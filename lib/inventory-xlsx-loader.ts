/**
 * Inventory XLSX Loader
 *
 * Reads data/inventory-import/inventory-source.xlsx — the snapshot of
 * Richard's inventory app — and returns parsed transactions ready for
 * the backfill route to convert into tickets / credit memos.
 *
 * Source schema (Inventory tab):
 *   Inventory ID | Item ID | DateTime | Amount | R# | Price | Cost | Delivery Photo
 *
 *   - DateTime is an Excel serial number (days since 1899-12-30)
 *   - Amount is signed: negative = leaving warehouse (delivery / return-to-supplier),
 *     positive = entering warehouse (restock / return-from-job)
 *   - R# is a 4-5 digit numeric reference. R#=1234 is the restock pseudo-ref.
 *     Other R# values map 1:1 to JobNimbus jobs (R-{number}).
 *   - Cost in this column is actually the LINE total at the SELL price
 *     (qty × Items.Price), not the supplier cost. The real per-unit cost
 *     and price come from the Items tab.
 *
 * The loader is read-only and pure — it touches no Sheets, no JN, no email.
 */

import path from 'path';
import fs from 'fs';
import * as XLSX from 'xlsx';

export interface XlsxItem {
  itemId: string;
  name: string;
  description: string;
  imageUrl: string;
  /** Per-unit purchase cost (what we paid the supplier) */
  unitCost: number;
  /** Per-unit selling price (what we charge a job) */
  unitPrice: number;
}

export interface XlsxTransaction {
  inventoryId: string;
  itemId: string;
  /** ISO 8601 timestamp */
  dateTime: string;
  /** Signed quantity. Negative = left the warehouse. Positive = entered. */
  amount: number;
  /** Reference number (R#). 1234 is the restock pseudo-ref. */
  referenceNumber: string;
}

export interface ParsedXlsx {
  items: XlsxItem[];
  transactions: XlsxTransaction[];
}

const DEFAULT_PATH = path.join(
  process.cwd(),
  'data',
  'inventory-import',
  'inventory-source.xlsx',
);

function excelSerialToIso(serial: unknown): string {
  if (typeof serial !== 'number' || !Number.isFinite(serial)) {
    return '';
  }
  // Excel serial date — days since 1899-12-30. JS Date works in ms since epoch.
  // 25569 = days from 1899-12-30 to 1970-01-01.
  const ms = (serial - 25569) * 86400 * 1000;
  return new Date(ms).toISOString();
}

function parseDollarString(val: unknown): number {
  if (typeof val === 'number') return val;
  if (typeof val !== 'string') return 0;
  const cleaned = val.replace(/[$,\s]/g, '').trim();
  const n = parseFloat(cleaned);
  return Number.isFinite(n) ? n : 0;
}

export function loadInventoryXlsx(filePath: string = DEFAULT_PATH): ParsedXlsx {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Inventory XLSX not found at ${filePath}`);
  }

  const wb = XLSX.readFile(filePath);

  // ---- Items tab --------------------------------------------------------
  const itemsSheet = wb.Sheets['Items'];
  if (!itemsSheet) {
    throw new Error('Items tab missing from inventory source XLSX');
  }
  const itemRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(itemsSheet, {
    defval: '',
  });
  const items: XlsxItem[] = itemRows
    .filter(r => String(r['Item ID'] || '').trim() !== '')
    .map(r => ({
      itemId: String(r['Item ID']).trim(),
      name: String(r['Name'] || '').trim(),
      description: String(r['Description'] || '').trim(),
      imageUrl: String(r['Image'] || '').trim(),
      unitCost: parseDollarString(r['Cost']),
      unitPrice: parseDollarString(r['Price']),
    }));

  // ---- Inventory tab ----------------------------------------------------
  const inventorySheet = wb.Sheets['Inventory'];
  if (!inventorySheet) {
    throw new Error('Inventory tab missing from inventory source XLSX');
  }
  const txRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(inventorySheet, {
    defval: '',
  });
  const transactions: XlsxTransaction[] = txRows
    .filter(r => {
      const ref = String(r['R#'] || '').trim();
      const item = String(r['Item ID'] || '').trim();
      const amount = Number(r['Amount']);
      return ref !== '' && item !== '' && Number.isFinite(amount) && amount !== 0;
    })
    .map(r => ({
      inventoryId: String(r['Inventory ID'] || '').trim(),
      itemId: String(r['Item ID']).trim(),
      dateTime: excelSerialToIso(r['DateTime']),
      amount: Number(r['Amount']),
      referenceNumber: String(r['R#']).trim(),
    }));

  return { items, transactions };
}

/**
 * Group transactions by reference number.
 * Returns a Map keyed by R# whose values are the transactions for that R#.
 * Excludes any R# the caller passes in `excludeRefs`.
 */
export function groupByReference(
  transactions: XlsxTransaction[],
  excludeRefs: Set<string> = new Set(),
): Map<string, XlsxTransaction[]> {
  const out = new Map<string, XlsxTransaction[]>();
  for (const t of transactions) {
    if (excludeRefs.has(t.referenceNumber)) continue;
    if (!out.has(t.referenceNumber)) {
      out.set(t.referenceNumber, []);
    }
    out.get(t.referenceNumber)!.push(t);
  }
  // Sort each group oldest-first so the ticket's createdAt is the first scan
  for (const [, txs] of out) {
    txs.sort((a, b) => a.dateTime.localeCompare(b.dateTime));
  }
  return out;
}

/**
 * Split a reference group into delivery (negative amounts, materials leaving)
 * and return (positive amounts, materials coming back from a job) buckets.
 * Used by the backfill route to decide whether a job needs just a delivery
 * ticket or also a credit memo.
 */
export function splitDeliveryAndReturn(
  txs: XlsxTransaction[],
): { delivery: XlsxTransaction[]; returned: XlsxTransaction[] } {
  const delivery: XlsxTransaction[] = [];
  const returned: XlsxTransaction[] = [];
  for (const t of txs) {
    if (t.amount < 0) delivery.push(t);
    else if (t.amount > 0) returned.push(t);
  }
  return { delivery, returned };
}
