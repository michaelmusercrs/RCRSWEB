/**
 * RCRS Voicemail API
 *
 * Endpoints for listing and creating voicemails.
 *
 * GET  /api/voicemail - List voicemails with filters
 * POST /api/voicemail - Create a new voicemail (webhook or manual)
 *
 * @author RCRS Development Team
 * @version 1.0.0
 */

import { NextRequest, NextResponse } from 'next/server';
import { voicemailService } from '@/lib/voicemail-service';

/**
 * GET /api/voicemail
 *
 * List voicemails with optional filters.
 *
 * Query params:
 * - extension: Filter by extension number
 * - isRead: 'true' | 'false'
 * - isUrgent: 'true' | 'false'
 * - startDate: ISO date string
 * - endDate: ISO date string
 * - search: Search query (name, phone, transcription, notes)
 * - linkedJobId: Filter by linked job
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const filter: Record<string, unknown> = {};

    if (searchParams.get('extension')) {
      filter.extension = searchParams.get('extension')!;
    }
    if (searchParams.get('isRead') !== null && searchParams.get('isRead') !== undefined && searchParams.get('isRead') !== '') {
      filter.isRead = searchParams.get('isRead') === 'true';
    }
    if (searchParams.get('isUrgent') !== null && searchParams.get('isUrgent') !== undefined && searchParams.get('isUrgent') !== '') {
      filter.isUrgent = searchParams.get('isUrgent') === 'true';
    }
    if (searchParams.get('startDate')) {
      filter.startDate = searchParams.get('startDate')!;
    }
    if (searchParams.get('endDate')) {
      filter.endDate = searchParams.get('endDate')!;
    }
    if (searchParams.get('search')) {
      filter.searchQuery = searchParams.get('search')!;
    }
    if (searchParams.get('linkedJobId')) {
      filter.linkedJobId = searchParams.get('linkedJobId')!;
    }

    const voicemails = voicemailService.getAll(
      Object.keys(filter).length > 0 ? filter as any : undefined
    );

    const stats = voicemailService.getStats();

    return NextResponse.json({
      voicemails,
      stats,
      total: voicemails.length,
    });
  } catch (error) {
    console.error('[Voicemail API] GET error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch voicemails' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/voicemail
 *
 * Create a new voicemail record.
 * Called by phone system webhook or manual entry.
 *
 * Body:
 * - callerPhone (required)
 * - callerName
 * - extension
 * - callId
 * - duration
 * - audioUrl
 * - transcription
 * - isUrgent
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    if (!body.callerPhone) {
      return NextResponse.json(
        { error: 'callerPhone is required' },
        { status: 400 }
      );
    }

    const voicemail = voicemailService.create({
      callId: body.callId,
      callerPhone: body.callerPhone,
      callerName: body.callerName,
      extension: body.extension,
      timestamp: body.timestamp,
      duration: body.duration,
      audioUrl: body.audioUrl,
      transcription: body.transcription,
      isUrgent: body.isUrgent,
      linkedJobId: body.linkedJobId,
      linkedContactId: body.linkedContactId,
    });

    return NextResponse.json({
      success: true,
      voicemail,
    });
  } catch (error) {
    console.error('[Voicemail API] POST error:', error);
    return NextResponse.json(
      { error: 'Failed to create voicemail' },
      { status: 500 }
    );
  }
}
