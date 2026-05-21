/**
 * Per-Rep Notification Preferences API
 *
 * GET  /api/portal/notifications-prefs
 *   Returns the authenticated rep's own preferences (defaults if none stored).
 *
 * PUT  /api/portal/notifications-prefs
 *   Updates the authenticated rep's own preferences. Body is the full
 *   preferences object minus repSlug/repName (server fills those in from
 *   the session). Defaults: every channel ON, every alert ON.
 *
 * Auth: requireAuth — reps can only modify their own prefs. There is no
 * cross-rep write surface here; admins use a separate /api/notifications/
 * preferences route for cascading defaults.
 *
 * The page never fires notifications — it only records the rep's choices
 * on the `Rep_Notification_Prefs` sheet tab (lazy-created). Choices are
 * honored once `GROUPME_FORCE_SEND=true` per the master guard.
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-service';
import { checkRequestSize } from '@/lib/request-size-limit';
import {
  defaultRepPrefs,
  getRepNotificationPrefs,
  saveRepNotificationPrefs,
  type RepNotificationPrefs,
} from '@/lib/rep-notification-prefs';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function ownSlug(user: { userId?: string; name?: string }): string {
  if (user.userId) {
    // Match how the existing notifications/preferences route derives the slug:
    // strip the RVR-NNN prefix some IDs carry, lowercase.
    return user.userId.toLowerCase().replace(/^rvr-\d+-?/i, '').trim();
  }
  if (user.name) return user.name.toLowerCase().replace(/\s+/g, '-');
  return '';
}

// ---------------------------------------------------------------------------
// GET — return the caller's own prefs (defaults if no row stored yet).
// ---------------------------------------------------------------------------

export async function GET() {
  const auth = await requireAuth();
  if (!auth.authenticated) return auth.response;

  const slug = ownSlug(auth.user);
  if (!slug) {
    return NextResponse.json(
      { success: false, error: 'Could not derive rep slug from session' },
      { status: 400 },
    );
  }

  const prefs = await getRepNotificationPrefs(slug, auth.user.name || slug);
  return NextResponse.json({ success: true, data: prefs });
}

// ---------------------------------------------------------------------------
// PUT — upsert the caller's own prefs.
// ---------------------------------------------------------------------------

export async function PUT(request: NextRequest) {
  // Body cap — prefs are <1kb; 50kb is generous.
  const sizeError = checkRequestSize(request, '50kb');
  if (sizeError) return sizeError;

  const auth = await requireAuth();
  if (!auth.authenticated) return auth.response;

  const slug = ownSlug(auth.user);
  if (!slug) {
    return NextResponse.json(
      { success: false, error: 'Could not derive rep slug from session' },
      { status: 400 },
    );
  }

  let body: Partial<RepNotificationPrefs>;
  try {
    body = (await request.json()) as Partial<RepNotificationPrefs>;
  } catch {
    return NextResponse.json(
      { success: false, error: 'Invalid JSON body' },
      { status: 400 },
    );
  }

  // Defaults first (every ON), then overlay only the boolean fields the
  // client sent. Reps cannot rename themselves or rewrite the slug via
  // this endpoint — those come from the session.
  const defaults = defaultRepPrefs(slug, auth.user.name || slug);
  const prefs: RepNotificationPrefs = {
    ...defaults,
    channelGroupMe: typeof body.channelGroupMe === 'boolean' ? body.channelGroupMe : defaults.channelGroupMe,
    channelEmail: typeof body.channelEmail === 'boolean' ? body.channelEmail : defaults.channelEmail,
    alertNewLead: typeof body.alertNewLead === 'boolean' ? body.alertNewLead : defaults.alertNewLead,
    alertCustomerMessage: typeof body.alertCustomerMessage === 'boolean' ? body.alertCustomerMessage : defaults.alertCustomerMessage,
    alertDigest: typeof body.alertDigest === 'boolean' ? body.alertDigest : defaults.alertDigest,
    alertSystem: typeof body.alertSystem === 'boolean' ? body.alertSystem : defaults.alertSystem,
    alertMention: typeof body.alertMention === 'boolean' ? body.alertMention : defaults.alertMention,
  };

  const result = await saveRepNotificationPrefs(prefs);
  if (!result.success) {
    return NextResponse.json(
      { success: false, error: result.error || 'Save failed' },
      { status: 500 },
    );
  }

  return NextResponse.json({ success: true, data: prefs });
}
