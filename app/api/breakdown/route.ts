/**
 * API Route: List All Breakdowns
 * GET /api/breakdown - Get all customer breakdowns with optional filters
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-service';
import { breakdownService, BreakdownStatus } from '@/lib/breakdown-service';

export async function GET(request: NextRequest) {
  const auth = await requireAuth();
  if (!auth.authenticated) return auth.response;

  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') as BreakdownStatus | null;
    const customerId = searchParams.get('customerId');
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');
    const action = searchParams.get('action');

    // Dashboard stats endpoint
    if (action === 'stats') {
      const stats = await breakdownService.getDashboardStats();
      return NextResponse.json({ stats });
    }

    const filters: any = {};
    if (status) filters.status = status;
    if (customerId) filters.customerId = customerId;
    if (dateFrom) filters.dateFrom = dateFrom;
    if (dateTo) filters.dateTo = dateTo;

    const breakdowns = await breakdownService.getAllBreakdowns(
      Object.keys(filters).length > 0 ? filters : undefined
    );

    // Calculate summary stats
    const summary = {
      total: breakdowns.length,
      active: breakdowns.filter(b => b.status === 'active').length,
      pendingInvoice: breakdowns.filter(b => b.status === 'pending_invoice').length,
      invoiced: breakdowns.filter(b => b.status === 'invoiced').length,
      closed: breakdowns.filter(b => b.status === 'closed').length,
      totalMaterialsValue: breakdowns.reduce((sum, b) => sum + b.materialsPrice, 0),
      totalLaborValue: breakdowns.reduce((sum, b) => sum + b.laborCost, 0),
      totalValue: breakdowns.reduce((sum, b) => sum + b.totalPrice, 0),
      averageMargin: breakdowns.length > 0
        ? breakdowns.reduce((sum, b) => sum + b.profitMargin, 0) / breakdowns.length
        : 0
    };

    return NextResponse.json({
      breakdowns,
      summary,
      count: breakdowns.length
    });
  } catch (error: any) {
    console.error('Error fetching breakdowns:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch breakdowns' },
      { status: 500 }
    );
  }
}
