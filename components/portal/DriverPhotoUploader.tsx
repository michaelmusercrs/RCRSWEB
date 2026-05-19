'use client';

/**
 * DriverPhotoUploader
 *
 * Reusable photo upload component for driver/warehouse flows.
 *
 * Features:
 *   - Client-side image compression via `browser-image-compression`
 *     (resize max 1600px, target <500KB, WebP when supported)
 *   - Live thumbnail previews of each selected photo
 *   - Per-photo upload progress bar using XMLHttpRequest
 *     (fetch can't surface upload progress)
 *   - Automatic offline-queue fallback when network upload fails
 *   - Capture GPS once and attach to every upload
 *   - Dark theme, neon-green accents, mobile-friendly
 *
 * Used by:
 *   - /portal/delivery/loading-checklist (verify load)
 *   - /portal/delivery/returns (pickup/transit/delivery photos)
 *   - /portal/delivery/driver (proof of delivery)
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import imageCompression from 'browser-image-compression';
import { Camera, X, CheckCircle, Loader2, AlertTriangle, Upload, WifiOff } from 'lucide-react';
import { enqueueOfflinePhoto } from '@/lib/offline-queue';

export interface UploadedPhoto {
  id: string;
  url: string;
  filename: string;
  size: number;
  type: string;
  gpsLocation?: string;
  uploadedAt: string;
}

interface PendingPhoto {
  id: string;
  file: File;
  originalSize: number;
  compressedSize: number;
  preview: string;
  progress: number; // 0..100
  status: 'pending' | 'compressing' | 'uploading' | 'done' | 'error' | 'queued';
  error?: string;
  uploaded?: UploadedPhoto;
}

interface Props {
  ticketId: string;
  stage: string;
  maxPhotos?: number;
  label?: string;
  helpText?: string;
  uploadEndpoint?: string;
  onChange?: (uploaded: UploadedPhoto[]) => void;
  initialPhotos?: UploadedPhoto[];
}

const DEFAULT_ENDPOINT = '/api/portal/delivery/photos';

// Compression target: max 1600px longest side, target <500KB
const COMPRESSION_OPTIONS = {
  maxSizeMB: 0.5,
  maxWidthOrHeight: 1600,
  useWebWorker: true,
  fileType: 'image/webp' as const, // browser-image-compression handles fallback automatically
  initialQuality: 0.85,
};

// Detect WebP support — fall back to JPEG if the browser/canvas can't encode WebP
function supportsWebP(): boolean {
  if (typeof document === 'undefined') return false;
  const canvas = document.createElement('canvas');
  canvas.width = 1;
  canvas.height = 1;
  try {
    return canvas.toDataURL('image/webp').startsWith('data:image/webp');
  } catch {
    return false;
  }
}

export default function DriverPhotoUploader({
  ticketId,
  stage,
  maxPhotos = 10,
  label = 'Add Photos',
  helpText = 'Tap to take a photo or pick from your gallery.',
  uploadEndpoint = DEFAULT_ENDPOINT,
  onChange,
  initialPhotos = [],
}: Props) {
  const [photos, setPhotos] = useState<PendingPhoto[]>([]);
  const [uploaded, setUploaded] = useState<UploadedPhoto[]>(initialPhotos);
  const [gps, setGps] = useState<string | undefined>(undefined);
  const [isOnline, setIsOnline] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const webpRef = useRef<boolean | null>(null);

  // Detect WebP support once
  useEffect(() => {
    webpRef.current = supportsWebP();
  }, []);

  // Capture GPS best-effort on mount (silent failure if denied)
  useEffect(() => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => setGps(`${pos.coords.latitude.toFixed(6)},${pos.coords.longitude.toFixed(6)}`),
      (err) => console.warn('[uploader] GPS unavailable:', err.message),
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 60_000 }
    );
  }, []);

  // Online/offline detection — when we go offline, in-flight items get queued
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const setOn = () => setIsOnline(true);
    const setOff = () => setIsOnline(false);
    setIsOnline(navigator.onLine);
    window.addEventListener('online', setOn);
    window.addEventListener('offline', setOff);
    return () => {
      window.removeEventListener('online', setOn);
      window.removeEventListener('offline', setOff);
    };
  }, []);

  // Push uploaded list to parent whenever it changes
  useEffect(() => {
    onChange?.(uploaded);
  }, [uploaded, onChange]);

  const updatePhoto = useCallback((id: string, patch: Partial<PendingPhoto>) => {
    setPhotos((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  }, []);

  const uploadOne = useCallback(
    async (item: PendingPhoto, blob: File) => {
      return new Promise<UploadedPhoto>((resolve, reject) => {
        const fd = new FormData();
        fd.append('photo', blob);
        fd.append('ticketId', ticketId);
        fd.append('stage', stage);
        if (gps) fd.append('gpsLocation', gps);

        const xhr = new XMLHttpRequest();
        xhr.open('POST', uploadEndpoint);
        xhr.responseType = 'json';

        xhr.upload.addEventListener('progress', (evt) => {
          if (!evt.lengthComputable) return;
          const pct = Math.round((evt.loaded / evt.total) * 100);
          updatePhoto(item.id, { progress: pct });
        });

        xhr.addEventListener('load', () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            const json = xhr.response;
            if (json?.success && json.photo) {
              resolve(json.photo as UploadedPhoto);
            } else {
              reject(new Error(json?.error || `Upload failed (${xhr.status})`));
            }
          } else {
            const errMsg = xhr.response?.error || `Upload failed (${xhr.status})`;
            reject(new Error(errMsg));
          }
        });

        xhr.addEventListener('error', () => reject(new Error('Network error')));
        xhr.addEventListener('abort', () => reject(new Error('Upload aborted')));

        xhr.send(fd);
      });
    },
    [ticketId, stage, gps, uploadEndpoint, updatePhoto]
  );

  const processFile = useCallback(
    async (file: File) => {
      if (photos.length + uploaded.length >= maxPhotos) {
        console.warn('[uploader] max photos reached, ignoring file');
        return;
      }

      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
      const preview = URL.createObjectURL(file);

      const pending: PendingPhoto = {
        id,
        file,
        originalSize: file.size,
        compressedSize: file.size,
        preview,
        progress: 0,
        status: 'compressing',
      };
      setPhotos((prev) => [...prev, pending]);

      // 1. Compress
      let compressed: File;
      try {
        const opts = {
          ...COMPRESSION_OPTIONS,
          // Fall back to JPEG if the browser can't render WebP
          fileType: (webpRef.current ? 'image/webp' : 'image/jpeg') as
            | 'image/webp'
            | 'image/jpeg',
        };
        compressed = await imageCompression(file, opts);
      } catch (err) {
        console.warn('[uploader] compression failed, uploading original:', err);
        compressed = file;
      }
      updatePhoto(id, {
        compressedSize: compressed.size,
        status: 'uploading',
      });

      // 2. Upload (or queue if offline)
      if (!navigator.onLine) {
        try {
          await enqueueOfflinePhoto({
            id,
            ticketId,
            stage,
            gpsLocation: gps,
            file: compressed,
            endpoint: uploadEndpoint,
            queuedAt: Date.now(),
          });
          updatePhoto(id, { status: 'queued' });
        } catch (err) {
          updatePhoto(id, {
            status: 'error',
            error: err instanceof Error ? err.message : 'Failed to queue offline',
          });
        }
        return;
      }

      try {
        const result = await uploadOne(pending, compressed);
        updatePhoto(id, { status: 'done', uploaded: result, progress: 100 });
        setUploaded((prev) => [...prev, result]);
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Upload failed';
        // Queue for retry on next online event
        try {
          await enqueueOfflinePhoto({
            id,
            ticketId,
            stage,
            gpsLocation: gps,
            file: compressed,
            endpoint: uploadEndpoint,
            queuedAt: Date.now(),
          });
          updatePhoto(id, { status: 'queued', error: msg });
        } catch (qerr) {
          updatePhoto(id, {
            status: 'error',
            error: msg + ' (offline queue also failed)',
          });
        }
      }
    },
    [photos.length, uploaded.length, maxPhotos, ticketId, stage, gps, uploadEndpoint, updatePhoto, uploadOne]
  );

  const handleFiles = useCallback(
    (files: FileList | null) => {
      if (!files) return;
      Array.from(files).forEach((f) => {
        if (f.type.startsWith('image/')) processFile(f);
      });
      if (fileInputRef.current) fileInputRef.current.value = '';
    },
    [processFile]
  );

  const removePhoto = (id: string) => {
    setPhotos((prev) => {
      const removed = prev.find((p) => p.id === id);
      if (removed?.preview) URL.revokeObjectURL(removed.preview);
      const filtered = prev.filter((p) => p.id !== id);
      // Also remove from uploaded list if it had been successfully uploaded
      if (removed?.uploaded) {
        setUploaded((u) => u.filter((x) => x.url !== removed.uploaded?.url));
      }
      return filtered;
    });
  };

  const totalPhotos = photos.length + uploaded.length;
  const canAddMore = totalPhotos < maxPhotos;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-white flex items-center gap-2">
            <Camera className="w-4 h-4 text-[#39FF14]" />
            {label}
          </h3>
          <p className="text-xs text-zinc-500 mt-0.5">{helpText}</p>
        </div>
        <div className="flex items-center gap-2 text-xs">
          {!isOnline && (
            <span className="inline-flex items-center gap-1 px-2 py-1 bg-amber-500/15 border border-amber-500/30 text-amber-400 rounded">
              <WifiOff className="w-3 h-3" /> Offline
            </span>
          )}
          <span className="text-zinc-500">
            {totalPhotos}/{maxPhotos}
          </span>
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        multiple
        onChange={(e) => handleFiles(e.target.files)}
        className="hidden"
      />

      {canAddMore && (
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="w-full py-4 border-2 border-dashed border-zinc-700 hover:border-[#39FF14] rounded-xl text-zinc-400 hover:text-[#39FF14] transition-colors flex items-center justify-center gap-2"
        >
          <Camera className="w-5 h-5" />
          <span className="font-medium">Take or Choose Photo</span>
        </button>
      )}

      {(photos.length > 0 || uploaded.length > 0) && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {/* Previously uploaded (from initialPhotos) without a pending entry */}
          {uploaded
            .filter((u) => !photos.some((p) => p.uploaded?.url === u.url))
            .map((u) => (
              <div
                key={u.url}
                className="relative aspect-square bg-zinc-900 border border-[#39FF14]/30 rounded-lg overflow-hidden"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={u.url} alt={u.filename} className="w-full h-full object-cover" />
                <div className="absolute top-1 right-1 bg-[#39FF14] text-black rounded-full p-1">
                  <CheckCircle className="w-3 h-3" />
                </div>
              </div>
            ))}

          {photos.map((p) => (
            <div
              key={p.id}
              className="relative aspect-square bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.preview} alt="upload preview" className="w-full h-full object-cover" />

              {p.status === 'compressing' && (
                <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center text-xs text-white">
                  <Loader2 className="w-5 h-5 animate-spin text-[#39FF14] mb-1" />
                  Compressing…
                </div>
              )}

              {p.status === 'uploading' && (
                <div className="absolute inset-x-0 bottom-0 bg-black/70 p-1.5">
                  <div className="text-[10px] text-white mb-1 flex items-center gap-1">
                    <Upload className="w-3 h-3" /> {p.progress}%
                  </div>
                  <div className="h-1 bg-zinc-700 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[#39FF14] transition-all"
                      style={{ width: `${p.progress}%` }}
                    />
                  </div>
                </div>
              )}

              {p.status === 'done' && (
                <div className="absolute top-1 right-1 bg-[#39FF14] text-black rounded-full p-1">
                  <CheckCircle className="w-3 h-3" />
                </div>
              )}

              {p.status === 'queued' && (
                <div className="absolute inset-x-0 bottom-0 bg-amber-500/80 text-black text-[10px] px-1.5 py-0.5 flex items-center gap-1">
                  <WifiOff className="w-3 h-3" /> Queued
                </div>
              )}

              {p.status === 'error' && (
                <div className="absolute inset-0 bg-red-600/70 flex flex-col items-center justify-center text-[10px] text-white p-1 text-center">
                  <AlertTriangle className="w-4 h-4 mb-1" />
                  {p.error || 'Upload failed'}
                </div>
              )}

              <button
                type="button"
                onClick={() => removePhoto(p.id)}
                className="absolute top-1 left-1 bg-black/70 hover:bg-red-600 text-white rounded-full p-1"
                aria-label="Remove photo"
              >
                <X className="w-3 h-3" />
              </button>

              <div className="absolute bottom-0 left-0 right-0 bg-black/60 px-1.5 py-0.5 text-[9px] text-zinc-300 flex items-center justify-between">
                <span>{(p.compressedSize / 1024).toFixed(0)}KB</span>
                {p.originalSize !== p.compressedSize && (
                  <span className="text-[#39FF14]">
                    -{Math.round(((p.originalSize - p.compressedSize) / p.originalSize) * 100)}%
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
