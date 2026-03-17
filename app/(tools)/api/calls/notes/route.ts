/**
 * RCRS Call Notes API
 *
 * Manage notes attached to call records.
 * Stores notes separately in data/call-notes.json for flexibility.
 *
 * GET  /api/calls/notes - Get notes for a call
 * POST /api/calls/notes - Add/update a note on a call
 *
 * @author RCRS Development Team
 * @version 1.0.0
 */

import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

// =============================================================================
// TYPES
// =============================================================================

export interface CallNote {
  /** Unique note identifier */
  id: string;
  /** Associated call ID */
  callId: string;
  /** Note content */
  note: string;
  /** Author name or user ID */
  author: string;
  /** When the note was created */
  createdAt: string;
  /** When the note was last updated */
  updatedAt: string;
}

interface CallNotesData {
  notes: CallNote[];
  lastUpdated: string;
}

// =============================================================================
// DATA HELPERS
// =============================================================================

const DATA_FILE_PATH = path.join(process.cwd(), 'data', 'call-notes.json');

function readNotesData(): CallNotesData {
  try {
    if (fs.existsSync(DATA_FILE_PATH)) {
      const content = fs.readFileSync(DATA_FILE_PATH, 'utf-8');
      return JSON.parse(content);
    }
  } catch (error) {
    console.error('Error reading call notes data:', error);
  }

  return {
    notes: [],
    lastUpdated: new Date().toISOString(),
  };
}

function writeNotesData(data: CallNotesData): void {
  try {
    const dir = path.dirname(DATA_FILE_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    data.lastUpdated = new Date().toISOString();
    fs.writeFileSync(DATA_FILE_PATH, JSON.stringify(data, null, 2));
  } catch (error) {
    console.error('Error writing call notes data:', error);
    throw error;
  }
}

function generateNoteId(): string {
  const timestamp = Date.now();
  const random = crypto.randomBytes(3).toString('hex').toUpperCase();
  return `NOTE-${timestamp}-${random}`;
}

// =============================================================================
// ROUTE HANDLERS
// =============================================================================

/**
 * GET /api/calls/notes
 *
 * Get notes for a specific call.
 *
 * Query params:
 * - callId (required): The call ID to get notes for
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const callId = searchParams.get('callId');

    if (!callId) {
      return NextResponse.json(
        { error: 'callId query parameter is required' },
        { status: 400 }
      );
    }

    const data = readNotesData();
    const notes = data.notes
      .filter(n => n.callId === callId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return NextResponse.json({
      callId,
      notes,
      total: notes.length,
    });
  } catch (error) {
    console.error('[Call Notes API] GET error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch call notes' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/calls/notes
 *
 * Add or update a note on a call.
 *
 * Body:
 * - callId (required): The call ID
 * - note (required): The note content
 * - author (required): Who wrote the note
 * - noteId: If provided, updates an existing note instead of creating
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    if (!body.callId) {
      return NextResponse.json(
        { error: 'callId is required' },
        { status: 400 }
      );
    }

    if (!body.note || body.note.trim() === '') {
      return NextResponse.json(
        { error: 'note content is required' },
        { status: 400 }
      );
    }

    if (!body.author) {
      return NextResponse.json(
        { error: 'author is required' },
        { status: 400 }
      );
    }

    const data = readNotesData();
    const now = new Date().toISOString();

    // Update existing note if noteId is provided
    if (body.noteId) {
      const index = data.notes.findIndex(n => n.id === body.noteId);
      if (index < 0) {
        return NextResponse.json(
          { error: 'Note not found' },
          { status: 404 }
        );
      }

      data.notes[index].note = body.note.trim();
      data.notes[index].author = body.author;
      data.notes[index].updatedAt = now;

      writeNotesData(data);

      return NextResponse.json({
        success: true,
        note: data.notes[index],
        action: 'updated',
      });
    }

    // Create new note
    const newNote: CallNote = {
      id: generateNoteId(),
      callId: body.callId,
      note: body.note.trim(),
      author: body.author,
      createdAt: now,
      updatedAt: now,
    };

    data.notes.unshift(newNote);
    writeNotesData(data);

    return NextResponse.json({
      success: true,
      note: newNote,
      action: 'created',
    });
  } catch (error) {
    console.error('[Call Notes API] POST error:', error);
    return NextResponse.json(
      { error: 'Failed to save call note' },
      { status: 500 }
    );
  }
}
