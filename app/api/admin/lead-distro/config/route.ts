// Lead Distribution Config API
// GET: Read current config
// PUT: Update config (admin only)
// Uses the lead distribution service singleton for consistent config management
// and syncs response timer settings when saved.

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth-service';
import { leadDistributionService, LeadDistroConfig } from '@/lib/lead-distribution-service';
import { leadResponseTimerService } from '@/lib/lead-response-timer';

export async function GET(request: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.authenticated) return auth.response;

  try {
    const config = leadDistributionService.getConfig();

    return NextResponse.json({ success: true, config });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.authenticated) return auth.response;

  try {
    const body = await request.json();
    const { config, updatedBy } = body;

    if (!config) {
      return NextResponse.json(
        { success: false, error: 'Config object required' },
        { status: 400 }
      );
    }

    // Validate ENABLED weights sum to 100. Disabled (dismissed) factors are
    // excluded from the sum so admins can turn off a metric without rebalancing
    // the rest immediately. weightsEnabled is optional; missing = all enabled.
    if (config.weights) {
      const enabled = (config.weightsEnabled || {}) as Record<string, boolean>;
      const enabledSum = Object.entries(config.weights as Record<string, number>)
        .filter(([k]) => enabled[k] !== false)
        .reduce((sum, [, w]) => sum + Number(w), 0);
      if (Math.abs(enabledSum - 100) > 0.01) {
        return NextResponse.json(
          { success: false, error: `Enabled weights must sum to 100, got ${enabledSum}` },
          { status: 400 }
        );
      }
    }

    // Deep merge with existing config to avoid overwriting sub-objects
    const existing = leadDistributionService.getConfig();
    const merged: LeadDistroConfig = {
      ...existing,
      ...config,
      weights: { ...existing.weights, ...(config.weights || {}) },
      weightsEnabled: { ...(existing.weightsEnabled || {}), ...(config.weightsEnabled || {}) },
      thresholds: { ...existing.thresholds, ...(config.thresholds || {}) },
      responseTimers: { ...existing.responseTimers, ...(config.responseTimers || {}) },
    };

    // Save via the service (adds updatedAt/updatedBy)
    leadDistributionService.saveConfig(merged, updatedBy || 'admin');

    // Sync response timer settings to the timer service
    const savedConfig = leadDistributionService.getConfig();
    leadResponseTimerService.setConfig({
      reminderMinutes: savedConfig.responseTimers.reminderMinutes,
      warningMinutes: savedConfig.responseTimers.warningMinutes,
      urgentWarningMinutes: savedConfig.responseTimers.urgentWarningMinutes,
      reassignMinutes: savedConfig.responseTimers.reassignMinutes,
    });
    return NextResponse.json({ success: true, config: savedConfig });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
