/**
 * Stalled Tickets Daily Digest — DRAFT, NOT YET SCHEDULED
 *
 * Every morning, email Michael + Sara a summary of any delivery ticket
 * stuck in a non-terminal status for >STALL_THRESHOLD_HOURS. Catches the
 * things that fall through the cracks — would have caught today's
 * "17 tickets in created status for weeks" if it had been running.
 *
 * Trigger: GET /api/cron/stalled-tickets-digest
 * Schedule (add to vercel.json): `0 12 * * *` (6am CT = 12 UTC)
 * Auth: CRON_SECRET header (Vercel) or admin/owner session (manual run)
 *
 * Terminal statuses (NOT stalled — even if old): completed, cancelled.
 * Everything else with age > threshold counts as stalled.
 *
 * Output: groups stalled tickets by status with age, customer, job number.
 * Empty days send no email (no spam).
 */

import { NextRequest, NextResponse } from 'next/server';
import { ticketSheetService, type TicketStatus } from '@/lib/ticket-sheet-service';
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

function buildDigestHtml(byStatus: Map<TicketStatus, StalledTicket[]>): string {
  const sections: string[] = [];
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
  const stalled: StalledTicket[] = [];
  for (const t of all) {
    if (TERMINAL_STATUSES.includes(t.status)) continue;
    if (t.ticketType !== 'delivery') continue;
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

  if (stalled.length === 0) {
    return NextResponse.json({
      success: true,
      stalledCount: 0,
      emailSent: false,
      message: 'No stalled tickets. Nothing emailed.',
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

  const subject = `[RCRS] ${stalled.length} ticket${stalled.length === 1 ? '' : 's'} stalled · oldest ${ageDisplay(Math.max(...stalled.map(s => s.ageHours)))}`;
  const body = buildDigestHtml(byStatus);

  let sent = 0;
  for (const to of recipients) {
    const res = await emailService.send({ template: 'stalled-tickets-digest', to, subject, body });
    if (res.success) sent++;
  }

  return NextResponse.json({
    success: true,
    stalledCount: stalled.length,
    recipients: recipients.length,
    emailsSent: sent,
    byStatus: Object.fromEntries(
      [...byStatus.entries()].map(([s, list]) => [s, list.length])
    ),
  });
}

// ─── TODO before scheduling ──────────────────────────────────────────────
// 1. Add vercel.json crons entry:
//    { "path": "/api/cron/stalled-tickets-digest", "schedule": "0 12 * * *" }  // 6am CT
// 2. Confirm CRON_SECRET is set in Vercel env (already used by other crons)
// 3. Verify TEAM_MEMBERS in lib/team-roles has email addresses for office/admin/owner
// 4. Tune STALL_THRESHOLD_HOURS if 48h is too eager (or not eager enough)
