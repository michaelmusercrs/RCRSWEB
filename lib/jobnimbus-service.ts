// JobNimbus API Service
// Syncs contacts, jobs, and estimates with customer portal
// NO DEMO MODE - requires valid API key
//
// COST-PRIVACY: all read functions in this file accept an optional `viewer`
// arg + redact cost fields via lib/jn-redact.ts before returning. Missing
// viewer => fail-safe redaction (treat as not-allowed). NEVER bypass. See
// docs/research-crm-comparison.md moat #3 + feedback_purchase_price_visibility.

import { stripCostFields } from './cost-visibility';
import {
  redactCostFieldsDeep,
  effectiveCanSeeCost,
  type JNViewer,
} from './jn-redact';

const JOBNIMBUS_API_KEY = process.env.JOBNIMBUS_API_KEY;
const JOBNIMBUS_API_URL = process.env.JOBNIMBUS_API_URL || 'https://app.jobnimbus.com/api1';

// Maximum pages to fetch to prevent infinite loops
const MAX_PAGES = 100;

// API configuration check
export function isJobNimbusConfigured(): boolean {
  return Boolean(JOBNIMBUS_API_KEY);
}

export function getApiStatus(): { configured: boolean; apiUrl: string } {
  return {
    configured: isJobNimbusConfigured(),
    apiUrl: JOBNIMBUS_API_URL,
  };
}

interface JobNimbusContact {
  jnid: string;
  first_name?: string;
  last_name?: string;
  display_name?: string;
  company?: string;
  email?: string;
  home_phone?: string;
  mobile_phone?: string;
  work_phone?: string;
  address_line1?: string;
  address_line2?: string;
  city?: string;
  state_text?: string;
  zip?: string;
  country?: string;
  sales_rep?: string;
  sales_rep_name?: string;
  status?: string;
  status_name?: string;
  source?: string;
  source_name?: string;
  number?: string;
  created_by_name?: string;
  date_created?: number;
  date_updated?: number;
  date_status_change?: number;
  created_at?: number;
  updated_at?: number;
  is_archived?: boolean;
  is_closed?: boolean;
  geo?: { lat: number; lng?: number; lon?: number };
  record_type?: string;
  record_type_name?: string;
  tags?: string[];
  approved_estimate_total?: number;
  approved_invoice_total?: number;
  last_budget_revenue?: number;
  // Custom fields — JN returns these with their human-readable label
  'Date of Loss'?: number;
  cf_date_1?: number;
  cf_date_2?: number;
  [key: string]: unknown; // tolerate other custom fields without typing them all
}

interface JobNimbusJob {
  jnid: string;
  number?: string;
  name?: string;
  description?: string;
  status?: string;
  status_name?: string;
  sales_rep?: string;
  sales_rep_name?: string;
  // The related contact on a job. JN returns `id` here, NOT `jnid`. Both are
  // kept on the type because old call sites read .jnid; new code should read .id.
  primary?: {
    id?: string;
    jnid?: string;
    name?: string;
    number?: string;
    email?: string | null;
    type?: string;
  };
  address_line1?: string;
  address_line2?: string;
  city?: string;
  state_text?: string;
  zip?: string;
  // Phone fields are on the job itself (parent_*) — no separate contact fetch needed.
  parent_home_phone?: string;
  parent_mobile_phone?: string;
  parent_work_phone?: string;
  parent_fax_number?: string;
  created_at?: number;
  updated_at?: number;
  date_start?: number;
  date_end?: number;
}

interface JobNimbusEstimate {
  jnid: string;
  number?: string;
  status?: string;
  amount?: number;
  tax?: number;
  total?: number;
  description?: string;
  primary?: { jnid?: string; id?: string }; // Related contact — JN returns .id, see JobNimbusJob
  related?: { jnid?: string; id?: string }; // Related job
  pdf_url?: string;
  public_url?: string;
  created_at?: number;
  updated_at?: number;
}

interface JobNimbusTask {
  jnid: string;
  title?: string;
  description?: string;
  type?: string;
  status?: string;
  date_start?: number;
  date_end?: number;
  assigned_to?: string[];
  primary?: { jnid?: string; id?: string };
}

interface JobNimbusNote {
  jnid: string;
  content?: string;
  type?: string;
  created_at?: number;
  created_by?: string;
  created_by_name?: string;
  primary?: { jnid?: string; id?: string };
  related?: { jnid?: string; id?: string };
}

interface JobNimbusAttachment {
  jnid: string;
  filename?: string;
  description?: string;
  url?: string;
  thumbnail_url?: string;
  content_type?: string;
  size?: number;
  created_at?: number;
  created_by?: string;
  primary?: { jnid?: string; id?: string };
  related?: { jnid?: string; id?: string };
}

interface JobNimbusInvoice {
  jnid: string;
  number?: string;
  status?: string;
  amount?: number;
  amount_paid?: number;
  balance?: number;
  total?: number;
  description?: string;
  due_date?: number;
  pdf_url?: string;
  public_url?: string;
  created_at?: number;
  primary?: { jnid?: string; id?: string };
  related?: { jnid?: string; id?: string };
}

// Error types for better error handling
export class JobNimbusError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public endpoint?: string,
    public details?: string
  ) {
    super(message);
    this.name = 'JobNimbusError';
  }
}

export class JobNimbusConfigError extends JobNimbusError {
  constructor() {
    super('JobNimbus API key not configured. Please set JOBNIMBUS_API_KEY in .env.local');
    this.name = 'JobNimbusConfigError';
  }
}

class JobNimbusService {
  private async apiRequest<T>(
    endpoint: string,
    method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET',
    body?: object,
    retries = 2
  ): Promise<T> {
    if (!JOBNIMBUS_API_KEY) {
      throw new JobNimbusConfigError();
    }

    const url = `${JOBNIMBUS_API_URL}${endpoint}`;

    // HARD RULE: never push purchase cost / margin / wholesale to JobNimbus.
    // Strip every cost-related field from the body before sending. This is a
    // belt-and-suspenders guard — the typed methods above already exclude
    // cost fields, but if a future caller bypasses the type via `as any` we
    // still don't leak. See feedback_purchase_price_visibility.md.
    const safeBody = body && (method === 'POST' || method === 'PUT')
      ? stripCostFields(body)
      : body;

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const response = await fetch(url, {
          method,
          headers: {
            'Authorization': `Bearer ${JOBNIMBUS_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: safeBody ? JSON.stringify(safeBody) : undefined,
          // 15s upper bound — JN p95 is well under 3s; a hang here would
          // multiply through the retry loop and tie up the whole Vercel
          // function. AbortError surfaces as a normal request failure.
          signal: AbortSignal.timeout(15000),
        });

        if (!response.ok) {
          const errorText = await response.text();

          // Don't retry client errors (4xx)
          if (response.status >= 400 && response.status < 500) {
            throw new JobNimbusError(
              `JobNimbus API error: ${response.status}`,
              response.status,
              endpoint,
              errorText
            );
          }

          // Retry server errors (5xx) if we have retries left
          if (attempt < retries) {
            await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
            continue;
          }

          throw new JobNimbusError(
            `JobNimbus API error after ${retries + 1} attempts: ${response.status}`,
            response.status,
            endpoint,
            errorText
          );
        }

        return response.json();
      } catch (error) {
        if (error instanceof JobNimbusError) {
          throw error;
        }

        // Network or other errors
        if (attempt < retries) {
          await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
          continue;
        }

        throw new JobNimbusError(
          `Failed to connect to JobNimbus API: ${error instanceof Error ? error.message : 'Unknown error'}`,
          undefined,
          endpoint
        );
      }
    }

    throw new JobNimbusError('Unexpected error in API request', undefined, endpoint);
  }

  // Get all contacts
  async getContacts(params?: {
    limit?: number;
    offset?: number;
    since?: number; // Unix timestamp for updated_at filter
  }, viewer?: JNViewer): Promise<{ count: number; results: JobNimbusContact[] }> {
    const query = new URLSearchParams();
    if (params?.limit) query.set('limit', params.limit.toString());
    if (params?.offset) query.set('offset', params.offset.toString());
    if (params?.since) query.set('since', params.since.toString());

    const raw = await this.apiRequest<{ count: number; results: JobNimbusContact[] }>(
      `/contacts?${query.toString()}`,
    );
    return redactCostFieldsDeep(raw, effectiveCanSeeCost(viewer));
  }

  // Get single contact
  async getContact(jnid: string, viewer?: JNViewer): Promise<JobNimbusContact> {
    const raw = await this.apiRequest<JobNimbusContact>(`/contacts/${jnid}`);
    return redactCostFieldsDeep(raw, effectiveCanSeeCost(viewer));
  }

  // Get all jobs
  async getJobs(params?: {
    limit?: number;
    offset?: number;
    since?: number;
  }, viewer?: JNViewer): Promise<{ count: number; results: JobNimbusJob[] }> {
    const query = new URLSearchParams();
    if (params?.limit) query.set('limit', params.limit.toString());
    if (params?.offset) query.set('offset', params.offset.toString());
    if (params?.since) query.set('since', params.since.toString());

    const raw = await this.apiRequest<{ count: number; results: JobNimbusJob[] }>(
      `/jobs?${query.toString()}`,
    );
    return redactCostFieldsDeep(raw, effectiveCanSeeCost(viewer));
  }

  // Get single job
  async getJob(jnid: string, viewer?: JNViewer): Promise<JobNimbusJob> {
    const raw = await this.apiRequest<JobNimbusJob>(`/jobs/${jnid}`);
    return redactCostFieldsDeep(raw, effectiveCanSeeCost(viewer));
  }

  // Get jobs for a contact.
  // JN filter must be a JSON object — see getJobByNumber comment.
  async getJobsForContact(contactJnid: string, viewer?: JNViewer): Promise<JobNimbusJob[]> {
    if (!contactJnid) return [];
    const filter = { must: [{ term: { 'primary.id': contactJnid } }] };
    const result = await this.apiRequest<{ results: JobNimbusJob[] }>(
      `/jobs?filter=${encodeURIComponent(JSON.stringify(filter))}`,
    );
    return redactCostFieldsDeep(result.results || [], effectiveCanSeeCost(viewer));
  }

  /**
   * Look up a single job by its display number (e.g. "R-11071"). Returns
   * null if no match — used by the historical inventory backfill to
   * enrich tickets with customer/address/sales rep data.
   */
  async getJobByNumber(jobNumber: string, viewer?: JNViewer): Promise<JobNimbusJob | null> {
    if (!jobNumber) return null;
    try {
      // JN requires the `filter` query param to be a JSON-encoded Elasticsearch
      // bool query. The previous `filter=number:"R-XXXX"` was a string and
      // returned HTTP 400 "Filter syntax error: not valid JSON". Verified
      // 2026-05-19 against R-10997 — must+term returns the single match.
      const filter = { must: [{ term: { number: jobNumber } }] };
      const result = await this.apiRequest<{ results: JobNimbusJob[]; count?: number }>(
        `/jobs?filter=${encodeURIComponent(JSON.stringify(filter))}`,
      );
      const jobs = result.results || [];
      const first = jobs[0] || null;
      if (!first) return null;
      return redactCostFieldsDeep(first, effectiveCanSeeCost(viewer));
    } catch {
      return null;
    }
  }

  // Get estimates
  async getEstimates(params?: {
    limit?: number;
    offset?: number;
    since?: number;
  }, viewer?: JNViewer): Promise<{ count: number; results: JobNimbusEstimate[] }> {
    const query = new URLSearchParams();
    if (params?.limit) query.set('limit', params.limit.toString());
    if (params?.offset) query.set('offset', params.offset.toString());
    if (params?.since) query.set('since', params.since.toString());

    const raw = await this.apiRequest<{ count: number; results: JobNimbusEstimate[] }>(
      `/estimates?${query.toString()}`,
    );
    return redactCostFieldsDeep(raw, effectiveCanSeeCost(viewer));
  }

  // Get estimate by ID
  async getEstimate(jnid: string, viewer?: JNViewer): Promise<JobNimbusEstimate> {
    const raw = await this.apiRequest<JobNimbusEstimate>(`/estimates/${jnid}`);
    return redactCostFieldsDeep(raw, effectiveCanSeeCost(viewer));
  }

  // Get estimates for a contact (JSON filter — see getJobByNumber)
  async getEstimatesForContact(contactJnid: string, viewer?: JNViewer): Promise<JobNimbusEstimate[]> {
    if (!contactJnid) return [];
    const filter = { must: [{ term: { 'primary.id': contactJnid } }] };
    const result = await this.apiRequest<{ results: JobNimbusEstimate[] }>(
      `/estimates?filter=${encodeURIComponent(JSON.stringify(filter))}`,
    );
    return redactCostFieldsDeep(result.results || [], effectiveCanSeeCost(viewer));
  }

  // Get tasks/appointments
  async getTasks(params?: {
    limit?: number;
    offset?: number;
    since?: number;
  }, viewer?: JNViewer): Promise<{ count: number; results: JobNimbusTask[] }> {
    const query = new URLSearchParams();
    if (params?.limit) query.set('limit', params.limit.toString());
    if (params?.offset) query.set('offset', params.offset.toString());
    if (params?.since) query.set('since', params.since.toString());

    const raw = await this.apiRequest<{ count: number; results: JobNimbusTask[] }>(
      `/tasks?${query.toString()}`,
    );
    return redactCostFieldsDeep(raw, effectiveCanSeeCost(viewer));
  }

  // Get tasks for a contact
  async getTasksForContact(contactJnid: string, viewer?: JNViewer): Promise<JobNimbusTask[]> {
    if (!contactJnid) return [];
    const filter = { must: [{ term: { 'primary.id': contactJnid } }] };
    const result = await this.apiRequest<{ results: JobNimbusTask[] }>(
      `/tasks?filter=${encodeURIComponent(JSON.stringify(filter))}`,
    );
    return redactCostFieldsDeep(result.results || [], effectiveCanSeeCost(viewer));
  }

  // Get notes for a contact
  async getNotesForContact(contactJnid: string, limit: number = 50, viewer?: JNViewer): Promise<JobNimbusNote[]> {
    if (!contactJnid) return [];
    const filter = { must: [{ term: { 'primary.id': contactJnid } }] };
    const qs = new URLSearchParams({
      filter: JSON.stringify(filter),
      sort: '-created_at',
      limit: String(limit),
    });
    const result = await this.apiRequest<{ results: JobNimbusNote[] }>(
      `/notes?${qs.toString()}`,
    );
    return redactCostFieldsDeep(result.results || [], effectiveCanSeeCost(viewer));
  }

  // Get attachments/files for a contact
  async getAttachmentsForContact(contactJnid: string, viewer?: JNViewer): Promise<JobNimbusAttachment[]> {
    if (!contactJnid) return [];
    const filter = { must: [{ term: { 'primary.id': contactJnid } }] };
    const qs = new URLSearchParams({
      filter: JSON.stringify(filter),
      sort: '-created_at',
    });
    const result = await this.apiRequest<{ results: JobNimbusAttachment[] }>(
      `/files?${qs.toString()}`,
    );
    return redactCostFieldsDeep(result.results || [], effectiveCanSeeCost(viewer));
  }

  // Get invoices for a contact
  async getInvoicesForContact(contactJnid: string, viewer?: JNViewer): Promise<JobNimbusInvoice[]> {
    if (!contactJnid) return [];
    const filter = { must: [{ term: { 'primary.id': contactJnid } }] };
    const result = await this.apiRequest<{ results: JobNimbusInvoice[] }>(
      `/invoices?filter=${encodeURIComponent(JSON.stringify(filter))}`,
    );
    return redactCostFieldsDeep(result.results || [], effectiveCanSeeCost(viewer));
  }

  // Update a job's status
  async updateJobStatus(jobJnid: string, status: string): Promise<JobNimbusJob> {
    return this.apiRequest(`/jobs/${jobJnid}`, 'PUT', { status_name: status });
  }

  // Update a contact
  async updateContact(contactJnid: string, data: Partial<JobNimbusContact>): Promise<JobNimbusContact> {
    return this.apiRequest(`/contacts/${contactJnid}`, 'PUT', data);
  }

  // Update a job
  async updateJob(jobJnid: string, data: Partial<JobNimbusJob>): Promise<JobNimbusJob> {
    return this.apiRequest(`/jobs/${jobJnid}`, 'PUT', data);
  }

  // Create a contact
  async createContact(data: Partial<JobNimbusContact>): Promise<JobNimbusContact> {
    return this.apiRequest('/contacts', 'POST', data);
  }

  // Create a job
  async createJob(data: Partial<JobNimbusJob>): Promise<JobNimbusJob> {
    return this.apiRequest('/jobs', 'POST', data);
  }

  // Get all notes with pagination
  async getNotes(params?: {
    limit?: number;
    offset?: number;
    since?: number;
  }, viewer?: JNViewer): Promise<{ count: number; results: JobNimbusNote[] }> {
    const query = new URLSearchParams();
    if (params?.limit) query.set('limit', params.limit.toString());
    if (params?.offset) query.set('offset', params.offset.toString());
    if (params?.since) query.set('since', params.since.toString());
    const raw = await this.apiRequest<{ count: number; results: JobNimbusNote[] }>(
      `/activities?${query.toString()}`,
    );
    return redactCostFieldsDeep(raw, effectiveCanSeeCost(viewer));
  }

  // Get notes for a job
  // JN filter must be JSON-encoded — see getJobByNumber comment.
  async getNotesForJob(jobJnid: string, limit: number = 50, viewer?: JNViewer): Promise<JobNimbusNote[]> {
    const filter = { must: [{ term: { 'related.id': jobJnid } }] };
    const result = await this.apiRequest<{ results: JobNimbusNote[] }>(
      `/activities?filter=${encodeURIComponent(JSON.stringify(filter))}&sort=-created_at&limit=${limit}`,
    );
    return redactCostFieldsDeep(result.results || [], effectiveCanSeeCost(viewer));
  }

  // Create a note on a job
  async createNoteOnJob(jobJnid: string, contactJnid: string, content: string): Promise<JobNimbusNote> {
    return this.apiRequest('/activities', 'POST', {
      primary: { jnid: contactJnid },
      related: { jnid: jobJnid },
      note: content,
      record_type_name: 'Note',
      is_active: true,
    });
  }

  /**
   * Upload a file (e.g. a delivery photo) directly onto a JN job via
   * POST /files.
   *
   * ⚠️ UNVERIFIED PAYLOAD SHAPE — DO NOT WIRE INTO PRODUCTION PATHS YET.
   * The api1 docs for file creation are thin and we have not run a live
   * write-probe (a POST creates a real file on a real customer job). The
   * shipping mechanism for delivery photos is the note-link written by
   * lib/jn-photo-sync.ts (createNoteOnJob — prod-proven). This method exists
   * so that, once the payload is confirmed via scripts/test-jn-file-upload.mjs,
   * the sync can be upgraded to a real file attachment in one line.
   *
   * Payload informed by a real GET /files probe (2026-07-10, see
   * scripts/test-jn-file-upload.mjs): file records return `related` as an
   * ARRAY of { id, type } (job first), `primary` mirrors the job (JN derives
   * it), `record_type_name` is a JN file category ('Photo', 'Permit', …),
   * and the list response key is `files`, NOT `results`. What remains
   * unverified is the WRITE side: whether POST accepts base64 in `data` as
   * JSON (per api1 docs) or requires multipart — hence the disabled
   * write-probe in the script.
   */
  async uploadFileToJob(
    jobJnid: string,
    contactJnid: string,
    file: { filename: string; contentType: string; base64: string },
  ): Promise<JobNimbusAttachment> {
    return this.apiRequest('/files', 'POST', {
      data: file.base64,
      filename: file.filename,
      content_type: file.contentType,
      // Relate to the job (primary is derived by JN) + the contact so the
      // file surfaces on both records — mirrors how real files come back.
      related: [{ id: jobJnid }, { id: contactJnid }],
      record_type_name: 'Photo',
      persist: true,
      is_active: true,
    });
  }

  // Get all files/attachments
  async getFiles(params?: {
    limit?: number;
    offset?: number;
  }, viewer?: JNViewer): Promise<{ count: number; results: JobNimbusAttachment[] }> {
    const query = new URLSearchParams();
    if (params?.limit) query.set('limit', params.limit.toString());
    if (params?.offset) query.set('offset', params.offset.toString());
    const raw = await this.apiRequest<{ count: number; results: JobNimbusAttachment[] }>(
      `/files?${query.toString()}`,
    );
    return redactCostFieldsDeep(raw, effectiveCanSeeCost(viewer));
  }

  // Get files for a job
  // JN filter must be JSON-encoded — see getJobByNumber comment.
  async getFilesForJob(jobJnid: string, viewer?: JNViewer): Promise<JobNimbusAttachment[]> {
    const filter = { must: [{ term: { 'related.id': jobJnid } }] };
    const result = await this.apiRequest<{ results: JobNimbusAttachment[] }>(
      `/files?filter=${encodeURIComponent(JSON.stringify(filter))}&sort=-created_at`,
    );
    return redactCostFieldsDeep(result.results || [], effectiveCanSeeCost(viewer));
  }

  // Create a note on a contact
  async createNote(contactJnid: string, content: string): Promise<JobNimbusNote> {
    return this.apiRequest('/activities', 'POST', {
      primary: { jnid: contactJnid },
      note: content,
      record_type_name: 'Note',
      is_active: true,
    });
  }

  // Create a note with portal message tag
  async createPortalMessage(contactJnid: string, message: string, isFromCustomer: boolean = true): Promise<JobNimbusNote> {
    const prefix = isFromCustomer ? '[Customer Portal Message]' : '[Staff Reply]';
    return this.createNote(contactJnid, `${prefix} ${message}`);
  }

  // Add custom field to contact (for portal link)
  async updateContactCustomField(
    contactJnid: string,
    fieldName: string,
    value: string
  ): Promise<JobNimbusContact> {
    return this.apiRequest(`/contacts/${contactJnid}`, 'PUT', {
      [fieldName]: value,
    });
  }

  // Format contact address
  formatAddress(contact: JobNimbusContact): string {
    const parts = [
      contact.address_line1,
      contact.address_line2,
      contact.city,
      contact.state_text,
      contact.zip,
    ].filter(Boolean);

    return parts.join(', ') || 'Address not provided';
  }

  // Get contact's primary phone
  getContactPhone(contact: JobNimbusContact): string {
    return contact.mobile_phone || contact.home_phone || contact.work_phone || '';
  }

  // Format contact name
  getContactName(contact: JobNimbusContact): string {
    if (contact.display_name) return contact.display_name;
    return `${contact.first_name || ''} ${contact.last_name || ''}`.trim() || 'Customer';
  }

  // Map JobNimbus status to portal phase
  mapStatusToPhase(status?: string): string {
    const statusMap: Record<string, string> = {
      'lead': 'lead',
      'new': 'lead',
      'contacted': 'inspection',
      'appointment set': 'inspection',
      'inspected': 'estimate',
      'estimate sent': 'estimate',
      'proposal sent': 'estimate',
      'contract signed': 'contract',
      'permit': 'permit',
      'material ordered': 'materials',
      'scheduled': 'scheduled',
      'in progress': 'in_progress',
      'work in progress': 'in_progress',
      'complete': 'complete',
      'closed': 'complete',
    };

    const normalized = (status || '').toLowerCase();
    return statusMap[normalized] || 'lead';
  }

  // Sync all contacts since a given timestamp.
  // NOTE: this is an internal sync path used by background jobs. We pass an
  // explicit owner-tier viewer so the underlying paginator does not redact;
  // the downstream consumer (jn-sync-engine) is responsible for re-applying
  // redaction on the surface that reaches end users.
  async syncContacts(since?: number, viewer?: JNViewer): Promise<JobNimbusContact[]> {
    const allContacts: JobNimbusContact[] = [];
    let offset = 0;
    const limit = 100;
    let hasMore = true;
    let pageCount = 0;

    while (hasMore && pageCount < MAX_PAGES) {
      const result = await this.getContacts({ limit, offset, since }, viewer);
      allContacts.push(...result.results);
      offset += limit;
      hasMore = result.results.length === limit;
      pageCount++;
    }

    if (pageCount >= MAX_PAGES) {
      console.warn('Max pagination limit reached for syncContacts');
    }

    return allContacts;
  }

  // Search contacts by email
  // JN filter must be JSON-encoded — see getJobByNumber comment.
  async searchContactByEmail(email: string, viewer?: JNViewer): Promise<JobNimbusContact | null> {
    const filter = { must: [{ term: { email } }] };
    const result = await this.apiRequest<{ results: JobNimbusContact[] }>(
      `/contacts?filter=${encodeURIComponent(JSON.stringify(filter))}&limit=1`,
    );
    const first = result.results[0] || null;
    if (!first) return null;
    return redactCostFieldsDeep(first, effectiveCanSeeCost(viewer));
  }

  // Search contacts by phone (checks all phone fields)
  // `should` with multiple terms is ES's OR — at least one phone field matches.
  async searchContactByPhone(phone: string, viewer?: JNViewer): Promise<JobNimbusContact | null> {
    const normalizedPhone = phone.replace(/\D/g, '');
    const filter = {
      should: [
        { term: { mobile_phone: normalizedPhone } },
        { term: { home_phone: normalizedPhone } },
        { term: { work_phone: normalizedPhone } },
      ],
    };
    const result = await this.apiRequest<{ results: JobNimbusContact[] }>(
      `/contacts?filter=${encodeURIComponent(JSON.stringify(filter))}&limit=1`,
    );
    const first = result.results[0] || null;
    if (!first) return null;
    return redactCostFieldsDeep(first, effectiveCanSeeCost(viewer));
  }

  // Get complete customer data with jobs, estimates, and tasks
  async getCustomerPortalData(contactJnid: string, viewer?: JNViewer): Promise<{
    contact: JobNimbusContact;
    jobs: JobNimbusJob[];
    estimates: JobNimbusEstimate[];
    tasks: JobNimbusTask[];
    notes: JobNimbusNote[];
    attachments: JobNimbusAttachment[];
    invoices: JobNimbusInvoice[];
  } | null> {
    try {
      // Pass viewer through to each underlying read so redaction happens once,
      // at the source. The final shape coming out of this aggregator is also
      // re-redacted as belt-and-suspenders below.
      const results = await Promise.allSettled([
        this.getContact(contactJnid, viewer),
        this.getJobsForContact(contactJnid, viewer),
        this.getEstimatesForContact(contactJnid, viewer),
        this.getTasksForContact(contactJnid, viewer),
        this.getNotesForContact(contactJnid, 50, viewer),
        this.getAttachmentsForContact(contactJnid, viewer),
        this.getInvoicesForContact(contactJnid, viewer),
      ]);

      // Extract fulfilled values or log rejections
      const contact = results[0].status === 'fulfilled' ? results[0].value : null;
      const jobs = results[1].status === 'fulfilled' ? results[1].value : [];
      const estimates = results[2].status === 'fulfilled' ? results[2].value : [];
      const tasks = results[3].status === 'fulfilled' ? results[3].value : [];
      const notes = results[4].status === 'fulfilled' ? results[4].value : [];
      const attachments = results[5].status === 'fulfilled' ? results[5].value : [];
      const invoices = results[6].status === 'fulfilled' ? results[6].value : [];

      // Log any failures (except 404s which are expected)
      results.forEach((result, index) => {
        if (result.status === 'rejected') {
          const labels = ['contact', 'jobs', 'estimates', 'tasks', 'notes', 'attachments', 'invoices'];
          console.warn(`Failed to fetch ${labels[index]} for contact ${contactJnid}:`, result.reason);
        }
      });

      // If contact fetch failed, return null
      if (!contact) {
        return null;
      }

      // Belt-and-suspenders: redact at the aggregate level as well. Each
      // underlying call already redacted, but if any future field bypasses
      // a typed shape this catches it.
      const bundle = { contact, jobs, estimates, tasks, notes, attachments, invoices };
      return redactCostFieldsDeep(bundle, effectiveCanSeeCost(viewer));
    } catch (error) {
      if (error instanceof JobNimbusError && error.statusCode === 404) {
        return null;
      }
      throw error;
    }
  }

  // Test API connection
  async testConnection(): Promise<{ success: boolean; message: string; contactCount?: number }> {
    try {
      const result = await this.getContacts({ limit: 1 });
      return {
        success: true,
        message: 'JobNimbus API connection successful',
        contactCount: result.count,
      };
    } catch (error) {
      if (error instanceof JobNimbusConfigError) {
        return {
          success: false,
          message: 'API key not configured',
        };
      }
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  // Get API statistics.
  // Counts only — no cost-sensitive payload — but we still accept a viewer
  // for signature consistency across the read surface.
  async getStats(_viewer?: JNViewer): Promise<{
    contacts: number;
    jobs: number;
    estimates: number;
    tasks: number;
  }> {
    // Stats endpoint asks JN for count totals only. Use an owner-tier viewer
    // internally because we discard the payload bodies and just keep `count`.
    const ownerView: JNViewer = { canSeeCost: true };
    const [contacts, jobs, estimates, tasks] = await Promise.all([
      this.getContacts({ limit: 1 }, ownerView),
      this.getJobs({ limit: 1 }, ownerView),
      this.getEstimates({ limit: 1 }, ownerView),
      this.getTasks({ limit: 1 }, ownerView),
    ]);

    return {
      contacts: contacts.count,
      jobs: jobs.count,
      estimates: estimates.count,
      tasks: tasks.count,
    };
  }
}

// =============================================================================
// SANDBOX MODE WRAPPER
// =============================================================================

import { isSandboxMode, sandboxLog } from './sandbox-config';
import { getSandboxJNContacts, getSandboxJNJobs } from './sandbox-data';

const _realJNService = new JobNimbusService();

const jnSandboxProxy = new Proxy(_realJNService, {
  get(target, prop: string) {
    const original = (target as unknown as Record<string, unknown>)[prop];
    if (typeof original !== 'function') return original;
    if (!isSandboxMode()) return original.bind(target);

    const mocks: Record<string, (...args: unknown[]) => unknown> = {
      getContacts: async () => { sandboxLog('JobNimbus', 'getContacts'); return { results: getSandboxJNContacts(), count: getSandboxJNContacts().length }; },
      getContact: async (jnid: unknown) => { sandboxLog('JobNimbus', 'getContact', jnid); return getSandboxJNContacts().find(c => c.jnid === jnid) || null; },
      getJobs: async () => { sandboxLog('JobNimbus', 'getJobs'); return { results: getSandboxJNJobs(), count: getSandboxJNJobs().length }; },
      getJob: async (jnid: unknown) => { sandboxLog('JobNimbus', 'getJob', jnid); return getSandboxJNJobs().find(j => j.jnid === jnid) || null; },
      getJobsForContact: async () => { sandboxLog('JobNimbus', 'getJobsForContact'); return { results: getSandboxJNJobs().slice(0, 1), count: 1 }; },
      getEstimates: async () => { sandboxLog('JobNimbus', 'getEstimates'); return { results: [], count: 0 }; },
      getEstimate: async () => { sandboxLog('JobNimbus', 'getEstimate'); return null; },
      getEstimatesForContact: async () => { sandboxLog('JobNimbus', 'getEstimatesForContact'); return { results: [], count: 0 }; },
      getTasks: async () => { sandboxLog('JobNimbus', 'getTasks'); return { results: [], count: 0 }; },
      getTasksForContact: async () => { sandboxLog('JobNimbus', 'getTasksForContact'); return { results: [], count: 0 }; },
      getNotesForContact: async () => { sandboxLog('JobNimbus', 'getNotesForContact'); return { results: [], count: 0 }; },
      getNotes: async () => { sandboxLog('JobNimbus', 'getNotes'); return { results: [], count: 0 }; },
      getAttachmentsForContact: async () => { sandboxLog('JobNimbus', 'getAttachmentsForContact'); return { results: [], count: 0 }; },
      getFilesForJob: async () => { sandboxLog('JobNimbus', 'getFilesForJob'); return { results: [], count: 0 }; },
      getFiles: async () => { sandboxLog('JobNimbus', 'getFiles'); return { results: [], count: 0 }; },
      getInvoicesForContact: async () => { sandboxLog('JobNimbus', 'getInvoicesForContact'); return { results: [], count: 0 }; },
      searchContactByEmail: async () => { sandboxLog('JobNimbus', 'searchContactByEmail'); return null; },
      searchContactByPhone: async () => { sandboxLog('JobNimbus', 'searchContactByPhone'); return null; },
      getCustomerPortalData: async () => {
        sandboxLog('JobNimbus', 'getCustomerPortalData');
        const contact = getSandboxJNContacts()[0];
        return { contact, jobs: { results: getSandboxJNJobs().slice(0, 1), count: 1 }, estimates: { results: [], count: 0 }, tasks: { results: [], count: 0 }, notes: { results: [], count: 0 }, attachments: { results: [], count: 0 }, invoices: { results: [], count: 0 } };
      },
      // Write operations — intercept
      createContact: async (...args: unknown[]) => { sandboxLog('JobNimbus', 'createContact', args[0]); return { jnid: `jn-sandbox-${Date.now()}`, ...args[0] as object }; },
      updateContact: async (...args: unknown[]) => { sandboxLog('JobNimbus', 'updateContact', args[0]); return args[0]; },
      createJob: async (...args: unknown[]) => { sandboxLog('JobNimbus', 'createJob', args[0]); return { jnid: `jn-job-sandbox-${Date.now()}`, ...args[0] as object }; },
      updateJobStatus: async (...args: unknown[]) => { sandboxLog('JobNimbus', 'updateJobStatus', args); return true; },
      createNote: async (...args: unknown[]) => { sandboxLog('JobNimbus', 'createNote', args[0]); return { jnid: `jn-note-sandbox-${Date.now()}` }; },
      createNoteOnJob: async (...args: unknown[]) => { sandboxLog('JobNimbus', 'createNoteOnJob', args); return { jnid: `jn-note-sandbox-${Date.now()}` }; },
      uploadFileToJob: async (...args: unknown[]) => { sandboxLog('JobNimbus', 'uploadFileToJob', args); return { jnid: `jn-file-sandbox-${Date.now()}` }; },
      createPortalMessage: async (...args: unknown[]) => { sandboxLog('JobNimbus', 'createPortalMessage', args[0]); return { jnid: `jn-msg-sandbox-${Date.now()}` }; },
      syncContacts: async () => { sandboxLog('JobNimbus', 'syncContacts'); return { added: 0, updated: 0, errors: 0 }; },
      getApiStats: async () => { sandboxLog('JobNimbus', 'getApiStats'); return { contacts: 6, jobs: 3, estimates: 0, tasks: 0 }; },
    };

    if (mocks[prop]) return mocks[prop];

    // Fallback — log and return empty
    return async (...args: unknown[]) => {
      sandboxLog('JobNimbus', prop, '(unmocked)', args);
      return null;
    };
  },
});

export const jobNimbusService = jnSandboxProxy;

// Export types for use elsewhere
export type { JobNimbusContact, JobNimbusJob, JobNimbusEstimate, JobNimbusTask, JobNimbusNote, JobNimbusAttachment, JobNimbusInvoice };
