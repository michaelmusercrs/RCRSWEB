import { NextRequest, NextResponse } from 'next/server';
import { priceVerificationService } from '@/lib/price-verification-service';

// POST /api/portal/pricing/verify - Verify invoice prices against agreed pricing
export async function POST(request: NextRequest) {
  try {
    const data = await request.json();
    const { supplier, lineItems, invoiceNumber, invoiceDate, createAlerts = true } = data;

    if (!supplier || !lineItems || !Array.isArray(lineItems)) {
      return NextResponse.json(
        { error: 'Missing required fields: supplier, lineItems' },
        { status: 400 }
      );
    }

    // Verify all line items
    const verification = await priceVerificationService.verifyInvoiceLineItems(supplier, lineItems);

    // Create alerts for overcharges if requested
    if (createAlerts && verification.hasOvercharges) {
      for (const item of verification.results) {
        if (item.status === 'Overcharge') {
          await priceVerificationService.createPriceAlert({
            productId: item.productId,
            productName: item.productName,
            supplier,
            invoiceNumber: invoiceNumber || 'N/A',
            invoiceDate: invoiceDate || new Date().toISOString().slice(0, 10),
            agreedPrice: item.agreedPrice,
            invoicedPrice: item.unitPrice,
            quantity: item.quantity,
            discrepancy: item.priceDiff,
            discrepancyPercent: item.agreedPrice > 0 ? (item.priceDiff / item.agreedPrice) * 100 : 0,
            totalOvercharge: item.priceDiff * item.quantity,
            assignedTo: '',
            resolvedDate: '',
            creditAmount: 0,
            notes: `Auto-detected during invoice verification`,
          });
        }
      }
    }

    return NextResponse.json({
      ...verification,
      message: verification.hasOvercharges
        ? `ALERT: Found ${verification.discrepancyCount} overcharges totaling $${verification.totalDiscrepancy.toFixed(2)}`
        : 'All prices verified - no discrepancies found',
    });
  } catch (error) {
    console.error('Error verifying prices:', error);
    return NextResponse.json({ error: 'Failed to verify prices' }, { status: 500 });
  }
}
