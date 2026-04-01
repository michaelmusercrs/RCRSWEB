// Lead Distribution / Redistribution API
// POST: Manually distribute or redistribute a lead

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-service';
import { auditLog } from '@/lib/audit-logger';
import { leadDistributionService } from '@/lib/lead-distribution-service';
import { leadPortalService } from '@/lib/lead-portal-service';

export async function POST(request: NextRequest) {
  const auth = await requireAuth();
  if (!auth.authenticated) return auth.response;

  try {
    const { leadId, address, customerName, source, referralRepSlug, overrideRepSlug } = await request.json();

    if (!address || !customerName) {
      return NextResponse.json(
        { success: false, error: 'address and customerName are required' },
        { status: 400 }
      );
    }

    const result = await leadDistributionService.distributeLead(
      address,
      customerName,
      leadId || `MANUAL-${Date.now()}`,
      source,
      referralRepSlug,
      overrideRepSlug
    );

    // If leadId provided and lead exists, update the assigned rep
    if (leadId) {
      const lead = await leadPortalService.getLeadByToken(leadId).catch(() => null);
      if (lead && result.assignedRep) {
        await leadPortalService.updateLeadStatus(lead.leadId, lead.status, result.assignedRep.repSlug);
      }
    }

    auditLog(
      'LEAD_DISTRIBUTE',
      auth.user.email,
      `Distributed lead ${leadId || 'manual'} for ${customerName} to ${result.assignedRep?.repName || 'no rep'} (method: ${result.method})${overrideRepSlug ? ' [override]' : ''}`,
      request
    );

    return NextResponse.json({
      success: true,
      data: {
        assignedRep: result.assignedRep ? {
          slug: result.assignedRep.repSlug,
          name: result.assignedRep.repName,
          score: result.assignedRep.totalScore,
        } : null,
        method: result.method,
        logId: result.logId,
        allScores: result.allScores.map(s => ({
          slug: s.repSlug,
          name: s.repName,
          score: s.totalScore,
          isEligible: s.isEligible,
          disqualifyReason: s.disqualifyReason,
          factors: s.factors,
        })),
      },
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
