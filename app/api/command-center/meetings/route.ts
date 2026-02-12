/**
 * RCRS Command Center - Meetings API Route
 *
 * Handles meeting configuration, preparation data, and status management.
 *
 * GET: Returns meeting config, next meeting date, prep status
 * POST: Saves meeting prep data
 *
 * @author RCRS Development Team
 * @version 1.0.0
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-service';
import {
  getMeetingConfig,
  calculateNextMeetingDate,
  getISODate,
  getRandomBibleVerse,
  getBibleVerseByWeek,
  getWeekNumber,
  SLIDES,
  DEFAULT_AGENDA,
  MeetingPrepData,
  MeetingConfig,
} from '@/lib/meeting-data';

// =============================================================================
// In-Memory Storage (Replace with database in production)
// =============================================================================

// Store meeting prep data by meeting date
const meetingPrepStorage: Map<string, MeetingPrepData> = new Map();

// Track last presented meeting
let lastPresentedMeeting: string | null = null;

// =============================================================================
// Helper Functions
// =============================================================================

function generateMeetingId(date: string): string {
  return `meeting-${date}`;
}

function getMeetingPrepStatus(meetingDate: string): 'not-started' | 'in-progress' | 'ready' {
  const prep = meetingPrepStorage.get(meetingDate);
  if (!prep) return 'not-started';
  return prep.status === 'ready' ? 'ready' : 'in-progress';
}

// =============================================================================
// GET Handler - Retrieve Meeting Configuration
// =============================================================================

export async function GET(request: NextRequest) {
  const auth = await requireAuth();
  if (!auth.authenticated) return auth.response;

  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');

    // Get specific prep data
    if (action === 'prep') {
      const dateParam = searchParams.get('date');
      const nextMeeting = calculateNextMeetingDate();
      const meetingDate = dateParam || getISODate(nextMeeting);

      const prepData = meetingPrepStorage.get(meetingDate);

      if (!prepData) {
        // Return default template with pre-filled values
        const weekNum = getWeekNumber(new Date(meetingDate));
        const verse = getBibleVerseByWeek(weekNum);

        const defaultPrep: MeetingPrepData = {
          ...DEFAULT_AGENDA,
          id: generateMeetingId(meetingDate),
          meetingDate,
          bibleVerse: verse,
          useRandomVerse: false,
        };

        return NextResponse.json({
          success: true,
          data: defaultPrep,
          isNew: true,
          timestamp: new Date().toISOString(),
        });
      }

      return NextResponse.json({
        success: true,
        data: prepData,
        isNew: false,
        timestamp: new Date().toISOString(),
      });
    }

    // Get slides list
    if (action === 'slides') {
      return NextResponse.json({
        success: true,
        data: {
          slides: SLIDES,
          totalSlides: SLIDES.length,
          totalDuration: SLIDES.reduce((sum, s) => sum + s.duration, 0),
        },
        timestamp: new Date().toISOString(),
      });
    }

    // Get random verse
    if (action === 'verse') {
      const verse = getRandomBibleVerse();
      return NextResponse.json({
        success: true,
        data: verse,
        timestamp: new Date().toISOString(),
      });
    }

    // Default: Return full meeting configuration
    const config = getMeetingConfig();
    const nextMeeting = calculateNextMeetingDate();
    const meetingDate = getISODate(nextMeeting);

    // Override prep status with actual stored value
    const prepStatus = getMeetingPrepStatus(meetingDate);
    const enhancedConfig: MeetingConfig & {
      slides: typeof SLIDES;
      totalSlides: number;
      estimatedDuration: number;
      prepData: MeetingPrepData | null;
    } = {
      ...config,
      currentPrepStatus: prepStatus,
      lastMeetingDate: lastPresentedMeeting || config.lastMeetingDate,
      slides: SLIDES,
      totalSlides: SLIDES.length,
      estimatedDuration: Math.round(SLIDES.reduce((sum, s) => sum + s.duration, 0) / 60),
      prepData: meetingPrepStorage.get(meetingDate) || null,
    };

    return NextResponse.json({
      success: true,
      data: enhancedConfig,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[Meetings API] GET error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to retrieve meeting configuration',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

// =============================================================================
// POST Handler - Save Meeting Prep Data
// =============================================================================

export async function POST(request: NextRequest) {
  const auth = await requireAuth();
  if (!auth.authenticated) return auth.response;

  try {
    const body = await request.json();
    const { action, data } = body;

    // Save meeting prep
    if (action === 'save-prep') {
      const prepData = data as Partial<MeetingPrepData>;

      if (!prepData.meetingDate) {
        return NextResponse.json(
          {
            success: false,
            error: 'Meeting date is required',
          },
          { status: 400 }
        );
      }

      // Get existing or create new
      const existing = meetingPrepStorage.get(prepData.meetingDate);
      const meetingId = existing?.id || generateMeetingId(prepData.meetingDate);

      const updatedPrep: MeetingPrepData = {
        ...DEFAULT_AGENDA,
        ...existing,
        ...prepData,
        id: meetingId,
        preparedAt: new Date().toISOString(),
      };

      // Handle random verse selection
      if (updatedPrep.useRandomVerse) {
        updatedPrep.bibleVerse = getRandomBibleVerse();
      }

      // Save to storage
      meetingPrepStorage.set(prepData.meetingDate, updatedPrep);

      return NextResponse.json({
        success: true,
        data: updatedPrep,
        message: 'Meeting prep saved successfully',
        timestamp: new Date().toISOString(),
      });
    }

    // Mark meeting as ready
    if (action === 'mark-ready') {
      const { meetingDate } = data;

      if (!meetingDate) {
        return NextResponse.json(
          {
            success: false,
            error: 'Meeting date is required',
          },
          { status: 400 }
        );
      }

      const prep = meetingPrepStorage.get(meetingDate);
      if (!prep) {
        return NextResponse.json(
          {
            success: false,
            error: 'No prep data found for this meeting date',
          },
          { status: 404 }
        );
      }

      prep.status = 'ready';
      meetingPrepStorage.set(meetingDate, prep);

      return NextResponse.json({
        success: true,
        data: prep,
        message: 'Meeting marked as ready',
        timestamp: new Date().toISOString(),
      });
    }

    // Mark meeting as presented
    if (action === 'mark-presented') {
      const { meetingDate } = data;

      if (!meetingDate) {
        return NextResponse.json(
          {
            success: false,
            error: 'Meeting date is required',
          },
          { status: 400 }
        );
      }

      const prep = meetingPrepStorage.get(meetingDate);
      if (prep) {
        prep.status = 'presented';
        meetingPrepStorage.set(meetingDate, prep);
      }

      lastPresentedMeeting = meetingDate;

      return NextResponse.json({
        success: true,
        message: 'Meeting marked as presented',
        lastPresentedMeeting: meetingDate,
        timestamp: new Date().toISOString(),
      });
    }

    // Unknown action
    return NextResponse.json(
      {
        success: false,
        error: `Unknown action: ${action}`,
      },
      { status: 400 }
    );
  } catch (error) {
    console.error('[Meetings API] POST error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to save meeting data',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
