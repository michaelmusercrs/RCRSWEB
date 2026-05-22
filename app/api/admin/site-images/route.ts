// Site Images Admin API — browse + upload + approve
//
// GET  - list site images (filter by category / subcategory / status)
// PUT  - upsert one row (metadata edits, approval flip, URL swap)
// POST - upload an image: standardize via sharp pipeline → Blob → upsert row
//
// Owner / admin / manager only. Reuses the photo-standardizer that already
// powers rep profiles. Each category has a preset aspect ratio.

import { NextRequest, NextResponse } from 'next/server';
import { requireRoleAtLeast } from '@/lib/auth-service';
import { googleSheetsService, type SiteImageRecord } from '@/lib/google-sheets-service';
import { invalidateSiteImagesCache } from '@/lib/site-images';
import { standardizePhoto, type PhotoKind } from '@/lib/photo-standardizer';
import { put } from '@vercel/blob';

// Map our site-image categories onto photo-standardizer kinds. New
// categories: city / blog / service / og use 16:9 (truck preset); gallery
// uses 4:3 (job-photo); team headshots use 1:1.
function kindForCategory(category: string): PhotoKind {
  switch (category) {
    case 'team':
      return 'headshot';
    case 'gallery':
      return 'job-photo';
    case 'city':
    case 'service':
    case 'blog':
    case 'hero':
    case 'og':
    default:
      return 'truck'; // 16:9 — best generic landscape preset
  }
}

export async function GET(request: NextRequest) {
  const auth = await requireRoleAtLeast(['owner', 'admin', 'manager']);
  if (!auth.authenticated) return auth.response;

  const category = request.nextUrl.searchParams.get('category') || '';
  const subcategory = request.nextUrl.searchParams.get('subcategory') || '';
  const approvedOnly = request.nextUrl.searchParams.get('approved') === 'true';

  const records = await googleSheetsService.getSiteImages({
    category: category || undefined,
    subcategory: subcategory || undefined,
    approvedOnly,
  });
  return NextResponse.json({ success: true, images: records });
}

export async function PUT(request: NextRequest) {
  const auth = await requireRoleAtLeast(['owner', 'admin']);
  if (!auth.authenticated) return auth.response;

  try {
    const body = await request.json();
    const update = body.image as Partial<SiteImageRecord> & { key: string };
    if (!update?.key) {
      return NextResponse.json({ success: false, error: 'image.key required' }, { status: 400 });
    }

    // If approval is flipping to true, record who approved and when.
    const now = new Date().toISOString();
    if (update.approved === 'true' || update.approved === true as unknown as string) {
      update.approvedBy = auth.user.name || 'admin';
      update.approvedAt = now;
    }

    const ok = await googleSheetsService.upsertSiteImage(update);
    if (!ok) {
      return NextResponse.json({ success: false, error: 'Save failed' }, { status: 500 });
    }
    invalidateSiteImagesCache();
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({
      success: false,
      error: err instanceof Error ? err.message : 'Internal error',
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireRoleAtLeast(['owner', 'admin']);
  if (!auth.authenticated) return auth.response;
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return NextResponse.json({ success: false, error: 'Blob storage not configured' }, { status: 500 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const key = formData.get('key') as string | null;
    const category = formData.get('category') as string | null;
    const subcategory = (formData.get('subcategory') as string | null) || '';
    const alt = (formData.get('alt') as string | null) || '';
    const intent = (formData.get('intent') as string | null) || '';
    const licenseSource = (formData.get('licenseSource') as string | null) || '';

    if (!file || !key || !category) {
      return NextResponse.json({ success: false, error: 'file + key + category required' }, { status: 400 });
    }
    if (file.size > 8 * 1024 * 1024) {
      return NextResponse.json({ success: false, error: 'File too large (8MB max)' }, { status: 413 });
    }
    if (!file.type.startsWith('image/')) {
      return NextResponse.json({ success: false, error: 'Only image uploads allowed' }, { status: 400 });
    }

    const inputBuf = Buffer.from(await file.arrayBuffer());
    const ts = Date.now();

    // Originals → internal path (EXIF intact). Standardized → public path.
    const origExt = (file.name.split('.').pop() || 'jpg').toLowerCase();
    const internalPath = `site-images/internal/${key}-${ts}-original.${origExt}`;
    await put(internalPath, inputBuf, { access: 'public', contentType: file.type });

    const photoKind = kindForCategory(category);
    const { buffer: stdBuf, contentType: stdCT } = await standardizePhoto(inputBuf, { kind: photoKind });
    const publicPath = `site-images/public/${key}-${ts}.webp`;
    const blob = await put(publicPath, stdBuf, { access: 'public', contentType: stdCT });

    // Upsert row in Site_Images. Starts as approved=false — needs explicit
    // approval flip via PUT before getImage() will return it.
    const aspectByKind: Record<PhotoKind, string> = {
      headshot: '1:1',
      truck: '16:9',
      'job-photo': '4:3',
    };
    await googleSheetsService.upsertSiteImage({
      key,
      category,
      subcategory,
      url: blob.url,
      alt,
      intent,
      aspectRatio: aspectByKind[photoKind] || '16:9',
      standardized: 'true',
      approved: 'false',
      uploadedBy: auth.user.name || 'admin',
      licenseSource,
    });
    invalidateSiteImagesCache();

    return NextResponse.json({
      success: true,
      url: blob.url,
      key,
      standardized: true,
      approvalRequired: true,
      message: 'Uploaded and standardized. Approve it on the page to make it live.',
    });
  } catch (err) {
    return NextResponse.json({
      success: false,
      error: err instanceof Error ? err.message : 'Upload failed',
    }, { status: 500 });
  }
}
