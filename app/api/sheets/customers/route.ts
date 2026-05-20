/**
 * RCRS Customers API
 *
 * GET /api/sheets/customers - Get customer data from JobNimbus (primary) or Google Sheets (fallback)
 * POST /api/sheets/customers - Create/update customer in Sheets
 * DELETE /api/sheets/customers - Delete customer from Sheets
 *
 * Query params:
 *   source=jobnimbus|sheets (default: jobnimbus)
 *   salesRep=<name>
 *   search=<term>
 *   limit=<number> (for JN, default 500)
 *   includeArchived=true|false (default false)
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-service';
import {
  googleSheetsService,
  isGoogleSheetsConfigured,
  CustomerRecord,
} from '@/lib/google-sheets-service';
import { jobNimbusService, isJobNimbusConfigured } from '@/lib/jobnimbus-service';
import { viewerForRole, type JNViewer } from '@/lib/jn-redact';
import { cache, CACHE_TTL } from '@/lib/cache';

interface JNCustomerRecord {
  jnid: string;
  customerId: string;
  name: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  fullAddress: string;
  jobNumber: string;
  salesRep: string;
  createdBy: string;
  dateCreated: string;
  source: string;
  status: string;
  isArchived: boolean;
  lat: number | null;
  lng: number | null;
  jobCount: number;
  totalSpent: number;
  lastJobDate: string;
  createdAt: string;
  updatedAt: string;
}

interface CustomersResponse {
  success: boolean;
  data?: {
    customers?: (CustomerRecord | JNCustomerRecord)[];
    customer?: CustomerRecord;
    summary?: {
      totalCustomers: number;
      totalRevenue: number;
      averageJobCount: number;
      topSalesReps: { name: string; customerCount: number }[];
      withGeo: number;
    };
    source: 'jobnimbus' | 'sheets';
  };
  error?: string;
  message?: string;
}

function generateCustomerId(): string {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `CUST-${timestamp}-${random}`;
}

/**
 * Fetch all contacts from JobNimbus with pagination
 */
async function fetchAllJNContacts(maxContacts: number = 10500, viewer?: JNViewer): Promise<JNCustomerRecord[]> {
  const results: JNCustomerRecord[] = [];
  let offset = 0;
  const pageSize = 100;
  let hasMore = true;
  let pageCount = 0;
  const maxPages = Math.ceil(maxContacts / pageSize);

  while (hasMore && pageCount < maxPages) {
    const page = await jobNimbusService.getContacts({ limit: pageSize, offset }, viewer);

    for (const c of page.results) {
      const name = c.display_name || `${c.first_name || ''} ${c.last_name || ''}`.trim() || 'Unknown';
      const phone = c.mobile_phone || c.home_phone || c.work_phone || '';
      const address = c.address_line1 || '';
      const city = c.city || '';
      const state = c.state_text || '';
      const zip = c.zip || '';
      const fullAddress = [address, city, state, zip].filter(Boolean).join(', ');

      results.push({
        jnid: c.jnid,
        customerId: c.jnid,
        name,
        firstName: c.first_name || '',
        lastName: c.last_name || '',
        email: c.email || '',
        phone,
        address,
        city,
        state,
        zip,
        fullAddress,
        jobNumber: c.number || '',
        salesRep: c.sales_rep_name || '',
        createdBy: c.created_by_name || '',
        dateCreated: c.date_created
          ? new Date(c.date_created * 1000).toISOString()
          : c.created_at
            ? new Date(c.created_at * 1000).toISOString()
            : '',
        source: c.source_name || c.source || '',
        status: c.status_name || c.status || '',
        isArchived: c.is_archived || false,
        lat: c.geo?.lat ?? null,
        lng: c.geo?.lng ?? null,
        jobCount: 0,
        totalSpent: 0,
        lastJobDate: '',
        createdAt: c.created_at ? new Date(c.created_at * 1000).toISOString() : '',
        updatedAt: c.updated_at ? new Date(c.updated_at * 1000).toISOString() : '',
      });
    }

    offset += pageSize;
    hasMore = page.results.length === pageSize;
    pageCount++;
  }

  return results;
}

export async function GET(request: NextRequest): Promise<NextResponse<CustomersResponse>> {
  const auth = await requireAuth();
  if (!auth.authenticated) return auth.response as NextResponse<CustomersResponse>;

  // Derive viewer from caller role. The JN customer pull is cached per
  // includeArchived; cost-bearing fields are stripped before the cached
  // payload is built when the caller isn't on the allowlist.
  const viewer = viewerForRole(auth.user.role, { email: auth.user.email, userId: auth.user.userId });

  try {
    const { searchParams } = new URL(request.url);
    const dataSource = searchParams.get('source') || 'jobnimbus';
    const salesRep = searchParams.get('salesRep') || undefined;
    const search = searchParams.get('search') || undefined;
    const includeArchived = searchParams.get('includeArchived') === 'true';
    const limitParam = parseInt(searchParams.get('limit') || '0') || 0;

    // ── JobNimbus source ──────────────────────────────────────────────
    if (dataSource === 'jobnimbus') {
      if (!isJobNimbusConfigured()) {
        return NextResponse.json(
          { success: false, error: 'JobNimbus API not configured' },
          { status: 400 }
        );
      }

      // Cache key includes canSeeCost so the cached payload is segregated by
      // viewer-tier — we never serve a cost-bearing cache entry to a rep.
      const cacheKey = `jn:customers:${includeArchived}:cost=${viewer.canSeeCost ? '1' : '0'}`;
      let customers: JNCustomerRecord[] | undefined = cache.get<JNCustomerRecord[]>(cacheKey) ?? undefined;

      if (!customers) {
        customers = await fetchAllJNContacts(limitParam || 10500, viewer);
        cache.set(cacheKey, customers, CACHE_TTL.MEDIUM);
      }

      // Filter archived
      if (!includeArchived) {
        customers = customers.filter(c => !c.isArchived);
      }

      // Filter by sales rep
      if (salesRep) {
        const repLower = salesRep.toLowerCase();
        customers = customers.filter(c =>
          c.salesRep.toLowerCase().includes(repLower)
        );
      }

      // Search
      if (search) {
        const term = search.toLowerCase();
        customers = customers.filter(c =>
          c.name.toLowerCase().includes(term) ||
          c.email.toLowerCase().includes(term) ||
          c.phone.includes(term) ||
          c.fullAddress.toLowerCase().includes(term) ||
          c.jobNumber.toLowerCase().includes(term) ||
          c.status.toLowerCase().includes(term)
        );
      }

      // Summary
      const salesRepCounts = new Map<string, number>();
      let withGeo = 0;
      customers.forEach(c => {
        if (c.salesRep) {
          salesRepCounts.set(c.salesRep, (salesRepCounts.get(c.salesRep) || 0) + 1);
        }
        if (c.lat !== null && c.lng !== null) withGeo++;
      });

      const topSalesReps = Array.from(salesRepCounts.entries())
        .map(([name, customerCount]) => ({ name, customerCount }))
        .sort((a, b) => b.customerCount - a.customerCount)
        .slice(0, 10);

      return NextResponse.json({
        success: true,
        data: {
          customers,
          summary: {
            totalCustomers: customers.length,
            totalRevenue: 0,
            averageJobCount: 0,
            topSalesReps,
            withGeo,
          },
          source: 'jobnimbus',
        },
      }, {
        headers: { 'Cache-Control': 'private, s-maxage=30' },
      });
    }

    // ── Google Sheets source (legacy) ─────────────────────────────────
    if (!isGoogleSheetsConfigured()) {
      return NextResponse.json(
        { success: false, error: 'Google Sheets not configured' },
        { status: 400 }
      );
    }

    const cacheKey = `sheets:customers:${salesRep || 'all'}:${search || ''}`;
    const cached = cache.get<CustomerRecord[]>(cacheKey);
    const customers = cached ?? await (async () => {
      const data = await googleSheetsService.getCustomers({ salesRep, search });
      cache.set(cacheKey, data, CACHE_TTL.MEDIUM);
      return data;
    })();

    const totalRevenue = customers.reduce((sum, c) => sum + c.totalSpent, 0);
    const averageJobCount = customers.length > 0
      ? customers.reduce((sum, c) => sum + c.jobCount, 0) / customers.length
      : 0;

    const salesRepCounts = new Map<string, number>();
    customers.forEach(c => {
      if (c.salesRep) {
        salesRepCounts.set(c.salesRep, (salesRepCounts.get(c.salesRep) || 0) + 1);
      }
    });

    const topSalesReps = Array.from(salesRepCounts.entries())
      .map(([name, customerCount]) => ({ name, customerCount }))
      .sort((a, b) => b.customerCount - a.customerCount)
      .slice(0, 5);

    return NextResponse.json({
      success: true,
      data: {
        customers,
        summary: {
          totalCustomers: customers.length,
          totalRevenue,
          averageJobCount: Math.round(averageJobCount * 10) / 10,
          topSalesReps,
          withGeo: 0,
        },
        source: 'sheets',
      },
    }, {
      headers: { 'Cache-Control': 'private, s-maxage=30' },
    });
  } catch (error) {
    console.error('GET /api/sheets/customers error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch customers',
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/sheets/customers - Create or update a customer in Google Sheets
 */
export async function POST(request: NextRequest): Promise<NextResponse<CustomersResponse>> {
  const auth = await requireAuth();
  if (!auth.authenticated) return auth.response as NextResponse<CustomersResponse>;

  try {
    if (!isGoogleSheetsConfigured()) {
      return NextResponse.json(
        { success: false, error: 'Google Sheets not configured' },
        { status: 400 }
      );
    }

    const body = await request.json();
    if (!body.name) {
      return NextResponse.json(
        { success: false, error: 'Customer name is required' },
        { status: 400 }
      );
    }

    const now = new Date().toISOString();
    const customer: CustomerRecord = {
      customerId: body.customerId || generateCustomerId(),
      name: body.name,
      email: body.email || '',
      phone: body.phone || '',
      address: body.address || '',
      city: body.city || '',
      state: body.state || '',
      zip: body.zip || '',
      jobCount: parseInt(body.jobCount) || 0,
      totalSpent: parseFloat(body.totalSpent) || 0,
      lastJobDate: body.lastJobDate || '',
      notes: body.notes || '',
      source: body.source || '',
      salesRep: body.salesRep || '',
      createdAt: body.createdAt || now,
      updatedAt: now,
    };

    const success = await googleSheetsService.updateCustomer(customer);
    cache.invalidatePattern('^sheets:customers:');

    if (!success) {
      return NextResponse.json(
        { success: false, error: 'Failed to save customer to Google Sheets' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: { customer, source: 'sheets' },
      message: `Successfully saved customer: ${customer.name}`,
    });
  } catch (error) {
    console.error('POST /api/sheets/customers error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to save customer',
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/sheets/customers - Delete a customer from Google Sheets
 */
export async function DELETE(request: NextRequest): Promise<NextResponse<CustomersResponse>> {
  const auth = await requireAuth();
  if (!auth.authenticated) return auth.response as NextResponse<CustomersResponse>;

  try {
    if (!isGoogleSheetsConfigured()) {
      return NextResponse.json(
        { success: false, error: 'Google Sheets not configured' },
        { status: 400 }
      );
    }

    const body = await request.json();
    if (!body.customerId) {
      return NextResponse.json(
        { success: false, error: 'customerId is required' },
        { status: 400 }
      );
    }

    const success = await googleSheetsService.deleteCustomer(body.customerId);
    cache.invalidatePattern('^sheets:customers:');

    if (!success) {
      return NextResponse.json(
        { success: false, error: `Customer with ID ${body.customerId} not found` },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `Successfully deleted customer: ${body.customerId}`,
    });
  } catch (error) {
    console.error('DELETE /api/sheets/customers error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to delete customer',
      },
      { status: 500 }
    );
  }
}
