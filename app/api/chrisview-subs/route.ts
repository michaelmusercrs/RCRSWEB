import { NextResponse } from 'next/server';
import data from '@/data/sub-performance.json';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  return NextResponse.json(data);
}
