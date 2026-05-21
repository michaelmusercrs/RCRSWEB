/**
 * Customer Portal tile registry.
 *
 * Each tile DECLARES which fields it reads from the rep profile. The admin
 * config's `allowedRepDataFields` is the source of truth — a tile cannot
 * render a field admin hasn't allowed, even if it asks for it.
 *
 * Defense-in-depth: this enforcement is at the data-shaping layer, NOT
 * inside the tile component itself. When this module assembles a tile's
 * payload, it filters disallowed fields out before passing them down.
 */

import { isFieldAllowed, isTileEnabled, getCustomerPortalConfig } from './customer-portal-config';

export type TileKey =
  | 'rep-intro'
  | 'next-steps'
  | 'iko-visualizer'
  | 'contact'
  | 'photo-gallery'
  | 'about-rcrs'
  | 'weather-forecast';

interface TileDefinition {
  key: TileKey;
  label: string;
  description: string;
  fieldsRead: string[];       // rep-profile fields this tile needs
  needsLeadData: boolean;     // does this tile need lead-specific data (address, etc.)
}

export const TILE_REGISTRY: Record<TileKey, TileDefinition> = {
  'rep-intro': {
    key: 'rep-intro',
    label: 'Rep Introduction',
    description: 'Headshot, bio, certifications, quote, and call button',
    fieldsRead: ['name', 'phone', 'bio', 'headshotUrl', 'truckPicUrl', 'certifications', 'yearsExperience', 'favoriteQuote'],
    needsLeadData: false,
  },
  'next-steps': {
    key: 'next-steps',
    label: 'What Happens Next',
    description: 'Welcome message + what the customer should expect',
    fieldsRead: [],
    needsLeadData: false,
  },
  'iko-visualizer': {
    key: 'iko-visualizer',
    label: 'IKO Roof Visualizer',
    description: 'Link to IKO\'s free roof color/style visualizer tool',
    fieldsRead: [],
    needsLeadData: false,
  },
  'contact': {
    key: 'contact',
    label: 'Contact Card',
    description: 'Phone + text + email links to the assigned rep',
    fieldsRead: ['name', 'phone'],
    needsLeadData: false,
  },
  'photo-gallery': {
    key: 'photo-gallery',
    label: 'Job Photo Gallery',
    description: 'Photos from this customer\'s job (rep-approved only)',
    fieldsRead: [],
    needsLeadData: true,
  },
  'about-rcrs': {
    key: 'about-rcrs',
    label: 'About RCRS',
    description: 'Short company blurb + certifications + phone',
    fieldsRead: [],
    needsLeadData: false,
  },
  'weather-forecast': {
    key: 'weather-forecast',
    label: '5-Day Forecast',
    description: 'Huntsville-area weather forecast with install-schedule disclaimer',
    fieldsRead: [],
    needsLeadData: false,
  },
};

/**
 * Given the full set of rep-profile data, return only the fields a given
 * tile is allowed to read.
 *
 *   filterTileFields('rep-intro', { name, phone, bio, headshotUrl, ... })
 *     → only the fields admin has allowed AND the tile declares it reads.
 *
 * Defense in depth: even if the tile component requests `internalNotes`,
 * it never reaches the render path.
 */
export function filterTileFields(
  tileKey: TileKey,
  fullData: Record<string, unknown>,
): Record<string, unknown> {
  const tile = TILE_REGISTRY[tileKey];
  if (!tile) return {};
  const out: Record<string, unknown> = {};
  for (const field of tile.fieldsRead) {
    // Must be in the tile's declared reads AND in admin's field allowlist
    if (!isFieldAllowed(field)) continue;
    if (fullData[field] !== undefined) out[field] = fullData[field];
  }
  return out;
}

/**
 * Get the ordered list of tile keys to render, intersected with the admin's
 * enabled set. Layout order is admin-controlled.
 */
export function getOrderedActiveTiles(): TileKey[] {
  const cfg = getCustomerPortalConfig();
  const order = cfg.layoutOrder.length ? cfg.layoutOrder : Object.keys(TILE_REGISTRY);
  return order.filter((k): k is TileKey => k in TILE_REGISTRY && isTileEnabled(k));
}
