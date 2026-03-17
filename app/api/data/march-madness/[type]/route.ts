/**
 * API Route: GET /api/data/march-madness/[type]
 *
 * Serves March Madness tournament data by type.
 * Types: config, momentum, double-elim, tag-team
 * No auth required - displayed on competition pages for all staff.
 */

import { NextResponse } from 'next/server';
import { readFileSync } from 'fs';
import { join } from 'path';

const FILE_MAP: Record<string, string> = {
  config: 'march-madness-config.json',
  momentum: 'march-madness-momentum.json',
  'double-elim': 'march-madness-double-elim.json',
  'tag-team': 'march-madness-tag-team.json',
  classic: 'march-madness-2026.json',
};

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ type: string }> }
) {
  try {
    const { type } = await params;
    const fileName = FILE_MAP[type];
    if (!fileName) {
      return NextResponse.json(
        { error: `Unknown tournament type: ${type}. Valid: ${Object.keys(FILE_MAP).join(', ')}` },
        { status: 404 }
      );
    }

    const filePath = join(process.cwd(), 'data', fileName);
    const raw = readFileSync(filePath, 'utf8');
    const data = JSON.parse(raw);
    return NextResponse.json(data);
  } catch (err: any) {
    console.error('[March Madness API] Error:', err.message);
    return NextResponse.json(
      { error: 'Failed to load tournament data' },
      { status: 500 }
    );
  }
}
