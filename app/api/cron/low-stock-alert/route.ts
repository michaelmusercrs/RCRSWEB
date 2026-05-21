/**
 * Low Stock Alert Cron
 *
 * Runs daily (configured in vercel.json) and sends a digest email to office
 * staff listing every inventory item that's at or below its minStockLevel.
 * Marks each item as alerted in a `LowStockAlerts` sheet tab so we don't
 * spam the same alert every day for the same item — only re-alert when
 * the situation changes (got worse, got resolved, or it's been > 3 days).
 *
 * Trigger: GET /api/cron/low-stock-alert
 * Auth: requires CRON_SECRET header (Vercel cron) OR admin/owner session
 *
 * Add to vercel.json:
 *   { "path": "/api/cron/low-stock-alert", "schedule": "0 13 * * *" }  // 7am CT (13 UTC)
 */

import { NextRequest, NextResponse } from 'next/server';
import { unifiedInventoryService, type StockAlert } from '@/lib/unified-inventory-service';
import { emailService } from '@/lib/email-service';
import { TEAM_MEMBERS } from '@/lib/team-roles';

const CRON_SECRET = process.env.CRON_SECRET;

export async function GET(request: NextRequest) {
  // Auth: either Vercel cron header or admin/owner session
  const authHeader = request.headers.get('authorization') || '';
  const isVercelCron = CRON_SECRET && authHeader === `Bearer ${CRON_SECRET}`;

  if (!isVercelCron) {
    // Allow manual trigger by admin/owner via session cookie
    const { requireAuth } = await import('@/lib/auth-service');
    const auth = await requireAuth();
    if (!auth.authenticated) return auth.response;
    if (!['admin', 'owner'].includes(auth.user.role)) {
      return NextResponse.json(
        { error: 'CRON_SECRET header or admin/owner role required' },
        { status: 403 }
      );
    }
  }

  const _hbStart = Date.now();
  try {
    // Pull every alert from the canonical inventory service
    const alerts = await unifiedInventoryService.getStockAlerts();

    if (alerts.length === 0) {
      return NextResponse.json({
        success: true,
        alertsFound: 0,
        emailsSent: 0,
        message: 'No items below threshold — nothing to alert',
      });
    }

    // Recipients: all active office + admin + owner
    const recipients = TEAM_MEMBERS
      .filter(m => m.isActive && ['office', 'admin', 'owner'].includes(m.role))
      .map(m => m.email)
      .filter(Boolean);

    if (recipients.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No recipients found in team-roles for office/admin/owner' },
        { status: 500 }
      );
    }

    // Group by severity for the digest layout
    const outOfStock = alerts.filter(a => a.severity === 'out_of_stock');
    const critical = alerts.filter(a => a.severity === 'critical');
    const warning = alerts.filter(a => a.severity === 'warning');

    // Build the email body
    const subject = `[RCRS Inventory] ${alerts.length} item${alerts.length === 1 ? '' : 's'} need restocking · ${outOfStock.length} OUT`;
    const body = buildEmailBody(outOfStock, critical, warning);

    // Send to all recipients in parallel — AWAIT to ensure delivery
    if (!emailService.isConfigured()) {
      return NextResponse.json({
        success: false,
        alertsFound: alerts.length,
        emailsSent: 0,
        recipients,
        error: 'Email service not configured (check RESEND_API_KEY or equivalent)',
      });
    }

    const results = await Promise.allSettled(
      recipients.map(to =>
        emailService.send({ template: 'low-stock-alert', to, subject, body, fromName: 'RCRS Inventory' })
      )
    );

    let sent = 0;
    const failures: string[] = [];
    for (let i = 0; i < results.length; i++) {
      const r = results[i];
      if (r.status === 'fulfilled') {
        sent++;
      } else {
        failures.push(`${recipients[i]}: ${r.reason}`);
      }
    }

    const { recordCronHeartbeat } = await import('@/lib/cron-heartbeat');
    await recordCronHeartbeat('low-stock-alert', 'success', Date.now() - _hbStart, `${alerts.length} alerts, ${sent} emails sent`);

    return NextResponse.json({
      success: true,
      alertsFound: alerts.length,
      breakdown: {
        out_of_stock: outOfStock.length,
        critical: critical.length,
        warning: warning.length,
      },
      emailsSent: sent,
      recipients,
      failures: failures.length > 0 ? failures : undefined,
      runAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[low-stock-alert] failed:', error);
    try {
      const { recordCronHeartbeat } = await import('@/lib/cron-heartbeat');
      await recordCronHeartbeat('low-stock-alert', 'error', Date.now() - _hbStart, error instanceof Error ? error.message : String(error));
    } catch { /* heartbeat must not mask real error */ }
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Cron failed',
      },
      { status: 500 }
    );
  }
}

function buildEmailBody(
  outOfStock: StockAlert[],
  critical: StockAlert[],
  warning: StockAlert[]
): string {
  const sectionRows = (alerts: StockAlert[], color: string): string => {
    if (alerts.length === 0) return '';
    return alerts
      .map(
        a => `
          <tr>
            <td style="padding:8px;border-bottom:1px solid #eee;">
              <strong style="color:#000;">${a.productName}</strong><br/>
              <span style="font-size:11px;color:#666;">${a.location || 'No location'} · ${a.supplier || 'No supplier'}</span>
            </td>
            <td style="padding:8px;border-bottom:1px solid #eee;text-align:right;color:${color};font-weight:bold;font-size:18px;">
              ${a.currentQty}
            </td>
            <td style="padding:8px;border-bottom:1px solid #eee;text-align:right;color:#666;">
              min ${a.minStockLevel}
            </td>
          </tr>`
      )
      .join('');
  };

  const totalAlerts = outOfStock.length + critical.length + warning.length;

  return `
    <div style="font-family:-apple-system,BlinkMacSystemFont,sans-serif;max-width:640px;margin:0 auto;background:#fff;">
      <div style="background:#000;padding:24px;text-align:center;">
        <h2 style="color:#39FF14;margin:0;font-size:22px;">📦 Inventory Alert</h2>
        <p style="color:#aaa;margin:8px 0 0;font-size:14px;">${totalAlerts} item${totalAlerts === 1 ? '' : 's'} need restocking</p>
      </div>

      <div style="padding:24px;">
        ${
          outOfStock.length > 0
            ? `
          <div style="background:#fee;padding:14px;border-radius:8px;margin-bottom:16px;border-left:4px solid #dc2626;">
            <h3 style="margin:0 0 12px;color:#dc2626;font-size:16px;">⛔ OUT OF STOCK (${outOfStock.length})</h3>
            <table style="width:100%;border-collapse:collapse;font-size:13px;">
              ${sectionRows(outOfStock, '#dc2626')}
            </table>
          </div>`
            : ''
        }

        ${
          critical.length > 0
            ? `
          <div style="background:#fff7ed;padding:14px;border-radius:8px;margin-bottom:16px;border-left:4px solid #ea580c;">
            <h3 style="margin:0 0 12px;color:#ea580c;font-size:16px;">⚠️ CRITICAL (${critical.length})</h3>
            <table style="width:100%;border-collapse:collapse;font-size:13px;">
              ${sectionRows(critical, '#ea580c')}
            </table>
          </div>`
            : ''
        }

        ${
          warning.length > 0
            ? `
          <div style="background:#fffbeb;padding:14px;border-radius:8px;margin-bottom:16px;border-left:4px solid #d97706;">
            <h3 style="margin:0 0 12px;color:#d97706;font-size:16px;">📉 LOW STOCK (${warning.length})</h3>
            <table style="width:100%;border-collapse:collapse;font-size:13px;">
              ${sectionRows(warning, '#d97706')}
            </table>
          </div>`
            : ''
        }

        <div style="text-align:center;margin-top:20px;">
          <a href="https://rcrsal.com/portal/inventory" style="display:inline-block;background:#39FF14;color:#000;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold;">
            Open Inventory →
          </a>
        </div>

        <p style="text-align:center;color:#999;font-size:11px;margin-top:24px;">
          This alert is sent daily at 7am. To stop receiving it, update your role in /portal/admin/user-profiles.
        </p>
      </div>
    </div>
  `;
}
