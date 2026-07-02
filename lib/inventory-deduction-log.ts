/**
 * Inventory Deduction Idempotency Log
 *
 * Single source of truth for whether a given (ticketId, productName) pair
 * has already had its inventory deducted from Inventory_Products. Prevents
 * the double-deduct edge case called out as M7 in
 * `docs/2026-05-20-verification-pass.md`:
 *
 *   "if a user manually deletes an Invoice row to retry, a re-run of
 *    scripts/post-invoices-and-deduct.mjs or
 *    scripts/bulk-backfill-invoices-and-breakdowns.mjs would happily
 *    deduct the same materials again because the existing dedup checks
 *    Invoice presence, not 'was this ticket's materials deducted.'"
 *
 * Mechanism: append-only `Inventory_Deductions_Log` tab on the master
 * Google Sheet (lazy-create on first write). Both scripts (and any future
 * runtime deduction path in `lib/load-verified-aftermath.ts`) check the
 * log BEFORE deducting and append a row AFTER every successful deduction.
 *
 * Schema (header row):
 *   deductionId, ticketId, productName, productId, qtyBefore, qtyAfter,
 *   qtyDelta, invoiceId, deductedAt, source
 *
 * `source` is the script/route that ran the deduction (e.g.
 *   `post-invoices-and-deduct`, `bulk-backfill`, `load-verified-aftermath`)
 * so we can attribute every row when auditing.
 *
 * The check key is `${ticketId}::${productName.toLowerCase().trim()}`.
 * productName is the human-friendly comparator because the legacy ticket
 * `materialsJson` doesn't always carry a `productId` while always carrying
 * a `productName` — same comparator the scripts use to look up the
 * Inventory_Products row to deduct from.
 *
 * Best-effort write: a failure to append the log row never undoes the
 * deduction (which already happened) — the caller logs to console and
 * continues. Worst case is a missing audit row, NOT a double-deduct, and
 * the next read will still skip the deduction because the qty change
 * landed in the inventory row itself (operators can detect this divergence
 * by comparing the log to inventory `currentQty` history).
 *
 * Cross-instance behavior: the lookup is a fresh sheet read per `checkLog`
 * call, so a single script run sees its own previously-written rows. A
 * second concurrent script run could race the read/write window, but
 * neither script is run concurrently with itself in practice (operators
 * trigger them by hand). The runtime `load-verified-aftermath` path is
 * already gated to "one ticket → one verify-load click" so concurrent
 * deducts for the same (ticket, product) pair are not a real concern.
 */

import type { GoogleSpreadsheet, GoogleSpreadsheetWorksheet } from 'google-spreadsheet';

export const INVENTORY_DEDUCTIONS_LOG_TAB = 'Inventory_Deductions_Log';

export const INVENTORY_DEDUCTIONS_LOG_HEADERS = [
  'deductionId',
  'ticketId',
  'productName',
  'productId',
  'qtyBefore',
  'qtyAfter',
  'qtyDelta',
  'invoiceId',
  'deductedAt',
  'source',
] as const;

export type InventoryDeductionSource =
  | 'post-invoices-and-deduct'
  | 'bulk-backfill'
  | 'load-verified-aftermath'
  | string;

export interface InventoryDeductionLogEntry {
  ticketId: string;
  productName: string;
  productId?: string;
  qtyBefore: number;
  qtyAfter: number;
  qtyDelta: number;
  invoiceId?: string;
  source: InventoryDeductionSource;
  deductedAt?: string;
}

/**
 * Normalized lookup key for "has this (ticket, product) already been
 * deducted?". Lowercase + trimmed product name to match the comparator
 * the scripts use when looking up Inventory_Products rows.
 */
export function makeDeductionKey(ticketId: string, productName: string): string {
  return `${(ticketId || '').trim()}::${(productName || '').toLowerCase().trim()}`;
}

/**
 * Lazy-create the Inventory_Deductions_Log tab and return the worksheet.
 * Safe to call repeatedly — only creates when missing. Caller is
 * responsible for `await doc.loadInfo()` beforehand.
 */
export async function ensureInventoryDeductionsLogSheet(
  doc: GoogleSpreadsheet,
): Promise<GoogleSpreadsheetWorksheet> {
  let sheet = doc.sheetsByTitle[INVENTORY_DEDUCTIONS_LOG_TAB];
  if (!sheet) {
    sheet = await doc.addSheet({
      title: INVENTORY_DEDUCTIONS_LOG_TAB,
      headerValues: [...INVENTORY_DEDUCTIONS_LOG_HEADERS],
    });
  } else {
    // Make sure the header row is loaded so subsequent addRow() calls
    // write into the correct columns even on a sheet created in a
    // previous run (or by hand).
    await sheet.loadHeaderRow().catch(() => undefined);
  }
  return sheet;
}

/**
 * Build a Set of (ticketId, productName) keys already present in the
 * Inventory_Deductions_Log tab. Pass this set to `wasDeducted()` to skip
 * re-deducting on rerun.
 *
 * Reads once at the start of a batch run — keep the set in memory and
 * append to it as you log new deductions, so subsequent ticket loops in
 * the same run see their own new rows without re-reading the sheet.
 */
export async function loadDeductionKeySet(
  doc: GoogleSpreadsheet,
): Promise<Set<string>> {
  const sheet = await ensureInventoryDeductionsLogSheet(doc);
  const rows = await sheet.getRows({ limit: 100000 });
  const keys = new Set<string>();
  for (const row of rows) {
    const ticketId = row.get('ticketId');
    const productName = row.get('productName');
    if (!ticketId || !productName) continue;
    keys.add(makeDeductionKey(ticketId, productName));
  }
  return keys;
}

/**
 * Has the (ticketId, productName) pair already had its inventory
 * deducted? Pure helper — pass the set built by `loadDeductionKeySet`.
 */
export function wasDeducted(
  keys: Set<string>,
  ticketId: string,
  productName: string,
): boolean {
  return keys.has(makeDeductionKey(ticketId, productName));
}

/**
 * Append a deduction-log row. Best-effort: returns true on success, false
 * on failure (after logging to console). Callers should still update the
 * in-memory `Set` they built with `loadDeductionKeySet` regardless of
 * whether the audit row landed — the inventory `currentQty` write already
 * happened, so a future run must still skip even if this audit append
 * failed.
 */
export async function appendDeductionLog(
  doc: GoogleSpreadsheet,
  entry: InventoryDeductionLogEntry,
): Promise<boolean> {
  try {
    const sheet = await ensureInventoryDeductionsLogSheet(doc);
    const deductionId = `DED-${Date.now().toString(36).toUpperCase()}-${Math.random()
      .toString(36)
      .slice(2, 8)
      .toUpperCase()}`;
    await sheet.addRow({
      deductionId,
      ticketId: entry.ticketId,
      productName: entry.productName,
      productId: entry.productId || '',
      qtyBefore: String(entry.qtyBefore),
      qtyAfter: String(entry.qtyAfter),
      qtyDelta: String(entry.qtyDelta),
      invoiceId: entry.invoiceId || '',
      deductedAt: entry.deductedAt || new Date().toISOString(),
      source: entry.source,
    });
    return true;
  } catch (err) {
    console.error('[INVENTORY DEDUCT LOG FAILED]', {
      ticketId: entry.ticketId,
      productName: entry.productName,
      source: entry.source,
      err: err instanceof Error ? err.message : err,
    });
    return false;
  }
}
