/**
 * Rep Performance Stats
 * Calculates public-facing stats from commissions data for team member pages.
 * Shows job counts and general performance indicators — NOT exact dollar amounts.
 */

import fs from 'fs';
import path from 'path';

interface CommissionEntry {
  salesRep: string;
  date: string;
  amount: number;
  balance: number;
  jobNumber: string;
  customer: string;
}

export interface RepStats {
  totalJobs: number;
  paidJobs: number;           // Jobs where commission > 0 (completed & paid)
  avgJobsPerMonth: number;
  monthsActive: number;
  revenueGenerated: string;   // Friendly range like "$500K+" or "$1M+"
  rank: number;               // Rank among all reps by total jobs
  totalReps: number;
  topPercentile: number;      // e.g. "top 10%"
  bestMonth: string;          // "October 2025"
  bestMonthJobs: number;
  recentMonthJobs: number;    // Jobs in the most recent month with data
  companyAvgJobs: number;     // Average jobs per rep (for comparison)
}

// Map team slugs to commission data names
const SLUG_TO_COMMISSION_NAME: Record<string, string[]> = {
  'chris-muse': ['Chris Muse'],
  'michael-muse': ['Michael Muse', 'Michael'],
  'hunter': ['Hunter Rivers'],
  'aaron': ['Aaron Lussi'],
  'boston': ['Boston Muse'],
  'brendon': ['Brendon Muse'],
  'john': ['John Cordonis'],
  'bart': ['Bart Roberts'],
  'greg': ['Greg Muse'],
  'richard': ['Richard Geahr'],
  'travis': ['Travis Wages'],
  'tae': ['Taylor Jones'],
};

function parseDate(dateStr: string): Date {
  // Format: "M/D/YYYY"
  const parts = dateStr.split('/');
  return new Date(parseInt(parts[2]), parseInt(parts[0]) - 1, parseInt(parts[1]));
}

function getMonthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function getMonthLabel(key: string): string {
  const [year, month] = key.split('-');
  const months = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'];
  return `${months[parseInt(month) - 1]} ${year}`;
}

function revenueRange(totalCommission: number): string {
  // Commissions are roughly 8-12% of job revenue
  // So multiply by ~10 to estimate total revenue generated
  const estimated = totalCommission * 10;
  if (estimated >= 2000000) return '$2M+';
  if (estimated >= 1000000) return '$1M+';
  if (estimated >= 500000) return '$500K+';
  if (estimated >= 250000) return '$250K+';
  if (estimated >= 100000) return '$100K+';
  if (estimated >= 50000) return '$50K+';
  return '$25K+';
}

let cachedData: CommissionEntry[] | null = null;

function loadCommissions(): CommissionEntry[] {
  if (cachedData) return cachedData;
  try {
    const filePath = path.join(process.cwd(), 'data', 'commissions.json');
    const raw = fs.readFileSync(filePath, 'utf-8');
    cachedData = JSON.parse(raw);
    return cachedData!;
  } catch {
    return [];
  }
}

export function getRepStats(teamSlug: string): RepStats | null {
  const names = SLUG_TO_COMMISSION_NAME[teamSlug];
  if (!names) return null;

  const allData = loadCommissions();
  if (allData.length === 0) return null;

  // Get this rep's entries
  const repEntries = allData.filter(e => names.includes(e.salesRep));
  if (repEntries.length === 0) return null;

  const totalJobs = repEntries.length;
  const paidJobs = repEntries.filter(e => e.amount > 0).length;
  const totalCommission = repEntries.reduce((sum, e) => sum + e.amount, 0);

  // Calculate months active
  const dates = repEntries.map(e => parseDate(e.date));
  const minDate = new Date(Math.min(...dates.map(d => d.getTime())));
  const maxDate = new Date(Math.max(...dates.map(d => d.getTime())));
  const monthsActive = Math.max(1, Math.round(
    (maxDate.getTime() - minDate.getTime()) / (30.44 * 24 * 60 * 60 * 1000)
  ));

  // Jobs per month by month key
  const monthlyJobs: Record<string, number> = {};
  for (const entry of repEntries) {
    const key = getMonthKey(parseDate(entry.date));
    monthlyJobs[key] = (monthlyJobs[key] || 0) + 1;
  }

  const monthKeys = Object.keys(monthlyJobs).sort();
  const bestMonthKey = Object.entries(monthlyJobs)
    .sort((a, b) => b[1] - a[1])[0];

  // Most recent month
  const recentMonthKey = monthKeys[monthKeys.length - 1];

  // Rank among all reps
  const repTotals = new Map<string, number>();
  for (const entry of allData) {
    repTotals.set(entry.salesRep, (repTotals.get(entry.salesRep) || 0) + 1);
  }
  // Only count reps with >= 10 jobs (filter out one-offs)
  const activeReps = [...repTotals.entries()]
    .filter(([, count]) => count >= 10)
    .sort((a, b) => b[1] - a[1]);

  const rank = activeReps.findIndex(([name]) => names.includes(name)) + 1;
  const totalReps = activeReps.length;
  const topPercentile = Math.max(1, Math.round((rank / totalReps) * 100));

  // Company average (active reps only)
  const companyTotal = activeReps.reduce((sum, [, count]) => sum + count, 0);
  const companyAvgJobs = Math.round(companyTotal / activeReps.length);

  return {
    totalJobs,
    paidJobs,
    avgJobsPerMonth: Math.round((totalJobs / monthsActive) * 10) / 10,
    monthsActive,
    revenueGenerated: revenueRange(totalCommission),
    rank,
    totalReps,
    topPercentile,
    bestMonth: getMonthLabel(bestMonthKey[0]),
    bestMonthJobs: bestMonthKey[1],
    recentMonthJobs: monthlyJobs[recentMonthKey] || 0,
    companyAvgJobs,
  };
}
