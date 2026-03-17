/**
 * Job Profitability Service for River City Roofing Solutions
 *
 * Tracks per-job costs (materials, labor, subs, overhead), calculates
 * gross/net margins, and provides analytics by rep, month, and material.
 * Data persisted in data/job-costs.json.
 *
 * @version 1.0.0
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

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
// DATA HELPERS
// =============================================================================

interface JobCostData {
  jobCosts: JobCosts[];
}

const JOB_COSTS_FILE = path.join(process.cwd(), 'data', 'job-costs.json');

// Default overhead rate applied to all jobs (percentage of revenue)
const DEFAULT_OVERHEAD_RATE = 0.08;

function readJobCosts(): JobCostData {
  try {
    if (fs.existsSync(JOB_COSTS_FILE)) {
      const content = fs.readFileSync(JOB_COSTS_FILE, 'utf-8');
      return JSON.parse(content);
    }
  } catch (error) {
    console.error('[ProfitabilityService] Error reading job costs:', error);
  }
  return { jobCosts: [] };
}

function writeJobCosts(data: JobCostData): void {
  try {
    const dir = path.dirname(JOB_COSTS_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(JOB_COSTS_FILE, JSON.stringify(data, null, 2));
  } catch (error) {
    console.error('[ProfitabilityService] Error writing job costs:', error);
    throw error;
  }
}

function generateId(prefix: string): string {
  return `${prefix}-${crypto.randomBytes(6).toString('hex')}`;
}

// =============================================================================
// SERVICE
// =============================================================================

class ProfitabilityService {
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
  createJobCost(input: {
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
  }): JobCosts {
    const data = readJobCosts();

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

    data.jobCosts.push(job);
    writeJobCosts(data);
    return job;
  }

  /**
   * Get a single job cost entry by jobId.
   */
  getJobCost(jobId: string): JobCosts | null {
    const data = readJobCosts();
    return data.jobCosts.find((j) => j.jobId === jobId) || null;
  }

  /**
   * Update job cost fields (revenue, status, notes, commission rate, etc.).
   */
  updateJobCost(
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
  ): JobCosts {
    const data = readJobCosts();
    const job = data.jobCosts.find((j) => j.jobId === jobId);
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

    writeJobCosts(data);
    return job;
  }

  /**
   * Add a cost item to a specific category.
   */
  addCostItem(
    jobId: string,
    category: 'materials' | 'labor' | 'subcontractors' | 'overhead' | 'other',
    item: Omit<CostItem, 'id' | 'totalCost'>
  ): CostItem {
    const data = readJobCosts();
    const job = data.jobCosts.find((j) => j.jobId === jobId);
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

    writeJobCosts(data);
    return costItem;
  }

  /**
   * Remove a cost item by ID from any category.
   */
  removeCostItem(jobId: string, costItemId: string): void {
    const data = readJobCosts();
    const job = data.jobCosts.find((j) => j.jobId === jobId);
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
    writeJobCosts(data);
  }

  /**
   * Get profitability metrics for a single job.
   */
  calculateProfitability(
    jobId: string
  ): { grossProfit: number; grossMargin: number; netProfit: number; netMargin: number } | null {
    const job = this.getJobCost(jobId);
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
  listJobCosts(filters?: {
    repSlug?: string;
    status?: string;
    limit?: number;
  }): JobCosts[] {
    const data = readJobCosts();
    let jobs = [...data.jobCosts];

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
  getRepProfitability(
    repSlug: string
  ): { jobs: number; totalRevenue: number; totalProfit: number; avgMargin: number } {
    const data = readJobCosts();
    const repJobs = data.jobCosts.filter((j) => j.repSlug === repSlug);

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
  getAnalytics(startDate?: string, endDate?: string): ProfitabilityAnalytics {
    const data = readJobCosts();
    let jobs = [...data.jobCosts];

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
