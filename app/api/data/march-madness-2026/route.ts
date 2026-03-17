/**
 * API Route: GET /api/data/march-madness-2026
 *
 * Serves the March Madness 2026 bracket data from data/march-madness-2026.json.
 * No auth required - this is displayed on the competition page for all staff.
 */

import { NextResponse } from 'next/server';
import { readFileSync } from 'fs';
import { join } from 'path';

export async function GET() {
  try {
    const filePath = join(process.cwd(), 'data', 'march-madness-2026.json');
    const raw = readFileSync(filePath, 'utf8');
    const data = JSON.parse(raw);
    return NextResponse.json(data);
  } catch (err: any) {
    console.error('[March Madness API] Error loading bracket data:', err.message);
    return NextResponse.json(
      { error: 'Failed to load bracket data' },
      { status: 500 }
    );
  }
}
