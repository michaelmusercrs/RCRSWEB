import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { RIVER_SYSTEM_PROMPT } from '@/lib/rcrs-knowledge';
import { checkRequestSize } from '@/lib/request-size-limit';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || '',
});

export const runtime = 'nodejs';
export const maxDuration = 30;

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export async function POST(request: NextRequest) {
  // SECURITY: Enforce request body size limit (chat messages can be large but not unbounded)
  const sizeError = checkRequestSize(request, '500kb');
  if (sizeError) return sizeError;

  try {
    const { messages, mode } = await request.json() as {
      messages: ChatMessage[];
      mode?: 'customer' | 'rep';
    };

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({ error: 'Messages are required' }, { status: 400 });
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json({ error: 'AI service not configured' }, { status: 503 });
    }

    // Add mode-specific context
    let systemPrompt = RIVER_SYSTEM_PROMPT;
    if (mode === 'rep') {
      systemPrompt += `\n\nIMPORTANT: This user is an RCRS sales rep or team member using you for training. Be detailed, tactical, and help them learn the business inside and out. Share specific techniques, scripts, and insider knowledge freely.`;
    }

    // Limit conversation history to last 20 messages to manage tokens
    const recentMessages = messages.slice(-20).map(m => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    }));

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      system: systemPrompt,
      messages: recentMessages,
    });

    const textContent = response.content.find(c => c.type === 'text');
    const reply = textContent?.text || 'Sorry, I had trouble generating a response. Please try again!';

    return NextResponse.json({ reply });
  } catch (error: unknown) {
    console.error('Chat API error:', error);
    
    if (error instanceof Anthropic.APIError) {
      if (error.status === 429) {
        return NextResponse.json({ error: 'I\'m getting a lot of questions right now! Please try again in a moment.' }, { status: 429 });
      }
      if (error.status === 401) {
        return NextResponse.json({ error: 'AI service authentication error' }, { status: 503 });
      }
    }

    return NextResponse.json({ error: 'Something went wrong. Please try again or call us at (256) 274-8530.' }, { status: 500 });
  }
}
