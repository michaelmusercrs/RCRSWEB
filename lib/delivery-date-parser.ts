/**
 * Delivery Date Parser
 *
 * Pure module: derives the scheduled delivery date for a ticket from the
 * order's Special Instructions text. No I/O, no env — unit-tested directly
 * (tests/delivery-date-parser.test.mjs, run with --experimental-strip-types).
 *
 * Tiers (first match wins):
 *   1. Explicit date  — "Deliver by Monday 4/6", "deliver on 12/30/2026", …
 *   2. Weekday only   — "Deliver Wednesday" → next occurrence of that weekday
 *   3. Relative       — "today" / "ASAP" / "tomorrow" / "next day"
 *   4. Default        — next business day (Mon–Sat, mirrors the
 *                       auto-finalize-service business-hours model)
 *
 * TZ rule: the server runs UTC but the business runs America/Chicago, so a
 * "day" here always means a CHICAGO calendar date. The received-at instant is
 * converted to a Chicago YYYY-MM-DD via Intl (en-CA gives ISO format), and
 * every comparison afterwards is plain YYYY-MM-DD string comparison — never
 * Date-object comparison, which would re-introduce the server's timezone.
 */

const CHICAGO_TZ = 'America/Chicago';

export interface DerivedSchedule {
  /** YYYY-MM-DD (America/Chicago calendar date). */
  date: string;
  source: 'parsed' | 'default';
  /** The instruction text the date was parsed from (tiers 1–3 only). */
  matchedText?: string;
}

/** Chicago calendar date (YYYY-MM-DD) for an instant. */
export function chicagoDateOf(d: Date): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: CHICAGO_TZ }).format(d);
}

// ── Pure YYYY-MM-DD calendar math ───────────────────────────────────────────
// Once we hold a calendar date string, arithmetic is timezone-free: build the
// date at UTC noon-agnostic midnight and read it back. DST can't shift a
// whole-day UTC calculation.

function addDays(ymd: string, days: number): string {
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

/** 0=Sun … 6=Sat for a YYYY-MM-DD string. */
function weekdayOf(ymd: string): number {
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

function ymd(y: number, m: number, d: number): string {
  return `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

function isValidCalendarDate(y: number, m: number, d: number): boolean {
  if (m < 1 || m > 12 || d < 1 || d > 31) return false;
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

/** Approximate day difference a-b (calendar days). */
function dayDiff(a: string, b: string): number {
  const [ay, am, ad] = a.split('-').map(Number);
  const [by, bm, bd] = b.split('-').map(Number);
  return Math.round((Date.UTC(ay, am - 1, ad) - Date.UTC(by, bm - 1, bd)) / 86_400_000);
}

/** Business days are Mon–Sat (Sunday is the only non-working day). */
function nextBusinessDay(fromYmd: string): string {
  let d = addDays(fromYmd, 1);
  while (weekdayOf(d) === 0) d = addDays(d, 1);
  return d;
}

const WEEKDAY_WORDS: Array<[RegExp, number]> = [
  [/\bsun(?:day)?\b/i, 0],
  [/\bmon(?:day)?\b/i, 1],
  [/\btue(?:s(?:day)?)?\b/i, 2],
  [/\bwed(?:nesday)?\b/i, 3],
  [/\bthu(?:r(?:s(?:day)?)?)?\b/i, 4],
  [/\bfri(?:day)?\b/i, 5],
  [/\bsat(?:urday)?\b/i, 6],
];

// Tier 1 helpers: an M/D[/Y] token is only treated as a delivery date when it
// is anchored — a weekday word right before it ("Monday 4/6") or a
// delivery-ish keyword on the same line ("Deliver by 4/6"). A bare slash
// number is too ambiguous: instructions legitimately contain fractions like
// "3/4 plywood" or "1/2\" boot" that must never become a schedule.
const DATE_TOKEN_RE = /(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?/g;
const WEEKDAY_PREFIX_RE = /(?:sun|mon|tue|wed|thu|fri|sat)[a-z]*[,.\s]+$/i;
const DELIVERY_KEYWORD_RE = /\b(deliver\w*|drop|dropped|need\w*|schedule\w*|arrive\w*|out there|be there)\b/i;

/**
 * Derive the scheduled delivery date for a ticket.
 *
 * @param specialInstructions free text from the order (may be '')
 * @param orderDate           the order PDF's own date field (currently unused
 *                            except as a fallback year hint; may be '')
 * @param receivedAtIso       ISO instant the order email was received
 */
export function deriveScheduledDate(
  specialInstructions: string,
  orderDate: string,
  receivedAtIso: string,
): DerivedSchedule {
  const receivedMs = Date.parse(receivedAtIso || '');
  const received = chicagoDateOf(Number.isFinite(receivedMs) ? new Date(receivedMs) : new Date());
  const text = (specialInstructions || '').trim();

  if (text) {
    // ── Tier 1: explicit M/D[/Y] date, anchored by weekday or keyword ─────
    DATE_TOKEN_RE.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = DATE_TOKEN_RE.exec(text)) !== null) {
      const after = text.slice(m.index + m[0].length, m.index + m[0].length + 1);
      if (after === '"' || after === '”' || after === '″') continue; // inch fraction
      const before = text.slice(Math.max(0, m.index - 16), m.index);
      const line = (text.slice(0, m.index).split('\n').pop() || '') +
        (text.slice(m.index).split('\n')[0] || '');
      const anchored = WEEKDAY_PREFIX_RE.test(before) || DELIVERY_KEYWORD_RE.test(line);
      if (!anchored) continue;

      const month = parseInt(m[1], 10);
      const day = parseInt(m[2], 10);
      let year = m[3] ? parseInt(m[3], 10) : parseInt(received.slice(0, 4), 10);
      if (year < 100) year += 2000;
      if (!isValidCalendarDate(year, month, day)) continue;

      let candidate = ymd(year, month, day);
      // Year rollover: a December order saying "deliver 1/5" means NEXT
      // January, but the received year would place it 11 months in the
      // past. Anything >30d before receipt gets bumped a year forward.
      if (!m[3] && dayDiff(candidate, received) < -30) {
        candidate = ymd(year + 1, month, day);
      }
      // A delivery date in the past is nonsense — it's almost certainly a
      // fraction that slipped the guards ("need 3/4 plywood" reads as Mar 4
      // in April). Skip it and keep scanning for a real date.
      if (dayDiff(candidate, received) < 0) continue;
      return { date: candidate, source: 'parsed', matchedText: m[0].trim() };
    }

    // ── Tier 3a: relative "today"-class words (checked before weekday so
    // "ASAP Monday" resolves to the sooner reading is NOT an issue —
    // today/ASAP always beats a weekday mention) ──────────────────────────
    const relToday = /\b(asap|same[\s-]?day|today)\b/i.exec(text);
    if (relToday) {
      // Received on a Sunday → the first day anything can go out is Monday.
      const date = weekdayOf(received) === 0 ? nextBusinessDay(received) : received;
      return { date, source: 'parsed', matchedText: relToday[0] };
    }
    const relTomorrow = /\b(tomorrow|next[\s-]?day)\b/i.exec(text);
    if (relTomorrow) {
      return { date: nextBusinessDay(received), source: 'parsed', matchedText: relTomorrow[0] };
    }

    // ── Tier 2: weekday-only ("Deliver Wednesday") — earliest mention wins,
    // not the first in Sun–Sat scan order ("Deliver Monday or Tuesday" must
    // schedule Monday, not whichever weekday sorts first). ─────────────────
    let best: { index: number; target: number; matched: string } | null = null;
    for (const [re, target] of WEEKDAY_WORDS) {
      const wm = re.exec(text);
      if (wm && (!best || wm.index < best.index)) {
        best = { index: wm.index, target, matched: wm[0] };
      }
    }
    if (best) {
      const cur = weekdayOf(received);
      // Same weekday as receipt = TODAY, not next week. Orders arrive during
      // the business day, so "deliver Monday" sent Monday morning means this
      // Monday — and if the PM really meant next week, a today-dated ticket
      // fails VISIBLE on the board (design rule) instead of hiding for 7 days.
      const delta = (best.target - cur + 7) % 7;
      return { date: addDays(received, delta), source: 'parsed', matchedText: best.matched };
    }
  }

  // ── Tier 4: no usable instruction — next business day after receipt ─────
  return { date: nextBusinessDay(received), source: 'default' };
}
