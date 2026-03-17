// Rep Preferences API
// GET: Get rep county/area preferences
// PUT: Update rep preferences

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-service';
import { googleSheetsService } from '@/lib/google-sheets-service';
import { TEAM_MEMBERS } from '@/lib/team-roles';
import { cache, CACHE_TTL } from '@/lib/cache';

export async function GET(request: NextRequest) {
  const auth = await requireAuth();
  if (!auth.authenticated) return auth.response;

  try {
    const { searchParams } = new URL(request.url);
    const repSlug = searchParams.get('repSlug') || undefined;

    const cacheKey = `portal:rep-preferences:${repSlug || 'all'}`;
    const cached = cache.get(cacheKey);
    if (cached) return NextResponse.json(cached, { headers: { 'Cache-Control': 'private, s-maxage=30' } });

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
      const response = {
        success: true,
        data: result[0] || {
          repSlug,
          countiesEnabled: {},
          maxLeadsPerDay: 0,
          preferredAreas: [],
          excludedAreas: [],
          updatedAt: '',
        },
      };
      cache.set(cacheKey, response, CACHE_TTL.TEAM);
      return NextResponse.json(response, { headers: { 'Cache-Control': 'private, s-maxage=30' } });
    }

    const response = { success: true, data: result };
    cache.set(cacheKey, response, CACHE_TTL.MEDIUM);
    return NextResponse.json(response);
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

    cache.invalidatePattern('^portal:rep-preferences:');
    return NextResponse.json({ success });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
