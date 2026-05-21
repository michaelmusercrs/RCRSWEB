/**
 * Insurance Claim Coordination — Sheet-backed persistence
 *
 * Mirrors lib/email-log.ts + lib/customer-portal-sheets.ts patterns:
 *   - Lazy-create the "Insurance_Claims" tab on the master Google Sheet
 *     (same GOOGLE_SHEETS_ID used by form-service, email-log, etc.)
 *   - Silent-skip when env credentials are not configured.
 *   - Writes are best-effort, fire-and-forget. They MUST NOT throw.
 *   - Reads return null on failure so callers can fall back to defaults.
 *
 * Why a service module instead of inlining the sheet calls in the route:
 * the customer-portal pattern (lib/customer-portal-sheets.ts) keeps every
 * sheet-touching helper in one file so the route handlers stay thin and
 * the same writer is reusable from cron jobs, admin tools, or webhooks.
 *
 * Status progression (enforced by the admin update endpoint, NOT the
 * customer endpoint — customers can only file a new claim, never advance
 * status):
 *
 *   damage_reported
 *     → claim_filed          (customer or rep has filed with carrier)
 *     → awaiting_adjuster    (carrier has assigned but not visited)
 *     → adjuster_visited     (on-site inspection complete)
 *     → claim_approved       (initial scope accepted by carrier)
 *     → supplement_submitted (additional damages submitted for review)
 *     → supplement_approved  (supplement scope accepted)
 *     → final_settlement     (final payment received from carrier)
 *     → depreciation_released (recoverable depreciation released)
 *     → complete             (full payment cycle finished)
 *
 * Terminal states: complete, denied. Once a claim is in either, further
 * status updates are still permitted (claims can be reopened after a
 * denial), but the admin UI will warn before reverting.
 *
 * Money fields are PRICE-only per feedback_purchase_price_visibility —
 * material/labor COST never enters this tab. Only what the homeowner /
 * carrier see (initial estimate, supplement, final settlement,
 * depreciation, deductible).
 */

const SHEET_TAB = 'Insurance_Claims';

const HEADERS = [
  'timestamp',
  'claimId',
  'customerId',
  'customerName',
  'customerEmail',
  'jobId',
  'repSlug',
  'repName',
  'insuranceCarrier',
  'claimNumber',
  'adjusterName',
  'adjusterPhone',
  'adjusterEmail',
  'dateOfLoss',
  'dateClaimFiled',
  'dateAdjusterVisit',
  'dateAdjusterAccepted',
  'dateSupplementSubmitted',
  'dateSupplementApproved',
  'dateFinalApproved',
  'dateDepreciationReleased',
  'initialEstimate',
  'supplementAmount',
  'finalSettlement',
  'depreciationAmount',
  'deductible',
  'status',
  'notes',
  'createdAt',
  'updatedAt',
];

export type InsuranceClaimStatus =
  | 'damage_reported'
  | 'claim_filed'
  | 'awaiting_adjuster'
  | 'adjuster_visited'
  | 'claim_approved'
  | 'supplement_submitted'
  | 'supplement_approved'
  | 'final_settlement'
  | 'depreciation_released'
  | 'complete'
  | 'denied';

export const INSURANCE_CLAIM_STATUSES: InsuranceClaimStatus[] = [
  'damage_reported',
  'claim_filed',
  'awaiting_adjuster',
  'adjuster_visited',
  'claim_approved',
  'supplement_submitted',
  'supplement_approved',
  'final_settlement',
  'depreciation_released',
  'complete',
  'denied',
];

/**
 * Linear progression order (denied is excluded — denial is a terminal
 * branch off any prior state, not the next step after one).
 */
export const INSURANCE_CLAIM_PROGRESSION: InsuranceClaimStatus[] = [
  'damage_reported',
  'claim_filed',
  'awaiting_adjuster',
  'adjuster_visited',
  'claim_approved',
  'supplement_submitted',
  'supplement_approved',
  'final_settlement',
  'depreciation_released',
  'complete',
];

export interface InsuranceClaim {
  claimId: string;
  customerId: string;
  customerName: string;
  customerEmail: string;
  jobId: string;
  repSlug: string;
  repName: string;
  insuranceCarrier: string;
  claimNumber: string;
  adjusterName: string;
  adjusterPhone: string;
  adjusterEmail: string;
  dateOfLoss: string;
  dateClaimFiled: string;
  dateAdjusterVisit: string;
  dateAdjusterAccepted: string;
  dateSupplementSubmitted: string;
  dateSupplementApproved: string;
  dateFinalApproved: string;
  dateDepreciationReleased: string;
  /** PRICE-only. Material cost is never written here. */
  initialEstimate: string;
  /** PRICE-only. */
  supplementAmount: string;
  /** PRICE-only. */
  finalSettlement: string;
  /** PRICE-only. */
  depreciationAmount: string;
  /** PRICE-only — the homeowner's deductible. */
  deductible: string;
  status: InsuranceClaimStatus;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Partial claim used for status-advance + field-merge updates. Caller
 * provides any subset of fields plus the new status; existing row values
 * are preserved for everything else.
 */
export type InsuranceClaimUpdate = Partial<Omit<InsuranceClaim, 'claimId' | 'createdAt'>>;

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
 * Get-or-create the Insurance_Claims tab. Tolerant of pre-existing tabs
 * created without a header row.
 */
async function getOrCreateSheet(doc: Awaited<ReturnType<typeof getDoc>>) {
  if (!doc) return null;
  let sheet = doc.sheetsByTitle[SHEET_TAB];
  if (!sheet) {
    sheet = await doc.addSheet({
      title: SHEET_TAB,
      headerValues: HEADERS,
      gridProperties: { columnCount: Math.max(HEADERS.length + 5, 30) },
    });
  } else {
    try {
      await sheet.loadHeaderRow();
    } catch {
      if (sheet.gridProperties.columnCount < HEADERS.length) {
        await sheet.resize({
          rowCount: sheet.gridProperties.rowCount,
          columnCount: HEADERS.length + 5,
        });
      }
      await sheet.setHeaderRow(HEADERS);
    }
  }
  return sheet;
}

function rowToClaim(row: {
  get: (key: string) => string | undefined;
}): InsuranceClaim {
  return {
    claimId: String(row.get('claimId') ?? ''),
    customerId: String(row.get('customerId') ?? ''),
    customerName: String(row.get('customerName') ?? ''),
    customerEmail: String(row.get('customerEmail') ?? ''),
    jobId: String(row.get('jobId') ?? ''),
    repSlug: String(row.get('repSlug') ?? ''),
    repName: String(row.get('repName') ?? ''),
    insuranceCarrier: String(row.get('insuranceCarrier') ?? ''),
    claimNumber: String(row.get('claimNumber') ?? ''),
    adjusterName: String(row.get('adjusterName') ?? ''),
    adjusterPhone: String(row.get('adjusterPhone') ?? ''),
    adjusterEmail: String(row.get('adjusterEmail') ?? ''),
    dateOfLoss: String(row.get('dateOfLoss') ?? ''),
    dateClaimFiled: String(row.get('dateClaimFiled') ?? ''),
    dateAdjusterVisit: String(row.get('dateAdjusterVisit') ?? ''),
    dateAdjusterAccepted: String(row.get('dateAdjusterAccepted') ?? ''),
    dateSupplementSubmitted: String(row.get('dateSupplementSubmitted') ?? ''),
    dateSupplementApproved: String(row.get('dateSupplementApproved') ?? ''),
    dateFinalApproved: String(row.get('dateFinalApproved') ?? ''),
    dateDepreciationReleased: String(row.get('dateDepreciationReleased') ?? ''),
    initialEstimate: String(row.get('initialEstimate') ?? ''),
    supplementAmount: String(row.get('supplementAmount') ?? ''),
    finalSettlement: String(row.get('finalSettlement') ?? ''),
    depreciationAmount: String(row.get('depreciationAmount') ?? ''),
    deductible: String(row.get('deductible') ?? ''),
    status: (String(row.get('status') ?? 'damage_reported') as InsuranceClaimStatus),
    notes: String(row.get('notes') ?? ''),
    createdAt: String(row.get('createdAt') ?? ''),
    updatedAt: String(row.get('updatedAt') ?? ''),
  };
}

/**
 * Create or upsert (by claimId) an insurance claim row.
 *
 * Best-effort: never throws. Callers should NOT await this — fire it as
 * `recordInsuranceClaim(claim).catch(() => {})` so the customer-facing
 * response is never blocked by a sheet round-trip.
 */
export async function recordInsuranceClaim(
  claim: InsuranceClaim,
): Promise<void> {
  try {
    const doc = await getDoc();
    if (!doc) return;
    const sheet = await getOrCreateSheet(doc);
    if (!sheet) return;

    const rows = await sheet.getRows();
    const existing = claim.claimId
      ? rows.find(r => r.get('claimId') === claim.claimId)
      : undefined;

    const payload = {
      timestamp: new Date().toISOString(),
      ...claim,
    };

    if (existing) {
      Object.entries(payload).forEach(([k, v]) => existing.set(k, v));
      await existing.save();
    } else {
      await sheet.addRow(payload);
    }
  } catch (err) {
    console.error('[INSURANCE CLAIMS SHEET FAILED] recordInsuranceClaim', {
      claimId: claim.claimId,
      err: err instanceof Error ? err.message : err,
    });
  }
}

/**
 * Look up a single claim. Pass `claimId` for an exact match, or
 * `customerId` to return the most-recently-updated claim for that
 * customer (the common customer-portal case where a customer has at most
 * one active claim at a time).
 *
 * Returns null when:
 *   - env not configured
 *   - no matching row exists
 *   - the underlying sheet call throws (logged, not propagated)
 */
export async function getInsuranceClaim(args: {
  customerId?: string;
  claimId?: string;
}): Promise<InsuranceClaim | null> {
  if (!args.customerId && !args.claimId) return null;
  try {
    const doc = await getDoc();
    if (!doc) return null;
    const sheet = await getOrCreateSheet(doc);
    if (!sheet) return null;
    const rows = await sheet.getRows();

    if (args.claimId) {
      const row = rows.find(r => r.get('claimId') === args.claimId);
      return row ? rowToClaim(row) : null;
    }

    // customerId branch — pick the most-recently-updated row.
    const matching = rows.filter(r => r.get('customerId') === args.customerId);
    if (matching.length === 0) return null;
    matching.sort((a, b) => {
      const au = String(a.get('updatedAt') ?? '');
      const bu = String(b.get('updatedAt') ?? '');
      return bu.localeCompare(au);
    });
    return rowToClaim(matching[0]);
  } catch (err) {
    console.error('[INSURANCE CLAIMS SHEET FAILED] getInsuranceClaim', {
      args,
      err: err instanceof Error ? err.message : err,
    });
    return null;
  }
}

/**
 * Advance a claim's status and merge optional field updates into the
 * same row. Returns the updated claim, or null on failure / not-found.
 *
 * This is the admin-only mutation path (the customer route never calls
 * this — customers can file a new claim but cannot advance their own
 * status). The handler is responsible for the auth check; this function
 * does the sheet work only.
 *
 * Reads must surface failures so the admin UI can show an error, but
 * the function still does not throw — it logs and returns null.
 */
export async function updateInsuranceClaimStatus(
  claimId: string,
  status: InsuranceClaimStatus,
  fieldUpdates?: InsuranceClaimUpdate,
): Promise<InsuranceClaim | null> {
  if (!claimId) return null;
  try {
    const doc = await getDoc();
    if (!doc) return null;
    const sheet = await getOrCreateSheet(doc);
    if (!sheet) return null;
    const rows = await sheet.getRows();
    const row = rows.find(r => r.get('claimId') === claimId);
    if (!row) return null;

    const now = new Date().toISOString();
    row.set('status', status);
    row.set('updatedAt', now);

    if (fieldUpdates) {
      Object.entries(fieldUpdates).forEach(([k, v]) => {
        if (v === undefined || v === null) return;
        row.set(k, String(v));
      });
    }

    await row.save();
    return rowToClaim(row);
  } catch (err) {
    console.error('[INSURANCE CLAIMS SHEET FAILED] updateInsuranceClaimStatus', {
      claimId,
      status,
      err: err instanceof Error ? err.message : err,
    });
    return null;
  }
}

/**
 * Return every claim filed by a single customer, newest-updated first.
 * Used by the customer-portal GET handler (a customer with multiple
 * historical claims sees a list, not just the latest one).
 */
export async function listInsuranceClaimsForCustomer(
  customerId: string,
): Promise<InsuranceClaim[]> {
  if (!customerId) return [];
  try {
    const doc = await getDoc();
    if (!doc) return [];
    const sheet = await getOrCreateSheet(doc);
    if (!sheet) return [];
    const rows = await sheet.getRows();
    const matching = rows.filter(r => r.get('customerId') === customerId);
    const claims = matching.map(rowToClaim);
    claims.sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
    return claims;
  } catch (err) {
    console.error('[INSURANCE CLAIMS SHEET FAILED] listInsuranceClaimsForCustomer', {
      customerId,
      err: err instanceof Error ? err.message : err,
    });
    return [];
  }
}

/**
 * Return every claim in the sheet (admin viewer). Newest-updated first.
 * Empty list on env-unset or any failure — the admin page renders an
 * unconfigured / empty state instead of 500-ing.
 */
export async function listAllInsuranceClaims(): Promise<InsuranceClaim[]> {
  try {
    const doc = await getDoc();
    if (!doc) return [];
    const sheet = await getOrCreateSheet(doc);
    if (!sheet) return [];
    const rows = await sheet.getRows();
    const claims = rows.map(rowToClaim);
    claims.sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
    return claims;
  } catch (err) {
    console.error('[INSURANCE CLAIMS SHEET FAILED] listAllInsuranceClaims', {
      err: err instanceof Error ? err.message : err,
    });
    return [];
  }
}
