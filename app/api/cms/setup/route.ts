import { NextResponse } from 'next/server';
import { cmsSheetsService } from '@/lib/cms-sheets-service';

// POST /api/cms/setup - Initialize sheets with default data
export async function POST() {
  try {
    // Setup blog posts sheet
    await cmsSheetsService.setupBlogPostsSheet();

    // Setup images sheet
    await cmsSheetsService.setupImagesSheet();

    return NextResponse.json({
      success: true,
      message: 'CMS sheets initialized successfully'
    });
  } catch (error) {
    console.error('Error setting up CMS sheets:', error);
    return NextResponse.json({
      error: 'Failed to setup CMS sheets',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
