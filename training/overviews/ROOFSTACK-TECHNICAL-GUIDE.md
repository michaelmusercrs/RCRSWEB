# RCRS Platform -- Complete Reference Guide
## River City Roofing Solutions | February 2026

This document is the definitive technical and operational reference for the RCRS digital platform. It covers every feature, every integration, every role, and every page. Treat it as the owner's manual for the entire system. Estimated reading time: 45-60 minutes.

---

## Table of Contents

1. [Platform Overview](#1-platform-overview)
2. [Authentication & Security](#2-authentication--security)
3. [Public Website](#3-public-website)
4. [Check My Address System](#4-check-my-address-system)
5. [Command Center](#5-command-center)
6. [Sales Portal](#6-sales-portal)
7. [Office Portal](#7-office-portal)
8. [Delivery & Driver Portal](#8-delivery--driver-portal)
9. [Inventory Management](#9-inventory-management)
10. [Billing & Invoicing](#10-billing--invoicing)
11. [Training & Onboarding](#11-training--onboarding)
12. [GroupMe Chat Integration](#12-groupme-chat-integration)
13. [Integration Reference](#13-integration-reference)
14. [Data Flow Diagrams](#14-data-flow-diagrams)
15. [Role-Based Access Reference](#15-role-based-access-reference)
16. [Team Directory](#16-team-directory)
17. [Administration Guide](#17-administration-guide)
18. [Configuration Reference](#18-configuration-reference)
19. [Troubleshooting](#19-troubleshooting)
20. [Glossary](#20-glossary)

---

## 1. Platform Overview

### What It Is

The RCRS platform is a full-stack web application that combines a public-facing marketing website with a comprehensive internal operations portal. It was designed and built specifically for River City Roofing Solutions to replace scattered spreadsheets, manual processes, and disconnected tools with a single unified system.

### What Problems It Solves

- **Lead management**: Automated distribution, scoring, tracking, and assignment of incoming leads instead of manual round-robin or guesswork.
- **Inventory control**: Real-time tracking of 11 roofing material products with low-stock alerts, audit trails, and Google Sheets sync.
- **Delivery logistics**: Full ticket lifecycle from material order through loading checklist, route optimization, proof of delivery, and invoicing.
- **Sales performance**: Leaderboard, commission tracking, customer CRM integration with JobNimbus, and individual rep dashboards.
- **Team coordination**: GroupMe chat integration, shared calendar, Monday meeting system, and training modules.
- **Customer transparency**: Customer portal with job timeline, weather alerts, document sharing, and delivery tracking.
- **Marketing and SEO**: 68 blog articles, structured data on every page, Google Analytics, and a "Check My Address" lead capture tool.

### Technology Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 14.2.33 |
| UI Library | React 18 |
| Language | TypeScript |
| Styling | Tailwind CSS |
| UI Components | shadcn/ui |
| Hosting | Vercel (prj_7s9kclvyqkMQhOHS4fHWpBJLEruG) |
| Database | Google Sheets (17+ tabs via service account) |
| CRM | JobNimbus (2-way sync) |
| File Storage | Vercel Blob |
| Chat | GroupMe API |
| Calendar | Google Calendar (URL links) + TeamUp |
| Analytics | Google Analytics (G-Y8PB85BZC5) |
| Weather Data | NWS / Iowa State Mesonet |
| Email Notifications | Google Apps Script |

### Scale

| Metric | Count |
|--------|-------|
| Total Pages | 367 |
| API Routes | 180+ |
| React Components | 85+ |
| Library/Service Files | 95+ |
| Blog Articles | 68 |
| Team Member Profiles | 17 |
| Service Pages | 11 |
| Service Area Pages | 8 |
| Inventory Products | 11 |
| Google Sheets Tabs | 17+ |

### Domain and Contact

- **Website**: https://www.rivercityroofingsolutions.com
- **Email**: rcrs@rivercityroofingsolutions.com
- **Phone**: (256) 274-8530
- **Company Domain**: rcrsal.com (Google Workspace)
- **Headquarters**: 3325 Central Pkwy SW, Decatur, AL 35603
- **Brand Color**: #39FF14 (neon green, mapped to `brand-green` in Tailwind)
- **Founded**: 2010

---

## 2. Authentication & Security

### Admin Auth (JWT-Based)

Admin authentication protects the admin dashboard and management pages.

- **Login endpoint**: `POST /api/admin/auth` with the admin password
- **Token type**: JWT signed with `JWT_SECRET` environment variable (128-character hex string)
- **Token storage**: httpOnly cookie (not accessible to client-side JavaScript)
- **Middleware**: `requireAdmin()` function applied to all `/api/admin/*` routes
- **Password**: Single admin password stored in `ADMIN_PASSWORD` environment variable; no hardcoded fallbacks
- **Bypass mode**: `AUTH_BYPASS_MODE=true` environment variable allows unauthenticated access for pre-launch testing only; must be disabled before real users onboard

### Portal Auth (Email + PIN)

Team members access the portal by entering their email and 4-digit PIN.

- **Login endpoint**: `POST /api/portal/auth` with email + PIN
- **Team roster**: Defined in `lib/team-roles.ts` with unique PINs per member
- **Auth context**: `lib/auth-context.tsx` provides `useAuth()` React hook for client-side state
- **Route guards**: `ROLE_ROUTES` mapping in auth-context determines which portals each role can access
- **Session**: JWT token with role and permissions embedded

### Customer Portal Auth (Token-Based)

Customers receive a unique URL and do not need a password.

- **Entry points**: `/my/[token]` and `/api/customer/dashboard`
- **Token**: Auto-generated per customer, stored in the Customers Google Sheets tab
- **Portal generator**: `lib/portal-generator.ts` creates unique customer portal instances
- **No password required**: The token in the URL serves as the authentication credential

### RBAC Hierarchy

The role hierarchy controls what each user can see, create, edit, and delete. Roles are ranked by a numeric level.

```
owner (Level 100)
  |
admin (Level 90)
  |
manager (Level 80)
  |
sales / office / project_manager (Level 50)
  |
driver (Level 30)
  |
viewer (Level 10)
```

- **owner**: Chris Muse, Michael Muse -- full access to everything, wildcard (`*`) permissions
- **admin**: Sara Hill, system admin account -- full access with approval authority
- **manager**: Destin McCury -- operations oversight, view-all access, limited editing
- **sales**: Hunter, Aaron, Greg, Brendon, Rick, Rudy, Adam -- own leads, own jobs, personal stats, leaderboard
- **office**: Tia Morris -- billing, inventory, schedule management, lead entry
- **project_manager**: John Cordonis, Bart Roberts -- job scheduling, material orders, delivery coordination
- **driver**: Richard Geahr, Tae Orr -- delivery queue, route navigation, photo uploads, signature capture
- **viewer**: Read-only access to dashboards and reports

### Security Measures

- **No hardcoded credentials**: The `admin123` fallback password was removed; all credentials are environment variables
- **HMAC webhooks**: Webhook endpoints validate signatures to prevent spoofing
- **Rate limiting**: In-memory rate limiting on authentication endpoints (Redis upgrade planned for production)
- **Input validation**: API routes validate request bodies before processing
- **Auth checks on all routes**: 100+ admin/portal API routes have `requireAuth()` or `requireAdmin()` middleware applied
- **No team enumeration**: Quick Login buttons on the portal login page were removed to prevent enumerating team members
- **PIN required**: Portal login requires both email and PIN (previously accepted email only)
- **httpOnly cookies**: JWT tokens are stored in cookies not accessible to JavaScript
- **Content Security**: placehold.co removed from allowed image domains; Google Maps API key moved server-side

---

## 3. Public Website

### Homepage

The homepage is the primary landing page with multiple conversion-oriented sections:

- **Hero section**: Animated text with video background, primary CTA ("Get Your Free Inspection")
- **Service highlights**: Cards for each primary service with icons and descriptions
- **Trust signals**: "Why Choose RCRS" section with company differentiators
- **Customer reviews**: Rotating testimonials from verified customers
- **Service area map**: Interactive display of all active service areas
- **Contact form**: Inline form that submits to Google Sheets + triggers email notification
- **Promotional banner**: Top-of-page banner for seasonal offers or announcements
- **Floating contact button**: Fixed-position CTA button that follows the user as they scroll
- **Cookie consent**: GDPR-compliant consent banner for analytics tracking

### Blog System

The blog contains 68 articles covering roofing topics, storm preparedness, maintenance tips, and local guides.

- **Source file**: `lib/blogData.ts` -- all 68 posts with full content stored as TypeScript
- **Categories**: Roofing materials, storm damage, maintenance, insurance claims, local guides
- **Authors**: Chris Muse, Michael Muse, and other team members
- **SEO**: Each post has Article JSON-LD schema with author, datePublished, breadcrumbs
- **Layout**: Blog index page with search/filter, individual post pages with related articles
- **Admin CMS**: Blog content can be managed at `/portal/admin/blog` by admin users

### Team Pages

17 team member profiles organized by category.

**Categories**:
- Leadership: Chris Muse (President), Michael Muse (Vice President)
- Regional Partners: Hunter (Birmingham), Aaron (Nashville)
- Office: Sara Hill (Office Manager), Tia (Admin), Boston (Marketing Director), Destin (Admin)
- Production: John (Production Manager), Brendon (Sales Inspector), Bart (Insurance Claims Specialist), Tae (Materials Manager), Greg (Sales Inspector), Richard (Driver), Travis (Sales Inspector)
- Partners & Advisors: Donnie Dotson (Strategic Advisor)
- In Loving Memory: Danny Ray "Pops" Muse

**Each profile includes**: Photo, position, tagline, full bio, key strengths, responsibilities, social media links, and contact information.

- **SEO**: Person JSON-LD schema with worksFor, breadcrumbs
- **Admin CMS**: Team data managed at `/portal/admin/team`

### Service Pages

11 services organized into Primary and Additional categories.

**Primary Services** (8):
1. Residential Roof Replacement -- $5,000-$25,000+, 1-3 day timeline
2. Residential Roof Repair -- $300-$5,000, same-day to 2 weeks
3. Commercial Roofing -- TPO, EPDM, modified bitumen, metal
4. Storm & Hail Damage Repair -- 24/7 emergency, insurance claim support
5. Chimney Services -- $300-$800 per chimney
6. LeafX Gutter Protection -- $1,500-$5,000+, lifetime clog-free guarantee
7. Roof Inspections & Maintenance -- $150-$500 per inspection
8. Emergency Roof Services -- $500-$5,000, 24/7 availability

**Additional Services** (3):
9. Gutter Repair and Replacement -- $400-$3,000+
10. Attic Ventilation Solutions -- $500-$2,000
11. Roof Coating and Treatment -- $1-$3 per square foot

Each service page includes: description, what's included, materials available, timeline, cost range, key benefits, ideal-for list, and a CTA to schedule an inspection.

- **SEO**: Service JSON-LD schema with provider, areaServed, breadcrumbs
- **Admin CMS**: Managed at `/portal/admin/services`

### Location Pages

Dedicated pages for primary service areas with localized content and reviews.

- `/locations/huntsville` -- Huntsville, AL (population ~215,000)
- `/locations/madison` -- Madison, AL (population ~42,000)
- `/locations/decatur` -- Decatur, AL (headquarters, same-day service)

Each location page includes: LocalBusiness JSON-LD, FAQ schema, unique customer reviews, service availability, response times, and localized CTAs.

### Service Area Pages

8 service area pages covering the full territory.

**Active Areas** (6):
1. Decatur, AL -- Headquarters, same-day response
2. Huntsville, AL -- Major market, 1-2 day response
3. Madison, AL -- Growing suburb, 1-2 day response
4. Athens, AL -- College town, 1-2 day response
5. Owens Crossroads, AL -- Residential focus, 1-2 day response
6. North Alabama (General) -- Broader territory, 2-3 day response

**Expansion Areas** (2):
7. Birmingham, AL -- Regional partner Hunter, launched Q4 2025
8. Nashville, TN -- Regional partner Aaron, planned 2026

Each service area page includes: description, coverage details, services offered, response time, key details, and expansion timeline (if applicable).

### Contact Form

- **URL**: `/contact`
- **Fields**: Name, email, phone, address, service needed, message
- **Submission flow**:
  1. Client-side form validates inputs
  2. `POST /api/forms/contact` sends data to the server
  3. `form-service.ts` processes the submission
  4. Row appended to Google Sheets (Contacts tab)
  5. Google Apps Script sends email notification to the RCRS team
  6. GroupMe notification sent (when configured)
  7. User redirected to `/contact/thank-you`

### Referral Program

- **URL**: `/referral-rewards`
- **How it works**: Existing customers or partners can refer homeowners who need roofing work
- **Form fields**: Referrer name, email, phone; referred person name, phone, address, notes
- **Submission**: `POST /api/forms/referral` stores in Google Sheets and sends team notification
- **Rewards**: Referral calculator component shows estimated rewards based on job value

### BNI Page

- **URL**: `/bni`
- **Purpose**: Networking page for Business Network International (BNI) chapter partnerships
- **Content**: Company overview, team BNI members (Aaron is BNI chapter president), referral process

### SEO System

The SEO system is centralized in `lib/seo.ts` with the following capabilities:

- **Metadata generation**: `generateMetadata()` creates Next.js Metadata objects with OpenGraph, Twitter Card, and canonical URLs
- **Structured data**: JSON-LD generators for RoofingContractor, LocalBusiness, Article, Service, Person, FAQ, BreadcrumbList, CollectionPage
- **Reusable component**: `components/StructuredData.tsx` renders JSON-LD script tags
- **Site config**: Centralized in `siteConfig` object (company name, URLs, phone, address, social links, business hours)
- **All public pages**: Unique title, description, OG tags, canonical URLs

**Schema types used**:
- Homepage: RoofingContractor (LocalBusiness subtype)
- Blog posts: Article with author, datePublished
- Team profiles: Person with worksFor
- Service pages: Service with provider, areaServed
- Location pages: LocalBusiness + FAQ + BreadcrumbList
- Index pages: CollectionPage + BreadcrumbList

### Google Analytics

- **ID**: G-Y8PB85BZC5
- **Tracking provider**: `components/TrackingProvider.tsx` wraps the app with consent-aware analytics
- **Cookie consent**: `components/CookieConsent.tsx` displays GDPR-style consent banner; analytics only fires after consent

### Sitemap and robots.txt

- **Sitemap**: Auto-generated by Next.js covering all public pages
- **robots.txt**: Standard configuration allowing search engine crawling of public pages
- **Portal/admin pages**: Excluded from sitemap and blocked in robots.txt

---

## 4. Check My Address System

### Purpose

"Check My Address" is a public-facing lead capture tool that provides genuine value to homeowners. Users enter their address and receive a storm/hail damage risk report. RCRS simultaneously captures the lead.

### URL

`/check-my-address` -- also linked from the header nav, footer, and homepage CTA

### Input Fields

- Street address (required)
- City (required)
- State (dropdown, SE US states focused: AL, TN, GA, MS, FL, KY, NC, SC)
- ZIP code (required)
- Name (required for lead capture)
- Email (required for lead capture)
- Phone (required for lead capture)

### Processing Pipeline

1. User submits address + contact info
2. `POST /api/storm-report` receives the request
3. `lib/storm-report-service.ts` processes:
   - Queries NWS (National Weather Service) for active weather alerts in the area
   - Queries Iowa State Mesonet for historical hail reports within a configurable radius
   - Queries wind event data
   - Runs risk scoring algorithm

### Risk Scoring Algorithm

The algorithm produces a score from 0-100 and assigns a severity level:

| Score Range | Risk Level |
|-------------|-----------|
| 0-25 | Low |
| 26-50 | Moderate |
| 51-75 | High |
| 76-100 | Severe |

**Factors that increase the score**:
- Number of hail reports in the radius
- Proximity of closest hail event (closer = higher risk)
- Size of largest hail (bigger = higher risk)
- Recency of events (more recent = higher risk)
- Active weather alerts in the area
- Wind events in the area

### Output (Storm Report)

The generated report includes:
- **Risk score**: 0-100 numeric value
- **Risk level**: Low / Moderate / High / Severe
- **Total hail reports**: Count of hail events found
- **Closest hail distance**: Miles from the address to the nearest hail report
- **Largest hail size**: Diameter of the largest hail event found
- **Hail events timeline**: List of individual events with date, size, severity, distance, location, county
- **Wind events**: Associated wind events
- **Active alerts**: Any current NWS weather alerts
- **Risk factors**: Plain-English explanation of what drives the score
- **Recommendation**: Suggested action (e.g., "Schedule a free inspection")

### Lead Creation

- Auto-creates a lead record with storm data attached
- Lead includes all contact info + the full storm report
- Lead is stored in Google Sheets and optionally synced to JobNimbus

### Sales Use Case

Sales reps use Check My Address as a door-knocking tool:
1. Pull up the address on their phone at the door
2. Show the homeowner their personalized storm report
3. Point to specific hail events near their home
4. Offer a free inspection to assess actual damage

---

## 5. Command Center

The Command Center (`/command-center`) is the executive dashboard for owners, admins, and managers. It provides a bird's-eye view of all business operations.

### 5.1 Executive Dashboard (`/command-center`)

The main dashboard displays:

**KPI Cards** (top row):
- Revenue MTD (month-to-date) with month-over-month growth percentage
- Revenue YTD (year-to-date)
- Gross Margin percentage and gross profit
- Pipeline Value (potential revenue in active leads/quotes)
- Net Cash Flow
- Accounts Receivable with overdue amount highlighted

**Team Performance Section**:
- Per-rep stats: sales count, revenue, close rate
- Top performer highlight
- Underperforming rep alerts
- Lead comparison: this week vs. last week

**Revenue Trend Chart**:
- 12-month bar chart showing monthly revenue progression

**Auto-Generated Insights**:
- AI-style summaries based on trend data
- Alerts for unusual patterns (spikes, drops)

**Today's Schedule**:
- Upcoming inspections, deliveries, and meetings

**Quick Links**:
- Navigation to all Command Center sub-sections

### 5.2 Sales Leaderboard (`/command-center/sales`)

- **Rankings**: All sales reps ranked by revenue, close rate, or transaction count
- **Rep DNA**: Individual performance profiles showing strengths
- **Achievements**: Milestones and badges earned
- **Data**: $2.6M+ in tracked revenue, 4,199+ transactions in the system
- **Leaderboard component**: `components/Leaderboard.tsx`

### 5.3 Financial Reports (`/command-center/reports/financial`)

- Revenue MTD and YTD with detailed breakdowns
- Gross margins by service type
- Cash flow analysis
- Invoice aging reports (30/60/90 day buckets)
- Overdue invoice alerts with amounts
- Commission summaries by rep

### 5.4 Team Reports (`/command-center/team`)

- Cross-team performance comparison
- Individual rep performance cards
- Printable report format at `/command-center/reports/team`
- Period filtering (this week, this month, this quarter, custom)

### 5.5 Lead Management (`/command-center/leads`)

- **Search and filter**: By status, source, assigned rep, date range
- **Quick-assign**: Assign leads to reps directly from the list
- **Distribution rules**: View and manage lead distribution algorithm settings
- **Source analytics**: Where leads are coming from (website, referral, door knock, Check My Address)
- **Lead lifecycle tracking**: New, Contacted, Inspection Scheduled, Quote Sent, Won, Lost

### 5.6 Inventory Overview (`/command-center/inventory`)

- Stock levels for all 11 products
- Low-stock alerts (items below minimum quantity)
- SKU detail pages at `/command-center/inventory/[sku]`
- Reorder thresholds and supplier info
- Category breakdown: Fasteners, Underlayment, Ventilation, Flashing, Sealants

### 5.7 Marketing Hub (`/command-center/marketing`)

- **Campaign management**: Create and track marketing campaigns
- **Ad platforms**: Facebook/Instagram, Google Ads, Print
- **Email templates**: 5 pre-built email templates for common scenarios
- **Content calendar**: `/command-center/marketing/calendar` for planning posts and campaigns
- **Ads dashboard**: `/command-center/marketing/ads` for ad performance tracking
- **Email campaigns**: `/command-center/marketing/emails` for email blast management

### 5.8 Meeting Module (`/command-center/meetings`)

- **Prep**: `/command-center/meetings/prep` -- prepare Monday meeting agenda with KPIs and talking points
- **Present**: `/command-center/meetings/present` -- presentation mode with slides-style view
- **Archives**: `/command-center/meetings/archives` -- historical meeting notes and outcomes
- **Stats**: Meeting frequency, attendance, and action item completion via API
- **Leaderboard integration**: Pull leaderboard data into meeting presentations

### 5.9 Phone System (`/command-center/phone`)

- **8 extensions**: Configured for team members
- **Call history**: `/command-center/phone/calls` with search and filter
- **Extension detail**: `/command-center/phone/[extension]` for individual extension management
- **Voicemail**: Access and manage voicemail recordings
- **Configuration**: `/command-center/phone/manage` for phone system settings
- **Analytics**: Call volume trends, average duration, busiest hours

### 5.10 Other Command Center Sections

- **Schedule**: `/command-center/schedule` -- Master calendar with all events
- **Billing**: `/command-center/billing` -- Invoice overview, breakdowns, and financial data
- **Documents**: `/command-center/documents` -- Shared document library
- **Agents**: `/command-center/agents` -- Insurance agent directory and visit tracking

---

## 6. Sales Portal

### 6.1 Sales Dashboard (`/portal/sales`)

The sales dashboard is the primary interface for sales reps.

**Dashboard Layout**:

- **Commission progress bar**: Visual progress toward monthly/quarterly commission goals
- **Quick stats row**: Total leads, inspections scheduled, quotes sent, jobs won
- **Team comparison**: "Your rank" card showing position on leaderboard
- **Commission summary**: Earned MTD, pending, paid out

**Quick Actions** (prominent buttons):
- Quick Call: Tap to call a lead
- Schedule: Schedule an inspection via Google Calendar
- Send Quote: Generate and send a quote
- Upload Photo: Upload roof inspection photos

**Priority Leads Section**:
- Hot leads requiring immediate action
- Inline actions: call, schedule, update status
- Color-coded by urgency/age

**Recent Activity Timeline**:
- Chronological feed of the rep's actions (calls, inspections, quotes, closings)

**Today's Inspections**:
- List of scheduled inspections for the day with addresses
- Map integration for route planning

**Mobile Bottom Nav**:
- Persistent bottom navigation bar optimized for phone use: Dashboard, Leads, Performance, Settings

### 6.2 Lead Management (`/portal/sales/leads`)

- **Status workflow**: New -> Contacted -> Inspection Scheduled -> Quote Sent -> Won / Lost
- **Search**: By name, address, phone, email
- **Filters**: Status, source, date range, assigned rep (for managers viewing all)
- **Lead detail**: Full contact info, interaction history, notes, status updates
- **Inline actions**: Change status, add note, schedule inspection, send quote

### 6.3 Customer CRM (`/portal/sales/customers`)

- **JobNimbus integration**: 2-way sync of contacts, jobs, notes
- **Customer detail page**: `/portal/sales/customers/[id]` with 6 tabs:
  1. Overview: Contact info, address, status, source
  2. Jobs: Associated job records from JobNimbus
  3. Notes: Communication log and internal notes
  4. Documents: Shared documents (estimates, contracts)
  5. Timeline: Full interaction history
  6. Activity: Recent activity feed

### 6.4 Performance Dashboard (`/portal/sales/performance`)

- **KPIs**: Close rate, average deal size, response time, inspections per week
- **Comparison**: Current period vs. previous period with percentage changes
- **Goals**: Individual targets set by management
- **Trends**: Multi-week/month performance graphs
- **Leaderboard position**: Where the rep ranks among peers

### 6.5 Settings (`/portal/sales/settings`)

- Personal preferences (notification settings, default views)
- Territory preferences for lead distribution
- Availability status toggle

---

## 7. Office Portal

### 7.1 Structure

The office portal (`/portal/office`) uses a 4-tab interface:

| Tab | Purpose |
|-----|---------|
| Dashboard | Overview stats and quick actions |
| Delivery Tickets | Search, filter, and manage delivery tickets |
| Invoices | Invoice management and payment tracking |
| Create Order | New material order form |

### 7.2 Dashboard Tab

**Stats Cards**:
- Active Tickets: Count of delivery tickets not yet completed
- Completed Today: Tickets finished today
- Pending Invoices: Invoices awaiting payment
- Pending Amount: Total dollar amount of outstanding invoices

**Recent Activity**: Latest ticket updates, invoice payments, and order creations

### 7.3 Delivery Ticket Management

- **Search**: By job name, customer name, address
- **Filter by status**: Created, Assigned, Materials Pulled, Load Verified, En Route, Arrived, Delivered, Picked Up, Proof Captured, QC Photos, Completed, Cancelled
- **Driver assignment**: Assign or reassign tickets to available drivers
- **Pull materials**: Mark materials as pulled from inventory (updates stock levels)
- **Status tracking**: Visual status timeline for each ticket
- **Color-coded statuses**: Each status has a unique color for quick visual identification

### 7.4 Invoice Management

- **Status filter**: All, Pending, Sent, Paid, Overdue
- **Mark paid**: One-click to mark an invoice as paid
- **View details**: Full invoice breakdown with line items
- **Overdue alerts**: Highlighted invoices past due date

### 7.5 Order Creation (Create Tab)

The order creation form captures:

- **Job info**: Job name, job address, city, state, ZIP
- **Customer contact**: Name, phone, email
- **Project manager info**: PM name and phone
- **Delivery details**: Preferred date, time window, priority level, special instructions
- **Material grid**: Select products from inventory, specify quantities, running total
- **Submit**: Creates delivery ticket + updates inventory + notifies assigned driver

### 7.6 Additional Office Functions

- **Scheduling and calendar**: `/portal/schedule` -- view and manage team schedules
- **Lead entry and routing**: Office staff can enter new leads and trigger the distribution algorithm
- **Phone operations**: Manage calls, voicemail, and extensions

---

## 8. Delivery & Driver Portal

### 8.1 Delivery Hub (`/portal/delivery`)

The delivery management page for PMs and managers:

- **List/Map view toggle**: Switch between tabular list and map-based view of deliveries
- **Status filter**: Filter by any ticket status
- **Summary stats**: Total active, en route, completed today, unassigned
- **Unassigned banner**: Prominent alert when tickets lack a driver assignment
- **Bulk operations**: Assign multiple tickets to a driver at once

### 8.2 Route Management (`/portal/delivery/route`)

The active route page for drivers:

- **Driver info card**: Driver name, truck, and assignment summary
- **Distance and duration**: Total route distance and estimated completion time
- **Google Maps integration**: Turn-by-turn navigation link for each stop
- **Progress bar**: Visual indicator of route completion (stops completed / total stops)
- **Stop reordering**: Optimized stop sequence based on route optimization service

### 8.3 Stop Cards (`/portal/delivery/[id]`)

Each delivery stop shows:

- **Status badge**: Current status with color coding
- **Priority indicator**: Normal, Rush, or Urgent
- **Customer info**: Name, phone, address
- **Navigation button**: Direct link to Google Maps for the address
- **Action buttons**: Mark arrived, start unload, complete delivery, capture proof
- **Material list**: Items to be delivered with quantities
- **Special instructions**: Notes from the office/PM

### 8.4 Loading Checklist

Before departing, drivers must complete the loading checklist:

1. **Item verification**: Check off each material item against the ticket
2. **Quantity confirmation**: Verify quantities match the order
3. **Photo documentation**: Take photos of loaded materials
4. **Safety check**: Confirm load is secured properly
5. **Acknowledgment**: Digital signature confirming load is verified

Once completed, ticket status advances from "Materials Pulled" to "Load Verified."

### 8.5 Proof of Delivery

After delivery completion:

- **Photo upload**: Take and upload photos of delivered materials at the job site
- **Delivery notes**: Add notes about placement, condition, or issues
- **Customer signature**: Digital signature capture from the customer or site contact
- **Timestamp**: Automatic timestamp of delivery completion
- **GPS location**: Optional GPS coordinates logged for delivery verification

### 8.6 ETA System and Customer Notifications

The delivery reminder service (`lib/delivery-reminder-service.ts`) manages:

- **ETA calculation**: Based on stop number, total stops, and average minutes per stop (30 min default)
- **Reminder types**: Customer, Driver, and Office reminders
- **Triggers**: Next-day reminder, same-day morning, status change, manual
- **Customer notification**: ETA updates sent when driver is en route
- **Daily summary**: Overview of all deliveries for the day, organized by driver
- **Status tracking**: Each reminder logged with sent/pending/failed status

---

## 9. Inventory Management

### 9.1 Products Tracked

11 roofing material products with full details:

| Product ID | Product Name | Category | Unit | Cost | Price | Supplier |
|-----------|-------------|----------|------|------|-------|----------|
| item-123 | 1 1/4 EG Nails | Fasteners | box | $27.50 | $64.90 | ABC Supply |
| item-124 | Bottom Caps (plastic) | Fasteners | bag | $16.50 | $29.15 | ABC Supply |
| item-125 | RCRS Syn Felt | Underlayment | roll | $66.00 | $79.86 | IKO Industries |
| item-126 | Ice & Water Shield | Underlayment | roll | $62.70 | $114.22 | GAF Materials |
| item-127 | Ridge Vent 4LF | Ventilation | piece | $7.15 | $10.20 | Air Vent Inc |
| item-128 | 1 1/2" Black Bullet Boot | Flashing | each | $16.67 | $20.89 | Oatey |
| item-129 | 2" Black Bullet Boot | Flashing | each | $17.77 | $22.54 | Oatey |
| item-130 | 3" Black Bullet Boot | Flashing | each | $20.19 | $38.29 | Oatey |
| item-131 | 4" Black Bullet Boot | Flashing | each | $37.48 | $42.50 | Oatey |
| item-132 | Sealant | Sealants | tube | $9.35 | $10.00 | Geocel |
| item-133 | Zipper Boot | Flashing | each | $37.40 | $48.00 | Oatey |

### 9.2 Google Sheets Sync

- **Source of truth**: Google Sheets `Inventory` tab
- **Sync direction**: Bi-directional; platform writes changes, reads current state
- **Service**: `lib/inventory-sheets-sync.ts`
- **Fallback**: If Sheets API is unavailable, falls back to local JSON data from `lib/inventoryData.ts`

### 9.3 Low Stock Alerts

- Each product has a `minQty` (minimum quantity) threshold
- When `currentQty` drops to or below `minQty`, a low-stock alert is triggered
- Alerts appear on the Command Center dashboard, office portal, and inventory pages
- Reorder thresholds are configurable per product

### 9.4 Transaction History

- Every stock change is logged in the `InventoryLogs` Google Sheets tab
- Log entry includes: product ID, quantity change, operation (add/subtract), user who made the change, timestamp, and reason
- **Audit trail**: Full history of who changed what, when, and why
- **View**: `/portal/transactions` for transaction history

### 9.5 Role-Based Cost Visibility

| Role | Can See Cost | Can See Price | Can Adjust Stock |
|------|:-----------:|:------------:|:----------------:|
| Owner | Yes | Yes | Yes |
| Admin | Yes | Yes | Yes |
| Manager | Yes | Yes | Yes (restock) |
| Office | No | Yes | Yes |
| Sales | No | No (qty only) | No |
| Project Manager | No | Yes | No (request only) |
| Driver | No | No | Yes (with logging) |

### 9.6 Stock Adjustment

- Adjustments require selecting a product, entering quantity, choosing add/subtract, and providing a reason
- All adjustments are logged to the audit trail
- Drivers can adjust stock quantities but every change is logged with their ID
- Restock requests can be submitted by PMs and office staff

---

## 10. Billing & Invoicing

### 10.1 Invoice Generation

- Invoices can be generated from completed jobs
- **Service**: `lib/billing-workflow-service.ts` manages the billing lifecycle
- **PDF generation**: `lib/invoice-pdf-service.ts` creates downloadable PDF invoices
- **API**: `/api/portal/billing/pdf` for PDF generation

### 10.2 Status Workflow

```
Created -> Sent -> Paid
                \-> Overdue (past due date)
```

- **Created**: Invoice generated from job data
- **Sent**: Invoice sent to customer
- **Paid**: Payment received and recorded
- **Overdue**: Invoice past due date without payment

### 10.3 Aging Reports

Invoices are grouped by age:
- 0-30 days
- 31-60 days
- 61-90 days
- 90+ days

Each bucket shows count and total dollar amount. Overdue amounts are highlighted.

### 10.4 Commission Calculation

- Commissions tracked in the `Commissions` Google Sheets tab
- Commission rates may vary by rep, deal type, and volume
- Integration with JobNimbus for job value data
- Commission progress visible on each sales rep's dashboard

### 10.5 Job Breakdowns

- **API**: `/api/breakdown` -- detailed cost breakdown for a job
- **Data**: Stored in `Job_Breakdowns` Google Sheets tab
- **Components**: Materials cost, labor cost, overhead, margin
- **View**: `/command-center/billing/breakdowns` for job cost analysis

### 10.6 Invoice Management Pages

- `/command-center/billing` -- Overview of all billing
- `/command-center/billing/invoices` -- Full invoice list with search and filter
- `/command-center/billing/breakdowns` -- Job cost breakdowns
- `/portal/billing` -- Portal billing interface for office/manager roles

---

## 11. Training & Onboarding

### 11.1 Training Hub

The Training Hub (`/portal/training`) offers three distinct learning paths:

1. **Sales Training** (`/portal/training/sales`) -- 7-module course for sales reps
2. **Interface Onboarding** (`/portal/training/onboarding`) -- 8-section platform walkthrough
3. **RCRS University** -- Advanced modules for specialized knowledge

### 11.2 Sales Training (7 Modules)

| Module | Title | Description | Est. Time |
|--------|-------|-------------|-----------|
| 1 | Company Overview | RCRS history, mission, values, service areas, team structure | 15 min |
| 2 | Products & Services | Roofing materials (IKO Dynasty, Nordic, etc.), service details | 15 min |
| 3 | Insurance Claims | How to navigate homeowner insurance claims | 15 min |
| 4 | Sales Process | Inspection to close: the RCRS sales methodology | 15 min |
| 5 | Objection Handling | Common objections and proven responses | 10 min |
| 6 | Platform Tools | How to use the RCRS portal, CRM, and mobile tools | 15 min |
| 7 | Customer Communication | Professional communication standards and templates | 10 min |

**Module Structure**:
- Each module has multiple content sections with headings and paragraphs
- Pro tips are highlighted for practical advice
- A quiz follows each module

**Quiz System**:
- Multiple-choice questions with 4 options each
- Immediate feedback showing correct/incorrect with explanations
- **Passing score**: 70% required to pass
- Failed modules can be retried

**Certificates**:
- On passing all 7 modules, a completion certificate is generated
- Certificate includes trainee name, completion date, and scores
- Progress saved to `Training_Progress` Google Sheets tab

### 11.3 Interface Onboarding (8 Sections)

| Section | Title | Description |
|---------|-------|-------------|
| 1 | Dashboard Overview | Main dashboard metrics, navigation, and quick actions |
| 2 | Team Management | User roles, permissions, and team directory |
| 3 | Delivery System | Delivery tickets, driver assignment, and tracking |
| 4 | Inventory | Stock management, ordering, and alerts |
| 5 | Calendar & Scheduling | Event management, Google Calendar links |
| 6 | Order Management | Creating and managing material orders |
| 7 | Reporting | Available reports and how to use them |
| 8 | Admin Settings | System configuration and preferences |

**Each section includes**:
- Step-by-step walkthrough with screenshots and descriptions
- "Try It" links that navigate directly to the relevant platform section
- Tips for efficient use
- Section completion tracking

### 11.4 Progress Tracking

- Progress is tracked per user in the `Training_Progress` Google Sheets tab
- Admin view at `/portal/admin/training` shows all team members' progress
- Completion percentages visible on user profiles

---

## 12. GroupMe Chat Integration

### 12.1 Full Chat Interface (`/portal/chat`)

The chat page provides a full GroupMe messaging experience within the RCRS portal.

**Features**:
- **Group channels**: Team-wide and topic-specific group conversations
- **Direct messages (DMs)**: Private 1-on-1 conversations between team members
- **Message types**: Text, images, videos, and file attachments
- **@mentions**: Type `@` to autocomplete and mention specific team members
- **Search**: Search across messages and conversations
- **10-second polling**: Messages refresh automatically every 10 seconds for near-real-time updates
- **Mobile-optimized**: Responsive layout with touch-friendly interface

### 12.2 Chat Data Structures

- **Groups**: ID, name, description, image, member count, last message preview
- **Messages**: ID, text, sender info, avatar, timestamps, attachments, favorites
- **Members**: User ID, nickname, avatar, roles, mute status
- **DMs**: Separate conversation threads with their own message history

### 12.3 Floating Chat Widget

- A floating chat widget appears on all portal pages
- Click to expand and see latest messages without navigating away
- Quick reply capability from the widget
- Unread message indicator

### 12.4 Team Notifications

The GroupMe service (`lib/groupme-service.ts`) sends automated notifications for:
- New lead received
- Profile edit pending approval
- Low inventory alert
- Job status change
- Customer portal activity
- Delivery updates
- SLA alerts

**Configuration**: Notification types can be individually enabled/disabled in the GroupMe config.

### 12.5 Configuration

- **GROUPME_ACCESS_TOKEN**: Required for full chat functionality
- **GROUPME_BOT_ID**: Required for automated notifications
- **GROUPME_ENABLED**: Master toggle (set to `true` to enable)

---

## 13. Integration Reference

### 13.1 Google Sheets

**What it connects**: Primary database for all operational data (inventory, orders, deliveries, leads, commissions, customers, training progress).

**How data flows**:
- Server-side service account authenticates via JWT
- `lib/google-sheets-service.ts` provides CRUD operations for all 17+ tabs
- `lib/cms-sheets-service.ts` handles CMS operations (blog, team, images, settings)
- Data is read on every page load (with server-side caching)
- Writes happen on form submissions, status updates, and admin actions

**Tabs (17+)**:

| Tab Name | Purpose |
|----------|---------|
| team-members-import | Team member data |
| Inventory | Product stock levels |
| InventoryLogs | Stock change audit trail |
| Commissions | Sales commission tracking |
| Customers | Customer records and portal tokens |
| Orders | Material orders |
| Deliveries | Delivery tickets |
| Geocoded_Contacts | Location-indexed contacts |
| Lead_Distribution_Log | Lead assignment history |
| Rep_Availability | Sales rep availability status |
| Rep_Preferences | Rep territory preferences |
| Lead_Response_Log | Lead response time tracking |
| Job_Breakdowns | Job cost breakdowns |
| Team_Access_Overrides | Per-user permission overrides |
| Agent_Directory | Insurance agent contacts |
| Agent_Visits | Agent visit tracking |
| Training_Progress | Employee training completion |
| Storm_Reports | Generated storm/hail reports |

**CMS Tabs**:
| Tab Name | Purpose |
|----------|---------|
| blog-posts | Blog content management |
| images | Image library |
| settings | Site-wide settings |
| page-views | Page view analytics |
| profile-views | Profile view tracking |

**Configuration needed**:
- `GOOGLE_SERVICE_ACCOUNT_EMAIL` -- Service account email
- `GOOGLE_PRIVATE_KEY` -- Service account private key (with `\n` escaping)
- `GOOGLE_SHEETS_ID` -- Spreadsheet ID

**Troubleshooting**:
- If data is not updating, verify the service account has edit access to the spreadsheet
- Private key must have `\n` characters properly escaped in the environment variable
- Sheet tab names are case-sensitive and must match exactly

### 13.2 JobNimbus CRM

**What it connects**: Customer relationship management -- contacts, jobs, estimates, notes, tasks.

**How data flows**:
- `lib/jobnimbus-service.ts` provides the base API client
- `lib/jn-sync-engine.ts` handles 2-way synchronization
- Portal reads contacts, jobs, and notes from JobNimbus
- Status changes in the portal can be pushed back to JobNimbus
- Commission calculations pull job values from JobNimbus data
- Webhooks from JobNimbus trigger lead creation and status updates in the portal

**2-Way Sync Engine** (`lib/jn-sync-engine.ts`):
- Syncs contacts, jobs, and notes bidirectionally
- Tracks sync state (last timestamp, counts, errors)
- Per-rep contact summaries and job summaries
- Sales metrics calculation from JN data

**Configuration needed**:
- `JOBNIMBUS_API_KEY` -- API key for authentication
- `JOBNIMBUS_API_URL` -- Base URL for the JobNimbus API

**Troubleshooting**:
- If contacts are not syncing, verify the API key is still valid (keys can expire)
- Large sync operations may time out; the engine paginates up to 100 pages
- Webhook signature validation should be enabled for production security

### 13.3 Google Calendar

**What it connects**: Team scheduling, customer appointments, inspection bookings.

**How data flows**:
- `lib/google-calendar.ts` generates Google Calendar URL links (never .ics files)
- Links include event title, date/time, location, description, and attendee emails
- Team member @rcrsal.com emails are auto-resolved from the team roster
- Customer emails are included as optional attendees

**Key functions**:
- `generateGoogleCalendarLink()` -- Base link generator
- `generateGoogleCalendarLinkFromEvent()` -- From calendar event format
- `generateGoogleCalendarLinkFromScheduledEvent()` -- From scheduling service format
- `generateGoogleCalendarLinkFromJob()` -- From JobNimbus job data

**URL format**: `https://calendar.google.com/calendar/render?action=TEMPLATE&text=...&dates=...&details=...&location=...&add=email1,email2`

**Configuration needed**: No API key required; uses URL-based link generation.

### 13.4 TeamUp

**What it connects**: Crew scheduling and shared team calendar.

**How data flows**:
- `lib/teamup-service.ts` provides bi-directional sync with TeamUp calendar
- Events created in the portal are pushed to TeamUp
- Events in TeamUp are pulled into the portal calendar view

**Configuration needed**:
- `TEAMUP_API_KEY` -- API key (configured: `ksgfxermrxee1jz1fw`)
- `TEAMUP_CALENDAR_KEY` -- Calendar identifier

### 13.5 GroupMe

**What it connects**: Team communication, notifications, and real-time chat.

**How data flows**:
- `lib/groupme-service.ts` handles all GroupMe API interactions
- Bot API posts automated notifications to group channels
- User API provides full chat, DM, group management capabilities
- Portal polls for new messages every 10 seconds
- Chat page at `/portal/chat` provides the full interface

**Configuration needed**:
- `GROUPME_ACCESS_TOKEN` -- User access token for full API access
- `GROUPME_BOT_ID` -- Bot ID for automated notifications
- `GROUPME_ENABLED` -- Set to `true` to enable

### 13.6 Google Apps Script

**What it connects**: Email notifications for form submissions.

**How data flows**:
1. Contact or referral form is submitted
2. `form-service.ts` sends data to the Google Apps Script endpoint
3. Apps Script formats and sends an email notification to the RCRS team
4. Confirmation recorded in the form submission log

**Configuration needed**:
- `NEXT_PUBLIC_GOOGLE_SCRIPT_ENDPOINT` -- The deployed Apps Script web app URL

### 13.7 NWS (National Weather Service)

**What it connects**: Real weather data for the Check My Address storm report system.

**How data flows**:
- `lib/weather-service.ts` queries NWS API for active alerts and forecasts
- Iowa State Mesonet provides historical hail report data
- `lib/storm-report-service.ts` combines data into risk assessments
- Weather forecasts available for customer portal via `/api/weather/forecast/[zipcode]`
- Weather alerts via `/api/weather/alerts/[zipcode]`

**Configuration needed**: No API key required; NWS API is public.

### 13.8 Google Analytics

**What it connects**: Website visitor tracking and behavior analytics.

**How data flows**:
- `components/TrackingProvider.tsx` loads GA script after cookie consent
- `lib/tracking-service.ts` provides consent-aware tracking functions
- Internal analytics tracked separately in `lib/analytics.ts`
- Page views and profile views logged to Google Sheets

**Configuration needed**:
- `NEXT_PUBLIC_GA_ID` -- Google Analytics measurement ID (G-Y8PB85BZC5)

### 13.9 Vercel Blob

**What it connects**: File and image storage for uploads.

**How data flows**:
- Admin file uploads via `/api/admin/upload` are stored in Vercel Blob
- Profile images, blog images, and delivery photos stored here
- Files served from Vercel's CDN for fast loading
- Upload API returns a public URL for the stored file

**Configuration needed**:
- `BLOB_READ_WRITE_TOKEN` -- Vercel Blob storage token

---

## 14. Data Flow Diagrams

### 14.1 Lead Lifecycle

```
LEAD SOURCES                    PROCESSING                      OUTCOME
-----------                    ----------                      -------
Website Contact Form  ------+
Check My Address      ------+---> /api/forms/contact
Referral Form         ------+    or /api/leads/new
Manual Entry (Office) ------+         |
JobNimbus Webhook     ------+         v
                              form-service.ts
                                      |
                        +-------------+-------------+
                        |             |             |
                        v             v             v
                  Google Sheets   Apps Script    GroupMe
                  (Lead record)   (Email to     (Team
                                   RCRS team)   notification)
                        |
                        v
               lead-distribution-service.ts
                        |
              +---------+---------+
              |                   |
              v                   v
        Check Rep            Score & Rank
        Availability         All Eligible Reps
              |                   |
              v                   v
        Round-Robin or      Proximity,
        Proximity-Based     Referral Bonus,
        Assignment          Close Rate, etc.
              |                   |
              +--------+----------+
                       |
                       v
               Assign to Rep
                       |
            +----------+----------+
            |          |          |
            v          v          v
      Lead_Distro    Notify     Update
      _Log Sheet     Rep via    JN Contact
                     GroupMe
                       |
                       v
              Rep Works the Lead
                       |
     +---------+-------+--------+---------+
     |         |                |         |
     v         v                v         v
  Contacted  Inspection     Quote Sent   Lost
             Scheduled          |
                |               v
                v           Won / Job
            Quote Sent      Created
                |               |
                v               v
              Won ----> Job in JobNimbus
                            |
                            v
                     Material Order
                            |
                            v
                     Delivery Ticket
                            |
                            v
                     Loading Checklist
                            |
                            v
                     Route / Delivery
                            |
                            v
                     Proof of Delivery
                            |
                            v
                     Invoice Generated
                            |
                            v
                     Payment Received
                            |
                            v
                     Customer Portal
                     (Job tracking,
                      documents,
                      weather alerts)
```

### 14.2 Material Order Flow

```
PM or Office Staff
        |
        v
/portal/orders/new
(Create Material Order)
        |
        v
Order saved to Google Sheets (Orders tab)
        |
        v
Delivery Ticket auto-created (Deliveries tab)
        |
        v
Office assigns Driver + schedules date
        |
        v
Driver receives notification
        |
        v
Driver opens Loading Checklist
  - Verify items against ticket
  - Photo documentation
  - Safety check
  - Digital acknowledgment
        |
        v
Status: Load Verified
        |
        v
Driver starts Route (/portal/delivery/route)
  - Optimized stop sequence
  - Google Maps navigation per stop
  - ETA calculations
        |
        v
At each stop:
  - Mark Arrived
  - Unload materials
  - Proof of Delivery (photos + signature)
  - Customer ETA notification
        |
        v
Status: Completed
        |
        v
Invoice generated from delivery ticket
        |
        v
Invoice sent to customer / office
        |
        v
Payment tracked in billing system
```

### 14.3 Monday Meeting Flow

```
Before Meeting:
  /command-center/meetings/prep
        |
        v
  Auto-pulls this week's data:
  - Revenue KPIs
  - Leaderboard standings
  - Lead pipeline
  - Inventory alerts
  - Team performance
  - Schedule overview
        |
        v
During Meeting:
  /command-center/meetings/present
        |
        v
  Slides-style view with:
  - KPI review
  - Leaderboard celebration
  - Team report walkthrough
  - Lead review
  - Inventory status
  - Schedule for the week
  - Action items
        |
        v
After Meeting:
  /command-center/meetings/archives
        |
        v
  Notes and decisions saved
  Action items assigned
  Follow-up reminders scheduled
```

---

## 15. Role-Based Access Reference

### Portal Access by Role

| Feature / Page | Owner | Admin | Manager | Sales | Office | PM | Driver | Viewer |
|---------------|:-----:|:-----:|:-------:|:-----:|:------:|:--:|:------:|:------:|
| Command Center Dashboard | Yes | Yes | Yes | Sales only | Yes | Partial | Partial | Partial |
| Sales Leaderboard | Yes | Yes | Yes | Yes | No | No | No | No |
| Financial Reports | Yes | Yes | No | No | No | No | No | No |
| Team Reports | Yes | Yes | Yes | No | No | No | No | Yes |
| Lead Management | Yes | Yes | Yes | Own only | Yes | Yes | No | No |
| Inventory (full) | Yes | Yes | Yes | Qty only | Yes | View | Adjust qty | No |
| Inventory Costs | Yes | Yes | Yes | No | No | No | No | No |
| Marketing Hub | Yes | Yes | No | No | No | No | No | No |
| Meeting Module | Yes | Yes | Yes | Yes | Yes | Yes | No | No |
| Phone System | Yes | Yes | Yes | Yes | Yes | No | No | No |
| Schedule | Yes | Yes | Yes | Yes | Yes | Yes | Own | No |
| Sales Portal | Yes | Yes | No | Yes | No | No | No | No |
| Office Portal | Yes | Yes | Yes | No | Yes | No | No | Yes |
| Delivery Management | Yes | Yes | Yes | No | No | Yes | No | No |
| Driver Portal | Yes | Yes | No | No | No | No | Yes | No |
| Billing | Yes | Yes | Yes | Own | Yes | No | No | No |
| Admin Dashboard | Yes | Yes | No | No | No | No | No | No |
| User Management | Yes | Yes | No | No | No | No | No | No |
| System Settings | Yes | Yes | No | No | No | No | No | No |
| Blog CMS | Yes | Yes | No | No | No | No | No | No |
| Service/Area CMS | Yes | Yes | No | No | No | No | No | No |
| Training | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Yes |
| Chat | Yes | Yes | Yes | Yes | Yes | Yes | Yes | No |
| Profile (own) | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Yes |
| Profile Approvals | Yes | Yes | View | No | No | No | No | No |

### Data Visibility by Role

| Data Type | Owner | Admin | Manager | Sales | Office | PM | Driver | Customer |
|-----------|:-----:|:-----:|:-------:|:-----:|:------:|:--:|:------:|:--------:|
| All Leads | Yes | Yes | Yes | No | Yes | Yes | No | No |
| Own Leads | Yes | Yes | Yes | Yes | Yes | No | No | No |
| Job Costs | Yes | Yes | Yes | No | No | No | No | No |
| Inventory Costs | Yes | Yes | Yes | No | No | No | No | No |
| Commissions | Yes | Yes | No | Own | No | No | No | No |
| All Deliveries | Yes | Yes | Yes | No | No | Yes | No | No |
| Own Deliveries | Yes | Yes | Yes | No | No | No | Yes | No |
| Financial Reports | Yes | Yes | No | No | No | No | No | No |
| User Management | Yes | Yes | No | No | No | No | No | No |
| System Settings | Yes | Yes | No | No | No | No | No | No |
| Customer Job Status | Yes | Yes | Yes | Assigned | Yes | Assigned | No | Own |
| Customer Documents | Yes | Yes | Yes | Assigned | Yes | No | No | Own |

### Command Center Module Access

| Module | Owner | Admin | Manager | Sales | Office | PM | Driver | Viewer |
|--------|:-----:|:-----:|:-------:|:-----:|:------:|:--:|:------:|:------:|
| Dashboard | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Yes |
| Sales | Yes | Yes | Yes | Yes | No | No | No | No |
| Inventory | Yes | Yes | Yes | No | Yes | Yes | No | No |
| Marketing | Yes | Yes | No | No | No | No | No | No |
| Phone | Yes | Yes | Yes | Yes | Yes | No | No | No |
| Meetings | Yes | Yes | Yes | Yes | Yes | Yes | No | No |
| Team | Yes | Yes | Yes | No | No | No | No | No |
| Leads | Yes | Yes | Yes | Yes | Yes | No | No | No |
| Reports | Yes | Yes | Yes | No | No | No | No | Yes |
| Billing | Yes | Yes | No | No | Yes | No | No | No |
| Schedule | Yes | Yes | Yes | Yes | Yes | Yes | No | No |
| Settings | Yes | Yes | No | No | No | No | No | No |

---

## 16. Team Directory

### Full Roster

| Name | Position | Email | Phone | Role | Portal PIN Location |
|------|----------|-------|-------|------|-------------------|
| Chris Muse | President | chrismuse@rcrsal.com | 256-648-1224 | owner | team-roles.ts (1138) |
| Michael Muse | Vice President | michaelmuse@rcrsal.com | 256-221-4290 | owner | team-roles.ts (1135) |
| Sara Hill | Office Manager | sara@rcrsal.com | 256-810-3594 | admin | team-roles.ts (1131) |
| Destin McCury | Admin | destin@rcrsal.com | 256-905-7738 | manager | team-roles.ts (1132) |
| Tia Morris | Admin | tia@rcrsal.com | 256-394-8396 | office | team-roles.ts (1133) |
| Boston | Marketing Director | boston@rcrsal.com | (via email) | office | (not in roles) |
| Hunter | Regional Partner (Birmingham) | hunter@rcrsal.com | 256-221-0548 | sales | team-roles.ts (2010) |
| Aaron | Regional Partner (Nashville) | aaron@rcrsal.com | 256-656-7856 | sales | team-roles.ts (2020) |
| Greg | Sales Inspector | greg@rcrsal.com | 256-221-1809 | sales | team-roles.ts (2030) |
| Brendon Muse | Sales Inspector | brendon@rcrsal.com | 256-616-6174 | sales | team-roles.ts (2040) |
| Rick | Sales Rep | rick@rcrsal.com | -- | sales | team-roles.ts (2050) |
| Rudy | Sales Rep | rudy@rcrsal.com | -- | sales | team-roles.ts (2060) |
| Adam | Sales Rep | adam@rcrsal.com | -- | sales | team-roles.ts (2070) |
| John Cordonis | Production Manager | john@rcrsal.com | 256-654-0875 | project_manager | team-roles.ts (1137) |
| Bart Roberts | Insurance Claims Specialist | bart@rcrsal.com | 256-654-0747 | project_manager | team-roles.ts (1134) |
| Tae Orr | Materials Manager | tae@rcrsal.com | 256-200-3467 | driver | team-roles.ts (2033) |
| Richard Geahr | Driver | richard@rivercityroofingsolutions.com | -- | driver | team-roles.ts (1136) |
| Travis | Sales Inspector | travis@rcrsal.com | -- | (public profile only) | -- |
| Donnie Dotson | Strategic Advisor | -- | -- | (public profile only) | -- |

**Primary Portal by Role**:
- **Owner/Admin**: Command Center + all portals
- **Manager**: Command Center + Office Portal
- **Sales**: Sales Portal
- **Office**: Office Portal
- **Project Manager**: PM Portal + Delivery Management
- **Driver**: Driver Portal

---

## 17. Administration Guide

### 17.1 Adding New Team Members

1. Open `lib/team-roles.ts` in the codebase
2. Add a new entry to the `TEAM_MEMBERS` array with:
   - Unique `id` (format: RVR-###)
   - `name`, `slug`, `email`
   - `role` (one of: owner, admin, manager, sales, office, project_manager, driver, viewer)
   - `pin` (unique 4-digit PIN for portal login)
   - `isActive: true`
   - `permissions` array (use `['*']` for full access or specific permission strings)
3. To add a public profile, also add an entry to `lib/teamData.ts` with bio, photo, etc.
4. Deploy the change to Vercel
5. The new member can log in immediately with their email + PIN

### 17.2 Changing Roles and Permissions

1. Find the team member in `lib/team-roles.ts`
2. Update their `role` field to the new role
3. Update their `permissions` array to match the new role's access level
4. For temporary overrides, use the Team Access Overrides system:
   - Admin pages at `/portal/admin/team` allow per-user module overrides
   - Overrides are stored in the `Team_Access_Overrides` Google Sheets tab
   - Overrides add or remove specific Command Center modules without changing the base role

### 17.3 Updating Portal Settings

- **Admin settings page**: `/portal/admin/operations`
- **API**: `GET/POST /api/admin/settings` -- reads/writes settings JSON file
- **System status**: `/api/admin/system` -- system health and status
- **Feature flags**: `/api/admin/system/features` -- toggle features on/off
- **Maintenance mode**: `/api/admin/system/maintenance` -- enable/disable maintenance banner

### 17.4 Managing Lead Distribution Rules

1. Go to `/portal/admin/lead-distro` (admin only) or `/portal/manager/lead-controls` (manager)
2. **Algorithm weights** (admin only):
   - Install Proximity: how much weight to give geographic closeness to rep's past installs
   - Contact Proximity: closeness to rep's existing contacts
   - Door Knock Recency: bonus for recent activity in the area
   - Referral Bonus: extra weight for referral leads
   - Meeting Attendance: reward reps who attend meetings
   - Close Rate: favor reps with higher close rates
   - Response Time: favor reps who respond quickly
3. **Thresholds**:
   - Proximity radius (miles)
   - Recent interaction window (days)
   - Minimum reps for distribution
4. **Rep availability** (manager): Toggle individual reps on/off for lead receiving
5. All changes are logged with the admin's ID and timestamp

### 17.5 Blog and Content Management

- **Blog CMS**: `/portal/admin/blog` -- create, edit, and manage blog posts
- **Data source**: Blog posts in Google Sheets (`blog-posts` tab) or static `lib/blogData.ts`
- **Image uploads**: Use `/portal/admin/images` to upload and manage images via Vercel Blob
- **Categories**: Assign categories and keywords for SEO

### 17.6 Image Library Management

- **Image library**: `/portal/admin/images` -- upload, browse, and manage all images
- **Storage**: Vercel Blob (`BLOB_READ_WRITE_TOKEN`)
- **Formats**: PNG, JPG, JPEG, WebP supported
- **Usage**: Images are referenced by URL in blog posts, team profiles, and service pages

### 17.7 Service Area Management

- **Admin page**: `/portal/admin/areas` -- add, edit, and manage service areas
- **Data source**: `lib/servicesData.ts` (static) and Google Sheets (CMS)
- **Fields**: Name, slug, status (Active/Expansion), state, coverage, response time, regional partner
- **Map integration**: Map query string for embedded Google Maps

### 17.8 Common Admin Tasks

| Task | Where to Do It |
|------|---------------|
| Reset a user's PIN | Edit `lib/team-roles.ts` and redeploy |
| Disable a user | Set `isActive: false` in team-roles.ts |
| View audit log | `/api/admin/system/audit-log` |
| Check system health | `/api/admin/system` |
| Rotate API keys | Update environment variables in Vercel dashboard |
| Enable maintenance mode | `/api/admin/system/maintenance` POST |
| Manage feature flags | `/api/admin/system/features` |
| Upload files | `/portal/admin/images` or `/api/admin/upload` |

---

## 18. Configuration Reference

### 18.1 Environment Variables

All environment variables are managed in `.env.local` for local development and in the Vercel dashboard for production.

**Authentication & Security**:
| Variable | Description | Status |
|----------|-------------|--------|
| `ADMIN_PASSWORD` | Admin login password | Required |
| `JWT_SECRET` | 128-char hex string for JWT signing | Required |
| `AUTH_BYPASS_MODE` | Set `true` to skip auth (testing only) | Set to `true` -- disable before launch |

**Google Integration**:
| Variable | Description | Status |
|----------|-------------|--------|
| `GOOGLE_SERVICE_ACCOUNT_EMAIL` | Service account email for Sheets API | Configured |
| `GOOGLE_PRIVATE_KEY` | Service account private key | Configured |
| `GOOGLE_SHEETS_ID` | Main Google Sheets spreadsheet ID | Configured |
| `NEXT_PUBLIC_GOOGLE_SCRIPT_ENDPOINT` | Apps Script web app URL | Configured |
| `NEXT_PUBLIC_GA_ID` | Google Analytics ID (G-Y8PB85BZC5) | Configured |

**CRM & External APIs**:
| Variable | Description | Status |
|----------|-------------|--------|
| `JOBNIMBUS_API_KEY` | JobNimbus CRM API key | Configured |
| `JOBNIMBUS_API_URL` | JobNimbus API base URL | Configured |
| `GROUPME_ACCESS_TOKEN` | GroupMe user access token | Configured |
| `GROUPME_BOT_ID` | GroupMe bot ID for notifications | Not yet configured |
| `GROUPME_ENABLED` | Enable GroupMe integration | Set to `true` |
| `TEAMUP_API_KEY` | TeamUp calendar API key | Configured (ksgfxermrxee1jz1fw) |
| `TEAMUP_CALENDAR_KEY` | TeamUp calendar identifier | Not yet configured |

**Storage & Hosting**:
| Variable | Description | Status |
|----------|-------------|--------|
| `BLOB_READ_WRITE_TOKEN` | Vercel Blob storage token | Configured |
| `GITHUB_TOKEN` | GitHub access token for deployment | Configured |
| `NEXT_PUBLIC_SITE_URL` | Public site URL | Configured |
| `NEXT_PUBLIC_BASE_URL` | Base URL for API calls | Configured |

**Company Info**:
| Variable | Description | Status |
|----------|-------------|--------|
| `NEXT_PUBLIC_COMPANY_NAME` | "River City Roofing Solutions" | Configured |
| `NEXT_PUBLIC_COMPANY_PHONE` | "(256) 274-8530" | Configured |
| `NEXT_PUBLIC_COMPANY_LOCATION` | "Decatur, AL" | Configured |

**Not Yet Configured** (post-launch):
| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_FB_PIXEL_ID` | Facebook Pixel for ad tracking |
| `NEXT_PUBLIC_GOOGLE_ADS_ID` | Google Ads conversion tracking |
| `TWILIO_ACCOUNT_SID` | Twilio SMS account SID |
| `TWILIO_AUTH_TOKEN` | Twilio SMS auth token |
| `SENDGRID_API_KEY` | SendGrid email service |

### 18.2 Google Sheets Setup

**Required structure**: The main Google Sheets spreadsheet must have the following tab names (case-sensitive):

```
team-members-import
Inventory
InventoryLogs
Commissions
Customers
Orders
Deliveries
Geocoded_Contacts
Lead_Distribution_Log
Rep_Availability
Rep_Preferences
Lead_Response_Log
Job_Breakdowns
Team_Access_Overrides
Agent_Directory
Agent_Visits
Training_Progress
Storm_Reports
blog-posts
images
settings
page-views
profile-views
```

**Service account permissions**: The Google service account email must have Editor access to the spreadsheet.

### 18.3 JobNimbus API Configuration

- API key is passed as a Bearer token in the Authorization header
- Base URL points to the JobNimbus REST API
- API supports: GET contacts, jobs, estimates, tasks, notes; POST for creating/updating records
- Webhook endpoint at `/api/webhooks/jobnimbus` receives inbound notifications

### 18.4 GroupMe Setup

1. Create a GroupMe bot at https://dev.groupme.com/bots
2. Set the bot's group to your RCRS team group
3. Copy the bot ID to `GROUPME_BOT_ID`
4. Get an access token from https://dev.groupme.com/
5. Set `GROUPME_ACCESS_TOKEN`
6. Set `GROUPME_ENABLED=true`

### 18.5 TeamUp Setup

1. Create a TeamUp calendar at https://www.teamup.com/
2. Get the API key from calendar settings
3. Set `TEAMUP_API_KEY` and `TEAMUP_CALENDAR_KEY`

### 18.6 Phone System Configuration

- Phone extensions and configuration managed at `/command-center/phone/manage`
- 8 extensions configured for team members
- Call tracking and voicemail at `/command-center/phone/calls`

### 18.7 Google Analytics Setup

- Measurement ID: G-Y8PB85BZC5
- Set `NEXT_PUBLIC_GA_ID=G-Y8PB85BZC5`
- Tracking respects cookie consent; only fires after user accepts

---

## 19. Troubleshooting

### 19.1 Authentication Issues

**"I can't log in to the admin dashboard"**
- Verify `ADMIN_PASSWORD` is set in environment variables
- Check that `JWT_SECRET` is set (128-char hex string)
- If `AUTH_BYPASS_MODE=true`, authentication is skipped (for testing only)
- Clear browser cookies and try again
- Check browser console for error messages

**"I can't log in to the portal"**
- Portal login requires both email AND 4-digit PIN
- PINs are stored in `lib/team-roles.ts` -- look up the user's PIN there
- Email must match exactly (case-insensitive comparison)
- User must have `isActive: true` in team-roles.ts
- If the user is not in team-roles.ts, they cannot log in

**"Customer portal link is not working"**
- Customer tokens are stored in the `Customers` Google Sheets tab
- Verify the token exists and matches the URL
- Tokens are generated by `lib/portal-generator.ts`
- Check that the Customers sheet is accessible by the service account
- URL format: `/my/[token]` -- the token is the unique identifier

### 19.2 Data Issues

**"Leads are not showing up"**
- Check lead distribution rules at `/portal/admin/lead-distro`
- Verify Google Sheets API connection (service account permissions)
- Check the `Lead_Distribution_Log` sheet for errors
- Ensure at least one rep has availability set to "on" in `Rep_Availability`
- If using JobNimbus webhooks, verify the webhook endpoint is reachable

**"Inventory is not updating"**
- Check Google Sheets API connection first
- Verify the `Inventory` tab exists in the spreadsheet
- Service account must have Editor (not Viewer) access
- Check `InventoryLogs` sheet for recent entries
- If syncing fails, the system falls back to static data from `lib/inventoryData.ts`

**"Commissions are wrong or not showing"**
- Commission data is in the `Commissions` Google Sheets tab
- Verify the tab exists and has data
- Check that rep names/slugs match between team-roles.ts and the Commissions sheet
- JobNimbus job values must sync correctly for commission calculations

### 19.3 Integration Issues

**"Chat is not loading"**
- Check that `GROUPME_ENABLED=true` in environment variables
- Verify `GROUPME_ACCESS_TOKEN` is set and valid
- GroupMe tokens can expire; re-authenticate if needed
- Check browser console for API errors
- The chat page polls every 10 seconds; allow time for initial load

**"JobNimbus data is not syncing"**
- Verify `JOBNIMBUS_API_KEY` is still valid
- Check `JOBNIMBUS_API_URL` is correct
- Test the connection at `/api/admin/jobnimbus/test`
- Large sync operations may time out on Vercel (10-second limit for serverless functions)
- Check the sync engine logs for specific errors

**"Google Sheets data is stale"**
- The server caches Sheets data; wait a few minutes or trigger a manual sync
- Check that the service account has not been revoked
- Verify the Google Sheets ID is correct
- Private key must have newlines properly escaped (`\n` in the env var)

**"Calendar events are not creating"**
- Google Calendar uses URL links (not API calls); verify the link opens correctly
- Check that attendee emails are valid @rcrsal.com addresses
- Team member email resolution depends on matching names in teamData.ts

### 19.4 Build and Deployment Issues

**"Build is failing"**
- Run `npm run build` locally to see errors
- Most common: TypeScript errors, missing imports, or undefined variables
- Dynamic route warnings are normal and do not indicate errors
- Ensure all environment variables are set in the Vercel dashboard

**"Page is showing 404"**
- Check that the page exists in the `app/` directory
- For dynamic routes ([slug], [id], [token]), verify the parameter is being passed
- Check `next.config.js` for any redirect or rewrite rules

**"Images are not loading"**
- Verify images exist in the `public/uploads/` directory or Vercel Blob
- Check `next.config.js` `remotePatterns` for allowed image domains
- Use `next/image` component (not raw `<img>` tags) for optimization

### 19.5 Performance Issues

**"Pages are loading slowly"**
- Check Vercel Speed Insights for performance data
- Large Google Sheets reads can be slow; caching layer should help
- Ensure images are optimized (compressed, correct format)
- Some blog images are 5-6MB and should be compressed
- Server-side cache (`lib/cache.ts`) reduces repeat API calls

---

## 20. Glossary

| Term | Definition |
|------|-----------|
| **RCRS** | River City Roofing Solutions -- the company and brand |
| **rcrsal.com** | Company Google Workspace domain |
| **brand-green** | #39FF14 neon green, the RCRS brand color used throughout the UI |
| **Command Center** | The executive dashboard for owners, admins, and managers |
| **Portal** | The internal operations system for all team members |
| **Customer Portal** | The external-facing portal for customers to track their job |
| **JWT** | JSON Web Token -- used for admin authentication |
| **PIN** | 4-digit Personal Identification Number used for portal login |
| **RBAC** | Role-Based Access Control -- the permission system |
| **SSG** | Static Site Generation -- pages built at deploy time for speed |
| **SSR** | Server-Side Rendering -- pages built on each request |
| **JobNimbus (JN)** | The external CRM system used for contact and job management |
| **Google Sheets** | The primary database backend for operational data |
| **Vercel Blob** | Cloud file storage service for images and documents |
| **GroupMe** | Team messaging platform integrated for chat and notifications |
| **TeamUp** | Shared calendar platform for crew scheduling |
| **NWS** | National Weather Service -- provides storm and weather data |
| **Check My Address** | Public lead capture tool that generates storm risk reports |
| **Lead Distribution** | Algorithm that automatically assigns incoming leads to sales reps |
| **Delivery Ticket** | A tracking record for a material delivery from warehouse to job site |
| **Loading Checklist** | Driver verification process before departing on deliveries |
| **Proof of Delivery** | Photos, signature, and notes captured at the delivery location |
| **ETA** | Estimated Time of Arrival -- calculated for each delivery stop |
| **SKU** | Stock Keeping Unit -- unique identifier for an inventory product |
| **MTD** | Month-to-Date -- revenue or metrics for the current month so far |
| **YTD** | Year-to-Date -- revenue or metrics for the current year so far |
| **Pipeline** | Total value of active leads and quotes that have not yet closed |
| **Close Rate** | Percentage of leads that result in a won job |
| **Commission** | Sales rep compensation based on job revenue |
| **BNI** | Business Network International -- professional networking organization |
| **IKO** | Roofing material manufacturer (Dynasty, Nordic, Royal Estate lines) |
| **LeafX** | Brand of gutter protection guards installed by RCRS |
| **TPO** | Thermoplastic Olefin -- commercial roofing membrane material |
| **EPDM** | Ethylene Propylene Diene Monomer -- rubber roofing membrane |
| **Bullet Boot** | Pipe boot flashing used to seal around roof penetrations |
| **Syn Felt** | Synthetic underlayment felt used beneath shingles |
| **Ice & Water Shield** | Self-adhering waterproof membrane for roof protection |
| **Ridge Vent** | Ventilation component installed at the roof peak |
| **JSON-LD** | JSON for Linking Data -- structured data format for SEO |
| **OG Tags** | Open Graph tags -- metadata for social media link previews |
| **Canonical URL** | The authoritative URL for a page, used to prevent duplicate content |
| **Apps Script** | Google Apps Script -- serverless functions for Google Workspace |
| **Webhook** | HTTP callback that pushes data from one system to another in real time |
| **HMAC** | Hash-based Message Authentication Code -- used to verify webhook authenticity |
| **Rate Limiting** | Restricting the number of requests per time period to prevent abuse |
| **Feature Flag** | Toggle that enables or disables a specific feature without code deployment |
| **Maintenance Mode** | System state where the platform shows a maintenance banner and limits access |
| **Audit Trail** | Chronological record of who did what, when, used for accountability |

---

*This document was last updated February 2026. For the most current information, check the PUNCHOUT-LIST.md in the project root and the ARCHITECTURE.md in the lib/ directory.*

*River City Roofing Solutions -- www.rivercityroofingsolutions.com -- (256) 274-8530 -- rcrs@rivercityroofingsolutions.com*
