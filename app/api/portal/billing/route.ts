import { NextRequest, NextResponse } from 'next/server';
import { billingWorkflowService, BillingStatus, VendorSource, TransactionType } from '@/lib/billing-workflow-service';
import { calculatePrice, calculateOrderTotal, getProductPricingList, getMarginAnalysis, pricingRules, volumePricing } from '@/lib/billingPricing';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');

    switch (action) {
      case 'dashboard': {
        const stats = await billingWorkflowService.getBillingDashboardStats();
        return NextResponse.json(stats);
      }

      case 'records': {
        const status = searchParams.get('status') as BillingStatus | null;
        const jobId = searchParams.get('jobId');
        const ticketId = searchParams.get('ticketId');
        const vendorSource = searchParams.get('vendorSource') as VendorSource | null;
        const unbilledOnly = searchParams.get('unbilledOnly') === 'true';
        const dateFrom = searchParams.get('dateFrom');
        const dateTo = searchParams.get('dateTo');

        const records = await billingWorkflowService.getBillingRecords({
          status: status || undefined,
          jobId: jobId || undefined,
          ticketId: ticketId || undefined,
          vendorSource: vendorSource || undefined,
          unbilledOnly,
          dateFrom: dateFrom || undefined,
          dateTo: dateTo || undefined
        });

        return NextResponse.json({ records });
      }

      case 'purchases': {
        const vendorSource = searchParams.get('vendorSource') as VendorSource | null;
        const jobId = searchParams.get('jobId');
        const paymentStatus = searchParams.get('paymentStatus');
        const unbilledOnly = searchParams.get('unbilledOnly') === 'true';

        const purchases = await billingWorkflowService.getVendorPurchases({
          vendorSource: vendorSource || undefined,
          jobId: jobId || undefined,
          paymentStatus: paymentStatus || undefined,
          unbilledOnly
        });

        return NextResponse.json({ purchases });
      }

      case 'alerts': {
        const unresolved = searchParams.get('unresolved') !== 'false';
        const severity = searchParams.get('severity') as 'critical' | 'high' | 'medium' | 'low' | null;
        const alertType = searchParams.get('alertType');

        const alerts = await billingWorkflowService.getAlerts({
          unresolved,
          severity: severity || undefined,
          alertType: alertType as any || undefined
        });

        return NextResponse.json({ alerts });
      }

      case 'notifications': {
        const unreadOnly = searchParams.get('unreadOnly') !== 'false';
        const notifications = await billingWorkflowService.getOfficeNotifications(unreadOnly);
        return NextResponse.json({ notifications });
      }

      case 'pricing-list': {
        const customerType = (searchParams.get('customerType') as 'residential' | 'commercial' | 'contractor' | 'insurance') || 'residential';
        const pricingList = getProductPricingList(customerType);
        return NextResponse.json({ pricingList, customerType });
      }

      case 'pricing-rules': {
        return NextResponse.json({ pricingRules, volumePricing });
      }

      case 'margin-analysis': {
        const analysis = getMarginAnalysis();
        return NextResponse.json({ analysis });
      }

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    console.error('Billing API GET error:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, ...data } = body;

    switch (action) {
      case 'create-billing-record': {
        const record = await billingWorkflowService.createBillingRecord({
          ticketId: data.ticketId,
          jobId: data.jobId,
          jobName: data.jobName,
          jobAddress: data.jobAddress,
          transactionType: data.transactionType as TransactionType,
          materials: data.materials,
          vendorSource: data.vendorSource as VendorSource,
          vendorInvoiceNumber: data.vendorInvoiceNumber,
          createdBy: data.createdBy,
          createdByName: data.createdByName
        });

        return NextResponse.json({ success: true, record });
      }

      case 'update-billing-status': {
        const record = await billingWorkflowService.updateBillingStatus(
          data.billingId,
          data.newStatus as BillingStatus,
          data.updatedBy,
          data.updatedByName,
          data.reason
        );

        if (!record) {
          return NextResponse.json({ error: 'Billing record not found' }, { status: 404 });
        }

        return NextResponse.json({ success: true, record });
      }

      case 'create-vendor-purchase': {
        const purchase = await billingWorkflowService.createVendorPurchase({
          vendorSource: data.vendorSource as VendorSource,
          vendorName: data.vendorName,
          invoiceNumber: data.invoiceNumber,
          invoiceDate: data.invoiceDate,
          items: data.items,
          jobId: data.jobId,
          jobName: data.jobName,
          ticketId: data.ticketId,
          purchasedBy: data.purchasedBy,
          purchasedByName: data.purchasedByName,
          notes: data.notes,
          receiptUrl: data.receiptUrl
        });

        return NextResponse.json({ success: true, purchase });
      }

      case 'report-loss': {
        const loss = await billingWorkflowService.reportLoss({
          billingId: data.billingId,
          ticketId: data.ticketId,
          jobId: data.jobId,
          jobName: data.jobName,
          lossType: data.lossType,
          materials: data.materials,
          discoveredBy: data.discoveredBy,
          discoveredByName: data.discoveredByName,
          investigation: data.investigation
        });

        return NextResponse.json({ success: true, loss });
      }

      case 'resolve-alert': {
        const alert = await billingWorkflowService.resolveAlert(
          data.alertId,
          data.resolvedBy,
          data.resolution
        );

        if (!alert) {
          return NextResponse.json({ error: 'Alert not found' }, { status: 404 });
        }

        return NextResponse.json({ success: true, alert });
      }

      case 'run-reconciliation': {
        const report = await billingWorkflowService.runReconciliation(
          data.periodStart,
          data.periodEnd,
          data.generatedBy
        );

        return NextResponse.json({ success: true, report });
      }

      case 'run-daily-check': {
        const result = await billingWorkflowService.runDailyBillingCheck();
        return NextResponse.json({ success: true, ...result });
      }

      case 'calculate': {
        // Calculate pricing for an order
        const { items, customerType } = data;
        if (!items || !Array.isArray(items)) {
          return NextResponse.json({ error: 'Items array required' }, { status: 400 });
        }
        try {
          const result = calculateOrderTotal(items, customerType || 'residential');
          return NextResponse.json(result);
        } catch (error: any) {
          return NextResponse.json({ error: error.message }, { status: 400 });
        }
      }

      case 'calculate-single': {
        // Calculate price for a single product
        const { productId, quantity, customerType } = data;
        if (!productId) {
          return NextResponse.json({ error: 'Product ID required' }, { status: 400 });
        }
        try {
          const result = calculatePrice(productId, quantity || 1, customerType || 'residential');
          return NextResponse.json(result);
        } catch (error: any) {
          return NextResponse.json({ error: error.message }, { status: 400 });
        }
      }

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    console.error('Billing API POST error:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
