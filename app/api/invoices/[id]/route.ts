/**
 * API Route: Invoice Operations
 * GET /api/invoices/[id] - Get invoice by ID
 * PATCH /api/invoices/[id] - Update invoice status
 * POST /api/invoices/[id] - Send invoice
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-service';
import { breakdownService, InvoiceStatus } from '@/lib/breakdown-service';
import { generateInvoiceHTML } from '@/lib/invoice-pdf-service';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET - Retrieve invoice by ID
export async function GET(
  request: NextRequest,
  { params }: RouteParams
) {
  const auth = await requireAuth();
  if (!auth.authenticated) return auth.response;

  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const format = searchParams.get('format');

    const invoice = await breakdownService.getInvoice(id);

    if (!invoice) {
      // Try by invoice number
      const invoiceByNumber = await breakdownService.getInvoiceByNumber(id);
      if (!invoiceByNumber) {
        return NextResponse.json(
          { error: 'Invoice not found' },
          { status: 404 }
        );
      }

      if (format === 'html') {
        return generateInvoiceHTMLResponse(invoiceByNumber);
      }

      return NextResponse.json({ invoice: invoiceByNumber });
    }

    if (format === 'html') {
      return generateInvoiceHTMLResponse(invoice);
    }

    return NextResponse.json({ invoice });
  } catch (error: any) {
    console.error('Error fetching invoice:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch invoice' },
      { status: 500 }
    );
  }
}

// PATCH - Update invoice status
export async function PATCH(
  request: NextRequest,
  { params }: RouteParams
) {
  const auth = await requireAuth();
  if (!auth.authenticated) return auth.response;

  try {
    const { id } = await params;
    const body = await request.json();
    const {
      status,
      updatedBy,
      updatedByName,
      paidAmount,
      paymentMethod,
      paymentReference
    } = body;

    if (!status) {
      return NextResponse.json(
        { error: 'status is required' },
        { status: 400 }
      );
    }

    if (!updatedBy || !updatedByName) {
      return NextResponse.json(
        { error: 'updatedBy and updatedByName are required' },
        { status: 400 }
      );
    }

    const validStatuses: InvoiceStatus[] = ['draft', 'sent', 'viewed', 'paid', 'overdue', 'cancelled', 'disputed'];
    if (!validStatuses.includes(status)) {
      return NextResponse.json(
        { error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` },
        { status: 400 }
      );
    }

    const invoice = await breakdownService.updateInvoiceStatus(
      id,
      status,
      updatedBy,
      updatedByName,
      status === 'paid' ? { paidAmount, paymentMethod, paymentReference } : undefined
    );

    if (!invoice) {
      return NextResponse.json(
        { error: 'Invoice not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      invoice,
      message: `Invoice status updated to ${status}`
    });
  } catch (error: any) {
    console.error('Error updating invoice:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to update invoice' },
      { status: 500 }
    );
  }
}

// POST - Send invoice to customer
export async function POST(
  request: NextRequest,
  { params }: RouteParams
) {
  const auth = await requireAuth();
  if (!auth.authenticated) return auth.response;

  try {
    const { id } = await params;
    const body = await request.json();
    const { sentTo, sentBy, sentByName } = body;

    if (!sentTo) {
      return NextResponse.json(
        { error: 'sentTo (email address) is required' },
        { status: 400 }
      );
    }

    if (!sentBy || !sentByName) {
      return NextResponse.json(
        { error: 'sentBy and sentByName are required' },
        { status: 400 }
      );
    }

    const invoice = await breakdownService.sendInvoice(id, sentTo, sentBy, sentByName);

    if (!invoice) {
      return NextResponse.json(
        { error: 'Invoice not found' },
        { status: 404 }
      );
    }

    // In production, you would send the email here
    // await sendInvoiceEmail(invoice, sentTo);

    return NextResponse.json({
      success: true,
      invoice,
      message: `Invoice sent to ${sentTo}`
    });
  } catch (error: any) {
    console.error('Error sending invoice:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to send invoice' },
      { status: 500 }
    );
  }
}

// Helper to generate HTML response for invoice
function generateInvoiceHTMLResponse(invoice: any) {
  const html = generateInvoiceHTML({
    invoiceNumber: invoice.invoiceNumber,
    invoiceDate: new Date(invoice.createdAt).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    }),
    dueDate: new Date(invoice.dueDate).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    }),
    companyName: 'River City Roofing Solutions',
    companyAddress: '3325 Central Pkwy SW, Decatur, AL 35603',
    companyPhone: '(256) 274-8530',
    companyEmail: 'rcrs@rivercityroofingsolutions.com',
    customerName: invoice.customerName,
    customerAddress: invoice.billingAddress,
    customerCity: invoice.billingCity,
    customerState: invoice.billingState,
    customerZip: invoice.billingZip,
    customerPhone: invoice.customerPhone || '',
    customerEmail: invoice.customerEmail,
    jobId: invoice.jobId,
    jobName: invoice.jobName,
    jobAddress: invoice.jobAddress,
    projectManager: invoice.createdByName,
    items: invoice.lineItems.map((item: any) => ({
      description: item.description,
      quantity: item.quantity,
      unit: item.unit,
      unitPrice: item.unitPrice,
      total: item.total
    })),
    subtotal: invoice.subtotal,
    deliveryFee: 0,
    handlingFee: 0,
    tax: invoice.taxAmount,
    total: invoice.total,
    notes: invoice.notes?.join(' ') || '',
    terms: invoice.terms
  });

  return new NextResponse(html, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8'
    }
  });
}
