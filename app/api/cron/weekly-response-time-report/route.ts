// Weekly Response-Time Report
// Runs Monday 7am Central. Aggregates last 7 days of response-log data,
// sends a summary to Chris + Michael only. Gated by RESPONSE_TIME_REPORT_ENABLED
// — does not fire until that env var is set to 'true' (default OFF per
// stated rule 2026-05-21).

import { NextRequest, NextResponse } from 'next/server';
import { apiError } from '@/lib/api-response';
import { googleSheetsService } from '@/lib/google-sheets-service';
import { emailService } from '@/lib/email-service';
import { TEAM_MEMBERS } from '@/lib/team-roles';
import { withCronLock } from '@/lib/cron-lock';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

const RECIPIENTS = [
  { name: 'Chris Muse',   email: 'chrismuse@rcrsal.com' },
  { name: 'Michael Muse', email: 'michaelmuse@rcrsal.com' },
];

function verifyCronAuth(request: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return true;
  const authHeader = request.headers.get('authorization');
  return authHeader === `Bearer ${cronSecret}`;
}

function isEnabled(): boolean {
  return process.env.RESPONSE_TIME_REPORT_ENABLED === 'true';
}

interface RepStats {
  slug: string;
  name: string;
  assignments: number;
  responded: number;
  avgMinutes: number;
  medianMinutes: number;
  p95Minutes: number;
  slaBreaches: number;
}

function median(arr: number[]): number {
  if (!arr.length) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function p95(arr: number[]): number {
  if (!arr.length) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length * 0.95)] || sorted[sorted.length - 1];
}

export async function GET(request: NextRequest) {
  if (!verifyCronAuth(request)) return apiError('Unauthorized', 401);

  return withCronLock('weekly-response-time-report', { staleMinutes: 30 }, async () => {
  const _hbStart = Date.now();
  try {
    const cutoff = Date.now() - 7 * 86400000;
    const allLogs = await googleSheetsService.getLeadResponseLogs();
    const recent = allLogs.filter(l => {
      const t = new Date(l.assignedAt).getTime();
      return !isNaN(t) && t >= cutoff;
    });

    // Aggregate per rep
    const byRep = new Map<string, { responses: number[]; total: number; breaches: number }>();
    for (const log of recent) {
      const s = byRep.get(log.repSlug) || { responses: [], total: 0, breaches: 0 };
      s.total++;
      const min = parseFloat(log.responseMinutes || '');
      if (!isNaN(min) && min > 0) {
        s.responses.push(min);
        if (min > 60) s.breaches++;
      } else if (log.reassignedAt) {
        // No responseMinutes + reassigned = breach
        s.breaches++;
      }
      byRep.set(log.repSlug, s);
    }

    const stats: RepStats[] = [];
    for (const [slug, s] of byRep) {
      const member = TEAM_MEMBERS.find(m => m.slug === slug);
      const avg = s.responses.length ? s.responses.reduce((a, b) => a + b, 0) / s.responses.length : 0;
      stats.push({
        slug,
        name: member?.name || slug,
        assignments: s.total,
        responded: s.responses.length,
        avgMinutes: Math.round(avg * 10) / 10,
        medianMinutes: Math.round(median(s.responses) * 10) / 10,
        p95Minutes: Math.round(p95(s.responses) * 10) / 10,
        slaBreaches: s.breaches,
      });
    }
    stats.sort((a, b) => a.avgMinutes - b.avgMinutes);

    const totalAssignments = stats.reduce((a, s) => a + s.assignments, 0);
    const totalResponded = stats.reduce((a, s) => a + s.responded, 0);
    const totalBreaches = stats.reduce((a, s) => a + s.slaBreaches, 0);
    const teamAvg = stats.length ? stats.reduce((a, s) => a + s.avgMinutes * s.responded, 0) / Math.max(1, totalResponded) : 0;

    if (!isEnabled()) {
      // Build the report but do NOT send. Returns the computed data so
      // Michael can inspect via the API while the email gate stays OFF.
      const { recordCronHeartbeat } = await import('@/lib/cron-heartbeat');
      await recordCronHeartbeat('weekly-response-time-report', 'success', Date.now() - _hbStart, 'gated:not-sent');
      return NextResponse.json({
        success: true,
        sent: false,
        reason: 'RESPONSE_TIME_REPORT_ENABLED not true — set env to allow send',
        summary: { totalAssignments, totalResponded, totalBreaches, teamAvgMinutes: Math.round(teamAvg * 10) / 10 },
        stats,
      });
    }

    // Build HTML
    const rows = stats.map(s => `
      <tr>
        <td style="padding:6px 10px;border-bottom:1px solid #eee;">${s.name}</td>
        <td style="padding:6px 10px;border-bottom:1px solid #eee;text-align:right;">${s.assignments}</td>
        <td style="padding:6px 10px;border-bottom:1px solid #eee;text-align:right;">${s.responded}</td>
        <td style="padding:6px 10px;border-bottom:1px solid #eee;text-align:right;">${s.avgMinutes}min</td>
        <td style="padding:6px 10px;border-bottom:1px solid #eee;text-align:right;">${s.medianMinutes}min</td>
        <td style="padding:6px 10px;border-bottom:1px solid #eee;text-align:right;">${s.p95Minutes}min</td>
        <td style="padding:6px 10px;border-bottom:1px solid #eee;text-align:right;color:${s.slaBreaches > 0 ? '#c00' : '#222'};">${s.slaBreaches}</td>
      </tr>
    `).join('');

    const body = `
      <div style="font-family:Arial,sans-serif;max-width:640px;margin:0 auto;">
        <div style="background:#000;padding:16px;text-align:center;">
          <h2 style="color:#39FF14;margin:0;">Weekly Response Time Report</h2>
          <p style="color:#ccc;margin:6px 0 0;font-size:13px;">Last 7 days · ranked by avg response</p>
        </div>
        <div style="padding:20px;background:#fff;color:#222;">
          <p><strong>Team summary:</strong> ${totalAssignments} assignments, ${totalResponded} responded, ${totalBreaches} SLA breaches. Team avg response: ${Math.round(teamAvg * 10) / 10}min.</p>
          <table style="width:100%;border-collapse:collapse;margin-top:12px;font-size:13px;">
            <thead>
              <tr style="background:#f5f5f5;">
                <th style="padding:6px 10px;text-align:left;">Rep</th>
                <th style="padding:6px 10px;text-align:right;">Assigned</th>
                <th style="padding:6px 10px;text-align:right;">Responded</th>
                <th style="padding:6px 10px;text-align:right;">Avg</th>
                <th style="padding:6px 10px;text-align:right;">Median</th>
                <th style="padding:6px 10px;text-align:right;">p95</th>
                <th style="padding:6px 10px;text-align:right;">SLA Breaches</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
          <p style="color:#666;font-size:12px;margin-top:16px;">SLA breach = no first contact within 60 minutes of assignment. Generated by /api/cron/weekly-response-time-report.</p>
        </div>
      </div>
    `;

    for (const r of RECIPIENTS) {
      await emailService.send({
        template: 'response-time-report',
        to: r.email,
        subject: `Weekly Response Time Report — ${totalAssignments} assignments, ${totalBreaches} SLA breaches`,
        body,
        fromName: 'RCRS Lead Distro',
      }).catch(err => {
        console.warn(`[WeeklyRTReport] send to ${r.email} failed:`, err);
      });
    }

    const { recordCronHeartbeat } = await import('@/lib/cron-heartbeat');
    await recordCronHeartbeat('weekly-response-time-report', 'success', Date.now() - _hbStart, `sent to ${RECIPIENTS.length}`);
    return NextResponse.json({ success: true, sent: true, stats });
  } catch (err) {
    console.error('[WeeklyRTReport] Error:', err);
    try {
      const { recordCronHeartbeat } = await import('@/lib/cron-heartbeat');
      await recordCronHeartbeat('weekly-response-time-report', 'error', Date.now() - _hbStart, err instanceof Error ? err.message : String(err));
    } catch { /* heartbeat */ }
    return NextResponse.json({ success: false, error: err instanceof Error ? err.message : 'cron failed' }, { status: 500 });
  }
  });
}
