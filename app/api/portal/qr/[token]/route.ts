// QR Code Generation API Route
// Generates QR codes for customer portal links

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-service';
import { qrGenerator } from '@/lib/qr-generator';
import { leadPortalService } from '@/lib/lead-portal-service';

interface RouteParams {
  params: Promise<{
    token: string;
  }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  const auth = await requireAuth();
  if (!auth.authenticated) return auth.response;

  try {
    const { token } = await params;

    if (!token) {
      return NextResponse.json(
        { success: false, error: 'Token is required' },
        { status: 400 }
      );
    }

    // Get query parameters for customization
    const { searchParams } = new URL(request.url);
    const format = searchParams.get('format') || 'png'; // png, svg, dataurl
    const width = parseInt(searchParams.get('width') || '300');
    const color = searchParams.get('color') || '#16a34a'; // River City green
    const bgColor = searchParams.get('bg') || '#ffffff';

    // Validate width
    if (width < 100 || width > 1000) {
      return NextResponse.json(
        { success: false, error: 'Width must be between 100 and 1000' },
        { status: 400 }
      );
    }

    // Check if this is a valid portal token
    const lead = await leadPortalService.getLeadByToken(token);

    // Build the portal URL
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://rivercityroofingsolutions.com';
    const portalUrl = `${baseUrl}/my/${token}`;

    // Generate QR code based on format
    const options = {
      width,
      color: {
        dark: color,
        light: bgColor,
      },
      margin: 2,
      errorCorrectionLevel: 'M' as const,
    };

    if (format === 'svg') {
      const result = await qrGenerator.generateSvg(portalUrl, options);

      if (!result.success || !result.svg) {
        return NextResponse.json(
          { success: false, error: result.error || 'Failed to generate QR code' },
          { status: 500 }
        );
      }

      return new NextResponse(result.svg, {
        status: 200,
        headers: {
          'Content-Type': 'image/svg+xml',
          'Cache-Control': 'public, max-age=31536000, immutable',
          'X-Portal-Token': token.substring(0, 8) + '...',
        },
      });
    }

    if (format === 'dataurl') {
      const result = await qrGenerator.generateDataUrl(portalUrl, options);

      if (!result.success || !result.dataUrl) {
        return NextResponse.json(
          { success: false, error: result.error || 'Failed to generate QR code' },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        data: {
          dataUrl: result.dataUrl,
          portalUrl,
          width,
          format: 'dataurl',
        },
      });
    }

    // Default to PNG buffer
    const result = await qrGenerator.generateBuffer(portalUrl, options);

    if (!result.success || !result.buffer) {
      return NextResponse.json(
        { success: false, error: result.error || 'Failed to generate QR code' },
        { status: 500 }
      );
    }

    // Record portal view if this is a valid lead
    // (We do this on QR generation as it indicates intent to share)
    if (lead) {
      // Don't record view here - only when portal is actually accessed
      console.log(`QR code generated for lead: ${lead.leadId}`);
    }

    // Convert Buffer to Uint8Array for NextResponse compatibility
    const uint8Array = Uint8Array.from(result.buffer);

    return new NextResponse(uint8Array, {
      status: 200,
      headers: {
        'Content-Type': 'image/png',
        'Content-Length': result.buffer.length.toString(),
        'Cache-Control': 'public, max-age=31536000, immutable',
        'Content-Disposition': `inline; filename="portal-qr-${token.substring(0, 8)}.png"`,
      },
    });

  } catch (error) {
    console.error('Error generating QR code:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
      },
      { status: 500 }
    );
  }
}

// POST - Generate QR code for custom URL
export async function POST(request: NextRequest, { params }: RouteParams) {
  const auth = await requireAuth();
  if (!auth.authenticated) return auth.response;

  try {
    const { token } = await params;
    const body = await request.json();

    // Allow generating QR for any URL (not just portal tokens)
    const customUrl = body.url;
    const format = body.format || 'dataurl';
    const width = body.width || 300;
    const color = body.color || '#16a34a';
    const bgColor = body.bgColor || '#ffffff';

    let targetUrl = customUrl;

    // If no custom URL, use the token as portal URL
    if (!targetUrl) {
      const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://rivercityroofingsolutions.com';
      targetUrl = `${baseUrl}/my/${token}`;
    }

    // Validate URL
    try {
      new URL(targetUrl);
    } catch {
      return NextResponse.json(
        { success: false, error: 'Invalid URL provided' },
        { status: 400 }
      );
    }

    const options = {
      width,
      color: {
        dark: color,
        light: bgColor,
      },
      margin: 2,
      errorCorrectionLevel: 'M' as const,
    };

    if (format === 'svg') {
      const result = await qrGenerator.generateSvg(targetUrl, options);
      if (!result.success) {
        return NextResponse.json(
          { success: false, error: result.error },
          { status: 500 }
        );
      }
      return NextResponse.json({
        success: true,
        data: {
          svg: result.svg,
          url: targetUrl,
        },
      });
    }

    // Default to data URL
    const result = await qrGenerator.generateDataUrl(targetUrl, options);
    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        dataUrl: result.dataUrl,
        url: targetUrl,
        width,
      },
    });

  } catch (error) {
    console.error('Error generating custom QR code:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
      },
      { status: 500 }
    );
  }
}
