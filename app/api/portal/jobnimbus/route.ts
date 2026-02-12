// Create Customer Portal from JobNimbus Contact
// This endpoint creates a portal link for a JobNimbus contact with LIVE data

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-service';
import { jobNimbusService, isJobNimbusConfigured, JobNimbusContact, JobNimbusJob } from '@/lib/jobnimbus-service';
import { portalGenerator } from '@/lib/portal-generator';
import { leadPortalService } from '@/lib/lead-portal-service';
import { teamMembers } from '@/lib/teamData';

interface CreatePortalRequest {
  // JobNimbus contact ID (jnid)
  contactId: string;
  // Optional: specific job ID to associate
  jobId?: string;
  // Optional: override sales rep assignment
  salesRepSlug?: string;
}

// POST - Create portal from JobNimbus contact
export async function POST(request: NextRequest) {
  const auth = await requireAuth();
  if (!auth.authenticated) return auth.response;

  try {
    if (!isJobNimbusConfigured()) {
      return NextResponse.json(
        { success: false, error: 'JobNimbus API not configured' },
        { status: 500 }
      );
    }

    const body: CreatePortalRequest = await request.json();
    const { contactId, jobId, salesRepSlug } = body;

    if (!contactId) {
      return NextResponse.json(
        { success: false, error: 'contactId is required' },
        { status: 400 }
      );
    }

    // Fetch live data from JobNimbus
    const portalData = await jobNimbusService.getCustomerPortalData(contactId);

    if (!portalData) {
      return NextResponse.json(
        { success: false, error: 'Contact not found in JobNimbus' },
        { status: 404 }
      );
    }

    const { contact, jobs, estimates } = portalData;

    // Check if portal already exists for this contact
    const existingLead = await leadPortalService.getLeadByEmail(contact.email || '');
    if (existingLead && existingLead.jobnimbusContactId === contactId) {
      const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://rivercityroofingsolutions.com';
      const existingSalesRep = teamMembers.find(m => m.slug === existingLead.salesRepSlug);

      return NextResponse.json({
        success: true,
        existing: true,
        data: {
          leadId: existingLead.leadId,
          customerId: existingLead.customerId,
          contactId: existingLead.jobnimbusContactId,
          portalUrl: `${baseUrl}/my/${existingLead.accessToken}`,
          shortPortalUrl: `${baseUrl}/p/${existingLead.shortCode}`,
          qrCodeUrl: `${baseUrl}/api/portal/qr/${existingLead.accessToken}`,
          customerName: existingLead.customerName,
          salesRep: existingSalesRep ? {
            name: existingSalesRep.name,
            slug: existingSalesRep.slug,
            phone: existingSalesRep.phone,
            email: existingSalesRep.email,
          } : null,
          createdAt: existingLead.createdAt,
        },
      });
    }

    // Determine sales rep from JobNimbus or override
    let assignedSalesRep = salesRepSlug
      ? teamMembers.find(m => m.slug === salesRepSlug)
      : null;

    // If not specified, try to match from JobNimbus sales_rep_name
    if (!assignedSalesRep && contact.sales_rep_name) {
      const repName = contact.sales_rep_name.toLowerCase();
      assignedSalesRep = teamMembers.find(m =>
        m.name.toLowerCase().includes(repName) ||
        repName.includes(m.name.toLowerCase().split(' ')[0])
      );
    }

    // Default to round-robin if still not assigned
    if (!assignedSalesRep) {
      const salesReps = teamMembers.filter(m =>
        m.position.toLowerCase().includes('sales') ||
        m.position.toLowerCase().includes('inspector')
      );
      if (salesReps.length > 0) {
        assignedSalesRep = salesReps[Date.now() % salesReps.length];
      } else {
        assignedSalesRep = teamMembers[0];
      }
    }

    // Format customer data
    const customerName = jobNimbusService.getContactName(contact);
    const customerAddress = jobNimbusService.formatAddress(contact);
    const customerPhone = jobNimbusService.getContactPhone(contact);

    // Find the specific job or use the first one
    let selectedJob: JobNimbusJob | undefined;
    if (jobId) {
      selectedJob = jobs.find(j => j.jnid === jobId);
    } else if (jobs.length > 0) {
      // Use the most recent job
      selectedJob = jobs.sort((a, b) =>
        (b.created_at || 0) - (a.created_at || 0)
      )[0];
    }

    // Generate portal
    const portalResult = await portalGenerator.generatePortalForLead({
      name: customerName,
      email: contact.email || '',
      phone: customerPhone,
      address: customerAddress,
      source: 'jobnimbus',
      assignedRepSlug: assignedSalesRep.slug,
      jobnimbusId: selectedJob?.jnid,
      jobnimbusContactId: contactId,
    });

    if (!portalResult.success || !portalResult.portalAccess) {
      return NextResponse.json(
        { success: false, error: portalResult.error || 'Failed to generate portal' },
        { status: 500 }
      );
    }

    // Store the lead record
    const lead = await leadPortalService.createLead({
      portalAccess: portalResult.portalAccess,
      shortCode: portalResult.shortCode!,
      source: 'jobnimbus',
      jobnimbusId: selectedJob?.jnid,
      jobnimbusContactId: contactId,
    });

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://rivercityroofingsolutions.com';

    return NextResponse.json({
      success: true,
      existing: false,
      data: {
        leadId: lead.leadId,
        customerId: lead.customerId,
        contactId,
        jobId: selectedJob?.jnid,
        accessToken: portalResult.portalAccess.accessToken,
        shortCode: portalResult.shortCode,
        portalUrl: portalResult.portalUrl,
        shortPortalUrl: `${baseUrl}/p/${portalResult.shortCode}`,
        qrCodeUrl: portalResult.qrCodeUrl,
        customerName,
        customerEmail: contact.email,
        customerPhone,
        customerAddress,
        salesRep: {
          name: assignedSalesRep.name,
          slug: assignedSalesRep.slug,
          phone: assignedSalesRep.phone,
          email: assignedSalesRep.email,
        },
        // Include JobNimbus data summary
        jobnimbus: {
          contact: {
            jnid: contact.jnid,
            name: customerName,
            status: contact.status,
          },
          jobCount: jobs.length,
          estimateCount: estimates.length,
          activeJob: selectedJob ? {
            jnid: selectedJob.jnid,
            name: selectedJob.name,
            status: selectedJob.status,
          } : null,
        },
        createdAt: lead.createdAt,
      },
    });

  } catch (error) {
    console.error('Error creating portal from JobNimbus:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
      },
      { status: 500 }
    );
  }
}

// GET - Search JobNimbus contacts for portal creation
export async function GET(request: NextRequest) {
  const auth = await requireAuth();
  if (!auth.authenticated) return auth.response;

  try {
    if (!isJobNimbusConfigured()) {
      return NextResponse.json(
        { success: false, error: 'JobNimbus API not configured' },
        { status: 500 }
      );
    }

    const { searchParams } = new URL(request.url);
    const email = searchParams.get('email');
    const phone = searchParams.get('phone');
    const contactId = searchParams.get('contactId');

    if (!email && !phone && !contactId) {
      return NextResponse.json(
        { success: false, error: 'Provide email, phone, or contactId to search' },
        { status: 400 }
      );
    }

    let contact: JobNimbusContact | null = null;

    if (contactId) {
      try {
        contact = await jobNimbusService.getContact(contactId);
      } catch {
        contact = null;
      }
    } else if (email) {
      contact = await jobNimbusService.searchContactByEmail(email);
    } else if (phone) {
      contact = await jobNimbusService.searchContactByPhone(phone);
    }

    if (!contact) {
      return NextResponse.json(
        { success: false, error: 'Contact not found' },
        { status: 404 }
      );
    }

    // Fetch related data
    const [jobs, estimates] = await Promise.all([
      jobNimbusService.getJobsForContact(contact.jnid),
      jobNimbusService.getEstimatesForContact(contact.jnid),
    ]);

    // Check if portal already exists
    let existingPortal = null;
    if (contact.email) {
      const existingLead = await leadPortalService.getLeadByEmail(contact.email);
      if (existingLead && existingLead.jobnimbusContactId === contact.jnid) {
        const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://rivercityroofingsolutions.com';
        existingPortal = {
          leadId: existingLead.leadId,
          portalUrl: `${baseUrl}/my/${existingLead.accessToken}`,
          createdAt: existingLead.createdAt,
          portalViews: existingLead.portalViews,
        };
      }
    }

    return NextResponse.json({
      success: true,
      contact: {
        jnid: contact.jnid,
        name: jobNimbusService.getContactName(contact),
        email: contact.email,
        phone: jobNimbusService.getContactPhone(contact),
        address: jobNimbusService.formatAddress(contact),
        status: contact.status,
        salesRep: contact.sales_rep_name,
      },
      jobs: jobs.map(j => ({
        jnid: j.jnid,
        name: j.name,
        status: j.status,
        address: [j.address_line1, j.city, j.state_text].filter(Boolean).join(', '),
      })),
      estimates: estimates.map(e => ({
        jnid: e.jnid,
        number: e.number,
        status: e.status,
        total: e.total,
      })),
      existingPortal,
    });

  } catch (error) {
    console.error('Error searching JobNimbus:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
      },
      { status: 500 }
    );
  }
}
