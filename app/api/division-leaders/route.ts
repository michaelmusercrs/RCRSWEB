/**
 * Division Leader Checks API — public read-only.
 *
 * Returns the per-check + rollup data extracted from QB 1099 memo lines
 * (data/division-leader-checks.json). Refresh by running
 * `node scripts/extract-division-leader-checks.mjs` after a new QB
 * export lands.
 */
import { NextResponse } from 'next/server';
import data from '@/data/division-leader-checks.json';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  return NextResponse.json(data);
}
