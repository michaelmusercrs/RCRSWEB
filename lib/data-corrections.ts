/**
 * Data Corrections Overlay
 *
 * One sheet tab holds hand-applied corrections to the raw QB / data
 * exports. Every chrisview lib that reads a number can call
 * `applyCorrections()` to overlay any matching corrections — so a fix
 * entered once in the sheet propagates to every chart, table, and KPI.
 *
 * The sheet tab is `chrisview_corrections` and has columns:
 *
 *   id            — short slug for the row (auto-generated)
 *   scope         — addresses the value, e.g. "monthly:2024-09:net",
 *                   "annual:2024:net", "lifetime:revenue", "rep:hunter rivers:reviews"
 *   originalValue — what the raw data said
 *   correctedValue— what it should be
 *   reason        — human-readable why (e.g. "hand-correction Michael 2026-05-21,
 *                   reclassified vendor adjustment")
 *   appliedBy     — who entered the correction
 *   appliedAt     — ISO date
 *   status        — "active" (applied) or "rejected" / "superseded" (ignored)
 *
 * SCOPE GRAMMAR
 *
 *   monthly:<YYYY-MM>:<field>     — month-level (revenue|expense|net|invoiceCount)
 *   annual:<YYYY>:<field>         — year-level
 *   lifetime:<field>              — lifetime aggregate
 *   rep:<name>:<field>            — per-rep
 *   carrier:<name>:<field>        — per-carrier
 *   custom:<key>                  — anything else; lib looks up by exact key
 *
 * Corrections are cached for 5 min in-memory + 90 min in the sheet
 * cache layer (writes from cron). To force a refresh, append the
 * correction in the sheet and either wait for the in-memory TTL or
 * call `invalidateCorrectionsCache()` from a redeploy.
 */

export interface DataCorrection {
  id: string;
  scope: string;
  originalValue: string;
  correctedValue: string;
  reason: string;
  appliedBy: string;
  appliedAt: string;
  status: string;
}

const CACHE_TTL_MS = 5 * 60 * 1000;
let _cache: { rows: DataCorrection[]; at: number } | null = null;

export function invalidateCorrectionsCache() {
  _cache = null;
}

async function getSheet() {
  const sheetsId = process.env.GOOGLE_SHEETS_ID;
  const svcEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const svcKey = process.env.GOOGLE_PRIVATE_KEY;
  if (!sheetsId || !svcEmail || !svcKey) return null;
  const { GoogleSpreadsheet } = await import('google-spreadsheet');
  const { JWT } = await import('google-auth-library');
  const auth = new JWT({
    email: svcEmail,
    key: svcKey.replace(/\\n/g, '\n'),
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  const doc = new GoogleSpreadsheet(sheetsId, auth);
  await doc.loadInfo();
  let sheet = doc.sheetsByTitle['chrisview_corrections'];
  if (!sheet) {
    sheet = await doc.addSheet({
      title: 'chrisview_corrections',
      headerValues: ['id', 'scope', 'originalValue', 'correctedValue', 'reason', 'appliedBy', 'appliedAt', 'status'],
    });
    // Seed with a sample row so an editor can see the format.
    await sheet.addRow({
      id: 'example',
      scope: 'annual:2024:net',
      originalValue: '-869000',
      correctedValue: '-280000',
      reason: 'EXAMPLE — replace with real corrections. Reclassified vendor adjustment.',
      appliedBy: 'system',
      appliedAt: new Date().toISOString(),
      status: 'rejected',
    });
  }
  return sheet;
}

export async function loadCorrections(): Promise<DataCorrection[]> {
  if (_cache && Date.now() - _cache.at < CACHE_TTL_MS) return _cache.rows;
  try {
    const sheet = await getSheet();
    if (!sheet) {
      _cache = { rows: [], at: Date.now() };
      return [];
    }
    const rows = await sheet.getRows();
    const out: DataCorrection[] = rows.map(r => ({
      id: String(r.get('id') || ''),
      scope: String(r.get('scope') || '').trim(),
      originalValue: String(r.get('originalValue') || ''),
      correctedValue: String(r.get('correctedValue') || ''),
      reason: String(r.get('reason') || ''),
      appliedBy: String(r.get('appliedBy') || ''),
      appliedAt: String(r.get('appliedAt') || ''),
      status: String(r.get('status') || 'active'),
    })).filter(c => c.scope && c.status === 'active');
    _cache = { rows: out, at: Date.now() };
    return out;
  } catch (err) {
    console.warn('[data-corrections] load failed:', err);
    _cache = { rows: [], at: Date.now() };
    return [];
  }
}

/**
 * Build a lookup map for fast access — keyed by scope string.
 * Use when you have many lookups in a loop.
 */
export async function loadCorrectionsMap(): Promise<Map<string, DataCorrection>> {
  const rows = await loadCorrections();
  const m = new Map<string, DataCorrection>();
  for (const r of rows) m.set(r.scope, r);
  return m;
}

/**
 * Look up one correction. Returns undefined if no active correction
 * exists for that scope.
 */
export async function getCorrection(scope: string): Promise<DataCorrection | undefined> {
  const m = await loadCorrectionsMap();
  return m.get(scope);
}

/**
 * Apply a correction in-place to a numeric field.
 * Returns { value, wasCorrected }.
 */
export async function applyCorrection(
  scope: string,
  originalValue: number,
): Promise<{ value: number; wasCorrected: boolean; correction?: DataCorrection }> {
  const c = await getCorrection(scope);
  if (!c) return { value: originalValue, wasCorrected: false };
  const corrected = parseFloat(c.correctedValue);
  if (!Number.isFinite(corrected)) return { value: originalValue, wasCorrected: false };
  return { value: corrected, wasCorrected: true, correction: c };
}

/**
 * Sync variant — when you already have the map loaded.
 */
export function applyCorrectionSync(
  scope: string,
  originalValue: number,
  map: Map<string, DataCorrection>,
): { value: number; wasCorrected: boolean; correction?: DataCorrection } {
  const c = map.get(scope);
  if (!c) return { value: originalValue, wasCorrected: false };
  const corrected = parseFloat(c.correctedValue);
  if (!Number.isFinite(corrected)) return { value: originalValue, wasCorrected: false };
  return { value: corrected, wasCorrected: true, correction: c };
}

/**
 * Format helper: turn a year + field into a scope string.
 */
export function annualScope(year: number | string, field: string): string {
  return `annual:${year}:${field}`;
}

export function monthlyScope(month: string, field: string): string {
  return `monthly:${month}:${field}`;
}

export function lifetimeScope(field: string): string {
  return `lifetime:${field}`;
}

export function repScope(repName: string, field: string): string {
  return `rep:${repName.toLowerCase().trim()}:${field}`;
}

export function carrierScope(carrier: string, field: string): string {
  return `carrier:${carrier.toLowerCase().trim()}:${field}`;
}

/**
 * Apply corrections across an array of {year, rev, exp, net, ...} rows.
 * Mutates the array. Use during /api/chrisview, /chrisview-history, etc.
 */
export async function applyAnnualCorrections<T extends { year: string | number; revenue?: number; expense?: number; net?: number }>(
  rows: T[],
): Promise<{ corrected: number }> {
  const map = await loadCorrectionsMap();
  let count = 0;
  for (const r of rows) {
    const yr = String(r.year);
    if (r.revenue != null) {
      const { value, wasCorrected } = applyCorrectionSync(annualScope(yr, 'revenue'), r.revenue, map);
      if (wasCorrected) { r.revenue = value; count++; }
    }
    if (r.expense != null) {
      const { value, wasCorrected } = applyCorrectionSync(annualScope(yr, 'expense'), r.expense, map);
      if (wasCorrected) { r.expense = value; count++; }
    }
    if (r.net != null) {
      const { value, wasCorrected } = applyCorrectionSync(annualScope(yr, 'net'), r.net, map);
      if (wasCorrected) { r.net = value; count++; }
    }
  }
  return { corrected: count };
}

/**
 * Apply corrections across {month, revenue, expense, net, ...} rows.
 */
export async function applyMonthlyCorrections<T extends { month: string; revenue?: number; expense?: number; net?: number }>(
  rows: T[],
): Promise<{ corrected: number }> {
  const map = await loadCorrectionsMap();
  let count = 0;
  for (const r of rows) {
    if (r.revenue != null) {
      const { value, wasCorrected } = applyCorrectionSync(monthlyScope(r.month, 'revenue'), r.revenue, map);
      if (wasCorrected) { r.revenue = value; count++; }
    }
    if (r.expense != null) {
      const { value, wasCorrected } = applyCorrectionSync(monthlyScope(r.month, 'expense'), r.expense, map);
      if (wasCorrected) { r.expense = value; count++; }
    }
    if (r.net != null) {
      const { value, wasCorrected } = applyCorrectionSync(monthlyScope(r.month, 'net'), r.net, map);
      if (wasCorrected) { r.net = value; count++; }
    }
  }
  return { corrected: count };
}
