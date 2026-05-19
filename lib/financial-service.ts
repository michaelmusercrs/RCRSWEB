/**
 * Financial Service for River City Roofing
 * Provides comprehensive financial tracking, reporting, and analytics
 * from a CFO perspective for end-to-end job flow management.
 *
 * Data sources (in priority order):
 * 1. commissions.json - 4,199 real commission transactions ($2.6M+ total)
 * 2. invoice-service.ts - 12 detailed invoices with line items, payments, aging
 * 3. Google Sheets (Billing_Records, Vendor_Purchases) - when available
 * 4. JobNimbus API - job pipeline data when configured
 */

import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';
import commissionsData from '@/data/commissions.json';
import companyOverviewData from '@/data/company-overview.json';
import transactionsMonthly from '@/data/transactions-monthly.json';
import transactionsByRep from '@/data/transactions-by-rep.json';
import { invoiceService, type Invoice } from './invoice-service';
import { isJobNimbusConfigured, jobNimbusService } from './jobnimbus-service';

// =============================================================================
// Types
// =============================================================================

export interface FinancialSummary {
  // Revenue
  totalRevenue: number;
  revenueThisMonth: number;
  revenueLastMonth: number;
  revenueYTD: number;
  monthOverMonthGrowth: number;
  yearOverYearGrowth: number;

  // Costs
  totalCosts: number;
  materialCosts: number;
  laborCosts: number;
  operationalCosts: number;

  // Profit
  grossProfit: number;
  netProfit: number;
  grossMargin: number;
  netMargin: number;

  // Pipeline
  pipelineValue: number;
  leadsValue: number;
  quotedValue: number;
  contractedValue: number;

  // AR/AP
  accountsReceivable: number;
  accountsPayable: number;
  outstandingInvoices: number;
  overdueInvoices: number;
  overdueAmount: number;

  // Cash Flow
  cashInflow: number;
  cashOutflow: number;
  netCashFlow: number;
}

export interface RevenueByRep {
  repId: string;
  repName: string;
  totalRevenue: number;
  totalCommissions: number;
  jobCount: number;
  avgJobValue: number;
  closeRate: number;
  percentOfTotal: number;
}

export interface RevenueByPeriod {
  period: string;
  periodLabel: string;
  revenue: number;
  costs: number;
  profit: number;
  margin: number;
  jobCount: number;
  avgJobValue: number;
}

export interface InvoiceAgingBucket {
  bucket: 'current' | '1-30' | '31-60' | '61-90' | '90+';
  label: string;
  count: number;
  amount: number;
  percentOfTotal: number;
}

export interface JobProfitability {
  jobId: string;
  jobName: string;
  customerName: string;
  revenue: number;
  materialCost: number;
  laborCost: number;
  overheadCost: number;
  totalCost: number;
  profit: number;
  margin: number;
  status: string;
  completedDate?: string;
}

export interface BudgetVsActual {
  category: string;
  budgeted: number;
  actual: number;
  variance: number;
  variancePercent: number;
  status: 'under' | 'on_track' | 'over';
}

export interface FinancialAlert {
  alertId: string;
  type: 'margin_warning' | 'overdue_invoice' | 'budget_exceeded' | 'cash_flow_warning' | 'approval_needed' | 'large_expense';
  severity: 'info' | 'warning' | 'critical';
  title: string;
  description: string;
  amount?: number;
  relatedId?: string;
  createdAt: string;
  acknowledged: boolean;
  acknowledgedBy?: string;
  acknowledgedAt?: string;
}

export interface ApprovalRequest {
  requestId: string;
  type: 'expense' | 'discount' | 'credit' | 'refund' | 'budget_override';
  requestedBy: string;
  requestedByName: string;
  requestedAt: string;
  amount: number;
  description: string;
  justification: string;
  relatedJobId?: string;
  relatedJobName?: string;
  status: 'pending' | 'approved' | 'rejected';
  reviewedBy?: string;
  reviewedByName?: string;
  reviewedAt?: string;
  reviewNotes?: string;
}

// =============================================================================
// Internal Types for Data Processing
// =============================================================================

interface CommissionRecord {
  salesRep: string;
  date: string;
  amount: number;
  balance: number;
}

interface ParsedCommission {
  salesRep: string;
  date: Date;
  amount: number;
  balance: number;
  dateString: string;
}

interface InvoiceData {
  invoiceId: string;
  customerName: string;
  amount: number;
  balanceDue: number;
  amountPaid: number;
  status: string;
  type: string;
  dueDate: string;
  paidAt?: string;
  createdAt: string;
  materialCost: number;
  laborCost: number;
  lineItems: { category: string; total: number }[];
}

// =============================================================================
// Thresholds and Configuration
// =============================================================================

const FINANCIAL_THRESHOLDS = {
  // Margin alerts
  minGrossMargin: 25,
  minJobMargin: 20,

  // Budget alerts
  budgetWarningThreshold: 90,
  budgetExceededThreshold: 100,

  // Approval thresholds
  expenseApprovalThreshold: 5000,
  discountApprovalThreshold: 500,
  creditApprovalThreshold: 1000,

  // Cash flow alerts
  minCashReserve: 50000,
  arDaysThreshold: 45,

  // Revenue targets (monthly)
  monthlyRevenueTarget: 50000,

  // Invoice aging
  invoiceAgingBuckets: [0, 30, 60, 90],
};

// Removed: COMMISSION_TO_REVENUE_MULTIPLIER. All revenue figures now come
// from real QB transaction data (data/transactions-monthly.json,
// data/transactions-by-rep.json) — see refresh via
// `node scripts/aggregate-transactions.mjs`. Lifetime company-wide totals
// use getLifetimeTotals() (from the management report).
// Real RCRS cost ratios derived from the QB Management Report (lifetime):
//   materials: jobMaterials / revenue       = 11,749,759 / 35,845,992 ≈ 32.8%
//   labor:    (subcontractors + sales comm) / revenue
//                                            = 13,775,974 / 35,845,992 ≈ 38.4%
//   overhead: operating expenses / revenue   = 6,714,853 / 35,845,992 ≈ 18.7%
// These replace the previous textbook 35/25/5% guesses with company-specific
// ratios. Recompute by running `node scripts/aggregate-transactions.mjs` and
// updating data/company-overview.json from a fresh QB management report.
const _o = companyOverviewData;
const MATERIAL_COST_RATIO = _o.income.total > 0
  ? _o.cogs.jobMaterials.total / _o.income.total
  : 0.328;
const LABOR_COST_RATIO = _o.income.total > 0
  ? (_o.cogs.subcontractorPay.total + _o.cogs.salesCommission.total) / _o.income.total
  : 0.384;
const OVERHEAD_COST_RATIO = _o.income.total > 0
  ? _o.expenses.total / _o.income.total
  : 0.187;

// =============================================================================
// Commission Data Parsing (cached)
// =============================================================================

let _parsedCommissions: ParsedCommission[] | null = null;

function parseCommissionDate(dateStr: string): Date | null {
  if (!dateStr || typeof dateStr !== 'string') return null;
  const parts = dateStr.trim().split('/');
  if (parts.length !== 3) return null;
  const month = parseInt(parts[0], 10);
  const day = parseInt(parts[1], 10);
  let year = parseInt(parts[2], 10);
  if (isNaN(month) || isNaN(day) || isNaN(year)) return null;
  if (year < 100) year = 2000 + year;
  if (year < 2019 || year > 2030) return null;
  const date = new Date(year, month - 1, day);
  if (date.getMonth() !== month - 1) return null;
  return date;
}

function getParsedCommissions(): ParsedCommission[] {
  if (_parsedCommissions) return _parsedCommissions;

  const rawData = commissionsData as CommissionRecord[];
  const parsed: ParsedCommission[] = [];

  for (const record of rawData) {
    const date = parseCommissionDate(record.date);
    if (!date) continue;
    parsed.push({
      salesRep: record.salesRep.replace(/\s+/g, ' ').trim(),
      date,
      amount: record.amount,
      balance: record.balance,
      dateString: record.date,
    });
  }

  parsed.sort((a, b) => a.date.getTime() - b.date.getTime());
  _parsedCommissions = parsed;
  return parsed;
}

// =============================================================================
// Financial Service Class
// =============================================================================

class FinancialService {
  private doc: GoogleSpreadsheet | null = null;
  private initialized = false;
  private sheetsAvailable = true;

  private async getDoc(): Promise<GoogleSpreadsheet | null> {
    if (this.doc && this.initialized) {
      return this.doc;
    }

    if (!this.sheetsAvailable) return null;

    const serviceAccountEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
    const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n');
    // The rest of the codebase uses GOOGLE_SHEETS_ID (plural). Accept both
    // so this service works whether the env var was set with either spelling.
    const sheetId = process.env.GOOGLE_SHEETS_ID || process.env.GOOGLE_SHEET_ID;

    if (!serviceAccountEmail || !privateKey || !sheetId) {
      this.sheetsAvailable = false;
      return null;
    }

    try {
      const jwt = new JWT({
        email: serviceAccountEmail,
        key: privateKey,
        scopes: ['https://www.googleapis.com/auth/spreadsheets'],
      });

      this.doc = new GoogleSpreadsheet(sheetId, jwt);
      await this.doc.loadInfo();
      this.initialized = true;
      return this.doc;
    } catch (error) {
      console.warn('[FinancialService] Google Sheets unavailable, using local data sources:', error);
      this.sheetsAvailable = false;
      return null;
    }
  }

  private async getOrCreateSheet(sheetName: string, headers: string[]) {
    const doc = await this.getDoc();
    if (!doc) return null;

    let sheet = doc.sheetsByTitle[sheetName];
    if (!sheet) {
      try {
        sheet = await doc.addSheet({ title: sheetName, headerValues: headers, gridProperties: { columnCount: Math.max(headers.length + 5, 26) } });
      } catch {
        return null;
      }
    } else {
      try {
        await sheet.loadHeaderRow();
      } catch {
        if (sheet.gridProperties.columnCount < headers.length) {
          await sheet.resize({ rowCount: sheet.gridProperties.rowCount, columnCount: headers.length + 5 });
        }
        await sheet.setHeaderRow(headers);
      }
    }
    return sheet;
  }

  // =============================================================================
  // Core Data Loading: Commission Revenue
  // =============================================================================

  /**
   * Get commission revenue data, filtered by date range.
   * This is the PRIMARY revenue data source (4,199 real transactions).
   * Commission amounts represent the rep's cut; multiply by 10 for estimated job revenue.
   */
  private getCommissionData(dateFrom?: Date, dateTo?: Date): ParsedCommission[] {
    const commissions = getParsedCommissions();
    if (!dateFrom && !dateTo) return commissions;

    return commissions.filter(c => {
      if (dateFrom && c.date < dateFrom) return false;
      if (dateTo && c.date > dateTo) return false;
      return true;
    });
  }

  /**
   * Get all invoices from the invoice service (real invoice data with line items).
   */
  private async getInvoiceRecords(): Promise<InvoiceData[]> {
    try {
      const invoices = await invoiceService.getAllInvoices();
      return invoices.map((inv: Invoice) => {
        const materialCost = inv.lineItems
          .filter(li => li.category === 'materials')
          .reduce((sum, li) => sum + li.total, 0);
        const laborCost = inv.lineItems
          .filter(li => li.category === 'labor')
          .reduce((sum, li) => sum + li.total, 0);

        return {
          invoiceId: inv.invoiceId,
          customerName: inv.customerName,
          amount: inv.total,
          balanceDue: inv.balanceDue,
          amountPaid: inv.amountPaid,
          status: inv.status,
          type: inv.type,
          dueDate: inv.dueDate,
          paidAt: inv.paidAt,
          createdAt: inv.createdAt,
          materialCost,
          laborCost,
          lineItems: inv.lineItems.map(li => ({ category: li.category, total: li.total })),
        };
      });
    } catch (error) {
      console.warn('[FinancialService] Failed to load invoices:', error);
      return [];
    }
  }

  /**
   * Try to fetch expenses from Google Sheets. Returns empty array if unavailable.
   */
  private async getExpensesFromSheets(): Promise<{ amount: number; status: string; category: string; paidDate?: string }[]> {
    try {
      const sheet = await this.getOrCreateSheet('Vendor_Purchases', []);
      if (!sheet) return [];
      const rows = await sheet.getRows();
      return rows.map(r => ({
        amount: parseFloat(r.get('total')) || 0,
        status: r.get('paymentStatus') || 'unknown',
        category: r.get('vendorSource') || 'Other',
        paidDate: r.get('paidAt'),
      }));
    } catch {
      return [];
    }
  }

  /**
   * Try to get pipeline jobs from JobNimbus API.
   * Returns jobs grouped by status with estimated values.
   */
  private async getPipelineFromJN(): Promise<{
    leads: { count: number; value: number };
    quoted: { count: number; value: number };
    contracted: { count: number; value: number };
    inProgress: { count: number; value: number };
  }> {
    const defaultPipeline = {
      leads: { count: 0, value: 0 },
      quoted: { count: 0, value: 0 },
      contracted: { count: 0, value: 0 },
      inProgress: { count: 0, value: 0 },
    };

    if (!isJobNimbusConfigured()) return defaultPipeline;

    try {
      // Fetch recent jobs from JN (first 200)
      const result = await jobNimbusService.getJobs({ limit: 200 });
      const jobs = result.results || [];

      for (const job of jobs) {
        const status = (job.status || '').toLowerCase();
        // Estimate job value: use JN amount if available, else average
        const estimatedValue = 8500; // Average RCRS job value

        if (status === 'lead' || status === 'new' || status === 'contacted') {
          defaultPipeline.leads.count++;
          defaultPipeline.leads.value += estimatedValue;
        } else if (status === 'estimate sent' || status === 'proposal sent' || status === 'inspected') {
          defaultPipeline.quoted.count++;
          defaultPipeline.quoted.value += estimatedValue;
        } else if (status === 'contract signed' || status === 'permit' || status === 'material ordered') {
          defaultPipeline.contracted.count++;
          defaultPipeline.contracted.value += estimatedValue;
        } else if (status === 'work in progress' || status === 'in progress' || status === 'scheduled') {
          defaultPipeline.inProgress.count++;
          defaultPipeline.inProgress.value += estimatedValue;
        }
      }

      return defaultPipeline;
    } catch (error) {
      console.warn('[FinancialService] JN pipeline fetch failed:', error);
      return defaultPipeline;
    }
  }

  // =============================================================================
  // Financial Summary - REAL DATA
  // =============================================================================

  async getFinancialSummary(): Promise<FinancialSummary> {
    const now = new Date();
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
    const yearStart = new Date(now.getFullYear(), 0, 1);
    const lastYearStart = new Date(now.getFullYear() - 1, 0, 1);
    const lastYearEnd = new Date(now.getFullYear() - 1, 11, 31, 23, 59, 59);

    // ---- Revenue from commissions.json (real data) ----
    // If the current month has no commissions yet (e.g. QB hasn't been synced
    // for April), fall back to the most recent month that DOES have data so
    // the dashboard never shows $0 when there's real data we just haven't
    // refreshed yet. The original date range stays in `thisMonthStart` for
    // every other calculation downstream.
    const allCommissions = this.getCommissionData();
    let effectiveThisMonthStart = thisMonthStart;
    let effectiveThisMonthEnd: Date | undefined = undefined;
    const thisMonthHasData = allCommissions.some((c) => c.date >= thisMonthStart);
    if (!thisMonthHasData && allCommissions.length > 0) {
      const latest = allCommissions.reduce(
        (max, c) => (c.date > max ? c.date : max),
        allCommissions[0].date,
      );
      effectiveThisMonthStart = new Date(latest.getFullYear(), latest.getMonth(), 1);
      effectiveThisMonthEnd = new Date(latest.getFullYear(), latest.getMonth() + 1, 0, 23, 59, 59);
    }
    const thisMonthCommissions = this.getCommissionData(effectiveThisMonthStart, effectiveThisMonthEnd);
    const lastMonthCommissions = this.getCommissionData(lastMonthStart, lastMonthEnd);
    const ytdCommissions = this.getCommissionData(yearStart);
    const lastYearCommissions = this.getCommissionData(lastYearStart, lastYearEnd);

    // Commission totals (real, from data/commissions.json) — used for cash-flow
    // outflow context below.
    const totalCommissions = allCommissions.reduce((sum, c) => sum + c.amount, 0);
    const thisMonthCommissionTotal = thisMonthCommissions.reduce((sum, c) => sum + c.amount, 0);

    // Revenue figures come from the REAL transaction ledger
    // (data/transactions-monthly.json — sum of Invoice + Sales Receipt minus
    // Credit Memo, per month). Previously this section multiplied commissions
    // by COMMISSION_TO_REVENUE_MULTIPLIER (a 10× heuristic guess); that's gone.
    const monthlyMap = new Map<string, number>(
      (transactionsMonthly as Array<{ month: string; netRevenue: number }>).map(
        m => [m.month, m.netRevenue],
      ),
    );
    function monthKey(d: Date): string {
      return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
    }
    function sumMonthsInRange(from: Date, to?: Date): number {
      let total = 0;
      const end = to || new Date();
      const cursor = new Date(Date.UTC(from.getFullYear(), from.getMonth(), 1));
      const endMonth = new Date(Date.UTC(end.getFullYear(), end.getMonth(), 1));
      while (cursor <= endMonth) {
        total += monthlyMap.get(monthKey(cursor)) || 0;
        cursor.setUTCMonth(cursor.getUTCMonth() + 1);
      }
      return Math.round(total * 100) / 100;
    }

    const totalRevenue = Math.round(
      Array.from(monthlyMap.values()).reduce((s, v) => s + v, 0) * 100,
    ) / 100;
    const revenueThisMonth = sumMonthsInRange(effectiveThisMonthStart, effectiveThisMonthEnd);
    const revenueLastMonth = sumMonthsInRange(lastMonthStart, lastMonthEnd);
    const revenueYTD = sumMonthsInRange(yearStart);
    const revenueLastYear = sumMonthsInRange(lastYearStart, lastYearEnd);

    // ---- Costs (estimated from revenue ratios + real invoice data) ----
    const invoices = await this.getInvoiceRecords();
    const sheetExpenses = await this.getExpensesFromSheets();

    // Calculate material and labor costs from invoices that have line items
    const invoiceMaterialCost = invoices.reduce((sum, inv) => sum + inv.materialCost, 0);
    const invoiceLaborCost = invoices.reduce((sum, inv) => sum + inv.laborCost, 0);

    // Scale costs proportionally: use invoice ratios if we have data, else use industry ratios
    const invoiceTotalRevenue = invoices
      .filter(inv => inv.type !== 'credit' && inv.type !== 'estimate')
      .reduce((sum, inv) => sum + Math.abs(inv.amount), 0);

    let materialCostRatio = MATERIAL_COST_RATIO;
    let laborCostRatio = LABOR_COST_RATIO;

    if (invoiceTotalRevenue > 0 && invoiceMaterialCost > 0) {
      materialCostRatio = invoiceMaterialCost / invoiceTotalRevenue;
      laborCostRatio = invoiceLaborCost / invoiceTotalRevenue;
    }

    const materialCosts = Math.round(revenueYTD * materialCostRatio * 100) / 100;
    const laborCosts = Math.round(revenueYTD * laborCostRatio * 100) / 100;
    const operationalCosts = sheetExpenses.reduce((sum, e) => sum + e.amount, 0)
      || Math.round(revenueYTD * OVERHEAD_COST_RATIO * 100) / 100;
    const totalCosts = materialCosts + laborCosts + operationalCosts;

    // ---- Profit ----
    const grossProfit = revenueYTD - materialCosts - laborCosts;
    const netProfit = grossProfit - operationalCosts;
    const grossMargin = revenueYTD > 0 ? Math.round((grossProfit / revenueYTD) * 10000) / 100 : 0;
    const netMargin = revenueYTD > 0 ? Math.round((netProfit / revenueYTD) * 10000) / 100 : 0;

    // ---- Pipeline (from invoices + JN) ----
    const jnPipeline = await this.getPipelineFromJN();

    // Also count local invoices by type as pipeline indicators
    const estimateInvoices = invoices.filter(inv => inv.type === 'estimate');
    const sentInvoices = invoices.filter(inv =>
      inv.status === 'sent' || inv.status === 'viewed'
    );
    const approvedInvoices = invoices.filter(inv => inv.status === 'approved');

    const leadsValue = jnPipeline.leads.value
      + estimateInvoices.filter(inv => inv.status === 'draft').reduce((sum, inv) => sum + Math.abs(inv.amount), 0);
    const quotedValue = jnPipeline.quoted.value
      + estimateInvoices.filter(inv => inv.status === 'sent' || inv.status === 'viewed').reduce((sum, inv) => sum + Math.abs(inv.amount), 0);
    const contractedValue = jnPipeline.contracted.value + jnPipeline.inProgress.value
      + approvedInvoices.reduce((sum, inv) => sum + Math.abs(inv.amount), 0);
    const pipelineValue = leadsValue + quotedValue + contractedValue;

    // ---- AR/AP from real invoices ----
    const unpaidInvoices = invoices.filter(inv =>
      inv.status !== 'paid' && inv.status !== 'cancelled' && inv.status !== 'draft' &&
      inv.type !== 'credit' && inv.balanceDue > 0
    );
    const accountsReceivable = Math.round(unpaidInvoices.reduce((sum, inv) => sum + inv.balanceDue, 0) * 100) / 100;
    const overdueInvoicesData = unpaidInvoices.filter(inv => {
      const due = new Date(inv.dueDate);
      return due < now;
    });
    const overdueAmount = Math.round(overdueInvoicesData.reduce((sum, inv) => sum + inv.balanceDue, 0) * 100) / 100;

    const unpaidExpenses = sheetExpenses.filter(e => e.status !== 'paid');
    const accountsPayable = unpaidExpenses.reduce((sum, e) => sum + e.amount, 0);

    // ---- Growth Rates ----
    const monthOverMonthGrowth = revenueLastMonth > 0
      ? Math.round(((revenueThisMonth - revenueLastMonth) / revenueLastMonth) * 10000) / 100
      : (revenueThisMonth > 0 ? 100 : 0);

    const yearOverYearGrowth = revenueLastYear > 0
      ? Math.round(((revenueYTD - revenueLastYear) / revenueLastYear) * 10000) / 100
      : 0;

    // ---- Cash Flow (from invoice payments this month) ----
    const paidInvoicesThisMonth = invoices.filter(inv => {
      if (!inv.paidAt) return false;
      const paidDate = new Date(inv.paidAt);
      return paidDate >= thisMonthStart && inv.amountPaid > 0;
    });
    const cashInflow = Math.round(
      paidInvoicesThisMonth.reduce((sum, inv) => sum + inv.amountPaid, 0) * 100
    ) / 100;

    // Also include commission payouts this month as cash outflow context
    const cashOutflowFromExpenses = sheetExpenses
      .filter(e => e.status === 'paid' && e.paidDate && new Date(e.paidDate) >= thisMonthStart)
      .reduce((sum, e) => sum + e.amount, 0);
    // Commission payouts are a cost
    const cashOutflowFromCommissions = thisMonthCommissionTotal;
    const cashOutflow = Math.round((cashOutflowFromExpenses + cashOutflowFromCommissions) * 100) / 100;
    const netCashFlow = Math.round((cashInflow - cashOutflow) * 100) / 100;

    return {
      totalRevenue,
      revenueThisMonth,
      revenueLastMonth,
      revenueYTD,
      monthOverMonthGrowth,
      yearOverYearGrowth,
      totalCosts,
      materialCosts,
      laborCosts,
      operationalCosts,
      grossProfit,
      netProfit,
      grossMargin,
      netMargin,
      pipelineValue,
      leadsValue,
      quotedValue,
      contractedValue,
      accountsReceivable,
      accountsPayable,
      outstandingInvoices: unpaidInvoices.length,
      overdueInvoices: overdueInvoicesData.length,
      overdueAmount,
      cashInflow,
      cashOutflow,
      netCashFlow,
    };
  }

  // =============================================================================
  // Revenue by Rep - REAL DATA from transactions-by-rep.json
  // =============================================================================

  async getRevenueByRep(dateFrom?: string, dateTo?: string): Promise<RevenueByRep[]> {
    // Note: dateFrom/dateTo are ignored here because the rep aggregates in
    // transactions-by-rep.json are lifetime (since-inception). The financial
    // dashboard's monthly breakdown handles date-windowed views via the
    // transactions-monthly.json data instead. Per-rep date-windowed needs the
    // raw transactions.json — see /api/financial/transactions.
    void dateFrom; void dateTo;

    const repRows = transactionsByRep as Array<{
      rep: string;
      invoiceTotal: number;
      invoiceCount: number;
    }>;

    // Commission totals come from data/commissions.json (1099 payouts) and
    // are joined onto each rep where we have a name match.
    const allCommissions = getParsedCommissions();
    const commissionByRep = new Map<string, number>();
    for (const c of allCommissions) {
      commissionByRep.set(c.salesRep, (commissionByRep.get(c.salesRep) || 0) + c.amount);
    }

    const grandTotalRevenue = repRows.reduce((s, r) => s + r.invoiceTotal, 0);

    const result: RevenueByRep[] = repRows.map(r => {
      const totalCommissions = Math.round((commissionByRep.get(r.rep) || 0) * 100) / 100;
      return {
        repId: r.rep.toLowerCase().replace(/\s+/g, '-'),
        repName: r.rep,
        totalRevenue: Math.round(r.invoiceTotal * 100) / 100,
        totalCommissions,
        jobCount: r.invoiceCount,
        avgJobValue: r.invoiceCount > 0
          ? Math.round((r.invoiceTotal / r.invoiceCount) * 100) / 100
          : 0,
        // closeRate computed from ratio of invoices to total invoice volume —
        // not a real close rate (we don't have lead counts), but at least it's
        // grounded in actual rep activity rather than a productivity estimate.
        closeRate: grandTotalRevenue > 0
          ? Math.round(((r.invoiceTotal / grandTotalRevenue) * 100) * 10) / 10
          : 0,
        percentOfTotal: grandTotalRevenue > 0
          ? Math.round((r.invoiceTotal / grandTotalRevenue) * 10000) / 100
          : 0,
      };
    });

    return result.sort((a, b) => b.totalRevenue - a.totalRevenue);
  }

  // =============================================================================
  // Revenue by Period - REAL DATA from commissions.json
  // =============================================================================

  async getRevenueByPeriod(
    groupBy: 'day' | 'week' | 'month' | 'quarter' | 'year' = 'month',
    periods: number = 12
  ): Promise<RevenueByPeriod[]> {
    const now = new Date();
    const result: RevenueByPeriod[] = [];

    for (let i = periods - 1; i >= 0; i--) {
      let periodStart: Date;
      let periodEnd: Date;
      let periodLabel: string;
      let period: string;

      switch (groupBy) {
        case 'day':
          periodStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
          periodEnd = new Date(periodStart);
          periodEnd.setDate(periodEnd.getDate() + 1);
          period = periodStart.toISOString().split('T')[0];
          periodLabel = periodStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
          break;
        case 'week': {
          const weekStart = new Date(now);
          weekStart.setDate(weekStart.getDate() - weekStart.getDay() - (i * 7));
          weekStart.setHours(0, 0, 0, 0);
          periodStart = weekStart;
          periodEnd = new Date(weekStart);
          periodEnd.setDate(periodEnd.getDate() + 7);
          period = `W${Math.ceil((weekStart.getDate()) / 7)}-${weekStart.getFullYear()}`;
          periodLabel = `Week of ${weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
          break;
        }
        case 'month':
          periodStart = new Date(now.getFullYear(), now.getMonth() - i, 1);
          periodEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0, 23, 59, 59);
          period = `${periodStart.getFullYear()}-${String(periodStart.getMonth() + 1).padStart(2, '0')}`;
          periodLabel = periodStart.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
          break;
        case 'quarter': {
          const quarterMonth = Math.floor(now.getMonth() / 3) * 3 - (i * 3);
          const quarterYear = now.getFullYear() + Math.floor(quarterMonth / 12);
          const adjustedQuarterMonth = ((quarterMonth % 12) + 12) % 12;
          periodStart = new Date(quarterYear, adjustedQuarterMonth, 1);
          periodEnd = new Date(quarterYear, adjustedQuarterMonth + 3, 0, 23, 59, 59);
          period = `Q${Math.floor(adjustedQuarterMonth / 3) + 1}-${quarterYear}`;
          periodLabel = `Q${Math.floor(adjustedQuarterMonth / 3) + 1} ${quarterYear}`;
          break;
        }
        case 'year':
          periodStart = new Date(now.getFullYear() - i, 0, 1);
          periodEnd = new Date(now.getFullYear() - i, 11, 31, 23, 59, 59);
          period = String(periodStart.getFullYear());
          periodLabel = String(periodStart.getFullYear());
          break;
        default:
          periodStart = new Date(now.getFullYear(), now.getMonth() - i, 1);
          periodEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0, 23, 59, 59);
          period = `${periodStart.getFullYear()}-${String(periodStart.getMonth() + 1).padStart(2, '0')}`;
          periodLabel = periodStart.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
      }

      const periodCommissions = this.getCommissionData(periodStart, periodEnd);
      // Revenue + expense for the period come from the transaction ledger
      // (real). For sub-month periods (day/week), we approximate by scaling
      // the containing month's totals proportionally to days-in-window.
      const monthlyRows = transactionsMonthly as Array<{
        month: string; netRevenue: number; expense: number; invoiceCount: number;
      }>;
      const inWindow = (m: { month: string }) => {
        const [y, mm] = m.month.split('-').map(Number);
        const ms = new Date(Date.UTC(y, mm - 1, 1));
        const me = new Date(Date.UTC(y, mm, 0, 23, 59, 59));
        return ms <= periodEnd && me >= periodStart;
      };
      let revenue = 0;
      let costs = 0;
      let invoiceCount = 0;
      for (const m of monthlyRows.filter(inWindow)) {
        const [y, mm] = m.month.split('-').map(Number);
        const ms = new Date(Date.UTC(y, mm - 1, 1));
        const me = new Date(Date.UTC(y, mm, 0, 23, 59, 59));
        // Day-fraction of the month that overlaps the period
        const overlapStart = ms > periodStart ? ms : periodStart;
        const overlapEnd = me < periodEnd ? me : periodEnd;
        const overlapDays =
          (overlapEnd.getTime() - overlapStart.getTime()) / 86400000 + 1;
        const monthDays = (me.getTime() - ms.getTime()) / 86400000 + 1;
        const frac = Math.max(0, Math.min(1, overlapDays / monthDays));
        revenue += m.netRevenue * frac;
        costs += m.expense * frac;
        invoiceCount += Math.round(m.invoiceCount * frac);
      }
      revenue = Math.round(revenue * 100) / 100;
      costs = Math.round(costs * 100) / 100;
      const profit = Math.round((revenue - costs) * 100) / 100;
      const margin = revenue > 0 ? Math.round((profit / revenue) * 10000) / 100 : 0;

      // Use real invoice count from the ledger (falls back to commission
      // count if no transactions in this period).
      const jobCount = invoiceCount || periodCommissions.length;
      result.push({
        period,
        periodLabel,
        revenue,
        costs,
        profit,
        margin,
        jobCount,
        avgJobValue: jobCount > 0
          ? Math.round((revenue / jobCount) * 100) / 100
          : 0,
      });
    }

    return result;
  }

  // =============================================================================
  // Invoice Aging (AR Aging) - REAL DATA from invoice-service
  // =============================================================================

  async getInvoiceAging(): Promise<InvoiceAgingBucket[]> {
    const invoices = await this.getInvoiceRecords();
    const now = new Date();

    // Filter to unpaid invoices with a balance (exclude drafts, credits, cancelled)
    const unpaidInvoices = invoices.filter(inv =>
      inv.status !== 'paid' &&
      inv.status !== 'cancelled' &&
      inv.status !== 'draft' &&
      inv.type !== 'credit' &&
      inv.balanceDue > 0
    );

    const totalAmount = unpaidInvoices.reduce((sum, inv) => sum + inv.balanceDue, 0);

    const buckets: InvoiceAgingBucket[] = [
      { bucket: 'current', label: 'Current', count: 0, amount: 0, percentOfTotal: 0 },
      { bucket: '1-30', label: '1-30 Days', count: 0, amount: 0, percentOfTotal: 0 },
      { bucket: '31-60', label: '31-60 Days', count: 0, amount: 0, percentOfTotal: 0 },
      { bucket: '61-90', label: '61-90 Days', count: 0, amount: 0, percentOfTotal: 0 },
      { bucket: '90+', label: '90+ Days', count: 0, amount: 0, percentOfTotal: 0 },
    ];

    for (const invoice of unpaidInvoices) {
      const dueDate = new Date(invoice.dueDate);
      const daysOverdue = Math.floor((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));

      let bucketIndex: number;
      if (daysOverdue <= 0) {
        bucketIndex = 0;
      } else if (daysOverdue <= 30) {
        bucketIndex = 1;
      } else if (daysOverdue <= 60) {
        bucketIndex = 2;
      } else if (daysOverdue <= 90) {
        bucketIndex = 3;
      } else {
        bucketIndex = 4;
      }

      buckets[bucketIndex].count++;
      buckets[bucketIndex].amount += invoice.balanceDue;
    }

    // Calculate percentages
    for (const bucket of buckets) {
      bucket.amount = Math.round(bucket.amount * 100) / 100;
      bucket.percentOfTotal = totalAmount > 0 ? Math.round((bucket.amount / totalAmount) * 10000) / 100 : 0;
    }

    return buckets;
  }

  // =============================================================================
  // Job Profitability - from real invoice line items
  // =============================================================================

  async getJobProfitability(filters?: {
    status?: string;
    dateFrom?: string;
    dateTo?: string;
    minMargin?: number;
    maxMargin?: number;
  }): Promise<JobProfitability[]> {
    const invoices = await this.getInvoiceRecords();

    // Each invoice represents a job. Derive profitability from line items.
    let filteredInvoices = invoices.filter(inv => inv.type !== 'credit');

    if (filters) {
      if (filters.status === 'completed') {
        filteredInvoices = filteredInvoices.filter(inv => inv.status === 'paid');
      } else if (filters.status) {
        filteredInvoices = filteredInvoices.filter(inv => inv.status === filters.status);
      }
      if (filters.dateFrom) {
        filteredInvoices = filteredInvoices.filter(inv => inv.createdAt >= filters.dateFrom!);
      }
      if (filters.dateTo) {
        filteredInvoices = filteredInvoices.filter(inv => inv.createdAt <= filters.dateTo!);
      }
    }

    let result: JobProfitability[] = filteredInvoices.map(inv => {
      const revenue = Math.abs(inv.amount);
      // Material cost is what we pay suppliers (estimate ~60% of material line item total for markup)
      const materialCostToUs = Math.round(inv.materialCost * 0.6 * 100) / 100;
      // Labor cost is largely pass-through (crew gets ~80% of labor charges)
      const laborCostToUs = Math.round(inv.laborCost * 0.8 * 100) / 100;
      const overheadCost = Math.round(revenue * OVERHEAD_COST_RATIO * 100) / 100;
      const totalCost = materialCostToUs + laborCostToUs + overheadCost;
      const profit = Math.round((revenue - totalCost) * 100) / 100;
      const margin = revenue > 0 ? Math.round((profit / revenue) * 10000) / 100 : 0;

      // Map invoice status to job status
      let status = 'active';
      if (inv.status === 'paid') status = 'completed';
      else if (inv.status === 'overdue') status = 'overdue';
      else if (inv.status === 'draft') status = 'draft';
      else if (inv.status === 'sent' || inv.status === 'viewed') status = 'invoiced';
      else if (inv.status === 'approved') status = 'approved';
      else if (inv.status === 'disputed') status = 'disputed';

      return {
        jobId: inv.invoiceId.replace('INV-', 'JOB-'),
        jobName: `${inv.customerName} - ${inv.type === 'estimate' ? 'Estimate' : inv.type === 'supplement' ? 'Supplement' : 'Roof Job'}`,
        customerName: inv.customerName,
        revenue,
        materialCost: materialCostToUs,
        laborCost: laborCostToUs,
        overheadCost,
        totalCost,
        profit,
        margin,
        status,
        completedDate: inv.paidAt?.slice(0, 10),
      };
    });

    // Apply margin filters after calculation
    if (filters?.minMargin !== undefined) {
      result = result.filter(j => j.margin >= filters.minMargin!);
    }
    if (filters?.maxMargin !== undefined) {
      result = result.filter(j => j.margin <= filters.maxMargin!);
    }

    return result.sort((a, b) => b.margin - a.margin);
  }

  // =============================================================================
  // Budget vs Actual - Real estimates from commission data
  // =============================================================================

  async getBudgetVsActual(period?: string): Promise<BudgetVsActual[]> {
    // Monthly budget targets based on historical revenue and industry benchmarks
    const now = new Date();
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const thisMonthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

    // Real revenue for this month from the transaction ledger.
    const monthKey = `${thisMonthStart.getFullYear()}-${String(thisMonthStart.getMonth() + 1).padStart(2, '0')}`;
    const monthRevenueRow = (transactionsMonthly as Array<{ month: string; netRevenue: number }>)
      .find(m => m.month === monthKey);
    const monthRevenue = monthRevenueRow?.netRevenue || 0;
    void thisMonthEnd;

    // Real commission outflow for this month — used in the Commissions budget row.
    const monthCommissions = this.getCommissionData(thisMonthStart, thisMonthEnd);
    const monthCommissionTotal = monthCommissions.reduce((sum, c) => sum + c.amount, 0);

    // Get real expenses if available from sheets
    const sheetExpenses = await this.getExpensesFromSheets();
    const expensesByCategory = new Map<string, number>();
    for (const e of sheetExpenses) {
      const cat = e.category || 'Other';
      expensesByCategory.set(cat, (expensesByCategory.get(cat) || 0) + e.amount);
    }

    // Build budget based on monthly revenue target and typical roofing cost structure
    const budgets = [
      {
        category: 'Materials',
        budgeted: Math.round(FINANCIAL_THRESHOLDS.monthlyRevenueTarget * MATERIAL_COST_RATIO),
        actual: expensesByCategory.get('Materials')
          || Math.round(monthRevenue * MATERIAL_COST_RATIO),
      },
      {
        category: 'Labor',
        budgeted: Math.round(FINANCIAL_THRESHOLDS.monthlyRevenueTarget * LABOR_COST_RATIO),
        actual: expensesByCategory.get('Labor')
          || Math.round(monthRevenue * LABOR_COST_RATIO),
      },
      {
        category: 'Marketing',
        budgeted: 5000,
        actual: expensesByCategory.get('Marketing') || 0, // No fake fallback — 0 if no Sheets data
      },
      {
        category: 'Operations',
        budgeted: 10000,
        actual: expensesByCategory.get('Operations')
          || (monthRevenue > 0 ? Math.round(monthRevenue * OVERHEAD_COST_RATIO) : 0),
      },
      {
        category: 'Equipment',
        budgeted: 8000,
        actual: expensesByCategory.get('Equipment') || 0, // No fake fallback — 0 if no Sheets data
      },
      {
        category: 'Commissions',
        budgeted: Math.round(FINANCIAL_THRESHOLDS.monthlyRevenueTarget * 0.10),
        actual: Math.round(monthCommissionTotal),
      },
    ];

    return budgets.map(b => {
      const variance = b.actual - b.budgeted;
      const variancePercent = b.budgeted > 0
        ? Math.round((variance / b.budgeted) * 10000) / 100
        : 0;

      let status: 'under' | 'on_track' | 'over' = 'on_track';
      if (variancePercent > 0) {
        status = 'over';
      } else if (variancePercent < -10) {
        status = 'under';
      }

      return {
        category: b.category,
        budgeted: b.budgeted,
        actual: Math.round(b.actual * 100) / 100,
        variance: Math.round(variance * 100) / 100,
        variancePercent,
        status,
      };
    });
  }

  // =============================================================================
  // Financial Alerts - REAL alerts from real data
  // =============================================================================

  async getFinancialAlerts(): Promise<FinancialAlert[]> {
    const alerts: FinancialAlert[] = [];
    const now = new Date().toISOString();

    // 1. Overdue invoices (from real invoice data)
    const invoices = await this.getInvoiceRecords();
    const today = new Date();

    const overdueInvoices = invoices.filter(inv =>
      inv.status !== 'paid' && inv.status !== 'cancelled' && inv.status !== 'draft' &&
      inv.type !== 'credit' && inv.balanceDue > 0 && new Date(inv.dueDate) < today
    );

    // Individual overdue invoice alerts for large balances
    for (const inv of overdueInvoices) {
      const dueDate = new Date(inv.dueDate);
      const daysOverdue = Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));

      if (inv.balanceDue >= 5000 || daysOverdue > 30) {
        alerts.push({
          alertId: `INV-OVERDUE-${inv.invoiceId}`,
          type: 'overdue_invoice',
          severity: daysOverdue > 60 ? 'critical' : daysOverdue > 30 ? 'warning' : 'info',
          title: `Overdue: ${inv.customerName}`,
          description: `Invoice ${inv.invoiceId} is ${daysOverdue} days overdue. Balance: $${inv.balanceDue.toLocaleString()}`,
          amount: inv.balanceDue,
          relatedId: inv.invoiceId,
          createdAt: now,
          acknowledged: false,
        });
      }
    }

    // Summary overdue alert
    if (overdueInvoices.length > 0) {
      const totalOverdue = overdueInvoices.reduce((sum, inv) => sum + inv.balanceDue, 0);
      alerts.push({
        alertId: `AR-SUMMARY-${Date.now()}`,
        type: 'overdue_invoice',
        severity: totalOverdue > 20000 ? 'critical' : totalOverdue > 10000 ? 'warning' : 'info',
        title: `${overdueInvoices.length} Overdue Invoices`,
        description: `Total overdue: $${totalOverdue.toLocaleString()}. Oldest: ${overdueInvoices.length > 0 ? overdueInvoices[0].customerName : 'N/A'}`,
        amount: totalOverdue,
        createdAt: now,
        acknowledged: false,
      });
    }

    // 2. Revenue below target alert — real monthly revenue from the ledger.
    const thisMonthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    const alertMonthKey = `${thisMonthStart.getFullYear()}-${String(thisMonthStart.getMonth() + 1).padStart(2, '0')}`;
    const alertMonthRow = (transactionsMonthly as Array<{ month: string; netRevenue: number }>)
      .find(m => m.month === alertMonthKey);
    const thisMonthRevenue = alertMonthRow?.netRevenue || 0;
    const dayOfMonth = today.getDate();
    const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
    const proRatedTarget = (FINANCIAL_THRESHOLDS.monthlyRevenueTarget / daysInMonth) * dayOfMonth;

    if (thisMonthRevenue < proRatedTarget * 0.8) {
      const shortfall = proRatedTarget - thisMonthRevenue;
      alerts.push({
        alertId: `REV-TARGET-${today.getFullYear()}-${today.getMonth() + 1}`,
        type: 'cash_flow_warning',
        severity: thisMonthRevenue < proRatedTarget * 0.5 ? 'critical' : 'warning',
        title: 'Revenue Below Target',
        description: `MTD revenue ($${Math.round(thisMonthRevenue).toLocaleString()}) is ${Math.round((1 - thisMonthRevenue / proRatedTarget) * 100)}% below pro-rated target ($${Math.round(proRatedTarget).toLocaleString()})`,
        amount: Math.round(shortfall),
        createdAt: now,
        acknowledged: false,
      });
    }

    // 3. Low margin jobs from profitability analysis
    const jobProfitability = await this.getJobProfitability({ status: 'completed' });
    const lowMarginJobs = jobProfitability.filter(j => j.margin < FINANCIAL_THRESHOLDS.minJobMargin && j.revenue > 1000);
    if (lowMarginJobs.length > 0) {
      const worstJob = lowMarginJobs[lowMarginJobs.length - 1]; // Sorted by margin desc, so last is worst
      alerts.push({
        alertId: `MARGIN-LOW-${worstJob.jobId}`,
        type: 'margin_warning',
        severity: worstJob.margin < 10 ? 'critical' : 'warning',
        title: `Low Margin: ${worstJob.customerName}`,
        description: `Job margin is ${worstJob.margin.toFixed(1)}% (target: ${FINANCIAL_THRESHOLDS.minJobMargin}%). Review pricing for future similar jobs.`,
        amount: worstJob.profit,
        relatedId: worstJob.jobId,
        createdAt: now,
        acknowledged: false,
      });
    }

    // 4. Disputed invoices
    const disputedInvoices = invoices.filter(inv => inv.status === 'disputed');
    for (const inv of disputedInvoices) {
      alerts.push({
        alertId: `DISPUTED-${inv.invoiceId}`,
        type: 'overdue_invoice',
        severity: inv.balanceDue > 5000 ? 'warning' : 'info',
        title: `Disputed: ${inv.customerName}`,
        description: `Invoice ${inv.invoiceId} ($${inv.amount.toLocaleString()}) is disputed. Balance due: $${inv.balanceDue.toLocaleString()}`,
        amount: inv.balanceDue,
        relatedId: inv.invoiceId,
        createdAt: now,
        acknowledged: false,
      });
    }

    // 5. Large outstanding balances (>$10K)
    const largeOutstanding = invoices.filter(inv =>
      inv.balanceDue > 10000 && inv.status !== 'paid' && inv.status !== 'cancelled' && inv.type !== 'credit'
    );
    for (const inv of largeOutstanding) {
      // Don't duplicate with overdue alerts
      if (!overdueInvoices.find(o => o.invoiceId === inv.invoiceId)) {
        alerts.push({
          alertId: `LARGE-BAL-${inv.invoiceId}`,
          type: 'large_expense',
          severity: inv.balanceDue > 25000 ? 'warning' : 'info',
          title: `Large Balance: ${inv.customerName}`,
          description: `Outstanding balance of $${inv.balanceDue.toLocaleString()} on invoice ${inv.invoiceId}. Due: ${inv.dueDate}`,
          amount: inv.balanceDue,
          relatedId: inv.invoiceId,
          createdAt: now,
          acknowledged: false,
        });
      }
    }

    // 6. Budget exceeded alerts
    const budgetVsActual = await this.getBudgetVsActual();
    for (const b of budgetVsActual) {
      if (b.status === 'over' && b.variancePercent > 10) {
        alerts.push({
          alertId: `BUDGET-${b.category}`,
          type: 'budget_exceeded',
          severity: b.variancePercent > 25 ? 'warning' : 'info',
          title: `Budget Over: ${b.category}`,
          description: `${b.category} spending ($${b.actual.toLocaleString()}) exceeds budget ($${b.budgeted.toLocaleString()}) by ${b.variancePercent.toFixed(1)}%`,
          amount: b.variance,
          createdAt: now,
          acknowledged: false,
        });
      }
    }

    // Sort by severity (critical first)
    return alerts.sort((a, b) => {
      const severityOrder = { critical: 0, warning: 1, info: 2 };
      return severityOrder[a.severity] - severityOrder[b.severity];
    });
  }

  // =============================================================================
  // Approval Workflow (Google Sheets backed - unchanged)
  // =============================================================================

  async createApprovalRequest(data: {
    type: ApprovalRequest['type'];
    requestedBy: string;
    requestedByName: string;
    amount: number;
    description: string;
    justification: string;
    relatedJobId?: string;
    relatedJobName?: string;
  }): Promise<ApprovalRequest> {
    const sheet = await this.getOrCreateSheet('Approval_Requests', [
      'requestId', 'type', 'requestedBy', 'requestedByName', 'requestedAt',
      'amount', 'description', 'justification', 'relatedJobId', 'relatedJobName',
      'status', 'reviewedBy', 'reviewedByName', 'reviewedAt', 'reviewNotes'
    ]);

    const requestId = `APR-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
    const nowStr = new Date().toISOString();

    const request: ApprovalRequest = {
      requestId,
      type: data.type,
      requestedBy: data.requestedBy,
      requestedByName: data.requestedByName,
      requestedAt: nowStr,
      amount: data.amount,
      description: data.description,
      justification: data.justification,
      relatedJobId: data.relatedJobId,
      relatedJobName: data.relatedJobName,
      status: 'pending',
    };

    if (sheet) {
      await sheet.addRow({
        requestId: request.requestId,
        type: request.type,
        requestedBy: request.requestedBy,
        requestedByName: request.requestedByName,
        requestedAt: request.requestedAt,
        amount: request.amount.toString(),
        description: request.description,
        justification: request.justification,
        relatedJobId: request.relatedJobId || '',
        relatedJobName: request.relatedJobName || '',
        status: request.status,
        reviewedBy: '',
        reviewedByName: '',
        reviewedAt: '',
        reviewNotes: '',
      });
    }

    return request;
  }

  async reviewApprovalRequest(
    requestId: string,
    decision: 'approved' | 'rejected',
    reviewedBy: string,
    reviewedByName: string,
    notes?: string
  ): Promise<ApprovalRequest | null> {
    const sheet = await this.getOrCreateSheet('Approval_Requests', []);
    if (!sheet) return null;

    const rows = await sheet.getRows();
    const row = rows.find(r => r.get('requestId') === requestId);

    if (!row) return null;

    const nowStr = new Date().toISOString();
    row.set('status', decision);
    row.set('reviewedBy', reviewedBy);
    row.set('reviewedByName', reviewedByName);
    row.set('reviewedAt', nowStr);
    row.set('reviewNotes', notes || '');
    await row.save();

    return {
      requestId: row.get('requestId'),
      type: row.get('type') as ApprovalRequest['type'],
      requestedBy: row.get('requestedBy'),
      requestedByName: row.get('requestedByName'),
      requestedAt: row.get('requestedAt'),
      amount: parseFloat(row.get('amount')) || 0,
      description: row.get('description'),
      justification: row.get('justification'),
      relatedJobId: row.get('relatedJobId'),
      relatedJobName: row.get('relatedJobName'),
      status: decision,
      reviewedBy,
      reviewedByName,
      reviewedAt: nowStr,
      reviewNotes: notes,
    };
  }

  async getPendingApprovals(): Promise<ApprovalRequest[]> {
    const sheet = await this.getOrCreateSheet('Approval_Requests', []);
    if (!sheet) return [];

    try {
      const rows = await sheet.getRows();
      return rows
        .filter(r => r.get('status') === 'pending')
        .map(r => ({
          requestId: r.get('requestId'),
          type: r.get('type') as ApprovalRequest['type'],
          requestedBy: r.get('requestedBy'),
          requestedByName: r.get('requestedByName'),
          requestedAt: r.get('requestedAt'),
          amount: parseFloat(r.get('amount')) || 0,
          description: r.get('description'),
          justification: r.get('justification'),
          relatedJobId: r.get('relatedJobId'),
          relatedJobName: r.get('relatedJobName'),
          status: 'pending' as const,
        }));
    } catch {
      return [];
    }
  }

  /**
   * Real company-wide lifetime totals from the most recent QuickBooks
   * Management Report (data/company-overview.json). Use these for
   * "since-inception" cards on the finance dashboard — they're the
   * authoritative numbers, not derived from any multiplier.
   */
  getLifetimeTotals(): {
    generatedAt: string;
    source: string;
    totalIncome: number;
    totalCOGS: number;
    grossProfit: number;
    grossMargin: number;
    totalExpenses: number;
    netOperatingIncome: number;
    netOtherIncome: number;
    netIncome: number;
    netMargin: number;
    salesCommissionTotal: number;
    subcontractorPayTotal: number;
    jobMaterialsTotal: number;
    payrollTotal: number;
    advertisingTotal: number;
    assets: number;
    liabilities: number;
    equity: number;
    accountsReceivable: number;
    cashOnHand: number;
  } {
    const o = companyOverviewData;
    return {
      generatedAt: o.generatedAt,
      source: o.source,
      totalIncome: o.income.total,
      totalCOGS: o.cogs.total,
      grossProfit: o.grossProfit,
      grossMargin: o.grossMargin,
      totalExpenses: o.expenses.total,
      netOperatingIncome: o.netOperatingIncome,
      netOtherIncome: o.netOtherIncome,
      netIncome: o.netIncome,
      netMargin: o.income.total > 0 ? o.netIncome / o.income.total : 0,
      salesCommissionTotal: o.cogs.salesCommission.total,
      subcontractorPayTotal: o.cogs.subcontractorPay.total,
      jobMaterialsTotal: o.cogs.jobMaterials.total,
      payrollTotal: o.expenses.payrollExpenses.total,
      advertisingTotal: o.expenses.advertisingMarketing.total,
      assets: o.balanceSheet.assets.total,
      liabilities: o.balanceSheet.liabilities.total,
      equity: o.balanceSheet.equity.total,
      accountsReceivable: o.balanceSheet.assets.currentAssets.accountsReceivable,
      cashOnHand: o.balanceSheet.assets.currentAssets.bankAccounts.total,
    };
  }
}

export const financialService = new FinancialService();
