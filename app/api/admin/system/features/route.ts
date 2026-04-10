/**
 * Feature Flags API
 *
 * GET - Retrieve all feature flags with current status
 * POST - Toggle or update feature flags
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  getAllFeatures,
  isFeatureEnabled,
  requiresApproval,
  getEnvironment,
  createAuditLogEntry,
  type FeatureFlag,
} from '@/lib/feature-flags';
import { requireAdmin } from '@/lib/auth-service';

const BLOB_KEY = 'data/system-config.json';
const LOCAL_PATH = 'data/system-config.json';

async function readConfig(): Promise<Record<string, any>> {
  try {
    const { list } = await import('@vercel/blob');
    const blobs = await list({ prefix: BLOB_KEY });
    if (blobs.blobs.length > 0) {
      const res = await fetch(blobs.blobs[0].url, { cache: 'no-store' });
      if (res.ok) return await res.json();
    }
  } catch (e) { /* blob not available */ }
  try {
    const fs = await import('fs');
    const path = await import('path');
    const filePath = path.join(process.cwd(), LOCAL_PATH);
    const data = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(data);
  } catch {
    return {};
  }
}

async function writeConfig(config: Record<string, any>): Promise<void> {
  // Vercel Blob is canonical; fs is dev-only fallback wrapped in try/catch.
  try {
    const { put } = await import('@vercel/blob');
    await put(BLOB_KEY, JSON.stringify(config, null, 2), {
      access: 'public', contentType: 'application/json', addRandomSuffix: false, allowOverwrite: true,
    });
    return;
  } catch (e) {
    console.warn('[features] Blob write failed, attempting fs fallback:', e);
  }
  try {
    const fs = await import('fs');
    const path = await import('path');
    const filePath = path.join(process.cwd(), LOCAL_PATH);
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(filePath, JSON.stringify(config, null, 2));
  } catch (fsErr) {
    console.warn('[features] Local fs write skipped (read-only fs?):', fsErr);
  }
}

// Read features from config
async function readFeatures(): Promise<Record<string, FeatureFlag>> {
  const config = await readConfig();
  return config.features || {};
}

// Save features to config
async function saveFeatures(features: Record<string, FeatureFlag>): Promise<void> {
  const config = await readConfig();
  config.features = features;
  config.lastUpdated = new Date().toISOString();
  await writeConfig(config);
}

// GET handler - Retrieve all features
export async function GET(request: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.authenticated) return auth.response;

  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category');
    const enabledOnly = searchParams.get('enabledOnly') === 'true';

    let features = getAllFeatures();
    const configFeatures = await readFeatures();

    // Merge with config overrides
    features = features.map(feature => ({
      ...feature,
      ...(configFeatures[feature.id] || {}),
      isEnabled: isFeatureEnabled(feature.id),
      needsApproval: requiresApproval(feature.id),
    }));

    // Filter by category if specified
    if (category) {
      features = features.filter(f => f.category === category);
    }

    // Filter to enabled only if specified
    if (enabledOnly) {
      features = features.filter(f => isFeatureEnabled(f.id));
    }

    // Group by category
    const groupedFeatures = features.reduce((acc, feature) => {
      if (!acc[feature.category]) {
        acc[feature.category] = [];
      }
      acc[feature.category].push(feature);
      return acc;
    }, {} as Record<string, FeatureFlag[]>);

    return NextResponse.json({
      success: true,
      data: {
        features,
        groupedFeatures,
        environment: getEnvironment(),
        totalCount: features.length,
        enabledCount: features.filter(f => isFeatureEnabled(f.id)).length,
      },
    });
  } catch (error) {
    console.error('Error fetching features:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch features' },
      { status: 500 }
    );
  }
}

// POST handler - Toggle or update features
export async function POST(request: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.authenticated) return auth.response;

  try {
    const body = await request.json();
    const { action, featureId, updates, userId = 'unknown', userEmail, approvalToken } = body;

    const environment = getEnvironment();
    const features = await readFeatures();

    // Check if feature exists
    if (!features[featureId]) {
      return NextResponse.json(
        { success: false, error: 'Feature not found' },
        { status: 404 }
      );
    }

    const feature = features[featureId];

    // Check if approval is required
    if (environment === 'production' && feature.requiresApproval && !approvalToken) {
      return NextResponse.json({
        success: false,
        error: 'This action requires approval in production',
        requiresApproval: true,
        approvalRequired: {
          featureId,
          action,
          environment,
        },
      }, { status: 403 });
    }

    // Create audit log entry
    const auditEntry = createAuditLogEntry(
      `feature-${action}`,
      `feature:${featureId}`,
      userId,
      { action, featureId, updates, environment },
      userEmail
    );

    switch (action) {
      case 'toggle':
        features[featureId].enabled = !feature.enabled;
        break;

      case 'enable':
        features[featureId].enabled = true;
        break;

      case 'disable':
        features[featureId].enabled = false;
        break;

      case 'update':
        features[featureId] = {
          ...feature,
          ...updates,
          id: feature.id, // Preserve ID
        };
        break;

      case 'set-rollout':
        features[featureId].rolloutPercentage = updates.rolloutPercentage;
        break;

      default:
        return NextResponse.json(
          { success: false, error: 'Unknown action' },
          { status: 400 }
        );
    }

    // Save changes
    await saveFeatures(features);

    return NextResponse.json({
      success: true,
      message: `Feature '${featureId}' ${action} completed`,
      data: {
        feature: features[featureId],
        isEnabled: features[featureId].enabled,
        auditEntry,
      },
    });
  } catch (error) {
    console.error('Error updating feature:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update feature' },
      { status: 500 }
    );
  }
}
