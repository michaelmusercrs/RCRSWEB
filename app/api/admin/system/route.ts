/**
 * System Configuration API
 *
 * GET - Retrieve system configuration and status
 * POST - Update system configuration
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  getEnvironment,
  isMaintenanceModeEnabled,
  getSystemStatus,
  getAllFeatures,
  createAuditLogEntry,
  type SystemConfig,
  type AuditLogEntry,
} from '@/lib/feature-flags';
import { requireAdmin } from '@/lib/auth-service';
import fs from 'fs';
import path from 'path';

// In-memory audit log (in production, use a database)
const auditLog: AuditLogEntry[] = [];

// Path to system config file
const CONFIG_PATH = path.join(process.cwd(), 'data', 'system-config.json');

// Read system config from file
function readSystemConfig(): SystemConfig {
  try {
    const configData = fs.readFileSync(CONFIG_PATH, 'utf-8');
    return JSON.parse(configData);
  } catch (error) {
    console.error('Error reading system config:', error);
    return getDefaultConfig();
  }
}

// Write system config to file
function writeSystemConfig(config: SystemConfig): void {
  try {
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
  } catch (error) {
    console.error('Error writing system config:', error);
    throw new Error('Failed to save system configuration');
  }
}

// Get default configuration
function getDefaultConfig(): SystemConfig {
  return {
    environment: getEnvironment(),
    maintenanceMode: isMaintenanceModeEnabled(),
    maintenanceMessage: 'We\'re currently performing scheduled maintenance. Please check back soon.',
    features: {},
    apiKeys: [],
    auditLogEnabled: true,
    lastUpdated: new Date().toISOString(),
    lastUpdatedBy: 'system',
  };
}

// GET handler - Retrieve system configuration
export async function GET() {
  const auth = await requireAdmin();
  if (!auth.authenticated) return auth.response;

  try {
    const config = readSystemConfig();
    const status = getSystemStatus();
    const features = getAllFeatures();

    // Mask sensitive data
    const maskedApiKeys = config.apiKeys.map(key => ({
      ...key,
      keyHash: '****hidden****',
    }));

    return NextResponse.json({
      success: true,
      data: {
        config: {
          ...config,
          apiKeys: maskedApiKeys,
          // Override with environment values
          environment: getEnvironment(),
          maintenanceMode: isMaintenanceModeEnabled(),
        },
        status,
        features,
        auditLogCount: auditLog.length,
        recentAuditLogs: auditLog.slice(-10),
      },
    });
  } catch (error) {
    console.error('Error fetching system config:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch system configuration' },
      { status: 500 }
    );
  }
}

// POST handler - Update system configuration
export async function POST(request: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.authenticated) return auth.response;

  try {
    const body = await request.json();
    const { action, payload, userId = 'unknown', userEmail } = body;

    // Get current config
    const config = readSystemConfig();

    // Create audit log entry
    const logEntry = createAuditLogEntry(
      action,
      'system-config',
      userId,
      { payload },
      userEmail,
      request.headers.get('x-forwarded-for') || 'unknown'
    );

    switch (action) {
      case 'toggle-maintenance':
        config.maintenanceMode = payload.enabled;
        config.maintenanceMessage = payload.message || config.maintenanceMessage;
        config.maintenanceEndTime = payload.endTime;
        break;

      case 'toggle-feature':
        if (config.features[payload.featureId]) {
          config.features[payload.featureId].enabled = payload.enabled;
        }
        break;

      case 'update-feature':
        if (config.features[payload.featureId]) {
          config.features[payload.featureId] = {
            ...config.features[payload.featureId],
            ...payload.updates,
          };
        }
        break;

      case 'add-api-key':
        config.apiKeys.push({
          id: `api_${Date.now()}`,
          name: payload.name,
          keyHash: '****hidden****',
          lastFourChars: payload.key?.slice(-4) || '****',
          permissions: payload.permissions || [],
          createdAt: new Date().toISOString(),
          expiresAt: payload.expiresAt,
          isActive: true,
        });
        break;

      case 'revoke-api-key':
        const keyIndex = config.apiKeys.findIndex(k => k.id === payload.keyId);
        if (keyIndex !== -1) {
          config.apiKeys[keyIndex].isActive = false;
        }
        break;

      case 'update-allowed-ips':
        config.allowedIPs = payload.ips;
        break;

      case 'toggle-audit-log':
        config.auditLogEnabled = payload.enabled;
        break;

      default:
        return NextResponse.json(
          { success: false, error: 'Unknown action' },
          { status: 400 }
        );
    }

    // Update metadata
    config.lastUpdated = new Date().toISOString();
    config.lastUpdatedBy = userId;

    // Save config
    writeSystemConfig(config);

    // Add to audit log
    if (config.auditLogEnabled) {
      auditLog.push(logEntry);
    }

    return NextResponse.json({
      success: true,
      message: `Action '${action}' completed successfully`,
      data: {
        config: {
          ...config,
          apiKeys: config.apiKeys.map(k => ({ ...k, keyHash: '****hidden****' })),
        },
        auditLogEntry: logEntry,
      },
    });
  } catch (error) {
    console.error('Error updating system config:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update system configuration' },
      { status: 500 }
    );
  }
}
