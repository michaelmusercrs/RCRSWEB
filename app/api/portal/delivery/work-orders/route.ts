import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-service';
import { auditLog } from '@/lib/audit-logger';
import {
  workOrderService,
  WorkOrderStatus,
  WorkOrderType,
  WorkOrderPriority,
} from '@/lib/work-order-service';
import { jobNimbusService } from '@/lib/jobnimbus-service';

// Roles allowed to schedule / reassign delivery work orders. Covers:
// - owner        (Michael, Chris)
// - admin        (Sara)
// - manager      (Destin)
// - project_manager (Bart, John)
// - office       (Tia)
// Drivers and sales reps are intentionally excluded.
const ALLOWED_SCHEDULER_ROLES = [
  'owner',
  'admin',
  'manager',
  'project_manager',
  'office',
];

// ============================================
// GET - List work orders with filtering
// ============================================

export async function GET(request: NextRequest) {
  const auth = await requireAuth();
  if (!auth.authenticated) return auth.response;

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const action = searchParams.get('action');

    // R-number lookup — used by the create form to auto-populate customer/
    // address/rep/phone/email from JobNimbus when the user enters a job
    // number like "R-11071".
    if (action === 'lookup') {
      const jobNumber = (searchParams.get('jobNumber') || '').trim();
      if (!jobNumber) {
        return NextResponse.json(
          { success: false, error: 'jobNumber query param required' },
          { status: 400 }
        );
      }

      // JN is tolerant about formatting but not consistent — try a few
      // reasonable variants.
      const candidates = Array.from(new Set([
        jobNumber,
        jobNumber.replace(/^R\s*/i, 'R-'),
        jobNumber.replace(/^R-?/i, ''),
        jobNumber.replace(/^R\s*/i, 'R'),
      ])).filter(Boolean);

      let jnJob = null;
      for (const candidate of candidates) {
        try {
          jnJob = await jobNimbusService.getJobByNumber(candidate);
          if (jnJob) break;
        } catch {
          // try next
        }
      }

      if (!jnJob) {
        return NextResponse.json({
          success: false,
          error: `No match in JobNimbus for ${jobNumber}`,
        });
      }

      // Pull contact record for phone/email (job has address but no phone)
      let contact: Awaited<ReturnType<typeof jobNimbusService.getContact>> | null = null;
      const contactJnid = jnJob.primary?.jnid;
      if (contactJnid) {
        try {
          contact = await jobNimbusService.getContact(contactJnid);
        } catch {
          contact = null;
        }
      }

      // Address: prefer job record, fall back to contact
      const addrSource = [
        jnJob.address_line1,
        jnJob.city,
        jnJob.state_text,
        jnJob.zip,
      ].some(Boolean) ? jnJob : contact;

      const address = addrSource
        ? [
            addrSource.address_line1,
            addrSource.city,
            addrSource.state_text,
            addrSource.zip,
          ].filter(Boolean).join(', ')
        : '';

      // Phone fallback order: mobile → home → work
      const phone =
        contact?.mobile_phone ||
        contact?.home_phone ||
        contact?.work_phone ||
        '';

      // Customer name: prefer job.name (e.g. "Smith - Roof Replacement"),
      // fall back to contact display name.
      const customerName =
        jnJob.name ||
        contact?.display_name ||
        [contact?.first_name, contact?.last_name].filter(Boolean).join(' ') ||
        '';

      return NextResponse.json({
        success: true,
        jobNumber: jnJob.number || jobNumber,
        jnJobId: jnJob.jnid,
        customerName,
        address,
        addressParts: {
          street: (addrSource?.address_line1 || '').trim(),
          city: (addrSource?.city || '').trim(),
          state: (addrSource?.state_text || '').trim(),
          zip: (addrSource?.zip || '').trim(),
        },
        phone,
        email: contact?.email || '',
        salesRep: jnJob.sales_rep_name || contact?.sales_rep_name || '',
        jobName: jnJob.name || '',
      });
    }

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
          jobNumber: data.jobNumber,
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
          supplierName: data.supplierName,
          orderSource: data.orderSource === 'other_vendor' ? 'other_vendor' : 'stock',
          createdBy: data.createdBy || auth.user.name || 'Unknown',
        });

        if (!result.success) {
          return NextResponse.json({ error: 'Validation failed', errors: result.errors }, { status: 400 });
        }

        auditLog('WORK_ORDER_CREATE', auth.user.email, `Created work order ${result.workOrder?.workOrderId || 'unknown'} for ${data.customerName || 'unknown'} (type: ${data.type || 'N/A'})`, request);
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

        auditLog('WORK_ORDER_STATUS', auth.user.email, `Work order ${data.workOrderId} status changed to ${data.status}${data.notes ? ': ' + data.notes : ''}`, request);
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

        auditLog('WORK_ORDER_APPROVE', auth.user.email, `Approved work order ${data.workOrderId}`, request);
        return NextResponse.json({ success: true });
      }

      // --- Schedule work order ---
      case 'schedule': {
        if (!ALLOWED_SCHEDULER_ROLES.includes(auth.user.role)) {
          return NextResponse.json(
            { error: 'Only owners, admins, managers, PMs, and office staff can schedule or reassign work orders' },
            { status: 403 }
          );
        }

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

        auditLog(
          'WORK_ORDER_SCHEDULED',
          auth.user.email,
          `Work order ${data.workOrderId} scheduled for ${data.scheduledDate} ${data.scheduledTime} · driver: ${data.driverName || 'unassigned'}`,
          request
        );
        return NextResponse.json({ success: true });
      }

      // --- Assign driver ---
      case 'assign-driver': {
        if (!ALLOWED_SCHEDULER_ROLES.includes(auth.user.role)) {
          return NextResponse.json(
            { error: 'Only owners, admins, managers, PMs, and office staff can schedule or reassign work orders' },
            { status: 403 }
          );
        }

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

        auditLog(
          'WORK_ORDER_ASSIGNED',
          auth.user.email,
          `Work order ${data.workOrderId} driver reassigned to ${data.driverName}${data.vehicleType ? ' (' + data.vehicleType + ')' : ''}`,
          request
        );
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
