import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-service';
import { invoiceService } from '@/lib/invoice-service';

// GET - Fetch invoice list with optional filtering
export async function GET(request: NextRequest) {
  const auth = await requireAuth();
  if (!auth.authenticated) return auth.response;

  try {
    const { searchParams } = new URL(request.url);
    const invoiceId = searchParams.get('invoiceId');
    const jobId = searchParams.get('jobId');
    const status = searchParams.get('status');
    const type = searchParams.get('type');
    const search = searchParams.get('search');
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');
    const amountMin = searchParams.get('amountMin');
    const amountMax = searchParams.get('amountMax');

    // Single invoice lookup
    if (invoiceId) {
      const invoice = await invoiceService.getInvoice(invoiceId);
      if (!invoice) {
        return NextResponse.json({ success: false, error: 'Invoice not found' }, { status: 404 });
      }
      return NextResponse.json({ success: true, invoice });
    }

    // Search
    if (search) {
      const results = await invoiceService.searchInvoices(search);
      return NextResponse.json({ success: true, invoices: results, count: results.length });
    }

    // Job-specific invoices
    if (jobId) {
      const results = await invoiceService.getInvoicesByJob(jobId);
      return NextResponse.json({ success: true, invoices: results, count: results.length });
    }

    // Filtered list
    if (status || type || dateFrom || dateTo || amountMin || amountMax) {
      const results = await invoiceService.filterInvoices({
        status: status as any,
        type: type as any,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
        amountMin: amountMin ? parseFloat(amountMin) : undefined,
        amountMax: amountMax ? parseFloat(amountMax) : undefined,
      });
      return NextResponse.json({ success: true, invoices: results, count: results.length });
    }

    // Return all
    const invoices = await invoiceService.getAllInvoices();
    return NextResponse.json({ success: true, invoices, count: invoices.length });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch invoices' },
      { status: 500 }
    );
  }
}

// POST - Actions: create, update, send, record-payment, verify-pricing, reports
export async function POST(request: NextRequest) {
  const auth = await requireAuth();
  if (!auth.authenticated) return auth.response;

  try {
    const body = await request.json();
    const { action } = body;

    switch (action) {
      case 'create': {
        const invoice = await invoiceService.createInvoice({
          ...body.data,
          createdBy: auth.user.name,
        });
        return NextResponse.json({ success: true, invoice });
      }

      case 'create-from-breakdown': {
        const { breakdownId } = body;
        if (!breakdownId) {
          return NextResponse.json(
            { success: false, error: 'breakdownId is required' },
            { status: 400 }
          );
        }
        const invoice = await invoiceService.createFromBreakdown(breakdownId);
        return NextResponse.json({ success: true, invoice });
      }

      case 'update': {
        const { invoiceId, updates } = body;
        if (!invoiceId) {
          return NextResponse.json(
            { success: false, error: 'invoiceId is required' },
            { status: 400 }
          );
        }
        const invoice = await invoiceService.updateInvoice(invoiceId, updates);
        if (!invoice) {
          return NextResponse.json(
            { success: false, error: 'Invoice not found' },
            { status: 404 }
          );
        }
        return NextResponse.json({ success: true, invoice });
      }

      case 'send': {
        const { invoiceId } = body;
        if (!invoiceId) {
          return NextResponse.json(
            { success: false, error: 'invoiceId is required' },
            { status: 400 }
          );
        }
        const invoice = await invoiceService.sendInvoice(invoiceId);
        if (!invoice) {
          return NextResponse.json(
            { success: false, error: 'Invoice not found' },
            { status: 404 }
          );
        }
        return NextResponse.json({ success: true, invoice, message: 'Invoice marked as sent' });
      }

      case 'record-payment': {
        const { invoiceId, payment } = body;
        if (!invoiceId || !payment) {
          return NextResponse.json(
            { success: false, error: 'invoiceId and payment are required' },
            { status: 400 }
          );
        }
        const invoice = await invoiceService.recordPayment(invoiceId, payment);
        if (!invoice) {
          return NextResponse.json(
            { success: false, error: 'Invoice not found' },
            { status: 404 }
          );
        }
        return NextResponse.json({ success: true, invoice });
      }

      case 'verify-pricing': {
        const { invoiceId } = body;
        if (!invoiceId) {
          return NextResponse.json(
            { success: false, error: 'invoiceId is required' },
            { status: 400 }
          );
        }
        const discrepancies = await invoiceService.verifyPricing(invoiceId);
        return NextResponse.json({ success: true, discrepancies, count: discrepancies.length });
      }

      case 'aging-report': {
        const report = await invoiceService.getAgingReport();
        return NextResponse.json({ success: true, report });
      }

      case 'revenue-report': {
        const { dateRange } = body;
        const report = await invoiceService.getRevenueReport(dateRange);
        return NextResponse.json({ success: true, report });
      }

      case 'duplicate': {
        const { invoiceId } = body;
        if (!invoiceId) {
          return NextResponse.json(
            { success: false, error: 'invoiceId is required' },
            { status: 400 }
          );
        }
        const invoice = await invoiceService.duplicateInvoice(invoiceId);
        if (!invoice) {
          return NextResponse.json(
            { success: false, error: 'Invoice not found' },
            { status: 404 }
          );
        }
        return NextResponse.json({ success: true, invoice });
      }

      // ---- JobNimbus READ-ONLY Integration ----

      case 'fetch-jn-invoices': {
        const { contactJnid } = body;
        const invoices = await invoiceService.fetchJNInvoices(contactJnid);
        return NextResponse.json({ success: true, invoices });
      }

      case 'fetch-jn-invoice-detail': {
        const { contactJnid, invoiceJnid } = body;
        if (!contactJnid || !invoiceJnid) {
          return NextResponse.json(
            { success: false, error: 'contactJnid and invoiceJnid required' },
            { status: 400 }
          );
        }
        const detail = await invoiceService.fetchJNInvoiceDetail(contactJnid, invoiceJnid);
        return NextResponse.json({ success: true, ...detail });
      }

      case 'import-jn-invoice': {
        const { jnInvoice } = body;
        if (!jnInvoice) {
          return NextResponse.json(
            { success: false, error: 'jnInvoice required' },
            { status: 400 }
          );
        }
        const importedInvoice = await invoiceService.importJNInvoice(jnInvoice);
        return NextResponse.json({ success: true, invoice: importedInvoice });
      }

      case 'compare-with-jn': {
        const { invoiceId, contactJnid } = body;
        if (!invoiceId || !contactJnid) {
          return NextResponse.json(
            { success: false, error: 'invoiceId and contactJnid required' },
            { status: 400 }
          );
        }
        const comparison = await invoiceService.compareWithJN(invoiceId, contactJnid);
        return NextResponse.json({ success: true, comparison });
      }

      default:
        return NextResponse.json(
          { success: false, error: `Unknown action: ${action}` },
          { status: 400 }
        );
    }
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to process request' },
      { status: 500 }
    );
  }
}
