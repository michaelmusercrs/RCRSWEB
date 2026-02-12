// GET /api/portal/jobnimbus/metrics
// Real sales data per rep from JobNimbus:
// - Total jobs by status
// - Revenue from JN jobs
// - Win/loss ratio
// - Average job value
// - Comparison: rep vs team average
// - Trends: monthly job count, revenue trend

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-service';
import { isJobNimbusConfigured } from '@/lib/jobnimbus-service';
import { jnSyncEngine } from '@/lib/jn-sync-engine';
import { TEAM_MEMBERS } from '@/lib/team-roles';

export async function GET(request: NextRequest) {
  const auth = await requireAuth();
  if (!auth.authenticated) return auth.response;

  if (!isJobNimbusConfigured()) {
    return NextResponse.json(
      { success: false, error: 'JobNimbus API not configured' },
      { status: 500 }
    );
  }

  try {
    const { searchParams } = new URL(request.url);
    const periodMonths = parseInt(searchParams.get('period') || '12');

    // Find the current user's team member record
    const currentUser = TEAM_MEMBERS.find(
      m => m.id === auth.user.userId || m.email === auth.user.email
    );

    if (!currentUser) {
      return NextResponse.json(
        { success: false, error: 'Team member not found' },
        { status: 404 }
      );
    }

    // For owners/admins, optionally view a specific rep
    const repFilter = searchParams.get('rep');
    let repName = currentUser.name;

    if (repFilter && (auth.user.role === 'owner' || auth.user.role === 'admin')) {
      const targetMember = TEAM_MEMBERS.find(
        m => m.slug === repFilter || m.id === repFilter
      );
      if (targetMember) {
        repName = targetMember.name;
      }
    }

    const metrics = await jnSyncEngine.getRepSalesMetrics(repName, periodMonths);

    return NextResponse.json({
      success: true,
      repName,
      repSlug: currentUser.slug,
      periodMonths,
      metrics,
    });
  } catch (error) {
    console.error('Error fetching metrics:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch metrics',
      },
      { status: 500 }
    );
  }
}
