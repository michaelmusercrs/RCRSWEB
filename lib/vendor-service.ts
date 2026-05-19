/**
 * Vendor Service (Phase 4)
 *
 * CRUD over a `Vendors` Google Sheets tab. Seeded with the 6 known
 * distributors from material-order-pipeline.DISTRIBUTORS on first load.
 *
 * Distinct from `app/api/portal/admin/vendors` which manages the supplier
 * dropdown for the customer-breakdown form — that one is JSON-backed and
 * categorizes "subcontractors" too. This service is specifically for
 * INVENTORY restock vendors / distributors.
 *
 * Schema columns: vendorId | name | contact | email | phone | address |
 *                 terms | paymentMethod | city | state | notes | active
 */

import { GoogleSpreadsheet, GoogleSpreadsheetRow, GoogleSpreadsheetWorksheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';
import { DISTRIBUTORS } from './material-order-pipeline';

const SHEETS_ID = process.env.DELIVERY_SHEETS_ID || process.env.GOOGLE_SHEETS_ID;
const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n')?.replace(/\r\n/g, '\n');
const serviceAuth = new JWT({
  email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
  key: privateKey,
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});
const SHEETS_CONFIGURED = !!(SHEETS_ID && process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL && privateKey);

const VENDORS_TAB = 'Vendors';
const VENDOR_HEADERS = [
  'vendorId', 'name', 'contact', 'email', 'phone', 'address',
  'terms', 'paymentMethod', 'city', 'state', 'notes', 'active',
];

export interface Vendor {
  vendorId: string;
  name: string;
  contact: string;
  email: string;
  phone: string;
  address: string;
  terms: string;       // e.g. "Net 30", "Net 15", "COD"
  paymentMethod: string; // e.g. "check", "ach", "card", "house_account"
  city: string;
  state: string;
  notes: string;
  active: boolean;
}

async function getOrCreateSheet(): Promise<{ sheet: GoogleSpreadsheetWorksheet; doc: GoogleSpreadsheet } | null> {
  if (!SHEETS_CONFIGURED) return null;
  try {
    const doc = new GoogleSpreadsheet(SHEETS_ID!, serviceAuth);
    await doc.loadInfo();
    let sheet = doc.sheetsByTitle[VENDORS_TAB];
    if (!sheet) {
      sheet = await doc.addSheet({ title: VENDORS_TAB, headerValues: VENDOR_HEADERS });
    } else {
      if (sheet.columnCount < VENDOR_HEADERS.length) {
        await sheet.resize({ rowCount: sheet.rowCount, columnCount: VENDOR_HEADERS.length });
      }
      await sheet.loadHeaderRow().catch(() => null);
      if (!sheet.headerValues || sheet.headerValues.length === 0) {
        await sheet.setHeaderRow(VENDOR_HEADERS);
      }
    }
    return { sheet, doc };
  } catch (err) {
    console.error('[vendor-service] getOrCreateSheet failed:', err);
    return null;
  }
}

function rowToVendor(row: GoogleSpreadsheetRow): Vendor {
  return {
    vendorId: row.get('vendorId') || '',
    name: row.get('name') || '',
    contact: row.get('contact') || '',
    email: row.get('email') || '',
    phone: row.get('phone') || '',
    address: row.get('address') || '',
    terms: row.get('terms') || '',
    paymentMethod: row.get('paymentMethod') || '',
    city: row.get('city') || '',
    state: row.get('state') || '',
    notes: row.get('notes') || '',
    active: (row.get('active') || 'true') !== 'false',
  };
}

function vendorToRow(v: Vendor): Record<string, string> {
  return {
    vendorId: v.vendorId,
    name: v.name,
    contact: v.contact,
    email: v.email,
    phone: v.phone,
    address: v.address,
    terms: v.terms,
    paymentMethod: v.paymentMethod,
    city: v.city,
    state: v.state,
    notes: v.notes,
    active: v.active ? 'true' : 'false',
  };
}

class VendorService {
  private cache: Vendor[] = [];
  private loaded = false;
  private loadPromise: Promise<void> | null = null;

  async ensureLoaded(): Promise<void> {
    if (this.loaded) return;
    if (this.loadPromise) return this.loadPromise;
    this.loadPromise = this._load();
    return this.loadPromise;
  }

  private async _load(): Promise<void> {
    try {
      const result = await getOrCreateSheet();
      if (!result) {
        // No Sheets — seed in memory from DISTRIBUTORS so callers don't crash
        this.cache = DISTRIBUTORS.map(d => ({
          vendorId: d.id,
          name: d.name,
          contact: '',
          email: '',
          phone: '',
          address: '',
          terms: '',
          paymentMethod: '',
          city: d.city,
          state: d.state,
          notes: '',
          active: true,
        }));
        this.loaded = true;
        return;
      }

      const rows = await result.sheet.getRows();
      if (rows.length === 0) {
        // Seed with the 6 known distributors from material-order-pipeline
        const seed: Vendor[] = DISTRIBUTORS.map(d => ({
          vendorId: d.id,
          name: d.name,
          contact: '',
          email: '',
          phone: '',
          address: '',
          terms: '',
          paymentMethod: '',
          city: d.city,
          state: d.state,
          notes: '',
          active: true,
        }));
        await result.sheet.addRows(seed.map(vendorToRow));
        this.cache = seed;
      } else {
        this.cache = rows.map(rowToVendor);
      }
      this.loaded = true;
    } catch (err) {
      console.error('[vendor-service] _load failed:', err);
      // Fallback to in-memory seed so the rest of the app still works
      this.cache = DISTRIBUTORS.map(d => ({
        vendorId: d.id,
        name: d.name,
        contact: '',
        email: '',
        phone: '',
        address: '',
        terms: '',
        paymentMethod: '',
        city: d.city,
        state: d.state,
        notes: '',
        active: true,
      }));
      this.loaded = true;
    }
  }

  async list(opts?: { activeOnly?: boolean }): Promise<Vendor[]> {
    await this.ensureLoaded();
    const all = [...this.cache].sort((a, b) => a.name.localeCompare(b.name));
    if (opts?.activeOnly) return all.filter(v => v.active);
    return all;
  }

  async getById(vendorId: string): Promise<Vendor | undefined> {
    await this.ensureLoaded();
    return this.cache.find(v => v.vendorId === vendorId);
  }

  async create(data: Omit<Vendor, 'vendorId' | 'active'> & { active?: boolean }): Promise<Vendor> {
    await this.ensureLoaded();
    // Slug-style id from name; suffix with timestamp for collision safety
    const slug = (data.name || 'vendor')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 30);
    const vendorId = `${slug}-${Date.now().toString(36)}`;
    const vendor: Vendor = {
      vendorId,
      name: data.name,
      contact: data.contact || '',
      email: data.email || '',
      phone: data.phone || '',
      address: data.address || '',
      terms: data.terms || '',
      paymentMethod: data.paymentMethod || '',
      city: data.city || '',
      state: data.state || '',
      notes: data.notes || '',
      active: data.active ?? true,
    };
    this.cache.push(vendor);

    const result = await getOrCreateSheet();
    if (result) {
      try {
        await result.sheet.addRow(vendorToRow(vendor));
      } catch (err) {
        console.error('[vendor-service] create persist failed:', err);
      }
    }
    return vendor;
  }

  async update(vendorId: string, updates: Partial<Omit<Vendor, 'vendorId'>>): Promise<Vendor | null> {
    await this.ensureLoaded();
    const idx = this.cache.findIndex(v => v.vendorId === vendorId);
    if (idx === -1) return null;
    this.cache[idx] = { ...this.cache[idx], ...updates, vendorId };

    const result = await getOrCreateSheet();
    if (result) {
      try {
        const rows = await result.sheet.getRows();
        const row = rows.find(r => r.get('vendorId') === vendorId);
        if (row) {
          const data = vendorToRow(this.cache[idx]);
          Object.entries(data).forEach(([k, v]) => row.set(k, v));
          await row.save();
        } else {
          // Row not on sheet yet — append it
          await result.sheet.addRow(vendorToRow(this.cache[idx]));
        }
      } catch (err) {
        console.error('[vendor-service] update persist failed:', err);
      }
    }
    return this.cache[idx];
  }

  async deactivate(vendorId: string): Promise<boolean> {
    const updated = await this.update(vendorId, { active: false });
    return updated !== null;
  }

  /**
   * Find a vendor by free-text name match. Used when an inventory row stores
   * a supplier name string instead of a vendorId — lets us still resolve to
   * a real Vendor record so the auto-PO carries contact info.
   */
  async findByName(name: string): Promise<Vendor | undefined> {
    if (!name) return undefined;
    await this.ensureLoaded();
    const norm = name.trim().toLowerCase();
    return this.cache.find(v =>
      v.name.toLowerCase() === norm ||
      v.name.toLowerCase().includes(norm) ||
      norm.includes(v.name.toLowerCase()),
    );
  }
}

export const vendorService = new VendorService();
