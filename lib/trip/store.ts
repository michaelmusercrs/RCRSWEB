/**
 * Vercel Blob storage layer for the /trip dashboard.
 *
 * Stores these artifacts:
 *  - trip/current.xlsx                   (raw uploaded spreadsheet)
 *  - trip/tracker.json                   (computed TrackerJSON)
 *  - trip/snapshots.json                 (snapshot history array)
 *  - trip/change-log.json                (change log entries)
 *  - trip/backups/{timestamp}-{hash}.html  (rendered HTML of /trip just before each commit)
 *
 * Falls back to bundled `data/bonus-tracker-2026.json` when Blob is empty
 * (first deploy / local dev without BLOB_READ_WRITE_TOKEN).
 */

import { ChangeLogEntry, Snapshot, TrackerJSON } from './types';

const TRACKER_KEY = 'trip/tracker.json';
const SNAPSHOTS_KEY = 'trip/snapshots.json';
const CHANGELOG_KEY = 'trip/change-log.json';
const XLSX_KEY = 'trip/current.xlsx';
const BACKUP_PREFIX = 'trip/backups/';
const EXCLUDED_REPS_KEY = 'trip/excluded-reps.json';
const DEFAULT_EXCLUDED_REPS = ['brendon'];

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

async function readLocalJSON<T>(filename: string): Promise<T | null> {
  try {
    const fs = await import('fs');
    const path = await import('path');
    const file = path.join(process.cwd(), 'data', filename);
    if (!fs.existsSync(file)) return null;
    return JSON.parse(fs.readFileSync(file, 'utf8')) as T;
  } catch {
    return null;
  }
}

export async function getSnapshots(): Promise<Snapshot[]> {
  const fromBlob = await readBlobJSON<Snapshot[]>(SNAPSHOTS_KEY);
  if (fromBlob) return fromBlob;
  const fromDisk = await readLocalJSON<Snapshot[]>('trip-snapshots.json');
  if (fromDisk) return fromDisk;
  return [];
}

export async function getChangeLog(): Promise<ChangeLogEntry[]> {
  const fromBlob = await readBlobJSON<ChangeLogEntry[]>(CHANGELOG_KEY);
  if (fromBlob) return fromBlob;
  const fromDisk = await readLocalJSON<ChangeLogEntry[]>('change-log.json');
  if (fromDisk) return fromDisk;
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

/**
 * Get the list of excluded rep first-names (lowercased). Reps in this list
 * are filtered out at upload-parse time, so they never reach the tracker
 * regardless of what the spreadsheet contains.
 */
export async function getExcludedReps(): Promise<string[]> {
  const fromBlob = await readBlobJSON<string[]>(EXCLUDED_REPS_KEY);
  if (fromBlob && Array.isArray(fromBlob)) return fromBlob.map((s) => s.toLowerCase());
  const fromDisk = await readLocalJSON<string[]>('trip-excluded-reps.json');
  if (fromDisk && Array.isArray(fromDisk)) return fromDisk.map((s) => s.toLowerCase());
  return [...DEFAULT_EXCLUDED_REPS];
}

export async function setExcludedReps(reps: string[]): Promise<string | null> {
  const normalized = Array.from(new Set(reps.map((r) => r.trim().toLowerCase()).filter(Boolean)));
  const url = await writeBlobJSON(EXCLUDED_REPS_KEY, normalized);
  if (!url) {
    // Local fallback so dev without Blob still persists
    try {
      const fs = await import('fs');
      const path = await import('path');
      const file = path.join(process.cwd(), 'data', 'trip-excluded-reps.json');
      fs.writeFileSync(file, JSON.stringify(normalized, null, 2));
    } catch {
      /* ignore */
    }
  }
  return url;
}

/* ------------------------------------------------------------------ *
 * Archived periods
 *
 * The live keys above always mean "the currently active period". When a half
 * closes, rollover copies them under trip/periods/{id}/ and stamps them
 * locked. Archive keys are a disjoint prefix from the live keys on purpose —
 * readBlobJSON picks the newest blob under a prefix, so an overlapping
 * namespace would let an archive shadow live data.
 * ------------------------------------------------------------------ */

const PERIODS_PREFIX = 'trip/periods/';

export interface PeriodMeta {
  id: string;
  name: string;
  start: string;
  end: string;
  locked: true;
  lockedAt: string;
  dataHash: string;
  teamTotal: number;
  qualifiedCount: number;
  totalAccrued: number;
  totalToBePaid: number;
  repCount: number;
  source: string;
}

export function archiveKey(periodId: string, file: string): string {
  return `${PERIODS_PREFIX}${periodId}/${file}`;
}

/**
 * Write an archive artifact. Uses allowOverwrite:false so a second rollover
 * throws rather than silently clobbering a locked period.
 */
export async function putArchiveFile(
  periodId: string,
  file: string,
  data: string | Buffer,
  contentType: string,
): Promise<string> {
  const { put } = await import('@vercel/blob');
  const blob = await put(archiveKey(periodId, file), data, {
    access: 'public',
    contentType,
    addRandomSuffix: false,
    allowOverwrite: false,
  });
  return blob.url;
}

async function readArchiveFile(periodId: string, file: string): Promise<Response | null> {
  try {
    const { list } = await import('@vercel/blob');
    const key = archiveKey(periodId, file);
    const blobs = await list({ prefix: key });
    const match = blobs.blobs.find((b) => b.pathname === key);
    if (!match) return null;
    const res = await fetch(match.url, { cache: 'no-store' });
    return res.ok ? res : null;
  } catch {
    return null;
  }
}

export async function getArchivedMeta(periodId: string): Promise<PeriodMeta | null> {
  const res = await readArchiveFile(periodId, 'meta.json');
  return res ? ((await res.json()) as PeriodMeta) : null;
}

export async function getArchivedTracker(periodId: string): Promise<TrackerJSON | null> {
  const res = await readArchiveFile(periodId, 'tracker.json');
  return res ? ((await res.json()) as TrackerJSON) : null;
}

export async function getArchivedDashboardHtml(periodId: string): Promise<string | null> {
  const res = await readArchiveFile(periodId, 'dashboard.html');
  return res ? await res.text() : null;
}

/** All archived period ids that have a completed meta.json, newest first. */
export async function listArchivedPeriods(): Promise<PeriodMeta[]> {
  try {
    const { list } = await import('@vercel/blob');
    const blobs = await list({ prefix: PERIODS_PREFIX });
    const ids = Array.from(
      new Set(
        blobs.blobs
          .map((b) => b.pathname.slice(PERIODS_PREFIX.length).split('/')[0])
          .filter(Boolean),
      ),
    );
    const metas = await Promise.all(ids.map((id) => getArchivedMeta(id)));
    return metas
      .filter((m): m is PeriodMeta => m !== null)
      .sort((a, b) => (a.start < b.start ? 1 : -1));
  } catch {
    return [];
  }
}

export interface BackupRef {
  key: string;
  url: string;
  uploadedAt: string;
  size: number;
}

/**
 * Persist a rendered HTML backup of the current /trip page. Called from the
 * commit route immediately before the new data overwrites the live tracker,
 * so we always have a frozen view of what the dashboard looked like before
 * each upload.
 */
export async function putBackupHtml(
  html: string,
  hash: string,
): Promise<{ key: string; url: string | null }> {
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const key = `${BACKUP_PREFIX}${ts}-${hash}.html`;
  try {
    const { put } = await import('@vercel/blob');
    const blob = await put(key, html, {
      access: 'public',
      contentType: 'text/html; charset=utf-8',
      addRandomSuffix: false,
      allowOverwrite: true,
    });
    return { key, url: blob.url };
  } catch (e) {
    console.error('[trip/store] putBackupHtml failed', key, e);
    // Local fallback: write to disk under data/trip-backups/ so dev without
    // BLOB_READ_WRITE_TOKEN still creates a real artifact.
    try {
      const fs = await import('fs');
      const path = await import('path');
      const dir = path.join(process.cwd(), 'data', 'trip-backups');
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      const file = path.join(dir, `${ts}-${hash}.html`);
      fs.writeFileSync(file, html, 'utf8');
      return { key, url: `/data/trip-backups/${ts}-${hash}.html` };
    } catch {
      return { key, url: null };
    }
  }
}

export async function listBackups(): Promise<BackupRef[]> {
  try {
    const { list } = await import('@vercel/blob');
    const blobs = await list({ prefix: BACKUP_PREFIX });
    return blobs.blobs
      .map((b) => ({
        key: b.pathname,
        url: b.url,
        uploadedAt: typeof b.uploadedAt === 'string' ? b.uploadedAt : new Date(b.uploadedAt).toISOString(),
        size: b.size,
      }))
      .sort((a, b) => (a.uploadedAt < b.uploadedAt ? 1 : -1));
  } catch {
    // Local fallback
    try {
      const fs = await import('fs');
      const path = await import('path');
      const dir = path.join(process.cwd(), 'data', 'trip-backups');
      if (!fs.existsSync(dir)) return [];
      return fs
        .readdirSync(dir)
        .filter((f) => f.endsWith('.html'))
        .map((f) => {
          const stat = fs.statSync(path.join(dir, f));
          return {
            key: `${BACKUP_PREFIX}${f}`,
            url: `/data/trip-backups/${f}`,
            uploadedAt: stat.mtime.toISOString(),
            size: stat.size,
          };
        })
        .sort((a, b) => (a.uploadedAt < b.uploadedAt ? 1 : -1));
    } catch {
      return [];
    }
  }
}
