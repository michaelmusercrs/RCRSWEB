// Email Service - Transactional email via Resend.
//
// Migrated 2026-05-20 off the legacy Google Apps Script transport which
// server-side amplified every send to the owner gmail as a malformed
// "NEW CONTACT FORM SUBMISSION" template. Full incident at
// project_rcrs_email_flood_safeguard memory + docs/email-callsite-audit.md.
//
// Two gates control whether a call actually fires:
//   1. Template allowlist  - only tagged templates in the allowlist fire.
//      Default allowlist: contact-form, load-verified-invoice,
//      driver-new-order. Override via ALLOWED_EMAIL_TEMPLATES env (csv).
//      Untagged sends (legacy callsites without a `template` field) drop.
//   2. Transport config    - if RESEND_API_KEY / EMAIL_FROM are unset,
//      sends drop with a clear log line.
//
// Env vars:
//   RESEND_API_KEY                  - Resend account key (required to send)
//   EMAIL_FROM                      - sender address (e.g. notifications@rivercityroofingsolutions.com)
//   EMAIL_FROM_NAME                 - optional friendly name (default "River City Roofing Solutions")
//   ALLOWED_EMAIL_TEMPLATES         - optional csv override of allowlist
//   EMAIL_CAP_PER_HOUR / *_PER_DAY  - optional per-recipient rate caps
//   EMAIL_CAP_OWNER_PER_HOUR / DAY  - tighter caps on owner gmail
//   SANDBOX_MODE=true               - log instead of sending
//   EMAIL_KILL_SWITCH=true          - legacy env kill (still honored)
//   CUSTOMER_EMAIL_ENABLED=true     - explicit opt-in for customer-facing
//                                     templates. DEFAULT is BLOCKED. Per
//                                     stated rule (2026-05-21): no customer
//                                     emails fire until Michael approves
//                                     after thorough testing. Internal team
//                                     emails are not affected.

import { Resend } from 'resend';
import {
  renderLoadVerifiedInvoiceEmail,
  loadVerifiedInvoiceSubject,
} from './email-templates/load-verified-invoice';
import { renderLoadVerifiedInvoicePDF } from './email-templates/load-verified-invoice-pdf';
import {
  renderDriverNewOrderEmail,
  driverNewOrderSubject,
} from './email-templates/driver-new-order';
import { logEmailAttempt } from './email-log';

export type EmailTemplate =
  | 'contact-form'
  | 'load-verified-invoice'
  | 'driver-new-order'
  | 'portal-link'
  | 'lead-assignment'
  | 'delivery-order'
  | 'office-material-order'
  | 'vendor-return'
  | 'delivery-reminder'
  // 2026-05-20 H1 verification-pass fix: tagged ad-hoc callsites so the
  // allowlist can re-enable them independently. See docs/email-callsite-audit.md.
  | 'login-alert'
  | 'job-status-update'
  | 'breakdown-draft'
  | 'notification-dispatch'
  | 'review-request'
  | 'careers-application'
  | 'work-order'
  | 'storm-report-customer'
  | 'storm-report-sales'
  | 'weekly-numbers-reminder'
  | 'stalled-tickets-digest'
  | 'material-order-parse-failure'
  | 'low-stock-alert'
  | 'profile-edit-request'
  | 'vendor-alert'
  | 'weekly-numbers-submitted'
  | 'customer-invoice'
  | 'new-lead-office'
  | 'return-credit'
  | 'pipeline-milestone'
  | 'reassign-notify'       // SLA breach → dispatcher team alert
  | 'response-time-report'  // weekly summary → Chris + Michael
  | 'customer-welcome-portal'; // post-assignment welcome with portal link

/**
 * A single binary attachment. Maps directly onto Resend's `Attachment`
 * shape (see node_modules/resend/dist/index.d.mts ~L597):
 *   { content?: string | Buffer; filename?: string | false; contentType?: string; ... }
 * We require both `filename` and `content`. `contentType` defaults to
 * `application/octet-stream` if omitted.
 */
export interface Attachment {
  filename: string;
  /** Binary Buffer or base64-encoded string. */
  content: Buffer | string;
  /** Defaults to 'application/octet-stream'. */
  contentType?: string;
}

export interface EmailOptions {
  template?: EmailTemplate;
  to: string;
  subject: string;
  body: string; // HTML body
  replyTo?: string;
  cc?: string;
  bcc?: string;
  fromName?: string;
  /** File attachments (PDF invoices, etc.). Forwarded to Resend. */
  attachments?: Attachment[];
}

/**
 * Templates that REACH A CUSTOMER. These require the
 * CUSTOMER_EMAIL_ENABLED=true env var to fire. Otherwise dropped at the
 * gate, regardless of the per-template allowlist.
 *
 * Hard rule (Michael, 2026-05-21): no automated email reaches a customer
 * until manual approval after thorough testing.
 *
 * Internal-team templates (lead-assignment, weekly-numbers-reminder, etc.)
 * are NOT in this list and continue to fire normally.
 */
const CUSTOMER_FACING_TEMPLATES: ReadonlySet<EmailTemplate> = new Set<EmailTemplate>([
  'portal-link',
  'job-status-update',
  'review-request',
  'storm-report-customer',
  'customer-invoice',
  'pipeline-milestone',
  'customer-welcome-portal',
  // contact-form: technically the inbound contact form auto-reply — confirm
  // each callsite case-by-case before adding. Today the contact-form template
  // primarily routes to office, not the customer. Leaving OUT for now; if
  // any callsite uses it to confirm to the customer, surface here.
]);

export function isCustomerFacingTemplate(template: EmailTemplate | undefined): boolean {
  return !!template && CUSTOMER_FACING_TEMPLATES.has(template);
}

export function isCustomerEmailEnabled(): boolean {
  return process.env.CUSTOMER_EMAIL_ENABLED === 'true';
}

function isTemplateAllowed(template: EmailTemplate | undefined): boolean {
  if (!template) return false;
  // Internal failure/ops alerts are ALWAYS allowed (fail-open) — we never
  // want an env misconfiguration to silence a "material order could not be
  // processed" alert. Customer-facing templates are handled by a separate,
  // fail-closed guard (isCustomerFacingTemplate) so this can't leak to them.
  const ALWAYS_ALLOWED: ReadonlySet<EmailTemplate> = new Set<EmailTemplate>([
    'material-order-parse-failure',
    // Internal ops alarms that must NEVER be silenced by an ALLOWED_EMAIL_TEMPLATES
    // override. 2026-08-05: the forwarder-heartbeat stall alert (sent via the
    // 'stalled-tickets-digest' tag) was being dropped as template_not_allowed,
    // so when the email→ticket ingest died, NOBODY was alerted. Fail-open here.
    'stalled-tickets-digest',
    'low-stock-alert',
  ]);
  if (ALWAYS_ALLOWED.has(template)) return true;
  // Default allowlist covers the INTERNAL lead-notification templates that
  // must always fire so website leads reach the team:
  //   contact-form        - contact / free-inspection / referral / careers / BNI
  //   new-lead-office      - office-staff alert from /api/leads/new
  //   storm-report-sales   - storm-report request -> assigned rep / sales team
  // (storm-report-customer stays OUT — customer-facing, gated separately by
  //  CUSTOMER_EMAIL_ENABLED per Michael's 2026-05-21 no-customer-email rule.)
  // Plus the operational templates: load-verified-invoice, driver-new-order.
  // 2026-07-10: added new-lead-office + storm-report-sales — they were being
  // dropped as 'template_not_allowed', silently killing every storm-report
  // lead and the office copy of every website lead. See email-callsite-audit.
  const list = (process.env.ALLOWED_EMAIL_TEMPLATES ||
    'contact-form,new-lead-office,storm-report-sales,load-verified-invoice,driver-new-order,return-credit,low-stock-alert')
    .split(',').map(s => s.trim()).filter(Boolean);
  return list.includes(template);
}

const OWNER_GMAIL = 'rivercityroofingsolutions@gmail.com';

// ─────────────────────────────────────────────────────────────────────────────
// Per-recipient rate-limit buckets.
//
// 2026-05-20 (M1 fix in docs/2026-05-20-verification-pass.md): on Vercel each
// warm Lambda instance held its own in-memory `rateBuckets` Map, so the
// effective owner-gmail cap of 5/hr was actually 5×N where N = warm instances.
// To enforce a global cap we now back the counter with Vercel KV
// (KV_REST_API_URL / KV_REST_API_TOKEN — same env that powers
// lib/rate-limiter-kv.ts).
//
// Fallback: when KV env is unset (local dev, or KV not provisioned on the
// project) we silently degrade to the legacy in-memory Map so `npm run dev`
// keeps working and behavior matches what was shipped before.
// ─────────────────────────────────────────────────────────────────────────────

type Bucket = { hour: number; hourCount: number; day: number; dayCount: number };
const rateBuckets = new Map<string, Bucket>();

function capsFor(addr: string): { hour: number; day: number } {
  if (addr === OWNER_GMAIL) {
    return {
      hour: parseInt(process.env.EMAIL_CAP_OWNER_PER_HOUR || '5', 10),
      day: parseInt(process.env.EMAIL_CAP_OWNER_PER_DAY || '30', 10),
    };
  }
  return {
    hour: parseInt(process.env.EMAIL_CAP_PER_HOUR || '30', 10),
    day: parseInt(process.env.EMAIL_CAP_PER_DAY || '100', 10),
  };
}

// ── KV client (lazy + fail-safe, mirrors lib/rate-limiter-kv.ts:146) ────────
type KvIncrExpire = {
  incr: (key: string) => Promise<number>;
  expire: (key: string, seconds: number) => Promise<number | boolean>;
};

let kvClient: KvIncrExpire | null = null;
let kvProbed = false;
let kvAvailable = false;

function isKvConfigured(): boolean {
  return Boolean(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);
}

async function getKvClient(): Promise<KvIncrExpire | null> {
  if (kvProbed) return kvAvailable ? kvClient : null;
  kvProbed = true;

  if (!isKvConfigured()) {
    console.info(
      '[email-service] KV env vars missing; falling back to in-memory rate buckets.',
    );
    kvAvailable = false;
    return null;
  }

  try {
    const mod = (await import('@vercel/kv')) as { kv: KvIncrExpire };
    kvClient = mod.kv;
    kvAvailable = true;
    return kvClient;
  } catch (err) {
    console.warn(
      '[email-service] @vercel/kv import failed; falling back to in-memory rate buckets.',
      err,
    );
    kvAvailable = false;
    return null;
  }
}

// ── In-memory fallback (legacy behavior) ────────────────────────────────────
function checkAndBumpRateMemory(addr: string): { allowed: boolean; reason?: string } {
  const now = Date.now();
  const hour = Math.floor(now / 3_600_000);
  const day = Math.floor(now / 86_400_000);
  const { hour: hourCap, day: dayCap } = capsFor(addr);
  let b = rateBuckets.get(addr);
  if (!b) b = { hour, hourCount: 0, day, dayCount: 0 };
  if (b.hour !== hour) { b.hour = hour; b.hourCount = 0; }
  if (b.day !== day) { b.day = day; b.dayCount = 0; }
  if (b.hourCount >= hourCap) return { allowed: false, reason: `hourly cap ${hourCap} hit` };
  if (b.dayCount >= dayCap) return { allowed: false, reason: `daily cap ${dayCap} hit` };
  b.hourCount++;
  b.dayCount++;
  rateBuckets.set(addr, b);
  return { allowed: true };
}

// ── KV-backed implementation ────────────────────────────────────────────────
// Bucket-per-window pattern (matches lib/rate-limiter-kv.ts): one INCR per
// send, EXPIRE set only on the first hit of a window so the TTL isn't pushed
// out by later hits. Two keys per address — one hourly, one daily — so the
// existing hour/day caps both apply. Over-budget hits still INCR (mirrors
// the in-memory behavior); the count is checked before the increment is
// committed by comparing the returned `count` to the cap.
async function checkAndBumpRateKv(
  kv: KvIncrExpire,
  addr: string,
): Promise<{ allowed: boolean; reason?: string }> {
  const now = Date.now();
  const hour = Math.floor(now / 3_600_000);
  const day = Math.floor(now / 86_400_000);
  const { hour: hourCap, day: dayCap } = capsFor(addr);

  const hourKey = `email-bucket:${addr}:hour:${hour}`;
  const dayKey = `email-bucket:${addr}:day:${day}`;

  // Hourly bucket: INCR + set TTL on first hit. Cap check uses the
  // post-increment count — first call returns 1 and is allowed iff cap >= 1.
  const hourCount = await kv.incr(hourKey);
  if (hourCount === 1) {
    // 1h + small slack so the bucket survives clock skew at the boundary.
    await kv.expire(hourKey, 3700);
  }
  if (hourCount > hourCap) {
    return { allowed: false, reason: `hourly cap ${hourCap} hit` };
  }

  const dayCount = await kv.incr(dayKey);
  if (dayCount === 1) {
    await kv.expire(dayKey, 86_500);
  }
  if (dayCount > dayCap) {
    return { allowed: false, reason: `daily cap ${dayCap} hit` };
  }

  return { allowed: true };
}

async function checkAndBumpRate(rawAddr: string): Promise<{ allowed: boolean; reason?: string }> {
  const addr = rawAddr.toLowerCase().trim();
  if (!addr) return { allowed: true };
  const kv = await getKvClient();
  if (!kv) return checkAndBumpRateMemory(addr);
  try {
    return await checkAndBumpRateKv(kv, addr);
  } catch (err) {
    console.warn(
      '[email-service] KV rate check failed; degrading to in-memory for this send.',
      err,
    );
    return checkAndBumpRateMemory(addr);
  }
}

async function filterRecipients(addrs: string | undefined, subject: string, field: 'to' | 'cc' | 'bcc'): Promise<{ kept: string; dropped: string[] }> {
  if (!addrs) return { kept: '', dropped: [] };
  const list = addrs.split(/[;,]/).map(s => s.trim()).filter(Boolean);
  const kept: string[] = [];
  const dropped: string[] = [];
  for (const a of list) {
    const r = await checkAndBumpRate(a);
    if (r.allowed) {
      kept.push(a);
    } else {
      dropped.push(a);
      console.warn('[EMAIL BLOCKED]', { field, addr: a, reason: r.reason, subject });
    }
  }
  return { kept: kept.join(','), dropped };
}

class EmailService {
  private resend: Resend | null;
  private from: string;
  private fromName: string;

  constructor() {
    const key = process.env.RESEND_API_KEY;
    this.resend = key ? new Resend(key) : null;
    this.from = process.env.EMAIL_FROM || '';
    this.fromName = process.env.EMAIL_FROM_NAME || 'River City Roofing Solutions';
  }

  // Send transactional email via Resend.
  // Two gates:
  //   1. Template must be in the allowlist (default: contact-form,
  //      load-verified-invoice, driver-new-order). Untagged sends drop.
  //   2. RESEND_API_KEY + EMAIL_FROM must be configured. If unset, drop.
  // Plus the per-recipient rate cap below and the legacy EMAIL_KILL_SWITCH env.
  async send(options: EmailOptions): Promise<{ success: boolean; error?: string }> {
    const template = options.template;

    // Gate 1: template allowlist.
    if (!isTemplateAllowed(template)) {
      console.warn('[EMAIL TEMPLATE NOT ALLOWED]', {
        template: template || '(untagged)',
        subject: options.subject,
        to: options.to,
      });
      // Fire-and-forget audit log — never block on the sheet write.
      logEmailAttempt({
        template: template || '(untagged)',
        to: options.to,
        cc: options.cc,
        bcc: options.bcc,
        from: options.fromName ? `${options.fromName} <${this.from}>` : this.from,
        subject: options.subject,
        status: 'dropped_template_not_allowed',
        error: `template '${template || 'untagged'}' not in allowlist`,
      }).catch(() => {});
      return { success: false, error: `template '${template || 'untagged'}' not in allowlist` };
    }

    // Legacy env kill switch — still honored.
    if (process.env.EMAIL_KILL_SWITCH === 'true') {
      console.warn('[EMAIL KILL SWITCH]', { template, to: options.to, subject: options.subject });
      logEmailAttempt({
        template,
        to: options.to,
        cc: options.cc,
        bcc: options.bcc,
        from: options.fromName ? `${options.fromName} <${this.from}>` : this.from,
        subject: options.subject,
        status: 'dropped_kill_switch',
        error: 'EMAIL_KILL_SWITCH active',
      }).catch(() => {});
      return { success: false, error: 'EMAIL_KILL_SWITCH active' };
    }

    // Customer-facing template guard. Per stated rule (2026-05-21), no
    // automated email reaches a customer until Michael explicitly opts in
    // via CUSTOMER_EMAIL_ENABLED=true. Belt-and-suspenders on top of the
    // per-template allowlist — even if a customer-facing template is added
    // to ALLOWED_EMAIL_TEMPLATES by mistake, this guard still drops it.
    if (isCustomerFacingTemplate(template) && !isCustomerEmailEnabled()) {
      console.warn('[CUSTOMER EMAIL BLOCKED]', { template, to: options.to, subject: options.subject });
      logEmailAttempt({
        template,
        to: options.to,
        cc: options.cc,
        bcc: options.bcc,
        from: options.fromName ? `${options.fromName} <${this.from}>` : this.from,
        subject: options.subject,
        status: 'dropped_customer_email_disabled',
        error: 'Customer-facing template blocked; set CUSTOMER_EMAIL_ENABLED=true to allow',
      }).catch(() => {});
      return { success: false, error: 'Customer-facing email blocked by CUSTOMER_EMAIL_ENABLED gate' };
    }

    // Gate 2: transport configured?
    if (!this.resend || !this.from) {
      console.warn('[EMAIL TRANSPORT NOT CONFIGURED]', {
        hasKey: !!this.resend,
        hasFrom: !!this.from,
        template,
        subject: options.subject,
      });
      logEmailAttempt({
        template,
        to: options.to,
        cc: options.cc,
        bcc: options.bcc,
        from: options.fromName ? `${options.fromName} <${this.from}>` : this.from,
        subject: options.subject,
        status: 'dropped_transport_not_configured',
        error: 'transport not configured (set RESEND_API_KEY and EMAIL_FROM)',
      }).catch(() => {});
      return {
        success: false,
        error: 'transport not configured (set RESEND_API_KEY and EMAIL_FROM)',
      };
    }

    // Sandbox.
    if (process.env.SANDBOX_MODE === 'true' || process.env.VERCEL_GIT_COMMIT_REF === 'sandbox') {
      console.log('[SANDBOX] Email intercepted:', { template, to: options.to, subject: options.subject });
      return { success: true };
    }

    // Per-recipient rate limit. Drop capped recipients, continue with the rest.
    // KV-backed when KV env is set, in-memory fallback otherwise (see helpers above).
    const toF = await filterRecipients(options.to, options.subject, 'to');
    const ccF = await filterRecipients(options.cc, options.subject, 'cc');
    const bccF = await filterRecipients(options.bcc, options.subject, 'bcc');

    if (!toF.kept) {
      console.warn('[EMAIL DROPPED] All to-recipients rate-limited:', {
        template,
        originalTo: options.to,
        droppedTo: toF.dropped,
        subject: options.subject,
      });
      logEmailAttempt({
        template,
        to: options.to,
        cc: options.cc,
        bcc: options.bcc,
        from: options.fromName ? `${options.fromName} <${this.from}>` : this.from,
        subject: options.subject,
        status: 'dropped_rate_limit',
        error: `all to-recipients rate-limited (dropped: ${toF.dropped.join(',')})`,
      }).catch(() => {});
      return { success: false, error: 'all to-recipients rate-limited' };
    }

    // Send via Resend.
    const displayName = options.fromName || this.fromName;
    const fromHeader = displayName ? `${displayName} <${this.from}>` : this.from;
    try {
      const toList = toF.kept.split(',').map(s => s.trim()).filter(Boolean);
      const ccList = ccF.kept ? ccF.kept.split(',').map(s => s.trim()).filter(Boolean) : undefined;
      const bccList = bccF.kept ? bccF.kept.split(',').map(s => s.trim()).filter(Boolean) : undefined;
      // Map our Attachment[] onto Resend's shape. Resend accepts
      // `content` as Buffer or string and `contentType` defaults to
      // application/octet-stream server-side if omitted.
      const resendAttachments = options.attachments?.length
        ? options.attachments.map(a => ({
            filename: a.filename,
            content: a.content,
            contentType: a.contentType || 'application/octet-stream',
          }))
        : undefined;

      const { error } = await this.resend.emails.send({
        from: fromHeader,
        to: toList,
        subject: options.subject,
        html: options.body,
        ...(options.replyTo ? { replyTo: options.replyTo } : {}),
        ...(ccList ? { cc: ccList } : {}),
        ...(bccList ? { bcc: bccList } : {}),
        ...(resendAttachments ? { attachments: resendAttachments } : {}),
      });
      if (error) {
        console.error('[EMAIL SEND FAILED]', { template, subject: options.subject, error });
        logEmailAttempt({
          template,
          to: toF.kept,
          cc: ccF.kept || options.cc,
          bcc: bccF.kept || options.bcc,
          from: fromHeader,
          subject: options.subject,
          status: 'send_failed',
          error: error.message || 'send failed',
        }).catch(() => {});
        return { success: false, error: error.message || 'send failed' };
      }
      logEmailAttempt({
        template,
        to: toF.kept,
        cc: ccF.kept || options.cc,
        bcc: bccF.kept || options.bcc,
        from: fromHeader,
        subject: options.subject,
        status: 'sent',
      }).catch(() => {});
      return { success: true };
    } catch (err) {
      console.error('[EMAIL SEND ERROR]', { template, subject: options.subject, err });
      logEmailAttempt({
        template,
        to: toF.kept,
        cc: ccF.kept || options.cc,
        bcc: bccF.kept || options.bcc,
        from: fromHeader,
        subject: options.subject,
        status: 'send_failed',
        error: err instanceof Error ? err.message : 'unknown error',
      }).catch(() => {});
      return {
        success: false,
        error: err instanceof Error ? err.message : 'unknown error',
      };
    }
  }

  // ========================================
  // CONVENIENCE METHODS
  // ========================================

  /**
   * @deprecated 2026-05-20 — DEAD WRAPPER. No callers found in repo.
   * Per docs/email-callsite-audit.md, customer portal link emails are sent
   * inline by the lead-intake flow, not through this convenience wrapper.
   * Slated for removal in Phase 4 cleanup. Do NOT add new callers; if you
   * need to send a portal link, use `sendEmail()` directly with the
   * relevant template, or revive this method and remove this tag.
   */
  // Send customer portal link
  async sendPortalLink(data: {
    customerEmail: string;
    customerName: string;
    portalUrl: string;
    repName: string;
    repEmail: string;
    repPhone: string;
    stormReportIncluded?: boolean;
  }): Promise<{ success: boolean; error?: string }> {
    const subject = `Your River City Roofing Project Portal`;
    const body = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #000; padding: 20px; text-align: center;">
          <h1 style="color: #39FF14; margin: 0;">River City Roofing Solutions</h1>
        </div>
        <div style="padding: 30px; background: #fff;">
          <p>Hi ${data.customerName},</p>
          <p>Thank you for contacting River City Roofing Solutions! Your personal project portal is ready.</p>
          ${data.stormReportIncluded ? '<p><strong>Your storm damage report is included in your portal.</strong></p>' : ''}
          <div style="text-align: center; margin: 30px 0;">
            <a href="${data.portalUrl}" style="background: #39FF14; color: #000; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px;">
              View Your Portal
            </a>
          </div>
          <p>Your assigned representative is <strong>${data.repName}</strong>.</p>
          <p>
            📞 ${data.repPhone}<br>
            📧 ${data.repEmail}
          </p>
          <p>Feel free to reach out anytime with questions!</p>
        </div>
        <div style="background: #f5f5f5; padding: 15px; text-align: center; font-size: 12px; color: #666;">
          River City Roofing Solutions | (256) 274-8530 | rivercityroofingsolutions.com
        </div>
      </div>
    `;

    return this.send({
      template: 'portal-link',
      to: data.customerEmail,
      subject,
      body,
      replyTo: data.repEmail,
      fromName: 'River City Roofing Solutions',
    });
  }

  /**
   * Customer welcome email — sends after a lead is assigned to a rep.
   * Links to the welcome portal page (/customer/welcome/[token]) which
   * introduces the rep (bio + headshot + truck pic) and shows next steps.
   *
   * GATED: this template is in CUSTOMER_FACING_TEMPLATES, so it requires
   * `CUSTOMER_EMAIL_ENABLED=true` to actually send. Until Michael flips
   * that env var, calls to this method log + drop without sending.
   *
   * No automatic trigger is wired — Michael will pick the trigger point
   * (probably inside distributeLead, after the rep is committed) after
   * he's tested the welcome page in the browser.
   */
  async sendCustomerWelcome(data: {
    customerEmail: string;
    customerName: string;
    portalToken: string;
    repName: string;
    repEmail: string;
    repPhone?: string;
  }): Promise<{ success: boolean; error?: string }> {
    const base = process.env.NEXT_PUBLIC_BASE_URL || 'https://rivercityroofingsolutions.com';
    const welcomeUrl = `${base}/customer/welcome/${encodeURIComponent(data.portalToken)}`;
    const firstName = data.customerName.split(' ')[0] || 'there';

    const subject = `Welcome, ${firstName} — meet your roofing specialist`;
    const body = `
      <div style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto;">
        <div style="background: #000; padding: 20px; text-align: center;">
          <h1 style="color: #39FF14; margin: 0; font-size: 22px;">River City Roofing Solutions</h1>
        </div>
        <div style="padding: 28px; background: #fff; color: #222;">
          <p style="font-size: 16px;">Hi ${firstName},</p>
          <p>Thanks for reaching out — we're glad to have the opportunity to take care of your roof. Your assigned specialist is <strong>${data.repName}</strong>${data.repPhone ? ` (${data.repPhone})` : ''}.</p>
          <p>We've put together a short welcome page where you can see ${data.repName}'s profile, what to expect next, and a free tool to visualize new shingles on your home.</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${welcomeUrl}" style="background: #39FF14; color: #000; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px;">
              View Your Welcome Page
            </a>
          </div>
          <p>${data.repName} will be reaching out shortly to schedule your free inspection. In the meantime, you can call or text them directly at the number above with any questions.</p>
          <p style="margin-top: 24px; color: #666;">— The team at River City Roofing Solutions</p>
        </div>
        <div style="background: #f5f5f5; padding: 14px; text-align: center; font-size: 12px; color: #666;">
          River City Roofing Solutions | (256) 656-7856 | rivercityroofingsolutions.com
        </div>
      </div>
    `;

    return this.send({
      template: 'customer-welcome-portal',
      to: data.customerEmail,
      subject,
      body,
      replyTo: data.repEmail,
      fromName: data.repName ? `${data.repName} (RCRS)` : 'River City Roofing Solutions',
    });
  }

  /**
   * @deprecated 2026-05-20 — DEAD WRAPPER. No callers found in repo.
   * Per docs/email-callsite-audit.md, lead-assignment notifications are
   * sent by the lead-distro service using its own templated payload, not
   * through this convenience wrapper. Slated for removal in Phase 4
   * cleanup. Do NOT add new callers; route through the lead-distro
   * notification path instead.
   */
  // Notify rep of new lead assignment
  async sendLeadAssignment(data: {
    repEmail: string;
    repName: string;
    leadName: string;
    leadPhone: string;
    leadEmail: string;
    leadAddress: string;
    source: string;
    riskScore?: number;
    portalUrl?: string;
  }): Promise<{ success: boolean; error?: string }> {
    const subject = `New Lead Assigned: ${data.leadName}`;
    const body = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #000; padding: 20px; text-align: center;">
          <h1 style="color: #39FF14; margin: 0;">New Lead Assignment</h1>
        </div>
        <div style="padding: 30px; background: #fff;">
          <p>Hi ${data.repName},</p>
          <p>A new lead has been assigned to you. <strong>Please respond within 5 minutes.</strong></p>
          <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
            <tr><td style="padding: 8px; border-bottom: 1px solid #eee; font-weight: bold;">Name</td><td style="padding: 8px; border-bottom: 1px solid #eee;">${data.leadName}</td></tr>
            <tr><td style="padding: 8px; border-bottom: 1px solid #eee; font-weight: bold;">Phone</td><td style="padding: 8px; border-bottom: 1px solid #eee;"><a href="tel:${data.leadPhone}">${data.leadPhone}</a></td></tr>
            <tr><td style="padding: 8px; border-bottom: 1px solid #eee; font-weight: bold;">Email</td><td style="padding: 8px; border-bottom: 1px solid #eee;"><a href="mailto:${data.leadEmail}">${data.leadEmail}</a></td></tr>
            <tr><td style="padding: 8px; border-bottom: 1px solid #eee; font-weight: bold;">Address</td><td style="padding: 8px; border-bottom: 1px solid #eee;">${data.leadAddress}</td></tr>
            <tr><td style="padding: 8px; border-bottom: 1px solid #eee; font-weight: bold;">Source</td><td style="padding: 8px; border-bottom: 1px solid #eee;">${data.source}</td></tr>
            ${data.riskScore ? `<tr><td style="padding: 8px; border-bottom: 1px solid #eee; font-weight: bold;">Storm Risk</td><td style="padding: 8px; border-bottom: 1px solid #eee;">${data.riskScore}/100</td></tr>` : ''}
          </table>
          ${data.portalUrl ? `<p><a href="${data.portalUrl}">View Customer Portal</a></p>` : ''}
        </div>
      </div>
    `;

    return this.send({
      template: 'lead-assignment',
      to: data.repEmail,
      subject,
      body,
      fromName: 'RCRS Lead Distribution',
    });
  }

  // Send delivery order email (triggers Gmail+ automation).
  // driverEmail is optional — if omitted, the order goes to stock@rcrsal.com.
  // That inbox is the single home for all inventory / stock / material-order
  // emails and must never be used for anything else. Default can be overridden
  // via the DEFAULT_DELIVERY_ORDER_EMAIL env var.
  // CRITICAL: items must contain only "qty unit name" strings — never include
  // cost, price, or any dollar value. The work order PDF physically rides out
  // with the truck and could be left at a job site.
  async sendDeliveryOrder(data: {
    driverEmail?: string;
    ticketId: string;
    customerName: string;
    address: string;
    items: string[];
    deliveryDate: string;
    notes?: string;
  }): Promise<{ success: boolean; error?: string }> {
    const recipient =
      data.driverEmail ||
      process.env.DEFAULT_DELIVERY_ORDER_EMAIL ||
      'stock@rcrsal.com';

    const subject = `Delivery Order: ${data.ticketId} - ${data.customerName}`;
    const body = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #000; padding: 20px; text-align: center;">
          <h1 style="color: #39FF14; margin: 0;">Delivery Order</h1>
        </div>
        <div style="padding: 30px; background: #fff;">
          <h2>Ticket: ${data.ticketId}</h2>
          <p><strong>Customer:</strong> ${data.customerName}</p>
          <p><strong>Address:</strong> ${data.address}</p>
          <p><strong>Date:</strong> ${data.deliveryDate}</p>
          <h3>Items:</h3>
          <ul>
            ${data.items.map(item => `<li>${item}</li>`).join('\n')}
          </ul>
          ${data.notes ? `<p><strong>Notes:</strong> ${data.notes}</p>` : ''}
          <p style="margin-top: 20px;"><a href="https://maps.google.com/?q=${encodeURIComponent(data.address)}" style="background: #0066CC; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Get Directions</a></p>
        </div>
      </div>
    `;

    return this.send({
      template: 'delivery-order',
      to: recipient,
      subject,
      body,
      fromName: 'RCRS Dispatch',
    });
  }

  /**
   * @deprecated 2026-05-20 — DEAD WRAPPER. No callers found in repo.
   * Per docs/email-callsite-audit.md, the stock-workflow material-order
   * notifications fire from the JN -> stock@rcrsal.com email path
   * (see project_rcrs_stock_workflow), not through this wrapper. Slated
   * for removal in Phase 4 cleanup. Do NOT add new callers; if office
   * notification needs to change, modify the stock-workflow trigger.
   */
  // Notify office (Sara + anyone copied) when a new material order ticket
  // is created. Office-side notification — INCLUDES cost / total because
  // Sara handles invoicing and accounting. This email NEVER goes to a
  // customer or sales rep.
  async sendOfficeMaterialOrderNotification(data: {
    officeEmail?: string;
    ticketId: string;
    ticketType: 'delivery' | 'return';
    jobNumber: string;
    customerName: string;
    address: string;
    salesRepName: string;
    materials: Array<{ name: string; qty: number; unit?: string; lineCost: number; linePrice: number }>;
    totalCost: number;
    totalPrice: number;
    interofficeInvoiceId: string;
    notes?: string;
  }): Promise<{ success: boolean; error?: string }> {
    // Default to Sara per the team-roles.ts entry
    const recipient = data.officeEmail || process.env.OFFICE_NOTIFY_EMAIL || 'rcrs@rcrsal.com';

    const isReturn = data.ticketType === 'return';
    const subject = isReturn
      ? `Credit Memo: ${data.ticketId} — ${data.jobNumber} ${data.customerName}`
      : `New Material Order: ${data.ticketId} — ${data.jobNumber} ${data.customerName}`;

    const fmt = (n: number) => `$${n.toFixed(2)}`;
    const tableRows = data.materials.map(m => `
      <tr>
        <td style="padding: 6px 8px; border-bottom: 1px solid #eee;">${m.qty} ${m.unit || ''} ${m.name}</td>
        <td style="padding: 6px 8px; border-bottom: 1px solid #eee; text-align: right;">${fmt(m.lineCost)}</td>
        <td style="padding: 6px 8px; border-bottom: 1px solid #eee; text-align: right;">${fmt(m.linePrice)}</td>
      </tr>
    `).join('');

    const body = `
      <div style="font-family: Arial, sans-serif; max-width: 700px; margin: 0 auto;">
        <div style="background: #000; padding: 20px; text-align: center;">
          <h1 style="color: #39FF14; margin: 0;">${isReturn ? 'Credit Memo' : 'New Material Order'}</h1>
        </div>
        <div style="padding: 30px; background: #fff;">
          <p style="font-size: 14px; color: #555;">
            ${isReturn
              ? 'Materials returned from job to warehouse. Credit memo posted to the job material cost ledger.'
              : 'Materials issued from warehouse to job. Interoffice invoice posted to the job material cost ledger.'}
          </p>
          <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
            <tr><td style="padding: 4px 8px;"><strong>Ticket:</strong></td><td style="padding: 4px 8px;">${data.ticketId}</td></tr>
            <tr><td style="padding: 4px 8px;"><strong>Interoffice Invoice:</strong></td><td style="padding: 4px 8px;">${data.interofficeInvoiceId}</td></tr>
            <tr><td style="padding: 4px 8px;"><strong>Job:</strong></td><td style="padding: 4px 8px;">${data.jobNumber} — ${data.customerName}</td></tr>
            <tr><td style="padding: 4px 8px;"><strong>Address:</strong></td><td style="padding: 4px 8px;">${data.address}</td></tr>
            <tr><td style="padding: 4px 8px;"><strong>Sales Rep:</strong></td><td style="padding: 4px 8px;">${data.salesRepName || '—'}</td></tr>
          </table>

          <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
            <thead>
              <tr style="background: #f5f5f5;">
                <th style="padding: 8px; text-align: left;">Item</th>
                <th style="padding: 8px; text-align: right;">Cost</th>
                <th style="padding: 8px; text-align: right;">Price</th>
              </tr>
            </thead>
            <tbody>${tableRows}</tbody>
            <tfoot>
              <tr style="font-weight: bold; background: #f5f5f5;">
                <td style="padding: 8px;">TOTAL</td>
                <td style="padding: 8px; text-align: right;">${fmt(data.totalCost)}</td>
                <td style="padding: 8px; text-align: right;">${fmt(data.totalPrice)}</td>
              </tr>
            </tfoot>
          </table>

          ${data.notes ? `<div style="background: #fffbe6; border-left: 3px solid #f0ad4e; padding: 12px; margin: 16px 0;"><strong>Special Instructions:</strong><br>${data.notes.replace(/\n/g, '<br>')}</div>` : ''}

          <p style="font-size: 12px; color: #888; margin-top: 20px;">
            This notification is INTERNAL ONLY. Do not forward to customer or sales rep.
            The interoffice invoice records cost-side material consumption for job profitability.
          </p>
        </div>
      </div>
    `;

    return this.send({
      template: 'office-material-order',
      to: recipient,
      subject,
      body,
      fromName: 'RCRS Inventory',
    });
  }

  // Office-facing invoice that fires AT load_verified (truck loaded, about
  // to leave warehouse). This is the office's "materials issued" notification
  // and serves as the invoice record. PRICE ONLY — no cost. Safe to attach
  // to JobNimbus or share with sales rep. Cost-bearing data only lives in
  // admin / office / manager reports, never on this email.
  //
  // 2026-05-20: the HTML body is now a short cover note; the full
  // invoice (line items + total) is generated as a PDF via
  // renderLoadVerifiedInvoicePDF and attached as Invoice-{invoiceId}.pdf.
  // If PDF generation fails we still send the cover-note email rather
  // than dropping the whole notification — the office at least gets the
  // summary, and the error is logged for follow-up.
  async sendLoadVerifiedInvoice(data: {
    officeEmail?: string;
    ticketId: string;
    invoiceId: string;
    jobNumber: string;
    customerName: string;
    address: string;
    salesRepName: string;
    verifiedByName: string;
    verifiedAt: string;
    materials: Array<{ name: string; qty: number; unit?: string; unitPrice: number; linePrice: number }>;
    totalPrice: number;
    notes?: string;
  }): Promise<{ success: boolean; error?: string }> {
    const recipient = data.officeEmail || process.env.OFFICE_NOTIFY_EMAIL || 'rcrs@rcrsal.com';

    const subject = loadVerifiedInvoiceSubject(data);
    const body = renderLoadVerifiedInvoiceEmail(data);

    let attachments: Attachment[] | undefined;
    try {
      const pdfBuffer = await renderLoadVerifiedInvoicePDF(data);
      attachments = [
        {
          filename: `Invoice-${data.invoiceId}.pdf`,
          content: pdfBuffer,
          contentType: 'application/pdf',
        },
      ];
    } catch (err) {
      // Don't lose the notification — send the cover note anyway, log
      // the PDF failure for manual follow-up.
      console.error('[LOAD-VERIFIED-INVOICE PDF FAILED]', {
        invoiceId: data.invoiceId,
        ticketId: data.ticketId,
        err: err instanceof Error ? err.message : err,
      });
    }

    return this.send({
      template: 'load-verified-invoice',
      to: recipient,
      subject,
      body,
      fromName: 'RCRS Inventory',
      attachments,
    });
  }

  // Notify the driver (Rick) when a new material-order ticket lands. Driver
  // view — NO cost or pricing data (per lib/cost-visibility.ts). Tells him
  // what to load and where to take it. Sent at ticket-create time so Rick
  // sees the load before he starts pulling.
  async sendDriverMaterialOrderNotification(data: {
    driverEmail?: string;
    ticketId: string;
    jobNumber: string;
    customerName: string;
    address: string;
    salesRepName: string;
    materials: Array<{ name: string; qty: number; unit?: string }>;
    notes?: string;
  }): Promise<{ success: boolean; error?: string }> {
    const recipient = data.driverEmail || process.env.DRIVER_NOTIFY_EMAIL || 'rick@RiverCityRoofingSolutions.com';

    const subject = driverNewOrderSubject(data);
    const body = renderDriverNewOrderEmail(data);

    return this.send({
      template: 'driver-new-order',
      to: recipient,
      subject,
      body,
      fromName: 'RCRS Deliveries',
    });
  }

  // Notify Sara about a vendor return — Rick picked up materials from a
  // job that came from an outside supplier (SRS, ABC, etc.). Sara needs to
  // chase the vendor credit and post it against the job. INTERNAL ONLY —
  // never goes to customer or sales rep.
  async sendVendorReturnNotification(data: {
    officeEmail?: string;
    vendorReturnId: string;
    jobNumber: string;
    customerName: string;
    pickupAddress: string;
    vendorName: string;
    vendorReceiptNumber?: string;
    pickedUpByName: string;
    lines: Array<{ description: string; quantity: number; unit?: string; estimatedValue?: number }>;
    estimatedTotalValue: number;
    notes?: string;
    photoUrl?: string;
  }): Promise<{ success: boolean; error?: string }> {
    const recipient = data.officeEmail || process.env.OFFICE_NOTIFY_EMAIL || 'rcrs@rcrsal.com';

    const subject = `Vendor Return: ${data.vendorName} — ${data.jobNumber} ${data.customerName}`;

    const fmt = (n: number) => `$${n.toFixed(2)}`;
    const tableRows = data.lines.map(l => `
      <tr>
        <td style="padding: 6px 8px; border-bottom: 1px solid #eee;">${l.quantity} ${l.unit || ''} ${l.description}</td>
        <td style="padding: 6px 8px; border-bottom: 1px solid #eee; text-align: right;">${l.estimatedValue ? fmt(l.estimatedValue) : '—'}</td>
      </tr>
    `).join('');

    const body = `
      <div style="font-family: Arial, sans-serif; max-width: 700px; margin: 0 auto;">
        <div style="background: #000; padding: 20px; text-align: center;">
          <h1 style="color: #39FF14; margin: 0;">Vendor Return — Action Needed</h1>
        </div>
        <div style="padding: 30px; background: #fff;">
          <p style="font-size: 14px; color: #555;">
            Materials were picked up from a job site that came from an outside vendor.
            These items are NOT in our inventory catalog. Please chase the credit from
            <strong>${data.vendorName}</strong> and post it against job <strong>${data.jobNumber}</strong>.
          </p>

          <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
            <tr><td style="padding: 4px 8px;"><strong>Vendor Return:</strong></td><td style="padding: 4px 8px;">${data.vendorReturnId}</td></tr>
            <tr><td style="padding: 4px 8px;"><strong>Job:</strong></td><td style="padding: 4px 8px;">${data.jobNumber} — ${data.customerName}</td></tr>
            <tr><td style="padding: 4px 8px;"><strong>Pickup Address:</strong></td><td style="padding: 4px 8px;">${data.pickupAddress}</td></tr>
            <tr><td style="padding: 4px 8px;"><strong>Vendor:</strong></td><td style="padding: 4px 8px;">${data.vendorName}</td></tr>
            ${data.vendorReceiptNumber ? `<tr><td style="padding: 4px 8px;"><strong>Receipt #:</strong></td><td style="padding: 4px 8px;">${data.vendorReceiptNumber}</td></tr>` : ''}
            <tr><td style="padding: 4px 8px;"><strong>Picked up by:</strong></td><td style="padding: 4px 8px;">${data.pickedUpByName}</td></tr>
          </table>

          <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
            <thead>
              <tr style="background: #f5f5f5;">
                <th style="padding: 8px; text-align: left;">Item</th>
                <th style="padding: 8px; text-align: right;">Est. Credit</th>
              </tr>
            </thead>
            <tbody>${tableRows}</tbody>
            <tfoot>
              <tr style="font-weight: bold; background: #f5f5f5;">
                <td style="padding: 8px;">ESTIMATED TOTAL</td>
                <td style="padding: 8px; text-align: right;">${fmt(data.estimatedTotalValue)}</td>
              </tr>
            </tfoot>
          </table>

          ${data.notes ? `<div style="background: #fffbe6; border-left: 3px solid #f0ad4e; padding: 12px; margin: 16px 0;"><strong>Notes:</strong><br>${data.notes.replace(/\n/g, '<br>')}</div>` : ''}

          ${data.photoUrl ? `<p><strong>Photo:</strong> <a href="${data.photoUrl}">${data.photoUrl}</a></p>` : ''}

          <p style="font-size: 12px; color: #888; margin-top: 20px;">
            INTERNAL ONLY. Do not forward to the customer. Once the vendor issues
            the credit memo, mark this vendor return as credited in the portal.
          </p>
        </div>
      </div>
    `;

    return this.send({
      template: 'vendor-return',
      to: recipient,
      subject,
      body,
      fromName: 'RCRS Inventory',
    });
  }

  // Notify the office when a STOCK credit memo posts — Rick brought OUR
  // materials back from a job. Mirrors the material-order invoice email:
  // PRICE side only, NEVER cost (belt-and-suspenders on the cost rule —
  // callers must not pass cost fields). INTERNAL ONLY — never goes to the
  // customer or sales rep. Uses the internal 'return-credit' template tag
  // (not in CUSTOMER_FACING_TEMPLATES); to actually fire it must be present
  // in the ALLOWED_EMAIL_TEMPLATES allowlist env.
  async sendCreditMemoNotification(data: {
    officeEmail?: string;
    ticketId: string;
    invoiceId: string;
    jobNumber: string;
    customerName: string;
    lines: Array<{ name: string; qty: number; unit?: string; unitPrice: number; linePrice: number }>;
    totalPrice: number;
    reason?: string;
    createdByName?: string;
  }): Promise<{ success: boolean; error?: string }> {
    const recipient = data.officeEmail || process.env.OFFICE_NOTIFY_EMAIL || 'rcrs@rcrsal.com';

    const subject = `Credit Memo ${data.invoiceId || data.ticketId} — ${data.jobNumber} ${data.customerName}`;

    const fmt = (n: number) => `$${(n || 0).toFixed(2)}`;
    const tableRows = data.lines.map(l => `
      <tr>
        <td style="padding: 6px 8px; border-bottom: 1px solid #eee;">${l.qty} ${l.unit || ''} ${l.name}</td>
        <td style="padding: 6px 8px; border-bottom: 1px solid #eee; text-align: right;">${fmt(l.unitPrice)}</td>
        <td style="padding: 6px 8px; border-bottom: 1px solid #eee; text-align: right;">${fmt(l.linePrice)}</td>
      </tr>
    `).join('');

    const body = `
      <div style="font-family: Arial, sans-serif; max-width: 700px; margin: 0 auto;">
        <div style="background: #000; padding: 20px; text-align: center;">
          <h1 style="color: #39FF14; margin: 0;">Credit Memo Posted</h1>
        </div>
        <div style="padding: 30px; background: #fff;">
          <p style="font-size: 14px; color: #555;">
            Our materials came back to the warehouse from this job. Inventory has been
            restocked and a credit memo posted against the job's material ledger.
          </p>

          <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
            <tr><td style="padding: 4px 8px;"><strong>Credit Memo:</strong></td><td style="padding: 4px 8px;">${data.invoiceId || '—'}</td></tr>
            <tr><td style="padding: 4px 8px;"><strong>Ticket:</strong></td><td style="padding: 4px 8px;">${data.ticketId}</td></tr>
            <tr><td style="padding: 4px 8px;"><strong>Job:</strong></td><td style="padding: 4px 8px;">${data.jobNumber} — ${data.customerName}</td></tr>
            ${data.createdByName ? `<tr><td style="padding: 4px 8px;"><strong>Posted by:</strong></td><td style="padding: 4px 8px;">${data.createdByName}</td></tr>` : ''}
          </table>

          <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
            <thead>
              <tr style="background: #f5f5f5;">
                <th style="padding: 8px; text-align: left;">Item Returned</th>
                <th style="padding: 8px; text-align: right;">Unit Price</th>
                <th style="padding: 8px; text-align: right;">Credit</th>
              </tr>
            </thead>
            <tbody>${tableRows}</tbody>
            <tfoot>
              <tr style="font-weight: bold; background: #f5f5f5;">
                <td style="padding: 8px;">TOTAL CREDIT</td>
                <td style="padding: 8px;"></td>
                <td style="padding: 8px; text-align: right;">${fmt(data.totalPrice)}</td>
              </tr>
            </tfoot>
          </table>

          ${data.reason ? `<div style="background: #fffbe6; border-left: 3px solid #f0ad4e; padding: 12px; margin: 16px 0;"><strong>Reason:</strong><br>${data.reason.replace(/\n/g, '<br>')}</div>` : ''}

          <p style="font-size: 12px; color: #888; margin-top: 20px;">
            INTERNAL ONLY. Do not forward to the customer. Amounts shown are the
            selling price of the returned material (no purchase cost on this email).
          </p>
        </div>
      </div>
    `;

    return this.send({
      template: 'return-credit',
      to: recipient,
      subject,
      body,
      fromName: 'RCRS Inventory',
    });
  }

  // Send delivery reminder to customer via email
  async sendDeliveryReminderEmail(data: {
    customerEmail: string;
    customerName: string;
    deliveryDate: string;
    timeWindow?: string;
    address: string;
  }): Promise<{ success: boolean; error?: string }> {
    const subject = `Delivery Scheduled - River City Roofing`;
    const body = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #000; padding: 20px; text-align: center;">
          <h1 style="color: #39FF14; margin: 0;">Delivery Reminder</h1>
        </div>
        <div style="padding: 30px; background: #fff;">
          <p>Hi ${data.customerName},</p>
          <p>Your material delivery from River City Roofing Solutions is scheduled for:</p>
          <div style="background: #f8f8f8; padding: 20px; border-radius: 8px; margin: 20px 0; text-align: center;">
            <p style="font-size: 24px; font-weight: bold; margin: 0;">${data.deliveryDate}</p>
            ${data.timeWindow ? `<p style="color: #666; margin: 5px 0 0 0;">${data.timeWindow}</p>` : ''}
          </div>
          <p><strong>Delivery Address:</strong> ${data.address}</p>
          <p>Please ensure the delivery area is accessible and clear of vehicles/obstacles.</p>
          <p>Questions? Call us at <a href="tel:+12562748530">(256) 274-8530</a>.</p>
        </div>
        <div style="background: #f5f5f5; padding: 15px; text-align: center; font-size: 12px; color: #666;">
          River City Roofing Solutions | (256) 274-8530 | rivercityroofingsolutions.com
        </div>
      </div>
    `;

    return this.send({
      template: 'delivery-reminder',
      to: data.customerEmail,
      subject,
      body,
      fromName: 'River City Roofing Solutions',
    });
  }

  // Check if email transport is configured (RESEND_API_KEY + EMAIL_FROM both set).
  isConfigured(): boolean {
    return !!this.resend && !!this.from;
  }
}

export const emailService = new EmailService();
export default emailService;
