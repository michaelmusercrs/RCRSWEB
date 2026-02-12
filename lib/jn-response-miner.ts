// JN Response Time Miner
// Mines JobNimbus historical data to calculate per-rep response times.
// Office staff (Sara, Destin, Tia) assign leads; we measure time until
// the assigned sales rep takes first action (call, appointment, or note).

import { jobNimbusService, isJobNimbusConfigured } from './jobnimbus-service';
import { matchRepToTeamMember } from './jn-sync-engine';
import { TEAM_MEMBERS } from './team-roles';
import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const SHEETS_ID = process.env.DELIVERY_SHEETS_ID || process.env.GOOGLE_SHEETS_ID;
const MAX_PAGES = 100;

const serviceAccountAuth = new JWT({
  email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
  key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

// Office staff who assign leads (not sales reps)
const OFFICE_STAFF_NAMES = [
  'sara hill',
  'destin mccary',
  'tia muse morris',
  'tia morris',
  'tia muse',
  // Also catch system/automation entries
];

const SYSTEM_AUTHORS = [
  'system',
  'automation',
  'jobnimbus',
  'api',
  'webhook',
  'rcrs portal',
  '[rcrs portal',
  '[portal',
];

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RepResponseStats {
  repSlug: string;
  repName: string;
  avgResponseMinutes: number;
  medianResponseMinutes: number;
  fastestMinutes: number;
  slowestMinutes: number;
  totalJobsAnalyzed: number;
  lastMinedAt: string;
}

export interface MiningResult {
  repStats: RepResponseStats[];
  totalJobsFetched: number;
  totalJobsWithNotes: number;
  totalOfficeAssigned: number;
  totalWithRepResponse: number;
  durationMs: number;
  errors: string[];
}

const RESPONSE_TIMES_HEADERS = [
  'repSlug',
  'repName',
  'avgResponseMinutes',
  'medianResponseMinutes',
  'fastestMinutes',
  'slowestMinutes',
  'totalJobsAnalyzed',
  'lastMinedAt',
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isOfficeStaff(authorName: string): boolean {
  const lower = (authorName || '').toLowerCase().trim();
  return OFFICE_STAFF_NAMES.some(name => lower.includes(name));
}

function isSystemOrAutomation(authorName: string): boolean {
  const lower = (authorName || '').toLowerCase().trim();
  return SYSTEM_AUTHORS.some(sys => lower.includes(sys));
}

function isOfficeOrSystem(authorName: string): boolean {
  return isOfficeStaff(authorName) || isSystemOrAutomation(authorName);
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2;
}

// ---------------------------------------------------------------------------
// JN Response Miner
// ---------------------------------------------------------------------------

class JNResponseMiner {
  private doc: GoogleSpreadsheet | null = null;
  private initialized = false;

  private async getDoc(): Promise<GoogleSpreadsheet> {
    if (!this.doc) {
      if (!SHEETS_ID) throw new Error('Google Sheets ID not configured');
      this.doc = new GoogleSpreadsheet(SHEETS_ID, serviceAccountAuth);
    }
    if (!this.initialized) {
      await this.doc.loadInfo();
      this.initialized = true;
    }
    return this.doc;
  }

  private async getOrCreateSheet(name: string, headers: string[]) {
    const doc = await this.getDoc();
    let sheet = doc.sheetsByTitle[name];
    if (!sheet) {
      sheet = await doc.addSheet({
        title: name,
        headerValues: headers,
        gridProperties: { columnCount: Math.max(headers.length + 5, 26) },
      });
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

  /**
   * Mine JN for historical response times per sales rep.
   *
   * Algorithm:
   * 1. Fetch all jobs from JN with pagination
   * 2. For each job, fetch notes/activities
   * 3. Identify jobs where the first activity was from office staff (= office assigned)
   * 4. Find the first subsequent activity by a sales rep (NOT office/system)
   * 5. Calculate time delta = rep first action - office assignment
   * 6. Group by rep, compute stats
   * 7. Store in Google Sheets JN_Response_Times tab
   */
  async mineResponseTimes(): Promise<MiningResult> {
    if (!isJobNimbusConfigured()) {
      throw new Error('JobNimbus API not configured');
    }

    const startTime = Date.now();
    const errors: string[] = [];

    // Step 1: Fetch all jobs
    console.log('[ResponseMiner] Fetching all jobs from JN...');
    const allJobs: Array<{ jnid: string; sales_rep_name?: string; created_at?: number }> = [];
    let offset = 0;
    const pageSize = 100;
    let hasMore = true;
    let pageCount = 0;

    while (hasMore && pageCount < MAX_PAGES) {
      try {
        const result = await jobNimbusService.getJobs({ limit: pageSize, offset });
        allJobs.push(...result.results.map(j => ({
          jnid: j.jnid,
          sales_rep_name: j.sales_rep_name,
          created_at: j.created_at,
        })));
        offset += pageSize;
        hasMore = result.results.length === pageSize;
        pageCount++;
      } catch (err) {
        errors.push(`Failed fetching jobs page ${pageCount}: ${err instanceof Error ? err.message : String(err)}`);
        break;
      }
    }

    console.log(`[ResponseMiner] Fetched ${allJobs.length} jobs across ${pageCount} pages`);

    // Step 2-5: For each job, fetch notes and analyze
    // Collect per-rep response times
    const repResponseTimes = new Map<string, { repSlug: string; repName: string; times: number[] }>();
    let totalWithNotes = 0;
    let totalOfficeAssigned = 0;
    let totalWithRepResponse = 0;

    for (let i = 0; i < allJobs.length; i++) {
      const job = allJobs[i];
      if (i > 0 && i % 50 === 0) {
        console.log(`[ResponseMiner] Processing job ${i}/${allJobs.length}...`);
      }

      try {
        // Fetch activities/notes for this job
        const notes = await jobNimbusService.getNotesForJob(job.jnid, 50);
        if (!notes || notes.length === 0) continue;
        totalWithNotes++;

        // Sort by created_at ascending (oldest first)
        const sorted = [...notes]
          .filter(n => n.created_at)
          .sort((a, b) => (a.created_at || 0) - (b.created_at || 0));

        if (sorted.length === 0) continue;

        // Find the first note from office staff (= assignment)
        const officeNote = sorted.find(n => {
          const author = n.created_by_name || n.created_by || '';
          return isOfficeStaff(author);
        });

        if (!officeNote) continue;
        totalOfficeAssigned++;

        const assignmentTime = (officeNote.created_at || 0) * 1000; // to ms

        // Find the first subsequent note by a non-office, non-system person
        const repNote = sorted.find(n => {
          if ((n.created_at || 0) <= (officeNote.created_at || 0)) return false;
          const author = n.created_by_name || n.created_by || '';
          return !isOfficeOrSystem(author) && author.length > 0;
        });

        if (!repNote) continue;
        totalWithRepResponse++;

        const responseTime = ((repNote.created_at || 0) * 1000) - assignmentTime;
        const responseMinutes = responseTime / (1000 * 60);

        // Skip obviously bad data (negative or >30 days)
        if (responseMinutes < 0 || responseMinutes > 43200) continue;

        // Match the rep to a team member
        const repAuthor = repNote.created_by_name || repNote.created_by || '';
        const teamMember = matchRepToTeamMember(repAuthor) ||
          matchRepToTeamMember(job.sales_rep_name);

        if (!teamMember) continue;

        if (!repResponseTimes.has(teamMember.slug)) {
          repResponseTimes.set(teamMember.slug, {
            repSlug: teamMember.slug,
            repName: teamMember.name,
            times: [],
          });
        }
        repResponseTimes.get(teamMember.slug)!.times.push(responseMinutes);

        // Rate limit: small delay every 10 jobs to avoid hammering JN API
        if (i % 10 === 0) {
          await new Promise(r => setTimeout(r, 200));
        }
      } catch (err) {
        // Don't fail the whole mine for individual job errors
        if (errors.length < 20) {
          errors.push(`Job ${job.jnid}: ${err instanceof Error ? err.message : String(err)}`);
        }
      }
    }

    // Step 6: Compute per-rep stats
    const now = new Date().toISOString();
    const repStats: RepResponseStats[] = [];

    for (const [, data] of repResponseTimes) {
      if (data.times.length === 0) continue;

      const sorted = [...data.times].sort((a, b) => a - b);
      const avg = sorted.reduce((sum, t) => sum + t, 0) / sorted.length;

      repStats.push({
        repSlug: data.repSlug,
        repName: data.repName,
        avgResponseMinutes: Math.round(avg * 10) / 10,
        medianResponseMinutes: Math.round(median(sorted) * 10) / 10,
        fastestMinutes: Math.round(sorted[0] * 10) / 10,
        slowestMinutes: Math.round(sorted[sorted.length - 1] * 10) / 10,
        totalJobsAnalyzed: sorted.length,
        lastMinedAt: now,
      });
    }

    // Sort by avg response time (fastest first)
    repStats.sort((a, b) => a.avgResponseMinutes - b.avgResponseMinutes);

    // Step 7: Store in Google Sheets
    try {
      await this.storeResults(repStats);
      console.log(`[ResponseMiner] Stored ${repStats.length} rep stats in JN_Response_Times sheet`);
    } catch (err) {
      errors.push(`Failed to store results: ${err instanceof Error ? err.message : String(err)}`);
    }

    const durationMs = Date.now() - startTime;
    console.log(`[ResponseMiner] Complete in ${(durationMs / 1000).toFixed(1)}s. ${repStats.length} reps, ${totalWithRepResponse} data points.`);

    return {
      repStats,
      totalJobsFetched: allJobs.length,
      totalJobsWithNotes: totalWithNotes,
      totalOfficeAssigned,
      totalWithRepResponse,
      durationMs,
      errors,
    };
  }

  /**
   * Store mined response times in Google Sheets JN_Response_Times tab.
   * Replaces all existing rows with fresh data.
   */
  private async storeResults(stats: RepResponseStats[]): Promise<void> {
    const sheet = await this.getOrCreateSheet('JN_Response_Times', RESPONSE_TIMES_HEADERS);

    // Clear existing rows
    const existingRows = await sheet.getRows();
    if (existingRows.length > 0) {
      // Delete in reverse order to avoid index shifting
      for (let i = existingRows.length - 1; i >= 0; i--) {
        await existingRows[i].delete();
      }
    }

    // Add new rows
    for (const stat of stats) {
      await sheet.addRow({
        repSlug: stat.repSlug,
        repName: stat.repName,
        avgResponseMinutes: String(stat.avgResponseMinutes),
        medianResponseMinutes: String(stat.medianResponseMinutes),
        fastestMinutes: String(stat.fastestMinutes),
        slowestMinutes: String(stat.slowestMinutes),
        totalJobsAnalyzed: String(stat.totalJobsAnalyzed),
        lastMinedAt: stat.lastMinedAt,
      });
    }
  }

  /**
   * Load previously mined response times from the sheet.
   * Used by lead-distribution-service for real scoring.
   */
  async getStoredResponseTimes(): Promise<RepResponseStats[]> {
    try {
      const sheet = await this.getOrCreateSheet('JN_Response_Times', RESPONSE_TIMES_HEADERS);
      const rows = await sheet.getRows();

      return rows.map(row => ({
        repSlug: row.get('repSlug') || '',
        repName: row.get('repName') || '',
        avgResponseMinutes: parseFloat(row.get('avgResponseMinutes')) || 0,
        medianResponseMinutes: parseFloat(row.get('medianResponseMinutes')) || 0,
        fastestMinutes: parseFloat(row.get('fastestMinutes')) || 0,
        slowestMinutes: parseFloat(row.get('slowestMinutes')) || 0,
        totalJobsAnalyzed: parseInt(row.get('totalJobsAnalyzed')) || 0,
        lastMinedAt: row.get('lastMinedAt') || '',
      }));
    } catch (error) {
      console.error('[ResponseMiner] Error loading stored response times:', error);
      return [];
    }
  }
}

// Export singleton
export const jnResponseMiner = new JNResponseMiner();
