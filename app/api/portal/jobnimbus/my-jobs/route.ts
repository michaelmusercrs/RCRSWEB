// GET /api/portal/jobnimbus/my-jobs
// Returns JobNimbus jobs filtered by the logged-in user's rep name

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
    const limit = parseInt(searchParams.get('limit') || '200');
    const statusFilter = searchParams.get('status');

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

    // For owners/admins, optionally filter by a specific rep
    const repFilter = searchParams.get('rep');
    let repName = currentUser.name;

    if (repFilter && (auth.user.role === 'owner' || auth.user.role === 'admin')) {
      const targetMember = TEAM_MEMBERS.find(
        m => m.slug === repFilter || m.id === repFilter || m.name.toLowerCase() === repFilter.toLowerCase()
      );
      if (targetMember) {
        repName = targetMember.name;
      }
    }

    let jobs = await jnSyncEngine.getJobsForRep(repName, limit);

    // Apply status filter if provided
    if (statusFilter) {
      jobs = jobs.filter(j =>
        j.status.toLowerCase() === statusFilter.toLowerCase()
      );
    }

    return NextResponse.json({
      success: true,
      repName,
      repSlug: currentUser.slug,
      count: jobs.length,
      jobs,
    });
  } catch (error) {
    console.error('Error fetching rep jobs:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch jobs',
      },
      { status: 500 }
    );
  }
}
