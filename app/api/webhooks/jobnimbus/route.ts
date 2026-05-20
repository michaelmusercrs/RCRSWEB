import { NextRequest, NextResponse } from 'next/server';
import { geocodeAndSaveContact } from '@/lib/geocode-sync';
import { matchRepToTeamMember, JN_TO_PORTAL_STATUS } from '@/lib/jn-sync-engine';
import { breakdownService } from '@/lib/breakdown-service';
import { emailService } from '@/lib/email-service';
import { auditLog } from '@/lib/audit-logger';
import { jobNimbusService } from '@/lib/jobnimbus-service';
import {
  saveBreakdown,
  getBreakdownByRNumber,
  generateBreakdownId,
  calculateTotals,
  loadDropdownConfig,
  type CustomerBreakdown,
} from '@/lib/customer-breakdown-service';
import crypto from 'crypto';

// Statuses that should trigger auto-creation of a job breakdown sheet
const BREAKDOWN_TRIGGER_STATUSES = ['approved', 'Approved', 'contract signed', 'Contract Signed', 'in progress', 'In Progress'];

// SECURITY: Webhook secret for HMAC-SHA256 signature verification.
// Set JOBNIMBUS_WEBHOOK_SECRET in environment variables to enable validation.
// When set, ALL incoming webhook requests MUST include a valid signature.
const WEBHOOK_SECRET = process.env.JOBNIMBUS_WEBHOOK_SECRET;

/**
 * SECURITY: Verify webhook signature using HMAC-SHA256.
 * JobNimbus sends a signature in the x-jobnimbus-signature header.
 * The signature is computed as HMAC-SHA256(secret, rawBody) encoded as hex.
 *
 * Returns true if the signature is valid, false otherwise.
 */
function verifyWebhookSignature(rawBody: string, signature: string, secret: string): boolean {
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(rawBody, 'utf8')
    .digest('hex');

  // Use timing-safe comparison to prevent timing attacks
  try {
    return crypto.timingSafeEqual(
      Buffer.from(signature, 'hex'),
      Buffer.from(expectedSignature, 'hex')
    );
  } catch {
    // If signatures are different lengths or invalid hex, they don't match
    return false;
  }
}

export async function POST(request: NextRequest) {
  try {
    // SECURITY: Check Content-Type header
    const contentType = request.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      console.warn('SECURITY: JN webhook rejected - invalid content type');
      return NextResponse.json(
        { error: 'Content-Type must be application/json' },
        { status: 400 }
      );
    }

    // SECURITY: Read raw body for signature verification before parsing JSON.
    // We need the exact bytes that were signed, not a re-serialized version.
    const rawBody = await request.text();

    // SECURITY: Request size limit - reject payloads > 1MB
    const MAX_BODY_SIZE = 1024 * 1024; // 1MB
    if (rawBody.length > MAX_BODY_SIZE) {
      console.warn(`SECURITY: JN webhook rejected - body too large (${rawBody.length} bytes)`);
      return NextResponse.json(
        { error: 'Request body too large' },
        { status: 413 }
      );
    }

    // SECURITY: Verify webhook signature when secret is configured.
    // If JOBNIMBUS_WEBHOOK_SECRET is set, signature validation is REQUIRED.
    // Requests without a valid signature are rejected with 401.
    if (WEBHOOK_SECRET) {
      const signature = request.headers.get('x-jobnimbus-signature');

      if (!signature) {
        console.warn('SECURITY: JN webhook rejected - missing signature header');
        return NextResponse.json(
          { error: 'Missing webhook signature' },
          { status: 401 }
        );
      }

      if (!verifyWebhookSignature(rawBody, signature, WEBHOOK_SECRET)) {
        console.warn('SECURITY: JN webhook rejected - invalid signature');
        return NextResponse.json(
          { error: 'Invalid webhook signature' },
          { status: 401 }
        );
      }
    } else {
      // Log warning if webhook secret is not configured
      console.warn('SECURITY WARNING: JOBNIMBUS_WEBHOOK_SECRET not set - webhook requests are not verified');
    }

    // Parse the verified body
    let body;
    try {
      body = JSON.parse(rawBody);
    } catch (parseError) {
      console.warn('SECURITY: JN webhook rejected - invalid JSON');
      return NextResponse.json(
        { error: 'Invalid JSON body' },
        { status: 400 }
      );
    }

    const { event, data } = body;
    // JN webhooks are inconsistent — some payloads use `type` instead of `event`.
    // We honor `event` as primary (existing behavior) but fall back to `type`
    // for deposit detection below.
    const eventType: string = (typeof event === 'string' && event)
      || (typeof body?.type === 'string' && body.type)
      || '';

    // SECURITY: Validate required fields
    if (!event || typeof event !== 'string') {
      console.warn('SECURITY: JN webhook rejected - missing or invalid event field');
      return NextResponse.json(
        { error: 'Missing or invalid event field' },
        { status: 400 }
      );
    }

    if (!data || typeof data !== 'object') {
      console.warn('SECURITY: JN webhook rejected - missing or invalid data field');
      return NextResponse.json(
        { error: 'Missing or invalid data field' },
        { status: 400 }
      );
    }

    // DEPOSIT DETECTION — fire-and-forget auto-create of CustomerBreakdown draft.
    // Wrapped in its own try/catch inside the handler; MUST NOT block the 200 response.
    if (isDepositEvent(eventType, body, data)) {
      handleDepositWebhook(data, body).catch(err => {
        console.error('[JN webhook] deposit handler crashed:', err);
      });
    }

    switch (event) {
      case 'contact.created':
      case 'contact.updated': {
        // Match sales rep to team member
        const repSlug = data?.sales_rep_name
          ? (matchRepToTeamMember(data.sales_rep_name)?.slug || data.sales_rep_name.toLowerCase().replace(/\s+/g, '-'))
          : '';

        if (data?.sales_rep_name) {
          const teamMember = matchRepToTeamMember(data.sales_rep_name);
          if (teamMember) {
          } else {
            console.warn(`JN contact ${data.jnid} has unmatched rep: ${data.sales_rep_name}`);
          }
        }

        // Auto-geocode new/updated contacts using Nominatim and save to Sheets
        if (data?.address_line1) {
          const address = [data.address_line1, data.city, data.state_text, data.zip].filter(Boolean).join(', ');
          const contactName = data.display_name || `${data.first_name || ''} ${data.last_name || ''}`.trim() || 'Unknown';

          // Determine type from status
          const statusLower = (data.status || '').toLowerCase();
          let contactType = 'contact';
          if (statusLower.includes('complete') || statusLower.includes('closed')) {
            contactType = 'install';
          } else if (statusLower.includes('lead') || statusLower.includes('new')) {
            contactType = 'lead';
          }

          // Geocode via Nominatim and save to Geocoded_Contacts sheet (fire-and-forget)
          geocodeAndSaveContact({
            id: data.jnid,
            name: contactName,
            address,
            salesRep: repSlug,
            type: contactType,
            status: data.status || '',
          }).then(result => {
            if (result) {
            }
          }).catch(err => {
            console.warn(`Failed to geocode JN contact ${data.jnid}:`, err);
          });
        }
        break;
      }

      case 'job.created':
      case 'job.updated': {
        const portalStatus = data?.status ? JN_TO_PORTAL_STATUS[data.status] || data.status : 'unknown';
        const jobStatus = data?.status || '';
        const jobId = data?.jnid || '';
        const jobName = data?.name || data?.display_name || '';
        const customerName = data?.display_name || `${data?.first_name || ''} ${data?.last_name || ''}`.trim() || 'Unknown';

        // Match sales rep
        const teamMember = data?.sales_rep_name ? matchRepToTeamMember(data.sales_rep_name) : null;
        const repSlug = teamMember?.slug || data?.sales_rep_name?.toLowerCase().replace(/\s+/g, '-') || '';

        // AUTO-CREATE JOB BREAKDOWN when job hits approved/contract signed/in progress
        if (BREAKDOWN_TRIGGER_STATUSES.some(s => jobStatus.toLowerCase() === s.toLowerCase())) {
          autoCreateBreakdown(data, customerName, jobId, jobName, repSlug).catch(err => {
            console.error(`[JN Webhook] Auto-breakdown creation failed for ${jobId}:`, err);
          });
        }

        // Log to audit
        auditLog(
          `JN_JOB_${event === 'job.created' ? 'CREATED' : 'UPDATED'}`,
          repSlug || 'jobnimbus-webhook',
          `Job ${jobId}: ${jobName} — Status: ${jobStatus} (${portalStatus})`,
        );

        // Email Michael on job status changes to key statuses
        if (['approved', 'Approved', 'contract signed', 'Contract Signed'].some(s => jobStatus.toLowerCase() === s.toLowerCase())) {
          emailService.send({
            to: 'michaelmuse@rcrsal.com',
            subject: `Job ${jobStatus}: ${customerName} — ${jobName || jobId}`,
            body: `
              <div style="font-family:Arial,sans-serif;max-width:500px;margin:0 auto;">
                <div style="background:#000;padding:16px;text-align:center;">
                  <h2 style="color:#39FF14;margin:0;">Job Status Update</h2>
                </div>
                <div style="padding:20px;background:#fff;">
                  <p>A JobNimbus job has been <strong>${jobStatus}</strong>.</p>
                  <table style="width:100%;border-collapse:collapse;margin:12px 0;">
                    <tr><td style="padding:6px;border-bottom:1px solid #eee;font-weight:bold;">Customer</td><td style="padding:6px;border-bottom:1px solid #eee;">${customerName}</td></tr>
                    <tr><td style="padding:6px;border-bottom:1px solid #eee;font-weight:bold;">Job</td><td style="padding:6px;border-bottom:1px solid #eee;">${jobName || jobId}</td></tr>
                    <tr><td style="padding:6px;border-bottom:1px solid #eee;font-weight:bold;">Status</td><td style="padding:6px;border-bottom:1px solid #eee;">${jobStatus}</td></tr>
                    <tr><td style="padding:6px;border-bottom:1px solid #eee;font-weight:bold;">Rep</td><td style="padding:6px;border-bottom:1px solid #eee;">${data?.sales_rep_name || 'Unassigned'}</td></tr>
                    <tr><td style="padding:6px;font-weight:bold;">Address</td><td style="padding:6px;">${data?.address_line1 || ''}, ${data?.city || ''}</td></tr>
                  </table>
                  <p style="color:#666;font-size:12px;">A job breakdown sheet has been auto-created.</p>
                </div>
              </div>
            `,
            fromName: 'RCRS JobNimbus',
          }).catch(() => {});
        }
        break;
      }

      case 'estimate.created':
      case 'estimate.updated':
        break;

      case 'note.created':
      case 'activity.created':
        break;

      case 'invoice.created':
      case 'invoice.updated':
        break;

      default:
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('JN webhook error:', error);
    return NextResponse.json(
      { success: false, error: 'Webhook processing error' },
      { status: 500 }
    );
  }
}

/**
 * Auto-create a job breakdown sheet when a JN job hits an approved/signed status.
 * Checks if breakdown already exists for this jobId to prevent duplicates.
 */
async function autoCreateBreakdown(
  data: Record<string, any>,
  customerName: string,
  jobId: string,
  jobName: string,
  repSlug: string,
) {
  // Check if breakdown already exists for this job
  try {
    const existing = await breakdownService.getAllBreakdowns({ customerId: jobId });
    if (existing && existing.length > 0) {
      console.log(`[JN Webhook] Breakdown already exists for job ${jobId}, skipping auto-creation`);
      return;
    }
  } catch {
    // If check fails, proceed with creation (worst case: duplicate, not data loss)
  }

  const address = [data?.address_line1, data?.city, data?.state_text, data?.zip].filter(Boolean).join(', ');

  await breakdownService.createBreakdown({
    customerId: jobId,
    customerName,
    customerEmail: data?.email || '',
    customerPhone: data?.mobile_phone || data?.home_phone || '',
    customerAddress: data?.address_line1 || '',
    customerCity: data?.city || '',
    customerState: data?.state_text || 'AL',
    customerZip: data?.zip || '',
    jobId,
    jobNimbusId: data?.jnid || jobId,
    jobName: jobName || `${customerName} — ${address}`,
    jobAddress: address,
    jobDescription: `Auto-created from JobNimbus. Status: ${data?.status || 'approved'}. Rep: ${data?.sales_rep_name || 'unassigned'}`,
    projectManager: 'system',
    projectManagerName: 'Auto-Generated',
    createdBy: 'jobnimbus-webhook',
    createdByName: 'JobNimbus Webhook',
  });

  console.log(`[JN Webhook] Auto-created breakdown for job ${jobId}: ${jobName}`);

  auditLog(
    'BREAKDOWN_AUTO_CREATED',
    'jobnimbus-webhook',
    `Auto-created breakdown for ${customerName} — Job: ${jobName || jobId} — Status: ${data?.status}`,
  );
}

// ─── Deposit webhook → CustomerBreakdown draft auto-create ────────────────
//
// When JN fires a deposit-related event we create a draft CustomerBreakdown
// pre-populated with customer info from JN. The office fills in totals later.
//
// Idempotent: checked via getBreakdownByRNumber(rNumber). If one already exists
// for the job's R-number, we skip.

/**
 * Decide whether a webhook payload represents a "deposit received" event.
 * JN uses a few different shapes for this:
 *   - event: 'job.status_changed' where new status contains "deposit"
 *   - type:  'task.created' where the task title/type contains "deposit"
 *   - type:  'payment.received' (any variant)
 *   - data.customFields.depositReceived truthy
 */
function isDepositEvent(
  eventType: string,
  body: Record<string, any>,
  data: Record<string, any>,
): boolean {
  const ev = (eventType || '').toLowerCase();

  // Payment events — any payment.* event is a strong signal.
  // Also catches 'payment_received', 'payment.created', etc.
  if (ev.startsWith('payment')) return true;
  if (ev.includes('deposit')) return true;  // e.g. 'deposit.received'

  // Match deposit-related status across the common JN lifecycle phrasings:
  //   "Deposit Received", "Deposited", "Down Payment", "Signed — Deposit",
  //   "Scheduled - Deposit In", etc.
  const depositStatusRe = /deposit|down\s*pay|sign.*deposit|scheduled.*deposit/i;

  // job.status_changed / job.updated with a deposit-bearing status
  if (ev === 'job.status_changed' || ev === 'job.updated' || ev === 'job.created') {
    const candidateStatuses: string[] = [];
    const pushIfString = (v: unknown) => {
      if (typeof v === 'string' && v.trim()) candidateStatuses.push(v);
    };
    pushIfString(body?.new_status);
    pushIfString(body?.old_status);
    pushIfString(data?.new_status);
    pushIfString(data?.status);
    pushIfString(data?.status_name);
    pushIfString(data?.record_type_name);
    pushIfString(data?.workflow_stage);
    for (const s of candidateStatuses) {
      if (depositStatusRe.test(s)) return true;
    }
  }

  // task.created / task.updated with a deposit-related title/type/description.
  // Includes workflow tasks (e.g. "Collect Deposit", "Deposit Received").
  if (ev === 'task.created' || ev === 'task.updated' || ev === 'task.completed') {
    const title = `${data?.title || ''} ${data?.type || ''} ${data?.description || ''} ${data?.record_type_name || ''} ${data?.name || ''}`;
    if (depositStatusRe.test(title)) return true;
    // Task completion with a positive amount is ALSO a deposit signal
    if (ev === 'task.completed' && Number(data?.amount || 0) > 0 && depositStatusRe.test(title)) {
      return true;
    }
  }

  // estimate.signed — in JN this means the customer accepted the estimate,
  // which is effectively a deposit trigger for jobs that require one
  if (ev === 'estimate.signed' || ev === 'estimate.approved') return true;

  // Custom field flag — supports several field name conventions
  const customFields = data?.customFields || data?.custom_fields || data?.custom || {};
  if (customFields && typeof customFields === 'object') {
    const candidates = [
      customFields.depositReceived,
      customFields.deposit_received,
      customFields['Deposit Received'],
      customFields['deposit-received'],
      customFields.depositPaid,
      customFields['Deposit Paid'],
      customFields.downPayment,
      customFields['Down Payment'],
    ];
    for (const flag of candidates) {
      if (flag === true || flag === 'true' || flag === 1 || flag === '1') return true;
      if (typeof flag === 'string' && /^(yes|y|paid|received|true)$/i.test(flag.trim())) return true;
      // Treat any non-zero numeric amount as a deposit signal
      if (typeof flag === 'number' && flag > 0) return true;
    }
  }

  return false;
}

/**
 * Auto-create a draft CustomerBreakdown in response to a JN deposit webhook.
 * Everything is wrapped in try/catch — webhook MUST return 200 regardless.
 */
async function handleDepositWebhook(
  data: Record<string, any>,
  body: Record<string, any>,
): Promise<void> {
  try {
    // Extract job identifiers from the payload. The payload shape varies by
    // event type, so we probe multiple candidate fields.
    // For task/payment events the related job is usually under data.related
    // or data.primary or data.job_number.
    const jnJobId: string =
      (typeof data?.jnid === 'string' && data.jnid)
      || (typeof data?.job_jnid === 'string' && data.job_jnid)
      || (typeof data?.related?.jnid === 'string' && data.related.jnid)
      || (typeof data?.primary?.id === 'string' && data.primary.id)
      || '';

    let jnJobNumber: string =
      (typeof data?.number === 'string' && data.number)
      || (typeof data?.job_number === 'string' && data.job_number)
      || (typeof data?.related?.number === 'string' && data.related.number)
      || '';

    if (!jnJobNumber && !jnJobId) {
      console.warn('[webhook] deposit event missing both jnJobId and jnJobNumber, skipping');
      return;
    }

    // Fetch the full job from JN. Prefer by number (canonical R-number);
    // fall back to by-id if we only have jnid.
    let jnJob: Record<string, any> | null = null;
    if (jnJobNumber) {
      try {
        jnJob = await jobNimbusService.getJobByNumber(jnJobNumber) as Record<string, any> | null;
      } catch (err) {
        console.warn(`[webhook] getJobByNumber(${jnJobNumber}) failed:`, err);
      }
    }
    if (!jnJob && jnJobId) {
      try {
        jnJob = await jobNimbusService.getJob(jnJobId) as Record<string, any> | null;
      } catch (err) {
        console.warn(`[webhook] getJob(${jnJobId}) failed:`, err);
      }
    }

    // If JN lookup failed, fall back to the webhook payload itself — it often
    // contains enough data to build the draft. Never abort on lookup failure.
    const job: Record<string, any> = jnJob || data;
    const rNumber: string =
      (typeof job?.number === 'string' && job.number)
      || jnJobNumber
      || '';

    if (!rNumber) {
      console.warn('[webhook] deposit event could not resolve rNumber, skipping');
      return;
    }

    // Idempotency check — skip if breakdown already exists for this rNumber
    try {
      const existing = await getBreakdownByRNumber(rNumber);
      if (existing) {
        console.log(`[webhook] breakdown already exists for ${rNumber}, skipping deposit auto-create`);
        return;
      }
    } catch (err) {
      // If the check fails, continue — worst case is a duplicate, not data loss.
      console.warn(`[webhook] getBreakdownByRNumber(${rNumber}) lookup failed, proceeding:`, err);
    }

    // Enrich with contact data if we have a contact jnid but no email/phone yet.
    const contactJnid: string =
      (typeof job?.primary?.id === 'string' && job.primary.id)
      || (typeof job?.primary_id === 'string' && job.primary_id)
      || '';

    let contact: Record<string, any> | null = null;
    if (contactJnid) {
      try {
        contact = await jobNimbusService.getContact(contactJnid) as Record<string, any> | null;
      } catch (err) {
        console.warn(`[webhook] getContact(${contactJnid}) failed:`, err);
      }
    }

    // Build display name preferring contact, then job fields
    const customerName: string =
      (contact?.display_name as string)
      || `${contact?.first_name || ''} ${contact?.last_name || ''}`.trim()
      || (job?.display_name as string)
      || `${job?.first_name || ''} ${job?.last_name || ''}`.trim()
      || (job?.name as string)
      || 'Unknown Customer';

    // Address: prefer job's address, fall back to contact's
    const addressLine1 = job?.address_line1 || contact?.address_line1 || '';
    const city = job?.city || contact?.city || '';
    const state = job?.state_text || contact?.state_text || '';
    const zip = job?.zip || contact?.zip || '';
    const address = [addressLine1, city, state, zip].filter(Boolean).join(', ');

    const now = new Date().toISOString();
    const breakdownId = generateBreakdownId();

    const breakdown: CustomerBreakdown = {
      breakdownId,
      rNumber,
      jnJobId: (job?.jnid as string) || jnJobId || '',
      jnJobNumber: (job?.number as string) || rNumber,
      customerName,
      address,
      salesRep: (job?.sales_rep_name as string) || '',
      inspector: '',
      dateInstalled: '',
      jobTotal: 0,
      permit: 0,
      otherCosts: [],
      materials: [],
      labor: [],
      paymentsIn: [],
      commissionsPaid: { revisions: [] },
      notes: 'Auto-created on JobNimbus deposit webhook. Office to fill in totals.',
      status: 'draft',
      createdAt: now,
      updatedAt: now,
      createdBy: 'jobnimbus-webhook',
    };

    // Compute initial totals (all zeros, but the service still expects them)
    let savedOk = false;
    try {
      const config = await loadDropdownConfig();
      const totals = calculateTotals(breakdown, config);
      savedOk = await saveBreakdown(breakdown, totals);
    } catch (err) {
      console.error(`[webhook] failed to compute/save breakdown for ${rNumber}:`, err);
      return;
    }

    if (!savedOk) {
      console.error(`[webhook] saveBreakdown returned false for ${rNumber}`);
      return;
    }

    console.log(`[webhook] Auto-created breakdown ${breakdownId} for ${rNumber} on deposit`);

    auditLog(
      'BREAKDOWN_AUTO_CREATED_DEPOSIT',
      'jobnimbus-webhook',
      `Deposit-triggered breakdown draft ${breakdownId} for ${rNumber} (${customerName})`,
    );

    // Notify office of the new draft. stock@rcrsal.com is reserved for
    // inventory / stock / material-order emails ONLY (see
    // project_rcrs_stock_workflow). Breakdown drafts are an office concern,
    // so this routes to Sara's office inbox.
    try {
      await emailService.send({
        to: 'rcrs@rcrsal.com',
        subject: `New breakdown draft: ${rNumber} - ${customerName}`,
        body: `
          <div style="font-family:Arial,sans-serif;max-width:500px;margin:0 auto;">
            <div style="background:#000;padding:16px;text-align:center;">
              <h2 style="color:#39FF14;margin:0;">New Breakdown Draft</h2>
            </div>
            <div style="padding:20px;background:#fff;">
              <p>A deposit was received on JobNimbus and a draft breakdown has been auto-created.</p>
              <table style="width:100%;border-collapse:collapse;margin:12px 0;">
                <tr><td style="padding:6px;border-bottom:1px solid #eee;font-weight:bold;">R-Number</td><td style="padding:6px;border-bottom:1px solid #eee;">${rNumber}</td></tr>
                <tr><td style="padding:6px;border-bottom:1px solid #eee;font-weight:bold;">Customer</td><td style="padding:6px;border-bottom:1px solid #eee;">${customerName}</td></tr>
                <tr><td style="padding:6px;border-bottom:1px solid #eee;font-weight:bold;">Address</td><td style="padding:6px;border-bottom:1px solid #eee;">${address || 'n/a'}</td></tr>
                <tr><td style="padding:6px;border-bottom:1px solid #eee;font-weight:bold;">Sales Rep</td><td style="padding:6px;border-bottom:1px solid #eee;">${breakdown.salesRep || 'unassigned'}</td></tr>
                <tr><td style="padding:6px;font-weight:bold;">Breakdown ID</td><td style="padding:6px;">${breakdownId}</td></tr>
              </table>
              <p style="color:#666;font-size:12px;">Office to fill in totals, materials, labor, and payments.</p>
            </div>
          </div>
        `,
        fromName: 'RCRS JobNimbus',
      });
    } catch (err) {
      // Email failure must not propagate — we've already saved the breakdown.
      console.warn(`[webhook] stock notification email failed for ${rNumber}:`, err);
    }
  } catch (err) {
    // Absolute outer catch — webhook processing must never throw to the caller
    console.error('[webhook] handleDepositWebhook unexpected error:', err);
  }
}
