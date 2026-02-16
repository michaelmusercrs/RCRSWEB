/**
 * RCRS Command Center - Meeting Announcements API
 * Proxies to /api/portal/monday-notes/announcements
 *
 * GET /api/command-center/meetings/announcements
 */

import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    // Forward to the portal monday-notes announcements endpoint
    const baseUrl = request.nextUrl.origin;
    const res = await fetch(`${baseUrl}/api/portal/monday-notes/announcements`, {
      headers: Object.fromEntries(request.headers),
    });

    if (!res.ok) {
      // Return empty announcements if the upstream fails
      return NextResponse.json({
        success: true,
        announcements: { early: [], late: [] },
        timestamp: new Date().toISOString(),
      });
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({
      success: true,
      announcements: { early: [], late: [] },
      timestamp: new Date().toISOString(),
    });
  }
}
