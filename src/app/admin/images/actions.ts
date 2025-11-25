'use server';

import { put, del } from '@vercel/blob';
import { revalidatePath } from 'next/cache';

export async function uploadImage(formData: FormData) {
  try {
    const file = formData.get('file') as File;
    const category = formData.get('category') as string;

    if (!file) {
      return { success: false, message: 'No file provided' };
    }

    // Validate file type
    const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];
    if (!validTypes.includes(file.type)) {
      return { success: false, message: 'Invalid file type. Only JPG, PNG, and WebP are allowed.' };
    }

    // Validate file size (10MB max)
    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      return { success: false, message: 'File too large. Maximum size is 10MB.' };
    }

    // Create filename with category prefix
    const timestamp = Date.now();
    const sanitizedName = file.name.replace(/[^a-zA-Z0-9.-]/g, '-').toLowerCase();
    const filename = `${category}/${timestamp}-${sanitizedName}`;

    // Upload to Vercel Blob
    const blob = await put(filename, file, {
      access: 'public',
      addRandomSuffix: false,
    });

    revalidatePath('/', 'layout');

    return {
      success: true,
      url: blob.url,
      message: 'Image uploaded successfully',
    };
  } catch (error) {
    console.error('Upload error:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Upload failed',
    };
  }
}

export async function deleteImage(url: string) {
  try {
    await del(url);
    revalidatePath('/', 'layout');
    
    return {
      success: true,
      message: 'Image deleted successfully',
    };
  } catch (error) {
    console.error('Delete error:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Delete failed',
    };
  }
}
