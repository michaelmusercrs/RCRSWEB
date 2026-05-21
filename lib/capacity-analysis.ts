/**
 * Crew / Production Capacity Analysis (chrisview).
 *
 * Pulls TeamUp events for a configurable window (default: last 60 days +
 * next 30 days) and answers the question "how booked-out are we?":
 *
 *   - eventsPerWeek         : weekly counts by subcalendar
 *   - byRep                 : events per crew/rep (from event.who), last 30d
 *   - gapDays               : number of business days in window with
 *                             ZERO installations
 *   - avgInstallsPerBusinessDay : installs in the past 30 days / business days
 *   - upcomingInstallations : next 20 scheduled installations
 *
 * The shape of `subcalendar_id` on each event is matched against the
 * env-configured IDs from `TEAMUP_SUBCALENDARS`. If a subcalendar ID is
 * unset (env var empty), we surface that gap honestly in the payload
 * via `configuredSubcalendars` so the UI can warn.
 *
 * Cached through the shared chrisview sheet cache under slug 'capacity'.
 */
import { teamupService, TEAMUP_SUBCALENDARS, type TeamUpEvent } from './teamup-service';
import { withChrisviewCache } from './chrisview-sheet-cache';

// ---------------------------------------------------------------------------
// Public output types
// ---------------------------------------------------------------------------
export interface WeekBucket {
  /** ISO week-start date (Monday, YYYY-MM-DD) */
  week: string;
  installations: number;
  deliveries: number;
  meetings: number;
  general: number;
  total: number;
}

export interface RepBucket {
  rep: string;
  installations: number;
  deliveries: number;
  meetings: number;
  total: number;
}

export interface UpcomingInstallation {
  id: string;
  title: string;
  start: string; // ISO 8601
  end: string;
  who: string;
  location: string;
  daysFromNow: number;
}

export interface ConfiguredSubcalendars {
  installations: boolean;
  deliveries: boolean;
  meetings: boolean;
  general: boolean;
}

export interface CapacityPayload {
  generatedAt: string;
  window: {
    startDate: string;
    endDate: string;
    pastDays: number;
    futureDays: number;
  };
  teamupConfigured: boolean;
  teamupConfigMessage: string;
  configuredSubcalendars: ConfiguredSubcalendars;
  totalEvents: number;
  eventsPerWeek: WeekBucket[];
  byRep: RepBucket[];
  gapDays: number;
  businessDaysLast30: number;
  installsLast30: number;
  installsThisWeek: number;
  installsNext30: number;
  avgInstallsPerBusinessDay: number;
  busiestRep: { rep: string; total: number } | null;
  upcomingInstallations: UpcomingInstallation[];
  meta: {
    pastDays: number;
    futureDays: number;
    queryTimeMs: number;
  };
}

// ---------------------------------------------------------------------------
// Date helpers
// ---------------------------------------------------------------------------
function toDateOnly(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Monday-anchored ISO week-start (UTC) for a given date. */
function weekStartIso(d: Date): string {
  const x = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  // getUTCDay: 0=Sun, 1=Mon … 6=Sat. Shift so Monday=0, Sunday=6.
  const dow = (x.getUTCDay() + 6) % 7;
  x.setUTCDate(x.getUTCDate() - dow);
  return toDateOnly(x);
}

/** True for Mon–Fri in UTC. */
function isBusinessDay(d: Date): boolean {
  const dow = d.getUTCDay();
  return dow >= 1 && dow <= 5;
}

function countBusinessDays(start: Date, end: Date): number {
  const a = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate()));
  const b = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate()));
  let count = 0;
  const cursor = new Date(a);
  while (cursor <= b) {
    if (isBusinessDay(cursor)) count++;
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return count;
}

// ---------------------------------------------------------------------------
// Subcalendar classification
// ---------------------------------------------------------------------------
// Per Michael 2026-05-21: TeamUp tracks deliveries, jobs/installations, and
// driver schedules ONLY. Inspections are NOT in TeamUp — those are reported
// to the Monday meeting in the Estimates column. So we drop inspections from
// this view. (Future: Rick's insurance-agent visits during free time will
// eventually land here; circle back when that's set up.)
type Bucket = 'installations' | 'deliveries' | 'meetings' | 'general' | 'other';

function bucketForEvent(
  event: TeamUpEvent,
  ids: { installations: string; deliveries: string; meetings: string; general: string },
): Bucket {
  // Prefer subcalendar match (handles single + multi-subcalendar events)
  const subIds: string[] = [];
  if (event.subcalendar_id) subIds.push(String(event.subcalendar_id));
  if (Array.isArray(event.subcalendar_ids)) {
    for (const s of event.subcalendar_ids) subIds.push(String(s));
  }
  for (const id of subIds) {
    if (ids.installations && id === ids.installations) return 'installations';
    if (ids.deliveries && id === ids.deliveries) return 'deliveries';
    if (ids.meetings && id === ids.meetings) return 'meetings';
    if (ids.general && id === ids.general) return 'general';
  }

  // Fallback: classify by title keywords (best-effort when subcal IDs aren't set)
  const t = (event.title || '').toLowerCase();
  if (/install|installation/.test(t)) return 'installations';
  if (/deliver|delivery|dropoff|drop-off|tear.?off pickup|driver/.test(t)) return 'deliveries';
  if (/meeting|standup|huddle|review/.test(t)) return 'meetings';
  return 'other';
}

// ---------------------------------------------------------------------------
// Core compute
// ---------------------------------------------------------------------------
function computeCapacity(events: TeamUpEvent[], options: {
  pastDays: number;
  futureDays: number;
  startDate: string;
  endDate: string;
  configured: boolean;
  configMessage: string;
  queryTimeMs: number;
}): CapacityPayload {
  const ids = {
    installations: TEAMUP_SUBCALENDARS.installations || '',
    deliveries: TEAMUP_SUBCALENDARS.deliveries || '',
    meetings: TEAMUP_SUBCALENDARS.meetings || '',
    general: TEAMUP_SUBCALENDARS.general || '',
  };

  const configuredSubcalendars: ConfiguredSubcalendars = {
    installations: Boolean(ids.installations),
    deliveries: Boolean(ids.deliveries),
    meetings: Boolean(ids.meetings),
    general: Boolean(ids.general),
  };

  // -------- Week buckets --------
  const weekMap = new Map<string, WeekBucket>();
  // Pre-seed weeks across the entire window so the chart has zeros, not gaps.
  const windowStart = new Date(`${options.startDate}T00:00:00Z`);
  const windowEnd = new Date(`${options.endDate}T23:59:59Z`);
  const weekCursor = new Date(windowStart);
  while (weekCursor <= windowEnd) {
    const ws = weekStartIso(weekCursor);
    if (!weekMap.has(ws)) {
      weekMap.set(ws, {
        week: ws,
        installations: 0,
        deliveries: 0,
        meetings: 0,
        general: 0,
        total: 0,
      });
    }
    weekCursor.setUTCDate(weekCursor.getUTCDate() + 7);
  }

  // -------- Rep buckets (last 30 days only) --------
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const repMap = new Map<string, RepBucket>();

  // -------- Per-day install set (for gap-days + avg-per-business-day) --------
  const installDaysInWindow = new Set<string>();
  const installDaysLast30 = new Set<string>();
  let installsLast30 = 0;
  let installsThisWeek = 0;
  let installsNext30 = 0;

  const thisWeekStart = weekStartIso(now);
  const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  const upcomingInstalls: UpcomingInstallation[] = [];

  for (const event of events) {
    if (!event.start_dt) continue;
    const start = new Date(event.start_dt);
    if (Number.isNaN(start.getTime())) continue;

    const bucket = bucketForEvent(event, ids);
    if (bucket === 'other') {
      // still count toward total but don't break out
    }

    const ws = weekStartIso(start);
    let weekRow = weekMap.get(ws);
    if (!weekRow) {
      weekRow = { week: ws, installations: 0, deliveries: 0, meetings: 0, general: 0, total: 0 };
      weekMap.set(ws, weekRow);
    }
    weekRow.total++;
    if (bucket === 'installations') weekRow.installations++;
    else if (bucket === 'deliveries') weekRow.deliveries++;
    else if (bucket === 'meetings') weekRow.meetings++;
    else if (bucket === 'general') weekRow.general++;

    // Rep rollup (only last 30 days, ignore unattributed)
    if (start >= thirtyDaysAgo && start <= now) {
      const who = (event.who || '').trim() || '(unassigned)';
      let row = repMap.get(who);
      if (!row) {
        row = { rep: who, installations: 0, deliveries: 0, meetings: 0, total: 0 };
        repMap.set(who, row);
      }
      row.total++;
      if (bucket === 'installations') row.installations++;
      else if (bucket === 'deliveries') row.deliveries++;
      else if (bucket === 'meetings') row.meetings++;
    }

    // Install-day tracking
    if (bucket === 'installations') {
      const dayKey = toDateOnly(start);
      installDaysInWindow.add(dayKey);
      if (start >= thirtyDaysAgo && start <= now) {
        installDaysLast30.add(dayKey);
        installsLast30++;
      }
      if (ws === thisWeekStart) {
        installsThisWeek++;
      }
      if (start >= now && start <= thirtyDaysFromNow) {
        installsNext30++;
        upcomingInstalls.push({
          id: String(event.id || ''),
          title: event.title || '(untitled)',
          start: event.start_dt,
          end: event.end_dt,
          who: event.who || '',
          location: event.location || '',
          daysFromNow: Math.round((start.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)),
        });
      }
    }
  }

  // -------- Gap days: business days in last 30 with ZERO installations --------
  const businessDaysLast30 = countBusinessDays(thirtyDaysAgo, now);
  let gapDays = 0;
  const cursor = new Date(thirtyDaysAgo);
  while (cursor <= now) {
    if (isBusinessDay(cursor)) {
      const k = toDateOnly(cursor);
      if (!installDaysLast30.has(k)) gapDays++;
    }
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  const avgInstallsPerBusinessDay = businessDaysLast30 > 0
    ? Number((installsLast30 / businessDaysLast30).toFixed(2))
    : 0;

  // Sort outputs
  const eventsPerWeek = Array.from(weekMap.values()).sort((a, b) => a.week.localeCompare(b.week));
  const byRep = Array.from(repMap.values()).sort((a, b) => b.total - a.total);
  const busiestRep = byRep.length > 0 ? { rep: byRep[0].rep, total: byRep[0].total } : null;

  upcomingInstalls.sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
  const upcomingInstallations = upcomingInstalls.slice(0, 20);

  return {
    generatedAt: new Date().toISOString(),
    window: {
      startDate: options.startDate,
      endDate: options.endDate,
      pastDays: options.pastDays,
      futureDays: options.futureDays,
    },
    teamupConfigured: options.configured,
    teamupConfigMessage: options.configMessage,
    configuredSubcalendars,
    totalEvents: events.length,
    eventsPerWeek,
    byRep,
    gapDays,
    businessDaysLast30,
    installsLast30,
    installsThisWeek,
    installsNext30,
    avgInstallsPerBusinessDay,
    busiestRep,
    upcomingInstallations,
    meta: {
      pastDays: options.pastDays,
      futureDays: options.futureDays,
      queryTimeMs: options.queryTimeMs,
    },
  };
}

// ---------------------------------------------------------------------------
// Public entry-point
// ---------------------------------------------------------------------------
export interface AnalyzeCapacityOptions {
  /** Days into the past to query (default 60) */
  pastDays?: number;
  /** Days into the future to query (default 30) */
  futureDays?: number;
  /** Bypass the sheet cache. Default false. */
  skipCache?: boolean;
}

export async function analyzeCapacity(
  options: AnalyzeCapacityOptions = {},
): Promise<CapacityPayload> {
  const pastDays = Math.max(1, Math.min(options.pastDays ?? 60, 365));
  const futureDays = Math.max(1, Math.min(options.futureDays ?? 30, 365));

  const compute = async (): Promise<CapacityPayload> => {
    const start = Date.now();
    const now = new Date();
    const windowStart = new Date(now.getTime() - pastDays * 24 * 60 * 60 * 1000);
    const windowEnd = new Date(now.getTime() + futureDays * 24 * 60 * 60 * 1000);
    const startDate = toDateOnly(windowStart);
    const endDate = toDateOnly(windowEnd);

    const config = teamupService.checkConfiguration();
    let events: TeamUpEvent[] = [];
    if (config.configured) {
      try {
        events = await teamupService.getEvents(startDate, endDate);
      } catch (err) {
        console.warn('[capacity-analysis] TeamUp getEvents failed:', err);
        events = [];
      }
    }

    return computeCapacity(events, {
      pastDays,
      futureDays,
      startDate,
      endDate,
      configured: config.configured,
      configMessage: config.message,
      queryTimeMs: Date.now() - start,
    });
  };

  // Default-window runs share the sheet cache; custom windows skip it
  // (would otherwise collide with the cron-written canonical row).
  const usesDefaultWindow = pastDays === 60 && futureDays === 30;
  if (options.skipCache || !usesDefaultWindow) {
    return compute();
  }

  const { payload } = await withChrisviewCache<CapacityPayload>('capacity', compute);
  return payload;
}
