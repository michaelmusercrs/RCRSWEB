import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-service';
import { jobNimbusService, isJobNimbusConfigured, JobNimbusError } from '@/lib/jobnimbus-service';
import { viewerForRole } from '@/lib/jn-redact';

// GET /api/jobnimbus/search - Search for customers/jobs in JobNimbus
export async function GET(request: NextRequest) {
  const auth = await requireAuth();
  if (!auth.authenticated) return auth.response;

  // Derive viewer from caller role. Reps/customers get cost stripped.
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
  const query = searchParams.get('q') || searchParams.get('query') || '';
  const type = searchParams.get('type') || 'all'; // 'contacts', 'jobs', or 'all'
  const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100);

  if (!query || query.length < 2) {
    return NextResponse.json({
      success: false,
      error: 'Search query required (minimum 2 characters)',
    }, { status: 400 });
  }

  try {
    const results: {
      contacts: any[];
      jobs: any[];
    } = {
      contacts: [],
      jobs: [],
    };

    // Determine search strategy based on query format
    const isEmail = query.includes('@');
    const isPhone = /^\d{10}$|^\d{3}-\d{3}-\d{4}$|^\(\d{3}\)\s?\d{3}-\d{4}$/.test(query.replace(/\D/g, '').length >= 10 ? query : '');

    // Search contacts
    if (type === 'contacts' || type === 'all') {
      let contacts: any[] = [];

      if (isEmail) {
        // Search by email
        const contact = await jobNimbusService.searchContactByEmail(query, viewer);
        if (contact) {
          contacts = [contact];
        }
      } else if (isPhone) {
        // Search by phone
        const contact = await jobNimbusService.searchContactByPhone(query, viewer);
        if (contact) {
          contacts = [contact];
        }
      } else {
        // General name search - get contacts and filter
        const allContacts = await jobNimbusService.getContacts({ limit: 500 }, viewer);
        const searchLower = query.toLowerCase();
        contacts = allContacts.results.filter(c => {
          const name = jobNimbusService.getContactName(c).toLowerCase();
          const address = jobNimbusService.formatAddress(c).toLowerCase();
          return name.includes(searchLower) || address.includes(searchLower);
        }).slice(0, limit);
      }

      results.contacts = contacts.map(c => ({
        jnid: c.jnid,
        displayName: jobNimbusService.getContactName(c),
        firstName: c.first_name,
        lastName: c.last_name,
        email: c.email || '',
        phone: jobNimbusService.getContactPhone(c),
        address: jobNimbusService.formatAddress(c),
        addressLine1: c.address_line1,
        city: c.city,
        state: c.state_text,
        zip: c.zip,
        status: c.status,
        source: c.source,
        salesRep: c.sales_rep_name,
        salesRepId: c.sales_rep,
        createdAt: c.created_at ? new Date(c.created_at * 1000).toISOString() : null,
      }));
    }

    // Search jobs
    if (type === 'jobs' || type === 'all') {
      const allJobs = await jobNimbusService.getJobs({ limit: 500 }, viewer);
      const searchLower = query.toLowerCase();

      const filteredJobs = allJobs.results.filter(j => {
        const name = (j.name || '').toLowerCase();
        const number = (j.number || '').toLowerCase();
        const address = [j.address_line1, j.city, j.state_text].filter(Boolean).join(' ').toLowerCase();
        return name.includes(searchLower) || number.includes(searchLower) || address.includes(searchLower);
      }).slice(0, limit);

      results.jobs = filteredJobs.map(j => ({
        jnid: j.jnid,
        number: j.number,
        name: j.name,
        description: j.description,
        status: j.status,
        phase: jobNimbusService.mapStatusToPhase(j.status),
        salesRep: j.sales_rep_name,
        salesRepId: j.sales_rep,
        contactId: j.primary?.id,
        address: [j.address_line1, j.city, j.state_text, j.zip].filter(Boolean).join(', '),
        addressLine1: j.address_line1,
        city: j.city,
        state: j.state_text,
        zip: j.zip,
        startDate: j.date_start ? new Date(j.date_start * 1000).toISOString() : null,
        endDate: j.date_end ? new Date(j.date_end * 1000).toISOString() : null,
        createdAt: j.created_at ? new Date(j.created_at * 1000).toISOString() : null,
      }));
    }

    return NextResponse.json({
      success: true,
      query,
      type,
      results,
      totalFound: results.contacts.length + results.jobs.length,
    });
  } catch (error) {
    console.error('JobNimbus search error:', error);

    if (error instanceof JobNimbusError) {
      return NextResponse.json(
        {
          success: false,
          error: 'JobNimbus API error',
          message: error.message,
          statusCode: error.statusCode,
        },
        { status: error.statusCode || 500 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: 'Search failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
