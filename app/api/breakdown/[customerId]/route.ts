/**
 * API Route: Customer Breakdown Sheet Operations
 * GET /api/breakdown/[customerId] - Get breakdown(s) for a customer
 * POST /api/breakdown/[customerId] - Create new breakdown for customer
 * PATCH /api/breakdown/[customerId] - Update breakdown (add materials, labor, etc.)
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-service';
import { breakdownService, LaborType } from '@/lib/breakdown-service';
import { filterCostByRole } from '@/lib/cost-visibility';

interface RouteParams {
  params: Promise<{ customerId: string }>;
}

// GET - Get breakdown(s) for a customer
export async function GET(
  request: NextRequest,
  { params }: RouteParams
) {
  const auth = await requireAuth();
  if (!auth.authenticated) return auth.response;

  try {
    const { customerId } = await params;
    const { searchParams } = new URL(request.url);
    const breakdownId = searchParams.get('breakdownId');
    const jobId = searchParams.get('jobId');

    // Cost visibility — sales reps and customers must never see costPrice or
    // any cost-related field on a breakdown. Office/owners/admin/manager/driver
    // get the full breakdown. Filter at every exit point.
    const role = auth.user.role;

    // If specific breakdown ID requested
    if (breakdownId) {
      const breakdown = await breakdownService.getBreakdown(breakdownId);
      if (!breakdown) {
        return NextResponse.json(
          { error: 'Breakdown not found' },
          { status: 404 }
        );
      }
      return NextResponse.json({ breakdown: filterCostByRole(breakdown, role) });
    }

    // If job ID specified, get breakdown for that job
    if (jobId) {
      const breakdown = await breakdownService.getBreakdownByJob(jobId);
      if (!breakdown) {
        return NextResponse.json(
          { error: 'Breakdown not found for this job' },
          { status: 404 }
        );
      }
      return NextResponse.json({ breakdown: filterCostByRole(breakdown, role) });
    }

    // Get all breakdowns for customer
    const breakdowns = await breakdownService.getBreakdownByCustomer(customerId);

    return NextResponse.json({
      breakdowns: filterCostByRole(breakdowns, role),
      count: breakdowns.length
    });
  } catch (error: any) {
    console.error('Error fetching breakdown:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch breakdown' },
      { status: 500 }
    );
  }
}

// POST - Create new breakdown for customer
export async function POST(
  request: NextRequest,
  { params }: RouteParams
) {
  const auth = await requireAuth();
  if (!auth.authenticated) return auth.response;

  try {
    const { customerId } = await params;
    const body = await request.json();

    const {
      customerName,
      customerEmail,
      customerPhone,
      customerAddress,
      customerCity,
      customerState,
      customerZip,
      jobId,
      jobNimbusId,
      jobName,
      jobAddress,
      jobDescription,
      projectManager,
      projectManagerName,
      createdBy,
      createdByName,
      taxRate
    } = body;

    // Validate required fields
    if (!customerName || !jobId || !jobName || !createdBy || !createdByName) {
      return NextResponse.json(
        { error: 'customerName, jobId, jobName, createdBy, and createdByName are required' },
        { status: 400 }
      );
    }

    // Check if breakdown already exists for this job
    const existingBreakdown = await breakdownService.getBreakdownByJob(jobId);
    if (existingBreakdown) {
      return NextResponse.json(
        { error: 'Breakdown already exists for this job', breakdown: existingBreakdown },
        { status: 409 }
      );
    }

    const breakdown = await breakdownService.createBreakdown({
      customerId,
      customerName,
      customerEmail,
      customerPhone,
      customerAddress: customerAddress || '',
      customerCity: customerCity || '',
      customerState: customerState || '',
      customerZip: customerZip || '',
      jobId,
      jobNimbusId,
      jobName,
      jobAddress: jobAddress || '',
      jobDescription,
      projectManager: projectManager || createdBy,
      projectManagerName: projectManagerName || createdByName,
      createdBy,
      createdByName,
      taxRate
    });

    return NextResponse.json({
      success: true,
      breakdown,
      message: 'Breakdown created successfully'
    }, { status: 201 });
  } catch (error: any) {
    console.error('Error creating breakdown:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create breakdown' },
      { status: 500 }
    );
  }
}

// PATCH - Update breakdown (add materials, labor, discount, etc.)
export async function PATCH(
  request: NextRequest,
  { params }: RouteParams
) {
  const auth = await requireAuth();
  if (!auth.authenticated) return auth.response;

  try {
    const { customerId } = await params;
    const body = await request.json();
    const { action, breakdownId } = body;

    if (!breakdownId) {
      return NextResponse.json(
        { error: 'breakdownId is required' },
        { status: 400 }
      );
    }

    let breakdown;

    switch (action) {
      case 'addMaterial':
        const { productId, quantity, sellPriceOverride, notes, addedBy, addedByName } = body;

        if (!productId || !quantity || !addedBy || !addedByName) {
          return NextResponse.json(
            { error: 'productId, quantity, addedBy, and addedByName are required' },
            { status: 400 }
          );
        }

        breakdown = await breakdownService.addMaterial(breakdownId, {
          productId,
          quantity,
          sellPriceOverride,
          notes,
          addedBy,
          addedByName
        });
        break;

      case 'addCustomMaterial':
        const {
          productName,
          description,
          quantity: customQty,
          unit,
          costPrice,
          sellPrice,
          notes: customNotes,
          addedBy: customAddedBy,
          addedByName: customAddedByName
        } = body;

        if (!productName || !customQty || !unit || costPrice === undefined || sellPrice === undefined) {
          return NextResponse.json(
            { error: 'productName, quantity, unit, costPrice, and sellPrice are required' },
            { status: 400 }
          );
        }

        breakdown = await breakdownService.addCustomMaterial(breakdownId, {
          productName,
          description,
          quantity: customQty,
          unit,
          costPrice,
          sellPrice,
          notes: customNotes,
          addedBy: customAddedBy,
          addedByName: customAddedByName
        });
        break;

      case 'removeMaterial':
        const { productId: removeProductId, removedBy, removedByName } = body;

        if (!removeProductId || !removedBy || !removedByName) {
          return NextResponse.json(
            { error: 'productId, removedBy, and removedByName are required' },
            { status: 400 }
          );
        }

        breakdown = await breakdownService.removeMaterial(
          breakdownId,
          removeProductId,
          removedBy,
          removedByName
        );
        break;

      case 'addLabor':
        const {
          laborType,
          description: laborDesc,
          hours,
          rate,
          workerId,
          workerName,
          workDate,
          notes: laborNotes,
          addedBy: laborAddedBy,
          addedByName: laborAddedByName
        } = body;

        if (!laborType || !laborDesc || !hours || !rate || !workerId || !workerName || !workDate) {
          return NextResponse.json(
            { error: 'laborType, description, hours, rate, workerId, workerName, and workDate are required' },
            { status: 400 }
          );
        }

        const validLaborTypes: LaborType[] = ['installation', 'repair', 'inspection', 'cleanup', 'other'];
        if (!validLaborTypes.includes(laborType)) {
          return NextResponse.json(
            { error: `Invalid laborType. Must be one of: ${validLaborTypes.join(', ')}` },
            { status: 400 }
          );
        }

        breakdown = await breakdownService.addLabor(breakdownId, {
          laborType,
          description: laborDesc,
          hours,
          rate,
          workerId,
          workerName,
          workDate,
          notes: laborNotes,
          addedBy: laborAddedBy,
          addedByName: laborAddedByName
        });
        break;

      case 'removeLabor':
        const { laborId, removedBy: laborRemovedBy, removedByName: laborRemovedByName } = body;

        if (!laborId || !laborRemovedBy || !laborRemovedByName) {
          return NextResponse.json(
            { error: 'laborId, removedBy, and removedByName are required' },
            { status: 400 }
          );
        }

        breakdown = await breakdownService.removeLabor(
          breakdownId,
          laborId,
          laborRemovedBy,
          laborRemovedByName
        );
        break;

      case 'applyDiscount':
        const { discountAmount, reason, appliedBy, appliedByName } = body;

        if (discountAmount === undefined || !reason || !appliedBy || !appliedByName) {
          return NextResponse.json(
            { error: 'discountAmount, reason, appliedBy, and appliedByName are required' },
            { status: 400 }
          );
        }

        breakdown = await breakdownService.applyDiscount(
          breakdownId,
          discountAmount,
          reason,
          appliedBy,
          appliedByName
        );
        break;

      case 'deductInventory':
        const { deductedBy, deductedByName } = body;

        if (!deductedBy || !deductedByName) {
          return NextResponse.json(
            { error: 'deductedBy and deductedByName are required' },
            { status: 400 }
          );
        }

        const result = await breakdownService.deductInventoryForBreakdown(
          breakdownId,
          deductedBy,
          deductedByName
        );

        return NextResponse.json({
          success: result.success,
          deducted: result.deducted,
          errors: result.errors,
          message: result.success
            ? 'Inventory deducted successfully'
            : 'Some items failed to deduct'
        });

      case 'lock': {
        const { userId, userName } = body;
        if (!userId || !userName) {
          return NextResponse.json(
            { error: 'userId and userName are required' },
            { status: 400 }
          );
        }
        breakdown = await breakdownService.lockBreakdown(breakdownId, userId, userName);
        break;
      }

      case 'unlock': {
        const { userId: unlockUserId } = body;
        if (!unlockUserId) {
          return NextResponse.json(
            { error: 'userId is required' },
            { status: 400 }
          );
        }
        breakdown = await breakdownService.unlockBreakdown(breakdownId, unlockUserId);
        break;
      }

      case 'submitForApproval': {
        const { submittedBy, submittedByName } = body;
        if (!submittedBy || !submittedByName) {
          return NextResponse.json(
            { error: 'submittedBy and submittedByName are required' },
            { status: 400 }
          );
        }
        breakdown = await breakdownService.submitForApproval(breakdownId, submittedBy, submittedByName);
        break;
      }

      case 'approve': {
        const { approvedBy, approvedByName } = body;
        if (!approvedBy || !approvedByName) {
          return NextResponse.json(
            { error: 'approvedBy and approvedByName are required' },
            { status: 400 }
          );
        }
        breakdown = await breakdownService.approveBreakdown(breakdownId, approvedBy, approvedByName);
        break;
      }

      case 'reject': {
        const { rejectedBy, rejectedByName, reason: rejectReason } = body;
        if (!rejectedBy || !rejectedByName || !rejectReason) {
          return NextResponse.json(
            { error: 'rejectedBy, rejectedByName, and reason are required' },
            { status: 400 }
          );
        }
        breakdown = await breakdownService.rejectBreakdown(breakdownId, rejectedBy, rejectedByName, rejectReason);
        break;
      }

      default:
        return NextResponse.json(
          { error: 'Invalid action. Must be one of: addMaterial, addCustomMaterial, removeMaterial, addLabor, removeLabor, applyDiscount, deductInventory, lock, unlock, submitForApproval, approve, reject' },
          { status: 400 }
        );
    }

    if (!breakdown) {
      return NextResponse.json(
        { error: 'Breakdown not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      breakdown,
      message: `${action} completed successfully`
    });
  } catch (error: any) {
    console.error('Error updating breakdown:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to update breakdown' },
      { status: 500 }
    );
  }
}
