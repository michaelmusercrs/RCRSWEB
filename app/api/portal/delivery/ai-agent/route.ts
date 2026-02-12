/**
 * Delivery AI Agent API
 *
 * Provides AI-powered assistance for drivers and warehouse staff:
 * - Loading walkthrough generation
 * - Smart reminders by delivery phase
 * - Q&A for common driver questions
 * - Coaching tips and safety briefings
 * - Status narration for TTS
 * - Conversation topics
 * - Full delivery briefings
 */

import { NextRequest, NextResponse } from 'next/server';
import { validateSession } from '@/lib/auth-service';
import { DeliveryAIAgent } from '@/lib/delivery-ai-agent';

const agent = new DeliveryAIAgent();

export async function POST(request: NextRequest) {
  try {
    const session = await validateSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { action } = body;

    if (!action || typeof action !== 'string') {
      return NextResponse.json({ error: 'action parameter required (string)' }, { status: 400 });
    }

    switch (action) {
      case 'greeting': {
        const { driverName, daySummary } = body;
        if (!driverName || !daySummary) {
          return NextResponse.json({ error: 'driverName and daySummary required' }, { status: 400 });
        }
        const greeting = agent.generateGreeting(driverName, daySummary);
        return NextResponse.json({ greeting });
      }

      case 'loading-walkthrough': {
        const { ticket } = body;
        if (!ticket) {
          return NextResponse.json({ error: 'ticket data required' }, { status: 400 });
        }
        const walkthrough = agent.generateLoadingWalkthrough(ticket);
        return NextResponse.json(walkthrough);
      }

      case 'coaching': {
        const { ticket, weather } = body;
        if (!ticket) {
          return NextResponse.json({ error: 'ticket data required' }, { status: 400 });
        }
        const tips = agent.generateDeliveryCoaching(ticket, weather);
        const script = agent.generateCoachingScript(ticket, weather);
        return NextResponse.json({ tips, script });
      }

      case 'reminders': {
        const { ticket, phase, options } = body;
        if (!ticket || !phase) {
          return NextResponse.json({ error: 'ticket and phase required' }, { status: 400 });
        }
        const reminders = agent.getSmartReminders(ticket, phase, options);
        const script = agent.generateReminderScript(ticket, phase, options);
        return NextResponse.json({ reminders, script });
      }

      case 'question': {
        const { query } = body;
        if (!query) {
          return NextResponse.json({ error: 'query required' }, { status: 400 });
        }
        const result = agent.answerQuestion(query);
        return NextResponse.json(result);
      }

      case 'status-narration': {
        const { ticket, previousStatus, newStatus, driverName } = body;
        if (!ticket || !previousStatus || !newStatus) {
          return NextResponse.json({ error: 'ticket, previousStatus, and newStatus required' }, { status: 400 });
        }
        const narration = agent.narrateStatusChange(ticket, previousStatus, newStatus, driverName);
        return NextResponse.json({ narration });
      }

      case 'safety-tips': {
        const { options } = body;
        const tips = agent.getSafetyTips(options || {});
        const script = agent.generateSafetyScript(options || {});
        return NextResponse.json({ tips, script });
      }

      case 'conversation': {
        const count = body.count || 3;
        const topics = agent.getConversationTopics(count);
        return NextResponse.json({ topics });
      }

      case 'briefing': {
        const { ticket, driverName, options } = body;
        if (!ticket || !driverName) {
          return NextResponse.json({ error: 'ticket and driverName required' }, { status: 400 });
        }
        const briefing = agent.generateFullBriefing(ticket, driverName, options);
        return NextResponse.json({ briefing });
      }

      case 'weight-estimate': {
        const { materials } = body;
        if (!materials) {
          return NextResponse.json({ error: 'materials array required' }, { status: 400 });
        }
        const estimate = agent.estimateLoadWeight(materials);
        return NextResponse.json(estimate);
      }

      case 'available-questions': {
        const questions = agent.getAvailableQuestions();
        return NextResponse.json({ questions });
      }

      default: {
        const sanitizedAction = typeof action === 'string' ? action.replace(/[<>&"']/g, '') : 'invalid';
        return NextResponse.json(
          { error: `Unknown action: ${sanitizedAction}. Available: greeting, loading-walkthrough, coaching, reminders, question, status-narration, safety-tips, conversation, briefing, weight-estimate, available-questions` },
          { status: 400 }
        );
      }
    }
  } catch (error) {
    console.error('[AI Agent API] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const session = await validateSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    return NextResponse.json({
      agent: agent.getAgentInfo(),
      availableActions: [
        'greeting',
        'loading-walkthrough',
        'coaching',
        'reminders',
        'question',
        'status-narration',
        'safety-tips',
        'conversation',
        'briefing',
        'weight-estimate',
        'available-questions',
      ],
    });
  } catch (error) {
    console.error('[AI Agent API] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
