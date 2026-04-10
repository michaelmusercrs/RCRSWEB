/**
 * Profitability Detail API — /api/profitability/[jobId]
 *
 * GET:   Get job cost details
 * PATCH: Update costs (add items, update revenue, change status)
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-service';
import { profitabilityService } from '@/lib/profitability-service';

export const dynamic = 'force-dynamic';

/**
 * GET /api/profitability/[jobId]
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { jobId: string } }
) {
  try {
    const jobCost = await profitabilityService.getJobCost(params.jobId);
    if (!jobCost) {
      return NextResponse.json(
        { error: 'Job cost entry not found' },
        { status: 404 }
      );
    }

    const profitability = await profitabilityService.calculateProfitability(params.jobId);

    return NextResponse.json({
      jobCost,
      profitability,
    });
  } catch (error: any) {
    console.error('[API] GET /api/profitability/[jobId] error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch job cost' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/profitability/[jobId]
 *
 * Body options:
 *  - { action: 'addCost', category, item: { description, quantity, unitCost, ... } }
 *  - { action: 'removeCost', costItemId }
 *  - { action: 'update', updates: { contractAmount?, status?, notes?, ... } }
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { jobId: string } }
) {
  try {
    const auth = await requireAuth();
    if (!auth.authenticated) return auth.response;

    const body = await request.json();
    const { action } = body;

    if (!action) {
      return NextResponse.json(
        { error: 'Missing required field: action' },
        { status: 400 }
      );
    }

    const jobId = params.jobId;

    switch (action) {
      case 'addCost': {
        const { category, item } = body;
        if (!category || !item) {
          return NextResponse.json(
            { error: 'Missing required fields: category, item' },
            { status: 400 }
          );
        }

        const validCategories = [
          'materials',
          'labor',
          'subcontractors',
          'overhead',
          'other',
        ];
        if (!validCategories.includes(category)) {
          return NextResponse.json(
            { error: `Invalid category. Must be one of: ${validCategories.join(', ')}` },
            { status: 400 }
          );
        }

        const costItem = await profitabilityService.addCostItem(jobId, category, {
          description: item.description,
          category: item.category || category,
          quantity: Number(item.quantity),
          unitCost: Number(item.unitCost),
          vendor: item.vendor,
          invoiceNumber: item.invoiceNumber,
          date: item.date,
        });

        const jobCost = await profitabilityService.getJobCost(jobId);
        return NextResponse.json({ costItem, jobCost });
      }

      case 'removeCost': {
        const { costItemId } = body;
        if (!costItemId) {
          return NextResponse.json(
            { error: 'Missing required field: costItemId' },
            { status: 400 }
          );
        }

        await profitabilityService.removeCostItem(jobId, costItemId);
        const jobCost = await profitabilityService.getJobCost(jobId);
        return NextResponse.json({ jobCost });
      }

      case 'update': {
        const { updates } = body;
        if (!updates) {
          return NextResponse.json(
            { error: 'Missing required field: updates' },
            { status: 400 }
          );
        }

        const jobCost = await profitabilityService.updateJobCost(jobId, updates);
        return NextResponse.json({ jobCost });
      }

      default:
        return NextResponse.json(
          { error: `Unknown action: ${action}` },
          { status: 400 }
        );
    }
  } catch (error: any) {
    console.error('[API] PATCH /api/profitability/[jobId] error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to update job cost' },
      { status: 500 }
    );
  }
}
