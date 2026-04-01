/**
 * Monday Notes Announcements API
 *
 * GET - Fetch active announcements for a meeting date, grouped by early/late
 * 
 * Reads directly from Google Sheets via googleSheetsService.getMondayNotes()
 * to avoid Next.js dev server deadlock (single-threaded internal fetch).
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  MondayNote,
  NoteCategory,
  getNextMondayDate,
  isAnnouncementActive,
} from '@/lib/monday-notes-service';
import { TeamRole } from '@/lib/team-roles';
import { googleSheetsService } from '@/lib/google-sheets-service';
import { cache, CACHE_TTL } from '@/lib/cache';

function rowToNote(row: Record<string, string>): MondayNote {
  return {
    id: row.id || '',
    meetingDate: row.meetingDate || '',
    userId: row.userId || '',
    userName: row.userName || '',
    userRole: (row.userRole || '') as TeamRole,
    category: (row.category || 'general') as NoteCategory,
    title: row.title || '',
    content: row.content || '',
    highlights: row.highlightsJson ? (() => { try { return JSON.parse(row.highlightsJson); } catch { return []; } })() : [],
    attachments: row.attachmentsJson ? (() => { try { return JSON.parse(row.attachmentsJson); } catch { return []; } })() : [],
    timing: row.timingJson ? (() => { try { return JSON.parse(row.timingJson); } catch { return {}; } })() : {},
    metrics: row.metricsJson ? (() => { try { return JSON.parse(row.metricsJson); } catch { return []; } })() : [],
    announcementType: (row.announcementType || undefined) as MondayNote['announcementType'],
    displayDuration: (row.displayDuration || undefined) as MondayNote['displayDuration'],
    displayStartDate: row.displayStartDate || undefined,
    displayEndDate: row.displayEndDate || undefined,
    includeInSlide: row.includeInSlide === 'TRUE' || row.includeInSlide === 'true',
    slideOrder: parseInt(row.slideOrder) || 0,
    status: (row.status || 'draft') as MondayNote['status'],
    createdAt: row.createdAt || '',
    updatedAt: row.updatedAt || '',
  };
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const meetingDate = searchParams.get('meetingDate') || getNextMondayDate();

    const cacheKey = `sheets:monday-announcements:${meetingDate}`;
    const cachedAnn = cache.get(cacheKey);
    if (cachedAnn) {
      return NextResponse.json(cachedAnn, {
        headers: { 'Cache-Control': 'private, s-maxage=30' },
      });
    }

    // Fetch notes for this meeting date directly from Sheets
    const rows = await googleSheetsService.getMondayNotes({ meetingDate });
    let allNotes = rows.map(rowToNote);

    // Check previous 4 weeks for recurring announcements
    const baseDate = new Date(meetingDate);
    for (let i = 1; i <= 4; i++) {
      const prevDate = new Date(baseDate);
      prevDate.setDate(prevDate.getDate() - i * 7);
      const prevDateStr = prevDate.toISOString().split('T')[0];
      const prevRows = await googleSheetsService.getMondayNotes({ meetingDate: prevDateStr });
      const prevNotes = prevRows.map(rowToNote);
      const carryover = prevNotes.filter(n => n.announcementType && isAnnouncementActive(n, meetingDate));
      allNotes.push(...carryover);
    }

    // Active announcements with explicit type
    const activeAnnouncements = allNotes.filter(
      n => n.announcementType && n.status !== 'draft' && isAnnouncementActive(n, meetingDate)
    );

    // Regular submitted notes with includeInSlide → default to early
    const regularNotes = allNotes.filter(
      n => !n.announcementType && n.status !== 'draft' && n.includeInSlide
    );

    const early: MondayNote[] = [
      ...activeAnnouncements.filter(n => n.announcementType === 'early'),
      ...regularNotes,
    ];
    const late: MondayNote[] = activeAnnouncements.filter(n => n.announcementType === 'late');

    // Deduplicate
    const dedup = (notes: MondayNote[]) => {
      const seen = new Set<string>();
      return notes.filter(n => { if (seen.has(n.id)) return false; seen.add(n.id); return true; });
    };

    const annResponse = {
      success: true,
      meetingDate,
      announcements: {
        early: dedup(early).sort((a, b) => (a.slideOrder || 0) - (b.slideOrder || 0)),
        late: dedup(late).sort((a, b) => (a.slideOrder || 0) - (b.slideOrder || 0)),
      },
      totalEarly: dedup(early).length,
      totalLate: dedup(late).length,
    };
    cache.set(cacheKey, annResponse, CACHE_TTL.MEETING);
    return NextResponse.json(annResponse, {
      headers: { 'Cache-Control': 'private, s-maxage=30' },
    });
  } catch (error) {
    console.error('Error fetching announcements:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch announcements' },
      { status: 500 }
    );
  }
}
