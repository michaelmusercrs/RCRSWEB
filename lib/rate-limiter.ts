/**
 * Rate Limiter for API Endpoints
 *
 * Provides configurable rate limiting with:
 * - Sliding window algorithm
 * - Per-IP and per-user tracking
 * - Configurable limits per endpoint
 * - Automatic cleanup
 */

// ============================================
// TYPES
// ============================================

export interface RateLimitConfig {
  windowMs: number;       // Time window in milliseconds
  maxRequests: number;    // Max requests per window
  message?: string;       // Custom error message
  skipFailedRequests?: boolean;  // Don't count failed requests
  keyGenerator?: (request: Request) => string;  // Custom key generator
}

interface RateLimitEntry {
  count: number;
  resetAt: number;
  requests: number[];  // Timestamps for sliding window
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
  retryAfter?: number;
}

// ============================================
// DEFAULT CONFIGURATIONS
// ============================================

export const RATE_LIMIT_CONFIGS = {
  // Auth endpoints - strict limiting
  auth: {
    windowMs: 15 * 60 * 1000,  // 15 minutes
    maxRequests: 5,
    message: 'Too many login attempts. Please try again later.',
  },

  // API endpoints - moderate limiting
  api: {
    windowMs: 60 * 1000,  // 1 minute
    maxRequests: 60,
    message: 'Too many requests. Please slow down.',
  },

  // Public endpoints - relaxed limiting
  public: {
    windowMs: 60 * 1000,  // 1 minute
    maxRequests: 100,
    message: 'Rate limit exceeded.',
  },

  // Form submissions - prevent spam on contact/referral/storm-report forms
  form: {
    windowMs: 5 * 60 * 1000,  // 5 minutes
    maxRequests: 5,
    message: 'Too many form submissions. Please wait a few minutes before trying again.',
  },

  // Admin endpoints - moderate limiting
  admin: {
    windowMs: 60 * 1000,  // 1 minute
    maxRequests: 30,
    message: 'Too many requests.',
  },

  // SECURITY: Customer token validation - strict limiting to prevent token brute-force.
  // 10 attempts per 15 minutes per IP, regardless of HTTP method used.
  customerToken: {
    windowMs: 15 * 60 * 1000,  // 15 minutes
    maxRequests: 10,
    message: 'Too many access attempts. Please try again later.',
  },
} as const;

// ============================================
// RATE LIMIT STORE (Use Redis in production)
// ============================================

const rateLimitStore = new Map<string, RateLimitEntry>();

// Cleanup expired entries every minute
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of rateLimitStore.entries()) {
      if (entry.resetAt < now) {
        rateLimitStore.delete(key);
      }
    }
  }, 60000);
}

// ============================================
// RATE LIMITER CLASS
// ============================================

export class RateLimiter {
  private config: Required<RateLimitConfig>;
  private prefix: string;

  constructor(config: RateLimitConfig, prefix: string = 'rl') {
    this.config = {
      windowMs: config.windowMs,
      maxRequests: config.maxRequests,
      message: config.message || 'Too many requests',
      skipFailedRequests: config.skipFailedRequests ?? false,
      keyGenerator: config.keyGenerator || this.defaultKeyGenerator,
    };
    this.prefix = prefix;
  }

  private defaultKeyGenerator(request: Request): string {
    // Try to get real IP from headers
    const forwarded = request.headers.get('x-forwarded-for');
    if (forwarded) {
      return forwarded.split(',')[0].trim();
    }

    const realIP = request.headers.get('x-real-ip');
    if (realIP) {
      return realIP;
    }

    // Fallback to a hash of the request URL (not ideal but works for local dev)
    return 'unknown-ip';
  }

  private getKey(request: Request): string {
    const identifier = this.config.keyGenerator(request);
    // SECURITY: Include the URL path in the rate limit key, but NOT the HTTP method.
    // This ensures rate limits apply across ALL methods (GET, POST, PUT, etc.)
    // for the same endpoint/IP combination, preventing method-switching bypass attacks.
    const url = new URL(request.url);
    const path = url.pathname;
    return `${this.prefix}:${path}:${identifier}`;
  }

  /**
   * Check if request is allowed
   */
  check(request: Request): RateLimitResult {
    const key = this.getKey(request);
    const now = Date.now();

    let entry = rateLimitStore.get(key);

    // Clean up old requests using sliding window
    if (entry) {
      entry.requests = entry.requests.filter(
        timestamp => now - timestamp < this.config.windowMs
      );
      entry.count = entry.requests.length;
    }

    if (!entry || entry.resetAt < now) {
      // Create new entry
      entry = {
        count: 0,
        resetAt: now + this.config.windowMs,
        requests: [],
      };
    }

    const remaining = Math.max(0, this.config.maxRequests - entry.count);
    const allowed = entry.count < this.config.maxRequests;

    if (!allowed) {
      const oldestRequest = Math.min(...entry.requests);
      const retryAfter = Math.ceil((oldestRequest + this.config.windowMs - now) / 1000);

      return {
        allowed: false,
        remaining: 0,
        resetAt: entry.resetAt,
        retryAfter: Math.max(1, retryAfter),
      };
    }

    return {
      allowed: true,
      remaining,
      resetAt: entry.resetAt,
    };
  }

  /**
   * Record a request (call after check passes)
   */
  record(request: Request): void {
    const key = this.getKey(request);
    const now = Date.now();

    let entry = rateLimitStore.get(key);

    if (!entry || entry.resetAt < now) {
      entry = {
        count: 1,
        resetAt: now + this.config.windowMs,
        requests: [now],
      };
    } else {
      // Clean old requests
      entry.requests = entry.requests.filter(
        timestamp => now - timestamp < this.config.windowMs
      );
      entry.requests.push(now);
      entry.count = entry.requests.length;
    }

    rateLimitStore.set(key, entry);
  }

  /**
   * Reset rate limit for an identifier
   */
  reset(request: Request): void {
    const key = this.getKey(request);
    rateLimitStore.delete(key);
  }

  /**
   * Get rate limit headers
   */
  getHeaders(result: RateLimitResult): Record<string, string> {
    const headers: Record<string, string> = {
      'X-RateLimit-Limit': this.config.maxRequests.toString(),
      'X-RateLimit-Remaining': result.remaining.toString(),
      'X-RateLimit-Reset': Math.ceil(result.resetAt / 1000).toString(),
    };

    if (result.retryAfter) {
      headers['Retry-After'] = result.retryAfter.toString();
    }

    return headers;
  }

  /**
   * Get error message
   */
  getMessage(): string {
    return this.config.message;
  }
}

// ============================================
// FACTORY FUNCTIONS
// ============================================

export function createAuthRateLimiter(): RateLimiter {
  return new RateLimiter(RATE_LIMIT_CONFIGS.auth, 'auth');
}

export function createApiRateLimiter(): RateLimiter {
  return new RateLimiter(RATE_LIMIT_CONFIGS.api, 'api');
}

export function createAdminRateLimiter(): RateLimiter {
  return new RateLimiter(RATE_LIMIT_CONFIGS.admin, 'admin');
}

export function createPublicRateLimiter(): RateLimiter {
  return new RateLimiter(RATE_LIMIT_CONFIGS.public, 'public');
}

export function createFormRateLimiter(): RateLimiter {
  return new RateLimiter(RATE_LIMIT_CONFIGS.form, 'form');
}

// SECURITY: Rate limiter for customer token validation endpoints.
// Prevents brute-force token guessing across all HTTP methods.
export function createCustomerTokenRateLimiter(): RateLimiter {
  return new RateLimiter(RATE_LIMIT_CONFIGS.customerToken, 'customer-token');
}

// ============================================
// MIDDLEWARE HELPER
// ============================================

import { NextResponse } from 'next/server';

export async function withRateLimit(
  request: Request,
  rateLimiter: RateLimiter,
  handler: () => Promise<Response>
): Promise<Response> {
  const result = rateLimiter.check(request);

  if (!result.allowed) {
    const headers = rateLimiter.getHeaders(result);
    return NextResponse.json(
      {
        success: false,
        error: rateLimiter.getMessage(),
        retryAfter: result.retryAfter,
      },
      {
        status: 429,
        headers,
      }
    );
  }

  // Record the request
  rateLimiter.record(request);

  // Execute handler
  const response = await handler();

  // Add rate limit headers to response
  const headers = rateLimiter.getHeaders(result);
  Object.entries(headers).forEach(([key, value]) => {
    response.headers.set(key, value);
  });

  return response;
}
