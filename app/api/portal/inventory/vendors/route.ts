/**
 * /api/portal/inventory/vendors — CRUD for the inventory vendor catalog.
 *
 * Backed by lib/vendor-service (Sheets `Vendors` tab). Admin/owner only.
 * GET    ?action=list — list all vendors
 * GET    ?action=get&vendorId=X — single vendor
 * POST   { action:'create', vendor } — create new
 * PATCH  { vendorId, updates } — update fields
 * DELETE ?vendorId=X — soft-delete (active=false)
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-service';
import { auditLog } from '@/lib/audit-logger';
import { vendorService } from '@/lib/vendor-service';

function isAdmin(role: string): boolean {
  return role === 'admin' || role === 'owner';
}

export async function GET(request: NextRequest) {
  const auth = await requireAuth();
  if (!auth.authenticated) return auth.response;
  // GET is allowed for any signed-in role — restock + low-stock pages need
  // the vendor list to populate dropdowns. Write ops are admin-only.
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action') || 'list';
    if (action === 'get') {
      const id = searchParams.get('vendorId');
      if (!id) return NextResponse.json({ error: 'vendorId required' }, { status: 400 });
      const vendor = await vendorService.getById(id);
      if (!vendor) return NextResponse.json({ error: 'Vendor not found' }, { status: 404 });
      return NextResponse.json(vendor);
    }
    const activeOnly = searchParams.get('activeOnly') === '1';
    const vendors = await vendorService.list({ activeOnly });
    return NextResponse.json({ vendors });
  } catch (err) {
    console.error('[vendor api] GET error', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth();
  if (!auth.authenticated) return auth.response;
  if (!isAdmin(auth.user.role)) {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }
  try {
    const body = await request.json();
    if (body.action !== 'create' || !body.vendor?.name) {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
    }
    const vendor = await vendorService.create(body.vendor);
    auditLog('VENDOR_CREATE', auth.user.email, `Created vendor: ${vendor.name} (${vendor.vendorId})`, request);
    return NextResponse.json(vendor, { status: 201 });
  } catch (err) {
    console.error('[vendor api] POST error', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  const auth = await requireAuth();
  if (!auth.authenticated) return auth.response;
  if (!isAdmin(auth.user.role)) {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }
  try {
    const body = await request.json();
    const { vendorId, updates } = body;
    if (!vendorId) return NextResponse.json({ error: 'vendorId required' }, { status: 400 });
    const vendor = await vendorService.update(vendorId, updates || {});
    if (!vendor) return NextResponse.json({ error: 'Vendor not found' }, { status: 404 });
    auditLog('VENDOR_UPDATE', auth.user.email, `Updated vendor ${vendor.name}: ${Object.keys(updates || {}).join(', ')}`, request);
    return NextResponse.json(vendor);
  } catch (err) {
    console.error('[vendor api] PATCH error', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const auth = await requireAuth();
  if (!auth.authenticated) return auth.response;
  if (!isAdmin(auth.user.role)) {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }
  try {
    const { searchParams } = new URL(request.url);
    const vendorId = searchParams.get('vendorId');
    if (!vendorId) return NextResponse.json({ error: 'vendorId required' }, { status: 400 });
    const ok = await vendorService.deactivate(vendorId);
    if (!ok) return NextResponse.json({ error: 'Vendor not found' }, { status: 404 });
    auditLog('VENDOR_DELETE', auth.user.email, `Deactivated vendor ${vendorId}`, request);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[vendor api] DELETE error', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
