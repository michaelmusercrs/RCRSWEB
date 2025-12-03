import { NextRequest, NextResponse } from 'next/server';
import { priceVerificationService } from '@/lib/price-verification-service';

// GET /api/portal/pricing - Get supplier pricing list
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const supplier = searchParams.get('supplier') || undefined;

    const pricing = await priceVerificationService.getSupplierPricing(supplier);
    return NextResponse.json(pricing);
  } catch (error) {
    console.error('Error fetching pricing:', error);
    return NextResponse.json({ error: 'Failed to fetch pricing' }, { status: 500 });
  }
}

// POST /api/portal/pricing - Add new supplier pricing
export async function POST(request: NextRequest) {
  try {
    const data = await request.json();
    const pricing = await priceVerificationService.addSupplierPricing(data);
    return NextResponse.json(pricing);
  } catch (error) {
    console.error('Error adding pricing:', error);
    return NextResponse.json({ error: 'Failed to add pricing' }, { status: 500 });
  }
}

// PATCH /api/portal/pricing - Update supplier pricing
export async function PATCH(request: NextRequest) {
  try {
    const data = await request.json();
    const { productId, ...updates } = data;

    await priceVerificationService.updateSupplierPricing(productId, updates);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating pricing:', error);
    return NextResponse.json({ error: 'Failed to update pricing' }, { status: 500 });
  }
}
