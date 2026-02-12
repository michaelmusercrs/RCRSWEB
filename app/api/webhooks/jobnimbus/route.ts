import { NextRequest, NextResponse } from 'next/server';
import { geocodeAndSaveContact } from '@/lib/geocode-sync';
import { matchRepToTeamMember, JN_TO_PORTAL_STATUS } from '@/lib/jn-sync-engine';
import crypto from 'crypto';

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

    console.log(`JN Webhook received: ${event}`, { jnid: data?.jnid });

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
            console.log(`JN contact ${data.jnid} matched to rep: ${teamMember.name} (${teamMember.slug})`);
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
              console.log(`Geocoded JN contact ${data.jnid}: ${result.lat}, ${result.lng}`);
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
        console.log(`Job ${event}: ${data?.jnid} - JN Status: ${data?.status} -> Portal: ${portalStatus}`);

        // Match sales rep
        if (data?.sales_rep_name) {
          const teamMember = matchRepToTeamMember(data.sales_rep_name);
          if (teamMember) {
            console.log(`JN job ${data.jnid} matched to rep: ${teamMember.name} (${teamMember.slug})`);
          }
        }
        break;
      }

      case 'estimate.created':
      case 'estimate.updated':
        console.log(`Estimate ${event}: ${data?.jnid} - Total: $${data?.total || 0}`);
        break;

      case 'note.created':
      case 'activity.created':
        console.log(`Activity ${event}: ${data?.jnid} on contact ${data?.primary?.jnid}`);
        break;

      case 'invoice.created':
      case 'invoice.updated':
        console.log(`Invoice ${event}: ${data?.jnid} - Amount: $${data?.amount || 0}`);
        break;

      default:
        console.log(`Unhandled JN webhook event: ${event}`);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('JN webhook error:', error);
    // Return 500 so JobNimbus knows the webhook failed and can retry.
    // Returning 200 on error silently swallows failures.
    return NextResponse.json(
      { success: false, error: 'Webhook processing error' },
      { status: 500 }
    );
  }
}
