// Leads API Route
// GET: List and search leads with optional filters
// Supports: status, source, salesRep, search query, date range, pagination

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-service';
import { leadPortalService } from '@/lib/lead-portal-service';

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
    const search = searchParams.get('search');
    const includeStats = searchParams.get('includeStats') === 'true';

    // Fetch leads with filters
    let leads = await leadPortalService.getLeads({
      status: status || undefined,
      source: source || undefined,
      salesRepSlug: salesRepSlug || undefined,
      fromDate: fromDate || undefined,
      toDate: toDate || undefined,
      limit: limit ? parseInt(limit) : undefined,
    });

    // Apply search filter (client-side text search across name, email, phone, address)
    if (search) {
      const term = search.toLowerCase();
      leads = leads.filter(lead =>
        (lead.customerName || '').toLowerCase().includes(term) ||
        (lead.customerEmail || '').toLowerCase().includes(term) ||
        (lead.customerPhone || '').includes(term) ||
        (lead.customerAddress || '').toLowerCase().includes(term) ||
        (lead.leadId || '').toLowerCase().includes(term)
      );
    }

    // Get statistics if requested
    let stats = null;
    if (includeStats) {
      stats = await leadPortalService.getLeadStats(fromDate || undefined, toDate || undefined);
    }

    return NextResponse.json({
      success: true,
      count: leads.length,
      data: leads.map(lead => ({
        ...lead,
        // Truncate sensitive token in list view
        accessToken: lead.accessToken ? lead.accessToken.substring(0, 8) + '...' : '',
        activityLog: undefined,
      })),
      stats,
    });

  } catch (error) {
    console.error('[Leads API] Error fetching leads:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
      },
      { status: 500 }
    );
  }
}
