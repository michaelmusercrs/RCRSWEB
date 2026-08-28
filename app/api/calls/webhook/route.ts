/**
 * RCRS Call Recording Webhook API
 *
 * Receives call events from the Google Voice PBX bridge system.
 * Supported events:
 * - call_start: New call initiated
 * - call_end: Call completed
 * - call_missed: Call was not answered
 * - voicemail: Call went to voicemail
 * - recording_ready: Call recording is available
 *
 * Security: Uses API key authentication
 *
 * @author RCRS Development Team
 * @version 1.0.0
 */

import { NextRequest, NextResponse } from 'next/server';
import { callsService, WebhookPayload } from '@/lib/calls-service';

// SECURITY 2026-05-20: was fail-open in non-production when CALLS_WEBHOOK_API_KEY
// was unset (any request accepted, "for development convenience"). The
// dev-mode loophole is removed: an unset env var now always rejects, in every
// environment. Production behavior (compare provided key to expected key) is
// unchanged. Caller distinguishes "webhook disabled" (503, no key configured)
// from "wrong key" (401, key mismatch).
type ApiKeyResult = 'ok' | 'not_configured' | 'invalid';

function validateApiKey(request: NextRequest): ApiKeyResult {
  const expectedKey = process.env.CALLS_WEBHOOK_API_KEY;

  if (!expectedKey) {
    console.error('[WEBHOOK FAIL-CLOSED route=calls] CRITICAL: CALLS_WEBHOOK_API_KEY is not set - webhook disabled, rejecting request');
    return 'not_configured';
  }

  const apiKey = request.headers.get('x-api-key') || request.headers.get('authorization')?.replace('Bearer ', '');
  return apiKey === expectedKey ? 'ok' : 'invalid';
}

/**
 * POST /api/calls/webhook
 *
 * Receive call events from PBX system
 */
export async function POST(request: NextRequest) {
  try {
    // Validate API key
    const auth = validateApiKey(request);
    if (auth === 'not_configured') {
      return NextResponse.json(
        { error: 'Service Unavailable', message: 'Webhook not configured' },
        { status: 503 }
      );
    }
    if (auth === 'invalid') {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'Invalid or missing API key' },
        { status: 401 }
      );
    }

    // Parse request body
    const payload: WebhookPayload = await request.json();

    // Validate required fields
    if (!payload.event) {
      return NextResponse.json(
        { error: 'Bad Request', message: 'Missing required field: event' },
        { status: 400 }
      );
    }

    const validEvents = ['call_start', 'call_end', 'call_missed', 'voicemail', 'recording_ready', 'transcript_ready'];
    if (!validEvents.includes(payload.event)) {
      return NextResponse.json(
        { error: 'Bad Request', message: `Invalid event type: ${payload.event}` },
        { status: 400 }
      );
    }

    // Default timestamp if not provided
    if (!payload.timestamp) {
      payload.timestamp = new Date().toISOString();
    }

    // Process the webhook
    const callRecord = await callsService.processWebhook(payload);
    return NextResponse.json({
      success: true,
      event: payload.event,
      callId: callRecord.callId,
      status: callRecord.status,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[Calls Webhook] Error:', error);
    return NextResponse.json(
      {
        error: 'Internal Server Error',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/calls/webhook
 *
 * Health check endpoint for monitoring
 */
export async function GET(request: NextRequest) {
  // Validate API key for status check too
  const auth = validateApiKey(request);
  if (auth === 'not_configured') {
    return NextResponse.json(
      { error: 'Service Unavailable', message: 'Webhook not configured' },
      { status: 503 }
    );
  }
  if (auth === 'invalid') {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }

  const stats = await callsService.getStats();

  return NextResponse.json({
    status: 'healthy',
    service: 'RCRS Calls Webhook',
    version: '1.0.0',
    stats: {
      totalCalls: stats.totalCalls,
      lastUpdated: stats.lastUpdated,
    },
    timestamp: new Date().toISOString(),
  });
}
