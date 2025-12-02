import { NextRequest, NextResponse } from 'next/server';
import { deliveryPortalService } from '@/lib/delivery-portal-service';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category') || undefined;
    const lowStock = searchParams.get('lowStock') === 'true';

    const inventory = lowStock
      ? await deliveryPortalService.getLowStockItems()
      : await deliveryPortalService.getInventory(category);

    return NextResponse.json(inventory);
  } catch (error) {
    console.error('Error fetching inventory:', error);
    return NextResponse.json({ error: 'Failed to fetch inventory' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const data = await request.json();
    const { action, productId, ...params } = data;

    switch (action) {
      case 'updateQty':
        await deliveryPortalService.updateInventoryQty(productId, params.qtyChange, params.reason);
        return NextResponse.json({ success: true });

      case 'submitCount':
        const result = await deliveryPortalService.submitInventoryCount(
          productId,
          params.actualQty,
          params.countedBy,
          params.notes
        );
        return NextResponse.json(result);

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    console.error('Error updating inventory:', error);
    return NextResponse.json({ error: 'Failed to update inventory' }, { status: 500 });
  }
}
