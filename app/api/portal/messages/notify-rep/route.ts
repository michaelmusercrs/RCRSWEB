/**
 * Portal Messaging — Notify Individual Rep
 *
 * POST /api/portal/messages/notify-rep
 *
 * Body: { repSlug, title, message, details? }
 *
 * Sends a high-priority direct message to a single rep's GroupMe DM —
 * NOT to a group. Restricted to owner/admin/manager/office. Routes
 * through portal-messaging-service so master kill-switch + quiet-hours
 * guards apply. Explicit user click only; no automatic invocation.
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireRoleAtLeast } from '@/lib/auth-service';
import {
  notifyIndividualRep,
  resolveRepGroupMeUserId,
} from '@/lib/portal-messaging-service';

const NOTIFY_REP_ROLES = ['owner', 'admin', 'manager', 'office'];

export async function POST(request: NextRequest) {
  const auth = await requireRoleAtLeast(NOTIFY_REP_ROLES);
  if (!auth.authenticated) return auth.response;

  let body: {
    repSlug?: string;
    title?: string;
    message?: string;
    details?: Record<string, string | number | boolean>;
  } = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON body' }, { status: 400 });
  }

  if (!body.repSlug || !body.title || !body.message) {
    return NextResponse.json(
      { success: false, error: 'repSlug, title, and message are required' },
      { status: 400 },
    );
  }

  // Resolve repSlug -> GroupMe user_id. If this fails, surface a clear
  // error so the operator can backfill the mapping.
  const resolved = await resolveRepGroupMeUserId(body.repSlug);
  if (!resolved.userId) {
    return NextResponse.json(
      {
        success: false,
        error: resolved.error || `Could not resolve GroupMe user for rep "${body.repSlug}"`,
        needsOwner: true,
      },
      { status: 422 },
    );
  }

  const result = await notifyIndividualRep({
    repSlug: body.repSlug,
    repGroupMeUserId: resolved.userId,
    fromUserId: auth.user.userId,
    fromUserName: auth.user.name,
    title: body.title,
    message: body.message,
    details: body.details,
  });

  if (!result.ok) {
    if (result.skipped) {
      return NextResponse.json(
        { success: false, skipped: true, reason: result.reason, error: result.error },
        { status: 202 },
      );
    }
    return NextResponse.json(
      { success: false, error: result.error || 'Notification failed' },
      { status: 500 },
    );
  }

  return NextResponse.json({
    success: true,
    resolvedTo: { userId: resolved.userId, nickname: resolved.nickname },
    data: result.data,
  });
}
