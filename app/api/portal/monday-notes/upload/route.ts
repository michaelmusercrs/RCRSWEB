/**
 * Monday Notes File Upload API
 *
 * POST - Upload images/documents for Monday notes
 * Uses Vercel Blob for file storage
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-service';
import { put, del } from '@vercel/blob';
import { MondayNoteAttachment } from '@/lib/monday-notes-service';

// Max file size: 10MB for images/docs, 50MB for videos
const MAX_FILE_SIZE = 50 * 1024 * 1024;
const MAX_NON_VIDEO_SIZE = 10 * 1024 * 1024;

// Allowed file types
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
const ALLOWED_VIDEO_TYPES = ['video/mp4', 'video/webm', 'video/quicktime', 'video/x-msvideo'];
const ALLOWED_DOC_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain',
];
const ALLOWED_TYPES = [...ALLOWED_IMAGE_TYPES, ...ALLOWED_VIDEO_TYPES, ...ALLOWED_DOC_TYPES];

function getFileType(mimeType: string): 'image' | 'document' | 'photo' {
  if (ALLOWED_IMAGE_TYPES.includes(mimeType)) {
    return 'image';
  }
  return 'document';
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth();
  if (!auth.authenticated) return auth.response;

  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const noteId = formData.get('noteId') as string | null;
    const userId = formData.get('userId') as string | null;
    const caption = formData.get('caption') as string | null;

    if (!file) {
      return NextResponse.json(
        { success: false, error: 'No file provided' },
        { status: 400 }
      );
    }

    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'User ID is required' },
        { status: 400 }
      );
    }

    // Validate file size (videos get 50MB, everything else 10MB)
    const isVideo = ALLOWED_VIDEO_TYPES.includes(file.type);
    const sizeLimit = isVideo ? MAX_FILE_SIZE : MAX_NON_VIDEO_SIZE;
    if (file.size > sizeLimit) {
      return NextResponse.json(
        { success: false, error: `File size exceeds ${isVideo ? '50MB' : '10MB'} limit` },
        { status: 400 }
      );
    }

    // Validate file type
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { success: false, error: 'File type not allowed. Please upload images (JPEG, PNG, GIF, WebP), videos (MP4, WebM, MOV), or documents (PDF, Word, Excel, TXT).' },
        { status: 400 }
      );
    }

    // Generate unique filename
    const timestamp = Date.now();
    const randomStr = Math.random().toString(36).substring(2, 8);
    const extension = file.name.split('.').pop();
    const filename = `monday-notes/${userId}/${timestamp}-${randomStr}.${extension}`;

    // Upload to Vercel Blob
    const blob = await put(filename, file, {
      access: 'public',
      addRandomSuffix: false,
    });

    // Create attachment object
    const attachment: MondayNoteAttachment = {
      id: `att_${timestamp}_${randomStr}`,
      type: getFileType(file.type),
      fileName: file.name,
      fileUrl: blob.url,
      fileSize: file.size,
      mimeType: file.type,
      caption: caption || undefined,
      uploadedAt: new Date().toISOString(),
    };

    return NextResponse.json({
      success: true,
      attachment,
      message: 'File uploaded successfully',
    });
  } catch (error) {
    console.error('Error uploading file:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to upload file' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  const auth = await requireAuth();
  if (!auth.authenticated) return auth.response;

  try {
    const { searchParams } = new URL(request.url);
    const fileUrl = searchParams.get('url');

    if (!fileUrl) {
      return NextResponse.json(
        { success: false, error: 'File URL is required' },
        { status: 400 }
      );
    }

    // Delete from Vercel Blob
    await del(fileUrl);

    return NextResponse.json({
      success: true,
      message: 'File deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting file:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete file' },
      { status: 500 }
    );
  }
}
