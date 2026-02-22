/**
 * Insurance Agent Database API
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-service';
import { insuranceAgentService, type AgentArea } from '@/lib/insurance-agent-service';

export async function GET(request: NextRequest) {
  const auth = await requireAuth();
  if (!auth.authenticated) return auth.response;

  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action') || 'list';

    switch (action) {
      case 'list': {
        const city = searchParams.get('city') as AgentArea | null;
        const company = searchParams.get('company') || undefined;
        const assignedRep = searchParams.get('assignedRep') || undefined;
        const unassigned = searchParams.get('unassigned') === 'true';
        const agents = await insuranceAgentService.getAgents({
          city: city || undefined, company, assignedRep, unassigned: unassigned || undefined,
        });
        return NextResponse.json(agents);
      }

      case 'agent': {
        const agentId = searchParams.get('agentId');
        if (!agentId) return NextResponse.json({ error: 'agentId required' }, { status: 400 });
        const agent = await insuranceAgentService.getAgentById(agentId);
        if (!agent) return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
        return NextResponse.json(agent);
      }

      case 'visits': {
        const agentId = searchParams.get('agentId') || undefined;
        const limit = parseInt(searchParams.get('limit') || '50');
        const visits = await insuranceAgentService.getVisits(agentId, limit);
        return NextResponse.json(visits);
      }

      case 'visitsByRep': {
        const repName = searchParams.get('repName');
        if (!repName) return NextResponse.json({ error: 'repName required' }, { status: 400 });
        const visits = await insuranceAgentService.getVisitsByRep(repName);
        return NextResponse.json(visits);
      }

      case 'suggest': {
        const location = searchParams.get('location') as AgentArea;
        if (!location) return NextResponse.json({ error: 'location required' }, { status: 400 });
        const repName = searchParams.get('repName') || undefined;
        const limit = parseInt(searchParams.get('limit') || '5');
        const suggestions = await insuranceAgentService.suggestVisits(location, repName, limit);
        return NextResponse.json(suggestions);
      }

      case 'areaSummary': {
        const summary = await insuranceAgentService.getAreaSummary();
        return NextResponse.json(summary);
      }

      case 'companySummary': {
        const summary = await insuranceAgentService.getCompanySummary();
        return NextResponse.json(summary);
      }

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    console.error('Insurance agents API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth();
  if (!auth.authenticated) return auth.response;

  try {
    const body = await request.json();
    const { action } = body;

    switch (action) {
      case 'addAgent': {
        const agent = await insuranceAgentService.addAgent(body.agent);
        return NextResponse.json(agent, { status: 201 });
      }

      case 'updateAgent': {
        const agent = await insuranceAgentService.updateAgent(body.agentId, body.updates);
        if (!agent) return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
        return NextResponse.json(agent);
      }

      case 'assignRep': {
        const agent = await insuranceAgentService.assignRep(body.agentId, body.repName);
        if (!agent) return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
        return NextResponse.json(agent);
      }

      case 'recordVisit': {
        const visit = await insuranceAgentService.recordVisit({
          agentId: body.agentId,
          visitedBy: auth.user.userId,
          visitedByName: auth.user.name,
          visitDate: body.visitDate || new Date().toISOString().split('T')[0],
          duration: body.duration,
          notes: body.notes || '',
          outcome: body.outcome,
          followUpDate: body.followUpDate,
        });
        return NextResponse.json(visit, { status: 201 });
      }

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    console.error('Insurance agents POST error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
