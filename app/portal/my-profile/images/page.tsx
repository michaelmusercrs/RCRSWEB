'use client';

import { useState, useEffect, useRef } from 'react';
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
} from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { teamMembers } from '@/lib/teamData';
import { ProfileImage } from '@/lib/profile-types';

type ImageType = ProfileImage['type'];
type UploadType = Exclude<ImageType, 'video'>; // Videos auto-detected

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
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);

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

      // Find team member
      const member = teamMembers.find(m =>
        m.email.toLowerCase() === user.email.toLowerCase()
      );

      if (member) {
        setRepSlug(member.slug);
        setCurrentProfileImage(member.profileImage || null);
        setCurrentTruckImage(member.truckImage || null);

        // Load uploaded images from API
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
      setUploadType('profile'); // placeholder, actual type auto-detected server-side
      videoInputRef.current?.click();
    } else {
      setUploadType(type);
      fileInputRef.current?.click();
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !repSlug) return;

    // Validate file type
    const allowedImageTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    const allowedVideoTypes = ['video/mp4', 'video/webm', 'video/quicktime'];
    const allAllowed = [...allowedImageTypes, ...allowedVideoTypes];
    const isVideo = allowedVideoTypes.includes(file.type);

    if (!allAllowed.includes(file.type)) {
      setMessage({ type: 'error', text: 'Invalid file type. Allowed: JPEG, PNG, WebP, MP4, WebM, MOV.' });
      return;
    }

    // Validate file size (10MB images, 50MB videos)
    const maxSize = isVideo ? 50 * 1024 * 1024 : 10 * 1024 * 1024;
    if (file.size > maxSize) {
      setMessage({ type: 'error', text: `File too large. Maximum: ${isVideo ? '50MB' : '10MB'}.` });
      return;
    }

    setIsUploading(true);
    setMessage(null);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('repSlug', repSlug);
      formData.append('type', isVideo ? 'video' : uploadType);
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
      if (fileInputRef.current) fileInputRef.current.value = '';
      if (videoInputRef.current) videoInputRef.current.value = '';
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
    } catch (error) {
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
            We couldn't find your team profile. Please contact an administrator.
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
        accept="image/jpeg,image/jpg,image/png,image/webp"
        className="hidden"
      />
      <input
        type="file"
        ref={videoInputRef}
        onChange={handleFileChange}
        accept="video/mp4,video/webm,video/quicktime"
        className="hidden"
      />

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
              Upload and manage your profile photos, truck image, and job photos
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

        {/* Profile Photo Section */}
        <div className="mb-8 p-6 bg-white/[0.02] border border-white/5 rounded-2xl">
          <div className="flex items-center gap-3 mb-4">
            <Camera size={20} className="text-brand-green" />
            <h2 className="text-lg font-semibold text-white">Profile Photo</h2>
          </div>

          <div className="flex items-start gap-6">
            {/* Current Profile Image */}
            <div className="relative w-32 h-32 rounded-xl overflow-hidden bg-neutral-800 flex-shrink-0">
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

            <div className="flex-1">
              <p className="text-neutral-400 text-sm mb-4">
                Your profile photo appears on your public team page. Square images work best.
              </p>

              <button
                onClick={() => handleFileSelect('profile')}
                disabled={isUploading}
                className="inline-flex items-center gap-2 px-4 py-2 bg-brand-green hover:bg-green-400 text-black font-medium rounded-xl transition-colors disabled:opacity-50"
              >
                {isUploading && uploadType === 'profile' ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    Uploading...
                  </>
                ) : (
                  <>
                    <Upload size={16} />
                    Upload New Photo
                  </>
                )}
              </button>

              {/* Uploaded profile images */}
              {getImagesByType('profile').length > 0 && (
                <div className="mt-4">
                  <p className="text-xs text-neutral-500 mb-2">Uploaded photos (pending approval):</p>
                  <div className="flex flex-wrap gap-2">
                    {getImagesByType('profile').map(img => (
                      <div key={img.id} className="relative group">
                        <div className="w-16 h-16 rounded-lg overflow-hidden bg-neutral-800">
                          <Image src={img.url} alt="" fill className="object-cover" />
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

        {/* Truck Photo Section */}
        <div className="mb-8 p-6 bg-white/[0.02] border border-white/5 rounded-2xl">
          <div className="flex items-center gap-3 mb-4">
            <Truck size={20} className="text-blue-400" />
            <h2 className="text-lg font-semibold text-white">Truck Photo</h2>
          </div>

          <div className="flex items-start gap-6">
            {/* Current Truck Image */}
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

            <div className="flex-1">
              <p className="text-neutral-400 text-sm mb-4">
                Help customers know what vehicle to expect. Show your branded work truck!
              </p>

              <button
                onClick={() => handleFileSelect('truck')}
                disabled={isUploading}
                className="inline-flex items-center gap-2 px-4 py-2 bg-brand-green hover:bg-blue-400 text-white font-medium rounded-xl transition-colors disabled:opacity-50"
              >
                {isUploading && uploadType === 'truck' ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    Uploading...
                  </>
                ) : (
                  <>
                    <Upload size={16} />
                    Upload Truck Photo
                  </>
                )}
              </button>

              {/* Uploaded truck images */}
              {getImagesByType('truck').length > 0 && (
                <div className="mt-4">
                  <p className="text-xs text-neutral-500 mb-2">Uploaded photos (pending approval):</p>
                  <div className="flex flex-wrap gap-2">
                    {getImagesByType('truck').map(img => (
                      <div key={img.id} className="relative group">
                        <div className="w-20 h-14 rounded-lg overflow-hidden bg-neutral-800">
                          <Image src={img.url} alt="" fill className="object-cover" />
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

        {/* Job Photos Section */}
        <div className="p-6 bg-white/[0.02] border border-white/5 rounded-2xl">
          <div className="flex items-center gap-3 mb-4">
            <ImageIcon size={20} className="text-purple-400" />
            <h2 className="text-lg font-semibold text-white">Job Photos (Before/After)</h2>
          </div>

          <p className="text-neutral-400 text-sm mb-6">
            Showcase your work with before and after photos from completed jobs.
          </p>

          <div className="grid md:grid-cols-2 gap-6">
            {/* Before Photos */}
            <div className="p-4 bg-white/[0.02] border border-white/5 rounded-xl">
              <h3 className="font-medium text-white mb-3">Before Photos</h3>

              <div className="grid grid-cols-3 gap-2 mb-4">
                {getImagesByType('job-before').map(img => (
                  <div key={img.id} className="relative group aspect-square">
                    <div className="absolute inset-0 rounded-lg overflow-hidden bg-neutral-800">
                      <Image src={img.url} alt="" fill className="object-cover" />
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

              <div className="grid grid-cols-3 gap-2 mb-4">
                {getImagesByType('job-after').map(img => (
                  <div key={img.id} className="relative group aspect-square">
                    <div className="absolute inset-0 rounded-lg overflow-hidden bg-neutral-800">
                      <Image src={img.url} alt="" fill className="object-cover" />
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
        </div>

        {/* Video Section */}
        <div className="mt-8 p-6 bg-white/[0.02] border border-white/5 rounded-2xl">
          <div className="flex items-center gap-3 mb-4">
            <Upload size={20} className="text-red-400" />
            <h2 className="text-lg font-semibold text-white">Videos</h2>
          </div>

          <p className="text-neutral-400 text-sm mb-6">
            Upload job videos, testimonials, or walkthroughs (MP4, WebM, MOV — max 50MB).
          </p>

          <div className="grid grid-cols-3 gap-3 mb-4">
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

            <button
              onClick={() => handleFileSelect('video')}
              disabled={isUploading}
              className="aspect-video rounded-lg border-2 border-dashed border-white/10 hover:border-white/30 flex items-center justify-center transition-colors"
            >
              {isUploading ? (
                <Loader2 size={20} className="text-neutral-500 animate-spin" />
              ) : (
                <Plus size={20} className="text-neutral-500" />
              )}
            </button>
          </div>
        </div>

        {/* Info Note */}
        <div className="mt-8 p-4 bg-brand-green/10 border border-blue-500/20 rounded-xl">
          <div className="flex items-start gap-3">
            <AlertCircle size={20} className="text-blue-400 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-medium text-blue-300">Image Guidelines</h3>
              <ul className="text-sm text-blue-200/70 mt-2 space-y-1">
                <li>- Image formats: JPEG, PNG, WebP (max 10MB)</li>
                <li>- Video formats: MP4, WebM, MOV (max 50MB)</li>
                <li>- Profile photos: Square images work best (e.g., 400x400)</li>
                <li>- All uploads require admin approval before going live</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
