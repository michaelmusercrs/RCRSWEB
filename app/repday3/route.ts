import { NextResponse } from 'next/server';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

// Rep Day 3 — final in-office sales training deck ("Close to Referral").
//
// Open link, no login, same intentional-public-link pattern as /monday,
// /reps, /trip and /chrisview. Served as a static, self-contained HTML
// slide deck (inline CSS + vanilla JS, no bundler) so it renders on any
// projector or phone with nothing to install.
//
// noindex/nofollow: shareable by link with the sales team, but kept out of
// search results.

export const dynamic = 'force-static';
export const runtime = 'nodejs';

export async function GET() {
  const filePath = path.join(process.cwd(), 'public', 'repday3', 'index.html');
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
