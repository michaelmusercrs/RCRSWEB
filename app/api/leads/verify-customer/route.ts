import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-service';
import { jobNimbusService, isJobNimbusConfigured } from '@/lib/jobnimbus-service';

// POST /api/leads/verify-customer - Check if customer exists in JobNimbus
// Searches by email, phone, and name simultaneously, returns deduplicated results with jobs
export async function POST(request: NextRequest) {
  const auth = await requireAuth();
  if (!auth.authenticated) return auth.response;

  if (!isJobNimbusConfigured()) {
    return NextResponse.json(
      { success: false, error: 'JobNimbus not configured' },
      { status: 500 }
    );
  }

  try {
    const body = await request.json();
    const { email, phone, firstName, lastName } = body;

    if (!email && !phone && !firstName) {
      return NextResponse.json(
        { success: false, error: 'At least one search field required (email, phone, or name)' },
        { status: 400 }
      );
    }

    const seen = new Set<string>();
    const matches: Array<{
      jnid: string;
      displayName: string;
      email: string;
      phone: string;
      address: string;
      salesRep: string;
      status: string;
      matchedBy: string;
      jobs: Array<{
        jnid: string;
        number: string;
        status: string;
        description: string;
      }>;
    }> = [];

    const addMatch = async (contact: any, matchedBy: string) => {
      if (!contact || seen.has(contact.jnid)) return;
      seen.add(contact.jnid);

      // Fetch jobs for this contact
      let jobs: any[] = [];
      try {
        jobs = await jobNimbusService.getJobsForContact(contact.jnid);
      } catch {
        // Jobs fetch failed, continue without
      }

      matches.push({
        jnid: contact.jnid,
        displayName: jobNimbusService.getContactName(contact),
        email: contact.email || '',
        phone: jobNimbusService.getContactPhone(contact),
        address: jobNimbusService.formatAddress(contact),
        salesRep: contact.sales_rep_name || 'Unassigned',
        status: contact.status || 'unknown',
        matchedBy,
        jobs: jobs.map(j => ({
          jnid: j.jnid,
          number: j.number || '',
          status: j.status || '',
          description: j.description || '',
        })),
      });
    };

    // Search in parallel: email, phone, name
    const searches: Promise<void>[] = [];

    if (email) {
      searches.push(
        jobNimbusService.searchContactByEmail(email)
          .then(c => addMatch(c, 'email'))
          .catch(() => {})
      );
    }

    if (phone) {
      searches.push(
        jobNimbusService.searchContactByPhone(phone)
          .then(c => addMatch(c, 'phone'))
          .catch(() => {})
      );
    }

    if (firstName || lastName) {
      const fullName = `${firstName || ''} ${lastName || ''}`.trim().toLowerCase();
      if (fullName.length >= 2) {
        searches.push(
          jobNimbusService.getContacts({ limit: 200 })
            .then(result => {
              const nameMatches = result.results.filter(c => {
                const contactName = jobNimbusService.getContactName(c).toLowerCase();
                return contactName.includes(fullName) || fullName.includes(contactName);
              });
              return Promise.all(nameMatches.slice(0, 5).map(c => addMatch(c, 'name')));
            })
            .then(() => {})
            .catch(() => {})
        );
      }
    }

    await Promise.all(searches);

    return NextResponse.json({
      success: true,
      matches,
      totalFound: matches.length,
    });
  } catch (error) {
    console.error('Customer verification error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Verification failed' },
      { status: 500 }
    );
  }
}
