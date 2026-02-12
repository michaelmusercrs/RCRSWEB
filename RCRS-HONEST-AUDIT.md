# RCRS HONEST SYSTEM AUDIT
## Date: February 8, 2026
## Purpose: Full truth about what works, what's fake, and what's missing

---

# EXECUTIVE SUMMARY

| Category | Count | % |
|----------|-------|---|
| **REAL** (working with real data) | ~35 pages, ~38 API routes | ~30% |
| **PARTIAL** (some real, some fake/incomplete) | ~10 pages, ~42 API routes | ~35% |
| **MOCK/FAKE** (hardcoded numbers, Math.random) | ~6 pages, ~10 API routes | ~10% |
| **EMPTY SHELL** (UI only, no logic) | ~5 pages, ~24 API routes | ~20% |
| **DOES NOT EXIST** | Home show signup, compensation tiers, vacation tiers, gas cards | Critical gaps |

**Bottom line: About 30% of the system actually works with real data. The rest is varying degrees of incomplete.**

---

# SECTION 1: WHAT ACTUALLY WORKS (REAL DATA, REAL LOGIC)

## 1.1 Public Website (FULLY WORKING)
These pages are static content - no data backend needed, they work 100%:
- **Homepage** (`app/page.tsx`) - Hero, services, contact form
- **About** (`app/about/page.tsx`) - Company info
- **Services** (`app/services/page.tsx` + `app/services/[slug]/page.tsx`) - All service pages
- **Service Areas** (`app/service-areas/page.tsx` + `[slug]`) - Location pages
- **Blog** (`app/blog/page.tsx` + `[slug]`) - Blog posts from `blogData.ts`
- **Contact** (`app/contact/`) - Form submits to Google Apps Script -> Sheets
- **Referral Rewards** (`app/referral-rewards/page.tsx`) - Static info
- **Team** (`app/team/page.tsx` + `[slug]`) - From `teamData.ts`
- **Locations** (Huntsville, Decatur, Madison) - Static content
- **BNI, Terms, Privacy, Not Found** - Static pages
- **Data source**: `blogData.ts`, `servicesData.ts`, `teamData.ts`, `reviewsData.ts` - all hardcoded TS arrays (fine for static content)

## 1.2 Contact/Referral Forms (WORKING)
- **Contact form** -> Google Apps Script -> Google Sheets + email notification
- **Referral form** -> Same pipeline
- **Header form** -> `/api/forms/contact` -> Google Sheets
- **Data stores to**: Google Sheets via Apps Script endpoint

## 1.3 Commission Data (REAL - READ ONLY)
- **Source**: `data/commissions.json` - 25,000+ lines of REAL historical commission records
- **Format**: `{salesRep, date, amount, balance}` per entry
- **API**: `/api/command-center/meetings/stats` - Reads this data, calculates weekly/monthly/YTD totals, per-rep stats, period-over-period comparisons, goal progress
- **API**: `/api/command-center/meetings/leaderboard` - Rankings, achievements, streaks, celebration triggers
- **API**: `/api/sheets/commissions` - Google Sheets CRUD for commissions (separate from static JSON)
- **STATUS**: Reading works perfectly. The static JSON file is a snapshot - new entries go to Google Sheets via the commissions API. **The two data sources are NOT connected to each other.**

## 1.4 Monday Meeting Presentation (MOSTLY WORKING)
- **Meeting prep** (`app/command-center/meetings/prep/page.tsx`) - Bible verse, announcements, employee of month
- **Presentation mode** (`app/command-center/meetings/present/page.tsx`) - Full-screen 18-slide presentation with real commission data
- **Meeting data** (`lib/meeting-data.ts`) - Slide definitions, bible verses, date calculations
- **Data source**: Commission data from `data/commissions.json` for leaderboard/stats slides
- **LIMITATION**: Monday meeting notes (`portal/monday-notes/`) store to Vercel Blob - works on deployed site but NOT local

## 1.5 JobNimbus CRM Integration (WORKING)
- **Service**: `lib/jobnimbus-service.ts` - Full REST API client
- **Functions**: Get contacts, jobs, estimates, tasks, notes, attachments, invoices, search by email/phone
- **API routes**: `/api/jobnimbus/*`, `/api/portal/jobnimbus/*`
- **Auth**: Uses `JOBNIMBUS_API_KEY` env var
- **STATUS**: All CRUD operations work when API key is set. **Requires valid API key in .env.local**

## 1.6 Google Sheets Backend (WORKING for configured sheets)
- **Service**: `lib/google-sheets-service.ts` - Main Sheets service
- **Sheets used**: Commissions, Team Members, Jobs_Master, Billing_Records, Vendor_Purchases, Approval_Requests, Delivery data
- **Auth**: Google Service Account (email + private key in env vars)
- **STATUS**: Works when Google Sheets credentials are configured. **Requires 3 env vars**

## 1.7 Portal Authentication (WORKING with caveats)
- **Service**: `lib/auth-service.ts` - JWT-based auth with `requireAdmin()` and `requireAuth()`
- **Portal auth**: `lib/portal-auth-service.ts` - PIN + email login backed by Google Sheets
- **CAVEAT**: Team member list has hardcoded `TEAM_MEMBERS` array as fallback. Real data should come from Sheets.

## 1.8 Customer Portal Auth (WORKING)
- **Token-based**: Customer gets unique URL with token
- **Service**: `lib/customer-portal-service.ts` - Token validation, customer data fetch from JN
- **Generates**: QR codes, unique portal links per customer

---

# SECTION 2: WHAT'S PARTIALLY WORKING

## 2.1 Financial Service (`lib/financial-service.ts`)
- **REAL**: `getJobsData()` reads from Google Sheets `Jobs_Master`
- **REAL**: `getInvoicesData()` reads from Google Sheets `Billing_Records`
- **REAL**: `getExpensesData()` reads from Google Sheets `Vendor_Purchases`
- **REAL**: `getFinancialSummary()` calculates revenue, costs, profit, AR/AP from sheet data
- **REAL**: Approval workflow (create, review, list) backed by Google Sheets
- **FAKE**: `getBudgetData()` returns HARDCODED mock: `[{Materials: 50000}, {Labor: 30000}, ...]`
- **MISSING**: `laborCost` always returns 0, `overheadCost` always returns 0, `commission` always returns 0
- **MISSING**: Year-over-year growth is hardcoded to 0

## 2.2 Unified Data Service (`lib/unified-data-service.ts`)
- **REAL**: JobNimbus stats (contacts, jobs, estimates, tasks) when API key configured
- **REAL**: Inventory product counts from `inventoryData.ts`
- **REAL**: Team data from `teamData.ts`
- **FAKE**: Sales figures use placeholder math: `Math.floor(45000 - (idx * 7000))`
- **FAKE**: "Recent activity" items are generated, not from real events

## 2.3 Order/Delivery Workflow
- **REAL**: `lib/order-workflow-service.ts` (1365 lines) - Full CRUD with Google Sheets
- **REAL**: `lib/delivery-workflow-service.ts` (1556 lines) - Delivery ticket management with Sheets
- **REAL**: `lib/material-job-flow.ts` (523 lines) - Stage definitions and transitions
- **PARTIAL**: 3 overlapping services that aren't wired together consistently
- **MISSING**: No actual driver mobile app/GPS tracking
- **MISSING**: Photo upload flow exists in types but capture/storage is incomplete
- **MISSING**: Signature capture not implemented (just types defined)

## 2.4 Portal Dashboard (`app/portal/dashboard/page.tsx`)
- **REAL**: Fetches from `/api/portal/dashboard` which pulls JN data
- **PARTIAL**: Some dashboard cards show real JN data, others show hardcoded fallback numbers

## 2.5 Admin Pages
- **`app/admin/page.tsx`** - REAL auth check, shows system status
- **`app/admin/sales/page.tsx`** - Uses commission data + JN data, but sales overview metrics are partially hardcoded
- **`app/admin/settings/page.tsx`** - UI exists but most save buttons are non-functional

---

# SECTION 3: WHAT'S COMPLETELY FAKE

## 3.1 Reports Service (`lib/reports-service.ts`) - 100% MOCK
Every single method returns hardcoded fake data:
- `generateDeliveryReport()` → Fixed numbers: 156 deliveries, $287,450 value
- `generateBillingReport()` → Fixed: $425,680 invoiced, $389,450 paid
- `generateInventoryReport()` → Fixed: 124 products, $89,450 value
- `generateTeamPerformanceReport()` → Fixed: Rick 82 deliveries, Tae 74
- `generateJobFlowReport()` → Fixed stage times and alert counts
- **Helper methods use `Math.random()`** for "daily" and "monthly" data points
- **This means**: Any page that shows report charts/graphs is displaying random numbers

## 3.2 Portal Reports Page (`app/portal/reports/page.tsx`)
- Calls the reports service above
- Every chart and number on this page is fabricated

## 3.3 Portal Sales Sub-Portal
- **`app/portal/sales/page.tsx`** - Empty shell, no working logic
- **`app/portal/sales/performance/page.tsx`** - Hardcoded rep names and numbers
- **`app/portal/sales/leads/page.tsx`** - Empty scaffold
- **`app/portal/sales/customers/[id]/page.tsx`** - Empty scaffold

## 3.4 Inventory Data (`lib/inventoryData.ts`)
- Hardcoded TypeScript array of ~11 products with real costs/prices from supplier PDF
- **`inventoryTransactions.ts` has 1,660 REAL transactions imported from Items.xlsx** - but baked into JS bundle, not live-syncing
- `materialOrders.ts` - Sample order records, not real live data
- Not connected to any real-time inventory system or supplier

## 3.5 Command Center Inventory (`app/command-center/inventory/`)
- Reads from hardcoded `inventoryData.ts`
- Stock adjustments are in-memory only (lost on page refresh)

## 3.6 Marketing Pages
- **`app/command-center/marketing/page.tsx`** - Hardcoded campaign data
- **`app/command-center/marketing/emails/page.tsx`** - Mock email templates
- **`app/command-center/marketing/ads/page.tsx`** - Mock ad campaigns
- **`app/command-center/marketing/calendar/page.tsx`** - Mock calendar
- **Data source**: `lib/marketing-data.ts` - All hardcoded arrays

## 3.7 Phone System Pages
- **`app/command-center/phone/page.tsx`** - Mock phone system dashboard
- **`app/command-center/phone/calls/page.tsx`** - Mock call logs
- **Data source**: `lib/phone-data.ts` - Hardcoded extension/call arrays
- **`lib/calls-service.ts`** - Has mock data pattern

## 3.8 Training Content
- **`app/portal/admin/training/page.tsx`** - Hardcoded training modules
- **`components/TrainingPopup.tsx`** - Hardcoded content, not imported anywhere
- **`components/RoleTrainingPopup.tsx`** - Hardcoded, not imported anywhere
- **`lib/training-context.tsx`** - Training provider exists but content is all static

---

# SECTION 4: WHAT DOES NOT EXIST AT ALL

| Feature | Status | Notes |
|---------|--------|-------|
| **Home Show Signup** | DOES NOT EXIST | Zero code, zero references anywhere in codebase |
| **Compensation Tiers** | DOES NOT EXIST | No tiered compensation structure defined |
| **Tiered Vacation** | DOES NOT EXIST | No vacation tracking or tier system |
| **Gas Card Details** | DOES NOT EXIST | No gas card tracking or management |
| **Estimated vs Real Numbers Comparison** | DOES NOT EXIST | Budget data is hardcoded mock; no "Monday estimated" vs "real" comparison |
| **Charts with Real Source Data** | PARTIAL | Commission leaderboard uses real data; ALL other charts use fake/random data |
| **Employee Benefits Tracking** | DOES NOT EXIST | No benefits management system |
| **Time Tracking / Clock-in** | DOES NOT EXIST | No time tracking system |
| **GPS/Route Tracking** | DOES NOT EXIST | Types defined but no implementation |
| **Photo Capture (Delivery Proof)** | DOES NOT EXIST | Interface defined, no upload/capture logic |
| **Signature Capture** | DOES NOT EXIST | Type defined, no implementation |
| **Real Notification System** | PARTIAL | GroupMe bot for team alerts exists; no SMS/email notification system |
| **Webhook Processing** | SHELL ONLY | `/api/webhooks/jobnimbus` exists but logic is minimal |

---

# SECTION 5: CRITICAL INFRASTRUCTURE ISSUES

## 5.1 Local JSON Files as "Database" (WILL BREAK ON VERCEL)
These files are used as data stores but Vercel's serverless functions have **read-only filesystem**:
| File | Used By | Problem |
|------|---------|---------|
| `data/commissions.json` | Meeting stats, leaderboard | READ-ONLY is fine, but can't append new entries |
| `data/locations.json` | Service areas | Read-only, fine |
| `data/tasks.json` | Task management | **WILL LOSE WRITES** |
| Various `data/*.json` | Multiple routes | Need audit per file |

## 5.2 In-Memory Storage (DATA LOST ON EVERY COLD START)
Several API routes use JavaScript Maps/arrays to store data. On Vercel, each request can be a fresh instance:
- Inventory stock adjustments
- Notification read status
- Session tracking
- Any route using `const dataStore = new Map()` at module level

## 5.3 Security Holes - CRITICAL
- **PLAINTEXT PASSWORDS in `lib/portalUsers.ts`**: 10 user accounts with passwords like `Admin2024!`, `Manager2024!`, `SuperAdmin2024!` stored as plain strings. Login validates with direct string comparison.
- **PINs HARDCODED in `lib/team-roles.ts`**: Every team member's 4-digit PIN is in the source code (e.g., Michael = `1135`, Chris = `1138`). This is in the Git repo.
- **Real PII in source code**: `lib/employeeDirectory.ts` and `lib/teamData.ts` contain real employee names, personal phone numbers, emails, and Google Drive photo links - all committed to Git.
- `/api/customer/dashboard` - **ZERO auth check**
- `/api/customer/messages` - **ZERO auth check**
- Several POST endpoints accept data, return `{success: true}`, but don't persist anything
- Portal login has hardcoded `TEAM_MEMBERS` fallback

## 5.4 Massive Bundle Bloat
- `lib/inventoryTransactions.ts` - **1,660 real transactions imported from Items.xlsx** baked into JS bundle (should be in Sheets)
- `lib/blogData.ts` - **68 full blog posts** with all content in the JS bundle
- `lib/employeeDirectory.ts` - **28 employee records** with PII in bundle
- Duplicate services: `qr-generator.ts` AND `qrcode-service.ts` both generate QR codes
- Duplicate blog data: `newBlogPosts.ts` has 3 posts that were never merged into `blogData.ts`

## 5.5 Orphaned Components (Built but Never Imported)
- `AdminLayout.tsx` - Not used
- `CallHistory.tsx` - Not used
- `CustomerCallHistory.tsx` - Not used
- `RoleTrainingPopup.tsx` - Not used
- `TrainingPopup.tsx` - Not used
- `ScrollReveal.tsx` - Not used
- `ViewCounter.tsx` - Not used
- `VideoEmbed.tsx` - Not used
- `WideImage.tsx` - Not used

---

# SECTION 6: SPECIFIC ANSWERS TO YOUR QUESTIONS

## Q: "Sales and commission numbers need updated and confirmed by Michael or Sara"
**A**: Commission data in `data/commissions.json` is REAL historical data (25K+ records). The meeting leaderboard and stats APIs process this data correctly. HOWEVER:
- This is a **static snapshot** - new commissions entered via the Google Sheets API (`/api/sheets/commissions`) go to a DIFFERENT location
- The two data sources are NOT merged
- **ACTION NEEDED**: Michael/Sara need to verify the JSON data is current and decide whether to keep using it or migrate everything to Google Sheets

## Q: "Home show signup"
**A**: **Does not exist.** Zero code, zero UI, zero backend. Needs to be built from scratch.

## Q: "Compensation tiers, tiered vacation, gas card details"
**A**: **None of these exist.** The only "tiers" in the codebase are material pricing tiers in `billingPricing.ts` (contractor discount, commercial markup, etc.). No employee compensation, vacation, or gas card systems.

## Q: "Charts and graphs need to reference source data"
**A**: These charts use REAL data:
- Monday meeting presentation (leaderboard, stats) - from `data/commissions.json`
- Admin Sales page (`/admin/sales`) - recharts BarChart + PieChart pulling from Google Sheets commission data via `/api/command-center/sales`

These charts use FAKE data:
- Reports pages - `Math.random()` generated values from `reports-service.ts`
- Command center dashboard - placeholder sales formulas like `Math.floor(45000 - (idx * 7000))`
- Financial reports - budget data hardcoded

## Q: "Monday estimated numbers vs real numbers comparison"
**A**: **Does not exist.** The budget data in `financial-service.ts` is hardcoded: `{Materials: 50000, Labor: 30000, ...}`. There is no system to input estimated/projected numbers and compare them against actuals.

## Q: "Where does data come from and store?"
**Answer by system:**

| System | Data Source | Storage | Status |
|--------|-----------|---------|--------|
| **Commission leaderboard** | `data/commissions.json` (static file) | Read-only JSON | REAL but frozen |
| **Commission CRUD** | Google Sheets | Google Sheets | REAL |
| **Jobs/Contacts/Estimates** | JobNimbus API | JobNimbus cloud | REAL (needs API key) |
| **Job sync** | JN -> Google Sheets `Jobs_Master` | Google Sheets | REAL |
| **Financial summaries** | Google Sheets (Jobs_Master, Billing_Records, Vendor_Purchases) | Google Sheets | REAL (except budget) |
| **Budget vs Actual** | Hardcoded mock | None | FAKE |
| **Delivery workflow** | Google Sheets | Google Sheets | REAL (service exists) |
| **Inventory products** | `inventoryData.ts` (11 items from supplier PDF) | Hardcoded | REAL DATA, static |
| **Inventory transactions** | `inventoryTransactions.ts` (1,660 records from Items.xlsx) | Hardcoded | REAL DATA, static |
| **Reports** | `reports-service.ts` mock data | None | 100% FAKE |
| **Marketing** | `marketing-data.ts` hardcoded | None | FAKE |
| **Phone/Calls** | `phone-data.ts` hardcoded | None | FAKE |
| **Training** | Hardcoded components | None | FAKE |
| **Monday notes** | Vercel Blob | Vercel Blob | REAL (deployed only) |
| **Profile images** | Vercel Blob | Vercel Blob | REAL (deployed only) |
| **Contact forms** | Google Apps Script | Google Sheets | REAL |
| **Team data** | `teamData.ts` hardcoded + Google Sheets | Hybrid | PARTIAL |

---

# SECTION 7: PRIORITY FIX LIST (For Delegation)

## TIER 1: Critical for Meeting Tomorrow
These are the features you specifically asked about:

| # | Task | What's Needed | Who Could Do It |
|---|------|---------------|-----------------|
| 1 | **Verify commission data is current** | Compare `data/commissions.json` entries against actual records. Are recent commissions missing? | Michael or Sara |
| 2 | **Home show signup page** | Design what info to collect, build form + backend | Developer |
| 3 | **Compensation tiers document** | Define the actual tier structure, vacation policy, gas card rules | Michael (business decision) |
| 4 | **Budget/estimated numbers** | Provide real budget figures to replace hardcoded mock data | Michael/Sara (finance data) |

## TIER 2: System Integrity
| # | Task | What's Needed |
|---|------|---------------|
| 5 | Fix reports service - connect to Google Sheets instead of mock data |
| 6 | Fix financial service budget data - create Budget sheet in Google Sheets |
| 7 | Fix unified data service sales placeholders |
| 8 | Add auth to `/api/customer/dashboard` and `/api/customer/messages` |
| 9 | Move inventory from hardcoded arrays to Google Sheets |
| 10 | Merge commission JSON with Google Sheets commission data |

## TIER 3: Feature Completion
| # | Task | What's Needed |
|---|------|---------------|
| 11 | Sales portal (leads, performance, customer detail) - currently empty shells |
| 12 | Build compensation/benefits tracking system |
| 13 | Build estimated vs actual comparison for Monday meetings |
| 14 | Connect charts to real data sources |
| 15 | Build photo capture and signature for delivery workflow |
| 16 | Remove orphaned components or wire them in |
| 17 | Fix admin settings page save buttons |
| 18 | Build real notification pipeline (email/SMS) |

## TIER 4: Infrastructure
| # | Task | What's Needed |
|---|------|---------------|
| 19 | Audit all local JSON file writes - ensure Vercel compatibility |
| 20 | Replace in-memory storage with Google Sheets or Vercel KV |
| 21 | Consolidate 3 overlapping delivery services into 1 |
| 22 | Full security audit - add auth to unprotected endpoints |

---

# SECTION 8: WHAT YOU CAN DEMO TOMORROW (Working Right Now)

1. **Public website** - All pages work, looks professional
2. **Monday meeting presentation** - Real commission leaderboard with rankings, achievements, streaks, celebrations
3. **Commission stats** - Weekly/monthly/YTD breakdowns with real data
4. **JobNimbus integration** - Show live customer/job data (if API key is set)
5. **Customer portal** - Token-based access to their job status from JN
6. **Contact form** - Submits to Google Sheets with email notification
7. **Team profiles** - All team member pages with bios and photos

8. **Admin Sales page** (`/admin/sales`) - Real charts (recharts) pulling real commission data from Google Sheets API

**DO NOT DEMO:**
- Reports page (all fake numbers)
- Inventory pages (hardcoded data, 1,660 real transactions exist but not wired to live UI)
- Sales portal sub-pages (empty shells)
- Admin settings save buttons (non-functional)
- Phone system (mock data)
- Marketing pages (mock data)

---

# SECTION 9: MINOR ISSUES ON PUBLIC PAGES

1. **Footer location inconsistency**: Customer portal login (`/customer`) and 404 page say "Hartselle, AL" while the main Footer and ContactForm say "3325 Central Pkwy SW, Decatur, AL 35603". Pick one.
2. **Referral form text misleading**: `ReferralForm.tsx` intro says "earn $100 when they get a new roof!" but the actual tiered structure on the same page shows $100-$1,000. Should say "$100 to $1,000."
3. **8 dead components** never imported anywhere: ScrollReveal, AdminLayout, RoleTrainingPopup, TrainingPopup, VideoBackground, VideoEmbed, WideImage, CustomerCallHistory

---

*This audit was generated by systematically reading every lib file (76 files), API route (114 routes), portal page (43 pages), public page, and component in the codebase. Numbers and verdicts are based on actual code inspection, not assumptions.*
