/**
 * Phone extension directory API.
 *
 * GET  — the merged directory (config seed overlaid with editable sheet rows).
 *        Any phone-module user (owner/admin/manager/sales/office) may read it.
 * PUT  — upsert one extension row (reassign, update GV number, swap MAC).
 *        Owner/admin only. Persists to the Phone_Extensions sheet.
 *
 * Never returns or stores voicemail PINs or phone IPs (see lib/phone-directory).
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, requireAdmin } from '@/lib/auth-service';
import { getPhoneScope } from '@/lib/phone-access';
import { phoneDirectory } from '@/lib/phone-directory';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  const auth = await requireAuth();
  if (!auth.authenticated) return auth.response;
  if (getPhoneScope(auth.user).level === 'none') {
    return NextResponse.json({ error: 'You do not have access to phone data' }, { status: 403 });
  }

  const directory = await phoneDirectory.getDirectory();
  return NextResponse.json({ directory });
}

export async function PUT(request: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.authenticated) return auth.response;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const extension = String(body.extension || '').trim();
  if (!extension) {
    return NextResponse.json({ error: 'extension is required' }, { status: 400 });
  }

  try {
    const updated = await phoneDirectory.upsert({
      extension,
      slug: body.slug !== undefined ? String(body.slug) : undefined,
      name: body.name !== undefined ? String(body.name) : undefined,
      email: body.email !== undefined ? String(body.email) : undefined,
      googleVoice: body.googleVoice !== undefined ? String(body.googleVoice) : undefined,
      mac: body.mac !== undefined ? String(body.mac) : undefined,
      active: body.active !== undefined ? Boolean(body.active) : undefined,
      notes: body.notes !== undefined ? String(body.notes) : undefined,
    });
    return NextResponse.json({ success: true, extension: updated });
  } catch (error) {
    console.error('[phone/directory] PUT error:', error);
    return NextResponse.json({ error: 'Failed to update extension' }, { status: 500 });
  }
}
