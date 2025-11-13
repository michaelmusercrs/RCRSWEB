/**
 * Lead Dashboard API
 * Provides metrics and lead data for business intelligence dashboard
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  calculateDashboardMetrics,
  groupLeadsBySource,
  calculateInspectorMetrics,
  generateTimeSeriesData,
  getUrgentActions,
  type Lead,
} from '@/lib/dashboard-metrics';
import fs from 'fs/promises';
import path from 'path';

const DATA_FILE = path.join(process.cwd(), 'data', 'leads.json');

/**
 * Ensure data directory and file exist
 */
async function ensureDataFile() {
  const dataDir = path.join(process.cwd(), 'data');

  try {
    await fs.access(dataDir);
  } catch {
    await fs.mkdir(dataDir, { recursive: true });
  }

  try {
    await fs.access(DATA_FILE);
  } catch {
    // Create with sample data for demonstration
    const sampleLeads: Lead[] = [
      {
        id: '1',
        name: 'John Doe',
        email: 'john@example.com',
        phone: '256-555-0100',
        subject: 'Roof Replacement',
        message: 'Need urgent roof replacement after storm damage. Looking for quote as soon as possible.',
        preferredInspector: 'Rick Muse',
        timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
        status: 'new',
        score: 85,
        priority: 'hot',
        source: 'Website',
      },
      {
        id: '2',
        name: 'Jane Smith',
        email: 'jane@company.com',
        phone: '256-555-0200',
        subject: 'Roof Inspection',
        message: 'Want to schedule inspection for roof repair.',
        preferredInspector: 'First Available',
        timestamp: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000), // 1 day ago
        status: 'contacted',
        score: 70,
        priority: 'warm',
        source: 'Google',
        contactedAt: new Date(Date.now() - 23 * 60 * 60 * 1000),
      },
      {
        id: '3',
        name: 'Bob Johnson',
        email: 'bob@email.com',
        subject: 'Storm Damage',
        message: 'Have leak',
        timestamp: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), // 3 days ago
        status: 'won',
        score: 65,
        priority: 'warm',
        source: 'Referral',
        contactedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000 + 30 * 60 * 1000),
        scheduledAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
        quotedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
        closedAt: new Date(),
        revenue: 12500,
      },
    ];

    await fs.writeFile(DATA_FILE, JSON.stringify(sampleLeads, null, 2));
  }
}

/**
 * Read leads from JSON file
 */
async function readLeads(): Promise<Lead[]> {
  await ensureDataFile();
  const data = await fs.readFile(DATA_FILE, 'utf-8');
  return JSON.parse(data);
}

/**
 * Write leads to JSON file
 */
async function writeLeads(leads: Lead[]): Promise<void> {
  await ensureDataFile();
  await fs.writeFile(DATA_FILE, JSON.stringify(leads, null, 2));
}

/**
 * GET /api/dashboard/leads
 * Returns dashboard metrics and lead data
 */
export async function GET(req: NextRequest) {
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
