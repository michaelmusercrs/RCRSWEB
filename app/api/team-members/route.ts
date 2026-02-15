import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth-service';
import { googleSheetsService } from '@/lib/google-sheets-service';
import { cache, CACHE_TTL } from '@/lib/cache';

export async function GET() {
  try {
    const cacheKey = 'sheets:team-members';
    const cached = cache.get<any>(cacheKey);
    if (cached) return NextResponse.json(cached);

    const teamMembers = await googleSheetsService.getTeamMembers();
    cache.set(cacheKey, teamMembers, CACHE_TTL.LONG);
    return NextResponse.json(teamMembers);
  } catch (error) {
    console.error('Error fetching team members:', error);
    return NextResponse.json({ error: 'Failed to fetch team members' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const auth = await requireAdmin();
  if (!auth.authenticated) return auth.response;

  try {
    const teamMember = await request.json();
    await googleSheetsService.updateTeamMember(teamMember);
    cache.invalidate('sheets:team-members');
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating team member:', error);
    return NextResponse.json({ error: 'Failed to update team member' }, { status: 500 });
  }
}