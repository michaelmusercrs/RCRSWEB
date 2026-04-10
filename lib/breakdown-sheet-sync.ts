/**
 * Breakdown Sheet Sync
 *
 * Bidirectional sync between the portal's CustomerBreakdown data model and
 * per-job Google Sheets tabs formatted in the historical 8-column Excel
 * layout (see scripts/verify-breakdown-calcs.js → parseBreakdownFile for the
 * authoritative layout reference).
 *
 * Exports:
 *   - writeBreakdownSheet:   portal → Sheets (writes / overwrites a tab
 *                             named {rNumber}_{customer})
 *   - readBreakdownSheet:    Sheets → portal (parses the tab back into a
 *                             partial CustomerBreakdown)
 *   - detectPendingChanges:  diffs the sheet against the live portal
 *                             breakdown, returns the changed fields so a
 *                             portal user can accept / reject edits
 *
 * Layout (rows are 1-indexed like Excel, cells are 0-indexed in the API):
 *
 *   Row  1: Name | <customer>                 | Job Number | <rNumber>      | Inspector | <initials>
 *   Row  2: Date Installed: | <iso date>
 *   Rows 3-10: Material suppliers (col A name, col B amount)
 *              Row 3 right:  Job Total        | <totals.jobTotal>
 *              Row 4 right:  Overhead         | <totals.overheadTotal>
 *              Row 5 right:  Material         | <totals.materialSubtotal>
 *              Row 6 right:  Labor            | <totals.laborTotal>
 *              Row 7 right:  Permit           | <breakdown.permit>
 *              Row 8 right:  Job profit       | <totals.jobProfit>
 *              Row 9 right:  Sales Rep        | <totals.salesRepCommission>
 *              Row 10 right: Pres             | <totals.presCommission>
 *              Row 11 right: Vp               | <totals.vpCommission>
 *   Rows 12-14: Material credits (col A name, col B amount) — ALWAYS subtract
 *   Row 15: Deposit        | <first deposit>  | <date> | <check#>
 *   Row 16: Final Payment  | <final sum>      | <date> | <check#>
 *   Row 17: Total Material Cost | <matSubtotal> |      | Balance | <balance>
 *   Rows 19-21: Labor subcontractors (col A name, col B amount, col C `{date} #{num}`)
 *              Row 20 right: Commission Paid On Deposit | <paidOnDeposit>
 *              Row 21 right: Final Payout Due           | <commissionOutstanding>
 *              Row 22 right: Job Profit                 | <profitPercentDisplay>%
 *   Row 23: Labor Total | <laborTotal> |      | Total Sales Commission | <salesRepCommission>
 *
 * Hidden metadata (col H) — used for the pending-changes diff:
 *   H1 = JSON { breakdownId, updatedAt, totalsHash }
 *   H2 = breakdownId (denormalized for fast lookup)
 *
 * The formatted per-job tab is a MIRROR. The canonical source of truth is
 * the CustomerBreakdowns JSON tab written by saveBreakdown(). If this sync
 * fails, saveBreakdown() still succeeds — failures here are logged and
 * swallowed (see wiring in customer-breakdown-service.ts).
 */

import type { GoogleSpreadsheet, GoogleSpreadsheetWorksheet } from 'google-spreadsheet';
import { googleSheetsService } from '@/lib/google-sheets-service';
import type {
  CustomerBreakdown,
  CalculatedTotals,
  MaterialLineItem,
  LaborLineItem,
  PaymentLineItem,
} from '@/lib/customer-breakdown-service';

// Accessor for the private `doc` on googleSheetsService
type SheetsServiceWithDoc = { doc: GoogleSpreadsheet | null };

// ─── Layout constants (row indices are 0-based like the Google Sheets API) ─
// Single source of truth for the per-job tab layout. Change these in one
// place and both the writer and reader pick up the new positions. Bumped
// from the original 8/3/3 caps to 100/25/25/25 per Michael's directive.
const LAYOUT = {
  // Header rows 1-2 (index 0-1)
  // Right-column summary at rows 3-17 (index 2-16)
  // Left-column material section starts below the summary.
  MATERIALS_HEADER: 19,        // row 20 — "MATERIAL SUPPLIERS" label
  MATERIALS_START: 20,         // row 21 — first supplier row
  POSITIVE_MATERIALS_CAP: 100, // 100 positive supplier rows (rows 21-120)

  CREDITS_HEADER: 122,         // row 123 — "MATERIAL CREDITS" label
  CREDITS_START: 123,          // row 124 — first credit row
  CREDITS_CAP: 25,             // 25 credit rows (rows 124-148)

  TOTAL_MATERIAL_ROW: 150,     // row 151 — Total Material Cost footer

  PAYMENTS_HEADER: 153,        // row 154 — "PAYMENTS RECEIVED" label
  PAYMENTS_START: 154,         // row 155 — first payment row
  PAYMENTS_CAP: 25,            // 25 payment rows (rows 155-179)

  LABOR_HEADER: 181,           // row 182 — "LABOR / SUBCONTRACTORS" label
  LABOR_START: 182,            // row 183 — first labor row
  LABOR_CAP: 25,               // 25 labor rows (rows 183-207)

  LABOR_TOTAL_ROW: 209,        // row 210 — Labor Total footer

  TOTAL_ROWS: 215,             // outer range A1:H215
} as const;

// ─── Helpers ─────────────────────────────────────────────────────────────

function round2(n: number): number {
  return Math.round((Number(n) || 0) * 100) / 100;
}

/**
 * Sheet tab name from a breakdown. Google Sheets caps tab names at 100 chars;
 * we cap ourselves at 50 so there's headroom. Only alphanumerics, underscores
 * and dashes survive — spaces become underscores.
 */
export function sanitizeSheetName(rNumber: string, customerName: string): string {
  const safeR = String(rNumber || '').replace(/[^A-Za-z0-9_-]/g, '');
  const safeName = String(customerName || '')
    .trim()
    .replace(/\s+/g, '_')
    .replace(/[^A-Za-z0-9_-]/g, '');
  const combined = safeName ? `${safeR}_${safeName}` : safeR || 'Breakdown';
  return combined.substring(0, 50) || 'Breakdown';
}

/**
 * Compute a lightweight hash of the breakdown+totals to detect whether the
 * sheet stored on Google still matches what the portal would write now.
 * If a user (Sara) edits the sheet directly, their changes won't match this
 * hash and we know pending edits exist.
 */
function computeTotalsHash(breakdown: CustomerBreakdown, totals: CalculatedTotals): string {
  return `${breakdown.updatedAt}_${round2(totals.jobProfit)}`;
}

/** First + last initial of a name ("Hunter Rivers" → "HR"). */
function initialsFrom(name: string): string {
  if (!name) return '';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0) return '';
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

/** Parse a cell value that might be "$1,234.56", 1234.56, or "". */
function parseCurrency(raw: unknown): number {
  if (raw === null || raw === undefined || raw === '') return 0;
  if (typeof raw === 'number') return raw;
  const cleaned = String(raw)
    .replace(/[$,\s]/g, '')
    .replace(/\(/g, '-')
    .replace(/\)/g, '');
  const n = parseFloat(cleaned);
  return isNaN(n) ? 0 : n;
}

/** Find the sheet for a given R-number. Matches by `{rNumber}_` prefix. */
function findSheetForRNumber(
  doc: GoogleSpreadsheet,
  rNumber: string
): GoogleSpreadsheetWorksheet | null {
  const prefix = `${rNumber}_`;
  const sheets = doc.sheetsByTitle;
  // Exact prefix match (most reliable)
  for (const title of Object.keys(sheets)) {
    if (title === rNumber || title.startsWith(prefix)) {
      return sheets[title];
    }
  }
  return null;
}

/** Pull the doc off googleSheetsService after init(), or null if unavailable. */
async function getDoc(): Promise<GoogleSpreadsheet | null> {
  const ready = await googleSheetsService.init();
  if (!ready) return null;
  const doc = (googleSheetsService as unknown as SheetsServiceWithDoc).doc;
  return doc || null;
}

// ─── writeBreakdownSheet ─────────────────────────────────────────────────

export async function writeBreakdownSheet(
  breakdown: CustomerBreakdown,
  totals: CalculatedTotals
): Promise<{ success: boolean; sheetName: string; url?: string; reason?: string }> {
  const sheetName = sanitizeSheetName(breakdown.rNumber, breakdown.customerName);
  try {
    const doc = await getDoc();
    if (!doc) {
      return { success: false, sheetName, reason: 'Google Sheets not initialized' };
    }

    // Scaled layout: up to 100 positive materials, 25 credits, 25 payments,
    // 25 labor lines. Sheet range grows to A1:H250. See LAYOUT constants below.
    const TOTAL_ROWS = LAYOUT.TOTAL_ROWS;
    const CELL_RANGE = `A1:H${TOTAL_ROWS}`;

    // Find-or-create the tab.
    let sheet: GoogleSpreadsheetWorksheet | undefined = doc.sheetsByTitle[sheetName];
    if (!sheet) {
      sheet = await doc.addSheet({
        title: sheetName,
        gridProperties: { columnCount: 10, rowCount: TOTAL_ROWS + 10 },
      });
    } else {
      // Overwriting — wipe existing content in the new expanded range.
      // Using `clear` on a range (rather than deleting + recreating the tab)
      // preserves the sheet's gid so the permalink URL stays stable.
      try {
        await sheet.clear(CELL_RANGE);
      } catch {
        try { await sheet.clear(); } catch { /* ignore */ }
      }
      if (
        sheet.gridProperties &&
        ((sheet.gridProperties.columnCount ?? 0) < 8 || (sheet.gridProperties.rowCount ?? 0) < TOTAL_ROWS)
      ) {
        await sheet.resize({ columnCount: 10, rowCount: TOTAL_ROWS + 10 });
      }
    }

    await sheet.loadCells(CELL_RANGE);

    // Column indices (0-based): A=0, B=1, C=2, D=3, E=4, F=5, G=6, H=7
    const A = 0, B = 1, C = 2, D = 3, E = 4, F = 5, H = 7;

    // ── Row 1: Name | customer | Job Number | rNumber | Inspector | initials
    sheet.getCell(0, A).value = 'Name';
    sheet.getCell(0, B).value = breakdown.customerName || '';
    sheet.getCell(0, C).value = 'Job Number';
    sheet.getCell(0, D).value = breakdown.rNumber || '';
    sheet.getCell(0, E).value = 'Inspector ';
    sheet.getCell(0, F).value = initialsFrom(breakdown.salesRep || breakdown.inspector || '');

    // ── Row 2: Date Installed
    sheet.getCell(1, A).value = 'Date Installed:';
    sheet.getCell(1, B).value = breakdown.dateInstalled || '';

    // ── Right-column financial summary (stays at top, rows 3-11)
    // Rows are pinned so the summary is glanceable even when the material
    // list scrolls for dozens of rows. Labels in col E, values in col F.
    sheet.getCell(2, E).value = 'Job Total';
    sheet.getCell(2, F).value = round2(totals.jobTotal);
    sheet.getCell(3, E).value = 'Overhead';
    sheet.getCell(3, F).value = round2(totals.overheadTotal);
    sheet.getCell(4, E).value = 'Material';
    sheet.getCell(4, F).value = round2(totals.materialSubtotal);
    sheet.getCell(5, E).value = 'Labor';
    sheet.getCell(5, F).value = round2(totals.laborTotal);
    sheet.getCell(6, E).value = 'Permit';
    sheet.getCell(6, F).value = round2(breakdown.permit || 0);
    sheet.getCell(7, E).value = 'Job profit';
    sheet.getCell(7, F).value = round2(totals.jobProfit);
    sheet.getCell(8, E).value = 'Sales Rep';
    sheet.getCell(8, F).value = round2(totals.salesRepCommission);
    sheet.getCell(9, E).value = 'Pres';
    sheet.getCell(9, F).value = round2(totals.presCommission || 0);
    sheet.getCell(10, E).value = 'Vp';
    sheet.getCell(10, F).value = round2(totals.vpCommission || 0);

    // ── Right-column commission detail rows (rows 13-16)
    sheet.getCell(12, E).value = 'Balance';
    sheet.getCell(12, F).value = round2(totals.balance);
    sheet.getCell(13, E).value = 'Commission Paid On Deposit';
    sheet.getCell(13, F).value = round2(breakdown.commissionsPaid?.onDeposit?.amount || 0);
    sheet.getCell(14, E).value = 'Final Payout Due';
    sheet.getCell(14, F).value = round2(totals.commissionOutstanding);
    sheet.getCell(15, E).value = `Job Profit %`;
    sheet.getCell(15, F).value = `${round2(totals.profitPercentDisplay)}%`;
    sheet.getCell(16, E).value = 'Total Sales Commission';
    sheet.getCell(16, F).value = round2(totals.salesRepCommission);

    // ── MATERIAL SUPPLIERS header (row LAYOUT.MATERIALS_HEADER)
    sheet.getCell(LAYOUT.MATERIALS_HEADER, A).value = 'MATERIAL SUPPLIERS';
    sheet.getCell(LAYOUT.MATERIALS_HEADER, B).value = 'Amount';
    sheet.getCell(LAYOUT.MATERIALS_HEADER, C).value = 'Description';

    // ── Positive materials — up to LAYOUT.POSITIVE_MATERIALS_CAP (100)
    const positiveMaterials = breakdown.materials
      .filter(m => !m.isCredit)
      .slice(0, LAYOUT.POSITIVE_MATERIALS_CAP);
    for (let i = 0; i < LAYOUT.POSITIVE_MATERIALS_CAP; i++) {
      const rowIdx = LAYOUT.MATERIALS_START + i;
      const mat = positiveMaterials[i];
      sheet.getCell(rowIdx, A).value = mat ? mat.supplier : '';
      sheet.getCell(rowIdx, B).value = mat ? round2(mat.amount) : '';
      sheet.getCell(rowIdx, C).value = mat ? (mat.description || '') : '';
    }

    // ── MATERIAL CREDITS header
    sheet.getCell(LAYOUT.CREDITS_HEADER, A).value = 'MATERIAL CREDITS';
    sheet.getCell(LAYOUT.CREDITS_HEADER, B).value = 'Amount';
    sheet.getCell(LAYOUT.CREDITS_HEADER, C).value = 'Description';

    // ── Credits — up to LAYOUT.CREDITS_CAP (25)
    const creditMaterials = breakdown.materials
      .filter(m => m.isCredit)
      .slice(0, LAYOUT.CREDITS_CAP);
    for (let i = 0; i < LAYOUT.CREDITS_CAP; i++) {
      const rowIdx = LAYOUT.CREDITS_START + i;
      const credit = creditMaterials[i];
      sheet.getCell(rowIdx, A).value = credit ? credit.supplier : '';
      sheet.getCell(rowIdx, B).value = credit ? round2(credit.amount) : '';
      sheet.getCell(rowIdx, C).value = credit ? (credit.description || '') : '';
    }

    // ── Total Material Cost footer row
    sheet.getCell(LAYOUT.TOTAL_MATERIAL_ROW, A).value = 'Total Material Cost';
    sheet.getCell(LAYOUT.TOTAL_MATERIAL_ROW, B).value = round2(totals.materialSubtotal);

    // ── PAYMENTS header
    sheet.getCell(LAYOUT.PAYMENTS_HEADER, A).value = 'PAYMENTS RECEIVED';
    sheet.getCell(LAYOUT.PAYMENTS_HEADER, B).value = 'Amount';
    sheet.getCell(LAYOUT.PAYMENTS_HEADER, C).value = 'Date';
    sheet.getCell(LAYOUT.PAYMENTS_HEADER, D).value = 'Check #';

    // ── Payments — up to LAYOUT.PAYMENTS_CAP (25)
    const payments = (breakdown.paymentsIn || []).slice(0, LAYOUT.PAYMENTS_CAP);
    for (let i = 0; i < LAYOUT.PAYMENTS_CAP; i++) {
      const rowIdx = LAYOUT.PAYMENTS_START + i;
      const p: PaymentLineItem | undefined = payments[i];
      sheet.getCell(rowIdx, A).value = p ? (p.kind === 'deposit' ? 'Deposit' : p.kind === 'final' ? 'Final Payment' : 'Progress') : '';
      sheet.getCell(rowIdx, B).value = p ? round2(p.amount) : '';
      sheet.getCell(rowIdx, C).value = p?.date || '';
      sheet.getCell(rowIdx, D).value = p?.checkNumber || '';
    }

    // ── LABOR / SUBCONTRACTORS header
    sheet.getCell(LAYOUT.LABOR_HEADER, A).value = 'LABOR / SUBCONTRACTORS';
    sheet.getCell(LAYOUT.LABOR_HEADER, B).value = 'Amount';
    sheet.getCell(LAYOUT.LABOR_HEADER, C).value = 'Check Date';
    sheet.getCell(LAYOUT.LABOR_HEADER, D).value = 'Check #';

    // ── Labor — up to LAYOUT.LABOR_CAP (25), excluding workers comp auto-lines
    const laborLines = (breakdown.labor || [])
      .filter(l => !l.isWorkersComp)
      .slice(0, LAYOUT.LABOR_CAP);
    for (let i = 0; i < LAYOUT.LABOR_CAP; i++) {
      const rowIdx = LAYOUT.LABOR_START + i;
      const lbr = laborLines[i];
      sheet.getCell(rowIdx, A).value = lbr ? lbr.subcontractor : '';
      sheet.getCell(rowIdx, B).value = lbr ? round2(lbr.amount) : '';
      sheet.getCell(rowIdx, C).value = lbr?.checkDate || '';
      sheet.getCell(rowIdx, D).value = lbr?.checkNumber || '';
    }

    // ── Labor Total footer row
    sheet.getCell(LAYOUT.LABOR_TOTAL_ROW, A).value = 'Labor Total';
    sheet.getCell(LAYOUT.LABOR_TOTAL_ROW, B).value = round2(totals.laborTotal);

    // ── Hidden metadata (col H) — used by detectPendingChanges
    const metadata = {
      breakdownId: breakdown.breakdownId,
      updatedAt: breakdown.updatedAt,
      totalsHash: computeTotalsHash(breakdown, totals),
      layoutVersion: 2, // bump when LAYOUT constants change
    };
    sheet.getCell(0, H).value = JSON.stringify(metadata);
    sheet.getCell(1, H).value = breakdown.breakdownId;

    await sheet.saveUpdatedCells();

    // Try to construct the permalink URL. `sheet.sheetId` is the numeric gid.
    const spreadsheetId = doc.spreadsheetId;
    const gid = sheet.sheetId;
    const url = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit#gid=${gid}`;

    return { success: true, sheetName, url };
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    console.error('[breakdown-sheet-sync] writeBreakdownSheet failed:', reason);
    return { success: false, sheetName, reason };
  }
}

// ─── readBreakdownSheet ──────────────────────────────────────────────────

export async function readBreakdownSheet(
  rNumber: string
): Promise<{ success: boolean; parsed?: Partial<CustomerBreakdown>; reason?: string }> {
  try {
    const doc = await getDoc();
    if (!doc) {
      return { success: false, reason: 'Google Sheets not initialized' };
    }

    const sheet = findSheetForRNumber(doc, rNumber);
    if (!sheet) {
      return { success: false, reason: `No sheet found for ${rNumber}` };
    }

    const CELL_RANGE = `A1:H${LAYOUT.TOTAL_ROWS}`;
    await sheet.loadCells(CELL_RANGE);

    const A = 0, B = 1, C = 2, D = 3, F = 5, H = 7;
    const valAt = (r: number, c: number): unknown => sheet.getCell(r, c).value;
    const strAt = (r: number, c: number): string => {
      const v = valAt(r, c);
      return v === null || v === undefined ? '' : String(v).trim();
    };

    // Header row
    const customerName = strAt(0, B);
    const rNumberFromSheet = strAt(0, D);
    const inspector = strAt(0, F);
    const dateInstalled = strAt(1, B);

    // Financials in the right column — same rows as before (2-16)
    const jobTotal = parseCurrency(valAt(2, F));
    const permit = parseCurrency(valAt(6, F));

    // Positive materials from the expanded block
    const materials: MaterialLineItem[] = [];
    for (let i = 0; i < LAYOUT.POSITIVE_MATERIALS_CAP; i++) {
      const r = LAYOUT.MATERIALS_START + i;
      const supplier = strAt(r, A);
      const amt = parseCurrency(valAt(r, B));
      if (!supplier || amt === 0) continue;
      // Skip anything that looks like a financial/section label
      if (/^(MATERIAL|Material|Labor|Total Material Cost|Labor Total|Deposit|Final Payment|Balance|PAYMENTS|CREDITS)/i.test(supplier)) {
        continue;
      }
      const description = strAt(r, C);
      materials.push({
        supplier,
        amount: round2(amt),
        isCredit: false,
        ...(description ? { description } : {}),
      });
    }

    // Material credits from the expanded credits block
    for (let i = 0; i < LAYOUT.CREDITS_CAP; i++) {
      const r = LAYOUT.CREDITS_START + i;
      const supplier = strAt(r, A);
      const amt = parseCurrency(valAt(r, B));
      if (!supplier || amt === 0) continue;
      if (/^(MATERIAL|CREDITS|Total Material Cost)/i.test(supplier)) continue;
      const description = strAt(r, C);
      materials.push({
        supplier,
        amount: round2(amt),
        isCredit: true,
        ...(description ? { description } : {}),
      });
    }

    // Labor from the expanded labor block
    const labor: LaborLineItem[] = [];
    for (let i = 0; i < LAYOUT.LABOR_CAP; i++) {
      const r = LAYOUT.LABOR_START + i;
      const sub = strAt(r, A);
      const amt = parseCurrency(valAt(r, B));
      if (!sub || amt === 0) continue;
      if (/^(LABOR|Labor Total|Total Sales Commission)/i.test(sub)) continue;
      const checkDate = strAt(r, C);
      const checkNumber = strAt(r, D);
      labor.push({
        subcontractor: sub,
        amount: round2(amt),
        ...(checkDate ? { checkDate } : {}),
        ...(checkNumber ? { checkNumber } : {}),
      });
    }

    // Metadata from H1/H2 (optional — used by detectPendingChanges)
    let breakdownId = '';
    try {
      const metaRaw = strAt(0, H);
      if (metaRaw) {
        const meta = JSON.parse(metaRaw);
        if (meta && typeof meta.breakdownId === 'string') {
          breakdownId = meta.breakdownId;
        }
      }
      if (!breakdownId) {
        breakdownId = strAt(1, H);
      }
    } catch {
      breakdownId = strAt(1, H);
    }

    const parsed: Partial<CustomerBreakdown> = {
      breakdownId: breakdownId || undefined,
      rNumber: rNumberFromSheet || rNumber,
      customerName,
      inspector: inspector || undefined,
      dateInstalled: dateInstalled || undefined,
      jobTotal,
      permit,
      materials,
      labor,
    };

    // We intentionally don't parse paymentsIn/commissionsPaid — those have
    // dates and check numbers that don't reliably round-trip through the
    // single-line Deposit/Final Payment rows, so changing them in-sheet
    // isn't an intended edit path. Payment edits flow through the portal.
    void D; // silence unused

    return { success: true, parsed };
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    console.error('[breakdown-sheet-sync] readBreakdownSheet failed:', reason);
    return { success: false, reason };
  }
}

// ─── detectPendingChanges ────────────────────────────────────────────────

export async function detectPendingChanges(
  breakdown: CustomerBreakdown,
  totals: CalculatedTotals
): Promise<{
  hasChanges: boolean;
  changes: Array<{ field: string; portalValue: unknown; sheetValue: unknown }>;
}> {
  void totals; // totals only used to mirror writeBreakdownSheet's signature

  const read = await readBreakdownSheet(breakdown.rNumber);
  if (!read.success || !read.parsed) {
    return { hasChanges: false, changes: [] };
  }

  const parsed = read.parsed;
  const changes: Array<{ field: string; portalValue: unknown; sheetValue: unknown }> = [];

  // jobTotal
  if (
    typeof parsed.jobTotal === 'number' &&
    round2(parsed.jobTotal) !== round2(breakdown.jobTotal)
  ) {
    changes.push({
      field: 'jobTotal',
      portalValue: round2(breakdown.jobTotal),
      sheetValue: round2(parsed.jobTotal),
    });
  }

  // permit
  if (
    typeof parsed.permit === 'number' &&
    round2(parsed.permit) !== round2(breakdown.permit || 0)
  ) {
    changes.push({
      field: 'permit',
      portalValue: round2(breakdown.permit || 0),
      sheetValue: round2(parsed.permit),
    });
  }

  // materials — compare by (supplier name, isCredit) key, amount per entry
  const portalMatMap = new Map<string, number>();
  for (const m of breakdown.materials) {
    const key = `${m.supplier.toLowerCase().trim()}|${m.isCredit ? 'credit' : 'positive'}`;
    portalMatMap.set(key, round2((portalMatMap.get(key) || 0) + Number(m.amount || 0)));
  }
  const sheetMatMap = new Map<string, number>();
  for (const m of parsed.materials || []) {
    const key = `${m.supplier.toLowerCase().trim()}|${m.isCredit ? 'credit' : 'positive'}`;
    sheetMatMap.set(key, round2((sheetMatMap.get(key) || 0) + Number(m.amount || 0)));
  }

  const allMatKeys = new Set([...portalMatMap.keys(), ...sheetMatMap.keys()]);
  for (const key of allMatKeys) {
    const portalAmt = portalMatMap.get(key) ?? 0;
    const sheetAmt = sheetMatMap.get(key) ?? 0;
    if (round2(portalAmt) !== round2(sheetAmt)) {
      changes.push({
        field: `material:${key}`,
        portalValue: portalAmt,
        sheetValue: sheetAmt,
      });
    }
  }

  // labor — same treatment (subcontractor name → amount)
  const portalLabMap = new Map<string, number>();
  for (const l of breakdown.labor) {
    if (l.isWorkersComp) continue;
    const key = l.subcontractor.toLowerCase().trim();
    portalLabMap.set(key, round2((portalLabMap.get(key) || 0) + Number(l.amount || 0)));
  }
  const sheetLabMap = new Map<string, number>();
  for (const l of parsed.labor || []) {
    const key = l.subcontractor.toLowerCase().trim();
    sheetLabMap.set(key, round2((sheetLabMap.get(key) || 0) + Number(l.amount || 0)));
  }

  const allLabKeys = new Set([...portalLabMap.keys(), ...sheetLabMap.keys()]);
  for (const key of allLabKeys) {
    const portalAmt = portalLabMap.get(key) ?? 0;
    const sheetAmt = sheetLabMap.get(key) ?? 0;
    if (round2(portalAmt) !== round2(sheetAmt)) {
      changes.push({
        field: `labor:${key}`,
        portalValue: portalAmt,
        sheetValue: sheetAmt,
      });
    }
  }

  return { hasChanges: changes.length > 0, changes };
}
