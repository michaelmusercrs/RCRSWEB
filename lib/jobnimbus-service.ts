// JobNimbus API Service
// Syncs contacts, jobs, and estimates with customer portal

const JOBNIMBUS_API_KEY = process.env.JOBNIMBUS_API_KEY;
const JOBNIMBUS_API_URL = 'https://app.jobnimbus.com/api1';

interface JobNimbusContact {
  jnid: string;
  first_name?: string;
  last_name?: string;
  display_name?: string;
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
  source?: string;
  created_at?: number;
  updated_at?: number;
}

interface JobNimbusJob {
  jnid: string;
  number?: string;
  name?: string;
  description?: string;
  status?: string;
  sales_rep?: string;
  sales_rep_name?: string;
  primary?: { jnid: string }; // Related contact
  address_line1?: string;
  address_line2?: string;
  city?: string;
  state_text?: string;
  zip?: string;
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
  primary?: { jnid: string }; // Related contact
  related?: { jnid: string }; // Related job
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
  primary?: { jnid: string };
}

class JobNimbusService {
  private async apiRequest<T>(
    endpoint: string,
    method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET',
    body?: object
  ): Promise<T> {
    if (!JOBNIMBUS_API_KEY) {
      throw new Error('JobNimbus API key not configured');
    }

    const response = await fetch(`${JOBNIMBUS_API_URL}${endpoint}`, {
      method,
      headers: {
        'Authorization': `Bearer ${JOBNIMBUS_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`JobNimbus API error: ${response.status} - ${error}`);
    }

    return response.json();
  }

  // Get all contacts
  async getContacts(params?: {
    limit?: number;
    offset?: number;
    since?: number; // Unix timestamp for updated_at filter
  }): Promise<{ count: number; results: JobNimbusContact[] }> {
    const query = new URLSearchParams();
    if (params?.limit) query.set('limit', params.limit.toString());
    if (params?.offset) query.set('offset', params.offset.toString());
    if (params?.since) query.set('since', params.since.toString());

    return this.apiRequest(`/contacts?${query.toString()}`);
  }

  // Get single contact
  async getContact(jnid: string): Promise<JobNimbusContact> {
    return this.apiRequest(`/contacts/${jnid}`);
  }

  // Get all jobs
  async getJobs(params?: {
    limit?: number;
    offset?: number;
    since?: number;
  }): Promise<{ count: number; results: JobNimbusJob[] }> {
    const query = new URLSearchParams();
    if (params?.limit) query.set('limit', params.limit.toString());
    if (params?.offset) query.set('offset', params.offset.toString());
    if (params?.since) query.set('since', params.since.toString());

    return this.apiRequest(`/jobs?${query.toString()}`);
  }

  // Get single job
  async getJob(jnid: string): Promise<JobNimbusJob> {
    return this.apiRequest(`/jobs/${jnid}`);
  }

  // Get jobs for a contact
  async getJobsForContact(contactJnid: string): Promise<JobNimbusJob[]> {
    const result = await this.apiRequest<{ results: JobNimbusJob[] }>(
      `/jobs?filter=primary.jnid:"${contactJnid}"`
    );
    return result.results;
  }

  // Get estimates
  async getEstimates(params?: {
    limit?: number;
    offset?: number;
    since?: number;
  }): Promise<{ count: number; results: JobNimbusEstimate[] }> {
    const query = new URLSearchParams();
    if (params?.limit) query.set('limit', params.limit.toString());
    if (params?.offset) query.set('offset', params.offset.toString());
    if (params?.since) query.set('since', params.since.toString());

    return this.apiRequest(`/estimates?${query.toString()}`);
  }

  // Get estimate by ID
  async getEstimate(jnid: string): Promise<JobNimbusEstimate> {
    return this.apiRequest(`/estimates/${jnid}`);
  }

  // Get estimates for a contact
  async getEstimatesForContact(contactJnid: string): Promise<JobNimbusEstimate[]> {
    const result = await this.apiRequest<{ results: JobNimbusEstimate[] }>(
      `/estimates?filter=primary.jnid:"${contactJnid}"`
    );
    return result.results;
  }

  // Get tasks/appointments
  async getTasks(params?: {
    limit?: number;
    offset?: number;
    since?: number;
  }): Promise<{ count: number; results: JobNimbusTask[] }> {
    const query = new URLSearchParams();
    if (params?.limit) query.set('limit', params.limit.toString());
    if (params?.offset) query.set('offset', params.offset.toString());
    if (params?.since) query.set('since', params.since.toString());

    return this.apiRequest(`/tasks?${query.toString()}`);
  }

  // Get tasks for a contact
  async getTasksForContact(contactJnid: string): Promise<JobNimbusTask[]> {
    const result = await this.apiRequest<{ results: JobNimbusTask[] }>(
      `/tasks?filter=primary.jnid:"${contactJnid}"`
    );
    return result.results;
  }

  // Create a note on a contact
  async createNote(contactJnid: string, content: string): Promise<any> {
    return this.apiRequest('/notes', 'POST', {
      primary: { jnid: contactJnid },
      content,
      type: 'note',
    });
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

  // Sync all contacts since a given timestamp
  async syncContacts(since?: number): Promise<JobNimbusContact[]> {
    const allContacts: JobNimbusContact[] = [];
    let offset = 0;
    const limit = 100;
    let hasMore = true;

    while (hasMore) {
      const result = await this.getContacts({ limit, offset, since });
      allContacts.push(...result.results);
      offset += limit;
      hasMore = result.results.length === limit;
    }

    return allContacts;
  }
}

export const jobNimbusService = new JobNimbusService();
