// GET /api/portal/jobnimbus/my-contacts
// Returns JobNimbus contacts filtered by the logged-in user's rep name

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
    const limit = parseInt(searchParams.get('limit') || '1000');

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

    const contacts = await jnSyncEngine.getContactsForRep(repName, limit);

    return NextResponse.json({
      success: true,
      repName,
      repSlug: currentUser.slug,
      count: contacts.length,
      contacts,
    });
  } catch (error) {
    console.error('Error fetching rep contacts:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch contacts',
      },
      { status: 500 }
    );
  }
}
