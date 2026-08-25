import { NextRequest, NextResponse } from 'next/server';
import { validateCsrf } from '@/lib/csrf';

// ── Page-level access control ──────────────────────────────────────────────────
//
// In addition to API-level enforcement, the middleware bounces users away from
// portal pages they don't have permission to load. This prevents the "broken
// page" experience where a viewer loads /portal/admin and sees empty UI shells
// because every API call returns 403.
//
// We do NOT verify the JWT signature here — API routes still do that. We only
// peek at the payload to read the role, since this layer is for UX, not
// security. A forged token with a fake role just gets the user a normal-looking
// page with broken API calls (same as today).

type RoleName = 'Owner' | 'Admin' | 'Manager' | 'Sales' | 'Driver' | 'Office' | string;

// Routes restricted to a minimum role tier (using ROLE_HIERARCHY weights).
// Higher number = higher privilege.
const ROLE_RANK: Record<string, number> = {
  // Capitalized (display names)
  Owner: 6,
  Admin: 5,
  Manager: 4,
  Office: 3,
  Sales: 2,
  Driver: 1,
  // Lowercase (JWT payload values from team-roles.ts)
  owner: 6,
  admin: 5,
  manager: 4,
  office: 3,
  sales: 2,
  driver: 1,
  // Extended roles from team-roles.ts
  project_manager: 4,
  pm: 4,
  viewer: 1,
};

// Pages that require at least the named role to load.
// Match is "starts with" — longer prefixes win over shorter ones.
const PROTECTED_PAGE_RULES: Array<{ prefix: string; minRole: RoleName }> = [
  // Admin-only
  { prefix: '/portal/admin', minRole: 'Admin' },
  { prefix: '/portal/billing', minRole: 'Office' },
  { prefix: '/portal/office', minRole: 'Office' },
  { prefix: '/command-center/admin', minRole: 'Admin' },
  { prefix: '/command-center/settings', minRole: 'Admin' },
  // Manager+ (operations oversight)
  { prefix: '/portal/manager', minRole: 'Manager' },
  // Office/Manager+
  // Rick (driver) needs inventory access for restock, weekly counts, QR scans
  { prefix: '/portal/inventory', minRole: 'Driver' },
];

function base64UrlDecode(str: string): string {
  // Edge-runtime safe: use atob, not Buffer
  const padded = str.replace(/-/g, '+').replace(/_/g, '/');
  const padding = padded.length % 4;
  const padStr = padding ? padded + '='.repeat(4 - padding) : padded;
  try {
    return atob(padStr);
  } catch {
    return '';
  }
}

function decodeJwtPayload(token: string): { role?: string; exp?: number } | null {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  try {
    const payload = JSON.parse(base64UrlDecode(parts[1]));
    return payload || null;
  } catch {
    return null;
  }
}

function getUserRoleFromRequest(request: NextRequest): string | null {
  const token = request.cookies.get('access_token')?.value;
  if (!token) return null;
  const payload = decodeJwtPayload(token);
  if (!payload) return null;
  // Honor expiration so a stale cookie doesn't grant access through middleware
  if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) return null;
  return payload.role || null;
}

function findProtectedRule(pathname: string): { prefix: string; minRole: RoleName } | null {
  // Longest-prefix match so /portal/admin/lead-distro picks the /portal/admin rule
  let best: { prefix: string; minRole: RoleName } | null = null;
  for (const rule of PROTECTED_PAGE_RULES) {
    if (pathname === rule.prefix || pathname.startsWith(rule.prefix + '/')) {
      if (!best || rule.prefix.length > best.prefix.length) {
        best = rule;
      }
    }
  }
  return best;
}

function userMeetsMinRole(userRole: string | null, minRole: RoleName): boolean {
  if (!userRole) return false;
  // JWT stores role as lowercase ("owner"), ROLE_RANK uses capitalized ("Owner").
  // Normalize both sides to handle any casing.
  const normalize = (r: string) => r.charAt(0).toUpperCase() + r.slice(1).toLowerCase();
  const userRank = ROLE_RANK[normalize(userRole)] ?? ROLE_RANK[userRole] ?? 0;
  const minRank = ROLE_RANK[normalize(minRole)] ?? ROLE_RANK[minRole] ?? 0;
  return userRank >= minRank;
}

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
  '/reviews',
  '/gallery',
  '/faq',
  '/financing',
  '/warranty',
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
  '/lp/',         // Google Ads landing pages
  '/view/',       // public customer portal by token (homeowner-facing)
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
  // /my/[token] and /view/[token] patterns - customer portal accessible on both domains
  return pathname.startsWith('/my/') || pathname.startsWith('/view/');
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

  // Rule 2.5: Canonicalize the public apex → www for page routes.
  // vercel.json already redirects apex→www, but the statically-prerendered
  // homepage is served from a host-shared edge cache that can bypass that
  // config redirect (users landing on the bare domain saw the home page
  // served on the apex instead of forwarding). Middleware runs per request
  // BEFORE the page cache, so it forwards the root — and every page —
  // reliably. API routes are left alone; they're allowed on both hosts.
  // 307 (not 308) per house rule so the redirect is never permanent-cached.
  if (hostname === 'rivercityroofingsolutions.com' && !isApiRoute(pathname)) {
    const url = request.nextUrl.clone();
    url.hostname = 'www.rivercityroofingsolutions.com';
    url.port = '';
    return NextResponse.redirect(url, 307);
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

  // ── Portal domain: rcrsal.com (CHECK FIRST — before public domain) ────────
  // rcrsal.com is the portal. Period. Root = login page. No public site content.

  if (isPortalDomain(hostname)) {
    // rcrsal.com root = login page. Always. No redirect. No intermediate page.
    if (pathname === '/' || pathname === '') {
      return NextResponse.rewrite(new URL('/portal', request.url));
    }

    // Allow portal routes — but enforce page-level access control first
    if (isPortalRoute(pathname)) {
      const rule = findProtectedRule(pathname);
      if (rule) {
        const userRole = getUserRoleFromRequest(request);
        if (!userMeetsMinRole(userRole, rule.minRole)) {
          // No role yet (not logged in) → send to login
          if (!userRole) {
            return NextResponse.rewrite(new URL('/portal', request.url));
          }
          // Logged in but insufficient role → bounce to dashboard
          return NextResponse.redirect(new URL('/portal/dashboard', request.url), 307);
        }
      }
      return NextResponse.next();
    }

    // Allow BNI routes on portal domain (presentations)
    if (pathname.startsWith('/bni')) {
      return NextResponse.next();
    }

    // Allow roof report/measure on portal domain
    if (pathname.startsWith('/roof-report') || pathname.startsWith('/roof-measure')) {
      return NextResponse.next();
    }

    // Public-on-portal pages (no login required, shareable links)
    // /trip is dynamic via app/trip/route.ts (reads from Vercel Blob).
    // /trip/update is the upload page. Allow both, plus /api/trip/*.
    if (pathname === '/trip' || pathname.startsWith('/trip/') || pathname.startsWith('/api/trip/')) {
      return NextResponse.next();
    }
    if (pathname === '/trip-dashboard' || pathname === '/trip-dashboard.html') {
      return NextResponse.redirect(new URL('/trip' + request.nextUrl.search, request.url), 307);
    }
    // /chrisview is a read-only RCRS database dashboard — public by owner's
    // choice (same pattern as /trip).
    if (pathname === '/chrisview' || pathname.startsWith('/chrisview/') || pathname.startsWith('/api/chrisview')) {
      return NextResponse.next();
    }
    // /monday is the public Monday meeting slide deck (HTML presentation).
    // Same intentional-public-link pattern as /trip.
    if (pathname === '/monday' || pathname.startsWith('/monday/')) {
      return NextResponse.next();
    }
    // /division-leaders shows recruiter / division-leader override checks
    // pulled from QB 1099 memos. Same intentional-public-link pattern.
    if (pathname === '/division-leaders' || pathname.startsWith('/division-leaders/') || pathname.startsWith('/api/division-leaders')) {
      return NextResponse.next();
    }
    // /reps is the sales rep production & commission report (QB 1099 +
    // invoice-by-rep). Same intentional-public-link pattern; the route sends
    // X-Robots-Tag: noindex so it stays out of search results.
    if (pathname === '/reps' || pathname.startsWith('/reps/')) {
      return NextResponse.next();
    }
    // /repday3 is the final-day in-office sales training deck ("Close to
    // Referral"), served as a static HTML presentation. Same intentional
    // public-link pattern; the route sends X-Robots-Tag: noindex.
    if (pathname === '/repday3' || pathname.startsWith('/repday3/')) {
      return NextResponse.next();
    }
    // /calls is the office call recording portal — open link protected by its
    // OWN shared password (not portal login), so office staff can reach it
    // without a staff account. The page and its /api/calls/portal endpoints
    // enforce the password; the route sends X-Robots-Tag: noindex. Customer
    // PII lives behind the password gate, never public.
    if (pathname === '/calls' || pathname.startsWith('/calls/')) {
      return NextResponse.next();
    }

    // Everything else on rcrsal.com that's not portal → redirect to public site
    if (isPublicRoute(pathname)) {
      const redirectUrl = new URL(pathname + request.nextUrl.search, SITE_URL);
      return NextResponse.redirect(redirectUrl, 307);
    }

    // Unknown routes on portal domain → login
    return NextResponse.rewrite(new URL('/portal', request.url));
  }

  // ── Public domain: rivercityroofingsolutions.com ───────────────────────────

  if (isPublicDomain(hostname)) {
    // Allow public routes
    if (isPublicRoute(pathname)) {
      return NextResponse.next();
    }

    // Allow portal login + auth flow on the public domain so users can
    // sign in with either rcrsal.com or rivercityroofingsolutions.com.
    // Once authenticated, portal pages still work on both domains — but
    // rcrsal.com remains the canonical/bookmarked portal URL.
    if (pathname === '/portal' || pathname === '/portal/change-password' || pathname === '/portal/welcome') {
      return NextResponse.next();
    }

    // Authenticated portal routes on the public domain — redirect to rcrsal.com
    // so the URL bar shows the portal domain for bookmarking / sharing.
    if (isPortalRoute(pathname)) {
      const redirectUrl = new URL(pathname + request.nextUrl.search, PORTAL_URL);
      return NextResponse.redirect(redirectUrl, 307);
    }

    // Block known internal/debug routes
    const blockedPrefixes = ['/test-debug', '/secret-deals', '/report', '/dashboard', '/admin'];
    if (blockedPrefixes.some(p => pathname.startsWith(p))) {
      return NextResponse.rewrite(new URL('/not-found', request.url));
    }

    // For any other unrecognized route, let Next.js handle it (will 404 naturally)
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
     * - /ram/* (standalone public diagnostic page — bypass auth entirely)
     * - /mazda/* (standalone diagnostic page — bypass auth/redirects entirely)
     */
    '/((?!_next/static|_next/image|favicon\\.ico|ram(?:/|$)|mazda(?:/|$)).*)',
  ],
};
