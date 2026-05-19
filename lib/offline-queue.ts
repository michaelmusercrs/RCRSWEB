/**
 * Offline Queue (IndexedDB)
 *
 * Persists failed photo uploads and stage-transition requests so they
 * survive page reloads / dropped network / phone going to sleep. A
 * background interval retries the queue whenever `navigator.onLine`
 * is true. When the queue drains, a single toast notification fires.
 *
 * Storage:
 *   - `photos` store: queued photo uploads (file blob + metadata)
 *   - `requests` store: queued JSON POST requests (e.g. stage transitions)
 *
 * Why IndexedDB and not localStorage?
 *   - localStorage is sync + 5MB cap; photos easily blow past that.
 *   - IndexedDB stores Blobs natively and is async (no main-thread block).
 *
 * Usage:
 *   import { startOfflineQueue, enqueueOfflinePhoto, enqueueOfflineRequest } from '@/lib/offline-queue';
 *   useEffect(() => startOfflineQueue(), []);  // mount once per app
 */

import type { IDBPDatabase } from 'idb';

// Lazy-load idb so this module is safe to import in server components
let dbPromise: Promise<IDBPDatabase> | null = null;

const DB_NAME = 'rcrs-offline-queue';
const DB_VERSION = 1;
const PHOTO_STORE = 'photos';
const REQUEST_STORE = 'requests';

export interface OfflinePhoto {
  id: string;
  ticketId: string;
  stage: string;
  gpsLocation?: string;
  file: Blob | File;
  endpoint: string;
  queuedAt: number;
  attempts?: number;
  lastAttemptAt?: number;
  lastError?: string;
}

export interface OfflineRequest {
  id: string;
  url: string;
  method: 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body: any;
  queuedAt: number;
  attempts?: number;
  lastAttemptAt?: number;
  lastError?: string;
}

function getDB(): Promise<IDBPDatabase> {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('IndexedDB not available on server'));
  }
  if (!dbPromise) {
    dbPromise = import('idb').then(({ openDB }) =>
      openDB(DB_NAME, DB_VERSION, {
        upgrade(db) {
          if (!db.objectStoreNames.contains(PHOTO_STORE)) {
            db.createObjectStore(PHOTO_STORE, { keyPath: 'id' });
          }
          if (!db.objectStoreNames.contains(REQUEST_STORE)) {
            db.createObjectStore(REQUEST_STORE, { keyPath: 'id' });
          }
        },
      })
    );
  }
  return dbPromise;
}

// ============================================
// ENQUEUE
// ============================================

export async function enqueueOfflinePhoto(item: OfflinePhoto): Promise<void> {
  const db = await getDB();
  await db.put(PHOTO_STORE, { attempts: 0, ...item });
}

export async function enqueueOfflineRequest(item: OfflineRequest): Promise<void> {
  const db = await getDB();
  await db.put(REQUEST_STORE, { attempts: 0, ...item });
}

// ============================================
// READ
// ============================================

export async function getQueuedPhotos(): Promise<OfflinePhoto[]> {
  const db = await getDB();
  return db.getAll(PHOTO_STORE);
}

export async function getQueuedRequests(): Promise<OfflineRequest[]> {
  const db = await getDB();
  return db.getAll(REQUEST_STORE);
}

export async function getQueueSize(): Promise<{ photos: number; requests: number; total: number }> {
  const db = await getDB();
  const photos = await db.count(PHOTO_STORE);
  const requests = await db.count(REQUEST_STORE);
  return { photos, requests, total: photos + requests };
}

// ============================================
// REMOVE
// ============================================

export async function removeQueuedPhoto(id: string): Promise<void> {
  const db = await getDB();
  await db.delete(PHOTO_STORE, id);
}

export async function removeQueuedRequest(id: string): Promise<void> {
  const db = await getDB();
  await db.delete(REQUEST_STORE, id);
}

// ============================================
// PROCESSOR
// ============================================

// Internal flag — don't run two drain loops at once
let draining = false;
let processorTimer: ReturnType<typeof setInterval> | null = null;
let listenersAttached = false;

/**
 * Try to send a single queued photo. Returns true on success.
 */
async function trySendPhoto(item: OfflinePhoto): Promise<boolean> {
  const fd = new FormData();
  fd.append('photo', item.file, `photo-${item.id}.webp`);
  fd.append('ticketId', item.ticketId);
  fd.append('stage', item.stage);
  if (item.gpsLocation) fd.append('gpsLocation', item.gpsLocation);

  try {
    const res = await fetch(item.endpoint, { method: 'POST', body: fd });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      console.warn(`[offline-queue] photo ${item.id} HTTP ${res.status}: ${text}`);
      return false;
    }
    const json = await res.json().catch(() => null);
    return !!json?.success;
  } catch (err) {
    console.warn(`[offline-queue] photo ${item.id} network error:`, err);
    return false;
  }
}

/**
 * Try to send a single queued JSON request. Returns true on success.
 */
async function trySendRequest(item: OfflineRequest): Promise<boolean> {
  try {
    const res = await fetch(item.url, {
      method: item.method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(item.body),
    });
    return res.ok;
  } catch (err) {
    console.warn(`[offline-queue] request ${item.id} network error:`, err);
    return false;
  }
}

/**
 * Drain the queue once. Optionally fires a callback when an item
 * succeeds (caller can show a toast).
 */
export async function drainQueue(opts?: {
  onProgress?: (drained: number, remaining: number) => void;
  onComplete?: (drained: number) => void;
}): Promise<void> {
  if (draining) return;
  if (typeof navigator !== 'undefined' && !navigator.onLine) return;

  draining = true;
  let drained = 0;

  try {
    const db = await getDB();

    // Photos first (more user-visible)
    const photos = await db.getAll(PHOTO_STORE);
    for (const p of photos) {
      const ok = await trySendPhoto(p);
      if (ok) {
        await db.delete(PHOTO_STORE, p.id);
        drained++;
        const remaining = await db.count(PHOTO_STORE) + await db.count(REQUEST_STORE);
        opts?.onProgress?.(drained, remaining);
      } else {
        const next: OfflinePhoto = {
          ...p,
          attempts: (p.attempts || 0) + 1,
          lastAttemptAt: Date.now(),
        };
        await db.put(PHOTO_STORE, next);
        // Stop on failure — likely still offline. Avoid hammering the API.
        if (!navigator.onLine) break;
      }
    }

    // Then JSON requests
    const requests = await db.getAll(REQUEST_STORE);
    for (const r of requests) {
      const ok = await trySendRequest(r);
      if (ok) {
        await db.delete(REQUEST_STORE, r.id);
        drained++;
        const remaining = await db.count(PHOTO_STORE) + await db.count(REQUEST_STORE);
        opts?.onProgress?.(drained, remaining);
      } else {
        const next: OfflineRequest = {
          ...r,
          attempts: (r.attempts || 0) + 1,
          lastAttemptAt: Date.now(),
        };
        await db.put(REQUEST_STORE, next);
        if (!navigator.onLine) break;
      }
    }

    if (drained > 0) opts?.onComplete?.(drained);
  } finally {
    draining = false;
  }
}

// ============================================
// LIFECYCLE
// ============================================

/**
 * Start the background processor. Safe to call multiple times — only the
 * first call attaches listeners and starts the timer.
 *
 * Returns a cleanup function (useful in React useEffect).
 */
export function startOfflineQueue(opts?: {
  intervalMs?: number;
  onDrain?: (drained: number) => void;
}): () => void {
  if (typeof window === 'undefined') return () => {};

  const intervalMs = opts?.intervalMs ?? 30_000;

  const tryDrain = () => {
    drainQueue({
      onComplete: (drained) => {
        if (drained > 0) {
          console.info(`[offline-queue] drained ${drained} items`);
          opts?.onDrain?.(drained);
        }
      },
    }).catch((err) => console.error('[offline-queue] drain failed:', err));
  };

  if (!processorTimer) {
    processorTimer = setInterval(tryDrain, intervalMs);
  }

  if (!listenersAttached) {
    window.addEventListener('online', tryDrain);
    listenersAttached = true;
  }

  // Try once immediately on mount
  if (navigator.onLine) tryDrain();

  return () => {
    if (processorTimer) {
      clearInterval(processorTimer);
      processorTimer = null;
    }
    if (listenersAttached) {
      window.removeEventListener('online', tryDrain);
      listenersAttached = false;
    }
  };
}

export async function clearQueue(): Promise<void> {
  const db = await getDB();
  await db.clear(PHOTO_STORE);
  await db.clear(REQUEST_STORE);
}
