import { GoogleSpreadsheet, GoogleSpreadsheetRow } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';

// Complete Job Record synced to Google Sheets
export interface JobRecord {
  jobId: string;
  jobNimbusId?: string; // For JobNimbus sync

  // Job Info
  jobName: string;
  jobType: 'residential' | 'commercial' | 'repair' | 'inspection' | 'other';
  jobStatus: 'lead' | 'estimate' | 'contract' | 'scheduled' | 'in_progress' | 'completed' | 'cancelled';

  // Customer Info
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  customerAddress: string;
  customerCity: string;
  customerState: string;
  customerZip: string;

  // Project Details
  projectManager: string;
  projectManagerId: string;
  salesRep?: string;
  contractAmount?: number;
  estimatedMaterialCost?: number;
  actualMaterialCost?: number;

  // Dates
  leadDate?: string;
  estimateDate?: string;
  contractDate?: string;
  scheduledStartDate?: string;
  actualStartDate?: string;
  completionDate?: string;

  // Materials & Deliveries
  totalDeliveries: number;
  totalPickups: number;
  totalReturns: number;
  totalMaterialCharged: number;
  totalMaterialCost: number;
  materialProfit: number;

  // Related IDs
  ticketIds: string[];
  billingIds: string[];
  invoiceIds: string[];
  photoIds: string[];

  // Tracking
  createdAt: string;
  updatedAt: string;
  syncedToJobNimbus?: string;
  lastJobNimbusSync?: string;

  // Notes
  notes: string;
}

export interface JobNimbusConfig {
  apiKey: string;
  baseUrl: string;
}

export interface SyncResult {
  success: boolean;
  jobId: string;
  jobNimbusId?: string;
  action: 'created' | 'updated' | 'skipped';
  message: string;
  timestamp: string;
}

class JobSyncService {
  private doc: GoogleSpreadsheet | null = null;
  private initialized = false;

  private async getDoc(): Promise<GoogleSpreadsheet> {
    if (this.doc && this.initialized) {
      return this.doc;
    }

    const serviceAccountEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
    const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n');
    const sheetId = process.env.GOOGLE_SHEET_ID || process.env.GOOGLE_SHEETS_ID;

    if (!serviceAccountEmail || !privateKey || !sheetId) {
      throw new Error('Missing Google Sheets credentials');
    }

    const jwt = new JWT({
      email: serviceAccountEmail,
      key: privateKey,
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    this.doc = new GoogleSpreadsheet(sheetId, jwt);
    await this.doc.loadInfo();
    this.initialized = true;

    return this.doc;
  }

  private async getOrCreateSheet(sheetName: string, headers: string[]) {
    const doc = await this.getDoc();
    let sheet = doc.sheetsByTitle[sheetName];
    if (!sheet) {
      sheet = await doc.addSheet({ title: sheetName, headerValues: headers, gridProperties: { columnCount: Math.max(headers.length + 5, 26) } });
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

  // ============ JOB RECORD MANAGEMENT ============

  async createOrUpdateJob(data: Partial<JobRecord> & { jobId: string }): Promise<JobRecord> {
    const sheet = await this.getOrCreateSheet('Jobs_Master', [
      'jobId', 'jobNimbusId', 'jobName', 'jobType', 'jobStatus',
      'customerName', 'customerPhone', 'customerEmail', 'customerAddress',
      'customerCity', 'customerState', 'customerZip',
      'projectManager', 'projectManagerId', 'salesRep',
      'contractAmount', 'estimatedMaterialCost', 'actualMaterialCost',
      'leadDate', 'estimateDate', 'contractDate', 'scheduledStartDate',
      'actualStartDate', 'completionDate',
      'totalDeliveries', 'totalPickups', 'totalReturns',
      'totalMaterialCharged', 'totalMaterialCost', 'materialProfit',
      'ticketIds', 'billingIds', 'invoiceIds', 'photoIds',
      'createdAt', 'updatedAt', 'syncedToJobNimbus', 'lastJobNimbusSync', 'notes'
    ]);

    const rows = await sheet.getRows();
    const existingRow = rows.find(r => r.get('jobId') === data.jobId);
    const now = new Date().toISOString();

    if (existingRow) {
      // Update existing job
      const updates: Record<string, string> = { updatedAt: now };

      Object.entries(data).forEach(([key, value]) => {
        if (value !== undefined && key !== 'jobId') {
          if (Array.isArray(value)) {
            updates[key] = JSON.stringify(value);
          } else if (typeof value === 'number') {
            updates[key] = value.toString();
          } else {
            updates[key] = value as string;
          }
        }
      });

      Object.entries(updates).forEach(([key, value]) => {
        existingRow.set(key, value);
      });

      await existingRow.save();
      return this.rowToJobRecord(existingRow);
    } else {
      // Create new job
      const newJob: JobRecord = {
        jobId: data.jobId,
        jobNimbusId: data.jobNimbusId,
        jobName: data.jobName || 'Untitled Job',
        jobType: data.jobType || 'residential',
        jobStatus: data.jobStatus || 'lead',
        customerName: data.customerName || '',
        customerPhone: data.customerPhone || '',
        customerEmail: data.customerEmail || '',
        customerAddress: data.customerAddress || '',
        customerCity: data.customerCity || '',
        customerState: data.customerState || 'AL',
        customerZip: data.customerZip || '',
        projectManager: data.projectManager || '',
        projectManagerId: data.projectManagerId || '',
        salesRep: data.salesRep,
        contractAmount: data.contractAmount,
        estimatedMaterialCost: data.estimatedMaterialCost,
        actualMaterialCost: data.actualMaterialCost,
        leadDate: data.leadDate,
        estimateDate: data.estimateDate,
        contractDate: data.contractDate,
        scheduledStartDate: data.scheduledStartDate,
        actualStartDate: data.actualStartDate,
        completionDate: data.completionDate,
        totalDeliveries: data.totalDeliveries || 0,
        totalPickups: data.totalPickups || 0,
        totalReturns: data.totalReturns || 0,
        totalMaterialCharged: data.totalMaterialCharged || 0,
        totalMaterialCost: data.totalMaterialCost || 0,
        materialProfit: data.materialProfit || 0,
        ticketIds: data.ticketIds || [],
        billingIds: data.billingIds || [],
        invoiceIds: data.invoiceIds || [],
        photoIds: data.photoIds || [],
        createdAt: now,
        updatedAt: now,
        notes: data.notes || ''
      };

      await sheet.addRow({
        ...newJob,
        contractAmount: newJob.contractAmount?.toString() || '',
        estimatedMaterialCost: newJob.estimatedMaterialCost?.toString() || '',
        actualMaterialCost: newJob.actualMaterialCost?.toString() || '',
        totalDeliveries: newJob.totalDeliveries.toString(),
        totalPickups: newJob.totalPickups.toString(),
        totalReturns: newJob.totalReturns.toString(),
        totalMaterialCharged: newJob.totalMaterialCharged.toString(),
        totalMaterialCost: newJob.totalMaterialCost.toString(),
        materialProfit: newJob.materialProfit.toString(),
        ticketIds: JSON.stringify(newJob.ticketIds),
        billingIds: JSON.stringify(newJob.billingIds),
        invoiceIds: JSON.stringify(newJob.invoiceIds),
        photoIds: JSON.stringify(newJob.photoIds)
      });

      return newJob;
    }
  }

  async getJob(jobId: string): Promise<JobRecord | null> {
    const sheet = await this.getOrCreateSheet('Jobs_Master', []);
    const rows = await sheet.getRows();
    const row = rows.find(r => r.get('jobId') === jobId);

    if (!row) return null;
    return this.rowToJobRecord(row);
  }

  async getJobs(filters?: {
    status?: JobRecord['jobStatus'];
    projectManagerId?: string;
    dateFrom?: string;
    dateTo?: string;
    limit?: number;
  }): Promise<JobRecord[]> {
    const sheet = await this.getOrCreateSheet('Jobs_Master', []);
    const rows = await sheet.getRows();

    let jobs = rows.map(r => this.rowToJobRecord(r));

    if (filters) {
      if (filters.status) {
        jobs = jobs.filter(j => j.jobStatus === filters.status);
      }
      if (filters.projectManagerId) {
        jobs = jobs.filter(j => j.projectManagerId === filters.projectManagerId);
      }
      if (filters.dateFrom) {
        jobs = jobs.filter(j => j.createdAt >= filters.dateFrom!);
      }
      if (filters.dateTo) {
        jobs = jobs.filter(j => j.createdAt <= filters.dateTo!);
      }
      if (filters.limit) {
        jobs = jobs.slice(0, filters.limit);
      }
    }

    return jobs;
  }

  private rowToJobRecord(row: { get(key: string): string }): JobRecord {
    return {
      jobId: row.get('jobId'),
      jobNimbusId: row.get('jobNimbusId'),
      jobName: row.get('jobName'),
      jobType: row.get('jobType') as JobRecord['jobType'],
      jobStatus: row.get('jobStatus') as JobRecord['jobStatus'],
      customerName: row.get('customerName'),
      customerPhone: row.get('customerPhone'),
      customerEmail: row.get('customerEmail'),
      customerAddress: row.get('customerAddress'),
      customerCity: row.get('customerCity'),
      customerState: row.get('customerState'),
      customerZip: row.get('customerZip'),
      projectManager: row.get('projectManager'),
      projectManagerId: row.get('projectManagerId'),
      salesRep: row.get('salesRep'),
      contractAmount: parseFloat(row.get('contractAmount')) || undefined,
      estimatedMaterialCost: parseFloat(row.get('estimatedMaterialCost')) || undefined,
      actualMaterialCost: parseFloat(row.get('actualMaterialCost')) || undefined,
      leadDate: row.get('leadDate'),
      estimateDate: row.get('estimateDate'),
      contractDate: row.get('contractDate'),
      scheduledStartDate: row.get('scheduledStartDate'),
      actualStartDate: row.get('actualStartDate'),
      completionDate: row.get('completionDate'),
      totalDeliveries: parseInt(row.get('totalDeliveries')) || 0,
      totalPickups: parseInt(row.get('totalPickups')) || 0,
      totalReturns: parseInt(row.get('totalReturns')) || 0,
      totalMaterialCharged: parseFloat(row.get('totalMaterialCharged')) || 0,
      totalMaterialCost: parseFloat(row.get('totalMaterialCost')) || 0,
      materialProfit: parseFloat(row.get('materialProfit')) || 0,
      ticketIds: JSON.parse(row.get('ticketIds') || '[]'),
      billingIds: JSON.parse(row.get('billingIds') || '[]'),
      invoiceIds: JSON.parse(row.get('invoiceIds') || '[]'),
      photoIds: JSON.parse(row.get('photoIds') || '[]'),
      createdAt: row.get('createdAt'),
      updatedAt: row.get('updatedAt'),
      syncedToJobNimbus: row.get('syncedToJobNimbus'),
      lastJobNimbusSync: row.get('lastJobNimbusSync'),
      notes: row.get('notes')
    };
  }

  // ============ UPDATE JOB FROM TICKET ============

  async updateJobFromTicket(jobId: string, ticketData: {
    ticketId: string;
    ticketType: 'delivery' | 'pickup' | 'return';
    materialCost: number;
    materialCharge: number;
    photoIds?: string[];
    billingId?: string;
  }): Promise<JobRecord | null> {
    const job = await this.getJob(jobId);
    if (!job) return null;

    // Update totals
    const updates: Partial<JobRecord> = {
      jobId,
      updatedAt: new Date().toISOString()
    };

    // Add ticket ID if not exists
    if (!job.ticketIds.includes(ticketData.ticketId)) {
      updates.ticketIds = [...job.ticketIds, ticketData.ticketId];
    }

    // Add billing ID if provided
    if (ticketData.billingId && !job.billingIds.includes(ticketData.billingId)) {
      updates.billingIds = [...job.billingIds, ticketData.billingId];
    }

    // Add photo IDs if provided
    if (ticketData.photoIds) {
      const newPhotoIds = ticketData.photoIds.filter(id => !job.photoIds.includes(id));
      if (newPhotoIds.length > 0) {
        updates.photoIds = [...job.photoIds, ...newPhotoIds];
      }
    }

    // Update counts based on ticket type
    switch (ticketData.ticketType) {
      case 'delivery':
        updates.totalDeliveries = job.totalDeliveries + 1;
        updates.totalMaterialCost = job.totalMaterialCost + ticketData.materialCost;
        updates.totalMaterialCharged = job.totalMaterialCharged + ticketData.materialCharge;
        break;
      case 'pickup':
        updates.totalPickups = job.totalPickups + 1;
        break;
      case 'return':
        updates.totalReturns = job.totalReturns + 1;
        // Returns reduce the charged amount
        updates.totalMaterialCharged = job.totalMaterialCharged - ticketData.materialCharge;
        break;
    }

    // Calculate profit
    updates.materialProfit = (updates.totalMaterialCharged || job.totalMaterialCharged) -
                             (updates.totalMaterialCost || job.totalMaterialCost);
    updates.actualMaterialCost = updates.totalMaterialCost || job.totalMaterialCost;

    return this.createOrUpdateJob(updates as Partial<JobRecord> & { jobId: string });
  }

  // ============ JOBNIMBUS INTEGRATION ============

  private mapStatusToJobNimbus(status: JobRecord['jobStatus']): string {
    const statusMap: Record<string, string> = {
      lead: 'Lead',
      estimate: 'Estimate Sent',
      contract: 'Contract Signed',
      scheduled: 'Scheduled',
      in_progress: 'Work In Progress',
      completed: 'Complete',
      cancelled: 'Cancelled'
    };
    return statusMap[status] || 'Lead';
  }

  /**
   * Sync a job to JobNimbus.
   * Creates/finds a JN contact for the customer, then creates/updates a JN job record.
   */
  async syncToJobNimbus(jobId: string): Promise<SyncResult> {
    const job = await this.getJob(jobId);
    if (!job) {
      return {
        success: false,
        jobId,
        action: 'skipped',
        message: 'Job not found',
        timestamp: new Date().toISOString()
      };
    }

    const apiKey = process.env.JOBNIMBUS_API_KEY;
    const baseUrl = process.env.JOBNIMBUS_API_URL || 'https://app.jobnimbus.com/api1';
    if (!apiKey) {
      return {
        success: false,
        jobId,
        action: 'skipped',
        message: 'JobNimbus API key not configured',
        timestamp: new Date().toISOString()
      };
    }

    const headers = {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    };

    try {
      // Step 1: Ensure we have a JN contact for this customer
      let contactJnid = job.jobNimbusId; // Legacy: this field was used for contact ID

      if (!contactJnid) {
        // Search for existing contact by email or phone
        let existingContact = null;
        // JN filter must be JSON-encoded — see lib/jobnimbus-service.ts:318
        if (job.customerEmail) {
          const f = encodeURIComponent(
            JSON.stringify({ must: [{ term: { email: job.customerEmail } }] }),
          );
          const searchRes = await fetch(`${baseUrl}/contacts?filter=${f}&limit=1`, { headers });
          if (searchRes.ok) {
            const data = await searchRes.json();
            existingContact = data.results?.[0] || null;
          }
        }
        if (!existingContact && job.customerPhone) {
          const normalizedPhone = job.customerPhone.replace(/\D/g, '');
          const f = encodeURIComponent(
            JSON.stringify({ must: [{ term: { mobile_phone: normalizedPhone } }] }),
          );
          const searchRes = await fetch(`${baseUrl}/contacts?filter=${f}&limit=1`, { headers });
          if (searchRes.ok) {
            const data = await searchRes.json();
            existingContact = data.results?.[0] || null;
          }
        }

        if (existingContact) {
          contactJnid = existingContact.jnid;
        } else {
          // Create a new contact
          const nameParts = (job.customerName || '').split(/\s+/);
          const contactPayload = {
            first_name: nameParts[0] || 'Unknown',
            last_name: nameParts.slice(1).join(' ') || '',
            email: job.customerEmail,
            mobile_phone: job.customerPhone,
            address_line1: job.customerAddress,
            city: job.customerCity,
            state_text: job.customerState,
            zip: job.customerZip,
            status: 'Lead',
            source: 'RCRS Portal',
          };

          const createRes = await fetch(`${baseUrl}/contacts`, {
            method: 'POST',
            headers,
            body: JSON.stringify(contactPayload)
          });

          if (createRes.ok) {
            const data = await createRes.json();
            contactJnid = data.jnid;
          } else {
            throw new Error(`Failed to create JN contact: ${createRes.status}`);
          }
        }

        // Save the contact jnid back to our record
        if (contactJnid) {
          await this.createOrUpdateJob({
            jobId,
            jobNimbusId: contactJnid,
          });
        }
      }

      if (!contactJnid) {
        throw new Error('Could not create or find JobNimbus contact');
      }

      // Step 2: Create or update the JN job record
      const jnStatus = this.mapStatusToJobNimbus(job.jobStatus);
      const jobPayload = {
        name: job.jobName || `RCRS Job ${jobId}`,
        description: job.notes || `Job type: ${job.jobType}. Project manager: ${job.projectManager || 'TBD'}.`,
        status_name: jnStatus,
        primary: { jnid: contactJnid },
        address_line1: job.customerAddress,
        city: job.customerCity,
        state_text: job.customerState,
        zip: job.customerZip,
        sales_rep_name: job.salesRep || job.projectManager || '',
      };

      // Check if we have a JN job ID already stored (look for it in notes or a dedicated field)
      // For now, always check for existing jobs on this contact
      // JN filter must be JSON-encoded — see lib/jobnimbus-service.ts:318
      const jobsFilter = encodeURIComponent(
        JSON.stringify({ must: [{ term: { 'primary.id': contactJnid } }] }),
      );
      const jobsRes = await fetch(`${baseUrl}/jobs?filter=${jobsFilter}&limit=50`, { headers });
      let existingJob = null;
      if (jobsRes.ok) {
        const data = await jobsRes.json();
        // Match by name or by our portal job ID in description
        existingJob = (data.results || []).find((j: { name?: string; description?: string; jnid?: string }) =>
          j.name === job.jobName ||
          (j.description || '').includes(jobId)
        );
      }

      let result: SyncResult;

      if (existingJob) {
        // Update existing JN job
        const updateRes = await fetch(`${baseUrl}/jobs/${existingJob.jnid}`, {
          method: 'PUT',
          headers,
          body: JSON.stringify({
            ...jobPayload,
            description: `${job.notes || ''}\n[Portal Job ID: ${jobId}]`.trim(),
          })
        });

        if (updateRes.ok) {
          result = {
            success: true,
            jobId,
            jobNimbusId: existingJob.jnid,
            action: 'updated',
            message: `JN job updated (contact: ${contactJnid}, job: ${existingJob.jnid})`,
            timestamp: new Date().toISOString()
          };
        } else {
          throw new Error(`Failed to update JN job: ${updateRes.status}`);
        }
      } else {
        // Create new JN job
        const createRes = await fetch(`${baseUrl}/jobs`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            ...jobPayload,
            description: `${job.notes || ''}\n[Portal Job ID: ${jobId}]`.trim(),
          })
        });

        if (createRes.ok) {
          const data = await createRes.json();
          result = {
            success: true,
            jobId,
            jobNimbusId: data.jnid,
            action: 'created',
            message: `JN job created (contact: ${contactJnid}, job: ${data.jnid})`,
            timestamp: new Date().toISOString()
          };

          // Add a note on the new JN job
          try {
            await fetch(`${baseUrl}/activities`, {
              method: 'POST',
              headers,
              body: JSON.stringify({
                primary: { jnid: contactJnid },
                related: { jnid: data.jnid },
                note: `[RCRS Portal] Job "${job.jobName}" synced from portal. Status: ${jnStatus}. Contract: $${job.contractAmount || 0}.`,
                record_type_name: 'Note',
                is_active: true,
              })
            });
          } catch {
            // Note creation is non-critical
          }
        } else {
          throw new Error(`Failed to create JN job: ${createRes.status}`);
        }
      }

      // Update local record with sync timestamp
      await this.createOrUpdateJob({
        jobId,
        syncedToJobNimbus: 'true',
        lastJobNimbusSync: new Date().toISOString()
      });

      // Log sync
      await this.logSync(result);
      return result;

    } catch (error) {
      const result: SyncResult = {
        success: false,
        jobId,
        action: 'skipped',
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      };
      await this.logSync(result);
      return result;
    }
  }

  async syncAllPendingToJobNimbus(): Promise<SyncResult[]> {
    const jobs = await this.getJobs();
    const pendingJobs = jobs.filter(j => !j.syncedToJobNimbus || j.updatedAt > (j.lastJobNimbusSync || ''));

    const results: SyncResult[] = [];
    for (const job of pendingJobs) {
      const result = await this.syncToJobNimbus(job.jobId);
      results.push(result);
      // Rate limiting
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    return results;
  }

  private async logSync(result: SyncResult): Promise<void> {
    const sheet = await this.getOrCreateSheet('Sync_Log', [
      'timestamp', 'jobId', 'jobNimbusId', 'action', 'success', 'message'
    ]);

    await sheet.addRow({
      timestamp: result.timestamp,
      jobId: result.jobId,
      jobNimbusId: result.jobNimbusId || '',
      action: result.action,
      success: result.success.toString(),
      message: result.message
    });
  }

  // ============ BULK DATA EXPORT ============

  async exportAllJobsData(): Promise<{
    jobs: JobRecord[];
    summary: {
      totalJobs: number;
      totalDeliveries: number;
      totalMaterialCost: number;
      totalMaterialCharged: number;
      totalProfit: number;
      byStatus: Record<string, number>;
      byProjectManager: Record<string, number>;
    }
  }> {
    const jobs = await this.getJobs();

    const summary = {
      totalJobs: jobs.length,
      totalDeliveries: jobs.reduce((sum, j) => sum + j.totalDeliveries, 0),
      totalMaterialCost: jobs.reduce((sum, j) => sum + j.totalMaterialCost, 0),
      totalMaterialCharged: jobs.reduce((sum, j) => sum + j.totalMaterialCharged, 0),
      totalProfit: jobs.reduce((sum, j) => sum + j.materialProfit, 0),
      byStatus: {} as Record<string, number>,
      byProjectManager: {} as Record<string, number>
    };

    jobs.forEach(job => {
      summary.byStatus[job.jobStatus] = (summary.byStatus[job.jobStatus] || 0) + 1;
      if (job.projectManager) {
        summary.byProjectManager[job.projectManager] = (summary.byProjectManager[job.projectManager] || 0) + 1;
      }
    });

    return { jobs, summary };
  }
}

export const jobSyncService = new JobSyncService();
