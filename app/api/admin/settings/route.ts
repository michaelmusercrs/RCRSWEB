import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth-service';

/**
 * Admin Settings API
 * 
 * Storage: Vercel Blob (works in serverless, persists across deploys)
 * 
 * Previously used local filesystem (data/site-settings.json) which breaks
 * on Vercel's read-only serverless filesystem.
 */

const SETTINGS_BLOB_KEY = 'settings/site-settings.json';

async function readSettings(): Promise<Record<string, unknown>> {
  try {
    const { list } = await import('@vercel/blob');
    const blobs = await list({ prefix: SETTINGS_BLOB_KEY });
    if (blobs.blobs.length > 0) {
      const res = await fetch(blobs.blobs[0].url, { cache: 'no-store' });
      if (res.ok) {
        return await res.json();
      }
    }
  } catch (e) {
    console.error('Settings: Blob read failed:', e);
  }

  // Fallback: try local file (dev environment)
  try {
    const fs = await import('fs');
    const path = await import('path');
    const filePath = path.join(process.cwd(), 'data', 'site-settings.json');
    const data = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(data);
  } catch {
    // No settings yet — that's fine
  }

  return {};
}

async function writeSettings(settings: Record<string, unknown>): Promise<void> {
  try {
    const { put } = await import('@vercel/blob');
    await put(SETTINGS_BLOB_KEY, JSON.stringify(settings, null, 2), {
      access: 'public',
      contentType: 'application/json',
      addRandomSuffix: false,
    });
  } catch (e) {
    console.error('Settings: Blob write failed, trying local file:', e);
    // Fallback: local file (dev environment)
    const fs = await import('fs');
    const path = await import('path');
    const filePath = path.join(process.cwd(), 'data', 'site-settings.json');
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(filePath, JSON.stringify(settings, null, 2));
  }
}

export async function GET() {
  const auth = await requireAdmin();
  if (!auth.authenticated) return auth.response;

  try {
    const settings = await readSettings();
    return NextResponse.json({ success: true, data: settings });
  } catch (error) {
    console.error('Error reading settings:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to read settings' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.authenticated) return auth.response;

  try {
    const body = await request.json();
    const existing = await readSettings();
    const updated = {
      ...existing,
      ...body,
      lastUpdated: new Date().toISOString(),
      updatedBy: auth.user.email,
    };
    await writeSettings(updated);

    return NextResponse.json({
      success: true,
      message: 'Settings saved successfully',
    });
  } catch (error) {
    console.error('Error saving settings:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to save settings' },
      { status: 500 }
    );
  }
}
