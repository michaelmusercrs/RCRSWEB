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
import fs from 'fs';
import path from 'path';

// Path to system config file
const CONFIG_PATH = path.join(process.cwd(), 'data', 'system-config.json');

// Read features from config
function readFeatures(): Record<string, FeatureFlag> {
  try {
    const configData = fs.readFileSync(CONFIG_PATH, 'utf-8');
    const config = JSON.parse(configData);
    return config.features || {};
  } catch {
    return {};
  }
}

// Save features to config
function saveFeatures(features: Record<string, FeatureFlag>): void {
  try {
    const configData = fs.readFileSync(CONFIG_PATH, 'utf-8');
    const config = JSON.parse(configData);
    config.features = features;
    config.lastUpdated = new Date().toISOString();
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
  } catch (error) {
    console.error('Error saving features:', error);
    throw new Error('Failed to save feature configuration');
  }
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
    const configFeatures = readFeatures();

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
    const features = readFeatures();

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
    saveFeatures(features);

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
