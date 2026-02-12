import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-service';
import {
  workOrderService,
  WorkOrderStatus,
  WorkOrderType,
  WorkOrderPriority,
} from '@/lib/work-order-service';

// ============================================
// GET - List work orders with filtering
// ============================================

export async function GET(request: NextRequest) {
  const auth = await requireAuth();
  if (!auth.authenticated) return auth.response;

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    // Single work order lookup
    if (id) {
      const workOrder = workOrderService.getWorkOrderById(id);
      if (!workOrder) {
        return NextResponse.json({ error: 'Work order not found' }, { status: 404 });
      }
      return NextResponse.json(workOrder);
    }

    // List with filters
    const status = searchParams.get('status') as WorkOrderStatus | null;
    const type = searchParams.get('type') as WorkOrderType | null;
    const priority = searchParams.get('priority') as WorkOrderPriority | null;
    const search = searchParams.get('search');
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');
    const sortBy = searchParams.get('sortBy');
    const sortDir = searchParams.get('sortDir') as 'asc' | 'desc' | null;

    const workOrders = workOrderService.getWorkOrders({
      status: status || undefined,
      type: type || undefined,
      priority: priority || undefined,
      search: search || undefined,
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined,
      sortBy: sortBy || undefined,
      sortDir: sortDir || undefined,
    });

    const stats = workOrderService.getStats();

    return NextResponse.json({
      workOrders,
      stats,
      total: workOrders.length,
    });
  } catch (error) {
    console.error('Work Orders API GET error:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

// ============================================
// POST - Action-based dispatch
// ============================================

export async function POST(request: NextRequest) {
  const auth = await requireAuth();
  if (!auth.authenticated) return auth.response;

  try {
    const body = await request.json();
    const { action, ...data } = body;

    switch (action) {
      // --- Create new work order ---
      case 'create': {
        const result = workOrderService.createWorkOrder({
          jobId: data.jobId,
          customerName: data.customerName,
          customerPhone: data.customerPhone,
          customerEmail: data.customerEmail,
          address: data.address,
          type: data.type,
          priority: data.priority,
          materials: data.materials || [],
          scheduledDate: data.scheduledDate,
          scheduledTime: data.scheduledTime,
          notes: data.notes,
          specialInstructions: data.specialInstructions,
          assignedDriver: data.assignedDriver,
          vehicleType: data.vehicleType,
          createdBy: data.createdBy || auth.user.name || 'Unknown',
        });

        if (!result.success) {
          return NextResponse.json({ error: 'Validation failed', errors: result.errors }, { status: 400 });
        }

        return NextResponse.json({ success: true, workOrder: result.workOrder }, { status: 201 });
      }

      // --- Update work order status ---
      case 'update-status': {
        if (!data.workOrderId || !data.status) {
          return NextResponse.json({ error: 'workOrderId and status are required' }, { status: 400 });
        }

        const result = workOrderService.updateWorkOrderStatus(
          data.workOrderId,
          data.status as WorkOrderStatus,
          data.changedBy || auth.user.name || 'Unknown',
          data.notes
        );

        if (!result.success) {
          return NextResponse.json({ error: result.error }, { status: 400 });
        }

        return NextResponse.json({ success: true, workOrder: result.workOrder });
      }

      // --- Bulk create tickets from jobs ---
      case 'bulk-create-from-jobs': {
        if (!data.jobIds || !Array.isArray(data.jobIds) || data.jobIds.length === 0) {
          return NextResponse.json({ error: 'jobIds array is required' }, { status: 400 });
        }

        const availableJobs = workOrderService.getAvailableJobs();
        const selectedJobs = availableJobs.filter(j => data.jobIds.includes(j.jobId));

        if (selectedJobs.length === 0) {
          return NextResponse.json({ error: 'No matching jobs found' }, { status: 404 });
        }

        const result = workOrderService.bulkCreateTickets(selectedJobs);
        return NextResponse.json({ success: true, ...result });
      }

      // --- Parse uploaded work order data ---
      case 'parse-upload': {
        if (!data.fileData) {
          return NextResponse.json({ error: 'fileData is required' }, { status: 400 });
        }

        const format = data.format === 'json' ? 'json' : 'csv';
        const result = workOrderService.parseWorkOrderUpload(data.fileData, format);
        return NextResponse.json({ success: true, ...result });
      }

      // --- Validate work order data ---
      case 'validate': {
        const result = workOrderService.validateWorkOrder(data);
        return NextResponse.json(result);
      }

      // --- Calculate estimated cost ---
      case 'calculate-cost': {
        if (!data.materials || !data.priority || !data.type) {
          return NextResponse.json({ error: 'materials, priority, and type are required' }, { status: 400 });
        }

        const cost = workOrderService.calculateWorkOrderCost({
          materials: data.materials,
          priority: data.priority,
          type: data.type,
        });
        return NextResponse.json({ estimatedCost: cost });
      }

      // --- Get work order history ---
      case 'get-history': {
        if (!data.workOrderId) {
          return NextResponse.json({ error: 'workOrderId is required' }, { status: 400 });
        }

        const history = workOrderService.getWorkOrderHistory(data.workOrderId);
        if (history === null) {
          return NextResponse.json({ error: 'Work order not found' }, { status: 404 });
        }

        return NextResponse.json({ history });
      }

      // --- Approve work order ---
      case 'approve': {
        if (!data.workOrderId) {
          return NextResponse.json({ error: 'workOrderId is required' }, { status: 400 });
        }

        const result = workOrderService.approveWorkOrder(
          data.workOrderId,
          data.approvedBy || auth.user.name || 'Unknown'
        );

        if (!result.success) {
          return NextResponse.json({ error: result.error }, { status: 400 });
        }

        return NextResponse.json({ success: true });
      }

      // --- Schedule work order ---
      case 'schedule': {
        if (!data.workOrderId || !data.scheduledDate || !data.scheduledTime) {
          return NextResponse.json(
            { error: 'workOrderId, scheduledDate, and scheduledTime are required' },
            { status: 400 }
          );
        }

        const result = workOrderService.scheduleWorkOrder(
          data.workOrderId,
          data.scheduledDate,
          data.scheduledTime,
          data.driverName,
          data.vehicleType
        );

        if (!result.success) {
          return NextResponse.json({ error: result.error }, { status: 400 });
        }

        return NextResponse.json({ success: true });
      }

      // --- Assign driver ---
      case 'assign-driver': {
        if (!data.workOrderId || !data.driverName) {
          return NextResponse.json({ error: 'workOrderId and driverName are required' }, { status: 400 });
        }

        const result = workOrderService.assignDriver(
          data.workOrderId,
          data.driverName,
          data.vehicleType || ''
        );

        if (!result.success) {
          return NextResponse.json({ error: result.error }, { status: 400 });
        }

        return NextResponse.json({ success: true });
      }

      // --- Get available jobs for conversion ---
      case 'get-jobs': {
        const jobs = workOrderService.getAvailableJobs();
        return NextResponse.json({ jobs });
      }

      // --- Get product catalog ---
      case 'get-catalog': {
        const catalog = workOrderService.getProductCatalog();
        return NextResponse.json({ catalog });
      }

      // --- Get drivers ---
      case 'get-drivers': {
        const drivers = workOrderService.getDrivers();
        return NextResponse.json({ drivers });
      }

      // --- Get sample CSV template ---
      case 'get-sample-csv': {
        const csv = workOrderService.getSampleCSV();
        return NextResponse.json({ csv });
      }

      // --- Fetch jobs from JobNimbus (READ-ONLY) ---
      case 'fetch-jn-jobs': {
        const { status, rep, limit } = data;
        const jobs = await workOrderService.fetchJNJobs({ status, rep, limit });
        return NextResponse.json({ jobs });
      }

      // --- Fetch single JN job detail (READ-ONLY) ---
      case 'fetch-jn-job-detail': {
        const { jnid } = data;
        if (!jnid) return NextResponse.json({ error: 'jnid required' }, { status: 400 });
        const detail = await workOrderService.fetchJNJobDetail(jnid);
        return NextResponse.json(detail);
      }

      // --- Convert JN job to work order (READ-ONLY mapping) ---
      case 'convert-jn-job': {
        const { jnJob } = data;
        if (!jnJob) return NextResponse.json({ error: 'jnJob required' }, { status: 400 });
        const workOrder = workOrderService.convertJNJobToWorkOrder(jnJob);
        return NextResponse.json({ workOrder });
      }

      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }
  } catch (error) {
    console.error('Work Orders API POST error:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
