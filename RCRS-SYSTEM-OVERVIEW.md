# RCRS Platform — Complete System Overview
## For NotebookLM Training Material Generation

**River City Roofing Solutions | www.rivercityroofingsolutions.com**
**Platform Version:** February 2026
**Contact:** rcrs@rivercityroofingsolutions.com | (256) 274-8530

---

## WHAT IS THE RCRS PLATFORM?

The RCRS Platform is a fully custom-built digital operations system for River City Roofing Solutions. It replaces scattered spreadsheets, text messages, phone calls, and manual processes with a single unified web application that every team member — from owners to drivers — accesses through their browser or phone.

The platform handles the entire business lifecycle: a homeowner finds the website or gets a hail report → becomes a lead → gets assigned to a sales rep → inspection scheduled → job created in CRM → materials ordered → delivery tracked → work completed → invoice generated → customer portal shared. Every step is tracked, every person knows their role, and leadership has real-time visibility into everything.

**Key Numbers:**
- 367+ pages across the platform
- 180+ API routes powering the backend
- 85+ reusable components
- 95+ library/service files
- 17 team members with role-based access
- 9 major system sections
- 5 deep integrations (Google Sheets, JobNimbus, GroupMe, Google Calendar, TeamUp)

---

## THE 9 MAJOR SECTIONS

### 1. PUBLIC WEBSITE (300+ pages)

The customer-facing website that establishes RCRS's online presence and generates leads.

**What it includes:**
- **Homepage** with brand messaging, service highlights, and calls-to-action
- **Blog** with 68 professionally written articles about roofing, storm damage, insurance claims, and home maintenance — drives organic SEO traffic
- **Team Pages** for all 17 team members with professional bios, photos, and specialties
- **Service Pages** detailing every service RCRS offers (roof replacement, repair, inspection, storm damage, insurance claims, gutters, etc.)
- **Service Area Pages** for Huntsville, Madison, Decatur, Birmingham, and Nashville — each with local SEO content
- **Contact Form** that submits directly to Google Sheets AND sends email notifications via Google Apps Script
- **Referral Rewards** program page for customer referrals
- **BNI Page** for Business Networking International partnerships
- **Check My Address** — a free hail/storm damage risk report tool (detailed below)
- **Privacy Policy and Terms of Service**

**SEO Features:**
- JSON-LD structured data on every public page (LocalBusiness, Article, Service, FAQs)
- Google Analytics (G-Y8PB85BZC5) tracking on all pages
- Sitemap and robots.txt for search engine crawling
- Mobile-responsive design across all pages

**Lead Generation:**
- Contact form (name, email, phone, message, service interest)
- Referral form (referrer info + referred person)
- Check My Address (address + contact info = lead + storm report)
- All forms submit to Google Sheets for tracking

---

### 2. CHECK MY ADDRESS — Hail & Storm Risk Reports

A powerful public tool that serves two purposes: provides genuine value to homeowners AND captures qualified leads.

**How it works:**
1. Homeowner enters their street address, city, state, and ZIP code
2. They provide their name, email, and phone number
3. System queries National Weather Service (NWS) storm data
4. Generates a comprehensive risk report including:
   - **Risk Score** (0-100) with color-coded severity level
   - **Total Hail Reports** near the address
   - **Closest Hail Distance** and **Largest Hail Size**
   - **Risk Factors** explaining the score
   - **Recent Hail Events** timeline (10 most recent with dates, sizes, severity)
   - **Recommendations** based on risk level
   - **Call-to-Action** to schedule a free inspection

**For Sales Reps:** This is a door-knocking and lead generation tool. Show homeowners their risk report on your phone, then schedule an inspection on the spot.

**For the Business:** Every report submission automatically creates a lead in the system with the homeowner's contact info and storm data attached.

---

### 3. COMMAND CENTER (Owner/Manager Dashboard)

The executive nerve center of the business. Gives leadership a real-time view of every aspect of operations.

**Executive Dashboard includes:**
- **KPI Cards:** Revenue MTD, Revenue YTD, Gross Margin, Pipeline Value, Cash Flow
- **Operational Stats:** Today's Sales, Active Jobs, Low Stock Alerts, Team Active count
- **Revenue Trend Chart:** 12-month bar chart showing monthly revenue
- **Insights Panel:** 6 AI-generated business insight cards
- **Team Performance:** Leaderboard with all reps showing Revenue, Deals, Avg Deal, % of Total
- **Financial Alerts:** Critical/Warning/Info severity levels for financial issues
- **Today's Schedule:** Upcoming appointments and events
- **Quick Actions:** One-click access to key functions

**Sub-Sections:**

#### Sales Leaderboard (`/command-center/sales`)
- Team ranking by revenue, transactions, average deal size
- Historical data: $2.6M+ total commissions, 4,199 transactions (2019-2026)
- Individual rep profiles with "Rep DNA" — performance characteristics
- Achievement wall with milestones and records
- Period filtering (month/quarter/year)

#### Financial Reports (`/command-center/reports/financial`)
- Revenue metrics (MTD, YTD, 12-month trends)
- Margin analysis and cash flow
- Invoice aging with overdue alerts
- Printable report generation

#### Team Reports (`/command-center/reports/team`)
- Cross-team performance comparison
- Department-level analytics
- Printable format for Monday meetings

#### Lead Management (`/command-center/leads`)
- Company-wide lead dashboard
- Search/filter by status, source, rep, date
- Quick-assign to available reps
- Lead source analytics (which channels produce best leads)
- Geographic mapping of lead locations

#### Inventory Overview (`/command-center/inventory`)
- Stock levels across 11 product categories
- Low stock alerts with reorder thresholds
- Individual SKU detail pages
- Cost tracking with role-based visibility

#### Marketing Hub (`/command-center/marketing`)
- Q1 2026 campaign plan with 10 ad variations
- Ad management across Facebook, Instagram, Google, Print
- 5 email campaign templates ready to use
- Content calendar for scheduling posts
- Copy management for consistent messaging

#### Meeting Module (`/command-center/meetings`)
- Monday meeting dashboard with prep tools
- Presentation mode for live team meetings
- Meeting archives with notes and action items
- Agenda builder and checklist tools

#### Phone System (`/command-center/phone`)
- 8 extensions configured and monitored
- Call history (inbound/outbound)
- Voicemail management
- Extension configuration and status

---

### 4. SALES PORTAL (Sales Rep Dashboard)

A mobile-first command center designed for sales reps in the field.

**Dashboard Features:**
- Personalized welcome with hot streak indicator
- **Monthly Commission Progress** — visual progress bar toward goals
- **Quick Stats:** Active Leads, Deals Closed, Rank, Commission earned
- **Team Comparison:** Percentage above/below team average
- **Commission Summary:** Earned (green), Pending (yellow), Avg Deal Size
- **Quick Actions:** Quick Call, Schedule, Send Quote, Upload Photo
- **Priority Leads:** Urgent/High priority leads with inline actions (Call, Text, Send Portal Link, Details)
- **Recent Activity:** Timeline of latest commissions, deals, lead updates
- **Today's Inspections:** Scheduled appointments with map navigation
- **Bottom Navigation:** Home, Leads, Quick Call (center button), Stats, Portal

**Lead Management:**
- Personal lead list with status filters (New, Contacted, Scheduled, Inspected, Quoted, Won, Lost)
- Search by name or address
- Priority sorting
- Quick status updates
- Lead preference settings (territory, notification frequency)

**Customer CRM (JobNimbus Integration):**
- Customer list pulled from JobNimbus
- 6-tab customer detail view:
  1. Overview (contact info, job summary)
  2. Active Jobs (current projects in progress)
  3. Job History (completed work)
  4. Documents (contracts, estimates, photos)
  5. Messages (communication log)
  6. Transactions (payments and invoices)
- Two-way sync: changes in portal update JobNimbus and vice versa

**Performance Dashboard:**
- Personal KPI tracking (revenue, conversion rate, avg deal)
- Monthly and yearly comparisons
- Goal tracking with progress indicators
- Commission trends over time
- Leaderboard position and movement

---

### 5. OFFICE PORTAL (Office Staff Dashboard)

The operations hub for daily office workflows.

**4-Tab Dashboard:**
1. **Dashboard Tab:** Summary stats (Active Tickets, Completed Today, Pending Invoices, Pending Amount $)
2. **Delivery Tickets Tab:** Table of all delivery tickets with search, filter by status, driver assignment dropdown, "Pull Materials" action button
3. **Invoices Tab:** Table of all invoices with search, status filter (Paid, Pending, Sent, Overdue), "Mark Paid" action
4. **Create Order Tab:** Full material order form with job info, customer contact, PM info, delivery details (date/time/priority/instructions), material selection grid with running total

**Key Capabilities:**
- Create material orders that auto-generate delivery tickets
- Assign drivers to deliveries
- Track delivery status in real-time
- Generate and manage invoices
- Process payments and mark invoices paid
- Schedule appointments and events
- Enter and route new leads
- Manage phone system (transfers, voicemail)
- Access customer portal information

---

### 6. DELIVERY & DRIVER PORTAL

Manages the complete material delivery lifecycle from order to proof-of-delivery.

**Delivery Management Hub:**
- List/Map view toggle for all deliveries
- Status filtering: Planned, In Progress, Completed
- Summary stats: Active Routes, Total Stops, Completed, Remaining, Unassigned
- Unassigned ticket banner with quick-assign buttons
- Two-pane layout: Route list (left) + Selected route details (right)

**Route Detail View:**
- Driver name, vehicle, distance, estimated duration
- Full Route button (opens Google Maps with all stops)
- Progress bar showing completed/total stops
- Per-stop cards with:
  - Status circle (Pending → In Progress → Delivered)
  - Priority badges (Urgent, Rush)
  - Customer info with clickable phone number
  - Navigate button (Google Maps directions)
  - Start Delivery / Complete Delivery / Photos buttons

**Driver Loading Checklist:**
- Item-by-item material verification before departing
- Photo documentation of loaded vehicle
- Safety checks
- Driver acknowledgment/sign-off

**Proof of Delivery:**
- Photo upload at delivery site
- Delivery notes
- Customer signature (if applicable)
- Automatic status updates and timestamps

---

### 7. INVENTORY & MATERIALS MANAGEMENT

Tracks all roofing materials and supplies with Google Sheets integration.

**Product Catalog (11 items tracked):**
- Fasteners, underlayment, pipe boots, ridge caps, starter strips, drip edge, flashing, ice & water shield, ventilation, sealants, and more

**Features:**
- Real-time stock levels synced with Google Sheets
- Low stock alerts when items hit reorder threshold
- Transaction history for every stock movement
- Material order fulfillment tracking
- Role-based cost visibility (owners/managers see costs; others see quantities only)
- Stock adjustment with audit trail (who changed what, when)
- Reorder threshold configuration per product

---

### 8. BILLING & INVOICING

Complete billing system integrated with job data.

**Features:**
- Invoice generation from job data
- Invoice status workflow: Created → Sent → Paid (or Overdue)
- Customer aging reports
- Revenue tracking and reporting
- Commission calculation tied to closed deals
- Job invoice breakdowns (materials + labor line items)
- PDF export capability
- Overdue invoice alerts with amounts and aging
- Bulk payment processing

---

### 9. TRAINING & ONBOARDING

Multi-path training system for new and existing team members.

**Training Hub (`/portal/training`) — 3 Paths:**

#### Path 1: Sales Training Course (7 Modules)
1. Introduction to RCRS
2. Products and Services
3. Sales Process and Techniques
4. Insurance Claims Process
5. Customer Relationship Management
6. Using the RCRS Portal
7. Advanced Sales Strategies

- Each module has lessons with content + quiz
- 70% passing score required
- Certificate generated upon completion
- Progress tracked in Google Sheets

#### Path 2: Interface Onboarding (8 Sections)
Guided walkthrough of the entire platform:
1. Dashboard Overview
2. Lead Management
3. Customer Portal
4. Scheduling & Calendar
5. Inventory System
6. Billing & Invoicing
7. Communication Tools
8. Reports & Analytics

Each section includes "Try It" links that take you directly to the relevant portal page.

#### Path 3: RCRS University
Extended learning modules for ongoing professional development.

---

## INTEGRATIONS & DATA FLOW

### Google Sheets (Primary Data Store)
- **17+ tabs** managing: Inventory, Commissions, Customers, Orders, Deliveries, Lead Distribution, Training Progress, and more
- Real-time read/write from the platform
- Fallback to JSON data if Sheets unavailable
- All form submissions (contact, referral) write to Sheets

### JobNimbus CRM (2-Way Sync)
- **Contacts:** Customer records sync bidirectionally
- **Jobs:** Job status, details, estimates sync between systems
- **Notes:** Activity notes sync to customer timeline
- **Status Push:** When a job status changes in the portal, it updates in JobNimbus
- **Commission Calculation:** Automated based on closed deal data from JN
- **Webhook Integration:** JN events trigger portal updates in real-time

### Google Calendar
- Calendar events created with one-click Google Calendar URL links
- Appointment scheduling from sales portal creates calendar entries
- Shared team calendar visibility
- Conflict detection for overlapping appointments

### TeamUp Calendar
- Bi-directional sync with TeamUp for shared team calendaring
- Events created in either system appear in both
- Used for crew scheduling and job site coordination

### GroupMe Team Chat
- Full chat integration accessible from every portal page
- Group channels for team-wide communication
- Direct messages between team members
- @mentions with autocomplete
- Image, video, and file sharing
- Message polling for near real-time updates (10-second intervals)
- Floating chat widget on portal pages for quick access

### Google Apps Script
- Receives form submissions from contact and referral forms
- Sends email notifications to the RCRS team
- Triggers on new lead creation

### National Weather Service (NWS)
- Hail and storm event data for Check My Address feature
- Historical storm reports by geographic area
- Used for risk scoring and customer education

### Google Analytics
- Tracking ID: G-Y8PB85BZC5
- Page views, user behavior, conversion tracking
- Integrated across all public pages

### Vercel Blob Storage
- Document and image file storage
- Used for customer portal document sharing
- Profile photos and media uploads

---

## SECURITY & AUTHENTICATION

### Admin Authentication
- JWT-based with httpOnly cookies
- Admin password required (no hardcoded fallbacks)
- Session validation on 50+ admin routes
- Role-based route protection

### Portal Authentication
- Email + PIN login for team members
- Role-based access control (RBAC):
  ```
  owner > admin > manager > sales/office > project_manager > driver > viewer
  ```
- Each role sees only their permitted features and data
- Session validation on 50+ portal routes

### Customer Portal
- Token-based access (unique URL per customer)
- No password required — link sharing model
- Read-only access to their job data, timeline, documents

### Security Measures
- HMAC webhook signature validation for JobNimbus
- Rate limiting on authentication endpoints
- No test credentials in production
- AUTH_BYPASS_MODE available for pre-launch testing only

---

## ROLE ACCESS MATRIX

| Feature | Owner | Admin | Manager | Sales | Office | PM | Driver | Viewer |
|---------|-------|-------|---------|-------|--------|-----|--------|--------|
| Command Center | Full | Full | Full | Read | - | - | - | - |
| Sales Leaderboard | Full | Full | Full | Own | - | - | - | - |
| Lead Management | Full | Full | Full | Own | Create | - | - | - |
| Sales Portal | View All | View All | View All | Full | - | - | - | - |
| Office Portal | Full | Full | Full | - | Full | - | - | View |
| Delivery Mgmt | Full | Full | View | - | View | View | Full | - |
| Inventory | Full | Full | Full | View | Full | View | - | - |
| Billing | Full | Full | Full | - | Full | - | - | - |
| Admin CMS | Full | Full | Full | - | - | - | - | - |
| User Management | Full | Full | - | - | - | - | - | - |
| Phone System | Full | Full | Full | Use | Use | - | - | - |
| Calendar | Full | Full | Full | Own | Full | Own | Own | View |
| Chat | Full | Full | Full | Full | Full | Full | Full | - |
| Training | Manage | Manage | View | Full | Full | Full | Full | Full |
| Customer Portal | Manage | Manage | View | Share | View | - | - | - |

---

## KEY WORKFLOWS

### Lead to Customer Lifecycle
```
Website Visit / Check My Address / Referral / Manual Entry
        ↓
    Lead Created (Google Sheets)
        ↓
    Auto-Assigned to Sales Rep (distribution rules)
        ↓
    Rep Contacted (status: Contacted)
        ↓
    Inspection Scheduled (Google Calendar link)
        ↓
    Inspection Completed (status: Inspected)
        ↓
    Quote Sent (status: Quoted)
        ↓
    Deal Won → Job Created in JobNimbus
        ↓
    Materials Ordered → Delivery Scheduled
        ↓
    Delivery Completed (proof-of-delivery photos)
        ↓
    Work Completed → Invoice Generated
        ↓
    Payment Received → Commission Calculated
        ↓
    Customer Portal Shared (ongoing relationship)
```

### Material Order to Delivery
```
PM/Office Creates Order (material selection + job info)
        ↓
    Delivery Ticket Auto-Generated
        ↓
    Driver Assigned (office or auto-assign)
        ↓
    Driver Checks Loading Checklist
        ↓
    Route Optimized (Google Maps integration)
        ↓
    Driver Navigates to Stops
        ↓
    Delivery Completed (photos + status update)
        ↓
    Customer/Office Notified
        ↓
    Invoice Generated from Delivered Materials
```

### Monday Meeting Flow
```
Command Center → Meetings → Prep
        ↓
    Review KPIs from Executive Dashboard
        ↓
    Check Sales Leaderboard
        ↓
    Review Team Performance Report
        ↓
    Check Lead Pipeline
        ↓
    Review Inventory Status
        ↓
    Check Upcoming Schedule
        ↓
    Enter Presentation Mode
        ↓
    Archive Meeting Notes
```

---

## TEAM ROSTER

### Leadership
| Name | Title | Email | Phone | Role |
|------|-------|-------|-------|------|
| Chris Muse | President | chrismuse@rcrsal.com | 256-648-1224 | Owner |
| Michael Muse | Vice President | michaelmuse@rcrsal.com | 256-221-4290 | Owner |

### Regional Partners
| Name | Region | Email | Phone |
|------|--------|-------|-------|
| Hunter | Birmingham | hunter@rcrsal.com | 256-221-0548 |
| Aaron | Nashville | aaron@rcrsal.com | 256-656-7856 |

### Office Staff
| Name | Title | Email | Phone | Role |
|------|-------|-------|-------|------|
| Sara Hill | Office Manager | sara@rcrsal.com | 256-810-3594 | Admin |
| Tia | Admin | tia@rcrsal.com | 256-394-8396 | Office |
| Destin | Admin | destin@rcrsal.com | 256-905-7738 | Office |
| Boston | Marketing Director | boston@rcrsal.com | — | Marketing |

### Production & Field
| Name | Title | Email | Phone | Role |
|------|-------|-------|-------|------|
| John | Production Manager | john@rcrsal.com | 256-654-0875 | PM |
| Brendon | Sales Inspector | brendon@rcrsal.com | 256-616-6174 | Sales |
| Greg | Sales Inspector | greg@rcrsal.com | 256-221-1809 | Sales |
| Travis | Sales Inspector | travis@rcrsal.com | — | Sales |
| Bart | Insurance Claims Specialist | bart@rcrsal.com | 256-654-0747 | Specialist |
| Tae | Materials Manager | tae@rcrsal.com | 256-200-3467 | Materials |
| Richard | Driver | richard@rivercityroofingsolutions.com | — | Driver |

### Advisors
| Name | Title | Role |
|------|-------|------|
| Donnie Dotson | Strategic Advisor | Advisor |

---

## COMPANY INFORMATION

- **Legal Name:** River City Roofing Solutions
- **Website:** www.rivercityroofingsolutions.com
- **Email:** rcrs@rivercityroofingsolutions.com
- **Phone:** (256) 274-8530
- **Google Workspace Domain:** rcrsal.com
- **Brand Color:** #39FF14 (Neon Green)
- **Locations:** Huntsville AL (HQ), Decatur AL, Madison AL
- **Expanding To:** Birmingham AL (Q4 2025), Nashville TN (2026)
- **Founded by:** The Muse family — three generations of roofing expertise
- **Core Values:** Honest assessments, quality workmanship, customer education, community service

---

## TECHNOLOGY STACK

- **Framework:** Next.js 14.2.33 (React 18, TypeScript)
- **Styling:** Tailwind CSS with custom brand-green (#39FF14)
- **Hosting:** Vercel (auto-deploy from GitHub)
- **Data:** Google Sheets (17+ tabs) + JobNimbus CRM
- **File Storage:** Vercel Blob
- **Chat:** GroupMe API
- **Calendar:** Google Calendar URLs + TeamUp bi-directional sync
- **Analytics:** Google Analytics (G-Y8PB85BZC5)
- **Weather Data:** National Weather Service API
- **Email:** Google Apps Script (form notifications)
- **Phone:** FreePBX / Google Voice (8 extensions)
