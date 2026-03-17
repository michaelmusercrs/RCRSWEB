/**
 * RCRS Report History API
 *
 * GET /api/reports/history - Get report generation history
 *
 * @author RCRS Development Team
 * @version 1.0.0
 */

import { NextRequest, NextResponse } from 'next/server';
import { reportGeneratorService } from '@/lib/report-generator-service';

/**
 * GET /api/reports/history
 *
 * Query params:
 * - limit: number of reports to return (default: 20)
 * - type: filter by report type (daily, weekly, monthly, custom)
 * - startDate: filter reports generated after this date (ISO string)
 * - id: get a specific report by ID
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limitStr = searchParams.get('limit');
    const type = searchParams.get('type');
    const startDate = searchParams.get('startDate');
    const id = searchParams.get('id');

    // Single report lookup
    if (id) {
      const report = reportGeneratorService.getReport(id);
      if (!report) {
        return NextResponse.json(
          { error: 'Report not found' },
          { status: 404 }
        );
      }
      return NextResponse.json({ success: true, report });
    }

    // Get history with optional limit
    const limit = limitStr ? parseInt(limitStr, 10) : 20;
    let reports = reportGeneratorService.getReportHistory(limit);

    // Filter by type if specified
    if (type) {
      reports = reports.filter((r) => r.type === type);
    }

    // Filter by start date if specified
    if (startDate) {
      const filterDate = new Date(startDate);
      reports = reports.filter(
        (r) => new Date(r.generatedAt) >= filterDate
      );
    }

    return NextResponse.json({
      success: true,
      reports: reports.map((r) => ({
        id: r.id,
        configId: r.configId,
        reportName: r.reportName,
        type: r.type,
        period: r.period,
        generatedAt: r.generatedAt,
        generatedBy: r.generatedBy,
        sentTo: r.sentTo,
        sentAt: r.sentAt,
      })),
      total: reports.length,
    });
  } catch (error) {
    console.error('[Reports API] History GET error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch report history' },
      { status: 500 }
    );
  }
}
