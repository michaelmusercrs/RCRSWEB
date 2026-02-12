# RCRS Integration & Data Flow Report

**River City Roofing Solutions | www.rivercityroofingsolutions.com**
**Report Version:** February 2026
**Classification:** Internal Technical Reference
**Contact:** rcrs@rivercityroofingsolutions.com | (256) 274-8530

---

## Executive Summary

The RCRS platform integrates with 9 external systems to power its end-to-end business operations. Google Sheets serves as the primary data store with 22+ tabs managing everything from inventory and commissions to leads and training progress. JobNimbus CRM provides bidirectional customer and job synchronization through a dedicated sync engine. GroupMe delivers team-wide communication with automated bot notifications. Google Calendar and TeamUp handle scheduling with URL-based event creation and bi-directional calendar sync. The National Weather Service API fuels the Check My Address lead capture tool with real storm data. Google Analytics tracks public website behavior, Vercel Blob stores documents and images on a global CDN, and Google Apps Script automates email notifications for form submissions. This report documents every integration in detail -- its purpose, authentication method, data direction, frequency, configuration requirements, and data flow patterns across the entire platform.

---

## Table of Contents

1. [Integration Inventory](#1-integration-inventory)
2. [Google Sheets Integration](#2-google-sheets-integration)
3. [JobNimbus CRM Integration](#3-jobnimbus-crm-integration)
4. [GroupMe Chat Integration](#4-groupme-chat-integration)
5. [Calendar Integrations](#5-calendar-integrations)
6. [Weather Integrations](#6-weather-integrations)
7. [Google Analytics](#7-google-analytics)
8. [Vercel Blob Storage](#8-vercel-blob-storage)
9. [Google Apps Script](#9-google-apps-script)
10. [Data Flow Diagrams](#10-data-flow-diagrams)

---

## 1. Integration Inventory

### Master Integration Table

| # | System | Purpose | Auth Method | Data Direction | Frequency | Status |
|---|--------|---------|-------------|----------------|-----------|--------|
| 1 | **Google Sheets** | Primary database (17+ operational tabs, 5+ CMS tabs) | Service account JWT | Bi-directional (read/write) | Every page load (cached) + on writes | Active |
| 2 | **JobNimbus CRM** | Customer/job/note management, commissions | Bearer token (API key) | Bi-directional (2-way sync engine) | On-demand + webhook-triggered | Active |
| 3 | **GroupMe** | Team chat, DMs, automated notifications | Access token + Bot ID | Bi-directional (read messages + send) | 10-second polling + event-driven sends | Active |
| 4 | **Google Calendar** | Appointment scheduling, inspections, events | URL-based (no API key) | Outbound only (link generation) | On-demand (user-initiated) | Active |
| 5 | **TeamUp** | Shared team calendar, crew scheduling | API key | Bi-directional (push/pull events) | On-demand sync | Active (partial config) |
| 6 | **NWS / Iowa State Mesonet** | Storm data, hail reports, weather alerts | Public API (no key) | Inbound only (data retrieval) | On-demand (Check My Address) | Active |
| 7 | **Google Analytics** | Page views, user behavior, conversions | Measurement ID (client-side) | Outbound only (event tracking) | Real-time (after cookie consent) | Active |
| 8 | **Vercel Blob** | Document/image file storage | Read/Write token | Bi-directional (upload/serve) | On-demand (uploads/reads) | Active |
| 9 | **Google Apps Script** | Email notifications for form submissions | Web app URL endpoint | Outbound only (form data -> email) | Event-driven (on form submission) | Active |

### Planned / Not Yet Configured

| System | Purpose | Status |
|--------|---------|--------|
| Facebook Pixel | Ad conversion tracking | Not configured (`NEXT_PUBLIC_FB_PIXEL_ID`) |
| Google Ads | Ad conversion tracking | Not configured (`NEXT_PUBLIC_GOOGLE_ADS_ID`) |
| Twilio | SMS notifications | Not configured (`TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`) |
| SendGrid | Transactional email | Not configured (`SENDGRID_API_KEY`) |
| Redis | Production rate limiting cache | Planned (currently in-memory) |

---

## 2. Google Sheets Integration

### Overview

Google Sheets is the primary database for all RCRS operational data. A Google service account authenticates via JWT to read and write data across 22+ tabs. The platform reads data on every page load (with server-side caching) and writes on form submissions, status updates, and admin actions.

### Configuration

| Variable | Description | Status |
|----------|-------------|--------|
| `GOOGLE_SERVICE_ACCOUNT_EMAIL` | Service account email address | Configured |
| `GOOGLE_PRIVATE_KEY` | Service account private key (with `\n` escaping) | Configured |
| `GOOGLE_SHEETS_ID` | Main spreadsheet ID | Configured |

**Service Files:**
- `lib/google-sheets-service.ts` -- CRUD operations for all 17+ operational tabs
- `lib/cms-sheets-service.ts` -- CMS operations (blog, team, images, settings)
- `lib/inventory-sheets-sync.ts` -- Inventory-specific sync logic

### Operational Tabs (17+)

| # | Tab Name | Purpose | Columns / Key Fields | Read/Write |
|---|----------|---------|---------------------|------------|
| 1 | `team-members-import` | Team member data and profiles | Name, email, phone, role, position, bio, photo URL | Read + Write |
| 2 | `Inventory` | Product stock levels (11 products) | Product ID, name, category, unit, cost, price, supplier, currentQty, minQty, reorderThreshold | Read + Write |
| 3 | `InventoryLogs` | Stock change audit trail | Product ID, qty change, operation (add/subtract), user, timestamp, reason | Write (append) + Read |
| 4 | `Commissions` | Sales commission tracking | Rep name/slug, deal value, commission rate, commission amount, date, job reference, status | Read + Write |
| 5 | `Customers` | Customer records and portal tokens | Name, email, phone, address, portal token, sales rep, status, source, created date | Read + Write |
| 6 | `Orders` | Material orders | Order ID, job name, customer, PM, materials list, quantities, total, status, date | Read + Write |
| 7 | `Deliveries` | Delivery tickets | Ticket ID, order reference, driver, status, priority, scheduled date/time, address, materials, proof photos, signature | Read + Write |
| 8 | `Geocoded_Contacts` | Location-indexed contacts | Contact name, address, lat/lng coordinates, rep assignment | Read + Write |
| 9 | `Lead_Distribution_Log` | Lead assignment history | Lead ID, assigned rep, algorithm scores, timestamp, assignment reason | Write (append) + Read |
| 10 | `Rep_Availability` | Sales rep availability status | Rep name/slug, available (on/off), last updated | Read + Write |
| 11 | `Rep_Preferences` | Rep territory preferences | Rep name/slug, preferred territories, notification frequency, territory radius | Read + Write |
| 12 | `Lead_Response_Log` | Lead response time tracking | Lead ID, rep, response time, initial contact method, timestamp | Write (append) + Read |
| 13 | `Job_Breakdowns` | Job cost breakdowns | Job ID, materials cost, labor cost, overhead, margin, total, line items | Read + Write |
| 14 | `Team_Access_Overrides` | Per-user permission overrides | User email, module overrides (add/remove), admin who set it, timestamp | Read + Write |
| 15 | `Agent_Directory` | Insurance agent contacts | Agent name, company, phone, email, territory, specialty | Read + Write |
| 16 | `Agent_Visits` | Agent visit tracking | Agent ID, visit date, rep, notes, outcome | Write (append) + Read |
| 17 | `Training_Progress` | Employee training completion | User name/email, module completed, score, completion date, certificate status | Read + Write |
| 18 | `Storm_Reports` | Generated storm/hail reports | Address, name, email, phone, risk score, risk level, hail count, report data, timestamp | Write (append) + Read |

### CMS Tabs (5+)

| # | Tab Name | Purpose | Key Fields | Read/Write |
|---|----------|---------|------------|------------|
| 19 | `blog-posts` | Blog content management | Title, slug, content, author, category, datePublished, SEO fields | Read + Write |
| 20 | `images` | Image library | URL, alt text, category, upload date, uploader | Read + Write |
| 21 | `settings` | Site-wide settings | Setting key, value, last updated, updated by | Read + Write |
| 22 | `page-views` | Page view analytics | Page URL, view count, date, referrer | Write (append) + Read |
| 23 | `profile-views` | Profile view tracking | Profile slug, view count, date, referrer | Write (append) + Read |

### Read/Write Patterns

**Reads (server-side, cached):**
- Every page load reads relevant tabs through `google-sheets-service.ts`
- Server-side cache (`lib/cache.ts`) reduces repeat API calls with configurable TTL
- Data freshness: Near real-time with cache invalidation on writes

**Writes (event-driven):**
- Contact form submission -> `Customers` tab + `Lead_Distribution_Log`
- Referral form submission -> `Customers` tab
- Material order creation -> `Orders` tab + `Deliveries` tab + `Inventory` update
- Stock adjustment -> `Inventory` tab + `InventoryLogs` tab
- Training module completion -> `Training_Progress` tab
- Invoice actions -> relevant billing tabs
- Admin settings changes -> `settings` tab
- Blog post creation/edit -> `blog-posts` tab

**Fallback Behavior:**
- If Google Sheets API is unavailable, the system falls back to static JSON data:
  - Inventory: `lib/inventoryData.ts`
  - Services: `lib/servicesData.ts`
  - Team data: `lib/teamData.ts`
  - Blog: `lib/blogData.ts`

### Google Apps Script Email Automation

- **Endpoint:** `NEXT_PUBLIC_GOOGLE_SCRIPT_ENDPOINT` (deployed Apps Script web app URL)
- **Trigger:** Contact form and referral form submissions
- **Flow:**
  1. Form data submitted via `form-service.ts`
  2. Data sent to Apps Script endpoint
  3. Apps Script formats email notification
  4. Email sent to RCRS team (rcrs@rivercityroofingsolutions.com)
  5. Confirmation recorded in form submission log

---

## 3. JobNimbus CRM Integration

### Overview

JobNimbus is the external CRM system used for contact and job management. The RCRS platform maintains a 2-way sync engine that keeps contacts, jobs, and notes synchronized between both systems. Commission calculations pull job values from JobNimbus data.

### Configuration

| Variable | Description | Status |
|----------|-------------|--------|
| `JOBNIMBUS_API_KEY` | API key (Bearer token in Authorization header) | Configured |
| `JOBNIMBUS_API_URL` | Base URL for the JobNimbus REST API | Configured |

### Service Files
- `lib/jobnimbus-service.ts` -- Base API client (GET/POST for contacts, jobs, estimates, tasks, notes)
- `lib/jn-sync-engine.ts` -- 2-way synchronization engine

### 2-Way Sync Engine (`lib/jn-sync-engine.ts`)

The sync engine handles bidirectional data flow between the RCRS portal and JobNimbus.

**Sync Capabilities:**

| Data Type | Portal -> JN | JN -> Portal | Details |
|-----------|:------------:|:------------:|---------|
| **Contacts** | Yes | Yes | Customer records with name, email, phone, address |
| **Jobs** | Yes | Yes | Job status, details, estimates, values |
| **Notes** | Yes | Yes | Activity notes and communication logs |
| **Status** | Yes (push) | Yes (pull) | Job status changes sync bidirectionally |
| **Commissions** | Read only | Yes (values) | Commission calculated from JN closed deal data |

**Sync Engine Features:**
- Tracks sync state: last timestamp, sync counts, error tracking
- Per-rep contact summaries and job summaries
- Sales metrics calculation from JN data
- Paginates up to 100 pages for large data sets
- Error handling with retry logic

**Webhook Integration:**
- **Endpoint:** `/api/webhooks/jobnimbus`
- **Events:** JN events trigger lead creation and status updates in the portal
- **Security:** HMAC signature validation to prevent webhook spoofing
- **Direction:** Inbound (JN pushes events to RCRS portal)

### Data Flow Detail

**Contact Sync (JN -> Portal):**
1. Sync engine queries JN API for contacts
2. Matches contacts by email or JN record ID
3. Updates or creates records in Google Sheets (`Customers` tab)
4. Populates per-rep contact summaries

**Contact Sync (Portal -> JN):**
1. New customer created in portal (via form or manual entry)
2. `jobnimbus-service.ts` pushes contact to JN via POST
3. JN record ID stored in portal for future reference

**Job Status Push (Portal -> JN):**
1. Job status changes in portal (e.g., lead -> inspected -> quoted -> won)
2. Status change pushed to JN via API
3. JN record updated with new status

**Commission Calculation:**
1. Sync engine pulls closed jobs from JN
2. Job values extracted (deal amount)
3. Commission rates applied per rep configuration
4. Results written to `Commissions` Google Sheets tab
5. Commission data displayed on sales rep dashboards

### Troubleshooting
- If contacts are not syncing, verify the API key is still valid (keys can expire)
- Large sync operations may time out on Vercel (10-second serverless limit); engine paginates
- Test connection at `/api/admin/jobnimbus/test`
- Check sync engine logs for specific error messages

---

## 4. GroupMe Chat Integration

### Overview

GroupMe provides team-wide communication within the RCRS portal. The integration supports full group chat, direct messages, @mentions, and automated bot notifications for business events.

### Configuration

| Variable | Description | Status |
|----------|-------------|--------|
| `GROUPME_ACCESS_TOKEN` | User access token for full API access | Configured |
| `GROUPME_BOT_ID` | Bot ID for automated notifications | Not yet configured |
| `GROUPME_ENABLED` | Master toggle (`true` to enable) | Set to `true` |

### Service File
- `lib/groupme-service.ts` -- All GroupMe API interactions

### Full Chat Interface (`/portal/chat`)

**Features:**
- **Group channels**: Team-wide and topic-specific group conversations
- **Direct messages (DMs)**: Private 1-on-1 conversations between team members
- **@mentions**: Type `@` to autocomplete and mention specific team members
- **Message types**: Text, images, videos, and file attachments
- **Search**: Search across messages and conversations
- **10-second polling**: Messages refresh automatically every 10 seconds for near-real-time updates
- **Mobile-optimized**: Responsive layout with touch-friendly interface

### Chat Data Structures

| Entity | Key Fields |
|--------|-----------|
| **Groups** | ID, name, description, image, member count, last message preview |
| **Messages** | ID, text, sender info, avatar, timestamps, attachments, favorites |
| **Members** | User ID, nickname, avatar, roles, mute status |
| **DMs** | Separate conversation threads with their own message history |

### Floating Chat Widget

- Appears on **all portal pages** as a floating widget
- Click to expand and see latest messages without navigating away
- Quick reply capability from the widget
- Unread message indicator badge

### Automated Bot Notifications

When `GROUPME_BOT_ID` is configured, the system sends automated notifications for:

| Event | Notification Content |
|-------|---------------------|
| New lead received | Lead name, source, assigned rep |
| Profile edit pending approval | Who requested, what changed |
| Low inventory alert | Product name, current qty, threshold |
| Job status change | Job name, old status -> new status |
| Customer portal activity | Customer name, action taken |
| Delivery updates | Ticket ID, status change, driver |
| SLA alerts | What's overdue, assigned owner |

- Notification types can be individually enabled/disabled in GroupMe config
- Bot posts to group channels; user API handles direct messages

---

## 5. Calendar Integrations

### 5.1 Google Calendar (URL-Based)

**Purpose:** Team scheduling, customer appointments, inspection bookings

**Service File:** `lib/google-calendar.ts`

**How It Works:**
- The platform generates Google Calendar URL links (never .ics files, never API calls)
- Clicking a link opens Google Calendar in a new tab with pre-filled event details
- No API key required; purely URL-based

**Key Functions:**
| Function | Input | Use Case |
|----------|-------|----------|
| `generateGoogleCalendarLink()` | Event title, dates, description, location, attendees | Base link generator |
| `generateGoogleCalendarLinkFromEvent()` | Calendar event format object | From calendar event data |
| `generateGoogleCalendarLinkFromScheduledEvent()` | Scheduling service format object | From scheduling service |
| `generateGoogleCalendarLinkFromJob()` | JobNimbus job data object | From JN job data |

**URL Format:**
```
https://calendar.google.com/calendar/render?action=TEMPLATE
  &text=[Event Title]
  &dates=[Start DateTime]/[End DateTime]
  &details=[Event Description]
  &location=[Event Location]
  &add=[email1],[email2]
```

**Attendee Resolution:**
- Team member @rcrsal.com emails auto-resolved from team roster
- Customer emails included as optional attendees
- Links include event title, date/time, location, description, and attendee emails

**Conflict Detection:**
- Platform checks for overlapping appointments before creating calendar links
- Alerts user if scheduling conflicts detected

### 5.2 TeamUp Calendar (Bi-Directional Sync)

**Purpose:** Crew scheduling, shared team calendar, job site coordination

**Service File:** `lib/teamup-service.ts`

**Configuration:**

| Variable | Description | Status |
|----------|-------------|--------|
| `TEAMUP_API_KEY` | API key | Configured (`ksgfxermrxee1jz1fw`) |
| `TEAMUP_CALENDAR_KEY` | Calendar identifier | Not yet configured |

**Sync Behavior:**
- Events created in the RCRS portal are pushed to TeamUp
- Events in TeamUp are pulled into the portal calendar view
- Bi-directional: Changes in either system reflected in both
- Used for crew scheduling and job site coordination

### 5.3 JobNimbus Calendar Sync

- JN jobs with scheduled dates appear on the portal calendar
- Inspection dates from JN jobs sync to team schedule
- Events created via portal can trigger JN task creation

---

## 6. Weather Integrations

### 6.1 National Weather Service (NWS) API

**Purpose:** Active weather alerts and forecasts for Check My Address and customer portal

**Service Files:**
- `lib/weather-service.ts` -- Queries NWS API for alerts and forecasts
- `lib/storm-report-service.ts` -- Combines data into risk assessments

**Configuration:** No API key required; NWS API is public

**Endpoints Used:**
| NWS Endpoint | Purpose | Used By |
|--------------|---------|---------|
| Active alerts by area | Current severe weather warnings | Check My Address, Customer Portal |
| Forecast by point | 7-day forecast data | Customer Portal |
| Hail reports (via Mesonet) | Historical hail event data | Check My Address |

**Portal API Routes:**
- `/api/weather/forecast/[zipcode]` -- Weather forecast for customer portal
- `/api/weather/alerts/[zipcode]` -- Active weather alerts
- `/api/storm-report` -- Full storm report generation

### 6.2 Iowa State Mesonet

**Purpose:** Historical hail report data for the Check My Address storm report system

**How It Works:**
1. User submits address in Check My Address
2. `storm-report-service.ts` queries Mesonet for historical hail reports within configurable radius
3. Returns individual hail events with: date, hail size, severity, distance from address, location, county
4. Wind event data also queried

### 6.3 Storm Report Service (`lib/storm-report-service.ts`)

**Combines data from NWS + Mesonet into a unified risk assessment:**

| Output Field | Source |
|--------------|--------|
| Risk Score (0-100) | Calculated from all factors |
| Risk Level (Low/Moderate/High/Severe) | Derived from score |
| Total Hail Reports | Mesonet query |
| Closest Hail Distance | Mesonet query (calculated) |
| Largest Hail Size | Mesonet query (max diameter) |
| Hail Events Timeline | Mesonet query (10 most recent) |
| Wind Events | Mesonet query |
| Active Alerts | NWS API |
| Risk Factors | Algorithm explanation |
| Recommendation | Based on risk level |

**Risk Scoring Factors:**
- Number of hail reports in radius (more events = higher score)
- Proximity of closest hail event (closer = higher score)
- Size of largest hail (bigger diameter = higher score)
- Recency of events (more recent = higher score)
- Active weather alerts (any active alert = score boost)
- Wind events in area (additional risk factor)

---

## 7. Google Analytics

### Overview

Google Analytics tracks visitor behavior across all public-facing pages of the RCRS website.

### Configuration

| Variable | Description | Status |
|----------|-------------|--------|
| `NEXT_PUBLIC_GA_ID` | Measurement ID: `G-Y8PB85BZC5` | Configured |

### Implementation

- **Tracking provider:** `components/TrackingProvider.tsx` wraps the app with consent-aware analytics
- **Cookie consent:** `components/CookieConsent.tsx` displays GDPR-style consent banner
- **Analytics loading:** GA script only fires AFTER user accepts cookie consent
- **Tracking service:** `lib/tracking-service.ts` provides consent-aware tracking functions

### What Is Tracked

| Event Type | Details |
|------------|---------|
| Page views | All public pages (blog, services, team, locations, etc.) |
| User behavior | Time on page, scroll depth, navigation patterns |
| Conversion events | Form submissions (contact, referral, Check My Address) |
| Source/medium | How visitors arrived (organic, direct, referral, social) |
| Device/browser | User device types and browser usage |

### Internal Analytics (Separate)

In addition to Google Analytics, the platform tracks its own analytics:
- `lib/analytics.ts` provides internal analytics functions
- Page views logged to `page-views` Google Sheets tab
- Profile views logged to `profile-views` Google Sheets tab
- These are platform-specific metrics not sent to Google

---

## 8. Vercel Blob Storage

### Overview

Vercel Blob provides CDN-backed file and image storage for the RCRS platform.

### Configuration

| Variable | Description | Status |
|----------|-------------|--------|
| `BLOB_READ_WRITE_TOKEN` | Vercel Blob storage token | Configured |

### Usage

| File Type | Upload Source | Served To |
|-----------|-------------|-----------|
| Blog images | Admin CMS (`/portal/admin/images`) | Public blog pages |
| Team photos | Admin CMS (`/portal/admin/team`) | Public team pages |
| Delivery photos | Driver portal (proof of delivery) | Office portal, customer portal |
| Customer documents | Admin/office portal | Customer portal |
| Profile images | Admin uploads | Team profiles |

### Upload Flow
1. File selected in admin interface or driver portal
2. `POST /api/admin/upload` sends file to server
3. Server uploads to Vercel Blob via `@vercel/blob` SDK
4. Vercel Blob returns a public CDN URL
5. URL stored in relevant Google Sheets tab or data source
6. File served from Vercel's global CDN for fast loading

### Supported Formats
- Images: PNG, JPG, JPEG, WebP
- Documents: PDF and other file types as needed

---

## 9. Google Apps Script

### Overview

Google Apps Script handles email notifications triggered by form submissions on the public website.

### Configuration

| Variable | Description | Status |
|----------|-------------|--------|
| `NEXT_PUBLIC_GOOGLE_SCRIPT_ENDPOINT` | Deployed Apps Script web app URL | Configured |

### Flow

```
User submits contact or referral form
        |
        v
form-service.ts processes the submission
        |
        v
Data sent to Google Apps Script endpoint (POST)
        |
        v
Apps Script receives the data
        |
        v
Apps Script formats and sends email notification
to the RCRS team (rcrs@rivercityroofingsolutions.com)
        |
        v
Confirmation recorded in form submission log
```

### Events That Trigger Email

| Trigger | Email Content |
|---------|--------------|
| Contact form submission | Name, email, phone, message, service interest |
| Referral form submission | Referrer info + referred person info |
| New lead creation | Lead details with source information |

---

## 10. Data Flow Diagrams

### 10.1 Lead Intake Flow

```
LEAD SOURCES                       PROCESSING                    OUTCOME
============                       ==========                    =======

Website Contact Form  --------+
                               |
Check My Address      --------+----> POST /api/forms/contact
                               |         or /api/leads/new
Referral Form         --------+              |
                               |              v
Manual Entry (Office) --------+      form-service.ts
                               |              |
JobNimbus Webhook     --------+    +---------+---------+---------+
                                   |         |         |         |
                                   v         v         v         v
                             Google      Apps Script  GroupMe   Storm_Reports
                             Sheets      (Email to    (Team     (if Check
                             (Lead       RCRS team)   notif)    My Address)
                             record)
                                   |
                                   v
                          lead-distribution-service.ts
                                   |
                          +--------+--------+
                          |                 |
                          v                 v
                    Check Rep          Score & Rank
                    Availability       Eligible Reps
                    (Rep_Availability   (proximity, referral
                     sheet)             bonus, close rate,
                          |             response time)
                          |                 |
                          +--------+--------+
                                   |
                                   v
                          Assign to Best Rep
                                   |
                          +--------+--------+--------+
                          |        |        |        |
                          v        v        v        v
                    Lead_Distro  Notify   Update   Rep sees
                    _Log Sheet   Rep via  Rep_     lead in
                                 GroupMe  Preferences Sales Portal
```

### 10.2 Job Lifecycle Flow

```
LEAD WON                    JOB CREATION                FULFILLMENT
========                    ============                ===========

Sales rep closes deal
        |
        v
Lead status -> "Won"
        |
        +---> Job created in JobNimbus (via jn-sync-engine.ts)
        |
        +---> Customer record updated in Google Sheets
        |
        v
PM creates material order (/portal/orders/new)
        |
        +---> Order saved to Google Sheets (Orders tab)
        |
        +---> Delivery Ticket auto-created (Deliveries tab)
        |
        +---> Inventory quantities updated (Inventory tab)
        |
        +---> InventoryLogs audit entry created
        |
        v
Office assigns Driver + schedules date
        |
        +---> Driver notified via GroupMe
        |
        v
Driver opens Loading Checklist
        |
        +---> Verify items against ticket
        +---> Photo documentation of loaded vehicle
        +---> Safety check
        +---> Digital acknowledgment
        |
        v
Status: "Load Verified"
        |
        v
Driver starts Route (/portal/delivery/route)
        |
        +---> Google Maps navigation per stop
        +---> ETA calculations (delivery-reminder-service.ts)
        +---> Customer ETA notification
        |
        v
At each stop:
        +---> Mark Arrived (status update)
        +---> Unload materials
        +---> Proof of Delivery:
        |       - Photos uploaded to Vercel Blob
        |       - Customer signature captured
        |       - Delivery notes recorded
        |       - GPS coordinates logged
        |       - Timestamp recorded
        |
        v
Status: "Completed"
        |
        +---> Office notified
        +---> Customer portal updated
        |
        v
Roof work performed by crew
        |
        v
Job completed -> Invoice generated
        |
        +---> billing-workflow-service.ts
        +---> invoice-pdf-service.ts (PDF)
        +---> Invoice saved to Google Sheets
        |
        v
Invoice sent to customer
        |
        v
Payment received
        |
        +---> Invoice status -> "Paid"
        +---> Commission calculated from JN job value
        +---> Commission written to Commissions tab
        |
        v
Customer Portal shared (/my/[token])
        +---> Job timeline visible
        +---> Documents accessible
        +---> Weather alerts active
        +---> Ongoing relationship
```

### 10.3 Financial Data Flow

```
DATA SOURCES                    PROCESSING                   OUTPUTS
============                    ==========                   =======

JobNimbus Jobs  --------+
(closed deals,           |
job values)              +----> jn-sync-engine.ts
                         |      (commission calculation)
Commissions Sheet ------+              |
                                       v
                               Commission data written
                               to Commissions Google Sheet
                                       |
                         +-------------+-------------+
                         |             |             |
                         v             v             v
                   Sales Portal   Command Center  Financial
                   (individual    (leaderboard    Reports
                    commission     $2.6M+ total,  (/command-center/
                    progress)      4,199+ txns)    reports/financial)

Deliveries Sheet -------+
(completed                |
deliveries)               +----> billing-workflow-service.ts
                          |      (invoice generation)
Orders Sheet    ---------+              |
(material orders)                       v
                                 Invoice created
                                 (invoice-pdf-service.ts for PDF)
                                        |
                          +-------------+-------------+
                          |             |             |
                          v             v             v
                    Office Portal  Command Center  Customer
                    (invoice       (billing        (invoice sent
                     management)    overview)       for payment)

Inventory Sheet --------+
(stock levels,           |
costs, prices)           +----> Margin calculations
                         |      Cost analysis
Job_Breakdowns  --------+              |
(materials + labor)                    v
                                 Job cost breakdowns
                                 (/command-center/billing/breakdowns)
                                        |
                                        v
                                 Revenue MTD, YTD
                                 Gross margins
                                 Cash flow analysis
                                 Invoice aging (30/60/90 days)
```

### 10.4 Communication Flow

```
EVENT TRIGGERS              CHANNELS                    RECIPIENTS
==============              ========                    ==========

New lead received -----+
                        |
Low stock alert -------+
                        |
Job status change -----+----> GroupMe Bot
                        |     (lib/groupme-service.ts)
Delivery update -------+              |
                        |              +---> Group channel notification
Profile edit pending --+              +---> Specific team @mentions
                        |
Customer portal -------+
activity                |
                        |
SLA alert -------------+


Form submission ------+
(contact, referral)    +----> Google Apps Script
                       |      (email notification)
                       |              |
                       |              +---> RCRS team email
                       |                   (rcrs@rivercityroofingsolutions.com)
                       |
                       +----> GroupMe notification
                              (when configured)


Team member  ---------+
sends chat message     +----> GroupMe API
                       |      (lib/groupme-service.ts)
                       |              |
                       |              +---> Group channels
                       |              +---> Direct messages
                       |              +---> @mentions -> specific users
                       |
                       +----> Portal Chat (/portal/chat)
                              + Floating Chat Widget
                              (10-second polling for updates)


Appointment  ---------+
scheduling             +----> Google Calendar URL link
                       |      (lib/google-calendar.ts)
                       |              |
                       |              +---> Attendee emails (@rcrsal.com)
                       |              +---> Customer email (optional)
                       |
                       +----> TeamUp sync
                              (lib/teamup-service.ts)
                                      |
                                      +---> Shared team calendar
                                      +---> Crew scheduling


Customer ETA  --------+
notification           +----> delivery-reminder-service.ts
                               |
                               +---> Customer: ETA when driver en route
                               +---> Driver: Next-day and same-day reminders
                               +---> Office: Daily delivery summary
```

### 10.5 Data Store Relationships

```
+-------------------+          +-------------------+
|                   |  2-way   |                   |
|   Google Sheets   |<-------->|    JobNimbus      |
|   (22+ tabs)      |  sync    |    CRM            |
|                   |          |                   |
| - Inventory       |          | - Contacts        |
| - Commissions     |          | - Jobs            |
| - Customers       |          | - Estimates       |
| - Orders          |          | - Notes           |
| - Deliveries      |          | - Tasks           |
| - Leads           |          |                   |
| - Training        |          +-------------------+
| - Settings        |
| - Blog            |          +-------------------+
| - Analytics       |  upload  |                   |
|                   |--------->|   Vercel Blob     |
+-------------------+          |   (CDN storage)   |
        |                      |                   |
        |                      | - Images          |
        |  read/write          | - Documents       |
        |                      | - Photos          |
        v                      |                   |
+-------------------+          +-------------------+
|                   |
|   RCRS Platform   |          +-------------------+
|   (Next.js)       |  poll    |                   |
|                   |<-------->|    GroupMe         |
| - 367+ pages      |  send    |    (Chat)         |
| - 180+ API routes |          |                   |
| - 85+ components  |          | - Group channels  |
|                   |          | - DMs             |
+-------------------+          | - Bot notifs      |
        |                      |                   |
        |  links               +-------------------+
        |
        v                      +-------------------+
+-------------------+  sync    |                   |
|  Google Calendar  |<-------->|     TeamUp        |
|  (URL links)      |          |   (Calendar)      |
+-------------------+          +-------------------+

+-------------------+          +-------------------+
|                   |          |                   |
|   NWS / Mesonet   |          | Google Analytics  |
|   (Weather data)  |          | (G-Y8PB85BZC5)   |
|                   |          |                   |
| - Hail reports    |          | - Page views      |
| - Active alerts   |          | - Conversions     |
| - Wind events     |          | - User behavior   |
| - Forecasts       |          |                   |
+-------------------+          +-------------------+
```

---

## Appendix: Environment Variable Quick Reference

### Required for Core Operations

| Variable | Integration | Required |
|----------|-------------|----------|
| `GOOGLE_SERVICE_ACCOUNT_EMAIL` | Google Sheets | Yes |
| `GOOGLE_PRIVATE_KEY` | Google Sheets | Yes |
| `GOOGLE_SHEETS_ID` | Google Sheets | Yes |
| `ADMIN_PASSWORD` | Admin auth | Yes |
| `JWT_SECRET` | Auth (128-char hex) | Yes |
| `JOBNIMBUS_API_KEY` | JobNimbus CRM | Yes |
| `JOBNIMBUS_API_URL` | JobNimbus CRM | Yes |

### Required for Full Features

| Variable | Integration | Required |
|----------|-------------|----------|
| `GROUPME_ACCESS_TOKEN` | GroupMe chat | Yes (for chat) |
| `GROUPME_BOT_ID` | GroupMe notifications | Optional |
| `GROUPME_ENABLED` | GroupMe toggle | Set `true` |
| `TEAMUP_API_KEY` | TeamUp calendar | Yes (for calendar sync) |
| `TEAMUP_CALENDAR_KEY` | TeamUp calendar | Not yet configured |
| `BLOB_READ_WRITE_TOKEN` | Vercel Blob | Yes (for uploads) |
| `NEXT_PUBLIC_GOOGLE_SCRIPT_ENDPOINT` | Apps Script email | Yes (for form emails) |
| `NEXT_PUBLIC_GA_ID` | Google Analytics | Yes (for tracking) |
| `NEXT_PUBLIC_SITE_URL` | Site URL | Yes |
| `NEXT_PUBLIC_BASE_URL` | Base URL | Yes |

---

*This report was generated February 2026. For the most current integration status, see .env.local.configured in the project root.*

*River City Roofing Solutions -- www.rivercityroofingsolutions.com -- (256) 274-8530 -- rcrs@rivercityroofingsolutions.com*
