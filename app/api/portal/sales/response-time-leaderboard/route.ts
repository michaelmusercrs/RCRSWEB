// Anonymized Response-Time Leaderboard
//
// Stated rule (Michael 2026-05-21): "shared leaderboard showing all reps
// avg time but no details about the actual value just a bar with a
// represented size and no individual or time range filters."
//
// Output contract — DO NOT add values or time filters here without
// explicit approval. The frontend renders bars only.
//
// - All reps are returned with a `barWidth` 0-100 (relative to fastest rep)
// - Names are HIDDEN except for the requester's own row (highlighted "you")
// - Absolute minute values are NOT exposed
// - No time-range parameter — fixed at last 30 days

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-service';
import { googleSheetsService } from '@/lib/google-sheets-service';
import { TEAM_MEMBERS, getSalesReps } from '@/lib/team-roles';

const WINDOW_DAYS = 30;
// Reps with fewer than this many responses don't show on the leaderboard
// at all (avoids fluky positions from one-off samples).
const MIN_SAMPLE = 3;

export async function GET(_request: NextRequest) {
  const auth = await requireAuth();
  if (!auth.authenticated) return auth.response;

  const ownSlug = (auth.user.userId || '').toLowerCase();
  const role = (auth.user.role || '').toLowerCase();

  // Customers cannot see the leaderboard. Everyone else can.
  if (role === 'customer') {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
  }

  try {
    const cutoff = Date.now() - WINDOW_DAYS * 86400000;
    const allLogs = await googleSheetsService.getLeadResponseLogs();
    const recent = allLogs.filter(l => {
      const t = new Date(l.assignedAt).getTime();
      return !isNaN(t) && t >= cutoff;
    });

    const byRep = new Map<string, number[]>();
    for (const log of recent) {
      const min = parseFloat(log.responseMinutes || '');
      if (isNaN(min) || min <= 0) continue;
      const arr = byRep.get(log.repSlug) || [];
      arr.push(min);
      byRep.set(log.repSlug, arr);
    }

    // Per-rep avg (filtered to MIN_SAMPLE)
    const activeReps = new Set(getSalesReps().map(r => r.slug));
    const ranked: Array<{ slug: string; avg: number; sample: number }> = [];
    for (const [slug, responses] of byRep) {
      // Lenient slug match: leaderboard membership should follow the active
      // sales-rep roster, but slugs in the log may differ (full-name vs
      // first-name). Match by first-name prefix as a fallback.
      const matchesActive = activeReps.has(slug) ||
        [...activeReps].some(s => slug === s || slug.startsWith(s + '-'));
      if (!matchesActive) continue;
      if (responses.length < MIN_SAMPLE) continue;
      const avg = responses.reduce((a, b) => a + b, 0) / responses.length;
      ranked.push({ slug, avg, sample: responses.length });
    }
    // Sort ascending (fastest first)
    ranked.sort((a, b) => a.avg - b.avg);

    if (!ranked.length) {
      return NextResponse.json({
        success: true,
        hasData: false,
        message: `Not enough response-log data yet (need ≥${MIN_SAMPLE} responses per rep in the last ${WINDOW_DAYS} days).`,
        bars: [],
      });
    }

    // Bar width: relative to fastest. Fastest = 100, slowest scales down.
    // Inverse mapping so the leader has the biggest bar.
    const fastest = ranked[0].avg;
    const slowest = ranked[ranked.length - 1].avg;
    const range = slowest - fastest;

    const bars = ranked.map((r, idx) => {
      // Inverse-linear: fastest = 100, slowest = 20 (so the slowest bar is
      // still visible). Keeps relative ranking visible without revealing
      // the underlying minute values.
      const fraction = range > 0 ? (slowest - r.avg) / range : 1;
      const barWidth = Math.round(20 + fraction * 80);
      const isYou = r.slug === ownSlug ||
        [...activeReps].some(s => r.slug === s + '-' + (TEAM_MEMBERS.find(m => m.slug === s)?.name.toLowerCase().split(' ')[1] || ''));
      // Display name: 'You' for self, otherwise anonymized
      return {
        rank: idx + 1,
        barWidth,
        isYou,
        label: isYou ? 'You' : `Rep ${String.fromCharCode(65 + idx)}`, // Rep A, Rep B, ...
        // sample/slug/avg deliberately omitted — endpoint must NOT leak the value
      };
    });

    return NextResponse.json({
      success: true,
      hasData: true,
      window: `last ${WINDOW_DAYS} days`,
      bars,
      meta: {
        totalReps: bars.length,
        note: 'Bar widths are relative-ranked. Absolute response times are intentionally not exposed via this endpoint.',
      },
    });
  } catch (err) {
    return NextResponse.json({
      success: false,
      error: err instanceof Error ? err.message : 'Failed to compute leaderboard',
    }, { status: 500 });
  }
}
