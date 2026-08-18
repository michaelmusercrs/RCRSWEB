/**
 * Stalled Tickets Daily Digest + Overdue/Zombie Sweeps
 *
 * Every morning (vercel.json: `12 12 * * *` = 6:12am CT), this cron:
 *   1. Flags past-due deliveries — active tickets whose scheduledDate has
 *      passed get overdueAt stamped + an [OVERDUE] note (once each; an
 *      office reschedule clears overdueAt so a re-miss re-flags).
 *   2. Auto-completes zombies — tickets stuck in delivered / proof_captured /
 *      qc_photos for >24h are physically done; flip them to 'completed' so
 *      they can't haunt the board. en_route/arrived are NEVER auto-completed.
 *   3. Emails Michael + Sara a digest of stalled tickets (>48h in a
 *      non-terminal status) plus the newly-flagged overdue deliveries.
 *
 * Trigger: GET /api/cron/stalled-tickets-digest
 * Auth: CRON_SECRET header (Vercel) or admin/owner session (manual run)
 *
 * Terminal statuses (NOT stalled — even if old): completed, cancelled.
 * Everything else with age > threshold counts as stalled.
 *
 * Nothing stalled AND nothing newly overdue → no email (no spam).
 */

import { NextRequest, NextResponse } from 'next/server';
import { ticketSheetService, type TicketStatus } from '@/lib/ticket-sheet-service';
import { scanTicketChain, type ChainScanReport } from '@/lib/ticket-chain-scan';
import { emailService } from '@/lib/email-service';
import { TEAM_MEMBERS } from '@/lib/team-roles';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
// Scans every non-terminal ticket across all statuses + assembles digest email;
// grows with ticket volume so 60s default is unsafe.
export const maxDuration = 300;

const CRON_SECRET = process.env.CRON_SECRET;
const STALL_THRESHOLD_HOURS = 48;

// Statuses that mean "this ticket is done" — never count as stalled
const TERMINAL_STATUSES: TicketStatus[] = ['completed', 'cancelled'];

// ── Overdue-delivery flagging (piggybacks on this cron's 6:12am CT slot) ────
// A delivery ticket whose scheduledDate has passed without delivery gets
// overdueAt stamped + an [OVERDUE] note, exactly once (blank-overdueAt gate;
// an office reschedule clears overdueAt so a re-missed date re-flags).
const ACTIVE_DELIVERY_STATUSES = new Set<TicketStatus>([
  'created', 'assigned', 'materials_pulled', 'load_verified', 'en_route', 'arrived',
]);
const MAX_OVERDUE_FLAGS_PER_RUN = 15; // bound write quota; rest tomorrow
const WRITE_PAUSE_MS = 1100;          // ~54 writes/min, under the 60/min quota

// ── Zombie completion sweep ────────────────────────────────────────────────
// A ticket that reached delivered/proof_captured/qc_photos is physically done
// — the driver just never tapped the last step. After 24h it auto-completes
// so it can't haunt boards/digests forever. en_route/arrived are NEVER
// auto-completed (the truck may genuinely be stuck) — they stay in the
// stalled sections above for a human.
const ZOMBIE_STATUSES = new Set<TicketStatus>(['delivered', 'proof_captured', 'qc_photos']);
const ZOMBIE_AGE_HOURS = 24;
const MAX_ZOMBIE_COMPLETIONS_PER_RUN = 15;

const CHICAGO_TZ = 'America/Chicago';
function chicagoToday(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: CHICAGO_TZ }).format(new Date());
}
/** Whole calendar days a-b for two YYYY-MM-DD strings. */
function dayDiff(a: string, b: string): number {
  const [ay, am, ad] = a.split('-').map(Number);
  const [by, bm, bd] = b.split('-').map(Number);
  return Math.round((Date.UTC(ay, am - 1, ad) - Date.UTC(by, bm - 1, bd)) / 86_400_000);
}

interface OverdueEntry {
  ticketId: string;
  jobNumber: string;
  customerName: string;
  scheduledDate: string;
  daysLate: number;
  status: TicketStatus;
}

interface StalledTicket {
  ticketId: string;
  jobNumber: string;
  status: TicketStatus;
  customerName: string;
  createdAt: string;
  ageHours: number;
  ageDisplay: string; // "3d 4h" or "12h"
}

function ageHours(createdAt: string): number {
  if (!createdAt) return 0;
  const created = new Date(createdAt).getTime();
  if (!Number.isFinite(created)) return 0;
  return (Date.now() - created) / (1000 * 60 * 60);
}

function ageDisplay(hours: number): string {
  if (hours < 24) return `${Math.floor(hours)}h`;
  const days = Math.floor(hours / 24);
  const remHours = Math.floor(hours - days * 24);
  return remHours > 0 ? `${days}d ${remHours}h` : `${days}d`;
}

function buildDigestHtml(
  byStatus: Map<TicketStatus, StalledTicket[]>,
  overdueEntries: OverdueEntry[],
): string {
  const sections: string[] = [];

  // "Past scheduled delivery date" first — these are promises we've broken
  // to a job site, more urgent than a slow pipeline stage.
  if (overdueEntries.length > 0) {
    const rows = overdueEntries.map(t => `
      <tr>
        <td style="padding: 6px 12px;"><strong>${t.jobNumber}</strong></td>
        <td style="padding: 6px 12px;">${t.customerName.slice(0, 40)}</td>
        <td style="padding: 6px 12px;">${t.scheduledDate}</td>
        <td style="padding: 6px 12px; text-align: right; color: ${t.daysLate > 3 ? '#c00' : '#e90'};">${t.daysLate}d late</td>
        <td style="padding: 6px 12px;">${t.status}</td>
      </tr>`).join('');
    sections.push(`
      <h3 style="margin: 24px 0 8px; color: #c00;">⚠ Past scheduled delivery date <span style="color: #888; font-weight: normal;">(${overdueEntries.length})</span></h3>
      <table style="width: 100%; border-collapse: collapse; background: #fff5f5;">
        <thead>
          <tr style="background: #c00; color: white; text-align: left;">
            <th style="padding: 8px 12px;">Job</th>
            <th style="padding: 8px 12px;">Customer</th>
            <th style="padding: 8px 12px;">Scheduled</th>
            <th style="padding: 8px 12px; text-align: right;">Late</th>
            <th style="padding: 8px 12px;">Status</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
      <p style="font-size: 12px; color: #888; margin: 4px 0 0;">
        Rescheduling the ticket in the portal clears the flag (it re-flags if missed again).
      </p>`);
  }
  // Order matters — show oldest-stuck first
  const statusOrder: TicketStatus[] = [
    'created', 'assigned', 'materials_pulled', 'load_verified',
    'en_route', 'arrived', 'delivered', 'picked_up',
    'proof_captured', 'qc_photos',
  ];

  for (const status of statusOrder) {
    const list = byStatus.get(status);
    if (!list || list.length === 0) continue;
    list.sort((a, b) => b.ageHours - a.ageHours);
    const rows = list.map(t => `
      <tr>
        <td style="padding: 6px 12px; font-family: monospace; font-size: 13px;">${t.ticketId}</td>
        <td style="padding: 6px 12px;"><strong>${t.jobNumber}</strong></td>
        <td style="padding: 6px 12px;">${t.customerName.slice(0, 40)}</td>
        <td style="padding: 6px 12px; text-align: right; color: ${t.ageHours > 168 ? '#c00' : t.ageHours > 96 ? '#e90' : '#333'};">${t.ageDisplay}</td>
      </tr>`).join('');
    sections.push(`
      <h3 style="margin: 24px 0 8px; color: #333;">${status} <span style="color: #888; font-weight: normal;">(${list.length})</span></h3>
      <table style="width: 100%; border-collapse: collapse; background: #fafafa;">
        <thead>
          <tr style="background: #333; color: white; text-align: left;">
            <th style="padding: 8px 12px;">Ticket</th>
            <th style="padding: 8px 12px;">Job</th>
            <th style="padding: 8px 12px;">Customer</th>
            <th style="padding: 8px 12px; text-align: right;">Age</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>`);
  }
  return `
<div style="font-family: -apple-system, sans-serif; max-width: 700px; margin: 0 auto;">
  <div style="background: #39FF14; color: black; padding: 20px;">
    <h1 style="margin: 0;">Stalled Tickets Digest</h1>
    <p style="margin: 4px 0 0; font-size: 14px;">Tickets in non-terminal status for &gt;${STALL_THRESHOLD_HOURS}h.</p>
  </div>
  <div style="padding: 20px;">
    ${sections.join('')}
    <p style="margin-top: 32px; font-size: 12px; color: #888;">
      Threshold: ${STALL_THRESHOLD_HOURS}h. Terminal statuses (completed, cancelled) are never reported.
      Color guide: black &lt;4d, orange 4-7d, red &gt;7d.
    </p>
  </div>
</div>`;
}

export async function GET(request: NextRequest) {
  // Auth
  const authHeader = request.headers.get('authorization') || '';
  const isVercelCron = CRON_SECRET && authHeader === `Bearer ${CRON_SECRET}`;
  if (!isVercelCron) {
    const { requireAuth } = await import('@/lib/auth-service');
    const auth = await requireAuth();
    if (!auth.authenticated) return auth.response;
    if (!['admin', 'owner', 'manager'].includes(auth.user.role)) {
      return NextResponse.json(
        { error: 'CRON_SECRET header or admin/owner/manager role required' },
        { status: 403 }
      );
    }
  }

  const all = await ticketSheetService.getAll();
  const today = chicagoToday();
  const nowIso = new Date().toISOString();
  const pause = () => new Promise(r => setTimeout(r, WRITE_PAUSE_MS));

  // ── Sweep 1: flag past-due deliveries (once each — blank-overdueAt gate).
  const overdueCandidates = all
    .filter(t =>
      t.ticketType === 'delivery' &&
      ACTIVE_DELIVERY_STATUSES.has(t.status) &&
      !!t.scheduledDate && t.scheduledDate < today &&
      !t.overdueAt,
    )
    // Oldest scheduled date first, so a capped run flags the worst offenders.
    .sort((a, b) => (a.scheduledDate || '').localeCompare(b.scheduledDate || ''));

  const newlyOverdue: OverdueEntry[] = [];
  const sweepErrors: string[] = [];
  for (const t of overdueCandidates.slice(0, MAX_OVERDUE_FLAGS_PER_RUN)) {
    const sched = t.scheduledDate!;
    const note = `[OVERDUE] Scheduled ${sched}, not delivered as of ${today}`;
    try {
      const ok = await ticketSheetService.patch(t.ticketId, {
        overdueAt: nowIso,
        notes: [t.notes, note].filter(Boolean).join('\n'),
      });
      if (ok) {
        newlyOverdue.push({
          ticketId: t.ticketId,
          jobNumber: t.referenceNumber || '?',
          customerName: t.customerName || '',
          scheduledDate: sched,
          daysLate: dayDiff(today, sched),
          status: t.status,
        });
      } else {
        sweepErrors.push(`overdue-flag ${t.ticketId}: patch returned false`);
      }
    } catch (err) {
      sweepErrors.push(`overdue-flag ${t.ticketId}: ${String(err)}`);
    }
    await pause();
  }

  // ── Sweep 2: auto-complete zombie tickets (delivered but never closed out).
  const zombies = all.filter(t =>
    t.ticketType === 'delivery' &&
    ZOMBIE_STATUSES.has(t.status) &&
    ageHours(t.createdAt || '') > ZOMBIE_AGE_HOURS,
  );
  const zombieCompleted: string[] = [];
  for (const t of zombies.slice(0, MAX_ZOMBIE_COMPLETIONS_PER_RUN)) {
    try {
      const ok = await ticketSheetService.updateStatus(t.ticketId, 'completed', nowIso);
      if (ok) zombieCompleted.push(t.ticketId);
      else sweepErrors.push(`zombie-complete ${t.ticketId}: update returned false`);
    } catch (err) {
      sweepErrors.push(`zombie-complete ${t.ticketId}: ${String(err)}`);
    }
    await pause();
  }
  const justCompleted = new Set(zombieCompleted);

  const stalled: StalledTicket[] = [];
  for (const t of all) {
    if (TERMINAL_STATUSES.includes(t.status)) continue;
    if (t.ticketType !== 'delivery') continue;
    if (justCompleted.has(t.ticketId)) continue; // closed by the zombie sweep above
    const hrs = ageHours(t.createdAt || '');
    if (hrs < STALL_THRESHOLD_HOURS) continue;
    stalled.push({
      ticketId: t.ticketId,
      jobNumber: t.referenceNumber || '?',
      status: t.status,
      customerName: t.customerName || '',
      createdAt: t.createdAt || '',
      ageHours: hrs,
      ageDisplay: ageDisplay(hrs),
    });
  }

  // Daily self-check: reconcile material-order ↔ ticket ↔ invoice ↔ breakdown ↔
  // inventory for the last 14 days. Best-effort — a scan failure never blocks the
  // stalled digest. The scan persists its own summary row (Chain_Scan_Results)
  // for the health dashboard.
  let chainScan: ChainScanReport | null = null;
  try {
    chainScan = await scanTicketChain(14);
  } catch (e) {
    console.warn('[stalled-tickets-digest] chain scan failed:', e);
  }
  const chainRed = chainScan?.counts.red ?? 0;

  if (stalled.length === 0 && newlyOverdue.length === 0 && chainRed === 0) {
    return NextResponse.json({
      success: true,
      stalledCount: 0,
      newlyOverdue: 0,
      overdueBacklog: Math.max(0, overdueCandidates.length - newlyOverdue.length),
      zombiesCompleted: zombieCompleted.length,
      sweepErrors,
      chainScan: chainScan?.counts ?? null,
      emailSent: false,
      message: 'No stalled tickets, nothing newly overdue, no red chain findings. Nothing emailed.',
    });
  }

  const byStatus = new Map<TicketStatus, StalledTicket[]>();
  for (const s of stalled) {
    if (!byStatus.has(s.status)) byStatus.set(s.status, []);
    byStatus.get(s.status)!.push(s);
  }

  // Recipients: Michael + Sara + active office/admin/owner
  const recipients = TEAM_MEMBERS
    .filter(m => m.isActive && ['owner', 'admin', 'office'].includes(m.role))
    .map(m => m.email)
    .filter(Boolean);

  if (recipients.length === 0) {
    return NextResponse.json({
      success: false,
      stalledCount: stalled.length,
      error: 'No recipients configured',
    }, { status: 500 });
  }

  const subjectBits = [
    stalled.length > 0
      ? `${stalled.length} ticket${stalled.length === 1 ? '' : 's'} stalled · oldest ${ageDisplay(Math.max(...stalled.map(s => s.ageHours)))}`
      : '',
    newlyOverdue.length > 0
      ? `${newlyOverdue.length} past delivery date`
      : '',
  ].filter(Boolean);
  if (chainRed > 0) subjectBits.push(`${chainRed} chain issue${chainRed === 1 ? '' : 's'}`);
  const subject = `[RCRS] ${subjectBits.join(' · ') || 'Self-check'}`;
  let body = buildDigestHtml(byStatus, newlyOverdue);

  // Append the self-check summary + top findings when the scan found anything.
  if (chainScan && (chainScan.counts.red > 0 || chainScan.counts.yellow > 0 || chainScan.counts.proposals > 0)) {
    const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const top = chainScan.findings
      .filter(f => f.severity === 'red')
      .slice(0, 15)
      .map(f => `<li><strong>${esc(f.referenceNumber || f.ticketId)}</strong> — ${esc(f.check)}: ${esc(f.detail)}</li>`)
      .join('');
    body += `
      <div style="margin-top:24px;padding-top:16px;border-top:2px solid #e5e5e5">
        <h3 style="margin:0 0 6px;color:#b91c1c">Inventory self-check (last ${chainScan.windowDays} days)</h3>
        <p style="margin:0 0 8px;font-size:14px;color:#555">
          Scanned ${chainScan.ticketsScanned} tickets — <strong style="color:#b91c1c">${chainScan.counts.red} red</strong>,
          ${chainScan.counts.yellow} yellow, ${chainScan.counts.proposals} proposed inventory adjustment(s).
          Full report: /api/admin/ticket-chain-scan
        </p>
        ${top ? `<ul style="font-size:13px;color:#333;margin:6px 0 0;padding-left:18px">${top}</ul>` : ''}
      </div>`;
  }

  let sent = 0;
  for (const to of recipients) {
    const res = await emailService.send({ template: 'stalled-tickets-digest', to, subject, body });
    if (res.success) sent++;
  }

  return NextResponse.json({
    success: true,
    stalledCount: stalled.length,
    newlyOverdue: newlyOverdue.length,
    overdueBacklog: Math.max(0, overdueCandidates.length - newlyOverdue.length),
    zombiesCompleted: zombieCompleted.length,
    sweepErrors,
    recipients: recipients.length,
    emailsSent: sent,
    chainScan: chainScan?.counts ?? null,
    byStatus: Object.fromEntries(
      [...byStatus.entries()].map(([s, list]) => [s, list.length])
    ),
  });
}

// Scheduled in vercel.json: { "path": "/api/cron/stalled-tickets-digest", "schedule": "12 12 * * *" } (6:12am CT).
// Tune STALL_THRESHOLD_HOURS / ZOMBIE_AGE_HOURS if 48h/24h prove too eager or too lax.
