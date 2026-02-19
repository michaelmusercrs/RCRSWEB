import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, AuthUser } from '@/lib/auth-service';
import { TeamRole, TEAM_MEMBERS } from '@/lib/team-roles';

// =============================================================================
// JobNimbus API helpers
// =============================================================================

const JN_BASE = 'https://app.jobnimbus.com/api1';
const JN_KEY = process.env.JOBNIMBUS_API_KEY || 'mb3blj22awhl50rc';

async function jnFetch(endpoint: string, params?: Record<string, string>) {
  const url = new URL(`${JN_BASE}${endpoint}`);
  if (params) {
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  }
  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${JN_KEY}` },
    next: { revalidate: 0 },
  });
  if (!res.ok) throw new Error(`JobNimbus ${endpoint} ${res.status}`);
  return res.json();
}

// =============================================================================
// Role-based access helpers
// =============================================================================

type AccessLevel = 'all' | 'own' | 'assigned' | 'none';

function getAccessLevel(role: string): AccessLevel {
  switch (role) {
    case 'owner':
    case 'admin':
    case 'manager':
    case 'office':
      return 'all';
    case 'sales':
      return 'own';
    case 'project_manager':
      return 'assigned';
    case 'driver':
      return 'assigned';
    default:
      return 'none';
  }
}

function getAccessLabel(role: string): string {
  switch (role) {
    case 'owner':
    case 'admin':
      return 'Full Access';
    case 'manager':
    case 'office':
      return 'All Data';
    case 'sales':
      return 'Your Jobs & Leads';
    case 'project_manager':
      return 'Assigned Jobs';
    case 'driver':
      return 'Your Deliveries';
    default:
      return 'Limited';
  }
}

// =============================================================================
// Quick actions by role
// =============================================================================

interface QuickAction {
  label: string;
  query: string;
}

function getQuickActions(role: string): QuickAction[] {
  switch (role) {
    case 'sales':
      return [
        { label: 'My Leads', query: 'Show my leads' },
        { label: 'My Jobs', query: 'Show my jobs' },
        { label: 'My Commissions', query: 'Show my recent closed jobs' },
        { label: 'Response Times', query: 'How quickly am I responding to leads?' },
      ];
    case 'office':
      return [
        { label: 'All Leads Today', query: 'Show all leads from today' },
        { label: 'Unassigned Leads', query: 'Show unassigned leads' },
        { label: 'Pending Invoices', query: 'Show pending invoices' },
      ];
    case 'driver':
      return [
        { label: 'My Deliveries', query: 'Show my deliveries' },
        { label: 'Route Today', query: 'What deliveries do I have today?' },
      ];
    case 'project_manager':
      return [
        { label: 'Job Schedule', query: 'Show my job schedule' },
        { label: 'Material Orders', query: 'Show pending material orders' },
      ];
    case 'owner':
    case 'admin':
      return [
        { label: 'Company Dashboard', query: 'Show company overview' },
        { label: 'Team Performance', query: 'Show team performance summary' },
        { label: 'All Leads', query: 'Show all recent leads' },
      ];
    case 'manager':
      return [
        { label: 'Company Dashboard', query: 'Show company overview' },
        { label: 'Team Performance', query: 'Show team performance summary' },
        { label: 'All Leads', query: 'Show all recent leads' },
      ];
    default:
      return [
        { label: 'My Jobs', query: 'Show my jobs' },
        { label: "Today's Schedule", query: 'What is on the schedule today?' },
      ];
  }
}

// =============================================================================
// Intent parsing
// =============================================================================

type Intent =
  | 'list_jobs'
  | 'list_leads'
  | 'list_contacts'
  | 'search_customer'
  | 'job_status'
  | 'overview'
  | 'team_performance'
  | 'unknown';

interface ParsedQuery {
  intent: Intent;
  searchTerm?: string;
  status?: string;
  limit: number;
}

function parseMessage(message: string): ParsedQuery {
  const lower = message.toLowerCase().trim();
  let limit = 10;

  // Check for number limits
  const numMatch = lower.match(/(?:show|list|get|top)\s+(\d+)/);
  if (numMatch) limit = Math.min(parseInt(numMatch[1]), 50);

  // Job status lookup
  const jobNumMatch = lower.match(/(?:job|order|#)\s*(\d{3,})/);
  if (jobNumMatch) {
    return { intent: 'job_status', searchTerm: jobNumMatch[1], limit: 1 };
  }

  // Customer search
  const customerPatterns = [
    /(?:find|search|look up|lookup|customer|contact)\s+(?:for\s+)?["']?([a-z][a-z\s]+?)["']?$/,
    /(?:who is|info on|details for)\s+["']?([a-z][a-z\s]+?)["']?$/,
  ];
  for (const pat of customerPatterns) {
    const m = lower.match(pat);
    if (m) return { intent: 'search_customer', searchTerm: m[1].trim(), limit };
  }

  // Status filter
  let status: string | undefined;
  if (lower.includes('pending')) status = 'Pending';
  else if (lower.includes('closed') || lower.includes('won')) status = 'Closed';
  else if (lower.includes('open') || lower.includes('active')) status = 'Open';
  else if (lower.includes('unassigned')) status = 'Unassigned';

  // Intent detection
  if (lower.includes('overview') || lower.includes('dashboard') || lower.includes('summary') || lower.includes('company')) {
    return { intent: 'overview', limit };
  }
  if (lower.includes('team') || lower.includes('performance') || lower.includes('rep')) {
    return { intent: 'team_performance', limit };
  }
  if (lower.includes('lead')) {
    return { intent: 'list_leads', status, limit };
  }
  if (lower.includes('contact') || lower.includes('customer')) {
    return { intent: 'list_contacts', status, limit };
  }
  if (lower.includes('job') || lower.includes('order') || lower.includes('delivery') || lower.includes('deliveries') || lower.includes('schedule') || lower.includes('invoice') || lower.includes('commission')) {
    return { intent: 'list_jobs', status, limit };
  }

  return { intent: 'unknown', limit };
}

// =============================================================================
// Data fetching & response building
// =============================================================================

interface ChatResponse {
  message: string;
  data?: Record<string, unknown>[];
  suggestedQuestions: string[];
}

async function handleQuery(
  parsed: ParsedQuery,
  user: AuthUser,
  accessLevel: AccessLevel
): Promise<ChatResponse> {
  const userName = user.name;

  try {
    switch (parsed.intent) {
      case 'job_status': {
        const data = await jnFetch('/jobs', { 'filter[number]': parsed.searchTerm! });
        const jobs = data.results || [];
        if (jobs.length === 0) {
          return {
            message: `No job found with number **${parsed.searchTerm}**.`,
            suggestedQuestions: ['Show my jobs', 'Search by customer name'],
          };
        }
        const job = jobs[0];
        return {
          message: formatJobDetail(job),
          data: [job],
          suggestedQuestions: [
            `Find customer ${job.display_name || job.first_name || ''}`,
            'Show my jobs',
          ],
        };
      }

      case 'search_customer': {
        const data = await jnFetch('/contacts', {
          'filter[display_name]': parsed.searchTerm!,
        });
        let contacts = data.results || [];
        if (accessLevel === 'own') {
          contacts = contacts.filter(
            (c: Record<string, unknown>) =>
              String(c.sales_rep || '').toLowerCase().includes(userName.toLowerCase())
          );
        }
        if (contacts.length === 0) {
          return {
            message: `No contacts found matching **"${parsed.searchTerm}"**.${accessLevel === 'own' ? ' (Searching your assigned contacts only)' : ''}`,
            suggestedQuestions: ['Show my leads', 'Show all contacts'],
          };
        }
        return {
          message: `Found **${contacts.length}** contact(s) matching "${parsed.searchTerm}":\n\n${contacts.slice(0, parsed.limit).map(formatContactSummary).join('\n')}`,
          data: contacts.slice(0, parsed.limit),
          suggestedQuestions: contacts.length > 0
            ? [`Show jobs for ${contacts[0].display_name || contacts[0].first_name}`, 'Show my leads']
            : ['Show my leads'],
        };
      }

      case 'list_leads':
      case 'list_contacts': {
        const params: Record<string, string> = {};
        if (parsed.status) params['filter[status_name]'] = parsed.status;
        if (accessLevel === 'own') params['filter[sales_rep]'] = userName;

        const data = await jnFetch('/contacts', params);
        let contacts = data.results || [];

        // Sort by date_created descending
        contacts.sort((a: Record<string, unknown>, b: Record<string, unknown>) =>
          Number(b.date_created || 0) - Number(a.date_created || 0)
        );

        const sliced = contacts.slice(0, parsed.limit);
        const statusLabel = parsed.status ? ` with status "${parsed.status}"` : '';
        const scopeLabel = accessLevel === 'own' ? ' (your assignments)' : '';

        if (sliced.length === 0) {
          return {
            message: `No ${parsed.intent === 'list_leads' ? 'leads' : 'contacts'} found${statusLabel}${scopeLabel}.`,
            suggestedQuestions: ['Show all leads', 'Show my jobs'],
          };
        }

        return {
          message: `📋 **${contacts.length} ${parsed.intent === 'list_leads' ? 'leads' : 'contacts'}** found${statusLabel}${scopeLabel}. Showing top ${sliced.length}:\n\n${sliced.map(formatContactSummary).join('\n')}`,
          data: sliced,
          suggestedQuestions: [
            'Show my jobs',
            sliced.length < contacts.length ? `Show top ${Math.min(parsed.limit + 10, 50)} leads` : 'Search for a customer',
          ],
        };
      }

      case 'list_jobs': {
        const params: Record<string, string> = {};
        if (parsed.status) params['filter[status_name]'] = parsed.status;
        if (accessLevel === 'own') params['filter[sales_rep]'] = userName;

        const data = await jnFetch('/jobs', params);
        let jobs = data.results || [];

        if (accessLevel === 'assigned') {
          jobs = jobs.filter(
            (j: Record<string, unknown>) =>
              String(j.sales_rep || '').toLowerCase().includes(userName.toLowerCase()) ||
              String(j.assigned || '').toLowerCase().includes(userName.toLowerCase())
          );
        }

        jobs.sort((a: Record<string, unknown>, b: Record<string, unknown>) =>
          Number(b.date_created || 0) - Number(a.date_created || 0)
        );

        const sliced = jobs.slice(0, parsed.limit);
        const statusLabel = parsed.status ? ` with status "${parsed.status}"` : '';
        const scopeLabel = accessLevel !== 'all' ? ' (your assignments)' : '';

        if (sliced.length === 0) {
          return {
            message: `No jobs found${statusLabel}${scopeLabel}.`,
            suggestedQuestions: ['Show my leads', 'Show all jobs'],
          };
        }

        return {
          message: `🔨 **${jobs.length} jobs** found${statusLabel}${scopeLabel}. Showing top ${sliced.length}:\n\n${sliced.map(formatJobSummary).join('\n')}`,
          data: sliced,
          suggestedQuestions: [
            'Show my leads',
            sliced.length < jobs.length ? `Show top ${Math.min(parsed.limit + 10, 50)} jobs` : 'Search for a customer',
          ],
        };
      }

      case 'overview': {
        if (accessLevel === 'none') {
          return { message: "You don't have access to company overview data.", suggestedQuestions: [] };
        }
        const [jobsData, contactsData] = await Promise.all([
          jnFetch('/jobs'),
          jnFetch('/contacts'),
        ]);
        const jobs = jobsData.results || [];
        const contacts = contactsData.results || [];

        const statusCounts: Record<string, number> = {};
        for (const j of jobs) {
          const s = String(j.status_name || 'Unknown');
          statusCounts[s] = (statusCounts[s] || 0) + 1;
        }

        const lines = [
          `📊 **Company Overview**`,
          ``,
          `**Total Jobs:** ${jobs.length}`,
          `**Total Contacts:** ${contacts.length}`,
          ``,
          `**Jobs by Status:**`,
          ...Object.entries(statusCounts).sort((a, b) => b[1] - a[1]).map(([s, c]) => `- ${s}: ${c}`),
        ];

        return {
          message: lines.join('\n'),
          suggestedQuestions: ['Show all leads', 'Team performance', 'Show recent jobs'],
        };
      }

      case 'team_performance': {
        if (accessLevel !== 'all') {
          return { message: "You don't have access to team performance data.", suggestedQuestions: ['Show my jobs'] };
        }
        const jobsData = await jnFetch('/jobs');
        const jobs = jobsData.results || [];

        const repCounts: Record<string, number> = {};
        for (const j of jobs) {
          const rep = String(j.sales_rep || 'Unassigned');
          repCounts[rep] = (repCounts[rep] || 0) + 1;
        }

        const lines = [
          `👥 **Team Performance Summary**`,
          ``,
          `**Jobs by Rep:**`,
          ...Object.entries(repCounts)
            .sort((a, b) => b[1] - a[1])
            .map(([rep, count]) => `- **${rep}**: ${count} jobs`),
        ];

        return {
          message: lines.join('\n'),
          suggestedQuestions: ['Show all leads', 'Company overview'],
        };
      }

      case 'unknown':
      default:
        return {
          message: `I'm not sure what you're looking for. Try asking about:\n\n- **Jobs** — "Show my jobs" or "Job #12345"\n- **Leads** — "Show my leads" or "Show open leads"\n- **Customers** — "Find customer John Smith"\n- **Overview** — "Company dashboard" or "Team performance"`,
          suggestedQuestions: getQuickActions(user.role).map(a => a.label),
        };
    }
  } catch (err) {
    console.error('AI Chat query error:', err);
    return {
      message: `⚠️ Sorry, I had trouble fetching that data. Please try again.`,
      suggestedQuestions: ['Show my jobs', 'Show my leads'],
    };
  }
}

// =============================================================================
// Formatters
// =============================================================================

function formatJobDetail(job: Record<string, unknown>): string {
  const lines = [
    `🔨 **Job #${job.number || 'N/A'}**`,
    '',
    `**Customer:** ${job.display_name || job.first_name || 'N/A'} ${job.last_name || ''}`.trim(),
    `**Status:** ${job.status_name || 'Unknown'}`,
    `**Sales Rep:** ${job.sales_rep || 'Unassigned'}`,
  ];
  if (job.address_line1) lines.push(`**Address:** ${job.address_line1}${job.city ? `, ${job.city}` : ''}`);
  if (job.description) lines.push(`**Description:** ${String(job.description).slice(0, 200)}`);
  if (job.date_created) {
    const d = new Date(Number(job.date_created) * 1000);
    lines.push(`**Created:** ${d.toLocaleDateString()}`);
  }
  return lines.join('\n');
}

function formatJobSummary(job: Record<string, unknown>): string {
  const num = job.number ? `#${job.number}` : '';
  const name = job.display_name || `${job.first_name || ''} ${job.last_name || ''}`.trim() || 'Unknown';
  const status = job.status_name || 'Unknown';
  const rep = job.sales_rep || 'Unassigned';
  return `- ${num} **${name}** — ${status} (${rep})`;
}

function formatContactSummary(contact: Record<string, unknown>): string {
  const name = contact.display_name || `${contact.first_name || ''} ${contact.last_name || ''}`.trim() || 'Unknown';
  const status = contact.status_name || 'Unknown';
  const rep = contact.sales_rep || 'Unassigned';
  const phone = contact.mobile_phone || contact.home_phone || '';
  return `- **${name}** — ${status}${rep !== 'Unassigned' ? ` (${rep})` : ''}${phone ? ` 📞 ${phone}` : ''}`;
}

// =============================================================================
// POST handler
// =============================================================================

export async function POST(request: NextRequest) {
  const auth = await requireAuth();
  if (!auth.authenticated) return auth.response;

  const user = auth.user;

  try {
    const body = await request.json();
    const { message, action } = body as {
      message?: string;
      action?: string;
      conversationHistory?: Array<{ role: string; content: string }>;
    };

    // If action === 'init', return quick actions and access info
    if (action === 'init') {
      return NextResponse.json({
        success: true,
        accessLevel: getAccessLabel(user.role),
        quickActions: getQuickActions(user.role),
        greeting: `Hi ${user.name.split(' ')[0]}! I'm your RoofStack Assistant. Ask me about jobs, leads, customers, or use the quick actions below.`,
      });
    }

    if (!message || typeof message !== 'string' || !message.trim()) {
      return NextResponse.json({ success: false, error: 'Message is required' }, { status: 400 });
    }

    const accessLevel = getAccessLevel(user.role);
    const parsed = parseMessage(message.trim());
    const response = await handleQuery(parsed, user, accessLevel);

    return NextResponse.json({
      success: true,
      response: response.message,
      data: response.data,
      suggestedQuestions: response.suggestedQuestions,
    });
  } catch (error) {
    console.error('AI Chat error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
