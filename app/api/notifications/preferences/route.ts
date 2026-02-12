/**
 * Notification Preferences API Route
 *
 * Manages the 3-tier notification preference cascade:
 *   1. Admin defaults (company-wide)
 *   2. Rep overrides (per sales rep)
 *   3. Customer overrides (per homeowner, set by rep)
 *
 * GET  - Fetch preferences at any level, or resolved preferences
 * POST - Save/update preferences at any level
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, requireAdmin } from '@/lib/auth-service';
import {
  notificationService,
  NotificationPreferences,
  NotificationOverrides,
  ReminderTiming,
  ALL_TRIGGERS,
  ALL_CHANNELS,
  TRIGGER_LABELS,
  CHANNEL_LABELS,
  TRIGGER_DESCRIPTIONS,
  DEFAULT_ADMIN_PREFERENCES,
  DEFAULT_REMINDER_TIMING,
} from '@/lib/notification-service';

/**
 * GET /api/notifications/preferences
 * Query params:
 *   level: 'admin' | 'rep' | 'customer' | 'resolved'
 *   repSlug: required for rep/customer/resolved
 *   customerId: required for customer, optional for resolved
 */
export async function GET(request: NextRequest) {
  const auth = await requireAuth();
  if (!auth.authenticated) return auth.response;

  try {
    const { searchParams } = new URL(request.url);
    const level = searchParams.get('level') || 'resolved';
    const repSlug = searchParams.get('repSlug') || '';
    const customerId = searchParams.get('customerId') || '';

    // Always include metadata about available triggers and channels
    const metadata = {
      triggers: ALL_TRIGGERS.map(t => ({
        key: t,
        label: TRIGGER_LABELS[t],
        description: TRIGGER_DESCRIPTIONS[t],
      })),
      channels: ALL_CHANNELS.map(c => ({
        key: c,
        label: CHANNEL_LABELS[c],
      })),
    };

    if (level === 'admin') {
      const config = await notificationService.getAdminDefaults();
      return NextResponse.json({
        success: true,
        level: 'admin',
        data: config,
        metadata,
      });
    }

    if (level === 'rep') {
      if (!repSlug) {
        return NextResponse.json(
          { success: false, error: 'repSlug is required for rep-level preferences' },
          { status: 400 }
        );
      }
      const overrides = await notificationService.getRepOverrides(repSlug);
      const adminConfig = await notificationService.getAdminDefaults();
      return NextResponse.json({
        success: true,
        level: 'rep',
        repSlug,
        data: {
          overrides: overrides?.overrides || null,
          reminderTiming: overrides?.reminderTiming || null,
          updatedAt: overrides?.updatedAt || null,
        },
        adminDefaults: adminConfig.defaults,
        metadata,
      });
    }

    if (level === 'customer') {
      if (!customerId) {
        return NextResponse.json(
          { success: false, error: 'customerId is required for customer-level preferences' },
          { status: 400 }
        );
      }
      const overrides = await notificationService.getCustomerOverrides(customerId);
      const adminConfig = await notificationService.getAdminDefaults();
      const repOverrides = repSlug ? await notificationService.getRepOverrides(repSlug) : null;
      return NextResponse.json({
        success: true,
        level: 'customer',
        customerId,
        repSlug,
        data: {
          overrides: overrides?.overrides || null,
          reminderTiming: overrides?.reminderTiming || null,
          updatedAt: overrides?.updatedAt || null,
        },
        adminDefaults: adminConfig.defaults,
        repOverrides: repOverrides?.overrides || null,
        metadata,
      });
    }

    if (level === 'resolved') {
      if (!repSlug) {
        return NextResponse.json(
          { success: false, error: 'repSlug is required for resolved preferences' },
          { status: 400 }
        );
      }

      const resolved = await notificationService.resolvePreferences(repSlug, customerId || undefined);
      const reminderTiming = await notificationService.resolveReminderTiming(repSlug, customerId || undefined);

      return NextResponse.json({
        success: true,
        level: 'resolved',
        repSlug,
        customerId: customerId || null,
        data: {
          preferences: resolved,
          reminderTiming,
        },
        metadata,
      });
    }

    // Also support listing all rep overrides (admin use)
    if (level === 'all_reps') {
      const adminAuth = await requireAdmin();
      if (!adminAuth.authenticated) return adminAuth.response;

      const allOverrides = await notificationService.getAllRepOverrides();
      return NextResponse.json({
        success: true,
        level: 'all_reps',
        count: allOverrides.length,
        data: allOverrides,
        metadata,
      });
    }

    // And listing customer overrides for a rep
    if (level === 'rep_customers') {
      if (!repSlug) {
        return NextResponse.json(
          { success: false, error: 'repSlug is required for rep_customers level' },
          { status: 400 }
        );
      }
      const customerOverrides = await notificationService.getCustomerOverridesForRep(repSlug);
      return NextResponse.json({
        success: true,
        level: 'rep_customers',
        repSlug,
        count: customerOverrides.length,
        data: customerOverrides,
        metadata,
      });
    }

    return NextResponse.json(
      { success: false, error: 'Invalid level. Use: admin, rep, customer, resolved, all_reps, or rep_customers' },
      { status: 400 }
    );
  } catch (error) {
    console.error('[Notification Preferences] GET error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/notifications/preferences
 * Body:
 *   level: 'admin' | 'rep' | 'customer'
 *   preferences?: NotificationPreferences (admin level)
 *   overrides?: NotificationOverrides (rep/customer level)
 *   reminderTiming?: ReminderTiming or Partial<ReminderTiming>
 *   repSlug?: string (required for rep/customer)
 *   repName?: string (for rep level)
 *   customerId?: string (required for customer)
 *   customerName?: string (for customer level)
 */
export async function POST(request: NextRequest) {
  const auth = await requireAuth();
  if (!auth.authenticated) return auth.response;

  try {
    const body = await request.json();
    const { level } = body;

    if (level === 'admin') {
      // Admin-only: save company defaults
      const adminAuth = await requireAdmin();
      if (!adminAuth.authenticated) return adminAuth.response;

      const { preferences, reminderTiming } = body;

      if (!preferences) {
        return NextResponse.json(
          { success: false, error: 'preferences object is required for admin level' },
          { status: 400 }
        );
      }

      // Validate structure
      for (const trigger of ALL_TRIGGERS) {
        if (!preferences[trigger]) {
          return NextResponse.json(
            { success: false, error: `Missing preferences for trigger: ${trigger}` },
            { status: 400 }
          );
        }
      }

      const result = await notificationService.saveAdminDefaults(
        preferences as NotificationPreferences,
        reminderTiming || DEFAULT_REMINDER_TIMING,
        auth.user.name || auth.user.email
      );

      return NextResponse.json({
        success: result.success,
        error: result.error,
        message: result.success ? 'Admin notification defaults saved' : undefined,
      });
    }

    if (level === 'rep') {
      const { repSlug, repName, overrides, reminderTiming } = body;

      if (!repSlug) {
        return NextResponse.json(
          { success: false, error: 'repSlug is required for rep level' },
          { status: 400 }
        );
      }

      if (!overrides) {
        return NextResponse.json(
          { success: false, error: 'overrides object is required for rep level' },
          { status: 400 }
        );
      }

      // Non-admin users can only modify their own preferences
      const isAdmin = auth.user.role === 'admin' || auth.user.role === 'owner';
      const ownSlug = auth.user.userId || auth.user.name.toLowerCase().replace(/\s+/g, '-');
      if (!isAdmin && repSlug !== ownSlug) {
        return NextResponse.json(
          { success: false, error: 'You can only modify your own notification preferences' },
          { status: 403 }
        );
      }

      const result = await notificationService.saveRepOverrides(
        repSlug,
        repName || auth.user.name || repSlug,
        overrides as NotificationOverrides,
        reminderTiming
      );

      return NextResponse.json({
        success: result.success,
        error: result.error,
        message: result.success ? `Rep notification preferences saved for ${repSlug}` : undefined,
      });
    }

    if (level === 'customer') {
      const { customerId, customerName, repSlug, overrides, reminderTiming } = body;

      if (!customerId || !repSlug) {
        return NextResponse.json(
          { success: false, error: 'customerId and repSlug are required for customer level' },
          { status: 400 }
        );
      }

      if (!overrides) {
        return NextResponse.json(
          { success: false, error: 'overrides object is required for customer level' },
          { status: 400 }
        );
      }

      const result = await notificationService.saveCustomerOverrides(
        customerId,
        customerName || customerId,
        repSlug,
        overrides as NotificationOverrides,
        reminderTiming
      );

      return NextResponse.json({
        success: result.success,
        error: result.error,
        message: result.success ? `Customer notification preferences saved for ${customerId}` : undefined,
      });
    }

    return NextResponse.json(
      { success: false, error: 'Invalid level. Use: admin, rep, or customer' },
      { status: 400 }
    );
  } catch (error) {
    console.error('[Notification Preferences] POST error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
