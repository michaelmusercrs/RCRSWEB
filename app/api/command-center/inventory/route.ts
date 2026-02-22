/**
 * RCRS Command Center - Inventory API
 * 
 * Uses unified-inventory-service as single source of truth.
 * Implements role-based field filtering.
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-service';
import { unifiedInventoryService, CATEGORY_LABELS } from '@/lib/unified-inventory-service';

// Role-based filtering
const COST_VIEW_ROLES = ['admin', 'owner', 'office', 'manager'];

function canViewCosts(role: string): boolean {
  return COST_VIEW_ROLES.includes(role.toLowerCase());
}

export async function GET(request: NextRequest) {
  const auth = await requireAuth();
  if (!auth.authenticated) return auth.response;

  try {
    const { searchParams } = new URL(request.url);
    const sku = searchParams.get('sku');
    const action = searchParams.get('action') || 'list';
    const role = auth.user.role;

    if (sku || action === 'item') {
      const productId = sku || searchParams.get('productId') || '';
      const item = await unifiedInventoryService.getItemById(productId);
      if (!item) {
        return NextResponse.json({ success: false, error: 'Item not found' }, { status: 404 });
      }

      // Role-based filtering
      const filtered = canViewCosts(role) ? {
        sku: item.sku,
        productId: item.productId,
        name: item.productName,
        description: item.description,
        category: CATEGORY_LABELS[item.category],
        cost: item.unitCost,
        price: item.unitPrice,
        quantity: item.currentQty,
        holdQty: item.holdQty,
        availableQty: item.availableQty,
        minStock: item.minStockLevel,
        maxStock: item.maxStockLevel,
        unit: item.unit,
        supplier: item.supplier,
        location: item.location,
        lastUpdated: item.lastCountDate || item.lastRestockDate || '',
        notes: item.notes,
      } : {
        sku: item.sku,
        name: item.productName,
        description: item.description,
        category: CATEGORY_LABELS[item.category],
        quantity: item.currentQty,
        unit: item.unit,
        location: item.location,
      };

      return NextResponse.json({ success: true, data: { item: filtered } });
    }

    // List all items
    const items = await unifiedInventoryService.getInventoryForRole(role);
    const value = await unifiedInventoryService.getInventoryValue();
    const lowStock = await unifiedInventoryService.getLowStockItems();

    return NextResponse.json({
      success: true,
      data: {
        items,
        summary: {
          totalItems: value.itemCount,
          lowStockCount: lowStock.length,
          ...(canViewCosts(role) ? { totalValue: value.totalRetail, totalCost: value.totalCost } : {}),
        },
      },
    });
  } catch (error) {
    console.error('Command center inventory error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  const auth = await requireAuth();
  if (!auth.authenticated) return auth.response;

  if (!canViewCosts(auth.user.role)) {
    return NextResponse.json({ success: false, error: 'Insufficient permissions' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { productId, sku, ...updates } = body;
    const id = productId || sku;
    if (!id) return NextResponse.json({ success: false, error: 'productId or sku required' }, { status: 400 });

    // Map command center field names to unified service field names
    const mapped: Record<string, unknown> = {};
    if (updates.quantity !== undefined) mapped.currentQty = updates.quantity;
    if (updates.cost !== undefined) mapped.unitCost = updates.cost;
    if (updates.price !== undefined) mapped.unitPrice = updates.price;
    if (updates.minStock !== undefined) mapped.minStockLevel = updates.minStock;
    if (updates.maxStock !== undefined) mapped.maxStockLevel = updates.maxStock;
    if (updates.name !== undefined) mapped.productName = updates.name;
    if (updates.location !== undefined) mapped.location = updates.location;
    if (updates.notes !== undefined) mapped.notes = updates.notes;

    const item = await unifiedInventoryService.updateItem(id, mapped);
    if (!item) return NextResponse.json({ success: false, error: 'Item not found' }, { status: 404 });

    return NextResponse.json({ success: true, data: { item } });
  } catch (error) {
    console.error('Command center inventory PUT error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth();
  if (!auth.authenticated) return auth.response;

  if (!canViewCosts(auth.user.role)) {
    return NextResponse.json({ success: false, error: 'Insufficient permissions' }, { status: 403 });
  }

  try {
    const body = await request.json();

    // Stock adjustment
    if (body.action === 'adjust') {
      const { productId, sku, quantity, type, notes } = body;
      const id = productId || sku;
      if (!id) return NextResponse.json({ success: false, error: 'productId or sku required' }, { status: 400 });

      if (type === 'add') {
        const txn = await unifiedInventoryService.addStock(
          id, quantity, 'adjustment', 'manual', 'command_center',
          auth.user.userId, auth.user.name, notes || ''
        );
        return NextResponse.json({ success: true, data: { transaction: txn } });
      } else {
        const txn = await unifiedInventoryService.deductStock(
          id, quantity, 'manual', 'command_center',
          auth.user.userId, auth.user.name, notes || ''
        );
        return NextResponse.json({ success: true, data: { transaction: txn } });
      }
    }

    return NextResponse.json({ success: false, error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('Command center inventory POST error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
