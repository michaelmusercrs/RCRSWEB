import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth-service';
import { financialService } from '@/lib/financial-service';

export async function GET(request: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.authenticated) return auth.response;

  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');

    switch (action) {
      case 'summary': {
        const summary = await financialService.getFinancialSummary();
        return NextResponse.json({ success: true, data: summary });
      }

      case 'revenue-by-rep': {
        const dateFrom = searchParams.get('dateFrom') || undefined;
        const dateTo = searchParams.get('dateTo') || undefined;
        const data = await financialService.getRevenueByRep(dateFrom, dateTo);
        return NextResponse.json({ success: true, data });
      }

      case 'revenue-by-period': {
        const groupBy = (searchParams.get('groupBy') as 'day' | 'week' | 'month' | 'quarter' | 'year') || 'month';
        const periods = parseInt(searchParams.get('periods') || '12');
        const data = await financialService.getRevenueByPeriod(groupBy, periods);
        return NextResponse.json({ success: true, data });
      }

      case 'invoice-aging': {
        const data = await financialService.getInvoiceAging();
        return NextResponse.json({ success: true, data });
      }

      case 'job-profitability': {
        const status = searchParams.get('status') || undefined;
        const dateFrom = searchParams.get('dateFrom') || undefined;
        const dateTo = searchParams.get('dateTo') || undefined;
        const minMargin = searchParams.get('minMargin') ? parseFloat(searchParams.get('minMargin')!) : undefined;
        const maxMargin = searchParams.get('maxMargin') ? parseFloat(searchParams.get('maxMargin')!) : undefined;

        const data = await financialService.getJobProfitability({
          status,
          dateFrom,
          dateTo,
          minMargin,
          maxMargin,
        });
        return NextResponse.json({ success: true, data });
      }

      case 'budget-vs-actual': {
        const period = searchParams.get('period') || undefined;
        const data = await financialService.getBudgetVsActual(period);
        return NextResponse.json({ success: true, data });
      }

      case 'alerts': {
        const data = await financialService.getFinancialAlerts();
        return NextResponse.json({ success: true, data });
      }

      case 'pending-approvals': {
        const data = await financialService.getPendingApprovals();
        return NextResponse.json({ success: true, data });
      }

      case 'dashboard': {
        // Comprehensive dashboard data for widgets
        // Use Promise.allSettled so partial failures don't kill the whole response
        const [summaryResult, invoiceAgingResult, alertsResult, pendingApprovalsResult, revenueByRepResult] = await Promise.allSettled([
          financialService.getFinancialSummary(),
          financialService.getInvoiceAging(),
          financialService.getFinancialAlerts(),
          financialService.getPendingApprovals(),
          financialService.getRevenueByRep(),
        ]);

        const summary = summaryResult.status === 'fulfilled' ? summaryResult.value : null;
        const invoiceAging = invoiceAgingResult.status === 'fulfilled' ? invoiceAgingResult.value : [];
        const alerts = alertsResult.status === 'fulfilled' ? alertsResult.value : [];
        const pendingApprovals = pendingApprovalsResult.status === 'fulfilled' ? pendingApprovalsResult.value : [];
        const revenueByRep = revenueByRepResult.status === 'fulfilled' ? revenueByRepResult.value : [];

        // Log any failures for debugging
        if (summaryResult.status === 'rejected') {
          console.error('Financial summary failed:', summaryResult.reason);
        }

        return NextResponse.json({
          success: true,
          data: {
            summary: summary || {
              totalRevenue: 0, revenueThisMonth: 0, revenueLastMonth: 0, revenueYTD: 0,
              monthOverMonthGrowth: 0, yearOverYearGrowth: 0, totalCosts: 0,
              materialCosts: 0, laborCosts: 0, operationalCosts: 0,
              grossProfit: 0, netProfit: 0, grossMargin: 0, netMargin: 0,
              pipelineValue: 0, leadsValue: 0, quotedValue: 0, contractedValue: 0,
              accountsReceivable: 0, accountsPayable: 0, outstandingInvoices: 0,
              overdueInvoices: 0, overdueAmount: 0, cashInflow: 0, cashOutflow: 0, netCashFlow: 0,
            },
            invoiceAging,
            alerts: alerts.slice(0, 5),
            pendingApprovals,
            revenueByRep: revenueByRep.slice(0, 10),
            kpis: {
              revenue: {
                value: summary?.revenueThisMonth || 0,
                label: 'Revenue This Month',
                change: summary?.monthOverMonthGrowth || 0,
                trend: (summary?.monthOverMonthGrowth || 0) >= 0 ? 'up' : 'down',
              },
              revenueYTD: {
                value: summary?.revenueYTD || 0,
                label: 'Revenue YTD',
              },
              grossMargin: {
                value: summary?.grossMargin || 0,
                label: 'Gross Margin',
                target: 30,
                status: (summary?.grossMargin || 0) >= 25 ? 'good' : (summary?.grossMargin || 0) >= 20 ? 'warning' : 'critical',
              },
              arAging: {
                current: invoiceAging.find(b => b.bucket === 'current')?.amount || 0,
                overdue: invoiceAging.filter(b => b.bucket !== 'current').reduce((sum, b) => sum + b.amount, 0),
              },
              cashFlow: {
                inflow: summary?.cashInflow || 0,
                outflow: summary?.cashOutflow || 0,
                net: summary?.netCashFlow || 0,
              },
              pipeline: {
                total: summary?.pipelineValue || 0,
                leads: summary?.leadsValue || 0,
                quoted: summary?.quotedValue || 0,
                contracted: summary?.contractedValue || 0,
              },
              profitability: {
                grossProfit: summary?.grossProfit || 0,
                netProfit: summary?.netProfit || 0,
                netMargin: summary?.netMargin || 0,
              },
              totalRevenue: summary?.totalRevenue || 0,
            },
          },
        });
      }

      default:
        return NextResponse.json(
          { success: false, error: 'Invalid action. Valid actions: summary, revenue-by-rep, revenue-by-period, invoice-aging, job-profitability, budget-vs-actual, alerts, pending-approvals, dashboard' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Financial API GET error:', error);
    return NextResponse.json(
      { success: false, error: 'Server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.authenticated) return auth.response;

  try {
    const body = await request.json();
    const { action, ...data } = body;

    switch (action) {
      case 'create-approval': {
        const approval = await financialService.createApprovalRequest({
          type: data.type,
          requestedBy: data.requestedBy,
          requestedByName: data.requestedByName,
          amount: data.amount,
          description: data.description,
          justification: data.justification,
          relatedJobId: data.relatedJobId,
          relatedJobName: data.relatedJobName,
        });

        return NextResponse.json({ success: true, data: approval });
      }

      case 'review-approval': {
        const result = await financialService.reviewApprovalRequest(
          data.requestId,
          data.decision,
          data.reviewedBy,
          data.reviewedByName,
          data.notes
        );

        if (!result) {
          return NextResponse.json(
            { success: false, error: 'Approval request not found' },
            { status: 404 }
          );
        }

        return NextResponse.json({ success: true, data: result });
      }

      default:
        return NextResponse.json(
          { success: false, error: 'Invalid action. Valid actions: create-approval, review-approval' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Financial API POST error:', error);
    return NextResponse.json(
      { success: false, error: 'Server error' },
      { status: 500 }
    );
  }
}
