import { NextRequest, NextResponse } from 'next/server';
import { cmsSheetsService } from '@/lib/cms-sheets-service';

export async function GET() {
  try {
    const images = await cmsSheetsService.getImages();
    return NextResponse.json(images);
  } catch (error) {
    console.error('Error fetching images:', error);
    return NextResponse.json({ error: 'Failed to fetch images' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const data = await request.json();

    const image = await cmsSheetsService.addImage({
      filename: data.filename,
      path: data.path,
      category: data.category || 'Uploads',
      uploadedBy: data.uploadedBy || 'Admin',
      altText: data.altText || '',
    });

    return NextResponse.json(image);
  } catch (error) {
    console.error('Error adding image:', error);
    return NextResponse.json({ error: 'Failed to add image' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
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

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting image:', error);
    return NextResponse.json({ error: 'Failed to delete image' }, { status: 500 });
  }
}
