/**
 * Customer Portal global config. Single-row sheet (only the first row is
 * read; admin edits via /portal/admin/customer-portal-config).
 *
 * Defines:
 *   - Which tiles are ENABLED globally (admin ceiling)
 *   - Which rep-profile fields the customer portal is allowed to render
 *   - Allowed doc types
 *   - Token expiry, max photos
 *   - Layout order (tile-key array)
 *   - Analytics on/off
 *
 * Reps choose WITHIN this ceiling via their own per-rep prefs (separate).
 */
import fs from 'fs';
import path from 'path';

export interface CustomerPortalConfig {
  enabledTiles: string[];
  allowedRepDataFields: string[];
  allowedDocTypes: string[];
  maxPhotosPerJob: number;
  tokenExpiryDays: number;
  layoutOrder: string[];
  analyticsEnabled: boolean;
  watermarkCustomerName: boolean;
  weatherTileLocation: string;
  weatherDisclaimer: string;
  updatedAt: string;
  updatedBy: string;
}

const CONFIG_PATH = 'data/customer-portal-config.json';

export const DEFAULT_CONFIG: CustomerPortalConfig = {
  enabledTiles: [
    'rep-intro',
    'next-steps',
    'iko-visualizer',
    'contact',
    'photo-gallery',
    'about-rcrs',
    'weather-forecast',
  ],
  // Field allowlist — only these rep-profile fields can be rendered on the
  // customer portal. NEW fields default to NOT exposed (fail-safe).
  allowedRepDataFields: [
    'name',
    'phone',
    'bio',
    'headshotUrl',
    'truckPicUrl',
    'certifications',
    'yearsExperience',
    'favoriteQuote',
  ],
  // Doc types customers can be shown. Excludes internal-pricing, cost-breakdown.
  allowedDocTypes: [
    'inspection-report',
    'proposal-customer-facing',
    'warranty',
    'completion-cert',
    'before-after-summary',
  ],
  maxPhotosPerJob: 12,
  tokenExpiryDays: 90,
  layoutOrder: ['rep-intro', 'next-steps', 'photo-gallery', 'iko-visualizer', 'weather-forecast', 'about-rcrs', 'contact'],
  analyticsEnabled: true,
  watermarkCustomerName: true,
  weatherTileLocation: 'Huntsville, AL',
  weatherDisclaimer: 'This 5-day forecast is general weather for the Huntsville area. It is NOT a guarantee of when your project install will happen. Your sales rep will confirm your schedule directly.',
  updatedAt: '',
  updatedBy: '',
};

let _cache: CustomerPortalConfig | null = null;
let _cacheLoadedAt = 0;
const CACHE_TTL_MS = 60_000;

export function getCustomerPortalConfig(): CustomerPortalConfig {
  if (_cache && Date.now() - _cacheLoadedAt < CACHE_TTL_MS) return _cache;
  try {
    const raw = fs.readFileSync(path.join(process.cwd(), CONFIG_PATH), 'utf-8');
    const parsed = JSON.parse(raw);
    _cache = { ...DEFAULT_CONFIG, ...parsed };
    _cacheLoadedAt = Date.now();
    return _cache!;
  } catch {
    return DEFAULT_CONFIG;
  }
}

export function invalidateCustomerPortalConfigCache(): void {
  _cache = null;
  _cacheLoadedAt = 0;
}

export function saveCustomerPortalConfig(config: Partial<CustomerPortalConfig>, updatedBy: string): boolean {
  try {
    const current = getCustomerPortalConfig();
    const merged: CustomerPortalConfig = {
      ...current,
      ...config,
      updatedAt: new Date().toISOString(),
      updatedBy,
    };
    fs.writeFileSync(path.join(process.cwd(), CONFIG_PATH), JSON.stringify(merged, null, 2), 'utf-8');
    invalidateCustomerPortalConfigCache();
    return true;
  } catch (err) {
    console.warn('[CustomerPortalConfig] save failed (read-only fs?):', err);
    return false;
  }
}

/**
 * Field-level check — is the named rep-profile field allowed on the
 * customer portal? Returns false for any field NOT in the allowlist
 * (fail-safe — NEW fields default to internal-only).
 */
export function isFieldAllowed(fieldName: string): boolean {
  return getCustomerPortalConfig().allowedRepDataFields.includes(fieldName);
}

/**
 * Is the named tile enabled in the admin config?
 */
export function isTileEnabled(tileKey: string): boolean {
  return getCustomerPortalConfig().enabledTiles.includes(tileKey);
}
