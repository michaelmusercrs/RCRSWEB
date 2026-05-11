/**
 * Vercel Blob storage layer for the /trip dashboard.
 *
 * Stores three artifacts:
 *  - trip/current.xlsx        (raw uploaded spreadsheet)
 *  - trip/tracker.json        (computed TrackerJSON)
 *  - trip/snapshots.json      (snapshot history array)
 *  - trip/change-log.json     (change log entries)
 *
 * Falls back to bundled `data/bonus-tracker-2026.json` when Blob is empty
 * (first deploy / local dev without BLOB_READ_WRITE_TOKEN).
 */

import { ChangeLogEntry, Snapshot, TrackerJSON } from './types';

const TRACKER_KEY = 'trip/tracker.json';
const SNAPSHOTS_KEY = 'trip/snapshots.json';
const CHANGELOG_KEY = 'trip/change-log.json';
const XLSX_KEY = 'trip/current.xlsx';

async function readBlobJSON<T>(prefix: string): Promise<T | null> {
  try {
    const { list } = await import('@vercel/blob');
    const blobs = await list({ prefix });
    if (blobs.blobs.length === 0) return null;
    // pick newest (list returns sorted by uploadedAt desc by default? sort just in case)
    const newest = [...blobs.blobs].sort((a, b) => (b.uploadedAt > a.uploadedAt ? 1 : -1))[0];
    const res = await fetch(newest.url, { cache: 'no-store' });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

async function writeBlobJSON(key: string, data: unknown): Promise<string | null> {
  try {
    const { put } = await import('@vercel/blob');
    const blob = await put(key, JSON.stringify(data, null, 2), {
      access: 'public',
      contentType: 'application/json',
      addRandomSuffix: false,
      allowOverwrite: true,
    });
    return blob.url;
  } catch (e) {
    console.error('[trip/store] writeBlobJSON failed', key, e);
    return null;
  }
}

async function writeBlobBinary(key: string, data: ArrayBuffer | Buffer, contentType: string): Promise<string | null> {
  try {
    const { put } = await import('@vercel/blob');
    const blob = await put(key, data, {
      access: 'public',
      contentType,
      addRandomSuffix: false,
      allowOverwrite: true,
    });
    return blob.url;
  } catch (e) {
    console.error('[trip/store] writeBlobBinary failed', key, e);
    return null;
  }
}

export async function getTracker(): Promise<TrackerJSON | null> {
  // Try Blob first
  const fromBlob = await readBlobJSON<TrackerJSON>(TRACKER_KEY);
  if (fromBlob) return fromBlob;

  // Fall back to bundled file
  try {
    const fs = await import('fs');
    const path = await import('path');
    const file = path.join(process.cwd(), 'data', 'bonus-tracker-2026.json');
    if (fs.existsSync(file)) {
      return JSON.parse(fs.readFileSync(file, 'utf8')) as TrackerJSON;
    }
  } catch {
    /* ignore */
  }
  return null;
}

export async function getSnapshots(): Promise<Snapshot[]> {
  const fromBlob = await readBlobJSON<Snapshot[]>(SNAPSHOTS_KEY);
  if (fromBlob) return fromBlob;
  return [];
}

export async function getChangeLog(): Promise<ChangeLogEntry[]> {
  const fromBlob = await readBlobJSON<ChangeLogEntry[]>(CHANGELOG_KEY);
  if (fromBlob) return fromBlob;
  return [];
}

export async function putTracker(t: TrackerJSON) {
  return writeBlobJSON(TRACKER_KEY, t);
}

export async function putSnapshots(s: Snapshot[]) {
  return writeBlobJSON(SNAPSHOTS_KEY, s);
}

export async function putChangeLog(c: ChangeLogEntry[]) {
  return writeBlobJSON(CHANGELOG_KEY, c);
}

export async function putXlsx(buf: ArrayBuffer | Buffer) {
  return writeBlobBinary(
    XLSX_KEY,
    buf,
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  );
}

export async function getXlsxUrl(): Promise<string | null> {
  try {
    const { list } = await import('@vercel/blob');
    const blobs = await list({ prefix: XLSX_KEY });
    if (blobs.blobs.length === 0) return null;
    return blobs.blobs[0].url;
  } catch {
    return null;
  }
}
