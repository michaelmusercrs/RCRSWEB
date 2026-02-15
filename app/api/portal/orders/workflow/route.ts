import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-service';
import { orderWorkflowService } from '@/lib/order-workflow-service';
import { materialOrders } from '@/lib/materialOrders';
import { updateProductStock } from '@/lib/inventoryData';

// GET - Fetch orders or a single order
export async function GET(request: NextRequest) {
  const auth = await requireAuth();
  if (!auth.authenticated) return auth.response;

  try {
    const { searchParams } = new URL(request.url);
    const orderId = searchParams.get('orderId');
    const status = searchParams.get('status') as any;
    const date = searchParams.get('date');
    const driverId = searchParams.get('driverId');
    const limit = searchParams.get('limit');

    // If orderId is provided, return single order
    if (orderId) {
      // First try the new workflow service
      const order = await orderWorkflowService.getOrderById(orderId);
      if (order) {
        return NextResponse.json(order);
      }

      // Fall back to legacy order data
      const legacyOrder = materialOrders.find(o => o.orderId === orderId);
      if (legacyOrder) {
        return NextResponse.json({
          ...legacyOrder,
          items: legacyOrder.materials.map((m, idx) => ({
            itemId: `OI-${idx}`,
            ...m,
            pulled: legacyOrder.status === 'Delivered' || legacyOrder.status === 'Shipped',
            verified: legacyOrder.status === 'Delivered',
          })),
          hasBreakdownSheet: true,
          inspectorRequired: false,
          qualityCheckComplete: legacyOrder.status === 'Delivered',
        });
      }

      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    // Otherwise, return filtered list
    const filters: any = {};
    if (status) {
      // Map legacy status to new format
      const statusMap: Record<string, string> = {
        'Draft': 'draft',
        'Pending': 'submitted',
        'Approved': 'approved',
        'Ordered': 'processing',
        'Shipped': 'in_transit',
        'Delivered': 'delivered',
        'Cancelled': 'cancelled',
      };
      filters.status = statusMap[status] || status;
    }
    if (date) filters.date = date;
    if (driverId) filters.assignedDriver = driverId;
    if (limit) filters.limit = parseInt(limit);

    const orders = await orderWorkflowService.getOrders(filters);

    // If no orders from service, return legacy order data
    if (orders.length === 0) {
      let legacyOrders = [...materialOrders];

      if (status) {
        legacyOrders = legacyOrders.filter(o => o.status === status);
      }

      return NextResponse.json({
        orders: legacyOrders.map(o => ({
          ...o,
          items: o.materials.map((m, idx) => ({
            itemId: `OI-${idx}`,
            ...m,
            pulled: o.status === 'Delivered' || o.status === 'Shipped',
            verified: o.status === 'Delivered',
          })),
          hasBreakdownSheet: true,
          inspectorRequired: false,
          qualityCheckComplete: o.status === 'Delivered',
        })),
      });
    }

    return NextResponse.json({ orders });
  } catch (error) {
    console.error('Error fetching orders:', error);
    return NextResponse.json({ error: 'Failed to fetch orders' }, { status: 500 });
  }
}

// POST - Create new order or perform actions
export async function POST(request: NextRequest) {
  const auth = await requireAuth();
  if (!auth.authenticated) return auth.response;

  try {
    const data = await request.json();
    const { action } = data;

    switch (action) {
      case 'create': {
        const {
          createdBy,
          createdByName,
          priority,
          jobId,
          jobNimbusId,
          jobNumber,
          jobName,
          customerId,
          customerName,
          customerPhone,
          customerEmail,
          customerAddress,
          city,
          state,
          zipCode,
          requestedDeliveryDate,
          requestedDeliveryTime,
          items,
          specialInstructions,
          internalNotes,
          inspectorRequired,
          inspectorName,
          inspectorPhone,
          inspectorArrivalTime,
        } = data;

        // Create order using service
        const order = await orderWorkflowService.createOrder({
          createdBy,
          createdByName,
          priority,
          jobId,
          jobNimbusId,
          jobNumber,
          jobName,
          customerId,
          customerName,
          customerPhone,
          customerEmail,
          customerAddress,
          city,
          state,
          zipCode,
          requestedDeliveryDate,
          requestedDeliveryTime,
          items: items.map((item: any) => ({
            productId: item.productId,
            productName: item.productName,
            sku: item.sku,
            category: item.category,
            quantity: item.quantity,
            unit: item.unit,
            unitCost: item.unitCost,
            unitPrice: item.unitPrice,
          })),
          specialInstructions,
          internalNotes,
          inspectorRequired,
          inspectorName,
          inspectorPhone,
          inspectorArrivalTime,
        });

        return NextResponse.json(order);
      }

      case 'approve': {
        const { orderId, approvedBy } = data;
        if (!orderId || !approvedBy) {
          return NextResponse.json({ error: 'orderId and approvedBy required' }, { status: 400 });
        }
        const order = await orderWorkflowService.approveOrder(orderId, approvedBy);
        return NextResponse.json(order);
      }

      case 'schedule': {
        const { orderId, assignedDriver, assignedDriverName, assignedVehicle, scheduledDeliveryDate, scheduledDeliveryTime } = data;
        if (!orderId || !scheduledDeliveryDate) {
          return NextResponse.json({ error: 'orderId and scheduledDeliveryDate required' }, { status: 400 });
        }
        await orderWorkflowService.scheduleDelivery(orderId, {
          assignedDriver,
          assignedDriverName,
          assignedVehicle,
          scheduledDeliveryDate,
          scheduledDeliveryTime,
        });
        return NextResponse.json({ success: true });
      }

      case 'create_manifest': {
        const { orderId, createdBy } = data;
        if (!orderId || !createdBy) {
          return NextResponse.json({ error: 'orderId and createdBy required' }, { status: 400 });
        }
        const manifest = await orderWorkflowService.createLoadingManifest(orderId, createdBy);
        return NextResponse.json(manifest);
      }

      case 'update_manifest_item': {
        const { manifestId, productId, pulledBy } = data;
        if (!manifestId || !productId || !pulledBy) {
          return NextResponse.json({ error: 'manifestId, productId, and pulledBy required' }, { status: 400 });
        }
        await orderWorkflowService.updateManifestItem(manifestId, productId, pulledBy);
        return NextResponse.json({ success: true });
      }

      case 'verify_load': {
        const { manifestId, verifiedBy } = data;
        if (!manifestId || !verifiedBy) {
          return NextResponse.json({ error: 'manifestId and verifiedBy required' }, { status: 400 });
        }
        await orderWorkflowService.verifyLoad(manifestId, verifiedBy);
        return NextResponse.json({ success: true });
      }

      case 'update_status': {
        const { orderId, status, updates } = data;
        await orderWorkflowService.updateOrderStatus(orderId, status, updates);
        return NextResponse.json({ success: true });
      }

      case 'generate_invoice': {
        const { orderId } = data;
        if (!orderId) {
          return NextResponse.json({ error: 'orderId required' }, { status: 400 });
        }
        const invoice = await orderWorkflowService.generateInvoice(orderId);
        return NextResponse.json(invoice);
      }

      case 'complete_qc': {
        const { orderId, completedBy, notes } = data;
        if (!orderId || !completedBy) {
          return NextResponse.json({ error: 'orderId and completedBy required' }, { status: 400 });
        }
        await orderWorkflowService.completeQualityCheck(orderId, completedBy, notes);
        return NextResponse.json({ success: true });
      }

      case 'create_return': {
        const { originalOrderId, createdBy, createdByName, items, notes } = data;
        const returnOrder = await orderWorkflowService.createReturn({
          originalOrderId,
          createdBy,
          createdByName,
          items,
          notes,
        });
        return NextResponse.json(returnOrder);
      }

      case 'create_route': {
        const { date, driverId, driverName, vehicleId, orderIds } = data;
        const route = await orderWorkflowService.createRoute({
          date,
          driverId,
          driverName,
          vehicleId,
          orderIds,
        });
        return NextResponse.json(route);
      }

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    console.error('Error processing order action:', error);
    return NextResponse.json({ error: 'Failed to process request' }, { status: 500 });
  }
}

// PATCH - Update existing order
export async function PATCH(request: NextRequest) {
  const auth = await requireAuth();
  if (!auth.authenticated) return auth.response;

  try {
    const data = await request.json();
    const { orderId, status, ...updates } = data;

    if (!orderId) {
      return NextResponse.json({ error: 'Order ID required' }, { status: 400 });
    }

    await orderWorkflowService.updateOrderStatus(orderId, status, updates);

    // Update inventory if order is moving to loading (deduct stock once)
    // Only deduct if loadedAt is not already set (prevents double-deduction on repeat calls)
    if (status === 'loading') {
      const order = await orderWorkflowService.getOrderById(orderId);
      if (order && !order.loadedAt) {
        for (const item of order.items) {
          updateProductStock(item.productId, item.quantity, 'subtract');
        }
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating order:', error);
    return NextResponse.json({ error: 'Failed to update order' }, { status: 500 });
  }
}
