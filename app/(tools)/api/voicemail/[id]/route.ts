/**
 * RCRS Single Voicemail API
 *
 * Operations on individual voicemail records:
 * - GET: Fetch voicemail details
 * - PATCH: Update voicemail (mark read, add note, link to job, share)
 * - DELETE: Delete voicemail
 *
 * @author RCRS Development Team
 * @version 1.0.0
 */

import { NextRequest, NextResponse } from 'next/server';
import { voicemailService } from '@/lib/voicemail-service';

/**
 * GET /api/voicemail/[id]
 *
 * Get a single voicemail by ID with full details.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const voicemail = voicemailService.getById(params.id);

    if (!voicemail) {
      return NextResponse.json(
        { error: 'Voicemail not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ voicemail });
  } catch (error) {
    console.error('[Voicemail API] GET error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch voicemail' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/voicemail/[id]
 *
 * Update a voicemail record.
 *
 * Supported operations (via body fields):
 * - isRead: boolean - Mark read/unread
 * - markAllRead: boolean - Mark all voicemails read (extension optional)
 * - note: string - Add a note
 * - linkedJobId: string - Link to a JobNimbus job
 * - linkedContactId: string - Link to a JobNimbus contact
 * - sharedWith: string[] - Share with team members
 * - isUrgent: boolean - Toggle urgent flag
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    let result = null;

    // Handle mark all read (special case using id as a signal)
    if (body.markAllRead === true) {
      const count = voicemailService.markAllRead(body.extension);
      return NextResponse.json({
        success: true,
        message: `Marked ${count} voicemails as read`,
        count,
      });
    }

    // Mark read/unread
    if ('isRead' in body) {
      result = body.isRead
        ? voicemailService.markAsRead(params.id)
        : voicemailService.markAsUnread(params.id);
    }

    // Add note
    if (body.note) {
      result = voicemailService.addNote(params.id, body.note);
    }

    // Link to job
    if (body.linkedJobId !== undefined) {
      result = voicemailService.linkToJob(params.id, body.linkedJobId, body.linkedContactId);
    }

    // Share with team
    if (body.sharedWith && Array.isArray(body.sharedWith)) {
      result = voicemailService.shareWithTeam(params.id, body.sharedWith);
    }

    // Toggle urgent
    if ('isUrgent' in body && !('isRead' in body) && !body.note && body.linkedJobId === undefined && !body.sharedWith) {
      result = voicemailService.update(params.id, { isUrgent: body.isUrgent });
    }

    // Generic update fallback for other fields
    if (!result) {
      const allowedFields = ['isRead', 'isUrgent', 'notes', 'linkedJobId', 'linkedContactId'];
      const updates: Record<string, unknown> = {};
      for (const field of allowedFields) {
        if (field in body) {
          updates[field] = body[field];
        }
      }

      if (Object.keys(updates).length > 0) {
        result = voicemailService.update(params.id, updates as any);
      }
    }

    if (!result) {
      return NextResponse.json(
        { error: 'Voicemail not found or no valid updates provided' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      voicemail: result,
    });
  } catch (error) {
    console.error('[Voicemail API] PATCH error:', error);
    return NextResponse.json(
      { error: 'Failed to update voicemail' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/voicemail/[id]
 *
 * Delete a voicemail record.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const deleted = voicemailService.deleteVoicemail(params.id);

    if (!deleted) {
      return NextResponse.json(
        { error: 'Voicemail not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Voicemail deleted',
    });
  } catch (error) {
    console.error('[Voicemail API] DELETE error:', error);
    return NextResponse.json(
      { error: 'Failed to delete voicemail' },
      { status: 500 }
    );
  }
}
