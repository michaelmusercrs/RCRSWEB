// New Lead API Route
// Processes new leads: spam filter → log to sheet → notify office staff → scan JN for matches
// NO auto-assignment. Office staff (Tia/Destin/Sara) review and manually enter into lead distribution.

import { NextRequest, NextResponse } from 'next/server';
import {
  createContactFormRateLimiter,
  createGlobalFormRateLimiter,
  withRateLimit,
} from '@/lib/rate-limiter-kv';
import { requireAuth } from '@/lib/auth-service';
import { auditLog } from '@/lib/audit-logger';
import { portalGenerator, LeadData } from '@/lib/portal-generator';
import { leadPortalService } from '@/lib/lead-portal-service';
import { teamMembers } from '@/lib/teamData';
import { geocodingService, GeocodedContact } from '@/lib/geocoding-service';
import { geocodeAndSaveContact } from '@/lib/geocode-sync';
import { googleSheetsService } from '@/lib/google-sheets-service';
import { leadPipelineOrchestrator } from '@/lib/lead-pipeline-orchestrator';
import { emailService } from '@/lib/email-service';
import { riverBot } from '@/lib/river-bot-service';
import { stormReportService } from '@/lib/storm-report-service';
import { jnSyncEngine } from '@/lib/jn-sync-engine';
import { isJobNimbusConfigured, jobNimbusService } from '@/lib/jobnimbus-service';
import { roofReportService } from '@/lib/roof-report-service';
import { checkForSpam } from '@/lib/spam-filter';
import { checkHoneypot } from '@/lib/honeypot';
import { verifyTurnstileToken, getRequestIp } from '@/lib/turnstile';
import { logSpamBlock } from '@/lib/spam-log';

// Rate limit: 3/hr per IP via shared KV contact-form bucket, plus the
// cross-form 15/hr global cap.
const leadRateLimiter = createContactFormRateLimiter();
const globalFormRateLimiter = createGlobalFormRateLimiter();

// Office staff + Michael who receive new lead notifications
const OFFICE_NOTIFY_EMAILS = [
  'michaelmuse@rcrsal.com',
  'sara@rcrsal.com',
  'destin@rcrsal.com',
  'tia@rcrsal.com',
];

interface NewLeadRequest {
  // Required fields
  name: string;
  email: string;
  phone: string;
  address: string;

  // Optional address components
  city?: string;
  state?: string;
  zip?: string;

  // Source tracking
  source: 'contact_form' | 'jobnimbus' | 'phone_call' | 'referral' | 'walk_in' | 'other' | 'email_capture';
  sourceDetails?: string;
  sourcePage?: string;

  // Sales rep preference (used when office manually distributes)
  preferredRepSlug?: string;
  assignedRepSlug?: string;

  // Additional info
  serviceType?: string;
  message?: string;
  urgency?: 'low' | 'normal' | 'high' | 'emergency';

  // JobNimbus integration
  jobnimbusId?: string;
  jobnimbusContactId?: string;

  // Options
  sendNotifications?: boolean;
  notifyTeam?: boolean;
}

function sanitizeInput(str: string | undefined): string {
  if (!str) return '';
  return str.replace(/<[^>]*>/g, '').trim();
}

export async function POST(request: NextRequest) {
  // Check the cross-form global cap first so a hot IP can't burn its
  // per-form budget before tripping the global cap.
  return withRateLimit(request, globalFormRateLimiter, async () =>
    withRateLimit(request, leadRateLimiter, async () => {
  try {
    let body: NewLeadRequest;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { success: false, error: 'Invalid request body' },
        { status: 400 }
      );
    }

    // Honeypot check — silently drop bot submissions before any real work
    // (including the spam-filter pre-gate below). Returns the generic
    // success shape so bots can't probe what worked.
    const hp = checkHoneypot(body);
    if (hp.triggered) {
      console.warn('[HONEYPOT TRIGGERED route=leads/new]', { value: hp.value });
      logSpamBlock({
        gate: 'honeypot',
        route: '/api/leads/new',
        ip: getRequestIp(request),
        reason: 'website field populated',
        details: JSON.stringify({ value: hp.value }),
        submitterEmail: typeof body?.email === 'string' ? body.email : undefined,
        submitterName: typeof body?.name === 'string' ? body.name : undefined,
      }).catch(() => {});
      return NextResponse.json({ success: true });
    }

    // Sanitize text inputs to strip HTML/XSS vectors
    body.name = sanitizeInput(body.name);
    body.address = sanitizeInput(body.address);
    body.message = sanitizeInput(body.message) || undefined;
    body.sourceDetails = sanitizeInput(body.sourceDetails) || undefined;

    // Validate required fields (address is optional for quick forms)
    if (!body.name || !body.email) {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing required fields',
          required: ['name', 'email'],
        },
        { status: 400 }
      );
    }

    // Validate max field lengths
    const MAX_LENGTHS: Record<string, number> = { name: 200, email: 254, phone: 50, address: 500, message: 5000, sourceDetails: 500 };
    for (const [field, max] of Object.entries(MAX_LENGTHS)) {
      const value = body[field as keyof NewLeadRequest];
      if (typeof value === 'string' && value.length > max) {
        return NextResponse.json(
          { success: false, error: `${field} exceeds maximum length of ${max} characters` },
          { status: 400 }
        );
      }
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(body.email)) {
      return NextResponse.json(
        { success: false, error: 'Invalid email format' },
        { status: 400 }
      );
    }

    // Validate source
    const validSources = ['contact_form', 'jobnimbus', 'phone_call', 'referral', 'walk_in', 'other', 'email_capture'];
    if (body.source && !validSources.includes(body.source)) {
      body.source = 'other';
    }
    if (!body.source) body.source = 'contact_form';

    // ── SPAM FILTER ──────────────────────────────────────────────────────
    const spamResult = await checkForSpam({
      name: body.name,
      email: body.email,
      phone: body.phone,
      message: body.message,
      address: body.address,
    });

    // ── LOG EVERYTHING TO SHEET (spam or not) ────────────────────────────
    // All submissions get logged with full metadata for audit trail
    const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown';
    const userAgent = request.headers.get('user-agent') || '';
    const referer = request.headers.get('referer') || '';
    const timestamp = new Date().toISOString();

    try {
      const { GoogleSpreadsheet } = await import('google-spreadsheet');
      const { JWT } = await import('google-auth-library');
      const auth = new JWT({
        email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
        key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
        scopes: ['https://www.googleapis.com/auth/spreadsheets'],
      });
      const doc = new GoogleSpreadsheet(process.env.GOOGLE_SHEETS_ID!, auth);
      await doc.loadInfo();

      let allLeadsSheet = doc.sheetsByTitle['All Lead Submissions'];
      if (!allLeadsSheet) {
        allLeadsSheet = await doc.addSheet({
          title: 'All Lead Submissions',
          headerValues: [
            'Timestamp', 'Lead ID', 'Name', 'Email', 'Phone', 'Address',
            'City', 'State', 'Zip', 'Source', 'Source Details', 'Source Page',
            'Service Type', 'Message', 'Urgency',
            'Spam Score', 'Spam Reasons', 'Is Spam', 'Passed Filter',
            'IP Address', 'User Agent', 'Referer',
            'JN Match Found', 'JN Match ID', 'JN Match Name', 'JN Match Type',
            'Duplicate Found', 'Duplicate Match By',
            'County', 'Status',
          ],
        });
      }

      // We'll fill JN matches after the scan below
      await allLeadsSheet.addRow({
        Timestamp: timestamp,
        'Lead ID': `LEAD-${Date.now()}`,
        Name: body.name,
        Email: body.email,
        Phone: body.phone || '',
        Address: body.address || '',
        City: body.city || '',
        State: body.state || '',
        Zip: body.zip || '',
        Source: body.source,
        'Source Details': body.sourceDetails || '',
        'Source Page': body.sourcePage || '',
        'Service Type': body.serviceType || '',
        Message: body.message || '',
        Urgency: body.urgency || 'normal',
        'Spam Score': spamResult.spamScore.toString(),
        'Spam Reasons': spamResult.reasons.join('; '),
        'Is Spam': spamResult.isSpam ? 'YES' : 'NO',
        'Passed Filter': spamResult.passedFilter ? 'YES' : 'NO',
        'IP Address': ip,
        'User Agent': userAgent.substring(0, 200),
        Referer: referer,
        'JN Match Found': '',
        'JN Match ID': '',
        'JN Match Name': '',
        'JN Match Type': '',
        'Duplicate Found': '',
        'Duplicate Match By': '',
        County: '',
        Status: spamResult.isSpam ? 'spam' : 'new',
      });
    } catch (logErr) {
      console.error('[NewLead] Sheet logging failed:', logErr);
    }

    // If spam, stop here — logged but no further processing.
    // Return a minimal generic 200 so bots can't tell they were filtered:
    // no leadId, no spamScore, no `filtered: true` flag. Match the shape
    // of the legit response surface but omit data that would let an
    // attacker probe the filter.
    if (spamResult.isSpam) {
      console.warn('[LEADS NEW SPAM BLOCKED]', {
        email: body.email, score: spamResult.spamScore, reasons: spamResult.reasons,
      });
      return NextResponse.json({ success: true });
    }

    // Cloudflare Turnstile — bot fingerprint challenge. INERT until env vars
    // are set (see lib/turnstile.ts header). Explicit 400 on failure so legit
    // users can retry.
    //
    // Note on inter-route calls: /api/forms/contact, /api/forms/referral,
    // /api/email-capture, and the check-my-address page fan into this route
    // server-side AFTER they've already verified Turnstile. Those callers
    // pass turnstileToken: 'disabled' so this verifier short-circuits as
    // "already gated upstream" — Cloudflare tokens are single-use, so we
    // can't re-verify the original token here.
    const turnstileToken =
      (body as unknown as { turnstileToken?: string }).turnstileToken;
    const turnstile = await verifyTurnstileToken(turnstileToken, getRequestIp(request));
    if (!turnstile.valid) {
      console.warn('[TURNSTILE FAILED route=leads/new]', { reason: turnstile.reason });
      return NextResponse.json(
        { success: false, message: 'Verification failed. Please try again.' },
        { status: 400 }
      );
    }

    // ── GEOCODE ──────────────────────────────────────────────────────────
    const geocoded = body.address ? await geocodingService.geocodeAddress(body.address) : null;

    // ── JN MATCH SCAN ────────────────────────────────────────────────────
    // Search JobNimbus for similar contacts by email, phone, name.
    // This is an UNAUTHENTICATED public submission endpoint — explicit
    // no-cost viewer enforces redaction at the source.
    const publicViewer = { canSeeCost: false };
    let jnMatches: Array<{ jnid: string; displayName: string; matchType: string; phone?: string; email?: string; address?: string }> = [];
    if (isJobNimbusConfigured()) {
      try {
        // Search by email
        if (body.email) {
          const byEmail = await jobNimbusService.searchContactByEmail(body.email, publicViewer).catch(() => null);
          if (byEmail) {
            jnMatches.push({
              jnid: byEmail.jnid,
              displayName: jobNimbusService.getContactName(byEmail),
              matchType: 'email',
              email: byEmail.email,
              phone: byEmail.mobile_phone || byEmail.home_phone || '',
              address: [byEmail.address_line1, byEmail.city, byEmail.state_text].filter(Boolean).join(', '),
            });
          }
        }
        // Search by phone
        if (body.phone && !jnMatches.length) {
          const byPhone = await jobNimbusService.searchContactByPhone(body.phone, publicViewer).catch(() => null);
          if (byPhone) {
            jnMatches.push({
              jnid: byPhone.jnid,
              displayName: jobNimbusService.getContactName(byPhone),
              matchType: 'phone',
              email: byPhone.email,
              phone: byPhone.mobile_phone || byPhone.home_phone || '',
              address: [byPhone.address_line1, byPhone.city, byPhone.state_text].filter(Boolean).join(', '),
            });
          }
        }
      } catch (jnErr) {
        console.warn('[NewLead] JN match scan failed:', jnErr);
      }
    }

    // ── DUPLICATE CHECK (Sheets + JN) ────────────────────────────────────
    const duplicateCheck = await leadPortalService.findDuplicate({
      email: body.email,
      phone: body.phone,
      name: body.name,
      address: body.address,
    });

    if (duplicateCheck.found && duplicateCheck.lead) {
      const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://rivercityroofingsolutions.com';
      return NextResponse.json({
        success: true,
        existing: true,
        message: `Lead already exists (matched by ${duplicateCheck.matchedBy})`,
        data: {
          leadId: duplicateCheck.lead.leadId,
          customerId: duplicateCheck.lead.customerId,
          portalUrl: `${baseUrl}/my/${duplicateCheck.lead.accessToken}`,
          salesRep: {
            name: duplicateCheck.lead.salesRepName,
            slug: duplicateCheck.lead.salesRepSlug,
          },
          matchedBy: duplicateCheck.matchedBy,
          createdAt: duplicateCheck.lead.createdAt,
          jnMatches,
        },
      });
    }

    // If JN match found but no Sheets match, link the JN contact ID
    if (duplicateCheck.jnMatch && !body.jobnimbusContactId) {
      body.jobnimbusContactId = duplicateCheck.jnMatch.jnid;
    }

    // ── CREATE LEAD (no rep assigned yet) ────────────────────────────────
    // Do NOT assign a rep — leads sit unassigned until office staff manually distributes
    const leadData: LeadData = {
      name: body.name,
      email: body.email,
      phone: body.phone || '',
      address: body.address || 'Not provided',
      city: body.city,
      state: body.state,
      zip: body.zip,
      source: body.source,
      sourceDetails: body.sourceDetails,
      preferredRepSlug: body.preferredRepSlug,
      assignedRepSlug: undefined, // NO auto-assignment
      serviceType: body.serviceType,
      message: body.message,
      urgency: body.urgency,
      jobnimbusId: body.jobnimbusId,
      jobnimbusContactId: body.jobnimbusContactId,
    };

    const portalResult = await portalGenerator.generatePortalForLead(leadData);

    if (!portalResult.success || !portalResult.portalAccess) {
      return NextResponse.json(
        { success: false, error: portalResult.error || 'Failed to generate portal' },
        { status: 500 }
      );
    }

    const lead = await leadPortalService.createLead({
      portalAccess: portalResult.portalAccess,
      shortCode: portalResult.shortCode!,
      source: body.source,
      sourceDetails: body.sourceDetails,
      serviceType: body.serviceType,
      message: body.message,
      jobnimbusId: body.jobnimbusId,
      jobnimbusContactId: body.jobnimbusContactId,
    });

    // ── GEOCODE & SAVE (fire-and-forget) ─────────────────────────────────
    if (body.address && body.address !== 'Not provided') {
      const fullAddress = [body.address, body.city, body.state, body.zip].filter(Boolean).join(', ');
      geocodeAndSaveContact({
        id: lead.leadId || `lead-${Date.now()}`,
        name: body.name,
        address: fullAddress,
        salesRep: '', // No rep assigned yet
        type: 'lead',
        status: 'new',
      }).catch(err => {
        console.warn(`[NewLead] Geocode save failed for ${body.name}:`, err);
      });
    }

    // ── ADDRESS INTELLIGENCE (fire-and-forget enrichment) ────────────────
    let addressIntel = null;
    if (geocoded) {
      try {
        const contactRecords = await googleSheetsService.getGeocodedContacts();
        const contacts: GeocodedContact[] = contactRecords
          .filter(c => c.lat && c.lng)
          .map(c => ({
            jnid: c.jnid,
            name: c.name,
            address: c.address,
            lat: parseFloat(c.lat),
            lng: parseFloat(c.lng),
            placeId: c.placeId,
            type: c.type as GeocodedContact['type'],
            salesRep: c.salesRep,
            jobStatus: c.jobStatus,
            lastInteraction: c.lastInteraction,
            interactionType: c.interactionType,
            createdAt: c.createdAt,
          }));
        addressIntel = await geocodingService.getAddressIntelligence(body.address, contacts);
      } catch (err) {
        console.warn('[NewLead] Address intelligence failed:', err);
      }
    }

    // ── AUTO-GENERATE STORM REPORT (fire-and-forget) ─────────────────────
    const stormReportCity = body.city || geocoded?.components?.city || '';
    const stormReportState = body.state || geocoded?.components?.state || 'AL';
    const stormReportZip = body.zip || geocoded?.components?.zip || '';

    if (stormReportCity && stormReportZip) {
      stormReportService.generateReport({
        address: body.address || '',
        city: stormReportCity,
        state: stormReportState,
        zip: stormReportZip,
        leadId: lead.leadId,
        customerId: lead.customerId,
      }).catch(err => {
        console.warn(`[Lead ${lead.leadId}] Auto storm report failed:`, err);
      });
    }

    // ── AUTO-GENERATE ROOF REPORT (fire-and-forget) ──────────────────────
    if (body.address && body.address !== 'Not provided') {
      roofReportService.generateReport({
        address: body.address,
        leadId: lead.leadId,
        customerId: lead.customerId,
      }).catch(err => {
        console.warn(`[Lead ${lead.leadId}] Auto roof report failed:`, err);
      });
    }

    // ── NOTIFY OFFICE STAFF (Tia, Destin, Sara) ─────────────────────────
    // Email all office staff about the new lead. NO rep notifications, NO customer notifications.
    // Customer notifications happen AFTER office staff processes and distributes the lead.
    const officeNotifyPromises: Promise<any>[] = [];

    const newLeadEmailBody = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #000; padding: 20px; text-align: center;">
          <h1 style="color: #39FF14; margin: 0;">New Lead Received</h1>
          <p style="color: #ccc; margin: 5px 0 0 0;">Action Required — Review &amp; Distribute</p>
        </div>
        <div style="padding: 30px; background: #fff;">
          <table style="width: 100%; border-collapse: collapse;">
            <tr><td style="padding: 10px; border-bottom: 1px solid #eee; font-weight: bold; width: 120px;">Name</td><td style="padding: 10px; border-bottom: 1px solid #eee;">${body.name}</td></tr>
            <tr><td style="padding: 10px; border-bottom: 1px solid #eee; font-weight: bold;">Email</td><td style="padding: 10px; border-bottom: 1px solid #eee;"><a href="mailto:${body.email}">${body.email}</a></td></tr>
            <tr><td style="padding: 10px; border-bottom: 1px solid #eee; font-weight: bold;">Phone</td><td style="padding: 10px; border-bottom: 1px solid #eee;"><a href="tel:${body.phone || ''}">${body.phone || 'Not provided'}</a></td></tr>
            <tr><td style="padding: 10px; border-bottom: 1px solid #eee; font-weight: bold;">Address</td><td style="padding: 10px; border-bottom: 1px solid #eee;">${body.address || 'Not provided'}</td></tr>
            <tr><td style="padding: 10px; border-bottom: 1px solid #eee; font-weight: bold;">Source</td><td style="padding: 10px; border-bottom: 1px solid #eee;">${body.source}${body.sourceDetails ? ` — ${body.sourceDetails}` : ''}</td></tr>
            <tr><td style="padding: 10px; border-bottom: 1px solid #eee; font-weight: bold;">Service</td><td style="padding: 10px; border-bottom: 1px solid #eee;">${body.serviceType || 'General'}</td></tr>
            ${body.message ? `<tr><td style="padding: 10px; border-bottom: 1px solid #eee; font-weight: bold;">Message</td><td style="padding: 10px; border-bottom: 1px solid #eee;">${body.message}</td></tr>` : ''}
            ${geocoded?.components?.county ? `<tr><td style="padding: 10px; border-bottom: 1px solid #eee; font-weight: bold;">County</td><td style="padding: 10px; border-bottom: 1px solid #eee;">${geocoded.components.county}</td></tr>` : ''}
          </table>
          ${jnMatches.length > 0 ? `
            <div style="margin-top: 20px; padding: 15px; background: #fff3cd; border: 1px solid #ffc107; border-radius: 8px;">
              <strong>JobNimbus Match Found:</strong><br>
              ${jnMatches.map(m => `${m.displayName} (matched by ${m.matchType}) — ${m.address || 'no address'}`).join('<br>')}
            </div>
          ` : ''}
          <div style="text-align: center; margin: 25px 0;">
            <a href="${process.env.NEXT_PUBLIC_PORTAL_URL || 'https://rcrsal.com'}/command-center/leads" style="background: #39FF14; color: #000; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px;">
              Review &amp; Distribute Lead
            </a>
          </div>
        </div>
        <div style="background: #f5f5f5; padding: 15px; text-align: center; font-size: 12px; color: #666;">
          Lead ID: ${lead.leadId} | ${timestamp}
        </div>
      </div>`;

    for (const officeEmail of OFFICE_NOTIFY_EMAILS) {
      officeNotifyPromises.push(
        emailService.send({
          to: officeEmail,
          subject: `New Lead: ${body.name} — ${body.serviceType || body.source}`,
          body: newLeadEmailBody,
          fromName: 'RCRS New Leads',
        }).catch(err => {
          console.warn(`[Lead ${lead.leadId}] Office notify failed for ${officeEmail}:`, err);
        })
      );
    }

    // Also notify via GroupMe so office sees it immediately
    officeNotifyPromises.push(
      riverBot.notifyNewLead({
        leadName: body.name,
        leadId: lead.leadId,
        address: body.address || 'Not provided',
        source: body.source,
        assignedRep: 'UNASSIGNED — Needs Review',
        assignedRepEmail: '',
        riskScore: undefined,
        portalUrl: `${process.env.NEXT_PUBLIC_PORTAL_URL || 'https://rcrsal.com'}/command-center/leads`,
      }).catch(err => {
        console.warn(`[Lead ${lead.leadId}] GroupMe notification failed:`, err);
      })
    );

    // Fire all office notifications without blocking response
    Promise.allSettled(officeNotifyPromises).catch(() => {});

    auditLog('LEAD_CREATE', body.email, `New lead: ${body.name} (${body.source}), address: ${body.address || 'N/A'}`, request);

    return NextResponse.json({
      success: true,
      data: {
        leadId: lead.leadId,
        customerId: lead.customerId,
        accessToken: portalResult.portalAccess.accessToken,
        shortCode: portalResult.shortCode,
        portalUrl: portalResult.portalUrl,
        qrCodeUrl: portalResult.qrCodeUrl,

        // Geocoded data
        county: geocoded?.components?.county,
        addressIntel,

        // Storm/roof reports generating in background
        stormReport: {
          status: stormReportCity && stormReportZip ? 'generating' : 'skipped',
          fetchUrl: `/api/leads/${lead.leadId}/storm-report`,
        },
        roofReport: {
          status: body.address && body.address !== 'Not provided' ? 'generating' : 'skipped',
          fetchUrl: `/api/leads/${lead.leadId}/roof-report`,
        },

        // NO rep assigned — office staff will distribute manually
        salesRep: null,
        status: 'unassigned',

        // JN matches for office portal to display
        jnMatches,
        duplicateCheck: duplicateCheck.found ? {
          matchedBy: duplicateCheck.matchedBy,
          jnMatch: duplicateCheck.jnMatch,
        } : null,

        // Spam filter results (for admin visibility)
        spamFilter: {
          score: spamResult.spamScore,
          passed: spamResult.passedFilter,
          reasons: spamResult.reasons,
        },

        createdAt: lead.createdAt,
      },
    });

  } catch (error) {
    console.error('Error processing new lead:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
      },
      { status: 500 }
    );
  }
  })
  );
}

// GET - Retrieve leads (admin use)
export async function GET(request: NextRequest) {
  const auth = await requireAuth();
  if (!auth.authenticated) return auth.response;

  try {
    const { searchParams } = new URL(request.url);

    // Optional filters
    const status = searchParams.get('status') as any;
    const source = searchParams.get('source');
    const salesRepSlug = searchParams.get('salesRep');
    const fromDate = searchParams.get('from');
    const toDate = searchParams.get('to');
    const limit = searchParams.get('limit');

    const leads = await leadPortalService.getLeads({
      status,
      source: source || undefined,
      salesRepSlug: salesRepSlug || undefined,
      fromDate: fromDate || undefined,
      toDate: toDate || undefined,
      limit: limit ? parseInt(limit) : undefined,
    });

    // Get statistics if requested
    const includeStats = searchParams.get('includeStats') === 'true';
    let stats = null;
    if (includeStats) {
      stats = await leadPortalService.getLeadStats(fromDate || undefined, toDate || undefined);
    }

    return NextResponse.json({
      success: true,
      count: leads.length,
      data: leads.map(lead => ({
        ...lead,
        // Remove sensitive token from list view
        accessToken: lead.accessToken ? lead.accessToken.substring(0, 8) + '...' : '',
        activityLog: undefined,
      })),
      stats,
    });

  } catch (error) {
    console.error('Error fetching leads:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
      },
      { status: 500 }
    );
  }
}
