/**
 * Bi-annual period model for the /trip trip-qualification program.
 *
 * The program runs in halves: H1 = Jan 1 – Jun 30, H2 = Jul 1 – Dec 31.
 * A rep must hit `tripThreshold` cumulative revenue WITHIN a half to qualify;
 * monthly tier bonuses accrue into a trip budget that is only paid out if they
 * qualify. Each half starts from zero and the previous half is locked.
 *
 * The active period is DERIVED FROM THE DATE, not read from config, so the
 * rollover happens automatically every Jan 1 / Jul 1 without a deploy. The
 * risk of auto-rollover (a new half beginning before anyone archived the old
 * one) is handled by the write guards in the commit routes, which refuse to
 * write when the live tracker's period no longer matches the active one.
 */

import { MONTH_NAMES, MonthName } from './types';

export interface Period {
  /** Stable id used in URLs and Blob keys, e.g. "H1-2026". */
  id: string;
  /** Human label, e.g. "H1 2026". */
  name: string;
  year: number;
  half: 1 | 2;
  /** ISO date, inclusive. */
  start: string;
  /** ISO date, inclusive. */
  end: string;
  /** The six month sheet names that belong to this period, in order. */
  months: MonthName[];
}

export const H1_MONTHS: MonthName[] = MONTH_NAMES.slice(0, 6);
export const H2_MONTHS: MonthName[] = MONTH_NAMES.slice(6, 12);

export function makePeriod(year: number, half: 1 | 2): Period {
  return half === 1
    ? {
        id: `H1-${year}`,
        name: `H1 ${year}`,
        year,
        half: 1,
        start: `${year}-01-01`,
        end: `${year}-06-30`,
        months: [...H1_MONTHS],
      }
    : {
        id: `H2-${year}`,
        name: `H2 ${year}`,
        year,
        half: 2,
        start: `${year}-07-01`,
        end: `${year}-12-31`,
        months: [...H2_MONTHS],
      };
}

/**
 * Company-local (America/Chicago) year+month for an instant. Vercel runs UTC,
 * so without this the Dec 31 -> Jan 1 flip would happen at 6pm Central.
 */
function chicagoYearMonth(d: Date): { year: number; month: number } {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Chicago',
    year: 'numeric',
    month: 'numeric',
  }).formatToParts(d);
  const year = Number(parts.find((p) => p.type === 'year')?.value);
  const month = Number(parts.find((p) => p.type === 'month')?.value); // 1-12
  return { year, month };
}

export function periodForDate(d: Date): Period {
  const { year, month } = chicagoYearMonth(d);
  return makePeriod(year, month <= 6 ? 1 : 2);
}

/** The period that should currently be accepting uploads. */
export function getActivePeriod(now: Date = new Date()): Period {
  return periodForDate(now);
}

export function parsePeriodId(id: string): Period | null {
  const m = /^H([12])-(\d{4})$/.exec(id.trim());
  if (!m) return null;
  const half = Number(m[1]) as 1 | 2;
  const year = Number(m[2]);
  if (year < 2000 || year > 2999) return null;
  return makePeriod(year, half);
}

export function nextPeriod(p: Period): Period {
  return p.half === 1 ? makePeriod(p.year, 2) : makePeriod(p.year + 1, 1);
}

export function previousPeriod(p: Period): Period {
  return p.half === 2 ? makePeriod(p.year, 1) : makePeriod(p.year - 1, 2);
}

/**
 * Recover a period id from a TrackerJSON's `period` block. Trackers written
 * before the bi-annual split have no `id`, so fall back to the start date.
 */
export function inferPeriodId(period: { start?: string; end?: string; name?: string; id?: string }): string | null {
  if (period.id) return period.id;
  if (period.start) {
    const m = /^(\d{4})-(\d{2})/.exec(period.start);
    if (m) {
      const year = Number(m[1]);
      const month = Number(m[2]);
      return makePeriod(year, month <= 6 ? 1 : 2).id;
    }
  }
  if (period.name) {
    const m = /^H([12])\s+(\d{4})$/.exec(period.name.trim());
    if (m) return `H${m[1]}-${m[2]}`;
  }
  return null;
}

/** "Jan 1 – Jun 30" style label for headers and rules copy. */
export function formatPeriodRange(p: Pick<Period, 'start' | 'end'>): string {
  const fmt = (iso: string) => {
    const [y, m, d] = iso.split('-').map(Number);
    const date = new Date(Date.UTC(y, m - 1, d));
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      timeZone: 'UTC',
    }).format(date);
  };
  return `${fmt(p.start)} – ${fmt(p.end)}`;
}
