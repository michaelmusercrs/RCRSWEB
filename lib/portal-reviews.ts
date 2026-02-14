/**
 * Portal Reviews Helper
 * Reads approved, visible reviews from the portal review system
 * for display on public team pages.
 */

import { promises as fs } from 'fs';
import path from 'path';
import { ProfileReview } from './profile-types';

const BLOB_KEY = 'data/profile-reviews.json';
const LOCAL_PATH = path.join(process.cwd(), 'data', 'profile-reviews.json');

async function readReviews(): Promise<ProfileReview[]> {
  // Try Vercel Blob first
  try {
    const { list } = await import('@vercel/blob');
    const blobs = await list({ prefix: BLOB_KEY });
    if (blobs.blobs.length > 0) {
      const res = await fetch(blobs.blobs[0].url, { cache: 'no-store' });
      if (res.ok) return await res.json();
    }
  } catch { /* blob not available */ }

  // Fall back to local file
  try {
    const data = await fs.readFile(LOCAL_PATH, 'utf-8');
    return JSON.parse(data);
  } catch {
    return [];
  }
}

/**
 * Get approved, visible reviews for a specific rep.
 * Featured reviews come first, then sorted by date descending.
 */
export async function getApprovedPortalReviews(repSlug: string): Promise<ProfileReview[]> {
  const reviews = await readReviews();

  return reviews
    .filter(r => r.repSlug === repSlug && r.approved && r.visible)
    .sort((a, b) => {
      // Featured first
      if (a.featured && !b.featured) return -1;
      if (!a.featured && b.featured) return 1;
      // Then by date desc
      return new Date(b.date).getTime() - new Date(a.date).getTime();
    });
}

/**
 * Get all approved, visible reviews across all reps (for company-wide display).
 */
export async function getAllApprovedPortalReviews(): Promise<ProfileReview[]> {
  const reviews = await readReviews();

  return reviews
    .filter(r => r.approved && r.visible)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}
