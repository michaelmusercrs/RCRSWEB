/**
 * RCRS Voicemail Transcription API
 *
 * Triggers AI transcription for a voicemail.
 * Currently uses mock transcription; structured for easy
 * integration with Google Gemini, OpenAI Whisper, or
 * Google Cloud Speech-to-Text.
 *
 * POST /api/voicemail/transcribe
 *
 * @author RCRS Development Team
 * @version 1.0.0
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-service';
import { voicemailService } from '@/lib/voicemail-service';

/**
 * POST /api/voicemail/transcribe
 *
 * Trigger transcription for a voicemail.
 *
 * Body:
 * - id (required): Voicemail ID to transcribe
 * - force: boolean - Re-transcribe even if already done
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth();
    if (!auth.authenticated) return auth.response;

    const body = await request.json();

    if (!body.id) {
      return NextResponse.json(
        { error: 'Voicemail id is required' },
        { status: 400 }
      );
    }

    // Check if voicemail exists
    const existing = await voicemailService.getById(body.id);
    if (!existing) {
      return NextResponse.json(
        { error: 'Voicemail not found' },
        { status: 404 }
      );
    }

    // Skip if already transcribed (unless force=true)
    if (existing.transcription && !body.force) {
      return NextResponse.json({
        success: true,
        message: 'Voicemail already transcribed',
        voicemail: existing,
        alreadyTranscribed: true,
      });
    }

    // Perform transcription
    const transcribed = await voicemailService.transcribeVoicemail(body.id);

    if (!transcribed) {
      return NextResponse.json(
        { error: 'Failed to transcribe voicemail' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      voicemail: transcribed,
      alreadyTranscribed: false,
    });
  } catch (error) {
    console.error('[Voicemail Transcribe API] POST error:', error);
    return NextResponse.json(
      { error: 'Failed to transcribe voicemail' },
      { status: 500 }
    );
  }
}
