/**
 * Page Views API
 * Tracks and reports page view analytics
 */

import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

const DATA_FILE = path.join(process.cwd(), 'data', 'page-views.json');

interface PageView {
  path: string;
  timestamp: string;
  referrer?: string;
}

/**
 * Ensure data file exists
 */
async function ensureDataFile() {
  const dataDir = path.join(process.cwd(), 'data');

  try {
    await fs.access(dataDir);
  } catch {
    await fs.mkdir(dataDir, { recursive: true });
  }

  try {
    await fs.access(DATA_FILE);
  } catch {
    await fs.writeFile(DATA_FILE, JSON.stringify([], null, 2));
  }
}

/**
 * Read page views
 */
async function readPageViews(): Promise<PageView[]> {
  await ensureDataFile();
  const data = await fs.readFile(DATA_FILE, 'utf-8');
  return JSON.parse(data);
}

/**
 * Write page views
 */
async function writePageViews(views: PageView[]): Promise<void> {
  await ensureDataFile();
  await fs.writeFile(DATA_FILE, JSON.stringify(views, null, 2));
}

/**
 * Calculate statistics
 */
function calculateStats(views: PageView[], filterPath?: string) {
  const filtered = filterPath
    ? views.filter((v) => v.path === filterPath)
    : views;

  // Total views
  const totalViews = filtered.length;

  // Views by day (last 30 days)
  const viewsByDay: Record<string, number> = {};
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  filtered.forEach((view) => {
    const viewDate = new Date(view.timestamp);
    if (viewDate >= thirtyDaysAgo) {
      const dateKey = viewDate.toISOString().split('T')[0];
      viewsByDay[dateKey] = (viewsByDay[dateKey] || 0) + 1;
    }
  });

  // Top pages (last 30 days)
  const pageCounts: Record<string, number> = {};
  filtered
    .filter((v) => new Date(v.timestamp) >= thirtyDaysAgo)
    .forEach((view) => {
      pageCounts[view.path] = (pageCounts[view.path] || 0) + 1;
    });

  const topPages = Object.entries(pageCounts)
    .map(([path, views]) => ({ path, views }))
    .sort((a, b) => b.views - a.views)
    .slice(0, 10);

  // Recent views
  const recentViews = filtered
    .slice(-20)
    .reverse()
    .map((v) => ({
      ...v,
      timestamp: new Date(v.timestamp),
    }));

  return {
    totalViews,
    uniqueViews: totalViews, // Could implement unique tracking with IP/session
    viewsByDay,
    topPages,
    recentViews,
  };
}

/**
 * GET /api/analytics/page-views
 * Get page view statistics
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const path = searchParams.get('path');

    const views = await readPageViews();
    const stats = calculateStats(views, path || undefined);

    return NextResponse.json({
      success: true,
      stats,
    });
  } catch (error) {
    console.error('Error fetching page views:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch page views' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/analytics/page-views
 * Record a page view
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { path: viewPath, timestamp, referrer } = body;

    if (!viewPath) {
      return NextResponse.json(
        { success: false, error: 'Missing path' },
        { status: 400 }
      );
    }

    const views = await readPageViews();

    const newView: PageView = {
      path: viewPath,
      timestamp: timestamp || new Date().toISOString(),
      referrer,
    };

    views.push(newView);

    // Keep only last 10,000 views to prevent file from growing too large
    if (views.length > 10000) {
      views.splice(0, views.length - 10000);
    }

    await writePageViews(views);

    return NextResponse.json({
      success: true,
      view: newView,
    });
  } catch (error) {
    console.error('Error recording page view:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to record page view' },
      { status: 500 }
    );
  }
}
