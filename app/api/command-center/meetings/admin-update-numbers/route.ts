/**
 * Admin Live Number Edit API
 *
 * Lets an admin/owner update a rep's Monday meeting numbers in real time
 * during the 10am meeting. Writes to the Monday meeting Google Sheet and
 * refreshes the local JSON cache so the presentation picks it up on its
 * next poll.
 *
 * POST body:
 *   repName: string            // e.g. "Greg Muse"
 *   meetingDate?: string       // YYYY-MM-DD, defaults to next/this Monday
 *   inspected?, damage?, signed?, repair?, gutter?, revenue?, approved?,
 *   goal?, referrals?, agents?, homeShow?: number
 *   present?: string           // "1" | "0" | "E" etc.
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth-service';
import { meetingNumbersService } from '@/lib/meeting-numbers-service';
import { cache } from '@/lib/cache';

function getThisMondayDate(): string {
  const now = new Date();
  const day = now.getDay();
  const diff = day === 0 ? -6 : 1 - day; // Monday = 1
  const monday = new Date(now);
  monday.setDate(now.getDate() + diff);
  return monday.toISOString().slice(0, 10);
}

export async function POST(request: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.authenticated) return auth.response;

  try {
    const body = await request.json();
    const repName: string | undefined = body.repName;
    if (!repName || typeof repName !== 'string') {
      return NextResponse.json({ success: false, error: 'repName is required' }, { status: 400 });
    }

    const meetingDate: string = body.meetingDate || getThisMondayDate();

    const parsed = {
      inspected: body.inspected !== undefined ? parseInt(String(body.inspected)) || 0 : undefined,
      damage: body.damage !== undefined ? parseInt(String(body.damage)) || 0 : undefined,
      signed: body.signed !== undefined ? parseInt(String(body.signed)) || 0 : undefined,
      repair: body.repair !== undefined ? parseInt(String(body.repair)) || 0 : undefined,
      gutter: body.gutter !== undefined ? parseInt(String(body.gutter)) || 0 : undefined,
      revenue: body.revenue !== undefined ? parseFloat(String(body.revenue)) || 0 : undefined,
      approved: body.approved !== undefined ? parseInt(String(body.approved)) || 0 : undefined,
      goal: body.goal !== undefined ? parseInt(String(body.goal)) || 0 : undefined,
      referrals: body.referrals !== undefined ? parseInt(String(body.referrals)) || 0 : undefined,
      agents: body.agents !== undefined ? parseInt(String(body.agents)) || 0 : undefined,
      present: body.present !== undefined ? String(body.present) : undefined,
      homeShow: body.homeShow !== undefined ? parseInt(String(body.homeShow)) || 0 : undefined,
    };

    // Strip undefined so submitNumbers treats them as no-change
    const clean: Record<string, number | string> = {};
    for (const [k, v] of Object.entries(parsed)) {
      if (v !== undefined) clean[k] = v;
    }

    if (Object.keys(clean).length === 0) {
      return NextResponse.json({ success: false, error: 'No fields to update' }, { status: 400 });
    }

    const result = await meetingNumbersService.submitNumbers(repName, meetingDate, clean);

    cache.invalidatePattern('^sheets:weekly-numbers:');
    cache.invalidatePattern('^sheets:meeting-data:');
    cache.invalidatePattern('^meeting:');

    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error || 'Update failed' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: `Updated ${repName} for ${meetingDate}`,
      repName,
      meetingDate,
      updated: clean,
      editedBy: auth.user.name,
      editedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[admin-update-numbers] error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Update failed' },
      { status: 500 },
    );
  }
}

export async function GET(request: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.authenticated) return auth.response;

  const { searchParams } = new URL(request.url);
  const meetingDate = searchParams.get('meetingDate') || getThisMondayDate();
  const repName = searchParams.get('repName') || undefined;

  const all = meetingNumbersService.loadAllData();
  const thisWeek = all.filter(r => r.meetingDate === meetingDate);
  const byRep: Record<string, typeof thisWeek[0]> = {};
  for (const r of thisWeek) byRep[r.repName] = r;

  if (repName) {
    return NextResponse.json({ success: true, meetingDate, repName, record: byRep[repName] || null });
  }

  return NextResponse.json({ success: true, meetingDate, records: Object.values(byRep) });
}
