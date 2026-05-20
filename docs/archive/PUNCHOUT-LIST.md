# RIVER CITY ROOFING SOLUTIONS - MASTER PUNCHOUT LIST
## Pre-Launch Checklist & Outstanding Items

**Generated:** February 6, 2026
**Last Updated:** February 9, 2026
**Overall Status:** NEARLY COMPLETE

---

## LEGEND
- [x] COMPLETED
- [ ] PENDING
- [!] NEEDS HUMAN ACTION (credentials, accounts, decisions)
- [B] BYPASS MODE (security with bypass for pre-user testing)

---

## PHASE 1: CRITICAL FIXES (COMPLETED)

### Security
- [x] Remove hardcoded admin fallback password (`admin123`)
- [x] Generate and set proper JWT_SECRET (128-char hex)
- [x] Set production ADMIN_PASSWORD
- [x] Remove test credentials from portal inventory page
- [x] Remove Google Maps API key from client code (switched to keyless embed)
- [x] Add AUTH_BYPASS_MODE env var for pre-user testing
- [x] Remove placehold.co from image remote patterns
- [x] Fix portal login bypass (was authenticating by email only, now requires PIN)
- [x] Add auth to ALL 100+ admin/portal/internal API routes (requireAuth/requireAdmin)
- [x] Remove team member enumeration from portal login Quick Login buttons

### Configuration
- [x] Configure Google Sheets credentials (service account, private key, sheet ID)
- [x] Configure Google Apps Script endpoint for form submissions
- [x] Configure Google Analytics ID (G-Y8PB85BZC5)
- [x] Set NEXT_PUBLIC_SITE_URL
- [x] Set NEXT_PUBLIC_BASE_URL
- [x] Set all company info env vars

### Content Fixes
- [x] Remove awards page and data directory
- [x] Fix "Madison, Madison" typo on Madison page
- [x] Standardize all email addresses to rcrs@rivercityroofingsolutions.com
- [x] Update privacy policy date to February 2026
- [x] Update terms of service date to February 2026
- [x] Fix duplicate customer reviews across location pages
- [x] Fix header form to actually submit to API (was only console.log)
- [x] Fix Team nav link (was causing unnecessary 301 redirect)
- [x] Remove dead hidden nav element from header
- [x] Standardize button colors to brand-green (remove hardcoded hex)
- [x] Delete empty .png file from uploads

---

## PHASE 2: HIGH PRIORITY (MOSTLY COMPLETE)

### Authentication & Security
- [x] Add `requireAuth()`/`requireAdmin()` to all admin/portal API routes (100+ routes covered)
- [x] Fix portal login - require PIN validation (was email-only auto-login)
- [x] Remove team member enumeration from portal login quick links
- [B] Implement admin auth bypass for testing phase
- [x] Fix horizontal privilege escalation in customer token routes (validateTokenOwnership in /api/customer/[token]; POST rejects body customerId)
- [ ] Add webhook signature validation for JobNimbus
- [x] Fix customer auth rate limit bypass (method switching) (shared authRateLimiter on POST and GET in /api/customer/auth)

### Portal/Admin Features
- [x] Fix admin settings save - now persists to JSON file via API
- [x] Fix admin dashboard placeholder stats (now uses real data counts)
- [x] Fix admin sales page (now fetches from real Google Sheets commission data)
- [x] Fix admin system status text (was misleading "Operational" message)
- [x] Fix admin approvals - reviewer name now from auth context (not hardcoded)
- [x] Fix settings page GA ID placeholder (was UA-XXXXXXXXX-X, now G-Y8PB85BZC5)
- [ ] Add delete functionality to inventory management
- [ ] Move training validation to server-side (currently sessionStorage)

### Error Handling
- [ ] Replace silent error swallowing with user-visible error states
- [ ] Standardize API error response format across all endpoints

---

## PHASE 3: MEDIUM PRIORITY

### SEO & Marketing
- [x] Add structured data schema to team page (JSON-LD) - CollectionPage + Breadcrumb
- [x] Add structured data schema to blog index page - CollectionPage + Breadcrumb
- [x] Add structured data schema to services index page - CollectionPage + Breadcrumb
- [x] Create reusable StructuredData component (components/StructuredData.tsx)
- [x] Refactor all pages to use StructuredData component (blog, team, services, locations)
- [x] Create architecture documentation (lib/ARCHITECTURE.md)
- [x] Verify sitemap generates correctly after awards page removal
- [x] All public pages have unique title, description, OG tags, canonical URLs
- [x] All blog posts have Article schema with author, datePublished, breadcrumbs
- [x] All team member pages have Person schema with worksFor, breadcrumbs
- [x] All service pages have Service schema with provider, areaServed, breadcrumbs
- [x] All location pages have LocalBusiness + FAQ + Breadcrumb schemas
- [x] Service area pages have metadata with canonical URLs and OG tags
- [ ] Add BNI page link to footer navigation
- [!] Set up Facebook Pixel (NEXT_PUBLIC_FB_PIXEL_ID)
- [!] Set up Google Ads tracking (NEXT_PUBLIC_GOOGLE_ADS_ID)

### Images & Performance
- [x] All public pages use next/image for optimization (30 files verified)
- [ ] Compress oversized blog images (some are 5-6MB)
- [ ] Replace AI-generated Picsart headshots with real team photos
- [ ] Verify hero video loads properly with fallback
- [ ] Fix 3 portal admin pages using raw `<img>` tags instead of next/image (admin/areas, admin/blog, admin/services)
- [!] Add real before/after gallery images (currently same images for both projects)
- [!] Add missing team member profile photos

### Integration Setup
- [!] Verify Google Sheets service account has edit access to spreadsheet
- [!] Verify JobNimbus API key is still valid
- [!] Test form submission end-to-end (contact form -> Sheets + email)
- [!] Configure GroupMe bot for team notifications (when ready)
- [!] Configure TeamUp calendar integration (when ready)

### Code Quality
- [ ] Fix remaining TODO/FIXME items in codebase
- [ ] Add input validation to all API routes (use zod schemas)
- [ ] Fix inconsistent date/timestamp handling
- [ ] Add request size limits to JSON parsing routes
- [ ] Fix race condition in duplicate lead prevention

---

## PHASE 4: FUTURE ENHANCEMENTS (POST-LAUNCH)

### Security Hardening
- [ ] Replace in-memory rate limiting with Redis
- [ ] Implement token blacklist for proper logout/revocation
- [ ] Add CORS headers explicitly to all API routes
- [ ] Move system config from filesystem to database
- [ ] Replace in-memory audit log with persistent storage
- [ ] Implement two-factor authentication for customers
- [ ] Add file magic number validation for uploads
- [ ] Set up Sentry or similar error tracking

### Multi-User System
- [ ] Move admin users from hardcoded to database
- [x] Role-based access control (RBAC) implemented via team-roles.ts + auth-context.tsx
- [ ] Add user creation/management endpoint
- [ ] Per-user audit logging
- [ ] Per-user notification preferences

### Integrations
- [!] Configure Twilio for SMS notifications
- [!] Configure SendGrid for email service
- [ ] Set up Google Business Profile integration
- [ ] Android Play Store preparation
- [ ] Apple App Store preparation (future)

### Features
- [x] Admin settings persistence (implemented via /api/admin/settings + JSON file)
- [x] Admin sales connected to real Google Sheets commission data
- [x] Admin dashboard stats connected to real data
- [ ] Add inventory audit trail
- [ ] Implement proper blog CMS
- [ ] Add customer two-factor auth

---

## CREDENTIALS & ACCOUNTS STATUS

| Service | Status | Action Needed |
|---------|--------|---------------|
| Vercel | CONFIGURED | Deployed and linked |
| Google Analytics | CONFIGURED | G-Y8PB85BZC5 active |
| Google Sheets | CONFIGURED | Verify sheet access |
| Google Apps Script | CONFIGURED | Test form endpoint |
| JobNimbus | CONFIGURED | Verify API key validity |
| Vercel Blob | CONFIGURED | Working |
| GitHub | CONFIGURED | Token active |
| GroupMe | NOT SET | Create bot when ready |
| TeamUp | NOT SET | Create account when ready |
| Twilio | NOT SET | Sign up when ready |
| SendGrid | NOT SET | Sign up when ready |
| Facebook Pixel | NOT SET | Get pixel ID from FB Ads |
| Google Ads | NOT SET | Get conversion ID |

---

## ENVIRONMENT VARIABLES CHECKLIST

### Set and Working
- [x] BLOB_READ_WRITE_TOKEN
- [x] GITHUB_TOKEN
- [x] JOBNIMBUS_API_KEY
- [x] JOBNIMBUS_API_URL
- [x] GOOGLE_SERVICE_ACCOUNT_EMAIL
- [x] GOOGLE_PRIVATE_KEY
- [x] GOOGLE_SHEETS_ID
- [x] NEXT_PUBLIC_GOOGLE_SCRIPT_ENDPOINT
- [x] ADMIN_PASSWORD
- [x] JWT_SECRET
- [x] AUTH_BYPASS_MODE
- [x] NEXT_PUBLIC_GA_ID
- [x] NEXT_PUBLIC_SITE_URL
- [x] NEXT_PUBLIC_BASE_URL
- [x] NEXT_PUBLIC_COMPANY_NAME
- [x] NEXT_PUBLIC_COMPANY_PHONE
- [x] NEXT_PUBLIC_COMPANY_LOCATION

### Not Yet Configured (On Punchout)
- [ ] GROUPME_BOT_ID
- [ ] GROUPME_ACCESS_TOKEN
- [ ] TEAMUP_API_KEY
- [ ] TEAMUP_CALENDAR_KEY
- [ ] NEXT_PUBLIC_FB_PIXEL_ID
- [ ] NEXT_PUBLIC_GOOGLE_ADS_ID
- [ ] TWILIO_ACCOUNT_SID
- [ ] TWILIO_AUTH_TOKEN
- [ ] SENDGRID_API_KEY

---

## BUILD STATUS
- [x] Production build passes without errors (304/304 pages generated)
- [x] All routes accessible
- [x] No broken imports
- [ ] Vercel deployment successful (deploy after final review)

---

## TESTING CHECKLIST (Run Before Launch)
- [ ] Home page loads correctly
- [ ] All navigation links work
- [ ] Contact form submits successfully
- [ ] Referral form submits successfully
- [ ] Admin login works with new password
- [ ] Portal login works with PIN
- [ ] Blog posts load
- [ ] Service pages load
- [ ] Location pages load
- [ ] Service area pages load
- [ ] Mobile responsive on real device
- [ ] Cookie consent appears
- [ ] Google Analytics tracking fires
- [ ] Sitemap.xml generates
- [ ] Robots.txt accessible
- [ ] 404 page works
- [ ] SSL certificate valid
- [ ] Domain resolves correctly
- [ ] www redirect works

---

## PORTAL AUDIT (February 9, 2026)

### Console.log Statements
Most portal pages use `console.error()` for error handling in catch blocks. This is acceptable for
development but should be replaced with proper error reporting (Sentry) before production.
- 80+ `console.error()` calls across portal pages (error handling in API fetch catch blocks)
- No `console.log()` calls found in portal pages (previously cleaned up)

### TODO/FIXME Items in Portal
- `portal/monday-notes/admin/page.tsx:463` - TODO: Generate slides (onClick handler is a no-op)
- `portal/sales/settings/page.tsx:44` - TODO: Get actual rep slug from auth context
- `portal/sales/customers/[id]/page.tsx:158` - TODO: Fetch customer from JobNimbus API

### Raw HTML `<img>` Tags (should use next/image)
- `portal/admin/areas/page.tsx:311` - Image preview in area editor
- `portal/admin/blog/page.tsx:441` - Image preview in blog editor
- `portal/admin/services/page.tsx:292` - Image preview in services editor

### Other Notes
- All placeholder/mock data from portal pages appears to have been removed in previous sessions
- Form input `placeholder` attributes are used correctly for UX hints (not mock data)
- No hardcoded test credentials found in portal pages
- `portal/admin/users/page.tsx` imports `DEFAULT_TEMP_PASSWORDS` - review if these contain sensitive data

---

## DOCUMENTATION STATUS
- [x] Architecture documentation created: `lib/ARCHITECTURE.md`
- [x] Punchout list updated with SEO, performance, and portal audit findings
- [x] SEO system documented in architecture doc
- [x] API route inventory documented (100+ routes categorized)
- [x] Portal page inventory documented (50+ pages with role assignments)
- [x] Google Sheets tab structure documented (17+ tabs)
- [x] External integrations documented

---

## NOTES
- AUTH_BYPASS_MODE=true is set - disable when real users onboard
- Admin password: Set in .env.local (not committed to git)
- All tokens should be rotated periodically (90-day cycle recommended)
- Google private key should be managed via Vercel secrets in production
- Portal login now requires PIN (PINs are in lib/team-roles.ts TEAM_MEMBERS array)
- 100+ API routes now have proper auth checks (requireAuth or requireAdmin)
