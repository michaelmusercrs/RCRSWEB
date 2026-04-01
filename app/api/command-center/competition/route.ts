/**
 * RCRS Command Center - Competition API
 *
 * GET /api/command-center/competition
 * Returns current competition standings, tier progress, and gas card eligibility.
 * Data source: data/commissions.json (read dynamically) filtered by competition-config.json period.
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-service';
import competitionConfig from '@/data/competition-config.json';
import { isInternalSalesRep, resolveCommissionName } from '@/lib/team-roles';
import { readFileSync } from 'fs';
import * as path from 'path';

interface CommissionRaw {
  salesRep: string;
  date: string;
  amount: number;
  balance: number;
}

function parseDate(dateStr: string): Date {
  // Format: M/D/YYYY
  const parts = dateStr.split('/');
  return new Date(parseInt(parts[2]), parseInt(parts[0]) - 1, parseInt(parts[1]));
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const presentMode = searchParams.get('presentMode') === 'true';

  if (!presentMode) {
    const auth = await requireAuth();
    if (!auth.authenticated) return auth.response;

    // Check role
    const allowedRoles = ['owner', 'admin', 'manager'];
    if (!allowedRoles.includes(auth.user.role)) {
      return NextResponse.json({ success: false, error: 'Insufficient permissions' }, { status: 403 });
    }
  }

  const config = competitionConfig;
  const periodStart = new Date(config.currentPeriod.start);
  const periodEnd = new Date(config.currentPeriod.end + 'T23:59:59');

  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();

  // Read commissions.json dynamically (not import - import bundles at build time)
  const commissionsPath = path.join(process.cwd(), 'data', 'commissions.json');
  const commissionsData: CommissionRaw[] = JSON.parse(readFileSync(commissionsPath, 'utf-8'));

  const entries = (commissionsData)
    .filter(e => isInternalSalesRep(e.salesRep))
    .map(e => ({
      ...e,
      salesRep: resolveCommissionName(e.salesRep),
      parsedDate: parseDate(e.date),
    }));

  // Filter to current period
  const periodEntries = entries.filter(e => e.parsedDate >= periodStart && e.parsedDate <= periodEnd);

  // Filter to current month
  const monthEntries = entries.filter(e =>
    e.parsedDate.getMonth() === currentMonth && e.parsedDate.getFullYear() === currentYear
  );

  // Aggregate by rep
  const repTotals: Record<string, { periodTotal: number; monthlyTotal: number; periodDeals: number; monthlyDeals: number }> = {};

  for (const e of periodEntries) {
    if (!repTotals[e.salesRep]) {
      repTotals[e.salesRep] = { periodTotal: 0, monthlyTotal: 0, periodDeals: 0, monthlyDeals: 0 };
    }
    repTotals[e.salesRep].periodTotal += e.amount;
    repTotals[e.salesRep].periodDeals += 1;
  }

  for (const e of monthEntries) {
    if (!repTotals[e.salesRep]) {
      repTotals[e.salesRep] = { periodTotal: 0, monthlyTotal: 0, periodDeals: 0, monthlyDeals: 0 };
    }
    repTotals[e.salesRep].monthlyTotal += e.amount;
    repTotals[e.salesRep].monthlyDeals += 1;
  }

  const tiers = config.bonusTiers;

  const leaderboard = Object.entries(repTotals)
    .map(([name, data]) => {
      const currentTier = [...tiers].reverse().find(t => data.periodTotal >= t.threshold) || null;
      const nextTier = tiers.find(t => data.periodTotal < t.threshold) || null;
      const amountToNext = nextTier ? nextTier.threshold - data.periodTotal : 0;
      const gasCardEligible = data.monthlyDeals >= config.monthlyGasCard.minDeals;

      return {
        name,
        periodTotal: Math.round(data.periodTotal * 100) / 100,
        monthlyTotal: Math.round(data.monthlyTotal * 100) / 100,
        periodDeals: data.periodDeals,
        monthlyDeals: data.monthlyDeals,
        currentTier: currentTier ? { label: currentTier.label, bonus: currentTier.bonus, threshold: currentTier.threshold } : null,
        nextTier: nextTier ? { label: nextTier.label, bonus: nextTier.bonus, threshold: nextTier.threshold } : null,
        amountToNext: Math.round(amountToNext * 100) / 100,
        gasCardEligible,
      };
    })
    .sort((a, b) => b.periodTotal - a.periodTotal);

  return NextResponse.json({
    success: true,
    dataSource: 'actual-commissions',
    dataSourceLabel: 'Actual Commission Records',
    period: config.currentPeriod,
    tiers: config.bonusTiers,
    gasCard: config.monthlyGasCard,
    leaderboard,
    generatedAt: new Date().toISOString(),
  });
}
