/**
 * RCRS Subcontractor Management Service
 *
 * Manages subcontractor directory, job assignments, ratings, compliance
 * tracking, and performance analytics.
 *
 * Persisted to the Google Sheets master workbook (Subcontractors tab).
 * The legacy data/subcontractors.json file is left in place as a dev seed
 * but no longer read or written at runtime.
 *
 * @author RCRS Development Team
 * @version 2.0.0
 */

import crypto from 'crypto';
import { googleSheetsService, SHEET_NAMES } from './google-sheets-service';

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

// =============================================================================
// SHEET SCHEMA
// =============================================================================

const SUBCONTRACTOR_HEADERS: string[] = [
  'id',
  'companyName',
  'contactName',
  'phone',
  'email',
  'address',
  'specialty',        // JSON string[]
  'licenseNumber',
  'insuranceExpiry',
  'rating',
  'reliability',
  'quality',
  'status',
  'hourlyRate',
  'perSquareRate',
  'jobHistory',       // JSON SubcontractorJob[]
  'notes',
  'documents',        // JSON SubcontractorDocument[]
  'createdAt',
  'updatedAt',
];

// =============================================================================
// ROW <-> OBJECT CONVERSION
// =============================================================================

function parseJson<T>(raw: string, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function parseNumber(raw: string): number {
  if (!raw) return 0;
  const n = parseFloat(raw);
  return Number.isFinite(n) ? n : 0;
}

function rowToSub(row: Record<string, string>): Subcontractor {
  const sub: Subcontractor = {
    id: row.id || '',
    companyName: row.companyName || '',
    contactName: row.contactName || '',
    phone: row.phone || '',
    email: row.email || '',
    address: row.address || '',
    specialty: parseJson<SubcontractorSpecialty[]>(row.specialty, []),
    rating: parseNumber(row.rating),
    reliability: parseNumber(row.reliability),
    quality: parseNumber(row.quality),
    status: (row.status as SubcontractorStatus) || 'active',
    jobHistory: parseJson<SubcontractorJob[]>(row.jobHistory, []),
    notes: row.notes || '',
    documents: parseJson<SubcontractorDocument[]>(row.documents, []),
    createdAt: row.createdAt || '',
    updatedAt: row.updatedAt || '',
  };
  if (row.licenseNumber) sub.licenseNumber = row.licenseNumber;
  if (row.insuranceExpiry) sub.insuranceExpiry = row.insuranceExpiry;
  if (row.hourlyRate) sub.hourlyRate = parseNumber(row.hourlyRate);
  if (row.perSquareRate) sub.perSquareRate = parseNumber(row.perSquareRate);
  return sub;
}

function subToRow(sub: Subcontractor): Record<string, unknown> {
  return {
    id: sub.id,
    companyName: sub.companyName,
    contactName: sub.contactName,
    phone: sub.phone,
    email: sub.email,
    address: sub.address,
    specialty: JSON.stringify(sub.specialty || []),
    licenseNumber: sub.licenseNumber || '',
    insuranceExpiry: sub.insuranceExpiry || '',
    rating: sub.rating,
    reliability: sub.reliability,
    quality: sub.quality,
    status: sub.status,
    hourlyRate: sub.hourlyRate ?? '',
    perSquareRate: sub.perSquareRate ?? '',
    jobHistory: JSON.stringify(sub.jobHistory || []),
    notes: sub.notes || '',
    documents: JSON.stringify(sub.documents || []),
    createdAt: sub.createdAt,
    updatedAt: sub.updatedAt,
  };
}

// =============================================================================
// SERVICE CLASS
// =============================================================================

class SubcontractorService {
  // 60-second in-memory cache
  private cache: Subcontractor[] | null = null;
  private cacheExpiresAt = 0;
  private readonly CACHE_TTL_MS = 60_000;

  private async loadFromSheet(): Promise<Subcontractor[]> {
    const rows = await googleSheetsService.getGenericRows(
      SHEET_NAMES.SUBCONTRACTORS,
      SUBCONTRACTOR_HEADERS
    );
    return rows.map(rowToSub);
  }

  private async loadCached(): Promise<Subcontractor[]> {
    if (this.cache && Date.now() < this.cacheExpiresAt) {
      return this.cache;
    }
    this.cache = await this.loadFromSheet();
    this.cacheExpiresAt = Date.now() + this.CACHE_TTL_MS;
    return this.cache;
  }

  private invalidateCache(): void {
    this.cache = null;
    this.cacheExpiresAt = 0;
  }

  private async persist(sub: Subcontractor): Promise<void> {
    await googleSheetsService.upsertGenericRow(
      SHEET_NAMES.SUBCONTRACTORS,
      SUBCONTRACTOR_HEADERS,
      'id',
      subToRow(sub)
    );
    this.invalidateCache();
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
  async addSubcontractor(
    data: Omit<Subcontractor, 'id' | 'jobHistory' | 'createdAt' | 'updatedAt'>
  ): Promise<Subcontractor> {
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

    await this.persist(sub);
    return sub;
  }

  /**
   * Get all subcontractors with optional filtering
   */
  async getSubcontractors(options?: SubcontractorFilter): Promise<Subcontractor[]> {
    const subcontractors = await this.loadCached();
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
  async getSubcontractor(id: string): Promise<Subcontractor | null> {
    const subcontractors = await this.loadCached();
    return subcontractors.find((s) => s.id === id) || null;
  }

  /**
   * Update a subcontractor
   */
  async updateSubcontractor(
    id: string,
    data: Partial<Omit<Subcontractor, 'id' | 'createdAt'>>
  ): Promise<Subcontractor> {
    const subcontractors = await this.loadCached();
    const existing = subcontractors.find((s) => s.id === id);

    if (!existing) {
      throw new Error(`Subcontractor not found: ${id}`);
    }

    const { jobHistory: _ignoreJobs, ...safeUpdates } = data;
    const updated: Subcontractor = {
      ...existing,
      ...safeUpdates,
      updatedAt: new Date().toISOString(),
    };

    await this.persist(updated);
    return updated;
  }

  /**
   * Assign a job to a subcontractor
   */
  async assignJob(
    subId: string,
    jobData: Omit<SubcontractorJob, 'id' | 'subcontractorId' | 'createdAt'>
  ): Promise<SubcontractorJob> {
    const subcontractors = await this.loadCached();
    const existing = subcontractors.find((s) => s.id === subId);

    if (!existing) {
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

    const updated: Subcontractor = {
      ...existing,
      jobHistory: [...existing.jobHistory, job],
      updatedAt: new Date().toISOString(),
    };

    await this.persist(updated);
    return job;
  }

  /**
   * Update a job for a subcontractor
   */
  async updateJob(
    subId: string,
    jobId: string,
    updates: Partial<SubcontractorJob>
  ): Promise<SubcontractorJob> {
    const subcontractors = await this.loadCached();
    const existing = subcontractors.find((s) => s.id === subId);

    if (!existing) {
      throw new Error(`Subcontractor not found: ${subId}`);
    }

    const jobIndex = existing.jobHistory.findIndex((j) => j.id === jobId);
    if (jobIndex === -1) {
      throw new Error(`Job not found: ${jobId}`);
    }

    const { id: _ignoreId, subcontractorId: _ignoreSub, createdAt: _ignoreCreated, ...safeUpdates } = updates;
    const newJobHistory = [...existing.jobHistory];
    newJobHistory[jobIndex] = { ...newJobHistory[jobIndex], ...safeUpdates };

    const updated: Subcontractor = {
      ...existing,
      jobHistory: newJobHistory,
      updatedAt: new Date().toISOString(),
    };

    // Recalculate ratings if quality or timeliness was updated
    if (updates.qualityRating !== undefined || updates.timelinessRating !== undefined) {
      this.recalculateRatings(updated);
    }

    await this.persist(updated);
    return updated.jobHistory[jobIndex];
  }

  /**
   * Get available subcontractors by specialty and date
   */
  async getAvailable(specialty: SubcontractorSpecialty, date: string): Promise<Subcontractor[]> {
    const subcontractors = await this.loadCached();
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
  async getSubcontractorStats(): Promise<SubcontractorStats> {
    const subcontractors = await this.loadCached();
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
  async searchSubcontractors(query: string): Promise<Subcontractor[]> {
    return this.getSubcontractors({ search: query });
  }

  /**
   * Deactivate a subcontractor (soft delete)
   */
  async deactivate(id: string): Promise<Subcontractor> {
    return this.updateSubcontractor(id, { status: 'inactive' });
  }
}

// =============================================================================
// SINGLETON EXPORT
// =============================================================================

export const subcontractorService = new SubcontractorService();
