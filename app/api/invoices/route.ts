/**
 * API Route: List Invoices
 * GET /api/invoices - Get all invoices with optional filters
 */

import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/auth-service';
import { breakdownService, InvoiceStatus } from '@/lib/breakdown-service';
import { apiSuccess, apiError, getErrorMessage } from '@/lib/api-response';

export async function GET(request: NextRequest) {
  const auth = await requireAuth();
  if (!auth.authenticated) return auth.response;

  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') as InvoiceStatus | null;
    const customerId = searchParams.get('customerId');
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');
    const action = searchParams.get('action');

    // Dashboard stats endpoint
    if (action === 'stats') {
      const stats = await breakdownService.getDashboardStats();
      return apiSuccess({ stats });
    }

    const filters: any = {};
    if (status) filters.status = status;
    if (customerId) filters.customerId = customerId;
    if (dateFrom) filters.dateFrom = dateFrom;
    if (dateTo) filters.dateTo = dateTo;

    const invoices = await breakdownService.getAllInvoices(
      Object.keys(filters).length > 0 ? filters : undefined
    );

    // Calculate summary stats
    const summary = {
      total: invoices.length,
      draft: invoices.filter(i => i.status === 'draft').length,
      sent: invoices.filter(i => i.status === 'sent').length,
      viewed: invoices.filter(i => i.status === 'viewed').length,
      paid: invoices.filter(i => i.status === 'paid').length,
      overdue: invoices.filter(i => i.status === 'overdue').length,
      totalAmount: invoices.reduce((sum, i) => sum + i.total, 0),
      paidAmount: invoices.filter(i => i.status === 'paid').reduce((sum, i) => sum + i.total, 0),
      outstandingAmount: invoices
        .filter(i => ['sent', 'viewed', 'overdue'].includes(i.status))
        .reduce((sum, i) => sum + i.total, 0)
    };

    return apiSuccess({ invoices, summary, count: invoices.length });
  } catch (error) {
    console.error('Error fetching invoices:', error);
    return apiError(getErrorMessage(error), 500, 'INVOICES_FETCH_FAILED');
  }
}
