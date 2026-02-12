/**
 * Maintenance Mode API
 *
 * GET - Check maintenance mode status
 * POST - Toggle maintenance mode
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  getEnvironment,
  isMaintenanceModeEnabled,
  createAuditLogEntry,
} from '@/lib/feature-flags';
import { requireAdmin } from '@/lib/auth-service';
import fs from 'fs';
import path from 'path';

// Path to system config file
const CONFIG_PATH = path.join(process.cwd(), 'data', 'system-config.json');

interface MaintenanceConfig {
  enabled: boolean;
  message: string;
  endTime?: string;
  allowedIPs?: string[];
  bypassToken?: string;
}

// Read maintenance config
function readMaintenanceConfig(): MaintenanceConfig {
  try {
    const configData = fs.readFileSync(CONFIG_PATH, 'utf-8');
    const config = JSON.parse(configData);
    return {
      enabled: config.maintenanceMode || false,
      message: config.maintenanceMessage || 'System under maintenance',
      endTime: config.maintenanceEndTime,
      allowedIPs: config.allowedIPs || [],
    };
  } catch {
    return {
      enabled: isMaintenanceModeEnabled(),
      message: 'System under maintenance',
    };
  }
}

// Save maintenance config
function saveMaintenanceConfig(maintenance: MaintenanceConfig): void {
  try {
    const configData = fs.readFileSync(CONFIG_PATH, 'utf-8');
    const config = JSON.parse(configData);
    config.maintenanceMode = maintenance.enabled;
    config.maintenanceMessage = maintenance.message;
    config.maintenanceEndTime = maintenance.endTime;
    config.allowedIPs = maintenance.allowedIPs;
    config.lastUpdated = new Date().toISOString();
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
  } catch (error) {
    console.error('Error saving maintenance config:', error);
    throw new Error('Failed to save maintenance configuration');
  }
}

// GET handler - Check maintenance status
export async function GET(request: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.authenticated) return auth.response;

  try {
    const maintenance = readMaintenanceConfig();
    const clientIP = request.headers.get('x-forwarded-for') || 'unknown';
    const bypassToken = request.headers.get('x-maintenance-bypass');

    // Check if IP is allowed to bypass maintenance
    const isIPAllowed = maintenance.allowedIPs?.includes(clientIP) || false;

    // Check if bypass token is valid (in production, use a secure token)
    const isBypassValid = bypassToken === process.env.MAINTENANCE_BYPASS_TOKEN;

    // Check if maintenance window has ended
    const hasEnded = maintenance.endTime
      ? new Date(maintenance.endTime) < new Date()
      : false;

    return NextResponse.json({
      success: true,
      data: {
        maintenanceMode: maintenance.enabled && !hasEnded,
        message: maintenance.message,
        endTime: maintenance.endTime,
        canBypass: isIPAllowed || isBypassValid,
        environment: getEnvironment(),
      },
    });
  } catch (error) {
    console.error('Error checking maintenance status:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to check maintenance status' },
      { status: 500 }
    );
  }
}

// POST handler - Toggle maintenance mode
export async function POST(request: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.authenticated) return auth.response;

  try {
    const body = await request.json();
    const {
      enabled,
      message,
      endTime,
      allowedIPs,
      userId = 'unknown',
      userEmail,
    } = body;

    const environment = getEnvironment();

    // In production, require confirmation
    if (environment === 'production' && enabled && !body.confirmProduction) {
      return NextResponse.json({
        success: false,
        error: 'Enabling maintenance mode in production requires confirmation',
        requiresConfirmation: true,
        confirmationMessage: 'You are about to enable maintenance mode in PRODUCTION. This will prevent users from accessing the site.',
      }, { status: 403 });
    }

    const currentConfig = readMaintenanceConfig();

    // Update configuration
    const newConfig: MaintenanceConfig = {
      enabled: enabled ?? currentConfig.enabled,
      message: message ?? currentConfig.message,
      endTime: endTime ?? currentConfig.endTime,
      allowedIPs: allowedIPs ?? currentConfig.allowedIPs,
    };

    saveMaintenanceConfig(newConfig);

    // Create audit log entry
    const auditEntry = createAuditLogEntry(
      enabled ? 'maintenance-enabled' : 'maintenance-disabled',
      'system:maintenance',
      userId,
      {
        previousState: currentConfig.enabled,
        newState: newConfig.enabled,
        message: newConfig.message,
        endTime: newConfig.endTime,
        environment,
      },
      userEmail,
      request.headers.get('x-forwarded-for') || 'unknown'
    );

    return NextResponse.json({
      success: true,
      message: `Maintenance mode ${enabled ? 'enabled' : 'disabled'}`,
      data: {
        maintenanceMode: newConfig.enabled,
        message: newConfig.message,
        endTime: newConfig.endTime,
        environment,
        auditEntry,
      },
    });
  } catch (error) {
    console.error('Error updating maintenance mode:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update maintenance mode' },
      { status: 500 }
    );
  }
}
