# RCRS Platform Capabilities Report

**River City Roofing Solutions | www.rivercityroofingsolutions.com**
**Report Version:** February 2026
**Classification:** Internal Reference Document
**Contact:** rcrs@rivercityroofingsolutions.com | (256) 274-8530

---

## Executive Summary

The RCRS Platform is a fully custom-built, enterprise-grade digital operations system that unifies every aspect of River City Roofing Solutions' business -- from public-facing marketing and lead generation through internal sales management, material delivery logistics, billing, and team training -- into a single web application accessible from any browser or mobile device. Built on Next.js 14.2.33 with React 18, TypeScript, and Tailwind CSS, and deployed on Vercel's edge network, the platform encompasses 367+ pages, 180+ API routes, 85+ reusable components, and 95+ library/service files, integrating with Google Sheets (17+ tabs), JobNimbus CRM (2-way sync), GroupMe team chat, Google Calendar, TeamUp, NWS weather data, Google Analytics, and Vercel Blob storage to deliver a seamless operational experience for all 17 team members across 7 distinct role levels.

---

## Table of Contents

1. [Platform Architecture](#1-platform-architecture)
2. [Scale Metrics](#2-scale-metrics)
3. [Section 1: Public Website](#3-section-1-public-website)
4. [Section 2: Check My Address](#4-section-2-check-my-address)
5. [Section 3: Command Center](#5-section-3-command-center)
6. [Section 4: Sales Portal](#6-section-4-sales-portal)
7. [Section 5: Office Portal](#7-section-5-office-portal)
8. [Section 6: Delivery & Driver Portal](#8-section-6-delivery--driver-portal)
9. [Section 7: Inventory & Materials Management](#9-section-7-inventory--materials-management)
10. [Section 8: Billing & Invoicing](#10-section-8-billing--invoicing)
11. [Section 9: Training & Onboarding](#11-section-9-training--onboarding)
12. [Customer Portal](#12-customer-portal)
13. [Security Features](#13-security-features)
14. [Performance & Reliability](#14-performance--reliability)

---

## 1. Platform Architecture

### Technology Stack

| Layer | Technology | Details |
|-------|-----------|---------|
| **Framework** | Next.js 14.2.33 | Full-stack React framework with SSR, SSG, and API routes |
| **UI Library** | React 18 | Component-based UI with hooks and concurrent features |
| **Language** | TypeScript | Type-safe JavaScript across frontend and backend |
| **Styling** | Tailwind CSS | Utility-first CSS with custom `brand-green` (#39FF14) theme |
| **UI Components** | shadcn/ui | Pre-built accessible component library |
| **Hosting** | Vercel | Edge network deployment with auto-deploy from GitHub |
| **Project ID** | prj_7s9kclvyqkMQhOHS4fHWpBJLEruG | Vercel project identifier |
| **Database** | Google Sheets | 17+ tabs via service account (JWT auth) |
| **CRM** | JobNimbus | 2-way sync engine for contacts, jobs, notes |
| **File Storage** | Vercel Blob | CDN-backed document and image storage |
| **Chat** | GroupMe API | Team messaging with bot notifications |
| **Calendar** | Google Calendar + TeamUp | URL-based event creation + bi-directional sync |
| **Analytics** | Google Analytics | G-Y8PB85BZC5 with consent-aware tracking |
| **Weather Data** | NWS / Iowa State Mesonet | Storm reports, hail data, active alerts |
| **Email** | Google Apps Script | Form notification automation |
| **Phone** | FreePBX / Google Voice | 8 extensions configured |

### Deployment Architecture

- **Auto-deploy**: GitHub push to main branch triggers Vercel build and deploy
- **Environment**: Environment variables managed in Vercel dashboard
- **CDN**: Static assets served from Vercel's global edge network
- **Serverless Functions**: API routes run as Vercel serverless functions (10s timeout)
- **Domain**: www.rivercityroofingsolutions.com
- **Google Workspace Domain**: rcrsal.com
- **Headquarters**: 3325 Central Pkwy SW, Decatur, AL 35603
- **Brand Color**: #39FF14 (neon green), mapped to `brand-green` in Tailwind config
- **Founded**: 2010

---

## 2. Scale Metrics

| Metric | Count | Notes |
|--------|-------|-------|
| **Total Pages** | 367+ | Public + portal + admin |
| **API Routes** | 180+ | REST endpoints powering all features |
| **React Components** | 85+ | Reusable UI components |
| **Library/Service Files** | 95+ | Business logic, integrations, utilities |
| **Blog Articles** | 68 | SEO-optimized roofing content |
| **Team Member Profiles** | 17 | Public-facing professional profiles |
| **Service Pages** | 11 | Primary (8) + Additional (3) |
| **Service Area Pages** | 8 | Active (6) + Expansion (2) |
| **Location Pages** | 3 | Huntsville, Madison, Decatur |
| **Inventory Products** | 11 | Tracked roofing materials |
| **Google Sheets Tabs** | 22+ | Operational (17+) + CMS (5) data tabs |
| **Training Modules** | 7 | Sales training course |
| **Onboarding Sections** | 8 | Interface walkthrough |
| **Phone Extensions** | 8 | Configured team extensions |
| **Deep Integrations** | 5 | Sheets, JobNimbus, GroupMe, Calendar, TeamUp |
| **Team Members with Access** | 17+ | Across 7 role levels |
| **Historical Transactions** | 4,199+ | Sales data tracked since 2019 |
| **Total Revenue Tracked** | $2.6M+ | Commission and deal data |

---

## 3. Section 1: Public Website

**URL:** https://www.rivercityroofingsolutions.com
**Page Count:** 300+ pages
**Purpose:** Customer-facing marketing website, lead generation, and SEO presence

### Features

#### Homepage
- Animated hero section with video background
- Primary CTA: "Get Your Free Inspection"
- Service highlight cards with icons and descriptions
- "Why Choose RCRS" trust signals section
- Rotating customer testimonials from verified customers
- Interactive service area map display
- Inline contact form (submits to Google Sheets + triggers email notification)
- Promotional banner for seasonal offers or announcements
- Floating contact button (fixed-position CTA follows scroll)
- Cookie consent banner (GDPR-compliant, gates analytics tracking)

#### Blog System (68 Articles)
- **URL:** `/blog` and `/blog/[slug]`
- Full-text articles covering: roofing materials, storm damage, maintenance tips, insurance claims, local guides
- Blog index page with search and category filtering
- Related articles recommendations on each post
- Author attribution (Chris Muse, Michael Muse, other team members)
- Article JSON-LD schema with author, datePublished, breadcrumbs
- Data source: `lib/blogData.ts` (TypeScript) with CMS management at `/portal/admin/blog`

#### Team Pages (17 Profiles)
- **URL:** `/team` and `/team/[slug]`
- Professional photos, position titles, taglines
- Full bios with key strengths and responsibilities
- Social media links and contact information
- **Categories:** Leadership, Regional Partners, Office, Production, Partners & Advisors, In Loving Memory (Danny Ray "Pops" Muse)
- Person JSON-LD schema with worksFor
- Admin CMS: `/portal/admin/team`

#### Service Pages (11 Services)
- **URL:** `/services` and `/services/[slug]`
- **Primary Services (8):**
  1. Residential Roof Replacement -- $5,000-$25,000+, 1-3 day timeline
  2. Residential Roof Repair -- $300-$5,000, same-day to 2 weeks
  3. Commercial Roofing -- TPO, EPDM, modified bitumen, metal
  4. Storm & Hail Damage Repair -- 24/7 emergency, insurance claim support
  5. Chimney Services -- $300-$800 per chimney
  6. LeafX Gutter Protection -- $1,500-$5,000+, lifetime clog-free guarantee
  7. Roof Inspections & Maintenance -- $150-$500 per inspection
  8. Emergency Roof Services -- $500-$5,000, 24/7 availability
- **Additional Services (3):**
  9. Gutter Repair and Replacement -- $400-$3,000+
  10. Attic Ventilation Solutions -- $500-$2,000
  11. Roof Coating and Treatment -- $1-$3 per square foot
- Each page includes: description, what's included, materials, timeline, cost range, benefits, ideal-for list, CTA
- Service JSON-LD schema with provider, areaServed
- Admin CMS: `/portal/admin/services`

#### Location Pages (3 Dedicated)
- `/locations/huntsville` -- Huntsville, AL (population ~215,000)
- `/locations/madison` -- Madison, AL (population ~42,000)
- `/locations/decatur` -- Decatur, AL (headquarters, same-day service)
- LocalBusiness + FAQ + BreadcrumbList JSON-LD
- Unique customer reviews, service availability, response times, localized CTAs

#### Service Area Pages (8 Total)
- **Active Areas (6):**
  1. Decatur, AL -- Headquarters, same-day response
  2. Huntsville, AL -- Major market, 1-2 day response
  3. Madison, AL -- Growing suburb, 1-2 day response
  4. Athens, AL -- College town, 1-2 day response
  5. Owens Crossroads, AL -- Residential focus, 1-2 day response
  6. North Alabama (General) -- Broader territory, 2-3 day response
- **Expansion Areas (2):**
  7. Birmingham, AL -- Regional partner Hunter, launched Q4 2025
  8. Nashville, TN -- Regional partner Aaron, planned 2026

#### Contact & Lead Capture Forms
- **Contact Form** (`/contact`): Name, email, phone, address, service needed, message
  - Flow: Client validation -> `POST /api/forms/contact` -> `form-service.ts` -> Google Sheets (Contacts tab) -> Google Apps Script email notification -> GroupMe team notification -> Redirect to `/contact/thank-you`
- **Referral Program** (`/referral-rewards`): Referrer + referred person forms, reward calculator
  - Flow: `POST /api/forms/referral` -> Google Sheets -> team notification
- **BNI Page** (`/bni`): Business Networking International partnership page (Aaron is BNI chapter president)

#### SEO System
- Centralized in `lib/seo.ts` with `generateMetadata()` function
- `components/StructuredData.tsx` renders JSON-LD script tags
- **Schema types used on public pages:**
  - Homepage: RoofingContractor (LocalBusiness subtype)
  - Blog posts: Article with author, datePublished
  - Team profiles: Person with worksFor
  - Service pages: Service with provider, areaServed
  - Location pages: LocalBusiness + FAQ + BreadcrumbList
  - Index pages: CollectionPage + BreadcrumbList
- OpenGraph and Twitter Card metadata on all pages
- Canonical URLs to prevent duplicate content
- Auto-generated sitemap covering all public pages
- robots.txt blocks portal/admin pages from search indexing
- `siteConfig` object centralizes: company name, URLs, phone, address, social links, business hours

#### Analytics
- Google Analytics G-Y8PB85BZC5 on all public pages
- `components/TrackingProvider.tsx` with consent-aware loading
- `components/CookieConsent.tsx` GDPR-style consent banner (analytics only fires after consent)
- Internal analytics tracked to Google Sheets (`page-views` and `profile-views` tabs)
- `lib/tracking-service.ts` provides consent-aware tracking functions

---

## 4. Section 2: Check My Address

**URL:** `/check-my-address`
**Also linked from:** Header navigation, footer, homepage CTA
**Purpose:** Public lead capture tool providing genuine hail/storm risk reports to homeowners

### Input Fields
- Street address (required)
- City (required)
- State (dropdown, SE US states focused: AL, TN, GA, MS, FL, KY, NC, SC)
- ZIP code (required)
- Name (required -- lead capture)
- Email (required -- lead capture)
- Phone (required -- lead capture)

### Processing Pipeline
1. User submits address + contact info
2. `POST /api/storm-report` receives the request
3. `lib/storm-report-service.ts` processes:
   - Queries NWS (National Weather Service) for active weather alerts in the area
   - Queries Iowa State Mesonet for historical hail reports within configurable radius
   - Queries wind event data
   - Runs risk scoring algorithm

### Risk Scoring Algorithm (0-100 Scale)

| Score Range | Risk Level | Color Code |
|-------------|-----------|------------|
| 0-25 | Low | Green |
| 26-50 | Moderate | Yellow |
| 51-75 | High | Orange |
| 76-100 | Severe | Red |

**Factors that increase the score:**
- Number of hail reports in the radius (more = higher)
- Proximity of closest hail event (closer = higher)
- Size of largest hail (bigger = higher)
- Recency of events (more recent = higher)
- Active weather alerts in the area
- Wind events in the area

### Output (Storm Report)
- **Risk score**: 0-100 numeric value
- **Risk level**: Low / Moderate / High / Severe
- **Total hail reports**: Count of hail events found
- **Closest hail distance**: Miles from address to nearest hail report
- **Largest hail size**: Diameter of the largest hail event found
- **Hail events timeline**: 10 most recent events with date, size, severity, distance, location, county
- **Wind events**: Associated wind event listings
- **Active alerts**: Current NWS weather alerts
- **Risk factors**: Plain-English explanation of what drives the score
- **Recommendation**: Suggested action (e.g., "Schedule a free inspection")
- **Call-to-action**: Schedule a free inspection with RCRS

### Lead Generation
- Auto-creates lead record with storm data attached
- Lead includes all contact info + full storm report
- Stored in Google Sheets (Lead record + `Storm_Reports` tab)
- Optionally synced to JobNimbus

### Sales Use Case
Sales reps use Check My Address as a door-knocking tool:
1. Pull up the address on their phone at the door
2. Show the homeowner their personalized storm report
3. Point to specific hail events near their home
4. Offer a free inspection to assess actual damage

---

## 5. Section 3: Command Center

**URL:** `/command-center`
**Access:** Owner, Admin, Manager (sales see limited views)
**Purpose:** Executive nerve center providing real-time visibility into all business operations

### 5.1 Executive Dashboard (`/command-center`)

**KPI Cards (top row):**
- Revenue MTD (month-to-date) with month-over-month growth %
- Revenue YTD (year-to-date)
- Gross Margin % and gross profit
- Pipeline Value (potential revenue in active leads/quotes)
- Net Cash Flow
- Accounts Receivable with overdue amount highlighted

**Operational Stats:**
- Today's Sales
- Active Jobs count
- Low Stock Alerts
- Team Active count

**Team Performance Section:**
- Per-rep stats: sales count, revenue, close rate
- Top performer highlight
- Underperforming rep alerts
- Lead comparison: this week vs. last week

**Revenue Trend Chart:**
- 12-month bar chart showing monthly revenue progression

**Insights Panel:**
- 6 AI-generated business insight cards
- Alerts for unusual patterns (revenue spikes, drops)

**Today's Schedule:**
- Upcoming inspections, deliveries, and meetings

**Quick Actions:**
- One-click navigation to all Command Center sub-sections

### 5.2 Sales Leaderboard (`/command-center/sales`)
- All reps ranked by revenue, close rate, or transaction count
- "Rep DNA" -- individual performance profile showing strengths
- Achievement wall with milestones and badges
- Historical data: **$2.6M+ total revenue, 4,199+ transactions** (2019-2026)
- Period filtering: month, quarter, year
- Component: `components/Leaderboard.tsx`

### 5.3 Financial Reports (`/command-center/reports/financial`)
- Revenue MTD and YTD with detailed breakdowns
- Gross margins by service type
- Cash flow analysis
- Invoice aging reports (30/60/90 day buckets)
- Overdue invoice alerts with amounts
- Commission summaries by rep
- Printable report generation

### 5.4 Team Reports (`/command-center/reports/team`)
- Cross-team performance comparison
- Individual rep performance cards
- Printable format for Monday meetings
- Period filtering (this week, this month, this quarter, custom)
- Printable at `/command-center/reports/team`

### 5.5 Lead Management (`/command-center/leads`)
- Company-wide lead dashboard
- Search/filter by status, source, assigned rep, date range
- Quick-assign to available reps
- Lead distribution algorithm settings (admin view)
- Lead source analytics: website, referral, door knock, Check My Address
- Geographic mapping of lead locations
- Lead lifecycle tracking: New -> Contacted -> Inspection Scheduled -> Quote Sent -> Won / Lost

### 5.6 Inventory Overview (`/command-center/inventory`)
- Stock levels across 11 product categories
- Low stock alerts with reorder thresholds
- Individual SKU detail pages (`/command-center/inventory/[sku]`)
- Cost tracking with role-based visibility (owners/managers see costs; others see quantities only)
- Category breakdown: Fasteners, Underlayment, Ventilation, Flashing, Sealants
- Reorder thresholds and supplier info

### 5.7 Marketing Hub (`/command-center/marketing`)
- Q1 2026 campaign plan with 10 ad variations
- **Ad management:** Facebook/Instagram, Google Ads, Print
  - Ads dashboard: `/command-center/marketing/ads`
- **Email campaigns:** 5 pre-built templates
  - Email management: `/command-center/marketing/emails`
- **Content calendar:** `/command-center/marketing/calendar`
- Copy management for consistent messaging

### 5.8 Meeting Module (`/command-center/meetings`)
- **Prep** (`/command-center/meetings/prep`): Auto-pulls weekly data -- Revenue KPIs, leaderboard standings, lead pipeline, inventory alerts, team performance, schedule overview
- **Present** (`/command-center/meetings/present`): Slides-style presentation mode for live team meetings
- **Archives** (`/command-center/meetings/archives`): Historical meeting notes, outcomes, action items
- Stats: Meeting frequency, attendance, action item completion
- Agenda builder and checklist tools

### 5.9 Phone System (`/command-center/phone`)
- **8 extensions** configured and monitored
- Call history (`/command-center/phone/calls`): Search and filter inbound/outbound
- Extension detail (`/command-center/phone/[extension]`): Individual extension management
- Voicemail management
- Configuration (`/command-center/phone/manage`): Phone system settings
- Analytics: Call volume trends, average duration, busiest hours

### 5.10 Additional Sub-Sections
- **Schedule** (`/command-center/schedule`): Master calendar with all events
- **Billing** (`/command-center/billing`): Invoice overview, breakdowns, financial data
- **Documents** (`/command-center/documents`): Shared document library
- **Agents** (`/command-center/agents`): Insurance agent directory and visit tracking

---

## 6. Section 4: Sales Portal

**URL:** `/portal/sales`
**Access:** Sales reps (own data), owners/admins/managers (all data)
**Purpose:** Mobile-first field sales command center

### 6.1 Sales Dashboard (`/portal/sales`)
- Personalized welcome with hot streak indicator
- **Monthly Commission Progress**: Visual progress bar toward goals
- **Quick Stats:** Active Leads, Deals Closed, Rank, Commission earned
- **Team Comparison:** Percentage above/below team average
- **Commission Summary:** Earned (green), Pending (yellow), Avg Deal Size
- **Quick Actions:** Quick Call, Schedule Inspection, Send Quote, Upload Photo
- **Priority Leads:** Urgent/High priority leads with inline actions (Call, Text, Send Portal Link, Details)
- **Recent Activity:** Timeline of latest commissions, deals, lead updates
- **Today's Inspections:** Scheduled appointments with map navigation
- **Mobile Bottom Nav:** Home, Leads, Quick Call (center button), Stats, Portal

### 6.2 Lead Management (`/portal/sales/leads`)
- **Status workflow:** New -> Contacted -> Inspection Scheduled -> Quote Sent -> Won / Lost
- Search by name, address, phone, email
- Filters: Status, source, date range, assigned rep (managers see all)
- Lead detail: Full contact info, interaction history, notes, status updates
- Inline actions: Change status, add note, schedule inspection, send quote
- Lead preference settings: Territory, notification frequency
- Priority sorting (Urgent / High / Normal)

### 6.3 Customer CRM (`/portal/sales/customers`)
- JobNimbus 2-way sync of contacts, jobs, notes
- Customer detail page (`/portal/sales/customers/[id]`) with **6 tabs:**
  1. **Overview**: Contact info, address, status, source
  2. **Jobs**: Associated JobNimbus job records
  3. **Notes**: Communication log and internal notes
  4. **Documents**: Shared documents (estimates, contracts, photos)
  5. **Timeline**: Full interaction history
  6. **Activity**: Recent activity feed
- Changes sync bidirectionally with JobNimbus

### 6.4 Performance Dashboard (`/portal/sales/performance`)
- **KPIs:** Close rate, average deal size, response time, inspections per week
- Period comparison: Current vs. previous with percentage changes
- Individual targets set by management with progress indicators
- Multi-week/month performance graphs
- Commission trends over time
- Leaderboard position and movement

### 6.5 Settings (`/portal/sales/settings`)
- Personal notification preferences (frequency, channels)
- Territory preferences for lead distribution
- Availability status toggle (on/off for lead receiving)
- Default view settings

---

## 7. Section 5: Office Portal

**URL:** `/portal/office`
**Access:** Office staff, managers, admins, owners (viewers: read-only)
**Purpose:** Operations hub for daily office workflows

### 4-Tab Interface

#### Tab 1: Dashboard
- **Active Tickets** count
- **Completed Today** count
- **Pending Invoices** count
- **Pending Amount** ($)
- Recent Activity feed (ticket updates, invoice payments, order creations)

#### Tab 2: Delivery Tickets
- Search by job name, customer name, address
- Filter by status: Created, Assigned, Materials Pulled, Load Verified, En Route, Arrived, Delivered, Picked Up, Proof Captured, QC Photos, Completed, Cancelled
- Driver assignment/reassignment dropdown
- "Pull Materials" action button (updates inventory stock levels)
- Visual status timeline per ticket
- Color-coded status badges for quick identification

#### Tab 3: Invoices
- Search and status filter: All, Pending, Sent, Paid, Overdue
- "Mark Paid" one-click action
- Full invoice detail view with line items
- Overdue invoice highlighting with aging

#### Tab 4: Create Order
- **Job info:** Job name, job address, city, state, ZIP
- **Customer contact:** Name, phone, email
- **PM info:** PM name and phone
- **Delivery details:** Preferred date, time window, priority level (Normal/Rush/Urgent), special instructions
- **Material selection grid:** Select products from inventory, specify quantities, running total
- **Submit action:** Creates delivery ticket + updates inventory + notifies assigned driver

### Additional Office Functions
- **Scheduling & calendar** (`/portal/schedule`): View and manage team schedules
- **Lead entry & routing**: Enter new leads, trigger distribution algorithm
- **Phone operations**: Manage calls, voicemail, transfer calls between extensions

---

## 8. Section 6: Delivery & Driver Portal

**URL:** `/portal/delivery`
**Access:** Drivers (own routes), PMs (delivery management), managers/admins (all)
**Purpose:** Complete material delivery lifecycle from order to proof-of-delivery

### Delivery Management Hub (`/portal/delivery`)
- **List/Map view toggle** for all deliveries
- **Status filtering:** Planned, In Progress, Completed
- **Summary stats:** Active Routes, Total Stops, Completed, Remaining, Unassigned
- **Unassigned ticket banner** with quick-assign buttons
- **Two-pane layout:** Route list (left) + Selected route details (right)
- **Bulk operations:** Assign multiple tickets to a driver at once

### Route Management (`/portal/delivery/route`)
- Driver info card: Name, vehicle, assignment summary
- Distance and estimated duration for full route
- "Full Route" button: Opens Google Maps with all stops sequenced
- Progress bar: Completed stops / total stops
- Optimized stop sequence via route optimization service

### Stop Cards (`/portal/delivery/[id]`)
- Status badge with color coding (Pending -> In Progress -> Delivered)
- Priority indicator: Normal, Rush, Urgent
- Customer info with clickable phone number
- Navigate button: Direct Google Maps directions to address
- Action buttons: Mark Arrived, Start Unload, Complete Delivery, Capture Proof
- Material list with item names and quantities
- Special instructions from office/PM

### Loading Checklist
1. **Item verification:** Check off each material item against the ticket
2. **Quantity confirmation:** Verify quantities match the order
3. **Photo documentation:** Take photos of loaded materials in vehicle
4. **Safety check:** Confirm load is secured properly
5. **Digital acknowledgment:** Driver sign-off confirming load is verified
- Advances status from "Materials Pulled" to "Load Verified"

### Proof of Delivery
- **Photo upload:** Take and upload photos of delivered materials at job site
- **Delivery notes:** Notes about placement, condition, or issues
- **Customer signature:** Digital signature capture from customer or site contact
- **Automatic timestamp:** Delivery completion time recorded
- **GPS location:** Optional GPS coordinates logged for verification

### ETA System & Customer Notifications (`lib/delivery-reminder-service.ts`)
- **ETA calculation:** Based on stop number, total stops, average minutes per stop (30 min default)
- **Reminder types:** Customer, Driver, Office
- **Triggers:** Next-day reminder, same-day morning, status change, manual
- **Customer notification:** ETA updates sent when driver is en route
- **Daily summary:** Overview of all deliveries for the day, organized by driver
- **Status tracking:** Each reminder logged with sent/pending/failed status

---

## 9. Section 7: Inventory & Materials Management

**URL:** `/command-center/inventory` and `/portal/office` (Create Order tab)
**Access:** Role-based (see cost visibility matrix below)
**Purpose:** Real-time tracking of 11 roofing material products with Google Sheets sync

### Product Catalog (11 Items)

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

### Features
- Real-time stock levels synced with Google Sheets (`Inventory` tab)
- Bi-directional sync via `lib/inventory-sheets-sync.ts`
- Fallback to static data in `lib/inventoryData.ts` if Sheets unavailable
- Low stock alerts when items hit minimum quantity threshold
- Configurable reorder thresholds per product
- Transaction history for every stock movement (`InventoryLogs` Google Sheets tab)
- Full audit trail: Who changed what, when, why
- Transaction view at `/portal/transactions`
- Material order fulfillment tracking
- Stock adjustment with reason required

### Role-Based Cost Visibility

| Role | See Cost | See Price | Adjust Stock |
|------|:--------:|:---------:|:------------:|
| Owner | Yes | Yes | Yes |
| Admin | Yes | Yes | Yes |
| Manager | Yes | Yes | Yes (restock) |
| Office | No | Yes | Yes |
| Sales | No | No (qty only) | No |
| Project Manager | No | Yes | No (request only) |
| Driver | No | No | Yes (with logging) |

---

## 10. Section 8: Billing & Invoicing

**URL:** `/command-center/billing` and `/portal/billing`
**Access:** Owners, admins, managers, office staff (sales: own invoices only)
**Purpose:** Complete billing lifecycle from job completion to payment

### Invoice Generation
- Generated from completed job data
- Service: `lib/billing-workflow-service.ts`
- PDF generation: `lib/invoice-pdf-service.ts`
- API: `/api/portal/billing/pdf`

### Status Workflow
```
Created -> Sent -> Paid
                \-> Overdue (past due date)
```

### Aging Reports
| Bucket | Description |
|--------|-------------|
| 0-30 days | Current invoices |
| 31-60 days | Aging invoices |
| 61-90 days | Significantly past due |
| 90+ days | Critical overdue |

Each bucket shows count and total dollar amount. Overdue amounts are highlighted.

### Commission Calculation
- Tracked in `Commissions` Google Sheets tab
- Variable rates by rep, deal type, and volume
- Integration with JobNimbus for job value data
- Commission progress visible on each sales rep's dashboard
- Automated calculation from closed deal data

### Job Breakdowns
- **API:** `/api/breakdown`
- **Data:** `Job_Breakdowns` Google Sheets tab
- **Components:** Materials cost, labor cost, overhead, margin
- **View:** `/command-center/billing/breakdowns`

### Invoice Management Pages
- `/command-center/billing` -- Billing overview
- `/command-center/billing/invoices` -- Full invoice list with search and filter
- `/command-center/billing/breakdowns` -- Job cost breakdowns
- `/portal/billing` -- Portal billing interface for office/manager roles

### Additional Capabilities
- Bulk payment processing
- Overdue invoice alerts with amounts and aging
- Job invoice breakdowns (materials + labor line items)
- PDF export capability
- Revenue tracking and reporting

---

## 11. Section 9: Training & Onboarding

**URL:** `/portal/training`
**Access:** All team members (owners/admins manage; others complete)
**Purpose:** Multi-path training system for new and existing team members

### Three Training Paths

#### Path 1: Sales Training Course (`/portal/training/sales`) -- 7 Modules

| Module | Title | Description | Est. Time |
|--------|-------|-------------|-----------|
| 1 | Company Overview | RCRS history, mission, values, service areas, team structure | 15 min |
| 2 | Products & Services | Roofing materials (IKO Dynasty, Nordic, etc.), service details | 15 min |
| 3 | Insurance Claims | Navigating homeowner insurance claims process | 15 min |
| 4 | Sales Process | Inspection to close: the RCRS sales methodology | 15 min |
| 5 | Objection Handling | Common objections and proven response techniques | 10 min |
| 6 | Platform Tools | How to use the RCRS portal, CRM, and mobile tools | 15 min |
| 7 | Customer Communication | Professional communication standards and templates | 10 min |

**Quiz System:**
- Multiple-choice questions (4 options each)
- Immediate feedback showing correct/incorrect with explanations
- **70% passing score** required per module
- Failed modules can be retried unlimited times
- Pro tips highlighted throughout content for practical advice

**Certification:**
- Certificate generated upon completing all 7 modules
- Certificate includes: trainee name, completion date, individual module scores
- Progress saved to `Training_Progress` Google Sheets tab

#### Path 2: Interface Onboarding (`/portal/training/onboarding`) -- 8 Sections

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

- Each section includes **"Try It" links** that navigate directly to the relevant portal section
- Step-by-step walkthroughs with descriptions and tips
- Section completion tracking

#### Path 3: RCRS University
- Extended learning modules for ongoing professional development
- Specialized knowledge areas beyond the initial 7-module course

### Progress Tracking
- Per-user tracking in `Training_Progress` Google Sheets tab
- Admin view at `/portal/admin/training` shows all team members' progress
- Completion percentages visible on user profiles

---

## 12. Customer Portal

**URL:** `/my/[token]`
**Access:** Token-based (unique URL per customer, no password required)
**Purpose:** Customer transparency into their roofing job lifecycle

### Capabilities
- **Job Timeline**: Visual progress tracking from start to finish
- **Weather Alerts**: NWS weather forecasts and alerts for customer's ZIP code
  - API: `/api/weather/forecast/[zipcode]` and `/api/weather/alerts/[zipcode]`
- **Hail Reports**: Storm/hail data for their area
- **Document Sharing**: View contracts, estimates, photos shared by the RCRS team
- **Messages**: Communication log with assigned sales rep
- **Delivery Tracking**: Real-time status of material deliveries to their property
- **Appointments**: Scheduled inspection dates and work appointments

### Authentication
- Token auto-generated per customer via `lib/portal-generator.ts`
- Tokens stored in `Customers` Google Sheets tab
- No password required -- unique URL token serves as the credential
- Link-sharing model (sales rep sends link to customer)
- Read-only access to own job data

---

## 13. Security Features

### Authentication Layers

| Layer | Method | Details |
|-------|--------|---------|
| **Admin Auth** | JWT + httpOnly cookies | `POST /api/admin/auth`, `requireAdmin()` middleware on all `/api/admin/*` routes, `JWT_SECRET` env var (128-char hex), no hardcoded fallbacks |
| **Portal Auth** | Email + 4-digit PIN -> JWT | `POST /api/portal/auth`, team roster in `lib/team-roles.ts`, `ROLE_ROUTES` mapping controls portal access, `useAuth()` React hook via `lib/auth-context.tsx` |
| **Customer Auth** | Token-based URL | `/my/[token]`, no password, link-sharing model, tokens from `Customers` Google Sheets tab |

### RBAC Hierarchy (Role-Based Access Control)
```
owner (Level 100) -- wildcard (*) permissions, full access to everything
  |
admin (Level 90) -- full access with approval authority
  |
manager (Level 80) -- operations oversight, view-all access, limited editing
  |
sales / office / project_manager (Level 50) -- role-specific feature access
  |
driver (Level 30) -- delivery queue, route navigation, photo uploads
  |
viewer (Level 10) -- read-only access to dashboards and reports
```

### Security Measures
- **No hardcoded credentials**: The `admin123` fallback password was removed; all credentials are environment variables only
- **HMAC webhook validation**: JobNimbus webhook endpoint validates signatures to prevent spoofing
- **Rate limiting**: In-memory rate limiting on authentication endpoints (Redis upgrade planned for production)
- **Input validation**: All API routes validate request bodies before processing
- **Auth checks on all routes**: 100+ admin/portal API routes have `requireAuth()` or `requireAdmin()` middleware applied
- **No team enumeration**: Quick Login buttons removed from portal login page to prevent member discovery
- **PIN required**: Portal login requires both email AND 4-digit PIN (email-only login disabled)
- **httpOnly cookies**: JWT tokens stored in cookies not accessible to client-side JavaScript
- **Content security**: `placehold.co` removed from allowed image domains; Google Maps API key moved server-side
- **AUTH_BYPASS_MODE**: Available for pre-launch testing only; must be disabled before real user onboarding
- **No test credentials in production**: All test/demo credentials removed from UI

---

## 14. Performance & Reliability

### Caching
- Server-side cache (`lib/cache.ts`) reduces repeat Google Sheets API calls
- Vercel CDN caches static assets across global edge network
- Image optimization via `next/image` component
- Data cached on server with configurable TTL

### Data Resilience
- Google Sheets primary data store with JSON fallback for: inventory (`lib/inventoryData.ts`), services (`lib/servicesData.ts`), team data (`lib/teamData.ts`)
- Graceful degradation when external integrations are unavailable
- Retry logic on API calls to external services

### Build & Deployment
- Clean build process (exit 0) -- dynamic route warnings are informational only
- Auto-deploy on GitHub push to main branch
- Environment variables managed in Vercel dashboard (not committed to repo)
- Vercel Speed Insights available for performance monitoring

### Known Considerations
- **Vercel serverless timeout**: 10 seconds per function invocation; large sync operations must paginate
- **Google Sheets API latency**: Can be slow for large reads; server-side caching mitigates this
- **Blog image sizes**: Some images are 5-6MB and should be compressed for optimal load times
- **GroupMe polling**: 10-second intervals for near-real-time chat (not instant WebSocket)
- **JobNimbus webhooks**: Endpoint must be internet-reachable; webhook signature validation recommended for production

### Monitoring & Administration
- **System health**: `/api/admin/system`
- **Feature flags**: `/api/admin/system/features` -- toggle features without redeployment
- **Audit log**: `/api/admin/system/audit-log` -- who did what, when
- **Maintenance mode**: `/api/admin/system/maintenance` -- enable/disable maintenance banner
- **Google Analytics**: Public page performance tracking
- **Internal analytics**: Page views and profile views logged to Google Sheets
- **Admin settings**: `/portal/admin/operations` for system configuration

---

*This report was generated February 2026. For the most current platform status, see PUNCHOUT-LIST.md in the project root and ARCHITECTURE.md in the lib/ directory.*

*River City Roofing Solutions -- www.rivercityroofingsolutions.com -- (256) 274-8530 -- rcrs@rivercityroofingsolutions.com*
