import { NextResponse } from 'next/server';
import { getSiteConfig } from '@/lib/site-config';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const config = await getSiteConfig();
    return NextResponse.json({ success: true, data: config });
  } catch (error) {
    console.error('Site config read failed:', error);
    return NextResponse.json({
      success: true,
      data: { showBeforeAfterGallery: false }
    });
  }
}
