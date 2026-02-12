# INFOGRAPHIC: HOW IT ALL CONNECTS

```
================================================================================
|                                                                              |
|                      HOW IT ALL CONNECTS                                     |
|                      ===================                                     |
|                                                                              |
|     The 7 external integrations that power the RCRS Platform                 |
|     + what data flows between each system                                    |
|                                                                              |
================================================================================
```

---

## THE INTEGRATION MAP

```
+==================================================================================+
|                                                                                  |
|                        +==============================+                          |
|                        |                              |                          |
|                        |      RCRS PLATFORM           |                          |
|                        |      ==============          |                          |
|                        |                              |                          |
|                        |   Next.js 14 + React 18      |                          |
|                        |   180+ API Routes            |                          |
|                        |   367 Pages                  |                          |
|                        |   Vercel Hosting              |                          |
|                        |                              |                          |
|                        +==============|===============+                          |
|                                       |                                          |
|         +----------+----------+-------+-------+----------+----------+            |
|         |          |          |               |          |          |            |
|         v          v          v               v          v          v            |
|                                                                                  |
|  +==========+ +==========+ +==========+ +==========+ +==========+ +==========+  |
|  | GOOGLE   | |JOBNIMBUS | | GROUPME  | | GOOGLE   | |  TEAMUP  | |   NWS    |  |
|  | SHEETS   | |   CRM    | |   CHAT   | | CALENDAR | |          | |   API    |  |
|  +==========+ +==========+ +==========+ +==========+ +==========+ +==========+  |
|                                                                                  |
|                       +==========+  +==========+                                 |
|                       | GOOGLE   |  |  VERCEL  |                                 |
|                       |ANALYTICS |  |   BLOB   |                                 |
|                       +==========+  +==========+                                 |
|                                                                                  |
+==================================================================================+
```

---

## INTEGRATION 1: GOOGLE SHEETS

```
+==================================================================================+
|                                                                                  |
|   GOOGLE SHEETS  <=======>  RCRS PLATFORM                                       |
|   ============================================                                   |
|   Direction: BI-DIRECTIONAL (2-way sync)                                        |
|                                                                                  |
|   +-------------------+          +-------------------------------+               |
|   | GOOGLE SHEETS     |          | RCRS PLATFORM                |               |
|   |==================|          |==============================|               |
|   |                   |  ---->   |                               |               |
|   | Inventory Levels  | ======>  | Inventory Dashboard           |               |
|   | (11 products)     | <======  | (stock levels, alerts)        |               |
|   |                   |  <----   |                               |               |
|   |-------------------|          |-------------------------------|               |
|   |                   |  ---->   |                               |               |
|   | Commission Data   | ======>  | Sales Rep Commission Tracker  |               |
|   | (rep earnings)    | <======  | (progress bars, summaries)    |               |
|   |                   |  <----   |                               |               |
|   |-------------------|          |-------------------------------|               |
|   |                   |  ---->   |                               |               |
|   | Material Orders   | ======>  | Office Order Management       |               |
|   | (order records)   | <======  | (new orders flow to sheets)   |               |
|   |                   |  <----   |                               |               |
|   |-------------------|          |-------------------------------|               |
|   |                   |  ---->   |                               |               |
|   | Lead Records      | ======>  | Lead Dashboard                |               |
|   | (form submissions)| <======  | (auto-captured from web)      |               |
|   |                   |  <----   |                               |               |
|   |-------------------|          |-------------------------------|               |
|   |                   |  ---->   |                               |               |
|   | Training Scores   | ======>  | Training Progress Tracker     |               |
|   | (quiz results)    | <======  | (completion certificates)     |               |
|   |                   |  <----   |                               |               |
|   +-------------------+          +-------------------------------+               |
|                                                                                  |
|   KEY: Google Sheets is the primary data store for inventory, commissions,       |
|        orders, leads, and training. It serves as a lightweight database           |
|        that anyone with Sheets access can also view directly.                    |
|                                                                                  |
+==================================================================================+
```

---

## INTEGRATION 2: JOBNIMBUS CRM

```
+==================================================================================+
|                                                                                  |
|   JOBNIMBUS  <=======>  RCRS PLATFORM                                           |
|   ========================================                                       |
|   Direction: BI-DIRECTIONAL (2-way sync via jn-sync-engine.ts)                  |
|                                                                                  |
|   +-------------------+          +-------------------------------+               |
|   | JOBNIMBUS CRM     |          | RCRS PLATFORM                |               |
|   |==================|          |==============================|               |
|   |                   |          |                               |               |
|   | Contacts          | <======> | Customer Records (6 tabs)     |               |
|   | (name, phone,     |          | (overview, jobs, history,     |               |
|   |  email, address)  |          |  docs, messages, transactions)|               |
|   |                   |          |                               |               |
|   |-------------------|          |-------------------------------|               |
|   |                   |          |                               |               |
|   | Jobs              | <======> | Job Pipeline                  |               |
|   | (type, status,    |          | (status tracking, crew,       |               |
|   |  crew, dates)     |          |  timeline, commission calc)   |               |
|   |                   |          |                               |               |
|   |-------------------|          |-------------------------------|               |
|   |                   |          |                               |               |
|   | Estimates         | <======> | Quote Management              |               |
|   | (scope, pricing,  |          | (send, track, accept/reject)  |               |
|   |  line items)      |          |                               |               |
|   |                   |          |                               |               |
|   |-------------------|          |-------------------------------|               |
|   |                   |          |                               |               |
|   | Status Updates    | <======> | Pipeline Stage                |               |
|   | (New -> Won)      |          | (one-tap stage advancement    |               |
|   |                   |          |  pushes to JN in real-time)   |               |
|   |                   |          |                               |               |
|   |-------------------|          |-------------------------------|               |
|   |                   |          |                               |               |
|   | Notes & Activity  | <======> | Communication Log             |               |
|   | (internal notes,  |          | (messages, @mentions,         |               |
|   |  contact history) |          |  activity timeline)           |               |
|   |                   |          |                               |               |
|   +-------------------+          +-------------------------------+               |
|                                                                                  |
|   SYNC ENGINE: lib/jn-sync-engine.ts handles bi-directional sync               |
|   WEBHOOK: JN events trigger portal updates via HMAC-verified webhooks          |
|                                                                                  |
+==================================================================================+
```

---

## INTEGRATION 3: GROUPME

```
+==================================================================================+
|                                                                                  |
|   GROUPME  <=======>  RCRS PLATFORM                                             |
|   ======================================                                         |
|   Direction: BI-DIRECTIONAL (chat + notifications)                              |
|                                                                                  |
|   +-------------------+          +-------------------------------+               |
|   | GROUPME           |          | RCRS PLATFORM                |               |
|   |==================|          |==============================|               |
|   |                   |          |                               |               |
|   | Group Channels    | <======> | Team Chat Page (/chat)        |               |
|   | (team, dept)      |          | (full chat interface)         |               |
|   |                   |          |                               |               |
|   |-------------------|          |-------------------------------|               |
|   |                   |          |                               |               |
|   | Direct Messages   | <======> | DM Interface                  |               |
|   | (1-on-1 chats)    |          | (private conversations)       |               |
|   |                   |          |                               |               |
|   |-------------------|          |-------------------------------|               |
|   |                   |          |                               |               |
|   | @Mentions         | <======> | Tag Notifications             |               |
|   | (alert specific   |          | (urgent attention requests)   |               |
|   |  team members)    |          |                               |               |
|   |                   |          |                               |               |
|   |-------------------|          |-------------------------------|               |
|   |                   |          |                               |               |
|   | Notifications     | <------  | System Alerts                 |               |
|   | (delivery, lead,  |          | (auto-generated from events:  |               |
|   |  status updates)  |          |  new lead, delivery complete,  |               |
|   |                   |          |  status change, etc.)         |               |
|   |                   |          |                               |               |
|   +-------------------+          +-------------------------------+               |
|                                                                                  |
|   FLOATING WIDGET: ChatWidget component appears on ALL portal pages             |
|   CONFIG: GROUPME_ACCESS_TOKEN + GROUPME_ENABLED=true in .env                  |
|                                                                                  |
+==================================================================================+
```

---

## INTEGRATION 4: GOOGLE CALENDAR

```
+==================================================================================+
|                                                                                  |
|   GOOGLE CALENDAR  <=======>  RCRS PLATFORM                                    |
|   =================================================                             |
|   Direction: BI-DIRECTIONAL (via URL link format)                               |
|                                                                                  |
|   +-------------------+          +-------------------------------+               |
|   | GOOGLE CALENDAR   |          | RCRS PLATFORM                |               |
|   |==================|          |==============================|               |
|   |                   |          |                               |               |
|   | Inspection Events | <======> | Lead Quick-Actions            |               |
|   | (date, time, loc) |          | (schedule button creates      |               |
|   |                   |          |  Google Calendar URL event)   |               |
|   |                   |          |                               |               |
|   |-------------------|          |-------------------------------|               |
|   |                   |          |                               |               |
|   | Team Appointments | <======> | Calendar Views                |               |
|   | (all staff events)|          | (month/week/day with all     |               |
|   |                   |          |  team events shown)           |               |
|   |                   |          |                               |               |
|   |-------------------|          |-------------------------------|               |
|   |                   |          |                               |               |
|   | Adjuster Meetings | <======> | Insurance Scheduling          |               |
|   | (insurance appts) |          | (specialist books via         |               |
|   |                   |          |  calendar URL links)          |               |
|   |                   |          |                               |               |
|   |-------------------|          |-------------------------------|               |
|   |                   |          |                               |               |
|   | Delivery Schedule | <======> | Delivery Coordination         |               |
|   | (material drops)  |          | (synced with delivery         |               |
|   |                   |          |  ticket system)               |               |
|   |                   |          |                               |               |
|   +-------------------+          +-------------------------------+               |
|                                                                                  |
|   FORMAT: URL links (not .ics files) per Google Workspace preference            |
|   UTILITY: lib/google-calendar.ts generates calendar URL links                  |
|   LINK FORMAT: calendar.google.com/calendar/render?action=TEMPLATE&text=...     |
|                                                                                  |
+==================================================================================+
```

---

## INTEGRATION 5: TEAMUP

```
+==================================================================================+
|                                                                                  |
|   TEAMUP  <=======>  RCRS PLATFORM                                              |
|   ======================================                                         |
|   Direction: BI-DIRECTIONAL (calendar sync)                                     |
|                                                                                  |
|   +-------------------+          +-------------------------------+               |
|   | TEAMUP            |          | RCRS PLATFORM                |               |
|   |==================|          |==============================|               |
|   |                   |          |                               |               |
|   | Crew Schedules    | <======> | Calendar System               |               |
|   | (who works when   |          | (crew assignments visible     |               |
|   |  and where)       |          |  in portal calendar views)    |               |
|   |                   |          |                               |               |
|   |-------------------|          |-------------------------------|               |
|   |                   |          |                               |               |
|   | Job Calendar      | <======> | Job Scheduling                |               |
|   | (installation     |          | (job dates synced with        |               |
|   |  dates & crews)   |          |  production management)       |               |
|   |                   |          |                               |               |
|   |-------------------|          |-------------------------------|               |
|   |                   |          |                               |               |
|   | Event Colors      | <======> | Visual Calendar               |               |
|   | (team / type      |          | (color-coded events match     |               |
|   |  color coding)    |          |  TeamUp color scheme)         |               |
|   |                   |          |                               |               |
|   +-------------------+          +-------------------------------+               |
|                                                                                  |
|   CONFIG: TEAMUP_API_KEY=ksgfxermrxee1jz1fw in .env                            |
|   SYNC: Bi-directional -- changes in either system appear in both              |
|                                                                                  |
+==================================================================================+
```

---

## INTEGRATION 6: NWS API (National Weather Service)

```
+==================================================================================+
|                                                                                  |
|   NWS API  ------->  RCRS PLATFORM                                              |
|   ======================================                                         |
|   Direction: INBOUND ONLY (data pulled from NWS)                                |
|                                                                                  |
|   +-------------------+          +-------------------------------+               |
|   | NATIONAL WEATHER  |          | RCRS PLATFORM                |               |
|   | SERVICE API       |          |                               |               |
|   |==================|          |==============================|               |
|   |                   |          |                               |               |
|   | Storm History     | -------> | Check My Address Page         |               |
|   | (historical hail  |          | (/check-my-address)           |               |
|   |  events database) |          | Public lead capture tool      |               |
|   |                   |          |                               |               |
|   |-------------------|          |-------------------------------|               |
|   |                   |          |                               |               |
|   | Hail Reports      | -------> | Storm Report Generator        |               |
|   | (size, location,  |          | (lib/storm-report-service.ts) |               |
|   |  date, severity)  |          | 10 most recent events shown   |               |
|   |                   |          |                               |               |
|   |-------------------|          |-------------------------------|               |
|   |                   |          |                               |               |
|   | Geographic Data   | -------> | Risk Score Calculator         |               |
|   | (coordinates,     |          | (0-100 property risk score    |               |
|   |  distances)       |          |  based on proximity, size,    |               |
|   |                   |          |  recency, frequency)          |               |
|   |                   |          |                               |               |
|   |-------------------|          |-------------------------------|               |
|   |                   |          |                               |               |
|   | Event Details     | -------> | Insurance Evidence            |               |
|   | (official gov     |          | (printable report for         |               |
|   |  weather records) |          |  adjuster meetings & claims)  |               |
|   |                   |          |                               |               |
|   +-------------------+          +-------------------------------+               |
|                                                                                  |
|   USE CASES:                                                                     |
|   - Public lead generation (homeowners check their address)                      |
|   - Sales rep door-knocking tool (show storm data at the door)                  |
|   - Insurance claim evidence (official NWS data supports filings)               |
|   - Marketing tool (promote "Check My Address" across all channels)             |
|                                                                                  |
+==================================================================================+
```

---

## INTEGRATION 7: GOOGLE ANALYTICS

```
+==================================================================================+
|                                                                                  |
|   GOOGLE ANALYTICS  <-------  RCRS WEBSITE                                      |
|   =============================================                                  |
|   Direction: OUTBOUND ONLY (website sends data to GA)                           |
|                                                                                  |
|   +-------------------+          +-------------------------------+               |
|   | GOOGLE ANALYTICS  |          | RCRS WEBSITE                 |               |
|   | G-Y8PB85BZC5      |          |                               |               |
|   |==================|          |==============================|               |
|   |                   |          |                               |               |
|   | Page View Data    | <------- | 367 Website Pages             |               |
|   | (which pages get  |          | (every page sends tracking    |               |
|   |  the most visits) |          |  data to Google Analytics)    |               |
|   |                   |          |                               |               |
|   |-------------------|          |-------------------------------|               |
|   |                   |          |                               |               |
|   | Traffic Sources   | <------- | Visitor Origin                |               |
|   | (organic, direct, |          | (where visitors come from:    |               |
|   |  social, paid,    |          |  search, ads, social, direct) |               |
|   |  referral)        |          |                               |               |
|   |                   |          |                               |               |
|   |-------------------|          |-------------------------------|               |
|   |                   |          |                               |               |
|   | Conversion Data   | <------- | Form Submissions              |               |
|   | (form fills,      |          | (contact form, check my       |               |
|   |  click-to-call,   |          |  address, referral form)      |               |
|   |  portal signups)  |          |                               |               |
|   |                   |          |                               |               |
|   |-------------------|          |-------------------------------|               |
|   |                   |          |                               |               |
|   | Device Data       | <------- | User Agents                   |               |
|   | (mobile/desktop/  |          | (browser + device info sent   |               |
|   |  tablet, browser) |          |  with every page view)        |               |
|   |                   |          |                               |               |
|   +-------------------+          +-------------------------------+               |
|                                                                                  |
|   REPORTING: Marketing Director uses GA data for campaign ROI,                  |
|              traffic analysis, and conversion optimization                        |
|                                                                                  |
+==================================================================================+
```

---

## BONUS: VERCEL BLOB STORAGE

```
+==================================================================================+
|                                                                                  |
|   VERCEL BLOB  <=======>  RCRS PLATFORM                                        |
|   =============================================                                  |
|   Direction: BI-DIRECTIONAL (upload + serve)                                    |
|                                                                                  |
|   +-------------------+          +-------------------------------+               |
|   | VERCEL BLOB       |          | RCRS PLATFORM                |               |
|   | STORAGE           |          |                               |               |
|   |==================|          |==============================|               |
|   |                   |          |                               |               |
|   | Document Storage  | <======> | Customer Portal Documents     |               |
|   | (contracts, PDFs, |          | (upload & download via portal)|               |
|   |  reports)         |          |                               |               |
|   |                   |          |                               |               |
|   |-------------------|          |-------------------------------|               |
|   |                   |          |                               |               |
|   | Image Hosting     | <======> | Blog & Team Images            |               |
|   | (photos, logos,   |          | (CMS uploads, team photos,    |               |
|   |  marketing assets)|          |  before/after project shots)  |               |
|   |                   |          |                               |               |
|   |-------------------|          |-------------------------------|               |
|   |                   |          |                               |               |
|   | CDN Delivery      | -------> | Fast Image Loading            |               |
|   | (global edge      |          | (images served from nearest   |               |
|   |  network)         |          |  Vercel edge location)        |               |
|   |                   |          |                               |               |
|   +-------------------+          +-------------------------------+               |
|                                                                                  |
|   DEPENDENCY: @vercel/blob package in package.json                              |
|                                                                                  |
+==================================================================================+
```

---

## DATA FLOW SUMMARY

```
+==================================================================================+
|                                                                                  |
|   COMPLETE DATA FLOW MAP                                                        |
|   ======================                                                         |
|                                                                                  |
|                                                                                  |
|   Google Sheets ---[inventory, commissions, orders, leads, training]---> PORTAL  |
|   Google Sheets <--[stock updates, new orders, quiz scores]------------- PORTAL  |
|                                                                                  |
|   JobNimbus ------[contacts, jobs, estimates, notes, status]-----------> PORTAL  |
|   JobNimbus <-----[status push, new notes, commission calc]------------- PORTAL  |
|                                                                                  |
|   GroupMe --------[messages, DMs, @mentions]--------------------------> PORTAL  |
|   GroupMe <-------[system notifications, status alerts]----------------- PORTAL  |
|                                                                                  |
|   Google Cal -----[events, appointments]------------------------------> PORTAL  |
|   Google Cal <----[new events via URL links]---------------------------- PORTAL  |
|                                                                                  |
|   TeamUp ---------[crew schedules, job dates, colors]-----------------> PORTAL  |
|   TeamUp <--------[schedule changes, new events]------------------------ PORTAL  |
|                                                                                  |
|   NWS API --------[storm data, hail reports, coordinates]-------------> PORTAL  |
|                    (one-way: data pulled on demand)                               |
|                                                                                  |
|   Google Analytics [page views, traffic, conversions, devices]----> GA DASHBOARD |
|                    (one-way: website sends tracking data)                         |
|                                                                                  |
|   Vercel Blob ----[stored files served to users]----------------------> PORTAL  |
|   Vercel Blob <---[new uploads from CMS, portal]----------------------- PORTAL  |
|                                                                                  |
+==================================================================================+
```

---

## INTEGRATION STATUS DASHBOARD

```
+==================================================================================+
|                                                                                  |
|   INTEGRATION        DIRECTION     SYNC TYPE        STATUS    CONFIG KEY         |
|   ===========        =========     =========        ======    ==========         |
|                                                                                  |
|   Google Sheets      2-way         Real-time        ACTIVE    (Sheets API)       |
|   JobNimbus          2-way         Webhook+API      ACTIVE    JOBNIMBUS_API_KEY  |
|   GroupMe            2-way         API polling       ACTIVE    GROUPME_TOKEN      |
|   Google Calendar    2-way         URL links         ACTIVE    (URL format)       |
|   TeamUp             2-way         API sync          ACTIVE    TEAMUP_API_KEY     |
|   NWS API            Inbound       On-demand         ACTIVE    (public API)       |
|   Google Analytics   Outbound      Auto-tracking     ACTIVE    G-Y8PB85BZC5      |
|   Vercel Blob        2-way         Upload/Serve      ACTIVE    BLOB_READ_WRITE    |
|                                                                                  |
|   TOTAL: 8 integrations | 5 bi-directional | 1 inbound | 2 outbound            |
|                                                                                  |
+==================================================================================+
```

---

```
================================================================================
|                                                                              |
|   HOW IT ALL CONNECTS                                                        |
|   8 integrations working together as one unified platform.                   |
|                                                                              |
|   RIVER CITY ROOFING SOLUTIONS                                               |
|   www.rivercityroofingsolutions.com | (256) 274-8530                         |
|                                                                              |
================================================================================
```
