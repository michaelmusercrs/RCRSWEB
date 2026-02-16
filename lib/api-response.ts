/**
 * Standardized API Response Helpers
 *
 * Provides consistent response shapes across all API routes:
 *   Success: { success: true, data: ... }
 *   Error:   { success: false, error: string, code?: string }
 *
 * Usage:
 *   import { apiSuccess, apiError, apiValidationError } from '@/lib/api-response';
 *
 *   return apiSuccess({ leads });
 *   return apiError('Not found', 404);
 *   return apiValidationError({ email: 'Invalid email', phone: 'Required' });
 */

import { NextResponse } from 'next/server';

// ── Response Types ──────────────────────────────────────────────────

export interface ApiSuccessResponse<T = unknown> {
  success: true;
  data: T;
  message?: string;
}

export interface ApiErrorResponse {
  success: false;
  error: string;
  code?: string;
  details?: Record<string, string>;
}

export type ApiResponse<T = unknown> = ApiSuccessResponse<T> | ApiErrorResponse;

// ── Helper Functions ────────────────────────────────────────────────

/**
 * Return a successful JSON response.
 *
 * @param data - The payload to include under `data`
 * @param status - HTTP status code (default 200)
 * @param message - Optional human-readable message
 */
export function apiSuccess<T>(data: T, status = 200, message?: string): NextResponse<ApiSuccessResponse<T>> {
  const body: ApiSuccessResponse<T> = { success: true, data };
  if (message) body.message = message;
  return NextResponse.json(body, { status });
}

/**
 * Return an error JSON response.
 *
 * @param error - Human-readable error message
 * @param status - HTTP status code (default 500)
 * @param code - Optional machine-readable error code (e.g. 'RATE_LIMITED')
 */
export function apiError(error: string, status = 500, code?: string): NextResponse<ApiErrorResponse> {
  const body: ApiErrorResponse = { success: false, error };
  if (code) body.code = code;
  return NextResponse.json(body, { status });
}

/**
 * Return a 400 validation error with per-field details.
 *
 * @param fields - Map of field names to their validation error messages
 */
export function apiValidationError(fields: Record<string, string>): NextResponse<ApiErrorResponse> {
  const fieldNames = Object.keys(fields);
  const summary = fieldNames.length === 1
    ? `Validation failed: ${fields[fieldNames[0]]}`
    : `Validation failed on ${fieldNames.length} fields`;

  return NextResponse.json(
    {
      success: false,
      error: summary,
      code: 'VALIDATION_ERROR',
      details: fields,
    },
    { status: 400 }
  );
}

/**
 * Return a successful JSON response with HTTP cache headers.
 * Use for semi-static data (team members, blog posts, service areas, etc.)
 *
 * @param data - The payload
 * @param maxAge - Cache duration in seconds (default 300 = 5 min)
 * @param staleWhileRevalidate - Stale-while-revalidate window in seconds (default 600 = 10 min)
 */
export function apiCachedSuccess<T>(
  data: T,
  maxAge = 300,
  staleWhileRevalidate = 600,
): NextResponse<ApiSuccessResponse<T>> {
  const body: ApiSuccessResponse<T> = { success: true, data };
  const hash = Buffer.from(JSON.stringify(data)).length.toString(36) + '-' + Date.now().toString(36);
  return NextResponse.json(body, {
    status: 200,
    headers: {
      'Cache-Control': `public, s-maxage=${maxAge}, stale-while-revalidate=${staleWhileRevalidate}`,
      'ETag': `"${hash}"`,
    },
  });
}

/**
 * Extract a useful error message from an unknown thrown value.
 * Prevents leaking stack traces while still providing context.
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return 'Internal server error';
}
