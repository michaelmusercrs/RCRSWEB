/**
 * Storm Report Email API
 *
 * POST – After a storm report is generated, sends:
 *   1. A partial/teaser report to the CUSTOMER
 *   2. The FULL report to the sales team
 */

import { NextRequest, NextResponse } from 'next/server';
import { emailService } from '@/lib/email-service';
import { TEAM_MEMBERS } from '@/lib/team-roles';
import { checkForSpam } from '@/lib/spam-filter';

// ---------------------------------------------------------------------------
// Types (mirror the page types for the report data)
// ---------------------------------------------------------------------------

interface HailEvent {
  date: string;
  size: string;
  sizeNum: number;
  severity: string;
  distance: number;
  location: string;
  county: string;
}

interface WindEvent {
  date: string;
  event: string;
  severity: string;
  description: string;
}

interface StormReportPayload {
  // Customer info
  customerName: string;
  customerEmail: string;
  customerPhone: string;

  // Assignment — optional. Set when the lead-capture page was loaded with
  // ?rep=<slug> (rep-specific landing URLs). Used to route the "full report"
  // email to the actual rep instead of falling back to SALES_TEAM_EMAIL.
  assignedRep?: string;

  // Report data
  reportId: string;
  address: string;
  fullAddress: string;
  riskLevel: string;
  riskScore: number;
  totalHailReports: number;
  largestHailSize: string | null;
  largestHailSizeNum: number;
  closestHailMiles: number | null;
  riskFactors: string[];
  recommendation: string;
  hailEvents: HailEvent[];
  windEvents: WindEvent[];
  hailReconTotalStorms?: number;
  hailReconLargestSizeLabel?: string;
  dateRangeStart: string;
  dateRangeEnd: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const COMPANY_NAME = 'River City Roofing Solutions';
const COMPANY_PHONE = '256-274-8530';
const COMPANY_URL = 'https://www.rivercityroofingsolutions.com';
const SALES_TEAM_EMAIL = process.env.SALES_TEAM_EMAIL || 'michaelmuse@rcrsal.com';

function riskColor(level: string): string {
  switch (level) {
    case 'Severe': return '#dc2626';
    case 'High': return '#f97316';
    case 'Moderate': return '#eab308';
    default: return '#22c55e';
  }
}

// ---------------------------------------------------------------------------
// Customer email – partial/teaser report
// ---------------------------------------------------------------------------

function buildCustomerEmailHtml(data: StormReportPayload): string {
  const color = riskColor(data.riskLevel);
  const topFactors = data.riskFactors.slice(0, 3);

  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#111;font-family:Arial,Helvetica,sans-serif;color:#e5e5e5;">
  <div style="max-width:600px;margin:0 auto;padding:20px;">

    <!-- Header -->
    <div style="text-align:center;padding:24px 0;border-bottom:1px solid #333;">
      <h1 style="margin:0;font-size:22px;letter-spacing:2px;text-transform:uppercase;color:#84cc16;">
        ${COMPANY_NAME}
      </h1>
      <p style="margin:4px 0 0;font-size:12px;color:#888;letter-spacing:1px;">STORM DAMAGE RISK REPORT</p>
    </div>

    <!-- Risk Banner -->
    <div style="background:${color};padding:28px 20px;text-align:center;margin:20px 0;border-radius:12px;">
      <p style="margin:0 0 4px;font-size:12px;color:rgba(255,255,255,0.8);text-transform:uppercase;letter-spacing:2px;">
        Storm Damage Risk Level
      </p>
      <h2 style="margin:0;font-size:36px;font-weight:900;color:#fff;text-transform:uppercase;letter-spacing:3px;">
        ${data.riskLevel}
      </h2>
      <p style="margin:8px 0 0;font-size:14px;color:rgba(255,255,255,0.7);">
        Risk Score: <strong style="color:#fff;">${data.riskScore}/100</strong>
      </p>
    </div>

    <!-- Address -->
    <p style="color:#aaa;font-size:13px;text-align:center;margin:0 0 20px;">
      Report for: <strong style="color:#fff;">${data.fullAddress}</strong><br/>
      Report ID: ${data.reportId}
    </p>

    <!-- Key Stats -->
    <table style="width:100%;border-collapse:collapse;margin:0 0 20px;" cellpadding="0" cellspacing="0">
      <tr>
        <td style="width:33%;text-align:center;padding:16px 8px;background:#1a1a1a;border-radius:8px 0 0 8px;">
          <div style="font-size:24px;font-weight:900;color:#fff;">${data.totalHailReports}</div>
          <div style="font-size:10px;color:#888;text-transform:uppercase;letter-spacing:1px;margin-top:4px;">Hail Reports</div>
        </td>
        <td style="width:33%;text-align:center;padding:16px 8px;background:#1a1a1a;border-left:1px solid #333;border-right:1px solid #333;">
          <div style="font-size:24px;font-weight:900;color:#fff;">${data.largestHailSize || 'N/A'}</div>
          <div style="font-size:10px;color:#888;text-transform:uppercase;letter-spacing:1px;margin-top:4px;">Largest Hail</div>
        </td>
        <td style="width:33%;text-align:center;padding:16px 8px;background:#1a1a1a;border-radius:0 8px 8px 0;">
          <div style="font-size:24px;font-weight:900;color:#fff;">${data.closestHailMiles !== null ? data.closestHailMiles.toFixed(1) + ' mi' : 'N/A'}</div>
          <div style="font-size:10px;color:#888;text-transform:uppercase;letter-spacing:1px;margin-top:4px;">Closest Hail</div>
        </td>
      </tr>
    </table>

    <!-- Top Risk Factors -->
    <div style="background:#1a1a1a;border:1px solid #333;border-radius:12px;padding:20px;margin:0 0 20px;">
      <h3 style="margin:0 0 12px;font-size:14px;color:#84cc16;text-transform:uppercase;letter-spacing:2px;">
        Top Risk Factors
      </h3>
      ${topFactors.map(f => `
        <div style="display:flex;align-items:flex-start;margin:0 0 10px;">
          <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${color};margin:6px 10px 0 0;flex-shrink:0;"></span>
          <span style="font-size:13px;color:#ccc;">${f}</span>
        </div>
      `).join('')}
    </div>

    <!-- CTA -->
    <div style="background:#1a1a1a;border:2px solid #84cc16;border-radius:12px;padding:24px;text-align:center;margin:0 0 20px;">
      <h3 style="margin:0 0 8px;font-size:18px;color:#fff;text-transform:uppercase;letter-spacing:2px;">
        Schedule Your Free Inspection
      </h3>
      <p style="margin:0 0 16px;font-size:13px;color:#aaa;">
        For your complete storm damage assessment, contact our certified inspectors.
      </p>
      <a href="tel:${COMPANY_PHONE}" style="display:inline-block;background:#84cc16;color:#000;font-weight:900;font-size:16px;text-decoration:none;padding:14px 32px;border-radius:8px;text-transform:uppercase;letter-spacing:2px;">
        Call ${COMPANY_PHONE}
      </a>
      <p style="margin:12px 0 0;">
        <a href="${COMPANY_URL}/contact" style="color:#84cc16;font-size:13px;text-decoration:underline;">Or request online &rarr;</a>
      </p>
    </div>

    <!-- Footer -->
    <div style="text-align:center;padding:20px 0;border-top:1px solid #333;">
      <p style="margin:0;font-size:12px;color:#666;">
        ${COMPANY_NAME} &bull; Hartselle, AL &bull; <a href="tel:${COMPANY_PHONE}" style="color:#84cc16;text-decoration:none;">${COMPANY_PHONE}</a>
      </p>
      <p style="margin:8px 0 0;font-size:11px;color:#555;">
        This report was generated based on publicly available NWS data and is for informational purposes only.
      </p>
    </div>

  </div>
</body>
</html>`;
}

// ---------------------------------------------------------------------------
// Sales team email – FULL report
// ---------------------------------------------------------------------------

function buildSalesEmailHtml(data: StormReportPayload): string {
  const color = riskColor(data.riskLevel);

  const hailRows = data.hailEvents.slice(0, 20).map(e => `
    <tr style="border-bottom:1px solid #333;">
      <td style="padding:8px;font-size:12px;color:#ccc;">${new Date(e.date).toLocaleDateString()}</td>
      <td style="padding:8px;font-size:12px;color:#fff;font-weight:bold;">${e.size}</td>
      <td style="padding:8px;font-size:12px;color:#ccc;">${e.distance.toFixed(1)} mi</td>
      <td style="padding:8px;font-size:12px;color:#ccc;">${e.location || 'N/A'}</td>
      <td style="padding:8px;font-size:12px;color:${e.severity === 'severe' ? '#ef4444' : e.severity === 'moderate' ? '#f97316' : '#eab308'};">${e.severity}</td>
    </tr>
  `).join('');

  const windRows = data.windEvents.slice(0, 10).map(e => `
    <tr style="border-bottom:1px solid #333;">
      <td style="padding:8px;font-size:12px;color:#ccc;">${new Date(e.date).toLocaleDateString()}</td>
      <td style="padding:8px;font-size:12px;color:#ccc;">${e.event}</td>
      <td style="padding:8px;font-size:12px;color:#ccc;">${e.description}</td>
    </tr>
  `).join('');

  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#111;font-family:Arial,Helvetica,sans-serif;color:#e5e5e5;">
  <div style="max-width:700px;margin:0 auto;padding:20px;">

    <!-- Header -->
    <div style="background:${color};padding:16px 20px;border-radius:8px 8px 0 0;">
      <h1 style="margin:0;font-size:18px;color:#fff;text-transform:uppercase;letter-spacing:2px;">
        🔔 New Storm Report Lead – ${data.riskLevel} Risk
      </h1>
    </div>

    <!-- Customer Info -->
    <div style="background:#1a1a1a;border:1px solid #333;border-top:none;padding:20px;border-radius:0 0 8px 8px;margin:0 0 20px;">
      <h3 style="margin:0 0 12px;font-size:14px;color:#84cc16;text-transform:uppercase;letter-spacing:1px;">Customer Contact</h3>
      <table cellpadding="0" cellspacing="0" style="width:100%;">
        <tr><td style="padding:4px 0;font-size:13px;color:#888;width:80px;">Name:</td><td style="padding:4px 0;font-size:13px;color:#fff;font-weight:bold;">${data.customerName}</td></tr>
        <tr><td style="padding:4px 0;font-size:13px;color:#888;">Email:</td><td style="padding:4px 0;font-size:13px;"><a href="mailto:${data.customerEmail}" style="color:#84cc16;">${data.customerEmail}</a></td></tr>
        <tr><td style="padding:4px 0;font-size:13px;color:#888;">Phone:</td><td style="padding:4px 0;font-size:13px;"><a href="tel:${data.customerPhone}" style="color:#84cc16;">${data.customerPhone}</a></td></tr>
        <tr><td style="padding:4px 0;font-size:13px;color:#888;">Address:</td><td style="padding:4px 0;font-size:13px;color:#fff;">${data.fullAddress}</td></tr>
      </table>
    </div>

    <!-- Risk Summary -->
    <div style="background:#1a1a1a;border:1px solid #333;border-radius:8px;padding:20px;margin:0 0 20px;">
      <h3 style="margin:0 0 12px;font-size:14px;color:#84cc16;text-transform:uppercase;letter-spacing:1px;">Risk Assessment</h3>
      <p style="margin:0;font-size:14px;color:#fff;">
        <strong>Risk Level:</strong> <span style="color:${color};font-weight:900;font-size:18px;">${data.riskLevel}</span>
        &nbsp;&bull;&nbsp; <strong>Score:</strong> ${data.riskScore}/100
        &nbsp;&bull;&nbsp; <strong>Hail Reports:</strong> ${data.totalHailReports}
        &nbsp;&bull;&nbsp; <strong>Largest:</strong> ${data.largestHailSize || 'N/A'}
      </p>
      <p style="margin:8px 0 0;font-size:12px;color:#aaa;">
        Report ID: ${data.reportId} &bull; Period: ${data.dateRangeStart} to ${data.dateRangeEnd}
      </p>
    </div>

    <!-- Risk Factors -->
    <div style="background:#1a1a1a;border:1px solid #333;border-radius:8px;padding:20px;margin:0 0 20px;">
      <h3 style="margin:0 0 12px;font-size:14px;color:#84cc16;text-transform:uppercase;letter-spacing:1px;">All Risk Factors</h3>
      ${data.riskFactors.map(f => `<p style="margin:0 0 6px;font-size:13px;color:#ccc;">• ${f}</p>`).join('')}
    </div>

    <!-- Recommendation -->
    <div style="background:#1a1a1a;border:1px solid #333;border-radius:8px;padding:20px;margin:0 0 20px;">
      <h3 style="margin:0 0 8px;font-size:14px;color:#84cc16;text-transform:uppercase;letter-spacing:1px;">Recommendation</h3>
      <p style="margin:0;font-size:13px;color:#ccc;line-height:1.6;">${data.recommendation}</p>
    </div>

    <!-- Hail Events Table -->
    ${data.hailEvents.length > 0 ? `
    <div style="background:#1a1a1a;border:1px solid #333;border-radius:8px;padding:20px;margin:0 0 20px;overflow-x:auto;">
      <h3 style="margin:0 0 12px;font-size:14px;color:#84cc16;text-transform:uppercase;letter-spacing:1px;">
        Hail Events (${data.hailEvents.length} total)
      </h3>
      <table cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;">
        <tr style="border-bottom:2px solid #444;">
          <th style="padding:8px;text-align:left;font-size:11px;color:#888;text-transform:uppercase;">Date</th>
          <th style="padding:8px;text-align:left;font-size:11px;color:#888;text-transform:uppercase;">Size</th>
          <th style="padding:8px;text-align:left;font-size:11px;color:#888;text-transform:uppercase;">Dist</th>
          <th style="padding:8px;text-align:left;font-size:11px;color:#888;text-transform:uppercase;">Location</th>
          <th style="padding:8px;text-align:left;font-size:11px;color:#888;text-transform:uppercase;">Severity</th>
        </tr>
        ${hailRows}
      </table>
    </div>` : ''}

    <!-- Wind Events -->
    ${data.windEvents.length > 0 ? `
    <div style="background:#1a1a1a;border:1px solid #333;border-radius:8px;padding:20px;margin:0 0 20px;overflow-x:auto;">
      <h3 style="margin:0 0 12px;font-size:14px;color:#84cc16;text-transform:uppercase;letter-spacing:1px;">
        Wind Events (${data.windEvents.length} total)
      </h3>
      <table cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;">
        <tr style="border-bottom:2px solid #444;">
          <th style="padding:8px;text-align:left;font-size:11px;color:#888;text-transform:uppercase;">Date</th>
          <th style="padding:8px;text-align:left;font-size:11px;color:#888;text-transform:uppercase;">Event</th>
          <th style="padding:8px;text-align:left;font-size:11px;color:#888;text-transform:uppercase;">Details</th>
        </tr>
        ${windRows}
      </table>
    </div>` : ''}

    <!-- HailRecon -->
    ${data.hailReconTotalStorms && data.hailReconTotalStorms > 0 ? `
    <div style="background:#1a1a1a;border:1px solid #333;border-radius:8px;padding:16px 20px;margin:0 0 20px;">
      <p style="margin:0;font-size:13px;color:#aaa;">
        <strong style="color:#84cc16;">HailRecon Historical:</strong>
        ${data.hailReconTotalStorms} storms since 2011 &bull; Largest: ${data.hailReconLargestSizeLabel || 'N/A'}
      </p>
    </div>` : ''}

    <!-- Footer -->
    <div style="text-align:center;padding:16px 0;border-top:1px solid #333;">
      <p style="margin:0;font-size:11px;color:#555;">
        Auto-generated by ${COMPANY_NAME} Storm Report System
      </p>
    </div>

  </div>
</body>
</html>`;
}

// ---------------------------------------------------------------------------
// POST handler
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  try {
    const data: StormReportPayload = await request.json();

    // Validate minimum fields
    if (!data.customerEmail || !data.reportId || !data.riskLevel) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 },
      );
    }

    // Spam filter — drop bot/outreach submissions BEFORE we email the
    // (potentially fake) customer or alert the sales team. Return a normal-
    // looking success so bots don't learn they were blocked.
    {
      const spamCheck = await checkForSpam({
        name: data.customerName || '',
        email: data.customerEmail,
        phone: data.customerPhone,
        address: data.fullAddress || data.address,
      });
      if (spamCheck.isSpam) {
        console.warn('[STORM REPORT SPAM BLOCKED]', {
          email: data.customerEmail, score: spamCheck.spamScore, reasons: spamCheck.reasons,
        });
        return NextResponse.json({
          success: true,
          customerEmail: true,
          salesEmail: true,
          errors: { customer: undefined, sales: undefined },
        });
      }
    }

    // Resolve the sales rep recipient. Per owner directive "reminders to
    // sales reps should go to the sales rep, not the comp email":
    //   1. If the lead-capture page passed `assignedRep` (from ?rep=<slug>),
    //      look the rep up in team-roles and email them directly.
    //   2. Otherwise fall back to SALES_TEAM_EMAIL (last resort) and log a
    //      warning so we know it happened.
    let salesRecipient = SALES_TEAM_EMAIL;
    if (data.assignedRep) {
      const slug = data.assignedRep.toLowerCase().trim();
      const rep = TEAM_MEMBERS.find(
        m => m.isActive && (m.slug === slug || m.email.toLowerCase().startsWith(`${slug}@`))
      );
      if (rep?.email) {
        salesRecipient = rep.email;
      } else {
        console.warn(
          `[storm-report/email] assignedRep="${data.assignedRep}" did not resolve to a team member — falling back to SALES_TEAM_EMAIL (${SALES_TEAM_EMAIL})`
        );
      }
    } else {
      console.warn(
        `[storm-report/email] No assignedRep on payload for ${data.reportId} — falling back to SALES_TEAM_EMAIL (${SALES_TEAM_EMAIL})`
      );
    }

    // Fire both emails in parallel via Google Apps Script
    const [customerResult, salesResult] = await Promise.allSettled([
      // 1. Customer partial report
      emailService.send({
        to: data.customerEmail,
        subject: `Your Storm Damage Risk Report – ${data.riskLevel} Risk | ${COMPANY_NAME}`,
        body: buildCustomerEmailHtml(data),
        fromName: COMPANY_NAME,
      }),

      // 2. Sales team full report — routed to assigned rep when known.
      emailService.send({
        to: salesRecipient,
        subject: `New Storm Report Lead - ${data.riskLevel} - ${data.fullAddress}`,
        body: buildSalesEmailHtml(data),
        replyTo: data.customerEmail,
        fromName: 'RCRS Storm Reports',
      }),
    ]);

    const customerOk = customerResult.status === 'fulfilled' && customerResult.value.success;
    const salesOk = salesResult.status === 'fulfilled' && salesResult.value.success;

    return NextResponse.json({
      success: true,
      customerEmail: customerOk,
      salesEmail: salesOk,
      errors: {
        customer: !customerOk
          ? (customerResult.status === 'fulfilled' ? customerResult.value.error : (customerResult as PromiseRejectedResult).reason?.message)
          : undefined,
        sales: !salesOk
          ? (salesResult.status === 'fulfilled' ? salesResult.value.error : (salesResult as PromiseRejectedResult).reason?.message)
          : undefined,
      },
    });
  } catch (err) {
    console.error('[storm-report/email] Error:', err);
    return NextResponse.json(
      { success: false, error: 'Failed to send emails' },
      { status: 500 },
    );
  }
}
