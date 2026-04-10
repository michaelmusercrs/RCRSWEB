/**
 * RCRS Report Generation API
 *
 * GET  /api/reports/generate - Generate a report by type or configId
 * POST /api/reports/generate - Generate custom report with date range and sections
 *
 * @author RCRS Development Team
 * @version 1.0.0
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-service';
import { reportGeneratorService } from '@/lib/report-generator-service';

/**
 * GET /api/reports/generate
 *
 * Query params:
 * - type: 'daily' | 'weekly' | 'monthly' (uses default config)
 * - configId: specific config ID to use
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');
    const configId = searchParams.get('configId');

    let report;

    if (configId) {
      report = reportGeneratorService.generateReport(configId);
    } else if (type === 'daily') {
      report = reportGeneratorService.generateDailyReport();
    } else if (type === 'weekly') {
      report = reportGeneratorService.generateWeeklyReport();
    } else if (type === 'monthly') {
      // Use weekly config with monthly date range for now
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      report = reportGeneratorService.generateReport('config-weekly', {
        start: monthStart.toISOString(),
        end: now.toISOString(),
      });
    } else {
      return NextResponse.json(
        { error: 'Please specify type (daily|weekly|monthly) or configId' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      report: {
        id: report.id,
        reportName: report.reportName,
        type: report.type,
        period: report.period,
        generatedAt: report.generatedAt,
        data: report.data,
        sentTo: report.sentTo,
      },
      htmlContent: report.htmlContent,
    });
  } catch (error) {
    console.error('[Reports API] Generate GET error:', error);
    const message = error instanceof Error ? error.message : 'Failed to generate report';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * POST /api/reports/generate
 *
 * Body:
 * - configId?: string - use an existing config
 * - name?: string - report name for custom
 * - type?: string - report type label
 * - sections?: ReportSection[] - specific sections to include
 * - dateRange: { start: string; end: string } - custom date range
 * - recipients?: string[] - email recipients
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth();
    if (!auth.authenticated) return auth.response;

    const body = await request.json();

    // If configId provided, generate from config with custom date range
    if (body.configId) {
      const report = reportGeneratorService.generateReport(
        body.configId,
        body.dateRange || undefined
      );

      return NextResponse.json({
        success: true,
        report: {
          id: report.id,
          reportName: report.reportName,
          type: report.type,
          period: report.period,
          generatedAt: report.generatedAt,
          data: report.data,
          sentTo: report.sentTo,
        },
        htmlContent: report.htmlContent,
      });
    }

    // Custom report: create a temporary config and generate
    if (!body.dateRange?.start || !body.dateRange?.end) {
      return NextResponse.json(
        { error: 'dateRange with start and end is required for custom reports' },
        { status: 400 }
      );
    }

    // Build default sections if none provided
    const defaultSections = [
      { id: 'cs1', name: 'Sales Summary', type: 'sales_summary' as const, enabled: true, order: 1 },
      { id: 'cs2', name: 'Lead Activity', type: 'lead_activity' as const, enabled: true, order: 2 },
      { id: 'cs3', name: 'Call Stats', type: 'call_stats' as const, enabled: true, order: 3 },
      { id: 'cs4', name: 'Delivery Status', type: 'delivery_status' as const, enabled: true, order: 4 },
      { id: 'cs5', name: 'Open Items', type: 'open_items' as const, enabled: true, order: 5 },
    ];

    // Create temp config
    const tempConfig = reportGeneratorService.createReportConfig({
      name: body.name || 'Custom Report',
      type: body.type || 'custom',
      sections: body.sections || defaultSections,
      recipients: body.recipients || [],
      schedule: 'manual',
      format: 'html',
      isActive: false, // Don't save as a recurring config
      createdBy: body.createdBy || 'user',
    });

    const report = reportGeneratorService.generateReport(
      tempConfig.id,
      body.dateRange
    );

    return NextResponse.json({
      success: true,
      report: {
        id: report.id,
        reportName: report.reportName,
        type: report.type,
        period: report.period,
        generatedAt: report.generatedAt,
        data: report.data,
        sentTo: report.sentTo,
      },
      htmlContent: report.htmlContent,
    });
  } catch (error) {
    console.error('[Reports API] Generate POST error:', error);
    const message = error instanceof Error ? error.message : 'Failed to generate custom report';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
