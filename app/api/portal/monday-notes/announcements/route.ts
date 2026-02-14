/**
 * Monday Notes Announcements API
 *
 * GET - Fetch active announcements for a meeting date, grouped by early/late
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-service';
import {
  MondayNote,
  AnnouncementType,
  getNextMondayDate,
  isAnnouncementActive,
} from '@/lib/monday-notes-service';

export async function GET(request: NextRequest) {
  const auth = await requireAuth();
  if (!auth.authenticated) return auth.response;

  try {
    const { searchParams } = new URL(request.url);
    const meetingDate = searchParams.get('meetingDate') || getNextMondayDate();

    // Fetch all notes from the main monday-notes endpoint
    const notesResponse = await fetch(
      `${request.nextUrl.origin}/api/portal/monday-notes?meetingDate=${meetingDate}`,
      { cache: 'no-store' }
    );

    let allNotes: MondayNote[] = [];
    if (notesResponse.ok) {
      const data = await notesResponse.json();
      allNotes = data.notes || [];
    }

    // Also check for recurring/multi-week announcements from previous weeks
    // Fetch notes from last 4 weeks to catch recurring items
    const previousWeeks: string[] = [];
    const baseDate = new Date(meetingDate);
    for (let i = 1; i <= 4; i++) {
      const prevDate = new Date(baseDate);
      prevDate.setDate(prevDate.getDate() - i * 7);
      previousWeeks.push(prevDate.toISOString().split('T')[0]);
    }

    for (const prevDate of previousWeeks) {
      try {
        const prevRes = await fetch(
          `${request.nextUrl.origin}/api/portal/monday-notes?meetingDate=${prevDate}`,
          { cache: 'no-store' }
        );
        if (prevRes.ok) {
          const prevData = await prevRes.json();
          const prevNotes = (prevData.notes || []) as MondayNote[];
          // Only include notes that have announcement settings and are still active
          const carryoverNotes = prevNotes.filter(
            (n) => n.announcementType && isAnnouncementActive(n, meetingDate)
          );
          allNotes.push(...carryoverNotes);
        }
      } catch {
        // Ignore fetch errors for previous weeks
      }
    }

    // Filter to only announcement-typed notes that are active
    const activeAnnouncements = allNotes.filter(
      (n) =>
        n.announcementType &&
        n.status !== 'draft' &&
        isAnnouncementActive(n, meetingDate)
    );

    // Also include submitted notes without explicit announcement type as "early" by default
    const regularNotes = allNotes.filter(
      (n) => !n.announcementType && n.status !== 'draft' && n.includeInSlide
    );

    // Group by early/late
    const early: MondayNote[] = [
      ...activeAnnouncements.filter((n) => n.announcementType === 'early'),
      ...regularNotes, // Regular notes default to early
    ];
    const late: MondayNote[] = activeAnnouncements.filter(
      (n) => n.announcementType === 'late'
    );

    // Deduplicate by note id
    const dedup = (notes: MondayNote[]) => {
      const seen = new Set<string>();
      return notes.filter((n) => {
        if (seen.has(n.id)) return false;
        seen.add(n.id);
        return true;
      });
    };

    return NextResponse.json({
      success: true,
      meetingDate,
      announcements: {
        early: dedup(early),
        late: dedup(late),
      },
      totalEarly: dedup(early).length,
      totalLate: dedup(late).length,
    });
  } catch (error) {
    console.error('Error fetching announcements:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch announcements' },
      { status: 500 }
    );
  }
}
