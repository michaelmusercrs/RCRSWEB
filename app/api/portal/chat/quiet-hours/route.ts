import { NextResponse } from 'next/server';
import { getQuietHoursInfo } from '@/lib/chat-quiet-hours';
import { requireAuth } from '@/lib/auth-service';

// GET - Check quiet hours status
export async function GET() {
  const auth = await requireAuth();
  if (!auth.authenticated) return auth.response;

  const info = getQuietHoursInfo();
  return NextResponse.json(info);
}
