/**
 * GAF QuickMeasure → JobNimbus ingest orchestrator (the state machine).
 *
 * Called by the /api/cron/gaf-report-sync cron (~every 15 min). One pass:
 *   1. INGEST  — read new QuickMeasure reports from the rcrs@ mailbox, dedupe
 *                by GAF order #, add to the GAF_Report_Queue.
 *   2. MATCH   — for each open report, find the JN job by address (rep-scoped
 *                tie-break). Manual match (office override) wins.
 *   3. ATTACH  — high-confidence match → attach the Full Report PDF to the job,
 *                add a material cheat-sheet note, email the rep the summary.
 *   4. RETRY   — no match → notify the rep once, retry at ~15/30/60 min, then
 *                escalate to the office once. Keep retrying hourly until matched.
 *   5. VERIFY  — follow-up: confirm the file is actually on the job before
 *                closing the report out ('done').
 *
 * No unnecessary email: rep gets ONE no-match note (first miss) + the summary
 * on success; office gets ONE escalation. Everything else is silent.
 *
 * Never throws — a bad report, JN hiccup, or Sheets outage degrades to a log
 * line and a retry next run.
 */

import { jobNimbusService, JN_FILE_TYPE } from '../jobnimbus-service';
import {
  listMessageIds, getMessage, getAttachmentBase64, gmailConfigured,
} from './gmail-service';
import {
  isRealQuickMeasureReport, addressFromSubject, orderNumberFromBody,
  repsFromRecipients,
} from './quickmeasure-parse';
import { getCandidateJobs, getJobsByZip, matchJob, parseAddress, type JobLike } from './jn-address-match';
import { buildMaterialSummary } from './coverage-config';
import { extractMeasurementsFromPdf } from './pdf-measurements';
import { renderSummaryPdf } from './summary-pdf';
import {
  getAllReports, upsertReport, logIngest, type QueueRecord, type ReportStatus,
} from './report-queue';
import {
  sendRepSummary, sendRepNoMatch, sendOfficeEscalation,
} from './gaf-emails';
import { resolveRep } from './rep-resolver';

const LOOKBACK_DAYS = parseInt(process.env.GAF_LOOKBACK_DAYS || '4', 10);
const JOB_LOOKBACK_DAYS = parseInt(process.env.GAF_JOB_LOOKBACK_DAYS || '120', 10);
const MAX_PDF_BYTES = 18 * 1024 * 1024; // JN base64 body guard (~24MB encoded)

const TERMINAL: ReportStatus[] = ['done', 'skipped'];

function reportFilename(orderNumber: string): string {
  return `GAF-QuickMeasure-${orderNumber}.pdf`;
}
function summaryFilename(orderNumber: string): string {
  return `GAF-Summary-${orderNumber}.pdf`;
}

/** ~15/30/60 min after first seen, then hourly. */
function nextAttemptIso(firstSeenIso: string, attempts: number): string {
  const first = Date.parse(firstSeenIso) || Date.now();
  const offsetsMin = [15, 30, 60];
  const ms = attempts <= offsetsMin.length
    ? first + offsetsMin[attempts - 1] * 60_000
    : Date.now() + 60 * 60_000;
  return new Date(ms).toISOString();
}

export interface IngestResult {
  configured: boolean;
  discovered: number;
  attached: number;
  verified: number;
  repNoMatch: number;
  escalated: number;
  errors: number;
  processed: number;
  message?: string;
}

export interface IngestOptions {
  /** Override the inbox lookback window (for a one-time backlog sweep). */
  lookbackDays?: number;
  /** Backlog mode: attach + note only, send NO rep/office emails. */
  quiet?: boolean;
}

export async function processGafReports(opts: IngestOptions = {}): Promise<IngestResult> {
  const res: IngestResult = {
    configured: true, discovered: 0, attached: 0, verified: 0,
    repNoMatch: 0, escalated: 0, errors: 0, processed: 0,
  };

  if (!gmailConfigured()) {
    return { ...res, configured: false, message: 'Gmail service account not configured' };
  }

  // ── 1. INGEST ──────────────────────────────────────────────────────────────
  try {
    const lookback = opts.lookbackDays ?? LOOKBACK_DAYS;
    const query = `from:services@gaf.com subject:"GAF QuickMeasure" has:attachment newer_than:${lookback}d`;
    const ids = await listMessageIds(query, 50);
    const existing = new Set((await getAllReports()).map(r => r.orderNumber));
    for (const id of ids) {
      try {
        const msg = await getMessage(id);
        if (!isRealQuickMeasureReport(msg.subject)) continue;
        const hasPdf = msg.attachments.some(a => /\.pdf$/i.test(a.filename));
        if (!hasPdf) continue;
        const orderNumber = orderNumberFromBody(msg.bodyText);
        if (!orderNumber || existing.has(orderNumber)) continue;
        const address = addressFromSubject(msg.subject);
        const reps = repsFromRecipients(msg.to);
        const primaryRep = reps[0];
        const resolved = primaryRep ? resolveRep(primaryRep.email, primaryRep.localPart) : null;

        await upsertReport({
          orderNumber,
          messageId: msg.id,
          threadId: msg.threadId,
          address,
          repEmail: resolved?.email || primaryRep?.email || '',
          repName: resolved?.name || '',
          repLocalPart: primaryRep?.localPart || '',
          receivedAt: msg.date ? new Date(msg.date).toISOString() : '',
          firstSeenAt: new Date().toISOString(),
          nextAttemptAt: '', // process immediately
          attempts: 0,
          status: 'new',
        });
        existing.add(orderNumber);
        res.discovered++;
        await logIngest({ orderNumber, address, status: 'discovered', detail: `rep=${primaryRep?.localPart || '?'}` });
      } catch (err) {
        res.errors++;
        console.error('[gaf] ingest message failed', id, err);
      }
    }
  } catch (err) {
    res.errors++;
    console.error('[gaf] ingest listing failed', err);
  }

  // ── 2–5. PROCESS QUEUE ──────────────────────────────────────────────────────
  let reports: QueueRecord[] = [];
  try {
    reports = await getAllReports();
  } catch (err) {
    console.error('[gaf] could not read queue', err);
    return { ...res, message: 'queue read failed' };
  }

  const now = Date.now();
  const due = reports.filter(r =>
    !TERMINAL.includes(r.status) &&
    (r.status === 'new' || !r.nextAttemptAt || Date.parse(r.nextAttemptAt) <= now || r.status === 'attached' || r.manualJobNumber),
  );

  // Candidate resolution: prefer same-zip jobs (a precise JN filter query,
  // cached per zip), and fall back to a recent-jobs window only if the zip
  // query is empty. The recent window is fetched lazily at most once.
  const zipCache = new Map<string, JobLike[]>();
  let recentWindow: JobLike[] | null = null;
  const resolveCandidates = async (address: string): Promise<JobLike[]> => {
    const zip = parseAddress(address).zip;
    if (zip) {
      if (!zipCache.has(zip)) zipCache.set(zip, await getJobsByZip(zip));
      const zipJobs = zipCache.get(zip)!;
      if (zipJobs.length) return zipJobs;
    }
    if (recentWindow === null) {
      try { recentWindow = await getCandidateJobs({ sinceDays: JOB_LOOKBACK_DAYS }); }
      catch { recentWindow = []; }
    }
    return recentWindow;
  };

  for (const r of due) {
    res.processed++;
    try {
      await processOne(r, resolveCandidates, res, opts);
    } catch (err) {
      res.errors++;
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[gaf] processOne failed', r.orderNumber, msg);
      await upsertReport({ orderNumber: r.orderNumber, status: 'error', lastError: msg.slice(0, 240), lastAttemptAt: new Date().toISOString() });
      await logIngest({ orderNumber: r.orderNumber, address: r.address, status: 'error', detail: msg });
    }
  }

  return res;
}

async function processOne(
  r: QueueRecord,
  resolveCandidates: (address: string) => Promise<JobLike[]>,
  res: IngestResult,
  opts: IngestOptions,
): Promise<void> {
  const nowIso = new Date().toISOString();

  // ── VERIFY step: already attached, confirm the file is on the job → done ────
  if (r.status === 'attached') {
    if (!r.jobJnid) { await upsertReport({ orderNumber: r.orderNumber, status: 'done', verifiedAt: nowIso }); return; }
    try {
      const files = await jobNimbusService.getFilesForJob(r.jobJnid, { canSeeCost: false });
      const present = files.some(f => (f.filename || '') === reportFilename(r.orderNumber));
      if (present) {
        await upsertReport({ orderNumber: r.orderNumber, status: 'done', verifiedAt: nowIso });
        res.verified++;
        await logIngest({ orderNumber: r.orderNumber, address: r.address, status: 'verified', jobNumber: r.jobNumber, mechanism: 'file' });
      } else {
        // Not visible yet — leave 'attached', re-check next run (don't re-upload).
        await upsertReport({ orderNumber: r.orderNumber, lastAttemptAt: nowIso });
        await logIngest({ orderNumber: r.orderNumber, address: r.address, status: 'verify_pending', jobNumber: r.jobNumber });
      }
    } catch (err) {
      await logIngest({ orderNumber: r.orderNumber, address: r.address, status: 'verify_error', detail: String(err) });
    }
    return;
  }

  // ── MATCH: manual override > existing match > address match ──────────────────
  let jobJnid = r.jobJnid;
  let contactJnid = r.contactJnid;
  let jobNumber = r.jobNumber;

  if (!jobJnid) {
    const manual = r.manualJobNumber?.trim();
    if (manual) {
      const job = await jobNimbusService.getJobByNumber(manual, { canSeeCost: false });
      if (job?.jnid) {
        jobJnid = job.jnid; contactJnid = job.primary?.id || job.jnid; jobNumber = job.number || manual;
      } else {
        await logIngest({ orderNumber: r.orderNumber, address: r.address, status: 'manual_not_found', detail: `manual job ${manual} not found` });
      }
    }
    if (!jobJnid) {
      const cands = await resolveCandidates(r.address);
      const m = matchJob(r.address, cands, r.repLocalPart || r.repName);
      if (m.tier === 'high' && m.job) {
        jobJnid = m.job.jnid; contactJnid = m.job.primary?.id || m.job.jnid; jobNumber = m.jobNumber;
        await logIngest({ orderNumber: r.orderNumber, address: r.address, status: 'matched', jobNumber, detail: `${m.reason} (score ${m.score})` });
      }
    }
  }

  // ── No match → retry ladder + notifications ─────────────────────────────────
  if (!jobJnid) {
    const attempts = r.attempts + 1;
    const elapsedMin = (Date.now() - (Date.parse(r.firstSeenAt) || Date.now())) / 60_000;

    // First miss → notify the rep once.
    let repNotified = r.repNotifiedNoMatch;
    if (!opts.quiet && !repNotified && r.repEmail) {
      const sent = await sendRepNoMatch({ repEmail: r.repEmail, repName: r.repName, address: r.address, orderNumber: r.orderNumber });
      if (sent.success) { repNotified = true; res.repNoMatch++; }
      await logIngest({ orderNumber: r.orderNumber, address: r.address, status: 'rep_notified_no_match', mechanism: 'email', detail: sent.success ? r.repEmail : (sent.error || 'send failed') });
    }

    // After the ~60-min window still nothing → escalate to office once.
    let escalated = r.officeEscalated;
    let status: ReportStatus = 'unmatched';
    if (!opts.quiet && elapsedMin >= 58 && !escalated) {
      const sent = await sendOfficeEscalation({ address: r.address, orderNumber: r.orderNumber, repName: r.repName, repEmail: r.repEmail });
      if (sent.success) { escalated = true; res.escalated++; }
      status = 'escalated';
      await logIngest({ orderNumber: r.orderNumber, address: r.address, status: 'office_escalated', mechanism: 'email', detail: sent.success ? 'ok' : (sent.error || 'send failed') });
    } else if (escalated) {
      status = 'escalated';
    }

    await upsertReport({
      orderNumber: r.orderNumber,
      status,
      attempts,
      lastAttemptAt: nowIso,
      nextAttemptAt: nextAttemptIso(r.firstSeenAt || nowIso, attempts),
      repNotifiedNoMatch: repNotified,
      officeEscalated: escalated,
    });
    return;
  }

  // ── ATTACH: matched → report PDF + material-summary PDF + rep email ──────────
  // Per-file idempotency: fetch existing files once; attach whichever is missing.
  let existingFiles: { filename?: string }[] = [];
  try { existingFiles = await jobNimbusService.getFilesForJob(jobJnid, { canSeeCost: false }); } catch { /* best-effort */ }
  const hasReport = existingFiles.some(f => (f.filename || '') === reportFilename(r.orderNumber));
  const hasSummary = existingFiles.some(f => (f.filename || '') === summaryFilename(r.orderNumber));

  if (hasReport && hasSummary) {
    await upsertReport({ orderNumber: r.orderNumber, status: 'attached', jobJnid, contactJnid, jobNumber, attachedAt: r.attachedAt || nowIso, lastAttemptAt: nowIso });
    await logIngest({ orderNumber: r.orderNumber, address: r.address, status: 'already_attached', jobNumber });
    return;
  }

  const msg = await getMessage(r.messageId);
  const pdfAtt = msg.attachments.find(a => /^full report/i.test(a.filename) && /\.pdf$/i.test(a.filename))
    || msg.attachments.find(a => /\.pdf$/i.test(a.filename) && !/property owner/i.test(a.filename))
    || msg.attachments.find(a => /\.pdf$/i.test(a.filename));
  if (!pdfAtt) {
    await upsertReport({ orderNumber: r.orderNumber, status: 'error', lastError: 'no PDF attachment on message', lastAttemptAt: nowIso });
    await logIngest({ orderNumber: r.orderNumber, address: r.address, status: 'error', detail: 'no PDF attachment' });
    return;
  }

  // Download the Full Report PDF once (attach it AND parse its Summary page —
  // the XML is only geometry, so measurements come from the PDF).
  const pdfB64 = await getAttachmentBase64(msg.id, pdfAtt.attachmentId);
  const pdfBuffer = Buffer.from(pdfB64, 'base64');
  if (pdfBuffer.byteLength > MAX_PDF_BYTES) {
    await upsertReport({ orderNumber: r.orderNumber, status: 'error', lastError: `PDF too large (${pdfBuffer.byteLength} bytes)`, lastAttemptAt: nowIso });
    await logIngest({ orderNumber: r.orderNumber, address: r.address, status: 'error', detail: 'PDF too large for JN upload' });
    return;
  }

  const pa = parseAddress(r.address);
  const { measurements, ok: parseOk } = await extractMeasurementsFromPdf(pdfBuffer);
  const summary = buildMaterialSummary(measurements, { city: pa.city, zip: pa.zip });
  const squares = measurements.squares != null ? measurements.squares.toFixed(1) : '';
  if (!parseOk) {
    await logIngest({ orderNumber: r.orderNumber, address: r.address, status: 'measure_parse_incomplete', detail: `roofArea=${measurements.roofAreaSqFt} eave=${measurements.eaveLengthFt}` });
  }

  // 1) Full Report PDF (the measurement report — EagleView file-type slot).
  if (!hasReport) {
    await jobNimbusService.uploadFileToJob(jobJnid, contactJnid, {
      filename: reportFilename(r.orderNumber),
      contentType: 'application/pdf',
      base64: pdfB64,
      description: `[GAF QuickMeasure] Full measurement report — Order #${r.orderNumber}`,
      fileType: JN_FILE_TYPE.EAGLEVIEW,
    });
  }

  // 2) Material cheat-sheet PDF (best-effort — never block the report attach).
  if (!hasSummary && summary.lines.length) {
    try {
      const summaryPdf = await renderSummaryPdf(r.address, r.orderNumber, measurements, summary);
      await jobNimbusService.uploadFileToJob(jobJnid, contactJnid, {
        filename: summaryFilename(r.orderNumber),
        contentType: 'application/pdf',
        base64: summaryPdf.toString('base64'),
        description: `[GAF QuickMeasure] Material order cheat-sheet — Order #${r.orderNumber}`,
        fileType: JN_FILE_TYPE.DOCUMENT,
      });
      await logIngest({ orderNumber: r.orderNumber, address: r.address, status: 'summary_attached', jobNumber, mechanism: 'file' });
    } catch (err) {
      console.error('[gaf] summary pdf failed', r.orderNumber, err);
      await logIngest({ orderNumber: r.orderNumber, address: r.address, status: 'summary_error', detail: String(err).slice(0, 200) });
    }
  }

  // 3) Email the rep the summary (they already have the report itself).
  if (!opts.quiet && r.repEmail && summary.lines.length) {
    const sent = await sendRepSummary({
      repEmail: r.repEmail, repName: r.repName, address: r.address,
      orderNumber: r.orderNumber, measurements, summary,
    });
    await logIngest({ orderNumber: r.orderNumber, address: r.address, status: 'rep_summary_email', mechanism: 'email', detail: sent.success ? r.repEmail : (sent.error || 'send failed') });
  }

  await upsertReport({
    orderNumber: r.orderNumber,
    status: 'attached',
    jobJnid, contactJnid, jobNumber,
    attachedAt: nowIso,
    lastAttemptAt: nowIso,
    squares,
    xmlKeysLogged: true,
    lastError: '',
  });
  res.attached++;
  await logIngest({ orderNumber: r.orderNumber, address: r.address, status: 'attached', jobNumber, mechanism: 'file' });
}
