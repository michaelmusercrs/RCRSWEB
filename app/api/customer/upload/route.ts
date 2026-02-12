import { NextRequest, NextResponse } from 'next/server';
import { put } from '@vercel/blob';
import { requireAuth } from '@/lib/auth-service';

export async function POST(request: NextRequest) {
  // SECURITY: Require authentication for file uploads
  const auth = await requireAuth();
  if (!auth.authenticated) return auth.response;

  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const customerId = formData.get('customerId') as string;
    const description = formData.get('description') as string || '';
    const category = formData.get('category') as string || 'customer_upload';

    if (!file || !customerId) {
      return NextResponse.json(
        { success: false, error: 'File and customerId are required' },
        { status: 400 }
      );
    }

    // SECURITY: Prevent horizontal privilege escalation.
    // Customers can ONLY upload files for their own account.
    if (auth.user.role === 'customer' && auth.user.userId !== customerId) {
      console.warn(
        `SECURITY: Horizontal privilege escalation attempt (upload). ` +
        `User ${auth.user.userId} tried to upload for customer ${customerId}`
      );
      return NextResponse.json(
        { success: false, error: 'Access denied: you can only upload files for your own account' },
        { status: 403 }
      );
    }

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'application/pdf'];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { success: false, error: 'Invalid file type. Allowed: JPEG, PNG, WebP, HEIC, PDF' },
        { status: 400 }
      );
    }

    // Validate file size (max 10MB)
    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      return NextResponse.json(
        { success: false, error: 'File too large. Maximum size is 10MB' },
        { status: 400 }
      );
    }

    // Upload to Vercel Blob
    const timestamp = Date.now();
    const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
    const path = `customer-uploads/${customerId}/${timestamp}-${safeName}`;

    const blob = await put(path, file, {
      access: 'public',
      addRandomSuffix: false,
    });

    console.log(`Customer upload: ${customerId} - ${file.name} -> ${blob.url}`);

    return NextResponse.json({
      success: true,
      data: {
        url: blob.url,
        filename: file.name,
        size: file.size,
        type: file.type,
        category,
        description,
        uploadedAt: new Date().toISOString(),
      },
    });

  } catch (error) {
    console.error('Customer upload error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Upload failed' },
      { status: 500 }
    );
  }
}
