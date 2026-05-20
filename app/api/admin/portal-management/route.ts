// Admin Portal Management API
// Manage customer portals and JobNimbus integration

import { NextRequest, NextResponse } from 'next/server';
import { jobNimbusService, isJobNimbusConfigured } from '@/lib/jobnimbus-service';
import { leadPortalService } from '@/lib/lead-portal-service';
import { teamMembers } from '@/lib/teamData';
import { requireAdmin } from '@/lib/auth-service';
import { viewerForRole } from '@/lib/jn-redact';

// GET - List all portals with JobNimbus status
export async function GET(request: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.authenticated) return auth.response;

  // Admin-gated route — derive viewer from role (admin/owner => sees cost).
  const viewer = viewerForRole(auth.user.role, { email: auth.user.email, userId: auth.user.userId });

  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action') || 'list';

    if (action === 'list') {
      // Get all leads/portals
      const leads = await leadPortalService.getLeads({ limit: 100 });

      const portalsWithStatus = leads.map(lead => ({
        leadId: lead.leadId,
        customerId: lead.customerId,
        customerName: lead.customerName,
        customerEmail: lead.customerEmail,
        customerPhone: lead.customerPhone,
        salesRepName: lead.salesRepName,
        status: lead.status,
        portalViews: lead.portalViews,
        lastPortalView: lead.lastPortalView,
        createdAt: lead.createdAt,
        hasJobNimbusLink: !!lead.jobnimbusContactId,
        jobnimbusContactId: lead.jobnimbusContactId,
        jobnimbusJobId: lead.jobnimbusId,
        portalUrl: `${process.env.NEXT_PUBLIC_BASE_URL || 'https://rivercityroofingsolutions.com'}/my/${lead.accessToken}`,
      }));

      return NextResponse.json({
        success: true,
        portals: portalsWithStatus,
        totalCount: portalsWithStatus.length,
      });
    }

    if (action === 'stats') {
      const stats = await leadPortalService.getLeadStats();
      return NextResponse.json({ success: true, stats });
    }

    if (action === 'search-jobnimbus') {
      if (!isJobNimbusConfigured()) {
        return NextResponse.json(
          { success: false, error: 'JobNimbus not configured' },
          { status: 500 }
        );
      }

      const query = searchParams.get('q');
      if (!query) {
        return NextResponse.json(
          { success: false, error: 'Search query required' },
          { status: 400 }
        );
      }

      // Search by email or phone
      let contact = null;
      if (query.includes('@')) {
        contact = await jobNimbusService.searchContactByEmail(query, viewer);
      } else {
        contact = await jobNimbusService.searchContactByPhone(query, viewer);
      }

      if (!contact) {
        return NextResponse.json({
          success: true,
          found: false,
          message: 'No contact found in JobNimbus',
        });
      }

      // Get related data
      const [jobs, estimates] = await Promise.all([
        jobNimbusService.getJobsForContact(contact.jnid, viewer),
        jobNimbusService.getEstimatesForContact(contact.jnid, viewer),
      ]);

      // Check if portal already exists
      let existingPortal = null;
      if (contact.email) {
        const existingLead = await leadPortalService.getLeadByEmail(contact.email);
        if (existingLead) {
          existingPortal = {
            leadId: existingLead.leadId,
            portalUrl: `${process.env.NEXT_PUBLIC_BASE_URL}/my/${existingLead.accessToken}`,
            createdAt: existingLead.createdAt,
          };
        }
      }

      return NextResponse.json({
        success: true,
        found: true,
        contact: {
          jnid: contact.jnid,
          name: jobNimbusService.getContactName(contact),
          email: contact.email,
          phone: jobNimbusService.getContactPhone(contact),
          address: jobNimbusService.formatAddress(contact),
          status: contact.status,
          salesRep: contact.sales_rep_name,
        },
        jobCount: jobs.length,
        estimateCount: estimates.length,
        jobs: jobs.slice(0, 5).map(j => ({
          jnid: j.jnid,
          name: j.name,
          status: j.status,
        })),
        existingPortal,
      });
    }

    if (action === 'jobnimbus-contacts') {
      if (!isJobNimbusConfigured()) {
        return NextResponse.json(
          { success: false, error: 'JobNimbus not configured' },
          { status: 500 }
        );
      }

      const limit = parseInt(searchParams.get('limit') || '25');
      const offset = parseInt(searchParams.get('offset') || '0');

      const result = await jobNimbusService.getContacts({ limit, offset }, viewer);

      const contacts = result.results.map(c => ({
        jnid: c.jnid,
        name: jobNimbusService.getContactName(c),
        email: c.email,
        phone: jobNimbusService.getContactPhone(c),
        address: jobNimbusService.formatAddress(c),
        status: c.status,
        salesRep: c.sales_rep_name,
      }));

      return NextResponse.json({
        success: true,
        contacts,
        totalCount: result.count,
        hasMore: offset + limit < result.count,
      });
    }

    return NextResponse.json(
      { success: false, error: 'Invalid action' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Portal management error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
      },
      { status: 500 }
    );
  }
}

// POST - Create or update portal
export async function POST(request: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.authenticated) return auth.response;

  // Admin-gated route — derive viewer from role.
  const postViewer = viewerForRole(auth.user.role, { email: auth.user.email, userId: auth.user.userId });

  try {
    const body = await request.json();
    const { action } = body;

    if (action === 'create-from-jobnimbus') {
      if (!isJobNimbusConfigured()) {
        return NextResponse.json(
          { success: false, error: 'JobNimbus not configured' },
          { status: 500 }
        );
      }

      const { contactId, jobId, salesRepSlug } = body;

      if (!contactId) {
        return NextResponse.json(
          { success: false, error: 'contactId is required' },
          { status: 400 }
        );
      }

      // Fetch contact from JobNimbus
      const portalData = await jobNimbusService.getCustomerPortalData(contactId, postViewer);

      if (!portalData) {
        return NextResponse.json(
          { success: false, error: 'Contact not found in JobNimbus' },
          { status: 404 }
        );
      }

      const { contact, jobs } = portalData;

      // Check for existing portal
      if (contact.email) {
        const existing = await leadPortalService.getLeadByEmail(contact.email);
        if (existing && existing.jobnimbusContactId === contactId) {
          const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://rivercityroofingsolutions.com';
          return NextResponse.json({
            success: true,
            existing: true,
            portalUrl: `${baseUrl}/my/${existing.accessToken}`,
            leadId: existing.leadId,
          });
        }
      }

      // Determine sales rep
      let salesRep = salesRepSlug
        ? teamMembers.find(m => m.slug === salesRepSlug)
        : null;

      if (!salesRep && contact.sales_rep_name) {
        const repName = contact.sales_rep_name.toLowerCase();
        salesRep = teamMembers.find(m =>
          m.name.toLowerCase().includes(repName) ||
          repName.includes(m.name.toLowerCase().split(' ')[0])
        );
      }

      if (!salesRep) {
        salesRep = teamMembers[0];
      }

      // Get the selected or most recent job
      let selectedJob = jobId
        ? jobs.find(j => j.jnid === jobId)
        : jobs[0];

      // Create portal
      const { portalGenerator } = await import('@/lib/portal-generator');

      const result = await portalGenerator.generatePortalForLead({
        name: jobNimbusService.getContactName(contact),
        email: contact.email || '',
        phone: jobNimbusService.getContactPhone(contact),
        address: jobNimbusService.formatAddress(contact),
        source: 'jobnimbus',
        assignedRepSlug: salesRep.slug,
        jobnimbusId: selectedJob?.jnid,
        jobnimbusContactId: contactId,
      });

      if (!result.success || !result.portalAccess) {
        return NextResponse.json(
          { success: false, error: result.error || 'Failed to create portal' },
          { status: 500 }
        );
      }

      // Store the lead
      const lead = await leadPortalService.createLead({
        portalAccess: result.portalAccess,
        shortCode: result.shortCode!,
        source: 'jobnimbus',
        jobnimbusId: selectedJob?.jnid,
        jobnimbusContactId: contactId,
      });

      return NextResponse.json({
        success: true,
        existing: false,
        portalUrl: result.portalUrl,
        shortCode: result.shortCode,
        leadId: lead.leadId,
        customerId: lead.customerId,
        customerName: lead.customerName,
        salesRep: {
          name: salesRep.name,
          slug: salesRep.slug,
        },
      });
    }

    if (action === 'update-status') {
      const { leadId, status } = body;

      if (!leadId || !status) {
        return NextResponse.json(
          { success: false, error: 'leadId and status are required' },
          { status: 400 }
        );
      }

      const updated = await leadPortalService.updateLeadStatus(leadId, status);

      return NextResponse.json({
        success: updated,
        message: updated ? 'Status updated' : 'Lead not found',
      });
    }

    return NextResponse.json(
      { success: false, error: 'Invalid action' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Portal management error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
      },
      { status: 500 }
    );
  }
}
