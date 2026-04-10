/**
 * API Route: /api/data/march-madness/settings
 *
 * GET  - Returns tournament admin settings (visibility, overrides, prizes)
 * POST - Update settings (admin only: owner/admin role or marchMadnessAdmins list)
 *
 * As of the 2026-04-09 persistence migration, settings live on the
 * MarchMadness_Settings tab of the master Google Sheet (key/value rows). Prior
 * versions wrote `data/march-madness-settings.json` which was lost on every
 * Vercel redeploy.
 */

import { NextResponse } from 'next/server';
import { requireAdmin, validateSession } from '@/lib/auth-service';
import { googleSheetsService, SHEET_NAMES } from '@/lib/google-sheets-service';

// Each setting is one row keyed by `key`. Complex values (objects, arrays) are
// stored as JSON-encoded strings in `value`.
const SETTINGS_HEADERS = ['key', 'value', 'updatedBy', 'updatedAt'] as const;

interface MMSettings {
  showToReps: boolean;
  tournamentStatus: string;
  marchMadnessAdmins: string[];
  announcementEnabled: boolean;
  announcementMessage: string;
  showOnMondayMeeting: boolean;
  overrides: Record<string, Record<string, number | null | undefined>>;
  prizes: Record<string, unknown>;
  lastUpdatedBy: string;
  lastUpdatedAt: string;
  [key: string]: unknown;
}

const DEFAULTS: MMSettings = {
  showToReps: false,
  tournamentStatus: 'upcoming',
  marchMadnessAdmins: ['Michael Muse', 'Chris Muse', 'Sara Hill', 'Boston Muse'],
  announcementEnabled: false,
  announcementMessage: '',
  showOnMondayMeeting: false,
  overrides: {},
  prizes: {},
  lastUpdatedBy: '',
  lastUpdatedAt: '',
};

function decodeValue(raw: string, key: string): unknown {
  if (raw === '' || raw === undefined) return (DEFAULTS as Record<string, unknown>)[key];
  // Try JSON parse first — works for booleans, arrays, objects, numbers, null.
  try {
    return JSON.parse(raw);
  } catch {
    // Plain string fallback.
    return raw;
  }
}

async function loadSettings(): Promise<MMSettings> {
  const rows = await googleSheetsService.getGenericRows(
    SHEET_NAMES.MARCH_MADNESS_SETTINGS,
    Array.from(SETTINGS_HEADERS),
  );

  const result: MMSettings = { ...DEFAULTS };
  for (const row of rows) {
    const k = row.key;
    if (!k) continue;
    (result as Record<string, unknown>)[k] = decodeValue(row.value, k);
  }
  return result;
}

async function saveSettings(merged: MMSettings, updatedBy: string): Promise<void> {
  const updatedAt = new Date().toISOString();
  // Persist every key as its own row. Use upsert so a partial save doesn't
  // wipe untouched keys.
  for (const [k, v] of Object.entries(merged)) {
    if (k === 'lastUpdatedBy' || k === 'lastUpdatedAt') continue;
    await googleSheetsService.upsertGenericRow(
      SHEET_NAMES.MARCH_MADNESS_SETTINGS,
      Array.from(SETTINGS_HEADERS),
      'key',
      {
        key: k,
        value: typeof v === 'string' ? v : JSON.stringify(v),
        updatedBy,
        updatedAt,
      },
    );
  }
  // Track the audit fields as their own keyed rows so the GET handler can
  // return them without a separate code path.
  await googleSheetsService.upsertGenericRow(
    SHEET_NAMES.MARCH_MADNESS_SETTINGS,
    Array.from(SETTINGS_HEADERS),
    'key',
    { key: 'lastUpdatedBy', value: JSON.stringify(updatedBy), updatedBy, updatedAt },
  );
  await googleSheetsService.upsertGenericRow(
    SHEET_NAMES.MARCH_MADNESS_SETTINGS,
    Array.from(SETTINGS_HEADERS),
    'key',
    { key: 'lastUpdatedAt', value: JSON.stringify(updatedAt), updatedBy, updatedAt },
  );
}

function isMMAdmin(settings: MMSettings, userName: string, role: string): boolean {
  if (role === 'owner' || role === 'admin') return true;
  const admins = settings.marchMadnessAdmins || [];
  return admins.includes(userName);
}

export async function GET() {
  try {
    const settings = await loadSettings();
    return NextResponse.json({ success: true, settings });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to load settings';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const auth = await requireAdmin();
  if (!auth.authenticated) return auth.response;

  try {
    const session = await validateSession();
    if (!session.valid || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const current = await loadSettings();
    if (!isMMAdmin(current, session.user.name, session.user.role)) {
      return NextResponse.json({ error: 'March Madness admin access required' }, { status: 403 });
    }

    const body = await request.json();

    // Deep merge body into current settings (matches the original semantics).
    const merged: MMSettings = { ...current };
    for (const key of Object.keys(body)) {
      if (key === 'overrides' && typeof body.overrides === 'object') {
        merged.overrides = { ...current.overrides };
        for (const rep of Object.keys(body.overrides)) {
          merged.overrides[rep] = {
            ...(current.overrides?.[rep] || {}),
            ...body.overrides[rep],
          };
        }
      } else if (key === 'prizes' && typeof body.prizes === 'object') {
        merged.prizes = { ...current.prizes, ...body.prizes };
      } else {
        (merged as Record<string, unknown>)[key] = body[key];
      }
    }

    merged.lastUpdatedBy = session.user.name;
    merged.lastUpdatedAt = new Date().toISOString();

    await saveSettings(merged, session.user.name);

    return NextResponse.json({ success: true, settings: merged });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to save settings';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
