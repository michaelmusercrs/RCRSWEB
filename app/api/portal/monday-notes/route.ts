/**
 * Monday Notes API
 *
 * GET  - Fetch notes for a meeting date or user
 * POST - Create or update a note
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-service';
import {
  MondayNote,
  generateNoteId,
  getNextMondayDate,
  validateNote,
  areSubmissionsOpen,
  calculateDisplayEndDate,
  AnnouncementType,
  DisplayDuration,
} from '@/lib/monday-notes-service';

// In-memory storage for demo (would be database in production)
let mondayNotes: MondayNote[] = [];

// Helper to load notes from file system in production
// For now using in-memory storage

export async function GET(request: NextRequest) {
  const auth = await requireAuth();
  if (!auth.authenticated) return auth.response;

  try {
    const { searchParams } = new URL(request.url);
    const meetingDate = searchParams.get('meetingDate') || getNextMondayDate();
    const userId = searchParams.get('userId');
    const category = searchParams.get('category');
    const status = searchParams.get('status');

    let filteredNotes = mondayNotes.filter(n => n.meetingDate === meetingDate);

    if (userId) {
      filteredNotes = filteredNotes.filter(n => n.userId === userId);
    }

    if (category) {
      filteredNotes = filteredNotes.filter(n => n.category === category);
    }

    if (status) {
      filteredNotes = filteredNotes.filter(n => n.status === status);
    }

    // Sort by category then by userName
    filteredNotes.sort((a, b) => {
      if (a.category !== b.category) {
        return a.category.localeCompare(b.category);
      }
      return a.userName.localeCompare(b.userName);
    });

    return NextResponse.json({
      success: true,
      meetingDate,
      notes: filteredNotes,
      count: filteredNotes.length,
      submissionsOpen: areSubmissionsOpen(),
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
    const existingIndex = id
      ? mondayNotes.findIndex(n => n.id === id)
      : mondayNotes.findIndex(n => n.userId === userId && n.meetingDate === meetingDate);

    if (existingIndex >= 0) {
      // Update existing note
      const updDisplayStart = meetingDate;
      const updDisplayEnd = displayDuration ? calculateDisplayEndDate(updDisplayStart, displayDuration as DisplayDuration) : undefined;

      mondayNotes[existingIndex] = {
        ...mondayNotes[existingIndex],
        category: category || mondayNotes[existingIndex].category,
        title: title || '',
        content: content || '',
        highlights: highlights || [],
        attachments: attachments || mondayNotes[existingIndex].attachments,
        timing,
        metrics: metrics || [],
        announcementType: announcementType as AnnouncementType | undefined ?? mondayNotes[existingIndex].announcementType,
        displayDuration: displayDuration as DisplayDuration | undefined ?? mondayNotes[existingIndex].displayDuration,
        displayStartDate: announcementType ? updDisplayStart : mondayNotes[existingIndex].displayStartDate,
        displayEndDate: updDisplayEnd || mondayNotes[existingIndex].displayEndDate,
        includeInSlide: includeInSlide !== undefined ? includeInSlide : true,
        status: status || 'draft',
        updatedAt: now,
      };

      return NextResponse.json({
        success: true,
        note: mondayNotes[existingIndex],
        message: 'Note updated successfully',
      });
    } else {
      // Create new note
      const displayStart = meetingDate;
      const displayEnd = displayDuration ? calculateDisplayEndDate(displayStart, displayDuration as DisplayDuration) : undefined;

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

      mondayNotes.push(newNote);

      return NextResponse.json({
        success: true,
        note: newNote,
        message: 'Note created successfully',
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

    const noteIndex = mondayNotes.findIndex(n => n.id === noteId);

    if (noteIndex === -1) {
      return NextResponse.json(
        { success: false, error: 'Note not found' },
        { status: 404 }
      );
    }

    mondayNotes.splice(noteIndex, 1);

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
