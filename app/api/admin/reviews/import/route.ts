/**
 * /api/admin/reviews/import
 *
 * Admin-only endpoint to bulk-import reviews into the Reviews_Master sheet tab.
 * Accepts a JSON paste — one of:
 *
 *   { source: 'google' | 'bbb' | 'yelp' | 'facebook' | 'direct' | 'other',
 *     reviews: ImportReviewInput[] }
 *
 * or
 *
 *   { reviews: Array<ImportReviewInput & { source: ReviewSource }> }
 *
 * GET returns the current import counts (per-source) for a quick health check.
 *
 * [needs-owner] We do not have API credentials for any of the sources below.
 * Until those exist, this endpoint accepts a JSON paste prepared manually OR
 * by a scraping cron. Owner action:
 *   - Google Business Profile API:  needs an OAuth refresh token tied to
 *     RCRS's Google Business account. See https://developers.google.com/my-business
 *   - BBB:                          BBB does not publish a public review API.
 *     Pull via Screaming Frog crawl or paid scraper.
 *   - Yelp Fusion API:              app key needed (free tier returns only 3
 *     review snippets per business — full reviews require Yelp's paid product).
 *   - Facebook Graph API:           page-access token with `pages_read_engagement`
 *     and `pages_show_list` scopes on the RCRS Facebook page.
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth-service';
import {
  importMasterReviews,
  getMasterReviewsFromSheet,
  type ImportReviewInput,
  type ReviewSource,
} from '@/lib/reviews-master-sheet';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const VALID_SOURCES: ReviewSource[] = ['google', 'bbb', 'yelp', 'facebook', 'direct', 'other'];

interface RawReviewInput {
  source?: string;
  rating?: number;
  body?: string;
  text?: string;
  author?: string;
  name?: string;
  mentionedTeam?: string[] | string;
  originalDate?: string;
  date?: string;
  sourceUrl?: string;
}

function normalizeReview(
  raw: RawReviewInput,
  defaultSource?: ReviewSource,
): ImportReviewInput | null {
  const sourceRaw = (raw.source || defaultSource || '').toString().toLowerCase();
  if (!VALID_SOURCES.includes(sourceRaw as ReviewSource)) return null;

  const ratingNum = typeof raw.rating === 'number' ? raw.rating : Number(raw.rating);
  if (!Number.isFinite(ratingNum) || ratingNum < 1 || ratingNum > 5) return null;

  const body = (raw.body || raw.text || '').toString().trim();
  if (!body) return null;

  const author = (raw.author || raw.name || 'Anonymous').toString().trim();

  let mentionedTeam: string[] = [];
  if (Array.isArray(raw.mentionedTeam)) {
    mentionedTeam = raw.mentionedTeam.map((s) => String(s));
  } else if (typeof raw.mentionedTeam === 'string') {
    mentionedTeam = raw.mentionedTeam.split(',').map((s) => s.trim());
  }

  return {
    source: sourceRaw as ReviewSource,
    rating: ratingNum,
    body,
    author,
    mentionedTeam: mentionedTeam.filter(Boolean),
    originalDate: (raw.originalDate || raw.date || '').toString() || undefined,
    sourceUrl: (raw.sourceUrl || '').toString() || undefined,
  };
}

export async function POST(request: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.authenticated) return auth.response;

  try {
    const body = await request.json();
    const defaultSourceRaw = (body.source || '').toString().toLowerCase();
    const defaultSource = VALID_SOURCES.includes(defaultSourceRaw as ReviewSource)
      ? (defaultSourceRaw as ReviewSource)
      : undefined;

    const rawReviews = Array.isArray(body.reviews) ? body.reviews : [];
    if (rawReviews.length === 0) {
      return NextResponse.json(
        { error: 'No reviews supplied. Provide `reviews: [...]` in the body.' },
        { status: 400 },
      );
    }

    const normalized: ImportReviewInput[] = [];
    const errors: Array<{ index: number; reason: string }> = [];
    rawReviews.forEach((raw: RawReviewInput, idx: number) => {
      const norm = normalizeReview(raw, defaultSource);
      if (norm) {
        normalized.push(norm);
      } else {
        errors.push({ index: idx, reason: 'Missing source/rating/body or invalid values' });
      }
    });

    if (normalized.length === 0) {
      return NextResponse.json(
        { error: 'No reviews passed validation.', errors },
        { status: 400 },
      );
    }

    const result = await importMasterReviews(normalized);

    return NextResponse.json({
      success: true,
      ...result,
      validationErrors: errors,
      needsOwner: defaultSource
        ? [`[needs-owner] API credentials for ${defaultSource} required to automate this import`]
        : [],
    });
  } catch (error) {
    console.error('[POST /api/admin/reviews/import] error:', error);
    return NextResponse.json(
      { error: 'Failed to import reviews.' },
      { status: 500 },
    );
  }
}

export async function GET() {
  const auth = await requireAdmin();
  if (!auth.authenticated) return auth.response;

  try {
    const all = await getMasterReviewsFromSheet();

    const bySource: Record<string, number> = {};
    const byStatus: Record<string, number> = {};
    let withMentions = 0;
    let totalRating = 0;

    for (const r of all) {
      bySource[r.source] = (bySource[r.source] || 0) + 1;
      byStatus[r.status] = (byStatus[r.status] || 0) + 1;
      if (r.mentionedTeam.length > 0) withMentions++;
      totalRating += r.rating;
    }

    return NextResponse.json({
      total: all.length,
      averageRating: all.length > 0 ? Number((totalRating / all.length).toFixed(2)) : 0,
      bySource,
      byStatus,
      withTeamMentions: withMentions,
      needsOwner: [
        '[needs-owner] Google Business Profile API OAuth refresh token',
        '[needs-owner] Yelp Fusion API key',
        '[needs-owner] Facebook Graph API page-access token (pages_read_engagement)',
        '[needs-owner] BBB scrape/feed (no public API)',
      ],
    });
  } catch (error) {
    console.error('[GET /api/admin/reviews/import] error:', error);
    return NextResponse.json({ error: 'Failed to load stats.' }, { status: 500 });
  }
}
