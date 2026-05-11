import {
  BonusTier,
  BreakdownEntry,
  DataMap,
  MONTH_NAME_SET,
  RepSummary,
  TrackerJSON,
} from './types';

const ABOVE_500K_RATE = 1000;
const MONTHLY_CAP_AMOUNT = 1000000;
const MONTHLY_CAP_BONUS = 9000;

export function bonusReplacement(amount: number, tiers: BonusTier[]) {
  let bonus = 0;
  let topTier: string | null = null;
  for (const t of tiers) {
    if (amount >= t.threshold) {
      bonus = t.bonus;
      topTier = t.label;
    }
  }
  if (amount > 500000) {
    const capped = Math.min(amount, MONTHLY_CAP_AMOUNT);
    const extra = Math.floor((capped - 500000) / 100000);
    if (extra > 0) {
      bonus += extra * ABOVE_500K_RATE;
      topTier = `$${Math.floor(capped / 100000) * 100}K (linear)`;
    }
    if (amount >= MONTHLY_CAP_AMOUNT) {
      bonus = MONTHLY_CAP_BONUS;
      topTier = '$1M+ (capped)';
    }
  }
  return { bonus, topTier };
}

/**
 * Parse an xlsx Buffer into a DataMap (rep -> month -> revenue).
 * Skips any non-month sheets (e.g. a "Totals" tab).
 */
export async function parseXlsxBuffer(buf: ArrayBuffer | Buffer): Promise<{
  dataMap: DataMap;
  months: string[];
}> {
  const XLSX = await import('xlsx');
  const wb = XLSX.read(buf, { type: buf instanceof ArrayBuffer ? 'array' : 'buffer' });
  const monthSheets = wb.SheetNames.filter((s) => MONTH_NAME_SET.has(s.trim()));
  const months = monthSheets.map((s) => s.trim());
  const dataMap: DataMap = {};
  for (const sheetName of monthSheets) {
    const month = sheetName.trim();
    const rows = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[sheetName], {
      header: 1,
      defval: '',
    });
    for (const row of rows) {
      const rep = String((row as unknown[])[0] ?? '').trim();
      const rev = Number((row as unknown[])[1]) || 0;
      if (!rep || rev <= 0) continue;
      dataMap[rep] = dataMap[rep] || {};
      dataMap[rep][month] = (dataMap[rep][month] || 0) + rev;
    }
  }
  return { dataMap, months };
}

/**
 * Build a TrackerJSON payload from a parsed DataMap + competition config.
 */
export function buildTrackerJSON(args: {
  dataMap: DataMap;
  months: string[];
  tiers: BonusTier[];
  tripThreshold: number;
  period: { start: string; end: string; name: string };
  source: string;
}): TrackerJSON {
  const { dataMap, months, tiers, tripThreshold, period, source } = args;
  const reps: RepSummary[] = Object.entries(dataMap)
    .map(([rep, byMonth]) => {
      const breakdown: BreakdownEntry[] = months.map((m) => {
        const rev = byMonth[m] || 0;
        const repl = bonusReplacement(rev, tiers);
        return { month: m, revenue: rev, tier: repl.topTier, bonus: repl.bonus };
      });
      const ytd = breakdown.reduce((s, r) => s + r.revenue, 0);
      const accrued = breakdown.reduce((s, r) => s + r.bonus, 0);
      const qualified = ytd >= tripThreshold;
      return {
        rep,
        ytd,
        breakdown,
        accruedTripBudget: accrued,
        qualifiedForTrip: qualified,
        actualTripBudget: qualified ? accrued : 0,
        gapToTrip: Math.max(0, tripThreshold - ytd),
        pctToTrip: Math.min(100, (ytd / tripThreshold) * 100),
      };
    })
    .sort((a, b) => b.ytd - a.ytd);

  const totalAccrued = reps.reduce((s, r) => s + r.accruedTripBudget, 0);
  const totalToBePaid = reps
    .filter((r) => r.qualifiedForTrip)
    .reduce((s, r) => s + r.actualTripBudget, 0);

  return {
    source,
    generatedAt: new Date().toISOString(),
    period,
    tripThreshold,
    bonusModel: 'replacement',
    monthlyTiers: tiers,
    aboveCapRate: { perStep: 100000, bonusPerStep: ABOVE_500K_RATE, startsAbove: 500000 },
    reps,
    totalAccrued,
    totalToBePaid,
  };
}

export function trackerToDataMap(tracker: TrackerJSON): DataMap {
  const out: DataMap = {};
  for (const r of tracker.reps) {
    out[r.rep] = {};
    for (const b of r.breakdown) out[r.rep][b.month] = b.revenue;
  }
  return out;
}

/**
 * Compute a stable hash over the cell-level data, ignoring ordering.
 * Used for snapshot dedup.
 */
export async function dataMapHash(dataMap: DataMap): Promise<string> {
  const minimal = Object.keys(dataMap)
    .sort()
    .map((rep) => ({
      rep,
      monthly: Object.keys(dataMap[rep])
        .sort()
        .map((m) => [m, dataMap[rep][m]] as const),
    }));
  const json = JSON.stringify(minimal);
  if (typeof crypto !== 'undefined' && 'subtle' in crypto) {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(json));
    const arr = Array.from(new Uint8Array(buf));
    return arr.map((b) => b.toString(16).padStart(2, '0')).join('').slice(0, 16);
  }
  const { createHash } = await import('crypto');
  return createHash('sha256').update(json).digest('hex').slice(0, 16);
}
