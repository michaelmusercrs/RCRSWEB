// JobNimbus 2-Way Sync Engine
// Handles bidirectional sync between our portal and JobNimbus CRM
//
// COST-PRIVACY: all read functions in this file accept an optional `viewer`
// arg + redact cost fields via lib/jn-redact.ts before returning. Missing
// viewer => fail-safe redaction (treat as not-allowed). NEVER bypass. See
// docs/research-crm-comparison.md moat #3 + feedback_purchase_price_visibility.

import {
  jobNimbusService,
  isJobNimbusConfigured,
  type JobNimbusContact,
  type JobNimbusJob,
  type JobNimbusNote,
  type JobNimbusEstimate,
  type JobNimbusAttachment,
  type JobNimbusInvoice,
} from './jobnimbus-service';
import { teamMembers } from './teamData';
import { TEAM_MEMBERS, type TeamMember } from './team-roles';
import {
  redactCostFieldsDeep,
  effectiveCanSeeCost,
  type JNViewer,
} from './jn-redact';

// Maximum pages to fetch to prevent infinite loops
const MAX_PAGES = 100;

// =============================================================================
// Types
// =============================================================================

export interface SyncState {
  lastSyncTimestamp: number; // Unix timestamp of last sync
  contactsSynced: number;
  jobsSynced: number;
  notesSynced: number;
  errors: SyncError[];
  syncDuration: number; // ms
  startedAt: string;
  completedAt: string;
}

export interface SyncError {
  entity: 'contact' | 'job' | 'note' | 'estimate' | 'file';
  entityId: string;
  action: string;
  message: string;
  timestamp: string;
}

export interface RepContactSummary {
  jnid: string;
  name: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  status: string;
  source: string;
  salesRep: string;
  lastActivity: string;
  notesPreview: string;
  jobCount: number;
  totalJobValue: number;
  createdAt: string;
  updatedAt: string;
}

export interface RepJobSummary {
  jnid: string;
  number: string;
  name: string;
  description: string;
  status: string;
  contactName: string;
  contactJnid: string;
  address: string;
  salesRep: string;
  startDate: string;
  endDate: string;
  estimateTotal: number;
  createdAt: string;
  updatedAt: string;
}

export interface RepSalesMetrics {
  totalJobs: number;
  jobsByStatus: Record<string, number>;
  totalRevenue: number;
  closedRevenue: number;
  pendingRevenue: number;
  avgJobValue: number;
  winCount: number;
  lossCount: number;
  winRate: number;
  monthlyData: MonthlyMetric[];
  teamComparison: {
    repRevenue: number;
    teamAvgRevenue: number;
    repJobs: number;
    teamAvgJobs: number;
    percentAboveAvg: number;
  };
}

export interface MonthlyMetric {
  month: string; // YYYY-MM
  jobCount: number;
  revenue: number;
  closedCount: number;
}

export interface CommissionData {
  repName: string;
  repSlug: string;
  totalEarned: number;
  totalPending: number;
  totalPaid: number;
  jobs: CommissionJob[];
  byMonth: MonthlyCommission[];
}

export interface CommissionJob {
  jobJnid: string;
  jobName: string;
  customerName: string;
  jobValue: number;
  commissionRate: number;
  commissionAmount: number;
  status: 'earned' | 'pending' | 'paid';
  completedAt: string;
}

export interface MonthlyCommission {
  month: string;
  earned: number;
  pending: number;
  paid: number;
  jobCount: number;
}

// Status mapping: our portal -> JN
export const PORTAL_TO_JN_STATUS: Record<string, string> = {
  lead: 'Lead',
  new: 'New',
  contacted: 'Contacted',
  inspection: 'Appointment Set',
  scheduled: 'Appointment Set',
  inspected: 'Inspected',
  estimate: 'Estimate Sent',
  quoted: 'Estimate Sent',
  proposal_sent: 'Proposal Sent',
  contract: 'Contract Signed',
  approved: 'Contract Signed',
  permit: 'Permit',
  materials: 'Material Ordered',
  material_ordered: 'Material Ordered',
  in_progress: 'Work In Progress',
  work_in_progress: 'Work In Progress',
  complete: 'Complete',
  completed: 'Complete',
  closed_won: 'Complete',
  closed: 'Closed',
  closed_lost: 'Lost',
  cancelled: 'Cancelled',
};

// Status mapping: JN -> our portal
export const JN_TO_PORTAL_STATUS: Record<string, string> = {
  'Lead': 'lead',
  'New': 'new',
  'Contacted': 'contacted',
  'Appointment Set': 'scheduled',
  'Inspected': 'inspected',
  'Estimate Sent': 'quoted',
  'Proposal Sent': 'quoted',
  'Contract Signed': 'approved',
  'Permit': 'permit',
  'Material Ordered': 'material_ordered',
  'Scheduled': 'scheduled',
  'Work In Progress': 'in_progress',
  'In Progress': 'in_progress',
  'Complete': 'completed',
  'Completed': 'completed',
  'Closed': 'closed_won',
  'Lost': 'closed_lost',
  'Cancelled': 'cancelled',
};

// Commission rate tiers by job type
const COMMISSION_RATES: Record<string, number> = {
  residential: 0.10, // 10%
  commercial: 0.08, // 8%
  repair: 0.12, // 12%
  insurance: 0.10, // 10%
  default: 0.10, // 10%
};

// =============================================================================
// In-memory sync state (would use Redis/DB in production)
// =============================================================================

let lastSyncState: SyncState | null = null;

// =============================================================================
// Rep Matching
// =============================================================================

/**
 * Match a JN sales_rep_name to a team member.
 * Tries exact match first, then partial name matching.
 */
export function matchRepToTeamMember(salesRepName?: string): TeamMember | null {
  if (!salesRepName) return null;
  const normalized = salesRepName.toLowerCase().trim();

  // Exact email match
  const byEmail = TEAM_MEMBERS.find(
    m => m.email.toLowerCase() === normalized && m.isActive
  );
  if (byEmail) return byEmail;

  // Exact name match
  const byName = TEAM_MEMBERS.find(
    m => m.name.toLowerCase() === normalized && m.isActive
  );
  if (byName) return byName;

  // Partial name match (first name)
  const byFirstName = TEAM_MEMBERS.find(m => {
    const firstName = m.name.toLowerCase().split(' ')[0];
    return normalized.includes(firstName) || firstName === normalized;
  });
  if (byFirstName) return byFirstName;

  // Slug match
  const bySlug = TEAM_MEMBERS.find(
    m => m.slug === normalized && m.isActive
  );
  if (bySlug) return bySlug;

  // Also check teamData.ts (has different field names)
  const teamDataMember = teamMembers.find(m => {
    const name = m.name.toLowerCase();
    return name === normalized ||
      name.includes(normalized) ||
      normalized.includes(name.split(' ')[0]);
  });
  if (teamDataMember) {
    // Map back to TEAM_MEMBERS by slug
    return TEAM_MEMBERS.find(m => m.slug === teamDataMember.slug) || null;
  }

  return null;
}

/**
 * Get the JN sales rep name for a team member
 */
export function getJNRepName(member: TeamMember): string {
  return member.name;
}

// =============================================================================
// Sync Engine
// =============================================================================

class JNSyncEngine {

  /**
   * Get contacts filtered by sales rep name
   */
  async getContactsForRep(repName: string, limit: number = 200, viewer?: JNViewer): Promise<RepContactSummary[]> {
    if (!isJobNimbusConfigured()) {
      throw new Error('JobNimbus API not configured');
    }

    // Walk JN until we've paged through all contacts; cap at MAX_PAGES.
    // The previous version stopped at `allContacts.length < limit`, which
    // truncated BEFORE rep-filtering — so reps whose contacts lived past
    // the first 200 results saw an empty or short list. `limit` is now
    // applied to the post-filter rep list, not the global pull.
    const allContacts: JobNimbusContact[] = [];
    let offset = 0;
    const pageSize = 100;
    let hasMore = true;
    let pageCount = 0;

    while (hasMore && pageCount < MAX_PAGES) {
      const result = await jobNimbusService.getContacts({
        limit: pageSize,
        offset,
      }, viewer);
      allContacts.push(...result.results);
      offset += pageSize;
      hasMore = result.results.length === pageSize;
      pageCount++;
    }

    if (pageCount >= MAX_PAGES) {
      console.warn('Max pagination limit reached for contacts');
    }

    // Filter by rep name (case-insensitive partial match)
    const repNameLower = repName.toLowerCase();
    const repContacts = allContacts.filter(c => {
      const srn = (c.sales_rep_name || '').toLowerCase();
      return srn.includes(repNameLower) ||
        repNameLower.includes(srn.split(' ')[0]);
    }).slice(0, limit);

    // Enrich with job counts. The mapper below produces our own shape from
    // JN fields, so cost fields shouldn't surface naturally — but we run the
    // final array through the redactor as defense in depth.
    const summaries: RepContactSummary[] = repContacts.map(c => ({
      jnid: c.jnid,
      name: jobNimbusService.getContactName(c),
      email: c.email || '',
      phone: jobNimbusService.getContactPhone(c),
      address: c.address_line1 || '',
      city: c.city || '',
      state: c.state_text || '',
      zip: c.zip || '',
      status: c.status || 'unknown',
      source: c.source || '',
      salesRep: c.sales_rep_name || '',
      lastActivity: c.updated_at ? new Date(c.updated_at * 1000).toISOString() : '',
      notesPreview: '',
      jobCount: 0,
      totalJobValue: 0,
      createdAt: c.created_at ? new Date(c.created_at * 1000).toISOString() : '',
      updatedAt: c.updated_at ? new Date(c.updated_at * 1000).toISOString() : '',
    }));

    return redactCostFieldsDeep(summaries, effectiveCanSeeCost(viewer));
  }

  /**
   * Get jobs filtered by sales rep
   */
  async getJobsForRep(repName: string, limit: number = 200, viewer?: JNViewer): Promise<RepJobSummary[]> {
    if (!isJobNimbusConfigured()) {
      throw new Error('JobNimbus API not configured');
    }

    // Same fix as getContactsForRep: walk the full pages first, then
    // filter by rep, then slice. The previous version capped at
    // `allJobs.length < limit` and missed reps whose jobs were past page 2.
    const allJobs: JobNimbusJob[] = [];
    let offset = 0;
    const pageSize = 100;
    let hasMore = true;
    let pageCount = 0;

    while (hasMore && pageCount < MAX_PAGES) {
      const result = await jobNimbusService.getJobs({
        limit: pageSize,
        offset,
      }, viewer);
      allJobs.push(...result.results);
      offset += pageSize;
      hasMore = result.results.length === pageSize;
      pageCount++;
    }

    if (pageCount >= MAX_PAGES) {
      console.warn('Max pagination limit reached for jobs');
    }

    // Filter by rep name
    const repNameLower = repName.toLowerCase();
    const repJobs = allJobs.filter(j => {
      const srn = (j.sales_rep_name || '').toLowerCase();
      return srn.includes(repNameLower) ||
        repNameLower.includes(srn.split(' ')[0]);
    }).slice(0, limit);

    const out: RepJobSummary[] = repJobs.map(j => ({
      jnid: j.jnid,
      number: j.number || '',
      name: j.name || 'Untitled Job',
      description: j.description || '',
      status: j.status || 'unknown',
      contactName: '',
      contactJnid: j.primary?.id || '',
      address: [j.address_line1, j.city, j.state_text, j.zip].filter(Boolean).join(', '),
      salesRep: j.sales_rep_name || '',
      startDate: j.date_start ? new Date(j.date_start * 1000).toISOString() : '',
      endDate: j.date_end ? new Date(j.date_end * 1000).toISOString() : '',
      estimateTotal: 0,
      createdAt: j.created_at ? new Date(j.created_at * 1000).toISOString() : '',
      updatedAt: j.updated_at ? new Date(j.updated_at * 1000).toISOString() : '',
    }));
    return redactCostFieldsDeep(out, effectiveCanSeeCost(viewer));
  }

  /**
   * Push a status update from our portal to JobNimbus
   */
  async pushStatusUpdate(
    jobJnid: string,
    newStatus: string,
    updatedBy: string
  ): Promise<{ success: boolean; message: string }> {
    if (!isJobNimbusConfigured()) {
      return { success: false, message: 'JobNimbus API not configured' };
    }

    // Map our status to JN status
    const jnStatus = PORTAL_TO_JN_STATUS[newStatus] || newStatus;

    try {
      await jobNimbusService.updateJobStatus(jobJnid, jnStatus);

      // Also add a note about the status change. Internal sync — only the
      // primary.id is consumed, so an owner-tier viewer is safe.
      const job = await jobNimbusService.getJob(jobJnid, { canSeeCost: true });
      if (job.primary?.id) {
        await jobNimbusService.createNoteOnJob(
          jobJnid,
          job.primary.id,
          `[Portal Status Update] Status changed to "${jnStatus}" by ${updatedBy} via RCRS Portal`
        );
      }

      return {
        success: true,
        message: `Job status updated to "${jnStatus}" in JobNimbus`,
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to update status',
      };
    }
  }

  /**
   * Push a note from our portal to JobNimbus
   */
  async pushNote(
    contactJnid: string,
    content: string,
    authorName: string,
    jobJnid?: string
  ): Promise<{ success: boolean; noteJnid?: string; message: string }> {
    if (!isJobNimbusConfigured()) {
      return { success: false, message: 'JobNimbus API not configured' };
    }

    try {
      const taggedContent = `[RCRS Portal - ${authorName}] ${content}`;

      let note: JobNimbusNote;
      if (jobJnid) {
        note = await jobNimbusService.createNoteOnJob(jobJnid, contactJnid, taggedContent);
      } else {
        note = await jobNimbusService.createNote(contactJnid, taggedContent);
      }

      return {
        success: true,
        noteJnid: note.jnid,
        message: 'Note added to JobNimbus',
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to add note',
      };
    }
  }

  /**
   * Pull notes from JobNimbus for a contact
   */
  async pullNotes(
    contactJnid: string,
    limit: number = 50,
    viewer?: JNViewer,
  ): Promise<Array<{
    jnid: string;
    content: string;
    author: string;
    createdAt: string;
    isPortalNote: boolean;
  }>> {
    if (!isJobNimbusConfigured()) return [];

    try {
      const notes = await jobNimbusService.getNotesForContact(contactJnid, limit, viewer);
      const mapped = notes.map(n => ({
        jnid: n.jnid,
        content: n.content || '',
        author: n.created_by_name || n.created_by || 'Unknown',
        createdAt: n.created_at ? new Date(n.created_at * 1000).toISOString() : '',
        isPortalNote: (n.content || '').includes('[RCRS Portal') || (n.content || '').includes('[Portal'),
      }));
      return redactCostFieldsDeep(mapped, effectiveCanSeeCost(viewer));
    } catch {
      return [];
    }
  }

  /**
   * Pull notes from JobNimbus for a job
   */
  async pullNotesForJob(
    jobJnid: string,
    limit: number = 50,
    viewer?: JNViewer,
  ): Promise<Array<{
    jnid: string;
    content: string;
    author: string;
    createdAt: string;
    isPortalNote: boolean;
  }>> {
    if (!isJobNimbusConfigured()) return [];

    try {
      const notes = await jobNimbusService.getNotesForJob(jobJnid, limit, viewer);
      const mapped = notes.map(n => ({
        jnid: n.jnid,
        content: n.content || '',
        author: n.created_by_name || n.created_by || 'Unknown',
        createdAt: n.created_at ? new Date(n.created_at * 1000).toISOString() : '',
        isPortalNote: (n.content || '').includes('[RCRS Portal') || (n.content || '').includes('[Portal'),
      }));
      return redactCostFieldsDeep(mapped, effectiveCanSeeCost(viewer));
    } catch {
      return [];
    }
  }

  /**
   * Get documents/attachments for a contact and their jobs
   */
  async getDocuments(contactJnid: string, viewer?: JNViewer): Promise<Array<{
    jnid: string;
    filename: string;
    description: string;
    url: string;
    thumbnailUrl: string;
    contentType: string;
    size: number;
    createdAt: string;
    createdBy: string;
    source: 'jobnimbus' | 'portal';
  }>> {
    if (!isJobNimbusConfigured()) return [];

    try {
      const attachments = await jobNimbusService.getAttachmentsForContact(contactJnid, viewer);
      const mapped = attachments.map(a => ({
        jnid: a.jnid,
        filename: a.filename || 'Unknown',
        description: a.description || '',
        url: a.url || '',
        thumbnailUrl: a.thumbnail_url || '',
        contentType: a.content_type || 'application/octet-stream',
        size: a.size || 0,
        createdAt: a.created_at ? new Date(a.created_at * 1000).toISOString() : '',
        createdBy: a.created_by || 'Unknown',
        source: 'jobnimbus' as const,
      }));
      return redactCostFieldsDeep(mapped, effectiveCanSeeCost(viewer));
    } catch {
      return [];
    }
  }

  /**
   * Get documents for a specific job
   */
  async getDocumentsForJob(jobJnid: string, viewer?: JNViewer): Promise<Array<{
    jnid: string;
    filename: string;
    description: string;
    url: string;
    thumbnailUrl: string;
    contentType: string;
    size: number;
    createdAt: string;
    createdBy: string;
  }>> {
    if (!isJobNimbusConfigured()) return [];

    try {
      const files = await jobNimbusService.getFilesForJob(jobJnid, viewer);
      const mapped = files.map(f => ({
        jnid: f.jnid,
        filename: f.filename || 'Unknown',
        description: f.description || '',
        url: f.url || '',
        thumbnailUrl: f.thumbnail_url || '',
        contentType: f.content_type || 'application/octet-stream',
        size: f.size || 0,
        createdAt: f.created_at ? new Date(f.created_at * 1000).toISOString() : '',
        createdBy: f.created_by || 'Unknown',
      }));
      return redactCostFieldsDeep(mapped, effectiveCanSeeCost(viewer));
    } catch {
      return [];
    }
  }

  /**
   * Calculate sales metrics for a rep from JN data
   */
  async getRepSalesMetrics(repName: string, periodMonths: number = 12, viewer?: JNViewer): Promise<RepSalesMetrics> {
    // Rep metrics include estimateTotal (price, not cost). We still propagate
    // the viewer so any underlying call redacts cost fields if a future
    // mapper exposes one.
    const jobs = await this.getJobsForRep(repName, 500, viewer);

    // Calculate cutoff date
    const cutoff = new Date();
    cutoff.setMonth(cutoff.getMonth() - periodMonths);
    const cutoffIso = cutoff.toISOString();

    const periodJobs = jobs.filter(j => j.createdAt >= cutoffIso);

    // Job status counts
    const jobsByStatus: Record<string, number> = {};
    periodJobs.forEach(j => {
      const status = j.status || 'unknown';
      jobsByStatus[status] = (jobsByStatus[status] || 0) + 1;
    });

    // Revenue calculation: use estimate totals for jobs
    let totalRevenue = 0;
    let closedRevenue = 0;
    let pendingRevenue = 0;
    let winCount = 0;
    let lossCount = 0;

    for (const job of periodJobs) {
      const value = job.estimateTotal || 0;
      totalRevenue += value;

      const portalStatus = JN_TO_PORTAL_STATUS[job.status] || job.status;
      if (['completed', 'closed_won', 'complete'].includes(portalStatus)) {
        closedRevenue += value;
        winCount++;
      } else if (['closed_lost', 'cancelled'].includes(portalStatus)) {
        lossCount++;
      } else {
        pendingRevenue += value;
      }
    }

    const avgJobValue = periodJobs.length > 0 ? totalRevenue / periodJobs.length : 0;
    const totalDecisions = winCount + lossCount;
    const winRate = totalDecisions > 0 ? (winCount / totalDecisions) * 100 : 0;

    // Monthly breakdown
    const monthlyMap = new Map<string, MonthlyMetric>();
    for (const job of periodJobs) {
      if (!job.createdAt) continue;
      const month = job.createdAt.substring(0, 7); // YYYY-MM
      const existing = monthlyMap.get(month) || { month, jobCount: 0, revenue: 0, closedCount: 0 };
      existing.jobCount++;
      existing.revenue += job.estimateTotal || 0;

      const portalStatus = JN_TO_PORTAL_STATUS[job.status] || job.status;
      if (['completed', 'closed_won', 'complete'].includes(portalStatus)) {
        existing.closedCount++;
      }
      monthlyMap.set(month, existing);
    }

    const monthlyData = Array.from(monthlyMap.values()).sort((a, b) => a.month.localeCompare(b.month));

    // Team comparison (simplified - compare against all reps)
    const teamComparison = {
      repRevenue: closedRevenue,
      teamAvgRevenue: closedRevenue, // Will be updated if we have team data
      repJobs: periodJobs.length,
      teamAvgJobs: periodJobs.length,
      percentAboveAvg: 0,
    };

    return {
      totalJobs: periodJobs.length,
      jobsByStatus,
      totalRevenue,
      closedRevenue,
      pendingRevenue,
      avgJobValue,
      winCount,
      lossCount,
      winRate,
      monthlyData,
      teamComparison,
    };
  }

  /**
   * Calculate commission data for a rep.
   *
   * Commission viewing is allowed to the rep themselves + the cost-visible
   * roles. The viewer here gates cost redaction on the underlying JN job
   * fetch — commissions themselves are derived from price not cost.
   */
  async getRepCommissions(repName: string, repSlug: string, viewer?: JNViewer): Promise<CommissionData> {
    const jobs = await this.getJobsForRep(repName, 500, viewer);

    const commissionJobs: CommissionJob[] = [];
    let totalEarned = 0;
    let totalPending = 0;
    let totalPaid = 0;

    for (const job of jobs) {
      const jobValue = job.estimateTotal || 0;
      if (jobValue === 0) continue;

      // Determine commission rate based on job type guess
      const rate = COMMISSION_RATES.default;
      const commissionAmount = jobValue * rate;

      const portalStatus = JN_TO_PORTAL_STATUS[job.status] || job.status;
      let commissionStatus: 'earned' | 'pending' | 'paid' = 'pending';

      if (['completed', 'closed_won', 'complete'].includes(portalStatus)) {
        commissionStatus = 'earned';
        totalEarned += commissionAmount;
      } else if (['closed_lost', 'cancelled'].includes(portalStatus)) {
        continue; // No commission on lost/cancelled
      } else {
        totalPending += commissionAmount;
      }

      commissionJobs.push({
        jobJnid: job.jnid,
        jobName: job.name,
        customerName: job.contactName || 'Unknown',
        jobValue,
        commissionRate: rate,
        commissionAmount,
        status: commissionStatus,
        completedAt: job.endDate || job.updatedAt || '',
      });
    }

    // Group by month
    const monthlyMap = new Map<string, MonthlyCommission>();
    for (const cj of commissionJobs) {
      const date = cj.completedAt || new Date().toISOString();
      const month = date.substring(0, 7);
      const existing = monthlyMap.get(month) || { month, earned: 0, pending: 0, paid: 0, jobCount: 0 };
      existing.jobCount++;
      if (cj.status === 'earned') existing.earned += cj.commissionAmount;
      else if (cj.status === 'pending') existing.pending += cj.commissionAmount;
      else if (cj.status === 'paid') existing.paid += cj.commissionAmount;
      monthlyMap.set(month, existing);
    }

    return {
      repName,
      repSlug,
      totalEarned,
      totalPending,
      totalPaid,
      jobs: commissionJobs.sort((a, b) =>
        (b.completedAt || '').localeCompare(a.completedAt || '')
      ),
      byMonth: Array.from(monthlyMap.values()).sort((a, b) => b.month.localeCompare(a.month)),
    };
  }

  /**
   * Create a new contact in JobNimbus from lead data.
   * Returns the JN contact ID (jnid) on success.
   * If a matching contact already exists (by email or phone), returns the existing jnid.
   */
  async pushNewContact(params: {
    firstName: string;
    lastName: string;
    email?: string;
    phone?: string;
    address?: string;
    city?: string;
    state?: string;
    zip?: string;
    source?: string;
    salesRepName?: string;
    status?: string;
  }): Promise<{ success: boolean; jnid?: string; action: 'created' | 'existing' | 'failed'; message: string }> {
    if (!isJobNimbusConfigured()) {
      return { success: false, action: 'failed', message: 'JobNimbus API not configured' };
    }

    try {
      // Check for existing contact by email first, then phone. Internal
      // dedup check — we only read jnid, so owner-tier viewer is safe.
      const dedupViewer: JNViewer = { canSeeCost: true };
      let existing: import('./jobnimbus-service').JobNimbusContact | null = null;
      if (params.email) {
        existing = await jobNimbusService.searchContactByEmail(params.email, dedupViewer).catch(() => null);
      }
      if (!existing && params.phone) {
        existing = await jobNimbusService.searchContactByPhone(params.phone, dedupViewer).catch(() => null);
      }

      if (existing) {
        return {
          success: true,
          jnid: existing.jnid,
          action: 'existing',
          message: `Existing JN contact found: ${jobNimbusService.getContactName(existing)}`,
        };
      }

      // Create new contact
      const contactData: Partial<import('./jobnimbus-service').JobNimbusContact> = {
        first_name: params.firstName,
        last_name: params.lastName,
        email: params.email,
        mobile_phone: params.phone,
        address_line1: params.address,
        city: params.city,
        state_text: params.state,
        zip: params.zip,
        source: params.source || 'RCRS Portal',
        status: params.status || 'Lead',
        sales_rep_name: params.salesRepName,
      };

      const contact = await jobNimbusService.createContact(contactData);
      return {
        success: true,
        jnid: contact.jnid,
        action: 'created',
        message: `Contact created in JobNimbus: ${params.firstName} ${params.lastName}`,
      };
    } catch (error) {
      return {
        success: false,
        action: 'failed',
        message: error instanceof Error ? error.message : 'Failed to create JN contact',
      };
    }
  }

  /**
   * Create a new job in JobNimbus linked to a contact.
   * Returns the JN job ID (jnid) on success.
   */
  async pushNewJob(params: {
    contactJnid: string;
    jobName: string;
    description?: string;
    status?: string;
    salesRepName?: string;
    address?: string;
    city?: string;
    state?: string;
    zip?: string;
  }): Promise<{ success: boolean; jnid?: string; message: string }> {
    if (!isJobNimbusConfigured()) {
      return { success: false, message: 'JobNimbus API not configured' };
    }

    try {
      // Map portal status to JN status
      const jnStatus = params.status
        ? (PORTAL_TO_JN_STATUS[params.status] || params.status)
        : 'Lead';

      const jobData: Partial<import('./jobnimbus-service').JobNimbusJob> = {
        name: params.jobName,
        description: params.description,
        status: jnStatus,
        sales_rep_name: params.salesRepName,
        primary: { jnid: params.contactJnid },
        address_line1: params.address,
        city: params.city,
        state_text: params.state,
        zip: params.zip,
      };

      const job = await jobNimbusService.createJob(jobData);

      // Add a creation note
      try {
        await jobNimbusService.createNoteOnJob(
          job.jnid,
          params.contactJnid,
          `[RCRS Portal] Job "${params.jobName}" created via RCRS Portal. Status: ${jnStatus}`
        );
      } catch {
        // Note creation is non-critical
      }

      return {
        success: true,
        jnid: job.jnid,
        message: `Job created in JobNimbus: ${params.jobName}`,
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to create JN job',
      };
    }
  }

  /**
   * Push a contact status update to JobNimbus
   */
  async pushContactStatusUpdate(
    contactJnid: string,
    newStatus: string,
    updatedBy: string
  ): Promise<{ success: boolean; message: string }> {
    if (!isJobNimbusConfigured()) {
      return { success: false, message: 'JobNimbus API not configured' };
    }

    const jnStatus = PORTAL_TO_JN_STATUS[newStatus] || newStatus;

    try {
      await jobNimbusService.updateContact(contactJnid, { status: jnStatus });

      // Add a note about the status change
      try {
        await jobNimbusService.createNote(
          contactJnid,
          `[Portal Status Update] Contact status changed to "${jnStatus}" by ${updatedBy} via RCRS Portal`
        );
      } catch {
        // Note is non-critical
      }

      return {
        success: true,
        message: `Contact status updated to "${jnStatus}" in JobNimbus`,
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to update contact status',
      };
    }
  }

  /**
   * Get full customer detail from JN (all related data)
   */
  async getFullCustomerData(contactJnid: string, viewer?: JNViewer) {
    if (!isJobNimbusConfigured()) {
      throw new Error('JobNimbus API not configured');
    }

    const portalData = await jobNimbusService.getCustomerPortalData(contactJnid, viewer);
    if (!portalData) {
      return null;
    }

    const { contact, jobs, estimates, tasks, notes, attachments, invoices } = portalData;

    const shaped = {
      contact: {
        jnid: contact.jnid,
        name: jobNimbusService.getContactName(contact),
        firstName: contact.first_name || '',
        lastName: contact.last_name || '',
        email: contact.email || '',
        phone: jobNimbusService.getContactPhone(contact),
        mobilePhone: contact.mobile_phone || '',
        homePhone: contact.home_phone || '',
        workPhone: contact.work_phone || '',
        address: contact.address_line1 || '',
        addressLine2: contact.address_line2 || '',
        city: contact.city || '',
        state: contact.state_text || '',
        zip: contact.zip || '',
        status: contact.status || '',
        portalPhase: jobNimbusService.mapStatusToPhase(contact.status),
        source: contact.source || '',
        salesRep: contact.sales_rep_name || '',
        createdAt: contact.created_at ? new Date(contact.created_at * 1000).toISOString() : '',
        updatedAt: contact.updated_at ? new Date(contact.updated_at * 1000).toISOString() : '',
      },
      jobs: jobs.map(j => ({
        jnid: j.jnid,
        number: j.number || '',
        name: j.name || 'Untitled Job',
        description: j.description || '',
        status: j.status || '',
        portalStatus: JN_TO_PORTAL_STATUS[j.status || ''] || j.status || 'unknown',
        address: [j.address_line1, j.city, j.state_text, j.zip].filter(Boolean).join(', '),
        salesRep: j.sales_rep_name || '',
        startDate: j.date_start ? new Date(j.date_start * 1000).toISOString() : '',
        endDate: j.date_end ? new Date(j.date_end * 1000).toISOString() : '',
        createdAt: j.created_at ? new Date(j.created_at * 1000).toISOString() : '',
        updatedAt: j.updated_at ? new Date(j.updated_at * 1000).toISOString() : '',
      })),
      estimates: estimates.map(e => ({
        jnid: e.jnid,
        number: e.number || '',
        status: e.status || '',
        amount: e.amount || 0,
        tax: e.tax || 0,
        total: e.total || 0,
        description: e.description || '',
        pdfUrl: e.pdf_url || '',
        publicUrl: e.public_url || '',
        createdAt: e.created_at ? new Date(e.created_at * 1000).toISOString() : '',
      })),
      tasks: tasks.map(t => ({
        jnid: t.jnid,
        title: t.title || '',
        description: t.description || '',
        type: t.type || '',
        status: t.status || '',
        startDate: t.date_start ? new Date(t.date_start * 1000).toISOString() : '',
        endDate: t.date_end ? new Date(t.date_end * 1000).toISOString() : '',
        assignedTo: t.assigned_to || [],
      })),
      notes: notes.map(n => ({
        jnid: n.jnid,
        content: n.content || '',
        type: n.type || 'note',
        author: n.created_by_name || n.created_by || 'Unknown',
        createdAt: n.created_at ? new Date(n.created_at * 1000).toISOString() : '',
        isPortalNote: (n.content || '').includes('[RCRS Portal') || (n.content || '').includes('[Portal'),
      })),
      attachments: attachments.map(a => ({
        jnid: a.jnid,
        filename: a.filename || 'Unknown',
        description: a.description || '',
        url: a.url || '',
        thumbnailUrl: a.thumbnail_url || '',
        contentType: a.content_type || '',
        size: a.size || 0,
        createdAt: a.created_at ? new Date(a.created_at * 1000).toISOString() : '',
      })),
      invoices: invoices.map(i => ({
        jnid: i.jnid,
        number: i.number || '',
        status: i.status || '',
        amount: i.amount || 0,
        amountPaid: i.amount_paid || 0,
        balance: i.balance || 0,
        total: i.total || 0,
        dueDate: i.due_date ? new Date(i.due_date * 1000).toISOString() : '',
        pdfUrl: i.pdf_url || '',
        publicUrl: i.public_url || '',
        createdAt: i.created_at ? new Date(i.created_at * 1000).toISOString() : '',
      })),
    };

    // Final belt-and-suspenders pass — strips any cost-named field the
    // shape mapper above missed.
    return redactCostFieldsDeep(shaped, effectiveCanSeeCost(viewer));
  }

  /**
   * Run a full sync cycle (contacts + jobs from JN)
   */
  async runFullSync(): Promise<SyncState> {
    const startTime = Date.now();
    const errors: SyncError[] = [];
    let contactsSynced = 0;
    let jobsSynced = 0;
    let notesSynced = 0;

    const sinceTimestamp = lastSyncState?.lastSyncTimestamp;

    // runFullSync is a server-internal job; it does not return data to a
    // caller, only updates lastSyncState counters. Pass an owner-tier viewer
    // so cost fields are NOT redacted out of the internal copy that may be
    // persisted to our sheets. Any downstream surface that exposes this data
    // to users must apply redaction at its own boundary.
    const internalViewer: JNViewer = { canSeeCost: true };
    try {
      // Sync contacts
      const contacts = await jobNimbusService.syncContacts(sinceTimestamp, internalViewer);
      contactsSynced = contacts.length;

      // Sync jobs
      const allJobs: JobNimbusJob[] = [];
      let offset = 0;
      const limit = 100;
      let hasMore = true;
      let pageCount = 0;

      while (hasMore && pageCount < MAX_PAGES) {
        const result = await jobNimbusService.getJobs({
          limit,
          offset,
          since: sinceTimestamp,
        }, internalViewer);
        allJobs.push(...result.results);
        offset += limit;
        hasMore = result.results.length === limit;
        pageCount++;
      }

      if (pageCount >= MAX_PAGES) {
        console.warn('Max pagination limit reached for job sync');
      }

      jobsSynced = allJobs.length;

    } catch (error) {
      errors.push({
        entity: 'contact',
        entityId: 'bulk',
        action: 'sync',
        message: error instanceof Error ? error.message : 'Sync failed',
        timestamp: new Date().toISOString(),
      });
    }

    const syncState: SyncState = {
      lastSyncTimestamp: Math.floor(Date.now() / 1000),
      contactsSynced,
      jobsSynced,
      notesSynced,
      errors,
      syncDuration: Date.now() - startTime,
      startedAt: new Date(startTime).toISOString(),
      completedAt: new Date().toISOString(),
    };

    lastSyncState = syncState;
    return syncState;
  }

  /**
   * Get current sync status
   */
  getSyncStatus(): {
    lastSync: SyncState | null;
    isConfigured: boolean;
  } {
    return {
      lastSync: lastSyncState,
      isConfigured: isJobNimbusConfigured(),
    };
  }
}

export const jnSyncEngine = new JNSyncEngine();
