// Rep Preferences API
// GET: Get rep county/area preferences
// PUT: Update rep preferences

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-service';
import { googleSheetsService } from '@/lib/google-sheets-service';
import { TEAM_MEMBERS } from '@/lib/team-roles';

export async function GET(request: NextRequest) {
  const auth = await requireAuth();
  if (!auth.authenticated) return auth.response;

  try {
    const { searchParams } = new URL(request.url);
    const repSlug = searchParams.get('repSlug') || undefined;

    const preferences = await googleSheetsService.getRepPreferences(repSlug);

    const result = preferences.map(pref => ({
      repSlug: pref.repSlug,
      countiesEnabled: JSON.parse(pref.countiesEnabled || '{}'),
      maxLeadsPerDay: parseInt(pref.maxLeadsPerDay) || 0,
      preferredAreas: JSON.parse(pref.preferredAreas || '[]'),
      excludedAreas: JSON.parse(pref.excludedAreas || '[]'),
      updatedAt: pref.updatedAt,
    }));

    if (repSlug) {
      return NextResponse.json({
        success: true,
        data: result[0] || {
          repSlug,
          countiesEnabled: {},
          maxLeadsPerDay: 0,
          preferredAreas: [],
          excludedAreas: [],
          updatedAt: '',
        },
      });
    }

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  const auth = await requireAuth();
  if (!auth.authenticated) return auth.response;

  try {
    const body = await request.json();
    const { repSlug, countiesEnabled, maxLeadsPerDay, preferredAreas, excludedAreas } = body;

    if (!repSlug) {
      return NextResponse.json(
        { success: false, error: 'repSlug is required' },
        { status: 400 }
      );
    }

    const rep = TEAM_MEMBERS.find(m => m.slug === repSlug);
    if (!rep) {
      return NextResponse.json(
        { success: false, error: 'Rep not found' },
        { status: 404 }
      );
    }

    const success = await googleSheetsService.updateRepPreferences({
      repSlug,
      countiesEnabled: JSON.stringify(countiesEnabled || {}),
      maxLeadsPerDay: String(maxLeadsPerDay || 0),
      preferredAreas: JSON.stringify(preferredAreas || []),
      excludedAreas: JSON.stringify(excludedAreas || []),
      updatedAt: new Date().toISOString(),
    });

    return NextResponse.json({ success });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
