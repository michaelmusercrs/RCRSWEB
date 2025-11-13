/**
 * Page View Counter & Analytics
 * Tracks page views and team member profile views
 */

export interface PageView {
  path: string;
  timestamp: Date;
  userAgent?: string;
  referrer?: string;
}

export interface ProfileView {
  slug: string;
  teamMemberName: string;
  timestamp: Date;
  source?: string;
}

export interface ViewStats {
  totalViews: number;
  uniqueViews: number;
  viewsByDay: Record<string, number>;
  topPages: Array<{ path: string; views: number }>;
  recentViews: PageView[];
}

export interface ProfileStats {
  slug: string;
  name: string;
  totalViews: number;
  viewsThisWeek: number;
  viewsThisMonth: number;
  recentViews: ProfileView[];
}

/**
 * Track a page view (client-side)
 */
export async function trackPageView(path: string): Promise<void> {
  try {
    await fetch('/api/analytics/page-views', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        path,
        timestamp: new Date().toISOString(),
        referrer: typeof document !== 'undefined' ? document.referrer : undefined,
      }),
    });
  } catch (error) {
    console.error('Failed to track page view:', error);
  }
}

/**
 * Track a team member profile view (client-side)
 */
export async function trackProfileView(
  slug: string,
  teamMemberName: string,
  source?: string
): Promise<void> {
  try {
    await fetch('/api/analytics/profile-views', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        slug,
        teamMemberName,
        timestamp: new Date().toISOString(),
        source,
      }),
    });
  } catch (error) {
    console.error('Failed to track profile view:', error);
  }
}

/**
 * Get view statistics for a page
 */
export async function getPageViewStats(path?: string): Promise<ViewStats> {
  try {
    const url = path
      ? `/api/analytics/page-views?path=${encodeURIComponent(path)}`
      : '/api/analytics/page-views';
    const response = await fetch(url);
    const data = await response.json();
    return data.stats;
  } catch (error) {
    console.error('Failed to fetch page view stats:', error);
    return {
      totalViews: 0,
      uniqueViews: 0,
      viewsByDay: {},
      topPages: [],
      recentViews: [],
    };
  }
}

/**
 * Get view statistics for a team member profile
 */
export async function getProfileViewStats(slug: string): Promise<ProfileStats> {
  try {
    const response = await fetch(`/api/analytics/profile-views?slug=${slug}`);
    const data = await response.json();
    return data.stats;
  } catch (error) {
    console.error('Failed to fetch profile view stats:', error);
    return {
      slug,
      name: '',
      totalViews: 0,
      viewsThisWeek: 0,
      viewsThisMonth: 0,
      recentViews: [],
    };
  }
}

/**
 * Get all team member profile stats (for admin dashboard)
 */
export async function getAllProfileStats(): Promise<ProfileStats[]> {
  try {
    const response = await fetch('/api/analytics/profile-views?all=true');
    const data = await response.json();
    return data.stats;
  } catch (error) {
    console.error('Failed to fetch all profile stats:', error);
    return [];
  }
}
