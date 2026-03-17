/**
 * API Route: /api/data/march-madness/settings
 *
 * GET  - Returns tournament admin settings (visibility, overrides, prizes)
 * POST - Update settings (admin only: owner/admin role or marchMadnessAdmins list)
 */

import { NextResponse } from 'next/server';
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { validateSession } from '@/lib/auth-service';

const SETTINGS_PATH = join(process.cwd(), 'data', 'march-madness-settings.json');

function loadSettings() {
  try {
    return JSON.parse(readFileSync(SETTINGS_PATH, 'utf8'));
  } catch {
    return {
      showToReps: false,
      tournamentStatus: 'upcoming',
      marchMadnessAdmins: ['Michael Muse', 'Chris Muse', 'Sara Hill', 'Boston Muse'],
      announcementEnabled: false,
      announcementMessage: '',
      showOnMondayMeeting: false,
      overrides: {},
      prizes: {},
      lastUpdatedBy: '',
      lastUpdatedAt: '',
    };
  }
}

function saveSettings(data: Record<string, unknown>) {
  writeFileSync(SETTINGS_PATH, JSON.stringify(data, null, 2), 'utf8');
}

function isMMAdmin(settings: Record<string, unknown>, userName: string, role: string): boolean {
  if (role === 'owner' || role === 'admin') return true;
  const admins = (settings.marchMadnessAdmins || []) as string[];
  return admins.includes(userName);
}

export async function GET() {
  try {
    const settings = loadSettings();
    return NextResponse.json({ success: true, settings });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await validateSession();
    if (!session.valid || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const current = loadSettings();
    if (!isMMAdmin(current, session.user.name, session.user.role)) {
      return NextResponse.json({ error: 'March Madness admin access required' }, { status: 403 });
    }

    const body = await request.json();

    // Deep merge body into current settings
    const merged = { ...current };
    for (const key of Object.keys(body)) {
      if (key === 'overrides' && typeof body.overrides === 'object') {
        merged.overrides = { ...current.overrides };
        for (const rep of Object.keys(body.overrides)) {
          merged.overrides[rep] = {
            ...(current.overrides?.[rep] || {}),
            ...body.overrides[rep],
          };
        }
      } else if (key === 'prizes' && typeof body.prizes === 'object') {
        merged.prizes = { ...current.prizes, ...body.prizes };
      } else {
        merged[key] = body[key];
      }
    }

    merged.lastUpdatedBy = session.user.name;
    merged.lastUpdatedAt = new Date().toISOString();

    saveSettings(merged);

    return NextResponse.json({ success: true, settings: merged });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
