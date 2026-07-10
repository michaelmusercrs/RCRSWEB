/**
 * JN Photo Sync
 *
 * Mirrors delivery/ticket photos into JobNimbus so the office sees them on
 * the job record without opening the portal.
 *
 * Flow: ticket photo lands in Vercel Blob (public URL) → the add-photo
 * handler in /api/portal/tickets calls syncTicketPhotoToJN → we look up the
 * ticket's referenceNumber (R-XXXXX) → find the JN job → attach the photo.
 *
 * MECHANISM (primary): REAL file attachment. We fetch the Blob image
 * server-side, base64 it, and POST it to JN /files via
 * jobNimbusService.uploadFileToJob — payload live-verified 2026-07-10
 * (owner-authorized write probe, see scripts/test-jn-file-upload.mjs). The
 * photo shows up in the job's Photos/files tab like any office-uploaded file.
 *
 * MECHANISM (fallback): if the file upload throws for any reason (Blob fetch
 * failure, JN /files hiccup, oversized image), we fall back to the previous
 * prod-proven behavior — a note on the job with a clickable link to the
 * photo (createNoteOnJob, same path as the credit-memo notes in
 * lib/job-material-cost-service.ts).
 *
 * GUARANTEES:
 *   - NEVER throws. Strictly fire-and-forget; the photo upload path must not
 *     fail or slow down because JN, Blob, or Sheets is having a bad day.
 *   - Every attempt (success, no matching job, error) is appended to the
 *     master-sheet `JN_Photo_Sync_Log` tab with `mechanism` = 'file' | 'note'
 *     so failures AND fallbacks are visible.
 *   - Carries NO cost data — photo bytes + type only. (Hard rule: nothing
 *     cost-related ever goes to JobNimbus.)
 */

import { ticketSheetService } from './ticket-sheet-service';
import { googleSheetsService } from './google-sheets-service';

/**
 * Refuse to base64 anything bigger than this — a JSON body with base64
 * inflates ~33% and a huge photo would balloon Vercel function memory and JN
 * request size. Oversized photos fall back to the note link instead.
 */
const MAX_PHOTO_BYTES = 8 * 1024 * 1024; // 8 MB

export interface SyncTicketPhotoParams {
  ticketId: string;
  photoUrl: string;
  /** e.g. 'proof_of_delivery', 'load', 'qc' — whatever the portal sent. */
  photoType: string;
}

/**
 * Sync one ticket photo to the matching JobNimbus job — real file attachment
 * first, note-link fallback. Fire-and-forget: resolves (never rejects) no
 * matter what fails.
 */
export async function syncTicketPhotoToJN({
  ticketId,
  photoUrl,
  photoType,
}: SyncTicketPhotoParams): Promise<void> {
  let jobNumber = '';
  let mechanism: 'file' | 'note' = 'file';
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
      await logSync({ ticketId, jobNumber, photoType, photoUrl, mechanism, status: 'no_job' });
      return;
    }

    // JN's primary contact lives on `job.primary.id`; fall back to the job's
    // own jnid when the relationship isn't populated (same fallback the
    // credit-memo note path uses — uploadFileToJob dedupes it).
    const contactJnid = job.primary?.id || job.jnid;

    try {
      // ── PRIMARY: real file attachment ──────────────────────────────────
      const photo = await fetchPhotoAsBase64(photoUrl);
      await jobNimbusService.uploadFileToJob(job.jnid, contactJnid, {
        filename: buildJnFilename(jobNumber, photoType, photoUrl, photo.contentType),
        contentType: photo.contentType,
        base64: photo.base64,
        description: `[Delivery Photo — ${photoType}] synced from portal ticket ${ticketId}`,
      });
      await logSync({ ticketId, jobNumber, photoType, photoUrl, mechanism: 'file', status: 'success' });
    } catch (fileError) {
      // ── FALLBACK: prod-proven note link ────────────────────────────────
      mechanism = 'note';
      const fileMessage = fileError instanceof Error ? fileError.message : String(fileError);
      console.error(
        `[jn-photo-sync] file upload failed for ticket ${ticketId}, falling back to note:`,
        fileMessage,
      );
      await jobNimbusService.createNoteOnJob(
        job.jnid,
        contactJnid,
        `[Delivery Photo — ${photoType}] ${photoUrl}`,
      );
      await logSync({
        ticketId,
        jobNumber,
        photoType,
        photoUrl,
        mechanism: 'note',
        status: 'success',
        error: `file upload failed, fell back to note: ${fileMessage}`,
      });
    }
  } catch (error) {
    // Swallow everything — this path must never block or fail the caller.
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[jn-photo-sync] failed for ticket ${ticketId}:`, message);
    await logSync({ ticketId, jobNumber, photoType, photoUrl, mechanism, status: 'error', error: message });
  }
}

/**
 * Fetch the Vercel Blob photo server-side and return it base64-encoded.
 * Throws on any failure (caller falls back to the note link).
 */
async function fetchPhotoAsBase64(
  photoUrl: string,
): Promise<{ base64: string; contentType: string }> {
  const response = await fetch(photoUrl, { signal: AbortSignal.timeout(15000) });
  if (!response.ok) {
    throw new Error(`photo fetch failed: HTTP ${response.status}`);
  }
  const buffer = Buffer.from(await response.arrayBuffer());
  if (buffer.byteLength === 0) {
    throw new Error('photo fetch returned an empty body');
  }
  if (buffer.byteLength > MAX_PHOTO_BYTES) {
    throw new Error(`photo too large for JN file upload: ${buffer.byteLength} bytes`);
  }
  const contentType = response.headers.get('content-type')?.split(';')[0]?.trim() || 'image/jpeg';
  return { base64: buffer.toString('base64'), contentType };
}

/** content-type → filename extension for the JN attachment. */
const EXT_BY_CONTENT_TYPE: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/jpg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
  'image/heic': '.heic',
};

/**
 * Build a JN filename like `R-11305-proof_of_delivery-photo-Kj2f9x.jpg`.
 * The uniqueness suffix comes from the Blob pathname (Vercel Blob appends a
 * random suffix to every upload), NOT from a timestamp — the blob name is the
 * stable identity of this photo.
 */
function buildJnFilename(
  jobNumber: string,
  photoType: string,
  photoUrl: string,
  contentType: string,
): string {
  let blobBase = 'photo';
  try {
    const pathname = new URL(photoUrl).pathname;
    blobBase = decodeURIComponent(pathname.split('/').pop() || 'photo');
  } catch {
    // Unparseable URL — keep the generic base; the blob suffix is only for
    // uniqueness/traceability, not correctness.
  }
  // Split off the extension so it always lands at the very end of the name.
  const dotIndex = blobBase.lastIndexOf('.');
  const ext =
    dotIndex > 0
      ? blobBase.slice(dotIndex)
      : EXT_BY_CONTENT_TYPE[contentType] || '.jpg';
  const stem = dotIndex > 0 ? blobBase.slice(0, dotIndex) : blobBase;
  const raw = `${jobNumber}-${photoType}-${stem}`;
  // JN filenames: keep it filesystem-safe.
  const safe = raw.replace(/[^A-Za-z0-9._-]+/g, '_').slice(0, 180);
  return `${safe}${ext}`;
}

/** Append a row to JN_Photo_Sync_Log. Never throws (belt-and-suspenders). */
async function logSync(params: {
  ticketId: string;
  jobNumber: string;
  photoType: string;
  photoUrl: string;
  mechanism: 'file' | 'note';
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
      mechanism: params.mechanism,
      status: params.status,
      error: params.error || '',
    });
  } catch (logError) {
    // logJnPhotoSync already catches internally; this is pure paranoia.
    console.error('[jn-photo-sync] failed to write sync log:', logError);
  }
}
