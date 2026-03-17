import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth-service';
import { checkRequestSize } from '@/lib/request-size-limit';
import { inventoryReconciliationService } from '@/lib/inventory-reconciliation-service';
import { unifiedInventoryService } from '@/lib/unified-inventory-service';

/**
 * GET /api/portal/inventory/reconciliation
 *
 * Returns the reconciliation report. If ?jobId= is provided, returns
 * reconciliation for that specific job. Otherwise returns the full report
 * across all active jobs.
 *
 * Query params:
 *   - jobId: optional, reconcile a specific job
 *   - stored: if "true", return the last stored reconciliation from Google Sheets
 */
export async function GET(request: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.authenticated) return auth.response;

  try {
    const { searchParams } = new URL(request.url);
    // Ensure inventory is loaded
    await unifiedInventoryService.ensureLoaded();

    const jobId = searchParams.get('jobId');
    const stored = searchParams.get('stored');

    // Return stored reconciliation from Google Sheets
    if (stored === 'true') {
      const storedData = await inventoryReconciliationService.getStoredReconciliation();
      return NextResponse.json({
        success: true,
        source: 'stored',
        jobs: storedData,
        count: storedData.length,
      });
    }

    // Reconcile a single job
    if (jobId) {
      const result = await inventoryReconciliationService.reconcileJob(jobId);
      if (!result) {
        return NextResponse.json(
          { success: false, error: `No breakdown found for job: ${jobId}` },
          { status: 404 }
        );
      }
      return NextResponse.json({
        success: true,
        job: result,
      });
    }

    // Full reconciliation report
    const report = await inventoryReconciliationService.getReconciliationReport();
    return NextResponse.json({
      success: true,
      report,
    });
  } catch (error) {
    console.error('Reconciliation GET error:', error);
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 }
    );
  }
}

/**
 * POST /api/portal/inventory/reconciliation
 *
 * Triggers a full reconciliation run and syncs results to Google Sheets.
 *
 * Body (optional):
 *   - jobId: if provided, only reconcile that job
 *   - syncToSheets: boolean, default true - whether to write results to Google Sheets
 */
export async function POST(request: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.authenticated) return auth.response;

  // SECURITY: Enforce request body size limit
  const sizeError = checkRequestSize(request, '100kb');
  if (sizeError) return sizeError;

  try {
    let body: { jobId?: string; syncToSheets?: boolean } = {};
    try {
      body = await request.json();
    } catch {
      // No body provided, use defaults
    }

    const syncToSheets = body.syncToSheets !== false;

    // Run full reconciliation
    const report = await inventoryReconciliationService.getReconciliationReport();

    // Sync to Google Sheets if requested
    let sheetsResult = null;
    if (syncToSheets) {
      sheetsResult = await inventoryReconciliationService.syncToGoogleSheets();
    }

    return NextResponse.json({
      success: true,
      report,
      sheetsSync: sheetsResult,
    });
  } catch (error) {
    console.error('Reconciliation POST error:', error);
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 }
    );
  }
}
