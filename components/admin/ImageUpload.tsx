'use client';

/**
 * ImageUpload Component
 * Drag-and-drop image upload with preview and validation
 */

import React, { useState, useRef, ChangeEvent, DragEvent } from 'react';
import Image from 'next/image';
import { Upload, X, Check, AlertCircle, Image as ImageIcon, Loader2 } from 'lucide-react';

interface UploadedImageData {
  filename: string;
  originalName: string;
  url: string;
  sizes: Record<string, { path: string; width: number; height: number; size: number }>;
  metadata: {
    width?: number;
    height?: number;
    format?: string;
    size: string;
    sizeBytes: number;
  };
}

interface ImageUploadProps {
  onUploadComplete?: (data: UploadedImageData) => void;
  onUploadError?: (error: string) => void;
  acceptedFormats?: string[];
  maxSizeMB?: number;
  className?: string;
}

export default function ImageUpload({
  onUploadComplete,
  onUploadError,
  acceptedFormats = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'],
  maxSizeMB = 10,
  className = '',
}: ImageUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadedData, setUploadedData] = useState<UploadedImageData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Validate file
  const validateFile = (file: File): string | null => {
    // Check file type
    if (!acceptedFormats.includes(file.type)) {
      return `Invalid file type. Accepted formats: ${acceptedFormats.join(', ')}`;
    }

    // Check file size
    const fileSizeMB = file.size / (1024 * 1024);
    if (fileSizeMB > maxSizeMB) {
      return `File too large. Maximum size: ${maxSizeMB}MB`;
    }

    return null;
  };

  // Handle file selection
  const handleFileSelect = (file: File) => {
    setError(null);
    setUploadedData(null);

    // Validate file
    const validationError = validateFile(file);
    if (validationError) {
      setError(validationError);
      if (onUploadError) {
        onUploadError(validationError);
      }
      return;
    }

    setSelectedFile(file);

    // Create preview URL
    const objectUrl = URL.createObjectURL(file);
    setPreviewUrl(objectUrl);
  };

  // Handle file input change
  const handleFileInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  // Handle drag events
  const handleDragEnter = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const file = e.dataTransfer.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  // Handle upload
  const handleUpload = async () => {
    if (!selectedFile) return;

    setIsUploading(true);
    setUploadProgress(0);
    setError(null);

    try {
      // Create form data
      const formData = new FormData();
      formData.append('file', selectedFile);

      // Upload file
      const response = await fetch('/api/admin/upload', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Upload failed');
      }

      // Success
      setUploadProgress(100);
      setUploadedData(data.data);

      if (onUploadComplete) {
        onUploadComplete(data.data);
      }

      // Clean up preview
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Upload failed';
      setError(errorMessage);

      if (onUploadError) {
        onUploadError(errorMessage);
      }
    } finally {
      setIsUploading(false);
    }
  };

  // Handle cancel
  const handleCancel = () => {
    setSelectedFile(null);
    setPreviewUrl(null);
    setUploadedData(null);
    setError(null);
    setUploadProgress(0);

    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Handle click to select file
  const handleClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className={`w-full ${className}`}>
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept={acceptedFormats.join(',')}
        onChange={handleFileInputChange}
        className="hidden"
      />

      {/* Upload area */}
      {!selectedFile && !uploadedData && (
        <div
          onClick={handleClick}
          onDragEnter={handleDragEnter}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`
            relative border-2 border-dashed rounded-lg p-12 text-center cursor-pointer
            transition-all duration-200
            ${
              isDragging
                ? 'border-[#00FF00] bg-[#00FF00]/5 scale-[1.02]'
                : 'border-gray-300 hover:border-[#00FF00] hover:bg-gray-50'
            }
          `}
        >
          <div className="flex flex-col items-center space-y-4">
            <div
              className={`
              p-4 rounded-full transition-colors
              ${isDragging ? 'bg-[#00FF00]/10' : 'bg-gray-100'}
            `}
            >
              <Upload
                className={`w-12 h-12 ${isDragging ? 'text-[#00FF00]' : 'text-gray-400'}`}
              />
            </div>

            <div>
              <p className="text-lg font-semibold text-gray-700">
                {isDragging ? 'Drop image here' : 'Drag & drop an image here'}
              </p>
              <p className="text-sm text-gray-500 mt-1">or click to browse</p>
            </div>

            <div className="text-xs text-gray-400">
              <p>Accepted formats: JPEG, PNG, WebP, GIF</p>
              <p>Maximum size: {maxSizeMB}MB</p>
            </div>
          </div>
        </div>
      )}

      {/* Preview and upload */}
      {selectedFile && !uploadedData && (
        <div className="space-y-4">
          {/* Preview */}
          <div className="relative rounded-lg overflow-hidden bg-gray-100">
            {previewUrl && (
              <Image
                src={previewUrl}
                alt="Preview"
                width={800}
                height={600}
                className="w-full h-auto object-contain max-h-96"
              />
            )}

            {/* Cancel button */}
            <button
              onClick={handleCancel}
              className="absolute top-2 right-2 p-2 bg-black/50 hover:bg-black/70 rounded-full transition-colors"
              disabled={isUploading}
            >
              <X className="w-5 h-5 text-white" />
            </button>
          </div>

          {/* File info */}
          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
            <div className="flex items-center space-x-3">
              <ImageIcon className="w-5 h-5 text-gray-400" />
              <div>
                <p className="text-sm font-medium text-gray-700">{selectedFile.name}</p>
                <p className="text-xs text-gray-500">
                  {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB
                </p>
              </div>
            </div>

            <button
              onClick={handleUpload}
              disabled={isUploading}
              className="px-6 py-2 bg-[#00FF00] hover:bg-[#00DD00] text-black font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
            >
              {isUploading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Uploading...</span>
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4" />
                  <span>Upload</span>
                </>
              )}
            </button>
          </div>

          {/* Progress bar */}
          {isUploading && (
            <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
              <div
                className="bg-[#00FF00] h-full transition-all duration-300"
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
          )}
        </div>
      )}

      {/* Success state */}
      {uploadedData && (
        <div className="space-y-4">
          <div className="flex items-center space-x-3 p-4 bg-green-50 border border-green-200 rounded-lg">
            <Check className="w-6 h-6 text-brand-blue" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-green-800">Upload successful!</p>
              <p className="text-xs text-brand-blue mt-1">
                Image saved as: {uploadedData.filename}
              </p>
            </div>
          </div>

          {/* Uploaded image preview */}
          <div className="relative rounded-lg overflow-hidden bg-gray-100">
            <Image
              src={uploadedData.url}
              alt={uploadedData.originalName}
              width={uploadedData.metadata.width || 800}
              height={uploadedData.metadata.height || 600}
              className="w-full h-auto object-contain max-h-96"
            />
          </div>

          {/* Image details */}
          <div className="p-4 bg-gray-50 rounded-lg space-y-2">
            <h3 className="text-sm font-semibold text-gray-700">Image Details</h3>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <span className="text-gray-500">Filename:</span>
                <p className="text-gray-700 font-mono">{uploadedData.filename}</p>
              </div>

              <div>
                <span className="text-gray-500">Format:</span>
                <p className="text-gray-700">{uploadedData.metadata.format?.toUpperCase()}</p>
              </div>

              <div>
                <span className="text-gray-500">Dimensions:</span>
                <p className="text-gray-700">
                  {uploadedData.metadata.width} × {uploadedData.metadata.height}
                </p>
              </div>

              <div>
                <span className="text-gray-500">Size:</span>
                <p className="text-gray-700">{uploadedData.metadata.size}</p>
              </div>
            </div>

            {/* URL to copy */}
            <div className="pt-2 border-t border-gray-200">
              <span className="text-gray-500 text-xs">Image URL:</span>
              <div className="flex items-center space-x-2 mt-1">
                <input
                  type="text"
                  value={uploadedData.url}
                  readOnly
                  className="flex-1 px-3 py-2 text-xs font-mono bg-white border border-gray-300 rounded"
                  onClick={(e) => e.currentTarget.select()}
                />
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(uploadedData.url);
                  }}
                  className="px-3 py-2 text-xs bg-gray-700 hover:bg-gray-800 text-white rounded transition-colors"
                >
                  Copy
                </button>
              </div>
            </div>
          </div>

          {/* Upload another button */}
          <button
            onClick={handleCancel}
            className="w-full px-4 py-2 bg-gray-700 hover:bg-gray-800 text-white font-semibold rounded-lg transition-colors"
          >
            Upload Another Image
          </button>
        </div>
      )}

      {/* Error state */}
      {error && (
        <div className="flex items-start space-x-3 p-4 bg-red-50 border border-red-200 rounded-lg mt-4">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-red-800">Upload failed</p>
            <p className="text-xs text-red-600 mt-1">{error}</p>
          </div>
          <button onClick={() => setError(null)} className="text-red-600 hover:text-red-800">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}
