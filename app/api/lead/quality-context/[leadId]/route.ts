/**
 * Lead Quality — Sales Rep "Unconfirmed Intelligence" view (BETA)
 *
 * GET /api/lead/quality-context/[leadId]
 *
 * Returns the *raw inputs* that fed the quality model — hail recon summary,
 * source historical context, area context, returning-customer flag,
 * commercial flag, date-of-loss signal. EXPLICITLY OMITS the score, the
 * band, the weights, and the factor contributions.
 *
 * Sales reps see this as "unconfirmed preliminary intelligence" — useful
 * context for working the lead, without revealing the model's verdict.
 *
 * Roles allowed: sales, owner, admin, office, manager.
 * Roles denied: customer (never has access to lead context regardless).
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireRoleAtLeast } from '@/lib/auth-service';
import { googleSheetsService } from '@/lib/google-sheets-service';
import { repSafeUnconfirmedContext, type LeadQualityFactors, type LeadQualityResult } from '@/lib/lead-quality-service';

export async function GET(
  _request: NextRequest,
  { params }: { params: { leadId: string } }
) {
  const auth = await requireRoleAtLeast(['owner', 'admin', 'office', 'manager', 'sales']);
  if (!auth.authenticated) return auth.response;

  const leadId = params.leadId;
  if (!leadId) {
    return NextResponse.json({ success: false, error: 'leadId required' }, { status: 400 });
  }

  try {
    const logs = await googleSheetsService.getDistributionLogs({ limit: 5000 });
    const row = logs.find(l => l.leadId === leadId);
    if (!row || !row.leadQualityFactors) {
      return NextResponse.json({
        success: true,
        hasContext: false,
        isBeta: true,
        message: 'No preliminary intelligence has been generated for this lead.',
      });
    }

    let factors: LeadQualityFactors;
    try {
      factors = JSON.parse(row.leadQualityFactors);
    } catch {
      return NextResponse.json({
        success: true,
        hasContext: false,
        isBeta: true,
        message: 'Could not parse preliminary intelligence for this lead.',
      });
    }

    // Reconstruct a minimal LeadQualityResult shape for the redactor.
    // We DO NOT pass score, contributions, or band — those are admin-only.
    const synthetic: LeadQualityResult = {
      score: 0, // not exposed
      band: 'low', // not exposed
      factors,
      factorContributions: {}, // not exposed
      confidence: (row.leadQualityConfidence as LeadQualityResult['confidence']) || 'preliminary',
      isBeta: true,
      computedAt: row.leadQualityComputedAt,
      unconfirmedNotes: [],
    };
    // Re-derive the user-friendly notes from the factors themselves so reps
    // get the same explanations admins do, minus the actual score.
    if (factors.hailEventCountNearby > 0) {
      synthetic.unconfirmedNotes.push(
        `${factors.hailEventCountNearby} hail event(s) detected within 25mi over the last 12mo${
          factors.hailLargestSizeInches > 0 ? `; largest ${factors.hailLargestSizeInches}"` : ''
        }${
          factors.hailMostRecentDays != null ? `; most recent ${factors.hailMostRecentDays}d ago` : ''
        }.`
      );
    }
    if (factors.dateOfLossWithinYear) {
      synthetic.unconfirmedNotes.push('Lead has a Date of Loss within the last 12 months — insurance opportunity.');
    }
    if (factors.sourceName) {
      synthetic.unconfirmedNotes.push(
        `Source: ${factors.sourceName}${
          factors.sourceCloseRateBasis === 'derived'
            ? ` — historical close rate ${(factors.sourceHistoricalCloseRate * 100).toFixed(0)}% (from ${factors.sourceSampleSize} prior jobs).`
            : ` — close rate estimate ${(factors.sourceHistoricalCloseRate * 100).toFixed(0)}% (limited data; preliminary).`
        }`
      );
    }
    if (factors.areaName) {
      synthetic.unconfirmedNotes.push(
        `${factors.areaName} historical close rate: ${(factors.areaHistoricalCloseRate * 100).toFixed(0)}%${
          factors.areaCloseRateBasis === 'derived' ? ` (from ${factors.areaSampleSize} prior local jobs)` : ' (regional prior)'
        }.`
      );
    }
    if (factors.isReturningCustomer) {
      synthetic.unconfirmedNotes.push('Returning customer — has a prior closed job in our system.');
    }
    if (factors.isCommercial) {
      synthetic.unconfirmedNotes.push('Commercial / company lead.');
    }

    const safe = repSafeUnconfirmedContext(synthetic);

    return NextResponse.json({
      success: true,
      hasContext: true,
      leadId,
      label: 'Unconfirmed preliminary intelligence',
      caveat: 'These notes are auto-generated from outside data sources. Verify with the customer before relying on them.',
      ...safe, // includes isBeta:true plus unconfirmedNotes + preliminaryFactsForDisclosure
    });
  } catch (err) {
    return NextResponse.json({
      success: false,
      error: err instanceof Error ? err.message : 'Failed to read quality context',
    }, { status: 500 });
  }
}
