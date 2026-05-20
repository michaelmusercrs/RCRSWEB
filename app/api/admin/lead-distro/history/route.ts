// Lead Distribution History API
// GET: Get recent distribution logs

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth-service';
import { leadDistributionService } from '@/lib/lead-distribution-service';

// SECURITY 2026-05-20: was requireAuth (any logged-in user could read
// distribution history including reps). Lead-distro logs reveal which rep
// got which lead and why — sales-rep-visible data. Tightened to requireAdmin.
export async function GET(request: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.authenticated) return auth.response;

  try {
    const { searchParams } = new URL(request.url);
    const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : 50;
    const rep = searchParams.get('rep') || undefined;

    const history = await leadDistributionService.getDistributionHistory(limit, rep);

    return NextResponse.json({
      success: true,
      count: history.length,
      data: history,
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
