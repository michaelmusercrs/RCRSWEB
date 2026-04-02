/**
 * Unified Inventory API Route
 * 
 * Single entry point for all inventory operations.
 * Uses unified-inventory-service as THE single source of truth.
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-service';
import { auditLog } from '@/lib/audit-logger';
import {
  unifiedInventoryService,
  resolveProductId,
  CATEGORY_LABELS,
  type InventoryCategory,
  type InventoryFilters,
} from '@/lib/unified-inventory-service';

export async function GET(request: NextRequest) {
  const auth = await requireAuth();
  if (!auth.authenticated) return auth.response;

  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action') || 'list';

    switch (action) {
      case 'list': {
        const filters: InventoryFilters = {};
        const category = searchParams.get('category');
        if (category) filters.category = category as InventoryCategory;
        if (searchParams.get('lowStock') === 'true') filters.lowStock = true;
        if (searchParams.get('outOfStock') === 'true') filters.outOfStock = true;
        const search = searchParams.get('search');
        if (search) filters.search = search;
        const supplier = searchParams.get('supplier');
        if (supplier) filters.supplier = supplier;
        const location = searchParams.get('location');
        if (location) filters.location = location;

        const inventory = await unifiedInventoryService.getInventory(filters);
        const value = await unifiedInventoryService.getInventoryValue();
        return NextResponse.json({ items: inventory, ...value });
      }

      case 'item': {
        const productId = searchParams.get('productId');
        if (!productId) return NextResponse.json({ error: 'productId required' }, { status: 400 });
        const item = await unifiedInventoryService.getItemById(productId);
        if (!item) return NextResponse.json({ error: 'Item not found' }, { status: 404 });
        return NextResponse.json(item);
      }

      case 'alerts': {
        const alerts = await unifiedInventoryService.getStockAlerts();
        return NextResponse.json(alerts);
      }

      case 'lowStock': {
        const items = await unifiedInventoryService.getLowStockItems();
        return NextResponse.json(items);
      }

      case 'transactions': {
        const productId = searchParams.get('productId') || undefined;
        const limit = parseInt(searchParams.get('limit') || '50');
        const transactions = await unifiedInventoryService.getTransactions(productId, limit);
        return NextResponse.json(transactions);
      }

      case 'categories': {
        const breakdown = await unifiedInventoryService.getCategoryBreakdown();
        return NextResponse.json(breakdown);
      }

      case 'suppliers': {
        const suppliers = await unifiedInventoryService.getSuppliers();
        return NextResponse.json(suppliers);
      }

      case 'pricing': {
        const report = await unifiedInventoryService.getPricingReport();
        return NextResponse.json(report);
      }

      case 'pricingHistory': {
        const productId = searchParams.get('productId');
        if (!productId) return NextResponse.json({ error: 'productId required' }, { status: 400 });
        const history = await unifiedInventoryService.getPricingHistory(productId);
        return NextResponse.json(history);
      }

      case 'restockSuggestions': {
        const suggestions = await unifiedInventoryService.getRestockSuggestions();
        return NextResponse.json(suggestions);
      }

      case 'restockOrders': {
        const status = searchParams.get('status') as any;
        const orders = await unifiedInventoryService.getRestockOrders(status || undefined);
        return NextResponse.json(orders);
      }

      case 'countSessions': {
        const sessions = await unifiedInventoryService.getCountSessions();
        return NextResponse.json(sessions);
      }

      case 'countRecords': {
        const sessionId = searchParams.get('sessionId');
        if (!sessionId) return NextResponse.json({ error: 'sessionId required' }, { status: 400 });
        const records = await unifiedInventoryService.getCountRecords(sessionId);
        return NextResponse.json(records);
      }

      case 'activeCount': {
        const session = await unifiedInventoryService.getActiveCountSession();
        return NextResponse.json(session || null);
      }

      case 'returnTickets': {
        const type = searchParams.get('type') as any;
        const status = searchParams.get('status') as any;
        const tickets = await unifiedInventoryService.getReturnTickets(type || undefined, status || undefined);
        return NextResponse.json(tickets);
      }

      case 'returnTicket': {
        const ticketId = searchParams.get('ticketId');
        if (!ticketId) return NextResponse.json({ error: 'ticketId required' }, { status: 400 });
        const ticket = await unifiedInventoryService.getReturnTicketById(ticketId);
        if (!ticket) return NextResponse.json({ error: 'Ticket not found' }, { status: 404 });
        return NextResponse.json(ticket);
      }

      case 'holds': {
        const orderId = searchParams.get('orderId') || undefined;
        const holds = await unifiedInventoryService.getActiveHolds(orderId);
        return NextResponse.json(holds);
      }

      case 'activity': {
        const limit = parseInt(searchParams.get('limit') || '20');
        const activity = await unifiedInventoryService.getRecentActivity(limit);
        return NextResponse.json(activity);
      }

      case 'forRole': {
        const role = searchParams.get('role') || auth.user.role;
        const items = await unifiedInventoryService.getInventoryForRole(role);
        return NextResponse.json(items);
      }

      case 'history': {
        const productId = searchParams.get('productId') || undefined;
        const limit = parseInt(searchParams.get('limit') || '100');
        const transactions = await unifiedInventoryService.getTransactions(productId, limit);
        return NextResponse.json({ transactions });
      }

      case 'management': {
        const [inventory, alerts, lowStock, value, restockSuggestions, restockOrders, categories] = await Promise.all([
          unifiedInventoryService.getInventory({}),
          unifiedInventoryService.getStockAlerts(),
          unifiedInventoryService.getLowStockItems(),
          unifiedInventoryService.getInventoryValue(),
          unifiedInventoryService.getRestockSuggestions(),
          unifiedInventoryService.getRestockOrders(),
          unifiedInventoryService.getCategoryBreakdown(),
        ]);
        return NextResponse.json({
          items: inventory,
          alerts,
          lowStock,
          ...value,
          restockSuggestions,
          restockOrders,
          categories,
        });
      }

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    console.error('Inventory API error:', error);
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
      case 'addItem': {
        const item = await unifiedInventoryService.addItem(body.item);
        auditLog('INVENTORY_ADD', auth.user.email, `Added item: ${body.item?.name || 'unknown'} (${body.item?.sku || 'no-sku'})`, request);
        return NextResponse.json(item, { status: 201 });
      }

      case 'updateItem': {
        const item = await unifiedInventoryService.updateItem(body.productId, body.updates);
        if (!item) return NextResponse.json({ error: 'Item not found' }, { status: 404 });
        auditLog('INVENTORY_UPDATE', auth.user.email, `Updated item ${body.productId}: ${Object.keys(body.updates || {}).join(', ')}`, request);
        return NextResponse.json(item);
      }

      case 'deactivateItem': {
        const success = await unifiedInventoryService.deactivateItem(body.productId);
        auditLog('INVENTORY_DEACTIVATE', auth.user.email, `Deactivated item ${body.productId}`, request);
        return NextResponse.json({ success });
      }

      case 'deductStock': {
        const txn = await unifiedInventoryService.deductStock(
          body.productId, body.quantity, body.referenceId, body.referenceType,
          auth.user.userId, auth.user.name, body.notes || ''
        );
        if (!txn) return NextResponse.json({ error: 'Item not found' }, { status: 404 });
        auditLog('INVENTORY_DEDUCT', auth.user.email, `Deducted ${body.quantity} from ${body.productId} (ref: ${body.referenceId || 'manual'})`, request);
        return NextResponse.json(txn);
      }

      case 'addStock': {
        const txn = await unifiedInventoryService.addStock(
          body.productId, body.quantity, body.type || 'adjustment',
          body.referenceId || 'manual', body.referenceType || 'manual',
          auth.user.userId, auth.user.name, body.notes || ''
        );
        if (!txn) return NextResponse.json({ error: 'Item not found' }, { status: 404 });
        auditLog('INVENTORY_ADD_STOCK', auth.user.email, `Added ${body.quantity} to ${body.productId} (type: ${body.type || 'adjustment'})`, request);
        return NextResponse.json(txn);
      }

      case 'updatePricing': {
        const item = await unifiedInventoryService.updatePricing(
          body.productId, body.newCost, body.newPrice, auth.user.name, body.reason
        );
        if (!item) return NextResponse.json({ error: 'Item not found' }, { status: 404 });
        auditLog('INVENTORY_PRICING', auth.user.email, `Updated pricing for ${body.productId}: cost=${body.newCost}, price=${body.newPrice}, reason: ${body.reason || 'none'}`, request);
        return NextResponse.json(item);
      }

      case 'placeHold': {
        const hold = await unifiedInventoryService.placeHold(
          body.productId, body.quantity, body.orderId, body.orderType, auth.user.userId
        );
        if (!hold) return NextResponse.json({ error: 'Item not found' }, { status: 404 });
        return NextResponse.json(hold);
      }

      case 'releaseHold': {
        const success = await unifiedInventoryService.releaseHold(body.holdId);
        return NextResponse.json({ success });
      }

      case 'initiateCount': {
        const session = await unifiedInventoryService.initiateWeeklyCount(auth.user.userId, auth.user.name);
        return NextResponse.json(session, { status: 201 });
      }

      case 'recordCount': {
        const record = await unifiedInventoryService.recordCount(
          body.sessionId, body.productId, body.countedQty,
          auth.user.userId, auth.user.name, body.photoUrl, body.notes
        );
        if (!record) return NextResponse.json({ error: 'Invalid session or product' }, { status: 400 });
        return NextResponse.json(record);
      }

      case 'resolveDiscrepancy': {
        const success = await unifiedInventoryService.resolveDiscrepancy(
          body.recordId, body.resolution, body.adjustedQty, body.reason, auth.user.name
        );
        return NextResponse.json({ success });
      }

      case 'createRestockOrder': {
        const order = await unifiedInventoryService.createRestockOrder(
          body.items, auth.user.userId, auth.user.name, body.supplier, body.notes
        );
        return NextResponse.json(order, { status: 201 });
      }

      case 'updateRestockStatus': {
        const order = await unifiedInventoryService.updateRestockStatus(body.orderId, body.status, auth.user.name);
        if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 });
        return NextResponse.json(order);
      }

      case 'receiveRestock': {
        const order = await unifiedInventoryService.receiveRestock(
          body.orderId, body.receivedItems, auth.user.userId, auth.user.name
        );
        if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 });
        return NextResponse.json(order);
      }

      case 'createReturnTicket': {
        const ticket = await unifiedInventoryService.createReturnTicket({
          ...body,
          createdBy: auth.user.userId,
          createdByName: auth.user.name,
        });
        return NextResponse.json(ticket, { status: 201 });
      }

      case 'updateReturnStatus': {
        const ticket = await unifiedInventoryService.updateReturnStatus(body.ticketId, body.status, body.updates);
        if (!ticket) return NextResponse.json({ error: 'Ticket not found' }, { status: 404 });
        return NextResponse.json(ticket);
      }

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    console.error('Inventory POST error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  const auth = await requireAuth();
  if (!auth.authenticated) return auth.response;

  try {
    const body = await request.json();
    const { action, productId } = body;

    if (!productId) {
      return NextResponse.json({ error: 'productId required' }, { status: 400 });
    }

    switch (action) {
      case 'updateQty': {
        const { qtyChange, reason } = body;
        if (typeof qtyChange !== 'number' || qtyChange === 0) {
          return NextResponse.json({ error: 'Non-zero qtyChange required' }, { status: 400 });
        }

        if (qtyChange > 0) {
          const txn = await unifiedInventoryService.addStock(
            productId, qtyChange, 'adjustment',
            'manual', 'manual',
            auth.user.userId, auth.user.name, reason || 'Manual adjustment'
          );
          if (!txn) return NextResponse.json({ error: 'Item not found' }, { status: 404 });
          auditLog('INVENTORY_ADJUST', auth.user.email, `Added ${qtyChange} to ${productId}: ${reason || 'Manual adjustment'}`, request);
          return NextResponse.json(txn);
        } else {
          const txn = await unifiedInventoryService.deductStock(
            productId, Math.abs(qtyChange),
            'manual', 'manual',
            auth.user.userId, auth.user.name, reason || 'Manual adjustment'
          );
          if (!txn) return NextResponse.json({ error: 'Item not found' }, { status: 404 });
          auditLog('INVENTORY_ADJUST', auth.user.email, `Deducted ${Math.abs(qtyChange)} from ${productId}: ${reason || 'Manual adjustment'}`, request);
          return NextResponse.json(txn);
        }
      }

      case 'updateItem': {
        const { productId: pid, action: _, ...updates } = body;
        const item = await unifiedInventoryService.updateItem(pid, updates);
        if (!item) return NextResponse.json({ error: 'Item not found' }, { status: 404 });
        auditLog('INVENTORY_UPDATE', auth.user.email, `Updated item ${pid}: ${Object.keys(updates).join(', ')}`, request);
        return NextResponse.json(item);
      }

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    console.error('Inventory PATCH error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const auth = await requireAuth();
  if (!auth.authenticated) return auth.response;

  try {
    const { searchParams } = new URL(request.url);
    const productId = searchParams.get('productId');

    if (!productId) {
      return NextResponse.json({ error: 'productId required' }, { status: 400 });
    }

    const success = await unifiedInventoryService.deactivateItem(productId);
    if (!success) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 });
    }

    auditLog('INVENTORY_DELETE', auth.user.email, `Deactivated item ${productId}`, request);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Inventory DELETE error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
