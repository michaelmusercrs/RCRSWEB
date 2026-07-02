/**
 * Rep Notification Preferences (sheet-backed)
 *
 * Per-rep opt-in/opt-out for the alert types they receive (new lead, customer
 * message, daily/weekly digest, system alerts, mentions) on the channels
 * they care about (GroupMe, email). One row per rep slug on the
 * `Rep_Notification_Prefs` tab on the master Google Sheet (lazy-created).
 *
 * Per the master GroupMe guard: this layer ONLY records what the rep wants.
 * It does NOT fire anything. Honoring the choice is the responsibility of
 * the GroupMe / email senders once the owner flips
 * `GROUPME_FORCE_SEND=true`. The kill switch wins over rep prefs.
 *
 * Defaults: every channel ON, every alert ON. Reps opt OUT of what they
 * don't want, not into things they do. Same philosophy the rest of the
 * notification system uses.
 */

// We talk to GoogleSpreadsheet directly (mirroring lib/email-log.ts) so this
// module has no coupling to the GoogleSheetsService singleton's private
// helpers. Lazy imports keep the cold-start cost off the request path.

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

export const REP_NOTIFICATION_PREFS_TAB = 'Rep_Notification_Prefs';

export const REP_NOTIFICATION_PREFS_HEADERS = [
  'repSlug',
  'repName',
  'channelGroupMe',
  'channelEmail',
  'alertNewLead',
  'alertCustomerMessage',
  'alertDigest',
  'alertSystem',
  'alertMention',
  'updatedAt',
] as const;

export interface RepNotificationPrefs {
  repSlug: string;
  repName: string;
  channelGroupMe: boolean;
  channelEmail: boolean;
  alertNewLead: boolean;
  alertCustomerMessage: boolean;
  alertDigest: boolean;
  alertSystem: boolean;
  alertMention: boolean;
  updatedAt: string;
}

/**
 * Default preferences — every channel ON, every alert ON. Reps opt out.
 */
export function defaultRepPrefs(repSlug: string, repName: string): RepNotificationPrefs {
  return {
    repSlug,
    repName,
    channelGroupMe: true,
    channelEmail: true,
    alertNewLead: true,
    alertCustomerMessage: true,
    alertDigest: true,
    alertSystem: true,
    alertMention: true,
    updatedAt: '',
  };
}

// ---------------------------------------------------------------------------
// Sheet I/O
// ---------------------------------------------------------------------------

function parseBool(v: unknown): boolean {
  if (typeof v === 'boolean') return v;
  if (typeof v !== 'string') return true; // missing cell → default ON
  const s = v.trim().toLowerCase();
  if (s === '' || s === 'true' || s === '1' || s === 'yes' || s === 'on') return true;
  return false;
}

function rowToPrefs(row: Record<string, unknown>): RepNotificationPrefs {
  const repSlug = String(row.repSlug || '').trim().toLowerCase();
  const repName = String(row.repName || '').trim();
  const base = defaultRepPrefs(repSlug, repName);
  // Explicit field-by-field parse so a missing column doesn't accidentally flip
  // a stored OFF to ON. We override only when the raw cell is present.
  const target = base as unknown as Record<string, boolean | string>;
  for (const key of [
    'channelGroupMe',
    'channelEmail',
    'alertNewLead',
    'alertCustomerMessage',
    'alertDigest',
    'alertSystem',
    'alertMention',
  ] as const) {
    if (key in row) target[key] = parseBool(row[key]);
  }
  base.updatedAt = String(row.updatedAt || '').trim();
  return base;
}

/**
 * Load this rep's stored preferences, or return defaults (every ON) if none.
 * Lazy-creates the sheet tab on first read.
 */
export async function getRepNotificationPrefs(
  repSlug: string,
  repName: string,
): Promise<RepNotificationPrefs> {
  const slug = repSlug.trim().toLowerCase();
  if (!slug) return defaultRepPrefs('', repName);

  try {
    const { GoogleSpreadsheet } = await import('google-spreadsheet');
    const { JWT } = await import('google-auth-library');

    const sheetsId = process.env.GOOGLE_SHEETS_ID;
    const svcEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
    const svcKey = process.env.GOOGLE_PRIVATE_KEY;
    if (!sheetsId || !svcEmail || !svcKey) {
      return defaultRepPrefs(slug, repName);
    }

    const auth = new JWT({
      email: svcEmail,
      key: svcKey.replace(/\\n/g, '\n'),
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });
    const doc = new GoogleSpreadsheet(sheetsId, auth);
    await doc.loadInfo();

    let sheet = doc.sheetsByTitle[REP_NOTIFICATION_PREFS_TAB];
    if (!sheet) {
      sheet = await doc.addSheet({
        title: REP_NOTIFICATION_PREFS_TAB,
        headerValues: [...REP_NOTIFICATION_PREFS_HEADERS],
      });
      return defaultRepPrefs(slug, repName);
    }

    const rows = await sheet.getRows({ limit: 100000 });
    const match = rows.find(r => String(r.get('repSlug') || '').trim().toLowerCase() === slug);
    if (!match) return defaultRepPrefs(slug, repName);

    const raw: Record<string, unknown> = {};
    for (const h of REP_NOTIFICATION_PREFS_HEADERS) raw[h] = match.get(h);
    const prefs = rowToPrefs(raw);
    // Ensure the rep's name is the cached one — they might have been
    // renamed since the row was written.
    if (repName && !prefs.repName) prefs.repName = repName;
    return prefs;
  } catch (err) {
    console.error('[rep-notification-prefs] read failed:', err);
    return defaultRepPrefs(slug, repName);
  }
}

/**
 * Upsert this rep's preferences. Writes a new row on first save,
 * updates the existing row on subsequent saves. Lazy-creates the sheet
 * tab on first write.
 */
export async function saveRepNotificationPrefs(
  prefs: RepNotificationPrefs,
): Promise<{ success: boolean; error?: string }> {
  const slug = prefs.repSlug.trim().toLowerCase();
  if (!slug) return { success: false, error: 'repSlug required' };

  try {
    const { GoogleSpreadsheet } = await import('google-spreadsheet');
    const { JWT } = await import('google-auth-library');

    const sheetsId = process.env.GOOGLE_SHEETS_ID;
    const svcEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
    const svcKey = process.env.GOOGLE_PRIVATE_KEY;
    if (!sheetsId || !svcEmail || !svcKey) {
      return { success: false, error: 'sheets not configured' };
    }

    const auth = new JWT({
      email: svcEmail,
      key: svcKey.replace(/\\n/g, '\n'),
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });
    const doc = new GoogleSpreadsheet(sheetsId, auth);
    await doc.loadInfo();

    let sheet = doc.sheetsByTitle[REP_NOTIFICATION_PREFS_TAB];
    if (!sheet) {
      sheet = await doc.addSheet({
        title: REP_NOTIFICATION_PREFS_TAB,
        headerValues: [...REP_NOTIFICATION_PREFS_HEADERS],
      });
    }

    const updatedAt = new Date().toISOString();
    const rowData = {
      repSlug: slug,
      repName: prefs.repName,
      channelGroupMe: String(prefs.channelGroupMe),
      channelEmail: String(prefs.channelEmail),
      alertNewLead: String(prefs.alertNewLead),
      alertCustomerMessage: String(prefs.alertCustomerMessage),
      alertDigest: String(prefs.alertDigest),
      alertSystem: String(prefs.alertSystem),
      alertMention: String(prefs.alertMention),
      updatedAt,
    };

    const rows = await sheet.getRows({ limit: 100000 });
    const existing = rows.find(r => String(r.get('repSlug') || '').trim().toLowerCase() === slug);
    if (existing) {
      for (const [k, v] of Object.entries(rowData)) existing.set(k, v);
      await existing.save();
    } else {
      await sheet.addRow(rowData);
    }

    return { success: true };
  } catch (err) {
    console.error('[rep-notification-prefs] save failed:', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'unknown error',
    };
  }
}
