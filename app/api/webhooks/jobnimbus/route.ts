import { NextRequest, NextResponse } from 'next/server';
import { geocodeAndSaveContact } from '@/lib/geocode-sync';
import { matchRepToTeamMember, JN_TO_PORTAL_STATUS } from '@/lib/jn-sync-engine';
import { breakdownService } from '@/lib/breakdown-service';
import { emailService } from '@/lib/email-service';
import { auditLog } from '@/lib/audit-logger';
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
