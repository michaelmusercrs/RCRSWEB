/**
 * RCRS Report Configs API
 *
 * GET  /api/reports/configs - List report configurations
 * POST /api/reports/configs - Create a new report config
 * PUT  /api/reports/configs - Update an existing config
 *
 * @author RCRS Development Team
 * @version 1.0.0
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-service';
import { reportGeneratorService } from '@/lib/report-generator-service';

/**
 * GET /api/reports/configs
 */
export async function GET() {
  try {
    const configs = reportGeneratorService.getReportConfigs();

    return NextResponse.json({
      success: true,
      configs,
      total: configs.length,
    });
  } catch (error) {
    console.error('[Reports API] Configs GET error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch report configs' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/reports/configs
 *
 * Body: ReportConfig fields (minus id, createdAt)
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth();
    if (!auth.authenticated) return auth.response;

    const body = await request.json();

    if (!body.name) {
      return NextResponse.json(
        { error: 'Report config name is required' },
        { status: 400 }
      );
    }

    if (!body.type || !['daily', 'weekly', 'monthly', 'custom'].includes(body.type)) {
      return NextResponse.json(
        { error: 'Valid report type is required (daily, weekly, monthly, custom)' },
        { status: 400 }
      );
    }

    const config = reportGeneratorService.createReportConfig({
      name: body.name,
      type: body.type,
      sections: body.sections || [],
      recipients: body.recipients || [],
      schedule: body.schedule || 'manual',
      format: body.format || 'html',
      isActive: body.isActive !== undefined ? body.isActive : true,
      createdBy: body.createdBy || 'user',
    });

    return NextResponse.json({ success: true, config }, { status: 201 });
  } catch (error) {
    console.error('[Reports API] Configs POST error:', error);
    const message = error instanceof Error ? error.message : 'Failed to create config';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * PUT /api/reports/configs
 *
 * Body: { id: string, ...updates }
 */
export async function PUT(request: NextRequest) {
  try {
    const auth = await requireAuth();
    if (!auth.authenticated) return auth.response;

    const body = await request.json();

    if (!body.id) {
      return NextResponse.json(
        { error: 'Config id is required' },
        { status: 400 }
      );
    }

    const { id, ...updates } = body;
    const config = reportGeneratorService.updateReportConfig(id, updates);

    return NextResponse.json({ success: true, config });
  } catch (error) {
    console.error('[Reports API] Configs PUT error:', error);
    const message = error instanceof Error ? error.message : 'Failed to update config';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
