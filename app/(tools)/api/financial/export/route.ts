/**
 * Financial Data Export API
 *
 * Exports financial data as CSV for download. Uses standard accounting
 * terminology compatible with QuickBooks.
 *
 * GET /api/financial/export
 *   - ?type=commissions|invoices|profitability|summary  (required)
 *   - ?format=csv                                        (default: csv)
 *   - ?dateFrom=YYYY-MM-DD                               (optional)
 *   - ?dateTo=YYYY-MM-DD                                 (optional)
 */

import { NextRequest, NextResponse } from 'next/server';
import { financialService } from '@/lib/financial-service';
import { invoiceService } from '@/lib/invoice-service';
import { profitabilityService } from '@/lib/profitability-service';

// Escape CSV field: wrap in quotes if it contains commas, quotes, or newlines
function csvEscape(value: string | number | undefined | null): string {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function toCsv(headers: string[], rows: (string | number | undefined | null)[][]): string {
  const headerLine = headers.map(csvEscape).join(',');
  const dataLines = rows.map(row => row.map(csvEscape).join(','));
  return [headerLine, ...dataLines].join('\n');
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const type = searchParams.get('type');
    const dateFrom = searchParams.get('dateFrom') || undefined;
    const dateTo = searchParams.get('dateTo') || undefined;

    if (!type || !['commissions', 'invoices', 'profitability', 'summary'].includes(type)) {
      return NextResponse.json(
        { error: 'Missing or invalid "type" parameter. Must be: commissions, invoices, profitability, or summary' },
        { status: 400 }
      );
    }

    let csvContent = '';
    let filename = '';

    switch (type) {
      // =====================================================================
      // COMMISSIONS EXPORT
      // =====================================================================
      case 'commissions': {
        const revenueByRep = await financialService.getRevenueByRep(dateFrom, dateTo);

        const headers = [
          'Sales Rep',
          'Gross Revenue',
          'Total Commissions Earned',
          'Job Count',
          'Average Job Size',
          'Estimated Close Rate %',
          '% of Total Gross Revenue',
        ];

        const rows = revenueByRep.map(rep => [
          rep.repName,
          rep.totalRevenue.toFixed(2),
          rep.totalCommissions.toFixed(2),
          rep.jobCount,
          rep.avgJobValue.toFixed(2),
          `${rep.closeRate}%`,
          `${rep.percentOfTotal}%`,
        ]);

        // Add total row
        const totalRevenue = revenueByRep.reduce((sum, r) => sum + r.totalRevenue, 0);
        const totalCommissions = revenueByRep.reduce((sum, r) => sum + r.totalCommissions, 0);
        const totalJobs = revenueByRep.reduce((sum, r) => sum + r.jobCount, 0);
        rows.push([
          'TOTAL',
          totalRevenue.toFixed(2),
          totalCommissions.toFixed(2),
          totalJobs,
          totalJobs > 0 ? (totalRevenue / totalJobs).toFixed(2) : '0.00',
          '',
          '100%',
        ]);

        csvContent = toCsv(headers, rows);
        filename = `rcrs-commissions-by-rep-${new Date().toISOString().split('T')[0]}.csv`;
        break;
      }

      // =====================================================================
      // INVOICES EXPORT (Accounts Receivable)
      // =====================================================================
      case 'invoices': {
        const allInvoices = await invoiceService.getAllInvoices();
        const now = new Date();

        const headers = [
          'Invoice ID',
          'Customer Name',
          'Job ID',
          'Invoice Type',
          'Status',
          'Total Amount',
          'Amount Paid',
          'Accounts Receivable (Balance Due)',
          'Due Date',
          'Days Outstanding',
          'Aging Bucket',
          'Terms',
          'Created Date',
          'Paid Date',
        ];

        const rows = allInvoices.map(inv => {
          const dueDate = new Date(inv.dueDate);
          const daysOutstanding = inv.status === 'paid' ? 0
            : Math.max(0, Math.floor((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24)));

          let agingBucket = 'Current';
          if (inv.status === 'paid') agingBucket = 'Paid';
          else if (inv.status === 'cancelled') agingBucket = 'Cancelled';
          else if (daysOutstanding > 90) agingBucket = '90+ Days';
          else if (daysOutstanding > 60) agingBucket = '61-90 Days';
          else if (daysOutstanding > 30) agingBucket = '31-60 Days';
          else if (daysOutstanding > 0) agingBucket = '1-30 Days';

          return [
            inv.invoiceId,
            inv.customerName,
            inv.jobId,
            inv.type,
            inv.status,
            inv.total.toFixed(2),
            inv.amountPaid.toFixed(2),
            inv.balanceDue.toFixed(2),
            inv.dueDate,
            daysOutstanding,
            agingBucket,
            inv.terms,
            inv.createdAt.split('T')[0],
            inv.paidAt ? inv.paidAt.split('T')[0] : '',
          ];
        });

        // Add summary rows
        const totalInvoiced = allInvoices.reduce((sum, inv) => sum + Math.abs(inv.total), 0);
        const totalPaid = allInvoices.reduce((sum, inv) => sum + inv.amountPaid, 0);
        const totalAR = allInvoices.reduce((sum, inv) => sum + Math.max(0, inv.balanceDue), 0);

        rows.push([]);
        rows.push([
          'SUMMARY',
          `${allInvoices.length} Invoices`,
          '',
          '',
          '',
          totalInvoiced.toFixed(2),
          totalPaid.toFixed(2),
          totalAR.toFixed(2),
          '',
          '',
          '',
          '',
          '',
          '',
        ]);

        csvContent = toCsv(headers, rows);
        filename = `rcrs-accounts-receivable-${new Date().toISOString().split('T')[0]}.csv`;
        break;
      }

      // =====================================================================
      // PROFITABILITY EXPORT
      // =====================================================================
      case 'profitability': {
        // Combine data from both profitability sources
        const jobCosts = profitabilityService.listJobCosts();
        const invoiceJobs = await financialService.getJobProfitability({
          dateFrom,
          dateTo,
        });

        const headers = [
          'Job ID',
          'Customer Name',
          'Gross Revenue',
          'Material Cost',
          'Labor Cost',
          'Subcontractor Cost',
          'Overhead / Other',
          'Total Cost of Goods Sold (COGS)',
          'Gross Profit',
          'Gross Margin %',
          'Commission Rate',
          'Commission Amount',
          'Net Operating Income',
          'Net Margin %',
          'Status',
          'Date',
        ];

        const rows: (string | number | undefined | null)[][] = [];

        // job-costs.json entries (detailed)
        for (const job of jobCosts) {
          const materialCost = job.materials.reduce((sum, m) => sum + m.totalCost, 0);
          const laborCost = job.labor.reduce((sum, l) => sum + l.totalCost, 0);
          const subCost = job.subcontractors.reduce((sum, s) => sum + s.totalCost, 0);
          const overheadCost = job.overhead.reduce((sum, o) => sum + o.totalCost, 0)
            + job.other.reduce((sum, o) => sum + o.totalCost, 0);
          const totalCOGS = materialCost + laborCost + subCost + overheadCost;
          const netIncome = job.totalRevenue - totalCOGS - job.commissionAmount;

          rows.push([
            job.jobId,
            job.customerName,
            job.totalRevenue.toFixed(2),
            materialCost.toFixed(2),
            laborCost.toFixed(2),
            subCost.toFixed(2),
            overheadCost.toFixed(2),
            totalCOGS.toFixed(2),
            job.grossProfit.toFixed(2),
            `${job.grossMargin}%`,
            `${(job.commissionRate * 100).toFixed(1)}%`,
            job.commissionAmount.toFixed(2),
            netIncome.toFixed(2),
            job.totalRevenue > 0
              ? `${(Math.round((netIncome / job.totalRevenue) * 10000) / 100)}%`
              : '0%',
            job.status,
            job.createdAt.split('T')[0],
          ]);
        }

        // Invoice-derived entries (for jobs not in job-costs.json)
        const existingJobIds = new Set(jobCosts.map(j => j.jobId));
        for (const jp of invoiceJobs) {
          if (!existingJobIds.has(jp.jobId)) {
            rows.push([
              jp.jobId,
              jp.customerName,
              jp.revenue.toFixed(2),
              jp.materialCost.toFixed(2),
              jp.laborCost.toFixed(2),
              '0.00', // No sub breakdown from invoices
              jp.overheadCost.toFixed(2),
              jp.totalCost.toFixed(2),
              jp.profit.toFixed(2),
              `${jp.margin}%`,
              '', // No commission from invoice data
              '',
              jp.profit.toFixed(2),
              `${jp.margin}%`,
              jp.status,
              jp.completedDate || '',
            ]);
          }
        }

        // Summary
        const totalRevenue = rows.reduce((sum, r) => sum + (parseFloat(String(r[2])) || 0), 0);
        const totalCOGS = rows.reduce((sum, r) => sum + (parseFloat(String(r[7])) || 0), 0);
        const totalGP = rows.reduce((sum, r) => sum + (parseFloat(String(r[8])) || 0), 0);

        rows.push([]);
        rows.push([
          'TOTAL',
          `${rows.length - 1} Jobs`,
          totalRevenue.toFixed(2),
          '', '', '', '',
          totalCOGS.toFixed(2),
          totalGP.toFixed(2),
          totalRevenue > 0 ? `${(Math.round((totalGP / totalRevenue) * 10000) / 100)}%` : '0%',
          '', '', '', '',
          '',
          '',
        ]);

        csvContent = toCsv(headers, rows);
        filename = `rcrs-job-profitability-${new Date().toISOString().split('T')[0]}.csv`;
        break;
      }

      // =====================================================================
      // FINANCIAL SUMMARY EXPORT (P&L)
      // =====================================================================
      case 'summary': {
        const monthlyRevenue = await financialService.getRevenueByPeriod('month', 12);
        const summary = await financialService.getFinancialSummary();

        const headers = [
          'Period',
          'Gross Revenue',
          'Cost of Goods Sold (COGS)',
          'Gross Profit',
          'Gross Margin %',
          'Operating Expenses',
          'Net Operating Income',
          'Net Margin %',
          'Job Count',
          'Average Job Size',
        ];

        const rows: (string | number | undefined | null)[][] = monthlyRevenue.map(month => {
          const opex = Math.round(month.revenue * 0.05 * 100) / 100;
          const netIncome = Math.round((month.profit - opex) * 100) / 100;
          const netMargin = month.revenue > 0
            ? Math.round((netIncome / month.revenue) * 10000) / 100
            : 0;

          return [
            month.periodLabel,
            month.revenue.toFixed(2),
            month.costs.toFixed(2),
            month.profit.toFixed(2),
            `${month.margin}%`,
            opex.toFixed(2),
            netIncome.toFixed(2),
            `${netMargin}%`,
            month.jobCount,
            month.avgJobValue.toFixed(2),
          ];
        });

        // YTD Summary row
        rows.push([]);
        rows.push([
          'YTD TOTAL',
          summary.revenueYTD.toFixed(2),
          (summary.materialCosts + summary.laborCosts).toFixed(2),
          summary.grossProfit.toFixed(2),
          `${summary.grossMargin}%`,
          summary.operationalCosts.toFixed(2),
          summary.netProfit.toFixed(2),
          `${summary.netMargin}%`,
          '',
          '',
        ]);

        // AR/AP section
        rows.push([]);
        rows.push(['BALANCE SHEET ITEMS', '', '', '', '', '', '', '', '', '']);
        rows.push(['Accounts Receivable', summary.accountsReceivable.toFixed(2), '', '', '', '', '', '', '', '']);
        rows.push(['Accounts Payable', summary.accountsPayable.toFixed(2), '', '', '', '', '', '', '', '']);
        rows.push(['Pipeline Value', summary.pipelineValue.toFixed(2), '', '', '', '', '', '', '', '']);
        rows.push([]);
        rows.push(['CASH FLOW', '', '', '', '', '', '', '', '', '']);
        rows.push(['Cash Inflow (This Month)', summary.cashInflow.toFixed(2), '', '', '', '', '', '', '', '']);
        rows.push(['Cash Outflow (This Month)', summary.cashOutflow.toFixed(2), '', '', '', '', '', '', '', '']);
        rows.push(['Net Cash Flow', summary.netCashFlow.toFixed(2), '', '', '', '', '', '', '', '']);

        csvContent = toCsv(headers, rows);
        filename = `rcrs-financial-summary-${new Date().toISOString().split('T')[0]}.csv`;
        break;
      }

      default:
        return NextResponse.json(
          { error: 'Invalid export type' },
          { status: 400 }
        );
    }

    // Return CSV response
    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-cache',
      },
    });
  } catch (error) {
    console.error('[Financial Export API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to export financial data', details: String(error) },
      { status: 500 }
    );
  }
}
