// Portal Generate API Route
// Generates portal links and tokens for existing customers

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-service';
import { portalGenerator, LeadData } from '@/lib/portal-generator';
import { leadPortalService } from '@/lib/lead-portal-service';
import { teamMembers } from '@/lib/teamData';

interface GeneratePortalRequest {
  // For existing customer - lookup by email or customerId
  email?: string;
  customerId?: string;

  // For new customer - full details
  name?: string;
  phone?: string;
  address?: string;
  city?: string;
  state?: string;
  zip?: string;

  // Sales rep assignment
  salesRepSlug?: string;

  // Source
  source?: 'contact_form' | 'jobnimbus' | 'phone_call' | 'referral' | 'walk_in' | 'other';

  // Options
  regenerate?: boolean; // Force regenerate even if exists
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth();
  if (!auth.authenticated) return auth.response;

  try {
    const body: GeneratePortalRequest = await request.json();

    // Check if looking up existing customer
    if (body.email && !body.regenerate) {
      const existingLead = await leadPortalService.getLeadByEmail(body.email);
      if (existingLead) {
        const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://rivercityroofingsolutions.com';
        const salesRep = teamMembers.find(m => m.slug === existingLead.salesRepSlug);

        return NextResponse.json({
          success: true,
          existing: true,
          data: {
            leadId: existingLead.leadId,
            customerId: existingLead.customerId,
            portalUrl: `${baseUrl}/my/${existingLead.accessToken}`,
            shortPortalUrl: `${baseUrl}/p/${existingLead.shortCode}`,
            qrCodeUrl: `${baseUrl}/api/portal/qr/${existingLead.accessToken}`,
            salesRep: salesRep ? {
              name: salesRep.name,
              slug: salesRep.slug,
              phone: salesRep.phone,
              email: salesRep.email,
              profileUrl: `${baseUrl}/team/${salesRep.slug}`,
            } : null,
            createdAt: existingLead.createdAt,
          },
        });
      }
    }

    // Check by customerId
    if (body.customerId) {
      const existingLead = await leadPortalService.getLeadByCustomerId(body.customerId);
      if (existingLead) {
        const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://rivercityroofingsolutions.com';
        const salesRep = teamMembers.find(m => m.slug === existingLead.salesRepSlug);

        return NextResponse.json({
          success: true,
          existing: true,
          data: {
            leadId: existingLead.leadId,
            customerId: existingLead.customerId,
            portalUrl: `${baseUrl}/my/${existingLead.accessToken}`,
            shortPortalUrl: `${baseUrl}/p/${existingLead.shortCode}`,
            qrCodeUrl: `${baseUrl}/api/portal/qr/${existingLead.accessToken}`,
            salesRep: salesRep ? {
              name: salesRep.name,
              slug: salesRep.slug,
              phone: salesRep.phone,
              email: salesRep.email,
              profileUrl: `${baseUrl}/team/${salesRep.slug}`,
            } : null,
            createdAt: existingLead.createdAt,
          },
        });
      }
    }

    // For new portal, require minimum fields
    if (!body.name || !body.email || !body.phone || !body.address) {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing required fields for new portal',
          required: ['name', 'email', 'phone', 'address'],
        },
        { status: 400 }
      );
    }

    // Generate new portal
    const leadData: LeadData = {
      name: body.name,
      email: body.email,
      phone: body.phone,
      address: body.address,
      city: body.city,
      state: body.state,
      zip: body.zip,
      source: body.source || 'other',
      assignedRepSlug: body.salesRepSlug,
    };

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
      source: body.source || 'other',
    });

    const salesRep = portalResult.salesRep;
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://rivercityroofingsolutions.com';

    return NextResponse.json({
      success: true,
      existing: false,
      data: {
        leadId: lead.leadId,
        customerId: lead.customerId,
        accessToken: portalResult.portalAccess.accessToken,
        shortCode: portalResult.shortCode,
        portalUrl: portalResult.portalUrl,
        shortPortalUrl: `${baseUrl}/p/${portalResult.shortCode}`,
        qrCodeUrl: portalResult.qrCodeUrl,
        salesRep: salesRep ? {
          name: salesRep.name,
          slug: salesRep.slug,
          position: salesRep.position,
          phone: salesRep.phone,
          email: salesRep.email,
          profileUrl: `${baseUrl}/team/${salesRep.slug}`,
        } : null,
        createdAt: lead.createdAt,
      },
    });

  } catch (error) {
    console.error('Error generating portal:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
      },
      { status: 500 }
    );
  }
}

// GET - Lookup portal by token or short code
export async function GET(request: NextRequest) {
  const auth = await requireAuth();
  if (!auth.authenticated) return auth.response;

  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');
    const shortCode = searchParams.get('code');
    const email = searchParams.get('email');

    let lead = null;

    if (token) {
      lead = await leadPortalService.getLeadByToken(token);
    } else if (shortCode) {
      lead = await leadPortalService.getLeadByShortCode(shortCode);
    } else if (email) {
      lead = await leadPortalService.getLeadByEmail(email);
    } else {
      return NextResponse.json(
        {
          success: false,
          error: 'Must provide token, code, or email parameter',
        },
        { status: 400 }
      );
    }

    if (!lead) {
      return NextResponse.json(
        { success: false, error: 'Portal not found' },
        { status: 404 }
      );
    }

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://rivercityroofingsolutions.com';
    const salesRep = teamMembers.find(m => m.slug === lead.salesRepSlug);

    return NextResponse.json({
      success: true,
      data: {
        leadId: lead.leadId,
        customerId: lead.customerId,
        customerName: lead.customerName,
        portalUrl: `${baseUrl}/my/${lead.accessToken}`,
        shortPortalUrl: `${baseUrl}/p/${lead.shortCode}`,
        qrCodeUrl: `${baseUrl}/api/portal/qr/${lead.accessToken}`,
        salesRep: salesRep ? {
          name: salesRep.name,
          slug: salesRep.slug,
          phone: salesRep.phone,
          email: salesRep.email,
          profileUrl: `${baseUrl}/team/${salesRep.slug}`,
        } : null,
        status: lead.status,
        portalViews: lead.portalViews,
        createdAt: lead.createdAt,
      },
    });

  } catch (error) {
    console.error('Error looking up portal:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
      },
      { status: 500 }
    );
  }
}
