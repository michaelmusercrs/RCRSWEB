/**
 * Profile Views API
 * Tracks views of team member profiles
 */

import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

const DATA_FILE = path.join(process.cwd(), 'data', 'profile-views.json');

interface ProfileView {
  slug: string;
  teamMemberName: string;
  timestamp: string;
  source?: string;
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
 * Read profile views
 */
async function readProfileViews(): Promise<ProfileView[]> {
  await ensureDataFile();
  const data = await fs.readFile(DATA_FILE, 'utf-8');
  return JSON.parse(data);
}

/**
 * Write profile views
 */
async function writeProfileViews(views: ProfileView[]): Promise<void> {
  await ensureDataFile();
  await fs.writeFile(DATA_FILE, JSON.stringify(views, null, 2));
}

/**
 * Calculate profile statistics
 */
function calculateProfileStats(views: ProfileView[], slug?: string) {
  const filtered = slug
    ? views.filter((v) => v.slug === slug)
    : views;

  if (!slug) {
    // Return stats for all profiles
    const profileGroups: Record<string, ProfileView[]> = {};

    views.forEach((view) => {
      if (!profileGroups[view.slug]) {
        profileGroups[view.slug] = [];
      }
      profileGroups[view.slug].push(view);
    });

    const now = new Date();
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    return Object.entries(profileGroups).map(([profileSlug, profileViews]) => {
      const viewsThisWeek = profileViews.filter(
        (v) => new Date(v.timestamp) >= oneWeekAgo
      ).length;

      const viewsThisMonth = profileViews.filter(
        (v) => new Date(v.timestamp) >= oneMonthAgo
      ).length;

      return {
        slug: profileSlug,
        name: profileViews[0]?.teamMemberName || profileSlug,
        totalViews: profileViews.length,
        viewsThisWeek,
        viewsThisMonth,
        recentViews: profileViews.slice(-10).reverse(),
      };
    });
  }

  // Stats for specific profile
  const now = new Date();
  const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const totalViews = filtered.length;
  const viewsThisWeek = filtered.filter(
    (v) => new Date(v.timestamp) >= oneWeekAgo
  ).length;
  const viewsThisMonth = filtered.filter(
    (v) => new Date(v.timestamp) >= oneMonthAgo
  ).length;

  const recentViews = filtered.slice(-20).reverse();

  return {
    slug: slug || '',
    name: filtered[0]?.teamMemberName || '',
    totalViews,
    viewsThisWeek,
    viewsThisMonth,
    recentViews,
  };
}

/**
 * GET /api/analytics/profile-views
 * Get profile view statistics
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const slug = searchParams.get('slug');
    const all = searchParams.get('all');

    const views = await readProfileViews();

    if (all === 'true') {
      // Return stats for all profiles
      const stats = calculateProfileStats(views);
      return NextResponse.json({
        success: true,
        stats,
      });
    } else if (slug) {
      // Return stats for specific profile
      const stats = calculateProfileStats(views, slug);
      return NextResponse.json({
        success: true,
        stats,
      });
    } else {
      return NextResponse.json(
        { success: false, error: 'Missing slug or all parameter' },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error('Error fetching profile views:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch profile views' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/analytics/profile-views
 * Record a profile view
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { slug, teamMemberName, timestamp, source } = body;

    if (!slug || !teamMemberName) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const views = await readProfileViews();

    const newView: ProfileView = {
      slug,
      teamMemberName,
      timestamp: timestamp || new Date().toISOString(),
      source,
    };

    views.push(newView);

    // Keep only last 10,000 views
    if (views.length > 10000) {
      views.splice(0, views.length - 10000);
    }

    await writeProfileViews(views);

    return NextResponse.json({
      success: true,
      view: newView,
    });
  } catch (error) {
    console.error('Error recording profile view:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to record profile view' },
      { status: 500 }
    );
  }
}
