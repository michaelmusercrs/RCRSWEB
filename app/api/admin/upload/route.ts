/**
 * Image Upload API Route
 * Handles file uploads with validation and optimization
 */

import { NextRequest, NextResponse } from 'next/server';
import formidable, { File as FormidableFile } from 'formidable';
import { promises as fs } from 'fs';
import path from 'path';
import {
  isValidImageType,
  isValidImageExtension,
  isValidFileSize,
  generateUniqueFilename,
  getUploadDir,
  ensureUploadDir,
  optimizeImage,
  generateImageSizes,
  getImageMetadata,
  formatFileSize,
  MAX_FILE_SIZE_MB,
} from '@/lib/image-utils';

/**
 * Helper to parse form data using formidable
 */
async function parseForm(req: NextRequest): Promise<{
  fields: formidable.Fields;
  files: formidable.Files;
}> {
  // Convert NextRequest to Node.js IncomingMessage-like object
  const headers: Record<string, string> = {};
  req.headers.forEach((value, key) => {
    headers[key] = value;
  });

  // Create a readable stream from the request
  const chunks: Buffer[] = [];
  const reader = req.body?.getReader();

  if (reader) {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(Buffer.from(value));
    }
  }

  const buffer = Buffer.concat(chunks);

  // Set up formidable
  const uploadDir = getUploadDir();
  await ensureUploadDir();

  const form = formidable({
    uploadDir,
    keepExtensions: true,
    maxFileSize: 10 * 1024 * 1024, // 10MB
    maxFiles: 1,
    filter: function ({ mimetype }) {
      // Accept only image files
      return mimetype ? mimetype.startsWith('image/') : false;
    },
  });

  return new Promise((resolve, reject) => {
    // Create a mock request object for formidable
    const mockReq = {
      headers,
      on: () => {},
      once: () => {},
      emit: () => {},
      // Provide the buffer as if it were being read from a stream
    } as any;

    form.parse(mockReq, (err, fields, files) => {
      if (err) {
        reject(err);
      } else {
        resolve({ fields, files });
      }
    });

    // Simulate data events
    mockReq.emit('data', buffer);
    mockReq.emit('end');
  });
}

/**
 * Alternative simpler approach: Manual multipart parsing
 */
async function handleFileUpload(req: NextRequest): Promise<{
  file: Buffer;
  filename: string;
  mimetype: string;
  size: number;
}> {
  const contentType = req.headers.get('content-type');

  if (!contentType || !contentType.includes('multipart/form-data')) {
    throw new Error('Content-Type must be multipart/form-data');
  }

  const formData = await req.formData();
  const file = formData.get('file') as File | null;

  if (!file) {
    throw new Error('No file uploaded');
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  return {
    file: buffer,
    filename: file.name,
    mimetype: file.type,
    size: file.size,
  };
}

/**
 * POST /api/admin/upload
 * Handles image upload with validation and optimization
 */
export async function POST(req: NextRequest) {
  try {
    // Parse uploaded file
    const { file, filename, mimetype, size } = await handleFileUpload(req);

    // Validate file type
    if (!isValidImageType(mimetype)) {
      return NextResponse.json(
        {
          error: 'Invalid file type',
          message: `File must be an image (JPEG, PNG, WebP, or GIF). Received: ${mimetype}`,
        },
        { status: 400 }
      );
    }

    // Validate file extension
    if (!isValidImageExtension(filename)) {
      return NextResponse.json(
        {
          error: 'Invalid file extension',
          message: 'File must have a valid image extension (.jpg, .jpeg, .png, .webp, .gif)',
        },
        { status: 400 }
      );
    }

    // Validate file size
    if (!isValidFileSize(size)) {
      return NextResponse.json(
        {
          error: 'File too large',
          message: `File size must be less than ${MAX_FILE_SIZE_MB}MB. Received: ${formatFileSize(size)}`,
        },
        { status: 400 }
      );
    }

    // Ensure upload directory exists
    await ensureUploadDir();
    const uploadDir = getUploadDir();

    // Generate unique filename
    const uniqueFilename = generateUniqueFilename(filename);
    const tempPath = path.join(uploadDir, `temp-${uniqueFilename}`);
    const finalPath = path.join(uploadDir, uniqueFilename);

    // Save file temporarily
    await fs.writeFile(tempPath, file);

    // Get image metadata
    let metadata;
    try {
      metadata = await getImageMetadata(tempPath);
    } catch (error) {
      // Clean up temp file
      await fs.unlink(tempPath);

      return NextResponse.json(
        {
          error: 'Invalid image',
          message: 'File is not a valid image or is corrupted',
        },
        { status: 400 }
      );
    }

    // Optimize the original image and save it
    const optimizedInfo = await optimizeImage(tempPath, finalPath, 'original');

    // Generate different sizes (thumbnail, small, medium, large)
    const sizes = await generateImageSizes(finalPath, uniqueFilename);

    // Delete temp file
    await fs.unlink(tempPath);

    // Return success response with file info
    return NextResponse.json({
      success: true,
      message: 'Image uploaded successfully',
      data: {
        filename: uniqueFilename,
        originalName: filename,
        url: `/uploads/${uniqueFilename}`,
        sizes,
        metadata: {
          width: metadata.width,
          height: metadata.height,
          format: metadata.format,
          size: formatFileSize(size),
          sizeBytes: size,
        },
      },
    });
  } catch (error) {
    console.error('Upload error:', error);

    return NextResponse.json(
      {
        error: 'Upload failed',
        message: error instanceof Error ? error.message : 'An unexpected error occurred',
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/admin/upload
 * Lists all uploaded images
 */
export async function GET() {
  try {
    const uploadDir = getUploadDir();

    // Check if upload directory exists
    try {
      await fs.access(uploadDir);
    } catch {
      // Directory doesn't exist, return empty array
      return NextResponse.json({
        success: true,
        images: [],
      });
    }

    // Read directory contents
    const files = await fs.readdir(uploadDir);

    // Filter for image files only (original size, not variants)
    const imageFiles = files.filter((file) => {
      return (
        isValidImageExtension(file) &&
        !file.includes('-thumbnail') &&
        !file.includes('-small') &&
        !file.includes('-medium') &&
        !file.includes('-large') &&
        !file.startsWith('temp-')
      );
    });

    // Get metadata for each image
    const images = await Promise.all(
      imageFiles.map(async (filename) => {
        const filePath = path.join(uploadDir, filename);
        const stats = await fs.stat(filePath);

        let metadata;
        try {
          metadata = await getImageMetadata(filePath);
        } catch {
          metadata = null;
        }

        return {
          filename,
          url: `/uploads/${filename}`,
          size: formatFileSize(stats.size),
          sizeBytes: stats.size,
          uploadedAt: stats.birthtime,
          metadata: metadata
            ? {
                width: metadata.width,
                height: metadata.height,
                format: metadata.format,
              }
            : null,
        };
      })
    );

    // Sort by upload date (newest first)
    images.sort((a, b) => b.uploadedAt.getTime() - a.uploadedAt.getTime());

    return NextResponse.json({
      success: true,
      images,
      count: images.length,
    });
  } catch (error) {
    console.error('Error listing images:', error);

    return NextResponse.json(
      {
        error: 'Failed to list images',
        message: error instanceof Error ? error.message : 'An unexpected error occurred',
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/upload?filename=example.jpg
 * Deletes an uploaded image and its variants
 */
export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const filename = searchParams.get('filename');

    if (!filename) {
      return NextResponse.json(
        {
          error: 'Missing filename',
          message: 'Filename parameter is required',
        },
        { status: 400 }
      );
    }

    // Validate filename (prevent path traversal)
    if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
      return NextResponse.json(
        {
          error: 'Invalid filename',
          message: 'Filename contains invalid characters',
        },
        { status: 400 }
      );
    }

    const uploadDir = getUploadDir();
    const filePath = path.join(uploadDir, filename);

    // Check if file exists
    try {
      await fs.access(filePath);
    } catch {
      return NextResponse.json(
        {
          error: 'File not found',
          message: `Image "${filename}" does not exist`,
        },
        { status: 404 }
      );
    }

    // Delete the original and all size variants
    const ext = path.extname(filename);
    const nameWithoutExt = path.basename(filename, ext);

    const deletePromises = [
      fs.unlink(filePath), // Original
      fs.unlink(path.join(uploadDir, `${nameWithoutExt}-thumbnail${ext}`)).catch(() => {}),
      fs.unlink(path.join(uploadDir, `${nameWithoutExt}-small${ext}`)).catch(() => {}),
      fs.unlink(path.join(uploadDir, `${nameWithoutExt}-medium${ext}`)).catch(() => {}),
      fs.unlink(path.join(uploadDir, `${nameWithoutExt}-large${ext}`)).catch(() => {}),
    ];

    await Promise.all(deletePromises);

    return NextResponse.json({
      success: true,
      message: 'Image deleted successfully',
      filename,
    });
  } catch (error) {
    console.error('Delete error:', error);

    return NextResponse.json(
      {
        error: 'Delete failed',
        message: error instanceof Error ? error.message : 'An unexpected error occurred',
      },
      { status: 500 }
    );
  }
}
