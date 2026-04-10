/**
 * RCRS Job Progress Photo Timeline Service
 *
 * Tracks job progress through phases with photos, notes, weather, and crew info.
 * Supports customer-facing shared timelines via token-based public links.
 *
 * Persisted to the master Google Sheet on the `Job_Progress` tab via
 * googleSheetsService. One row per jobId — the `entries` array (with embedded
 * photos) is stored as a JSON string on each row. The local
 * data/job-progress.json file is now a deprecated dev seed and is NOT written
 * by this service anymore.
 *
 * @author RCRS Development Team
 * @version 2.0.0
 */

import crypto from 'crypto';
import { googleSheetsService, SHEET_NAMES } from './google-sheets-service';

// =============================================================================
// TYPES
// =============================================================================

export type JobPhase =
  | 'pre_inspection'
  | 'inspection'
  | 'estimate'
  | 'contract_signed'
  | 'material_ordered'
  | 'material_delivered'
  | 'tear_off'
  | 'install_day1'
  | 'install_day2'
  | 'install_day3'
  | 'cleanup'
  | 'final_inspection'
  | 'completed'
  | 'warranty_registered';

export interface JobPhoto {
  id: string;
  url: string;
  caption: string;
  category: 'before' | 'during' | 'after' | 'damage' | 'material' | 'detail' | 'crew' | 'drone';
  uploadedBy: string;
  uploadedAt: string;
  isCustomerVisible: boolean;
}

export interface JobProgressEntry {
  id: string;
  jobId: string;
  jobNimbusId?: string;
  customerName: string;
  address: string;

  phase: JobPhase;

  photos: JobPhoto[];
  notes: string;
  weather?: string;
  crewMembers?: string[];

  completedBy: string;
  completedByName: string;
  completedAt: string;

  customerNotified: boolean;
  customerViewedAt?: string;
}

export interface JobTimeline {
  jobId: string;
  customerName: string;
  address: string;
  status: string;
  startDate: string;
  completionDate?: string;
  entries: JobProgressEntry[];
  totalPhotos: number;
  completionPercentage: number;
  assignedRep: string;
  shareToken?: string;
}

export interface ProgressStats {
  inProgress: number;
  completedThisMonth: number;
  avgDaysToComplete: number;
  totalPhotos: number;
  byPhase: Record<string, number>;
}

// =============================================================================
// CONSTANTS
// =============================================================================

export const PHASE_ORDER: JobPhase[] = [
  'pre_inspection',
  'inspection',
  'estimate',
  'contract_signed',
  'material_ordered',
  'material_delivered',
  'tear_off',
  'install_day1',
  'install_day2',
  'install_day3',
  'cleanup',
  'final_inspection',
  'completed',
  'warranty_registered',
];

export const PHASE_LABELS: Record<JobPhase, string> = {
  pre_inspection: 'Pre-Inspection',
  inspection: 'Inspection',
  estimate: 'Estimate',
  contract_signed: 'Contract Signed',
  material_ordered: 'Material Ordered',
  material_delivered: 'Material Delivered',
  tear_off: 'Tear Off',
  install_day1: 'Install Day 1',
  install_day2: 'Install Day 2',
  install_day3: 'Install Day 3',
  cleanup: 'Cleanup',
  final_inspection: 'Final Inspection',
  completed: 'Completed',
  warranty_registered: 'Warranty Registered',
};

export const PHOTO_CATEGORIES = [
  'before', 'during', 'after', 'damage', 'material', 'detail', 'crew', 'drone',
] as const;

// =============================================================================
// SHEET CONFIG
// =============================================================================

// Canonical column order for the Job_Progress tab. Do NOT reorder.
// One row per jobId; `entries` is a JSON-encoded array of JobProgressEntry.
const JOB_PROGRESS_HEADERS: string[] = [
  'jobId',
  'customerName',
  'address',
  'status',
  'startDate',
  'completionDate',
  'entries',
  'totalPhotos',
  'completionPercentage',
  'assignedRep',
  'shareToken',
];

// =============================================================================
// HELPERS
// =============================================================================

function generateId(prefix: string): string {
  return `${prefix}-${crypto.randomBytes(6).toString('hex')}`;
}

function generateShareToken(): string {
  return crypto.randomBytes(16).toString('hex');
}

function getPhaseIndex(phase: JobPhase): number {
  return PHASE_ORDER.indexOf(phase);
}

function computeCompletionPercentage(entries: JobProgressEntry[]): number {
  if (entries.length === 0) return 0;
  const latestPhase = entries[entries.length - 1]?.phase;
  const phaseIdx = getPhaseIndex(latestPhase);
  return Math.round(((phaseIdx + 1) / PHASE_ORDER.length) * 100);
}

function computeStatus(timeline: JobTimeline): string {
  if (timeline.entries.length === 0) return 'not_started';
  const latestPhase = timeline.entries[timeline.entries.length - 1]?.phase;
  if (latestPhase === 'completed' || latestPhase === 'warranty_registered') return 'completed';
  return 'in_progress';
}

/** Parse a sheet row back into a JobTimeline. */
function rowToTimeline(row: Record<string, string>): JobTimeline {
  let entries: JobProgressEntry[] = [];
  if (row.entries) {
    try {
      entries = JSON.parse(row.entries) as JobProgressEntry[];
    } catch {
      entries = [];
    }
  }

  const timeline: JobTimeline = {
    jobId: row.jobId || '',
    customerName: row.customerName || '',
    address: row.address || '',
    status: row.status || 'not_started',
    startDate: row.startDate || '',
    completionDate: row.completionDate || undefined,
    entries,
    totalPhotos:
      row.totalPhotos !== '' && row.totalPhotos !== undefined
        ? Number(row.totalPhotos)
        : 0,
    completionPercentage:
      row.completionPercentage !== '' && row.completionPercentage !== undefined
        ? Number(row.completionPercentage)
        : 0,
    assignedRep: row.assignedRep || '',
    shareToken: row.shareToken || undefined,
  };

  return timeline;
}

/** Flatten a JobTimeline into sheet columns. */
function timelineToRow(timeline: JobTimeline): Record<string, unknown> {
  return {
    jobId: timeline.jobId,
    customerName: timeline.customerName,
    address: timeline.address,
    status: timeline.status,
    startDate: timeline.startDate,
    completionDate: timeline.completionDate || '',
    entries: JSON.stringify(timeline.entries || []),
    totalPhotos: timeline.totalPhotos,
    completionPercentage: timeline.completionPercentage,
    assignedRep: timeline.assignedRep,
    shareToken: timeline.shareToken || '',
  };
}

// =============================================================================
// SERVICE CLASS
// =============================================================================

class JobProgressService {
  // 60-second cache so we don't hammer the Sheets API for read-heavy endpoints.
  private cache: JobTimeline[] | null = null;
  private cacheExpiresAt = 0;

  private invalidateCache(): void {
    this.cache = null;
    this.cacheExpiresAt = 0;
  }

  private async loadFromSheet(): Promise<JobTimeline[]> {
    try {
      const rows = await googleSheetsService.getGenericRows(
        SHEET_NAMES.JOB_PROGRESS,
        JOB_PROGRESS_HEADERS,
      );
      return rows.filter((r) => r.jobId).map(rowToTimeline);
    } catch (error) {
      console.error('[JobProgressService] Error loading timelines from sheet:', error);
      return [];
    }
  }

  private async loadCached(): Promise<JobTimeline[]> {
    if (this.cache && Date.now() < this.cacheExpiresAt) return this.cache;
    this.cache = await this.loadFromSheet();
    this.cacheExpiresAt = Date.now() + 60_000;
    return this.cache;
  }

  private async persistTimeline(timeline: JobTimeline): Promise<void> {
    await googleSheetsService.upsertGenericRow(
      SHEET_NAMES.JOB_PROGRESS,
      JOB_PROGRESS_HEADERS,
      'jobId',
      timelineToRow(timeline),
    );
    this.invalidateCache();
  }

  /**
   * Get the full timeline for a job.
   */
  async getTimeline(jobId: string): Promise<JobTimeline | null> {
    const timelines = await this.loadCached();
    const timeline = timelines.find((t) => t.jobId === jobId);
    if (!timeline) return null;

    // Recompute dynamic fields
    timeline.totalPhotos = timeline.entries.reduce((sum, e) => sum + e.photos.length, 0);
    timeline.completionPercentage = computeCompletionPercentage(timeline.entries);
    timeline.status = computeStatus(timeline);

    return timeline;
  }

  /**
   * Add a new progress entry to a job timeline.
   * Creates the timeline if it doesn't exist.
   */
  async addProgressEntry(jobId: string, entryData: {
    phase: JobPhase;
    notes: string;
    photos?: Omit<JobPhoto, 'id' | 'uploadedAt'>[];
    weather?: string;
    crewMembers?: string[];
    customerName: string;
    address: string;
    completedBy: string;
    completedByName: string;
    jobNimbusId?: string;
    customerNotified?: boolean;
  }): Promise<JobProgressEntry> {
    // Load current timeline (bypass cache for writes to avoid stale reads)
    const timelines = await this.loadFromSheet();
    let timeline = timelines.find((t) => t.jobId === jobId);

    if (!timeline) {
      timeline = {
        jobId,
        customerName: entryData.customerName,
        address: entryData.address,
        status: 'in_progress',
        startDate: new Date().toISOString(),
        entries: [],
        totalPhotos: 0,
        completionPercentage: 0,
        assignedRep: entryData.completedBy,
      };
    }

    const now = new Date().toISOString();

    // Build photos
    const photos: JobPhoto[] = (entryData.photos || []).map(p => ({
      ...p,
      id: generateId('PHT'),
      uploadedAt: now,
    }));

    const entry: JobProgressEntry = {
      id: generateId('PGE'),
      jobId,
      jobNimbusId: entryData.jobNimbusId,
      customerName: entryData.customerName,
      address: entryData.address,
      phase: entryData.phase,
      photos,
      notes: entryData.notes,
      weather: entryData.weather,
      crewMembers: entryData.crewMembers,
      completedBy: entryData.completedBy,
      completedByName: entryData.completedByName,
      completedAt: now,
      customerNotified: entryData.customerNotified || false,
    };

    timeline.entries.push(entry);
    timeline.totalPhotos = timeline.entries.reduce((sum, e) => sum + e.photos.length, 0);
    timeline.completionPercentage = computeCompletionPercentage(timeline.entries);
    timeline.status = computeStatus(timeline);

    if (entry.phase === 'completed' || entry.phase === 'warranty_registered') {
      timeline.completionDate = now;
    }

    await this.persistTimeline(timeline);
    return entry;
  }

  /**
   * Add photos to an existing progress entry.
   */
  async addPhotos(jobId: string, entryId: string, photos: Omit<JobPhoto, 'id' | 'uploadedAt'>[]): Promise<JobPhoto[]> {
    const timelines = await this.loadFromSheet();
    const timeline = timelines.find((t) => t.jobId === jobId);
    if (!timeline) throw new Error(`Timeline not found for job ${jobId}`);

    const entry = timeline.entries.find(e => e.id === entryId);
    if (!entry) throw new Error(`Entry ${entryId} not found in job ${jobId}`);

    const now = new Date().toISOString();
    const newPhotos: JobPhoto[] = photos.map(p => ({
      ...p,
      id: generateId('PHT'),
      uploadedAt: now,
    }));

    entry.photos.push(...newPhotos);
    timeline.totalPhotos = timeline.entries.reduce((sum, e) => sum + e.photos.length, 0);

    await this.persistTimeline(timeline);
    return newPhotos;
  }

  /**
   * Update the phase of a job (convenience method that creates a new entry).
   */
  async updatePhase(jobId: string, phase: JobPhase, notes: string, photos?: Omit<JobPhoto, 'id' | 'uploadedAt'>[]): Promise<JobProgressEntry> {
    const timelines = await this.loadFromSheet();
    const timeline = timelines.find((t) => t.jobId === jobId);
    if (!timeline) throw new Error(`Timeline not found for job ${jobId}`);

    return this.addProgressEntry(jobId, {
      phase,
      notes,
      photos,
      customerName: timeline.customerName,
      address: timeline.address,
      completedBy: timeline.assignedRep,
      completedByName: timeline.assignedRep,
    });
  }

  /**
   * Get recently updated progress entries across all jobs.
   */
  async getRecentProgress(limit: number = 20): Promise<JobProgressEntry[]> {
    const timelines = await this.loadCached();
    const allEntries: JobProgressEntry[] = [];

    for (const timeline of timelines) {
      allEntries.push(...timeline.entries);
    }

    allEntries.sort((a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime());
    return allEntries.slice(0, limit);
  }

  /**
   * Get all job timelines filtered by phase.
   */
  async getJobsByPhase(phase: JobPhase): Promise<JobTimeline[]> {
    const timelines = await this.loadCached();
    const result: JobTimeline[] = [];

    for (const timeline of timelines) {
      if (timeline.entries.length === 0) continue;
      const latestPhase = timeline.entries[timeline.entries.length - 1]?.phase;
      if (latestPhase === phase) {
        timeline.totalPhotos = timeline.entries.reduce((sum, e) => sum + e.photos.length, 0);
        timeline.completionPercentage = computeCompletionPercentage(timeline.entries);
        timeline.status = computeStatus(timeline);
        result.push(timeline);
      }
    }

    return result;
  }

  /**
   * Get all timelines, optionally filtered.
   */
  async getAllTimelines(options?: {
    phase?: JobPhase;
    repSlug?: string;
    limit?: number;
  }): Promise<JobTimeline[]> {
    const cached = await this.loadCached();
    // Recompute dynamic fields
    let timelines: JobTimeline[] = cached.map(t => ({
      ...t,
      totalPhotos: t.entries.reduce((sum, e) => sum + e.photos.length, 0),
      completionPercentage: computeCompletionPercentage(t.entries),
      status: computeStatus(t),
    }));

    if (options?.phase) {
      timelines = timelines.filter(t => {
        if (t.entries.length === 0) return false;
        return t.entries[t.entries.length - 1]?.phase === options.phase;
      });
    }

    if (options?.repSlug) {
      timelines = timelines.filter(t => t.assignedRep === options.repSlug);
    }

    // Sort by most recently updated
    timelines.sort((a, b) => {
      const aLast = a.entries[a.entries.length - 1]?.completedAt || a.startDate;
      const bLast = b.entries[b.entries.length - 1]?.completedAt || b.startDate;
      return new Date(bLast).getTime() - new Date(aLast).getTime();
    });

    if (options?.limit) {
      timelines = timelines.slice(0, options.limit);
    }

    return timelines;
  }

  /**
   * Generate a shareable customer-facing timeline link.
   */
  async shareTimeline(jobId: string): Promise<{ url: string; token: string }> {
    const timelines = await this.loadFromSheet();
    const timeline = timelines.find((t) => t.jobId === jobId);
    if (!timeline) throw new Error(`Timeline not found for job ${jobId}`);

    if (!timeline.shareToken) {
      timeline.shareToken = generateShareToken();
      await this.persistTimeline(timeline);
    }

    return {
      url: `/api/job-progress/share/${timeline.shareToken}`,
      token: timeline.shareToken,
    };
  }

  /**
   * Get customer-visible timeline using a share token.
   * Filters out non-customer-visible photos and internal notes.
   */
  async getCustomerTimeline(token: string): Promise<JobTimeline | null> {
    const timelines = await this.loadCached();

    for (const timeline of timelines) {
      if (timeline.shareToken === token) {
        // Filter entries to only customer-visible content
        const filteredEntries = timeline.entries.map(entry => ({
          ...entry,
          photos: entry.photos.filter(p => p.isCustomerVisible),
        }));

        return {
          ...timeline,
          entries: filteredEntries,
          totalPhotos: filteredEntries.reduce((sum, e) => sum + e.photos.length, 0),
          completionPercentage: computeCompletionPercentage(timeline.entries),
          status: computeStatus(timeline),
        };
      }
    }

    return null;
  }

  /**
   * Mark a customer timeline as viewed.
   */
  async markCustomerViewed(token: string): Promise<void> {
    const timelines = await this.loadFromSheet();

    for (const timeline of timelines) {
      if (timeline.shareToken === token) {
        const now = new Date().toISOString();
        for (const entry of timeline.entries) {
          if (!entry.customerViewedAt) {
            entry.customerViewedAt = now;
          }
        }
        await this.persistTimeline(timeline);
        return;
      }
    }
  }

  /**
   * Get aggregate progress statistics.
   */
  async getProgressStats(): Promise<ProgressStats> {
    const timelines = await this.loadCached();

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    let totalPhotos = 0;
    let inProgress = 0;
    let completedThisMonth = 0;
    const completionDays: number[] = [];
    const byPhase: Record<string, number> = {};

    // Initialize phase counts
    for (const phase of PHASE_ORDER) {
      byPhase[phase] = 0;
    }

    for (const timeline of timelines) {
      totalPhotos += timeline.entries.reduce((sum, e) => sum + e.photos.length, 0);

      const status = computeStatus(timeline);

      if (status === 'in_progress') {
        inProgress++;
        // Count by current phase
        if (timeline.entries.length > 0) {
          const currentPhase = timeline.entries[timeline.entries.length - 1].phase;
          byPhase[currentPhase] = (byPhase[currentPhase] || 0) + 1;
        }
      }

      if (status === 'completed' && timeline.completionDate) {
        const completionDate = new Date(timeline.completionDate);
        if (completionDate >= monthStart) {
          completedThisMonth++;
        }

        // Calculate days to complete
        const startDate = new Date(timeline.startDate);
        const days = Math.ceil((completionDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
        if (days > 0) completionDays.push(days);
      }
    }

    const avgDaysToComplete = completionDays.length > 0
      ? Math.round(completionDays.reduce((a, b) => a + b, 0) / completionDays.length)
      : 0;

    return {
      inProgress,
      completedThisMonth,
      avgDaysToComplete,
      totalPhotos,
      byPhase,
    };
  }

  /**
   * Notify customer about progress update.
   */
  async markCustomerNotified(jobId: string, entryId: string): Promise<void> {
    const timelines = await this.loadFromSheet();
    const timeline = timelines.find((t) => t.jobId === jobId);
    if (!timeline) return;

    const entry = timeline.entries.find(e => e.id === entryId);
    if (entry) {
      entry.customerNotified = true;
      await this.persistTimeline(timeline);
    }
  }
}

// =============================================================================
// SINGLETON EXPORT
// =============================================================================

export const jobProgressService = new JobProgressService();
