'use client';

import { useState, useEffect, useRef, useCallback, DragEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import {
  ArrowLeft,
  Upload,
  Trash2,
  Check,
  X,
  Loader2,
  Camera,
  Truck,
  Image as ImageIcon,
  AlertCircle,
  Clock,
  Plus,
  Car,
  HardHat,
  Eye,
  EyeOff,
  Move,
  Info,
} from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { teamMembers } from '@/lib/teamData';
import { ProfileImage } from '@/lib/profile-types';

type ImageType = ProfileImage['type'];
type UploadType = Exclude<ImageType, 'video'>;

// Accepted file formats
const ACCEPTED_IMAGE_FORMATS = 'image/jpeg,image/jpg,image/png,image/webp,image/heic,image/heif,image/gif,image/tiff,image/bmp';
const ACCEPTED_VIDEO_FORMATS = 'video/mp4,video/webm,video/quicktime,video/x-msvideo';
const ALLOWED_IMAGE_TYPES = [
  'image/jpeg', 'image/jpg', 'image/png', 'image/webp',
  'image/heic', 'image/heif', 'image/gif', 'image/tiff', 'image/bmp',
];
const ALLOWED_VIDEO_TYPES = ['video/mp4', 'video/webm', 'video/quicktime', 'video/x-msvideo'];
const ALL_ALLOWED = [...ALLOWED_IMAGE_TYPES, ...ALLOWED_VIDEO_TYPES];

// Format badge labels
const FORMAT_BADGES = ['JPEG', 'PNG', 'WebP', 'HEIC', 'GIF', 'TIFF', 'BMP'];
const VIDEO_FORMAT_BADGES = ['MP4', 'WebM', 'MOV', 'AVI'];

// Roles that can see specific sections
const VEHICLE_ROLES = ['owner', 'admin', 'manager', 'sales', 'driver', 'project_manager', 'office'];
const JOB_PHOTO_ROLES = ['owner', 'admin', 'manager', 'sales', 'project_manager'];
const JOB_SITE_ROLES = ['owner', 'admin', 'manager', 'sales', 'project_manager'];
const BEFORE_AFTER_TOGGLE_ROLES = ['owner', 'admin'];

// ------- Upload Preview & Crop Modal -------
interface UploadPreviewProps {
  file: File;
  previewType: UploadType | 'video';
  onConfirm: () => void;
  onCancel: () => void;
  isUploading: boolean;
}

function UploadPreviewModal({ file, previewType, onConfirm, onCancel, isUploading }: UploadPreviewProps) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [position, setPosition] = useState({ x: 50, y: 50 }); // percent
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef<{ x: number; y: number; posX: number; posY: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const isCircular = previewType === 'profile';
  const isLandscape = previewType === 'truck' || previewType === 'vehicle';

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    dragStart.current = { x: e.clientX, y: e.clientY, posX: position.x, posY: position.y };
  };

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging || !dragStart.current || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const dx = ((e.clientX - dragStart.current.x) / rect.width) * 100;
    const dy = ((e.clientY - dragStart.current.y) / rect.height) * 100;
    setPosition({
      x: Math.max(0, Math.min(100, dragStart.current.posX + dx)),
      y: Math.max(0, Math.min(100, dragStart.current.posY + dy)),
    });
  }, [isDragging]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
    dragStart.current = null;
  }, []);

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, handleMouseMove, handleMouseUp]);

  if (!previewUrl) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4" onClick={onCancel}>
      <div
        className="bg-neutral-900 border border-white/10 rounded-2xl p-6 max-w-lg w-full"
        onClick={e => e.stopPropagation()}
      >
        <h3 className="text-lg font-semibold text-white mb-1">Preview Upload</h3>
        <p className="text-sm text-neutral-400 mb-4">
          {isCircular
            ? 'Drag to reposition how your profile photo will appear.'
            : isLandscape
              ? 'Drag to reposition how your vehicle photo will appear (landscape crop).'
              : 'Preview of your upload.'}
        </p>

        {/* Crop preview area */}
        <div className="flex justify-center mb-4">
          <div
            ref={containerRef}
            className={`relative overflow-hidden bg-neutral-800 cursor-move select-none ${
              isCircular ? 'w-48 h-48 rounded-full' : isLandscape ? 'w-80 h-52 rounded-xl' : 'w-64 h-64 rounded-xl'
            }`}
            onMouseDown={handleMouseDown}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={previewUrl}
              alt="Upload preview"
              className="absolute w-full h-full"
              style={{
                objectFit: 'cover',
                objectPosition: `${position.x}% ${position.y}%`,
              }}
              draggable={false}
            />
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-0 hover:opacity-100 transition-opacity">
              <Move size={24} className="text-white drop-shadow-lg" />
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs text-neutral-500 mb-4">
          <Move size={12} />
          <span>Drag image to reposition</span>
        </div>

        <div className="text-xs text-neutral-500 mb-4">
          <span className="text-neutral-400">{file.name}</span>
          <span className="mx-2">|</span>
          <span>{(file.size / 1024 / 1024).toFixed(1)} MB</span>
          <span className="mx-2">|</span>
          <span>{file.type.split('/')[1]?.toUpperCase()}</span>
        </div>

        <div className="flex gap-3 justify-end">
          <button
            onClick={onCancel}
            disabled={isUploading}
            className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={isUploading}
            className="inline-flex items-center gap-2 px-4 py-2 bg-brand-green hover:bg-green-400 text-black font-medium rounded-xl transition-colors disabled:opacity-50"
          >
            {isUploading ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Uploading...
              </>
            ) : (
              <>
                <Upload size={16} />
                Upload
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// ------- Drag-and-Drop Zone -------
interface DropZoneProps {
  label: string;
  maxSize: string;
  onFileDrop: (file: File) => void;
  onClickUpload: () => void;
  isUploading: boolean;
  isActive: boolean;
  icon?: React.ReactNode;
}

function DropZone({ label, maxSize, onFileDrop, onClickUpload, isUploading, isActive, icon }: DropZoneProps) {
  const [isDragOver, setIsDragOver] = useState(false);

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) onFileDrop(file);
  };

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={onClickUpload}
      className={`relative border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all ${
        isDragOver
          ? 'border-brand-green bg-brand-green/10'
          : 'border-white/10 hover:border-white/30 hover:bg-white/[0.02]'
      }`}
    >
      {isUploading && isActive ? (
        <div className="flex flex-col items-center gap-2">
          <Loader2 size={24} className="text-brand-green animate-spin" />
          <span className="text-sm text-neutral-400">Uploading...</span>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-2">
          {icon || <Upload size={24} className="text-neutral-500" />}
          <span className="text-sm text-neutral-300">{label}</span>
          <span className="text-xs text-neutral-500">Drag & drop or click to browse</span>
          <span className="text-xs text-neutral-600">Max {maxSize}</span>
        </div>
      )}
    </div>
  );
}

// ------- Format Badges Component -------
function FormatBadges({ formats, className }: { formats: string[]; className?: string }) {
  return (
    <div className={`flex flex-wrap gap-1 ${className || ''}`}>
      <span className="text-xs text-neutral-500 mr-1">Accepted:</span>
      {formats.map(f => (
        <span key={f} className="text-[10px] px-1.5 py-0.5 bg-white/5 border border-white/10 rounded text-neutral-400">
          {f}
        </span>
      ))}
    </div>
  );
}

// ------- Format Notification -------
function FormatNotification({ file, onDismiss }: { file: File; onDismiss: () => void }) {
  const ext = file.name.split('.').pop()?.toLowerCase();
  const isHeic = ext === 'heic' || ext === 'heif' || file.type.includes('heic') || file.type.includes('heif');
  const isUncommon = ['tiff', 'tif', 'bmp'].includes(ext || '');

  if (!isHeic && !isUncommon) return null;

  return (
    <div className="mb-3 p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg flex items-start gap-2">
      <Info size={14} className="text-blue-400 mt-0.5 flex-shrink-0" />
      <div className="flex-1">
        <p className="text-xs text-blue-300">
          {isHeic
            ? 'HEIC/HEIF (iPhone photo) detected. This format is accepted and will be processed automatically.'
            : `${ext?.toUpperCase()} format detected. This format is supported but may take a moment to process.`}
        </p>
      </div>
      <button onClick={onDismiss} className="text-blue-400 hover:text-white">
        <X size={12} />
      </button>
    </div>
  );
}

// ======= Main Page Component =======
export default function MyProfileImagesPage() {
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();
  const [images, setImages] = useState<ProfileImage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadType, setUploadType] = useState<UploadType>('profile');
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [repSlug, setRepSlug] = useState<string | null>(null);
  const [currentProfileImage, setCurrentProfileImage] = useState<string | null>(null);
  const [currentTruckImage, setCurrentTruckImage] = useState<string | null>(null);
  const [showBeforeAfter, setShowBeforeAfter] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [pendingUploadType, setPendingUploadType] = useState<UploadType | 'video'>('profile');
  const [formatNotifFile, setFormatNotifFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);

  const userRole = user?.role || 'viewer';
  const isAdminOrOwner = userRole === 'admin' || userRole === 'owner';
  const canSeeVehicle = VEHICLE_ROLES.includes(userRole);
  const canSeeJobPhotos = JOB_PHOTO_ROLES.includes(userRole);
  const canSeeJobSite = JOB_SITE_ROLES.includes(userRole);
  const canToggleBeforeAfter = BEFORE_AFTER_TOGGLE_ROLES.includes(userRole);

  // Redirect if not authenticated
  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/portal');
    }
  }, [user, authLoading, router]);

  // Find team member and load images
  useEffect(() => {
    if (!user) return;

    const loadData = async () => {
      setIsLoading(true);

      const member = teamMembers.find(m =>
        m.email.toLowerCase() === user.email.toLowerCase()
      );

      if (member) {
        setRepSlug(member.slug);
        setCurrentProfileImage(member.profileImage || null);
        setCurrentTruckImage(member.truckImage || null);

        try {
          const response = await fetch(`/api/profile/images?repSlug=${member.slug}`);
          if (response.ok) {
            const data = await response.json();
            setImages(data.images || []);
          }
        } catch (error) {
          console.error('Error loading images:', error);
        }
      }

      setIsLoading(false);
    };

    loadData();
  }, [user]);

  const handleFileSelect = (type: UploadType | 'video') => {
    if (type === 'video') {
      setUploadType('profile');
      videoInputRef.current?.click();
    } else {
      setUploadType(type);
      fileInputRef.current?.click();
    }
  };

  // Validate and show preview instead of immediately uploading
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !repSlug) return;

    const isVideo = ALLOWED_VIDEO_TYPES.includes(file.type);

    // Check if format is unrecognized (some browsers report HEIC as empty string)
    const ext = file.name.split('.').pop()?.toLowerCase();
    const heicExts = ['heic', 'heif'];
    const isLikelyHeic = heicExts.includes(ext || '') && !file.type;

    if (!ALL_ALLOWED.includes(file.type) && !isLikelyHeic) {
      setMessage({ type: 'error', text: `Unsupported file type "${file.type || ext}". Accepted: JPEG, PNG, WebP, HEIC, GIF, TIFF, BMP, MP4, WebM, MOV, AVI.` });
      return;
    }

    const maxSize = isVideo ? 50 * 1024 * 1024 : 10 * 1024 * 1024;
    if (file.size > maxSize) {
      setMessage({ type: 'error', text: `File too large. Maximum: ${isVideo ? '50MB' : '10MB'}.` });
      return;
    }

    // Show format notification for special formats
    setFormatNotifFile(file);

    // For videos, upload directly (no crop preview)
    if (isVideo) {
      setPendingUploadType('video');
      await executeUpload(file, 'video');
    } else {
      // Show crop/preview modal
      setPendingFile(file);
      setPendingUploadType(uploadType);
    }
  };

  const executeUpload = async (file: File, type: UploadType | 'video') => {
    if (!repSlug) return;

    const isVideo = ALLOWED_VIDEO_TYPES.includes(file.type);
    setIsUploading(true);
    setMessage(null);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('repSlug', repSlug);
      formData.append('type', isVideo ? 'video' : type);
      formData.append('uploadedBy', user?.name || 'unknown');

      const response = await fetch('/api/profile/images', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setImages(prev => [...prev, data.image]);
        setMessage({ type: 'success', text: 'Image uploaded successfully! Pending admin approval.' });
      } else {
        throw new Error(data.error || 'Upload failed');
      }
    } catch (error) {
      console.error('Upload error:', error);
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Upload failed' });
    } finally {
      setIsUploading(false);
      setPendingFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      if (videoInputRef.current) videoInputRef.current.value = '';
    }
  };

  const handlePreviewConfirm = () => {
    if (pendingFile) {
      executeUpload(pendingFile, pendingUploadType as UploadType);
    }
  };

  const handlePreviewCancel = () => {
    setPendingFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleDropFile = (file: File, type: UploadType | 'video') => {
    const isVideo = ALLOWED_VIDEO_TYPES.includes(file.type);
    const ext = file.name.split('.').pop()?.toLowerCase();
    const heicExts = ['heic', 'heif'];
    const isLikelyHeic = heicExts.includes(ext || '') && !file.type;

    if (!ALL_ALLOWED.includes(file.type) && !isLikelyHeic) {
      setMessage({ type: 'error', text: `Unsupported file type "${file.type || ext}". Accepted: JPEG, PNG, WebP, HEIC, GIF, TIFF, BMP.` });
      return;
    }

    const maxSize = isVideo ? 50 * 1024 * 1024 : 10 * 1024 * 1024;
    if (file.size > maxSize) {
      setMessage({ type: 'error', text: `File too large. Maximum: ${isVideo ? '50MB' : '10MB'}.` });
      return;
    }

    setFormatNotifFile(file);

    if (isVideo) {
      executeUpload(file, 'video');
    } else {
      setUploadType(type as UploadType);
      setPendingFile(file);
      setPendingUploadType(type);
    }
  };

  const handleDeleteImage = async (image: ProfileImage) => {
    if (!confirm('Are you sure you want to delete this image?')) return;

    try {
      const response = await fetch(`/api/profile/images?url=${encodeURIComponent(image.url)}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        setImages(prev => prev.filter(img => img.id !== image.id));
        setMessage({ type: 'success', text: 'Image deleted successfully' });
      } else {
        throw new Error('Failed to delete image');
      }
    } catch {
      setMessage({ type: 'error', text: 'Failed to delete image' });
    }
  };

  const getImagesByType = (type: ImageType) => {
    return images.filter(img => img.type === type);
  };

  // Loading state
  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-neutral-950 via-neutral-900 to-neutral-950 flex items-center justify-center">
        <Loader2 className="animate-spin text-brand-green" size={48} />
      </div>
    );
  }

  if (!repSlug) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-neutral-950 via-neutral-900 to-neutral-950 p-6">
        <div className="max-w-2xl mx-auto text-center py-12">
          <AlertCircle size={48} className="mx-auto text-yellow-500 mb-4" />
          <h1 className="text-2xl font-bold text-white mb-2">Profile Not Found</h1>
          <p className="text-neutral-400 mb-6">
            We couldn&apos;t find your team profile. Please contact an administrator.
          </p>
          <Link
            href="/portal/dashboard"
            className="inline-flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors"
          >
            <ArrowLeft size={16} />
            Back to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-neutral-950 via-neutral-900 to-neutral-950">
      {/* Background Pattern */}
      <div className="fixed inset-0 opacity-30 pointer-events-none">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `radial-gradient(circle at 25px 25px, rgba(255,255,255,0.03) 2px, transparent 0)`,
            backgroundSize: '50px 50px',
          }}
        />
      </div>

      {/* Hidden file inputs */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept={ACCEPTED_IMAGE_FORMATS}
        className="hidden"
      />
      <input
        type="file"
        ref={videoInputRef}
        onChange={handleFileChange}
        accept={ACCEPTED_VIDEO_FORMATS}
        className="hidden"
      />

      {/* Upload Preview Modal */}
      {pendingFile && (
        <UploadPreviewModal
          file={pendingFile}
          previewType={pendingUploadType}
          onConfirm={handlePreviewConfirm}
          onCancel={handlePreviewCancel}
          isUploading={isUploading}
        />
      )}

      <div className="relative z-10 max-w-4xl mx-auto p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <Link
              href="/portal/my-profile"
              className="inline-flex items-center gap-2 text-neutral-400 hover:text-white transition-colors mb-2"
            >
              <ArrowLeft size={16} />
              Back to Profile
            </Link>
            <h1 className="text-2xl font-bold text-white">Manage Images</h1>
            <p className="text-neutral-400">
              Upload and manage your profile photos, vehicle images, and job photos
            </p>
          </div>
        </div>

        {/* Message */}
        {message && (
          <div
            className={`mb-6 p-4 rounded-xl flex items-start gap-3 ${
              message.type === 'success'
                ? 'bg-green-500/10 border border-green-500/30'
                : 'bg-red-500/10 border border-red-500/30'
            }`}
          >
            {message.type === 'success' ? (
              <Check size={20} className="text-green-500 flex-shrink-0 mt-0.5" />
            ) : (
              <AlertCircle size={20} className="text-red-500 flex-shrink-0 mt-0.5" />
            )}
            <div className="flex-1">
              <p className={`text-sm ${message.type === 'success' ? 'text-green-300' : 'text-red-300'}`}>
                {message.text}
              </p>
            </div>
            <button onClick={() => setMessage(null)} className="text-neutral-400 hover:text-white">
              <X size={16} />
            </button>
          </div>
        )}

        {/* Format notification */}
        {formatNotifFile && (
          <FormatNotification file={formatNotifFile} onDismiss={() => setFormatNotifFile(null)} />
        )}

        {/* ===== Profile Photo Section ===== */}
        <div className="mb-8 p-6 bg-white/[0.02] border border-white/5 rounded-2xl">
          <div className="flex items-center gap-3 mb-4">
            <Camera size={20} className="text-brand-green" />
            <h2 className="text-lg font-semibold text-white">Profile Photo</h2>
            <span className="text-xs text-neutral-500 ml-auto">Max 10MB</span>
          </div>

          <div className="flex flex-col sm:flex-row items-start gap-6">
            {/* Current Profile Image - circular preview */}
            <div className="relative w-32 h-32 rounded-full overflow-hidden bg-neutral-800 flex-shrink-0 ring-2 ring-white/10">
              {currentProfileImage ? (
                <Image
                  src={currentProfileImage}
                  alt="Current profile"
                  fill
                  className="object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Camera size={32} className="text-neutral-600" />
                </div>
              )}
            </div>

            <div className="flex-1 w-full">
              <p className="text-neutral-400 text-sm mb-3">
                Your profile photo appears on your public team page. Square images work best and will be displayed in a circular crop.
              </p>

              <FormatBadges formats={FORMAT_BADGES} className="mb-3" />

              <DropZone
                label="Upload Profile Photo"
                maxSize="10MB"
                onFileDrop={(file) => handleDropFile(file, 'profile')}
                onClickUpload={() => handleFileSelect('profile')}
                isUploading={isUploading}
                isActive={uploadType === 'profile'}
                icon={<Camera size={24} className="text-neutral-500" />}
              />

              {/* Uploaded profile images */}
              {getImagesByType('profile').length > 0 && (
                <div className="mt-4">
                  <p className="text-xs text-neutral-500 mb-2">Uploaded photos (pending approval):</p>
                  <div className="flex flex-wrap gap-2">
                    {getImagesByType('profile').map(img => (
                      <div key={img.id} className="relative group">
                        <div className="w-16 h-16 rounded-full overflow-hidden bg-neutral-800">
                          <Image src={img.url} alt="Profile photo upload" fill className="object-cover" />
                        </div>
                        {!img.approved && (
                          <div className="absolute top-0 left-0">
                            <Clock size={12} className="text-yellow-500" />
                          </div>
                        )}
                        <button
                          onClick={() => handleDeleteImage(img)}
                          className="absolute top-0 right-0 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <Trash2 size={12} className="text-white" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ===== Truck Photo Section ===== */}
        <div className="mb-8 p-6 bg-white/[0.02] border border-white/5 rounded-2xl">
          <div className="flex items-center gap-3 mb-4">
            <Truck size={20} className="text-blue-400" />
            <h2 className="text-lg font-semibold text-white">Truck Photo</h2>
            <span className="text-xs text-neutral-500 ml-auto">Max 10MB</span>
          </div>

          <div className="flex flex-col sm:flex-row items-start gap-6">
            {/* Current Truck Image - landscape preview */}
            <div className="relative w-40 h-28 rounded-xl overflow-hidden bg-neutral-800 flex-shrink-0">
              {currentTruckImage ? (
                <Image
                  src={currentTruckImage}
                  alt="Current truck"
                  fill
                  className="object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Truck size={32} className="text-neutral-600" />
                </div>
              )}
            </div>

            <div className="flex-1 w-full">
              <p className="text-neutral-400 text-sm mb-3">
                Help customers know what vehicle to expect. Show your branded work truck! Landscape photos work best.
              </p>

              <FormatBadges formats={FORMAT_BADGES} className="mb-3" />

              <DropZone
                label="Upload Truck Photo"
                maxSize="10MB"
                onFileDrop={(file) => handleDropFile(file, 'truck')}
                onClickUpload={() => handleFileSelect('truck')}
                isUploading={isUploading}
                isActive={uploadType === 'truck'}
                icon={<Truck size={24} className="text-neutral-500" />}
              />

              {/* Uploaded truck images */}
              {getImagesByType('truck').length > 0 && (
                <div className="mt-4">
                  <p className="text-xs text-neutral-500 mb-2">Uploaded photos (pending approval):</p>
                  <div className="flex flex-wrap gap-2">
                    {getImagesByType('truck').map(img => (
                      <div key={img.id} className="relative group">
                        <div className="w-20 h-14 rounded-lg overflow-hidden bg-neutral-800">
                          <Image src={img.url} alt="Truck photo upload" fill className="object-cover" />
                        </div>
                        {!img.approved && (
                          <div className="absolute top-1 left-1">
                            <Clock size={12} className="text-yellow-500" />
                          </div>
                        )}
                        <button
                          onClick={() => handleDeleteImage(img)}
                          className="absolute top-1 right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <Trash2 size={12} className="text-white" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ===== Vehicle Photos Section (new) ===== */}
        {canSeeVehicle && (
          <div className="mb-8 p-6 bg-white/[0.02] border border-white/5 rounded-2xl">
            <div className="flex items-center gap-3 mb-4">
              <Car size={20} className="text-cyan-400" />
              <h2 className="text-lg font-semibold text-white">Work Vehicle Photos</h2>
              <span className="text-xs text-neutral-500 ml-auto">Max 10MB each</span>
            </div>

            <p className="text-neutral-400 text-sm mb-3">
              Upload photos of your work vehicle. Multiple photos allowed for different angles.
            </p>

            <FormatBadges formats={FORMAT_BADGES} className="mb-3" />

            <DropZone
              label="Upload Vehicle Photo"
              maxSize="10MB"
              onFileDrop={(file) => handleDropFile(file, 'vehicle')}
              onClickUpload={() => handleFileSelect('vehicle')}
              isUploading={isUploading}
              isActive={uploadType === 'vehicle'}
              icon={<Car size={24} className="text-neutral-500" />}
            />

            {/* Uploaded vehicle images */}
            {getImagesByType('vehicle').length > 0 && (
              <div className="mt-4">
                <p className="text-xs text-neutral-500 mb-2">Vehicle photos:</p>
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                  {getImagesByType('vehicle').map(img => (
                    <div key={img.id} className="relative group aspect-[4/3]">
                      <div className="absolute inset-0 rounded-lg overflow-hidden bg-neutral-800">
                        <Image src={img.url} alt="Work vehicle photo" fill className="object-cover" />
                      </div>
                      {!img.approved && (
                        <div className="absolute top-1 left-1">
                          <Clock size={12} className="text-yellow-500" />
                        </div>
                      )}
                      <button
                        onClick={() => handleDeleteImage(img)}
                        className="absolute top-1 right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <Trash2 size={10} className="text-white" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ===== Job Site Photos Section (PM & Sales) ===== */}
        {canSeeJobSite && (
          <div className="mb-8 p-6 bg-white/[0.02] border border-white/5 rounded-2xl">
            <div className="flex items-center gap-3 mb-4">
              <HardHat size={20} className="text-orange-400" />
              <h2 className="text-lg font-semibold text-white">Job Site Photos</h2>
              <span className="text-xs text-neutral-500 ml-auto">Max 10MB each</span>
            </div>

            <p className="text-neutral-400 text-sm mb-3">
              Document active job sites with progress photos, site conditions, and completed work.
            </p>

            <FormatBadges formats={FORMAT_BADGES} className="mb-3" />

            <DropZone
              label="Upload Job Site Photo"
              maxSize="10MB"
              onFileDrop={(file) => handleDropFile(file, 'job-site')}
              onClickUpload={() => handleFileSelect('job-site')}
              isUploading={isUploading}
              isActive={uploadType === 'job-site'}
              icon={<HardHat size={24} className="text-neutral-500" />}
            />

            {/* Uploaded job site images */}
            {getImagesByType('job-site').length > 0 && (
              <div className="mt-4">
                <p className="text-xs text-neutral-500 mb-2">Job site photos:</p>
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                  {getImagesByType('job-site').map(img => (
                    <div key={img.id} className="relative group aspect-square">
                      <div className="absolute inset-0 rounded-lg overflow-hidden bg-neutral-800">
                        <Image src={img.url} alt="Job site photo" fill className="object-cover" />
                      </div>
                      {!img.approved && (
                        <div className="absolute top-1 left-1">
                          <Clock size={12} className="text-yellow-500" />
                        </div>
                      )}
                      <button
                        onClick={() => handleDeleteImage(img)}
                        className="absolute top-1 right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <Trash2 size={10} className="text-white" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ===== Job Photos Before/After Section ===== */}
        {canSeeJobPhotos && (
          <div className="mb-8 p-6 bg-white/[0.02] border border-white/5 rounded-2xl">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <ImageIcon size={20} className="text-purple-400" />
                <h2 className="text-lg font-semibold text-white">Job Photos (Before/After)</h2>
              </div>

              {/* Toggle button - admins/owners can toggle; regular users see it hidden */}
              {canToggleBeforeAfter ? (
                <button
                  onClick={() => setShowBeforeAfter(!showBeforeAfter)}
                  className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-colors ${
                    showBeforeAfter
                      ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                      : 'bg-white/5 text-neutral-400 border border-white/10 hover:border-white/20'
                  }`}
                >
                  {showBeforeAfter ? <EyeOff size={14} /> : <Eye size={14} />}
                  {showBeforeAfter ? 'Hide Gallery' : 'Show Before/After Gallery'}
                </button>
              ) : null}
            </div>

            {!canToggleBeforeAfter && !showBeforeAfter && (
              <p className="text-neutral-500 text-sm">
                Before/After gallery is managed by administrators. Contact your admin to enable this section.
              </p>
            )}

            {showBeforeAfter && (
              <>
                <p className="text-neutral-400 text-sm mb-6">
                  Showcase your work with before and after photos from completed jobs.
                </p>

                <div className="grid md:grid-cols-2 gap-6">
                  {/* Before Photos */}
                  <div className="p-4 bg-white/[0.02] border border-white/5 rounded-xl">
                    <h3 className="font-medium text-white mb-3">Before Photos</h3>
                    <FormatBadges formats={FORMAT_BADGES} className="mb-3" />

                    <div className="grid grid-cols-3 gap-2 mb-4">
                      {getImagesByType('job-before').map(img => (
                        <div key={img.id} className="relative group aspect-square">
                          <div className="absolute inset-0 rounded-lg overflow-hidden bg-neutral-800">
                            <Image src={img.url} alt="Before photo of roofing job" fill className="object-cover" />
                          </div>
                          {!img.approved && (
                            <div className="absolute top-1 left-1">
                              <Clock size={12} className="text-yellow-500" />
                            </div>
                          )}
                          <button
                            onClick={() => handleDeleteImage(img)}
                            className="absolute top-1 right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <Trash2 size={10} className="text-white" />
                          </button>
                        </div>
                      ))}

                      {/* Add button */}
                      <button
                        onClick={() => handleFileSelect('job-before')}
                        disabled={isUploading}
                        className="aspect-square rounded-lg border-2 border-dashed border-white/10 hover:border-white/30 flex items-center justify-center transition-colors"
                      >
                        {isUploading && uploadType === 'job-before' ? (
                          <Loader2 size={20} className="text-neutral-500 animate-spin" />
                        ) : (
                          <Plus size={20} className="text-neutral-500" />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* After Photos */}
                  <div className="p-4 bg-white/[0.02] border border-white/5 rounded-xl">
                    <h3 className="font-medium text-white mb-3">After Photos</h3>
                    <FormatBadges formats={FORMAT_BADGES} className="mb-3" />

                    <div className="grid grid-cols-3 gap-2 mb-4">
                      {getImagesByType('job-after').map(img => (
                        <div key={img.id} className="relative group aspect-square">
                          <div className="absolute inset-0 rounded-lg overflow-hidden bg-neutral-800">
                            <Image src={img.url} alt="After photo of completed roofing job" fill className="object-cover" />
                          </div>
                          {!img.approved && (
                            <div className="absolute top-1 left-1">
                              <Clock size={12} className="text-yellow-500" />
                            </div>
                          )}
                          <button
                            onClick={() => handleDeleteImage(img)}
                            className="absolute top-1 right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <Trash2 size={10} className="text-white" />
                          </button>
                        </div>
                      ))}

                      {/* Add button */}
                      <button
                        onClick={() => handleFileSelect('job-after')}
                        disabled={isUploading}
                        className="aspect-square rounded-lg border-2 border-dashed border-white/10 hover:border-white/30 flex items-center justify-center transition-colors"
                      >
                        {isUploading && uploadType === 'job-after' ? (
                          <Loader2 size={20} className="text-neutral-500 animate-spin" />
                        ) : (
                          <Plus size={20} className="text-neutral-500" />
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* ===== Video Section ===== */}
        <div className="mt-8 p-6 bg-white/[0.02] border border-white/5 rounded-2xl">
          <div className="flex items-center gap-3 mb-4">
            <Upload size={20} className="text-red-400" />
            <h2 className="text-lg font-semibold text-white">Videos</h2>
            <span className="text-xs text-neutral-500 ml-auto">Max 50MB</span>
          </div>

          <p className="text-neutral-400 text-sm mb-3">
            Upload job videos, testimonials, or walkthroughs.
          </p>

          <FormatBadges formats={VIDEO_FORMAT_BADGES} className="mb-4" />

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
            {getImagesByType('video' as ImageType).map(vid => (
              <div key={vid.id} className="relative group aspect-video">
                <div className="absolute inset-0 rounded-lg overflow-hidden bg-neutral-800">
                  <video src={vid.url} className="w-full h-full object-cover" preload="metadata" />
                </div>
                {!vid.approved && (
                  <div className="absolute top-1 left-1">
                    <Clock size={12} className="text-yellow-500" />
                  </div>
                )}
                <button
                  onClick={() => handleDeleteImage(vid)}
                  className="absolute top-1 right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <Trash2 size={10} className="text-white" />
                </button>
              </div>
            ))}
          </div>

          <DropZone
            label="Upload Video"
            maxSize="50MB"
            onFileDrop={(file) => handleDropFile(file, 'video')}
            onClickUpload={() => handleFileSelect('video')}
            isUploading={isUploading}
            isActive={ALLOWED_VIDEO_TYPES.includes(pendingFile?.type || '')}
            icon={<Upload size={24} className="text-neutral-500" />}
          />
        </div>

        {/* ===== Info Note ===== */}
        <div className="mt-8 p-4 bg-brand-green/10 border border-blue-500/20 rounded-xl">
          <div className="flex items-start gap-3">
            <AlertCircle size={20} className="text-blue-400 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-medium text-blue-300">Image Guidelines</h3>
              <ul className="text-sm text-blue-200/70 mt-2 space-y-1">
                <li>- Image formats: JPEG, PNG, WebP, HEIC (iPhone), GIF, TIFF, BMP (max 10MB)</li>
                <li>- Video formats: MP4, WebM, MOV, AVI (max 50MB)</li>
                <li>- Profile photos: Square images work best (e.g., 400x400) -- displayed as circular crop</li>
                <li>- Truck/vehicle photos: Landscape orientation recommended</li>
                <li>- All uploads require admin approval before going live</li>
                <li>- Drag and drop files onto any upload zone, or click to browse</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Role info */}
        <div className="mt-4 text-center">
          <p className="text-xs text-neutral-600">
            Showing sections for your role: <span className="text-neutral-400 capitalize">{userRole.replace('_', ' ')}</span>
          </p>
        </div>
      </div>
    </div>
  );
}
