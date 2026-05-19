/**
 * Predictive Stock Cron
 *
 * Runs daily (configured in vercel.json: "0 6 * * *" = 6 AM UTC / 1 AM CT,
 * but Vercel cron runs at UTC and we just want a once-a-day pre-business-hours
 * check). Pulls JN signed jobs, generates a 14-day material consumption
 * forecast, then fires ntfy + email alerts for any projected shortfalls.
 *
 * Trigger: GET /api/cron/predictive-stock
 * Auth: Vercel cron header (Bearer ${CRON_SECRET}) OR admin/owner session
 */

import { NextRequest, NextResponse } from 'next/server';
import { predictiveStockService, type MaterialForecastLine } from '@/lib/predictive-stock-service';
import { ntfyService } from '@/lib/ntfy-service';
import { emailService } from '@/lib/email-service';
import { TEAM_MEMBERS } from '@/lib/team-roles';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

const CRON_SECRET = process.env.CRON_SECRET;

export async function GET(request: NextRequest) {
  // Auth: either Vercel cron header or admin/owner session
  const authHeader = request.headers.get('authorization') || '';
  const isVercelCron = CRON_SECRET && authHeader === `Bearer ${CRON_SECRET}`;

  if (!isVercelCron) {
    const { requireAuth } = await import('@/lib/auth-service');
    const auth = await requireAuth();
    if (!auth.authenticated) return auth.response;
    if (!['admin', 'owner'].includes(auth.user.role)) {
      return NextResponse.json(
        { error: 'CRON_SECRET header or admin/owner role required' },
        { status: 403 },
      );
    }
  }

  const _hbStart = Date.now();

  try {
    const forecast = await predictiveStockService.generateForecast();

    if (forecast.shortfalls.length === 0) {
      try {
        const { recordCronHeartbeat } = await import('@/lib/cron-heartbeat');
        await recordCronHeartbeat(
          'predictive-stock',
          'success',
          Date.now() - _hbStart,
          `${forecast.jobCount} jobs, no shortfalls projected`,
        );
      } catch { /* heartbeat best-effort */ }

      return NextResponse.json({
        success: true,
        jobCount: forecast.jobCount,
        shortfallCount: 0,
        stormBufferApplied: forecast.stormBufferApplied,
        message: 'No projected shortfalls — nothing to alert',
      });
    }

    // ntfy push (free, OSS). Fanout to office + admin so both surface it.
    const topShortfalls = forecast.shortfalls.slice(0, 5);
    const ntfyTitle = `Inventory at risk: ${forecast.shortfalls.length} item${forecast.shortfalls.length === 1 ? '' : 's'} projected short`;
    const ntfyBody = [
      `Next ${forecast.horizonDays}d: ${forecast.jobCount} scheduled job${forecast.jobCount === 1 ? '' : 's'}.`,
      forecast.stormBufferApplied
        ? `Storm buffer ON (${forecast.stormReason || 'severe weather forecast'}).`
        : 'No storm buffer applied.',
      '',
      ...topShortfalls.map(s =>
        `- ${s.productName}: need ${s.projectedUsage.toFixed(1)} ${s.unit}, have ${s.availableQty.toFixed(1)} → PO ${s.suggestedPoQty} ${s.unit}`,
      ),
      forecast.shortfalls.length > topShortfalls.length
        ? `(+${forecast.shortfalls.length - topShortfalls.length} more)`
        : '',
    ].filter(Boolean).join('\n');

    const ntfyResults = await ntfyService.sendToRoles(['office', 'admin'], {
      title: ntfyTitle,
      message: ntfyBody,
      priority: 'high',
      tags: ['package', 'warning'],
      clickUrl: 'https://rcrsal.com/portal/inventory/forecast',
    });

    // Email fallback to office/admin if email is configured. Push is preferred,
    // email is the backstop so nobody misses the alert.
    let emailsSent = 0;
    const emailFailures: string[] = [];
    if (emailService.isConfigured()) {
      const recipients = TEAM_MEMBERS
        .filter(m => m.isActive && ['office', 'admin', 'owner'].includes(m.role))
        .map(m => m.email)
        .filter(Boolean);

      const subject = `[RCRS Forecast] ${forecast.shortfalls.length} item${forecast.shortfalls.length === 1 ? '' : 's'} projected short in next ${forecast.horizonDays} days`;
      const body = buildForecastEmail(forecast.jobCount, forecast.stormBufferApplied, forecast.stormReason, forecast.shortfalls);

      const results = await Promise.allSettled(
        recipients.map(to => emailService.send({ to, subject, body, fromName: 'RCRS Forecast' })),
      );
      for (let i = 0; i < results.length; i++) {
        const r = results[i];
        if (r.status === 'fulfilled') emailsSent++;
        else emailFailures.push(`${recipients[i]}: ${r.reason}`);
      }
    }

    try {
      const { recordCronHeartbeat } = await import('@/lib/cron-heartbeat');
      await recordCronHeartbeat(
        'predictive-stock',
        'success',
        Date.now() - _hbStart,
        `${forecast.shortfalls.length} shortfalls, ${emailsSent} emails`,
      );
    } catch { /* heartbeat best-effort */ }

    return NextResponse.json({
      success: true,
      runAt: new Date().toISOString(),
      jobCount: forecast.jobCount,
      shortfallCount: forecast.shortfalls.length,
      stormBufferApplied: forecast.stormBufferApplied,
      stormReason: forecast.stormReason,
      pushed: ntfyResults,
      emailsSent,
      emailFailures: emailFailures.length > 0 ? emailFailures : undefined,
      topShortfalls: topShortfalls.map(s => ({
        productId: s.productId,
        productName: s.productName,
        availableQty: s.availableQty,
        projectedUsage: s.projectedUsage,
        suggestedPoQty: s.suggestedPoQty,
      })),
    });
  } catch (error) {
    console.error('[predictive-stock] cron failed:', error);
    try {
      const { recordCronHeartbeat } = await import('@/lib/cron-heartbeat');
      await recordCronHeartbeat(
        'predictive-stock',
        'error',
        Date.now() - _hbStart,
        error instanceof Error ? error.message : String(error),
      );
    } catch { /* heartbeat must not mask real error */ }

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Cron failed',
      },
      { status: 500 },
    );
  }
}

function buildForecastEmail(
  jobCount: number,
  stormBufferApplied: boolean,
  stormReason: string | undefined,
  shortfalls: MaterialForecastLine[],
): string {
  const rows = shortfalls
    .map(
      s => `
        <tr>
          <td style="padding:8px;border-bottom:1px solid #eee;">
            <strong>${escapeHtml(s.productName)}</strong><br/>
            <span style="font-size:11px;color:#666;">${escapeHtml(s.category)}</span>
          </td>
          <td style="padding:8px;border-bottom:1px solid #eee;text-align:right;">
            ${s.availableQty.toFixed(1)} ${escapeHtml(s.unit)}
          </td>
          <td style="padding:8px;border-bottom:1px solid #eee;text-align:right;color:#dc2626;font-weight:bold;">
            ${s.projectedUsage.toFixed(1)} ${escapeHtml(s.unit)}
          </td>
          <td style="padding:8px;border-bottom:1px solid #eee;text-align:right;font-weight:bold;color:#ea580c;">
            ${s.suggestedPoQty} ${escapeHtml(s.unit)}
          </td>
        </tr>`,
    )
    .join('');

  return `
    <div style="font-family:-apple-system,BlinkMacSystemFont,sans-serif;max-width:720px;margin:0 auto;background:#fff;">
      <div style="background:#000;padding:24px;text-align:center;">
        <h2 style="color:#39FF14;margin:0;font-size:22px;">14-Day Stock Forecast</h2>
        <p style="color:#aaa;margin:8px 0 0;font-size:14px;">${shortfalls.length} item${shortfalls.length === 1 ? '' : 's'} projected short · ${jobCount} signed job${jobCount === 1 ? '' : 's'} scheduled</p>
      </div>
      <div style="padding:24px;">
        ${stormBufferApplied
          ? `<div style="background:#fff7ed;padding:12px;border-radius:8px;border-left:4px solid #ea580c;margin-bottom:16px;">
              <strong style="color:#ea580c;">Storm buffer applied (+30%)</strong><br/>
              <span style="font-size:13px;color:#555;">${escapeHtml(stormReason || 'severe weather forecast for service area')}</span>
            </div>`
          : ''}
        <table style="width:100%;border-collapse:collapse;font-size:13px;">
          <thead>
            <tr style="background:#f5f5f5;">
              <th style="padding:10px;text-align:left;">Item</th>
              <th style="padding:10px;text-align:right;">On hand</th>
              <th style="padding:10px;text-align:right;">Projected use</th>
              <th style="padding:10px;text-align:right;">Suggested PO</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
        <div style="text-align:center;margin-top:20px;">
          <a href="https://rcrsal.com/portal/inventory/forecast" style="display:inline-block;background:#39FF14;color:#000;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold;">
            Open Forecast →
          </a>
        </div>
        <p style="text-align:center;color:#999;font-size:11px;margin-top:24px;">
          Daily forecast based on signed JobNimbus jobs + NWS weather. Estimates only — refine before ordering.
        </p>
      </div>
    </div>
  `;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
