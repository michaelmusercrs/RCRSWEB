import { NextResponse } from 'next/server';
import { googleSheetsService } from '@/lib/google-sheets-service';

const CACHE_DURATION = 30 * 1000; // 30 seconds - good for testing
let cache: { data: any; timestamp: number; } | null = null;

export async function GET() {
  try {
    if (cache && Date.now() - cache.timestamp < CACHE_DURATION) {
      return NextResponse.json(cache.data);
    }

    const teamMembers = await googleSheetsService.getTeamMembers();
    cache = { data: teamMembers, timestamp: Date.now() };
    return NextResponse.json(teamMembers);
  } catch (error) {
    console.error('Error fetching team members:', error);
    return NextResponse.json({ error: 'Failed to fetch team members' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const teamMember = await request.json();
    await googleSheetsService.updateTeamMember(teamMember);
    cache = null;
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating team member:', error);
    return NextResponse.json({ error: 'Failed to update team member' }, { status: 500 });
  }
}