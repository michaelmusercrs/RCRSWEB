import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth-service';
import { cmsSheetsService } from '@/lib/cms-sheets-service';
import { cache } from '@/lib/cache';

const CMS_TTL = 30 * 60 * 1000; // 30 minutes

export async function GET() {
  const auth = await requireAdmin();
  if (!auth.authenticated) return auth.response;

  try {
    const cacheKey = 'cms:images:all';
    const cached = cache.get(cacheKey);
    if (cached) return NextResponse.json(cached);

    const images = await cmsSheetsService.getImages();
    cache.set(cacheKey, images, CMS_TTL);
    return NextResponse.json(images);
  } catch (error) {
    console.error('Error fetching images:', error);
    return NextResponse.json({ error: 'Failed to fetch images' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.authenticated) return auth.response;

  try {
    const data = await request.json();

    const image = await cmsSheetsService.addImage({
      filename: data.filename,
      path: data.path,
      category: data.category || 'Uploads',
      uploadedBy: data.uploadedBy || 'Admin',
      altText: data.altText || '',
    });

    cache.invalidate('cms:images:all');
    return NextResponse.json(image);
  } catch (error) {
    console.error('Error adding image:', error);
    return NextResponse.json({ error: 'Failed to add image' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.authenticated) return auth.response;

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'ID is required' }, { status: 400 });
    }

    const success = await cmsSheetsService.deleteImage(id);

    if (!success) {
      return NextResponse.json({ error: 'Image not found' }, { status: 404 });
    }

    cache.invalidate('cms:images:all');
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting image:', error);
    return NextResponse.json({ error: 'Failed to delete image' }, { status: 500 });
  }
}
