import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-service';
import {
  inventoryManagementService,
  type InventoryCategory,
  type DiscrepancyResolution,
  type DiscrepancyReason,
  type RestockOrderStatus,
} from '@/lib/inventory-management-service';

// ============================================
// GET - Inventory list with filtering
// ============================================

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

    // Ensure Google Sheets data is loaded
    await inventoryManagementService.ensureSheetsLoaded();

    // Special views
    if (view === 'alerts') {
      return NextResponse.json({ alerts: inventoryManagementService.getStockAlerts() });
    }
    if (view === 'suggestions') {
      return NextResponse.json({ suggestions: inventoryManagementService.getRestockSuggestions() });
    }
    if (view === 'pricing-report') {
      return NextResponse.json({ report: inventoryManagementService.getPricingReport() });
    }
    if (view === 'margins') {
      return NextResponse.json({ margins: inventoryManagementService.calculateMargins() });
    }
    if (view === 'pricing-issues') {
      return NextResponse.json({ issues: inventoryManagementService.flagPricingIssues() });
    }
    if (view === 'count-history') {
      return NextResponse.json({ sessions: inventoryManagementService.getCountHistory() });
    }
    if (view === 'restock-orders') {
      const status = searchParams.get('status') as RestockOrderStatus | null;
      return NextResponse.json({ orders: inventoryManagementService.getRestockOrders(status ? { status } : undefined) });
    }
    if (view === 'category-breakdown') {
      return NextResponse.json({ categories: inventoryManagementService.getCategoryBreakdown() });
    }
    if (view === 'inventory-value') {
      return NextResponse.json(inventoryManagementService.getInventoryValue());
    }
    if (view === 'activity') {
      return NextResponse.json({ activity: inventoryManagementService.getRecentActivity() });
    }
    if (view === 'suppliers') {
      return NextResponse.json({ suppliers: inventoryManagementService.getSuppliers() });
    }
    if (view === 'stock-trend') {
      const productId = searchParams.get('productId');
      const days = parseInt(searchParams.get('days') || '30');
      if (!productId) {
        return NextResponse.json({ error: 'productId required' }, { status: 400 });
      }
      return NextResponse.json({ trend: inventoryManagementService.getStockTrend(productId, days) });
    }
    if (view === 'item') {
      const productId = searchParams.get('productId');
      if (!productId) {
        return NextResponse.json({ error: 'productId required' }, { status: 400 });
      }
      const item = inventoryManagementService.getItemById(productId);
      if (!item) {
        return NextResponse.json({ error: 'Item not found' }, { status: 404 });
      }
      return NextResponse.json({ item });
    }
    if (view === 'pricing-history') {
      const productId = searchParams.get('productId');
      if (!productId) {
        return NextResponse.json({ error: 'productId required' }, { status: 400 });
      }
      return NextResponse.json({ history: inventoryManagementService.getPricingHistory(productId) });
    }
    if (view === 'active-count') {
      const session = inventoryManagementService.getActiveCountSession();
      return NextResponse.json({ session: session || null });
    }
    if (view === 'count-progress') {
      const sessionId = searchParams.get('sessionId');
      if (!sessionId) {
        return NextResponse.json({ error: 'sessionId required' }, { status: 400 });
      }
      return NextResponse.json({ progress: inventoryManagementService.getCountProgress(sessionId) });
    }
    if (view === 'alert-rules') {
      return NextResponse.json({ rules: inventoryManagementService.getAlertRules() });
    }

    // Default: full inventory with filters
    const inventory = inventoryManagementService.getInventory({
      category: category || undefined,
      search,
      lowStock,
      outOfStock,
      supplier,
    });

    return NextResponse.json({ inventory, total: inventory.length });
  } catch (error) {
    console.error('Inventory management GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch inventory data' }, { status: 500 });
  }
}

// ============================================
// POST - Actions
// ============================================

export async function POST(request: NextRequest) {
  const auth = await requireAuth();
  if (!auth.authenticated) return auth.response;

  try {
    const body = await request.json();
    const { action } = body;

    // Ensure Google Sheets data is loaded
    await inventoryManagementService.ensureSheetsLoaded();

    switch (action) {
      // --- Count Operations ---
      case 'start-count': {
        const { countedBy } = body;
        if (!countedBy) {
          return NextResponse.json({ error: 'countedBy is required' }, { status: 400 });
        }
        const existing = inventoryManagementService.getActiveCountSession();
        if (existing) {
          return NextResponse.json({ error: 'A count session is already in progress', session: existing }, { status: 409 });
        }
        const session = inventoryManagementService.initiateWeeklyCount(countedBy);
        return NextResponse.json({ success: true, session });
      }

      case 'record-count': {
        const { productId, countedQty, countedBy, notes } = body;
        if (!productId || countedQty === undefined || !countedBy) {
          return NextResponse.json({ error: 'productId, countedQty, and countedBy are required' }, { status: 400 });
        }
        const record = inventoryManagementService.recordCount(productId, countedQty, countedBy, notes);
        if (!record) {
          return NextResponse.json({ error: 'No active count session or item not found' }, { status: 400 });
        }
        return NextResponse.json({ success: true, record });
      }

      case 'resolve-discrepancy': {
        const { productId, resolution, adjustedQty, reason, resolvedBy } = body;
        if (!productId || !resolution || adjustedQty === undefined || !reason) {
          return NextResponse.json({ error: 'productId, resolution, adjustedQty, and reason are required' }, { status: 400 });
        }
        const resolved = inventoryManagementService.resolveDiscrepancy(
          productId,
          resolution as DiscrepancyResolution,
          adjustedQty,
          reason as DiscrepancyReason,
          resolvedBy || auth.user.name
        );
        if (!resolved) {
          return NextResponse.json({ error: 'Could not resolve discrepancy' }, { status: 400 });
        }
        return NextResponse.json({ success: true });
      }

      // --- Restock Operations ---
      case 'create-restock-order': {
        const { items, supplier, notes: orderNotes } = body;
        if (!items || !Array.isArray(items) || items.length === 0) {
          return NextResponse.json({ error: 'items array is required' }, { status: 400 });
        }
        const order = inventoryManagementService.createRestockOrder(
          items,
          auth.user.name || 'Admin',
          supplier,
          orderNotes
        );
        return NextResponse.json({ success: true, order });
      }

      case 'approve-restock': {
        const { orderId } = body;
        if (!orderId) {
          return NextResponse.json({ error: 'orderId is required' }, { status: 400 });
        }
        const order = inventoryManagementService.approveRestockOrder(orderId, auth.user.name || 'Admin');
        if (!order) {
          return NextResponse.json({ error: 'Order not found or cannot be approved' }, { status: 400 });
        }
        return NextResponse.json({ success: true, order });
      }

      case 'receive-restock': {
        const { orderId, receivedItems } = body;
        if (!orderId || !receivedItems || !Array.isArray(receivedItems)) {
          return NextResponse.json({ error: 'orderId and receivedItems are required' }, { status: 400 });
        }
        const order = inventoryManagementService.receiveRestock(orderId, receivedItems);
        if (!order) {
          return NextResponse.json({ error: 'Order not found' }, { status: 400 });
        }
        return NextResponse.json({ success: true, order });
      }

      // --- Pricing Operations ---
      case 'update-pricing': {
        const { productId, newCost, newPrice, reason: pricingReason } = body;
        if (!productId || newCost === undefined || newPrice === undefined) {
          return NextResponse.json({ error: 'productId, newCost, and newPrice are required' }, { status: 400 });
        }
        const item = inventoryManagementService.updatePricing(
          productId,
          newCost,
          newPrice,
          auth.user.name || 'Admin',
          pricingReason
        );
        if (!item) {
          return NextResponse.json({ error: 'Item not found' }, { status: 404 });
        }
        return NextResponse.json({ success: true, item });
      }

      // --- Item CRUD ---
      case 'add-item': {
        const { itemData } = body;
        if (!itemData || !itemData.productName || !itemData.category) {
          return NextResponse.json({ error: 'itemData with productName and category is required' }, { status: 400 });
        }
        const item = inventoryManagementService.addItem(itemData);
        return NextResponse.json({ success: true, item });
      }

      case 'update-item': {
        const { productId, updates } = body;
        if (!productId || !updates) {
          return NextResponse.json({ error: 'productId and updates are required' }, { status: 400 });
        }
        const item = inventoryManagementService.updateItem(productId, updates);
        if (!item) {
          return NextResponse.json({ error: 'Item not found' }, { status: 404 });
        }
        return NextResponse.json({ success: true, item });
      }

      // --- Alert Operations ---
      case 'get-alerts': {
        const alerts = inventoryManagementService.getStockAlerts();
        return NextResponse.json({ alerts });
      }

      case 'get-suggestions': {
        const suggestions = inventoryManagementService.getRestockSuggestions();
        return NextResponse.json({ suggestions });
      }

      case 'pricing-report': {
        const report = inventoryManagementService.getPricingReport();
        const margins = inventoryManagementService.calculateMargins();
        const issues = inventoryManagementService.flagPricingIssues();
        return NextResponse.json({ report, margins, issues });
      }

      case 'set-alert-rule': {
        const { productId, threshold, notifyRoles } = body;
        if (!productId || threshold === undefined || !notifyRoles) {
          return NextResponse.json({ error: 'productId, threshold, and notifyRoles are required' }, { status: 400 });
        }
        const rule = inventoryManagementService.setStockAlert(productId, threshold, notifyRoles);
        return NextResponse.json({ success: true, rule });
      }

      case 'update-order-status': {
        const { orderId, status } = body;
        if (!orderId || !status) {
          return NextResponse.json({ error: 'orderId and status are required' }, { status: 400 });
        }
        const order = inventoryManagementService.updateRestockOrderStatus(orderId, status as RestockOrderStatus);
        if (!order) {
          return NextResponse.json({ error: 'Order not found' }, { status: 400 });
        }
        return NextResponse.json({ success: true, order });
      }

      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }
  } catch (error) {
    console.error('Inventory management POST error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
