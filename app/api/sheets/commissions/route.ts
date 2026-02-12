/**
 * RCRS Google Sheets Commissions API
 *
 * GET /api/sheets/commissions - Get commission data from Google Sheets
 * POST /api/sheets/commissions - Add commission entry to Sheets
 * POST /api/sheets/commissions/import - Import commissions from CSV
 *
 * @author RCRS Development Team
 * @version 1.0.0
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth-service';
import {
  googleSheetsService,
  isGoogleSheetsConfigured,
  CommissionEntry,
  CommissionSummary,
} from '@/lib/google-sheets-service';

interface CommissionsResponse {
  success: boolean;
  data?: {
    entries?: CommissionEntry[];
    summaries?: CommissionSummary[];
    entry?: CommissionEntry;
    totalEntries?: number;
    totalEarned?: number;
    uniqueReps?: number;
  };
  error?: string;
  message?: string;
}

/**
 * GET /api/sheets/commissions
 *
 * Query Parameters:
 * - salesRep: Filter by sales rep name
 * - startDate: Filter by start date (YYYY-MM-DD or MM/DD/YYYY)
 * - endDate: Filter by end date (YYYY-MM-DD or MM/DD/YYYY)
 * - view: 'entries' | 'summaries' (default: 'entries')
 */
export async function GET(request: NextRequest): Promise<NextResponse<CommissionsResponse>> {
  const auth = await requireAdmin();
  if (!auth.authenticated) return auth.response as NextResponse<CommissionsResponse>;

  try {
    if (!isGoogleSheetsConfigured()) {
      return NextResponse.json(
        {
          success: false,
          error: 'Google Sheets not configured',
        },
        { status: 400 }
      );
    }

    const { searchParams } = new URL(request.url);
    const salesRep = searchParams.get('salesRep') || undefined;
    const startDate = searchParams.get('startDate') || undefined;
    const endDate = searchParams.get('endDate') || undefined;
    const view = searchParams.get('view') || 'entries';

    if (view === 'summaries') {
      // Get summary view (grouped by sales rep)
      const summaries = await googleSheetsService.getCommissionSummaries();

      // Filter by sales rep if specified
      const filteredSummaries = salesRep
        ? summaries.filter(s => s.salesRep.toLowerCase() === salesRep.toLowerCase())
        : summaries;

      const totalEarned = filteredSummaries.reduce((sum, s) => sum + s.totalEarned, 0);

      return NextResponse.json({
        success: true,
        data: {
          summaries: filteredSummaries,
          totalEarned,
          uniqueReps: filteredSummaries.length,
        },
      });
    }

    // Get entries view
    const entries = await googleSheetsService.getCommissions({
      salesRep,
      startDate,
      endDate,
    });

    const totalEarned = entries.reduce((sum, e) => sum + e.amount, 0);
    const uniqueReps = new Set(entries.map(e => e.salesRep)).size;

    return NextResponse.json({
      success: true,
      data: {
        entries,
        totalEntries: entries.length,
        totalEarned,
        uniqueReps,
      },
    });
  } catch (error) {
    console.error('GET /api/sheets/commissions error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch commissions',
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/sheets/commissions
 *
 * Add a commission entry or import from CSV
 *
 * Body Option 1 - Single entry:
 * {
 *   salesRep: string,
 *   date: string,
 *   amount: number,
 *   balance?: number,
 *   jobId?: string,
 *   jobName?: string,
 *   description?: string
 * }
 *
 * Body Option 2 - CSV import:
 * {
 *   action: 'import',
 *   csvData: string
 * }
 */
export async function POST(request: NextRequest): Promise<NextResponse<CommissionsResponse>> {
  const auth = await requireAdmin();
  if (!auth.authenticated) return auth.response as NextResponse<CommissionsResponse>;

  try {
    if (!isGoogleSheetsConfigured()) {
      return NextResponse.json(
        {
          success: false,
          error: 'Google Sheets not configured',
        },
        { status: 400 }
      );
    }

    const body = await request.json();

    // Handle CSV import
    if (body.action === 'import' && body.csvData) {
      const result = await googleSheetsService.importCommissionsFromCsv(body.csvData);

      return NextResponse.json({
        success: result.success,
        message: result.success
          ? `Successfully imported ${result.synced} commission entries`
          : `Import completed with errors: ${result.errors.join(', ')}`,
        data: {
          totalEntries: result.synced,
        },
      });
    }

    // Handle single entry
    if (!body.salesRep || !body.date || body.amount === undefined) {
      return NextResponse.json(
        {
          success: false,
          error: 'salesRep, date, and amount are required',
        },
        { status: 400 }
      );
    }

    const entry: CommissionEntry = {
      salesRep: body.salesRep,
      date: body.date,
      amount: parseFloat(body.amount),
      balance: parseFloat(body.balance) || 0,
      jobId: body.jobId || '',
      jobName: body.jobName || '',
      description: body.description || '',
      status: body.status || 'pending',
    };

    const success = await googleSheetsService.addCommissionEntry(entry);

    if (!success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to add commission entry to Google Sheets',
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: { entry },
      message: `Successfully added commission entry for ${entry.salesRep}`,
    });
  } catch (error) {
    console.error('POST /api/sheets/commissions error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to add commission entry',
      },
      { status: 500 }
    );
  }
}
