import { NextResponse } from 'next/server';

const JOBNIMBUS_API_KEY = process.env.JOBNIMBUS_API_KEY;
const JOBNIMBUS_API_URL = process.env.JOBNIMBUS_API_URL || 'https://app.jobnimbus.com/api1';

export async function GET() {
  // Demo mode when API key not configured
  if (!JOBNIMBUS_API_KEY) {
    return NextResponse.json({
      success: true,
      contacts: [
        {
          jnid: 'demo-1',
          display_name: 'John Smith',
          email: 'john.smith@example.com',
          phone: '256-555-1234',
          address: '123 Main St, Hartselle, AL',
          status: 'Active',
          created_at: new Date().toISOString(),
        },
        {
          jnid: 'demo-2',
          display_name: 'Jane Doe',
          email: 'jane.doe@example.com',
          phone: '256-555-5678',
          address: '456 Oak Ave, Decatur, AL',
          status: 'Lead',
          created_at: new Date().toISOString(),
        },
        {
          jnid: 'demo-3',
          display_name: 'Bob Johnson',
          email: 'bob.j@example.com',
          phone: '256-555-9012',
          address: '789 Pine St, Huntsville, AL',
          status: 'Customer',
          created_at: new Date().toISOString(),
        },
      ],
      jobs: [
        {
          jnid: 'job-1',
          name: 'Roof Replacement - Smith',
          status: 'In Progress',
          address: '123 Main St, Hartselle, AL',
          contact_name: 'John Smith',
          created_at: new Date().toISOString(),
        },
        {
          jnid: 'job-2',
          name: 'Storm Damage Repair - Doe',
          status: 'Scheduled',
          address: '456 Oak Ave, Decatur, AL',
          contact_name: 'Jane Doe',
          created_at: new Date().toISOString(),
        },
        {
          jnid: 'job-3',
          name: 'Inspection - Johnson',
          status: 'Completed',
          address: '789 Pine St, Huntsville, AL',
          contact_name: 'Bob Johnson',
          created_at: new Date().toISOString(),
        },
      ],
      stats: {
        totalContacts: 3,
        totalJobs: 3,
        activeJobs: 2,
        completedJobs: 1,
      },
      lastSync: new Date().toISOString(),
    });
  }

  try {
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
      (j: { status: string }) =>
        !j.status.toLowerCase().includes('complete') && !j.status.toLowerCase().includes('closed')
    ).length;

    const completedJobs = jobs.filter(
      (j: { status: string }) =>
        j.status.toLowerCase().includes('complete') || j.status.toLowerCase().includes('closed')
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
