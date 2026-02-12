import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth-service';
import {
  customerPortalService,
  PortalSettings,
  RepPortalSettings,
} from '@/lib/customer-portal-service';
import { teamMembers } from '@/lib/teamData';

// GET - Returns global settings + all rep-level overrides
export async function GET(request: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.authenticated) return auth.response;

  try {
    // Load global settings
    const globalSettings = await customerPortalService.loadGlobalSettings();

    // Load all rep overrides
    const repOverrides = await customerPortalService.getAllRepSettings();

    // Build rep list from team data (active reps who could have customer portals)
    const activeReps = teamMembers
      .filter(m => m.category !== 'In Loving Memory' && m.slug)
      .map(m => ({
        slug: m.slug,
        name: m.name,
        position: m.position,
        category: m.category,
      }));

    return NextResponse.json({
      success: true,
      globalSettings,
      repOverrides,
      teamMembers: activeReps,
    });
  } catch (error) {
    console.error('Error fetching portal settings:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch portal settings' },
      { status: 500 }
    );
  }
}

// PUT - Update global or rep settings
export async function PUT(request: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.authenticated) return auth.response;

  try {
    const body = await request.json();
    const { type } = body;

    if (type === 'global') {
      const { settings } = body as { type: 'global'; settings: PortalSettings };

      if (!settings) {
        return NextResponse.json(
          { success: false, error: 'Settings object required' },
          { status: 400 }
        );
      }

      await customerPortalService.saveGlobalSettings(settings);

      return NextResponse.json({
        success: true,
        message: 'Global settings updated',
        settings,
      });
    }

    if (type === 'rep') {
      const { repSlug, settings } = body as {
        type: 'rep';
        repSlug: string;
        settings: Partial<RepPortalSettings>;
      };

      if (!repSlug) {
        return NextResponse.json(
          { success: false, error: 'repSlug is required' },
          { status: 400 }
        );
      }

      // Verify rep exists in team data
      const rep = teamMembers.find(m => m.slug === repSlug);
      if (!rep) {
        return NextResponse.json(
          { success: false, error: `Rep "${repSlug}" not found in team data` },
          { status: 404 }
        );
      }

      await customerPortalService.saveRepSettings(repSlug, {
        ...settings,
        repName: rep.name,
        updatedBy: auth.user.name || 'admin',
      });

      // Return effective settings for this rep
      const effectiveSettings = await customerPortalService.getEffectiveSettings(repSlug);

      return NextResponse.json({
        success: true,
        message: `Settings updated for ${rep.name}`,
        effectiveSettings,
      });
    }

    return NextResponse.json(
      { success: false, error: 'Invalid type. Use "global" or "rep".' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Error updating portal settings:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update portal settings' },
      { status: 500 }
    );
  }
}
