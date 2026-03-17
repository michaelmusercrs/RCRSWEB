/**
 * RCRS Warranties API
 *
 * GET  /api/warranties - List/search warranties
 * POST /api/warranties - Create a new warranty
 *
 * @author RCRS Development Team
 * @version 1.0.0
 */

import { NextRequest, NextResponse } from 'next/server';
import { warrantyService } from '@/lib/warranty-service';

/**
 * GET /api/warranties
 *
 * Query params:
 * - customerId: filter by customer
 * - status: active | expiring_soon | expired | claimed | voided
 * - type: manufacturer | workmanship | extended | leak_free
 * - manufacturer: GAF, Owens Corning, etc.
 * - search: text search across name, address, job ID
 * - expiringDays: number — return warranties expiring within N days
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const customerId = searchParams.get('customerId') || undefined;
    const status = searchParams.get('status') || undefined;
    const type = searchParams.get('type') || undefined;
    const manufacturer = searchParams.get('manufacturer') || undefined;
    const search = searchParams.get('search') || undefined;
    const expiringDaysStr = searchParams.get('expiringDays');
    const expiringDays = expiringDaysStr ? parseInt(expiringDaysStr, 10) : undefined;

    const warranties = warrantyService.searchWarranties({
      customerId,
      status,
      type,
      manufacturer,
      search,
      expiringDays,
    });

    const stats = warrantyService.getWarrantyStats();

    return NextResponse.json({
      success: true,
      warranties,
      total: warranties.length,
      stats,
    });
  } catch (error) {
    console.error('[Warranties API] GET error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch warranties' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/warranties
 *
 * Create a new warranty record.
 *
 * Body: see WarrantyService.createWarranty input type
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate required fields
    const required = ['customerName', 'customerPhone', 'address', 'type', 'startDate', 'durationYears', 'installedBy'];
    const missing = required.filter(f => !body[f]);
    if (missing.length > 0) {
      return NextResponse.json(
        { error: `Missing required fields: ${missing.join(', ')}` },
        { status: 400 }
      );
    }

    // Validate type
    const validTypes = ['manufacturer', 'workmanship', 'extended', 'leak_free'];
    if (!validTypes.includes(body.type)) {
      return NextResponse.json(
        { error: `Invalid warranty type. Must be one of: ${validTypes.join(', ')}` },
        { status: 400 }
      );
    }

    const warranty = warrantyService.createWarranty({
      customerId: body.customerId || `CUST-${Date.now()}`,
      customerName: body.customerName,
      customerPhone: body.customerPhone,
      customerEmail: body.customerEmail || '',
      address: body.address,
      jobId: body.jobId || `JOB-${Date.now()}`,
      jobNimbusId: body.jobNimbusId,
      type: body.type,
      manufacturer: body.manufacturer,
      productLine: body.productLine,
      startDate: body.startDate,
      durationYears: body.durationYears,
      installedBy: body.installedBy,
      inspectedBy: body.inspectedBy,
      notes: body.notes,
      certificateUrl: body.certificateUrl,
    });

    return NextResponse.json({
      success: true,
      warranty,
    }, { status: 201 });
  } catch (error) {
    console.error('[Warranties API] POST error:', error);
    return NextResponse.json(
      { error: 'Failed to create warranty' },
      { status: 500 }
    );
  }
}
