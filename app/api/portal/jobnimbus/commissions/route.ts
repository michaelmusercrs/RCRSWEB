// GET /api/portal/jobnimbus/commissions
// Commission integration with real JN data:
// - Pull job values from JN
// - Calculate commissions based on job type and rep tier
// - Show earned vs pending vs paid
// - Historical commission data

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
    // Find the current user
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
    const { searchParams } = new URL(request.url);
    const repFilter = searchParams.get('rep');
    let repName = currentUser.name;
    let repSlug = currentUser.slug;

    if (repFilter && (auth.user.role === 'owner' || auth.user.role === 'admin')) {
      const targetMember = TEAM_MEMBERS.find(
        m => m.slug === repFilter || m.id === repFilter
      );
      if (targetMember) {
        repName = targetMember.name;
        repSlug = targetMember.slug;
      }
    }

    const commissions = await jnSyncEngine.getRepCommissions(repName, repSlug);

    return NextResponse.json({
      success: true,
      commissions,
    });
  } catch (error) {
    console.error('Error fetching commissions:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch commissions',
      },
      { status: 500 }
    );
  }
}
