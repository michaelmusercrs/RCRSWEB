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
  // Vercel Blob is the canonical store for runtime config (it survives
  // redeploys and is the same across all serverless instances). Local fs
  // writes are a best-effort dev fallback — they'll fail on Vercel's
  // read-only filesystem and that's OK.
  try {
    const { put } = await import('@vercel/blob');
    await put(BLOB_KEY, JSON.stringify(config, null, 2), {
      access: 'public', contentType: 'application/json', addRandomSuffix: false, allowOverwrite: true,
    });
    return;
  } catch (e) {
    console.warn('[system-config] Blob write failed, attempting local fs fallback:', e);
  }
  try {
    const fs = await import('fs');
    const path = await import('path');
    const filePath = path.join(process.cwd(), LOCAL_PATH);
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(filePath, JSON.stringify(config, null, 2));
  } catch (fsErr) {
    console.error('[system-config] Both blob and fs writes failed:', fsErr);
    throw fsErr;
  }
}

interface MaintenanceConfig {
  enabled: boolean;
  message: string;
  endTime?: string;
  allowedIPs?: string[];
  bypassToken?: string;
}

// Read maintenance config
async function readMaintenanceConfig(): Promise<MaintenanceConfig> {
  try {
    const config = await readConfig();
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
async function saveMaintenanceConfig(maintenance: MaintenanceConfig): Promise<void> {
  const config = await readConfig();
  config.maintenanceMode = maintenance.enabled;
  config.maintenanceMessage = maintenance.message;
  config.maintenanceEndTime = maintenance.endTime;
  config.allowedIPs = maintenance.allowedIPs;
  config.lastUpdated = new Date().toISOString();
  await writeConfig(config);
}

// GET handler - Check maintenance status
export async function GET(request: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.authenticated) return auth.response;

  try {
    const maintenance = await readMaintenanceConfig();
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

    const currentConfig = await readMaintenanceConfig();

    // Update configuration
    const newConfig: MaintenanceConfig = {
      enabled: enabled ?? currentConfig.enabled,
      message: message ?? currentConfig.message,
      endTime: endTime ?? currentConfig.endTime,
      allowedIPs: allowedIPs ?? currentConfig.allowedIPs,
    };

    await saveMaintenanceConfig(newConfig);

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
