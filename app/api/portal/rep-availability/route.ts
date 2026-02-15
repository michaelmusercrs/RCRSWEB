// Rep Availability API
// GET: Get rep availability status
// PUT: Update rep availability (manager/admin only)

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-service';
import { googleSheetsService } from '@/lib/google-sheets-service';
import { getSalesReps, TEAM_MEMBERS } from '@/lib/team-roles';
import { cache, CACHE_TTL } from '@/lib/cache';

export async function GET(request: NextRequest) {
  const auth = await requireAuth();
  if (!auth.authenticated) return auth.response;

  try {
    const { searchParams } = new URL(request.url);
    const repSlug = searchParams.get('repSlug') || undefined;

    const cacheKey = `portal:rep-availability:${repSlug || 'all'}`;
    const cached = cache.get(cacheKey);
    if (cached) return NextResponse.json(cached);

    const availability = await googleSheetsService.getRepAvailability(repSlug);
    const salesReps = getSalesReps();

    // Merge availability data with rep info
    const result = salesReps.map(rep => {
      const avail = availability.find(a => a.repSlug === rep.slug);
      return {
        repSlug: rep.slug,
        repName: rep.name,
        role: rep.role,
        isActive: rep.isActive,
        isReceivingLeads: avail ? avail.isReceivingLeads === 'true' : true,
        adminOverride: avail ? avail.adminOverride === 'true' : false,
        adminOverrideBy: avail?.adminOverrideBy || '',
        adminOverrideReason: avail?.adminOverrideReason || '',
        autoResumeAt: avail?.autoResumeAt || '',
        schedule: avail?.scheduleJson ? JSON.parse(avail.scheduleJson) : {},
        updatedAt: avail?.updatedAt || '',
      };
    });

    if (repSlug) {
      const single = result.find(r => r.repSlug === repSlug);
      const response = { success: true, data: single || null };
      cache.set(cacheKey, response, CACHE_TTL.MEDIUM);
      return NextResponse.json(response);
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
    const { repSlug, isReceivingLeads, adminOverride, adminOverrideBy, adminOverrideReason, autoResumeAt, schedule } = body;

    if (!repSlug) {
      return NextResponse.json(
        { success: false, error: 'repSlug is required' },
        { status: 400 }
      );
    }

    // Verify rep exists
    const rep = TEAM_MEMBERS.find(m => m.slug === repSlug);
    if (!rep) {
      return NextResponse.json(
        { success: false, error: 'Rep not found' },
        { status: 404 }
      );
    }

    const success = await googleSheetsService.updateRepAvailability({
      repSlug,
      isReceivingLeads: String(isReceivingLeads ?? true),
      adminOverride: String(adminOverride ?? false),
      adminOverrideBy: adminOverrideBy || '',
      adminOverrideReason: adminOverrideReason || '',
      autoResumeAt: autoResumeAt || '',
      scheduleJson: schedule ? JSON.stringify(schedule) : '{}',
      updatedAt: new Date().toISOString(),
    });

    cache.invalidatePattern('^portal:rep-availability:');
    return NextResponse.json({ success });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
