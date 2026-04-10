/**
 * Driver Locations API (read-side for the office)
 *
 * Returns the latest known GPS coordinates for every driver. Powers the
 * /portal/manager/driver-map page so the office can see Rick / Tae on a
 * map and intercept them with extra material if needed.
 *
 * GET /api/portal/driver-locations
 *
 * Auth: office, admin, owner, manager only. Sales reps and customers
 * never see live driver positions.
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-service';
import { googleSheetsService, SHEET_NAMES } from '@/lib/google-sheets-service';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const HEADERS = [
  'userId',
  'userName',
  'lat',
  'lng',
  'accuracy',
  'distanceMiles',
  'updatedAt',
];

const ALLOWED_ROLES = new Set(['admin', 'owner', 'office', 'manager', 'project_manager', 'pm']);

export async function GET(_request: NextRequest) {
  const auth = await requireAuth();
  if (!auth.authenticated) return auth.response;
  if (!ALLOWED_ROLES.has(auth.user.role)) {
    return NextResponse.json({ error: 'Office/admin/manager role required' }, { status: 403 });
  }

  try {
    const rows = await googleSheetsService.getGenericRows(SHEET_NAMES.DRIVER_LOCATIONS, HEADERS);
    const drivers = rows
      .filter(r => r.userId && r.lat && r.lng)
      .map(r => ({
        userId: r.userId,
        userName: r.userName,
        lat: parseFloat(r.lat),
        lng: parseFloat(r.lng),
        accuracy: r.accuracy ? parseFloat(r.accuracy) : null,
        distanceMiles: parseFloat(r.distanceMiles) || 0,
        updatedAt: r.updatedAt,
        // Time since last ping (helpful for "is this driver online?")
        ageSeconds: r.updatedAt
          ? Math.round((Date.now() - new Date(r.updatedAt).getTime()) / 1000)
          : null,
      }))
      .filter(d => Number.isFinite(d.lat) && Number.isFinite(d.lng))
      .sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));

    return NextResponse.json({ drivers });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
