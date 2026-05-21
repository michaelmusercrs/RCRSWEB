/**
 * Reviews fetcher — filters AT THE SOURCE so anything unsafe never enters
 * the "available to display" list.
 *
 * Per stated rule (Michael 2026-05-21):
 *   - Reviews mentioning competitors → filtered (never exposed as an option)
 *   - Anything less than 5-star → filtered
 *   - Negative sentiment → filtered (heuristic on text)
 *   - Reviews flagged as not approved or hidden → filtered
 *
 * The rep selects which to display from THIS filtered list. They can never
 * pick a review the source filter rejected.
 */

import { googleSheetsService } from './google-sheets-service';

export interface Review {
  id: string;
  name: string;          // reviewer name
  date: string;
  rating: number;        // numeric 1-5
  text: string;
  salesRep: string;      // attribution
  repSlug: string;
  source: string;        // Google / Facebook / BBB / direct
  visible: boolean;
  featured: boolean;
  approved: boolean;
}

// Competitor names that should never appear in customer-facing reviews.
// Add new entries here as they emerge — research scan flagged these:
const COMPETITOR_KEYWORDS = [
  'acculynx', 'accu lynx',
  'jobnimbus', 'job nimbus',
  'roofr',
  'companycam', 'company cam',
  'mighty dog',
  'best choice', 'best-choice',
  'yellowhammer', 'yellow hammer',
  'continental',
  'leak detectives',
  'sunbelt',
  'lone star',
  'erie',
  // Generic competitor terms — flag for human review even if it's praise
  'previous contractor', 'other roofing company', 'their competitor',
];

// Negative-sentiment heuristic. Reviews with these terms get filtered even
// if 5-star — they read as nuanced/negative and shouldn't be customer-facing.
const NEGATIVE_KEYWORDS = [
  ' but ', ' however ', ' although ', ' wish ', ' disappointed',
  ' not great', ' could be better', ' would not', ' wouldn\'t',
  ' missed', ' late', ' delay', ' issue', ' problem', ' complaint',
  ' refused', ' overcharged', ' unhappy',
];

function containsCompetitor(text: string): boolean {
  const lc = (text || '').toLowerCase();
  return COMPETITOR_KEYWORDS.some(k => lc.includes(k));
}

function containsNegative(text: string): boolean {
  const lc = ` ${(text || '').toLowerCase()} `;
  return NEGATIVE_KEYWORDS.some(k => lc.includes(k));
}

function parseReview(raw: Record<string, string>): Review | null {
  const rating = parseFloat(raw.rating || '0');
  if (isNaN(rating)) return null;
  return {
    id: raw.id || '',
    name: raw.name || '',
    date: raw.date || '',
    rating,
    text: raw.text || '',
    salesRep: raw.salesRep || '',
    repSlug: raw.repSlug || '',
    source: raw.source || '',
    visible: raw.visible === 'true' || raw.visible === 'TRUE',
    featured: raw.featured === 'true' || raw.featured === 'TRUE',
    approved: raw.approved === 'true' || raw.approved === 'TRUE',
  };
}

/**
 * Get reviews safe to expose to a rep as "available to display."
 *
 * Filters applied:
 *   - rating === 5  (anything less filtered out)
 *   - approved === true
 *   - visible !== false
 *   - text does not mention competitors
 *   - text does not contain negative-sentiment terms
 */
async function getSafeReviews(): Promise<Review[]> {
  const raw = await googleSheetsService.getReviews({ approvedOnly: true });
  const parsed = raw.map(parseReview).filter((r): r is Review => r !== null);
  return parsed.filter(r =>
    r.rating === 5 &&
    r.approved &&
    r.visible !== false &&
    !containsCompetitor(r.text) &&
    !containsNegative(r.text)
  );
}

/**
 * Reviews available for a rep to choose from. Combines personal reviews
 * (attributed to this rep via repSlug) with optional company-wide reviews
 * when reviewDisplayMode allows it.
 */
export async function getAvailableReviewsForRep(
  repSlug: string,
  mode: 'personal-only' | 'personal-plus-company-fallback' | 'company-only' = 'personal-plus-company-fallback'
): Promise<Review[]> {
  const safe = await getSafeReviews();
  // Match rep slug lenient: 'aaron', 'aaron-lussi', or stored salesRep name
  const personal = safe.filter(r =>
    r.repSlug === repSlug ||
    r.repSlug.startsWith(repSlug + '-') ||
    repSlug.startsWith(r.repSlug + '-')
  );

  switch (mode) {
    case 'personal-only':
      return personal;
    case 'company-only':
      return safe.filter(r => !r.repSlug); // unattributed = "general company" review
    case 'personal-plus-company-fallback':
    default: {
      const company = safe.filter(r => !r.repSlug);
      // If the rep has plenty of personal reviews, lean on those; otherwise
      // supplement with general company reviews to pad the count.
      return personal.length >= 5 ? personal : [...personal, ...company];
    }
  }
}

/**
 * Returns the reviews to ACTUALLY display on the customer welcome page,
 * given the rep's selected IDs (or auto-pick the top few if none chosen).
 *
 * If the rep has selected specific reviews via personalReviewIds, those
 * are returned (intersected with the safe list — defense in depth). If
 * they haven't picked any, we return the top 3 from their available set.
 */
export async function getDisplayReviewsForRep(
  repSlug: string,
  selectedIds: string,           // pipe-delimited list of review IDs
  mode: 'personal-only' | 'personal-plus-company-fallback' | 'company-only' = 'personal-plus-company-fallback'
): Promise<Review[]> {
  const available = await getAvailableReviewsForRep(repSlug, mode);
  if (!selectedIds) return available.slice(0, 3);
  const ids = new Set(selectedIds.split('|').map(s => s.trim()).filter(Boolean));
  return available.filter(r => ids.has(r.id));
}
