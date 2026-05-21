/**
 * RCRS Google Sheets Service - Comprehensive Integration
 *
 * Provides two-way synchronization between the application and Google Sheets for:
 * - Team members
 * - Inventory
 * - Commissions
 * - Customers
 * - Orders
 *
 * @author RCRS Development Team
 * @version 2.0.0
 */

import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';

// =============================================================================
// CONFIGURATION
// =============================================================================

// Handle private key - works with both escaped \n and actual newlines.
// Also strip leading/trailing whitespace so a stray newline pasted into
// the Vercel dashboard can't corrupt the PEM block.
const privateKey = process.env.GOOGLE_PRIVATE_KEY
  ?.replace(/\\n/g, '\n')
  ?.replace(/\r\n/g, '\n')
  ?.trim();

// Trim the SA email too — `\r\n` here corrupts the JWT iss claim and
// makes every auth fail with no useful error message (Google just
// rejects the token).
const serviceAccountEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL?.trim();

const serviceAccountAuth = new JWT({
  email: serviceAccountEmail,
  key: privateKey,
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

// Trim env value — Vercel env entries can carry trailing whitespace/\r\n
// if the value was pasted into the dashboard with a stray newline. An
// untrimmed sheet ID corrupts the API URL and makes init() silently fail.
const SHEETS_ID = process.env.GOOGLE_SHEETS_ID?.trim();

// Check if Google Sheets is properly configured
export function isGoogleSheetsConfigured(): boolean {
  return !!(
    SHEETS_ID &&
    process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL &&
    privateKey
  );
}

// =============================================================================
// TYPE DEFINITIONS
// =============================================================================

export interface TeamMember {
  slug: string;
  name: string;
  company: string;
  category: string;
  position: string;
  phone: string;
  email: string;
  altEmail: string;
  displayOrder: number;
  tagline?: string;
  bio: string;
  region?: string;
  launchDate?: string;
  profileImage?: string;
  truckImage?: string;
  facebook?: string;
  instagram?: string;
  x?: string;
}

export interface InventoryItem {
  sku: string;
  name: string;
  description: string;
  category: string;
  cost: number;
  price: number;
  quantity: number;
  minStock: number;
  maxStock: number;
  unit: string;
  supplier: string;
  location: string;
  imageUrl: string;
  lastUpdated: string;
  updatedBy: string;
}

export interface CommissionEntry {
  salesRep: string;
  date: string;
  amount: number;
  balance: number;
  jobId?: string;
  jobName?: string;
  description?: string;
  status?: string;
}

export interface CommissionSummary {
  salesRep: string;
  totalEarned: number;
  currentBalance: number;
  transactionCount: number;
  lastTransaction: string;
}

export interface CustomerRecord {
  customerId: string;
  name: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  jobCount: number;
  totalSpent: number;
  lastJobDate?: string;
  notes?: string;
  source?: string;
  salesRep?: string;
  createdAt: string;
  updatedAt: string;
}

export interface OrderRecord {
  orderId: string;
  customerId: string;
  customerName: string;
  jobId?: string;
  jobAddress?: string;
  status: 'pending' | 'approved' | 'in-progress' | 'delivered' | 'completed' | 'cancelled';
  items: string; // JSON string of order items
  totalCost: number;
  totalPrice: number;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  notes?: string;
  deliveryDate?: string;
  deliveredBy?: string;
}

export interface SyncResult {
  success: boolean;
  synced: number;
  errors: string[];
  timestamp: string;
}

export interface GeocodedContactRecord {
  jnid: string;
  name: string;
  firstName: string;
  lastName: string;
  company: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  lat: string;
  lng: string;
  placeId: string;
  email: string;
  mobilePhone: string;
  homePhone: string;
  type: string; // contact/install/lead/referral/door_knock
  recordType: string; // JN record_type_name (Contact, Job, etc.)
  salesRep: string; // slug (canonical: first-name slug from team-roles)
  salesRepName: string; // raw display name from JN
  salesRepId: string;
  jobStatus: string;
  isClosed: string;
  isArchived: string;
  source: string; // JN source_name
  tags: string; // pipe-delimited
  approvedEstimateTotal: string;
  approvedInvoiceTotal: string;
  lastBudgetRevenue: string;
  dateOfLoss: string; // custom field — storm/insurance signal
  dateCreated: string;
  dateUpdated: string;
  lastInteraction: string;
  interactionType: string;
  createdAt: string;
}

export const GEOCODED_CONTACT_COLUMNS = [
  'jnid', 'name', 'firstName', 'lastName', 'company',
  'address', 'city', 'state', 'zip',
  'lat', 'lng', 'placeId',
  'email', 'mobilePhone', 'homePhone',
  'type', 'recordType',
  'salesRep', 'salesRepName', 'salesRepId',
  'jobStatus', 'isClosed', 'isArchived',
  'source', 'tags',
  'approvedEstimateTotal', 'approvedInvoiceTotal', 'lastBudgetRevenue',
  'dateOfLoss',
  'dateCreated', 'dateUpdated', 'lastInteraction', 'interactionType',
  'createdAt',
];

export interface LeadDistributionLogRecord {
  logId: string;
  leadId: string;
  customerName: string;
  address: string;
  assignedRep: string;
  algorithmScores: string; // JSON
  factors: string; // JSON
  overrideReason: string;
  timestamp: string;
  reason: string; // human-readable explanation of why this rep won
  runnerUpRep: string;
  runnerUpScore: string;
  weightSetVersion: string; // pin which weight set drove the decision (config.updatedAt)
  tiebreakerApplied: string; // 'longest-since-last' | 'new-rep-boost' | '' | other
  // BETA — Lead Quality scoring (admin/manager visibility only).
  // Hidden from sales reps and customers via API-layer redaction.
  leadQualityScore: string;         // 0-100 or ''
  leadQualityBand: string;          // 'low' | 'medium' | 'high' | 'premium' | ''
  leadQualityFactors: string;       // JSON of LeadQualityFactors
  leadQualityContributions: string; // JSON of per-factor weighted contributions
  leadQualityConfidence: string;    // 'preliminary' | 'updated' | 'unavailable' | ''
  leadQualityComputedAt: string;    // ISO
}

export const LEAD_DISTRIBUTION_LOG_COLUMNS = [
  'logId', 'leadId', 'customerName', 'address', 'assignedRep',
  'algorithmScores', 'factors', 'overrideReason', 'timestamp',
  'reason', 'runnerUpRep', 'runnerUpScore', 'weightSetVersion', 'tiebreakerApplied',
  'leadQualityScore', 'leadQualityBand', 'leadQualityFactors',
  'leadQualityContributions', 'leadQualityConfidence', 'leadQualityComputedAt',
];

/**
 * Per-lead outcome record — what happened AFTER the lead was assigned.
 * Joined to LeadDistributionLogRecord by `logId`. Written progressively as
 * events occur (first contact, estimate, sold/lost, reassignment, final).
 * Source for the quarterly recalibration / "AI improvement" loop.
 */
export interface LeadOutcomeLogRecord {
  logId: string; // FK to LeadDistributionLogRecord.logId
  leadId: string;
  assignedRep: string; // current owner (changes on reassignment)
  originalAssignedRep: string; // who got it first
  firstContactAttemptAt: string; // ISO
  firstContactConnectAt: string; // ISO — actual customer reached
  firstContactMethod: string; // 'call' | 'sms' | 'email' | 'in-person' | ''
  estimateCreatedAt: string; // ISO
  estimateAmount: string; // dollar value
  jobSoldAt: string; // ISO
  jobSoldAmount: string;
  jobLostAt: string; // ISO
  jobLostReason: string;
  reassignedAt: string; // ISO (most recent)
  reassignedTo: string;
  reassignReason: string;
  finalDisposition: string; // 'closed-won' | 'closed-lost' | 'ghosted' | 'reassigned-out' | 'open' | ''
  dispositionAt: string; // ISO
  updatedAt: string; // ISO — last write to this row
}

export const LEAD_OUTCOME_LOG_COLUMNS = [
  'logId', 'leadId', 'assignedRep', 'originalAssignedRep',
  'firstContactAttemptAt', 'firstContactConnectAt', 'firstContactMethod',
  'estimateCreatedAt', 'estimateAmount',
  'jobSoldAt', 'jobSoldAmount',
  'jobLostAt', 'jobLostReason',
  'reassignedAt', 'reassignedTo', 'reassignReason',
  'finalDisposition', 'dispositionAt',
  'updatedAt',
];

/**
 * Pending-reassignment queue. The SLA cron writes a row here when a lead
 * breaches the reassign threshold WITHOUT auto-executing the reassignment.
 * A dispatcher reviews the suggested next-best rep and either confirms or
 * declines. Manual execution per stated policy (Michael 2026-05-21).
 */
export interface LeadReassignmentQueueRecord {
  queueId: string;
  leadId: string;
  customerName: string;
  customerAddress: string;
  originalRep: string;
  minutesElapsed: string;
  suggestedRep: string;       // next-best rep slug from the algorithm
  suggestedRepName: string;
  suggestedRepReason: string; // why this rep was suggested
  status: string;             // 'pending' | 'resolved-reassigned' | 'resolved-declined' | 'expired'
  createdAt: string;
  resolvedAt: string;
  resolvedBy: string;
  resolutionNotes: string;
}

export const LEAD_REASSIGNMENT_QUEUE_COLUMNS = [
  'queueId', 'leadId', 'customerName', 'customerAddress',
  'originalRep', 'minutesElapsed',
  'suggestedRep', 'suggestedRepName', 'suggestedRepReason',
  'status', 'createdAt', 'resolvedAt', 'resolvedBy', 'resolutionNotes',
];

/**
 * Rep profile — bio + photo URLs. Used by the customer welcome portal to
 * introduce the assigned rep. Sheet-backed so admins can edit through the
 * UI without redeploys.
 */
export interface TeamProfileRecord {
  repSlug: string;
  bio: string;
  headshotUrl: string;
  truckPicUrl: string;
  certifications: string;     // comma-separated, e.g. "IKO ROOFPRO Craftsman Premier, OC Preferred"
  yearsExperience: string;
  favoriteQuote: string;
  // Approval workflow (added 2026-05-21 per Michael's stated requirements).
  // Existing rows with empty status default to 'published' in the loader,
  // so prior data isn't broken.
  status: string;             // 'draft' | 'pending-approval' | 'published' | 'needs-changes'
  pendingDraft: string;       // JSON of {bio, certs, headshotUrl, ...} — unapproved edits
  submittedAt: string;        // ISO — when rep clicked Submit for Approval
  submittedBy: string;        // slug of the rep who submitted
  approvedBy: string;         // slug of the approver (Chris/Michael/Sara)
  approvedAt: string;         // ISO
  rejectionNotes: string;     // when approver clicks Needs Changes
  version: string;            // incrementing integer (as string for sheet compat)
  publishedAt: string;        // ISO when current published version went live
  // Review display preferences
  personalReviewIds: string;  // pipe-delimited list of review IDs the rep selected
  reviewDisplayMode: string;  // 'personal-only' | 'personal-plus-company-fallback' | 'company-only'
  updatedAt: string;
  updatedBy: string;
}

export const TEAM_PROFILES_COLUMNS = [
  'repSlug', 'bio', 'headshotUrl', 'truckPicUrl',
  'certifications', 'yearsExperience', 'favoriteQuote',
  'status', 'pendingDraft', 'submittedAt', 'submittedBy',
  'approvedBy', 'approvedAt', 'rejectionNotes', 'version', 'publishedAt',
  'personalReviewIds', 'reviewDisplayMode',
  'updatedAt', 'updatedBy',
];

/**
 * Customer portal analytics event. Written by /api/portal/event endpoint
 * from client-side beacons + page-unload handlers. Keep payload small —
 * this can fire dozens of times per portal view.
 */
export interface CustomerPortalEventRecord {
  eventId: string;
  portalToken: string;     // hashed for long-term storage; raw OK for short-lived debugging
  leadId: string;
  assignedRep: string;
  customerName: string;
  eventType: string;       // portal_view | tile_interact | doc_view | call_clicked | iko_clickthrough | repeat_visit | photo_view
  tileKey: string;
  userAgent: string;       // truncated 120 chars
  ipHash: string;          // SHA256 truncated
  referrer: string;
  timeOnPageMs: string;
  isPreview: string;       // 'true' if from view-as-customer simulator (excluded from real engagement counts)
  createdAt: string;
}

export const CUSTOMER_PORTAL_EVENTS_COLUMNS = [
  'eventId', 'portalToken', 'leadId', 'assignedRep', 'customerName',
  'eventType', 'tileKey', 'userAgent', 'ipHash', 'referrer',
  'timeOnPageMs', 'isPreview', 'createdAt',
];

/**
 * Cached weather forecast. One row per location. Initially just one row
 * (huntsville-al). Schema designed to extend to zip-code-precise later
 * by adding rows keyed on zip (e.g. '35801').
 *
 * A cron writes here every ~60 min; the customer-portal forecast endpoint
 * reads from here. One NWS fetch per refresh, regardless of customer load.
 */
export interface WeatherForecastCacheRecord {
  locationKey: string;     // 'huntsville-al' for now; future: '35801', '35802', etc.
  displayName: string;     // 'Huntsville, AL' or '35801'
  lat: string;
  lng: string;
  forecastJson: string;    // serialized FiveDayForecast
  disclaimer: string;
  fetchedAt: string;       // ISO
  nextRefreshAt: string;   // ISO — cron skips if not yet due
  source: string;          // 'NOAA-NWS' for now
}

export const WEATHER_FORECAST_CACHE_COLUMNS = [
  'locationKey', 'displayName', 'lat', 'lng',
  'forecastJson', 'disclaimer',
  'fetchedAt', 'nextRefreshAt', 'source',
];

export interface RepAvailabilityRecord {
  repSlug: string;
  isReceivingLeads: string; // 'true'/'false'
  adminOverride: string;
  adminOverrideBy: string;
  adminOverrideReason: string;
  autoResumeAt: string;
  scheduleJson: string; // JSON
  updatedAt: string;
}

export interface RepPreferencesRecord {
  repSlug: string;
  countiesEnabled: string; // JSON
  maxLeadsPerDay: string;
  preferredAreas: string; // JSON
  excludedAreas: string; // JSON
  updatedAt: string;
}

export interface LeadResponseLogRecord {
  leadId: string;
  repSlug: string;
  assignedAt: string;
  firstContactAt: string;
  responseMinutes: string;
  reminderSentAt: string;
  warningSentAt: string;
  urgentWarningSentAt?: string;
  reassignedAt: string;
  reassignedTo: string;
  missedReason: string;
}

export interface JobBreakdownRecord {
  breakdownId: string;
  jobId: string;
  customerName: string;
  address: string;
  rNumber: string;
  salesRep: string;
  status: string;
  materialsJson: string; // JSON
  totals: string; // JSON
  createdAt: string;
  updatedAt: string;
}

export interface DailyActivityRecord {
  date: string; // YYYY-MM-DD
  week: string; // YYYY-Wnn format
  repName: string;
  repEmail: string;
  inspected: number;
  damage: number;
  signed: number;
  repair: number;
  gutter: number;
  revenue: number;
  approved: number;
  goal: number;
  referrals: number;
  agents: number;
  present: string;
  homeShow: number;
  submittedAt: string;
}

export interface RepWeeklyNumbersRecord {
  week: string; // YYYY-Wnn format
  repName: string;
  repEmail: string;
  doorsKnocked: number;
  appointmentsSet: number;
  inspectionsCompleted: number;
  estimatesGiven: number;
  contractsSigned: number;
  revenueClosed: number;
  leadsGenerated: number;
  followUpsMade: number;
  notes: string;
  submittedAt: string;
}

export interface CustomerPortalLogRecord {
  logId: string;
  customerName: string;
  customerEmail: string;
  jobId: string;
  action: string; // portal_opened, document_viewed, message_sent, appointment_scheduled, payment_viewed, photo_viewed, document_downloaded, file_uploaded, tab_changed
  timestamp: string;
  ipAddress: string;
  userAgent: string;
  details: string; // JSON string with action-specific data
}

export interface CustomerPortalDataRecord {
  customerId: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  address: string;
  jobId: string;
  jobStatus: string;
  portalToken: string;
  portalCreatedAt: string;
  lastAccessed: string;
  totalVisits: number;
  messagesSent: number;
  documentsViewed: number;
  notes: string;
}

// =============================================================================
// SHEET NAMES
// =============================================================================

export interface TeamAccessOverrideRecord {
  memberId: string;
  moduleOverrides: string; // JSON: {"inventory": true, "marketing": false}
  customPermissions: string; // JSON: future use
  updatedBy: string;
  updatedAt: string;
}

const SHEET_NAMES = {
  TEAM_MEMBERS: 'team-members-import',
  INVENTORY: 'Inventory',
  INVENTORY_LOGS: 'InventoryLogs',
  COMMISSIONS: 'Commissions',
  CUSTOMERS: 'Customers',
  ORDERS: 'Orders',
  DELIVERIES: 'Deliveries',
  GEOCODED_CONTACTS: 'Geocoded_Contacts',
  LEAD_DISTRIBUTION_LOG: 'Lead_Distribution_Log',
  LEAD_OUTCOME_LOG: 'Lead_Outcome_Log',
  LEAD_REASSIGNMENT_QUEUE: 'Lead_Reassignment_Queue',
  TEAM_PROFILES: 'Team_Profiles',
  CUSTOMER_PORTAL_CONFIG: 'Customer_Portal_Config',
  CUSTOMER_PORTAL_EVENTS: 'Customer_Portal_Events',
  WEATHER_FORECAST_CACHE: 'Weather_Forecast_Cache',
  REP_AVAILABILITY: 'Rep_Availability',
  REP_PREFERENCES: 'Rep_Preferences',
  LEAD_RESPONSE_LOG: 'Lead_Response_Log',
  JOB_BREAKDOWNS: 'Job_Breakdowns',
  TEAM_ACCESS_OVERRIDES: 'Team_Access_Overrides',
  AGENT_DIRECTORY: 'Agent_Directory',
  AGENT_VISITS: 'Agent_Visits',
  TRAINING_PROGRESS: 'Training_Progress',
  INVOICES: 'Invoices',
  REP_WEEKLY_NUMBERS: 'RepWeeklyNumbers',
  CUSTOMER_PORTAL_LOG: 'CustomerPortalLog',
  CUSTOMER_PORTAL_DATA: 'CustomerPortalData',
  MONDAY_NOTES: 'MondayNotes',
  REVIEWS: 'Reviews',
  AUDIT_LOG: 'AuditLog',
  MARCH_MADNESS: 'MarchMadness',
  DAILY_ACTIVITY: 'DailyActivity',
  FINANCIAL_SUMMARY: 'Financial_Summary',
  REVENUE_BY_REP: 'Revenue_By_Rep',
  JOB_PROFITABILITY: 'Job_Profitability',
  OUTSTANDING_INVOICES: 'Outstanding_Invoices',
  MONTHLY_TRENDS: 'Monthly_Trends',
  MEETING_PREP: 'MeetingPrep',
  NUMBER_SESSIONS: 'NumberSessions',

  // ===========================================================================
  // PERSISTENCE MIGRATION (2026-04-09): tabs added to replace local data/*.json
  // writes, so production stops losing data on every redeploy. Each entry below
  // is the canonical home for a service or route that previously called
  // fs.writeFileSync. See: project_rcrsal_data_persistence_migration.md
  // ===========================================================================
  GAMIFICATION: 'Gamification',
  MARCH_MADNESS_BRACKETS: 'MarchMadness_Brackets',
  MARCH_MADNESS_SETTINGS: 'MarchMadness_Settings',
  INVENTORY_TRANSACTIONS: 'Inventory_Transactions',
  INVENTORY_PRODUCTS: 'Inventory_Products',
  PIPELINE_ORDERS: 'Pipeline_Orders',
  BLOG_POSTS: 'Blog_Posts',
  NOTIFICATIONS: 'Notifications',
  NOTIFICATION_PREFERENCES: 'Notification_Preferences',
  PROFILE_NOTIFICATIONS: 'Profile_Notifications',
  INSPECTIONS: 'Inspections',
  JOB_PROGRESS: 'Job_Progress',
  JOB_COSTS: 'Job_Costs',
  SUBCONTRACTORS: 'Subcontractors',
  TIME_ENTRIES: 'Time_Entries',
  ROUTES: 'Routes',
  CALLS: 'Calls',
  DOCUMENTS: 'Documents',
  SURVEY_RESPONSES: 'Survey_Responses',
  CUSTOMER_REVIEWS: 'Customer_Reviews',
  WEATHER_EVENTS: 'Weather_Events',
  GENERATED_REPORTS: 'Generated_Reports',
  PROFILE_UPDATES: 'Profile_Updates',
  LEAD_DISTRO_REASSIGNMENTS: 'Lead_Distro_Reassignments',
  VOICEMAILS: 'Voicemails',
  CUSTOMER_SURVEY_TOKENS: 'Customer_Survey_Tokens',
  WARRANTIES: 'Warranties',
  ESTIMATES: 'Estimates',
  TICKETS: 'Tickets',
  // Interoffice invoices created automatically when materials leave the
  // warehouse. Cost-side only. Customer NEVER sees these. Feeds the
  // job material cost line in the job breakdown.
  JOB_MATERIAL_COSTS: 'Job_Material_Costs',
  // Materials picked up from a job site that came from an OUTSIDE supplier
  // (SRS, ABC, etc.) — NOT in our catalog. These never touch our inventory
  // app; they're tracked here so Sara can issue the vendor credit and the
  // job breakdown can subtract the credit from material cost.
  VENDOR_RETURNS: 'Vendor_Returns',
  // Driver GPS pings persisted so the office can see Rick on a map.
  DRIVER_LOCATIONS: 'Driver_Locations',
  SYSTEM_HEALTH: 'SystemHealth',
} as const;

export type SheetName = (typeof SHEET_NAMES)[keyof typeof SHEET_NAMES];

// Re-export the registry so callers can reference tab names symbolically
// instead of duplicating string literals.
export { SHEET_NAMES };

// =============================================================================
// GOOGLE SHEETS SERVICE CLASS
// =============================================================================

class GoogleSheetsService {
  private doc: GoogleSpreadsheet | null = null;
  private initialized = false;
  private lastInitAttempt = 0;
  private initCooldown = 5000; // 5 seconds between init attempts

  // Per-tab write queue. Serializes upserts to the same tab so two
  // concurrent webhook calls can't both "find no existing row" and both
  // addRow → duplicate. Within a single container only — multi-container
  // races still possible but rare and the dedupe sweep below covers them.
  private writeQueue: Map<string, Promise<unknown>> = new Map();

  private serializeTabWrite<T>(tabName: string, op: () => Promise<T>): Promise<T> {
    const prev = this.writeQueue.get(tabName) || Promise.resolve();
    const next = prev.catch(() => undefined).then(op);
    this.writeQueue.set(tabName, next);
    // Clean up when this op settles so the map doesn't grow unbounded
    next.finally(() => {
      if (this.writeQueue.get(tabName) === next) this.writeQueue.delete(tabName);
    });
    return next;
  }

  /**
   * Initialize connection to Google Sheets
   */
  async init(): Promise<boolean> {
    if (this.initialized && this.doc) return true;

    // Prevent rapid retry attempts
    const now = Date.now();
    if (now - this.lastInitAttempt < this.initCooldown) {
      return false;
    }
    this.lastInitAttempt = now;

    if (!isGoogleSheetsConfigured()) {
      console.warn('Google Sheets not configured. Check environment variables.');
      return false;
    }

    try {
      this.doc = new GoogleSpreadsheet(SHEETS_ID!, serviceAccountAuth);
      await this.doc.loadInfo();
      this.initialized = true;
      return true;
    } catch (error) {
      console.error('Failed to initialize Google Sheets:', error);
      this.doc = null;
      this.initialized = false;
      return false;
    }
  }

  /**
   * Get or create a sheet with specified headers
   */
  private async getOrCreateSheet(name: string, headers: string[]) {
    if (!this.doc) throw new Error('Google Sheets not initialized');

    let sheet = this.doc.sheetsByTitle[name];
    if (!sheet) {
      sheet = await this.doc.addSheet({ title: name, headerValues: headers, gridProperties: { columnCount: Math.max(headers.length + 5, 26) } });
    } else {
      // Ensure headers exist - fix for sheets created without headers
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
   * Convert Google Drive share link to direct image URL
   */
  private convertDriveLink(shareLink: string): string {
    if (!shareLink || !shareLink.includes('drive.google.com')) {
      return shareLink;
    }

    let fileId = null;

    // Format: /d/FILE_ID/
    const fileIdMatch = shareLink.match(/\/d\/([a-zA-Z0-9-_]+)/);
    if (fileIdMatch) {
      fileId = fileIdMatch[1];
    }

    // Format: id=FILE_ID
    const idMatch = shareLink.match(/[?&]id=([a-zA-Z0-9-_]+)/);
    if (!fileId && idMatch) {
      fileId = idMatch[1];
    }

    if (fileId) {
      return `https://drive.google.com/thumbnail?id=${fileId}&sz=w400`;
    }

    return shareLink;
  }

  // ===========================================================================
  // TEAM MEMBERS
  // ===========================================================================

  async getTeamMembers(): Promise<TeamMember[]> {
    const ready = await this.init();
    if (!ready || !this.doc) return [];

    try {
      const sheet = this.doc.sheetsByTitle[SHEET_NAMES.TEAM_MEMBERS];
      if (!sheet) {
        console.warn(`Sheet "${SHEET_NAMES.TEAM_MEMBERS}" not found`);
        return [];
      }

      const rows = await sheet.getRows();

      return rows.map(row => ({
        slug: row.get('slug') || '',
        name: row.get('name') || '',
        company: row.get('company') || '',
        category: row.get('category') || '',
        position: row.get('position') || '',
        phone: row.get('phone') || '',
        email: row.get('email') || '',
        altEmail: row.get('altEmail') || '',
        displayOrder: parseInt(row.get('displayOrder')) || 0,
        tagline: row.get('tagline') || '',
        bio: row.get('bio') || '',
        region: row.get('region') || '',
        launchDate: row.get('launchDate') || '',
        profileImage: this.convertDriveLink(row.get('profileImage') || ''),
        truckImage: this.convertDriveLink(row.get('truckImage') || ''),
        facebook: row.get('facebook') || '',
        instagram: row.get('instagram') || '',
        x: row.get('x') || '',
      })).sort((a, b) => a.displayOrder - b.displayOrder);
    } catch (error) {
      console.error('Error fetching team members:', error);
      return [];
    }
  }

  async updateTeamMember(member: TeamMember): Promise<boolean> {
    const ready = await this.init();
    if (!ready || !this.doc) return false;

    try {
      const sheet = this.doc.sheetsByTitle[SHEET_NAMES.TEAM_MEMBERS];
      if (!sheet) return false;

      const rows = await sheet.getRows();
      const existingRow = rows.find(row => row.get('slug') === member.slug);

      if (existingRow) {
        Object.keys(member).forEach(key => {
          existingRow.set(key, (member as any)[key]);
        });
        await existingRow.save();
      } else {
        await sheet.addRow(member as unknown as Record<string, string | number | boolean>);
      }

      return true;
    } catch (error) {
      console.error('Error updating team member:', error);
      return false;
    }
  }

  async deleteTeamMember(slug: string): Promise<boolean> {
    const ready = await this.init();
    if (!ready || !this.doc) return false;

    try {
      const sheet = this.doc.sheetsByTitle[SHEET_NAMES.TEAM_MEMBERS];
      if (!sheet) return false;

      const rows = await sheet.getRows();
      const rowToDelete = rows.find(row => row.get('slug') === slug);

      if (rowToDelete) {
        await rowToDelete.delete();
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error deleting team member:', error);
      return false;
    }
  }

  // ===========================================================================
  // INVENTORY
  // ===========================================================================

  async getInventory(options?: {
    category?: string;
    lowStock?: boolean;
    search?: string;
  }): Promise<InventoryItem[]> {
    const ready = await this.init();
    if (!ready || !this.doc) return [];

    try {
      const sheet = await this.getOrCreateSheet(SHEET_NAMES.INVENTORY, [
        'sku', 'name', 'description', 'category', 'cost', 'price',
        'quantity', 'minStock', 'maxStock', 'unit', 'supplier',
        'location', 'imageUrl', 'lastUpdated', 'updatedBy'
      ]);

      const rows = await sheet.getRows();
      let items: InventoryItem[] = rows.map(row => ({
        sku: row.get('sku') || '',
        name: row.get('name') || '',
        description: row.get('description') || '',
        category: row.get('category') || '',
        cost: parseFloat(row.get('cost')) || 0,
        price: parseFloat(row.get('price')) || 0,
        quantity: parseInt(row.get('quantity')) || 0,
        minStock: parseInt(row.get('minStock')) || 10,
        maxStock: parseInt(row.get('maxStock')) || 100,
        unit: row.get('unit') || 'each',
        supplier: row.get('supplier') || '',
        location: row.get('location') || '',
        imageUrl: row.get('imageUrl') || '',
        lastUpdated: row.get('lastUpdated') || '',
        updatedBy: row.get('updatedBy') || '',
      }));

      // Apply filters
      if (options?.category) {
        items = items.filter(item =>
          item.category.toLowerCase() === options.category!.toLowerCase()
        );
      }

      if (options?.lowStock) {
        items = items.filter(item => item.quantity <= item.minStock);
      }

      if (options?.search) {
        const searchLower = options.search.toLowerCase();
        items = items.filter(item =>
          item.sku.toLowerCase().includes(searchLower) ||
          item.name.toLowerCase().includes(searchLower) ||
          item.description.toLowerCase().includes(searchLower) ||
          item.category.toLowerCase().includes(searchLower)
        );
      }

      return items.sort((a, b) => a.name.localeCompare(b.name));
    } catch (error) {
      console.error('Error fetching inventory:', error);
      return [];
    }
  }

  async updateInventoryItem(item: InventoryItem): Promise<boolean> {
    const ready = await this.init();
    if (!ready || !this.doc) return false;

    try {
      const sheet = this.doc.sheetsByTitle[SHEET_NAMES.INVENTORY];
      if (!sheet) return false;

      const rows = await sheet.getRows();
      const existingRow = rows.find(row => row.get('sku') === item.sku);

      const now = new Date().toISOString();

      if (existingRow) {
        existingRow.set('name', item.name);
        existingRow.set('description', item.description);
        existingRow.set('category', item.category);
        existingRow.set('cost', item.cost.toString());
        existingRow.set('price', item.price.toString());
        existingRow.set('quantity', item.quantity.toString());
        existingRow.set('minStock', item.minStock.toString());
        existingRow.set('maxStock', item.maxStock.toString());
        existingRow.set('unit', item.unit);
        existingRow.set('supplier', item.supplier);
        existingRow.set('location', item.location);
        existingRow.set('imageUrl', item.imageUrl);
        existingRow.set('lastUpdated', now);
        existingRow.set('updatedBy', item.updatedBy);
        await existingRow.save();
      } else {
        await sheet.addRow({
          ...item,
          cost: item.cost.toString(),
          price: item.price.toString(),
          quantity: item.quantity.toString(),
          minStock: item.minStock.toString(),
          maxStock: item.maxStock.toString(),
          lastUpdated: now,
        });
      }

      return true;
    } catch (error) {
      console.error('Error updating inventory item:', error);
      return false;
    }
  }

  async deleteInventoryItem(sku: string): Promise<boolean> {
    const ready = await this.init();
    if (!ready || !this.doc) return false;

    try {
      const sheet = this.doc.sheetsByTitle[SHEET_NAMES.INVENTORY];
      if (!sheet) return false;

      const rows = await sheet.getRows();
      const rowToDelete = rows.find(row => row.get('sku') === sku);

      if (rowToDelete) {
        await rowToDelete.delete();
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error deleting inventory item:', error);
      return false;
    }
  }

  async syncInventoryFromJson(items: InventoryItem[]): Promise<SyncResult> {
    const ready = await this.init();
    if (!ready || !this.doc) {
      return { success: false, synced: 0, errors: ['Google Sheets not initialized'], timestamp: new Date().toISOString() };
    }

    const errors: string[] = [];
    let synced = 0;

    try {
      const sheet = await this.getOrCreateSheet(SHEET_NAMES.INVENTORY, [
        'sku', 'name', 'description', 'category', 'cost', 'price',
        'quantity', 'minStock', 'maxStock', 'unit', 'supplier',
        'location', 'imageUrl', 'lastUpdated', 'updatedBy'
      ]);

      for (const item of items) {
        try {
          const success = await this.updateInventoryItem(item);
          if (success) synced++;
          else errors.push(`Failed to sync item: ${item.sku}`);
        } catch (e) {
          errors.push(`Error syncing ${item.sku}: ${e}`);
        }
      }

      return { success: errors.length === 0, synced, errors, timestamp: new Date().toISOString() };
    } catch (error) {
      return { success: false, synced, errors: [String(error)], timestamp: new Date().toISOString() };
    }
  }

  // ===========================================================================
  // COMMISSIONS
  // ===========================================================================

  async getCommissions(options?: {
    salesRep?: string;
    startDate?: string;
    endDate?: string;
  }): Promise<CommissionEntry[]> {
    const ready = await this.init();
    if (!ready || !this.doc) return [];

    try {
      const sheet = await this.getOrCreateSheet(SHEET_NAMES.COMMISSIONS, [
        'salesRep', 'date', 'amount', 'balance', 'jobId', 'jobName', 'description', 'status'
      ]);

      const rows = await sheet.getRows();
      let entries: CommissionEntry[] = rows.map(row => ({
        salesRep: row.get('salesRep') || '',
        date: row.get('date') || '',
        amount: parseFloat(row.get('amount')) || 0,
        balance: parseFloat(row.get('balance')) || 0,
        jobId: row.get('jobId') || '',
        jobName: row.get('jobName') || '',
        description: row.get('description') || '',
        status: row.get('status') || '',
      }));

      // Apply filters
      if (options?.salesRep) {
        entries = entries.filter(e =>
          e.salesRep.toLowerCase() === options.salesRep!.toLowerCase()
        );
      }

      if (options?.startDate) {
        entries = entries.filter(e => e.date >= options.startDate!);
      }

      if (options?.endDate) {
        entries = entries.filter(e => e.date <= options.endDate!);
      }

      return entries.sort((a, b) => b.date.localeCompare(a.date));
    } catch (error) {
      console.error('Error fetching commissions:', error);
      return [];
    }
  }

  async getCommissionSummaries(): Promise<CommissionSummary[]> {
    const entries = await this.getCommissions();

    // Group by sales rep
    const summaryMap = new Map<string, CommissionSummary>();

    for (const entry of entries) {
      const existing = summaryMap.get(entry.salesRep);

      if (existing) {
        existing.totalEarned += entry.amount;
        existing.transactionCount++;
        if (entry.date > existing.lastTransaction) {
          existing.lastTransaction = entry.date;
          existing.currentBalance = entry.balance;
        }
      } else {
        summaryMap.set(entry.salesRep, {
          salesRep: entry.salesRep,
          totalEarned: entry.amount,
          currentBalance: entry.balance,
          transactionCount: 1,
          lastTransaction: entry.date,
        });
      }
    }

    return Array.from(summaryMap.values()).sort((a, b) =>
      b.totalEarned - a.totalEarned
    );
  }

  async addCommissionEntry(entry: CommissionEntry): Promise<boolean> {
    const ready = await this.init();
    if (!ready || !this.doc) return false;

    try {
      const sheet = await this.getOrCreateSheet(SHEET_NAMES.COMMISSIONS, [
        'salesRep', 'date', 'amount', 'balance', 'jobId', 'jobName', 'description', 'status'
      ]);

      await sheet.addRow({
        salesRep: entry.salesRep,
        date: entry.date,
        amount: entry.amount.toString(),
        balance: entry.balance.toString(),
        jobId: entry.jobId || '',
        jobName: entry.jobName || '',
        description: entry.description || '',
        status: entry.status || 'pending',
      });

      return true;
    } catch (error) {
      console.error('Error adding commission entry:', error);
      return false;
    }
  }

  async importCommissionsFromCsv(csvData: string): Promise<SyncResult> {
    const ready = await this.init();
    if (!ready || !this.doc) {
      return { success: false, synced: 0, errors: ['Google Sheets not initialized'], timestamp: new Date().toISOString() };
    }

    const errors: string[] = [];
    let synced = 0;

    try {
      const lines = csvData.split('\n');
      const headers = lines[0].split(',').map(h => h.trim());

      // Map CSV columns to our schema
      const salesRepIdx = headers.findIndex(h => h.toLowerCase().includes('sales') || h.toLowerCase().includes('rep'));
      const dateIdx = headers.findIndex(h => h.toLowerCase() === 'date');
      const amountIdx = headers.findIndex(h => h.toLowerCase() === 'amount');
      const balanceIdx = headers.findIndex(h => h.toLowerCase() === 'balance');

      if (salesRepIdx === -1 || dateIdx === -1 || amountIdx === -1) {
        return { success: false, synced: 0, errors: ['Invalid CSV format'], timestamp: new Date().toISOString() };
      }

      const sheet = await this.getOrCreateSheet(SHEET_NAMES.COMMISSIONS, [
        'salesRep', 'date', 'amount', 'balance', 'jobId', 'jobName', 'description', 'status'
      ]);

      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        const values = line.split(',').map(v => v.trim());

        try {
          await sheet.addRow({
            salesRep: values[salesRepIdx] || '',
            date: values[dateIdx] || '',
            amount: values[amountIdx] || '0',
            balance: balanceIdx >= 0 ? values[balanceIdx] || '0' : '0',
            jobId: '',
            jobName: '',
            description: 'Imported from CSV',
            status: 'completed',
          });
          synced++;
        } catch (e) {
          errors.push(`Error on line ${i + 1}: ${e}`);
        }
      }

      return { success: errors.length === 0, synced, errors, timestamp: new Date().toISOString() };
    } catch (error) {
      return { success: false, synced, errors: [String(error)], timestamp: new Date().toISOString() };
    }
  }

  // ===========================================================================
  // CUSTOMERS
  // ===========================================================================

  async getCustomers(options?: {
    salesRep?: string;
    search?: string;
  }): Promise<CustomerRecord[]> {
    const ready = await this.init();
    if (!ready || !this.doc) return [];

    try {
      const sheet = await this.getOrCreateSheet(SHEET_NAMES.CUSTOMERS, [
        'customerId', 'name', 'email', 'phone', 'address', 'city', 'state', 'zip',
        'jobCount', 'totalSpent', 'lastJobDate', 'notes', 'source', 'salesRep',
        'createdAt', 'updatedAt'
      ]);

      const rows = await sheet.getRows();
      let customers: CustomerRecord[] = rows.map(row => ({
        customerId: row.get('customerId') || '',
        name: row.get('name') || '',
        email: row.get('email') || '',
        phone: row.get('phone') || '',
        address: row.get('address') || '',
        city: row.get('city') || '',
        state: row.get('state') || '',
        zip: row.get('zip') || '',
        jobCount: parseInt(row.get('jobCount')) || 0,
        totalSpent: parseFloat(row.get('totalSpent')) || 0,
        lastJobDate: row.get('lastJobDate') || '',
        notes: row.get('notes') || '',
        source: row.get('source') || '',
        salesRep: row.get('salesRep') || '',
        createdAt: row.get('createdAt') || '',
        updatedAt: row.get('updatedAt') || '',
      }));

      // Apply filters
      if (options?.salesRep) {
        customers = customers.filter(c =>
          c.salesRep?.toLowerCase() === options.salesRep!.toLowerCase()
        );
      }

      if (options?.search) {
        const searchLower = options.search.toLowerCase();
        customers = customers.filter(c =>
          c.name.toLowerCase().includes(searchLower) ||
          c.email.toLowerCase().includes(searchLower) ||
          c.phone.includes(searchLower) ||
          c.address.toLowerCase().includes(searchLower)
        );
      }

      return customers.sort((a, b) => b.totalSpent - a.totalSpent);
    } catch (error) {
      console.error('Error fetching customers:', error);
      return [];
    }
  }

  async updateCustomer(customer: CustomerRecord): Promise<boolean> {
    const ready = await this.init();
    if (!ready || !this.doc) return false;

    try {
      const sheet = this.doc.sheetsByTitle[SHEET_NAMES.CUSTOMERS];
      if (!sheet) return false;

      const rows = await sheet.getRows();
      const existingRow = rows.find(row => row.get('customerId') === customer.customerId);
      const now = new Date().toISOString();

      if (existingRow) {
        Object.keys(customer).forEach(key => {
          if (key !== 'createdAt') {
            existingRow.set(key, String((customer as any)[key]));
          }
        });
        existingRow.set('updatedAt', now);
        await existingRow.save();
      } else {
        await sheet.addRow({
          ...customer,
          jobCount: customer.jobCount.toString(),
          totalSpent: customer.totalSpent.toString(),
          createdAt: now,
          updatedAt: now,
        });
      }

      return true;
    } catch (error) {
      console.error('Error updating customer:', error);
      return false;
    }
  }

  async deleteCustomer(customerId: string): Promise<boolean> {
    const ready = await this.init();
    if (!ready || !this.doc) return false;

    try {
      const sheet = this.doc.sheetsByTitle[SHEET_NAMES.CUSTOMERS];
      if (!sheet) return false;

      const rows = await sheet.getRows();
      const rowToDelete = rows.find(row => row.get('customerId') === customerId);

      if (rowToDelete) {
        await rowToDelete.delete();
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error deleting customer:', error);
      return false;
    }
  }

  // ===========================================================================
  // ORDERS
  // ===========================================================================

  async getOrders(options?: {
    status?: string;
    customerId?: string;
  }): Promise<OrderRecord[]> {
    const ready = await this.init();
    if (!ready || !this.doc) return [];

    try {
      const sheet = await this.getOrCreateSheet(SHEET_NAMES.ORDERS, [
        'orderId', 'customerId', 'customerName', 'jobId', 'jobAddress', 'status',
        'items', 'totalCost', 'totalPrice', 'createdBy', 'createdAt', 'updatedAt',
        'notes', 'deliveryDate', 'deliveredBy'
      ]);

      const rows = await sheet.getRows();
      let orders: OrderRecord[] = rows.map(row => ({
        orderId: row.get('orderId') || '',
        customerId: row.get('customerId') || '',
        customerName: row.get('customerName') || '',
        jobId: row.get('jobId') || '',
        jobAddress: row.get('jobAddress') || '',
        status: (row.get('status') || 'pending') as OrderRecord['status'],
        items: row.get('items') || '[]',
        totalCost: parseFloat(row.get('totalCost')) || 0,
        totalPrice: parseFloat(row.get('totalPrice')) || 0,
        createdBy: row.get('createdBy') || '',
        createdAt: row.get('createdAt') || '',
        updatedAt: row.get('updatedAt') || '',
        notes: row.get('notes') || '',
        deliveryDate: row.get('deliveryDate') || '',
        deliveredBy: row.get('deliveredBy') || '',
      }));

      // Apply filters
      if (options?.status) {
        orders = orders.filter(o => o.status === options.status);
      }

      if (options?.customerId) {
        orders = orders.filter(o => o.customerId === options.customerId);
      }

      return orders.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    } catch (error) {
      console.error('Error fetching orders:', error);
      return [];
    }
  }

  async updateOrder(order: OrderRecord): Promise<boolean> {
    const ready = await this.init();
    if (!ready || !this.doc) return false;

    try {
      const sheet = this.doc.sheetsByTitle[SHEET_NAMES.ORDERS];
      if (!sheet) return false;

      const rows = await sheet.getRows();
      const existingRow = rows.find(row => row.get('orderId') === order.orderId);
      const now = new Date().toISOString();

      if (existingRow) {
        Object.keys(order).forEach(key => {
          if (key !== 'createdAt') {
            existingRow.set(key, String((order as any)[key]));
          }
        });
        existingRow.set('updatedAt', now);
        await existingRow.save();
      } else {
        await sheet.addRow({
          ...order,
          totalCost: order.totalCost.toString(),
          totalPrice: order.totalPrice.toString(),
          createdAt: now,
          updatedAt: now,
        });
      }

      return true;
    } catch (error) {
      console.error('Error updating order:', error);
      return false;
    }
  }

  // ===========================================================================
  // SYNC OPERATIONS
  // ===========================================================================

  async triggerFullSync(): Promise<{
    success: boolean;
    results: {
      inventory: SyncResult;
      team: SyncResult;
    };
  }> {
    const ready = await this.init();
    if (!ready) {
      const failResult: SyncResult = {
        success: false,
        synced: 0,
        errors: ['Google Sheets not initialized'],
        timestamp: new Date().toISOString(),
      };
      return {
        success: false,
        results: {
          inventory: failResult,
          team: failResult,
        },
      };
    }

    // This would sync data from JSON files to sheets
    // For now, return current state
    const inventoryResult: SyncResult = {
      success: true,
      synced: 0,
      errors: [],
      timestamp: new Date().toISOString(),
    };

    const teamResult: SyncResult = {
      success: true,
      synced: 0,
      errors: [],
      timestamp: new Date().toISOString(),
    };

    return {
      success: true,
      results: {
        inventory: inventoryResult,
        team: teamResult,
      },
    };
  }

  /**
   * Get connection status
   */
  getStatus(): {
    configured: boolean;
    connected: boolean;
    sheetTitle?: string;
  } {
    return {
      configured: isGoogleSheetsConfigured(),
      connected: this.initialized && this.doc !== null,
      sheetTitle: this.doc?.title,
    };
  }

  // ===========================================================================
  // GEOCODED CONTACTS
  // ===========================================================================

  async getGeocodedContacts(options?: {
    salesRep?: string;
    type?: string;
  }): Promise<GeocodedContactRecord[]> {
    const ready = await this.init();
    if (!ready || !this.doc) return [];

    try {
      const sheet = await this.getOrCreateSheet(SHEET_NAMES.GEOCODED_CONTACTS, GEOCODED_CONTACT_COLUMNS);

      const rows = await sheet.getRows();
      let contacts: GeocodedContactRecord[] = rows.map(row => ({
        jnid: row.get('jnid') || '',
        name: row.get('name') || '',
        firstName: row.get('firstName') || '',
        lastName: row.get('lastName') || '',
        company: row.get('company') || '',
        address: row.get('address') || '',
        city: row.get('city') || '',
        state: row.get('state') || '',
        zip: row.get('zip') || '',
        lat: row.get('lat') || '',
        lng: row.get('lng') || '',
        placeId: row.get('placeId') || '',
        email: row.get('email') || '',
        mobilePhone: row.get('mobilePhone') || '',
        homePhone: row.get('homePhone') || '',
        type: row.get('type') || '',
        recordType: row.get('recordType') || '',
        salesRep: row.get('salesRep') || '',
        salesRepName: row.get('salesRepName') || '',
        salesRepId: row.get('salesRepId') || '',
        jobStatus: row.get('jobStatus') || '',
        isClosed: row.get('isClosed') || '',
        isArchived: row.get('isArchived') || '',
        source: row.get('source') || '',
        tags: row.get('tags') || '',
        approvedEstimateTotal: row.get('approvedEstimateTotal') || '',
        approvedInvoiceTotal: row.get('approvedInvoiceTotal') || '',
        lastBudgetRevenue: row.get('lastBudgetRevenue') || '',
        dateOfLoss: row.get('dateOfLoss') || '',
        dateCreated: row.get('dateCreated') || '',
        dateUpdated: row.get('dateUpdated') || '',
        lastInteraction: row.get('lastInteraction') || '',
        interactionType: row.get('interactionType') || '',
        createdAt: row.get('createdAt') || '',
      }));

      if (options?.salesRep) {
        contacts = contacts.filter(c => c.salesRep === options.salesRep);
      }
      if (options?.type) {
        contacts = contacts.filter(c => c.type === options.type);
      }

      return contacts;
    } catch (error) {
      console.error('Error fetching geocoded contacts:', error);
      return [];
    }
  }

  async addGeocodedContact(contact: GeocodedContactRecord): Promise<boolean> {
    const ready = await this.init();
    if (!ready || !this.doc) return false;

    try {
      const sheet = await this.getOrCreateSheet(SHEET_NAMES.GEOCODED_CONTACTS, GEOCODED_CONTACT_COLUMNS);

      // Check for existing entry
      const rows = await sheet.getRows();
      const existing = rows.find(r => r.get('jnid') === contact.jnid);

      if (existing) {
        Object.keys(contact).forEach(key => {
          existing.set(key, (contact as any)[key]);
        });
        await existing.save();
      } else {
        await sheet.addRow(contact as unknown as Record<string, string | number | boolean>);
      }

      return true;
    } catch (error) {
      console.error('Error adding geocoded contact:', error);
      return false;
    }
  }

  async addGeocodedContactsBatch(contacts: GeocodedContactRecord[]): Promise<{ added: number; errors: number }> {
    const ready = await this.init();
    if (!ready || !this.doc) return { added: 0, errors: contacts.length };

    let added = 0;
    let errors = 0;

    try {
      const sheet = await this.getOrCreateSheet(SHEET_NAMES.GEOCODED_CONTACTS, GEOCODED_CONTACT_COLUMNS);

      for (const contact of contacts) {
        try {
          await sheet.addRow(contact as unknown as Record<string, string | number | boolean>);
          added++;
        } catch {
          errors++;
        }
      }
    } catch (error) {
      console.error('Error batch adding geocoded contacts:', error);
      errors = contacts.length - added;
    }

    return { added, errors };
  }

  // ===========================================================================
  // LEAD DISTRIBUTION LOG
  // ===========================================================================

  async addDistributionLog(log: LeadDistributionLogRecord): Promise<boolean> {
    const ready = await this.init();
    if (!ready || !this.doc) return false;

    try {
      const sheet = await this.getOrCreateSheet(SHEET_NAMES.LEAD_DISTRIBUTION_LOG, LEAD_DISTRIBUTION_LOG_COLUMNS);

      await sheet.addRow(log as unknown as Record<string, string | number | boolean>);
      return true;
    } catch (error) {
      console.error('Error adding distribution log:', error);
      return false;
    }
  }

  async getDistributionLogs(options?: {
    limit?: number;
    assignedRep?: string;
  }): Promise<LeadDistributionLogRecord[]> {
    const ready = await this.init();
    if (!ready || !this.doc) return [];

    try {
      const sheet = await this.getOrCreateSheet(SHEET_NAMES.LEAD_DISTRIBUTION_LOG, LEAD_DISTRIBUTION_LOG_COLUMNS);

      const rows = await sheet.getRows();
      let logs: LeadDistributionLogRecord[] = rows.map(row => ({
        logId: row.get('logId') || '',
        leadId: row.get('leadId') || '',
        customerName: row.get('customerName') || '',
        address: row.get('address') || '',
        assignedRep: row.get('assignedRep') || '',
        algorithmScores: row.get('algorithmScores') || '{}',
        factors: row.get('factors') || '{}',
        overrideReason: row.get('overrideReason') || '',
        timestamp: row.get('timestamp') || '',
        reason: row.get('reason') || '',
        runnerUpRep: row.get('runnerUpRep') || '',
        runnerUpScore: row.get('runnerUpScore') || '',
        weightSetVersion: row.get('weightSetVersion') || '',
        tiebreakerApplied: row.get('tiebreakerApplied') || '',
        leadQualityScore: row.get('leadQualityScore') || '',
        leadQualityBand: row.get('leadQualityBand') || '',
        leadQualityFactors: row.get('leadQualityFactors') || '{}',
        leadQualityContributions: row.get('leadQualityContributions') || '{}',
        leadQualityConfidence: row.get('leadQualityConfidence') || '',
        leadQualityComputedAt: row.get('leadQualityComputedAt') || '',
      }));

      if (options?.assignedRep) {
        logs = logs.filter(l => l.assignedRep === options.assignedRep);
      }

      logs.sort((a, b) => b.timestamp.localeCompare(a.timestamp));

      if (options?.limit) {
        logs = logs.slice(0, options.limit);
      }

      return logs;
    } catch (error) {
      console.error('Error fetching distribution logs:', error);
      return [];
    }
  }

  /**
   * Find the most-recent distribution log entry for a given leadId. Used by
   * outcome-log writers (recordContact, recordReassignment, JN webhook hooks)
   * to discover which logId to upsert against. Returns '' if no row found.
   *
   * Note: O(n) scan today. Fine at current volume (low hundreds of rows).
   * If the log grows large, add a leadId index column or move to a real DB.
   */
  async findDistributionLogIdByLeadId(leadId: string): Promise<string> {
    if (!leadId) return '';
    const logs = await this.getDistributionLogs();
    const match = logs.find(l => l.leadId === leadId);
    return match?.logId || '';
  }

  /**
   * Update only the lead-quality fields on a distribution-log row, keyed by
   * logId. Used by the post-roof-measure recompute hook (and any future
   * model-update path) so the quality score can be refined after the initial
   * preliminary computation without rewriting the rest of the row.
   */
  async updateDistributionLogQuality(
    logId: string,
    quality: {
      leadQualityScore?: string;
      leadQualityBand?: string;
      leadQualityFactors?: string;
      leadQualityContributions?: string;
      leadQualityConfidence?: string;
      leadQualityComputedAt?: string;
    }
  ): Promise<boolean> {
    const ready = await this.init();
    if (!ready || !this.doc || !logId) return false;
    try {
      const sheet = await this.getOrCreateSheet(SHEET_NAMES.LEAD_DISTRIBUTION_LOG, LEAD_DISTRIBUTION_LOG_COLUMNS);
      const rows = await sheet.getRows();
      const row = rows.find(r => r.get('logId') === logId);
      if (!row) return false;
      for (const [k, v] of Object.entries(quality)) {
        if (v !== undefined) row.set(k, v);
      }
      await row.save();
      return true;
    } catch (err) {
      console.error('[LeadDistro] Failed to update quality fields:', err);
      return false;
    }
  }

  // ===========================================================================
  // LEAD OUTCOME LOG
  // ===========================================================================

  async getLeadOutcomeLogs(options?: {
    logId?: string;
    assignedRep?: string;
    finalDisposition?: string;
    limit?: number;
  }): Promise<LeadOutcomeLogRecord[]> {
    const ready = await this.init();
    if (!ready || !this.doc) return [];

    try {
      const sheet = await this.getOrCreateSheet(SHEET_NAMES.LEAD_OUTCOME_LOG, LEAD_OUTCOME_LOG_COLUMNS);
      const rows = await sheet.getRows();
      let logs: LeadOutcomeLogRecord[] = rows.map(row => ({
        logId: row.get('logId') || '',
        leadId: row.get('leadId') || '',
        assignedRep: row.get('assignedRep') || '',
        originalAssignedRep: row.get('originalAssignedRep') || '',
        firstContactAttemptAt: row.get('firstContactAttemptAt') || '',
        firstContactConnectAt: row.get('firstContactConnectAt') || '',
        firstContactMethod: row.get('firstContactMethod') || '',
        estimateCreatedAt: row.get('estimateCreatedAt') || '',
        estimateAmount: row.get('estimateAmount') || '',
        jobSoldAt: row.get('jobSoldAt') || '',
        jobSoldAmount: row.get('jobSoldAmount') || '',
        jobLostAt: row.get('jobLostAt') || '',
        jobLostReason: row.get('jobLostReason') || '',
        reassignedAt: row.get('reassignedAt') || '',
        reassignedTo: row.get('reassignedTo') || '',
        reassignReason: row.get('reassignReason') || '',
        finalDisposition: row.get('finalDisposition') || '',
        dispositionAt: row.get('dispositionAt') || '',
        updatedAt: row.get('updatedAt') || '',
      }));

      if (options?.logId) logs = logs.filter(l => l.logId === options.logId);
      if (options?.assignedRep) logs = logs.filter(l => l.assignedRep === options.assignedRep);
      if (options?.finalDisposition) logs = logs.filter(l => l.finalDisposition === options.finalDisposition);
      logs.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
      if (options?.limit) logs = logs.slice(0, options.limit);
      return logs;
    } catch (error) {
      console.error('Error fetching lead outcome logs:', error);
      return [];
    }
  }

  /**
   * Upsert by logId. Pass any subset of fields and they will be merged onto
   * the existing row (or a new row will be created if logId is new). Called
   * progressively as outcome events fire: first-contact, estimate, sold, lost,
   * reassign, final disposition.
   */
  async upsertLeadOutcomeLog(
    record: Partial<LeadOutcomeLogRecord> & { logId: string }
  ): Promise<boolean> {
    const ready = await this.init();
    if (!ready || !this.doc) return false;

    if (!record.logId) {
      console.warn('[OutcomeLog] upsert called without logId');
      return false;
    }

    try {
      const sheet = await this.getOrCreateSheet(SHEET_NAMES.LEAD_OUTCOME_LOG, LEAD_OUTCOME_LOG_COLUMNS);
      const rows = await sheet.getRows();
      const existing = rows.find(r => r.get('logId') === record.logId);
      const updatedAt = new Date().toISOString();

      if (existing) {
        for (const [k, v] of Object.entries(record)) {
          if (v !== undefined && v !== null) existing.set(k, v as string);
        }
        existing.set('updatedAt', updatedAt);
        await existing.save();
      } else {
        const full: LeadOutcomeLogRecord = {
          logId: record.logId,
          leadId: record.leadId || '',
          assignedRep: record.assignedRep || '',
          originalAssignedRep: record.originalAssignedRep || record.assignedRep || '',
          firstContactAttemptAt: record.firstContactAttemptAt || '',
          firstContactConnectAt: record.firstContactConnectAt || '',
          firstContactMethod: record.firstContactMethod || '',
          estimateCreatedAt: record.estimateCreatedAt || '',
          estimateAmount: record.estimateAmount || '',
          jobSoldAt: record.jobSoldAt || '',
          jobSoldAmount: record.jobSoldAmount || '',
          jobLostAt: record.jobLostAt || '',
          jobLostReason: record.jobLostReason || '',
          reassignedAt: record.reassignedAt || '',
          reassignedTo: record.reassignedTo || '',
          reassignReason: record.reassignReason || '',
          finalDisposition: record.finalDisposition || 'open',
          dispositionAt: record.dispositionAt || '',
          updatedAt,
        };
        await sheet.addRow(full as unknown as Record<string, string | number | boolean>);
      }
      return true;
    } catch (error) {
      console.error('Error upserting lead outcome log:', error);
      return false;
    }
  }

  // ===========================================================================
  // LEAD REASSIGNMENT QUEUE
  // ===========================================================================

  async getReassignmentQueue(options?: { status?: string; limit?: number }): Promise<LeadReassignmentQueueRecord[]> {
    const ready = await this.init();
    if (!ready || !this.doc) return [];
    try {
      const sheet = await this.getOrCreateSheet(SHEET_NAMES.LEAD_REASSIGNMENT_QUEUE, LEAD_REASSIGNMENT_QUEUE_COLUMNS);
      const rows = await sheet.getRows();
      let records: LeadReassignmentQueueRecord[] = rows.map(row => ({
        queueId: row.get('queueId') || '',
        leadId: row.get('leadId') || '',
        customerName: row.get('customerName') || '',
        customerAddress: row.get('customerAddress') || '',
        originalRep: row.get('originalRep') || '',
        minutesElapsed: row.get('minutesElapsed') || '',
        suggestedRep: row.get('suggestedRep') || '',
        suggestedRepName: row.get('suggestedRepName') || '',
        suggestedRepReason: row.get('suggestedRepReason') || '',
        status: row.get('status') || 'pending',
        createdAt: row.get('createdAt') || '',
        resolvedAt: row.get('resolvedAt') || '',
        resolvedBy: row.get('resolvedBy') || '',
        resolutionNotes: row.get('resolutionNotes') || '',
      }));
      if (options?.status) records = records.filter(r => r.status === options.status);
      records.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      if (options?.limit) records = records.slice(0, options.limit);
      return records;
    } catch (err) {
      console.error('Error fetching reassignment queue:', err);
      return [];
    }
  }

  async addReassignmentQueueEntry(record: LeadReassignmentQueueRecord): Promise<boolean> {
    const ready = await this.init();
    if (!ready || !this.doc) return false;
    try {
      const sheet = await this.getOrCreateSheet(SHEET_NAMES.LEAD_REASSIGNMENT_QUEUE, LEAD_REASSIGNMENT_QUEUE_COLUMNS);
      // Idempotency: skip if there's already an open queue entry for this lead
      const rows = await sheet.getRows();
      const existing = rows.find(r => r.get('leadId') === record.leadId && r.get('status') === 'pending');
      if (existing) {
        // Update the elapsed time so the queue reflects the latest breach moment
        existing.set('minutesElapsed', record.minutesElapsed);
        existing.set('suggestedRep', record.suggestedRep);
        existing.set('suggestedRepName', record.suggestedRepName);
        existing.set('suggestedRepReason', record.suggestedRepReason);
        await existing.save();
        return true;
      }
      await sheet.addRow(record as unknown as Record<string, string | number | boolean>);
      return true;
    } catch (err) {
      console.error('Error adding reassignment queue entry:', err);
      return false;
    }
  }

  async resolveReassignmentQueueEntry(
    queueId: string,
    resolution: { status: 'resolved-reassigned' | 'resolved-declined'; resolvedBy: string; resolutionNotes?: string }
  ): Promise<boolean> {
    const ready = await this.init();
    if (!ready || !this.doc) return false;
    try {
      const sheet = await this.getOrCreateSheet(SHEET_NAMES.LEAD_REASSIGNMENT_QUEUE, LEAD_REASSIGNMENT_QUEUE_COLUMNS);
      const rows = await sheet.getRows();
      const row = rows.find(r => r.get('queueId') === queueId);
      if (!row) return false;
      row.set('status', resolution.status);
      row.set('resolvedAt', new Date().toISOString());
      row.set('resolvedBy', resolution.resolvedBy);
      row.set('resolutionNotes', resolution.resolutionNotes || '');
      await row.save();
      return true;
    } catch (err) {
      console.error('Error resolving reassignment queue entry:', err);
      return false;
    }
  }

  // ===========================================================================
  // TEAM PROFILES
  // ===========================================================================

  async getTeamProfiles(): Promise<TeamProfileRecord[]> {
    const ready = await this.init();
    if (!ready || !this.doc) return [];
    try {
      const sheet = await this.getOrCreateSheet(SHEET_NAMES.TEAM_PROFILES, TEAM_PROFILES_COLUMNS);
      const rows = await sheet.getRows();
      return rows.map(row => ({
        repSlug: row.get('repSlug') || '',
        bio: row.get('bio') || '',
        headshotUrl: row.get('headshotUrl') || '',
        truckPicUrl: row.get('truckPicUrl') || '',
        certifications: row.get('certifications') || '',
        yearsExperience: row.get('yearsExperience') || '',
        favoriteQuote: row.get('favoriteQuote') || '',
        // Default existing rows (no status set) to 'published' — they were
        // already considered live before approval workflow shipped.
        status: row.get('status') || 'published',
        pendingDraft: row.get('pendingDraft') || '',
        submittedAt: row.get('submittedAt') || '',
        submittedBy: row.get('submittedBy') || '',
        approvedBy: row.get('approvedBy') || '',
        approvedAt: row.get('approvedAt') || '',
        rejectionNotes: row.get('rejectionNotes') || '',
        version: row.get('version') || '1',
        publishedAt: row.get('publishedAt') || row.get('updatedAt') || '',
        personalReviewIds: row.get('personalReviewIds') || '',
        reviewDisplayMode: row.get('reviewDisplayMode') || 'personal-plus-company-fallback',
        updatedAt: row.get('updatedAt') || '',
        updatedBy: row.get('updatedBy') || '',
      }));
    } catch (err) {
      console.error('Error fetching team profiles:', err);
      return [];
    }
  }

  async getTeamProfile(repSlug: string): Promise<TeamProfileRecord | null> {
    const all = await this.getTeamProfiles();
    return all.find(p => p.repSlug === repSlug) || null;
  }

  async upsertTeamProfile(profile: Partial<TeamProfileRecord> & { repSlug: string }): Promise<boolean> {
    const ready = await this.init();
    if (!ready || !this.doc || !profile.repSlug) return false;
    try {
      const sheet = await this.getOrCreateSheet(SHEET_NAMES.TEAM_PROFILES, TEAM_PROFILES_COLUMNS);
      const rows = await sheet.getRows();
      const existing = rows.find(r => r.get('repSlug') === profile.repSlug);
      const ts = new Date().toISOString();
      const payload: Record<string, string> = { updatedAt: ts };
      for (const [k, v] of Object.entries(profile)) {
        if (v !== undefined && v !== null) payload[k] = String(v);
      }
      if (existing) {
        for (const [k, v] of Object.entries(payload)) {
          existing.set(k, v);
        }
        await existing.save();
      } else {
        // Initialize defaults for new rows
        const full = {
          status: 'draft',
          version: '1',
          reviewDisplayMode: 'personal-plus-company-fallback',
          ...payload,
        };
        await sheet.addRow(full as unknown as Record<string, string | number | boolean>);
      }
      return true;
    } catch (err) {
      console.error('Error upserting team profile:', err);
      return false;
    }
  }

  // ===========================================================================
  // WEATHER FORECAST CACHE
  // ===========================================================================

  async getWeatherForecastCache(locationKey: string): Promise<WeatherForecastCacheRecord | null> {
    const ready = await this.init();
    if (!ready || !this.doc) return null;
    try {
      const sheet = await this.getOrCreateSheet(SHEET_NAMES.WEATHER_FORECAST_CACHE, WEATHER_FORECAST_CACHE_COLUMNS);
      const rows = await sheet.getRows();
      const row = rows.find(r => r.get('locationKey') === locationKey);
      if (!row) return null;
      return {
        locationKey: row.get('locationKey') || '',
        displayName: row.get('displayName') || '',
        lat: row.get('lat') || '',
        lng: row.get('lng') || '',
        forecastJson: row.get('forecastJson') || '',
        disclaimer: row.get('disclaimer') || '',
        fetchedAt: row.get('fetchedAt') || '',
        nextRefreshAt: row.get('nextRefreshAt') || '',
        source: row.get('source') || '',
      };
    } catch (err) {
      console.error('Error fetching weather cache:', err);
      return null;
    }
  }

  async getAllWeatherForecastCache(): Promise<WeatherForecastCacheRecord[]> {
    const ready = await this.init();
    if (!ready || !this.doc) return [];
    try {
      const sheet = await this.getOrCreateSheet(SHEET_NAMES.WEATHER_FORECAST_CACHE, WEATHER_FORECAST_CACHE_COLUMNS);
      const rows = await sheet.getRows();
      return rows.map(row => ({
        locationKey: row.get('locationKey') || '',
        displayName: row.get('displayName') || '',
        lat: row.get('lat') || '',
        lng: row.get('lng') || '',
        forecastJson: row.get('forecastJson') || '',
        disclaimer: row.get('disclaimer') || '',
        fetchedAt: row.get('fetchedAt') || '',
        nextRefreshAt: row.get('nextRefreshAt') || '',
        source: row.get('source') || '',
      }));
    } catch (err) {
      console.error('Error listing weather cache:', err);
      return [];
    }
  }

  async upsertWeatherForecastCache(record: WeatherForecastCacheRecord): Promise<boolean> {
    const ready = await this.init();
    if (!ready || !this.doc || !record.locationKey) return false;
    try {
      const sheet = await this.getOrCreateSheet(SHEET_NAMES.WEATHER_FORECAST_CACHE, WEATHER_FORECAST_CACHE_COLUMNS);
      const rows = await sheet.getRows();
      const existing = rows.find(r => r.get('locationKey') === record.locationKey);
      const payload = record as unknown as Record<string, string | number | boolean>;
      if (existing) {
        for (const [k, v] of Object.entries(record)) {
          if (v !== undefined) existing.set(k, v as string);
        }
        await existing.save();
      } else {
        await sheet.addRow(payload);
      }
      return true;
    } catch (err) {
      console.error('Error upserting weather cache:', err);
      return false;
    }
  }

  // ===========================================================================
  // CUSTOMER PORTAL EVENTS (analytics)
  // ===========================================================================

  async addCustomerPortalEvent(event: Partial<CustomerPortalEventRecord> & { eventType: string; createdAt?: string }): Promise<boolean> {
    const ready = await this.init();
    if (!ready || !this.doc) return false;
    try {
      const sheet = await this.getOrCreateSheet(SHEET_NAMES.CUSTOMER_PORTAL_EVENTS, CUSTOMER_PORTAL_EVENTS_COLUMNS);
      const full: Record<string, string> = {
        eventId: event.eventId || `EVT-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        portalToken: event.portalToken || '',
        leadId: event.leadId || '',
        assignedRep: event.assignedRep || '',
        customerName: event.customerName || '',
        eventType: event.eventType,
        tileKey: event.tileKey || '',
        userAgent: (event.userAgent || '').slice(0, 120),
        ipHash: event.ipHash || '',
        referrer: (event.referrer || '').slice(0, 200),
        timeOnPageMs: event.timeOnPageMs || '',
        isPreview: event.isPreview || 'false',
        createdAt: event.createdAt || new Date().toISOString(),
      };
      await sheet.addRow(full as unknown as Record<string, string | number | boolean>);
      return true;
    } catch (err) {
      console.error('Error adding customer-portal event:', err);
      return false;
    }
  }

  async getCustomerPortalEvents(options?: { leadId?: string; assignedRep?: string; eventType?: string; limit?: number; excludePreview?: boolean }): Promise<CustomerPortalEventRecord[]> {
    const ready = await this.init();
    if (!ready || !this.doc) return [];
    try {
      const sheet = await this.getOrCreateSheet(SHEET_NAMES.CUSTOMER_PORTAL_EVENTS, CUSTOMER_PORTAL_EVENTS_COLUMNS);
      const rows = await sheet.getRows();
      let events: CustomerPortalEventRecord[] = rows.map(row => ({
        eventId: row.get('eventId') || '',
        portalToken: row.get('portalToken') || '',
        leadId: row.get('leadId') || '',
        assignedRep: row.get('assignedRep') || '',
        customerName: row.get('customerName') || '',
        eventType: row.get('eventType') || '',
        tileKey: row.get('tileKey') || '',
        userAgent: row.get('userAgent') || '',
        ipHash: row.get('ipHash') || '',
        referrer: row.get('referrer') || '',
        timeOnPageMs: row.get('timeOnPageMs') || '',
        isPreview: row.get('isPreview') || 'false',
        createdAt: row.get('createdAt') || '',
      }));
      if (options?.leadId) events = events.filter(e => e.leadId === options.leadId);
      if (options?.assignedRep) events = events.filter(e => e.assignedRep === options.assignedRep);
      if (options?.eventType) events = events.filter(e => e.eventType === options.eventType);
      if (options?.excludePreview !== false) events = events.filter(e => e.isPreview !== 'true');
      events.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      if (options?.limit) events = events.slice(0, options.limit);
      return events;
    } catch (err) {
      console.error('Error fetching customer-portal events:', err);
      return [];
    }
  }

  // ===========================================================================
  // REP AVAILABILITY
  // ===========================================================================

  async getRepAvailability(repSlug?: string): Promise<RepAvailabilityRecord[]> {
    const ready = await this.init();
    if (!ready || !this.doc) return [];

    try {
      const sheet = await this.getOrCreateSheet(SHEET_NAMES.REP_AVAILABILITY, [
        'repSlug', 'isReceivingLeads', 'adminOverride', 'adminOverrideBy',
        'adminOverrideReason', 'autoResumeAt', 'scheduleJson', 'updatedAt'
      ]);

      const rows = await sheet.getRows();
      let records: RepAvailabilityRecord[] = rows.map(row => ({
        repSlug: row.get('repSlug') || '',
        isReceivingLeads: row.get('isReceivingLeads') || 'true',
        adminOverride: row.get('adminOverride') || 'false',
        adminOverrideBy: row.get('adminOverrideBy') || '',
        adminOverrideReason: row.get('adminOverrideReason') || '',
        autoResumeAt: row.get('autoResumeAt') || '',
        scheduleJson: row.get('scheduleJson') || '{}',
        updatedAt: row.get('updatedAt') || '',
      }));

      if (repSlug) {
        records = records.filter(r => r.repSlug === repSlug);
      }

      return records;
    } catch (error) {
      console.error('Error fetching rep availability:', error);
      return [];
    }
  }

  async updateRepAvailability(record: RepAvailabilityRecord): Promise<boolean> {
    const ready = await this.init();
    if (!ready || !this.doc) return false;

    try {
      const sheet = await this.getOrCreateSheet(SHEET_NAMES.REP_AVAILABILITY, [
        'repSlug', 'isReceivingLeads', 'adminOverride', 'adminOverrideBy',
        'adminOverrideReason', 'autoResumeAt', 'scheduleJson', 'updatedAt'
      ]);

      const rows = await sheet.getRows();
      const existing = rows.find(r => r.get('repSlug') === record.repSlug);

      if (existing) {
        Object.keys(record).forEach(key => {
          existing.set(key, (record as any)[key]);
        });
        existing.set('updatedAt', new Date().toISOString());
        await existing.save();
      } else {
        await sheet.addRow({
          ...record,
          updatedAt: new Date().toISOString(),
        } as unknown as Record<string, string | number | boolean>);
      }

      return true;
    } catch (error) {
      console.error('Error updating rep availability:', error);
      return false;
    }
  }

  // ===========================================================================
  // REP PREFERENCES
  // ===========================================================================

  async getRepPreferences(repSlug?: string): Promise<RepPreferencesRecord[]> {
    const ready = await this.init();
    if (!ready || !this.doc) return [];

    try {
      const sheet = await this.getOrCreateSheet(SHEET_NAMES.REP_PREFERENCES, [
        'repSlug', 'countiesEnabled', 'maxLeadsPerDay', 'preferredAreas',
        'excludedAreas', 'updatedAt'
      ]);

      const rows = await sheet.getRows();
      let records: RepPreferencesRecord[] = rows.map(row => ({
        repSlug: row.get('repSlug') || '',
        countiesEnabled: row.get('countiesEnabled') || '{}',
        maxLeadsPerDay: row.get('maxLeadsPerDay') || '0',
        preferredAreas: row.get('preferredAreas') || '[]',
        excludedAreas: row.get('excludedAreas') || '[]',
        updatedAt: row.get('updatedAt') || '',
      }));

      if (repSlug) {
        records = records.filter(r => r.repSlug === repSlug);
      }

      return records;
    } catch (error) {
      console.error('Error fetching rep preferences:', error);
      return [];
    }
  }

  async updateRepPreferences(record: RepPreferencesRecord): Promise<boolean> {
    const ready = await this.init();
    if (!ready || !this.doc) return false;

    try {
      const sheet = await this.getOrCreateSheet(SHEET_NAMES.REP_PREFERENCES, [
        'repSlug', 'countiesEnabled', 'maxLeadsPerDay', 'preferredAreas',
        'excludedAreas', 'updatedAt'
      ]);

      const rows = await sheet.getRows();
      const existing = rows.find(r => r.get('repSlug') === record.repSlug);

      if (existing) {
        Object.keys(record).forEach(key => {
          existing.set(key, (record as any)[key]);
        });
        existing.set('updatedAt', new Date().toISOString());
        await existing.save();
      } else {
        await sheet.addRow({
          ...record,
          updatedAt: new Date().toISOString(),
        } as unknown as Record<string, string | number | boolean>);
      }

      return true;
    } catch (error) {
      console.error('Error updating rep preferences:', error);
      return false;
    }
  }

  // ===========================================================================
  // LEAD RESPONSE LOG
  // ===========================================================================

  async addLeadResponseLog(log: LeadResponseLogRecord): Promise<boolean> {
    const ready = await this.init();
    if (!ready || !this.doc) return false;

    try {
      const sheet = await this.getOrCreateSheet(SHEET_NAMES.LEAD_RESPONSE_LOG, [
        'leadId', 'repSlug', 'assignedAt', 'firstContactAt', 'responseMinutes',
        'reminderSentAt', 'warningSentAt', 'reassignedAt', 'reassignedTo', 'missedReason'
      ]);

      await sheet.addRow(log as unknown as Record<string, string | number | boolean>);
      return true;
    } catch (error) {
      console.error('Error adding lead response log:', error);
      return false;
    }
  }

  async updateLeadResponseLog(leadId: string, updates: Partial<LeadResponseLogRecord>): Promise<boolean> {
    const ready = await this.init();
    if (!ready || !this.doc) return false;

    try {
      const sheet = await this.getOrCreateSheet(SHEET_NAMES.LEAD_RESPONSE_LOG, [
        'leadId', 'repSlug', 'assignedAt', 'firstContactAt', 'responseMinutes',
        'reminderSentAt', 'warningSentAt', 'reassignedAt', 'reassignedTo', 'missedReason'
      ]);

      const rows = await sheet.getRows();
      const existing = rows.find(r => r.get('leadId') === leadId);

      if (!existing) return false;

      Object.entries(updates).forEach(([key, value]) => {
        if (value !== undefined) {
          existing.set(key, String(value));
        }
      });

      await existing.save();
      return true;
    } catch (error) {
      console.error('Error updating lead response log:', error);
      return false;
    }
  }

  async getLeadResponseLogs(options?: {
    repSlug?: string;
    limit?: number;
  }): Promise<LeadResponseLogRecord[]> {
    const ready = await this.init();
    if (!ready || !this.doc) return [];

    try {
      const sheet = await this.getOrCreateSheet(SHEET_NAMES.LEAD_RESPONSE_LOG, [
        'leadId', 'repSlug', 'assignedAt', 'firstContactAt', 'responseMinutes',
        'reminderSentAt', 'warningSentAt', 'reassignedAt', 'reassignedTo', 'missedReason'
      ]);

      const rows = await sheet.getRows();
      let logs: LeadResponseLogRecord[] = rows.map(row => ({
        leadId: row.get('leadId') || '',
        repSlug: row.get('repSlug') || '',
        assignedAt: row.get('assignedAt') || '',
        firstContactAt: row.get('firstContactAt') || '',
        responseMinutes: row.get('responseMinutes') || '',
        reminderSentAt: row.get('reminderSentAt') || '',
        warningSentAt: row.get('warningSentAt') || '',
        urgentWarningSentAt: row.get('urgentWarningSentAt') || '',
        reassignedAt: row.get('reassignedAt') || '',
        reassignedTo: row.get('reassignedTo') || '',
        missedReason: row.get('missedReason') || '',
      }));

      if (options?.repSlug) {
        logs = logs.filter(l => l.repSlug === options.repSlug);
      }

      logs.sort((a, b) => b.assignedAt.localeCompare(a.assignedAt));

      if (options?.limit) {
        logs = logs.slice(0, options.limit);
      }

      return logs;
    } catch (error) {
      console.error('Error fetching lead response logs:', error);
      return [];
    }
  }

  // ===========================================================================
  // JOB BREAKDOWNS
  // ===========================================================================

  async getJobBreakdowns(options?: {
    salesRep?: string;
    status?: string;
    search?: string;
  }): Promise<JobBreakdownRecord[]> {
    const ready = await this.init();
    if (!ready || !this.doc) return [];

    try {
      const sheet = await this.getOrCreateSheet(SHEET_NAMES.JOB_BREAKDOWNS, [
        'breakdownId', 'jobId', 'customerName', 'address', 'rNumber',
        'salesRep', 'status', 'materialsJson', 'totals', 'createdAt', 'updatedAt'
      ]);

      const rows = await sheet.getRows();
      let breakdowns: JobBreakdownRecord[] = rows.map(row => ({
        breakdownId: row.get('breakdownId') || '',
        jobId: row.get('jobId') || '',
        customerName: row.get('customerName') || '',
        address: row.get('address') || '',
        rNumber: row.get('rNumber') || '',
        salesRep: row.get('salesRep') || '',
        status: row.get('status') || '',
        materialsJson: row.get('materialsJson') || '[]',
        totals: row.get('totals') || '{}',
        createdAt: row.get('createdAt') || '',
        updatedAt: row.get('updatedAt') || '',
      }));

      if (options?.salesRep) {
        breakdowns = breakdowns.filter(b => b.salesRep === options.salesRep);
      }
      if (options?.status) {
        breakdowns = breakdowns.filter(b => b.status === options.status);
      }
      if (options?.search) {
        const searchLower = options.search.toLowerCase();
        breakdowns = breakdowns.filter(b =>
          b.customerName.toLowerCase().includes(searchLower) ||
          b.address.toLowerCase().includes(searchLower) ||
          b.rNumber.toLowerCase().includes(searchLower)
        );
      }

      return breakdowns.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    } catch (error) {
      console.error('Error fetching job breakdowns:', error);
      return [];
    }
  }

  async addJobBreakdown(breakdown: JobBreakdownRecord): Promise<boolean> {
    const ready = await this.init();
    if (!ready || !this.doc) return false;

    try {
      const sheet = await this.getOrCreateSheet(SHEET_NAMES.JOB_BREAKDOWNS, [
        'breakdownId', 'jobId', 'customerName', 'address', 'rNumber',
        'salesRep', 'status', 'materialsJson', 'totals', 'createdAt', 'updatedAt'
      ]);

      await sheet.addRow(breakdown as unknown as Record<string, string | number | boolean>);
      return true;
    } catch (error) {
      console.error('Error adding job breakdown:', error);
      return false;
    }
  }

  async updateJobBreakdown(breakdownId: string, updates: Partial<JobBreakdownRecord>): Promise<boolean> {
    const ready = await this.init();
    if (!ready || !this.doc) return false;

    try {
      const sheet = this.doc.sheetsByTitle[SHEET_NAMES.JOB_BREAKDOWNS];
      if (!sheet) return false;

      const rows = await sheet.getRows();
      const existing = rows.find(r => r.get('breakdownId') === breakdownId);

      if (!existing) return false;

      Object.entries(updates).forEach(([key, value]) => {
        if (value !== undefined) {
          existing.set(key, String(value));
        }
      });
      existing.set('updatedAt', new Date().toISOString());

      await existing.save();
      return true;
    } catch (error) {
      console.error('Error updating job breakdown:', error);
      return false;
    }
  }
  // ===========================================================================
  // TEAM ACCESS OVERRIDES
  // ===========================================================================

  private readonly accessOverrideHeaders = [
    'memberId', 'moduleOverrides', 'customPermissions', 'updatedBy', 'updatedAt'
  ];

  async getTeamAccessOverrides(memberId?: string): Promise<TeamAccessOverrideRecord[]> {
    const ready = await this.init();
    if (!ready || !this.doc) return [];

    try {
      const sheet = await this.getOrCreateSheet(
        SHEET_NAMES.TEAM_ACCESS_OVERRIDES,
        this.accessOverrideHeaders
      );

      const rows = await sheet.getRows();
      let records: TeamAccessOverrideRecord[] = rows.map(row => ({
        memberId: row.get('memberId') || '',
        moduleOverrides: row.get('moduleOverrides') || '{}',
        customPermissions: row.get('customPermissions') || '{}',
        updatedBy: row.get('updatedBy') || '',
        updatedAt: row.get('updatedAt') || '',
      }));

      if (memberId) {
        records = records.filter(r => r.memberId === memberId);
      }

      return records;
    } catch (error) {
      console.error('Error fetching team access overrides:', error);
      return [];
    }
  }

  async saveTeamAccessOverride(record: TeamAccessOverrideRecord): Promise<boolean> {
    const ready = await this.init();
    if (!ready || !this.doc) return false;

    try {
      const sheet = await this.getOrCreateSheet(
        SHEET_NAMES.TEAM_ACCESS_OVERRIDES,
        this.accessOverrideHeaders
      );

      const rows = await sheet.getRows();
      const existing = rows.find(r => r.get('memberId') === record.memberId);

      if (existing) {
        existing.set('moduleOverrides', record.moduleOverrides);
        existing.set('customPermissions', record.customPermissions);
        existing.set('updatedBy', record.updatedBy);
        existing.set('updatedAt', new Date().toISOString());
        await existing.save();
      } else {
        await sheet.addRow({
          ...record,
          updatedAt: new Date().toISOString(),
        } as unknown as Record<string, string | number | boolean>);
      }

      return true;
    } catch (error) {
      console.error('Error saving team access override:', error);
      return false;
    }
  }

  async deleteTeamAccessOverride(memberId: string): Promise<boolean> {
    const ready = await this.init();
    if (!ready || !this.doc) return false;

    try {
      const sheet = this.doc.sheetsByTitle[SHEET_NAMES.TEAM_ACCESS_OVERRIDES];
      if (!sheet) return false;

      const rows = await sheet.getRows();
      const row = rows.find(r => r.get('memberId') === memberId);

      if (row) {
        await row.delete();
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error deleting team access override:', error);
      return false;
    }
  }

  // ===========================================================================
  // AGENT DIRECTORY & VISITS
  // ===========================================================================

  private readonly agentHeaders = [
    'id', 'name', 'company', 'phone', 'email', 'address', 'notes',
    'isActive', 'assignedRep', 'createdAt', 'updatedAt'
  ];

  private readonly visitHeaders = [
    'id', 'agentId', 'agentName', 'visitedBy', 'visitDate', 'notes',
    'jobsReferred', 'followUpDate', 'createdAt'
  ];

  async getAgents(): Promise<Record<string, string>[]> {
    const ready = await this.init();
    if (!ready || !this.doc) return [];

    try {
      const sheet = await this.getOrCreateSheet(
        SHEET_NAMES.AGENT_DIRECTORY,
        this.agentHeaders
      );

      const rows = await sheet.getRows();
      return rows.map(row => {
        const record: Record<string, string> = {};
        for (const h of this.agentHeaders) {
          record[h] = row.get(h) || '';
        }
        return record;
      });
    } catch (error) {
      console.error('Error fetching agents:', error);
      return [];
    }
  }

  async saveAgent(agent: Record<string, string>): Promise<boolean> {
    const ready = await this.init();
    if (!ready || !this.doc) return false;

    try {
      const sheet = await this.getOrCreateSheet(
        SHEET_NAMES.AGENT_DIRECTORY,
        this.agentHeaders
      );

      const rows = await sheet.getRows();
      const existing = rows.find(r => r.get('id') === agent.id);

      if (existing) {
        for (const h of this.agentHeaders) {
          if (agent[h] !== undefined) existing.set(h, agent[h]);
        }
        existing.set('updatedAt', new Date().toISOString());
        await existing.save();
      } else {
        await sheet.addRow({
          ...agent,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        } as unknown as Record<string, string | number | boolean>);
      }

      return true;
    } catch (error) {
      console.error('Error saving agent:', error);
      return false;
    }
  }

  async getAgentVisits(agentId?: string): Promise<Record<string, string>[]> {
    const ready = await this.init();
    if (!ready || !this.doc) return [];

    try {
      const sheet = await this.getOrCreateSheet(
        SHEET_NAMES.AGENT_VISITS,
        this.visitHeaders
      );

      const rows = await sheet.getRows();
      let records = rows.map(row => {
        const record: Record<string, string> = {};
        for (const h of this.visitHeaders) {
          record[h] = row.get(h) || '';
        }
        return record;
      });

      if (agentId) {
        records = records.filter(r => r.agentId === agentId);
      }

      return records;
    } catch (error) {
      console.error('Error fetching agent visits:', error);
      return [];
    }
  }

  async logAgentVisit(visit: Record<string, string>): Promise<boolean> {
    const ready = await this.init();
    if (!ready || !this.doc) return false;

    try {
      const sheet = await this.getOrCreateSheet(
        SHEET_NAMES.AGENT_VISITS,
        this.visitHeaders
      );

      await sheet.addRow({
        ...visit,
        createdAt: new Date().toISOString(),
      } as unknown as Record<string, string | number | boolean>);

      return true;
    } catch (error) {
      console.error('Error logging agent visit:', error);
      return false;
    }
  }

  // ===========================================================================
  // TRAINING PROGRESS
  // ===========================================================================

  private readonly trainingProgressHeaders = [
    'id', 'userId', 'userName', 'moduleId', 'moduleName',
    'score', 'passed', 'completedAt', 'createdAt'
  ];

  async getTrainingProgress(userId?: string): Promise<Record<string, string>[]> {
    const ready = await this.init();
    if (!ready || !this.doc) return [];

    try {
      const sheet = await this.getOrCreateSheet(
        SHEET_NAMES.TRAINING_PROGRESS,
        this.trainingProgressHeaders
      );

      const rows = await sheet.getRows();
      let records = rows.map(row => {
        const record: Record<string, string> = {};
        for (const h of this.trainingProgressHeaders) {
          record[h] = row.get(h) || '';
        }
        return record;
      });

      if (userId) {
        records = records.filter(r => r.userId === userId);
      }

      return records;
    } catch (error) {
      console.error('Error fetching training progress:', error);
      return [];
    }
  }

  async recordTrainingCompletion(record: Record<string, string>): Promise<boolean> {
    const ready = await this.init();
    if (!ready || !this.doc) return false;

    try {
      const sheet = await this.getOrCreateSheet(
        SHEET_NAMES.TRAINING_PROGRESS,
        this.trainingProgressHeaders
      );

      // Check for existing completion of same module by same user
      const rows = await sheet.getRows();
      const existing = rows.find(
        r => r.get('userId') === record.userId && r.get('moduleId') === record.moduleId
      );

      if (existing) {
        // Update existing record
        for (const h of this.trainingProgressHeaders) {
          if (record[h] !== undefined) {
            existing.set(h, record[h]);
          }
        }
        await existing.save();
      } else {
        await sheet.addRow({
          ...record,
          createdAt: new Date().toISOString(),
        } as unknown as Record<string, string | number | boolean>);
      }

      return true;
    } catch (error) {
      console.error('Error recording training completion:', error);
      return false;
    }
  }

  // ===========================================================================
  // REP WEEKLY NUMBERS
  // ===========================================================================

  private readonly weeklyNumbersHeaders = [
    'week', 'repName', 'repEmail', 'doorsKnocked', 'appointmentsSet',
    'inspectionsCompleted', 'estimatesGiven', 'contractsSigned',
    'revenueClosed', 'leadsGenerated', 'followUpsMade', 'notes', 'submittedAt'
  ];

  async getRepWeeklyNumbers(options?: {
    repEmail?: string;
    weekStart?: string;
    weekEnd?: string;
  }): Promise<RepWeeklyNumbersRecord[]> {
    const ready = await this.init();
    if (!ready || !this.doc) return [];

    try {
      const sheet = await this.getOrCreateSheet(
        SHEET_NAMES.REP_WEEKLY_NUMBERS,
        this.weeklyNumbersHeaders
      );

      const rows = await sheet.getRows();
      let records: RepWeeklyNumbersRecord[] = rows.map(row => ({
        week: row.get('week') || '',
        repName: row.get('repName') || '',
        repEmail: row.get('repEmail') || '',
        doorsKnocked: parseInt(row.get('doorsKnocked')) || 0,
        appointmentsSet: parseInt(row.get('appointmentsSet')) || 0,
        inspectionsCompleted: parseInt(row.get('inspectionsCompleted')) || 0,
        estimatesGiven: parseInt(row.get('estimatesGiven')) || 0,
        contractsSigned: parseInt(row.get('contractsSigned')) || 0,
        revenueClosed: parseFloat(row.get('revenueClosed')) || 0,
        leadsGenerated: parseInt(row.get('leadsGenerated')) || 0,
        followUpsMade: parseInt(row.get('followUpsMade')) || 0,
        notes: row.get('notes') || '',
        submittedAt: row.get('submittedAt') || '',
      }));

      if (options?.repEmail) {
        records = records.filter(r =>
          r.repEmail.toLowerCase() === options.repEmail!.toLowerCase()
        );
      }

      if (options?.weekStart) {
        records = records.filter(r => r.week >= options.weekStart!);
      }

      if (options?.weekEnd) {
        records = records.filter(r => r.week <= options.weekEnd!);
      }

      return records.sort((a, b) => b.week.localeCompare(a.week));
    } catch (error) {
      console.error('Error fetching rep weekly numbers:', error);
      return [];
    }
  }

  async addRepWeeklyNumbers(record: RepWeeklyNumbersRecord): Promise<boolean> {
    const ready = await this.init();
    if (!ready || !this.doc) return false;

    try {
      const sheet = await this.getOrCreateSheet(
        SHEET_NAMES.REP_WEEKLY_NUMBERS,
        this.weeklyNumbersHeaders
      );

      await sheet.addRow({
        week: record.week,
        repName: record.repName,
        repEmail: record.repEmail,
        doorsKnocked: record.doorsKnocked.toString(),
        appointmentsSet: record.appointmentsSet.toString(),
        inspectionsCompleted: record.inspectionsCompleted.toString(),
        estimatesGiven: record.estimatesGiven.toString(),
        contractsSigned: record.contractsSigned.toString(),
        revenueClosed: record.revenueClosed.toString(),
        leadsGenerated: record.leadsGenerated.toString(),
        followUpsMade: record.followUpsMade.toString(),
        notes: record.notes,
        submittedAt: record.submittedAt,
      });

      return true;
    } catch (error) {
      console.error('Error adding rep weekly numbers:', error);
      return false;
    }
  }

  async updateRepWeeklyNumbers(
    week: string,
    repEmail: string,
    updates: Partial<RepWeeklyNumbersRecord>
  ): Promise<boolean> {
    const ready = await this.init();
    if (!ready || !this.doc) return false;

    try {
      const sheet = await this.getOrCreateSheet(
        SHEET_NAMES.REP_WEEKLY_NUMBERS,
        this.weeklyNumbersHeaders
      );

      const rows = await sheet.getRows();
      const existing = rows.find(
        r => r.get('week') === week && r.get('repEmail')?.toLowerCase() === repEmail.toLowerCase()
      );

      if (!existing) return false;

      const numericFields = [
        'doorsKnocked', 'appointmentsSet', 'inspectionsCompleted',
        'estimatesGiven', 'contractsSigned', 'revenueClosed',
        'leadsGenerated', 'followUpsMade'
      ];

      Object.entries(updates).forEach(([key, value]) => {
        if (value !== undefined && key !== 'week' && key !== 'repEmail') {
          existing.set(key, numericFields.includes(key) ? String(value) : String(value));
        }
      });

      existing.set('submittedAt', new Date().toISOString());
      await existing.save();

      return true;
    } catch (error) {
      console.error('Error updating rep weekly numbers:', error);
      return false;
    }
  }
  // ===========================================================================
  // DAILY ACTIVITY
  // ===========================================================================

  private readonly dailyActivityHeaders = [
    'date', 'week', 'repName', 'repEmail', 'inspected', 'damage', 'signed',
    'repair', 'gutter', 'revenue', 'approved', 'goal', 'referrals', 'agents',
    'present', 'homeShow', 'submittedAt'
  ];

  async getDailyActivity(options?: {
    repEmail?: string;
    week?: string;
    dateStart?: string;
    dateEnd?: string;
  }): Promise<DailyActivityRecord[]> {
    const ready = await this.init();
    if (!ready || !this.doc) return [];

    try {
      const sheet = await this.getOrCreateSheet(
        SHEET_NAMES.DAILY_ACTIVITY,
        this.dailyActivityHeaders
      );

      const rows = await sheet.getRows();
      let records: DailyActivityRecord[] = rows.map(row => ({
        date: row.get('date') || '',
        week: row.get('week') || '',
        repName: row.get('repName') || '',
        repEmail: row.get('repEmail') || '',
        inspected: parseInt(row.get('inspected')) || 0,
        damage: parseInt(row.get('damage')) || 0,
        signed: parseInt(row.get('signed')) || 0,
        repair: parseInt(row.get('repair')) || 0,
        gutter: parseInt(row.get('gutter')) || 0,
        revenue: parseFloat(row.get('revenue')) || 0,
        approved: parseInt(row.get('approved')) || 0,
        goal: parseInt(row.get('goal')) || 0,
        referrals: parseInt(row.get('referrals')) || 0,
        agents: parseInt(row.get('agents')) || 0,
        present: row.get('present') || '',
        homeShow: parseInt(row.get('homeShow')) || 0,
        submittedAt: row.get('submittedAt') || '',
      }));

      if (options?.repEmail) {
        records = records.filter(r =>
          r.repEmail.toLowerCase() === options.repEmail!.toLowerCase()
        );
      }

      if (options?.week) {
        records = records.filter(r => r.week === options.week);
      }

      if (options?.dateStart) {
        records = records.filter(r => r.date >= options.dateStart!);
      }

      if (options?.dateEnd) {
        records = records.filter(r => r.date <= options.dateEnd!);
      }

      return records.sort((a, b) => b.date.localeCompare(a.date));
    } catch (error) {
      console.error('Error fetching daily activity:', error);
      return [];
    }
  }

  async addDailyActivity(record: DailyActivityRecord): Promise<boolean> {
    const ready = await this.init();
    if (!ready || !this.doc) return false;

    try {
      const sheet = await this.getOrCreateSheet(
        SHEET_NAMES.DAILY_ACTIVITY,
        this.dailyActivityHeaders
      );

      await sheet.addRow({
        date: record.date,
        week: record.week,
        repName: record.repName,
        repEmail: record.repEmail,
        inspected: record.inspected.toString(),
        damage: record.damage.toString(),
        signed: record.signed.toString(),
        repair: record.repair.toString(),
        gutter: record.gutter.toString(),
        revenue: record.revenue.toString(),
        approved: record.approved.toString(),
        goal: record.goal.toString(),
        referrals: record.referrals.toString(),
        agents: record.agents.toString(),
        present: record.present,
        homeShow: record.homeShow.toString(),
        submittedAt: record.submittedAt,
      });

      return true;
    } catch (error) {
      console.error('Error adding daily activity:', error);
      return false;
    }
  }

  // ===========================================================================
  // CUSTOMER PORTAL LOG
  // ===========================================================================

  private readonly portalLogHeaders = [
    'logId', 'customerName', 'customerEmail', 'jobId', 'action',
    'timestamp', 'ipAddress', 'userAgent', 'details'
  ];

  async addPortalLog(log: CustomerPortalLogRecord): Promise<boolean> {
    const ready = await this.init();
    if (!ready || !this.doc) return false;

    try {
      const sheet = await this.getOrCreateSheet(
        SHEET_NAMES.CUSTOMER_PORTAL_LOG,
        this.portalLogHeaders
      );

      await sheet.addRow({
        logId: log.logId,
        customerName: log.customerName,
        customerEmail: log.customerEmail,
        jobId: log.jobId,
        action: log.action,
        timestamp: log.timestamp,
        ipAddress: log.ipAddress,
        userAgent: log.userAgent,
        details: log.details,
      });

      return true;
    } catch (error) {
      console.error('Error adding portal log:', error);
      return false;
    }
  }

  async getPortalLogs(options?: {
    customerEmail?: string;
    customerId?: string;
    action?: string;
    limit?: number;
    startDate?: string;
    endDate?: string;
  }): Promise<CustomerPortalLogRecord[]> {
    const ready = await this.init();
    if (!ready || !this.doc) return [];

    try {
      const sheet = await this.getOrCreateSheet(
        SHEET_NAMES.CUSTOMER_PORTAL_LOG,
        this.portalLogHeaders
      );

      const rows = await sheet.getRows();
      let logs: CustomerPortalLogRecord[] = rows.map(row => ({
        logId: row.get('logId') || '',
        customerName: row.get('customerName') || '',
        customerEmail: row.get('customerEmail') || '',
        jobId: row.get('jobId') || '',
        action: row.get('action') || '',
        timestamp: row.get('timestamp') || '',
        ipAddress: row.get('ipAddress') || '',
        userAgent: row.get('userAgent') || '',
        details: row.get('details') || '{}',
      }));

      if (options?.customerEmail) {
        logs = logs.filter(l =>
          l.customerEmail.toLowerCase() === options.customerEmail!.toLowerCase()
        );
      }

      if (options?.customerId) {
        // Match by customerId found in the details JSON
        logs = logs.filter(l => {
          try {
            const d = JSON.parse(l.details);
            return d.customerId === options.customerId;
          } catch {
            return false;
          }
        });
      }

      if (options?.action) {
        logs = logs.filter(l => l.action === options.action);
      }

      if (options?.startDate) {
        logs = logs.filter(l => l.timestamp >= options.startDate!);
      }

      if (options?.endDate) {
        logs = logs.filter(l => l.timestamp <= options.endDate!);
      }

      logs.sort((a, b) => b.timestamp.localeCompare(a.timestamp));

      if (options?.limit) {
        logs = logs.slice(0, options.limit);
      }

      return logs;
    } catch (error) {
      console.error('Error fetching portal logs:', error);
      return [];
    }
  }

  // ===========================================================================
  // CUSTOMER PORTAL DATA
  // ===========================================================================

  private readonly portalDataHeaders = [
    'customerId', 'customerName', 'customerEmail', 'customerPhone',
    'address', 'jobId', 'jobStatus', 'portalToken', 'portalCreatedAt',
    'lastAccessed', 'totalVisits', 'messagesSent', 'documentsViewed', 'notes'
  ];

  async getPortalData(customerId?: string): Promise<CustomerPortalDataRecord[]> {
    const ready = await this.init();
    if (!ready || !this.doc) return [];

    try {
      const sheet = await this.getOrCreateSheet(
        SHEET_NAMES.CUSTOMER_PORTAL_DATA,
        this.portalDataHeaders
      );

      const rows = await sheet.getRows();
      let records: CustomerPortalDataRecord[] = rows.map(row => ({
        customerId: row.get('customerId') || '',
        customerName: row.get('customerName') || '',
        customerEmail: row.get('customerEmail') || '',
        customerPhone: row.get('customerPhone') || '',
        address: row.get('address') || '',
        jobId: row.get('jobId') || '',
        jobStatus: row.get('jobStatus') || '',
        portalToken: row.get('portalToken') || '',
        portalCreatedAt: row.get('portalCreatedAt') || '',
        lastAccessed: row.get('lastAccessed') || '',
        totalVisits: parseInt(row.get('totalVisits')) || 0,
        messagesSent: parseInt(row.get('messagesSent')) || 0,
        documentsViewed: parseInt(row.get('documentsViewed')) || 0,
        notes: row.get('notes') || '',
      }));

      if (customerId) {
        records = records.filter(r => r.customerId === customerId);
      }

      return records;
    } catch (error) {
      console.error('Error fetching portal data:', error);
      return [];
    }
  }

  async upsertPortalData(record: CustomerPortalDataRecord): Promise<boolean> {
    const ready = await this.init();
    if (!ready || !this.doc) return false;

    try {
      const sheet = await this.getOrCreateSheet(
        SHEET_NAMES.CUSTOMER_PORTAL_DATA,
        this.portalDataHeaders
      );

      const rows = await sheet.getRows();
      const existing = rows.find(r => r.get('customerId') === record.customerId);

      if (existing) {
        existing.set('customerName', record.customerName);
        existing.set('customerEmail', record.customerEmail);
        existing.set('customerPhone', record.customerPhone);
        existing.set('address', record.address);
        existing.set('jobId', record.jobId);
        existing.set('jobStatus', record.jobStatus);
        existing.set('portalToken', record.portalToken);
        existing.set('lastAccessed', record.lastAccessed);
        existing.set('totalVisits', record.totalVisits.toString());
        existing.set('messagesSent', record.messagesSent.toString());
        existing.set('documentsViewed', record.documentsViewed.toString());
        if (record.notes) existing.set('notes', record.notes);
        await existing.save();
      } else {
        await sheet.addRow({
          customerId: record.customerId,
          customerName: record.customerName,
          customerEmail: record.customerEmail,
          customerPhone: record.customerPhone,
          address: record.address,
          jobId: record.jobId,
          jobStatus: record.jobStatus,
          portalToken: record.portalToken,
          portalCreatedAt: record.portalCreatedAt || new Date().toISOString(),
          lastAccessed: record.lastAccessed,
          totalVisits: record.totalVisits.toString(),
          messagesSent: record.messagesSent.toString(),
          documentsViewed: record.documentsViewed.toString(),
          notes: record.notes,
        });
      }

      return true;
    } catch (error) {
      console.error('Error upserting portal data:', error);
      return false;
    }
  }

  async incrementPortalVisit(customerId: string): Promise<boolean> {
    const ready = await this.init();
    if (!ready || !this.doc) return false;

    try {
      const sheet = await this.getOrCreateSheet(
        SHEET_NAMES.CUSTOMER_PORTAL_DATA,
        this.portalDataHeaders
      );

      const rows = await sheet.getRows();
      const existing = rows.find(r => r.get('customerId') === customerId);

      if (existing) {
        const currentVisits = parseInt(existing.get('totalVisits')) || 0;
        existing.set('totalVisits', (currentVisits + 1).toString());
        existing.set('lastAccessed', new Date().toISOString());
        await existing.save();
        return true;
      }

      return false;
    } catch (error) {
      console.error('Error incrementing portal visit:', error);
      return false;
    }
  }

  async incrementPortalStat(
    customerId: string,
    stat: 'messagesSent' | 'documentsViewed'
  ): Promise<boolean> {
    const ready = await this.init();
    if (!ready || !this.doc) return false;

    try {
      const sheet = await this.getOrCreateSheet(
        SHEET_NAMES.CUSTOMER_PORTAL_DATA,
        this.portalDataHeaders
      );

      const rows = await sheet.getRows();
      const existing = rows.find(r => r.get('customerId') === customerId);

      if (existing) {
        const currentVal = parseInt(existing.get(stat)) || 0;
        existing.set(stat, (currentVal + 1).toString());
        await existing.save();
        return true;
      }

      return false;
    } catch (error) {
      console.error(`Error incrementing portal stat ${stat}:`, error);
      return false;
    }
  }

  // ===========================================================================
  // MONDAY NOTES
  // ===========================================================================

  private readonly mondayNotesHeaders = [
    'id', 'meetingDate', 'userId', 'userName', 'userRole', 'category',
    'title', 'content', 'highlightsJson', 'attachmentsJson',
    'timingJson', 'metricsJson', 'announcementType', 'displayDuration',
    'displayStartDate', 'displayEndDate', 'includeInSlide', 'slideOrder',
    'status', 'createdAt', 'updatedAt'
  ];

  async getMondayNotes(options?: {
    meetingDate?: string;
    userId?: string;
    category?: string;
    status?: string;
  }): Promise<Record<string, string>[]> {
    const ready = await this.init();
    if (!ready || !this.doc) return [];

    try {
      const sheet = await this.getOrCreateSheet(
        SHEET_NAMES.MONDAY_NOTES,
        this.mondayNotesHeaders
      );

      const rows = await sheet.getRows();
      let records = rows.map(row => {
        const record: Record<string, string> = {};
        for (const h of this.mondayNotesHeaders) {
          record[h] = row.get(h) || '';
        }
        return record;
      });

      if (options?.meetingDate) {
        records = records.filter(r => r.meetingDate === options.meetingDate);
      }
      if (options?.userId) {
        records = records.filter(r => r.userId === options.userId);
      }
      if (options?.category) {
        records = records.filter(r => r.category === options.category);
      }
      if (options?.status) {
        records = records.filter(r => r.status === options.status);
      }

      return records;
    } catch (error) {
      console.error('Error fetching monday notes:', error);
      return [];
    }
  }

  async saveMondayNote(note: Record<string, string>): Promise<boolean> {
    const ready = await this.init();
    if (!ready || !this.doc) return false;

    try {
      const sheet = await this.getOrCreateSheet(
        SHEET_NAMES.MONDAY_NOTES,
        this.mondayNotesHeaders
      );

      const rows = await sheet.getRows();
      const existing = rows.find(r => r.get('id') === note.id);

      if (existing) {
        for (const key of this.mondayNotesHeaders) {
          if (note[key] !== undefined) {
            existing.set(key, note[key]);
          }
        }
        await existing.save();
      } else {
        await sheet.addRow(note as unknown as Record<string, string | number | boolean>);
      }

      return true;
    } catch (error) {
      console.error('Error saving monday note:', error);
      return false;
    }
  }

  async deleteMondayNote(noteId: string): Promise<boolean> {
    const ready = await this.init();
    if (!ready || !this.doc) return false;

    try {
      const sheet = this.doc.sheetsByTitle[SHEET_NAMES.MONDAY_NOTES];
      if (!sheet) return false;

      const rows = await sheet.getRows();
      const row = rows.find(r => r.get('id') === noteId);

      if (row) {
        await row.delete();
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error deleting monday note:', error);
      return false;
    }
  }
  // =========================================================================
  // REVIEWS
  // =========================================================================

  private readonly REVIEW_HEADERS = [
    'id', 'name', 'date', 'rating', 'text', 'salesRep', 'repSlug', 'source',
    'visible', 'featured', 'approved', 'createdAt',
  ];

  async getReviews(options?: { repSlug?: string; source?: string; approvedOnly?: boolean }): Promise<Record<string, string>[]> {
    try {
      await this.init();
      const sheet = await this.getOrCreateSheet(SHEET_NAMES.REVIEWS, this.REVIEW_HEADERS);
      const rows = await sheet.getRows();

      let results = rows.map(row => {
        const record: Record<string, string> = {};
        this.REVIEW_HEADERS.forEach(h => { record[h] = row.get(h) || ''; });
        return record;
      });

      if (options?.repSlug) {
        results = results.filter(r => r.repSlug === options.repSlug);
      }
      if (options?.source) {
        results = results.filter(r => r.source?.toLowerCase() === options.source!.toLowerCase());
      }
      if (options?.approvedOnly) {
        results = results.filter(r => r.approved === 'true' || r.approved === 'TRUE');
      }

      return results;
    } catch (error) {
      console.error('Error getting reviews:', error);
      return [];
    }
  }

  async addReview(review: Record<string, string>): Promise<boolean> {
    try {
      await this.init();
      const sheet = await this.getOrCreateSheet(SHEET_NAMES.REVIEWS, this.REVIEW_HEADERS);
      await sheet.addRow(review);
      return true;
    } catch (error) {
      console.error('Error adding review:', error);
      return false;
    }
  }

  async addReviews(reviews: Record<string, string>[]): Promise<boolean> {
    try {
      await this.init();
      const sheet = await this.getOrCreateSheet(SHEET_NAMES.REVIEWS, this.REVIEW_HEADERS);
      await sheet.addRows(reviews);
      return true;
    } catch (error) {
      console.error('Error adding reviews:', error);
      return false;
    }
  }

  // ===========================================================================
  // MARCH MADNESS BRACKET
  // ===========================================================================

  private readonly marchMadnessHeaders = [
    'repName', 'seed', 'nickname',
    'week1Sales', 'week2Sales', 'week3Sales',
    'marchTotal', 'status', 'updatedAt'
  ];

  async getMarchMadnessSales(): Promise<Array<{
    repName: string;
    seed: number;
    nickname: string;
    week1Sales: number;
    week2Sales: number;
    week3Sales: number;
    marchTotal: number;
    status: string;
  }>> {
    const ready = await this.init();
    if (!ready || !this.doc) return [];

    try {
      const sheet = await this.getOrCreateSheet(
        SHEET_NAMES.MARCH_MADNESS,
        this.marchMadnessHeaders
      );

      const rows = await sheet.getRows();
      return rows.map(row => ({
        repName: row.get('repName') || '',
        seed: parseInt(row.get('seed')) || 0,
        nickname: row.get('nickname') || '',
        week1Sales: parseFloat(row.get('week1Sales')) || 0,
        week2Sales: parseFloat(row.get('week2Sales')) || 0,
        week3Sales: parseFloat(row.get('week3Sales')) || 0,
        marchTotal: parseFloat(row.get('marchTotal')) || 0,
        status: row.get('status') || 'active',
      }));
    } catch (error) {
      console.error('[MarchMadness] Error reading sheet:', error);
      return [];
    }
  }

  async updateMarchMadnessSales(
    repName: string,
    week: 1 | 2 | 3,
    sales: number
  ): Promise<boolean> {
    const ready = await this.init();
    if (!ready || !this.doc) return false;

    try {
      const sheet = await this.getOrCreateSheet(
        SHEET_NAMES.MARCH_MADNESS,
        this.marchMadnessHeaders
      );

      const rows = await sheet.getRows();
      const row = rows.find(r => r.get('repName') === repName);

      if (row) {
        const weekKey = `week${week}Sales`;
        row.set(weekKey, sales.toString());
        const w1 = parseFloat(row.get('week1Sales')) || 0;
        const w2 = parseFloat(row.get('week2Sales')) || 0;
        const w3 = parseFloat(row.get('week3Sales')) || 0;
        const totals = [w1, w2, w3];
        totals[week - 1] = sales;
        row.set('marchTotal', (totals[0] + totals[1] + totals[2]).toString());
        row.set('updatedAt', new Date().toISOString());
        await row.save();
      }
      return true;
    } catch (error) {
      console.error('[MarchMadness] Error updating sales:', error);
      return false;
    }
  }

  async initMarchMadnessBracket(participants: Array<{
    repName: string;
    seed: number;
    nickname: string;
  }>): Promise<boolean> {
    const ready = await this.init();
    if (!ready || !this.doc) return false;

    try {
      const sheet = await this.getOrCreateSheet(
        SHEET_NAMES.MARCH_MADNESS,
        this.marchMadnessHeaders
      );

      // Clear existing rows
      const existing = await sheet.getRows();
      for (const row of existing) {
        await row.delete();
      }

      // Add participants
      const rows = participants.map(p => ({
        repName: p.repName,
        seed: p.seed.toString(),
        nickname: p.nickname,
        week1Sales: '0',
        week2Sales: '0',
        week3Sales: '0',
        marchTotal: '0',
        status: 'active',
        updatedAt: new Date().toISOString(),
      }));

      await sheet.addRows(rows);
      return true;
    } catch (error) {
      console.error('[MarchMadness] Error initializing bracket:', error);
      return false;
    }
  }

  // ===========================================================================
  // FINANCIAL SYNC
  // ===========================================================================

  private async syncSheetData(sheetName: string, data: Record<string, string | number>[]): Promise<void> {
    const ready = await this.init();
    if (!ready || !this.doc || data.length === 0) return;

    const headers = Object.keys(data[0]);
    const sheet = await this.getOrCreateSheet(sheetName, headers);
    const rows = await sheet.getRows();
    if (rows.length > 0) await sheet.clearRows();
    await sheet.addRows(data);
  }

  async syncFinancialSummary(data: Record<string, string | number>[]): Promise<void> {
    await this.syncSheetData(SHEET_NAMES.FINANCIAL_SUMMARY, data);
  }

  async syncRevenueByRep(data: Record<string, string | number>[]): Promise<void> {
    await this.syncSheetData(SHEET_NAMES.REVENUE_BY_REP, data);
  }

  async syncJobProfitability(data: Record<string, string | number>[]): Promise<void> {
    await this.syncSheetData(SHEET_NAMES.JOB_PROFITABILITY, data);
  }

  async syncOutstandingInvoices(data: Record<string, string | number>[]): Promise<void> {
    await this.syncSheetData(SHEET_NAMES.OUTSTANDING_INVOICES, data);
  }

  async syncMonthlyTrends(data: Record<string, string | number>[]): Promise<void> {
    await this.syncSheetData(SHEET_NAMES.MONTHLY_TRENDS, data);
  }

  // ===========================================================================
  // INVENTORY - addInventoryItem (explicit add, delegates to updateInventoryItem upsert)
  // ===========================================================================

  async addInventoryItem(item: InventoryItem): Promise<boolean> {
    return this.updateInventoryItem({
      ...item,
      lastUpdated: new Date().toISOString(),
    });
  }

  // ===========================================================================
  // INVOICES
  // ===========================================================================

  private readonly invoiceHeaders = [
    'invoiceId', 'jobId', 'breakdownId', 'customerName', 'customerEmail', 'customerPhone',
    'billingAddressJson', 'jobAddressJson',
    'type', 'status',
    'lineItemsJson',
    'subtotal', 'taxRate', 'taxAmount', 'discount', 'discountType', 'total', 'amountPaid', 'balanceDue',
    'paymentsJson',
    'insuranceClaimJson',
    'dueDate', 'terms', 'notes', 'internalNotes',
    'createdAt', 'updatedAt', 'sentAt', 'paidAt', 'createdBy',
  ];

  async getInvoices(options?: {
    status?: string;
    jobId?: string;
    customerName?: string;
  }): Promise<Record<string, string>[]> {
    const ready = await this.init();
    if (!ready || !this.doc) return [];

    try {
      const sheet = await this.getOrCreateSheet(SHEET_NAMES.INVOICES, this.invoiceHeaders);
      const rows = await sheet.getRows();

      let records = rows.map(row => {
        const record: Record<string, string> = {};
        for (const h of this.invoiceHeaders) {
          record[h] = row.get(h) || '';
        }
        return record;
      }).filter(r => r.invoiceId); // Filter out empty rows

      if (options?.status) {
        records = records.filter(r => r.status === options.status);
      }
      if (options?.jobId) {
        records = records.filter(r => r.jobId === options.jobId);
      }
      if (options?.customerName) {
        const search = options.customerName.toLowerCase();
        records = records.filter(r => r.customerName.toLowerCase().includes(search));
      }

      return records.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
    } catch (error) {
      console.error('Error fetching invoices:', error);
      return [];
    }
  }

  async addInvoice(invoice: Record<string, string>): Promise<boolean> {
    const ready = await this.init();
    if (!ready || !this.doc) return false;

    try {
      const sheet = await this.getOrCreateSheet(SHEET_NAMES.INVOICES, this.invoiceHeaders);
      await sheet.addRow(invoice);
      return true;
    } catch (error) {
      console.error('Error adding invoice:', error);
      return false;
    }
  }

  async updateInvoice(invoiceId: string, updates: Record<string, string>): Promise<boolean> {
    const ready = await this.init();
    if (!ready || !this.doc) return false;

    try {
      const sheet = await this.getOrCreateSheet(SHEET_NAMES.INVOICES, this.invoiceHeaders);
      const rows = await sheet.getRows();
      const existing = rows.find(r => r.get('invoiceId') === invoiceId);

      if (!existing) return false;

      for (const [key, value] of Object.entries(updates)) {
        if (value !== undefined) {
          existing.set(key, value);
        }
      }
      existing.set('updatedAt', new Date().toISOString());
      await existing.save();

      return true;
    } catch (error) {
      console.error('Error updating invoice:', error);
      return false;
    }
  }

  // ===========================================================================
  // AUDIT LOG
  // ===========================================================================

  private readonly auditLogHeaders = [
    'Timestamp', 'Action', 'UserEmail', 'Details', 'IP', 'UserAgent',
  ];

  /**
   * Append a single audit log entry to the AuditLog Google Sheet tab.
   * This is the canonical method -- callers no longer need to access doc directly.
   */
  async appendToAuditLog(entry: {
    action: string;
    userEmail: string;
    details: string;
    ip?: string;
    userAgent?: string;
    timestamp?: string;
  }): Promise<boolean> {
    const ready = await this.init();
    if (!ready || !this.doc) return false;

    try {
      const sheet = await this.getOrCreateSheet(SHEET_NAMES.AUDIT_LOG, this.auditLogHeaders);

      await sheet.addRow({
        Timestamp: entry.timestamp || new Date().toISOString(),
        Action: entry.action,
        UserEmail: entry.userEmail,
        Details: entry.details,
        IP: entry.ip || 'unknown',
        UserAgent: entry.userAgent || '',
      });

      return true;
    } catch (error) {
      console.error('Error appending to audit log:', error);
      return false;
    }
  }

  /**
   * Read audit log entries from the AuditLog Google Sheet tab.
   */
  async getAuditLog(options?: {
    action?: string;
    userEmail?: string;
    limit?: number;
  }): Promise<Record<string, string>[]> {
    const ready = await this.init();
    if (!ready || !this.doc) return [];

    try {
      const sheet = await this.getOrCreateSheet(SHEET_NAMES.AUDIT_LOG, this.auditLogHeaders);
      const rows = await sheet.getRows();

      let records = rows.map(row => {
        const record: Record<string, string> = {};
        for (const h of this.auditLogHeaders) {
          record[h] = row.get(h) || '';
        }
        return record;
      });

      if (options?.action) {
        records = records.filter(r => r.Action === options.action);
      }
      if (options?.userEmail) {
        records = records.filter(r => r.UserEmail === options.userEmail);
      }

      // Sort by timestamp descending
      records.sort((a, b) => (b.Timestamp || '').localeCompare(a.Timestamp || ''));

      if (options?.limit) {
        records = records.slice(0, options.limit);
      }

      return records;
    } catch (error) {
      console.error('Error reading audit log:', error);
      return [];
    }
  }
  // ==========================================================================
  // MEETING NUMBERS (Master Database Copy)
  // ==========================================================================

  /**
   * Upsert a rep's meeting numbers to the MeetingNumbers_{year} tab.
   * This keeps the master RoofStack sheet in sync with the Monday meeting sheet.
   */
  async upsertMeetingNumber(record: {
    meetingDate: string;
    repName: string;
    inspected: number | string;
    damage: number | string;
    signed: number | string;
    repair: number | string;
    gutter: number | string;
    revenue: number | string;
    approved: number | string;
    goal: number | string;
    referrals: number | string;
    agents: number | string;
    present: string;
    homeShow: number | string;
    tabName?: string;
  }): Promise<boolean> {
    const ready = await this.init();
    if (!ready || !this.doc) return false;

    try {
      const year = record.meetingDate.split('-')[0];
      const tabName = `MeetingNumbers_${year}`;
      const HEADERS = [
        'meetingDate', 'repName', 'Inspected', 'Damage', 'Signed', 'Repair',
        'Gutter', 'Revenue_Estimated', 'Approved', 'Goal', 'Referrals',
        'Agents', 'Present', 'HomeShow', 'tabName', 'lastUpdated',
      ];

      const sheet = await this.getOrCreateSheet(tabName, HEADERS);
      const rows = await sheet.getRows();
      const existing = rows.find(
        (r: any) => r.get('repName') === record.repName && r.get('meetingDate') === record.meetingDate
      );

      const now = new Date().toISOString();

      if (existing) {
        existing.set('Inspected', String(record.inspected || ''));
        existing.set('Damage', String(record.damage || ''));
        existing.set('Signed', String(record.signed || ''));
        existing.set('Repair', String(record.repair || ''));
        existing.set('Gutter', String(record.gutter || ''));
        existing.set('Revenue_Estimated', String(record.revenue || ''));
        existing.set('Approved', String(record.approved || ''));
        existing.set('Goal', String(record.goal || ''));
        existing.set('Referrals', String(record.referrals || ''));
        existing.set('Agents', String(record.agents || ''));
        existing.set('Present', String(record.present || ''));
        existing.set('HomeShow', String(record.homeShow || ''));
        existing.set('lastUpdated', now);
        await existing.save();
      } else {
        await sheet.addRow({
          meetingDate: record.meetingDate,
          repName: record.repName,
          Inspected: String(record.inspected || ''),
          Damage: String(record.damage || ''),
          Signed: String(record.signed || ''),
          Repair: String(record.repair || ''),
          Gutter: String(record.gutter || ''),
          Revenue_Estimated: String(record.revenue || ''),
          Approved: String(record.approved || ''),
          Goal: String(record.goal || ''),
          Referrals: String(record.referrals || ''),
          Agents: String(record.agents || ''),
          Present: String(record.present || ''),
          HomeShow: String(record.homeShow || ''),
          tabName: record.tabName || '',
          lastUpdated: now,
        });
      }

      return true;
    } catch (error) {
      console.error('Error upserting meeting number:', error);
      return false;
    }
  }

  // =========================================================================
  // MEETING PREP
  // =========================================================================

  private readonly meetingPrepHeaders = [
    'meetingDate', 'id', 'bibleVerseRef', 'bibleVerseText', 'bibleVerseTheme', 'useRandomVerse',
    'announcementsPart1', 'announcementsPart2', 'employeeName', 'employeeDept', 'employeeReason',
    'trainingTopic', 'salesNotes', 'operationsNotes', 'officeNotes', 'driversNotes',
    'specialNotes', 'preparedBy', 'status', 'weatherData', 'createdAt', 'updatedAt',
  ];

  async getMeetingPrep(meetingDate: string): Promise<Record<string, string> | null> {
    const ready = await this.init();
    if (!ready || !this.doc) return null;

    try {
      const sheet = await this.getOrCreateSheet(
        SHEET_NAMES.MEETING_PREP,
        this.meetingPrepHeaders
      );

      const rows = await sheet.getRows();
      const row = rows.find(r => r.get('meetingDate') === meetingDate);

      if (!row) return null;

      const record: Record<string, string> = {};
      for (const h of this.meetingPrepHeaders) {
        record[h] = row.get(h) || '';
      }
      return record;
    } catch (error) {
      console.error('Error fetching meeting prep:', error);
      return null;
    }
  }

  async saveMeetingPrep(data: Record<string, string>): Promise<boolean> {
    const ready = await this.init();
    if (!ready || !this.doc) return false;

    try {
      const sheet = await this.getOrCreateSheet(
        SHEET_NAMES.MEETING_PREP,
        this.meetingPrepHeaders
      );

      const rows = await sheet.getRows();
      const existing = rows.find(r => r.get('meetingDate') === data.meetingDate);

      if (existing) {
        for (const key of this.meetingPrepHeaders) {
          if (data[key] !== undefined) {
            existing.set(key, data[key]);
          }
        }
        existing.set('updatedAt', new Date().toISOString());
        await existing.save();
      } else {
        const now = new Date().toISOString();
        await sheet.addRow({
          ...data,
          createdAt: data.createdAt || now,
          updatedAt: now,
        } as unknown as Record<string, string | number | boolean>);
      }

      return true;
    } catch (error) {
      console.error('Error saving meeting prep:', error);
      return false;
    }
  }

  async listMeetingPreps(options?: { year?: number; limit?: number }): Promise<Record<string, string>[]> {
    const ready = await this.init();
    if (!ready || !this.doc) return [];

    try {
      const sheet = await this.getOrCreateSheet(
        SHEET_NAMES.MEETING_PREP,
        this.meetingPrepHeaders
      );

      const rows = await sheet.getRows();
      let records = rows.map(row => {
        const record: Record<string, string> = {};
        for (const h of this.meetingPrepHeaders) {
          record[h] = row.get(h) || '';
        }
        return record;
      });

      // Filter by year if specified
      if (options?.year) {
        const yearStr = String(options.year);
        records = records.filter(r => r.meetingDate && r.meetingDate.startsWith(yearStr));
      }

      // Sort by meetingDate descending
      records.sort((a, b) => (b.meetingDate || '').localeCompare(a.meetingDate || ''));

      // Apply limit
      if (options?.limit && options.limit > 0) {
        records = records.slice(0, options.limit);
      }

      return records;
    } catch (error) {
      console.error('Error listing meeting preps:', error);
      return [];
    }
  }

  // ===========================================================================
  // NUMBER SESSIONS
  // ===========================================================================

  private readonly numberSessionHeaders = [
    'id', 'week', 'repName', 'repEmail', 'sessionTimestamp',
    'inspected', 'damage', 'signed', 'repair', 'gutter',
    'revenue', 'approved', 'goal', 'referrals', 'agents',
    'present', 'homeShow', 'action', 'previousValues',
  ];

  /**
   * Append a single session row to the NumberSessions tab.
   */
  async appendNumberSession(session: {
    id: string;
    week: string;
    repName: string;
    repEmail: string;
    sessionTimestamp: string;
    inspected: number;
    damage: number;
    signed: number;
    repair: number;
    gutter: number;
    revenue: number;
    approved: number;
    goal: number;
    referrals: number;
    agents: number;
    present: string;
    homeShow: number;
    action: 'create' | 'update' | 'increment';
    previousValues: string; // JSON string
  }): Promise<boolean> {
    const ready = await this.init();
    if (!ready || !this.doc) return false;

    try {
      const sheet = await this.getOrCreateSheet(SHEET_NAMES.NUMBER_SESSIONS, this.numberSessionHeaders);

      await sheet.addRow({
        id: session.id,
        week: session.week,
        repName: session.repName,
        repEmail: session.repEmail,
        sessionTimestamp: session.sessionTimestamp,
        inspected: String(session.inspected),
        damage: String(session.damage),
        signed: String(session.signed),
        repair: String(session.repair),
        gutter: String(session.gutter),
        revenue: String(session.revenue),
        approved: String(session.approved),
        goal: String(session.goal),
        referrals: String(session.referrals),
        agents: String(session.agents),
        present: session.present,
        homeShow: String(session.homeShow),
        action: session.action,
        previousValues: session.previousValues,
      });

      return true;
    } catch (error) {
      console.error('Error appending number session:', error);
      return false;
    }
  }

  /**
   * Read number sessions from the NumberSessions tab.
   */
  async getNumberSessions(options?: {
    repEmail?: string;
    week?: string;
    limit?: number;
  }): Promise<Record<string, string>[]> {
    const ready = await this.init();
    if (!ready || !this.doc) return [];

    try {
      const sheet = await this.getOrCreateSheet(SHEET_NAMES.NUMBER_SESSIONS, this.numberSessionHeaders);
      const rows = await sheet.getRows();

      let records = rows.map(row => {
        const record: Record<string, string> = {};
        for (const h of this.numberSessionHeaders) {
          record[h] = row.get(h) || '';
        }
        return record;
      });

      if (options?.repEmail) {
        records = records.filter(r => r.repEmail === options.repEmail);
      }
      if (options?.week) {
        records = records.filter(r => r.week === options.week);
      }

      // Sort by sessionTimestamp descending
      records.sort((a, b) => (b.sessionTimestamp || '').localeCompare(a.sessionTimestamp || ''));

      if (options?.limit && options.limit > 0) {
        records = records.slice(0, options.limit);
      }

      return records;
    } catch (error) {
      console.error('Error reading number sessions:', error);
      return [];
    }
  }

  /**
   * Delete a number session row by id.
   */
  async deleteNumberSession(id: string): Promise<boolean> {
    const ready = await this.init();
    if (!ready || !this.doc) return false;

    try {
      const sheet = await this.getOrCreateSheet(SHEET_NAMES.NUMBER_SESSIONS, this.numberSessionHeaders);
      const rows = await sheet.getRows();

      const row = rows.find(r => r.get('id') === id);
      if (row) {
        await row.delete();
        return true;
      }

      return false;
    } catch (error) {
      console.error('Error deleting number session:', error);
      return false;
    }
  }

  // ===========================================================================
  // GENERIC TAB CRUD (persistence migration 2026-04-09)
  // ===========================================================================
  //
  // These six methods let any service or route persist domain data to a tab on
  // the master sheet without growing this file by hundreds of typed methods.
  // The new tabs declared in SHEET_NAMES (Gamification, Inventory_Transactions,
  // Blog_Posts, etc.) are all read/written through these helpers.
  //
  // Conventions:
  // - Callers own the schema: pass the same `headers` array on every call so
  //   getOrCreateSheet creates the tab with the right columns the first time.
  // - All values are stringified before writing — Sheets stores everything as
  //   strings anyway, and this avoids "[object Object]" surprises.
  // - `idField` is the column whose value is the row's primary key (e.g.
  //   "txId", "postId", "userId"). Used by upsert/update/delete.
  // - Reads return Record<string, string> arrays. Callers parse numbers /
  //   booleans / JSON blobs themselves at the call site, mirroring the typed
  //   methods above.

  /**
   * Read every row from a tab as a string-map. Creates the tab if missing so
   * a first read on a brand-new install doesn't fail — it just returns [].
   */
  async getGenericRows(
    tabName: string,
    headers: string[],
  ): Promise<Record<string, string>[]> {
    const ready = await this.init();
    if (!ready || !this.doc) return [];

    try {
      const sheet = await this.getOrCreateSheet(tabName, headers);
      const rows = await sheet.getRows();
      return rows.map((row) => {
        const obj: Record<string, string> = {};
        for (const h of headers) {
          const v = row.get(h);
          obj[h] = v !== undefined && v !== null ? String(v) : '';
        }
        return obj;
      });
    } catch (error) {
      console.error(`Error fetching rows from "${tabName}":`, error);
      return [];
    }
  }

  /** Coerce any value to a sheet-safe string. */
  private toCellValue(value: unknown): string {
    if (value === null || value === undefined) return '';
    if (typeof value === 'string') return value;
    if (typeof value === 'number' || typeof value === 'boolean') return String(value);
    if (value instanceof Date) return value.toISOString();
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }

  private toRow(headers: string[], data: Record<string, unknown>): Record<string, string> {
    const out: Record<string, string> = {};
    for (const h of headers) {
      out[h] = this.toCellValue(data[h]);
    }
    return out;
  }

  /**
   * Append a row. Use when the row is definitely new — for upserts (insert or
   * update by primary key) call upsertGenericRow instead.
   */
  async appendGenericRow(
    tabName: string,
    headers: string[],
    data: Record<string, unknown>,
  ): Promise<boolean> {
    const ready = await this.init();
    if (!ready || !this.doc) return false;

    try {
      const sheet = await this.getOrCreateSheet(tabName, headers);
      await sheet.addRow(this.toRow(headers, data));
      return true;
    } catch (error) {
      console.error(`Error appending row to "${tabName}":`, error);
      return false;
    }
  }

  /**
   * Update an existing row in-place by primary key. Returns false when no row
   * matches — caller can decide whether to fall back to append.
   */
  async updateGenericRow(
    tabName: string,
    headers: string[],
    idField: string,
    idValue: string,
    updates: Record<string, unknown>,
  ): Promise<boolean> {
    const ready = await this.init();
    if (!ready || !this.doc) return false;

    try {
      const sheet = await this.getOrCreateSheet(tabName, headers);
      const rows = await sheet.getRows();
      const row = rows.find((r) => String(r.get(idField) || '') === idValue);
      if (!row) return false;

      for (const [k, v] of Object.entries(updates)) {
        if (headers.includes(k)) {
          row.set(k, this.toCellValue(v));
        }
      }
      await row.save();
      return true;
    } catch (error) {
      console.error(`Error updating row in "${tabName}" (${idField}=${idValue}):`, error);
      return false;
    }
  }

  /**
   * Insert-or-update by primary key. The most common write pattern for the
   * migrated services — they don't care whether a row exists yet, they just
   * want the latest state persisted.
   */
  async upsertGenericRow(
    tabName: string,
    headers: string[],
    idField: string,
    data: Record<string, unknown>,
  ): Promise<boolean> {
    // Serialize per-tab so concurrent calls can't race past each other's
    // existence check and create duplicates. After write, sweep for any
    // duplicate rows by idField (covers cross-container races).
    return this.serializeTabWrite(tabName, async () => {
      const ready = await this.init();
      if (!ready || !this.doc) return false;

      try {
        const sheet = await this.getOrCreateSheet(tabName, headers);
        const rows = await sheet.getRows();
        const idValue = String(data[idField] ?? '');
        if (!idValue) {
          console.warn(`upsertGenericRow("${tabName}"): missing ${idField}`);
          return false;
        }
        const matches = rows.filter(r => String(r.get(idField) || '') === idValue);

        if (matches.length > 0) {
          // Update the first match
          const existing = matches[0];
          for (const h of headers) {
            if (h in data) {
              existing.set(h, this.toCellValue(data[h]));
            }
          }
          await existing.save();
          // Delete extras (cross-container race cleanup)
          for (let i = 1; i < matches.length; i++) {
            try {
              await matches[i].delete();
            } catch (err) {
              console.warn(`upsertGenericRow("${tabName}"): failed to dedupe row for ${idField}=${idValue}:`, err);
            }
          }
        } else {
          await sheet.addRow(this.toRow(headers, data));
        }
        return true;
      } catch (error) {
        console.error(`Error upserting row in "${tabName}":`, error);
        return false;
      }
    });
  }

  /**
   * Delete a row by primary key. Returns true if a row was actually removed.
   */
  async deleteGenericRow(
    tabName: string,
    idField: string,
    idValue: string,
  ): Promise<boolean> {
    const ready = await this.init();
    if (!ready || !this.doc) return false;

    try {
      const sheet = this.doc.sheetsByTitle[tabName];
      if (!sheet) return false;
      const rows = await sheet.getRows();
      const row = rows.find((r) => String(r.get(idField) || '') === idValue);
      if (!row) return false;
      await row.delete();
      return true;
    } catch (error) {
      console.error(`Error deleting row from "${tabName}" (${idField}=${idValue}):`, error);
      return false;
    }
  }

  /**
   * Replace the entire contents of a tab with `rows`. Used by services that
   * keep an in-memory list and want to flush the whole list to the sheet
   * (e.g. config-shaped data that's small and fully owned by one writer).
   *
   * NOTE: this clears every row except the header. Don't use it for tabs that
   * other services or humans also write to — use upsertGenericRow instead.
   */
  async replaceAllGenericRows(
    tabName: string,
    headers: string[],
    rows: Record<string, unknown>[],
  ): Promise<boolean> {
    const ready = await this.init();
    if (!ready || !this.doc) return false;

    try {
      const sheet = await this.getOrCreateSheet(tabName, headers);
      // Clear everything below the header row.
      const existing = await sheet.getRows();
      for (const r of existing) {
        await r.delete();
      }
      // Re-add. Batched in chunks of 100 to stay under the API's row limit.
      const CHUNK = 100;
      for (let i = 0; i < rows.length; i += CHUNK) {
        const chunk = rows.slice(i, i + CHUNK).map((r) => this.toRow(headers, r));
        await sheet.addRows(chunk);
      }
      return true;
    } catch (error) {
      console.error(`Error replacing rows in "${tabName}":`, error);
      return false;
    }
  }
}

// =============================================================================
// SANDBOX MODE WRAPPER
// =============================================================================

import { isSandboxMode, sandboxLog } from './sandbox-config';
import {
  getSandboxInventory,
  getSandboxCommissions,
  getSandboxCustomers,
  getSandboxOrders,
  getSandboxWeeklyNumbers,
  getSandboxReviews,
  getSandboxAuditLog,
  addSandboxAuditEntry,
  getSandboxMeetingPrep,
  getSandboxTrainingProgress,
} from './sandbox-data';

const _realService = new GoogleSheetsService();

/** Sandbox-aware proxy: returns mock data when SANDBOX_MODE is active */
const sandboxProxy = new Proxy(_realService, {
  get(target, prop: string) {
    const original = (target as unknown as Record<string, unknown>)[prop];

    // Always pass through non-functions and sandbox-irrelevant methods
    if (typeof original !== 'function') return original;

    // In production mode, use real service
    if (!isSandboxMode()) return original.bind(target);

    // Sandbox interceptors for READ operations
    const mockHandlers: Record<string, (...args: unknown[]) => unknown> = {
      init: async () => { sandboxLog('GoogleSheets', 'init', '(sandbox skip)'); return true; },
      getInventory: async () => { sandboxLog('GoogleSheets', 'getInventory'); return getSandboxInventory(); },
      getCommissions: async () => { sandboxLog('GoogleSheets', 'getCommissions'); return getSandboxCommissions(); },
      getCommissionSummaries: async () => { sandboxLog('GoogleSheets', 'getCommissionSummaries'); return getSandboxCommissions(); },
      getCustomers: async () => { sandboxLog('GoogleSheets', 'getCustomers'); return getSandboxCustomers(); },
      getOrders: async () => { sandboxLog('GoogleSheets', 'getOrders'); return getSandboxOrders(); },
      getRepWeeklyNumbers: async () => { sandboxLog('GoogleSheets', 'getRepWeeklyNumbers'); return getSandboxWeeklyNumbers(); },
      getReviews: async () => { sandboxLog('GoogleSheets', 'getReviews'); return getSandboxReviews(); },
      getAuditLog: async () => { sandboxLog('GoogleSheets', 'getAuditLog'); return getSandboxAuditLog(); },
      getMeetingPreps: async () => { sandboxLog('GoogleSheets', 'getMeetingPreps'); return [getSandboxMeetingPrep()]; },
      getTrainingProgress: async () => { sandboxLog('GoogleSheets', 'getTrainingProgress'); return getSandboxTrainingProgress(); },
      getNumberSessions: async () => { sandboxLog('GoogleSheets', 'getNumberSessions'); return []; },
      getTeamMembers: async () => { sandboxLog('GoogleSheets', 'getTeamMembers'); return []; },
      getTeamAccessOverrides: async () => { sandboxLog('GoogleSheets', 'getTeamAccessOverrides'); return []; },
      getAgents: async () => { sandboxLog('GoogleSheets', 'getAgents'); return []; },
      getAgentVisits: async () => { sandboxLog('GoogleSheets', 'getAgentVisits'); return []; },
      getGeocodedContacts: async () => { sandboxLog('GoogleSheets', 'getGeocodedContacts'); return []; },
      getDistributionLogs: async () => { sandboxLog('GoogleSheets', 'getDistributionLogs'); return []; },
      getRepAvailability: async () => { sandboxLog('GoogleSheets', 'getRepAvailability'); return []; },
      getRepPreferences: async () => { sandboxLog('GoogleSheets', 'getRepPreferences'); return []; },
      getLeadResponseLogs: async () => { sandboxLog('GoogleSheets', 'getLeadResponseLogs'); return []; },
      getJobBreakdowns: async () => { sandboxLog('GoogleSheets', 'getJobBreakdowns'); return []; },
      // Generic read added 2026-04-09 for the persistence migration:
      getGenericRows: async (...args: unknown[]) => {
        sandboxLog('GoogleSheets', 'getGenericRows', args[0]);
        return [];
      },
    };

    if (mockHandlers[prop]) return mockHandlers[prop];

    // Sandbox interceptors for WRITE operations — log but don't execute
    const writeOps = [
      'updateTeamMember', 'deleteTeamMember',
      'updateInventoryItem', 'deleteInventoryItem', 'syncInventoryFromJson',
      'addCommissionEntry', 'importCommissionsFromCsv',
      'updateCustomer', 'deleteCustomer',
      'updateOrder',
      'addRepWeeklyNumbers', 'updateRepWeeklyNumbers',
      'addGeocodedContact', 'addGeocodedContactsBatch',
      'addDistributionLog',
      'updateRepAvailability', 'updateRepPreferences',
      'addLeadResponseLog', 'updateLeadResponseLog',
      'addJobBreakdown', 'updateJobBreakdown',
      'saveTeamAccessOverride', 'deleteTeamAccessOverride',
      'saveAgent', 'logAgentVisit',
      'logTrainingProgress',
      'triggerFullSync',
      'saveMeetingPrep', 'updateMeetingPrep',
      'appendNumberSession', 'deleteNumberSession',
      // Generic CRUD added 2026-04-09 for the persistence migration:
      'appendGenericRow', 'updateGenericRow', 'upsertGenericRow',
      'deleteGenericRow', 'replaceAllGenericRows',
    ];

    if (writeOps.includes(prop)) {
      return async (...args: unknown[]) => {
        sandboxLog('GoogleSheets', prop, '(write intercepted)', args[0]);
        // For audit log, store in memory
        if (prop === 'appendToAuditLog' || prop === 'logAuditEntry') {
          addSandboxAuditEntry(args[0] as Record<string, string>);
        }
        return { success: true, added: 1, updated: 0, errors: 0 };
      };
    }

    // Catch-all for audit log
    if (prop === 'appendToAuditLog') {
      return async (...args: unknown[]) => {
        sandboxLog('GoogleSheets', 'appendToAuditLog', args[0]);
        addSandboxAuditEntry(args[0] as Record<string, string>);
        return true;
      };
    }

    // Anything else — pass through but log
    return (...args: unknown[]) => {
      sandboxLog('GoogleSheets', prop, '(passthrough)');
      return (original as Function).apply(target, args);
    };
  },
});

export const googleSheetsService = sandboxProxy;