/**
 * Cron Heartbeat Writer
 *
 * Shared helper that crons call after execution to record their status
 * in the SystemHealth Google Sheets tab. The system-health API reads
 * these rows to build the cron status dashboard.
 */

import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';

const SYSTEM_HEALTH_TAB = 'SystemHealth';
const HEADERS = ['cronName', 'lastRunAt', 'status', 'durationMs', 'details'];

let _doc: GoogleSpreadsheet | null = null;

async function getDoc(): Promise<GoogleSpreadsheet> {
  if (_doc) return _doc;

  const sheetsId = process.env.GOOGLE_SHEETS_ID;
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const key = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n');

  if (!sheetsId || !email || !key) {
    throw new Error('Google Sheets credentials not configured for heartbeat');
  }

  const auth = new JWT({
    email,
    key,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });

  _doc = new GoogleSpreadsheet(sheetsId, auth);
  await _doc.loadInfo();
  return _doc;
}

/**
 * Record a cron heartbeat in the SystemHealth sheet tab.
 * Upserts: if a row with the same cronName already exists, it is updated.
 * Otherwise a new row is added.
 */
export async function recordCronHeartbeat(
  cronName: string,
  status: 'success' | 'error',
  duration: number,
  details?: string,
): Promise<void> {
  try {
    const doc = await getDoc();

    let sheet = doc.sheetsByTitle[SYSTEM_HEALTH_TAB];
    if (!sheet) {
      sheet = await doc.addSheet({
        title: SYSTEM_HEALTH_TAB,
        headerValues: HEADERS,
        gridProperties: { columnCount: HEADERS.length + 5 },
      });
    } else {
      // Ensure headers exist
      try {
        await sheet.loadHeaderRow();
      } catch {
        await sheet.setHeaderRow(HEADERS);
      }
    }

    const rows = await sheet.getRows({ limit: 100000 });
    const existing = rows.find(r => r.get('cronName') === cronName);

    const now = new Date().toISOString();
    const durationStr = String(Math.round(duration));
    const detailStr = details ? details.slice(0, 500) : '';

    if (existing) {
      existing.set('lastRunAt', now);
      existing.set('status', status);
      existing.set('durationMs', durationStr);
      existing.set('details', detailStr);
      await existing.save();
    } else {
      await sheet.addRow({
        cronName,
        lastRunAt: now,
        status,
        durationMs: durationStr,
        details: detailStr,
      });
    }
  } catch (err) {
    // Heartbeat failures are logged but never throw — they must not break crons.
    console.error(`[cron-heartbeat] Failed to record heartbeat for ${cronName}:`, err);
  }
}
