/**
 * Warehouse Settings Service
 *
 * Stores the warehouse geofence config used by the auto-LOAD_VERIFIED
 * trigger in /api/warehouse/gps-ping. One config row (id = "default") for
 * now; if RCRS ever runs multiple warehouses we add more rows.
 *
 * Backing store: Google Sheets tab `WarehouseSettings`.
 * Falls back to the legacy WAREHOUSE_LAT/LNG env vars when the sheet is
 * empty so we never break the existing GPS ping flow.
 */

import { googleSheetsService } from './google-sheets-service';

const TAB_NAME = 'WarehouseSettings';
const HEADERS = [
  'settingsId',
  'warehouseLat',
  'warehouseLng',
  'geofenceRadiusMeters',
  'autoLoadVerifiedEnabled',
  'updatedAt',
  'updatedBy',
];
const DEFAULT_ID = 'default';

export interface WarehouseSettings {
  settingsId: string;
  warehouseLat: number;
  warehouseLng: number;
  /** Geofence radius in METERS. Default 100m. */
  geofenceRadiusMeters: number;
  /** Whether the gps-ping route should auto-fire LOAD_VERIFIED on exit. */
  autoLoadVerifiedEnabled: boolean;
  updatedAt: string;
  updatedBy: string;
}

function fallbackFromEnv(): WarehouseSettings {
  return {
    settingsId: DEFAULT_ID,
    warehouseLat: parseFloat(process.env.WAREHOUSE_LAT || '34.5536'),
    warehouseLng: parseFloat(process.env.WAREHOUSE_LNG || '-86.9806'),
    geofenceRadiusMeters: 100,
    autoLoadVerifiedEnabled: true,
    updatedAt: '',
    updatedBy: 'env-default',
  };
}

function parseRow(row: Record<string, string>): WarehouseSettings {
  const fallback = fallbackFromEnv();
  return {
    settingsId: row.settingsId || DEFAULT_ID,
    warehouseLat: Number(row.warehouseLat) || fallback.warehouseLat,
    warehouseLng: Number(row.warehouseLng) || fallback.warehouseLng,
    geofenceRadiusMeters:
      Number(row.geofenceRadiusMeters) || fallback.geofenceRadiusMeters,
    autoLoadVerifiedEnabled:
      row.autoLoadVerifiedEnabled === '' || row.autoLoadVerifiedEnabled === undefined
        ? fallback.autoLoadVerifiedEnabled
        : row.autoLoadVerifiedEnabled === 'true' || row.autoLoadVerifiedEnabled === '1',
    updatedAt: row.updatedAt || '',
    updatedBy: row.updatedBy || '',
  };
}

let cached: { value: WarehouseSettings; expires: number } | null = null;
const CACHE_TTL_MS = 60 * 1000; // 1 minute — gps-ping reads this on every ping

export async function getWarehouseSettings(force = false): Promise<WarehouseSettings> {
  if (!force && cached && Date.now() < cached.expires) return cached.value;

  try {
    const rows = await googleSheetsService.getGenericRows(TAB_NAME, HEADERS);
    const row = rows.find(r => r.settingsId === DEFAULT_ID) || rows[0];
    const value = row ? parseRow(row) : fallbackFromEnv();
    cached = { value, expires: Date.now() + CACHE_TTL_MS };
    return value;
  } catch (err) {
    console.warn('[warehouse-settings] getRows failed; using env fallback:', err);
    const value = fallbackFromEnv();
    cached = { value, expires: Date.now() + CACHE_TTL_MS };
    return value;
  }
}

export async function updateWarehouseSettings(updates: {
  warehouseLat?: number;
  warehouseLng?: number;
  geofenceRadiusMeters?: number;
  autoLoadVerifiedEnabled?: boolean;
  updatedBy: string;
}): Promise<WarehouseSettings> {
  const current = await getWarehouseSettings(true);

  const next: WarehouseSettings = {
    settingsId: DEFAULT_ID,
    warehouseLat: updates.warehouseLat ?? current.warehouseLat,
    warehouseLng: updates.warehouseLng ?? current.warehouseLng,
    geofenceRadiusMeters: updates.geofenceRadiusMeters ?? current.geofenceRadiusMeters,
    autoLoadVerifiedEnabled:
      updates.autoLoadVerifiedEnabled ?? current.autoLoadVerifiedEnabled,
    updatedAt: new Date().toISOString(),
    updatedBy: updates.updatedBy,
  };

  // Validate
  if (!Number.isFinite(next.warehouseLat) || Math.abs(next.warehouseLat) > 90) {
    throw new Error('warehouseLat must be a finite number in [-90, 90]');
  }
  if (!Number.isFinite(next.warehouseLng) || Math.abs(next.warehouseLng) > 180) {
    throw new Error('warehouseLng must be a finite number in [-180, 180]');
  }
  if (!Number.isFinite(next.geofenceRadiusMeters) || next.geofenceRadiusMeters < 10) {
    throw new Error('geofenceRadiusMeters must be at least 10');
  }
  if (next.geofenceRadiusMeters > 50_000) {
    throw new Error('geofenceRadiusMeters must be at most 50,000');
  }

  await googleSheetsService.upsertGenericRow(TAB_NAME, HEADERS, 'settingsId', {
    settingsId: next.settingsId,
    warehouseLat: next.warehouseLat,
    warehouseLng: next.warehouseLng,
    geofenceRadiusMeters: next.geofenceRadiusMeters,
    autoLoadVerifiedEnabled: next.autoLoadVerifiedEnabled,
    updatedAt: next.updatedAt,
    updatedBy: next.updatedBy,
  });

  cached = { value: next, expires: Date.now() + CACHE_TTL_MS };
  return next;
}

/**
 * Haversine distance in METERS between two lat/lng points.
 * Exposed because the gps-ping route does this calc on every ping; pull
 * it through one shared formula instead of duplicating.
 */
export function haversineDistanceMeters(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const toRad = (n: number) => (n * Math.PI) / 180;
  const R = 6_371_000; // Earth radius in METERS
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}
