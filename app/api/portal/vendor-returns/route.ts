/**
 * Vendor Returns API
 *
 * POST   /api/portal/vendor-returns        Create a vendor return + email Sara
 * GET    /api/portal/vendor-returns        List recent (limit query param)
 * GET    /api/portal/vendor-returns?id=    Get one
 * GET    /api/portal/vendor-returns?job=   Get all for a job number
 * PATCH  /api/portal/vendor-returns        Sara marks credited (admin/office only)
 *
 * Vendor returns track materials Rick picks up from a job that came from
 * an OUTSIDE supplier (SRS, ABC, etc.) — NOT in our catalog. Sara needs to
 * chase the credit and post it against the job.
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-service';
import { vendorReturnService, type VendorReturnLine } from '@/lib/vendor-return-service';
import { emailService } from '@/lib/email-service';
import { auditLog } from '@/lib/audit-logger';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const ALLOWED_CREATE_ROLES = new Set(['driver', 'admin', 'owner', 'office', 'manager']);
const ALLOWED_PATCH_ROLES = new Set(['admin', 'owner', 'office']);

export async function GET(request: NextRequest) {
  const auth = await requireAuth();
  if (!auth.authenticated) return auth.response;

  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  const job = searchParams.get('job');
  const limit = parseInt(searchParams.get('limit') || '50');

  try {
    if (id) {
      const record = await vendorReturnService.getById(id);
      if (!record) return NextResponse.json({ error: 'Not found' }, { status: 404 });
      return NextResponse.json(record);
    }
    if (job) {
      const records = await vendorReturnService.getByJob(job);
      return NextResponse.json({ records });
    }
    const records = await vendorReturnService.getRecent(limit);
    return NextResponse.json({ records });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth();
  if (!auth.authenticated) return auth.response;
  if (!ALLOWED_CREATE_ROLES.has(auth.user.role)) {
    return NextResponse.json({ error: 'Driver/office/admin role required' }, { status: 403 });
  }

  let body: {
    jobNumber?: string;
    jobName?: string;
    customerName?: string;
    pickupAddress?: string;
    vendorName?: string;
    vendorReceiptNumber?: string;
    lines?: VendorReturnLine[];
    photoUrl?: string;
    notes?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  if (!body.jobNumber) {
    return NextResponse.json({ error: 'jobNumber is required' }, { status: 400 });
  }
  if (!body.vendorName) {
    return NextResponse.json({ error: 'vendorName is required' }, { status: 400 });
  }
  if (!body.lines || !Array.isArray(body.lines) || body.lines.length === 0) {
    return NextResponse.json({ error: 'At least one line is required' }, { status: 400 });
  }

  // Sanitize lines — only the fields the schema expects
  const lines: VendorReturnLine[] = body.lines.map(l => ({
    description: String(l.description || '').trim(),
    quantity: Number(l.quantity) || 0,
    unit: l.unit ? String(l.unit) : undefined,
    estimatedValue: l.estimatedValue ? Number(l.estimatedValue) : undefined,
    notes: l.notes ? String(l.notes) : undefined,
  })).filter(l => l.description && l.quantity > 0);

  if (lines.length === 0) {
    return NextResponse.json({ error: 'No valid lines provided' }, { status: 400 });
  }

  try {
    const record = await vendorReturnService.create({
      jobNumber: body.jobNumber,
      jobName: body.jobName,
      customerName: body.customerName,
      pickupAddress: body.pickupAddress,
      vendorName: body.vendorName,
      vendorReceiptNumber: body.vendorReceiptNumber,
      lines,
      pickedUpBy: auth.user.userId,
      pickedUpByName: auth.user.name,
      photoUrl: body.photoUrl,
      notes: body.notes,
    });

    // Notify Sara — INTERNAL ONLY. Customer never sees this.
    try {
      await emailService.sendVendorReturnNotification({
        vendorReturnId: record.vendorReturnId,
        jobNumber: record.jobNumber,
        customerName: record.customerName,
        pickupAddress: record.pickupAddress,
        vendorName: record.vendorName,
        vendorReceiptNumber: record.vendorReceiptNumber,
        pickedUpByName: record.pickedUpByName,
        lines: record.lines.map(l => ({
          description: l.description,
          quantity: l.quantity,
          unit: l.unit,
          estimatedValue: l.estimatedValue,
        })),
        estimatedTotalValue: record.estimatedTotalValue,
        notes: record.notes,
        photoUrl: record.photoUrl,
      });
    } catch (emailErr) {
      console.warn('[vendor-returns] Failed to notify office:', emailErr);
    }

    // Audit log — never break the business logic
    try {
      auditLog(
        'VENDOR_RETURN_CREATED',
        auth.user.email,
        `Vendor return ${record.vendorReturnId} created. Vendor: ${record.vendorName}. Job: ${record.jobNumber}. Lines: ${record.lines.length}. Est. value: $${record.estimatedTotalValue || 0}.`,
        request
      );
    } catch (auditErr) {
      console.warn('[audit] VENDOR_RETURN_CREATED log failed:', auditErr);
    }

    return NextResponse.json({ success: true, vendorReturn: record });
  } catch (err) {
    console.error('[vendor-returns] create failed:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}

export async function PATCH(request: NextRequest) {
  const auth = await requireAuth();
  if (!auth.authenticated) return auth.response;
  if (!ALLOWED_PATCH_ROLES.has(auth.user.role)) {
    return NextResponse.json({ error: 'Office/admin/owner role required' }, { status: 403 });
  }

  let body: {
    vendorReturnId?: string;
    vendorCreditMemoNumber?: string;
    actualCreditAmount?: number;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  if (!body.vendorReturnId || !body.vendorCreditMemoNumber || body.actualCreditAmount == null) {
    return NextResponse.json(
      { error: 'vendorReturnId, vendorCreditMemoNumber, and actualCreditAmount are required' },
      { status: 400 },
    );
  }

  // Fetch the record first so we can include vendor name in the audit log
  const record = await vendorReturnService.getById(body.vendorReturnId);

  const ok = await vendorReturnService.markCredited({
    vendorReturnId: body.vendorReturnId,
    vendorCreditMemoNumber: body.vendorCreditMemoNumber,
    actualCreditAmount: Number(body.actualCreditAmount),
  });

  if (!ok) return NextResponse.json({ error: 'Vendor return not found' }, { status: 404 });

  // Audit log — never break the business logic
  try {
    auditLog(
      'VENDOR_RETURN_CREDITED',
      auth.user.email,
      `Vendor return ${body.vendorReturnId} marked credited. Vendor: ${record?.vendorName || 'unknown'}. Credit memo: ${body.vendorCreditMemoNumber}. Amount: $${body.actualCreditAmount || 0}.`,
      request
    );
  } catch (auditErr) {
    console.warn('[audit] VENDOR_RETURN_CREDITED log failed:', auditErr);
  }

  return NextResponse.json({ success: true });
}
