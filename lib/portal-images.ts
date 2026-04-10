/**
 * Portal Images Helper
 * Reads approved images from the portal image metadata store
 * for display on public team pages.
 * 
 * Image files live in Vercel Blob (profiles/{slug}/{type}/{file}).
 * Approval metadata is stored in data/profile-image-metadata.json.
 */

import { promises as fs } from 'fs';
import path from 'path';
import { ProfileImage } from './profile-types';

const BLOB_KEY = 'data/profile-image-metadata.json';
const LOCAL_PATH = path.join(process.cwd(), 'data', 'profile-image-metadata.json');

export async function readImageMetadata(): Promise<ProfileImage[]> {
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

export async function saveImageMetadata(images: ProfileImage[]): Promise<void> {
  // Try Vercel Blob first
  try {
    const { put } = await import('@vercel/blob');
    await put(BLOB_KEY, JSON.stringify(images, null, 2), {
      access: 'public',
      contentType: 'application/json',
      addRandomSuffix: false, allowOverwrite: true,
    });
    return;
  } catch { /* blob not available */ }

  // Fall back to local file
  const dir = path.dirname(LOCAL_PATH);
  await fs.mkdir(dir, { recursive: true }).catch(() => {});
  await fs.writeFile(LOCAL_PATH, JSON.stringify(images, null, 2));
}

/**
 * Get all approved images for a specific rep slug.
 */
export async function getApprovedImages(repSlug: string): Promise<ProfileImage[]> {
  const images = await readImageMetadata();
  return images.filter(img => {
    // Extract rep slug from the id (profiles/{slug}/{type}/{filename})
    const parts = img.id.split('/');
    const imgSlug = parts[1];
    return imgSlug === repSlug && img.approved;
  });
}

/**
 * Get all pending (unapproved) images across all reps.
 */
export async function getPendingImages(): Promise<ProfileImage[]> {
  const images = await readImageMetadata();
  return images.filter(img => !img.approved);
}

/**
 * Get all images for a specific rep slug (approved and pending).
 */
export async function getAllImagesForRep(repSlug: string): Promise<ProfileImage[]> {
  const images = await readImageMetadata();
  return images.filter(img => {
    const parts = img.id.split('/');
    return parts[1] === repSlug;
  });
}
