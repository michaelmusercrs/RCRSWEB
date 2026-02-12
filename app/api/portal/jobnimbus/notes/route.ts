// GET/POST /api/portal/jobnimbus/notes
// 2-way notes sync: pull notes from JN, push notes to JN

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-service';
import { isJobNimbusConfigured } from '@/lib/jobnimbus-service';
import { jnSyncEngine } from '@/lib/jn-sync-engine';

// GET - Pull notes from JobNimbus
export async function GET(request: NextRequest) {
  const auth = await requireAuth();
  if (!auth.authenticated) return auth.response;

  if (!isJobNimbusConfigured()) {
    return NextResponse.json(
      { success: false, error: 'JobNimbus API not configured' },
      { status: 500 }
    );
  }

  try {
    const { searchParams } = new URL(request.url);
    const contactJnid = searchParams.get('contactId');
    const jobJnid = searchParams.get('jobId');
    const limit = parseInt(searchParams.get('limit') || '50');

    if (!contactJnid && !jobJnid) {
      return NextResponse.json(
        { success: false, error: 'contactId or jobId is required' },
        { status: 400 }
      );
    }

    let notes;
    if (jobJnid) {
      notes = await jnSyncEngine.pullNotesForJob(jobJnid, limit);
    } else {
      notes = await jnSyncEngine.pullNotes(contactJnid!, limit);
    }

    return NextResponse.json({
      success: true,
      count: notes.length,
      notes,
    });
  } catch (error) {
    console.error('Error fetching notes:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch notes',
      },
      { status: 500 }
    );
  }
}

// POST - Push a note to JobNimbus
export async function POST(request: NextRequest) {
  const auth = await requireAuth();
  if (!auth.authenticated) return auth.response;

  if (!isJobNimbusConfigured()) {
    return NextResponse.json(
      { success: false, error: 'JobNimbus API not configured' },
      { status: 500 }
    );
  }

  try {
    const body = await request.json();
    const { contactJnid, jobJnid, content } = body;

    if (!contactJnid) {
      return NextResponse.json(
        { success: false, error: 'contactJnid is required' },
        { status: 400 }
      );
    }

    if (!content || !content.trim()) {
      return NextResponse.json(
        { success: false, error: 'Note content is required' },
        { status: 400 }
      );
    }

    const result = await jnSyncEngine.pushNote(
      contactJnid,
      content.trim(),
      auth.user.name,
      jobJnid
    );

    return NextResponse.json({
      success: result.success,
      noteJnid: result.noteJnid,
      message: result.message,
      author: auth.user.name,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error creating note:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create note',
      },
      { status: 500 }
    );
  }
}
