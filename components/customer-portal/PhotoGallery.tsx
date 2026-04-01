'use client';

import { useState, useEffect, useCallback } from 'react';
import { X, ChevronLeft, ChevronRight, Camera, Loader2, Image as ImageIcon } from 'lucide-react';

interface Photo {
  id: string;
  url: string;
  caption: string;
  category: 'before' | 'during' | 'after' | 'damage' | 'material' | 'detail' | 'crew' | 'drone';
  uploadedAt: string;
  phase?: string;
}

interface PhotoGalleryProps {
  customerId: string;
  token?: string;
  photos?: Photo[];
}

const PHASE_TABS = [
  { id: 'all', label: 'All Photos' },
  { id: 'before', label: 'Before' },
  { id: 'during', label: 'During' },
  { id: 'after', label: 'After' },
  { id: 'damage', label: 'Damage' },
];

const CATEGORY_LABELS: Record<string, string> = {
  before: 'Before',
  during: 'During',
  after: 'After',
  damage: 'Damage',
  material: 'Materials',
  detail: 'Detail',
  crew: 'Crew',
  drone: 'Drone',
};

export default function PhotoGallery({ customerId, token, photos: propPhotos }: PhotoGalleryProps) {
  const [photos, setPhotos] = useState<Photo[]>(propPhotos || []);
  const [loading, setLoading] = useState(!propPhotos);
  const [activeFilter, setActiveFilter] = useState('all');
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  useEffect(() => {
    if (!propPhotos) {
      fetchPhotos();
    }
  }, [token, propPhotos]);

  const fetchPhotos = async () => {
    if (!token) { setLoading(false); return; }
    try {
      // Fetch from the customer portal API to get documents that are photos
      const response = await fetch(`/api/customer/${token}`);
      if (response.ok) {
        const data = await response.json();
        const photoDocuments = (data.documents || [])
          .filter((d: { type?: string; fileType?: string; fileUrl?: string }) => d.type === 'photo' || d.fileType?.startsWith('image') || d.fileUrl?.match(/\.(jpg|jpeg|png|gif|webp)/i))
          .map((d: { documentId?: string; fileUrl: string; description?: string; title?: string; uploadedAt?: string }, index: number) => ({
            id: d.documentId || `photo-${index}`,
            url: d.fileUrl,
            caption: d.description || d.title || 'Project Photo',
            category: mapDocTypeToCategory(d.description || d.title || ''),
            uploadedAt: d.uploadedAt || new Date().toISOString(),
          }));
        setPhotos(photoDocuments);
      }
    } catch {
      // Silent fail
    } finally {
      setLoading(false);
    }
  };

  const filteredPhotos = activeFilter === 'all'
    ? photos
    : photos.filter(p => p.category === activeFilter);

  const openLightbox = (index: number) => {
    setLightboxIndex(index);
    setLightboxOpen(true);
  };

  const closeLightbox = () => {
    setLightboxOpen(false);
  };

  const nextPhoto = useCallback(() => {
    setLightboxIndex(prev => (prev + 1) % filteredPhotos.length);
  }, [filteredPhotos.length]);

  const prevPhoto = useCallback(() => {
    setLightboxIndex(prev => (prev - 1 + filteredPhotos.length) % filteredPhotos.length);
  }, [filteredPhotos.length]);

  // Keyboard navigation for lightbox
  useEffect(() => {
    if (!lightboxOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeLightbox();
      if (e.key === 'ArrowRight') nextPhoto();
      if (e.key === 'ArrowLeft') prevPhoto();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [lightboxOpen, nextPhoto, prevPhoto]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="animate-spin text-[#0066CC]" size={32} />
      </div>
    );
  }

  if (photos.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-sm p-8 text-center">
        <Camera className="text-neutral-300 mx-auto mb-4" size={48} />
        <h3 className="font-semibold text-neutral-800 mb-2">No Photos Yet</h3>
        <p className="text-neutral-500">
          Project photos will appear here as your roofing project progresses.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Filter Tabs */}
      <div className="bg-white rounded-xl shadow-sm p-4">
        <div className="flex gap-2 overflow-x-auto pb-1">
          {PHASE_TABS.map(tab => {
            const count = tab.id === 'all' ? photos.length : photos.filter(p => p.category === tab.id).length;
            if (tab.id !== 'all' && count === 0) return null;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveFilter(tab.id)}
                className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                  activeFilter === tab.id
                    ? 'bg-[#0066CC] text-white'
                    : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
                }`}
              >
                {tab.label}
                <span className={`ml-1.5 text-xs ${activeFilter === tab.id ? 'text-white/70' : 'text-neutral-400'}`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Photo Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {filteredPhotos.map((photo, index) => (
          <div
            key={photo.id}
            onClick={() => openLightbox(index)}
            className="relative group cursor-pointer rounded-xl overflow-hidden bg-neutral-200 aspect-square shadow-sm hover:shadow-md transition-shadow"
          >
            <img
              src={photo.url}
              alt={photo.caption}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              loading="lazy"
            />
            {/* Overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
              <div className="absolute bottom-0 left-0 right-0 p-3">
                <p className="text-white text-sm font-medium truncate">{photo.caption}</p>
                <div className="flex items-center justify-between mt-1">
                  <span className="text-white/70 text-xs">
                    {CATEGORY_LABELS[photo.category] || photo.category}
                  </span>
                  <span className="text-white/70 text-xs">
                    {new Date(photo.uploadedAt).toLocaleDateString()}
                  </span>
                </div>
              </div>
            </div>
            {/* Category Badge */}
            <span className="absolute top-2 left-2 px-2 py-0.5 bg-black/50 text-white text-xs rounded-md backdrop-blur-sm">
              {CATEGORY_LABELS[photo.category] || photo.category}
            </span>
          </div>
        ))}
      </div>

      {/* Lightbox Modal */}
      {lightboxOpen && filteredPhotos.length > 0 && (
        <div className="fixed inset-0 z-[100] bg-black/95 flex items-center justify-center">
          {/* Close Button */}
          <button
            onClick={closeLightbox}
            className="absolute top-4 right-4 p-2 text-white/70 hover:text-white rounded-full hover:bg-white/10 transition-colors z-10"
          >
            <X size={28} />
          </button>

          {/* Counter */}
          <div className="absolute top-4 left-4 text-white/70 text-sm z-10">
            {lightboxIndex + 1} / {filteredPhotos.length}
          </div>

          {/* Navigation Arrows */}
          {filteredPhotos.length > 1 && (
            <>
              <button
                onClick={prevPhoto}
                className="absolute left-4 top-1/2 -translate-y-1/2 p-3 text-white/70 hover:text-white rounded-full hover:bg-white/10 transition-colors z-10"
              >
                <ChevronLeft size={32} />
              </button>
              <button
                onClick={nextPhoto}
                className="absolute right-4 top-1/2 -translate-y-1/2 p-3 text-white/70 hover:text-white rounded-full hover:bg-white/10 transition-colors z-10"
              >
                <ChevronRight size={32} />
              </button>
            </>
          )}

          {/* Image */}
          <div className="max-w-[90vw] max-h-[80vh] flex items-center justify-center">
            <img
              src={filteredPhotos[lightboxIndex].url}
              alt={filteredPhotos[lightboxIndex].caption}
              className="max-w-full max-h-[80vh] object-contain rounded-lg"
            />
          </div>

          {/* Caption */}
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 max-w-lg text-center z-10">
            <p className="text-white font-medium">{filteredPhotos[lightboxIndex].caption}</p>
            <div className="flex items-center justify-center gap-3 mt-2 text-white/60 text-sm">
              <span>{CATEGORY_LABELS[filteredPhotos[lightboxIndex].category] || filteredPhotos[lightboxIndex].category}</span>
              <span>|</span>
              <span>{new Date(filteredPhotos[lightboxIndex].uploadedAt).toLocaleDateString()}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Helper: map document title/description keywords to photo category
function mapDocTypeToCategory(text: string): Photo['category'] {
  const lower = text.toLowerCase();
  if (lower.includes('before') || lower.includes('pre-')) return 'before';
  if (lower.includes('after') || lower.includes('complete') || lower.includes('finish')) return 'after';
  if (lower.includes('damage') || lower.includes('hail') || lower.includes('leak')) return 'damage';
  if (lower.includes('material') || lower.includes('supply')) return 'material';
  if (lower.includes('drone') || lower.includes('aerial')) return 'drone';
  if (lower.includes('crew') || lower.includes('team')) return 'crew';
  if (lower.includes('detail') || lower.includes('close')) return 'detail';
  return 'during';
}
