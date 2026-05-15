/**
 * Inventory Management API Route
 * 
 * Delegates to unified-inventory-service.
 * Maintained for backward compatibility with the management page.
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-service';
import {
  unifiedInventoryService,
  CATEGORY_LABELS,
  type InventoryCategory,
} from '@/lib/unified-inventory-service';

export async function GET(request: NextRequest) {
  const auth = await requireAuth();
  if (!auth.authenticated) return auth.response;

  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category') as InventoryCategory | null;
    const search = searchParams.get('search') || undefined;
    const lowStock = searchParams.get('lowStock') === 'true';
    const outOfStock = searchParams.get('outOfStock') === 'true';
    const supplier = searchParams.get('supplier') || undefined;
    const view = searchParams.get('view');

    if (view === 'alerts') {
      const alerts = await unifiedInventoryService.getStockAlerts();
      return NextResponse.json({ alerts });
    }
    if (view === 'suggestions') {
      const suggestions = await unifiedInventoryService.getRestockSuggestions();
      return NextResponse.json({ suggestions });
    }
    if (view === 'pricing-report') {
      const report = await unifiedInventoryService.getPricingReport();
      return NextResponse.json({ report });
    }
    if (view === 'count-history') {
      const sessions = await unifiedInventoryService.getCountSessions();
      return NextResponse.json({ sessions });
    }
    if (view === 'restock-orders') {
      const status = searchParams.get('status') as any;
      const orders = await unifiedInventoryService.getRestockOrders(status || undefined);
      return NextResponse.json({ orders });
    }
    if (view === 'category-breakdown') {
      const categories = await unifiedInventoryService.getCategoryBreakdown();
      return NextResponse.json({ categories });
    }
    if (view === 'inventory-value') {
      const value = await unifiedInventoryService.getInventoryValue();
      return NextResponse.json(value);
    }
    if (view === 'activity') {
      const activity = await unifiedInventoryService.getRecentActivity();
      return NextResponse.json({ activity });
    }
    if (view === 'suppliers') {
      const suppliers = await unifiedInventoryService.getSuppliers();
      return NextResponse.json({ suppliers });
    }

    // Default: filtered inventory list
    const items = await unifiedInventoryService.getInventory({
      category: category || undefined,
      search,
      lowStock: lowStock || undefined,
      outOfStock: outOfStock || undefined,
      supplier,
    });
    const value = await unifiedInventoryService.getInventoryValue();
    const alerts = await unifiedInventoryService.getStockAlerts();

    return NextResponse.json({
      items,
      ...value,
      alertCount: alerts.length,
      categories: Object.entries(CATEGORY_LABELS).map(([key, label]) => ({ key, label })),
    });
  } catch (error) {
    console.error('Inventory management GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth();
  if (!auth.authenticated) return auth.response;

  try {
    const body = await request.json();
    const { action } = body;

    switch (action) {
      case 'start-count': {
        const session = await unifiedInventoryService.initiateWeeklyCount(auth.user.userId, auth.user.name);
        return NextResponse.json({ session });
      }

      case 'record-count': {
        const record = await unifiedInventoryService.recordCount(
          body.sessionId, body.productId, body.countedQty,
          auth.user.userId, auth.user.name, body.photoUrl, body.notes
        );
        return NextResponse.json({ record });
      }

      case 'resolve-discrepancy': {
        const success = await unifiedInventoryService.resolveDiscrepancy(
          body.recordId || body.productId, body.resolution, body.adjustedQty, body.reason, auth.user.name
        );
        return NextResponse.json({ success });
      }

      case 'create-restock': {
        const order = await unifiedInventoryService.createRestockOrder(
          body.items, auth.user.userId, auth.user.name, body.supplier, body.notes
        );
        return NextResponse.json({ order });
      }

      case 'approve-restock': {
        const order = await unifiedInventoryService.updateRestockStatus(body.orderId, 'approved', auth.user.name);
        return NextResponse.json({ order });
      }

      case 'receive-restock': {
        const order = await unifiedInventoryService.receiveRestock(
          body.orderId, body.receivedItems, auth.user.userId, auth.user.name
        );
        return NextResponse.json({ order });
      }

      case 'receive-and-verify-restock': {
        // Preferred receive path. Each line:
        // { productId, receivedQty, actualUnitCost? }
        // Cost mismatches update inventory cost basis + write PricingRecord.
        const order = await unifiedInventoryService.receiveAndVerifyRestock(
          body.orderId,
          body.receivedItems,
          auth.user.userId,
          auth.user.name,
          body.notes,
        );
        if (!order) {
          return NextResponse.json({ error: 'Restock order not found' }, { status: 404 });
        }
        const discrepancies = order.items
          .filter(i => i.receivedQty !== undefined && (!i.countMatchesOrder || !i.costMatchesQuote))
          .map(i => ({
            productId: i.productId,
            productName: i.productName,
            orderedQty: i.orderQty,
            receivedQty: i.receivedQty,
            quotedUnitCost: i.unitCost,
            actualUnitCost: i.actualUnitCost,
            countMatchesOrder: i.countMatchesOrder,
            costMatchesQuote: i.costMatchesQuote,
          }));
        return NextResponse.json({ order, discrepancies });
      }

      case 'update-pricing': {
        const item = await unifiedInventoryService.updatePricing(
          body.productId, body.newCost, body.newPrice, auth.user.name, body.reason
        );
        return NextResponse.json({ item });
      }

      case 'update-item': {
        const item = await unifiedInventoryService.updateItem(body.productId, body.updates);
        return NextResponse.json({ item });
      }

      case 'add-item': {
        const item = await unifiedInventoryService.addItem(body.item);
        return NextResponse.json({ item });
      }

      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }
  } catch (error) {
    console.error('Inventory management POST error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
