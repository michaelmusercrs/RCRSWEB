'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  ArrowLeft, Upload, Trash2, Copy, Check, Search, Grid,
  List, Image as ImageIcon, Folder, X, Loader2, Download, ExternalLink
} from 'lucide-react';

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
    <div className="min-h-screen bg-neutral-900">
      {/* Header */}
      <div className="bg-neutral-800 border-b border-neutral-700 p-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/portal/admin" className="text-neutral-400 hover:text-white">
              <ArrowLeft size={20} />
            </Link>
            <div>
              <h1 className="text-xl font-bold text-white">Image Gallery</h1>
              <p className="text-sm text-neutral-400">{images.length} images</p>
            </div>
          </div>
          <label className="bg-brand-green hover:bg-lime-400 text-black font-bold px-4 py-2 rounded-lg flex items-center gap-2 cursor-pointer">
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
        </div>
      </div>

      <div className="max-w-6xl mx-auto p-4">
        {/* Search & Filter */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" size={18} />
            <input
              type="text"
              placeholder="Search images..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-neutral-800 border border-neutral-700 rounded-lg pl-10 pr-4 py-3 text-white"
            />
          </div>
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="bg-neutral-800 border border-neutral-700 rounded-lg px-4 py-3 text-white"
          >
            <option value="">All Categories</option>
            {categories.map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
          <div className="flex bg-neutral-800 border border-neutral-700 rounded-lg overflow-hidden">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-3 ${viewMode === 'grid' ? 'bg-neutral-700' : ''}`}
            >
              <Grid size={18} className="text-neutral-400" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-3 ${viewMode === 'list' ? 'bg-neutral-700' : ''}`}
            >
              <List size={18} className="text-neutral-400" />
            </button>
          </div>
        </div>

        {/* Grid View */}
        {viewMode === 'grid' ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {filteredImages.map(image => (
              <div
                key={image.path}
                onClick={() => setSelectedImage(image)}
                className="group relative bg-neutral-800 border border-neutral-700 rounded-xl overflow-hidden cursor-pointer hover:border-brand-green transition-colors"
              >
                <div className="aspect-square bg-neutral-700">
                  <img
                    src={image.path}
                    alt={image.name}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <button
                    onClick={(e) => { e.stopPropagation(); copyToClipboard(image.path); }}
                    className="p-2 bg-white/20 rounded-lg mr-2 hover:bg-white/30"
                    title="Copy path"
                  >
                    {copiedPath === image.path ? (
                      <Check size={16} className="text-green-500" />
                    ) : (
                      <Copy size={16} className="text-white" />
                    )}
                  </button>
                </div>
                <div className="p-2">
                  <p className="text-xs text-neutral-400 truncate">{image.name}</p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          // List View
          <div className="space-y-2">
            {filteredImages.map(image => (
              <div
                key={image.path}
                className="bg-neutral-800 border border-neutral-700 rounded-xl p-3 flex items-center gap-4 hover:border-neutral-600"
              >
                <div className="w-16 h-16 bg-neutral-700 rounded-lg overflow-hidden flex-shrink-0">
                  <img
                    src={image.path}
                    alt={image.name}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white font-medium truncate">{image.name}</p>
                  <p className="text-sm text-neutral-500">{image.path}</p>
                </div>
                <span className="px-2 py-1 bg-neutral-700 rounded text-xs text-neutral-400">
                  {image.category}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => copyToClipboard(image.path)}
                    className="p-2 bg-neutral-700 hover:bg-neutral-600 rounded-lg"
                    title="Copy path"
                  >
                    {copiedPath === image.path ? (
                      <Check size={16} className="text-green-500" />
                    ) : (
                      <Copy size={16} className="text-neutral-400" />
                    )}
                  </button>
                  <button
                    onClick={() => setSelectedImage(image)}
                    className="p-2 bg-neutral-700 hover:bg-neutral-600 rounded-lg"
                    title="Preview"
                  >
                    <ImageIcon size={16} className="text-neutral-400" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Image Preview Modal */}
      {selectedImage && (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center p-4 z-50">
          <div className="max-w-4xl w-full">
            {/* Close button */}
            <button
              onClick={() => setSelectedImage(null)}
              className="absolute top-4 right-4 p-2 bg-neutral-800 rounded-lg hover:bg-neutral-700"
            >
              <X size={24} className="text-white" />
            </button>

            {/* Image */}
            <div className="bg-neutral-800 rounded-xl overflow-hidden">
              <img
                src={selectedImage.path}
                alt={selectedImage.name}
                className="w-full max-h-[70vh] object-contain"
              />
              <div className="p-4 border-t border-neutral-700">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-white font-semibold">{selectedImage.name}</h3>
                    <p className="text-sm text-neutral-400">{selectedImage.path}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => copyToClipboard(selectedImage.path)}
                      className="px-4 py-2 bg-neutral-700 hover:bg-neutral-600 rounded-lg flex items-center gap-2 text-white"
                    >
                      {copiedPath === selectedImage.path ? (
                        <>
                          <Check size={16} className="text-green-500" />
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
                      className="px-4 py-2 bg-neutral-700 hover:bg-neutral-600 rounded-lg flex items-center gap-2 text-white"
                    >
                      <ExternalLink size={16} />
                      Open
                    </a>
                    <button
                      onClick={() => handleDelete(selectedImage)}
                      className="px-4 py-2 bg-red-600 hover:bg-red-500 rounded-lg flex items-center gap-2 text-white"
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
    </div>
  );
}
