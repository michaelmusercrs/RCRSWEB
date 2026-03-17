import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-service';
import { googleSheetsService } from '@/lib/google-sheets-service';
import { cache, CACHE_TTL } from '@/lib/cache';

function generateId(): string {
  return `AGT-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`.toUpperCase();
}

// GET - List agents and optionally their visits
export async function GET(request: NextRequest) {
  const auth = await requireAuth();
  if (!auth.authenticated) return auth.response;

  try {
    const { searchParams } = new URL(request.url);
    const includeVisits = searchParams.get('includeVisits') === 'true';
    const agentId = searchParams.get('agentId');

    const cacheKey = `cc:agents:${agentId || 'all'}:${includeVisits}`;
    const cached = cache.get(cacheKey);
    if (cached) return NextResponse.json(cached, { headers: { 'Cache-Control': 'private, s-maxage=30' } });

    if (agentId) {
      // Get single agent with visits
      const agents = await googleSheetsService.getAgents();
      const agent = agents.find(a => a.id === agentId);
      if (!agent) {
        return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
      }
      const visits = await googleSheetsService.getAgentVisits(agentId);
      const response = { agent, visits };
      cache.set(cacheKey, response, CACHE_TTL.TEAM);
      return NextResponse.json(response, { headers: { 'Cache-Control': 'private, s-maxage=30' } });
    }

    const agents = await googleSheetsService.getAgents();

    let visits: Record<string, string>[] = [];
    if (includeVisits) {
      visits = await googleSheetsService.getAgentVisits();
    }

    // Calculate stats per agent
    const agentStats = agents.map(agent => {
      const agentVisits = visits.filter(v => v.agentId === agent.id);
      const totalJobs = agentVisits.reduce((sum, v) => sum + (parseInt(v.jobsReferred) || 0), 0);
      const sortedVisits = [...agentVisits].sort((a, b) =>
        new Date(b.visitDate).getTime() - new Date(a.visitDate).getTime()
      );
      return {
        id: agent.id,
        name: agent.name,
        company: agent.company,
        phone: agent.phone,
        email: agent.email,
        address: agent.address,
        notes: agent.notes,
        isActive: agent.isActive,
        assignedRep: agent.assignedRep,
        createdAt: agent.createdAt,
        updatedAt: agent.updatedAt,
        visitCount: agentVisits.length,
        totalJobsReferred: totalJobs,
        lastVisit: sortedVisits.length > 0 ? sortedVisits[0].visitDate : null,
      };
    });

    // Leaderboard sorted by total jobs referred
    const leaderboard = agentStats
      .filter(a => a.isActive === 'true')
      .sort((a, b) => b.totalJobsReferred - a.totalJobsReferred)
      .map((agent, idx) => ({
        rank: idx + 1,
        name: agent.name,
        company: agent.company,
        totalJobs: agent.totalJobsReferred,
        visits: agent.visitCount,
      }));

    const response = {
      agents: agentStats,
      leaderboard,
      totalAgents: agents.length,
      activeAgents: agents.filter(a => a.isActive === 'true').length,
    };
    cache.set(cacheKey, response, CACHE_TTL.TEAM);
    return NextResponse.json(response, { headers: { 'Cache-Control': 'private, s-maxage=30' } });
  } catch (error) {
    console.error('Error fetching agents:', error);
    return NextResponse.json({ error: 'Failed to fetch agents' }, { status: 500 });
  }
}

// POST - Create agent or log visit
export async function POST(request: NextRequest) {
  const auth = await requireAuth();
  if (!auth.authenticated) return auth.response;

  try {
    const body = await request.json();
    const { action } = body;

    if (action === 'log-visit') {
      const { agentId, agentName, visitedBy, visitDate, notes, jobsReferred, followUpDate } = body;

      if (!agentId || !visitedBy) {
        return NextResponse.json({ error: 'agentId and visitedBy are required' }, { status: 400 });
      }

      const visit = {
        id: `VIS-${Date.now().toString(36)}`.toUpperCase(),
        agentId,
        agentName: agentName || '',
        visitedBy,
        visitDate: visitDate || new Date().toISOString().split('T')[0],
        notes: notes || '',
        jobsReferred: String(jobsReferred || 0),
        followUpDate: followUpDate || '',
      };

      const success = await googleSheetsService.logAgentVisit(visit);
      if (!success) {
        return NextResponse.json({ error: 'Failed to log visit' }, { status: 500 });
      }

      cache.invalidatePattern('^cc:agents:');
      return NextResponse.json({ success: true, visit });
    }

    // Default: create agent
    const { name, company, phone, email, address, notes, assignedRep } = body;

    if (!name) {
      return NextResponse.json({ error: 'Agent name is required' }, { status: 400 });
    }

    const agent = {
      id: generateId(),
      name,
      company: company || '',
      phone: phone || '',
      email: email || '',
      address: address || '',
      notes: notes || '',
      isActive: 'true',
      assignedRep: assignedRep || '',
    };

    const success = await googleSheetsService.saveAgent(agent);
    if (!success) {
      return NextResponse.json({ error: 'Failed to save agent' }, { status: 500 });
    }

    cache.invalidatePattern('^cc:agents:');
    return NextResponse.json({ success: true, agent });
  } catch (error) {
    console.error('Error creating agent/visit:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PUT - Update agent
export async function PUT(request: NextRequest) {
  const auth = await requireAuth();
  if (!auth.authenticated) return auth.response;

  try {
    const body = await request.json();
    const { id, ...updates } = body;

    if (!id) {
      return NextResponse.json({ error: 'Agent ID is required' }, { status: 400 });
    }

    const success = await googleSheetsService.saveAgent({ id, ...updates });
    if (!success) {
      return NextResponse.json({ error: 'Failed to update agent' }, { status: 500 });
    }

    cache.invalidatePattern('^cc:agents:');
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating agent:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
