import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/auth-service';
import { deliveryWorkflowService } from '@/lib/delivery-workflow-service';
import { apiSuccess, apiError, getErrorMessage } from '@/lib/api-response';

export async function GET(request: NextRequest) {
  const auth = await requireAuth();
  if (!auth.authenticated) return auth.response;

  try {
    const { searchParams } = new URL(request.url);
    const invoiceId = searchParams.get('invoiceId');
    const status = searchParams.get('status') as 'draft' | 'pending' | 'sent' | 'paid' | 'overdue' | 'cancelled' | null;
    const limit = searchParams.get('limit');

    // Get single invoice
    if (invoiceId) {
      const invoice = await deliveryWorkflowService.getInvoiceById(invoiceId);
      if (!invoice) {
        return apiError('Invoice not found', 404, 'INVOICE_NOT_FOUND');
      }
      return apiSuccess({ invoice });
    }

    // Get invoices with filters
    const invoices = await deliveryWorkflowService.getInvoices({
      status: status || undefined,
      limit: limit ? parseInt(limit) : undefined,
    });

    return apiSuccess({ invoices });
  } catch (error) {
    console.error('Invoices API GET error:', error);
    return apiError(getErrorMessage(error), 500, 'INVOICES_FETCH_FAILED');
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth();
  if (!auth.authenticated) return auth.response;

  try {
    const body = await request.json();
    const { action, ...data } = body;

    switch (action) {
      case 'mark-paid': {
        if (!data.invoiceId) {
          return apiError('Invoice ID is required', 400, 'MISSING_INVOICE_ID');
        }
        await deliveryWorkflowService.markInvoicePaid(
          data.invoiceId,
          data.paymentMethod,
          data.reference
        );
        return apiSuccess({ invoiceId: data.invoiceId }, 200, 'Invoice marked as paid');
      }

      default:
        return apiError('Invalid action', 400, 'INVALID_ACTION');
    }
  } catch (error) {
    console.error('Invoices API POST error:', error);
    return apiError(getErrorMessage(error), 500, 'INVOICE_UPDATE_FAILED');
  }
}
