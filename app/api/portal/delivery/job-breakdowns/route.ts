import { NextRequest, NextResponse } from 'next/server';
import { requireRoleAtLeast } from '@/lib/auth-service';
import {
  jobBreakdownService,
  type BreakdownStatus,
  type ProjectType,
} from '@/lib/job-breakdown-service';

// ── GET - List breakdowns with optional filtering ─────────────────────────

export async function GET(request: NextRequest) {
  // SECURITY 2026-05-20: job-breakdown records expose unitCost, materialCost,
  // labor cost, and per-job profit — owner/admin/office/manager tier only
  // per cost-visibility rule. Richard ('driver') allowed by slug.
  const auth = await requireRoleAtLeast(['owner', 'admin', 'office', 'manager']);
  if (!auth.authenticated) return auth.response;

  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') as BreakdownStatus | null;
    const projectType = searchParams.get('projectType') as ProjectType | null;
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');
    const search = searchParams.get('search');
    const jobId = searchParams.get('jobId');
    const id = searchParams.get('id');

    // Get single breakdown by ID
    if (id) {
      const breakdown = await jobBreakdownService.getBreakdown(id);
      if (!breakdown) {
        return NextResponse.json({ success: false, error: 'Breakdown not found' }, { status: 404 });
      }
      return NextResponse.json({ success: true, data: breakdown });
    }

    // Get breakdowns for a specific job
    if (jobId) {
      const breakdowns = await jobBreakdownService.getBreakdownsByJob(jobId);
      return NextResponse.json({ success: true, count: breakdowns.length, data: breakdowns });
    }

    // Get statistics
    if (searchParams.get('stats') === 'true') {
      const stats = await jobBreakdownService.getStatistics();
      return NextResponse.json({ success: true, data: stats });
    }

    // List with filters
    const breakdowns = await jobBreakdownService.getAllBreakdowns({
      status: status || undefined,
      projectType: projectType || undefined,
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined,
      search: search || undefined,
    });

    return NextResponse.json({
      success: true,
      count: breakdowns.length,
      data: breakdowns,
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

// ── POST - Actions on breakdowns ──────────────────────────────────────────

export async function POST(request: NextRequest) {
  // SECURITY 2026-05-20: create/update/approve/revise breakdowns containing
  // cost + profit data — owner/admin/office/manager tier only per cost-
  // visibility rule. Richard ('driver') allowed by slug.
  const auth = await requireRoleAtLeast(['owner', 'admin', 'office', 'manager']);
  if (!auth.authenticated) return auth.response;

  try {
    const body = await request.json();
    const { action } = body;

    switch (action) {
      // ── Create new breakdown ──────────────────────────────────────
      case 'create': {
        const { jobId, jobName, customerName, address, projectType, materials, labor, notes, estimatedStartDate, estimatedEndDate } = body;

        if (!jobId || !jobName || !customerName || !address || !projectType) {
          return NextResponse.json(
            { success: false, error: 'Missing required fields: jobId, jobName, customerName, address, projectType' },
            { status: 400 }
          );
        }

        const breakdown = await jobBreakdownService.createBreakdown({
          jobId,
          jobName,
          customerName,
          address,
          projectType,
          materials,
          labor,
          notes,
          estimatedStartDate,
          estimatedEndDate,
          createdBy: auth.user.name || 'System',
        });

        return NextResponse.json({ success: true, data: breakdown }, { status: 201 });
      }

      // ── Update existing breakdown ─────────────────────────────────
      case 'update': {
        const { breakdownId, updates } = body;
        if (!breakdownId || !updates) {
          return NextResponse.json(
            { success: false, error: 'Missing breakdownId or updates' },
            { status: 400 }
          );
        }

        const updated = await jobBreakdownService.updateBreakdown(breakdownId, updates);
        if (!updated) {
          return NextResponse.json(
            { success: false, error: 'Breakdown not found' },
            { status: 404 }
          );
        }

        return NextResponse.json({ success: true, data: updated });
      }

      // ── Approve breakdown ─────────────────────────────────────────
      case 'approve': {
        const { breakdownId: approveId } = body;
        if (!approveId) {
          return NextResponse.json(
            { success: false, error: 'Missing breakdownId' },
            { status: 400 }
          );
        }

        const approved = await jobBreakdownService.approveBreakdown(approveId, auth.user.name || 'System');
        if (!approved) {
          return NextResponse.json(
            { success: false, error: 'Breakdown not found or not in pending_approval status' },
            { status: 400 }
          );
        }

        return NextResponse.json({ success: true, data: approved });
      }

      // ── Revise breakdown ──────────────────────────────────────────
      case 'revise': {
        const { breakdownId: reviseId, materials: revisedMaterials, labor: revisedLabor, notes: revisedNotes, revisionNotes } = body;
        if (!reviseId) {
          return NextResponse.json(
            { success: false, error: 'Missing breakdownId' },
            { status: 400 }
          );
        }

        const revised = await jobBreakdownService.reviseBreakdown(reviseId, {
          materials: revisedMaterials,
          labor: revisedLabor,
          notes: revisedNotes,
          revisedBy: auth.user.name || 'System',
          revisionNotes: revisionNotes || 'Revision submitted',
        });
        if (!revised) {
          return NextResponse.json(
            { success: false, error: 'Breakdown not found' },
            { status: 404 }
          );
        }

        return NextResponse.json({ success: true, data: revised });
      }

      // ── Generate material list ────────────────────────────────────
      case 'generate-materials': {
        const { projectType: genType, measurements } = body;
        if (!genType || !measurements) {
          return NextResponse.json(
            { success: false, error: 'Missing projectType or measurements' },
            { status: 400 }
          );
        }

        const materials = jobBreakdownService.generateMaterialList(genType, measurements);
        return NextResponse.json({ success: true, data: materials });
      }

      // ── Generate delivery schedule ────────────────────────────────
      case 'generate-deliveries': {
        const { breakdownId: deliveryBdId } = body;
        if (!deliveryBdId) {
          return NextResponse.json(
            { success: false, error: 'Missing breakdownId' },
            { status: 400 }
          );
        }

        const breakdown = await jobBreakdownService.getBreakdown(deliveryBdId);
        if (!breakdown) {
          return NextResponse.json(
            { success: false, error: 'Breakdown not found' },
            { status: 404 }
          );
        }

        const deliveries = jobBreakdownService.generateDeliverySchedule(breakdown);
        return NextResponse.json({ success: true, data: deliveries });
      }

      // ── Calculate costs ───────────────────────────────────────────
      case 'calculate-costs': {
        const { breakdownId: calcId } = body;
        if (!calcId) {
          return NextResponse.json(
            { success: false, error: 'Missing breakdownId' },
            { status: 400 }
          );
        }

        const bd = await jobBreakdownService.getBreakdown(calcId);
        if (!bd) {
          return NextResponse.json(
            { success: false, error: 'Breakdown not found' },
            { status: 404 }
          );
        }

        const calculated = jobBreakdownService.calculateCosts(bd);
        return NextResponse.json({
          success: true,
          data: {
            materialTotal: calculated.materialTotal,
            laborTotal: calculated.laborTotal,
            deliveryFees: calculated.deliveryFees,
            overhead: calculated.overhead,
            profit: calculated.profit,
            totalEstimate: calculated.totalEstimate,
          },
        });
      }

      // ── Update status ─────────────────────────────────────────────
      case 'update-status': {
        const { breakdownId: statusBdId, status, notes: statusNotes } = body;
        if (!statusBdId || !status) {
          return NextResponse.json(
            { success: false, error: 'Missing breakdownId or status' },
            { status: 400 }
          );
        }

        const updated = await jobBreakdownService.updateStatus(
          statusBdId,
          status,
          auth.user.name || 'System',
          statusNotes || ''
        );
        if (!updated) {
          return NextResponse.json(
            { success: false, error: 'Breakdown not found' },
            { status: 404 }
          );
        }

        return NextResponse.json({ success: true, data: updated });
      }

      // ── Compare two breakdowns ────────────────────────────────────
      case 'compare': {
        const { breakdownId1, breakdownId2 } = body;
        if (!breakdownId1 || !breakdownId2) {
          return NextResponse.json(
            { success: false, error: 'Missing breakdownId1 or breakdownId2' },
            { status: 400 }
          );
        }

        const comparisons = await jobBreakdownService.compareBreakdowns(breakdownId1, breakdownId2);
        if (!comparisons) {
          return NextResponse.json(
            { success: false, error: 'One or both breakdowns not found' },
            { status: 404 }
          );
        }

        return NextResponse.json({ success: true, data: comparisons });
      }

      // ── Fetch JN jobs for breakdown import ───────────────────
      case 'fetch-jn-jobs': {
        const { status: jnStatus, limit: jnLimit } = body;
        const jobs = await jobBreakdownService.fetchJNJobsForBreakdown({ status: jnStatus, limit: jnLimit });
        return NextResponse.json({ success: true, jobs });
      }

      // ── Fetch JN job detail for pre-population ──────────────
      case 'fetch-jn-job-detail': {
        const { jnid } = body;
        if (!jnid) {
          return NextResponse.json(
            { success: false, error: 'jnid required' },
            { status: 400 }
          );
        }
        const detail = await jobBreakdownService.fetchJNJobForBreakdown(jnid);
        return NextResponse.json({ success: true, ...detail });
      }

      // ── Create breakdown from JN job data ───────────────────
      case 'create-from-jn': {
        const { jnData } = body;
        if (!jnData) {
          return NextResponse.json(
            { success: false, error: 'jnData required' },
            { status: 400 }
          );
        }
        const breakdown = await jobBreakdownService.createBreakdownFromJNJob(jnData);
        return NextResponse.json({ success: true, data: breakdown });
      }

      default:
        return NextResponse.json(
          { success: false, error: `Unknown action: ${action}. Valid actions: create, update, approve, revise, generate-materials, generate-deliveries, calculate-costs, update-status, compare, fetch-jn-jobs, fetch-jn-job-detail, create-from-jn` },
          { status: 400 }
        );
    }
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
