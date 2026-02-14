/**
 * RCRS Google Sheets Customers API
 *
 * GET /api/sheets/customers - Get customer data from Google Sheets
 * POST /api/sheets/customers - Create/update customer in Sheets
 * DELETE /api/sheets/customers - Delete customer from Sheets
 *
 * @author RCRS Development Team
 * @version 1.0.0
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-service';
import {
  googleSheetsService,
  isGoogleSheetsConfigured,
  CustomerRecord,
} from '@/lib/google-sheets-service';
import { cache, CACHE_TTL } from '@/lib/cache';

interface CustomersResponse {
  success: boolean;
  data?: {
    customers?: CustomerRecord[];
    customer?: CustomerRecord;
    summary?: {
      totalCustomers: number;
      totalRevenue: number;
      averageJobCount: number;
      topSalesReps: { name: string; customerCount: number }[];
    };
  };
  error?: string;
  message?: string;
}

/**
 * Generate a unique customer ID
 */
function generateCustomerId(): string {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `CUST-${timestamp}-${random}`;
}

/**
 * GET /api/sheets/customers
 *
 * Query Parameters:
 * - salesRep: Filter by assigned sales rep
 * - search: Search by name, email, phone, or address
 */
export async function GET(request: NextRequest): Promise<NextResponse<CustomersResponse>> {
  const auth = await requireAuth();
  if (!auth.authenticated) return auth.response as NextResponse<CustomersResponse>;

  try {
    if (!isGoogleSheetsConfigured()) {
      return NextResponse.json(
        {
          success: false,
          error: 'Google Sheets not configured',
        },
        { status: 400 }
      );
    }

    const { searchParams } = new URL(request.url);
    const salesRep = searchParams.get('salesRep') || undefined;
    const search = searchParams.get('search') || undefined;

    const cacheKey = `sheets:customers:${salesRep || 'all'}:${search || ''}`;
    const cached = cache.get<CustomerRecord[]>(cacheKey);
    const customers = cached ?? await (async () => {
      const data = await googleSheetsService.getCustomers({ salesRep, search });
      cache.set(cacheKey, data, CACHE_TTL.MEDIUM);
      return data;
    })();

    // Calculate summary
    const totalRevenue = customers.reduce((sum, c) => sum + c.totalSpent, 0);
    const averageJobCount = customers.length > 0
      ? customers.reduce((sum, c) => sum + c.jobCount, 0) / customers.length
      : 0;

    // Calculate top sales reps by customer count
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
        },
      },
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
 * POST /api/sheets/customers
 *
 * Create or update a customer in Google Sheets
 *
 * Body: CustomerRecord (customerId optional for new customers)
 */
export async function POST(request: NextRequest): Promise<NextResponse<CustomersResponse>> {
  const auth = await requireAuth();
  if (!auth.authenticated) return auth.response as NextResponse<CustomersResponse>;

  try {
    if (!isGoogleSheetsConfigured()) {
      return NextResponse.json(
        {
          success: false,
          error: 'Google Sheets not configured',
        },
        { status: 400 }
      );
    }

    const body = await request.json();

    // Validate required fields
    if (!body.name) {
      return NextResponse.json(
        {
          success: false,
          error: 'Customer name is required',
        },
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
        {
          success: false,
          error: 'Failed to save customer to Google Sheets',
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: { customer },
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
 * DELETE /api/sheets/customers
 *
 * Delete a customer from Google Sheets
 *
 * Body: { customerId: string }
 */
export async function DELETE(request: NextRequest): Promise<NextResponse<CustomersResponse>> {
  const auth = await requireAuth();
  if (!auth.authenticated) return auth.response as NextResponse<CustomersResponse>;

  try {
    if (!isGoogleSheetsConfigured()) {
      return NextResponse.json(
        {
          success: false,
          error: 'Google Sheets not configured',
        },
        { status: 400 }
      );
    }

    const body = await request.json();

    if (!body.customerId) {
      return NextResponse.json(
        {
          success: false,
          error: 'customerId is required',
        },
        { status: 400 }
      );
    }

    const success = await googleSheetsService.deleteCustomer(body.customerId);
    cache.invalidatePattern('^sheets:customers:');

    if (!success) {
      return NextResponse.json(
        {
          success: false,
          error: `Customer with ID ${body.customerId} not found`,
        },
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
