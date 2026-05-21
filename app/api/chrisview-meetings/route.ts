import { NextResponse } from 'next/server';
import { getMeetingHistory } from '@/lib/meeting-history';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  try {
    return NextResponse.json(await getMeetingHistory());
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
