// Lead Portal Service
// Manages customer portal records in Google Sheets

import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';
import { CustomerPortalAccess } from './customer-portal-service';

const SHEETS_ID = process.env.DELIVERY_SHEETS_ID || process.env.GOOGLE_SHEETS_ID;

const serviceAccountAuth = new JWT({
  email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
  key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

export interface LeadRecord {
  // Identifiers
  leadId: string;
  customerId: string;
  accessToken: string;
  shortCode: string;

  // Customer info
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  customerAddress: string;

  // Sales rep assignment
  salesRepId: string;
  salesRepName: string;
  salesRepSlug: string;

  // Source tracking
  source: string;
  sourceDetails?: string;
  serviceType?: string;
  message?: string;

  // Integration
  jobnimbusId?: string;
  jobnimbusContactId?: string;

  // Status tracking
  status: 'new' | 'contacted' | 'inspection_scheduled' | 'estimate_sent' | 'closed_won' | 'closed_lost';
  portalViews: number;
  lastPortalView?: string;

  // Notification tracking
  introEmailSent: boolean;
  introEmailSentAt?: string;
  portalEmailSent: boolean;
  portalEmailSentAt?: string;
  introSmsSent: boolean;
  introSmsSentAt?: string;
  portalSmsSent: boolean;
  portalSmsSentAt?: string;

  // Timestamps
  createdAt: string;
  updatedAt?: string;

  // Activity log (JSON string)
  activityLog?: string;
}

export interface LeadActivity {
  timestamp: string;
  action: string;
  details?: string;
  performedBy?: string;
}

const LEAD_HEADERS = [
  'leadId',
  'customerId',
  'accessToken',
  'shortCode',
  'customerName',
  'customerEmail',
  'customerPhone',
  'customerAddress',
  'salesRepId',
  'salesRepName',
  'salesRepSlug',
  'source',
  'sourceDetails',
  'serviceType',
  'message',
  'jobnimbusId',
  'jobnimbusContactId',
  'status',
  'portalViews',
  'lastPortalView',
  'introEmailSent',
  'introEmailSentAt',
  'portalEmailSent',
  'portalEmailSentAt',
  'introSmsSent',
  'introSmsSentAt',
  'portalSmsSent',
  'portalSmsSentAt',
  'createdAt',
  'updatedAt',
  'activityLog',
];

// =============================================================================
// Customer Service Requests (submitted from /customer portal)
// =============================================================================
export interface ServiceRequestRecord {
  id: string;
  customerId: string;
  customerName: string;
  customerAddress: string;
  customerPhone: string;
  customerEmail: string;
  repSlug: string;
  repName: string;
  type: 'maintenance' | 'repair' | 'inspection' | 'other';
  description: string;
  preferredDate: string;
  urgency: 'low' | 'medium' | 'high' | 'emergency';
  photos: string;
  status: 'submitted' | 'reviewed' | 'scheduled' | 'in_progress' | 'completed' | 'cancelled';
  assignedTo?: string;
  scheduledDate?: string;
  resolution?: string;
  createdAt: string;
  updatedAt: string;
}

const SERVICE_REQUEST_HEADERS = [
  'id',
  'customerId',
  'customerName',
  'customerAddress',
  'customerPhone',
  'customerEmail',
  'repSlug',
  'repName',
  'type',
  'description',
  'preferredDate',
  'urgency',
  'photos',
  'status',
  'assignedTo',
  'scheduledDate',
  'resolution',
  'createdAt',
  'updatedAt',
];

// =============================================================================
// Customer Notification Preferences
// =============================================================================
export interface NotificationPrefsRecord {
  customerId: string;
  emailNotifications: boolean;
  smsNotifications: boolean;
  weatherAlerts: boolean;
  statusUpdates: boolean;
  updatedAt: string;
}

const NOTIFICATION_PREFS_HEADERS = [
  'customerId',
  'emailNotifications',
  'smsNotifications',
  'weatherAlerts',
  'statusUpdates',
  'updatedAt',
];

// =============================================================================
// Customer Warranty Claims (Sheets-backed log of customer-submitted claims)
// =============================================================================
export interface WarrantyClaimRecord {
  id: string;
  warrantyId: string;
  customerId: string;
  customerName: string;
  customerAddress: string;
  customerPhone: string;
  customerEmail: string;
  repSlug: string;
  repName: string;
  jobId: string;
  category: 'leak' | 'shingle_damage' | 'flashing' | 'gutter' | 'ventilation' | 'other';
  severity: 'minor' | 'moderate' | 'major' | 'emergency';
  issueDescription: string;
  photos: string;
  status: 'submitted' | 'under_review' | 'approved' | 'denied' | 'completed';
  resolution?: string;
  repairDate?: string;
  coveredByWarranty?: boolean;
  createdAt: string;
  updatedAt: string;
}

const WARRANTY_CLAIM_HEADERS = [
  'id',
  'warrantyId',
  'customerId',
  'customerName',
  'customerAddress',
  'customerPhone',
  'customerEmail',
  'repSlug',
  'repName',
  'jobId',
  'category',
  'severity',
  'issueDescription',
  'photos',
  'status',
  'resolution',
  'repairDate',
  'coveredByWarranty',
  'createdAt',
  'updatedAt',
];

class LeadPortalService {
  private doc: GoogleSpreadsheet | null = null;
  private initialized = false;

  private async getDoc(): Promise<GoogleSpreadsheet> {
    if (!this.doc) {
      if (!SHEETS_ID) {
        throw new Error('Google Sheets ID not configured');
      }
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
      sheet = await doc.addSheet({ title: name, headerValues: headers, gridProperties: { columnCount: Math.max(headers.length + 5, 26) } });
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

  private generateLeadId(): string {
    const date = new Date();
    const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
    const random = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `LEAD-${dateStr}-${random}`;
  }

  // Create a new lead record
  async createLead(data: {
    portalAccess: CustomerPortalAccess;
    shortCode: string;
    source: LeadRecord['source'];
    sourceDetails?: string;
    serviceType?: string;
    message?: string;
    jobnimbusId?: string;
    jobnimbusContactId?: string;
  }): Promise<LeadRecord> {
    const sheet = await this.getOrCreateSheet('Customer Leads', LEAD_HEADERS);

    const leadId = this.generateLeadId();
    const now = new Date().toISOString();

    const initialActivity: LeadActivity[] = [{
      timestamp: now,
      action: 'LEAD_CREATED',
      details: `Lead created from ${data.source}`,
    }];

    const lead: LeadRecord = {
      leadId,
      customerId: data.portalAccess.customerId,
      accessToken: data.portalAccess.accessToken,
      shortCode: data.shortCode,
      customerName: data.portalAccess.customerName,
      customerEmail: data.portalAccess.customerEmail,
      customerPhone: data.portalAccess.customerPhone,
      customerAddress: data.portalAccess.customerAddress,
      salesRepId: data.portalAccess.salesRepId,
      salesRepName: data.portalAccess.salesRepName,
      salesRepSlug: data.portalAccess.salesRepSlug,
      source: data.source,
      sourceDetails: data.sourceDetails,
      serviceType: data.serviceType,
      message: data.message,
      jobnimbusId: data.jobnimbusId,
      jobnimbusContactId: data.jobnimbusContactId,
      status: 'new',
      portalViews: 0,
      introEmailSent: false,
      portalEmailSent: false,
      introSmsSent: false,
      portalSmsSent: false,
      createdAt: now,
      activityLog: JSON.stringify(initialActivity),
    };

    await sheet.addRow(lead as unknown as Record<string, string | number | boolean>);

    return lead;
  }

  // Get lead by access token
  // Get lead by lead ID
  async getLeadById(leadId: string): Promise<LeadRecord | null> {
    const sheet = await this.getOrCreateSheet('Customer Leads', LEAD_HEADERS);
    const rows = await sheet.getRows({ limit: 100000 });
    const row = rows.find(r => r.get('leadId') === leadId);

    if (!row) return null;

    return this.rowToLead(row);
  }

  async getLeadByToken(accessToken: string): Promise<LeadRecord | null> {
    const sheet = await this.getOrCreateSheet('Customer Leads', LEAD_HEADERS);
    const rows = await sheet.getRows({ limit: 100000 });
    const row = rows.find(r => r.get('accessToken') === accessToken);

    if (!row) return null;

    return this.rowToLead(row);
  }

  // Get lead by short code
  async getLeadByShortCode(shortCode: string): Promise<LeadRecord | null> {
    const sheet = await this.getOrCreateSheet('Customer Leads', LEAD_HEADERS);
    const rows = await sheet.getRows({ limit: 100000 });
    const row = rows.find(r => r.get('shortCode') === shortCode);

    if (!row) return null;

    return this.rowToLead(row);
  }

  // Get lead by customer ID
  async getLeadByCustomerId(customerId: string): Promise<LeadRecord | null> {
    const sheet = await this.getOrCreateSheet('Customer Leads', LEAD_HEADERS);
    const rows = await sheet.getRows({ limit: 100000 });
    const row = rows.find(r => r.get('customerId') === customerId);

    if (!row) return null;

    return this.rowToLead(row);
  }

  // Get lead by email
  async getLeadByEmail(email: string): Promise<LeadRecord | null> {
    const sheet = await this.getOrCreateSheet('Customer Leads', LEAD_HEADERS);
    const rows = await sheet.getRows({ limit: 100000 });
    const row = rows.find(r =>
      r.get('customerEmail')?.toLowerCase() === email.toLowerCase()
    );

    if (!row) return null;

    return this.rowToLead(row);
  }

  // Get lead by address (normalized comparison)
  async getLeadByAddress(address: string): Promise<LeadRecord | null> {
    const sheet = await this.getOrCreateSheet('Customer Leads', LEAD_HEADERS);
    const rows = await sheet.getRows({ limit: 100000 });

    const normalize = (addr: string) =>
      (addr || '').toLowerCase().replace(/[.,#]/g, '').replace(/\s+/g, ' ').trim();

    const normalizedInput = normalize(address);
    if (!normalizedInput) return null;

    const row = rows.find(r => {
      const rowAddr = normalize(r.get('customerAddress') || '');
      return rowAddr === normalizedInput;
    });

    if (!row) return null;
    return this.rowToLead(row);
  }

  // Get lead by name + address combination
  async getLeadByNameAndAddress(name: string, address: string): Promise<LeadRecord | null> {
    const sheet = await this.getOrCreateSheet('Customer Leads', LEAD_HEADERS);
    const rows = await sheet.getRows({ limit: 100000 });

    const normalize = (str: string) =>
      (str || '').toLowerCase().replace(/[.,#]/g, '').replace(/\s+/g, ' ').trim();

    const normalizedName = normalize(name);
    const normalizedAddr = normalize(address);
    if (!normalizedName || !normalizedAddr) return null;

    const row = rows.find(r => {
      const rowName = normalize(r.get('customerName') || '');
      const rowAddr = normalize(r.get('customerAddress') || '');
      return rowName === normalizedName && rowAddr === normalizedAddr;
    });

    if (!row) return null;
    return this.rowToLead(row);
  }

  // Comprehensive duplicate detection across all identifiers (Sheets + JobNimbus)
  async findDuplicate(params: {
    email?: string;
    phone?: string;
    name?: string;
    address?: string;
  }): Promise<{ found: boolean; lead: LeadRecord | null; matchedBy: string; jnMatch?: { jnid: string; displayName: string } }> {
    // Check email first (strongest match)
    if (params.email) {
      const byEmail = await this.getLeadByEmail(params.email);
      if (byEmail) return { found: true, lead: byEmail, matchedBy: 'email' };
    }

    // Check phone
    if (params.phone) {
      const sheet = await this.getOrCreateSheet('Customer Leads', LEAD_HEADERS);
      const rows = await sheet.getRows({ limit: 100000 });
      const normalizePhone = (ph: string) => (ph || '').replace(/\D/g, '');
      const inputPhone = normalizePhone(params.phone);
      if (inputPhone.length >= 10) {
        const row = rows.find(r => {
          const rowPhone = normalizePhone(r.get('customerPhone') || '');
          return rowPhone === inputPhone || rowPhone.endsWith(inputPhone.slice(-10));
        });
        if (row) return { found: true, lead: this.rowToLead(row), matchedBy: 'phone' };
      }
    }

    // Check name + address combination
    if (params.name && params.address) {
      const byNameAddr = await this.getLeadByNameAndAddress(params.name, params.address);
      if (byNameAddr) return { found: true, lead: byNameAddr, matchedBy: 'name+address' };
    }

    // Check address only (same property)
    if (params.address) {
      const byAddr = await this.getLeadByAddress(params.address);
      if (byAddr) return { found: true, lead: byAddr, matchedBy: 'address' };
    }

    // Check JobNimbus for existing customer (if configured).
    // Internal dedup lookup — we only read jnid + display name, so an
    // owner-tier viewer is safe (no cost data is returned to the caller).
    try {
      const { jobNimbusService, isJobNimbusConfigured } = await import('./jobnimbus-service');
      const dedupViewer = { canSeeCost: true };
      if (isJobNimbusConfigured()) {
        // Search by email in JN
        if (params.email) {
          const jnByEmail = await jobNimbusService.searchContactByEmail(params.email, dedupViewer).catch(() => null);
          if (jnByEmail) {
            return {
              found: true,
              lead: null,
              matchedBy: 'jobnimbus_email',
              jnMatch: { jnid: jnByEmail.jnid, displayName: jobNimbusService.getContactName(jnByEmail) },
            };
          }
        }
        // Search by phone in JN
        if (params.phone) {
          const jnByPhone = await jobNimbusService.searchContactByPhone(params.phone, dedupViewer).catch(() => null);
          if (jnByPhone) {
            return {
              found: true,
              lead: null,
              matchedBy: 'jobnimbus_phone',
              jnMatch: { jnid: jnByPhone.jnid, displayName: jobNimbusService.getContactName(jnByPhone) },
            };
          }
        }
      }
    } catch {
      // JobNimbus not available, skip
    }

    return { found: false, lead: null, matchedBy: '' };
  }

  // Get leads by sales rep
  async getLeadsBySalesRep(salesRepSlug: string, limit?: number): Promise<LeadRecord[]> {
    const sheet = await this.getOrCreateSheet('Customer Leads', LEAD_HEADERS);
    const rows = await sheet.getRows({ limit: 100000 });

    let leads = rows
      .filter(r => r.get('salesRepSlug') === salesRepSlug)
      .map(r => this.rowToLead(r))
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    if (limit) {
      leads = leads.slice(0, limit);
    }

    return leads;
  }

  // Get all leads with optional filters
  async getLeads(filters?: {
    status?: LeadRecord['status'];
    source?: string;
    salesRepSlug?: string;
    fromDate?: string;
    toDate?: string;
    limit?: number;
  }): Promise<LeadRecord[]> {
    const sheet = await this.getOrCreateSheet('Customer Leads', LEAD_HEADERS);
    const rows = await sheet.getRows({ limit: 100000 });

    let leads = rows.map(r => this.rowToLead(r));

    if (filters) {
      if (filters.status) {
        leads = leads.filter(l => l.status === filters.status);
      }
      if (filters.source) {
        leads = leads.filter(l => l.source === filters.source);
      }
      if (filters.salesRepSlug) {
        leads = leads.filter(l => l.salesRepSlug === filters.salesRepSlug);
      }
      if (filters.fromDate) {
        leads = leads.filter(l => l.createdAt >= filters.fromDate!);
      }
      if (filters.toDate) {
        leads = leads.filter(l => l.createdAt <= filters.toDate!);
      }
    }

    leads.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    if (filters?.limit) {
      leads = leads.slice(0, filters.limit);
    }

    return leads;
  }

  // Update lead's JobNimbus contact ID
  async updateLeadJNContactId(leadId: string, jnContactId: string): Promise<boolean> {
    const sheet = await this.getOrCreateSheet('Customer Leads', LEAD_HEADERS);
    const rows = await sheet.getRows({ limit: 100000 });
    const row = rows.find(r => r.get('leadId') === leadId);

    if (!row) return false;

    row.set('jobnimbusContactId', jnContactId);
    row.set('updatedAt', new Date().toISOString());

    await this.addActivity(row, {
      timestamp: new Date().toISOString(),
      action: 'JN_CONTACT_LINKED',
      details: `JobNimbus contact ID: ${jnContactId}`,
    });

    await row.save();
    return true;
  }

  // Update lead status
  async updateLeadStatus(
    leadId: string,
    status: LeadRecord['status'],
    performedBy?: string
  ): Promise<boolean> {
    const sheet = await this.getOrCreateSheet('Customer Leads', LEAD_HEADERS);
    const rows = await sheet.getRows({ limit: 100000 });
    const row = rows.find(r => r.get('leadId') === leadId);

    if (!row) return false;

    const oldStatus = row.get('status');
    row.set('status', status);
    row.set('updatedAt', new Date().toISOString());

    // Add to activity log
    await this.addActivity(row, {
      timestamp: new Date().toISOString(),
      action: 'STATUS_CHANGE',
      details: `${oldStatus} -> ${status}`,
      performedBy,
    });

    await row.save();
    return true;
  }

  // Record portal view
  async recordPortalView(accessToken: string): Promise<boolean> {
    const sheet = await this.getOrCreateSheet('Customer Leads', LEAD_HEADERS);
    const rows = await sheet.getRows({ limit: 100000 });
    const row = rows.find(r => r.get('accessToken') === accessToken);

    if (!row) return false;

    const currentViews = parseInt(row.get('portalViews')) || 0;
    row.set('portalViews', String(currentViews + 1));
    row.set('lastPortalView', new Date().toISOString());

    await this.addActivity(row, {
      timestamp: new Date().toISOString(),
      action: 'PORTAL_VIEW',
      details: `View count: ${currentViews + 1}`,
    });

    await row.save();
    return true;
  }

  // Record notification sent
  async recordNotificationSent(
    leadId: string,
    type: 'intro_email' | 'portal_email' | 'intro_sms' | 'portal_sms'
  ): Promise<boolean> {
    const sheet = await this.getOrCreateSheet('Customer Leads', LEAD_HEADERS);
    const rows = await sheet.getRows({ limit: 100000 });
    const row = rows.find(r => r.get('leadId') === leadId);

    if (!row) return false;

    const now = new Date().toISOString();

    switch (type) {
      case 'intro_email':
        row.set('introEmailSent', 'true');
        row.set('introEmailSentAt', now);
        break;
      case 'portal_email':
        row.set('portalEmailSent', 'true');
        row.set('portalEmailSentAt', now);
        break;
      case 'intro_sms':
        row.set('introSmsSent', 'true');
        row.set('introSmsSentAt', now);
        break;
      case 'portal_sms':
        row.set('portalSmsSent', 'true');
        row.set('portalSmsSentAt', now);
        break;
    }

    row.set('updatedAt', now);

    await this.addActivity(row, {
      timestamp: now,
      action: 'NOTIFICATION_SENT',
      details: type.replace(/_/g, ' ').toUpperCase(),
    });

    await row.save();
    return true;
  }

  // Add activity to lead
  private async addActivity(row: { get(key: string): string; set(key: string, value: string): void }, activity: LeadActivity): Promise<void> {
    let activities: LeadActivity[] = [];
    try {
      activities = JSON.parse(row.get('activityLog') || '[]');
    } catch {}

    activities.push(activity);

    // Keep last 50 activities
    if (activities.length > 50) {
      activities = activities.slice(-50);
    }

    row.set('activityLog', JSON.stringify(activities));
  }

  // Convert row to lead record
  private rowToLead(row: { get(key: string): string }): LeadRecord {
    return {
      leadId: row.get('leadId'),
      customerId: row.get('customerId'),
      accessToken: row.get('accessToken'),
      shortCode: row.get('shortCode'),
      customerName: row.get('customerName'),
      customerEmail: row.get('customerEmail'),
      customerPhone: row.get('customerPhone'),
      customerAddress: row.get('customerAddress'),
      salesRepId: row.get('salesRepId'),
      salesRepName: row.get('salesRepName'),
      salesRepSlug: row.get('salesRepSlug'),
      source: row.get('source') as LeadRecord['source'],
      sourceDetails: row.get('sourceDetails'),
      serviceType: row.get('serviceType'),
      message: row.get('message'),
      jobnimbusId: row.get('jobnimbusId'),
      jobnimbusContactId: row.get('jobnimbusContactId'),
      status: row.get('status') as LeadRecord['status'],
      portalViews: parseInt(row.get('portalViews')) || 0,
      lastPortalView: row.get('lastPortalView'),
      introEmailSent: row.get('introEmailSent') === 'true',
      introEmailSentAt: row.get('introEmailSentAt'),
      portalEmailSent: row.get('portalEmailSent') === 'true',
      portalEmailSentAt: row.get('portalEmailSentAt'),
      introSmsSent: row.get('introSmsSent') === 'true',
      introSmsSentAt: row.get('introSmsSentAt'),
      portalSmsSent: row.get('portalSmsSent') === 'true',
      portalSmsSentAt: row.get('portalSmsSentAt'),
      createdAt: row.get('createdAt'),
      updatedAt: row.get('updatedAt'),
      activityLog: row.get('activityLog'),
    };
  }

  // Get activity log for a lead
  getActivityLog(lead: LeadRecord): LeadActivity[] {
    try {
      return JSON.parse(lead.activityLog || '[]');
    } catch {
      return [];
    }
  }

  // Get leads that need follow-up (haven't been contacted)
  async getLeadsNeedingFollowUp(olderThanMinutes: number = 30): Promise<LeadRecord[]> {
    const leads = await this.getLeads({ status: 'new' });
    const cutoffTime = new Date(Date.now() - olderThanMinutes * 60 * 1000).toISOString();

    return leads.filter(l =>
      l.createdAt < cutoffTime &&
      !l.introEmailSent &&
      !l.introSmsSent
    );
  }

  // Get lead statistics
  async getLeadStats(fromDate?: string, toDate?: string): Promise<{
    total: number;
    byStatus: Record<string, number>;
    bySource: Record<string, number>;
    bySalesRep: Record<string, number>;
    avgPortalViews: number;
  }> {
    const leads = await this.getLeads({ fromDate, toDate });

    const stats = {
      total: leads.length,
      byStatus: {} as Record<string, number>,
      bySource: {} as Record<string, number>,
      bySalesRep: {} as Record<string, number>,
      avgPortalViews: 0,
    };

    let totalViews = 0;

    leads.forEach(lead => {
      // By status
      stats.byStatus[lead.status] = (stats.byStatus[lead.status] || 0) + 1;

      // By source
      stats.bySource[lead.source] = (stats.bySource[lead.source] || 0) + 1;

      // By sales rep
      stats.bySalesRep[lead.salesRepName] = (stats.bySalesRep[lead.salesRepName] || 0) + 1;

      // Total views
      totalViews += lead.portalViews;
    });

    stats.avgPortalViews = leads.length > 0 ? totalViews / leads.length : 0;

    return stats;
  }

  // ===========================================================================
  // Service Requests
  // ===========================================================================

  async createServiceRequest(req: ServiceRequestRecord): Promise<void> {
    const sheet = await this.getOrCreateSheet('CustomerServiceRequests', SERVICE_REQUEST_HEADERS);
    await sheet.addRow(req as unknown as Record<string, string | number | boolean>);
  }

  async getServiceRequestsByCustomer(customerId: string): Promise<ServiceRequestRecord[]> {
    const sheet = await this.getOrCreateSheet('CustomerServiceRequests', SERVICE_REQUEST_HEADERS);
    const rows = await sheet.getRows({ limit: 100000 });
    return rows
      .filter(r => r.get('customerId') === customerId)
      .map(r => this.rowToServiceRequest(r))
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  private rowToServiceRequest(row: { get(key: string): string }): ServiceRequestRecord {
    return {
      id: row.get('id'),
      customerId: row.get('customerId'),
      customerName: row.get('customerName'),
      customerAddress: row.get('customerAddress'),
      customerPhone: row.get('customerPhone'),
      customerEmail: row.get('customerEmail'),
      repSlug: row.get('repSlug'),
      repName: row.get('repName'),
      type: (row.get('type') || 'other') as ServiceRequestRecord['type'],
      description: row.get('description'),
      preferredDate: row.get('preferredDate'),
      urgency: (row.get('urgency') || 'low') as ServiceRequestRecord['urgency'],
      photos: row.get('photos') || '',
      status: (row.get('status') || 'submitted') as ServiceRequestRecord['status'],
      assignedTo: row.get('assignedTo') || undefined,
      scheduledDate: row.get('scheduledDate') || undefined,
      resolution: row.get('resolution') || undefined,
      createdAt: row.get('createdAt'),
      updatedAt: row.get('updatedAt'),
    };
  }

  // ===========================================================================
  // Notification Preferences
  // ===========================================================================

  async getNotificationPrefs(customerId: string): Promise<NotificationPrefsRecord | null> {
    const sheet = await this.getOrCreateSheet('CustomerNotificationPrefs', NOTIFICATION_PREFS_HEADERS);
    const rows = await sheet.getRows({ limit: 100000 });
    const row = rows.find(r => r.get('customerId') === customerId);
    if (!row) return null;
    return {
      customerId: row.get('customerId'),
      emailNotifications: row.get('emailNotifications') !== 'false',
      smsNotifications: row.get('smsNotifications') !== 'false',
      weatherAlerts: row.get('weatherAlerts') !== 'false',
      statusUpdates: row.get('statusUpdates') !== 'false',
      updatedAt: row.get('updatedAt'),
    };
  }

  async upsertNotificationPrefs(prefs: NotificationPrefsRecord): Promise<void> {
    const sheet = await this.getOrCreateSheet('CustomerNotificationPrefs', NOTIFICATION_PREFS_HEADERS);
    const rows = await sheet.getRows({ limit: 100000 });
    const existing = rows.find(r => r.get('customerId') === prefs.customerId);
    const payload = {
      customerId: prefs.customerId,
      emailNotifications: String(prefs.emailNotifications),
      smsNotifications: String(prefs.smsNotifications),
      weatherAlerts: String(prefs.weatherAlerts),
      statusUpdates: String(prefs.statusUpdates),
      updatedAt: prefs.updatedAt,
    };
    if (existing) {
      Object.entries(payload).forEach(([k, v]) => existing.set(k, v));
      await existing.save();
    } else {
      await sheet.addRow(payload);
    }
  }

  // ===========================================================================
  // Warranty Claims (customer-submitted log persisted to Sheets)
  // ===========================================================================

  async createWarrantyClaim(claim: WarrantyClaimRecord): Promise<void> {
    const sheet = await this.getOrCreateSheet('CustomerWarrantyClaims', WARRANTY_CLAIM_HEADERS);
    const payload = {
      ...claim,
      coveredByWarranty: claim.coveredByWarranty === undefined ? '' : String(claim.coveredByWarranty),
    };
    await sheet.addRow(payload as unknown as Record<string, string | number | boolean>);
  }

  async getWarrantyClaimsByCustomer(customerId: string): Promise<WarrantyClaimRecord[]> {
    const sheet = await this.getOrCreateSheet('CustomerWarrantyClaims', WARRANTY_CLAIM_HEADERS);
    const rows = await sheet.getRows({ limit: 100000 });
    return rows
      .filter(r => r.get('customerId') === customerId)
      .map(r => this.rowToWarrantyClaim(r))
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  private rowToWarrantyClaim(row: { get(key: string): string }): WarrantyClaimRecord {
    const covered = row.get('coveredByWarranty');
    return {
      id: row.get('id'),
      warrantyId: row.get('warrantyId'),
      customerId: row.get('customerId'),
      customerName: row.get('customerName'),
      customerAddress: row.get('customerAddress'),
      customerPhone: row.get('customerPhone'),
      customerEmail: row.get('customerEmail'),
      repSlug: row.get('repSlug'),
      repName: row.get('repName'),
      jobId: row.get('jobId'),
      category: (row.get('category') || 'other') as WarrantyClaimRecord['category'],
      severity: (row.get('severity') || 'minor') as WarrantyClaimRecord['severity'],
      issueDescription: row.get('issueDescription'),
      photos: row.get('photos') || '',
      status: (row.get('status') || 'submitted') as WarrantyClaimRecord['status'],
      resolution: row.get('resolution') || undefined,
      repairDate: row.get('repairDate') || undefined,
      coveredByWarranty: covered === '' ? undefined : covered === 'true',
      createdAt: row.get('createdAt'),
      updatedAt: row.get('updatedAt'),
    };
  }
}

// Export singleton instance
export const leadPortalService = new LeadPortalService();
