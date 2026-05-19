/**
 * Warehouse Settings API
 *
 * Admin-only CRUD for the warehouse geofence config used by the
 * Phase 5 auto-LOAD_VERIFIED trigger.
 *
 * GET  /api/portal/admin/warehouse-settings  → current settings
 * PUT  /api/portal/admin/warehouse-settings  → update (admin/owner only)
 *
 * Settings live on the `WarehouseSettings` Google Sheet tab.
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth-service';
import {
  getWarehouseSettings,
  updateWarehouseSettings,
} from '@/lib/warehouse-settings-service';
import { logConfigChange } from '@/lib/audit-sheet-logger';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  const auth = await requireAdmin();
  if (!auth.authenticated) return auth.response;

  try {
    const settings = await getWarehouseSettings(true);
    return NextResponse.json({ success: true, settings });
  } catch (err) {
    console.error('[warehouse-settings GET] failed:', err);
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Read failed' },
      { status: 500 },
    );
  }
}

export async function PUT(request: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.authenticated) return auth.response;

  let body: {
    warehouseLat?: number;
    warehouseLng?: number;
    geofenceRadiusMeters?: number;
    autoLoadVerifiedEnabled?: boolean;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON' }, { status: 400 });
  }

  // Coerce — JSON parsers sometimes hand back strings from form inputs
  const updates: Parameters<typeof updateWarehouseSettings>[0] = {
    updatedBy: auth.user.email || auth.user.name,
  };
  if (body.warehouseLat !== undefined) updates.warehouseLat = Number(body.warehouseLat);
  if (body.warehouseLng !== undefined) updates.warehouseLng = Number(body.warehouseLng);
  if (body.geofenceRadiusMeters !== undefined) {
    updates.geofenceRadiusMeters = Number(body.geofenceRadiusMeters);
  }
  if (body.autoLoadVerifiedEnabled !== undefined) {
    updates.autoLoadVerifiedEnabled = Boolean(body.autoLoadVerifiedEnabled);
  }

  try {
    const before = await getWarehouseSettings(true);
    const next = await updateWarehouseSettings(updates);

    // Fire-and-forget audit
    logConfigChange({
      action: 'warehouse_settings_updated',
      section: 'warehouse',
      changedBy: auth.user.email,
      changedByName: auth.user.name,
      before: JSON.stringify({
        lat: before.warehouseLat,
        lng: before.warehouseLng,
        radius: before.geofenceRadiusMeters,
        autoEnabled: before.autoLoadVerifiedEnabled,
      }),
      after: JSON.stringify({
        lat: next.warehouseLat,
        lng: next.warehouseLng,
        radius: next.geofenceRadiusMeters,
        autoEnabled: next.autoLoadVerifiedEnabled,
      }),
      details: `Warehouse geofence updated (radius ${next.geofenceRadiusMeters}m, auto-LOAD_VERIFIED ${next.autoLoadVerifiedEnabled ? 'ON' : 'off'})`,
    }).catch(() => {});

    return NextResponse.json({ success: true, settings: next });
  } catch (err) {
    console.error('[warehouse-settings PUT] failed:', err);
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Update failed' },
      { status: 400 },
    );
  }
}
