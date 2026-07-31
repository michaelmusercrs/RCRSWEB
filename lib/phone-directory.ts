/**
 * Phone extension directory — the single, editable source of truth mapping
 * each employee to their desk extension, Google Voice number, and phone MAC.
 *
 * Replaces THREE duplicated hardcoded copies that existed before:
 *   1. lib/phone-data.ts               (flagged placeholder, wrong email domain)
 *   2. lib/calls-service.ts            (inline findRepByExtension map)
 *   3. command-center/phone/manage UI  (client-side EXTENSIONS array)
 *
 * Design: layered. lib/phone-system-config.ts holds the canonical SEED (the
 * physical topology, code-owned, kept in lock-step with the dialplan). This
 * module overlays an editable `Phone_Extensions` sheet on top, so an admin can
 * reassign an extension, update a churned GV number, or swap a desk phone MAC
 * WITHOUT a deploy. A row is only written when actually edited; until then the
 * directory reads straight from the seed. Pattern mirrors
 * lib/team-groupme-mapping.ts (slug → external-id mappings).
 *
 * Deliberately NOT stored here: voicemail PINs (secret; pattern is 1+ext) and
 * phone IPs (DHCP-drifting; resolved by MAC on the PBX).
 *
 * The high-frequency webhook path (calls-service) does NOT read this async
 * directory per event — it resolves reps synchronously from the config seed.
 * This module serves the UI/admin and any read-time enrichment.
 */

import { googleSheetsService, SHEET_NAMES } from './google-sheets-service';
import { EXTENSION_SEED, seedForExtension, type ExtensionSeed } from './phone-system-config';

export const PHONE_EXTENSIONS_HEADERS: string[] = [
  'extension',
  'slug',
  'name',
  'email',
  'googleVoice',
  'mac',
  'active',
  'manualOverride',
  'notes',
  'updatedAt',
];

export interface PhoneExtension extends ExtensionSeed {
  active: boolean;
  /** True when set by hand in the admin UI. */
  manualOverride: boolean;
  notes: string;
  updatedAt: string;
  /** Where this record's values came from, for the admin UI. */
  source: 'seed' | 'sheet';
}

function seedToRecord(seed: ExtensionSeed): PhoneExtension {
  return {
    ...seed,
    active: seed.slug !== '',   // unassigned 108 defaults inactive
    manualOverride: false,
    notes: '',
    updatedAt: '',
    source: 'seed',
  };
}

function parseRow(row: Record<string, string>): PhoneExtension {
  return {
    extension: (row.extension || '').trim(),
    slug: (row.slug || '').trim().toLowerCase(),
    name: row.name || '',
    email: (row.email || '').trim().toLowerCase(),
    googleVoice: (row.googleVoice || '').replace(/\D/g, ''),
    mac: (row.mac || '').toLowerCase().replace(/[^0-9a-f]/g, ''),
    active: String(row.active || '').toLowerCase() !== 'false',
    manualOverride: String(row.manualOverride || '').toLowerCase() === 'true',
    notes: row.notes || '',
    updatedAt: row.updatedAt || '',
    source: 'sheet',
  };
}

class PhoneDirectoryService {
  private cache: PhoneExtension[] | null = null;
  private cacheExpiresAt = 0;
  private readonly CACHE_TTL_MS = 60_000;

  private async loadSheetRows(): Promise<PhoneExtension[]> {
    try {
      const rows = await googleSheetsService.getGenericRows(
        SHEET_NAMES.PHONE_EXTENSIONS,
        PHONE_EXTENSIONS_HEADERS,
      );
      return rows.map(parseRow).filter(r => r.extension);
    } catch {
      // Tab may not exist yet — the seed still yields a full directory.
      return [];
    }
  }

  /** Full directory: seed overlaid with any edited sheet rows, cached 60s. */
  async getDirectory(): Promise<PhoneExtension[]> {
    if (this.cache && Date.now() < this.cacheExpiresAt) return this.cache;

    const sheetRows = await this.loadSheetRows();
    const byExt = new Map<string, PhoneExtension>();
    for (const seed of EXTENSION_SEED) byExt.set(seed.extension, seedToRecord(seed));
    for (const row of sheetRows) byExt.set(row.extension, row); // sheet wins

    const merged = Array.from(byExt.values()).sort((a, b) => a.extension.localeCompare(b.extension));
    this.cache = merged;
    this.cacheExpiresAt = Date.now() + this.CACHE_TTL_MS;
    return merged;
  }

  private invalidate(): void {
    this.cache = null;
    this.cacheExpiresAt = 0;
  }

  async getByExtension(extension: string): Promise<PhoneExtension | null> {
    const ext = String(extension || '').trim();
    if (!ext) return null;
    const dir = await this.getDirectory();
    return dir.find(e => e.extension === ext) || null;
  }

  async getBySlug(slug: string): Promise<PhoneExtension | null> {
    const target = String(slug || '').trim().toLowerCase();
    if (!target) return null;
    const dir = await this.getDirectory();
    return dir.find(e => e.slug === target) || null;
  }

  /** The extension a given employee (slug) answers on, or null. */
  async extensionForSlug(slug: string): Promise<string | null> {
    const rec = await this.getBySlug(slug);
    return rec?.extension || null;
  }

  /**
   * Admin edit: upsert an extension row (persists to the sheet, marks it a
   * manual override so it survives future seed changes).
   */
  async upsert(entry: Partial<PhoneExtension> & { extension: string }): Promise<PhoneExtension> {
    const ext = entry.extension.trim();
    const base = (await this.getByExtension(ext)) || seedToRecord(
      seedForExtension(ext) || { extension: ext, slug: '', name: '', email: '', googleVoice: '', mac: '' },
    );
    const merged: PhoneExtension = {
      ...base,
      ...entry,
      extension: ext,
      googleVoice: (entry.googleVoice ?? base.googleVoice).replace(/\D/g, ''),
      mac: (entry.mac ?? base.mac).toLowerCase().replace(/[^0-9a-f]/g, ''),
      manualOverride: true,
      updatedAt: new Date().toISOString(),
      source: 'sheet',
    };
    await googleSheetsService.upsertGenericRow(
      SHEET_NAMES.PHONE_EXTENSIONS,
      PHONE_EXTENSIONS_HEADERS,
      'extension',
      {
        extension: merged.extension,
        slug: merged.slug,
        name: merged.name,
        email: merged.email,
        googleVoice: merged.googleVoice,
        mac: merged.mac,
        active: String(merged.active),
        manualOverride: 'true',
        notes: merged.notes,
        updatedAt: merged.updatedAt,
      },
    );
    this.invalidate();
    return merged;
  }
}

export const phoneDirectory = new PhoneDirectoryService();
