// New Lead API Route
// Processes new leads and auto-generates customer portals
// Sends portal link to customer via email + SMS
// Notifies assigned rep via River bot DM

import { NextRequest, NextResponse } from 'next/server';
import { rateLimit } from '@/lib/rate-limit';
import { requireAuth } from '@/lib/auth-service';
import { portalGenerator, LeadData } from '@/lib/portal-generator';
import { leadPortalService } from '@/lib/lead-portal-service';
import { groupMeService, getGroupMeConfigFromEnv } from '@/lib/groupme-service';
import { teamMembers } from '@/lib/teamData';
import { geocodingService, GeocodedContact } from '@/lib/geocoding-service';
import { geocodeAndSaveContact } from '@/lib/geocode-sync';
import { googleSheetsService } from '@/lib/google-sheets-service';
import { leadDistributionService } from '@/lib/lead-distribution-service';
import { leadResponseTimerService } from '@/lib/lead-response-timer';
import { leadPipelineOrchestrator } from '@/lib/lead-pipeline-orchestrator';
import { emailService } from '@/lib/email-service';
import { smsService } from '@/lib/sms-service';
import { riverBot } from '@/lib/river-bot-service';
import { stormReportService } from '@/lib/storm-report-service';
import { notificationService } from '@/lib/notification-service';
import { jnSyncEngine } from '@/lib/jn-sync-engine';
import { isJobNimbusConfigured } from '@/lib/jobnimbus-service';
import { roofReportService } from '@/lib/roof-report-service';

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
  source: 'contact_form' | 'jobnimbus' | 'phone_call' | 'referral' | 'walk_in' | 'other';
  sourceDetails?: string;

  // Sales rep preference
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
  // Rate limit: 5 requests per minute per IP
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
             request.headers.get('x-real-ip') || 'unknown';
  const rl = rateLimit(`leads:new:${ip}`, 5, 60_000);
  if (!rl.allowed) {
    return NextResponse.json(
      { success: false, error: 'Too many requests. Please try again later.' },
      {
        status: 429,
        headers: {
          'Retry-After': String(Math.ceil((rl.resetAt - Date.now()) / 1000)),
          'X-RateLimit-Remaining': '0',
        },
      }
    );
  }

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

    // Sanitize text inputs to strip HTML/XSS vectors
    body.name = sanitizeInput(body.name);
    body.address = sanitizeInput(body.address);
    body.message = sanitizeInput(body.message) || undefined;
    body.sourceDetails = sanitizeInput(body.sourceDetails) || undefined;

    // Validate required fields
    if (!body.name || !body.email || !body.phone || !body.address) {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing required fields',
          required: ['name', 'email', 'phone', 'address'],
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
    const validSources = ['contact_form', 'jobnimbus', 'phone_call', 'referral', 'walk_in', 'other'];
    if (!validSources.includes(body.source)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid source',
          validSources,
        },
        { status: 400 }
      );
    }

    // Geocode the lead address
    const geocoded = await geocodingService.geocodeAddress(body.address);

    // Auto-assign rep via lead distribution if not already assigned
    let distributionResult: { assignedRep: any; allScores: any[]; method: string } | null = null;
    if (!body.assignedRepSlug && geocoded) {
      const distribution = await leadDistributionService.distributeLead(
        body.address,
        body.name,
        'pending', // leadId not yet created
        body.source,
        body.preferredRepSlug
      );
      distributionResult = distribution;
      if (distribution.assignedRep) {
        body.assignedRepSlug = distribution.assignedRep.repSlug;
      }
    }

    // Get address intelligence with real geocoded contacts (fix: was passing empty [])
    let addressIntel = null;
    let pipelineEnrichment = null;
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
        addressIntel = await geocodingService.getAddressIntelligence(body.address, []);
      }

      // Run pipeline enrichment (rep recommendations, nearby jobs) non-blocking
      // Note: Storm report is now auto-generated separately (linked to lead ID)
      // so pipeline enrichment still runs for geocoding + rep scoring
      leadPipelineOrchestrator.processNewLead({
        address: body.address,
        city: body.city,
        state: body.state,
        zip: body.zip,
        name: body.name,
        source: body.source,
        referralRepSlug: body.preferredRepSlug,
      }).then(result => {
        if (result.enrichment.stormReport) {
          // Store pipeline enrichment data for later reference
          pipelineEnrichment = result.enrichment;
        }
      }).catch(err => {
        console.warn('[NewLead] Pipeline enrichment failed:', err);
      });
    }

    // Comprehensive duplicate detection: check email, phone, name+address in Sheets AND JobNimbus
    const duplicateCheck = await leadPortalService.findDuplicate({
      email: body.email,
      phone: body.phone,
      name: body.name,
      address: body.address,
    });

    if (duplicateCheck.found) {
      const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://rivercityroofingsolutions.com';

      // If we found a lead in our Sheets
      if (duplicateCheck.lead) {
        return NextResponse.json({
          success: true,
          existing: true,
          message: `Lead already exists (matched by ${duplicateCheck.matchedBy})`,
          data: {
            leadId: duplicateCheck.lead.leadId,
            customerId: duplicateCheck.lead.customerId,
            portalUrl: `${baseUrl}/my/${duplicateCheck.lead.accessToken}`,
            qrCodeUrl: `${baseUrl}/api/portal/qr/${duplicateCheck.lead.accessToken}`,
            salesRep: {
              name: duplicateCheck.lead.salesRepName,
              slug: duplicateCheck.lead.salesRepSlug,
            },
            matchedBy: duplicateCheck.matchedBy,
            createdAt: duplicateCheck.lead.createdAt,
          },
        });
      }

      // If we found a match in JobNimbus but not in our Sheets, warn but allow creation
      if (duplicateCheck.jnMatch) {
        // Set JN contact ID so the portal links to existing JN record
        if (!body.jobnimbusContactId) {
          body.jobnimbusContactId = duplicateCheck.jnMatch.jnid;
        }
      }
    }

    // Prepare lead data
    const leadData: LeadData = {
      name: body.name,
      email: body.email,
      phone: body.phone,
      address: body.address,
      city: body.city,
      state: body.state,
      zip: body.zip,
      source: body.source,
      sourceDetails: body.sourceDetails,
      preferredRepSlug: body.preferredRepSlug,
      assignedRepSlug: body.assignedRepSlug,
      serviceType: body.serviceType,
      message: body.message,
      urgency: body.urgency,
      jobnimbusId: body.jobnimbusId,
      jobnimbusContactId: body.jobnimbusContactId,
    };

    // Generate portal
    const portalResult = await portalGenerator.generatePortalForLead(leadData);

    if (!portalResult.success || !portalResult.portalAccess) {
      return NextResponse.json(
        { success: false, error: portalResult.error || 'Failed to generate portal' },
        { status: 500 }
      );
    }

    // Store lead record
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

    // Get full sales rep info
    const salesRep = teamMembers.find(m => m.slug === portalResult.salesRep?.slug);

    // Auto-geocode the new lead address and save to Geocoded_Contacts sheet (fire-and-forget)
    // Uses Nominatim (free, no API key) so this works even without Google Maps API key
    if (body.address && body.address !== 'Not provided') {
      const fullAddress = [body.address, body.city, body.state, body.zip].filter(Boolean).join(', ');
      geocodeAndSaveContact({
        id: lead.leadId || `lead-${Date.now()}`,
        name: body.name,
        address: fullAddress,
        salesRep: portalResult.salesRep?.slug || body.assignedRepSlug || '',
        type: 'lead',
        status: 'new',
      }).then(result => {
        if (result) {
        }
      }).catch(err => {
        console.warn(`[NewLead] Geocode save failed for ${body.name}:`, err);
      });
    }

    // ── SYNC TO JOBNIMBUS (fire-and-forget) ──────────────────────────────
    // Create a contact in JobNimbus for this new lead if not already linked.
    // Runs async so it doesn't slow the API response.
    if (!body.jobnimbusContactId && isJobNimbusConfigured()) {
      const nameParts = body.name.trim().split(/\s+/);
      const firstName = nameParts[0] || body.name;
      const lastName = nameParts.slice(1).join(' ') || '';

      jnSyncEngine.pushNewContact({
        firstName,
        lastName,
        email: body.email,
        phone: body.phone,
        address: body.address,
        city: body.city,
        state: body.state,
        zip: body.zip,
        source: `RCRS Portal - ${body.source}`,
        salesRepName: salesRep?.name,
        status: 'Lead',
      }).then(async (result) => {
        if (result.success && result.jnid) {
          // Update the lead record with the JN contact ID
          try {
            await leadPortalService.updateLeadJNContactId(lead.leadId, result.jnid);
          } catch {
            console.warn(`[Lead ${lead.leadId}] Failed to save JN contact ID to lead record`);
          }
        } else {
          console.warn(`[Lead ${lead.leadId}] JN sync failed: ${result.message}`);
        }
      }).catch(err => {
        console.warn(`[Lead ${lead.leadId}] JN sync error:`, err);
      });
    }

    // Generate SMS and email templates
    const smsTemplates = portalGenerator.getSmsTemplates(
      portalResult.portalAccess,
      portalResult.salesRep!
    );
    const emailTemplates = portalGenerator.getEmailTemplates(
      portalResult.portalAccess,
      portalResult.salesRep!
    );
    // ── AUTO-SEND NOTIFICATIONS (non-blocking) ──────────────────────────
    // All notification sends are fire-and-forget to not slow the API response

    const notificationPromises: Promise<any>[] = [];

    // 1. Send portal link EMAIL to customer
    if (body.sendNotifications !== false && salesRep) {
      notificationPromises.push(
        emailService.sendPortalLink({
          customerEmail: body.email,
          customerName: body.name,
          portalUrl: portalResult.portalUrl!,
          repName: salesRep.name,
          repEmail: salesRep.email,
          repPhone: salesRep.phone,
          stormReportIncluded: body.sourceDetails?.includes('Storm Report'),
        }).then(r => {
          if (!r.success) console.warn(`[Lead ${lead.leadId}] Email failed: ${r.error}`);
        })
      );
    }

    // 2. Send portal link SMS to customer (respects admin toggle + topic controls)
    if (body.sendNotifications !== false && body.phone && salesRep) {
      notificationPromises.push(
        smsService.sendPortalLink(
          body.phone,
          body.name,
          portalResult.portalUrl!,
          salesRep.name
        ).then(r => {
          if (!r.success) console.warn(`[Lead ${lead.leadId}] SMS failed: ${r.error}`);
        })
      );
    }

    // 3. Notify team via River bot (group post + DM to assigned rep)
    if (body.notifyTeam !== false && salesRep) {
      notificationPromises.push(
        riverBot.notifyNewLead({
          leadName: body.name,
          leadId: lead.leadId,
          address: body.address,
          source: body.source,
          assignedRep: salesRep.name,
          assignedRepEmail: salesRep.email,
          riskScore: undefined,
          portalUrl: portalResult.portalUrl,
        }).catch(err => {
          console.warn(`[Lead ${lead.leadId}] River bot notification failed:`, err);
        })
      );
    }

    // 4. Send lead assignment email to rep
    if (body.notifyTeam !== false && salesRep) {
      notificationPromises.push(
        emailService.sendLeadAssignment({
          repEmail: salesRep.email,
          repName: salesRep.name,
          leadName: body.name,
          leadPhone: body.phone,
          leadEmail: body.email,
          leadAddress: body.address,
          source: body.source,
          portalUrl: portalResult.portalUrl,
        }).then(() => {})
      );
    }

    // 5. Send unified notification via preference cascade (covers all channels)
    if (body.notifyTeam !== false && salesRep) {
      notificationPromises.push(
        notificationService.notifyLeadAssigned({
          repSlug: salesRep.slug,
          leadName: body.name,
          leadPhone: body.phone,
          leadEmail: body.email,
          leadAddress: body.address,
          source: body.source,
          leadId: lead.leadId,
          portalUrl: portalResult.portalUrl,
        }).then(result => {
          const sentChannels = Object.entries(result.channelResults)
            .filter(([, r]) => r.sent)
            .map(([ch]) => ch);
        }).catch(err => {
          console.warn(`[Lead ${lead.leadId}] Notification service failed:`, err);
        })
      );
    }

    // Start response timer
    if (portalResult.salesRep?.slug) {
      leadResponseTimerService.startTimer(lead.leadId, portalResult.salesRep.slug, body.name);
    }

    // ── AUTO-GENERATE STORM REPORT (fire-and-forget) ──────────────────────
    // Automatically pull a storm/hail report for the lead address.
    // This runs in the background so it does not block the API response.
    const stormReportCity = body.city || geocoded?.components?.city || '';
    const stormReportState = body.state || geocoded?.components?.state || 'AL';
    const stormReportZip = body.zip || geocoded?.components?.zip || '';

    let stormReportSummary: {
      reportId: string;
      riskLevel: string;
      riskScore: number;
      totalHailReports: number;
      recommendation: string;
      generatedAt: string;
    } | null = null;

    if (stormReportCity && stormReportZip) {
      // Fire-and-forget: generate storm report linked to this lead
      stormReportService.generateReport({
        address: body.address,
        city: stormReportCity,
        state: stormReportState,
        zip: stormReportZip,
        leadId: lead.leadId,
        customerId: lead.customerId,
      }).then(report => {
      }).catch(err => {
        console.warn(`[Lead ${lead.leadId}] Auto storm report failed:`, err);
      });
    }

    // ── AUTO-GENERATE ROOF REPORT (fire-and-forget) ──────────────────────
    // Automatically run AI roof measurement for the lead address.
    // This is a heavy operation (satellite imagery + AI analysis) so it
    // runs fully in the background without blocking.
    if (body.address && body.address !== 'Not provided') {
      roofReportService.generateReport({
        address: body.address,
        leadId: lead.leadId,
        customerId: lead.customerId,
      }).then(report => {
        console.log(`[Lead ${lead.leadId}] Auto roof report generated: ${report.reportId} (${report.totalRoofAreaSqFt} sqft, ${report.overallConfidence} confidence)`);
      }).catch(err => {
        console.warn(`[Lead ${lead.leadId}] Auto roof report failed:`, err);
      });
    }

    // Fire all notifications without blocking response
    Promise.allSettled(notificationPromises).catch(() => {});

    return NextResponse.json({
      success: true,
      data: {
        // Lead identifiers
        leadId: lead.leadId,
        customerId: lead.customerId,
        accessToken: portalResult.portalAccess.accessToken,
        shortCode: portalResult.shortCode,

        // Portal URLs
        portalUrl: portalResult.portalUrl,
        qrCodeUrl: portalResult.qrCodeUrl,

        // Geocoded data
        county: geocoded?.components?.county,
        addressIntel,

        // Storm report info (will be generated async, fetch via /api/leads/[id]/storm-report)
        stormReport: {
          status: stormReportCity && stormReportZip ? 'generating' : 'skipped',
          message: stormReportCity && stormReportZip
            ? 'Storm report is being generated automatically. Fetch via /api/leads/[leadId]/storm-report'
            : 'Missing city or zip - storm report skipped',
          fetchUrl: `/api/leads/${lead.leadId}/storm-report`,
        },

        // Roof report info (will be generated async, fetch via /api/leads/[id]/roof-report)
        roofReport: {
          status: body.address && body.address !== 'Not provided' ? 'generating' : 'skipped',
          message: body.address && body.address !== 'Not provided'
            ? 'Roof measurement report is being generated automatically. Fetch via /api/leads/[leadId]/roof-report'
            : 'No address provided - roof report skipped',
          fetchUrl: `/api/leads/${lead.leadId}/roof-report`,
        },

        // Assigned sales rep
        salesRep: salesRep ? {
          name: salesRep.name,
          slug: salesRep.slug,
          position: salesRep.position,
          phone: salesRep.phone,
          email: salesRep.email,
          profileImage: salesRep.profileImage,
          truckImage: salesRep.truckImage,
          profileUrl: portalGenerator.getSalesRepUrl(salesRep.slug),
        } : null,

        // Pre-generated notification templates
        templates: {
          sms: smsTemplates,
          email: emailTemplates,
        },

        // Distribution scores (so the UI can display them without a second API call)
        distributionScores: distributionResult?.allScores?.map(s => ({
          slug: s.repSlug,
          name: s.repName,
          score: s.totalScore,
          isEligible: s.isEligible,
          disqualifyReason: s.disqualifyReason,
          factors: s.factors,
        })) || [],
        distributionMethod: distributionResult?.method || null,

        // Metadata
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
        accessToken: lead.accessToken.substring(0, 8) + '...',
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
