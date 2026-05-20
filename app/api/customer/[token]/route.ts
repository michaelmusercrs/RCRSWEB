import { NextRequest, NextResponse } from 'next/server';
import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';
import { customerPortalService } from '@/lib/customer-portal-service';
import { groupMeService, getGroupMeConfigFromEnv } from '@/lib/groupme-service';
import { leadPortalService } from '@/lib/lead-portal-service';
import { teamMembers } from '@/lib/teamData';
import { jobNimbusService, isJobNimbusConfigured } from '@/lib/jobnimbus-service';
import { createCustomerTokenRateLimiter, withRateLimit } from '@/lib/rate-limiter';
import { notificationService } from '@/lib/notification-service';
import { googleSheetsService } from '@/lib/google-sheets-service';
import { geocodeWithNominatim } from '@/lib/nominatim-geocoder';

// Default coordinates: Hartselle, AL (RCRS home base)
const DEFAULT_LAT = 34.4434;
const DEFAULT_LNG = -86.9358;

// Simple in-memory cache to avoid re-geocoding the same address on every request
const geocodeCache = new Map<string, { lat: number; lng: number; ts: number }>();
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

async function getCoordinatesForAddress(address: string | undefined): Promise<{ lat: number; lng: number }> {
  if (!address || address.trim().length < 5) {
    return { lat: DEFAULT_LAT, lng: DEFAULT_LNG };
  }

  const key = address.trim().toLowerCase();
  const cached = geocodeCache.get(key);
  if (cached && Date.now() - cached.ts < CACHE_TTL_MS) {
    return { lat: cached.lat, lng: cached.lng };
  }

  try {
    const result = await geocodeWithNominatim(address);
    if (result) {
      geocodeCache.set(key, { lat: result.lat, lng: result.lng, ts: Date.now() });
      return { lat: result.lat, lng: result.lng };
    }
  } catch (err) {
    console.warn('[CustomerPortal] Geocode failed for address:', address, err);
  }

  return { lat: DEFAULT_LAT, lng: DEFAULT_LNG };
}

// SECURITY: Rate limiter for customer token access.
// Limits to 10 attempts per 15 minutes per IP to prevent token brute-force.
// Applied to both GET and POST methods (key is IP + path, method-agnostic).
const tokenRateLimiter = createCustomerTokenRateLimiter();

async function getDoc(): Promise<GoogleSpreadsheet> {
  const serviceAccountEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n');
  // Accept either GOOGLE_SHEET_ID (singular, legacy), GOOGLE_SHEETS_ID (plural,
  // current standard), or DELIVERY_SHEETS_ID. Whichever is set in this
  // environment, we use it — this prevents silent "Missing credentials" errors
  // when only one of the three names is configured on the host.
  const sheetId = process.env.GOOGLE_SHEET_ID
    || process.env.GOOGLE_SHEETS_ID
    || process.env.DELIVERY_SHEETS_ID;

  if (!serviceAccountEmail || !privateKey || !sheetId) {
    throw new Error('Missing Google Sheets credentials');
  }

  const jwt = new JWT({
    email: serviceAccountEmail,
    key: privateKey,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });

  const doc = new GoogleSpreadsheet(sheetId, jwt);
  await doc.loadInfo();
  return doc;
}

async function getOrCreateSheet(doc: GoogleSpreadsheet, sheetName: string, headers: string[]) {
  let sheet = doc.sheetsByTitle[sheetName];
  if (!sheet) {
    sheet = await doc.addSheet({ title: sheetName, headerValues: headers });
  }
  return sheet;
}

// SECURITY: Validate that a token resolves to a specific customer and return the customer ID.
// This prevents horizontal privilege escalation where a valid token could be used
// to access a different customer's data.
async function validateTokenOwnership(token: string): Promise<{
  valid: boolean;
  expired?: boolean;
  customerId?: string;
  source?: 'lead' | 'sheet';
  lead?: Awaited<ReturnType<typeof leadPortalService.getLeadByToken>>;
  accessRow?: any;
  doc?: GoogleSpreadsheet;
}> {
  // First check lead portal service
  const lead = await leadPortalService.getLeadByToken(token);
  if (lead) {
    return { valid: true, customerId: lead.customerId, source: 'lead', lead };
  }

  // Fall back to Google Sheets lookup
  try {
    const doc = await getDoc();
    const accessSheet = await getOrCreateSheet(doc, 'Customer_Portal_Access', [
      'accessToken', 'customerId', 'customerName', 'customerEmail', 'customerPhone',
      'customerAddress', 'salesRepId', 'salesRepName', 'salesRepSlug', 'jobId',
      'createdAt', 'expiresAt', 'lastAccessedAt', 'isActive'
    ]);
    const accessRows = await accessSheet.getRows();
    const accessRow = accessRows.find(r => r.get('accessToken') === token);

    if (accessRow && accessRow.get('isActive') === 'true') {
      // Check if token has expired
      const expiresAtStr = accessRow.get('expiresAt');
      if (expiresAtStr) {
        const expiresAt = new Date(expiresAtStr);
        if (expiresAt < new Date()) {
          return { valid: false, expired: true };
        }
      }

      return {
        valid: true,
        customerId: accessRow.get('customerId'),
        source: 'sheet',
        accessRow,
        doc,
      };
    }
  } catch {
    // Fall through to invalid
  }

  return { valid: false };
}

// GET - Fetch customer portal data
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  // SECURITY: Rate limit token access to prevent brute-force token guessing.
  // This applies across all HTTP methods for the same IP + endpoint path.
  return withRateLimit(request, tokenRateLimiter, async () => {
  try {
    const { token } = await params;

    // SECURITY: Validate token and resolve to specific customer
    // The token itself is the sole authentication factor - it maps 1:1 to a customer.
    // We do NOT accept any external customerId parameter; it is always derived from the token.

    // First, try to find in the new lead portal service
    const lead = await leadPortalService.getLeadByToken(token);
    if (lead) {
      // Record portal view
      await leadPortalService.recordPortalView(token);

      // Upsert CustomerPortalData in Google Sheets for long-term persistence
      googleSheetsService.upsertPortalData({
        customerId: lead.customerId,
        customerName: lead.customerName,
        customerEmail: lead.customerEmail || '',
        customerPhone: lead.customerPhone || '',
        address: lead.customerAddress || '',
        jobId: lead.jobnimbusId || '',
        jobStatus: '',
        portalToken: token,
        portalCreatedAt: lead.createdAt || new Date().toISOString(),
        lastAccessed: new Date().toISOString(),
        totalVisits: 1, // Will be incremented by portal-log route
        messagesSent: 0,
        documentsViewed: 0,
        notes: '',
      }).catch(err => {
        console.warn('[CustomerPortal] Failed to upsert portal data:', err);
      });

      // Notify rep that customer viewed portal (fire-and-forget, respects preference cascade)
      if (lead.salesRepSlug) {
        notificationService.notifyCustomerViewedPortal({
          repSlug: lead.salesRepSlug,
          customerId: lead.customerId,
          customerName: lead.customerName,
        }).catch(err => {
          console.warn(`[CustomerPortal] Failed to notify rep of portal view:`, err);
        });
      }

      // Get sales rep info from team data
      const salesRepData = teamMembers.find(m => m.slug === lead.salesRepSlug);

      const salesRep = {
        name: salesRepData?.name || lead.salesRepName,
        slug: salesRepData?.slug || lead.salesRepSlug,
        phone: salesRepData?.phone || '',
        email: salesRepData?.email || '',
        photo: salesRepData?.profileImage || '',
        position: salesRepData?.position || 'Roofing Specialist',
        truckImage: salesRepData?.truckImage || '',
        bio: salesRepData?.bio || '',
        tagline: salesRepData?.tagline || '',
      };

      // Get weather for the customer's actual area (geocode their address)
      const coords = await getCoordinatesForAddress(lead.customerAddress);
      const weather = await customerPortalService.getWeatherForecast(coords.lat, coords.lng);
      const hailReports = await customerPortalService.getHailReports(coords.lat, coords.lng, 30);

      // If this lead has a JobNimbus contact ID, fetch LIVE data.
      // Customer-facing route — explicit no-cost viewer.
      if (lead.jobnimbusContactId && isJobNimbusConfigured()) {
        try {
          const jnData = await jobNimbusService.getCustomerPortalData(
            lead.jobnimbusContactId,
            { canSeeCost: false },
          );

          if (jnData) {
            const { contact, jobs, estimates, tasks } = jnData;

            // Map jobs to portal format
            const mappedJobs = jobs.map(job => {
              const phase = jobNimbusService.mapStatusToPhase(job.status);
              const phaseProgress = getPhaseProgress(phase);
              return {
                jnid: job.jnid,
                name: job.name || 'Roofing Project',
                status: job.status || 'lead',
                phase,
                progress: phaseProgress,
                address: [job.address_line1, job.city, job.state_text, job.zip].filter(Boolean).join(', ') || lead.customerAddress,
                startDate: job.date_start ? new Date(job.date_start * 1000).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : undefined,
                estimatedCompletion: job.date_end ? new Date(job.date_end * 1000).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : undefined,
              };
            });

            // Map tasks to appointments
            const appointments = tasks.map(task => ({
              appointmentId: task.jnid,
              customerId: lead.customerId,
              type: mapTaskTypeToAppointmentType(task.type),
              title: task.title || 'Appointment',
              description: task.description,
              scheduledDate: task.date_start ? new Date(task.date_start * 1000).toLocaleDateString('en-US', { year: 'numeric', month: '2-digit', day: '2-digit' }) : '',
              scheduledTime: task.date_start ? new Date(task.date_start * 1000).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : '',
              duration: 60,
              status: task.status === 'completed' ? 'completed' : 'scheduled',
              assignedTo: lead.salesRepName,
              createdAt: new Date().toISOString(),
            }));

            // Map estimates to documents
            const documents = estimates.map(est => ({
              documentId: est.jnid,
              customerId: lead.customerId,
              type: 'estimate',
              title: `Estimate #${est.number || 'N/A'}`,
              description: est.description || 'Project estimate',
              fileUrl: est.public_url || est.pdf_url || '#',
              fileType: 'pdf',
              fileSize: 0,
              uploadedAt: est.created_at ? new Date(est.created_at * 1000).toISOString() : new Date().toISOString(),
              uploadedBy: lead.salesRepName,
              isVisible: true,
            }));

            // Get job status from the primary/most recent job
            let jobStatus = null;
            if (mappedJobs.length > 0) {
              const primaryJob = mappedJobs[0];
              const phases = customerPortalService.getJobPhases();
              const currentPhase = phases.find(p => p.id === primaryJob.phase);
              const nextPhase = phases.find(p => p.progress > (currentPhase?.progress || 0));

              jobStatus = {
                phase: currentPhase?.label || primaryJob.status || 'In Progress',
                progress: primaryJob.progress,
                nextMilestone: nextPhase?.label || 'Project Complete',
                estimatedCompletion: primaryJob.estimatedCompletion,
              };
            }

            return NextResponse.json({
              customer: {
                accessToken: token,
                customerId: lead.customerId,
                customerName: jobNimbusService.getContactName(contact),
                customerEmail: contact.email || lead.customerEmail,
                customerPhone: jobNimbusService.getContactPhone(contact) || lead.customerPhone,
                customerAddress: jobNimbusService.formatAddress(contact) || lead.customerAddress,
                salesRepId: lead.salesRepId,
                salesRepName: lead.salesRepName,
                salesRepSlug: lead.salesRepSlug,
                jobId: lead.jobnimbusId,
                jobnimbusContactId: lead.jobnimbusContactId,
                createdAt: lead.createdAt,
                isActive: true,
              },
              salesRep,
              appointments,
              documents,
              messages: [], // Messages still come from spreadsheet
              jobStatus: jobStatus || {
                phase: 'Pending Inspection',
                progress: 5,
                nextMilestone: 'Roof Inspection Scheduled',
                estimatedCompletion: null,
              },
              weather,
              hailReports,
              // Include job list for multi-job display
              jobs: mappedJobs,
              // Effective portal settings (3-tier: admin → rep → customer)
              settings: await customerPortalService.getEffectiveCustomerSettings(lead.salesRepSlug || '', lead.customerId || ''),
              // Flag that this is live JobNimbus data
              dataSource: 'jobnimbus',
            });
          }
        } catch (jnError) {
          console.error('Error fetching JobNimbus data for portal:', jnError);
          // Fall through to return basic lead data
        }
      }

      // Return basic portal data if no JobNimbus data available
      return NextResponse.json({
        customer: {
          accessToken: token,
          customerId: lead.customerId,
          customerName: lead.customerName,
          customerEmail: lead.customerEmail,
          customerPhone: lead.customerPhone,
          customerAddress: lead.customerAddress,
          salesRepId: lead.salesRepId,
          salesRepName: lead.salesRepName,
          salesRepSlug: lead.salesRepSlug,
          jobId: lead.jobnimbusId,
          createdAt: lead.createdAt,
          isActive: true,
        },
        salesRep,
        appointments: [],
        documents: [],
        messages: [],
        jobStatus: {
          phase: 'Pending Inspection',
          progress: 5,
          nextMilestone: 'Roof Inspection Scheduled',
          estimatedCompletion: null,
        },
        weather,
        hailReports,
        settings: await customerPortalService.getEffectiveCustomerSettings(lead.salesRepSlug || '', lead.customerId || ''),
        dataSource: 'local',
      });
    }

    // Helper function to get progress percentage for a phase
    function getPhaseProgress(phase: string): number {
      const phaseProgress: Record<string, number> = {
        'lead': 5,
        'inspection': 15,
        'estimate': 25,
        'contract': 40,
        'permit': 50,
        'materials': 60,
        'scheduled': 70,
        'in_progress': 80,
        'quality_check': 90,
        'complete': 100,
      };
      return phaseProgress[phase] || 5;
    }

    // Helper function to map task type to appointment type
    function mapTaskTypeToAppointmentType(taskType?: string): string {
      if (!taskType) return 'other';
      const lower = taskType.toLowerCase();
      if (lower.includes('inspect')) return 'inspection';
      if (lower.includes('estimate')) return 'estimate';
      if (lower.includes('install') || lower.includes('start')) return 'install_start';
      if (lower.includes('complete') || lower.includes('finish')) return 'install_complete';
      if (lower.includes('walk')) return 'final_walkthrough';
      return 'other';
    }

    // Fall back to original Google Sheets lookup
    const doc = await getDoc();

    // Get customer access record
    const accessSheet = await getOrCreateSheet(doc, 'Customer_Portal_Access', [
      'accessToken', 'customerId', 'customerName', 'customerEmail', 'customerPhone',
      'customerAddress', 'salesRepId', 'salesRepName', 'salesRepSlug', 'jobId',
      'createdAt', 'expiresAt', 'lastAccessedAt', 'isActive'
    ]);

    const accessRows = await accessSheet.getRows();
    const accessRow = accessRows.find(r => r.get('accessToken') === token);

    if (!accessRow || accessRow.get('isActive') !== 'true') {
      return NextResponse.json({ error: 'Invalid or expired access token' }, { status: 404 });
    }

    // Check if token has expired
    const expiresAtStr = accessRow.get('expiresAt');
    if (expiresAtStr) {
      const expiresAt = new Date(expiresAtStr);
      if (expiresAt < new Date()) {
        return NextResponse.json(
          { error: 'This portal link has expired. Please contact your rep for a new one.' },
          { status: 410 }
        );
      }
    }

    // Update last accessed
    accessRow.set('lastAccessedAt', new Date().toISOString());
    await accessRow.save();

    const customerId = accessRow.get('customerId');
    const customerAddress = accessRow.get('customerAddress');

    // Upsert CustomerPortalData for long-term persistence
    googleSheetsService.upsertPortalData({
      customerId: customerId || '',
      customerName: accessRow.get('customerName') || '',
      customerEmail: accessRow.get('customerEmail') || '',
      customerPhone: accessRow.get('customerPhone') || '',
      address: customerAddress || '',
      jobId: accessRow.get('jobId') || '',
      jobStatus: '',
      portalToken: token,
      portalCreatedAt: accessRow.get('createdAt') || new Date().toISOString(),
      lastAccessed: new Date().toISOString(),
      totalVisits: 1,
      messagesSent: 0,
      documentsViewed: 0,
      notes: '',
    }).catch(err => {
      console.warn('[CustomerPortal] Failed to upsert portal data (sheet path):', err);
    });

    // Get appointments
    const apptSheet = await getOrCreateSheet(doc, 'Customer_Appointments', [
      'appointmentId', 'customerId', 'type', 'title', 'description',
      'scheduledDate', 'scheduledTime', 'duration', 'status', 'assignedTo', 'notes', 'createdAt'
    ]);
    const apptRows = await apptSheet.getRows();
    const appointments = apptRows
      .filter(r => r.get('customerId') === customerId)
      .map(r => ({
        appointmentId: r.get('appointmentId'),
        customerId: r.get('customerId'),
        type: r.get('type'),
        title: r.get('title'),
        description: r.get('description'),
        scheduledDate: r.get('scheduledDate'),
        scheduledTime: r.get('scheduledTime'),
        duration: parseInt(r.get('duration')) || 60,
        status: r.get('status'),
        assignedTo: r.get('assignedTo'),
        notes: r.get('notes'),
        createdAt: r.get('createdAt'),
      }));

    // Get documents
    const docSheet = await getOrCreateSheet(doc, 'Customer_Documents', [
      'documentId', 'customerId', 'type', 'title', 'description',
      'fileUrl', 'fileType', 'fileSize', 'uploadedAt', 'uploadedBy', 'isVisible'
    ]);
    const docRows = await docSheet.getRows();
    const documents = docRows
      .filter(r => r.get('customerId') === customerId && r.get('isVisible') === 'true')
      .map(r => ({
        documentId: r.get('documentId'),
        customerId: r.get('customerId'),
        type: r.get('type'),
        title: r.get('title'),
        description: r.get('description'),
        fileUrl: r.get('fileUrl'),
        fileType: r.get('fileType'),
        fileSize: parseInt(r.get('fileSize')) || 0,
        uploadedAt: r.get('uploadedAt'),
        uploadedBy: r.get('uploadedBy'),
        isVisible: true,
      }));

    // Get messages
    const msgSheet = await getOrCreateSheet(doc, 'Customer_Messages', [
      'messageId', 'customerId', 'direction', 'channel', 'subject', 'content', 'sentAt', 'readAt', 'sentBy'
    ]);
    const msgRows = await msgSheet.getRows();
    const messages = msgRows
      .filter(r => r.get('customerId') === customerId)
      .map(r => ({
        messageId: r.get('messageId'),
        customerId: r.get('customerId'),
        direction: r.get('direction'),
        channel: r.get('channel'),
        subject: r.get('subject'),
        content: r.get('content'),
        sentAt: r.get('sentAt'),
        readAt: r.get('readAt'),
        sentBy: r.get('sentBy'),
      }));

    // Check for JobNimbus Contact ID from the sheet
    const jobNimbusContactId = accessRow.get('jobNimbusContactId');
    const jobNimbusJobId = accessRow.get('jobNimbusJobId') || accessRow.get('jobId');

    // Get job status - first try JobNimbus live data
    let jobStatus = null;
    let jnAppointments: any[] = [];
    let jnDocuments: any[] = [];
    let dataSource = 'local';

    if (jobNimbusContactId && isJobNimbusConfigured()) {
      try {
        // Customer-facing route — explicit no-cost viewer.
        const jnData = await jobNimbusService.getCustomerPortalData(
          jobNimbusContactId,
          { canSeeCost: false },
        );

        if (jnData) {
          const { jobs, estimates, tasks } = jnData;
          dataSource = 'jobnimbus';

          // Map tasks to appointments
          jnAppointments = tasks.map(task => ({
            appointmentId: task.jnid,
            customerId,
            type: mapTaskTypeToAppointmentType(task.type),
            title: task.title || 'Appointment',
            description: task.description,
            scheduledDate: task.date_start ? new Date(task.date_start * 1000).toLocaleDateString('en-US', { year: 'numeric', month: '2-digit', day: '2-digit' }) : '',
            scheduledTime: task.date_start ? new Date(task.date_start * 1000).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : '',
            duration: 60,
            status: task.status === 'completed' ? 'completed' : 'scheduled',
            assignedTo: accessRow.get('salesRepName'),
            createdAt: new Date().toISOString(),
          }));

          // Map estimates to documents
          jnDocuments = estimates.map(est => ({
            documentId: est.jnid,
            customerId,
            type: 'estimate',
            title: `Estimate #${est.number || 'N/A'}`,
            description: est.description || `Project estimate - $${(est.total || est.amount || 0).toLocaleString()}`,
            fileUrl: est.public_url || est.pdf_url || '#',
            fileType: 'pdf',
            fileSize: 0,
            uploadedAt: est.created_at ? new Date(est.created_at * 1000).toISOString() : new Date().toISOString(),
            uploadedBy: accessRow.get('salesRepName'),
            isVisible: true,
          }));

          // Get job status from the primary/most recent job
          if (jobs.length > 0) {
            const primaryJob = jobs[0];
            const phase = jobNimbusService.mapStatusToPhase(primaryJob.status);
            const phases = customerPortalService.getJobPhases();
            const currentPhase = phases.find(p => p.id === phase);
            const nextPhase = phases.find(p => p.progress > (currentPhase?.progress || 0));

            jobStatus = {
              phase: currentPhase?.label || primaryJob.status || 'In Progress',
              progress: currentPhase?.progress || getPhaseProgress(phase),
              nextMilestone: nextPhase?.label || 'Project Complete',
              estimatedCompletion: primaryJob.date_end ? new Date(primaryJob.date_end * 1000).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : null,
            };
          }
        }
      } catch (jnError) {
        console.error('Error fetching JobNimbus data for sheet portal:', jnError);
        // Fall through to local data
      }
    }

    // Fall back to local job status if no JobNimbus data
    if (!jobStatus && jobNimbusJobId) {
      const jobSheet = doc.sheetsByTitle['Jobs_Master'];
      if (jobSheet) {
        const jobRows = await jobSheet.getRows();
        const jobRow = jobRows.find(r => r.get('jobId') === jobNimbusJobId);
        if (jobRow) {
          const phases = customerPortalService.getJobPhases();
          const currentPhase = phases.find(p => p.id === jobRow.get('jobStatus'));
          const nextPhase = phases.find(p => p.progress > (currentPhase?.progress || 0));

          jobStatus = {
            phase: currentPhase?.label || 'In Progress',
            progress: currentPhase?.progress || 0,
            nextMilestone: nextPhase?.label || 'Project Complete',
            estimatedCompletion: jobRow.get('scheduledStartDate'),
          };
        }
      }
    }

    // Merge JobNimbus data with local data (JN takes precedence)
    const finalAppointments = jnAppointments.length > 0 ? jnAppointments : appointments;
    const finalDocuments = jnDocuments.length > 0 ? [...jnDocuments, ...documents] : documents;

    // Geocode the customer's address for accurate weather data
    const coords = await getCoordinatesForAddress(customerAddress);

    // Get weather forecast
    const weather = await customerPortalService.getWeatherForecast(coords.lat, coords.lng);

    // Get hail reports
    const hailReports = await customerPortalService.getHailReports(coords.lat, coords.lng, 30);

    // Get sales rep info from team sheet
    let salesRep = {
      name: accessRow.get('salesRepName'),
      slug: accessRow.get('salesRepSlug'),
      phone: '',
      email: '',
      photo: '',
      position: 'Roofing Specialist',
    };

    const teamSheet = doc.sheetsByTitle['team-members-import'];
    if (teamSheet) {
      const teamRows = await teamSheet.getRows();
      const repRow = teamRows.find(r => r.get('slug') === accessRow.get('salesRepSlug'));
      if (repRow) {
        salesRep = {
          name: repRow.get('name') || salesRep.name,
          slug: repRow.get('slug') || salesRep.slug,
          phone: repRow.get('phone') || '',
          email: repRow.get('email') || '',
          photo: repRow.get('profileImage') || '',
          position: repRow.get('position') || 'Roofing Specialist',
        };
      }
    }

    // Get effective portal settings for this rep
    let portalSettings = null;
    try {
      const settingsStr = accessRow.get('settings');
      if (settingsStr) {
        portalSettings = JSON.parse(settingsStr);
      }
    } catch {}
    if (!portalSettings) {
      try {
        portalSettings = await customerPortalService.getEffectiveCustomerSettings(
          accessRow.get('salesRepSlug') || '',
          customerId || ''
        );
      } catch {
        // Fall back to defaults if settings service fails
      }
    }

    return NextResponse.json({
      customer: {
        accessToken: token,
        customerId,
        customerName: accessRow.get('customerName'),
        customerEmail: accessRow.get('customerEmail'),
        customerPhone: accessRow.get('customerPhone'),
        customerAddress,
        salesRepId: accessRow.get('salesRepId'),
        salesRepName: accessRow.get('salesRepName'),
        salesRepSlug: accessRow.get('salesRepSlug'),
        jobId: jobNimbusJobId,
        jobNimbusContactId,
        createdAt: accessRow.get('createdAt'),
        isActive: true,
      },
      salesRep,
      appointments: finalAppointments,
      documents: finalDocuments,
      messages,
      jobStatus,
      weather,
      hailReports,
      settings: portalSettings,
      dataSource,
    });
  } catch (error) {
    console.error('Customer portal error:', error);
    return NextResponse.json({ error: 'Failed to load portal data' }, { status: 500 });
  }
  }); // end withRateLimit
}

// POST - Send message from customer
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  // SECURITY: Rate limit POST requests with same limiter as GET.
  // Shared key (IP + path) prevents method-switching bypass.
  return withRateLimit(request, tokenRateLimiter, async () => {
  try {
    const { token } = await params;
    const body = await request.json();
    const { message, subject } = body;

    // SECURITY: Reject any customerId passed in the request body.
    // The customerId MUST be derived from the token, never from user input.
    // This prevents horizontal privilege escalation.
    if (body.customerId) {
      console.warn(`SECURITY: POST to customer/[token] included customerId in body. Token: ${token.slice(0, 8)}...`);
      return NextResponse.json(
        { error: 'Forbidden: customerId cannot be specified in request body' },
        { status: 403 }
      );
    }

    if (!message || typeof message !== 'string' || !message.trim()) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    // First check lead portal service (newer token system)
    const lead = await leadPortalService.getLeadByToken(token);
    if (lead) {
      const doc = await getDoc();
      const msgSheet = await getOrCreateSheet(doc, 'Customer_Messages', [
        'messageId', 'customerId', 'direction', 'channel', 'subject', 'content', 'sentAt', 'readAt', 'sentBy'
      ]);

      await msgSheet.addRow({
        messageId: `MSG-${Date.now()}`,
        customerId: lead.customerId,
        direction: 'inbound',
        channel: 'portal',
        subject: subject || 'Message from Customer Portal',
        content: message.trim(),
        sentAt: new Date().toISOString(),
        readAt: '',
        sentBy: lead.customerName,
      });

      // Notify rep
      if (lead.salesRepSlug) {
        notificationService.notifyCustomerSentMessage({
          repSlug: lead.salesRepSlug,
          customerId: lead.customerId,
          customerName: lead.customerName,
          messagePreview: message.trim().slice(0, 100),
        }).catch(err => {
          console.warn('[CustomerPortal] Failed to notify rep of message:', err);
        });
      }

      // Send GroupMe notification
      try {
        const groupMeConfig = getGroupMeConfigFromEnv();
        if (groupMeConfig.enabled && groupMeConfig.botId && groupMeConfig.notifyOn.customerPortalActivity) {
          const notification = groupMeService.createPortalActivityNotification({
            customerName: lead.customerName,
            activityType: 'message',
            details: subject || message.trim().substring(0, 50),
          });
          await groupMeService.sendNotification(groupMeConfig, notification);
        }
      } catch (notifyError) {
        console.error('Failed to send portal activity notification:', notifyError);
      }

      return NextResponse.json({ success: true });
    }

    // Fall back to Google Sheets token lookup
    const doc = await getDoc();

    const accessSheet = doc.sheetsByTitle['Customer_Portal_Access'];
    if (!accessSheet) {
      return NextResponse.json({ error: 'Portal not configured' }, { status: 500 });
    }

    const accessRows = await accessSheet.getRows();
    const accessRow = accessRows.find(r => r.get('accessToken') === token);

    if (!accessRow || accessRow.get('isActive') !== 'true') {
      return NextResponse.json({ error: 'Invalid access token' }, { status: 404 });
    }

    // Check if token has expired
    const expiresAtStr = accessRow.get('expiresAt');
    if (expiresAtStr) {
      const expiresAt = new Date(expiresAtStr);
      if (expiresAt < new Date()) {
        return NextResponse.json(
          { error: 'This portal link has expired. Please contact your rep for a new one.' },
          { status: 410 }
        );
      }
    }

    // SECURITY: customerId is derived solely from the token lookup, never from user input
    const customerId = accessRow.get('customerId');

    // Update last accessed
    accessRow.set('lastAccessedAt', new Date().toISOString());
    await accessRow.save();

    // Save message
    const msgSheet = await getOrCreateSheet(doc, 'Customer_Messages', [
      'messageId', 'customerId', 'direction', 'channel', 'subject', 'content', 'sentAt', 'readAt', 'sentBy'
    ]);

    await msgSheet.addRow({
      messageId: `MSG-${Date.now()}`,
      customerId,
      direction: 'inbound',
      channel: 'portal',
      subject: subject || 'Message from Customer Portal',
      content: message.trim(),
      sentAt: new Date().toISOString(),
      readAt: '',
      sentBy: accessRow.get('customerName'),
    });

    // Send GroupMe notification for customer portal message
    try {
      const groupMeConfig = getGroupMeConfigFromEnv();
      if (groupMeConfig.enabled && groupMeConfig.botId && groupMeConfig.notifyOn.customerPortalActivity) {
        const notification = groupMeService.createPortalActivityNotification({
          customerName: accessRow.get('customerName'),
          activityType: 'message',
          details: subject || message.trim().substring(0, 50),
        });
        await groupMeService.sendNotification(groupMeConfig, notification);
      }
    } catch (notifyError) {
      console.error('Failed to send portal activity notification:', notifyError);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error sending message:', error);
    return NextResponse.json({ error: 'Failed to send message' }, { status: 500 });
  }
  }); // end withRateLimit
}
