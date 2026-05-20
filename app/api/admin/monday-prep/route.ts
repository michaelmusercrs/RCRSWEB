/**
 * Admin: Monday Meeting Prep Auto-Fill API
 *
 * GET  - Build (or return cached) prep data for the upcoming Monday. Cached
 *        in-memory for 30 minutes so polling doesn't hammer the sheet/weather
 *        APIs. Owner/admin-only via requireRoleAtLeast.
 * POST - Save the (possibly owner-edited) deck draft to the `Monday Prep`
 *        sheet tab. Idempotent on weekStart.
 *
 * Per task spec:
 *   - role-gated to owner/admin (per [[project_rcrs_leaderboards]] cost
 *     visibility — this surface exposes commission cash + per-rep numbers)
 *   - numbers traced to a source; missing data flagged `null`, never zero
 *   - three leaderboards (sales / commission / activity) NEVER combined
 *   - no auto-send; owner reviews before anything goes external
 *
 * @author RCRS Development Team
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireRoleAtLeast } from '@/lib/auth-service';
import { cache, CACHE_TTL } from '@/lib/cache';
import { googleSheetsService } from '@/lib/google-sheets-service';
import {
  buildPrepData,
  type PrepData,
} from '@/lib/monday-prep-autofill';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const CACHE_KEY_PREFIX = 'monday-prep-autofill';
// 30 min cache so repeated polls don't hammer weather + sheet APIs
const CACHE_TTL_MS = 30 * 60 * 1000;

// =============================================================================
// Helpers
// =============================================================================

/**
 * Resolve the Monday this prep belongs to. If ?weekStart=YYYY-MM-DD is
 * provided, use that. Otherwise: if today is Mon-Sat, use this coming
 * Monday; if today is Sunday, also use the upcoming Monday.
 */
function resolveWeekStart(param?: string | null): string {
  if (param && /^\d{4}-\d{2}-\d{2}$/.test(param)) return param;

  const now = new Date();
  // Convert to Central Time (RCRS is Decatur AL)
  const ct = new Date(now.toLocaleString('en-US', { timeZone: 'America/Chicago' }));
  const dow = ct.getDay(); // 0=Sun..6=Sat
  // Days until upcoming Monday. Monday is the meeting day, so:
  //   Sun(0)->1, Mon(1)->0 (today), Tue(2)->6, ... Sat(6)->2
  const daysUntilMon = dow === 0 ? 1 : dow === 1 ? 0 : 8 - dow;
  ct.setDate(ct.getDate() + daysUntilMon);
  const y = ct.getFullYear();
  const m = String(ct.getMonth() + 1).padStart(2, '0');
  const d = String(ct.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// =============================================================================
// GET — build (or return cached) prep data
// =============================================================================

export async function GET(request: NextRequest) {
  const auth = await requireRoleAtLeast(['owner', 'admin']);
  if (!auth.authenticated) return auth.response;

  try {
    const { searchParams } = new URL(request.url);
    const weekStart = resolveWeekStart(searchParams.get('weekStart'));
    const force = searchParams.get('force') === '1';

    const cacheKey = `${CACHE_KEY_PREFIX}:${weekStart}`;
    if (!force) {
      const cached = cache.get<PrepData>(cacheKey);
      if (cached) {
        return NextResponse.json(
          { success: true, data: cached, cached: true },
          { headers: { 'Cache-Control': 'private, max-age=60' } }
        );
      }
    }

    const prepData = await buildPrepData({ weekStart });
    cache.set(cacheKey, prepData, CACHE_TTL_MS);

    // Also load the existing saved draft so the owner sees their last edits
    // sitting alongside the freshly-generated proposal.
    const savedRow = await googleSheetsService.getMondayPrep(weekStart);
    let savedDraft: PrepData | null = null;
    if (savedRow && savedRow.sections) {
      try {
        savedDraft = JSON.parse(savedRow.sections);
      } catch (err) {
        console.error('[monday-prep] Failed to parse saved sections:', err);
      }
    }

    return NextResponse.json(
      {
        success: true,
        data: prepData,
        savedDraft,
        savedMeta: savedRow
          ? {
              generatedAt: savedRow.generatedAt,
              reviewed: savedRow.reviewed === 'true',
              approved: savedRow.approved === 'true',
              approvedBy: savedRow.approvedBy || '',
              approvedAt: savedRow.approvedAt || '',
              updatedAt: savedRow.updatedAt || '',
            }
          : null,
        cached: false,
      },
      { headers: { 'Cache-Control': 'private, max-age=60' } }
    );
  } catch (error) {
    console.error('[monday-prep GET] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to generate Monday meeting prep',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

// =============================================================================
// POST — save the owner-edited prep deck draft to `Monday Prep` sheet tab
// =============================================================================

interface SavePayload {
  weekStart: string;
  sections: PrepData;       // the (possibly edited) prep data blob
  reviewed?: boolean;
  approved?: boolean;
}

export async function POST(request: NextRequest) {
  const auth = await requireRoleAtLeast(['owner', 'admin']);
  if (!auth.authenticated) return auth.response;

  try {
    const body = (await request.json()) as Partial<SavePayload>;

    if (!body.weekStart || !/^\d{4}-\d{2}-\d{2}$/.test(body.weekStart)) {
      return NextResponse.json(
        { success: false, error: 'weekStart (YYYY-MM-DD) is required' },
        { status: 400 }
      );
    }
    if (!body.sections || typeof body.sections !== 'object') {
      return NextResponse.json(
        { success: false, error: 'sections (PrepData object) is required' },
        { status: 400 }
      );
    }

    const reviewed = body.reviewed === true;
    const approved = body.approved === true;
    const userName = auth.user.name || auth.user.email || auth.user.userId || 'unknown';
    const now = new Date().toISOString();

    const ok = await googleSheetsService.saveMondayPrep({
      weekStart: body.weekStart,
      generatedAt: body.sections.generatedAt || now,
      sections: JSON.stringify(body.sections),
      reviewed: String(reviewed),
      approved: String(approved),
      approvedBy: approved ? userName : '',
      approvedAt: approved ? now : '',
    });

    if (!ok) {
      return NextResponse.json(
        { success: false, error: 'Failed to save Monday prep' },
        { status: 500 }
      );
    }

    // Invalidate the in-memory cache so the next GET reflects the save
    cache.invalidate(`${CACHE_KEY_PREFIX}:${body.weekStart}`);

    return NextResponse.json({
      success: true,
      data: {
        weekStart: body.weekStart,
        reviewed,
        approved,
        approvedBy: approved ? userName : '',
        approvedAt: approved ? now : '',
      },
    });
  } catch (error) {
    console.error('[monday-prep POST] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to save Monday meeting prep',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
