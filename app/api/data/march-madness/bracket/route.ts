/**
 * API Route: /api/data/march-madness/bracket
 *
 * GET  - Returns bracket data (from Google Sheets if available, falls back to JSON)
 * POST - Update a rep's weekly sales (requires repName, week, sales)
 * PUT  - Initialize/reset the bracket on the Google Sheet
 */

import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-service';
import { readFileSync } from 'fs';
import { join } from 'path';
import { googleSheetsService, SHEET_NAMES } from '@/lib/google-sheets-service';
import { cache, CACHE_TTL } from '@/lib/cache';

// Tournament structure (participants, seeds, rules, prizes scaffold) is static
// config that ships with the build. Live sales numbers come from Google Sheets
// via googleSheetsService.getMarchMadnessSales(). Admin-mutable settings
// (overrides, prizes, visibility flags) live on the MarchMadness_Settings tab.
function loadBracketJSON() {
  const filePath = join(process.cwd(), 'data', 'march-madness-2026.json');
  const raw = readFileSync(filePath, 'utf8');
  return JSON.parse(raw);
}

const SETTINGS_HEADERS = ['key', 'value', 'updatedBy', 'updatedAt'];

function decodeSettingValue(raw: string): unknown {
  if (!raw) return undefined;
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}

async function loadSettings(): Promise<Record<string, unknown>> {
  try {
    const rows = await googleSheetsService.getGenericRows(
      SHEET_NAMES.MARCH_MADNESS_SETTINGS,
      SETTINGS_HEADERS,
    );
    const out: Record<string, unknown> = {
      showToReps: false,
      overrides: {},
      prizes: {},
      announcementEnabled: false,
      announcementMessage: '',
    };
    for (const row of rows) {
      if (!row.key) continue;
      out[row.key] = decodeSettingValue(row.value);
    }
    return out;
  } catch {
    return {
      showToReps: false,
      overrides: {},
      prizes: {},
      announcementEnabled: false,
      announcementMessage: '',
    };
  }
}

function buildBracket(
  participants: Array<{ seed: number; name: string; slug: string; nickname: string; ytdSales: number }>,
  salesByRep: Record<string, { week1: number; week2: number; week3: number }>,
  carryoverRate: number
) {
  // R1 matchups (fixed by seeding)
  const r1Matches = [
    { matchId: 'R1-M1', top: participants.find(p => p.seed === 1)!, bottom: null }, // BYE
    { matchId: 'R1-M2', top: participants.find(p => p.seed === 4)!, bottom: participants.find(p => p.seed === 5)! },
    { matchId: 'R1-M3', top: participants.find(p => p.seed === 3)!, bottom: participants.find(p => p.seed === 6)! },
    { matchId: 'R1-M4', top: participants.find(p => p.seed === 7)!, bottom: participants.find(p => p.seed === 2)! },
  ];

  const round1: Array<Record<string, unknown>> = [];
  const r1Winners: Array<{ seed: number; name: string; slug: string; weekSales: number }> = [];

  for (const m of r1Matches) {
    const topSales = salesByRep[m.top.name]?.week1 || 0;
    if (!m.bottom) {
      round1.push({
        matchId: m.matchId,
        topSeed: { seed: m.top.seed, name: m.top.name, slug: m.top.slug, weekSales: topSales, carryForward: 0, effectiveTotal: topSales, winner: true },
        bottomSeed: null,
      });
      r1Winners.push({ seed: m.top.seed, name: m.top.name, slug: m.top.slug, weekSales: topSales });
    } else {
      const botSales = salesByRep[m.bottom.name]?.week1 || 0;
      const topWins = topSales >= botSales;
      round1.push({
        matchId: m.matchId,
        topSeed: { seed: m.top.seed, name: m.top.name, slug: m.top.slug, weekSales: topSales, carryForward: 0, effectiveTotal: topSales, winner: topWins },
        bottomSeed: { seed: m.bottom.seed, name: m.bottom.name, slug: m.bottom.slug, weekSales: botSales, carryForward: 0, effectiveTotal: botSales, winner: !topWins },
      });
      r1Winners.push(topWins
        ? { seed: m.top.seed, name: m.top.name, slug: m.top.slug, weekSales: topSales }
        : { seed: m.bottom.seed, name: m.bottom.name, slug: m.bottom.slug, weekSales: botSales }
      );
    }
  }

  // R2 matchups (R1-M1 winner vs R1-M2 winner, R1-M3 winner vs R1-M4 winner)
  const round2: Array<Record<string, unknown>> = [];
  const r2Winners: Array<{ seed: number; name: string; slug: string; weekSales: number }> = [];

  if (r1Winners.length === 4) {
    const r2Matches = [
      { matchId: 'R2-M1', top: r1Winners[0], bottom: r1Winners[1] },
      { matchId: 'R2-M2', top: r1Winners[2], bottom: r1Winners[3] },
    ];

    for (const m of r2Matches) {
      const topWeek = salesByRep[m.top.name]?.week2 || 0;
      const botWeek = salesByRep[m.bottom.name]?.week2 || 0;
      const topCarry = m.top.weekSales * carryoverRate;
      const botCarry = m.bottom.weekSales * carryoverRate;
      const topEff = topWeek + topCarry;
      const botEff = botWeek + botCarry;
      const topWins = topEff >= botEff;

      round2.push({
        matchId: m.matchId,
        topSeed: { seed: m.top.seed, name: m.top.name, slug: m.top.slug, weekSales: topWeek, carryForward: Math.round(topCarry), effectiveTotal: Math.round(topEff), winner: topWins },
        bottomSeed: { seed: m.bottom.seed, name: m.bottom.name, slug: m.bottom.slug, weekSales: botWeek, carryForward: Math.round(botCarry), effectiveTotal: Math.round(botEff), winner: !topWins },
      });
      r2Winners.push(topWins
        ? { seed: m.top.seed, name: m.top.name, slug: m.top.slug, weekSales: topWeek }
        : { seed: m.bottom.seed, name: m.bottom.name, slug: m.bottom.slug, weekSales: botWeek }
      );
    }
  }

  // R3 Championship
  const round3: Array<Record<string, unknown>> = [];
  if (r2Winners.length === 2) {
    const topWeek = salesByRep[r2Winners[0].name]?.week3 || 0;
    const botWeek = salesByRep[r2Winners[1].name]?.week3 || 0;
    const topCarry = r2Winners[0].weekSales * carryoverRate;
    const botCarry = r2Winners[1].weekSales * carryoverRate;
    const topEff = topWeek + topCarry;
    const botEff = botWeek + botCarry;
    const hasData = topWeek > 0 || botWeek > 0;
    const topWins = hasData ? topEff >= botEff : false;

    round3.push({
      matchId: 'R3-M1',
      topSeed: { seed: r2Winners[0].seed, name: r2Winners[0].name, slug: r2Winners[0].slug, weekSales: topWeek, carryForward: Math.round(topCarry), effectiveTotal: Math.round(topEff), winner: hasData && topWins },
      bottomSeed: { seed: r2Winners[1].seed, name: r2Winners[1].name, slug: r2Winners[1].slug, weekSales: botWeek, carryForward: Math.round(botCarry), effectiveTotal: Math.round(botEff), winner: hasData && !topWins },
    });
  }

  return { round1, round2, round3 };
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const mode = url.searchParams.get('mode') || 'live';

    const cacheKey = `sheets:march-madness:${mode}`;
    const cachedBracket = cache.get(cacheKey);
    if (cachedBracket) {
      return NextResponse.json(cachedBracket, {
        headers: { 'Cache-Control': 'private, s-maxage=30' },
      });
    }

    const data = loadBracketJSON();

    // If demo mode, return the demo data as-is
    if (mode === 'demo' && data.demo) {
      return NextResponse.json({
        ...data,
        bracket: data.demo.bracket,
        participants: data.demo.participants,
        rounds: data.demo.rounds,
        champion: data.demo.champion,
        isDemo: true,
      });
    }

    // Try to get live data from Google Sheets
    let sheetData: Array<{
      repName: string; seed: number; nickname: string;
      week1Sales: number; week2Sales: number; week3Sales: number;
      marchTotal: number; status: string;
    }> = [];

    try {
      sheetData = await googleSheetsService.getMarchMadnessSales();
    } catch {
      // Google Sheets unavailable, use JSON data
    }

    // Load admin settings for overrides and visibility
    const settings = await loadSettings();

    // Build salesByRep from sheet data or default to zeros
    const salesByRep: Record<string, { week1: number; week2: number; week3: number }> = {};
    for (const p of data.participants) {
      salesByRep[p.name] = { week1: 0, week2: 0, week3: 0 };
    }

    if (sheetData.length > 0) {
      for (const row of sheetData) {
        salesByRep[row.repName] = {
          week1: row.week1Sales,
          week2: row.week2Sales,
          week3: row.week3Sales,
        };
      }
      data.dataSource = 'google_sheets';
    } else {
      // Extract sales from existing bracket JSON
      for (const roundKey of ['round1', 'round2', 'round3'] as const) {
        const weekNum = roundKey === 'round1' ? 'week1' : roundKey === 'round2' ? 'week2' : 'week3';
        const matches = data.bracket?.[roundKey] || [];
        for (const m of matches) {
          if (m.topSeed && salesByRep[m.topSeed.name]) {
            salesByRep[m.topSeed.name][weekNum] = m.topSeed.weekSales || 0;
          }
          if (m.bottomSeed && salesByRep[m.bottomSeed.name]) {
            salesByRep[m.bottomSeed.name][weekNum] = m.bottomSeed.weekSales || 0;
          }
        }
      }
      data.dataSource = 'json';
    }

    // Apply admin overrides (non-null values take priority).
    // settings.overrides is `unknown` after JSON-decode, so cast to a safe shape.
    const overrides =
      (settings.overrides as Record<string, { week1?: number; week2?: number; week3?: number }>) ||
      {};
    for (const repName of Object.keys(overrides)) {
      if (!salesByRep[repName]) continue;
      const o = overrides[repName];
      if (o.week1 !== null && o.week1 !== undefined) salesByRep[repName].week1 = o.week1;
      if (o.week2 !== null && o.week2 !== undefined) salesByRep[repName].week2 = o.week2;
      if (o.week3 !== null && o.week3 !== undefined) salesByRep[repName].week3 = o.week3;
    }

    // Rebuild bracket with merged data
    const bracket = buildBracket(data.participants, salesByRep, data.rules.carryoverRate);
    data.bracket = bracket;

    // Attach settings info for client-side visibility checks
    data.showToReps = settings.showToReps;
    data.announcementEnabled = settings.announcementEnabled;
    data.announcementMessage = settings.announcementMessage;
    data.showOnMondayMeeting = settings.showOnMondayMeeting;
    data.salesByRep = salesByRep;

    // Use prizes from settings if available
    if (settings.prizes && Object.keys(settings.prizes).length > 0) {
      data.prizes = settings.prizes;
    }

    cache.set(cacheKey, data, CACHE_TTL.MEETING);
    return NextResponse.json(data, {
      headers: { 'Cache-Control': 'private, s-maxage=30' },
    });
  } catch (err: any) {
    console.error('[March Madness Bracket API] Error:', err.message);
    return NextResponse.json({ error: 'Failed to load bracket data' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const auth = await requireAuth();
  if (!auth.authenticated) return auth.response;

  try {
    const body = await request.json();
    const { repName, week, sales } = body;

    if (!repName || !week || sales === undefined) {
      return NextResponse.json({ error: 'repName, week (1-3), and sales required' }, { status: 400 });
    }

    // Update Google Sheets
    const success = await googleSheetsService.updateMarchMadnessSales(
      repName,
      week as 1 | 2 | 3,
      sales
    );

    // Also update the JSON file
    const data = loadBracketJSON();
    const weekKey = `week${week}` as 'week1' | 'week2' | 'week3';
    const salesByRep: Record<string, { week1: number; week2: number; week3: number }> = {};

    for (const p of data.participants) {
      salesByRep[p.name] = { week1: 0, week2: 0, week3: 0 };
    }

    // Load existing sales from bracket
    for (const roundKey of ['round1', 'round2', 'round3']) {
      const matches = data.bracket[roundKey] || [];
      for (const m of matches) {
        if (m.topSeed) {
          const rk = roundKey === 'round1' ? 'week1' : roundKey === 'round2' ? 'week2' : 'week3';
          if (salesByRep[m.topSeed.name]) salesByRep[m.topSeed.name][rk as keyof typeof salesByRep[string]] = m.topSeed.weekSales;
        }
        if (m.bottomSeed) {
          const rk = roundKey === 'round1' ? 'week1' : roundKey === 'round2' ? 'week2' : 'week3';
          if (salesByRep[m.bottomSeed.name]) salesByRep[m.bottomSeed.name][rk as keyof typeof salesByRep[string]] = m.bottomSeed.weekSales;
        }
      }
    }

    // Apply the update
    if (salesByRep[repName]) {
      salesByRep[repName][weekKey] = sales;
    }

    // Rebuild bracket
    const bracket = buildBracket(data.participants, salesByRep, data.rules.carryoverRate);
    data.bracket = bracket;

    // Determine round statuses
    const hasR1Data = Object.values(salesByRep).some(s => s.week1 > 0);
    const hasR2Data = Object.values(salesByRep).some(s => s.week2 > 0);
    const hasR3Data = Object.values(salesByRep).some(s => s.week3 > 0);
    data.rounds[0].status = hasR1Data ? 'completed' : 'active';
    data.rounds[1].status = hasR2Data ? 'completed' : hasR1Data ? 'active' : 'upcoming';
    data.rounds[2].status = hasR3Data ? 'completed' : hasR2Data ? 'active' : 'upcoming';
    data.currentRound = hasR3Data ? 3 : hasR2Data ? 2 : 1;
    data.tournament.status = 'in_progress';

    // No local JSON write — sales already persisted to Sheets via
    // googleSheetsService.updateMarchMadnessSales above. The bracket structure
    // is recomputed on every GET from sheet data, so there's nothing else to
    // persist here. Just bust the cache.
    cache.invalidatePattern('^sheets:march-madness:');

    return NextResponse.json({ success: true, sheetsUpdated: success });
  } catch (err: any) {
    console.error('[March Madness API] POST error:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  const auth = await requireAuth();
  if (!auth.authenticated) return auth.response;

  try {
    const data = loadBracketJSON();
    const success = await googleSheetsService.initMarchMadnessBracket(
      data.participants.map((p: { name: string; seed: number; nickname: string }) => ({
        repName: p.name,
        seed: p.seed,
        nickname: p.nickname,
      }))
    );

    return NextResponse.json({
      success,
      message: success
        ? 'MarchMadness sheet initialized with all participants'
        : 'Failed to initialize sheet (check Google Sheets credentials)',
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
