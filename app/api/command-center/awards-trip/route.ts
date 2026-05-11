import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-service';
import { readFileSync, writeFileSync } from 'fs';
import * as path from 'path';

interface Tier {
  min: number;
  bonus: number;
  label: string;
}

interface Period {
  name: string;
  start: string;
  end: string;
  tripWindow: string;
}

interface AwardsData {
  rules: {
    qualifyingThreshold: number;
    tiers: Tier[];
    periods: Period[];
    reps: string[];
  };
  monthlySales: Record<string, Record<string, number>>;
}

const DATA_PATH = path.join(process.cwd(), 'data', 'awards-trip-data.json');

function loadData(): AwardsData {
  return JSON.parse(readFileSync(DATA_PATH, 'utf-8'));
}

function saveData(data: AwardsData): void {
  writeFileSync(DATA_PATH, JSON.stringify(data, null, 2));
}

function tierForAmount(amount: number, tiers: Tier[]): Tier | null {
  let match: Tier | null = null;
  for (const t of tiers) {
    if (amount >= t.min) match = t;
  }
  return match;
}

function monthsInPeriod(period: Period): string[] {
  const [sy, sm] = period.start.split('-').map(Number);
  const [ey, em] = period.end.split('-').map(Number);
  const out: string[] = [];
  let y = sy, m = sm;
  while (y < ey || (y === ey && m <= em)) {
    out.push(`${y}-${String(m).padStart(2, '0')}`);
    m++;
    if (m > 12) { m = 1; y++; }
  }
  return out;
}

function computePeriod(data: AwardsData, period: Period) {
  const months = monthsInPeriod(period);
  const { tiers, qualifyingThreshold } = data.rules;

  const repResults = data.rules.reps.map(repName => {
    const monthly: Array<{ month: string; sales: number; tier: Tier | null; bonus: number }> = months.map(m => {
      const sales = data.monthlySales[m]?.[repName] || 0;
      const tier = tierForAmount(sales, tiers);
      const bonus = tier?.bonus ?? 0;
      return { month: m, sales, tier, bonus };
    });

    const periodTotal = monthly.reduce((s, x) => s + x.sales, 0);
    const accruedBonus = monthly.reduce((s, x) => s + x.bonus, 0);
    const qualified = periodTotal >= qualifyingThreshold;
    const earnedAllowance = qualified ? accruedBonus : 0;
    const remainingToQualify = Math.max(0, qualifyingThreshold - periodTotal);
    const progressPct = Math.min(100, (periodTotal / qualifyingThreshold) * 100);

    return {
      repName,
      monthly,
      periodTotal,
      qualified,
      accruedBonus,
      earnedAllowance,
      remainingToQualify,
      progressPct,
    };
  });

  repResults.sort((a, b) => b.periodTotal - a.periodTotal);

  const teamTotal = repResults.reduce((s, r) => s + r.periodTotal, 0);
  const qualifierCount = repResults.filter(r => r.qualified).length;
  const totalAllowance = repResults.reduce((s, r) => s + r.earnedAllowance, 0);

  return {
    period,
    months,
    reps: repResults,
    teamTotal,
    qualifierCount,
    totalAllowance,
  };
}

function pickActivePeriod(data: AwardsData): Period {
  const today = new Date().toISOString().slice(0, 7);
  for (const p of data.rules.periods) {
    if (today >= p.start && today <= p.end) return p;
  }
  return data.rules.periods[0];
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const presentMode = searchParams.get('presentMode') === 'true';

  if (!presentMode) {
    const auth = await requireAuth();
    if (!auth.authenticated) return auth.response;
    const allowed = ['owner', 'admin', 'manager'];
    if (!allowed.includes(auth.user.role)) {
      return NextResponse.json({ success: false, error: 'Insufficient permissions' }, { status: 403 });
    }
  }

  const data = loadData();
  const requestedPeriod = searchParams.get('period');
  const period = data.rules.periods.find(p => p.name === requestedPeriod) ?? pickActivePeriod(data);
  const result = computePeriod(data, period);

  return NextResponse.json({
    success: true,
    rules: data.rules,
    result,
    generatedAt: new Date().toISOString(),
  });
}

export async function POST(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const presentMode = searchParams.get('presentMode') === 'true';

  if (!presentMode) {
    const auth = await requireAuth();
    if (!auth.authenticated) return auth.response;
    const allowed = ['owner', 'admin'];
    if (!allowed.includes(auth.user.role)) {
      return NextResponse.json({ success: false, error: 'Insufficient permissions' }, { status: 403 });
    }
  }

  let body: { month: string; sales: Record<string, number> };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON' }, { status: 400 });
  }

  if (!body?.month || !/^\d{4}-\d{2}$/.test(body.month)) {
    return NextResponse.json({ success: false, error: 'month must be YYYY-MM' }, { status: 400 });
  }
  if (!body.sales || typeof body.sales !== 'object') {
    return NextResponse.json({ success: false, error: 'sales must be an object' }, { status: 400 });
  }

  const data = loadData();
  if (!data.monthlySales[body.month]) data.monthlySales[body.month] = {};

  for (const [rep, val] of Object.entries(body.sales)) {
    const num = Number(val);
    if (!Number.isFinite(num) || num < 0) continue;
    if (num === 0) {
      delete data.monthlySales[body.month][rep];
    } else {
      data.monthlySales[body.month][rep] = num;
    }
  }

  saveData(data);

  return NextResponse.json({ success: true, month: body.month, sales: data.monthlySales[body.month] });
}
