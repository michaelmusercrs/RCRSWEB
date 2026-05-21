import { NextResponse } from 'next/server';
import { getYoYCompare } from '@/lib/yoy-compare';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  try {
    return NextResponse.json(await getYoYCompare());
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
