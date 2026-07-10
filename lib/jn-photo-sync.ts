/**
 * JN Photo Sync
 *
 * Mirrors delivery/ticket photos into JobNimbus so the office sees them on
 * the job record without opening the portal.
 *
 * Flow: ticket photo lands in Vercel Blob (public URL) → the add-photo
 * handler in /api/portal/tickets calls syncTicketPhotoToJN → we look up the
 * ticket's referenceNumber (R-XXXXX) → find the JN job → write a note with a
 * clickable link to the photo.
 *
 * MECHANISM: note-link via createNoteOnJob (prod-proven — same path as the
 * credit-memo notes in lib/job-material-cost-service.ts). A true file upload
 * (jobNimbusService.uploadFileToJob) exists but its POST /files payload is
 * UNVERIFIED — do not switch mechanisms until the write-probe in
 * scripts/test-jn-file-upload.mjs has been run and confirmed.
 *
 * GUARANTEES:
 *   - NEVER throws. Strictly fire-and-forget; the photo upload path must not
 *     fail or slow down because JN or Sheets is having a bad day.
 *   - Every attempt (success, no matching job, error) is appended to the
 *     master-sheet `JN_Photo_Sync_Log` tab so failures are visible.
 *   - Carries NO cost data — photo URL + type only. (Hard rule: nothing
 *     cost-related ever goes to JobNimbus.)
 */

import { ticketSheetService } from './ticket-sheet-service';
import { googleSheetsService } from './google-sheets-service';

const MECHANISM = 'note-link';

export interface SyncTicketPhotoParams {
  ticketId: string;
  photoUrl: string;
  /** e.g. 'proof_of_delivery', 'load', 'qc' — whatever the portal sent. */
  photoType: string;
}

/**
 * Sync one ticket photo to the matching JobNimbus job as a note link.
 * Fire-and-forget: resolves (never rejects) no matter what fails.
 */
export async function syncTicketPhotoToJN({
  ticketId,
  photoUrl,
  photoType,
}: SyncTicketPhotoParams): Promise<void> {
  let jobNumber = '';
  try {
    const ticket = await ticketSheetService.getById(ticketId);
    const referenceNumber = ticket?.referenceNumber?.trim();
    if (!referenceNumber) {
      // Ticket has no job number to match on — nothing to sync, exit quietly.
      return;
    }
    jobNumber = referenceNumber;

    // Internal sync path — only jnid + primary contact id are consumed
    // downstream, never cost fields. Owner-tier viewer matches the precedent
    // in job-material-cost-service.postCreditMemoNoteToJN.
    const { jobNimbusService } = await import('./jobnimbus-service');
    const job = await jobNimbusService.getJobByNumber(referenceNumber, { canSeeCost: true });

    if (!job?.jnid) {
      await logSync({ ticketId, jobNumber, photoType, photoUrl, status: 'no_job' });
      return;
    }

    // JN's primary contact lives on `job.primary.id`; fall back to the job's
    // own jnid when the relationship isn't populated (same fallback the
    // credit-memo note path uses).
    const contactJnid = job.primary?.id || job.jnid;

    await jobNimbusService.createNoteOnJob(
      job.jnid,
      contactJnid,
      `[Delivery Photo — ${photoType}] ${photoUrl}`,
    );

    await logSync({ ticketId, jobNumber, photoType, photoUrl, status: 'success' });
  } catch (error) {
    // Swallow everything — this path must never block or fail the caller.
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[jn-photo-sync] failed for ticket ${ticketId}:`, message);
    await logSync({ ticketId, jobNumber, photoType, photoUrl, status: 'error', error: message });
  }
}

/** Append a row to JN_Photo_Sync_Log. Never throws (belt-and-suspenders). */
async function logSync(params: {
  ticketId: string;
  jobNumber: string;
  photoType: string;
  photoUrl: string;
  status: 'success' | 'no_job' | 'error';
  error?: string;
}): Promise<void> {
  try {
    await googleSheetsService.logJnPhotoSync({
      timestamp: new Date().toISOString(),
      ticketId: params.ticketId,
      jobNumber: params.jobNumber,
      photoType: params.photoType,
      photoUrl: params.photoUrl,
      mechanism: MECHANISM,
      status: params.status,
      error: params.error || '',
    });
  } catch (logError) {
    // logJnPhotoSync already catches internally; this is pure paranoia.
    console.error('[jn-photo-sync] failed to write sync log:', logError);
  }
}
