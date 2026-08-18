/**
 * Material Orders API - Redirects to Pipeline
 * 
 * Backward-compatible route that delegates to the material-order-pipeline.
 * Maintained for existing clients; new code should use /api/portal/pipeline.
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-service';
import { materialOrderPipeline, type PipelineStage } from '@/lib/material-order-pipeline';
import { unifiedInventoryService } from '@/lib/unified-inventory-service';
import { canSeeCost, filterCostByRole } from '@/lib/cost-visibility';

export async function GET(request: NextRequest) {
  const auth = await requireAuth();
  if (!auth.authenticated) return auth.response;

  try {
    const { searchParams } = new URL(request.url);
    const orderId = searchParams.get('orderId');
    const status = searchParams.get('status');
    const pending = searchParams.get('pending');
    const limit = searchParams.get('limit');

    // Cost visibility gate — sales reps and customers must never see purchase
    // cost. Owners/admin/office/manager/driver can. Filter applied at every
    // exit point below.
    const userRole = auth.user.role;
    const showCost = canSeeCost(userRole);

    if (orderId) {
      const order = await materialOrderPipeline.getOrderById(orderId);
      if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 });
      return NextResponse.json(filterCostByRole(order, userRole));
    }

    if (pending === 'true') {
      const orders = await materialOrderPipeline.getOrders({
        stage: 'ORDER_CREATED',
        cancelled: false,
      });
      return NextResponse.json(filterCostByRole(orders, userRole));
    }

    const orders = await materialOrderPipeline.getOrders({
      limit: limit ? parseInt(limit) : 50,
      cancelled: false,
    });

    const inventory = await unifiedInventoryService.getInventory();
    const stats = await materialOrderPipeline.getOrderStats();

    // Build the products list with `cost` ONLY when the role is allowed.
    // Sales reps see price, currentQty, availableQty — never the supplier cost.
    const products = inventory.map(i => {
      const base = {
        productId: i.productId,
        productName: i.productName,
        category: i.category,
        sku: i.sku,
        unit: i.unit,
        price: i.unitPrice,
        currentQty: i.currentQty,
        availableQty: i.availableQty,
      };
      return showCost ? { ...base, cost: i.unitCost } : base;
    });

    return NextResponse.json({
      orders: filterCostByRole(orders, userRole),
      total: orders.length,
      products,
      stats: {
        pending: stats.byStage.ORDER_CREATED || 0,
        total: stats.total,
        active: stats.active,
      },
    });
  } catch (error) {
    console.error('Material orders GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth();
  if (!auth.authenticated) return auth.response;

  // PARKED 2026-08-18: this created a System-B "PipelineOrder" that never
  // reached the warehouse board (the board reads the canonical Tickets tab).
  // No UI POSTs here (verified). New orders must go through the warehouse
  // "New Work Order" flow or the stock@rcrsal.com email → webhook path, both of
  // which create a real Tickets-tab ticket. GET stays available so the legacy
  // orders/office views keep reading existing pipeline records.
  return NextResponse.json(
    {
      error: 'This endpoint is retired. Create material orders from the Warehouse board ("New Work Order") or the stock@rcrsal.com email flow so they appear for the warehouse.',
      redirect: '/portal/warehouse',
    },
    { status: 410 },
  );
}
