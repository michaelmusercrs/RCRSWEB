/**
 * Lead Quality — Admin / Manager view (BETA)
 *
 * GET /api/admin/lead-distro/quality/[leadId]
 *
 * Returns the full LeadQualityResult — score, band, factors, contributions —
 * for owner/admin/manager roles. Sales reps and customers must NEVER hit
 * this endpoint. The rep-safe context lives at
 * /api/lead/quality-context/[leadId].
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireRoleAtLeast } from '@/lib/auth-service';
import { googleSheetsService } from '@/lib/google-sheets-service';

export async function GET(
  _request: NextRequest,
  { params }: { params: { leadId: string } }
) {
  // Owner, admin, manager only. Reps + office + customer are deliberately
  // excluded from seeing the score.
  const auth = await requireRoleAtLeast(['owner', 'admin', 'manager']);
  if (!auth.authenticated) return auth.response;

  const leadId = params.leadId;
  if (!leadId) {
    return NextResponse.json({ success: false, error: 'leadId required' }, { status: 400 });
  }

  try {
    const logs = await googleSheetsService.getDistributionLogs({ limit: 5000 });
    const row = logs.find(l => l.leadId === leadId);
    if (!row) {
      return NextResponse.json({
        success: true,
        hasQuality: false,
        message: 'No distribution log entry found for this lead.',
      });
    }

    if (!row.leadQualityScore) {
      return NextResponse.json({
        success: true,
        hasQuality: false,
        message: 'This lead was assigned before the BETA quality engine shipped, or the compute failed.',
      });
    }

    let factors: any = {};
    let contributions: any = {};
    try { factors = JSON.parse(row.leadQualityFactors || '{}'); } catch { /* ignore */ }
    try { contributions = JSON.parse(row.leadQualityContributions || '{}'); } catch { /* ignore */ }

    return NextResponse.json({
      success: true,
      hasQuality: true,
      isBeta: true,
      leadId,
      logId: row.logId,
      score: parseInt(row.leadQualityScore, 10),
      band: row.leadQualityBand,
      factors,
      factorContributions: contributions,
      confidence: row.leadQualityConfidence,
      computedAt: row.leadQualityComputedAt,
      assignedRep: row.assignedRep,
      address: row.address,
      customerName: row.customerName,
    });
  } catch (err) {
    return NextResponse.json({
      success: false,
      error: err instanceof Error ? err.message : 'Failed to read quality data',
    }, { status: 500 });
  }
}
