/**
 * Portal Messaging — Direct Messages (peer-to-peer)
 *
 * GET  /api/portal/messages/dms?userId=<groupme_user_id>   — fetch DM thread
 * POST /api/portal/messages/dms                            — send a DM
 *
 * GET: returns a single thread's messages (GroupMe's REST API only
 *      surfaces DM history when scoped by the other user's groupme id).
 *      DM history is limited to owner/admin/manager/office because all
 *      DMs are seen from the company GroupMe account's perspective.
 *
 * POST: explicit user click. Routes through portal-messaging-service so
 *       the master kill-switch + quiet-hours guards apply.
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, requireRoleAtLeast } from '@/lib/auth-service';
import {
  listMessages,
  sendDirectMessage,
} from '@/lib/portal-messaging-service';

const DM_VIEW_ROLES = ['owner', 'admin', 'manager', 'office'];

export async function GET(request: NextRequest) {
  // DM history exposes all conversations from the company account — keep
  // it scoped to the elevated roles.
  const auth = await requireRoleAtLeast(DM_VIEW_ROLES);
  if (!auth.authenticated) return auth.response;

  const { searchParams } = new URL(request.url);
  const userId = searchParams.get('userId');
  const before = searchParams.get('before') || undefined;
  const since = searchParams.get('since') || undefined;
  const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!, 10) : undefined;

  if (!userId) {
    return NextResponse.json(
      { success: false, error: 'userId (groupme user_id) is required' },
      { status: 400 },
    );
  }

  const result = await listMessages({
    conversationId: userId,
    kind: 'dm',
    limit,
    before,
    since,
  });

  if (!result.ok) {
    return NextResponse.json(
      { success: false, error: result.error || 'Failed to fetch DM thread' },
      { status: 500 },
    );
  }

  return NextResponse.json({ success: true, messages: result.messages });
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth();
  if (!auth.authenticated) return auth.response;

  let body: { toUserId?: string; body?: string } = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON body' }, { status: 400 });
  }

  if (!body.toUserId || !body.body) {
    return NextResponse.json(
      { success: false, error: 'toUserId and body are required' },
      { status: 400 },
    );
  }

  const result = await sendDirectMessage({
    toUserId: body.toUserId,
    fromUserId: auth.user.userId,
    fromUserName: auth.user.name,
    body: body.body,
  });

  if (!result.ok) {
    if (result.skipped) {
      return NextResponse.json(
        { success: false, skipped: true, reason: result.reason, error: result.error },
        { status: 202 },
      );
    }
    return NextResponse.json(
      { success: false, error: result.error || 'Send failed' },
      { status: 500 },
    );
  }

  return NextResponse.json({ success: true, data: result.data });
}
