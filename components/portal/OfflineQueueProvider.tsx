'use client';

/**
 * OfflineQueueProvider
 *
 * Boots the IndexedDB-backed offline queue (see lib/offline-queue.ts)
 * and surfaces a single toast when the queue drains successfully.
 * Mount this once at the top of any client tree that needs offline retry.
 */

import { useEffect, useState } from 'react';
import { CheckCircle, WifiOff } from 'lucide-react';
import { startOfflineQueue, getQueueSize } from '@/lib/offline-queue';

export default function OfflineQueueProvider() {
  const [toast, setToast] = useState<string | null>(null);
  const [isOnline, setIsOnline] = useState(true);
  const [queuedCount, setQueuedCount] = useState(0);

  useEffect(() => {
    setIsOnline(typeof navigator !== 'undefined' ? navigator.onLine : true);

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    const refreshCount = () => {
      getQueueSize()
        .then((s) => setQueuedCount(s.total))
        .catch(() => {});
    };
    refreshCount();
    const countTimer = setInterval(refreshCount, 15_000);

    const stop = startOfflineQueue({
      intervalMs: 30_000,
      onDrain: (drained) => {
        setToast(`Synced ${drained} pending upload${drained === 1 ? '' : 's'}`);
        refreshCount();
        setTimeout(() => setToast(null), 4000);
      },
    });

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(countTimer);
      stop();
    };
  }, []);

  return (
    <>
      {!isOnline && queuedCount > 0 && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 bg-amber-500/20 border border-amber-500/40 text-amber-300 px-4 py-2 rounded-full text-sm flex items-center gap-2 shadow-lg">
          <WifiOff className="w-4 h-4" />
          Offline — {queuedCount} item{queuedCount === 1 ? '' : 's'} queued
        </div>
      )}
      {toast && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 bg-[#39FF14]/20 border border-[#39FF14]/40 text-[#39FF14] px-4 py-2 rounded-full text-sm flex items-center gap-2 shadow-lg">
          <CheckCircle className="w-4 h-4" />
          {toast}
        </div>
      )}
    </>
  );
}
