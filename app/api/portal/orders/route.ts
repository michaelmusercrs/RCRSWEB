import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-service';
import { auditLog } from '@/lib/audit-logger';
import { deliveryPortalService } from '@/lib/delivery-portal-service';

export async function GET(request: NextRequest) {
  const auth = await requireAuth();
  if (!auth.authenticated) return auth.response;

  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') as any || undefined;

    const orders = await deliveryPortalService.getOrders(status);
    return NextResponse.json(orders);
  } catch (error) {
    console.error('Error fetching orders:', error);
    return NextResponse.json({ error: 'Failed to fetch orders' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth();
  if (!auth.authenticated) return auth.response;

  try {
    const data = await request.json();
    const order = await deliveryPortalService.createOrder(data);
    auditLog('ORDER_CREATE', auth.user.email, `Created order${order?.orderId ? ' ' + order.orderId : ''}: ${data.customerName || 'unknown customer'}`, request);
    return NextResponse.json(order);
  } catch (error) {
    console.error('Error creating order:', error);
    return NextResponse.json({ error: 'Failed to create order' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  const auth = await requireAuth();
  if (!auth.authenticated) return auth.response;

  try {
    const data = await request.json();
    const { orderId, status, assignedDriver } = data;

    await deliveryPortalService.updateOrderStatus(orderId, status, assignedDriver);
    auditLog('ORDER_STATUS', auth.user.email, `Order ${orderId} status changed to ${status}${assignedDriver ? ', assigned to ' + assignedDriver : ''}`, request);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating order:', error);
    return NextResponse.json({ error: 'Failed to update order' }, { status: 500 });
  }
}
