// Lead Quality Config API — BETA
// GET: current config (weights + enabled flags)
// PUT: update config; only owners/admins; enabled weights must sum to 100.

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth-service';
import { getQualityConfig, invalidateQualityConfigCache, DEFAULT_QUALITY_WEIGHTS, type LeadQualityConfig } from '@/lib/lead-quality-service';
import fs from 'fs';
import path from 'path';

const CONFIG_FILE_PATH = path.join(process.cwd(), 'data', 'lead-quality-config.json');

export async function GET(_request: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.authenticated) return auth.response;
  return NextResponse.json({ success: true, config: getQualityConfig(), defaults: DEFAULT_QUALITY_WEIGHTS });
}

export async function PUT(request: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.authenticated) return auth.response;

  try {
    const body = await request.json();
    const { config, updatedBy } = body as { config: LeadQualityConfig; updatedBy?: string };
    if (!config || !config.weights) {
      return NextResponse.json({ success: false, error: 'config.weights required' }, { status: 400 });
    }

    // Validate enabled weights sum to 100
    const enabled = (config.weightsEnabled || {}) as Record<string, boolean>;
    const enabledSum = Object.entries(config.weights as unknown as Record<string, number>)
      .filter(([k]) => enabled[k] !== false)
      .reduce((sum, [, w]) => sum + Number(w), 0);
    if (Math.abs(enabledSum - 100) > 0.01) {
      return NextResponse.json(
        { success: false, error: `Enabled weights must sum to 100, got ${enabledSum}` },
        { status: 400 }
      );
    }

    const merged: LeadQualityConfig = {
      weights: { ...DEFAULT_QUALITY_WEIGHTS, ...config.weights },
      weightsEnabled: config.weightsEnabled,
      updatedAt: new Date().toISOString(),
      updatedBy: updatedBy || 'admin',
    };

    try {
      fs.writeFileSync(CONFIG_FILE_PATH, JSON.stringify(merged, null, 2), 'utf-8');
    } catch (err) {
      // Vercel runtime is read-only — best effort. Disk writes work in dev;
      // hourly Blob backup captures from data/*.json there.
      console.warn('[LeadQualityConfig] disk write skipped (read-only fs?):', err);
    }
    invalidateQualityConfigCache();

    return NextResponse.json({ success: true, config: merged });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Internal error' },
      { status: 500 }
    );
  }
}
