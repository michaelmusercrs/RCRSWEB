/**
 * RCRS Google Sheets Health Check API
 * 
 * GET  /api/admin/sheets-health - Run health check on all connected sheets
 * POST /api/admin/sheets-health - Attempt auto-repair on a specific sheet
 * 
 * @author RCRS Development Team
 * @version 1.0.0
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth-service';
import { sheetsHealthService } from '@/lib/sheets-health-service';

/**
 * GET /api/admin/sheets-health
 * Returns health status for all monitored Google Sheets tabs
 */
export async function GET() {
  const auth = await requireAdmin();
  if (!auth.authenticated) return auth.response;

  try {
    const report = await sheetsHealthService.checkHealth();
    return NextResponse.json(report);
  } catch (error) {
    console.error('GET /api/admin/sheets-health error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Health check failed' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/sheets-health
 * Attempt auto-repair on a specific sheet
 * Body: { sheetName: string }
 */
export async function POST(request: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.authenticated) return auth.response;

  try {
    const body = await request.json();
    const { sheetName } = body;

    if (!sheetName) {
      return NextResponse.json({ error: 'sheetName is required' }, { status: 400 });
    }

    const results = await sheetsHealthService.attemptRepair(sheetName);
    const allSuccess = results.every(r => r.success);

    return NextResponse.json({
      success: allSuccess,
      sheetName,
      repairSteps: results,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('POST /api/admin/sheets-health error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Repair attempt failed' },
      { status: 500 }
    );
  }
}
