# Security Audit Report - River City Roofing Website

**Date:** February 5, 2026
**Auditor:** Security Specialist (Claude)
**Project:** C:\Users\Michael\river-city-roofing

---

## Executive Summary

This report documents the security vulnerabilities identified in the River City Roofing website and the fixes implemented to address them. The main issues involved exposed credentials, insecure session management, and lack of rate limiting on authentication endpoints.

---

## Vulnerabilities Identified

### 1. CRITICAL: Admin Password Exposed to Browser

**Severity:** Critical
**Location:** `app/admin/layout.tsx`

**Issue:**
```typescript
// INSECURE - Password exposed to browser via NEXT_PUBLIC_ prefix
const ADMIN_PASSWORD = process.env.NEXT_PUBLIC_ADMIN_PASSWORD || 'admin123';
```

The `NEXT_PUBLIC_` prefix in Next.js causes environment variables to be bundled into the client-side JavaScript, making the password visible to anyone who inspects the page source.

**Fix Implemented:**
- Moved password verification to server-side API (`/api/admin/auth`)
- Created new environment variable `ADMIN_PASSWORD` (without NEXT_PUBLIC_ prefix)
- Password is never sent to the browser

---

### 2. HIGH: Insecure Session Storage

**Severity:** High
**Location:** `lib/auth-context.tsx`, `app/admin/layout.tsx`

**Issue:**
```typescript
// INSECURE - Session stored in browser's sessionStorage
sessionStorage.setItem('admin_authenticated', 'true');
sessionStorage.setItem('portalUser', JSON.stringify(authUser));
```

Client-side sessionStorage is vulnerable to XSS attacks and can be easily manipulated through browser developer tools.

**Fix Implemented:**
- Created `lib/auth-service.ts` with JWT token generation
- Implemented httpOnly cookies for token storage
- Tokens include expiration and are cryptographically signed
- Cookies use `secure` flag in production and `sameSite: strict`

---

### 3. HIGH: No Rate Limiting on Auth Endpoints

**Severity:** High
**Location:**
- `app/api/portal/auth/route.ts`
- `app/api/customer/auth/route.ts`
- `app/admin/layout.tsx` (client-side auth)

**Issue:**
No protection against brute force attacks. An attacker could make unlimited login attempts to guess passwords or PINs.

**Fix Implemented:**
- Created `lib/rate-limiter.ts` with configurable rate limiting
- Auth endpoints limited to 5 attempts per 15 minutes per IP
- Automatic 30-minute lockout after exceeding limit
- Rate limit headers included in responses (X-RateLimit-Limit, X-RateLimit-Remaining)
- Created `/api/admin/auth` endpoint with rate limiting

---

### 4. MEDIUM: Weak PIN Authentication

**Severity:** Medium
**Location:** `lib/portal-auth.ts`, `lib/team-roles.ts`

**Issue:**
4-digit PINs have only 10,000 possible combinations, making them vulnerable to brute force even with rate limiting.

**Existing Mitigations Found:**
- Account lockout after 5 failed attempts (30 min)
- Failed attempt logging
- Temporary passcode option for higher security

**Additional Fixes Implemented:**
- Rate limiting on PIN login endpoint
- IP-based tracking for failed attempts
- Enhanced logging of failed login attempts
- Option for 6-digit PINs added to auth service

**Recommendations for Future:**
- Consider implementing 2FA for sensitive operations
- Add SMS/email verification for password resets
- Implement hardware token support for admin access

---

### 5. MEDIUM: Hardcoded Team Member PINs

**Severity:** Medium
**Location:** `lib/team-roles.ts`

**Issue:**
Team member PINs are hardcoded in source code:
```typescript
{
  id: 'RVR-135',
  name: 'Michael Muse',
  pin: '1135', // Exposed in code
  ...
}
```

**Recommendation:**
- Move PIN storage to database or secure configuration
- Hash PINs before storage
- The `lib/auth-service.ts` includes PIN hashing utilities for future use

---

### 6. LOW: Missing Security Headers

**Severity:** Low
**Location:** All API routes

**Fix Implemented:**
Added security headers to all auth responses via `getSecurityHeaders()`:
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `X-XSS-Protection: 1; mode=block`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy: camera=(), microphone=(), geolocation=()`

---

## Files Created/Modified

### New Files Created

1. **`lib/auth-service.ts`**
   - JWT token generation and validation
   - Secure cookie management
   - Rate limiting for auth endpoints
   - PIN hashing utilities
   - Session validation functions

2. **`lib/rate-limiter.ts`**
   - Sliding window rate limiting
   - Configurable limits per endpoint type
   - Rate limit header generation
   - Middleware helper function

3. **`app/api/admin/auth/route.ts`**
   - Secure admin authentication endpoint
   - Password verification server-side
   - JWT token issuance
   - Rate limiting integration

4. **`SECURITY-AUDIT-REPORT.md`**
   - This document

### Files Modified

1. **`app/admin/layout.tsx`**
   - Removed client-side password comparison
   - Added API-based authentication
   - Added rate limit feedback to users
   - Added session validation on mount

2. **`app/api/portal/auth/route.ts`**
   - Added rate limiting
   - Added JWT token generation
   - Added secure cookie management
   - Added security headers

3. **`app/api/customer/auth/route.ts`**
   - Added rate limiting
   - Added JWT token generation
   - Added secure cookie management
   - Added security headers

4. **`.env.local.example`**
   - Added JWT_SECRET variable
   - Added AUTH_SECRET variable
   - Added ADMIN_PASSWORD (server-side only)
   - Removed NEXT_PUBLIC_ADMIN_PASSWORD
   - Added security documentation

---

## Environment Variables Required

Add these to your `.env.local` and Vercel environment:

```bash
# REQUIRED for production security
JWT_SECRET=<generate-with: openssl rand -base64 32>
AUTH_SECRET=<same-or-different-secret>
ADMIN_PASSWORD=<strong-admin-password>
```

**Important:** These must NOT have the `NEXT_PUBLIC_` prefix.

---

## Testing Recommendations

### Manual Testing

1. **Rate Limiting Test**
   - Attempt 6+ failed logins in 15 minutes
   - Verify lockout message appears
   - Verify 30-minute lockout is enforced

2. **Session Security Test**
   - Login successfully
   - Open browser dev tools
   - Verify no sensitive data in localStorage/sessionStorage
   - Verify cookies are httpOnly (not accessible via JS)

3. **Password Exposure Test**
   - View page source in browser
   - Search for "admin123" or password values
   - Verify passwords are not in client bundle

### Automated Testing

```bash
# Test rate limiting
for i in {1..10}; do
  curl -X POST http://localhost:3000/api/admin/auth \
    -H "Content-Type: application/json" \
    -d '{"action":"login","password":"wrong"}' \
    -w "\nStatus: %{http_code}\n"
done
```

---

## Deployment Checklist

- [ ] Set `JWT_SECRET` environment variable in Vercel
- [ ] Set `AUTH_SECRET` environment variable in Vercel
- [ ] Set `ADMIN_PASSWORD` environment variable in Vercel
- [ ] Remove `NEXT_PUBLIC_ADMIN_PASSWORD` from Vercel if present
- [ ] Redeploy the application
- [ ] Test login functionality in production
- [ ] Verify rate limiting works in production
- [ ] Monitor for unusual login patterns

---

## Future Security Improvements

1. **Two-Factor Authentication (2FA)**
   - Add TOTP support for admin accounts
   - SMS verification for sensitive operations

2. **Database-Backed Sessions**
   - Store sessions in database for revocation capability
   - Track active sessions per user

3. **Audit Logging Enhancement**
   - Log all authentication events to external service
   - Set up alerts for suspicious patterns

4. **Content Security Policy**
   - Implement strict CSP headers
   - Add to Next.js middleware

5. **API Key Rotation**
   - Implement automatic key rotation
   - Add key expiration alerts

6. **Penetration Testing**
   - Conduct professional security audit
   - Regular vulnerability scanning

---

## Conclusion

The critical security vulnerabilities have been addressed. The admin password is no longer exposed to the browser, authentication now uses secure JWT tokens in httpOnly cookies, and rate limiting protects against brute force attacks.

For production deployment, ensure all environment variables are properly configured in Vercel and the old `NEXT_PUBLIC_ADMIN_PASSWORD` variable is removed.

---

*Report generated by Security Specialist*
