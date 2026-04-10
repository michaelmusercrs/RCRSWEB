/**
 * Inspection Templates API — /api/inspections/templates
 *
 * GET:  List all templates
 * POST: Create a custom template
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-service';
import { inspectionService } from '@/lib/inspection-service';

export const dynamic = 'force-dynamic';

/**
 * GET /api/inspections/templates
 */
export async function GET() {
  try {
    const templates = inspectionService.getTemplates();
    return NextResponse.json({ templates });
  } catch (error: any) {
    console.error('[API] GET /api/inspections/templates error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch templates' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/inspections/templates
 * Body: { name, description, sections, estimatedMinutes, createdBy }
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth();
    if (!auth.authenticated) return auth.response;

    const body = await request.json();
    const { name, description, sections, estimatedMinutes, createdBy } = body;

    if (!name || !description) {
      return NextResponse.json(
        { error: 'name and description are required' },
        { status: 400 }
      );
    }
    if (!sections || !Array.isArray(sections) || sections.length === 0) {
      return NextResponse.json(
        { error: 'At least one section is required' },
        { status: 400 }
      );
    }

    const template = inspectionService.createTemplate({
      name,
      description,
      sections,
      estimatedMinutes: estimatedMinutes || 30,
      createdBy: createdBy || 'admin',
    });

    return NextResponse.json(template, { status: 201 });
  } catch (error: any) {
    console.error('[API] POST /api/inspections/templates error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create template' },
      { status: 500 }
    );
  }
}
