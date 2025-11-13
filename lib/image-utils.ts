/**
 * Image Upload Utilities
 * Helper functions for image validation, optimization, and management
 */

import sharp from 'sharp';
import { promises as fs } from 'fs';
import path from 'path';

// Supported image formats
export const ALLOWED_IMAGE_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/gif',
];

export const ALLOWED_IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp', '.gif'];

// File size limits (in bytes)
export const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
export const MAX_FILE_SIZE_MB = 10;

// Image optimization settings
export const IMAGE_SIZES = {
  thumbnail: { width: 300, height: 300 },
  small: { width: 640, height: 480 },
  medium: { width: 1280, height: 960 },
  large: { width: 1920, height: 1440 },
  original: null, // Keep original size
};

export type ImageSize = keyof typeof IMAGE_SIZES;

/**
 * Validates if a file type is an allowed image format
 */
export function isValidImageType(mimetype: string): boolean {
  return ALLOWED_IMAGE_TYPES.includes(mimetype);
}

/**
 * Validates if a file extension is allowed
 */
export function isValidImageExtension(filename: string): boolean {
  const ext = path.extname(filename).toLowerCase();
  return ALLOWED_IMAGE_EXTENSIONS.includes(ext);
}

/**
 * Validates file size
 */
export function isValidFileSize(size: number): boolean {
  return size <= MAX_FILE_SIZE;
}

/**
 * Sanitizes filename to prevent path traversal and special characters
 */
export function sanitizeFilename(filename: string): string {
  // Remove path components
  const basename = path.basename(filename);

  // Remove special characters, keep alphanumeric, hyphens, underscores, and dots
  const sanitized = basename
    .replace(/[^a-zA-Z0-9.-]/g, '-')
    .replace(/\.+/g, '.') // Replace multiple dots with single dot
    .replace(/-+/g, '-') // Replace multiple hyphens with single hyphen
    .toLowerCase();

  return sanitized;
}

/**
 * Generates a unique filename with timestamp
 */
export function generateUniqueFilename(originalFilename: string): string {
  const sanitized = sanitizeFilename(originalFilename);
  const ext = path.extname(sanitized);
  const nameWithoutExt = path.basename(sanitized, ext);
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);

  return `${nameWithoutExt}-${timestamp}-${random}${ext}`;
}

/**
 * Gets the upload directory path
 */
export function getUploadDir(): string {
  return path.join(process.cwd(), 'public', 'uploads');
}

/**
 * Ensures upload directory exists
 */
export async function ensureUploadDir(): Promise<void> {
  const uploadDir = getUploadDir();
  try {
    await fs.access(uploadDir);
  } catch {
    await fs.mkdir(uploadDir, { recursive: true });
  }
}

/**
 * Optimizes and resizes an image using sharp
 */
export async function optimizeImage(
  inputPath: string,
  outputPath: string,
  size: ImageSize = 'medium'
): Promise<{ width: number; height: number; size: number }> {
  const sizeConfig = IMAGE_SIZES[size];

  let sharpInstance = sharp(inputPath);

  // Resize if size is specified
  if (sizeConfig) {
    sharpInstance = sharpInstance.resize(sizeConfig.width, sizeConfig.height, {
      fit: 'inside',
      withoutEnlargement: true,
    });
  }

  // Get image format from input
  const metadata = await sharpInstance.metadata();
  const format = metadata.format;

  // Optimize based on format
  if (format === 'jpeg' || format === 'jpg') {
    sharpInstance = sharpInstance.jpeg({ quality: 85, progressive: true });
  } else if (format === 'png') {
    sharpInstance = sharpInstance.png({ quality: 85, compressionLevel: 9 });
  } else if (format === 'webp') {
    sharpInstance = sharpInstance.webp({ quality: 85 });
  }

  // Save optimized image
  const info = await sharpInstance.toFile(outputPath);

  return {
    width: info.width,
    height: info.height,
    size: info.size,
  };
}

/**
 * Converts image to WebP format for better compression
 */
export async function convertToWebP(
  inputPath: string,
  outputPath: string,
  quality: number = 85
): Promise<{ width: number; height: number; size: number }> {
  const info = await sharp(inputPath)
    .webp({ quality })
    .toFile(outputPath);

  return {
    width: info.width,
    height: info.height,
    size: info.size,
  };
}

/**
 * Generates multiple sizes of an image
 */
export async function generateImageSizes(
  inputPath: string,
  baseFilename: string
): Promise<Record<ImageSize, { path: string; width: number; height: number; size: number }>> {
  const uploadDir = getUploadDir();
  const ext = path.extname(baseFilename);
  const nameWithoutExt = path.basename(baseFilename, ext);

  const results: any = {};

  for (const [sizeName, sizeConfig] of Object.entries(IMAGE_SIZES)) {
    const outputFilename = sizeConfig
      ? `${nameWithoutExt}-${sizeName}${ext}`
      : baseFilename;
    const outputPath = path.join(uploadDir, outputFilename);

    const info = await optimizeImage(inputPath, outputPath, sizeName as ImageSize);

    results[sizeName] = {
      path: `/uploads/${outputFilename}`,
      width: info.width,
      height: info.height,
      size: info.size,
    };
  }

  return results;
}

/**
 * Deletes an image and all its size variants
 */
export async function deleteImage(filename: string): Promise<void> {
  const uploadDir = getUploadDir();
  const ext = path.extname(filename);
  const nameWithoutExt = path.basename(filename, ext);

  // Delete all size variants
  const deletePromises = Object.keys(IMAGE_SIZES).map(async (sizeName) => {
    const variantFilename = sizeName === 'original'
      ? filename
      : `${nameWithoutExt}-${sizeName}${ext}`;
    const variantPath = path.join(uploadDir, variantFilename);

    try {
      await fs.unlink(variantPath);
    } catch (error) {
      // Ignore errors if file doesn't exist
      console.warn(`Could not delete ${variantPath}:`, error);
    }
  });

  await Promise.all(deletePromises);
}

/**
 * Gets image metadata
 */
export async function getImageMetadata(filePath: string) {
  const metadata = await sharp(filePath).metadata();

  return {
    width: metadata.width,
    height: metadata.height,
    format: metadata.format,
    size: metadata.size,
    hasAlpha: metadata.hasAlpha,
    orientation: metadata.orientation,
  };
}

/**
 * Validates image dimensions
 */
export function isValidDimensions(
  width: number,
  height: number,
  minWidth = 100,
  minHeight = 100,
  maxWidth = 4096,
  maxHeight = 4096
): boolean {
  return (
    width >= minWidth &&
    height >= minHeight &&
    width <= maxWidth &&
    height <= maxHeight
  );
}

/**
 * Formats file size for display
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}

/**
 * Gets public URL for an uploaded image
 */
export function getImageUrl(filename: string, size: ImageSize = 'original'): string {
  if (size === 'original') {
    return `/uploads/${filename}`;
  }

  const ext = path.extname(filename);
  const nameWithoutExt = path.basename(filename, ext);
  return `/uploads/${nameWithoutExt}-${size}${ext}`;
}

/**
 * Lists all uploaded images
 */
export async function listUploadedImages(): Promise<string[]> {
  const uploadDir = getUploadDir();

  try {
    const files = await fs.readdir(uploadDir);
    return files.filter(file => isValidImageExtension(file));
  } catch {
    return [];
  }
}
