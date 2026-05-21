/**
 * Customer Portal Sheet-backed Persistence
 *
 * Lazy-create + append-only writes to the master Google Sheet
 * (GOOGLE_SHEETS_ID) for the three customer-portal surfaces that
 * previously accepted submissions and dropped the data:
 *
 *   - recordServiceRequest    → "Service_Requests" tab
 *   - recordWarrantyClaim     → "Warranty_Claims" tab
 *   - getNotificationPreferences / setNotificationPreferences
 *                             → "Customer_Notification_Prefs" tab
 *
 * Mirrors lib/email-log.ts:
 *  - Best-effort by design. Callers MUST fire-and-forget so the
 *    customer-facing response never blocks on the sheet write.
 *  - Silent-skip when GOOGLE_SHEETS_ID / GOOGLE_SERVICE_ACCOUNT_EMAIL /
 *    GOOGLE_PRIVATE_KEY are not configured (no error spam).
 *  - Writes never throw — failures surface to console.error with the
 *    [CUSTOMER PORTAL SHEET FAILED] tag.
 *
 * The reads (getNotificationPreferences) DO need to await + return data
 * (the GET handler renders defaults vs persisted prefs), but they also
 * never throw — return null on any failure so the route can fall back
 * to defaults.
 */

const SERVICE_REQUEST_TAB = 'Service_Requests';
const SERVICE_REQUEST_HEADERS = [
  'timestamp',
  'id',
  'customerId',
  'customerName',
  'customerAddress',
  'customerPhone',
  'customerEmail',
  'repSlug',
  'repName',
  'type',
  'description',
  'preferredDate',
  'urgency',
  'photos',
  'status',
  'createdAt',
  'updatedAt',
];

const WARRANTY_CLAIM_TAB = 'Warranty_Claims';
const WARRANTY_CLAIM_HEADERS = [
  'timestamp',
  'id',
  'warrantyId',
  'customerId',
  'customerName',
  'customerAddress',
  'customerPhone',
  'customerEmail',
  'repSlug',
  'repName',
  'jobId',
  'category',
  'severity',
  'issueDescription',
  'photos',
  'status',
  'createdAt',
  'updatedAt',
];

const NOTIFICATION_PREFS_TAB = 'Customer_Notification_Prefs';
const NOTIFICATION_PREFS_HEADERS = [
  'customerToken',
  'customerId',
  'emailNotifications',
  'smsNotifications',
  'weatherAlerts',
  'statusUpdates',
  'updatedAt',
];

export interface ServiceRequestPayload {
  id: string;
  customerId: string;
  customerName: string;
  customerAddress: string;
  customerPhone: string;
  customerEmail: string;
  repSlug: string;
  repName: string;
  type: string;
  description: string;
  preferredDate: string;
  urgency: string;
  photos: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface WarrantyClaimPayload {
  id: string;
  warrantyId: string;
  customerId: string;
  customerName: string;
  customerAddress: string;
  customerPhone: string;
  customerEmail: string;
  repSlug: string;
  repName: string;
  jobId: string;
  category: string;
  severity: string;
  issueDescription: string;
  photos: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface NotificationPrefs {
  emailNotifications: boolean;
  smsNotifications: boolean;
  weatherAlerts: boolean;
  statusUpdates: boolean;
}

export interface StoredNotificationPrefs extends NotificationPrefs {
  customerId?: string;
  updatedAt: string;
}

/**
 * Lazy-load the auth + spreadsheet doc. Returns null if env not configured
 * so callers can silent-skip without blowing up.
 */
async function getDoc() {
  const sheetsId = process.env.GOOGLE_SHEETS_ID;
  const svcEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const svcKey = process.env.GOOGLE_PRIVATE_KEY;

  if (!sheetsId || !svcEmail || !svcKey) {
    return null;
  }

  const { GoogleSpreadsheet } = await import('google-spreadsheet');
  const { JWT } = await import('google-auth-library');

  const auth = new JWT({
    email: svcEmail,
    key: svcKey.replace(/\\n/g, '\n'),
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });

  const doc = new GoogleSpreadsheet(sheetsId, auth);
  await doc.loadInfo();
  return doc;
}

/**
 * Get-or-create a tab with the given headers. Tolerant of pre-existing
 * tabs that were created without a header row.
 */
async function getOrCreateSheet(
  doc: Awaited<ReturnType<typeof getDoc>>,
  title: string,
  headers: string[],
) {
  if (!doc) return null;
  let sheet = doc.sheetsByTitle[title];
  if (!sheet) {
    sheet = await doc.addSheet({
      title,
      headerValues: headers,
      gridProperties: { columnCount: Math.max(headers.length + 5, 26) },
    });
  } else {
    try {
      await sheet.loadHeaderRow();
    } catch {
      if (sheet.gridProperties.columnCount < headers.length) {
        await sheet.resize({
          rowCount: sheet.gridProperties.rowCount,
          columnCount: headers.length + 5,
        });
      }
      await sheet.setHeaderRow(headers);
    }
  }
  return sheet;
}

/**
 * Append a service-request row to the "Service_Requests" tab.
 *
 * Best-effort: never throws. Callers should NOT await this — fire it as
 * `recordServiceRequest(payload).catch(() => {})` so the API response
 * is never blocked by a sheet round-trip.
 */
export async function recordServiceRequest(
  payload: ServiceRequestPayload,
): Promise<void> {
  try {
    const doc = await getDoc();
    if (!doc) return;
    const sheet = await getOrCreateSheet(doc, SERVICE_REQUEST_TAB, SERVICE_REQUEST_HEADERS);
    if (!sheet) return;
    await sheet.addRow({
      timestamp: new Date().toISOString(),
      ...payload,
    });
  } catch (err) {
    console.error('[CUSTOMER PORTAL SHEET FAILED] recordServiceRequest', {
      id: payload.id,
      err: err instanceof Error ? err.message : err,
    });
  }
}

/**
 * Append a warranty-claim row to the "Warranty_Claims" tab.
 *
 * Best-effort: never throws. Callers should NOT await this — fire it as
 * `recordWarrantyClaim(payload).catch(() => {})` so the API response is
 * never blocked by a sheet round-trip.
 */
export async function recordWarrantyClaim(
  payload: WarrantyClaimPayload,
): Promise<void> {
  try {
    const doc = await getDoc();
    if (!doc) return;
    const sheet = await getOrCreateSheet(doc, WARRANTY_CLAIM_TAB, WARRANTY_CLAIM_HEADERS);
    if (!sheet) return;
    await sheet.addRow({
      timestamp: new Date().toISOString(),
      ...payload,
    });
  } catch (err) {
    console.error('[CUSTOMER PORTAL SHEET FAILED] recordWarrantyClaim', {
      id: payload.id,
      err: err instanceof Error ? err.message : err,
    });
  }
}

/**
 * Read the persisted notification preferences for a customer token.
 *
 * Returns null when:
 *   - env is not configured (silent-skip)
 *   - no row exists for this token yet (caller should fall back to defaults)
 *   - the underlying sheet call throws (logged, never propagated)
 *
 * Reads ARE awaited by the caller (GET handler) — but the failure path
 * still must not throw; callers should be ready to receive null and serve
 * defaults.
 */
export async function getNotificationPreferences(
  customerToken: string,
): Promise<StoredNotificationPrefs | null> {
  if (!customerToken) return null;
  try {
    const doc = await getDoc();
    if (!doc) return null;
    const sheet = await getOrCreateSheet(doc, NOTIFICATION_PREFS_TAB, NOTIFICATION_PREFS_HEADERS);
    if (!sheet) return null;
    const rows = await sheet.getRows();
    const row = rows.find(r => r.get('customerToken') === customerToken);
    if (!row) return null;
    return {
      customerId: row.get('customerId') || undefined,
      emailNotifications: row.get('emailNotifications') !== 'false',
      smsNotifications: row.get('smsNotifications') !== 'false',
      weatherAlerts: row.get('weatherAlerts') !== 'false',
      statusUpdates: row.get('statusUpdates') !== 'false',
      updatedAt: row.get('updatedAt') || '',
    };
  } catch (err) {
    console.error('[CUSTOMER PORTAL SHEET FAILED] getNotificationPreferences', {
      err: err instanceof Error ? err.message : err,
    });
    return null;
  }
}

/**
 * Upsert the notification preferences for a customer token.
 *
 * Best-effort: never throws. Callers should NOT await this — fire it as
 * `setNotificationPreferences(token, prefs).catch(() => {})` so the PUT
 * response is never blocked by a sheet round-trip.
 *
 * `customerId` is optional metadata stored alongside the prefs row when
 * available (helps cross-reference with the leads/jobs tabs).
 */
export async function setNotificationPreferences(
  customerToken: string,
  prefs: NotificationPrefs,
  customerId?: string,
): Promise<void> {
  if (!customerToken) return;
  try {
    const doc = await getDoc();
    if (!doc) return;
    const sheet = await getOrCreateSheet(doc, NOTIFICATION_PREFS_TAB, NOTIFICATION_PREFS_HEADERS);
    if (!sheet) return;
    const rows = await sheet.getRows();
    const existing = rows.find(r => r.get('customerToken') === customerToken);
    const updatedAt = new Date().toISOString();
    const payload = {
      customerToken,
      customerId: customerId || '',
      emailNotifications: String(prefs.emailNotifications),
      smsNotifications: String(prefs.smsNotifications),
      weatherAlerts: String(prefs.weatherAlerts),
      statusUpdates: String(prefs.statusUpdates),
      updatedAt,
    };
    if (existing) {
      Object.entries(payload).forEach(([k, v]) => existing.set(k, v));
      await existing.save();
    } else {
      await sheet.addRow(payload);
    }
  } catch (err) {
    console.error('[CUSTOMER PORTAL SHEET FAILED] setNotificationPreferences', {
      err: err instanceof Error ? err.message : err,
    });
  }
}
