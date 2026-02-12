/**
 * Customer Authentication API
 *
 * Secure authentication endpoint for customer portal with:
 * - Rate limiting
 * - Failed attempt tracking
 * - JWT token generation
 * - httpOnly cookie sessions
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  generateAccessToken,
  generateRefreshToken,
  setAuthCookies,
  clearAuthCookies,
  validateSession,
  checkRateLimit,
  recordLoginAttempt,
  getClientIP,
  getSecurityHeaders,
  AuthUser,
} from '@/lib/auth-service';
import { createAuthRateLimiter, withRateLimit } from '@/lib/rate-limiter';

const JOBNIMBUS_API_KEY = process.env.JOBNIMBUS_API_KEY;
const JOBNIMBUS_API_URL = process.env.JOBNIMBUS_API_URL || 'https://app.jobnimbus.com/api1';

const authRateLimiter = createAuthRateLimiter();

interface JobNimbusContact {
  jnid: string;
  first_name?: string;
  last_name?: string;
  display_name?: string;
  email?: string;
  home_phone?: string;
  mobile_phone?: string;
  work_phone?: string;
  address_line1?: string;
  city?: string;
  state_text?: string;
  zip?: string;
}

function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, '');
}

function getContactName(contact: JobNimbusContact): string {
  if (contact.display_name) return contact.display_name;
  return `${contact.first_name || ''} ${contact.last_name || ''}`.trim() || 'Customer';
}

function getContactPhone(contact: JobNimbusContact): string {
  return contact.mobile_phone || contact.home_phone || contact.work_phone || '';
}

function formatAddress(contact: JobNimbusContact): string {
  const parts = [
    contact.address_line1,
    contact.city,
    contact.state_text,
    contact.zip,
  ].filter(Boolean);
  return parts.join(', ') || '';
}

export async function POST(request: NextRequest) {
  return withRateLimit(request, authRateLimiter, async () => {
    try {
      const body = await request.json();
      const { action, method, email, phone, accessCode } = body;
      const clientIP = getClientIP(request);

      // Handle logout action
      if (action === 'logout') {
        await clearAuthCookies();
        return NextResponse.json(
          { success: true },
          { headers: getSecurityHeaders() }
        );
      }

      // Handle validate action
      if (action === 'validate') {
        const sessionResult = await validateSession();
        if (!sessionResult.valid) {
          return NextResponse.json(
            { success: false, error: sessionResult.error },
            { status: 401, headers: getSecurityHeaders() }
          );
        }
        return NextResponse.json(
          { success: true, user: sessionResult.user },
          { headers: getSecurityHeaders() }
        );
      }

      // Require API key - no demo mode
      if (!JOBNIMBUS_API_KEY) {
        return NextResponse.json(
          {
            success: false,
            error: 'Customer portal is not configured',
            message: 'Please contact River City Roofing at 256-274-8530 for assistance.'
          },
          { status: 500, headers: getSecurityHeaders() }
        );
      }

      // Create identifier based on login method
      let identifier = `customer:${clientIP}`;
      if (method === 'email' && email) {
        identifier = `customer:${clientIP}:email:${email}`;
      } else if (method === 'phone' && phone) {
        identifier = `customer:${clientIP}:phone:${normalizePhone(phone)}`;
      } else if (method === 'code' && accessCode) {
        identifier = `customer:${clientIP}:code`;
      }

      // Check rate limit
      const rateLimitCheck = checkRateLimit(identifier);
      if (!rateLimitCheck.allowed) {
        return NextResponse.json(
          {
            success: false,
            error: `Too many login attempts. Please try again in ${rateLimitCheck.lockoutMinutes} minutes.`,
            remainingAttempts: 0,
          },
          {
            status: 429,
            headers: getSecurityHeaders(),
          }
        );
      }

      // Validate input
      if (method === 'email' && !email) {
        return NextResponse.json(
          { success: false, error: 'Email address is required' },
          { status: 400, headers: getSecurityHeaders() }
        );
      } else if (method === 'phone' && !phone) {
        return NextResponse.json(
          { success: false, error: 'Phone number is required' },
          { status: 400, headers: getSecurityHeaders() }
        );
      } else if (!['email', 'phone', 'code'].includes(method)) {
        return NextResponse.json(
          { success: false, error: 'Invalid login method' },
          { status: 400, headers: getSecurityHeaders() }
        );
      }

      // Fetch contacts from JobNimbus and filter client-side
      // The JobNimbus API doesn't support field-level filtering via query params
      const response = await fetch(`${JOBNIMBUS_API_URL}/contacts?limit=500`, {
        headers: {
          'Authorization': `Bearer ${JOBNIMBUS_API_KEY}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        console.error('JobNimbus API error:', response.status);
        recordLoginAttempt(identifier, false);
        const newCheck = checkRateLimit(identifier);

        return NextResponse.json(
          {
            success: false,
            error: 'Unable to verify account',
            remainingAttempts: newCheck.remainingAttempts,
          },
          { status: 500, headers: getSecurityHeaders() }
        );
      }

      const data = await response.json();
      const allContacts = data.results || [];

      // Filter contacts based on method
      let contacts: JobNimbusContact[] = [];
      if (method === 'email' && email) {
        const emailLower = email.toLowerCase();
        contacts = allContacts.filter((c: JobNimbusContact) =>
          c.email?.toLowerCase() === emailLower
        );
      } else if (method === 'phone' && phone) {
        const normalizedPhone = normalizePhone(phone);
        contacts = allContacts.filter((c: JobNimbusContact) => {
          const mobileNorm = c.mobile_phone ? normalizePhone(c.mobile_phone) : '';
          const homeNorm = c.home_phone ? normalizePhone(c.home_phone) : '';
          const workNorm = c.work_phone ? normalizePhone(c.work_phone) : '';
          return mobileNorm === normalizedPhone ||
                 homeNorm === normalizedPhone ||
                 workNorm === normalizedPhone ||
                 mobileNorm.endsWith(normalizedPhone) ||
                 homeNorm.endsWith(normalizedPhone) ||
                 workNorm.endsWith(normalizedPhone);
        });
      } else if (method === 'code' && accessCode) {
        // Access code lookup - would need custom field support
        contacts = allContacts.filter((c: Record<string, unknown>) =>
          c.customer_portal_code === accessCode
        );
      }

      if (contacts.length === 0) {
        recordLoginAttempt(identifier, false);
        const newCheck = checkRateLimit(identifier);

        return NextResponse.json(
          {
            success: false,
            error: 'Account not found. Please check your information or call us at 256-274-8530.',
            remainingAttempts: newCheck.remainingAttempts,
          },
          { headers: getSecurityHeaders() }
        );
      }

      // Successful login
      recordLoginAttempt(identifier, true);
      const contact = contacts[0] as JobNimbusContact;

      // Generate JWT tokens for customer
      const customerUser: AuthUser = {
        userId: contact.jnid,
        name: getContactName(contact),
        email: contact.email || '',
        role: 'customer',
        permissions: ['view_own_jobs', 'upload_documents', 'view_invoices', 'send_messages'],
      };

      const accessToken = generateAccessToken(customerUser);
      const refreshToken = generateRefreshToken(customerUser);
      await setAuthCookies(accessToken, refreshToken);

      return NextResponse.json(
        {
          success: true,
          customer: {
            jnid: contact.jnid,
            name: getContactName(contact),
            email: contact.email || '',
            phone: getContactPhone(contact),
            address: formatAddress(contact),
          },
        },
        { headers: getSecurityHeaders() }
      );
    } catch (error) {
      console.error('Customer auth error:', error);
      return NextResponse.json(
        { success: false, error: 'Server error' },
        { status: 500, headers: getSecurityHeaders() }
      );
    }
  });
}

// SECURITY: Rate limit GET requests with the same rate limiter as POST.
// This prevents attackers from bypassing rate limits by switching HTTP methods.
// The rate limiter key uses IP + path (no method), so limits are shared across
// GET and POST for the same endpoint.
export async function GET(request: NextRequest) {
  return withRateLimit(request, authRateLimiter, async () => {
    // Validate session endpoint
    try {
      const sessionResult = await validateSession();

      if (!sessionResult.valid) {
        return NextResponse.json(
          { authenticated: false },
          { status: 401, headers: getSecurityHeaders() }
        );
      }

      return NextResponse.json(
        {
          authenticated: true,
          customer: sessionResult.user,
        },
        { headers: getSecurityHeaders() }
      );
    } catch (error) {
      return NextResponse.json(
        { authenticated: false, error: 'Server error' },
        { status: 500, headers: getSecurityHeaders() }
      );
    }
  });
}
