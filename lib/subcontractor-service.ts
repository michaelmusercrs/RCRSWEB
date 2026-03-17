/**
 * RCRS Subcontractor Management Service
 *
 * Manages subcontractor directory, job assignments, ratings, compliance
 * tracking, and performance analytics.
 *
 * @author RCRS Development Team
 * @version 1.0.0
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

// =============================================================================
// TYPES
// =============================================================================

export type SubcontractorStatus = 'active' | 'inactive' | 'probation' | 'blacklisted';
export type SubcontractorSpecialty =
  | 'roofing'
  | 'gutters'
  | 'siding'
  | 'windows'
  | 'framing'
  | 'drywall'
  | 'painting'
  | 'electrical'
  | 'plumbing'
  | 'hvac'
  | 'tree_removal'
  | 'dumpster';

export type RateType = 'hourly' | 'per_square' | 'flat_rate';
export type JobStatus = 'scheduled' | 'in_progress' | 'completed' | 'issue' | 'cancelled';

export interface SubcontractorDocument {
  name: string;
  url: string;
  type: string;
  expiresAt?: string;
}

export interface SubcontractorJob {
  id: string;
  subcontractorId: string;
  jobId: string;
  customerName: string;
  address: string;
  scope: string;
  startDate: string;
  endDate?: string;
  agreedRate: number;
  rateType: RateType;
  totalCost: number;
  status: JobStatus;
  qualityRating?: number;
  timelinessRating?: number;
  notes: string;
  photos: string[];
  invoiceReceived: boolean;
  invoicePaid: boolean;
  createdAt: string;
}

export interface Subcontractor {
  id: string;
  companyName: string;
  contactName: string;
  phone: string;
  email: string;
  address: string;
  specialty: SubcontractorSpecialty[];
  licenseNumber?: string;
  insuranceExpiry?: string;
  rating: number;
  reliability: number;
  quality: number;
  status: SubcontractorStatus;
  hourlyRate?: number;
  perSquareRate?: number;
  jobHistory: SubcontractorJob[];
  notes: string;
  documents: SubcontractorDocument[];
  createdAt: string;
  updatedAt: string;
}

export interface SubcontractorStats {
  total: number;
  active: number;
  avgRating: number;
  jobsThisMonth: number;
  pendingInvoices: number;
  expiringInsurance: number;
}

export interface SubcontractorFilter {
  specialty?: SubcontractorSpecialty;
  status?: SubcontractorStatus;
  search?: string;
  minRating?: number;
  sortBy?: 'name' | 'rating' | 'reliability' | 'recent';
  sortOrder?: 'asc' | 'desc';
}

interface SubcontractorsFile {
  subcontractors: Subcontractor[];
}

// =============================================================================
// DATA PATH
// =============================================================================

const DATA_FILE_PATH = path.join(process.cwd(), 'data', 'subcontractors.json');

// =============================================================================
// SERVICE CLASS
// =============================================================================

class SubcontractorService {
  // ---------------------------------------------------------------------------
  // File I/O
  // ---------------------------------------------------------------------------

  private readData(): SubcontractorsFile {
    try {
      if (fs.existsSync(DATA_FILE_PATH)) {
        const content = fs.readFileSync(DATA_FILE_PATH, 'utf-8');
        return JSON.parse(content);
      }
    } catch (error) {
      console.error('[Subcontractor] Error reading data:', error);
    }
    return { subcontractors: [] };
  }

  private writeData(data: SubcontractorsFile): void {
    try {
      const dir = path.dirname(DATA_FILE_PATH);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(DATA_FILE_PATH, JSON.stringify(data, null, 2));
    } catch (error) {
      console.error('[Subcontractor] Error writing data:', error);
      throw error;
    }
  }

  // ---------------------------------------------------------------------------
  // ID generation
  // ---------------------------------------------------------------------------

  private generateId(prefix: string): string {
    return `${prefix}-${crypto.randomBytes(6).toString('hex')}`;
  }

  // ---------------------------------------------------------------------------
  // Ratings helpers
  // ---------------------------------------------------------------------------

  private recalculateRatings(sub: Subcontractor): void {
    const completedJobs = sub.jobHistory.filter((j) => j.status === 'completed');
    if (completedJobs.length === 0) return;

    const qualityRatings = completedJobs
      .filter((j) => typeof j.qualityRating === 'number' && j.qualityRating > 0)
      .map((j) => j.qualityRating as number);

    const timelinessRatings = completedJobs
      .filter((j) => typeof j.timelinessRating === 'number' && j.timelinessRating > 0)
      .map((j) => j.timelinessRating as number);

    if (qualityRatings.length > 0) {
      sub.quality = Math.round(
        (qualityRatings.reduce((a, b) => a + b, 0) / qualityRatings.length) * 10
      ) / 10;
    }

    if (timelinessRatings.length > 0) {
      sub.reliability = Math.round(
        (timelinessRatings.reduce((a, b) => a + b, 0) / timelinessRatings.length) * 10
      ) / 10;
    }

    // Overall rating is average of quality and reliability
    sub.rating = Math.round(((sub.quality + sub.reliability) / 2) * 10) / 10;
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  /**
   * Add a new subcontractor
   */
  addSubcontractor(
    data: Omit<Subcontractor, 'id' | 'jobHistory' | 'createdAt' | 'updatedAt'>
  ): Subcontractor {
    const file = this.readData();
    const now = new Date().toISOString();

    const sub: Subcontractor = {
      ...data,
      id: this.generateId('sub'),
      rating: data.rating || 0,
      reliability: data.reliability || 0,
      quality: data.quality || 0,
      status: data.status || 'active',
      specialty: data.specialty || [],
      jobHistory: [],
      documents: data.documents || [],
      notes: data.notes || '',
      createdAt: now,
      updatedAt: now,
    };

    file.subcontractors.push(sub);
    this.writeData(file);

    return sub;
  }

  /**
   * Get all subcontractors with optional filtering
   */
  getSubcontractors(options?: SubcontractorFilter): Subcontractor[] {
    const { subcontractors } = this.readData();
    let results = [...subcontractors];

    if (options?.specialty) {
      results = results.filter((s) => s.specialty.includes(options.specialty!));
    }

    if (options?.status) {
      results = results.filter((s) => s.status === options.status);
    }

    if (options?.minRating) {
      results = results.filter((s) => s.rating >= (options.minRating || 0));
    }

    if (options?.search) {
      const query = options.search.toLowerCase();
      results = results.filter(
        (s) =>
          s.companyName.toLowerCase().includes(query) ||
          s.contactName.toLowerCase().includes(query) ||
          s.email.toLowerCase().includes(query) ||
          s.phone.includes(query) ||
          s.specialty.some((sp) => sp.toLowerCase().includes(query))
      );
    }

    // Sort
    const sortOrder = options?.sortOrder === 'asc' ? 1 : -1;
    switch (options?.sortBy) {
      case 'name':
        results.sort((a, b) => a.companyName.localeCompare(b.companyName) * sortOrder);
        break;
      case 'rating':
        results.sort((a, b) => (b.rating - a.rating) * sortOrder);
        break;
      case 'reliability':
        results.sort((a, b) => (b.reliability - a.reliability) * sortOrder);
        break;
      case 'recent':
        results.sort(
          (a, b) =>
            (new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()) * sortOrder
        );
        break;
      default:
        // Default: active first, then by name
        results.sort((a, b) => {
          if (a.status === 'active' && b.status !== 'active') return -1;
          if (a.status !== 'active' && b.status === 'active') return 1;
          return a.companyName.localeCompare(b.companyName);
        });
    }

    return results;
  }

  /**
   * Get a single subcontractor by ID
   */
  getSubcontractor(id: string): Subcontractor | null {
    const { subcontractors } = this.readData();
    return subcontractors.find((s) => s.id === id) || null;
  }

  /**
   * Update a subcontractor
   */
  updateSubcontractor(
    id: string,
    data: Partial<Omit<Subcontractor, 'id' | 'createdAt'>>
  ): Subcontractor {
    const file = this.readData();
    const index = file.subcontractors.findIndex((s) => s.id === id);

    if (index === -1) {
      throw new Error(`Subcontractor not found: ${id}`);
    }

    const { jobHistory: _ignoreJobs, ...safeUpdates } = data;
    file.subcontractors[index] = {
      ...file.subcontractors[index],
      ...safeUpdates,
      updatedAt: new Date().toISOString(),
    };

    this.writeData(file);
    return file.subcontractors[index];
  }

  /**
   * Assign a job to a subcontractor
   */
  assignJob(
    subId: string,
    jobData: Omit<SubcontractorJob, 'id' | 'subcontractorId' | 'createdAt'>
  ): SubcontractorJob {
    const file = this.readData();
    const index = file.subcontractors.findIndex((s) => s.id === subId);

    if (index === -1) {
      throw new Error(`Subcontractor not found: ${subId}`);
    }

    const job: SubcontractorJob = {
      ...jobData,
      id: this.generateId('job'),
      subcontractorId: subId,
      status: jobData.status || 'scheduled',
      notes: jobData.notes || '',
      photos: jobData.photos || [],
      invoiceReceived: jobData.invoiceReceived || false,
      invoicePaid: jobData.invoicePaid || false,
      createdAt: new Date().toISOString(),
    };

    file.subcontractors[index].jobHistory.push(job);
    file.subcontractors[index].updatedAt = new Date().toISOString();
    this.writeData(file);

    return job;
  }

  /**
   * Update a job for a subcontractor
   */
  updateJob(
    subId: string,
    jobId: string,
    updates: Partial<SubcontractorJob>
  ): SubcontractorJob {
    const file = this.readData();
    const subIndex = file.subcontractors.findIndex((s) => s.id === subId);

    if (subIndex === -1) {
      throw new Error(`Subcontractor not found: ${subId}`);
    }

    const jobIndex = file.subcontractors[subIndex].jobHistory.findIndex(
      (j) => j.id === jobId
    );

    if (jobIndex === -1) {
      throw new Error(`Job not found: ${jobId}`);
    }

    const { id: _ignoreId, subcontractorId: _ignoreSub, createdAt: _ignoreCreated, ...safeUpdates } = updates;
    file.subcontractors[subIndex].jobHistory[jobIndex] = {
      ...file.subcontractors[subIndex].jobHistory[jobIndex],
      ...safeUpdates,
    };

    // Recalculate ratings if quality or timeliness was updated
    if (updates.qualityRating !== undefined || updates.timelinessRating !== undefined) {
      this.recalculateRatings(file.subcontractors[subIndex]);
    }

    file.subcontractors[subIndex].updatedAt = new Date().toISOString();
    this.writeData(file);

    return file.subcontractors[subIndex].jobHistory[jobIndex];
  }

  /**
   * Get available subcontractors by specialty and date
   */
  getAvailable(specialty: SubcontractorSpecialty, date: string): Subcontractor[] {
    const { subcontractors } = this.readData();
    const checkDate = new Date(date);

    return subcontractors.filter((sub) => {
      // Must be active
      if (sub.status !== 'active') return false;

      // Must have matching specialty
      if (!sub.specialty.includes(specialty)) return false;

      // Check if they have any in-progress or scheduled jobs on that date
      const hasConflict = sub.jobHistory.some((job) => {
        if (job.status === 'cancelled' || job.status === 'completed') return false;
        const jobStart = new Date(job.startDate);
        const jobEnd = job.endDate ? new Date(job.endDate) : new Date(jobStart);
        jobEnd.setDate(jobEnd.getDate() + 1); // Default 1 day if no end date
        return checkDate >= jobStart && checkDate <= jobEnd;
      });

      return !hasConflict;
    });
  }

  /**
   * Get aggregate stats
   */
  getSubcontractorStats(): SubcontractorStats {
    const { subcontractors } = this.readData();
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const thirtyDays = new Date();
    thirtyDays.setDate(thirtyDays.getDate() + 30);

    const active = subcontractors.filter((s) => s.status === 'active').length;

    const ratings = subcontractors
      .filter((s) => s.rating > 0)
      .map((s) => s.rating);
    const avgRating =
      ratings.length > 0
        ? Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 10) / 10
        : 0;

    let jobsThisMonth = 0;
    let pendingInvoices = 0;
    let expiringInsurance = 0;

    subcontractors.forEach((sub) => {
      // Count jobs this month
      sub.jobHistory.forEach((job) => {
        const jobDate = new Date(job.createdAt);
        if (jobDate >= monthStart) {
          jobsThisMonth++;
        }
        if (job.status === 'completed' && !job.invoicePaid) {
          pendingInvoices++;
        }
      });

      // Check insurance expiry
      if (sub.insuranceExpiry) {
        const expiry = new Date(sub.insuranceExpiry);
        if (expiry <= thirtyDays && expiry >= now) {
          expiringInsurance++;
        }
      }
    });

    return {
      total: subcontractors.length,
      active,
      avgRating,
      jobsThisMonth,
      pendingInvoices,
      expiringInsurance,
    };
  }

  /**
   * Search subcontractors by text query
   */
  searchSubcontractors(query: string): Subcontractor[] {
    return this.getSubcontractors({ search: query });
  }

  /**
   * Deactivate a subcontractor (soft delete)
   */
  deactivate(id: string): Subcontractor {
    return this.updateSubcontractor(id, { status: 'inactive' });
  }
}

// =============================================================================
// SINGLETON EXPORT
// =============================================================================

export const subcontractorService = new SubcontractorService();
