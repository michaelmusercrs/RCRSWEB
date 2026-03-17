/**
 * RCRS Job Progress Photo Timeline Service
 *
 * Tracks job progress through phases with photos, notes, weather, and crew info.
 * Supports customer-facing shared timelines via token-based public links.
 *
 * Data stored in data/job-progress.json
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
// DATA HELPERS
// =============================================================================

interface JobProgressData {
  timelines: Record<string, JobTimeline>;
}

const DATA_FILE_PATH = path.join(process.cwd(), 'data', 'job-progress.json');

function readData(): JobProgressData {
  try {
    if (fs.existsSync(DATA_FILE_PATH)) {
      const content = fs.readFileSync(DATA_FILE_PATH, 'utf-8');
      return JSON.parse(content);
    }
  } catch (error) {
    console.error('[JobProgressService] Error reading data:', error);
  }
  return { timelines: {} };
}

function writeData(data: JobProgressData): void {
  try {
    const dir = path.dirname(DATA_FILE_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(DATA_FILE_PATH, JSON.stringify(data, null, 2));
  } catch (error) {
    console.error('[JobProgressService] Error writing data:', error);
    throw error;
  }
}

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

// =============================================================================
// SERVICE CLASS
// =============================================================================

class JobProgressService {

  /**
   * Get the full timeline for a job.
   */
  getTimeline(jobId: string): JobTimeline | null {
    const data = readData();
    const timeline = data.timelines[jobId];
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
  addProgressEntry(jobId: string, entryData: {
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
  }): JobProgressEntry {
    const data = readData();

    // Create timeline if needed
    if (!data.timelines[jobId]) {
      data.timelines[jobId] = {
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

    const timeline = data.timelines[jobId];
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

    writeData(data);
    return entry;
  }

  /**
   * Add photos to an existing progress entry.
   */
  addPhotos(jobId: string, entryId: string, photos: Omit<JobPhoto, 'id' | 'uploadedAt'>[]): JobPhoto[] {
    const data = readData();
    const timeline = data.timelines[jobId];
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

    writeData(data);
    return newPhotos;
  }

  /**
   * Update the phase of a job (convenience method that creates a new entry).
   */
  updatePhase(jobId: string, phase: JobPhase, notes: string, photos?: Omit<JobPhoto, 'id' | 'uploadedAt'>[]): JobProgressEntry {
    const data = readData();
    const timeline = data.timelines[jobId];
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
  getRecentProgress(limit: number = 20): JobProgressEntry[] {
    const data = readData();
    const allEntries: JobProgressEntry[] = [];

    for (const timeline of Object.values(data.timelines)) {
      allEntries.push(...timeline.entries);
    }

    allEntries.sort((a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime());
    return allEntries.slice(0, limit);
  }

  /**
   * Get all job timelines filtered by phase.
   */
  getJobsByPhase(phase: JobPhase): JobTimeline[] {
    const data = readData();
    const result: JobTimeline[] = [];

    for (const timeline of Object.values(data.timelines)) {
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
  getAllTimelines(options?: {
    phase?: JobPhase;
    repSlug?: string;
    limit?: number;
  }): JobTimeline[] {
    const data = readData();
    let timelines = Object.values(data.timelines);

    // Recompute dynamic fields
    timelines = timelines.map(t => ({
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
  shareTimeline(jobId: string): { url: string; token: string } {
    const data = readData();
    const timeline = data.timelines[jobId];
    if (!timeline) throw new Error(`Timeline not found for job ${jobId}`);

    if (!timeline.shareToken) {
      timeline.shareToken = generateShareToken();
      writeData(data);
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
  getCustomerTimeline(token: string): JobTimeline | null {
    const data = readData();

    for (const timeline of Object.values(data.timelines)) {
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
  markCustomerViewed(token: string): void {
    const data = readData();

    for (const timeline of Object.values(data.timelines)) {
      if (timeline.shareToken === token) {
        const now = new Date().toISOString();
        for (const entry of timeline.entries) {
          if (!entry.customerViewedAt) {
            entry.customerViewedAt = now;
          }
        }
        writeData(data);
        return;
      }
    }
  }

  /**
   * Get aggregate progress statistics.
   */
  getProgressStats(): ProgressStats {
    const data = readData();
    const timelines = Object.values(data.timelines);

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
  markCustomerNotified(jobId: string, entryId: string): void {
    const data = readData();
    const timeline = data.timelines[jobId];
    if (!timeline) return;

    const entry = timeline.entries.find(e => e.id === entryId);
    if (entry) {
      entry.customerNotified = true;
      writeData(data);
    }
  }
}

// =============================================================================
// SINGLETON EXPORT
// =============================================================================

export const jobProgressService = new JobProgressService();
