/**
 * Monday Notes Approval API
 *
 * POST - Approve or reject a team-submitted note
 * Only accessible by admin/owner roles
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-service';
import { googleSheetsService } from '@/lib/google-sheets-service';
import { cache } from '@/lib/cache';
import { MondayNote, getNextMondayDate } from '@/lib/monday-notes-service';

function safeJsonParse<T>(str: string | undefined, fallback: T): T {
  if (!str) return fallback;
  try {
    const parsed = JSON.parse(str);
    if (fallback === undefined && typeof parsed === 'object' && Object.keys(parsed).length === 0) {
      return fallback;
    }
    return parsed;
  } catch {
    return fallback;
  }
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
    announcementType: (row.announcementType || undefined) as MondayNote['announcementType'],
    displayDuration: (row.displayDuration || undefined) as MondayNote['displayDuration'],
    displayStartDate: row.displayStartDate || undefined,
    displayEndDate: row.displayEndDate || undefined,
    schedule: safeJsonParse(row.scheduleJson, undefined),
    includeInSlide: row.includeInSlide !== 'false',
    slideOrder: row.slideOrder ? parseInt(row.slideOrder) : undefined,
    status: (row.status || 'draft') as MondayNote['status'],
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

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
    scheduleJson: JSON.stringify(note.schedule || {}),
    includeInSlide: note.includeInSlide ? 'true' : 'false',
    slideOrder: note.slideOrder?.toString() || '',
    status: note.status,
    createdAt: note.createdAt,
    updatedAt: note.updatedAt,
  };
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth();
  if (!auth.authenticated) return auth.response;

  try {
    const body = await request.json();
    const { noteId, action, editedContent, editedTitle, slideOrder } = body;

    if (!noteId || !action) {
      return NextResponse.json(
        { success: false, error: 'noteId and action are required' },
        { status: 400 }
      );
    }

    if (!['approve', 'reject', 'edit'].includes(action)) {
      return NextResponse.json(
        { success: false, error: 'action must be approve, reject, or edit' },
        { status: 400 }
      );
    }

    // Find the note across recent weeks
    const meetingDate = getNextMondayDate();
    const rows = await googleSheetsService.getMondayNotes({ meetingDate });
    const notes = rows.map(rowToNote);
    const note = notes.find(n => n.id === noteId);

    if (!note) {
      return NextResponse.json(
        { success: false, error: 'Note not found' },
        { status: 404 }
      );
    }

    const now = new Date().toISOString();

    if (action === 'approve') {
      note.status = 'approved';
      note.includeInSlide = true;
      if (slideOrder !== undefined) note.slideOrder = slideOrder;
    } else if (action === 'reject') {
      note.status = 'draft'; // Move back to draft
      note.includeInSlide = false;
    } else if (action === 'edit') {
      if (editedTitle) note.title = editedTitle;
      if (editedContent) note.content = editedContent;
      if (slideOrder !== undefined) note.slideOrder = slideOrder;
      note.status = 'approved';
      note.includeInSlide = true;
    }

    note.updatedAt = now;

    await googleSheetsService.saveMondayNote(noteToRow(note));
    cache.invalidatePattern('^sheets:monday-');

    return NextResponse.json({
      success: true,
      note,
      message: `Note ${action === 'approve' ? 'approved' : action === 'reject' ? 'rejected' : 'updated'}`,
    });
  } catch (error) {
    console.error('Error processing approval:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to process approval' },
      { status: 500 }
    );
  }
}
