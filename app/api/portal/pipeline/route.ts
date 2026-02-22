/**
 * Material Order Pipeline API
 * 
 * 18-stage material order lifecycle management.
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-service';
import {
  materialOrderPipeline,
  PIPELINE_STAGES,
  STAGE_CONFIG,
  type PipelineStage,
  type OrderPriority,
} from '@/lib/material-order-pipeline';

export async function GET(request: NextRequest) {
  const auth = await requireAuth();
  if (!auth.authenticated) return auth.response;

  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action') || 'list';

    switch (action) {
      case 'list': {
        const stage = searchParams.get('stage') as PipelineStage | null;
        const priority = searchParams.get('priority') as OrderPriority | null;
        const driverId = searchParams.get('driverId') || undefined;
        const jobNumber = searchParams.get('jobNumber') || undefined;
        const limit = parseInt(searchParams.get('limit') || '100');
        const cancelled = searchParams.get('cancelled') === 'true' ? true : searchParams.get('cancelled') === 'false' ? false : undefined;
        const paymentStatus = searchParams.get('paymentStatus') as any || undefined;

        const orders = await materialOrderPipeline.getOrders({
          stage: stage || undefined,
          priority: priority || undefined,
          driverId,
          jobNumber,
          cancelled,
          paymentStatus,
          limit,
        });
        return NextResponse.json(orders);
      }

      case 'order': {
        const orderId = searchParams.get('orderId');
        if (!orderId) return NextResponse.json({ error: 'orderId required' }, { status: 400 });
        const order = await materialOrderPipeline.getOrderById(orderId);
        if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 });

        // Filter cost data based on role
        const role = auth.user.role;
        if (role === 'sales' || role === 'driver') {
          // Strip purchase price info
          const safeOrder = {
            ...order,
            totalCost: undefined,
            items: order.items.map(i => ({ ...i, unitCost: undefined, totalCost: undefined })),
          };
          return NextResponse.json(safeOrder);
        }

        return NextResponse.json(order);
      }

      case 'active': {
        const orders = await materialOrderPipeline.getActiveOrders();
        return NextResponse.json(orders);
      }

      case 'byDriver': {
        const driverId = searchParams.get('driverId');
        if (!driverId) return NextResponse.json({ error: 'driverId required' }, { status: 400 });
        const orders = await materialOrderPipeline.getOrdersByDriver(driverId);
        return NextResponse.json(orders);
      }

      case 'atStage': {
        const stage = searchParams.get('stage') as PipelineStage;
        if (!stage) return NextResponse.json({ error: 'stage required' }, { status: 400 });
        const orders = await materialOrderPipeline.getOrdersAtStage(stage);
        return NextResponse.json(orders);
      }

      case 'stats': {
        const stats = await materialOrderPipeline.getOrderStats();
        return NextResponse.json(stats);
      }

      case 'pullSheet': {
        const orderId = searchParams.get('orderId');
        if (!orderId) return NextResponse.json({ error: 'orderId required' }, { status: 400 });
        const pullSheet = await materialOrderPipeline.generatePullSheet(orderId);
        if (!pullSheet) return NextResponse.json({ error: 'Order not found' }, { status: 404 });
        return NextResponse.json(pullSheet);
      }

      case 'stages': {
        return NextResponse.json({ stages: PIPELINE_STAGES, config: STAGE_CONFIG });
      }

      case 'invoices': {
        const orderId = searchParams.get('orderId');
        const type = searchParams.get('type') as any;
        const status = searchParams.get('status') as any;

        if (orderId) {
          const invoices = await materialOrderPipeline.getInvoicesByOrder(orderId);
          // Filter internal invoices for non-admin/office
          const role = auth.user.role;
          if (role !== 'admin' && role !== 'owner' && role !== 'office') {
            return NextResponse.json(invoices.filter(i => i.type === 'customer'));
          }
          return NextResponse.json(invoices);
        }

        const invoices = await materialOrderPipeline.getInvoices({ type, status });
        // Filter internal invoices for non-admin/office
        const role = auth.user.role;
        if (role !== 'admin' && role !== 'owner' && role !== 'office') {
          return NextResponse.json(invoices.filter(i => i.type === 'customer'));
        }
        return NextResponse.json(invoices);
      }

      case 'invoice': {
        const invoiceId = searchParams.get('invoiceId');
        if (!invoiceId) return NextResponse.json({ error: 'invoiceId required' }, { status: 400 });
        const invoice = await materialOrderPipeline.getInvoice(invoiceId);
        if (!invoice) return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });

        // Block internal invoice access for non-admin/office
        const role = auth.user.role;
        if (invoice.type === 'internal' && role !== 'admin' && role !== 'owner' && role !== 'office') {
          return NextResponse.json({ error: 'Access denied' }, { status: 403 });
        }

        return NextResponse.json(invoice);
      }

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    console.error('Pipeline API error:', error);
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
      case 'createOrder': {
        const order = await materialOrderPipeline.createOrder({
          createdBy: auth.user.userId,
          createdByName: auth.user.name,
          createdByRole: auth.user.role,
          priority: body.priority || 'normal',
          jobId: body.jobId,
          jobNimbusId: body.jobNimbusId,
          jobNumber: body.jobNumber,
          jobName: body.jobName,
          customerName: body.customerName,
          customerPhone: body.customerPhone,
          customerEmail: body.customerEmail,
          deliveryAddress: body.deliveryAddress,
          deliveryCity: body.deliveryCity,
          deliveryState: body.deliveryState || 'AL',
          deliveryZip: body.deliveryZip,
          requestedDeliveryDate: body.requestedDeliveryDate,
          items: body.items,
          specialInstructions: body.specialInstructions,
          notes: body.notes,
        });
        return NextResponse.json(order, { status: 201 });
      }

      case 'advanceStage': {
        const result = await materialOrderPipeline.advanceStage(
          body.orderId,
          body.targetStage,
          auth.user.userId,
          auth.user.name,
          auth.user.role,
          {
            photoUrls: body.photoUrls,
            gpsLatitude: body.gpsLatitude,
            gpsLongitude: body.gpsLongitude,
            gpsAddress: body.gpsAddress,
            notes: body.notes,
            metadata: body.metadata,
            assignedDriverId: body.assignedDriverId,
            assignedDriverName: body.assignedDriverName,
            scheduledDeliveryDate: body.scheduledDeliveryDate,
            scheduledDeliveryTime: body.scheduledDeliveryTime,
            pulledItems: body.pulledItems,
            verifiedItems: body.verifiedItems,
            deliveredItems: body.deliveredItems,
          }
        );
        if (!result.success) {
          return NextResponse.json({ error: result.error }, { status: 400 });
        }
        return NextResponse.json(result.order);
      }

      case 'cancelOrder': {
        const order = await materialOrderPipeline.cancelOrder(
          body.orderId, auth.user.userId, auth.user.name, body.reason || 'Cancelled'
        );
        if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 });
        return NextResponse.json(order);
      }

      case 'updateInvoiceStatus': {
        const invoice = await materialOrderPipeline.updateInvoiceStatus(
          body.invoiceId, body.status, body.paidAmount
        );
        if (!invoice) return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
        return NextResponse.json(invoice);
      }

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    console.error('Pipeline POST error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
