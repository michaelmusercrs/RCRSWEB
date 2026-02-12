import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-service';
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
import { deliveryWorkflowService, MaterialItem } from '@/lib/delivery-workflow-service';
import { emailService } from '@/lib/email-service';
import { riverBot } from '@/lib/river-bot-service';

export async function GET(request: NextRequest) {
  const auth = await requireAuth();
  if (!auth.authenticated) return auth.response;

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
  const auth = await requireAuth();
  if (!auth.authenticated) return auth.response;

  try {
    const data = await request.json();
    const { action, ...params } = data;

    switch (action) {
      case 'create': {
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

        // Auto-create a delivery ticket for this material order
        let ticketId: string | null = null;
        try {
          const ticketMaterials: MaterialItem[] = (params.materials || []).map((m: MaterialOrderItem) => ({
            productId: m.productId,
            productName: m.productName,
            sku: m.productId,
            quantity: m.quantity,
            unit: getProductById(m.productId)?.unit || 'each',
            unitPrice: m.unitPrice,
            totalPrice: m.totalPrice,
            category: getProductById(m.productId)?.category || 'General',
          }));

          const priorityMap: Record<string, 'normal' | 'rush' | 'urgent'> = {
            Normal: 'normal',
            Rush: 'rush',
            Urgent: 'urgent',
          };

          const ticket = await deliveryWorkflowService.createTicket({
            createdBy: params.createdBy || 'system',
            createdByName: params.salesRep || 'System',
            createdByRole: 'project_manager',
            jobId: params.jobNumber || newOrder.orderId,
            jobName: params.jobName || '',
            jobAddress: params.shippingAddress || '',
            city: params.city || '',
            state: params.state || 'AL',
            zip: params.zipCode || '',
            customerName: params.customerName || '',
            customerPhone: params.customerPhone || '',
            customerEmail: params.customerEmail,
            projectManager: params.salesRep || '',
            materials: ticketMaterials,
            requestedDate: params.requestedDeliveryDate || new Date().toISOString().slice(0, 10),
            priority: priorityMap[params.priority || 'Normal'] || 'normal',
            specialInstructions: params.specialInstructions,
          });

          ticketId = ticket.ticketId;
        } catch (ticketError) {
          console.error('Failed to auto-create delivery ticket:', ticketError);
          // Don't fail the order creation if ticket creation fails
        }

        // Send delivery order email to driver via Gmail+ alias (fire-and-forget)
        if (ticketId) {
          const materialsList = (params.materials || []).map(
            (m: MaterialOrderItem) => `${m.productName} x${m.quantity}`
          );

          // Send to richard+orders@ (triggers Gmail filter for delivery management)
          emailService.sendDeliveryOrder({
            driverEmail: 'richard+orders@rivercityroofingsolutions.com',
            ticketId,
            customerName: params.customerName || '',
            address: params.shippingAddress || '',
            items: materialsList,
            deliveryDate: params.requestedDeliveryDate || 'TBD',
            notes: params.specialInstructions,
          }).catch(err => console.warn('Delivery order email failed:', err));

          // Notify team via River bot
          riverBot.notifyDeliveryUpdate({
            ticketId,
            status: 'scheduled',
            driverName: 'Richard Geahr',
            address: params.shippingAddress || '',
            customerName: params.customerName,
          }).catch(err => console.warn('River bot delivery notify failed:', err));
        }

        return NextResponse.json({
          success: true,
          order: newOrder,
          ticketId,
          message: ticketId
            ? `Order created and delivery ticket ${ticketId} auto-generated`
            : 'Order created (delivery ticket creation failed - create manually)',
        });
      }

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

      case 'calculateTotals': {
        // Calculate order totals
        const totals = calculateOrderTotals(params.materials);
        return NextResponse.json(totals);
      }

      case 'create-ticket-from-order': {
        // Create a delivery ticket from an existing material order
        const order = getOrderById(params.orderId);
        if (!order) {
          return NextResponse.json({ error: 'Order not found' }, { status: 404 });
        }

        const ticketMats: MaterialItem[] = order.materials.map((m: MaterialOrderItem) => ({
          productId: m.productId,
          productName: m.productName,
          sku: m.productId,
          quantity: m.quantity,
          unit: getProductById(m.productId)?.unit || 'each',
          unitPrice: m.unitPrice,
          totalPrice: m.totalPrice,
          category: getProductById(m.productId)?.category || 'General',
        }));

        const pMap: Record<string, 'normal' | 'rush' | 'urgent'> = {
          Normal: 'normal',
          Rush: 'rush',
          Urgent: 'urgent',
        };

        const newTicket = await deliveryWorkflowService.createTicket({
          createdBy: params.createdBy || order.createdBy || 'system',
          createdByName: params.createdByName || order.salesRep || 'System',
          createdByRole: params.createdByRole || 'project_manager',
          jobId: order.jobNumber || order.orderId,
          jobName: order.jobName,
          jobAddress: order.shippingAddress,
          city: order.city,
          state: order.state,
          zip: order.zipCode,
          customerName: order.customerName,
          customerPhone: order.customerPhone,
          customerEmail: order.customerEmail,
          projectManager: order.salesRep,
          materials: ticketMats,
          requestedDate: order.requestedDeliveryDate,
          priority: pMap[order.priority] || 'normal',
          specialInstructions: order.specialInstructions,
        });

        return NextResponse.json({
          success: true,
          ticket: newTicket,
          message: `Delivery ticket ${newTicket.ticketId} created from order ${order.orderId}`,
        });
      }

      case 'create-ticket-from-job': {
        // Create a delivery ticket from completed job data
        const jobMaterials: MaterialItem[] = (params.materials || []).map((m: any) => ({
          productId: m.productId || m.sku || '',
          productName: m.productName || m.name || '',
          sku: m.sku || m.productId || '',
          quantity: m.quantity || 0,
          unit: m.unit || 'each',
          unitPrice: m.unitPrice || m.price || 0,
          totalPrice: (m.unitPrice || m.price || 0) * (m.quantity || 0),
          category: m.category || 'General',
        }));

        const jobTicket = await deliveryWorkflowService.createTicket({
          createdBy: params.createdBy || 'system',
          createdByName: params.createdByName || 'System',
          createdByRole: params.createdByRole || 'project_manager',
          jobId: params.jobId || '',
          jobName: params.jobName || '',
          jobAddress: params.jobAddress || '',
          city: params.city || '',
          state: params.state || 'AL',
          zip: params.zip || '',
          customerName: params.customerName || '',
          customerPhone: params.customerPhone || '',
          customerEmail: params.customerEmail,
          projectManager: params.projectManager || params.salesRep || '',
          materials: jobMaterials,
          requestedDate: params.requestedDate || new Date().toISOString().slice(0, 10),
          priority: params.priority || 'normal',
          specialInstructions: params.specialInstructions,
        });

        return NextResponse.json({
          success: true,
          ticket: jobTicket,
          message: `Delivery ticket ${jobTicket.ticketId} created from job ${params.jobId}`,
        });
      }

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
