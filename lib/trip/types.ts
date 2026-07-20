export type MonthName =
  | 'January' | 'February' | 'March' | 'April' | 'May' | 'June'
  | 'July' | 'August' | 'September' | 'October' | 'November' | 'December';

export const MONTH_NAMES: MonthName[] = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
];

export const MONTH_NAME_SET = new Set<string>(MONTH_NAMES);

export interface BreakdownEntry {
  month: string;
  revenue: number;
  tier: string | null;
  bonus: number;
}

export interface BonusTier {
  threshold: number;
  bonus: number;
  label: string;
}

export interface RepStats {
  activeMonths: number;
  tieredMonths: number;
  bestMonth: BreakdownEntry;
  monthlyAvg: number;
  monthlyAvgIncluding0: number;
  projectedPeriodEnd: number;
  neededPerMonth: number;
  neededPerWeek: number;
  consistency: number;
  bestMonthBeatGap: boolean;
  wouldQualifyIfBestRepeats: boolean;
}

export interface RepDelta {
  ytdDelta: number;
  accruedDelta: number;
  isNew: boolean;
  previousAccrued: number;
  previousYtd: number;
}

export interface RepInsights {
  wins: string[];
  gaps: string[];
  suggestions: string[];
  motivation: string;
  deltaMessage: string | null;
}

export interface RepSummary {
  rep: string;
  ytd: number;
  breakdown: BreakdownEntry[];
  accruedTripBudget: number;
  qualifiedForTrip: boolean;
  actualTripBudget: number;
  gapToTrip: number;
  pctToTrip: number;
  stats?: RepStats;
  delta?: RepDelta | null;
  insights?: RepInsights;
  llc?: string | null;
}

export interface TrackerJSON {
  source: string;
  generatedAt: string;
  /** `id` is optional so pre-split trackers (no id) still typecheck. */
  period: { start: string; end: string; name: string; id?: string };
  /** Set on archived periods. A locked tracker can never be written to again. */
  locked?: boolean;
  lockedAt?: string;
  tripThreshold: number;
  bonusModel: 'replacement';
  monthlyTiers: BonusTier[];
  aboveCapRate: { perStep: number; bonusPerStep: number; startsAbove: number };
  reps: RepSummary[];
  totalAccrued: number;
  totalToBePaid: number;
}

export interface Snapshot {
  capturedAt: string;
  capturedDate: string;
  source?: string;
  hash: string;
  teamTotal: number;
  qualifiedCount: number;
  totalAccrued?: number;
  reps: Array<{
    rep: string;
    ytd: number;
    monthly: Array<{ month: string; revenue: number; bonus?: number }>;
    accrued?: number;
    qualified?: boolean;
    pct?: number;
  }>;
  isFirst?: boolean;
  previousHash?: string | null;
  previousCapturedAt?: string | null;
  changes?: CellChange[];
  retroactiveCount?: number;
  additionCount?: number;
}

export interface CellChange {
  rep: string;
  month: string;
  oldValue: number;
  newValue: number;
  delta: number;
  type: 'added' | 'removed' | 'modified';
}

export interface ChangeLogEntry {
  timestamp: string;
  snapshotHash: string;
  previousHash: string | null;
  additions: number;
  modifications: number;
  changes: CellChange[];
}

// rep -> month -> revenue
export type DataMap = Record<string, Record<string, number>>;
