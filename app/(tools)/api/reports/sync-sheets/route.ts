/**
 * RCRS Report Sync to Google Sheets API
 *
 * POST /api/reports/sync-sheets
 *
 * Writes report summary data to a "Reports_Data" sheet tab in Google Sheets.
 * Creates the sheet if it does not exist. Appends a new row for each sync
 * so the user can see report history in their spreadsheet.
 *
 * Body:
 * - type: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'annual' (optional, defaults to 'weekly')
 *
 * @author RCRS Development Team
 * @version 1.0.0
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-service';
import { googleSheetsService, isGoogleSheetsConfigured } from '@/lib/google-sheets-service';

const REPORTS_SHEET_NAME = 'Reports_Data';

const REPORT_HEADERS = [
  'Date',
  'Report Type',
  'Period Start',
  'Period End',
  'Revenue (Period)',
  'Total Transactions',
  'Avg Commission',
  'New Leads',
  'Leads Converted',
  'Conversion Rate',
  'Total Calls',
  'Missed Calls',
  'Missed Rate',
  'Active Jobs',
  'Completed Jobs',
  'Low Stock Items',
  'Inventory Value',
  'Deliveries Completed',
  'On-Time Rate',
  'Avg Rating',
  'Total Reviews',
  'Hours Logged',
  'Weather Events',
  'Active Alerts',
  'Pending Items',
  'Generated At',
];

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth();
    if (!auth.authenticated) return auth.response;

    // Check Google Sheets configuration
    if (!isGoogleSheetsConfigured()) {
      return NextResponse.json(
        { error: 'Google Sheets is not configured. Set GOOGLE_SHEETS_ID, GOOGLE_SERVICE_ACCOUNT_EMAIL, and GOOGLE_PRIVATE_KEY in .env.local' },
        { status: 503 }
      );
    }

    // Parse request body
    let reportType = 'weekly';
    try {
      const body = await request.json();
      if (body.type) {
        reportType = body.type;
      }
    } catch {
      // No body or invalid JSON - use defaults
    }

    // Fetch the master report data from our own API
    const baseUrl = request.nextUrl.origin;
    const reportResponse = await fetch(
      `${baseUrl}/api/reports/master?type=${reportType}`,
      { headers: { 'Content-Type': 'application/json' } }
    );

    if (!reportResponse.ok) {
      const errData = await reportResponse.json().catch(() => ({}));
      return NextResponse.json(
        { error: `Failed to fetch report data: ${(errData as Record<string, string>).error || reportResponse.statusText}` },
        { status: 500 }
      );
    }

    const reportData = await reportResponse.json();
    const { summary, report } = reportData;

    // Initialize Google Sheets
    const initialized = await googleSheetsService.init();
    if (!initialized) {
      return NextResponse.json(
        { error: 'Failed to initialize Google Sheets connection' },
        { status: 503 }
      );
    }

    // Access the underlying doc via a public method
    // We need to use the getOrCreateSheet pattern - call a sync method
    // Since getOrCreateSheet is private, we use the service's init + direct doc access
    // The googleSheetsService exposes methods that use getOrCreateSheet internally
    // We'll write a row using the addRow pattern

    // Use internal doc access - the service is already initialized
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const service = googleSheetsService as any;
    const doc = service.doc;

    if (!doc) {
      return NextResponse.json(
        { error: 'Google Sheets document not available' },
        { status: 503 }
      );
    }

    // Get or create the Reports_Data sheet
    let sheet = doc.sheetsByTitle[REPORTS_SHEET_NAME];
    if (!sheet) {
      sheet = await doc.addSheet({
        title: REPORTS_SHEET_NAME,
        headerValues: REPORT_HEADERS,
        gridProperties: { columnCount: REPORT_HEADERS.length + 5 },
      });
    } else {
      // Ensure headers exist
      try {
        await sheet.loadHeaderRow();
      } catch {
        if (sheet.gridProperties.columnCount < REPORT_HEADERS.length) {
          await sheet.resize({
            rowCount: sheet.gridProperties.rowCount,
            columnCount: REPORT_HEADERS.length + 5,
          });
        }
        await sheet.setHeaderRow(REPORT_HEADERS);
      }
    }

    // Build the row data
    const now = new Date();
    const rowData: Record<string, string | number> = {
      Date: now.toLocaleDateString('en-US'),
      'Report Type': report.meta.type,
      'Period Start': new Date(report.meta.periodStart).toLocaleDateString('en-US'),
      'Period End': new Date(report.meta.periodEnd).toLocaleDateString('en-US'),
      'Revenue (Period)': report.revenue.periodCommissions,
      'Total Transactions': report.revenue.periodTransactions,
      'Avg Commission': report.revenue.avgCommission,
      'New Leads': report.leads.total,
      'Leads Converted': report.leads.converted,
      'Conversion Rate': report.leads.conversionRate + '%',
      'Total Calls': report.calls.total,
      'Missed Calls': report.calls.missed,
      'Missed Rate': report.calls.missedRate + '%',
      'Active Jobs': report.jobProgress.activeJobs,
      'Completed Jobs': report.jobProgress.completedJobs,
      'Low Stock Items': report.inventory.lowStockCount,
      'Inventory Value': report.inventory.estimatedValue,
      'Deliveries Completed': report.deliveries.completed,
      'On-Time Rate': report.deliveries.onTimeRate + '%',
      'Avg Rating': report.customerSatisfaction.avgRating,
      'Total Reviews': report.customerSatisfaction.totalReviews,
      'Hours Logged': report.timeTracking.totalHours,
      'Weather Events': report.weatherEvents.periodEvents,
      'Active Alerts': report.weatherEvents.activeAlerts,
      'Pending Items': summary.pendingItems,
      'Generated At': now.toISOString(),
    };

    // Append the row
    await sheet.addRow(rowData);

    return NextResponse.json({
      success: true,
      message: `Report data synced to Google Sheets (${REPORTS_SHEET_NAME} tab)`,
      reportType: report.meta.type,
      period: report.meta.label,
      syncedAt: now.toISOString(),
      sheetName: REPORTS_SHEET_NAME,
      metrics: {
        revenue: summary.revenueMTD,
        leads: report.leads.total,
        calls: report.calls.total,
        activeJobs: report.jobProgress.activeJobs,
      },
    });
  } catch (error) {
    console.error('[Report Sync Sheets] Error:', error);
    const message =
      error instanceof Error ? error.message : 'Failed to sync report to Google Sheets';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
