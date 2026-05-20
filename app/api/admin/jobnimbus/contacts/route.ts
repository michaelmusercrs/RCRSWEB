import { NextResponse } from 'next/server';
import { jobNimbusService, isJobNimbusConfigured } from '@/lib/jobnimbus-service';
import { requireAdmin } from '@/lib/auth-service';
import { viewerForRole } from '@/lib/jn-redact';

export async function GET(request: Request) {
  const auth = await requireAdmin();
  if (!auth.authenticated) return auth.response;

  // Admin-gated route — derive viewer from role (admin/owner => sees cost).
  const viewer = viewerForRole(auth.user.role, { email: auth.user.email, userId: auth.user.userId });

  if (!isJobNimbusConfigured()) {
    return NextResponse.json(
      {
        success: false,
        error: 'JobNimbus API key not configured',
        message: 'Please set JOBNIMBUS_API_KEY in your .env.local file'
      },
      { status: 500 }
    );
  }

  const { searchParams } = new URL(request.url);
  const contactId = searchParams.get('contactId');
  const email = searchParams.get('email');
  const phone = searchParams.get('phone');
  const limit = parseInt(searchParams.get('limit') || '100');
  const offset = parseInt(searchParams.get('offset') || '0');

  try {
    // Get specific contact by ID
    if (contactId) {
      const contact = await jobNimbusService.getContact(contactId, viewer);
      return NextResponse.json({
        success: true,
        contact: {
          jnid: contact.jnid,
          displayName: jobNimbusService.getContactName(contact),
          firstName: contact.first_name,
          lastName: contact.last_name,
          email: contact.email,
          phone: jobNimbusService.getContactPhone(contact),
          mobilePhone: contact.mobile_phone,
          homePhone: contact.home_phone,
          workPhone: contact.work_phone,
          address: jobNimbusService.formatAddress(contact),
          status: contact.status,
          source: contact.source,
          salesRep: contact.sales_rep_name,
          createdAt: contact.created_at ? new Date(contact.created_at * 1000).toISOString() : null,
          updatedAt: contact.updated_at ? new Date(contact.updated_at * 1000).toISOString() : null,
        },
      });
    }

    // Search by email
    if (email) {
      const contact = await jobNimbusService.searchContactByEmail(email, viewer);
      if (!contact) {
        return NextResponse.json({
          success: true,
          found: false,
          message: 'No contact found with this email',
        });
      }
      return NextResponse.json({
        success: true,
        found: true,
        contact: {
          jnid: contact.jnid,
          displayName: jobNimbusService.getContactName(contact),
          email: contact.email,
          phone: jobNimbusService.getContactPhone(contact),
          address: jobNimbusService.formatAddress(contact),
          status: contact.status,
        },
      });
    }

    // Search by phone
    if (phone) {
      const contact = await jobNimbusService.searchContactByPhone(phone, viewer);
      if (!contact) {
        return NextResponse.json({
          success: true,
          found: false,
          message: 'No contact found with this phone number',
        });
      }
      return NextResponse.json({
        success: true,
        found: true,
        contact: {
          jnid: contact.jnid,
          displayName: jobNimbusService.getContactName(contact),
          email: contact.email,
          phone: jobNimbusService.getContactPhone(contact),
          address: jobNimbusService.formatAddress(contact),
          status: contact.status,
        },
      });
    }

    // Get all contacts with pagination
    const result = await jobNimbusService.getContacts({ limit, offset }, viewer);

    return NextResponse.json({
      success: true,
      count: result.count,
      contacts: result.results.map(c => ({
        jnid: c.jnid,
        displayName: jobNimbusService.getContactName(c),
        email: c.email || '',
        phone: jobNimbusService.getContactPhone(c),
        address: jobNimbusService.formatAddress(c),
        status: c.status,
        salesRep: c.sales_rep_name,
        createdAt: c.created_at ? new Date(c.created_at * 1000).toISOString() : null,
      })),
      pagination: {
        limit,
        offset,
        total: result.count,
        hasMore: offset + result.results.length < result.count,
      },
    });
  } catch (error) {
    console.error('Contacts API error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch contacts',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
