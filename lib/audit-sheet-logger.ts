/**
 * Audit Sheet Logger
 * Logs all admin config changes to the "Config Audit Log" tab in Google Sheets.
 * Provides a persistent, visible record of who changed what and when.
 */

export interface AuditEntry {
  action: string;       // e.g. "weight_updated", "rep_toggled", "spam_threshold_changed"
  section: string;      // e.g. "lead_distribution", "spam_filter", "rep_availability"
  changedBy: string;    // email of the person who made the change
  changedByName: string;
  before: string;       // JSON string of old value
  after: string;        // JSON string of new value
  details: string;      // Human-readable description
  ipAddress?: string;
}

export async function logConfigChange(entry: AuditEntry): Promise<void> {
  try {
    const { GoogleSpreadsheet } = await import('google-spreadsheet');
    const { JWT } = await import('google-auth-library');

    const auth = new JWT({
      email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    const doc = new GoogleSpreadsheet(process.env.GOOGLE_SHEETS_ID!, auth);
    await doc.loadInfo();

    let sheet = doc.sheetsByTitle['Config Audit Log'];
    if (!sheet) {
      sheet = await doc.addSheet({
        title: 'Config Audit Log',
        headerValues: [
          'Timestamp', 'Action', 'Section', 'Changed By', 'Changed By Name',
          'Before', 'After', 'Details', 'IP Address'
        ],
      });
    }

    await sheet.addRow({
      Timestamp: new Date().toISOString(),
      Action: entry.action,
      Section: entry.section,
      'Changed By': entry.changedBy,
      'Changed By Name': entry.changedByName,
      Before: entry.before,
      After: entry.after,
      Details: entry.details,
      'IP Address': entry.ipAddress || '',
    });
  } catch (error) {
    console.error('[Audit Logger] Failed to log config change:', error);
    // Don't throw - audit logging failure should never break the main operation
  }
}
