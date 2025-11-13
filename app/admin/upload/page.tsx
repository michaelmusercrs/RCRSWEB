'use client';

/**
 * Admin Image Upload Page
 * Upload and manage images for the website
 */

import { useState, useEffect } from 'react';
import Image from 'next/image';
import ImageUpload from '@/components/admin/ImageUpload';
import { Trash2, Copy, ExternalLink, RefreshCw, Image as ImageIcon } from 'lucide-react';

interface UploadedImage {
  filename: string;
  url: string;
  size: string;
  sizeBytes: number;
  uploadedAt: string;
  metadata: {
    width?: number;
    height?: number;
    format?: string;
  } | null;
}

export default function AdminUploadPage() {
  const [uploadedImages, setUploadedImages] = useState<UploadedImage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);

  // Fetch uploaded images
  const fetchImages = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/admin/upload');
      const data = await response.json();

      if (data.success) {
        setUploadedImages(data.images);
      }
    } catch (error) {
      console.error('Failed to fetch images:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Load images on mount
  useEffect(() => {
    fetchImages();
  }, []);

  // Handle upload complete
  const handleUploadComplete = () => {
    // Refresh the image list
    fetchImages();
  };

  // Handle copy URL
  const handleCopyUrl = (url: string) => {
    navigator.clipboard.writeText(url);
    setCopiedUrl(url);

    // Reset after 2 seconds
    setTimeout(() => {
      setCopiedUrl(null);
    }, 2000);
  };

  // Handle delete image
  const handleDeleteImage = async (filename: string) => {
    if (!confirm(`Are you sure you want to delete "${filename}"?`)) {
      return;
    }

    setIsDeleting(filename);

    try {
      const response = await fetch(`/api/admin/upload?filename=${encodeURIComponent(filename)}`, {
        method: 'DELETE',
      });

      const data = await response.json();

      if (data.success) {
        // Refresh the image list
        fetchImages();
      } else {
        alert(`Failed to delete image: ${data.message}`);
      }
    } catch (error) {
      console.error('Failed to delete image:', error);
      alert('Failed to delete image');
    } finally {
      setIsDeleting(null);
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Upload Images</h1>
        <p className="text-gray-600 mt-2">
          Upload and manage images for blog posts, team members, and projects
        </p>
      </div>

      {/* Upload Section */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Upload New Image</h2>
        <ImageUpload
          onUploadComplete={handleUploadComplete}
          onUploadError={(error) => {
            console.error('Upload error:', error);
          }}
        />
      </div>

      {/* Uploaded Images Gallery */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-gray-900">Uploaded Images</h2>
          <button
            onClick={fetchImages}
            disabled={isLoading}
            className="flex items-center space-x-2 px-4 py-2 text-sm text-gray-600 hover:text-gray-900 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>

        {/* Loading state */}
        {isLoading && (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <RefreshCw className="w-8 h-8 text-gray-400 animate-spin mx-auto mb-2" />
              <p className="text-gray-600">Loading images...</p>
            </div>
          </div>
        )}

        {/* Empty state */}
        {!isLoading && uploadedImages.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <ImageIcon className="w-16 h-16 text-gray-300 mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No images uploaded yet</h3>
            <p className="text-gray-600">Upload your first image using the form above</p>
          </div>
        )}

        {/* Images grid */}
        {!isLoading && uploadedImages.length > 0 && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              Total: <strong>{uploadedImages.length}</strong> image{uploadedImages.length !== 1 ? 's' : ''}
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {uploadedImages.map((image) => (
                <div
                  key={image.filename}
                  className="bg-white border border-gray-200 rounded-lg overflow-hidden hover:shadow-md transition-shadow"
                >
                  {/* Image preview */}
                  <div className="relative aspect-video bg-gray-100">
                    <Image
                      src={image.url}
                      alt={image.filename}
                      fill
                      className="object-cover"
                    />
                  </div>

                  {/* Image info */}
                  <div className="p-4 space-y-3">
                    {/* Filename */}
                    <div>
                      <p className="text-sm font-medium text-gray-900 truncate" title={image.filename}>
                        {image.filename}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        {image.metadata?.width} × {image.metadata?.height} • {image.size}
                      </p>
                    </div>

                    {/* URL */}
                    <div>
                      <div className="flex items-center space-x-2">
                        <input
                          type="text"
                          value={image.url}
                          readOnly
                          className="flex-1 px-2 py-1 text-xs font-mono bg-gray-50 border border-gray-300 rounded truncate"
                          onClick={(e) => e.currentTarget.select()}
                        />
                        <button
                          onClick={() => handleCopyUrl(image.url)}
                          className="p-1 text-gray-600 hover:text-gray-900 transition-colors"
                          title="Copy URL"
                        >
                          {copiedUrl === image.url ? (
                            <span className="text-green-600 text-xs">✓</span>
                          ) : (
                            <Copy className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center space-x-2 pt-2 border-t border-gray-200">
                      <a
                        href={image.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-1 flex items-center justify-center space-x-1 px-3 py-2 text-xs font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded transition-colors"
                      >
                        <ExternalLink className="w-3 h-3" />
                        <span>View</span>
                      </a>
                      <button
                        onClick={() => handleDeleteImage(image.filename)}
                        disabled={isDeleting === image.filename}
                        className="flex-1 flex items-center justify-center space-x-1 px-3 py-2 text-xs font-medium text-red-700 bg-red-50 hover:bg-red-100 rounded transition-colors disabled:opacity-50"
                      >
                        <Trash2 className="w-3 h-3" />
                        <span>{isDeleting === image.filename ? 'Deleting...' : 'Delete'}</span>
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Usage Instructions */}
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">How to Use Images</h3>
        <div className="space-y-3 text-sm text-gray-700">
          <div>
            <strong>1. Upload an image</strong>
            <p className="text-gray-600 mt-1">
              Use the upload form above to add images. Accepted formats: JPEG, PNG, WebP, GIF (max 10MB)
            </p>
          </div>
          <div>
            <strong>2. Copy the image URL</strong>
            <p className="text-gray-600 mt-1">
              Click the copy button next to the URL to copy it to your clipboard
            </p>
          </div>
          <div>
            <strong>3. Use in your content</strong>
            <p className="text-gray-600 mt-1">
              Paste the URL in blog posts, team member profiles, or anywhere you need images
            </p>
          </div>
          <div>
            <strong>4. Multiple sizes generated</strong>
            <p className="text-gray-600 mt-1">
              Each upload creates multiple optimized sizes (thumbnail, small, medium, large) for better performance
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
