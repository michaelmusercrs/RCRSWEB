import { NextRequest, NextResponse } from 'next/server';
import { warrantyService } from '@/lib/warranty-service';
import { leadPortalService } from '@/lib/lead-portal-service';
import { recordWarrantyClaim } from '@/lib/customer-portal-sheets';
import crypto from 'crypto';

// warrantyService keeps an in-memory copy; the Sheets row (this shape) is
// the durable record that survives server restarts.
interface WarrantyClaimRecord {
  id: string;
  warrantyId: string;
  customerId: string;
  customerName: string;
  customerAddress: string;
  customerPhone: string;
  customerEmail: string;
  repSlug: string;
  repName: string;
  jobId: string;
  category: string;
  severity: string;
  issueDescription: string;
  photos: string;
  status: string;
  resolution?: string;
  repairDate?: string;
  coveredByWarranty?: boolean;
  createdAt: string;
  updatedAt: string;
}

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Validate token and return customer info
async function validateCustomerToken(token: string) {
  if (!token) return null;

  const lead = await leadPortalService.getLeadByToken(token);
  if (lead) {
    return {
      customerId: lead.customerId,
      customerName: lead.customerName,
      customerAddress: lead.customerAddress || '',
      customerPhone: lead.customerPhone || '',
      customerEmail: lead.customerEmail || '',
      repSlug: lead.salesRepSlug,
      repName: lead.salesRepName,
      jobId: lead.jobnimbusId,
    };
  }

  return null;
}

const VALID_CATEGORIES = ['leak', 'shingle_damage', 'flashing', 'gutter', 'ventilation', 'other'] as const;
const VALID_URGENCY = ['minor', 'moderate', 'major', 'emergency'] as const;

// POST - Submit a warranty claim
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { token, issueDescription, category, urgency, photos, warrantyId } = body;

    if (!token) {
      return NextResponse.json({ error: 'Token is required' }, { status: 401 });
    }

    if (!issueDescription || issueDescription.trim().length === 0) {
      return NextResponse.json({ error: 'Issue description is required' }, { status: 400 });
    }

    if (!category || !VALID_CATEGORIES.includes(category)) {
      return NextResponse.json({ error: 'Valid category is required' }, { status: 400 });
    }

    if (!urgency || !VALID_URGENCY.includes(urgency)) {
      return NextResponse.json({ error: 'Valid urgency level is required' }, { status: 400 });
    }

    const customer = await validateCustomerToken(token);
    if (!customer) {
      return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 });
    }

    // Find existing warranty for this customer, or use provided warrantyId
    let targetWarrantyId = warrantyId;

    if (!targetWarrantyId) {
      const warranties = await warrantyService.getWarrantiesByCustomer(customer.customerId);
      const activeWarranty = warranties.find(w => w.status === 'active' || w.status === 'expiring_soon' || w.status === 'claimed');

      if (activeWarranty) {
        targetWarrantyId = activeWarranty.id;
      } else {
        // Create a placeholder warranty if none exists
        const newWarranty = await warrantyService.createWarranty({
          customerId: customer.customerId,
          customerName: customer.customerName,
          customerPhone: customer.customerPhone,
          customerEmail: customer.customerEmail,
          address: customer.customerAddress,
          jobId: customer.jobId || `JOB-${Date.now()}`,
          type: 'workmanship',
          startDate: new Date().toISOString().split('T')[0],
          durationYears: 5,
          installedBy: customer.repName || 'River City Roofing',
          notes: 'Auto-created from customer warranty claim submission',
        });
        targetWarrantyId = newWarranty.id;
      }
    }

    const claim = await warrantyService.submitClaim(targetWarrantyId, {
      issueDescription: issueDescription.trim(),
      category,
      severity: urgency,
      photos: photos || [],
      notes: `Submitted by customer via portal. Customer: ${customer.customerName}`,
    });

    if (!claim) {
      return NextResponse.json({ error: 'Failed to submit warranty claim' }, { status: 500 });
    }

    // Persist to Google Sheets so the claim survives server restarts.
    // warrantyService keeps an in-memory/local copy; the Sheets row is the durable record.
    const now = new Date().toISOString();
    const sheetClaim: WarrantyClaimRecord = {
      id: claim.id || `WCL-${crypto.randomBytes(6).toString('hex')}`,
      warrantyId: targetWarrantyId,
      customerId: customer.customerId,
      customerName: customer.customerName,
      customerAddress: customer.customerAddress,
      customerPhone: customer.customerPhone,
      customerEmail: customer.customerEmail,
      repSlug: customer.repSlug,
      repName: customer.repName,
      jobId: customer.jobId || '',
      category,
      severity: urgency,
      issueDescription: issueDescription.trim(),
      photos: Array.isArray(photos) ? JSON.stringify(photos) : (photos || ''),
      status: 'submitted',
      createdAt: now,
      updatedAt: now,
    };

    // Fire-and-forget sheet append. Never blocks the customer response,
    // never throws — see lib/customer-portal-sheets.ts. warrantyService
    // already holds the in-memory/local copy above.
    recordWarrantyClaim({
      id: sheetClaim.id,
      warrantyId: sheetClaim.warrantyId,
      customerId: sheetClaim.customerId,
      customerName: sheetClaim.customerName,
      customerAddress: sheetClaim.customerAddress,
      customerPhone: sheetClaim.customerPhone,
      customerEmail: sheetClaim.customerEmail,
      repSlug: sheetClaim.repSlug,
      repName: sheetClaim.repName,
      jobId: sheetClaim.jobId,
      category: sheetClaim.category,
      severity: sheetClaim.severity,
      issueDescription: sheetClaim.issueDescription,
      photos: sheetClaim.photos,
      status: sheetClaim.status,
      createdAt: sheetClaim.createdAt,
      updatedAt: sheetClaim.updatedAt,
    }).catch(() => {});

    return NextResponse.json({
      success: true,
      claim: {
        id: claim.id,
        warrantyId: targetWarrantyId,
        status: claim.status,
        category: claim.category,
        severity: claim.severity,
        issueDescription: claim.issueDescription,
        createdAt: claim.createdAt,
      },
    });
  } catch (error) {
    console.error('Error submitting warranty claim:', error);
    return NextResponse.json({ error: 'Failed to submit warranty claim' }, { status: 500 });
  }
}

// GET - Get existing warranty claims for this customer
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');

    if (!token) {
      return NextResponse.json({ error: 'Token is required' }, { status: 401 });
    }

    const customer = await validateCustomerToken(token);
    if (!customer) {
      return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 });
    }

    // TODO: read from Sheets once leadPortalService has getWarrantyClaimsByCustomer.
    // warrantyService is the in-memory source until then.
    const sheetClaims: WarrantyClaimRecord[] = [];
    const warranties = await warrantyService.getWarrantiesByCustomer(customer.customerId);

    const memoryClaims = warranties.flatMap(w =>
      w.claims.map(c => ({
        id: c.id,
        warrantyId: w.id,
        warrantyType: w.type,
        status: c.status,
        category: c.category,
        severity: c.severity,
        issueDescription: c.issueDescription,
        resolution: c.resolution,
        repairDate: c.repairDate,
        coveredByWarranty: c.coveredByWarranty,
        photos: c.photos,
        createdAt: c.createdAt,
        updatedAt: c.updatedAt,
      }))
    );

    // Build a deduped list. Prefer Sheets row when IDs match.
    const seenIds = new Set<string>();
    const merged: Array<{
      id: string;
      warrantyId: string;
      warrantyType?: string;
      status: string;
      category: string;
      severity: string;
      issueDescription: string;
      resolution?: string;
      repairDate?: string;
      coveredByWarranty?: boolean;
      photos: string[];
      createdAt: string;
      updatedAt: string;
    }> = [];

    for (const c of sheetClaims) {
      let parsedPhotos: string[] = [];
      try {
        if (c.photos) parsedPhotos = JSON.parse(c.photos);
      } catch {
        parsedPhotos = c.photos ? [c.photos] : [];
      }
      merged.push({
        id: c.id,
        warrantyId: c.warrantyId,
        status: c.status,
        category: c.category,
        severity: c.severity,
        issueDescription: c.issueDescription,
        resolution: c.resolution,
        repairDate: c.repairDate,
        coveredByWarranty: c.coveredByWarranty,
        photos: parsedPhotos,
        createdAt: c.createdAt,
        updatedAt: c.updatedAt,
      });
      seenIds.add(c.id);
    }

    for (const c of memoryClaims) {
      if (!seenIds.has(c.id)) merged.push(c as typeof merged[number]);
    }

    // Sort newest first
    merged.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return NextResponse.json({
      claims: merged,
      warranties: warranties.map(w => ({
        id: w.id,
        type: w.type,
        status: w.status,
        startDate: w.startDate,
        endDate: w.endDate,
        manufacturer: w.manufacturer,
      })),
    });
  } catch (error) {
    console.error('Error fetching warranty claims:', error);
    return NextResponse.json({ error: 'Failed to fetch warranty claims' }, { status: 500 });
  }
}
