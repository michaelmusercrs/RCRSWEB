/**
 * Monday Notes API
 *
 * GET  - Fetch notes for a meeting date or user
 * POST - Create or update a note
 * DELETE - Delete a note
 *
 * Persisted to Google Sheets (MondayNotes tab)
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-service';
import { googleSheetsService } from '@/lib/google-sheets-service';
import { cache, CACHE_TTL } from '@/lib/cache';
import {
  MondayNote,
  generateNoteId,
  getNextMondayDate,
  validateNote,
  areSubmissionsOpen,
  isPastMondayDeadline,
  getDeadlineStatus,
  calculateDisplayEndDate,
  AnnouncementType,
  DisplayDuration,
} from '@/lib/monday-notes-service';

// ---- helpers to convert between MondayNote and flat sheet row ----

function noteToRow(note: MondayNote): Record<string, string> {
  return {
    id: note.id,
    meetingDate: note.meetingDate,
    userId: note.userId,
    userName: note.userName,
    userRole: note.userRole,
    category: note.category,
    title: note.title,
    content: note.content,
    highlightsJson: JSON.stringify(note.highlights || []),
    attachmentsJson: JSON.stringify(note.attachments || []),
    timingJson: JSON.stringify(note.timing || {}),
    metricsJson: JSON.stringify(note.metrics || []),
    announcementType: note.announcementType || '',
    displayDuration: note.displayDuration || '',
    displayStartDate: note.displayStartDate || '',
    displayEndDate: note.displayEndDate || '',
    includeInSlide: note.includeInSlide ? 'true' : 'false',
    slideOrder: note.slideOrder?.toString() || '',
    status: note.status,
    createdAt: note.createdAt,
    updatedAt: note.updatedAt,
  };
}

function rowToNote(row: Record<string, string>): MondayNote {
  return {
    id: row.id,
    meetingDate: row.meetingDate,
    userId: row.userId,
    userName: row.userName,
    userRole: row.userRole as MondayNote['userRole'],
    category: (row.category || 'general') as MondayNote['category'],
    title: row.title || '',
    content: row.content || '',
    highlights: safeJsonParse(row.highlightsJson, []),
    attachments: safeJsonParse(row.attachmentsJson, []),
    timing: safeJsonParse(row.timingJson, undefined),
    metrics: safeJsonParse(row.metricsJson, []),
    announcementType: (row.announcementType || undefined) as AnnouncementType | undefined,
    displayDuration: (row.displayDuration || undefined) as DisplayDuration | undefined,
    displayStartDate: row.displayStartDate || undefined,
    displayEndDate: row.displayEndDate || undefined,
    includeInSlide: row.includeInSlide !== 'false',
    slideOrder: row.slideOrder ? parseInt(row.slideOrder) : undefined,
    status: (row.status || 'draft') as MondayNote['status'],
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function safeJsonParse<T>(str: string | undefined, fallback: T): T {
  if (!str) return fallback;
  try {
    const parsed = JSON.parse(str);
    // If fallback is undefined and parsed is an empty object, return undefined
    if (fallback === undefined && typeof parsed === 'object' && Object.keys(parsed).length === 0) {
      return fallback;
    }
    return parsed;
  } catch {
    return fallback;
  }
}

export async function GET(request: NextRequest) {
  // Auth optional for GET — presentation mode and internal APIs need read access
  // POST/DELETE still require auth
  // const auth = await requireAuth();
  // if (!auth.authenticated) return auth.response;

  try {
    const { searchParams } = new URL(request.url);
    const meetingDate = searchParams.get('meetingDate') || getNextMondayDate();
    const userId = searchParams.get('userId');
    const category = searchParams.get('category');
    const status = searchParams.get('status');

    const cacheKey = `sheets:monday-notes:${meetingDate}:${userId || ''}:${category || ''}:${status || ''}`;
    const cachedNotes = cache.get(cacheKey);
    if (cachedNotes) {
      return NextResponse.json(cachedNotes, {
        headers: { 'Cache-Control': 'private, s-maxage=30' },
      });
    }

    const rows = await googleSheetsService.getMondayNotes({
      meetingDate,
      userId: userId || undefined,
      category: category || undefined,
      status: status || undefined,
    });

    let notes = rows.map(rowToNote);

    // Sort by category then by userName
    notes.sort((a, b) => {
      if (a.category !== b.category) {
        return a.category.localeCompare(b.category);
      }
      return a.userName.localeCompare(b.userName);
    });

    const deadlineStatus = getDeadlineStatus();
    const notesResponse = {
      success: true,
      meetingDate,
      notes,
      count: notes.length,
      submissionsOpen: areSubmissionsOpen(),
      deadlineStatus,
    };
    cache.set(cacheKey, notesResponse, CACHE_TTL.MEETING);
    return NextResponse.json(notesResponse, {
      headers: { 'Cache-Control': 'private, s-maxage=30' },
    });
  } catch (error) {
    console.error('Error fetching monday notes:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch notes' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth();
  if (!auth.authenticated) return auth.response;

  try {
    // Check Monday 9 AM CT deadline
    const pastDeadline = isPastMondayDeadline();
    const isAdminOrOwner = auth.user.role === 'owner' || auth.user.role === 'admin';

    if (pastDeadline && !isAdminOrOwner) {
      return NextResponse.json(
        {
          success: false,
          error: 'Submission deadline has passed (Monday 9:00 AM CT). Contact Sara or Michael for late submissions.',
          deadline: true,
        },
        { status: 403 }
      );
    }

    const body = await request.json();
    const {
      id,
      userId,
      userName,
      userRole,
      category,
      title,
      content,
      highlights,
      attachments,
      timing,
      metrics,
      includeInSlide,
      status,
      announcementType,
      displayDuration,
    } = body;

    // Validate required fields
    if (!userId || !userName || !userRole) {
      return NextResponse.json(
        { success: false, error: 'User information is required' },
        { status: 400 }
      );
    }

    // Validate note content
    const validationErrors = validateNote({ title, content });
    if (validationErrors.length > 0 && status !== 'draft') {
      return NextResponse.json(
        { success: false, errors: validationErrors },
        { status: 400 }
      );
    }

    const meetingDate = getNextMondayDate();
    const now = new Date().toISOString();

    // Check if updating existing note
    const existingRows = await googleSheetsService.getMondayNotes({ meetingDate });
    const existingNotes = existingRows.map(rowToNote);

    const existingNote = id
      ? existingNotes.find(n => n.id === id)
      : existingNotes.find(n => n.userId === userId && n.meetingDate === meetingDate);

    if (existingNote) {
      // Update existing note
      const updDisplayStart = meetingDate;
      const updDisplayEnd = displayDuration
        ? calculateDisplayEndDate(updDisplayStart, displayDuration as DisplayDuration)
        : undefined;

      const updated: MondayNote = {
        ...existingNote,
        category: category || existingNote.category,
        title: title || '',
        content: content || '',
        highlights: highlights || [],
        attachments: attachments || existingNote.attachments,
        timing,
        metrics: metrics || [],
        announcementType: (announcementType as AnnouncementType | undefined) ?? existingNote.announcementType,
        displayDuration: (displayDuration as DisplayDuration | undefined) ?? existingNote.displayDuration,
        displayStartDate: announcementType ? updDisplayStart : existingNote.displayStartDate,
        displayEndDate: updDisplayEnd || existingNote.displayEndDate,
        includeInSlide: includeInSlide !== undefined ? includeInSlide : true,
        status: status || 'draft',
        updatedAt: now,
      };

      await googleSheetsService.saveMondayNote(noteToRow(updated));
      cache.invalidatePattern('^sheets:monday-');

      return NextResponse.json({
        success: true,
        note: updated,
        lateSubmission: pastDeadline,
        message: pastDeadline ? 'Note updated (admin override - past deadline)' : 'Note updated successfully',
      });
    } else {
      // Create new note
      const displayStart = meetingDate;
      const displayEnd = displayDuration
        ? calculateDisplayEndDate(displayStart, displayDuration as DisplayDuration)
        : undefined;

      const newNote: MondayNote = {
        id: generateNoteId(),
        meetingDate,
        userId,
        userName,
        userRole,
        category: category || 'general',
        title: title || '',
        content: content || '',
        highlights: highlights || [],
        attachments: attachments || [],
        timing,
        metrics: metrics || [],
        announcementType: announcementType as AnnouncementType | undefined,
        displayDuration: displayDuration as DisplayDuration | undefined,
        displayStartDate: announcementType ? displayStart : undefined,
        displayEndDate: displayEnd || undefined,
        includeInSlide: includeInSlide !== undefined ? includeInSlide : true,
        status: status || 'draft',
        createdAt: now,
        updatedAt: now,
      };

      await googleSheetsService.saveMondayNote(noteToRow(newNote));
      cache.invalidatePattern('^sheets:monday-');

      return NextResponse.json({
        success: true,
        note: newNote,
        lateSubmission: pastDeadline,
        message: pastDeadline ? 'Note created (admin override - past deadline)' : 'Note created successfully',
      });
    }
  } catch (error) {
    console.error('Error saving monday note:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to save note' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  const auth = await requireAuth();
  if (!auth.authenticated) return auth.response;

  try {
    const { searchParams } = new URL(request.url);
    const noteId = searchParams.get('id');

    if (!noteId) {
      return NextResponse.json(
        { success: false, error: 'Note ID is required' },
        { status: 400 }
      );
    }

    const deleted = await googleSheetsService.deleteMondayNote(noteId);

    if (!deleted) {
      return NextResponse.json(
        { success: false, error: 'Note not found' },
        { status: 404 }
      );
    }

    cache.invalidatePattern('^sheets:monday-');

    return NextResponse.json({
      success: true,
      message: 'Note deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting monday note:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete note' },
      { status: 500 }
    );
  }
}
