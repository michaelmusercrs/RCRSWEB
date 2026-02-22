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

export async function GET(request: NextRequest) {
  const auth = await requireAuth();
  if (!auth.authenticated) return auth.response;

  try {
    const { searchParams } = new URL(request.url);
    const orderId = searchParams.get('orderId');
    const status = searchParams.get('status');
    const pending = searchParams.get('pending');
    const limit = searchParams.get('limit');

    if (orderId) {
      const order = await materialOrderPipeline.getOrderById(orderId);
      if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 });
      return NextResponse.json(order);
    }

    if (pending === 'true') {
      const orders = await materialOrderPipeline.getOrders({
        stage: 'ORDER_CREATED',
        cancelled: false,
      });
      return NextResponse.json(orders);
    }

    const orders = await materialOrderPipeline.getOrders({
      limit: limit ? parseInt(limit) : 50,
      cancelled: false,
    });

    const inventory = await unifiedInventoryService.getInventory();
    const stats = await materialOrderPipeline.getOrderStats();

    return NextResponse.json({
      orders,
      total: orders.length,
      products: inventory.map(i => ({
        productId: i.productId,
        productName: i.productName,
        category: i.category,
        sku: i.sku,
        unit: i.unit,
        cost: i.unitCost,
        price: i.unitPrice,
        currentQty: i.currentQty,
        availableQty: i.availableQty,
      })),
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

  try {
    const body = await request.json();

    // Create order via pipeline
    const order = await materialOrderPipeline.createOrder({
      createdBy: auth.user.userId,
      createdByName: auth.user.name,
      createdByRole: auth.user.role,
      priority: body.priority || 'normal',
      jobId: body.jobId,
      jobNimbusId: body.jobNimbusId,
      jobNumber: body.jobNumber || '',
      jobName: body.jobName || '',
      customerName: body.customerName || '',
      customerPhone: body.customerPhone || '',
      customerEmail: body.customerEmail,
      deliveryAddress: body.shippingAddress || body.deliveryAddress || '',
      deliveryCity: body.city || body.deliveryCity || '',
      deliveryState: body.state || body.deliveryState || 'AL',
      deliveryZip: body.zipCode || body.deliveryZip || '',
      requestedDeliveryDate: body.requestedDeliveryDate || '',
      items: (body.materials || body.items || []).map((m: any) => ({
        productId: m.productId,
        quantity: m.quantity,
        notes: m.notes,
      })),
      specialInstructions: body.specialInstructions,
      notes: body.notes,
    });

    return NextResponse.json(order, { status: 201 });
  } catch (error) {
    console.error('Material orders POST error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
