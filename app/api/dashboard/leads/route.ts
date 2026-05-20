/**
 * Lead Dashboard API
 * Provides metrics and lead data for business intelligence dashboard
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-service';
import {
  calculateDashboardMetrics,
  groupLeadsBySource,
  calculateInspectorMetrics,
  generateTimeSeriesData,
  getUrgentActions,
  type Lead,
} from '@/lib/dashboard-metrics';

const BLOB_KEY = 'data/leads.json';
const LOCAL_PATH = 'data/leads.json';

async function readData(key: string, localPath: string, defaultValue: any = []): Promise<any> {
  try {
    const { list } = await import('@vercel/blob');
    const blobs = await list({ prefix: key });
    if (blobs.blobs.length > 0) {
      const res = await fetch(blobs.blobs[0].url, { cache: 'no-store' });
      if (res.ok) return await res.json();
    }
  } catch (e) { /* blob not available */ }
  try {
    const fs = await import('fs');
    const path = await import('path');
    const filePath = path.join(process.cwd(), localPath);
    const data = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(data);
  } catch {
    return defaultValue;
  }
}

async function writeData(key: string, localPath: string, data: any): Promise<void> {
  // Vercel Blob is canonical; fs is dev-only fallback wrapped in try/catch.
  try {
    const { put } = await import('@vercel/blob');
    await put(key, JSON.stringify(data, null, 2), {
      access: 'public', contentType: 'application/json', addRandomSuffix: false, allowOverwrite: true,
    });
    return;
  } catch (e) {
    console.warn('[dashboard/leads] Blob write failed, attempting fs fallback:', e);
  }
  try {
    const fs = await import('fs');
    const path = await import('path');
    const filePath = path.join(process.cwd(), localPath);
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
  } catch (fsErr) {
    console.warn('[dashboard/leads] Local fs write skipped (read-only fs?):', fsErr);
  }
}

/**
 * Read leads
 */
async function readLeads(): Promise<Lead[]> {
  return await readData(BLOB_KEY, LOCAL_PATH, []);
}

/**
 * Write leads
 */
async function writeLeads(leads: Lead[]): Promise<void> {
  await writeData(BLOB_KEY, LOCAL_PATH, leads);
}

/**
 * GET /api/dashboard/leads
 * Returns dashboard metrics and lead data
 */
export async function GET(req: NextRequest) {
  const auth = await requireAuth();
  if (!auth.authenticated) return auth.response;

  try {
    const { searchParams } = new URL(req.url);
    const view = searchParams.get('view') || 'overview';
    const days = parseInt(searchParams.get('days') || '30');

    const leads = await readLeads();

    // Convert timestamp strings to Date objects
    const leadsWithDates = leads.map((lead) => ({
      ...lead,
      timestamp: new Date(lead.timestamp),
      contactedAt: lead.contactedAt ? new Date(lead.contactedAt) : undefined,
      scheduledAt: lead.scheduledAt ? new Date(lead.scheduledAt) : undefined,
      quotedAt: lead.quotedAt ? new Date(lead.quotedAt) : undefined,
      closedAt: lead.closedAt ? new Date(lead.closedAt) : undefined,
    }));

    if (view === 'overview') {
      // Return comprehensive dashboard data
      const metrics = calculateDashboardMetrics(leadsWithDates);
      const bySource = groupLeadsBySource(leadsWithDates);
      const byInspector = calculateInspectorMetrics(leadsWithDates);
      const timeSeries = generateTimeSeriesData(leadsWithDates, days);
      const urgentActions = getUrgentActions(leadsWithDates);

      return NextResponse.json({
        success: true,
        data: {
          metrics,
          bySource,
          byInspector,
          timeSeries,
          urgentActions,
          recentLeads: leadsWithDates
            .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
            .slice(0, 10),
        },
      });
    } else if (view === 'leads') {
      // Return full leads list
      const status = searchParams.get('status');
      const priority = searchParams.get('priority');

      let filtered = leadsWithDates;

      if (status && status !== 'all') {
        filtered = filtered.filter((l) => l.status === status);
      }

      if (priority && priority !== 'all') {
        filtered = filtered.filter((l) => l.priority === priority);
      }

      // Sort by timestamp (newest first)
      filtered.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

      return NextResponse.json({
        success: true,
        data: {
          leads: filtered,
          total: filtered.length,
        },
      });
    } else {
      return NextResponse.json(
        { success: false, error: 'Invalid view parameter' },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error('Error fetching dashboard data:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch dashboard data' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/dashboard/leads
 * Add a new lead (called from contact form)
 */
export async function POST(req: NextRequest) {
  // SECURITY 2026-05-20: was unauthenticated — legacy lead-write endpoint
  // with no honeypot/Turnstile/spam filter. Public POST = unlimited fake
  // leads dropped into the dashboard data. Gate to any authenticated team
  // member; the public contact form has its own validated endpoint.
  const auth = await requireAuth();
  if (!auth.authenticated) return auth.response;

  try {
    const body = await req.json();
    const leads = await readLeads();

    const newLead: Lead = {
      id: `lead-${Date.now()}`,
      name: body.name,
      email: body.email,
      phone: body.phone,
      subject: body.subject,
      message: body.message,
      preferredInspector: body.preferredInspector,
      timestamp: new Date(),
      status: 'new',
      score: body.score || 50,
      priority: body.priority || 'warm',
      source: body.source || 'Website',
    };

    leads.push(newLead);
    await writeLeads(leads);

    return NextResponse.json({
      success: true,
      lead: newLead,
    });
  } catch (error) {
    console.error('Error adding lead:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to add lead' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/dashboard/leads
 * Update a lead's status
 */
export async function PUT(req: NextRequest) {
  const auth = await requireAuth();
  if (!auth.authenticated) return auth.response;

  try {
    const body = await req.json();
    const { id, status, revenue, notes } = body;

    if (!id || !status) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const leads = await readLeads();
    const leadIndex = leads.findIndex((l) => l.id === id);

    if (leadIndex === -1) {
      return NextResponse.json(
        { success: false, error: 'Lead not found' },
        { status: 404 }
      );
    }

    const lead = leads[leadIndex];
    const now = new Date();

    // Update status and timestamps
    lead.status = status as any;
    if (notes) lead.notes = notes;
    if (revenue !== undefined) lead.revenue = revenue;

    // Set timestamps based on status transitions
    if (status === 'contacted' && !lead.contactedAt) {
      lead.contactedAt = now;
    } else if (status === 'scheduled' && !lead.scheduledAt) {
      lead.scheduledAt = now;
    } else if (status === 'quoted' && !lead.quotedAt) {
      lead.quotedAt = now;
    } else if ((status === 'won' || status === 'lost') && !lead.closedAt) {
      lead.closedAt = now;
    }

    leads[leadIndex] = lead;
    await writeLeads(leads);

    return NextResponse.json({
      success: true,
      lead,
    });
  } catch (error) {
    console.error('Error updating lead:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update lead' },
      { status: 500 }
    );
  }
}
