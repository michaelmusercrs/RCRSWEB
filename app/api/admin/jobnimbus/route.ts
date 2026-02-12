import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth-service';

const JOBNIMBUS_API_KEY = process.env.JOBNIMBUS_API_KEY;
const JOBNIMBUS_API_URL = process.env.JOBNIMBUS_API_URL || 'https://app.jobnimbus.com/api1';

async function fetchFromJobNimbus(endpoint: string, params?: Record<string, string>) {
  if (!JOBNIMBUS_API_KEY) {
    throw new Error('JOBNIMBUS_API_KEY is not configured. Please set it in .env.local');
  }

  const url = new URL(`${JOBNIMBUS_API_URL}${endpoint}`);
  if (params) {
    Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));
  }

  const response = await fetch(url.toString(), {
    headers: {
      'Authorization': `Bearer ${JOBNIMBUS_API_KEY}`,
      'Content-Type': 'application/json',
    },
    next: { revalidate: 60 }, // Cache for 60 seconds
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`JobNimbus API error (${response.status}): ${errorText}`);
  }

  return response.json();
}

export async function GET(request: Request) {
  const auth = await requireAdmin();
  if (!auth.authenticated) return auth.response;

  const { searchParams } = new URL(request.url);
  const type = searchParams.get('type'); // contacts, jobs, estimates, tasks
  const limit = searchParams.get('limit') || '100';
  const offset = searchParams.get('offset') || '0';

  // Require API key - no demo mode
  if (!JOBNIMBUS_API_KEY) {
    return NextResponse.json(
      {
        success: false,
        error: 'JobNimbus API key not configured',
        message: 'Please set JOBNIMBUS_API_KEY in your .env.local file'
      },
      { status: 500 }
    );
  }

  try {
    // If specific type requested, return just that data
    if (type) {
      const validTypes = ['contacts', 'jobs', 'estimates', 'tasks', 'notes'];
      if (!validTypes.includes(type)) {
        return NextResponse.json(
          { success: false, error: `Invalid type. Must be one of: ${validTypes.join(', ')}` },
          { status: 400 }
        );
      }

      const data = await fetchFromJobNimbus(`/${type}`, { limit, offset });
      return NextResponse.json({
        success: true,
        type,
        count: data.count,
        results: data.results,
        pagination: {
          limit: parseInt(limit),
          offset: parseInt(offset),
          total: data.count,
          hasMore: parseInt(offset) + data.results.length < data.count
        }
      });
    }

    // Default: fetch overview data (contacts and jobs)
    // Fetch contacts from JobNimbus
    const contactsResponse = await fetch(`${JOBNIMBUS_API_URL}/contacts?limit=100`, {
      headers: {
        'Authorization': `Bearer ${JOBNIMBUS_API_KEY}`,
        'Content-Type': 'application/json',
      },
    });

    if (!contactsResponse.ok) {
      throw new Error(`JobNimbus API error: ${contactsResponse.status}`);
    }

    const contactsData = await contactsResponse.json();

    // Fetch jobs from JobNimbus
    const jobsResponse = await fetch(`${JOBNIMBUS_API_URL}/jobs?limit=100`, {
      headers: {
        'Authorization': `Bearer ${JOBNIMBUS_API_KEY}`,
        'Content-Type': 'application/json',
      },
    });

    const jobsData = await jobsResponse.json();

    const contacts = (contactsData.results || []).map((c: Record<string, unknown>) => ({
      jnid: c.jnid,
      display_name: c.display_name || `${c.first_name || ''} ${c.last_name || ''}`.trim() || 'Unknown',
      email: c.email || '',
      phone: c.mobile_phone || c.home_phone || c.work_phone || '',
      address: [c.address_line1, c.city, c.state_text, c.zip].filter(Boolean).join(', '),
      status: c.status || 'Active',
      created_at: c.created_at ? new Date((c.created_at as number) * 1000).toISOString() : new Date().toISOString(),
    }));

    const jobs = (jobsData.results || []).map((j: Record<string, unknown>) => ({
      jnid: j.jnid,
      name: j.name || 'Untitled Job',
      status: j.status || 'New',
      address: [j.address_line1, j.city, j.state_text, j.zip].filter(Boolean).join(', '),
      contact_name: (j.primary as Record<string, string>)?.display_name || '',
      created_at: j.created_at ? new Date((j.created_at as number) * 1000).toISOString() : new Date().toISOString(),
    }));

    const activeJobs = jobs.filter(
      (j: { status: string }) => {
        const status = (j.status || '').toString().toLowerCase();
        return !status.includes('complete') && !status.includes('closed');
      }
    ).length;

    const completedJobs = jobs.filter(
      (j: { status: string }) => {
        const status = (j.status || '').toString().toLowerCase();
        return status.includes('complete') || status.includes('closed');
      }
    ).length;

    return NextResponse.json({
      success: true,
      contacts,
      jobs,
      stats: {
        totalContacts: contacts.length,
        totalJobs: jobs.length,
        activeJobs,
        completedJobs,
      },
      lastSync: new Date().toISOString(),
    });
  } catch (error) {
    console.error('JobNimbus API error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch data from JobNimbus' },
      { status: 500 }
    );
  }
}
