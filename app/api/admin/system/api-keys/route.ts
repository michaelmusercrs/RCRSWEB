/**
 * API Keys Management API
 *
 * GET - List all API keys (masked)
 * POST - Create new API key
 * DELETE - Revoke API key
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  getEnvironment,
  hashApiKey,
  createAuditLogEntry,
  type ApiKeyConfig,
} from '@/lib/feature-flags';
import { requireAdmin } from '@/lib/auth-service';
import crypto from 'crypto';

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
  } catch (e) {
    // Blob not available
  }
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
  try {
    const { put } = await import('@vercel/blob');
    await put(BLOB_KEY, JSON.stringify(config, null, 2), {
      access: 'public', contentType: 'application/json', addRandomSuffix: false, allowOverwrite: true,
    });
  } catch (e) {
    const fs = await import('fs');
    const path = await import('path');
    const filePath = path.join(process.cwd(), LOCAL_PATH);
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(filePath, JSON.stringify(config, null, 2));
  }
}

// Read API keys from config
async function readApiKeys(): Promise<ApiKeyConfig[]> {
  try {
    const config = await readConfig();
    return config.apiKeys || [];
  } catch {
    return [];
  }
}

// Save API keys to config
async function saveApiKeys(apiKeys: ApiKeyConfig[]): Promise<void> {
  try {
    const config = await readConfig();
    config.apiKeys = apiKeys;
    config.lastUpdated = new Date().toISOString();
    await writeConfig(config);
  } catch (error) {
    console.error('Error saving API keys:', error);
    throw new Error('Failed to save API keys');
  }
}

// Generate a new API key
function generateApiKey(prefix: string = 'rcrs'): string {
  const randomBytes = crypto.randomBytes(24).toString('hex');
  return `${prefix}_${randomBytes}`;
}

// GET handler - List API keys
export async function GET() {
  const auth = await requireAdmin();
  if (!auth.authenticated) return auth.response;

  try {
    const apiKeys = await readApiKeys();

    // Mask sensitive data
    const maskedKeys = apiKeys.map(key => ({
      id: key.id,
      name: key.name,
      lastFourChars: key.lastFourChars,
      permissions: key.permissions,
      createdAt: key.createdAt,
      expiresAt: key.expiresAt,
      isActive: key.isActive,
    }));

    // Get statistics
    const activeCount = apiKeys.filter(k => k.isActive).length;
    const expiredCount = apiKeys.filter(k =>
      k.expiresAt && new Date(k.expiresAt) < new Date()
    ).length;

    return NextResponse.json({
      success: true,
      data: {
        apiKeys: maskedKeys,
        statistics: {
          total: apiKeys.length,
          active: activeCount,
          revoked: apiKeys.length - activeCount,
          expired: expiredCount,
        },
        environment: getEnvironment(),
      },
    });
  } catch (error) {
    console.error('Error fetching API keys:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch API keys' },
      { status: 500 }
    );
  }
}

// POST handler - Create new API key
export async function POST(request: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.authenticated) return auth.response;

  try {
    const body = await request.json();
    const {
      name,
      permissions = [],
      expiresIn, // days until expiration
      userId = 'unknown',
      userEmail,
    } = body;

    if (!name) {
      return NextResponse.json(
        { success: false, error: 'API key name is required' },
        { status: 400 }
      );
    }

    const environment = getEnvironment();

    // In production, require additional confirmation
    if (environment === 'production' && !body.confirmProduction) {
      return NextResponse.json({
        success: false,
        error: 'Creating API keys in production requires confirmation',
        requiresConfirmation: true,
      }, { status: 403 });
    }

    // Generate new API key
    const newKey = generateApiKey();
    const keyHash = hashApiKey(newKey);

    // Calculate expiration date if specified
    let expiresAt: string | undefined;
    if (expiresIn) {
      const expirationDate = new Date();
      expirationDate.setDate(expirationDate.getDate() + expiresIn);
      expiresAt = expirationDate.toISOString();
    }

    const apiKeyConfig: ApiKeyConfig = {
      id: `api_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`,
      name,
      keyHash,
      lastFourChars: newKey.slice(-4),
      permissions,
      createdAt: new Date().toISOString(),
      expiresAt,
      isActive: true,
    };

    // Save to config
    const apiKeys = await readApiKeys();
    apiKeys.push(apiKeyConfig);
    await saveApiKeys(apiKeys);

    // Create audit log entry
    const auditEntry = createAuditLogEntry(
      'api-key-created',
      `api-key:${apiKeyConfig.id}`,
      userId,
      {
        keyName: name,
        permissions,
        expiresAt,
        environment,
      },
      userEmail,
      request.headers.get('x-forwarded-for') || 'unknown'
    );

    return NextResponse.json({
      success: true,
      message: 'API key created successfully',
      data: {
        apiKey: {
          id: apiKeyConfig.id,
          name: apiKeyConfig.name,
          key: newKey, // Only shown once!
          permissions: apiKeyConfig.permissions,
          createdAt: apiKeyConfig.createdAt,
          expiresAt: apiKeyConfig.expiresAt,
        },
        warning: 'Store this API key securely. It will not be shown again.',
        auditEntry,
      },
    });
  } catch (error) {
    console.error('Error creating API key:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create API key' },
      { status: 500 }
    );
  }
}

// DELETE handler - Revoke API key
export async function DELETE(request: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.authenticated) return auth.response;

  try {
    const { searchParams } = new URL(request.url);
    const keyId = searchParams.get('id');

    if (!keyId) {
      return NextResponse.json(
        { success: false, error: 'API key ID is required' },
        { status: 400 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const { userId = 'unknown', userEmail } = body;

    const apiKeys = await readApiKeys();
    const keyIndex = apiKeys.findIndex(k => k.id === keyId);

    if (keyIndex === -1) {
      return NextResponse.json(
        { success: false, error: 'API key not found' },
        { status: 404 }
      );
    }

    // Mark as revoked instead of deleting
    apiKeys[keyIndex].isActive = false;
    await saveApiKeys(apiKeys);

    // Create audit log entry
    const auditEntry = createAuditLogEntry(
      'api-key-revoked',
      `api-key:${keyId}`,
      userId,
      {
        keyName: apiKeys[keyIndex].name,
        revokedAt: new Date().toISOString(),
        environment: getEnvironment(),
      },
      userEmail,
      request.headers.get('x-forwarded-for') || 'unknown'
    );

    return NextResponse.json({
      success: true,
      message: 'API key revoked successfully',
      data: {
        keyId,
        auditEntry,
      },
    });
  } catch (error) {
    console.error('Error revoking API key:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to revoke API key' },
      { status: 500 }
    );
  }
}
