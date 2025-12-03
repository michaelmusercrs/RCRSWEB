import { NextRequest, NextResponse } from 'next/server';
import { deliveryWorkflowService } from '@/lib/delivery-workflow-service';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const invoiceId = searchParams.get('invoiceId');
    const status = searchParams.get('status') as 'draft' | 'pending' | 'sent' | 'paid' | 'overdue' | 'cancelled' | null;
    const limit = searchParams.get('limit');

    // Get single invoice
    if (invoiceId) {
      const invoice = await deliveryWorkflowService.getInvoiceById(invoiceId);
      if (!invoice) {
        return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
      }
      return NextResponse.json(invoice);
    }

    // Get invoices with filters
    const invoices = await deliveryWorkflowService.getInvoices({
      status: status || undefined,
      limit: limit ? parseInt(limit) : undefined,
    });

    return NextResponse.json(invoices);
  } catch (error) {
    console.error('Invoices API GET error:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, ...data } = body;

    switch (action) {
      case 'mark-paid': {
        await deliveryWorkflowService.markInvoicePaid(
          data.invoiceId,
          data.paymentMethod,
          data.reference
        );
        return NextResponse.json({ success: true, message: 'Invoice marked as paid' });
      }

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    console.error('Invoices API POST error:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
