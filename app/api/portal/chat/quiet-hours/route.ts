import { NextResponse } from 'next/server';
import { getQuietHoursInfo } from '@/lib/chat-quiet-hours';

// GET - Check quiet hours status (no auth required for UI check)
export async function GET() {
  const info = getQuietHoursInfo();
  return NextResponse.json(info);
}
