/**
 * RCRS Command Center - Meetings API Route
 *
 * Handles meeting configuration, preparation data, and status management.
 * Persists meeting prep data to Google Sheets (MeetingPrep tab).
 *
 * GET: Returns meeting config, next meeting date, prep status
 * POST: Saves meeting prep data
 *
 * @author RCRS Development Team
 * @version 2.0.0
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-service';
import { googleSheetsService } from '@/lib/google-sheets-service';
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
// Helper Functions
// =============================================================================

function generateMeetingId(date: string): string {
  return `meeting-${date}`;
}

/**
 * Deserialize a flat Google Sheets row into a MeetingPrepData object.
 */
function rowToPrepData(row: Record<string, string>, meetingDate: string): MeetingPrepData {
  return {
    id: row.id || generateMeetingId(meetingDate),
    meetingDate,
    bibleVerse: row.bibleVerseRef
      ? {
          reference: row.bibleVerseRef,
          text: row.bibleVerseText || '',
          theme: row.bibleVerseTheme || '',
        }
      : null,
    useRandomVerse: row.useRandomVerse === 'true',
    announcements: {
      part1: row.announcementsPart1 ? JSON.parse(row.announcementsPart1) : [],
      part2: row.announcementsPart2 ? JSON.parse(row.announcementsPart2) : [],
    },
    employeeOfMonth: row.employeeName
      ? {
          name: row.employeeName,
          department: row.employeeDept || '',
          reason: row.employeeReason || '',
        }
      : null,
    trainingTopic: row.trainingTopic || '',
    departmentNotes: {
      sales: row.salesNotes || '',
      operations: row.operationsNotes || '',
      office: row.officeNotes || '',
      drivers: row.driversNotes || '',
    },
    specialNotes: row.specialNotes || '',
    preparedBy: row.preparedBy || '',
    preparedAt: row.updatedAt || row.createdAt || '',
    status: (row.status as 'draft' | 'ready' | 'presented') || 'draft',
  };
}

/**
 * Serialize a MeetingPrepData object into a flat record for Google Sheets.
 */
function prepDataToRow(prep: MeetingPrepData): Record<string, string> {
  return {
    meetingDate: prep.meetingDate,
    id: prep.id,
    bibleVerseRef: prep.bibleVerse?.reference || '',
    bibleVerseText: prep.bibleVerse?.text || '',
    bibleVerseTheme: prep.bibleVerse?.theme || '',
    useRandomVerse: String(prep.useRandomVerse),
    announcementsPart1: JSON.stringify(prep.announcements.part1),
    announcementsPart2: JSON.stringify(prep.announcements.part2),
    employeeName: prep.employeeOfMonth?.name || '',
    employeeDept: prep.employeeOfMonth?.department || '',
    employeeReason: prep.employeeOfMonth?.reason || '',
    trainingTopic: prep.trainingTopic,
    salesNotes: prep.departmentNotes.sales,
    operationsNotes: prep.departmentNotes.operations,
    officeNotes: prep.departmentNotes.office,
    driversNotes: prep.departmentNotes.drivers,
    specialNotes: prep.specialNotes,
    preparedBy: prep.preparedBy,
    status: prep.status,
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Load prep status for a meeting date from Google Sheets.
 */
async function getMeetingPrepStatus(meetingDate: string): Promise<'not-started' | 'in-progress' | 'ready'> {
  const row = await googleSheetsService.getMeetingPrep(meetingDate);
  if (!row) return 'not-started';
  return row.status === 'ready' ? 'ready' : 'in-progress';
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

      const row = await googleSheetsService.getMeetingPrep(meetingDate);

      if (!row || !row.meetingDate) {
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

      const prepData = rowToPrepData(row, meetingDate);

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

    // List archived meeting preps
    if (action === 'list') {
      const yearParam = searchParams.get('year');
      const limitParam = searchParams.get('limit');
      const preps = await googleSheetsService.listMeetingPreps({
        year: yearParam ? parseInt(yearParam, 10) : undefined,
        limit: limitParam ? parseInt(limitParam, 10) : undefined,
      });

      const prepDataList = preps
        .filter(r => r.meetingDate)
        .map(r => rowToPrepData(r, r.meetingDate));

      return NextResponse.json({
        success: true,
        data: prepDataList,
        count: prepDataList.length,
        timestamp: new Date().toISOString(),
      });
    }

    // Default: Return full meeting configuration
    const config = getMeetingConfig();
    const nextMeeting = calculateNextMeetingDate();
    const meetingDate = getISODate(nextMeeting);

    // Get prep status from sheets
    const prepStatus = await getMeetingPrepStatus(meetingDate);

    // Load existing prep data from sheets
    const existingRow = await googleSheetsService.getMeetingPrep(meetingDate);
    const existingPrep = existingRow && existingRow.meetingDate
      ? rowToPrepData(existingRow, meetingDate)
      : null;

    // Find last presented meeting from sheets
    const recentPreps = await googleSheetsService.listMeetingPreps({ limit: 10 });
    const lastPresented = recentPreps.find(r => r.status === 'presented');

    const enhancedConfig: MeetingConfig & {
      slides: typeof SLIDES;
      totalSlides: number;
      estimatedDuration: number;
      prepData: MeetingPrepData | null;
    } = {
      ...config,
      currentPrepStatus: prepStatus,
      lastMeetingDate: lastPresented?.meetingDate || config.lastMeetingDate,
      slides: SLIDES,
      totalSlides: SLIDES.length,
      estimatedDuration: Math.round(SLIDES.reduce((sum, s) => sum + s.duration, 0) / 60),
      prepData: existingPrep,
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

      // Load existing from sheets or start fresh
      const existingRow = await googleSheetsService.getMeetingPrep(prepData.meetingDate);
      const existing = existingRow && existingRow.meetingDate
        ? rowToPrepData(existingRow, prepData.meetingDate)
        : null;

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

      // Serialize and save to Google Sheets
      const sheetRecord = prepDataToRow(updatedPrep);
      const saved = await googleSheetsService.saveMeetingPrep(sheetRecord);

      if (!saved) {
        return NextResponse.json(
          {
            success: false,
            error: 'Failed to persist meeting prep to Google Sheets',
          },
          { status: 500 }
        );
      }

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

      const existingRow = await googleSheetsService.getMeetingPrep(meetingDate);
      if (!existingRow || !existingRow.meetingDate) {
        return NextResponse.json(
          {
            success: false,
            error: 'No prep data found for this meeting date',
          },
          { status: 404 }
        );
      }

      const prep = rowToPrepData(existingRow, meetingDate);
      prep.status = 'ready';

      const sheetRecord = prepDataToRow(prep);
      await googleSheetsService.saveMeetingPrep(sheetRecord);

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

      const existingRow = await googleSheetsService.getMeetingPrep(meetingDate);
      if (existingRow && existingRow.meetingDate) {
        const prep = rowToPrepData(existingRow, meetingDate);
        prep.status = 'presented';

        const sheetRecord = prepDataToRow(prep);
        await googleSheetsService.saveMeetingPrep(sheetRecord);
      }

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
