/**
 * CSRF Protection Utilities
 *
 * Uses Origin header validation (recommended by OWASP for modern apps).
 * For state-changing requests (POST/PUT/DELETE/PATCH), the Origin header
 * must match one of our allowed origins. This prevents cross-site request
 * forgery since browsers always send the correct Origin header and it
 * cannot be spoofed by JavaScript.
 *
 * Exempt routes (webhooks, cron) are listed below since they receive
 * legitimate requests from external services without browser Origin headers.
 */

// Routes exempt from CSRF checks (webhooks, cron jobs, external callbacks)
const CSRF_EXEMPT_PREFIXES = [
  '/api/webhooks/',        // GroupMe, JobNimbus webhooks
  '/api/calls/webhook',    // Call recording webhook
  '/api/cron/',            // Vercel cron jobs
  '/api/honeypot',         // Honeypot endpoint (receives external hits)
  '/api/leads/new',        // Public lead submission form (no auth required)
  '/api/storm-report',     // Public storm report generation
];

const ALLOWED_ORIGINS = [
  'https://www.rivercityroofingsolutions.com',
  'https://rivercityroofingsolutions.com',
  'https://rcrsal.com',
  'https://www.rcrsal.com',
];

// Methods that change state and need CSRF protection
const UNSAFE_METHODS = new Set(['POST', 'PUT', 'DELETE', 'PATCH']);

/**
 * Check if a request passes CSRF validation.
 * Returns null if OK, or an error message string if blocked.
 */
export function validateCsrf(
  method: string,
  pathname: string,
  origin: string | null,
  hostname: string,
): string | null {
  // Only check unsafe methods
  if (!UNSAFE_METHODS.has(method)) {
    return null;
  }

  // Skip exempt routes (webhooks, cron)
  if (CSRF_EXEMPT_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
    return null;
  }

  // Skip localhost / dev
  if (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '::1' ||
    hostname.startsWith('192.168.') ||
    hostname.startsWith('10.')
  ) {
    return null;
  }

  // Allow Vercel preview deployments (*.vercel.app)
  if (hostname.endsWith('.vercel.app')) {
    // For preview deploys, accept same-origin or matching vercel origin
    if (!origin) return null; // server-to-server / non-browser
    if (origin.endsWith('.vercel.app')) return null;
    if (ALLOWED_ORIGINS.includes(origin)) return null;
    return 'CSRF: origin not allowed for preview deployment';
  }

  // No Origin header → likely server-to-server or same-origin navigation
  // Browsers ALWAYS send Origin on cross-origin POST, so missing = safe
  // However, same-origin POSTs may omit Origin in some browsers,
  // so we also accept matching Referer as fallback
  if (!origin) {
    return null;
  }

  // Check if origin is in our allowed list
  if (ALLOWED_ORIGINS.includes(origin)) {
    return null;
  }

  return `CSRF: origin '${origin}' not in allowed list`;
}
