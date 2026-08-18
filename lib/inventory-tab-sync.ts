/**
 * Legacy Inventory Tab Sync
 *
 * Writes individual transaction rows into the original `Inventory` tab
 * (capital I) — the same tab Richard's standalone inventory app reads from
 * and writes to. Every time the portal creates a new delivery ticket or
 * return, we ALSO push the per-material lines into this tab so the legacy
 * inventory app keeps showing accurate stock levels and the historical
 * transaction log stays continuous.
 *
 * This is the "2-way sync" requirement: portal → legacy tab is the half
 * implemented here. The reverse (legacy app → Tickets tab) is handled by
 * a separate cron-driven sync that polls for new rows.
 *
 * Schema of the legacy Inventory tab (from inventory-source.xlsx):
 *   Inventory ID | Item ID | DateTime | Amount | R# | Price | Cost | Delivery Photo
 *
 *   - Amount is signed: negative for delivery (out), positive for return (in)
 *   - DateTime is stored as a number (Excel serial) by the inventory app, but
 *     google-spreadsheet writes whatever string we send. The app reads any
 *     numeric value, so we write the serial form to stay byte-compatible.
 *   - Cost in this column is the LINE total at the sell price (qty × Items.Price),
 *     signed to match Amount.
 *   - Price is mostly empty in the existing data; we leave it empty for parity.
 */

import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';
import crypto from 'crypto';

// IMPORTANT: this MUST point at the standalone inventory app's spreadsheet,
// NOT the master rcrsal Sheet. The master Sheet has its own "Inventory" tab
// that's the product catalog (productId, productName, currentQty, etc.) —
// completely different schema. If we write transaction rows there we'll
// corrupt the catalog.
//
// We do NOT fall back to GOOGLE_SHEETS_ID for this reason. If
// LEGACY_INVENTORY_SHEETS_ID isn't set, the dual-write becomes a no-op
// and the new ticket persistence still works (just the legacy app stops
// receiving sync). This is the safe default.
const SHEETS_ID = process.env.LEGACY_INVENTORY_SHEETS_ID;

const LEGACY_TAB_NAME = 'Inventory';
const LEGACY_HEADERS = [
  'Inventory ID',
  'Item ID',
  'DateTime',
  'Amount',
  'R#',
  'Price',
  'Cost',
  'Delivery Photo',
];

/**
 * Convert a JS Date / ISO string to the Excel serial number format the
 * legacy inventory app uses. Excel serial = days since 1899-12-30.
 */
function toExcelSerial(date: Date | string): number {
  const d = typeof date === 'string' ? new Date(date) : date;
  const ms = d.getTime();
  return ms / 86400000 + 25569;
}

function shortId(): string {
  return crypto.randomBytes(4).toString('hex');
}

export interface LegacyTransactionLine {
  itemId: string;
  /** Quantity. Sign matters: negative = delivery (out), positive = return (in). */
  amount: number;
  /** Per-unit selling price from the catalog. Used to compute the Cost cell. */
  unitPrice: number;
}

class InventoryTabSync {
  private doc: GoogleSpreadsheet | null = null;
  private initialized = false;

  private async getDoc(): Promise<GoogleSpreadsheet | null> {
    if (this.doc && this.initialized) return this.doc;

    if (!SHEETS_ID || !process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || !process.env.GOOGLE_PRIVATE_KEY) {
      console.warn('[inventory-tab-sync] Missing Google Sheets credentials');
      return null;
    }

    const auth = new JWT({
      email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    try {
      this.doc = new GoogleSpreadsheet(SHEETS_ID, auth);
      await this.doc.loadInfo();
      this.initialized = true;
      return this.doc;
    } catch (err) {
      console.error('[inventory-tab-sync] Failed to connect:', err);
      return null;
    }
  }

  /**
   * Push N transaction rows (one per material line) into the legacy
   * Inventory tab. Returns the number of rows actually written.
   *
   * This is a fire-and-forget sync — the live ticket create handler should
   * await it but tolerate failure (the ticket persistence in the new
   * Tickets tab is the source of truth; the legacy mirror is convenience).
   */
  async pushTransactions(input: {
    referenceNumber: string;
    timestamp?: Date | string;
    lines: LegacyTransactionLine[];
  }): Promise<{ success: boolean; written: number; error?: string }> {
    const doc = await this.getDoc();
    if (!doc) {
      return { success: false, written: 0, error: 'Sheets not initialized' };
    }

    let sheet = doc.sheetsByTitle[LEGACY_TAB_NAME];
    if (!sheet) {
      // Create the tab in legacy format if it's missing entirely (shouldn't
      // happen on the live sheet — it has 1,991 rows already — but the
      // create-on-miss keeps tests / fresh installs working)
      try {
        sheet = await doc.addSheet({
          title: LEGACY_TAB_NAME,
          headerValues: LEGACY_HEADERS,
        });
      } catch (err) {
        return { success: false, written: 0, error: `Failed to create legacy tab: ${err}` };
      }
    }

    // Make sure the header row matches what we expect; if columns are
    // missing we'd write data into wrong cells.
    try {
      await sheet.loadHeaderRow();
    } catch {
      try {
        await sheet.setHeaderRow(LEGACY_HEADERS);
      } catch {
        // ignore — addRow will still try
      }
    }

    const serial = toExcelSerial(input.timestamp || new Date());
    const rows: Array<Record<string, string | number>> = [];

    for (const line of input.lines) {
      if (!line.itemId || !Number.isFinite(line.amount) || line.amount === 0) continue;
      // Cost cell in the legacy tab = signed line total at sell price.
      // Negative when materials leave the warehouse, positive when they
      // come back.
      const cost = Math.round(line.amount * (line.unitPrice || 0) * 100) / 100;
      rows.push({
        'Inventory ID': shortId(),
        'Item ID': line.itemId,
        'DateTime': serial,
        'Amount': line.amount,
        'R#': input.referenceNumber,
        'Price': '',
        'Cost': cost,
        'Delivery Photo': '',
      });
    }

    if (rows.length === 0) {
      return { success: true, written: 0 };
    }

    try {
      await sheet.addRows(rows);
      return { success: true, written: rows.length };
    } catch (err) {
      console.error('[inventory-tab-sync] Failed to add rows:', err);
      return { success: false, written: 0, error: String(err) };
    }
  }
}

/**
 * @deprecated 2026-08-18 — All call sites removed. The legacy `Inventory` tab
 * is now maintained solely by the `sync-inventory-tab` cron (Portal->legacy
 * catalog-state mirror, every 15 min), which deletes+rewrites that tab. Pushing
 * transaction rows here conflicted with the cron's schema and was wiped within
 * 15 min. Kept only for reference / possible future transaction-log feature.
 */
export const inventoryTabSync = new InventoryTabSync();
