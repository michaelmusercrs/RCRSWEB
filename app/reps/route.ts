import { NextResponse } from 'next/server';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

// Sales rep production & commission report — standalone read-only view.
//
// Open link, no login, same intentional-public-link pattern as /monday,
// /trip, /chrisview and /division-leaders. Served as a static HTML document
// so the report stays self-contained (inline CSS + SVG charts, no bundler).
//
// noindex/nofollow so the page is shareable by link but stays out of search
// results — it lists individual reps' production and commission.

export const dynamic = 'force-static';
export const runtime = 'nodejs';

export async function GET() {
  const filePath = path.join(process.cwd(), 'public', 'reps', 'index.html');
  const html = await readFile(filePath, 'utf8');
  return new NextResponse(html, {
    status: 200,
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'public, max-age=0, must-revalidate',
      'x-robots-tag': 'noindex, nofollow',
    },
  });
}
