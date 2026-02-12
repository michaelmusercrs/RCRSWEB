// Lead Search API
// POST: Search leads by name, email, phone, or address with advanced filtering

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-service';
import { leadPortalService } from '@/lib/lead-portal-service';

interface SearchRequest {
  query?: string;
  status?: string;
  source?: string;
  salesRepSlug?: string;
  fromDate?: string;
  toDate?: string;
  limit?: number;
  sortBy?: 'createdAt' | 'status' | 'customerName';
  sortOrder?: 'asc' | 'desc';
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth();
  if (!auth.authenticated) return auth.response;

  try {
    const body: SearchRequest = await request.json();
    const { query, status, source, salesRepSlug, fromDate, toDate, limit, sortBy, sortOrder } = body;

    // Fetch leads with filters
    let leads = await leadPortalService.getLeads({
      status: status as any || undefined,
      source: source || undefined,
      salesRepSlug: salesRepSlug || undefined,
      fromDate: fromDate || undefined,
      toDate: toDate || undefined,
    });

    // Apply text search
    if (query) {
      const term = query.toLowerCase();
      leads = leads.filter(lead =>
        (lead.customerName || '').toLowerCase().includes(term) ||
        (lead.customerEmail || '').toLowerCase().includes(term) ||
        (lead.customerPhone || '').includes(term) ||
        (lead.customerAddress || '').toLowerCase().includes(term) ||
        (lead.leadId || '').toLowerCase().includes(term) ||
        (lead.serviceType || '').toLowerCase().includes(term) ||
        (lead.message || '').toLowerCase().includes(term)
      );
    }

    // Apply custom sorting
    if (sortBy) {
      leads.sort((a, b) => {
        let comparison = 0;
        switch (sortBy) {
          case 'createdAt':
            comparison = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
            break;
          case 'status':
            comparison = (a.status || '').localeCompare(b.status || '');
            break;
          case 'customerName':
            comparison = (a.customerName || '').localeCompare(b.customerName || '');
            break;
        }
        return sortOrder === 'asc' ? comparison : -comparison;
      });
    }

    // Apply limit
    if (limit) {
      leads = leads.slice(0, limit);
    }

    return NextResponse.json({
      success: true,
      count: leads.length,
      data: leads.map(lead => ({
        ...lead,
        accessToken: lead.accessToken ? lead.accessToken.substring(0, 8) + '...' : '',
        activityLog: undefined,
      })),
    });

  } catch (error) {
    console.error('[Lead Search API] Error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
