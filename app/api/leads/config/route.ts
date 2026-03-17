// Lead Distribution Config API
// GET: Returns current algorithm configuration
// PUT: Updates algorithm configuration (partial merge)

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth-service';
import { leadDistributionService, LeadDistroConfig } from '@/lib/lead-distribution-service';
import { leadResponseTimerService } from '@/lib/lead-response-timer';

export async function GET() {
  const auth = await requireAdmin();
  if (!auth.authenticated) return auth.response;

  try {
    const config = leadDistributionService.getConfig();

    return NextResponse.json({
      success: true,
      data: config,
    });
  } catch (error) {
    console.error('[Leads Config API] Error fetching config:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to fetch config' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.authenticated) return auth.response;

  try {
    const body = await request.json();

    if (!body.updatedBy) {
      return NextResponse.json(
        { success: false, error: 'updatedBy is required' },
        { status: 400 }
      );
    }

    if (!body.config || typeof body.config !== 'object') {
      return NextResponse.json(
        { success: false, error: 'config object is required' },
        { status: 400 }
      );
    }

    const existing = leadDistributionService.getConfig();

    // Deep merge nested objects to avoid overwriting entire sub-objects
    const merged: LeadDistroConfig = {
      ...existing,
      ...body.config,
      weights: { ...existing.weights, ...(body.config.weights || {}) },
      thresholds: { ...existing.thresholds, ...(body.config.thresholds || {}) },
      responseTimers: { ...existing.responseTimers, ...(body.config.responseTimers || {}) },
    };

    leadDistributionService.saveConfig(merged, body.updatedBy);

    // Re-read to return the saved version (includes updatedAt timestamp)
    const updatedConfig = leadDistributionService.getConfig();

    // Sync response timer settings to the timer service
    leadResponseTimerService.setConfig({
      reminderMinutes: updatedConfig.responseTimers.reminderMinutes,
      warningMinutes: updatedConfig.responseTimers.warningMinutes,
      urgentWarningMinutes: updatedConfig.responseTimers.urgentWarningMinutes,
      reassignMinutes: updatedConfig.responseTimers.reassignMinutes,
    });
    return NextResponse.json({
      success: true,
      data: updatedConfig,
    });
  } catch (error) {
    console.error('[Leads Config API] Error updating config:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to update config' },
      { status: 500 }
    );
  }
}
