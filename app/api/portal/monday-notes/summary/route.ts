/**
 * Monday Notes Summary API
 *
 * GET - Get summary of submissions for the meeting presentation
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-service';
import {
  MondayNote,
  NoteCategory,
  getNextMondayDate,
  getSubmissionStatus,
  groupNotesByCategory,
  generateSlideContent,
  CATEGORY_INFO,
  areSubmissionsOpen,
  getSubmissionDeadline,
  getDaysUntilMonday,
} from '@/lib/monday-notes-service';

// Reference to the notes from main route (in production, this would be a database query)
// For demo, we'll fetch from the main API
async function fetchNotes(meetingDate: string): Promise<MondayNote[]> {
  // In production, this would be a database query
  // For now, return empty array - the actual notes are stored in the main route
  return [];
}

export async function GET(request: NextRequest) {
  const auth = await requireAuth();
  if (!auth.authenticated) return auth.response;

  try {
    const { searchParams } = new URL(request.url);
    const meetingDate = searchParams.get('meetingDate') || getNextMondayDate();
    const format = searchParams.get('format') || 'summary';

    // Fetch notes for the meeting date
    // In production, this would query the database
    const notesResponse = await fetch(
      `${request.nextUrl.origin}/api/portal/monday-notes?meetingDate=${meetingDate}`,
      { cache: 'no-store' }
    );

    let notes: MondayNote[] = [];
    if (notesResponse.ok) {
      const data = await notesResponse.json();
      notes = data.notes || [];
    }

    // Get submission status
    const submissionStatus = getSubmissionStatus(notes);

    if (format === 'slides') {
      // Generate slide-ready content
      const groupedNotes = groupNotesByCategory(notes);
      const slides: Record<NoteCategory, ReturnType<typeof generateSlideContent>> = {} as any;

      (Object.keys(CATEGORY_INFO) as NoteCategory[]).forEach(category => {
        if (groupedNotes[category]?.length > 0) {
          slides[category] = generateSlideContent(notes, category);
        }
      });

      return NextResponse.json({
        success: true,
        meetingDate,
        slides,
        totalNotes: notes.length,
        categoriesWithContent: Object.keys(slides),
      });
    }

    // Default summary format
    const categoryCounts: Record<NoteCategory, number> = {
      delivery: 0,
      sales: 0,
      operations: 0,
      office: 0,
      general: 0,
    };

    notes.forEach(note => {
      if (note.status !== 'draft') {
        categoryCounts[note.category]++;
      }
    });

    // Group notes by user for admin view
    const notesByUser: Record<string, {
      userName: string;
      userRole: string;
      notes: MondayNote[];
    }> = {};

    notes.forEach(note => {
      if (!notesByUser[note.userId]) {
        notesByUser[note.userId] = {
          userName: note.userName,
          userRole: note.userRole,
          notes: [],
        };
      }
      notesByUser[note.userId].notes.push(note);
    });

    return NextResponse.json({
      success: true,
      meetingDate,
      summary: {
        totalNotes: notes.length,
        submittedNotes: notes.filter(n => n.status !== 'draft').length,
        draftNotes: notes.filter(n => n.status === 'draft').length,
        categoryCounts,
        submissionStatus,
        submissionsOpen: areSubmissionsOpen(),
        deadline: getSubmissionDeadline().toISOString(),
        daysUntilMeeting: getDaysUntilMonday(),
      },
      notesByUser,
      categories: Object.entries(categoryCounts)
        .filter(([_, count]) => count > 0)
        .map(([category, count]) => ({
          category,
          count,
          label: CATEGORY_INFO[category as NoteCategory].label,
          color: CATEGORY_INFO[category as NoteCategory].color,
        })),
    });
  } catch (error) {
    console.error('Error generating monday notes summary:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to generate summary' },
      { status: 500 }
    );
  }
}
