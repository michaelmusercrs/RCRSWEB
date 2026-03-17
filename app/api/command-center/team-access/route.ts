import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth-service';
import { googleSheetsService } from '@/lib/google-sheets-service';
import { cache, CACHE_TTL } from '@/lib/cache';
import {
  TEAM_MEMBERS,
  COMMAND_CENTER_ACCESS,
  ALL_COMMAND_CENTER_MODULES,
  getTeamMember,
} from '@/lib/team-roles';

// GET - Returns all team members with their effective access
export async function GET() {
  const auth = await requireAdmin();
  if (!auth.authenticated) return auth.response;

  try {
    const cacheKey = 'cc:team-access';
    const cached = cache.get(cacheKey);
    if (cached) return NextResponse.json(cached, { headers: { 'Cache-Control': 'private, s-maxage=30' } });

    const overrides = await googleSheetsService.getTeamAccessOverrides();

    const overrideMap = new Map<string, Record<string, boolean>>();
    for (const o of overrides) {
      try {
        overrideMap.set(o.memberId, JSON.parse(o.moduleOverrides));
      } catch {
        overrideMap.set(o.memberId, {});
      }
    }

    const members = TEAM_MEMBERS.filter(m => m.isActive).map(member => {
      const defaultAccess = COMMAND_CENTER_ACCESS[member.role] || [];
      const memberOverrides = overrideMap.get(member.id) || {};

      // Calculate effective access
      const effective = new Set(defaultAccess);
      for (const [module, enabled] of Object.entries(memberOverrides)) {
        if (enabled) effective.add(module);
        else effective.delete(module);
      }

      return {
        id: member.id,
        name: member.name,
        slug: member.slug,
        email: member.email,
        phone: member.phone || '',
        role: member.role,
        hasPin: false, // PIN auth removed
        isActive: member.isActive,
        defaultAccess,
        overrides: memberOverrides,
        effectiveAccess: Array.from(effective),
        hasCustomAccess: Object.keys(memberOverrides).length > 0,
        overrideCount: Object.keys(memberOverrides).length,
      };
    });

    const response = { members, allModules: [...ALL_COMMAND_CENTER_MODULES] };
    cache.set(cacheKey, response, CACHE_TTL.TEAM);
    return NextResponse.json(response, { headers: { 'Cache-Control': 'private, s-maxage=30' } });
  } catch (error) {
    console.error('Error fetching team access:', error);
    // Fallback: return members with just role defaults
    const members = TEAM_MEMBERS.filter(m => m.isActive).map(member => ({
      id: member.id,
      name: member.name,
      slug: member.slug,
      email: member.email,
      phone: member.phone || '',
      role: member.role,
      hasPin: false, // PIN auth removed
      isActive: member.isActive,
      defaultAccess: COMMAND_CENTER_ACCESS[member.role] || [],
      overrides: {},
      effectiveAccess: COMMAND_CENTER_ACCESS[member.role] || [],
      hasCustomAccess: false,
      overrideCount: 0,
    }));

    return NextResponse.json({
      members,
      allModules: [...ALL_COMMAND_CENTER_MODULES],
      sheetsUnavailable: true,
    });
  }
}

// PUT - Save access overrides for a member
export async function PUT(request: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.authenticated) return auth.response;

  try {
    const body = await request.json();
    const { memberId, overrides, updatedBy } = body;

    if (!memberId || !updatedBy) {
      return NextResponse.json(
        { error: 'memberId and updatedBy are required' },
        { status: 400 }
      );
    }

    const member = getTeamMember(memberId);
    if (!member) {
      return NextResponse.json(
        { error: 'Member not found' },
        { status: 404 }
      );
    }

    // If overrides is empty or null, delete the override row (reset to defaults)
    if (!overrides || Object.keys(overrides).length === 0) {
      await googleSheetsService.deleteTeamAccessOverride(memberId);
      cache.invalidate('cc:team-access');
      return NextResponse.json({ success: true, action: 'reset' });
    }

    // Save overrides
    const success = await googleSheetsService.saveTeamAccessOverride({
      memberId,
      moduleOverrides: JSON.stringify(overrides),
      customPermissions: '{}',
      updatedBy,
      updatedAt: new Date().toISOString(),
    });

    if (!success) {
      return NextResponse.json(
        { error: 'Failed to save overrides. Google Sheets may be unavailable.' },
        { status: 500 }
      );
    }

    cache.invalidate('cc:team-access');
    return NextResponse.json({ success: true, action: 'saved' });
  } catch (error) {
    console.error('Error saving team access override:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
