/**
 * Number Sessions API Route
 *
 * GET    - Fetch sessions for a rep (by repEmail) or all sessions (admin, allReps=true).
 *          Optional week filter. Returns sorted by sessionTimestamp desc.
 * DELETE - Delete a specific session by id (admin only). Requires `id` in body.
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, requireAdmin } from '@/lib/auth-service';
import { googleSheetsService } from '@/lib/google-sheets-service';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// ─── GET ────────────────────────────────────────────────────────────────────
export async function GET(request: NextRequest) {
  const auth = await requireAuth();
  if (!auth.authenticated) return auth.response;

  try {
    const { searchParams } = new URL(request.url);
    const repEmail = searchParams.get('repEmail') || auth.user.email;
    const week = searchParams.get('week') || undefined;
    const allReps = searchParams.get('allReps') === 'true';
    const limit = parseInt(searchParams.get('limit') || '100') || 100;

    const isAdmin = auth.user.role === 'admin' || auth.user.role === 'owner';

    // Non-admins can only see their own sessions
    const emailFilter = (allReps && isAdmin) ? undefined : repEmail;

    const sessions = await googleSheetsService.getNumberSessions({
      repEmail: emailFilter,
      week,
      limit,
    });

    return NextResponse.json({
      success: true,
      sessions,
      total: sessions.length,
    });
  } catch (error) {
    console.error('Error fetching number sessions:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch sessions' },
      { status: 500 },
    );
  }
}

// ─── DELETE ─────────────────────────────────────────────────────────────────
export async function DELETE(request: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.authenticated) return auth.response;

  try {
    const body = await request.json();
    const { id } = body;

    if (!id || typeof id !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Session id is required' },
        { status: 400 },
      );
    }

    const deleted = await googleSheetsService.deleteNumberSession(id);

    if (!deleted) {
      return NextResponse.json(
        { success: false, error: 'Session not found' },
        { status: 404 },
      );
    }

    // Log the deletion to audit log
    googleSheetsService.appendToAuditLog({
      action: 'NUMBER_SESSION_DELETED',
      userEmail: auth.user.email,
      details: `Admin ${auth.user.name} deleted number session ${id}`,
      userAgent: 'sessions-api',
    }).catch(err => {
      console.error('[Sessions] AuditLog failed:', err);
    });

    return NextResponse.json({ success: true, message: 'Session deleted' });
  } catch (error) {
    console.error('Error deleting number session:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete session' },
      { status: 500 },
    );
  }
}
