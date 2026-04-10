/**
 * Centralized resolver for the master Google Sheet ID.
 *
 * The codebase has historically used three different env var names for the
 * same master sheet:
 *   - GOOGLE_SHEET_ID  (singular, oldest)
 *   - GOOGLE_SHEETS_ID (plural, current standard)
 *   - DELIVERY_SHEETS_ID (newer, used by lead/inventory services)
 *
 * On a host where only one of the three is set, services that read a
 * different name silently fail with "Missing Google Sheets credentials" and
 * the customer never sees the data save.
 *
 * Always import this helper instead of reading the env var directly.
 */
export function getMasterSheetId(): string | undefined {
  return (
    process.env.GOOGLE_SHEET_ID ||
    process.env.GOOGLE_SHEETS_ID ||
    process.env.DELIVERY_SHEETS_ID ||
    undefined
  );
}

/**
 * Same as getMasterSheetId but throws a descriptive error if none of the
 * env vars are set. Use this in code paths where missing config should be a
 * hard failure.
 */
export function requireMasterSheetId(): string {
  const id = getMasterSheetId();
  if (!id) {
    throw new Error(
      'Missing Google Sheet ID. Set one of GOOGLE_SHEET_ID, GOOGLE_SHEETS_ID, or DELIVERY_SHEETS_ID.'
    );
  }
  return id;
}
