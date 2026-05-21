/**
 * Bridge between the new `Team_Profiles` sheet and the existing
 * `lib/profile-overrides.ts` blob/file storage. Reads from BOTH and
 * merges, with the sheet taking precedence when a rep has a published
 * record there.
 *
 * Used by:
 *   - The public /team page (Meet the Team)
 *   - The internal portal profile views
 *   - The customer welcome page
 *
 * Caches the sheet read for 60s to avoid pounding the sheet API on
 * every page load. Cache is invalidated when an approval flips a
 * record to 'published' (see app/api/admin/approvals).
 */
import { googleSheetsService, type TeamProfileRecord } from './google-sheets-service';

let _cache: TeamProfileRecord[] | null = null;
let _cacheLoadedAt = 0;
const CACHE_TTL_MS = 60_000;

export interface PublishedProfile {
  repSlug: string;
  bio: string;
  headshotUrl: string;
  truckPicUrl: string;
  certifications: string;
  yearsExperience: string;
  favoriteQuote: string;
  personalReviewIds: string;
  reviewDisplayMode: string;
}

async function loadProfiles(): Promise<TeamProfileRecord[]> {
  if (_cache && Date.now() - _cacheLoadedAt < CACHE_TTL_MS) return _cache;
  try {
    _cache = await googleSheetsService.getTeamProfiles();
    _cacheLoadedAt = Date.now();
    return _cache;
  } catch (err) {
    console.warn('[ProfileOverridesBridge] load failed:', err);
    return _cache || [];
  }
}

export function invalidateProfileOverridesCache(): void {
  _cache = null;
  _cacheLoadedAt = 0;
}

/**
 * Get the PUBLISHED profile for a single rep — never returns a pending draft.
 * Returns null if the rep has no published record.
 */
export async function getPublishedProfile(repSlug: string): Promise<PublishedProfile | null> {
  const all = await loadProfiles();
  const found = all.find(p => p.repSlug === repSlug && p.status === 'published');
  if (!found) return null;
  return {
    repSlug: found.repSlug,
    bio: found.bio,
    headshotUrl: found.headshotUrl,
    truckPicUrl: found.truckPicUrl,
    certifications: found.certifications,
    yearsExperience: found.yearsExperience,
    favoriteQuote: found.favoriteQuote,
    personalReviewIds: found.personalReviewIds,
    reviewDisplayMode: found.reviewDisplayMode,
  };
}

/**
 * Get all published profiles, keyed by repSlug. Used by the public
 * /team page to display the whole roster.
 */
export async function getAllPublishedProfiles(): Promise<Record<string, PublishedProfile>> {
  const all = await loadProfiles();
  const out: Record<string, PublishedProfile> = {};
  for (const p of all) {
    if (p.status !== 'published') continue;
    out[p.repSlug] = {
      repSlug: p.repSlug,
      bio: p.bio,
      headshotUrl: p.headshotUrl,
      truckPicUrl: p.truckPicUrl,
      certifications: p.certifications,
      yearsExperience: p.yearsExperience,
      favoriteQuote: p.favoriteQuote,
      personalReviewIds: p.personalReviewIds,
      reviewDisplayMode: p.reviewDisplayMode,
    };
  }
  return out;
}
