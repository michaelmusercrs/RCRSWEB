/**
 * Financial Sync to Google Sheets API
 *
 * Syncs ALL financial data to Google Sheets so everything lives on
 * the same spreadsheet. Creates/updates these sheet tabs:
 *   - Financial_Summary  (Monthly P&L)
 *   - Revenue_By_Rep     (Per-rep revenue breakdown)
 *   - Job_Profitability   (Per-job profit/loss)
 *   - Outstanding_Invoices (Unpaid invoices with aging)
 *   - Monthly_Trends      (Trend data for charts)
 *
 * Uses standard accounting terminology compatible with QuickBooks.
 *
 * POST /api/financial/sync-to-sheets
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-service';
import { financialService } from '@/lib/financial-service';
import { invoiceService } from '@/lib/invoice-service';
import { profitabilityService } from '@/lib/profitability-service';
import { googleSheetsService, isGoogleSheetsConfigured } from '@/lib/google-sheets-service';

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuth();
    if (!auth.authenticated) return auth.response;

    // Verify Google Sheets is configured
    if (!isGoogleSheetsConfigured()) {
      return NextResponse.json(
        { error: 'Google Sheets not configured. Check GOOGLE_SERVICE_ACCOUNT_EMAIL, GOOGLE_PRIVATE_KEY, and GOOGLE_SHEETS_ID environment variables.' },
        { status: 503 }
      );
    }

    const syncTimestamp = new Date().toISOString();
    const syncResults: Record<string, { rows: number; status: string }> = {};

    // =========================================================================
    // 1. Financial Summary (Monthly P&L)
    // =========================================================================
    try {
      const monthlyRevenue = await financialService.getRevenueByPeriod('month', 12);

      const summaryData = monthlyRevenue.map(month => {
        const operatingExpenses = Math.round(month.revenue * 0.05 * 100) / 100;
        const netOperatingIncome = Math.round((month.profit - operatingExpenses) * 100) / 100;
        const netMargin = month.revenue > 0
          ? Math.round((netOperatingIncome / month.revenue) * 10000) / 100
          : 0;

        return {
          'Month': month.periodLabel,
          'Gross Revenue': month.revenue.toFixed(2),
          'Cost of Goods Sold (COGS)': month.costs.toFixed(2),
          'Gross Profit': month.profit.toFixed(2),
          'Operating Expenses': operatingExpenses.toFixed(2),
          'Net Operating Income': netOperatingIncome.toFixed(2),
          'Gross Margin %': `${month.margin}%`,
          'Net Margin %': `${netMargin}%`,
          'Job Count': month.jobCount,
          'Avg Job Size': month.avgJobValue.toFixed(2),
          'Last Synced': syncTimestamp,
        };
      });

      await googleSheetsService.syncFinancialSummary(summaryData);
      syncResults['Financial_Summary'] = { rows: summaryData.length, status: 'success' };
    } catch (error) {
      console.error('[Sync] Financial_Summary error:', error);
      syncResults['Financial_Summary'] = { rows: 0, status: `error: ${String(error)}` };
    }

    // =========================================================================
    // 2. Revenue By Rep
    // =========================================================================
    try {
      const revenueByRep = await financialService.getRevenueByRep();

      const repData = revenueByRep.map(rep => ({
        'Sales Rep': rep.repName,
        'Gross Revenue': rep.totalRevenue.toFixed(2),
        'Total Commissions': rep.totalCommissions.toFixed(2),
        'Job Count': rep.jobCount,
        'Avg Job Size': rep.avgJobValue.toFixed(2),
        'Close Rate %': `${rep.closeRate}%`,
        '% of Total Revenue': `${rep.percentOfTotal}%`,
        'Last Synced': syncTimestamp,
      }));

      await googleSheetsService.syncRevenueByRep(repData);
      syncResults['Revenue_By_Rep'] = { rows: repData.length, status: 'success' };
    } catch (error) {
      console.error('[Sync] Revenue_By_Rep error:', error);
      syncResults['Revenue_By_Rep'] = { rows: 0, status: `error: ${String(error)}` };
    }

    // =========================================================================
    // 3. Job Profitability
    // =========================================================================
    try {
      const jobProfitability = await financialService.getJobProfitability();

      // Also merge data from profitability service (job-costs.json) if available
      const jobCosts = await profitabilityService.listJobCosts();

      // Combine both sources, preferring profitability service data (more detailed)
      const combinedJobs: Record<string, string | number>[] = [];

      // Add job-costs.json entries first (more detailed cost breakdowns)
      for (const job of jobCosts) {
        const materialCost = job.materials.reduce((sum, m) => sum + m.totalCost, 0);
        const laborCost = job.labor.reduce((sum, l) => sum + l.totalCost, 0);
        const overheadCost = job.overhead.reduce((sum, o) => sum + o.totalCost, 0)
          + job.other.reduce((sum, o) => sum + o.totalCost, 0);
        const subCost = job.subcontractors.reduce((sum, s) => sum + s.totalCost, 0);
        const totalCOGS = materialCost + laborCost + subCost + overheadCost;

        combinedJobs.push({
          'Job ID': job.jobId,
          'Customer': job.customerName,
          'Gross Revenue': job.totalRevenue.toFixed(2),
          'Material Cost': materialCost.toFixed(2),
          'Labor Cost': laborCost.toFixed(2),
          'Overhead': overheadCost.toFixed(2),
          'Total Cost of Goods Sold (COGS)': totalCOGS.toFixed(2),
          'Gross Profit': job.grossProfit.toFixed(2),
          'Gross Margin %': `${job.grossMargin}%`,
          'Status': job.status,
          'Completed Date': job.status === 'completed' ? job.updatedAt.split('T')[0] : '',
          'Last Synced': syncTimestamp,
        });
      }

      // Add invoice-derived profitability entries (for jobs not in job-costs.json)
      const existingJobIds = new Set(jobCosts.map(j => j.jobId));
      for (const jp of jobProfitability) {
        if (!existingJobIds.has(jp.jobId)) {
          combinedJobs.push({
            'Job ID': jp.jobId,
            'Customer': jp.customerName,
            'Gross Revenue': jp.revenue.toFixed(2),
            'Material Cost': jp.materialCost.toFixed(2),
            'Labor Cost': jp.laborCost.toFixed(2),
            'Overhead': jp.overheadCost.toFixed(2),
            'Total Cost of Goods Sold (COGS)': jp.totalCost.toFixed(2),
            'Gross Profit': jp.profit.toFixed(2),
            'Gross Margin %': `${jp.margin}%`,
            'Status': jp.status,
            'Completed Date': jp.completedDate || '',
            'Last Synced': syncTimestamp,
          });
        }
      }

      await googleSheetsService.syncJobProfitability(combinedJobs);
      syncResults['Job_Profitability'] = { rows: combinedJobs.length, status: 'success' };
    } catch (error) {
      console.error('[Sync] Job_Profitability error:', error);
      syncResults['Job_Profitability'] = { rows: 0, status: `error: ${String(error)}` };
    }

    // =========================================================================
    // 4. Outstanding Invoices (Accounts Receivable Aging)
    // =========================================================================
    try {
      const allInvoices = await invoiceService.getAllInvoices();
      const now = new Date();

      const outstandingInvoices = allInvoices.filter(inv =>
        inv.status !== 'paid' && inv.status !== 'cancelled' && inv.status !== 'draft' &&
        inv.balanceDue > 0
      );

      const invoiceData = outstandingInvoices.map(inv => {
        const dueDate = new Date(inv.dueDate);
        const daysOutstanding = Math.max(0, Math.floor((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24)));

        let agingBucket = 'Current';
        if (daysOutstanding > 90) agingBucket = '90+ Days';
        else if (daysOutstanding > 60) agingBucket = '61-90 Days';
        else if (daysOutstanding > 30) agingBucket = '31-60 Days';
        else if (daysOutstanding > 0) agingBucket = '1-30 Days';

        return {
          'Invoice ID': inv.invoiceId,
          'Customer': inv.customerName,
          'Total Amount': inv.total.toFixed(2),
          'Amount Paid': inv.amountPaid.toFixed(2),
          'Accounts Receivable (Balance Due)': inv.balanceDue.toFixed(2),
          'Due Date': inv.dueDate,
          'Days Outstanding': daysOutstanding,
          'Aging Bucket': agingBucket,
          'Status': inv.status,
          'Last Synced': syncTimestamp,
        };
      });

      await googleSheetsService.syncOutstandingInvoices(invoiceData);
      syncResults['Outstanding_Invoices'] = { rows: invoiceData.length, status: 'success' };
    } catch (error) {
      console.error('[Sync] Outstanding_Invoices error:', error);
      syncResults['Outstanding_Invoices'] = { rows: 0, status: `error: ${String(error)}` };
    }

    // =========================================================================
    // 5. Monthly Trends (for charts)
    // =========================================================================
    try {
      const monthlyRevenue = await financialService.getRevenueByPeriod('month', 12);
      const invoiceAging = await financialService.getInvoiceAging();
      const summary = await financialService.getFinancialSummary();

      // Total AR from aging buckets
      const totalAR = invoiceAging.reduce((sum, b) => sum + b.amount, 0);

      const trendData = monthlyRevenue.map(month => {
        const operatingExpenses = Math.round(month.revenue * 0.05 * 100) / 100;
        const netOperatingIncome = Math.round((month.profit - operatingExpenses) * 100) / 100;
        const netCashFlow = Math.round((month.revenue - month.costs - operatingExpenses) * 100) / 100;

        return {
          'Month': month.periodLabel,
          'Gross Revenue': month.revenue.toFixed(2),
          'Cost of Goods Sold (COGS)': month.costs.toFixed(2),
          'Gross Profit': month.profit.toFixed(2),
          'Net Operating Income': netOperatingIncome.toFixed(2),
          'Gross Margin %': `${month.margin}%`,
          'Job Count': month.jobCount,
          'Accounts Receivable': totalAR.toFixed(2),
          'Accounts Payable': summary.accountsPayable.toFixed(2),
          'Net Cash Flow': netCashFlow.toFixed(2),
          'Last Synced': syncTimestamp,
        };
      });

      await googleSheetsService.syncMonthlyTrends(trendData);
      syncResults['Monthly_Trends'] = { rows: trendData.length, status: 'success' };
    } catch (error) {
      console.error('[Sync] Monthly_Trends error:', error);
      syncResults['Monthly_Trends'] = { rows: 0, status: `error: ${String(error)}` };
    }

    // =========================================================================
    // Build Response
    // =========================================================================
    const totalRowsSynced = Object.values(syncResults).reduce((sum, r) => sum + r.rows, 0);
    const failedSheets = Object.entries(syncResults)
      .filter(([, r]) => r.status.startsWith('error'))
      .map(([name]) => name);

    return NextResponse.json({
      success: failedSheets.length === 0,
      timestamp: syncTimestamp,
      totalRowsSynced,
      sheets: syncResults,
      failedSheets,
      message: failedSheets.length === 0
        ? `Successfully synced ${totalRowsSynced} rows across 5 sheet tabs.`
        : `Synced ${totalRowsSynced} rows. ${failedSheets.length} sheet(s) failed: ${failedSheets.join(', ')}`,
    });
  } catch (error) {
    console.error('[Financial Sync API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to sync financial data to Google Sheets', details: String(error) },
      { status: 500 }
    );
  }
}
