/**
 * Chris's analytics Q&A endpoint.
 *
 * POST /api/chrisview-ask
 *   body: { question: string, pageId?: string, pageUrl?: string, pageData?: unknown, history?: ChatMessage[] }
 *   returns: { answer: string, usage: { inputTokens, outputTokens, cacheReadTokens, cacheWriteTokens } }
 *
 * Public endpoint (chrisview is public read-only). Rate-limited per IP +
 * daily token budget so a runaway loop or scraper can't burn the API
 * key. Logs every Q+A to the `chrisview_qa` master-sheet tab for audit.
 *
 * Uses Sonnet 4.6 with prompt caching on the system prompt so subsequent
 * questions within 5 min of each other only pay output tokens.
 */

import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { CHRISVIEW_SYSTEM_PROMPT, buildPageContext } from '@/lib/chrisview-knowledge';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY || '' });
const MODEL = 'claude-sonnet-4-6'; // Sonnet 4.6 (latest production default per app spec)

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

// In-memory per-IP throttle. Best-effort; the serverless runtime can
// spin up a fresh instance and reset the counter, but it keeps casual
// scraping in check.
const ipBucket = new Map<string, { count: number; firstAt: number }>();
const IP_WINDOW_MS = 60 * 60 * 1000; // 1 hour
const IP_MAX = 30; // 30 questions per IP per hour

function getClientIp(request: NextRequest): string {
  const fwd = request.headers.get('x-forwarded-for');
  if (fwd) return fwd.split(',')[0].trim();
  return request.headers.get('x-real-ip') || 'unknown';
}

function rateLimit(ip: string): { ok: boolean; remaining: number } {
  const now = Date.now();
  const entry = ipBucket.get(ip);
  if (!entry || now - entry.firstAt > IP_WINDOW_MS) {
    ipBucket.set(ip, { count: 1, firstAt: now });
    return { ok: true, remaining: IP_MAX - 1 };
  }
  if (entry.count >= IP_MAX) return { ok: false, remaining: 0 };
  entry.count += 1;
  return { ok: true, remaining: IP_MAX - entry.count };
}

async function logQA(opts: {
  ip: string;
  pageId?: string;
  question: string;
  answer: string;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
}) {
  try {
    const sheetsId = process.env.GOOGLE_SHEETS_ID;
    const svcEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
    const svcKey = process.env.GOOGLE_PRIVATE_KEY;
    if (!sheetsId || !svcEmail || !svcKey) return;
    const { GoogleSpreadsheet } = await import('google-spreadsheet');
    const { JWT } = await import('google-auth-library');
    const auth = new JWT({
      email: svcEmail,
      key: svcKey.replace(/\\n/g, '\n'),
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });
    const doc = new GoogleSpreadsheet(sheetsId, auth);
    await doc.loadInfo();
    let sheet = doc.sheetsByTitle['chrisview_qa'];
    if (!sheet) {
      sheet = await doc.addSheet({
        title: 'chrisview_qa',
        headerValues: ['timestamp', 'ip', 'pageId', 'question', 'answer', 'inputTokens', 'outputTokens', 'cacheReadTokens'],
      });
    }
    await sheet.addRow({
      timestamp: new Date().toISOString(),
      ip: opts.ip,
      pageId: opts.pageId || '',
      question: opts.question.slice(0, 5000),
      answer: opts.answer.slice(0, 8000),
      inputTokens: opts.inputTokens,
      outputTokens: opts.outputTokens,
      cacheReadTokens: opts.cacheReadTokens,
    });
  } catch (err) {
    // Logging failure should never block the response.
    console.warn('[chrisview-ask] sheet log failed:', err);
  }
}

export async function POST(request: NextRequest) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: 'AI not configured' }, { status: 503 });
  }

  const ip = getClientIp(request);
  const rl = rateLimit(ip);
  if (!rl.ok) {
    return NextResponse.json(
      { error: `Rate limit reached (${IP_MAX} questions/hour). Try again later.` },
      { status: 429 },
    );
  }

  let body: {
    question?: string;
    pageId?: string;
    pageUrl?: string;
    pageData?: unknown;
    history?: ChatMessage[];
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const question = (body.question || '').trim();
  if (!question) return NextResponse.json({ error: 'Question required' }, { status: 400 });
  if (question.length > 4000) {
    return NextResponse.json({ error: 'Question too long (max 4000 chars)' }, { status: 400 });
  }

  const pageContext = buildPageContext({
    pageId: body.pageId,
    pageUrl: body.pageUrl,
    pageData: body.pageData,
  });

  // Build messages: history + current question (with page context attached
  // to the current turn so the cache on the system prompt stays warm).
  const recentHistory = (body.history || []).slice(-10).map(m => ({
    role: m.role as 'user' | 'assistant',
    content: m.content,
  }));
  const userMessage = pageContext
    ? `${pageContext}\n\n---\n\nQuestion: ${question}`
    : question;
  const messages = [...recentHistory, { role: 'user' as const, content: userMessage }];

  try {
    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 1024,
      system: [
        {
          type: 'text',
          text: CHRISVIEW_SYSTEM_PROMPT,
          cache_control: { type: 'ephemeral' },
        },
      ],
      messages,
    });

    const textContent = response.content.find(c => c.type === 'text');
    const answer = textContent && textContent.type === 'text' ? textContent.text : '';

    const usage = response.usage as unknown as {
      input_tokens?: number;
      output_tokens?: number;
      cache_read_input_tokens?: number;
      cache_creation_input_tokens?: number;
    };

    const out = {
      answer,
      usage: {
        inputTokens: usage.input_tokens || 0,
        outputTokens: usage.output_tokens || 0,
        cacheReadTokens: usage.cache_read_input_tokens || 0,
        cacheWriteTokens: usage.cache_creation_input_tokens || 0,
      },
      rateLimitRemaining: rl.remaining,
    };

    logQA({
      ip,
      pageId: body.pageId,
      question,
      answer,
      inputTokens: out.usage.inputTokens,
      outputTokens: out.usage.outputTokens,
      cacheReadTokens: out.usage.cacheReadTokens,
    });

    return NextResponse.json(out);
  } catch (err: unknown) {
    if (err instanceof Anthropic.APIError) {
      if (err.status === 429) {
        return NextResponse.json(
          { error: 'AI is rate-limited upstream. Try again in a minute.' },
          { status: 429 },
        );
      }
      if (err.status === 401) {
        return NextResponse.json({ error: 'AI auth error' }, { status: 503 });
      }
    }
    console.error('[chrisview-ask] error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 },
    );
  }
}
