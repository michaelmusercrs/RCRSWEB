/**
 * Job Profitability Service for River City Roofing Solutions
 *
 * Tracks per-job costs (materials, labor, subs, overhead), calculates
 * gross/net margins, and provides analytics by rep, month, and material.
 *
 * Persisted to the master Google Sheet on the `Job_Costs` tab via
 * googleSheetsService. One row per jobId — the nested cost-item arrays
 * (materials, labor, subcontractors, overhead, other) are stored as
 * JSON-encoded strings on each row. The local data/job-costs.json file is
 * now a deprecated dev seed and is NOT written by this service anymore.
 *
 * @version 2.0.0
 */

import crypto from 'crypto';
import { googleSheetsService, SHEET_NAMES } from './google-sheets-service';

// =============================================================================
// TYPES
// =============================================================================

export interface CostItem {
  id: string;
  description: string;
  category: string;
  quantity: number;
  unitCost: number;
  totalCost: number;
  vendor?: string;
  invoiceNumber?: string;
  date: string;
}

export interface JobCosts {
  jobId: string;
  customerName: string;
  address: string;
  repSlug: string;
  repName: string;

  // Revenue
  contractAmount: number;
  additionalWork: number;
  insurancePayout?: number;
  totalRevenue: number;

  // Costs
  materials: CostItem[];
  labor: CostItem[];
  subcontractors: CostItem[];
  overhead: CostItem[];
  other: CostItem[];
  totalCosts: number;

  // Profit
  grossProfit: number;
  grossMargin: number; // percentage
  netProfit: number;
  netMargin: number;

  // Commission
  commissionRate: number;
  commissionAmount: number;

  // Status
  status: 'estimating' | 'in_progress' | 'completed' | 'reconciled';

  notes: string;
  createdAt: string;
  updatedAt: string;
}

export interface ProfitabilityAnalytics {
  totalJobs: number;
  totalRevenue: number;
  totalCosts: number;
  totalProfit: number;
  avgGrossMargin: number;
  avgNetMargin: number;
  byRep: {
    repSlug: string;
    repName: string;
    jobs: number;
    revenue: number;
    profit: number;
    margin: number;
  }[];
  byMonth: {
    month: string;
    revenue: number;
    costs: number;
    profit: number;
    margin: number;
  }[];
  byMaterial: {
    material: string;
    totalCost: number;
    avgPerJob: number;
  }[];
  mostProfitable: {
    jobId: string;
    customerName: string;
    margin: number;
  }[];
  leastProfitable: {
    jobId: string;
    customerName: string;
    margin: number;
  }[];
}

// =============================================================================
// SHEET CONFIG
// =============================================================================

// Canonical column order for the Job_Costs tab. Do NOT reorder.
// One row per jobId; nested cost arrays are JSON-encoded strings.
const JOB_COSTS_HEADERS: string[] = [
  'jobId',
  'customerName',
  'address',
  'repSlug',
  'repName',
  'contractAmount',
  'additionalWork',
  'insurancePayout',
  'totalRevenue',
  'materials',
  'labor',
  'subcontractors',
  'overhead',
  'other',
  'totalCosts',
  'grossProfit',
  'grossMargin',
  'netProfit',
  'netMargin',
  'commissionRate',
  'commissionAmount',
  'status',
  'notes',
  'createdAt',
  'updatedAt',
];

// Default overhead rate applied to all jobs (percentage of revenue)
const DEFAULT_OVERHEAD_RATE = 0.08;

// =============================================================================
// HELPERS
// =============================================================================

function generateId(prefix: string): string {
  return `${prefix}-${crypto.randomBytes(6).toString('hex')}`;
}

function parseNum(raw: string | undefined, fallback = 0): number {
  if (raw === undefined || raw === null || raw === '') return fallback;
  const n = Number(raw);
  return Number.isFinite(n) ? n : fallback;
}

function parseCostItems(raw: string | undefined): CostItem[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed as CostItem[];
  } catch {
    // fall through
  }
  return [];
}

/** Parse a sheet row (all strings) into a typed JobCosts. */
function rowToJobCost(row: Record<string, string>): JobCosts {
  return {
    jobId: row.jobId || '',
    customerName: row.customerName || '',
    address: row.address || '',
    repSlug: row.repSlug || '',
    repName: row.repName || '',
    contractAmount: parseNum(row.contractAmount),
    additionalWork: parseNum(row.additionalWork),
    insurancePayout:
      row.insurancePayout !== '' && row.insurancePayout !== undefined
        ? parseNum(row.insurancePayout)
        : undefined,
    totalRevenue: parseNum(row.totalRevenue),
    materials: parseCostItems(row.materials),
    labor: parseCostItems(row.labor),
    subcontractors: parseCostItems(row.subcontractors),
    overhead: parseCostItems(row.overhead),
    other: parseCostItems(row.other),
    totalCosts: parseNum(row.totalCosts),
    grossProfit: parseNum(row.grossProfit),
    grossMargin: parseNum(row.grossMargin),
    netProfit: parseNum(row.netProfit),
    netMargin: parseNum(row.netMargin),
    commissionRate: parseNum(row.commissionRate),
    commissionAmount: parseNum(row.commissionAmount),
    status: (row.status || 'estimating') as JobCosts['status'],
    notes: row.notes || '',
    createdAt: row.createdAt || '',
    updatedAt: row.updatedAt || '',
  };
}

/** Flatten a JobCosts into sheet-friendly scalar columns. */
function jobCostToRow(job: JobCosts): Record<string, unknown> {
  return {
    jobId: job.jobId,
    customerName: job.customerName,
    address: job.address,
    repSlug: job.repSlug,
    repName: job.repName,
    contractAmount: job.contractAmount,
    additionalWork: job.additionalWork,
    insurancePayout: job.insurancePayout !== undefined ? job.insurancePayout : '',
    totalRevenue: job.totalRevenue,
    materials: JSON.stringify(job.materials || []),
    labor: JSON.stringify(job.labor || []),
    subcontractors: JSON.stringify(job.subcontractors || []),
    overhead: JSON.stringify(job.overhead || []),
    other: JSON.stringify(job.other || []),
    totalCosts: job.totalCosts,
    grossProfit: job.grossProfit,
    grossMargin: job.grossMargin,
    netProfit: job.netProfit,
    netMargin: job.netMargin,
    commissionRate: job.commissionRate,
    commissionAmount: job.commissionAmount,
    status: job.status,
    notes: job.notes,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
  };
}

// =============================================================================
// SERVICE
// =============================================================================

class ProfitabilityService {
  // 60-second cache so we don't hammer the Sheets API for read-heavy endpoints.
  private cache: JobCosts[] | null = null;
  private cacheExpiresAt = 0;

  private invalidateCache(): void {
    this.cache = null;
    this.cacheExpiresAt = 0;
  }

  private async loadFromSheet(): Promise<JobCosts[]> {
    try {
      const rows = await googleSheetsService.getGenericRows(
        SHEET_NAMES.JOB_COSTS,
        JOB_COSTS_HEADERS,
      );
      return rows.filter((r) => r.jobId).map(rowToJobCost);
    } catch (error) {
      console.error('[ProfitabilityService] Error loading job costs from sheet:', error);
      return [];
    }
  }

  private async loadCached(): Promise<JobCosts[]> {
    if (this.cache && Date.now() < this.cacheExpiresAt) return this.cache;
    this.cache = await this.loadFromSheet();
    this.cacheExpiresAt = Date.now() + 60_000;
    return this.cache;
  }

  private async persistJobCost(job: JobCosts): Promise<void> {
    await googleSheetsService.upsertGenericRow(
      SHEET_NAMES.JOB_COSTS,
      JOB_COSTS_HEADERS,
      'jobId',
      jobCostToRow(job),
    );
    this.invalidateCache();
  }

  /**
   * Recalculate totals and margins for a job cost entry.
   */
  private recalculate(job: JobCosts): void {
    // Sum all cost categories
    const sumCategory = (items: CostItem[]) =>
      items.reduce((sum, item) => sum + item.totalCost, 0);

    const materialsCost = sumCategory(job.materials);
    const laborCost = sumCategory(job.labor);
    const subCost = sumCategory(job.subcontractors);
    const overheadCost = sumCategory(job.overhead);
    const otherCost = sumCategory(job.other);

    job.totalCosts = materialsCost + laborCost + subCost + overheadCost + otherCost;

    // Revenue
    job.totalRevenue =
      job.contractAmount + job.additionalWork + (job.insurancePayout || 0);

    // Gross profit = revenue - direct costs (materials + labor + subs)
    const directCosts = materialsCost + laborCost + subCost;
    job.grossProfit = job.totalRevenue - directCosts;
    job.grossMargin =
      job.totalRevenue > 0
        ? Math.round((job.grossProfit / job.totalRevenue) * 10000) / 100
        : 0;

    // Net profit = revenue - all costs
    job.netProfit = job.totalRevenue - job.totalCosts;
    job.netMargin =
      job.totalRevenue > 0
        ? Math.round((job.netProfit / job.totalRevenue) * 10000) / 100
        : 0;

    // Commission
    job.commissionAmount =
      Math.round(job.totalRevenue * job.commissionRate * 100) / 100;
  }

  // ---------------------------------------------------------------------------
  // CRUD
  // ---------------------------------------------------------------------------

  /**
   * Create a new job cost tracking entry.
   */
  async createJobCost(input: {
    jobId?: string;
    customerName: string;
    address: string;
    repSlug: string;
    repName: string;
    contractAmount: number;
    additionalWork?: number;
    insurancePayout?: number;
    commissionRate?: number;
    status?: JobCosts['status'];
    notes?: string;
  }): Promise<JobCosts> {
    const job: JobCosts = {
      jobId: input.jobId || generateId('job'),
      customerName: input.customerName,
      address: input.address,
      repSlug: input.repSlug,
      repName: input.repName,

      contractAmount: input.contractAmount,
      additionalWork: input.additionalWork || 0,
      insurancePayout: input.insurancePayout,
      totalRevenue: 0,

      materials: [],
      labor: [],
      subcontractors: [],
      overhead: [],
      other: [],
      totalCosts: 0,

      grossProfit: 0,
      grossMargin: 0,
      netProfit: 0,
      netMargin: 0,

      commissionRate: input.commissionRate ?? 0.1,
      commissionAmount: 0,

      status: input.status || 'estimating',
      notes: input.notes || '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Add default overhead estimate if no overhead items
    if (job.overhead.length === 0) {
      const overheadAmount = Math.round(input.contractAmount * DEFAULT_OVERHEAD_RATE * 100) / 100;
      job.overhead.push({
        id: generateId('cost'),
        description: 'General overhead (estimated)',
        category: 'overhead',
        quantity: 1,
        unitCost: overheadAmount,
        totalCost: overheadAmount,
        date: new Date().toISOString().split('T')[0],
      });
    }

    this.recalculate(job);

    await this.persistJobCost(job);
    return job;
  }

  /**
   * Get a single job cost entry by jobId.
   */
  async getJobCost(jobId: string): Promise<JobCosts | null> {
    const jobs = await this.loadCached();
    return jobs.find((j) => j.jobId === jobId) || null;
  }

  /**
   * Update job cost fields (revenue, status, notes, commission rate, etc.).
   */
  async updateJobCost(
    jobId: string,
    updates: Partial<
      Pick<
        JobCosts,
        | 'contractAmount'
        | 'additionalWork'
        | 'insurancePayout'
        | 'commissionRate'
        | 'status'
        | 'notes'
        | 'customerName'
        | 'address'
        | 'repSlug'
        | 'repName'
      >
    >
  ): Promise<JobCosts> {
    // Pull a fresh copy to avoid stale cache for writes
    const jobs = await this.loadFromSheet();
    const job = jobs.find((j) => j.jobId === jobId);
    if (!job) throw new Error(`Job cost entry ${jobId} not found`);

    // Apply updates
    if (updates.contractAmount !== undefined)
      job.contractAmount = updates.contractAmount;
    if (updates.additionalWork !== undefined)
      job.additionalWork = updates.additionalWork;
    if (updates.insurancePayout !== undefined)
      job.insurancePayout = updates.insurancePayout;
    if (updates.commissionRate !== undefined)
      job.commissionRate = updates.commissionRate;
    if (updates.status !== undefined) job.status = updates.status;
    if (updates.notes !== undefined) job.notes = updates.notes;
    if (updates.customerName !== undefined)
      job.customerName = updates.customerName;
    if (updates.address !== undefined) job.address = updates.address;
    if (updates.repSlug !== undefined) job.repSlug = updates.repSlug;
    if (updates.repName !== undefined) job.repName = updates.repName;

    this.recalculate(job);
    job.updatedAt = new Date().toISOString();

    await this.persistJobCost(job);
    return job;
  }

  /**
   * Add a cost item to a specific category.
   */
  async addCostItem(
    jobId: string,
    category: 'materials' | 'labor' | 'subcontractors' | 'overhead' | 'other',
    item: Omit<CostItem, 'id' | 'totalCost'>
  ): Promise<CostItem> {
    const jobs = await this.loadFromSheet();
    const job = jobs.find((j) => j.jobId === jobId);
    if (!job) throw new Error(`Job cost entry ${jobId} not found`);

    const costItem: CostItem = {
      id: generateId('cost'),
      description: item.description,
      category: item.category || category,
      quantity: item.quantity,
      unitCost: item.unitCost,
      totalCost: Math.round(item.quantity * item.unitCost * 100) / 100,
      vendor: item.vendor,
      invoiceNumber: item.invoiceNumber,
      date: item.date || new Date().toISOString().split('T')[0],
    };

    job[category].push(costItem);
    this.recalculate(job);
    job.updatedAt = new Date().toISOString();

    await this.persistJobCost(job);
    return costItem;
  }

  /**
   * Remove a cost item by ID from any category.
   */
  async removeCostItem(jobId: string, costItemId: string): Promise<void> {
    const jobs = await this.loadFromSheet();
    const job = jobs.find((j) => j.jobId === jobId);
    if (!job) throw new Error(`Job cost entry ${jobId} not found`);

    const categories: (keyof Pick<
      JobCosts,
      'materials' | 'labor' | 'subcontractors' | 'overhead' | 'other'
    >)[] = ['materials', 'labor', 'subcontractors', 'overhead', 'other'];

    for (const cat of categories) {
      const idx = job[cat].findIndex((item) => item.id === costItemId);
      if (idx !== -1) {
        job[cat].splice(idx, 1);
        break;
      }
    }

    this.recalculate(job);
    job.updatedAt = new Date().toISOString();
    await this.persistJobCost(job);
  }

  /**
   * Get profitability metrics for a single job.
   */
  async calculateProfitability(
    jobId: string
  ): Promise<{ grossProfit: number; grossMargin: number; netProfit: number; netMargin: number } | null> {
    const job = await this.getJobCost(jobId);
    if (!job) return null;
    return {
      grossProfit: job.grossProfit,
      grossMargin: job.grossMargin,
      netProfit: job.netProfit,
      netMargin: job.netMargin,
    };
  }

  // ---------------------------------------------------------------------------
  // QUERIES
  // ---------------------------------------------------------------------------

  /**
   * List job costs with optional filters.
   */
  async listJobCosts(filters?: {
    repSlug?: string;
    status?: string;
    limit?: number;
  }): Promise<JobCosts[]> {
    const data = await this.loadCached();
    let jobs = [...data];

    if (filters?.repSlug) {
      jobs = jobs.filter((j) => j.repSlug === filters.repSlug);
    }
    if (filters?.status) {
      jobs = jobs.filter((j) => j.status === filters.status);
    }

    // Sort newest first
    jobs.sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    if (filters?.limit) {
      jobs = jobs.slice(0, filters.limit);
    }

    return jobs;
  }

  /**
   * Get profitability summary for a specific rep.
   */
  async getRepProfitability(
    repSlug: string
  ): Promise<{ jobs: number; totalRevenue: number; totalProfit: number; avgMargin: number }> {
    const data = await this.loadCached();
    const repJobs = data.filter((j) => j.repSlug === repSlug);

    if (repJobs.length === 0) {
      return { jobs: 0, totalRevenue: 0, totalProfit: 0, avgMargin: 0 };
    }

    const totalRevenue = repJobs.reduce((sum, j) => sum + j.totalRevenue, 0);
    const totalProfit = repJobs.reduce((sum, j) => sum + j.netProfit, 0);
    const avgMargin =
      repJobs.reduce((sum, j) => sum + j.netMargin, 0) / repJobs.length;

    return {
      jobs: repJobs.length,
      totalRevenue: Math.round(totalRevenue * 100) / 100,
      totalProfit: Math.round(totalProfit * 100) / 100,
      avgMargin: Math.round(avgMargin * 100) / 100,
    };
  }

  // ---------------------------------------------------------------------------
  // ANALYTICS
  // ---------------------------------------------------------------------------

  /**
   * Get comprehensive profitability analytics.
   */
  async getAnalytics(startDate?: string, endDate?: string): Promise<ProfitabilityAnalytics> {
    const data = await this.loadCached();
    let jobs = [...data];

    if (startDate) {
      jobs = jobs.filter((j) => j.createdAt >= startDate);
    }
    if (endDate) {
      jobs = jobs.filter((j) => j.createdAt <= endDate);
    }

    const totalJobs = jobs.length;
    if (totalJobs === 0) {
      return {
        totalJobs: 0,
        totalRevenue: 0,
        totalCosts: 0,
        totalProfit: 0,
        avgGrossMargin: 0,
        avgNetMargin: 0,
        byRep: [],
        byMonth: [],
        byMaterial: [],
        mostProfitable: [],
        leastProfitable: [],
      };
    }

    const totalRevenue = jobs.reduce((sum, j) => sum + j.totalRevenue, 0);
    const totalCosts = jobs.reduce((sum, j) => sum + j.totalCosts, 0);
    const totalProfit = jobs.reduce((sum, j) => sum + j.netProfit, 0);
    const avgGrossMargin =
      Math.round(
        (jobs.reduce((sum, j) => sum + j.grossMargin, 0) / totalJobs) * 100
      ) / 100;
    const avgNetMargin =
      Math.round(
        (jobs.reduce((sum, j) => sum + j.netMargin, 0) / totalJobs) * 100
      ) / 100;

    // By rep
    const repMap = new Map<
      string,
      { repName: string; jobs: number; revenue: number; profit: number }
    >();
    for (const job of jobs) {
      const existing = repMap.get(job.repSlug) || {
        repName: job.repName,
        jobs: 0,
        revenue: 0,
        profit: 0,
      };
      existing.jobs++;
      existing.revenue += job.totalRevenue;
      existing.profit += job.netProfit;
      repMap.set(job.repSlug, existing);
    }
    const byRep = Array.from(repMap.entries())
      .map(([slug, d]) => ({
        repSlug: slug,
        repName: d.repName,
        jobs: d.jobs,
        revenue: Math.round(d.revenue * 100) / 100,
        profit: Math.round(d.profit * 100) / 100,
        margin:
          d.revenue > 0
            ? Math.round((d.profit / d.revenue) * 10000) / 100
            : 0,
      }))
      .sort((a, b) => b.margin - a.margin);

    // By month
    const monthMap = new Map<
      string,
      { revenue: number; costs: number; profit: number }
    >();
    for (const job of jobs) {
      const month = job.createdAt.slice(0, 7); // YYYY-MM
      const existing = monthMap.get(month) || {
        revenue: 0,
        costs: 0,
        profit: 0,
      };
      existing.revenue += job.totalRevenue;
      existing.costs += job.totalCosts;
      existing.profit += job.netProfit;
      monthMap.set(month, existing);
    }
    const byMonth = Array.from(monthMap.entries())
      .map(([month, d]) => ({
        month,
        revenue: Math.round(d.revenue * 100) / 100,
        costs: Math.round(d.costs * 100) / 100,
        profit: Math.round(d.profit * 100) / 100,
        margin:
          d.revenue > 0
            ? Math.round((d.profit / d.revenue) * 10000) / 100
            : 0,
      }))
      .sort((a, b) => a.month.localeCompare(b.month));

    // By material (aggregate all material cost items)
    const materialMap = new Map<string, { totalCost: number; jobCount: number }>();
    for (const job of jobs) {
      const seen = new Set<string>();
      for (const item of job.materials) {
        const key = item.description.toLowerCase().trim();
        const existing = materialMap.get(key) || { totalCost: 0, jobCount: 0 };
        existing.totalCost += item.totalCost;
        if (!seen.has(key)) {
          existing.jobCount++;
          seen.add(key);
        }
        materialMap.set(key, existing);
      }
    }
    const byMaterial = Array.from(materialMap.entries())
      .map(([material, d]) => ({
        material,
        totalCost: Math.round(d.totalCost * 100) / 100,
        avgPerJob:
          d.jobCount > 0
            ? Math.round((d.totalCost / d.jobCount) * 100) / 100
            : 0,
      }))
      .sort((a, b) => b.totalCost - a.totalCost)
      .slice(0, 10);

    // Most / least profitable
    const sorted = [...jobs].sort((a, b) => b.netMargin - a.netMargin);
    const mostProfitable = sorted.slice(0, 5).map((j) => ({
      jobId: j.jobId,
      customerName: j.customerName,
      margin: j.netMargin,
    }));
    const leastProfitable = sorted
      .slice(-5)
      .reverse()
      .map((j) => ({
        jobId: j.jobId,
        customerName: j.customerName,
        margin: j.netMargin,
      }));

    return {
      totalJobs,
      totalRevenue: Math.round(totalRevenue * 100) / 100,
      totalCosts: Math.round(totalCosts * 100) / 100,
      totalProfit: Math.round(totalProfit * 100) / 100,
      avgGrossMargin,
      avgNetMargin,
      byRep,
      byMonth,
      byMaterial,
      mostProfitable,
      leastProfitable,
    };
  }
}

// =============================================================================
// SINGLETON EXPORT
// =============================================================================

export const profitabilityService = new ProfitabilityService();
