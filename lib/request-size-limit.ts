/**
 * Request Body Size Limit Utility
 *
 * Provides a helper to enforce body size limits on API routes.
 * In Next.js App Router, there's no built-in `api.bodyParser.sizeLimit` config,
 * so we check the Content-Length header and/or read the body with a size cap.
 *
 * Usage:
 *   const sizeError = checkRequestSize(request, '1mb');
 *   if (sizeError) return sizeError;
 */

import { NextRequest, NextResponse } from 'next/server';

// Parse size strings like '1mb', '500kb', '10kb' into bytes
function parseSizeLimit(size: string): number {
  const match = size.toLowerCase().match(/^(\d+(?:\.\d+)?)\s*(b|kb|mb|gb)?$/);
  if (!match) return 1024 * 1024; // default 1MB

  const value = parseFloat(match[1]);
  const unit = match[2] || 'b';

  switch (unit) {
    case 'gb': return value * 1024 * 1024 * 1024;
    case 'mb': return value * 1024 * 1024;
    case 'kb': return value * 1024;
    case 'b':
    default: return value;
  }
}

/**
 * Check if a request's Content-Length exceeds the specified size limit.
 * Returns a 413 NextResponse if the limit is exceeded, or null if OK.
 *
 * This checks the Content-Length header, which is set by clients before
 * the body is fully transmitted. It provides early rejection without
 * reading the entire body into memory.
 *
 * @param request - The incoming request
 * @param limit - Size limit string (e.g., '1mb', '500kb', '100kb')
 * @returns NextResponse with 413 status if too large, null if within limit
 */
export function checkRequestSize(
  request: NextRequest,
  limit: string = '1mb'
): NextResponse | null {
  const maxBytes = parseSizeLimit(limit);
  const contentLength = request.headers.get('content-length');

  if (contentLength) {
    const bodySize = parseInt(contentLength, 10);
    if (!isNaN(bodySize) && bodySize > maxBytes) {
      return NextResponse.json(
        {
          success: false,
          error: `Request body too large. Maximum size is ${limit}.`,
        },
        { status: 413 }
      );
    }
  }

  return null;
}

/**
 * Parse JSON body with size limit enforcement.
 * Reads the body as text, checks size, then parses as JSON.
 * Use this instead of request.json() when you need strict size enforcement
 * (handles cases where Content-Length header is missing or spoofed).
 *
 * @param request - The incoming request
 * @param limit - Size limit string (e.g., '1mb', '500kb')
 * @returns Parsed JSON body or a 413/400 NextResponse
 */
export async function parseJsonWithSizeLimit(
  request: NextRequest,
  limit: string = '1mb'
): Promise<{ data: unknown } | { error: NextResponse }> {
  const maxBytes = parseSizeLimit(limit);

  // First check Content-Length header for early rejection
  const headerCheck = checkRequestSize(request, limit);
  if (headerCheck) return { error: headerCheck };

  try {
    const rawBody = await request.text();

    // Check actual body size (Content-Length can be spoofed or missing)
    if (rawBody.length > maxBytes) {
      return {
        error: NextResponse.json(
          {
            success: false,
            error: `Request body too large. Maximum size is ${limit}.`,
          },
          { status: 413 }
        ),
      };
    }

    const data = JSON.parse(rawBody);
    return { data };
  } catch (parseError) {
    return {
      error: NextResponse.json(
        { success: false, error: 'Invalid JSON in request body' },
        { status: 400 }
      ),
    };
  }
}
