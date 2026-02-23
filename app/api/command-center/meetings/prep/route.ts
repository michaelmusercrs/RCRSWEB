/**
 * Meeting Prep API - convenience route that proxies to /api/command-center/meetings?action=prep
 */
import { NextRequest, NextResponse } from 'next/server';
import {
  calculateNextMeetingDate,
  getISODate,
  getWeekNumber,
  getBibleVerseByWeek,
  DEFAULT_AGENDA,
  MeetingPrepData,
} from '@/lib/meeting-data';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const dateParam = searchParams.get('date');
    const nextMeeting = calculateNextMeetingDate();
    const meetingDate = dateParam || getISODate(nextMeeting);

    const weekNum = getWeekNumber(new Date(meetingDate));
    const verse = getBibleVerseByWeek(weekNum);

    const defaultPrep: MeetingPrepData = {
      ...DEFAULT_AGENDA,
      id: `meeting-${meetingDate}`,
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
  } catch (error) {
    console.error('Meeting prep error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to load meeting prep data' },
      { status: 500 }
    );
  }
}
