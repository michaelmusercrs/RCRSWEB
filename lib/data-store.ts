/**
 * Persistent Data Store for River City Roofing
 * 
 * Abstracts storage away from local filesystem.
 * Primary: Vercel Blob (works in serverless)
 * Fallback: Local filesystem (dev environment)
 * 
 * Replaces direct fs.readFileSync/writeFileSync in API routes
 * which break on Vercel's read-only serverless filesystem.
 */

import fs from 'fs';
import path from 'path';

const BLOB_PREFIX = 'data/';

/**
 * Read a JSON data file. Tries Vercel Blob first, falls back to local fs.
 */
export async function readDataFile<T = unknown>(filename: string, defaultValue: T): Promise<T> {
  // Try Vercel Blob first
  try {
    const { list } = await import('@vercel/blob');
    const blobKey = `${BLOB_PREFIX}${filename}`;
    const blobs = await list({ prefix: blobKey });
    if (blobs.blobs.length > 0) {
      const res = await fetch(blobs.blobs[0].url, { cache: 'no-store' });
      if (res.ok) {
        return await res.json() as T;
      }
    }
  } catch {
    // Blob not available (local dev or error)
  }

  // Fallback: local filesystem
  try {
    const filePath = path.join(process.cwd(), 'data', filename);
    const data = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(data) as T;
  } catch {
    return defaultValue;
  }
}

/**
 * Write a JSON data file. Writes to Vercel Blob, falls back to local fs.
 */
export async function writeDataFile(filename: string, data: unknown): Promise<void> {
  const jsonStr = JSON.stringify(data, null, 2);

  // Try Vercel Blob first
  let blobSuccess = false;
  try {
    const { put } = await import('@vercel/blob');
    const blobKey = `${BLOB_PREFIX}${filename}`;
    await put(blobKey, jsonStr, {
      access: 'public',
      contentType: 'application/json',
      addRandomSuffix: false,
    });
    blobSuccess = true;
  } catch {
    // Blob not available
  }

  // Also write locally (dev) or as fallback
  try {
    const filePath = path.join(process.cwd(), 'data', filename);
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(filePath, jsonStr);
  } catch {
    if (!blobSuccess) {
      throw new Error(`Failed to persist ${filename} to any storage backend`);
    }
  }
}
