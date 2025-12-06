import { NextRequest, NextResponse } from 'next/server';
import {
  materialOrders,
  getOrderById,
  getOrdersByStatus,
  getOrdersBySalesRep,
  getPendingOrders,
  getRecentOrders,
  calculateOrderTotals,
  generateOrderId,
  MaterialOrderRequest,
  MaterialOrderItem
} from '@/lib/materialOrders';
import { inventoryProducts, getProductById } from '@/lib/inventoryData';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const orderId = searchParams.get('orderId');
    const status = searchParams.get('status') as MaterialOrderRequest['status'] | null;
    const salesRep = searchParams.get('salesRep');
    const pending = searchParams.get('pending');
    const limit = searchParams.get('limit');

    // Get single order
    if (orderId) {
      const order = getOrderById(orderId);
      if (!order) {
        return NextResponse.json({ error: 'Order not found' }, { status: 404 });
      }
      return NextResponse.json(order);
    }

    // Get orders by status
    if (status) {
      const orders = getOrdersByStatus(status);
      return NextResponse.json(orders);
    }

    // Get orders by sales rep
    if (salesRep) {
      const orders = getOrdersBySalesRep(salesRep);
      return NextResponse.json(orders);
    }

    // Get pending orders
    if (pending === 'true') {
      const orders = getPendingOrders();
      return NextResponse.json(orders);
    }

    // Get recent orders with limit
    if (limit) {
      const orders = getRecentOrders(parseInt(limit));
      return NextResponse.json(orders);
    }

    // Return all orders with products data
    const ordersWithDetails = materialOrders.map(order => ({
      ...order,
      materials: order.materials.map(m => ({
        ...m,
        product: getProductById(m.productId)
      }))
    }));

    return NextResponse.json({
      orders: ordersWithDetails,
      total: ordersWithDetails.length,
      products: inventoryProducts,
      stats: {
        pending: getPendingOrders().length,
        total: materialOrders.length,
        totalValue: materialOrders.reduce((sum, o) => sum + o.totalPrice, 0)
      }
    });

  } catch (error) {
    console.error('Error fetching material orders:', error);
    return NextResponse.json(
      { error: 'Failed to fetch material orders' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const data = await request.json();
    const { action, ...params } = data;

    switch (action) {
      case 'create':
        // Create new order
        const newOrder: MaterialOrderRequest = {
          orderId: generateOrderId(),
          salesRep: params.salesRep,
          jobNumber: params.jobNumber,
          jobName: params.jobName,
          customerName: params.customerName,
          customerPhone: params.customerPhone,
          customerEmail: params.customerEmail,
          shippingAddress: params.shippingAddress,
          city: params.city,
          state: params.state,
          zipCode: params.zipCode,
          orderDate: new Date().toISOString().slice(0, 10),
          requestedDeliveryDate: params.requestedDeliveryDate,
          materials: params.materials,
          ...calculateOrderTotals(params.materials),
          specialInstructions: params.specialInstructions,
          priority: params.priority || 'Normal',
          status: 'Pending',
          createdBy: params.createdBy,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };

        // In a real app, this would be saved to database
        // For now, return the created order
        return NextResponse.json({ success: true, order: newOrder });

      case 'approve':
        // Approve order
        return NextResponse.json({
          success: true,
          message: `Order ${params.orderId} approved by ${params.approvedBy}`
        });

      case 'updateStatus':
        // Update order status
        return NextResponse.json({
          success: true,
          message: `Order ${params.orderId} status updated to ${params.status}`
        });

      case 'calculateTotals':
        // Calculate order totals
        const totals = calculateOrderTotals(params.materials);
        return NextResponse.json(totals);

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    console.error('Error processing material order request:', error);
    return NextResponse.json(
      { error: 'Failed to process request' },
      { status: 500 }
    );
  }
}
