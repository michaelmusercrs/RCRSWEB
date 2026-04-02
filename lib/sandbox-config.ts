/**
 * Sandbox Mode Configuration
 *
 * When SANDBOX_MODE=true (or VERCEL_GIT_COMMIT_REF=sandbox), all external
 * service calls are intercepted and return mock data instead.
 *
 * This prevents hitting:
 * - Google Sheets (reads/writes)
 * - JobNimbus API
 * - Email sending (Google Apps Script)
 * - SMS/Twilio
 * - GroupMe
 *
 * Auth still works using team-roles.ts default passwords (ChangeMe123!)
 */

export function isSandboxMode(): boolean {
  // Explicit flag
  if (process.env.SANDBOX_MODE === 'true') return true;
  // Auto-enable on sandbox branch deploys
  if (process.env.VERCEL_GIT_COMMIT_REF === 'sandbox') return true;
  return false;
}

/** Log sandbox interception for debugging */
export function sandboxLog(service: string, method: string, ...args: unknown[]): void {
  if (typeof window === 'undefined') {
    console.log(`[SANDBOX] ${service}.${method}()`, ...args);
  }
}
