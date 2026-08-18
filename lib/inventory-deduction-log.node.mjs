/**
 * Inventory Deduction Idempotency Log — Node ESM (.mjs) companion
 *
 * Mirrors `lib/inventory-deduction-log.ts` for use from plain Node ESM
 * scripts under `scripts/*.mjs`. The TypeScript helper exists for the
 * runtime (Next.js) deduction path in `lib/load-verified-aftermath.ts`;
 * this `.mjs` exists because `.mjs` files cannot directly import `.ts`
 * (no transpiler involved at script-runtime).
 *
 * IMPORTANT: keep the schema constants here in sync with the `.ts`
 * version — same tab name, same headers, same key format. Both write to
 * the same `Inventory_Deductions_Log` tab on the master sheet.
 *
 * See `lib/inventory-deduction-log.ts` for full design notes (why we
 * key on (ticketId, productName), idempotency semantics, best-effort
 * write behavior, etc.).
 */

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
];

/** Normalized lookup key — must match `.ts` `makeDeductionKey` exactly. */
export function makeDeductionKey(ticketId, productName) {
  return `${(ticketId || '').trim()}::${(productName || '').toLowerCase().trim()}`;
}

/**
 * Lazy-create the Inventory_Deductions_Log tab and return the worksheet.
 * Caller is responsible for `await doc.loadInfo()` beforehand.
 */
export async function ensureInventoryDeductionsLogSheet(doc) {
  let sheet = doc.sheetsByTitle[INVENTORY_DEDUCTIONS_LOG_TAB];
  if (!sheet) {
    sheet = await doc.addSheet({
      title: INVENTORY_DEDUCTIONS_LOG_TAB,
      headerValues: INVENTORY_DEDUCTIONS_LOG_HEADERS,
    });
  } else {
    try {
      await sheet.loadHeaderRow();
    } catch {
      // header already loaded — fine
    }
  }
  return sheet;
}

/**
 * Build a Set of (ticketId, productName) keys already present in the log.
 * Read once at the top of a batch run; append in-memory as you write new
 * rows so subsequent ticket loops see their own writes without re-reading.
 */
export async function loadDeductionKeySet(doc) {
  const sheet = await ensureInventoryDeductionsLogSheet(doc);
  const rows = await sheet.getRows();
  // NET-delta aware (must match .ts): a key counts as "deducted" only while its
  // summed qtyDelta is still negative, so a reversal (undo-verify-load) that
  // cancels the original deduction lets a later re-verify deduct again once.
  const net = new Map();
  for (const row of rows) {
    const ticketId = row.get('ticketId');
    const productName = row.get('productName');
    if (!ticketId || !productName) continue;
    const key = makeDeductionKey(ticketId, productName);
    const delta = parseFloat(String(row.get('qtyDelta') ?? '')) || 0;
    net.set(key, (net.get(key) || 0) + delta);
  }
  const keys = new Set();
  for (const [key, delta] of net) {
    if (delta < 0) keys.add(key);
  }
  return keys;
}

/** Has this (ticketId, productName) pair already been deducted? */
export function wasDeducted(keys, ticketId, productName) {
  return keys.has(makeDeductionKey(ticketId, productName));
}

/**
 * Append a deduction-log row. Best-effort — logs to console on failure,
 * returns true/false. Callers should still update the in-memory `Set`
 * regardless: the inventory currentQty write already happened, so a
 * future run must skip even if this audit append failed.
 */
export async function appendDeductionLog(doc, entry) {
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
