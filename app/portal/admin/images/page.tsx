'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  Upload, Trash2, Copy, Check, Search, Grid,
  List, Image as ImageIcon, X, Loader2, ExternalLink, FolderOpen
} from 'lucide-react';
import AdminLayout from '@/components/AdminLayout';

interface ImageFile {
  name: string;
  path: string;
  size?: number;
  category?: string;
}

// Sample images from the uploads folder
const sampleImages: ImageFile[] = [
  // Team Photos
  { name: 'chris-muse.png', path: '/uploads/chris-muse.png', category: 'Team' },
  { name: 'michael-muse.png', path: '/uploads/michael-muse.png', category: 'Team' },
  { name: 'hunter.png', path: '/uploads/hunter.png', category: 'Team' },
  { name: 'aaron.jpg', path: '/uploads/aaron.jpg', category: 'Team' },
  { name: 'sara-hill.png', path: '/uploads/sara-hill.png', category: 'Team' },
  { name: 'tia.png', path: '/uploads/tia.png', category: 'Team' },
  { name: 'boston.jpeg', path: '/uploads/boston.jpeg', category: 'Team' },
  { name: 'destin.png', path: '/uploads/destin.png', category: 'Team' },
  { name: 'john.png', path: '/uploads/john.png', category: 'Team' },
  { name: 'brendon.jpg', path: '/uploads/brendon.jpg', category: 'Team' },
  { name: 'bart.png', path: '/uploads/bart.png', category: 'Team' },
  { name: 'tae.jpg', path: '/uploads/tae.jpg', category: 'Team' },
  { name: 'greg.png', path: '/uploads/greg.png', category: 'Team' },
  { name: 'travis.png', path: '/uploads/travis.png', category: 'Team' },
  { name: 'donnie-dotson.jpg', path: '/uploads/donnie-dotson.jpg', category: 'Team' },
  { name: 'danny-ray-muse.png', path: '/uploads/danny-ray-muse.png', category: 'Team' },

  // Services
  { name: 'service-residential.png', path: '/uploads/service-residential.png', category: 'Services' },
  { name: 'service-commercial.png', path: '/uploads/service-commercial.png', category: 'Services' },
  { name: 'service-storm.jpg', path: '/uploads/service-storm.jpg', category: 'Services' },
  { name: 'service-chimney.png', path: '/uploads/service-chimney.png', category: 'Services' },
  { name: 'service-leafx.png', path: '/uploads/service-leafx.png', category: 'Services' },

  // Certifications
  { name: 'cert-iko.png', path: '/uploads/cert-iko.png', category: 'Certifications' },
  { name: 'cert-owens-corning.png', path: '/uploads/cert-owens-corning.png', category: 'Certifications' },
  { name: 'cert-bbb.jpg', path: '/uploads/cert-bbb.jpg', category: 'Certifications' },
  { name: 'cert-google.png', path: '/uploads/cert-google.png', category: 'Certifications' },
  { name: 'cert-procat.png', path: '/uploads/cert-procat.png', category: 'Certifications' },
  { name: 'cert-iko-codeplus.png', path: '/uploads/cert-iko-codeplus.png', category: 'Certifications' },

  // Areas
  { name: 'area-huntsville-rocket.jpg', path: '/uploads/area-huntsville-rocket.jpg', category: 'Areas' },
  { name: 'area-decatur.png', path: '/uploads/area-decatur.png', category: 'Areas' },
  { name: 'area-madison.jpg', path: '/uploads/area-madison.jpg', category: 'Areas' },
  { name: 'area-athens.jpg', path: '/uploads/area-athens.jpg', category: 'Areas' },
  { name: 'area-birmingham.jpg', path: '/uploads/area-birmingham.jpg', category: 'Areas' },
  { name: 'area-nashville.webp', path: '/uploads/area-nashville.webp', category: 'Areas' },
  { name: 'area-north-alabama.png', path: '/uploads/area-north-alabama.png', category: 'Areas' },

  // Blog Images
  { name: 'blog-choosing-the-right-roofing-material.png', path: '/uploads/blog-choosing-the-right-roofing-material.png', category: 'Blog' },
  { name: 'blog-signs-you-need-a-new-roof.png', path: '/uploads/blog-signs-you-need-a-new-roof.png', category: 'Blog' },
  { name: 'blog-summer-heat-roof-damage.png', path: '/uploads/blog-summer-heat-roof-damage.png', category: 'Blog' },
  { name: 'blog-benefits-of-local-roofing-contractor.png', path: '/uploads/blog-benefits-of-local-roofing-contractor.png', category: 'Blog' },
  { name: 'blog-commercial-roof-maintenance-cullman.png', path: '/uploads/blog-commercial-roof-maintenance-cullman.png', category: 'Blog' },
  { name: 'blog-roof-leaks-and-your-attic.jpg', path: '/uploads/blog-roof-leaks-and-your-attic.jpg', category: 'Blog' },
];

const categoryColors: Record<string, { bg: string; text: string; border: string }> = {
  'Team': { bg: 'bg-emerald-500/20', text: 'text-emerald-400', border: 'border-emerald-500/30' },
  'Services': { bg: 'bg-blue-500/20', text: 'text-blue-400', border: 'border-blue-500/30' },
  'Certifications': { bg: 'bg-amber-500/20', text: 'text-amber-400', border: 'border-amber-500/30' },
  'Areas': { bg: 'bg-purple-500/20', text: 'text-purple-400', border: 'border-purple-500/30' },
  'Blog': { bg: 'bg-cyan-500/20', text: 'text-cyan-400', border: 'border-cyan-500/30' },
  'Uploads': { bg: 'bg-rose-500/20', text: 'text-rose-400', border: 'border-rose-500/30' },
};

export default function ImageGallery() {
  const [images, setImages] = useState<ImageFile[]>(sampleImages);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [selectedImage, setSelectedImage] = useState<ImageFile | null>(null);
  const [copiedPath, setCopiedPath] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const categories = [...new Set(images.map(i => i.category).filter(Boolean))];

  const filteredImages = images.filter(image => {
    const matchesSearch = image.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = !selectedCategory || image.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const copyToClipboard = (path: string) => {
    navigator.clipboard.writeText(path);
    setCopiedPath(path);
    setTimeout(() => setCopiedPath(null), 2000);
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    setIsUploading(true);

    // Simulate upload - in production this would upload to your server/CDN
    await new Promise(resolve => setTimeout(resolve, 1000));

    const newImages: ImageFile[] = Array.from(files).map(file => ({
      name: file.name,
      path: `/uploads/${file.name}`,
      size: file.size,
      category: 'Uploads',
    }));

    setImages([...newImages, ...images]);
    setIsUploading(false);
  };

  const handleDelete = (image: ImageFile) => {
    if (confirm(`Delete ${image.name}?`)) {
      setImages(images.filter(i => i.path !== image.path));
      setSelectedImage(null);
    }
  };

  return (
    <AdminLayout
      title="Image Gallery"
      subtitle={`${images.length} images`}
      actions={
        <label className="bg-gradient-to-r from-violet-500 to-purple-500 hover:from-violet-600 hover:to-purple-600 text-white font-semibold px-4 py-2 rounded-xl flex items-center gap-2 cursor-pointer transition-all shadow-lg shadow-violet-500/25">
          {isUploading ? <Loader2 className="animate-spin" size={18} /> : <Upload size={18} />}
          {isUploading ? 'Uploading...' : 'Upload'}
          <input
            type="file"
            multiple
            accept="image/*"
            onChange={handleUpload}
            className="hidden"
            disabled={isUploading}
          />
        </label>
      }
    >
      {/* Search & Filter */}
      <div className="flex flex-col sm:flex-row gap-3 mb-8">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-500" size={18} />
          <input
            type="text"
            placeholder="Search images..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-xl pl-12 pr-4 py-3 text-white placeholder:text-neutral-500 focus:outline-none focus:border-brand-green/50 focus:ring-1 focus:ring-brand-green/50 transition-all"
          />
        </div>
        <select
          value={selectedCategory}
          onChange={(e) => setSelectedCategory(e.target.value)}
          className="bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-brand-green/50 transition-all"
        >
          <option value="">All Categories</option>
          {categories.map(cat => (
            <option key={cat} value={cat}>{cat}</option>
          ))}
        </select>
        <div className="flex bg-white/5 border border-white/10 rounded-xl overflow-hidden">
          <button
            onClick={() => setViewMode('grid')}
            className={`p-3 transition-colors ${viewMode === 'grid' ? 'bg-white/10 text-white' : 'text-neutral-400 hover:text-white'}`}
          >
            <Grid size={18} />
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={`p-3 transition-colors ${viewMode === 'list' ? 'bg-white/10 text-white' : 'text-neutral-400 hover:text-white'}`}
          >
            <List size={18} />
          </button>
        </div>
      </div>

      {/* Category Pills */}
      <div className="flex flex-wrap gap-2 mb-6">
        <button
          onClick={() => setSelectedCategory('')}
          className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
            !selectedCategory
              ? 'bg-brand-green/20 text-brand-green border border-brand-green/30'
              : 'bg-white/5 text-neutral-400 border border-white/10 hover:bg-white/10'
          }`}
        >
          All ({images.length})
        </button>
        {categories.map(cat => {
          const count = images.filter(i => i.category === cat).length;
          const colors = categoryColors[cat || ''] || categoryColors['Uploads'];
          return (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat || '')}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-all border ${
                selectedCategory === cat
                  ? `${colors.bg} ${colors.text} ${colors.border}`
                  : 'bg-white/5 text-neutral-400 border-white/10 hover:bg-white/10'
              }`}
            >
              {cat} ({count})
            </button>
          );
        })}
      </div>

      {/* Grid View */}
      {viewMode === 'grid' ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {filteredImages.map(image => {
            const colors = categoryColors[image.category || ''] || categoryColors['Uploads'];
            return (
              <div
                key={image.path}
                onClick={() => setSelectedImage(image)}
                className="group relative bg-white/[0.02] border border-white/5 rounded-2xl overflow-hidden cursor-pointer hover:border-white/20 hover:bg-white/[0.04] transition-all duration-300"
              >
                <div className="aspect-square bg-gradient-to-br from-neutral-800 to-neutral-900">
                  <img
                    src={image.path}
                    alt={image.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                </div>
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-3">
                  <div className="flex items-center justify-between">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${colors.bg} ${colors.text}`}>
                      {image.category}
                    </span>
                    <button
                      onClick={(e) => { e.stopPropagation(); copyToClipboard(image.path); }}
                      className="w-8 h-8 bg-white/20 hover:bg-white/30 rounded-lg flex items-center justify-center transition-colors"
                      title="Copy path"
                    >
                      {copiedPath === image.path ? (
                        <Check size={14} className="text-green-400" />
                      ) : (
                        <Copy size={14} className="text-white" />
                      )}
                    </button>
                  </div>
                </div>
                <div className="p-3 border-t border-white/5">
                  <p className="text-xs text-neutral-400 truncate">{image.name}</p>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        // List View
        <div className="space-y-2">
          {filteredImages.map(image => {
            const colors = categoryColors[image.category || ''] || categoryColors['Uploads'];
            return (
              <div
                key={image.path}
                className="bg-white/[0.02] border border-white/5 rounded-xl p-3 flex items-center gap-4 hover:bg-white/[0.04] hover:border-white/10 transition-all"
              >
                <div className="w-16 h-16 bg-gradient-to-br from-neutral-800 to-neutral-900 rounded-xl overflow-hidden flex-shrink-0 border border-white/10">
                  <img
                    src={image.path}
                    alt={image.name}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white font-medium truncate">{image.name}</p>
                  <p className="text-sm text-neutral-500 truncate">{image.path}</p>
                </div>
                <span className={`px-3 py-1 rounded-full text-xs font-medium ${colors.bg} ${colors.text} border ${colors.border}`}>
                  {image.category}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => copyToClipboard(image.path)}
                    className="p-2.5 bg-white/5 hover:bg-white/10 rounded-xl transition-colors"
                    title="Copy path"
                  >
                    {copiedPath === image.path ? (
                      <Check size={16} className="text-green-400" />
                    ) : (
                      <Copy size={16} className="text-neutral-400" />
                    )}
                  </button>
                  <button
                    onClick={() => setSelectedImage(image)}
                    className="p-2.5 bg-white/5 hover:bg-white/10 rounded-xl transition-colors"
                    title="Preview"
                  >
                    <ImageIcon size={16} className="text-neutral-400" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Empty State */}
      {filteredImages.length === 0 && (
        <div className="text-center py-16">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-white/5 mb-4">
            <FolderOpen className="text-neutral-500" size={32} />
          </div>
          <p className="text-neutral-400 mb-2">No images found</p>
          <p className="text-neutral-500 text-sm">
            Try adjusting your search or filter
          </p>
        </div>
      )}

      {/* Image Preview Modal */}
      {selectedImage && (
        <div
          className="fixed inset-0 bg-black/90 backdrop-blur-sm flex items-center justify-center p-4 z-50"
          onClick={() => setSelectedImage(null)}
        >
          <div className="max-w-4xl w-full" onClick={e => e.stopPropagation()}>
            {/* Close button */}
            <button
              onClick={() => setSelectedImage(null)}
              className="absolute top-6 right-6 w-10 h-10 bg-white/10 hover:bg-white/20 rounded-xl flex items-center justify-center transition-colors"
            >
              <X size={20} className="text-white" />
            </button>

            {/* Image */}
            <div className="bg-white/[0.02] border border-white/10 rounded-2xl overflow-hidden">
              <div className="bg-gradient-to-br from-neutral-800 to-neutral-900">
                <img
                  src={selectedImage.path}
                  alt={selectedImage.name}
                  className="w-full max-h-[70vh] object-contain"
                />
              </div>
              <div className="p-6 border-t border-white/5">
                <div className="flex items-center justify-between flex-wrap gap-4">
                  <div className="min-w-0">
                    <h3 className="text-white font-semibold text-lg mb-1">{selectedImage.name}</h3>
                    <p className="text-sm text-neutral-400 truncate">{selectedImage.path}</p>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      onClick={() => copyToClipboard(selectedImage.path)}
                      className="px-4 py-2.5 bg-white/5 hover:bg-white/10 rounded-xl flex items-center gap-2 text-white text-sm font-medium transition-colors"
                    >
                      {copiedPath === selectedImage.path ? (
                        <>
                          <Check size={16} className="text-green-400" />
                          Copied!
                        </>
                      ) : (
                        <>
                          <Copy size={16} />
                          Copy Path
                        </>
                      )}
                    </button>
                    <a
                      href={selectedImage.path}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-4 py-2.5 bg-white/5 hover:bg-white/10 rounded-xl flex items-center gap-2 text-white text-sm font-medium transition-colors"
                    >
                      <ExternalLink size={16} />
                      Open
                    </a>
                    <button
                      onClick={() => handleDelete(selectedImage)}
                      className="px-4 py-2.5 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-xl flex items-center gap-2 text-sm font-medium transition-colors"
                    >
                      <Trash2 size={16} />
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
