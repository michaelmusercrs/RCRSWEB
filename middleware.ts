import { NextRequest, NextResponse } from 'next/server';
import { validateCsrf } from '@/lib/csrf';

// Environment-based URLs (with fallbacks)
const PORTAL_URL = process.env.NEXT_PUBLIC_PORTAL_URL || 'https://rcrsal.com';
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.rivercityroofingsolutions.com';

// ── Route definitions ──────────────────────────────────────────────────────────

// Public site routes allowed on rivercityroofingsolutions.com
const PUBLIC_ROUTES = new Set([
  '/',
  '/services',
  '/team',
  '/about',
  '/blog',
  '/locations',
  '/service-areas',
  '/check-my-address',
  '/referral-rewards',
  '/privacy',
  '/terms',
  '/bni',
  '/contact',
  '/community',
  '/careers',
  '/thank-you',
  '/offline',
  '/sitemap.xml',
  '/robots.txt',
]);

// Public route prefixes (routes that start with these paths)
const PUBLIC_PREFIXES = [
  '/services/',
  '/blog/',
  '/locations/',
  '/service-areas/',
  '/team/',
  '/p/',          // short links
];

// Internal portal prefixes allowed on rcrsal.com
const PORTAL_PREFIXES = [
  '/portal',
  '/admin',
  '/command-center',
  '/customer',
];

// Static file patterns that should always pass through
const STATIC_PREFIXES = [
  '/_next',
  '/favicon',
  '/images',
  '/icons',
  '/fonts',
  '/assets',
  '/uploads',
];

const STATIC_EXTENSIONS = [
  '.ico',
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.svg',
  '.webp',
  '.avif',
  '.woff',
  '.woff2',
  '.ttf',
  '.eot',
  '.css',
  '.js',
  '.map',
];

// ── Helper functions ───────────────────────────────────────────────────────────

function isLocalhost(hostname: string): boolean {
  return (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '::1' ||
    hostname.startsWith('192.168.') ||
    hostname.startsWith('10.')
  );
}

function isStaticFile(pathname: string): boolean {
  // Check static prefixes
  if (STATIC_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
    return true;
  }
  // Check file extensions
  if (STATIC_EXTENSIONS.some((ext) => pathname.endsWith(ext))) {
    return true;
  }
  return false;
}

function isApiRoute(pathname: string): boolean {
  return pathname.startsWith('/api/');
}

function isCustomerPortalRoute(pathname: string): boolean {
  // /my/[token] pattern - customer portal accessible on both domains
  return pathname.startsWith('/my/');
}

function isPublicRoute(pathname: string): boolean {
  // Exact match
  if (PUBLIC_ROUTES.has(pathname)) {
    return true;
  }
  // Prefix match (e.g. /services/roof-repair, /blog/some-post)
  if (PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
    return true;
  }
  return false;
}

function isPortalRoute(pathname: string): boolean {
  return PORTAL_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

function isPublicDomain(hostname: string): boolean {
  return (
    hostname === 'rivercityroofingsolutions.com' ||
    hostname === 'www.rivercityroofingsolutions.com'
  );
}

function isPortalDomain(hostname: string): boolean {
  return hostname === 'rcrsal.com' || hostname === 'www.rcrsal.com';
}

// ── Middleware ──────────────────────────────────────────────────────────────────

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hostname = request.headers.get('host')?.split(':')[0] || '';
  const port = request.headers.get('host')?.split(':')[1] || '';

  // Rule 1: On localhost / dev mode, allow ALL routes
  if (isLocalhost(hostname) || port === '3000') {
    return NextResponse.next();
  }

  // Rule 3: Static files always pass through
  if (isStaticFile(pathname)) {
    return NextResponse.next();
  }

  // Rule 2: API routes work on BOTH domains — with CORS enforcement + CSRF protection
  if (isApiRoute(pathname)) {
    const origin = request.headers.get('origin') || '';

    // ── CSRF Protection ──────────────────────────────────────────────────────
    // Block state-changing requests from unknown origins
    const csrfError = validateCsrf(request.method, pathname, origin || null, hostname);
    if (csrfError) {
      console.warn(`[CSRF] Blocked: ${request.method} ${pathname} — ${csrfError}`);
      return NextResponse.json(
        { error: 'Forbidden: CSRF validation failed' },
        { status: 403 }
      );
    }

    const response = NextResponse.next();

    // CORS: Only allow known origins in production
    const allowedOrigins = [
      'https://www.rivercityroofingsolutions.com',
      'https://rivercityroofingsolutions.com',
      'https://rcrsal.com',
      'https://www.rcrsal.com',
    ];

    if (allowedOrigins.includes(origin)) {
      response.headers.set('Access-Control-Allow-Origin', origin);
      response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
      response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
      response.headers.set('Access-Control-Max-Age', '86400');
    }

    // Handle preflight
    if (request.method === 'OPTIONS') {
      if (allowedOrigins.includes(origin)) {
        return new NextResponse(null, {
          status: 204,
          headers: {
            'Access-Control-Allow-Origin': origin,
            'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
            'Access-Control-Max-Age': '86400',
          },
        });
      }
      return new NextResponse(null, { status: 403 });
    }

    return response;
  }

  // Rule 4: /my/[token] customer portal works on BOTH domains
  if (isCustomerPortalRoute(pathname)) {
    return NextResponse.next();
  }

  // ── Public domain: rivercityroofingsolutions.com ───────────────────────────

  if (isPublicDomain(hostname)) {
    // Allow public routes
    if (isPublicRoute(pathname)) {
      return NextResponse.next();
    }

    // Block portal/admin/dashboard routes on the public domain — redirect to rcrsal.com
    if (isPortalRoute(pathname)) {
      const redirectUrl = new URL(pathname + request.nextUrl.search, PORTAL_URL);
      return NextResponse.redirect(redirectUrl, 308);
    }

    // Block known internal/debug routes
    const blockedPrefixes = ['/test-debug', '/secret-deals', '/report', '/dashboard', '/admin'];
    if (blockedPrefixes.some(p => pathname.startsWith(p))) {
      return NextResponse.rewrite(new URL('/not-found', request.url));
    }

    // For any other unrecognized route, let Next.js handle it (will 404 naturally)
    return NextResponse.next();
  }

  // ── Portal domain: rcrsal.com ──────────────────────────────────────────────

  if (isPortalDomain(hostname)) {
    // Allow portal routes
    if (isPortalRoute(pathname)) {
      return NextResponse.next();
    }

    // Redirect public page requests to rivercityroofingsolutions.com
    if (isPublicRoute(pathname)) {
      const redirectUrl = new URL(pathname + request.nextUrl.search, SITE_URL);
      return NextResponse.redirect(redirectUrl, 308);
    }

    // For any other unrecognized route on the portal domain, let Next.js handle it
    return NextResponse.next();
  }

  // ── Unknown domain (e.g. Vercel preview deployments) ───────────────────────
  // Allow all routes on unknown domains (covers *.vercel.app previews)
  return NextResponse.next();
}

// ── Matcher configuration ──────────────────────────────────────────────────────
// Run middleware on all routes EXCEPT static assets handled by Next.js internally
export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!_next/static|_next/image|favicon\\.ico).*)',
  ],
};
