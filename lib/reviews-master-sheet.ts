/**
 * Reviews_Master — Sheets-backed master review table.
 *
 * One canonical record per review across ALL sources (Google, BBB, Yelp,
 * Facebook, direct). Reviews mentioning a team member are surfaced under the
 * member's /team/<slug> profile via mentionedTeam (CSV of slugs).
 *
 * This is the SECOND review surface — distinct from:
 *   - lib/rep-reviews.ts          (static data/reviews-master.json, build-time)
 *   - lib/portal-reviews.ts       (Vercel Blob, customer-submitted via portal)
 *
 * Reviews_Master is the live admin-controlled tab; admins import here and the
 * row's status decides whether it renders publicly.
 */

import crypto from 'crypto';
import { googleSheetsService } from './google-sheets-service';

export const REVIEWS_MASTER_TAB = 'Reviews_Master';

export const REVIEWS_MASTER_HEADERS = [
  'id',
  'source',
  'rating',
  'body',
  'author',
  'mentionedTeam', // CSV of team slugs
  'importDate',
  'status', // 'visible' | 'hidden' | 'flagged'
  'respondedAt',
  'respondedBy',
  'originalDate', // when the customer left the review (vs importDate)
  'sourceUrl',
] as const;

export type ReviewStatus = 'visible' | 'hidden' | 'flagged';
export type ReviewSource = 'google' | 'bbb' | 'yelp' | 'facebook' | 'direct' | 'other';

export interface MasterReview {
  id: string;
  source: ReviewSource;
  rating: number;
  body: string;
  author: string;
  mentionedTeam: string[];
  importDate: string;
  status: ReviewStatus;
  respondedAt?: string;
  respondedBy?: string;
  originalDate?: string;
  sourceUrl?: string;
}

function generateReviewId(): string {
  return `RVW-${crypto.randomBytes(6).toString('hex')}`;
}

function rowToReview(row: Record<string, string>): MasterReview {
  const ratingNum = Number(row.rating);
  const mentioned = (row.mentionedTeam || '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);

  return {
    id: row.id,
    source: ((row.source || 'other').toLowerCase() as ReviewSource),
    rating: Number.isFinite(ratingNum) ? ratingNum : 0,
    body: row.body || '',
    author: row.author || 'Anonymous',
    mentionedTeam: mentioned,
    importDate: row.importDate || '',
    status: ((row.status || 'visible') as ReviewStatus),
    respondedAt: row.respondedAt || undefined,
    respondedBy: row.respondedBy || undefined,
    originalDate: row.originalDate || undefined,
    sourceUrl: row.sourceUrl || undefined,
  };
}

export async function getMasterReviewsFromSheet(): Promise<MasterReview[]> {
  const rows = await googleSheetsService.getGenericRows(
    REVIEWS_MASTER_TAB,
    [...REVIEWS_MASTER_HEADERS],
  );
  return rows.map(rowToReview);
}

export async function getVisibleReviewsForMember(slug: string): Promise<MasterReview[]> {
  const all = await getMasterReviewsFromSheet();
  const slugLower = slug.toLowerCase();
  return all
    .filter((r) => r.status === 'visible' && r.mentionedTeam.includes(slugLower))
    .sort((a, b) => {
      const aDate = a.originalDate || a.importDate;
      const bDate = b.originalDate || b.importDate;
      return bDate.localeCompare(aDate);
    });
}

export async function getAllVisibleMasterReviews(): Promise<MasterReview[]> {
  const all = await getMasterReviewsFromSheet();
  return all
    .filter((r) => r.status === 'visible')
    .sort((a, b) => {
      const aDate = a.originalDate || a.importDate;
      const bDate = b.originalDate || b.importDate;
      return bDate.localeCompare(aDate);
    });
}

export interface ImportReviewInput {
  source: ReviewSource;
  rating: number;
  body: string;
  author: string;
  mentionedTeam?: string[];
  originalDate?: string;
  sourceUrl?: string;
}

/**
 * Idempotent import: same source + author + body + rating won't duplicate
 * (uses a deterministic hash for the id).
 */
function deterministicId(input: ImportReviewInput): string {
  const key = `${input.source}|${input.author}|${input.rating}|${input.body}`.toLowerCase();
  const hash = crypto.createHash('sha1').update(key).digest('hex').slice(0, 12);
  return `RVW-${hash}`;
}

export async function importMasterReviews(
  reviews: ImportReviewInput[],
): Promise<{ imported: number; skipped: number; ids: string[] }> {
  const existing = await getMasterReviewsFromSheet();
  const existingIds = new Set(existing.map((r) => r.id));
  const now = new Date().toISOString();

  const ids: string[] = [];
  let imported = 0;
  let skipped = 0;

  for (const r of reviews) {
    const id = deterministicId(r);
    if (existingIds.has(id)) {
      skipped++;
      continue;
    }

    const ok = await googleSheetsService.appendGenericRow(
      REVIEWS_MASTER_TAB,
      [...REVIEWS_MASTER_HEADERS],
      {
        id,
        source: r.source,
        rating: r.rating,
        body: r.body,
        author: r.author,
        mentionedTeam: (r.mentionedTeam || []).map((s) => s.toLowerCase()).join(','),
        importDate: now,
        status: 'visible',
        respondedAt: '',
        respondedBy: '',
        originalDate: r.originalDate || '',
        sourceUrl: r.sourceUrl || '',
      },
    );

    if (ok) {
      imported++;
      ids.push(id);
      existingIds.add(id);
    }
  }

  return { imported, skipped, ids };
}

export async function setReviewStatus(id: string, status: ReviewStatus, actor?: string): Promise<boolean> {
  return googleSheetsService.updateGenericRow(
    REVIEWS_MASTER_TAB,
    [...REVIEWS_MASTER_HEADERS],
    'id',
    id,
    {
      status,
      respondedAt: status === 'flagged' ? new Date().toISOString() : '',
      respondedBy: actor || '',
    },
  );
}

// Re-export the id helper for callers that need to mint ids without the
// deterministic dedupe path (e.g. direct-feedback / portal-submitted reviews).
export { generateReviewId };
