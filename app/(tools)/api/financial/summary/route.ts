/**
 * Financial Summary API - Unified Financial Dashboard
 *
 * Aggregates ALL financial data from commissions, invoices, job costs,
 * and profitability services into a single comprehensive response.
 *
 * Uses standard accounting terminology compatible with QuickBooks.
 *
 * GET /api/financial/summary
 *   - ?dateFrom=YYYY-MM-DD  (optional)
 *   - ?dateTo=YYYY-MM-DD    (optional)
 */

import { NextRequest, NextResponse } from 'next/server';
import { financialService } from '@/lib/financial-service';
import { invoiceService } from '@/lib/invoice-service';
import { profitabilityService } from '@/lib/profitability-service';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const dateFrom = searchParams.get('dateFrom') || undefined;
    const dateTo = searchParams.get('dateTo') || undefined;

    // Fetch all financial data in parallel
    const [
      financialSummary,
      revenueByRep,
      monthlyRevenue,
      invoiceAging,
      jobProfitability,
      financialAlerts,
      allInvoices,
    ] = await Promise.all([
      financialService.getFinancialSummary(),
      financialService.getRevenueByRep(dateFrom, dateTo),
      financialService.getRevenueByPeriod('month', 12),
      financialService.getInvoiceAging(),
      financialService.getJobProfitability({
        dateFrom,
        dateTo,
      }),
      financialService.getFinancialAlerts(),
      invoiceService.getAllInvoices(),
    ]);

    // Profitability analytics from Job_Costs sheet tab
    const profitabilityAnalytics = await profitabilityService.getAnalytics(dateFrom, dateTo);

    // Build invoice summary
    const paidInvoices = allInvoices.filter(inv => inv.status === 'paid');
    const outstandingInvoices = allInvoices.filter(inv =>
      inv.status !== 'paid' && inv.status !== 'cancelled' && inv.status !== 'draft' &&
      inv.balanceDue > 0
    );
    const overdueInvoices = outstandingInvoices.filter(inv => {
      const due = new Date(inv.dueDate);
      return due < new Date();
    });

    const invoiceSummary = {
      totalInvoices: allInvoices.length,
      paidCount: paidInvoices.length,
      paidAmount: Math.round(paidInvoices.reduce((sum, inv) => sum + inv.amountPaid, 0) * 100) / 100,
      outstandingCount: outstandingInvoices.length,
      accountsReceivable: Math.round(outstandingInvoices.reduce((sum, inv) => sum + inv.balanceDue, 0) * 100) / 100,
      overdueCount: overdueInvoices.length,
      overdueAmount: Math.round(overdueInvoices.reduce((sum, inv) => sum + inv.balanceDue, 0) * 100) / 100,
    };

    // Build rep performance summary
    const repPerformance = revenueByRep.map(rep => ({
      repName: rep.repName,
      grossRevenue: rep.totalRevenue,
      totalCommissions: rep.totalCommissions,
      jobCount: rep.jobCount,
      avgJobSize: rep.avgJobValue,
      closeRate: rep.closeRate,
      percentOfTotal: rep.percentOfTotal,
    }));

    // Build monthly P&L breakdown (last 12 months)
    const monthlyBreakdown = monthlyRevenue.map(month => {
      // Estimate COGS breakdown for each month
      const cogs = month.costs;
      const operatingExpenses = Math.round(month.revenue * 0.05 * 100) / 100; // 5% overhead estimate
      const netOperatingIncome = Math.round((month.profit - operatingExpenses) * 100) / 100;

      return {
        period: month.period,
        periodLabel: month.periodLabel,
        grossRevenue: month.revenue,
        costOfGoodsSold: cogs,
        grossProfit: month.profit,
        operatingExpenses,
        netOperatingIncome,
        grossMargin: month.margin,
        netMargin: month.revenue > 0
          ? Math.round((netOperatingIncome / month.revenue) * 10000) / 100
          : 0,
        jobCount: month.jobCount,
        avgJobSize: month.avgJobValue,
      };
    });

    // Cash flow summary
    const cashFlow = {
      cashInflow: financialSummary.cashInflow,
      cashOutflow: financialSummary.cashOutflow,
      netCashFlow: financialSummary.netCashFlow,
      accountsReceivable: financialSummary.accountsReceivable,
      accountsPayable: financialSummary.accountsPayable,
    };

    // Build response using proper accounting terminology
    const response = {
      timestamp: new Date().toISOString(),
      dateRange: {
        from: dateFrom || 'all-time',
        to: dateTo || 'present',
      },

      // Income Statement (P&L)
      incomeStatement: {
        grossRevenue: financialSummary.totalRevenue,
        revenueThisMonth: financialSummary.revenueThisMonth,
        revenueLastMonth: financialSummary.revenueLastMonth,
        revenueYTD: financialSummary.revenueYTD,
        monthOverMonthGrowth: financialSummary.monthOverMonthGrowth,
        yearOverYearGrowth: financialSummary.yearOverYearGrowth,
        costOfGoodsSold: financialSummary.materialCosts + financialSummary.laborCosts,
        materialCosts: financialSummary.materialCosts,
        laborCosts: financialSummary.laborCosts,
        grossProfit: financialSummary.grossProfit,
        grossMargin: financialSummary.grossMargin,
        operatingExpenses: financialSummary.operationalCosts,
        netOperatingIncome: financialSummary.netProfit,
        netMargin: financialSummary.netMargin,
      },

      // Balance Sheet items
      balanceSheet: {
        accountsReceivable: invoiceSummary.accountsReceivable,
        accountsPayable: financialSummary.accountsPayable,
        pipelineValue: financialSummary.pipelineValue,
      },

      // Cash Flow
      cashFlow,

      // Invoice / AR Details
      invoices: invoiceSummary,

      // Aging Report
      aging: invoiceAging,

      // Rep Performance
      repPerformance,

      // Monthly P&L Breakdown
      monthlyBreakdown,

      // Job Profitability
      jobProfitability: jobProfitability.slice(0, 50), // Top 50 jobs

      // Profitability Analytics (from job-costs.json)
      profitabilityAnalytics: {
        totalJobs: profitabilityAnalytics.totalJobs,
        totalRevenue: profitabilityAnalytics.totalRevenue,
        totalCosts: profitabilityAnalytics.totalCosts,
        totalProfit: profitabilityAnalytics.totalProfit,
        avgGrossMargin: profitabilityAnalytics.avgGrossMargin,
        avgNetMargin: profitabilityAnalytics.avgNetMargin,
        byRep: profitabilityAnalytics.byRep,
        byMonth: profitabilityAnalytics.byMonth,
        mostProfitable: profitabilityAnalytics.mostProfitable,
        leastProfitable: profitabilityAnalytics.leastProfitable,
      },

      // Financial Alerts
      alerts: financialAlerts,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('[Financial Summary API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to generate financial summary', details: String(error) },
      { status: 500 }
    );
  }
}
