import { NextRequest, NextResponse } from 'next/server';
import { priceVerificationService } from '@/lib/price-verification-service';

// GET /api/portal/pricing/audit - Get audit summary
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    // Default to last 6 months if no dates provided
    const endDate = searchParams.get('endDate') || new Date().toISOString().slice(0, 10);
    const defaultStart = new Date();
    defaultStart.setMonth(defaultStart.getMonth() - 6);
    const startDate = searchParams.get('startDate') || defaultStart.toISOString().slice(0, 10);

    const summary = await priceVerificationService.getAuditSummary(startDate, endDate);

    return NextResponse.json(summary);
  } catch (error) {
    console.error('Error fetching audit summary:', error);
    return NextResponse.json({ error: 'Failed to fetch audit summary' }, { status: 500 });
  }
}

// POST /api/portal/pricing/audit - Setup pricing sheets
export async function POST(request: NextRequest) {
  try {
    const data = await request.json();
    const { action } = data;

    if (action === 'setup') {
      await priceVerificationService.setupPricingSheets();
      return NextResponse.json({ success: true, message: 'Pricing sheets created successfully' });
    }

    if (action === 'import' && data.pricingData) {
      const result = await priceVerificationService.importSupplierPricing(data.pricingData);
      return NextResponse.json(result);
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('Error in audit action:', error);
    return NextResponse.json({ error: 'Failed to perform audit action' }, { status: 500 });
  }
}
