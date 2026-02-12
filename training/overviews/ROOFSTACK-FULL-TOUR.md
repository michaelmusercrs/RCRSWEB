# The RCRS Platform — Mid-Dive Overview

**River City Roofing Solutions** | All-Hands Meeting | February 17, 2026
**Presenter:** Michael Muse | **Duration:** 10-15 minutes | www.rivercityroofingsolutions.com

---

> We did not buy an off-the-shelf system and force our business into it. We built a platform around the way River City actually works — every lead, every job, every delivery, every dollar — connected and visible in real time. This walkthrough covers the nine major sections, how they connect, and what it means for every person on this team.

---

## 1. Public Website

**What it is:** The 24/7 face of River City Roofing Solutions online. Over 300 pages of SEO-optimized content that drive inbound leads without anyone picking up the phone. Every page is built with structured data (JSON-LD) so Google understands exactly who we are, what we do, and where we serve.

**Key Features:**
- 300+ live pages covering services, locations, FAQs, and guides
- 68 published blog articles building organic search authority
- 17 individual team profile pages — every rep has a professional online presence
- Local landing pages for Huntsville, Madison, Decatur, Birmingham, and Nashville
- Contact form that drops leads directly into the pipeline (Google Sheets + email notification)
- Referral program page with trackable submissions
- BNI networking page for partner referrals
- Google Analytics (G-Y8PB85BZC5) tracking all traffic and conversions

**Who uses it:** Everyone benefits. **Boston** manages content and monitors analytics. **Sales reps** share their profile links and blog posts with prospects. **Chris and Michael** track lead volume and traffic trends through analytics.

**How it connects:** Contact form submissions flow into Google Sheets and trigger email alerts. Blog content supports SEO that feeds the Check My Address tool. Google Analytics data informs the marketing hub inside the Command Center.

---

## 2. Check My Address

**What it is:** A public-facing tool where any homeowner types in their address and instantly receives a hail and storm risk report. Behind the scenes, it pulls real data from the National Weather Service, scores the property's risk from 0 to 100, and auto-creates a lead in the system. It is both a customer tool and a sales weapon.

**Key Features:**
- Homeowner enters address and contact info on a clean, simple form
- System pulls NWS historical hail and storm event data for that location
- Generates a risk score (0-100) with color-coded severity
- Displays a timeline of past hail events affecting the area
- Provides actionable recommendations based on risk level
- Automatically creates a new lead record with the homeowner's info
- Shareable report link reps can text or email to prospects

**Who uses it:** **Sales reps** (Brendon, Greg, Travis, Hunter, Aaron, Bart) use it as a door-knocking and cold-outreach tool — "Let me pull up your address real quick." **Homeowners** find it through the website or social media. **Boston** promotes it across marketing channels.

**How it connects:** Every address lookup auto-creates a lead that appears in the Sales Portal pipeline and Command Center lead management. The contact info feeds into Google Sheets. Reps can immediately act on the lead from their mobile dashboard.

---

## 3. Command Center

**What it is:** The executive dashboard for ownership and management. Think of it as the cockpit of the entire business — every number that matters is visible in one view. Revenue, margins, pipeline value, team performance, inventory status, and marketing campaigns are all here, updated in real time.

**Key Features:**
- KPI cards: Revenue MTD/YTD, Gross Margin, Active Pipeline, Cash Flow
- Revenue trend chart with historical comparison
- Team leaderboard — $2.6M+ in tracked commissions across 4,199 transactions
- AI-powered insights panel highlighting trends and anomalies
- Financial reports with drill-down capability
- Lead management overview with source tracking and conversion rates
- Inventory status summary with low-stock flags
- Marketing hub: 10 ad variations, 5 email templates, content calendar
- Meeting module: prep agendas, presentation mode, archive past meetings
- Phone system overview: 8 extensions, call routing status

**Who uses it:** **Chris and Michael** (owners) for strategic decisions and daily pulse checks. **Sara** (Office Manager) for operational oversight. **John** (Production Manager) for job and delivery status. **Donnie** (Strategic Advisor) for performance review.

**How it connects:** Aggregates data from every other section. Sales Portal feeds rep performance and pipeline data. Inventory Management feeds stock levels. Billing feeds revenue and margin numbers. JobNimbus sync keeps CRM data current. Google Sheets serves as the underlying data layer.

---

## 4. Sales Portal

**What it is:** A mobile-first dashboard built for reps in the field. It is designed so that everything a sales inspector needs — leads, schedules, commissions, customer details — is accessible from a phone while standing on a roof or sitting in a truck. No desktop required.

**Key Features:**
- Commission progress bar with real-time earnings calculation
- Quick stats: deals closed, pipeline value, win rate
- Team comparison showing rank against other reps
- Priority leads list with inline actions: Call, Text, Send Portal Link, View Details
- Quick-action buttons: Call, Schedule, Send Quote, Upload Photo
- Today's inspections with integrated map view
- Bottom mobile navigation for thumb-friendly use
- Lead status workflow: New > Contacted > Scheduled > Inspected > Quoted > Won/Lost
- Full customer CRM powered by JobNimbus — 6-tab detail view (Overview, Active Jobs, History, Documents, Messages, Transactions)
- Performance dashboard with leaderboard ranking

**Who uses it:** **Brendon, Greg, Travis** (Sales Inspectors), **Hunter** (Birmingham Regional), **Aaron** (Nashville Regional), **Bart** (Insurance Claims). Daily driver for every field rep.

**How it connects:** Leads flow in from the Public Website contact form and Check My Address tool. Customer data syncs bi-directionally with JobNimbus. Commission calculations pull from Billing data. Scheduled inspections sync with Google Calendar and TeamUp. When a rep marks a job "Won," it triggers downstream workflows for ordering materials and scheduling delivery.

---

## 5. Office Portal

**What it is:** The operations nerve center for the office team. Where the Command Center is about big-picture numbers, the Office Portal is about executing the daily work — creating material orders, managing delivery tickets, processing invoices, and keeping jobs moving.

**Key Features:**
- 4-tab dashboard: Dashboard Stats, Delivery Tickets, Invoices, Create Order
- Delivery ticket management: search, filter, assign drivers, pull materials
- Invoice management: filter by status (Created/Sent/Paid/Overdue), mark paid
- Order creation: job info, customer contact, PM details, delivery details, and a material selection grid with running total
- Real-time delivery scheduling and dispatch
- Lead entry for walk-in and phone inquiries
- Phone operations: call routing, voicemail management across 8 extensions

**Who uses it:** **Sara** (Office Manager) as her primary workspace. **Tia and Destin** (Admin) for order entry, ticket creation, and invoice processing. **John** (Production Manager) for delivery coordination and job scheduling.

**How it connects:** Orders created here pull material data from Inventory Management and auto-generate delivery tickets that appear in the Driver Portal. Invoices link back to job records in JobNimbus. Delivery schedules sync to Google Calendar. Material pulls update inventory quantities in real time.

---

## 6. Delivery & Driver Portal

**What it is:** The field logistics dashboard for drivers and delivery coordinators. It provides everything needed to load a truck correctly, navigate to job sites efficiently, and confirm delivery with documentation — all from a phone or tablet.

**Key Features:**
- List view and map view of all assigned deliveries
- Route management with ordered stops and progress bars
- One-tap Google Maps navigation to each stop
- Driver loading checklist: item-by-item verification, photo capture, safety checks
- Proof of delivery: photos, notes, and status updates uploaded on-site
- Real-time ETA system with automatic recalculation
- Customer notification system: automated delivery-day and approaching-ETA alerts
- Status workflow: Assigned > Loading > In Transit > Delivered

**Who uses it:** **Richard** (Driver) as his daily operations screen. **Tae** (Materials Manager) for loading verification and dispatch. **John** (Production Manager) for delivery status tracking. **Sara** for customer communication and scheduling confirmation.

**How it connects:** Delivery tickets originate from orders created in the Office Portal. Material lists pull from Inventory Management. ETA notifications are sent to customers automatically. Proof-of-delivery photos and notes attach to the job record in JobNimbus. Completed deliveries update inventory quantities and trigger invoice readiness.

---

## 7. Inventory Management

**What it is:** A live inventory tracking system covering every material category we stock. It replaces manual counts and guesswork with real-time quantities, automatic alerts, and a full audit trail of every item that comes in or goes out.

**Key Features:**
- 11 product categories tracked (shingles, underlayment, flashing, vents, nails, etc.)
- Real-time sync with Google Sheets as the data backend
- Low stock alerts triggered when quantities hit reorder thresholds
- Configurable reorder points per item
- Full transaction history with audit trail (who moved what, when, and why)
- Role-based cost visibility: owners see dollar costs, others see quantities only
- Stock adjustment logging for returns, damage, corrections

**Who uses it:** **Tae** (Materials Manager) for daily stock management and receiving. **Sara** for ordering and cost tracking. **Chris and Michael** for cost analysis and purchase approvals (full cost visibility). **John** for ensuring materials are available before scheduling deliveries.

**How it connects:** Material orders from the Office Portal pull quantities from inventory and update stock levels automatically. Low-stock alerts surface in the Command Center. The loading checklist in the Driver Portal cross-references inventory to verify items are in stock. Google Sheets provides the persistent data layer for all inventory records.

---

## 8. Billing & Invoicing

**What it is:** The financial engine that turns completed jobs into invoices and tracks every dollar from creation to payment. It replaces manual invoice generation with a system that pulls job data, calculates costs, and monitors payment status automatically.

**Key Features:**
- Invoice generation from job data with pre-filled customer and job details
- Status workflow: Created > Sent > Paid / Overdue
- Customer aging reports showing outstanding balances by time period
- Commission calculation tied to invoice payments
- Job invoice breakdowns: itemized materials + labor costs
- PDF export for email and print
- Overdue payment alerts with escalation tracking

**Who uses it:** **Sara** (Office Manager) for invoice creation and payment tracking. **Tia and Destin** for data entry and payment recording. **Chris and Michael** for financial oversight, aging reports, and commission approvals. **Sales reps** see their commission impact as invoices move through the workflow.

**How it connects:** Invoices pull job and customer data from JobNimbus. Material costs reference Inventory Management pricing. Paid invoices feed revenue and margin calculations into the Command Center KPIs. Commission amounts roll up into rep performance in the Sales Portal leaderboard. Overdue alerts trigger follow-up tasks.

---

## 9. Training & Onboarding

**What it is:** A structured learning system so every new hire (and existing team member) can get up to speed on both roofing sales skills and how to use this platform. No more "shadow someone for a week and figure it out." Courses are self-paced with real assessments.

**Key Features:**
- 3 training paths: Sales Training, Interface Onboarding, RCRS University
- Sales Training: 7 modules covering prospecting through close, with quizzes at each stage
- 70% minimum score required to pass each quiz — retakes are unlimited
- Completion certificates generated for each finished course
- Interface Onboarding: 8 sections walking through every portal feature with "Try It" links that open the actual tools
- RCRS University: ongoing development for advanced topics and continuing education
- Progress tracking persisted in Google Sheets — management can see who has completed what
- Training library with study guides, flashcards, and infographics

**Who uses it:** **All new hires** during onboarding. **Sales reps** for the Sales Training path. **Office and admin staff** for Interface Onboarding. **Boston** for managing training content. **Chris, Michael, and Sara** for monitoring completion and compliance.

**How it connects:** Quiz results and completion status are stored in Google Sheets. Certificates link to the team member's profile. The Interface Onboarding sections link directly into live portal pages, so trainees learn by doing. Management can view training progress from the Command Center.

---

## Integration Map

All nine sections are connected through a shared set of external services. Here is how each integration touches the platform:

```
                        +---------------------+
                        |   RCRS PLATFORM     |
                        +---------------------+
                                 |
        +------------------------+------------------------+
        |            |           |           |            |
  +-----v----+ +----v-----+ +---v------+ +-v----------+ +v-----------+
  | Google   | | JobNimbus | | GroupMe  | | Google     | | NWS        |
  | Sheets   | | CRM      | | Chat     | | Calendar   | | Weather    |
  +----------+ +----------+ +----------+ | + TeamUp   | +------------+
                                         +------------+
        |            |           |           |            |
  Forms, Inventory,  Contacts,   Team &     Inspections,  Hail events,
  Training progress, Jobs,       DM chat,   Deliveries,   Storm history,
  Lead tracking,     Notes,      @mentions,  Follow-ups,  Risk scoring
  Financial data     Status sync Notifications Reminders

                    + Google Analytics (G-Y8PB85BZC5)
                      Traffic, conversions, page performance
```

| Integration | What It Does | Where It Appears |
|---|---|---|
| **Google Sheets** | Persistent data backend for forms, inventory, training, leads, and financial records | Every section |
| **JobNimbus** | Two-way CRM sync — contacts, jobs, notes, status updates, and commission data | Sales Portal, Office Portal, Command Center, Billing |
| **GroupMe** | Team messaging and DMs embedded in the portal with @mention notifications | All portal pages (floating chat widget) |
| **Google Calendar** | Scheduling links for inspections, deliveries, follow-ups, and meetings | Sales Portal, Office Portal, Delivery Portal |
| **TeamUp** | Shared team calendar with bi-directional sync to the platform calendar | Calendar views, Command Center |
| **NWS (National Weather Service)** | Real-time and historical storm/hail data for risk scoring | Check My Address, lead auto-creation |
| **Google Analytics** | Full traffic and conversion tracking across all public pages | Public Website, Command Center marketing hub |

---

## Key Workflows

### Lead to Cash: The Full Lifecycle

```
Homeowner visits website          Rep knocks door with
  or finds Check My Address        Check My Address report
         |                                |
         v                                v
  +-- LEAD CREATED (auto) ---------------+
  |
  v
  Sales Portal: Lead appears in rep's priority queue
  |
  v
  Rep takes action: Call / Text / Schedule Inspection
  |
  v
  Inspection completed, photos uploaded, estimate sent
  |
  v
  Customer accepts quote --> Job status: WON
  |
  v
  Office Portal: Material order created --> Inventory updated
  |
  v
  Delivery Portal: Ticket assigned, driver loads, delivers
  |
  v
  Proof of delivery: Photos + notes uploaded on-site
  |
  v
  Billing: Invoice generated from job data --> Sent to customer
  |
  v
  Payment received --> Commission calculated --> Rep dashboard updated
  |
  v
  Command Center: Revenue, margin, and performance KPIs updated
```

### Material Order to Delivery

```
  Office creates order (material grid + job details)
         |
         v
  Inventory quantities reserved, stock levels updated
         |
         v
  Delivery ticket generated, driver assigned
         |
         v
  Driver sees ticket in Delivery Portal
         |
         v
  Loading checklist: item-by-item verify + photos
         |
         v
  In Transit: ETA system active, customer notified
         |
         v
  On-site: Proof of delivery captured
         |
         v
  Inventory finalized, job record updated, invoice ready
```

---

## Role Access Matrix

| Portal / Section | Chris | Michael | Sara | Tia / Destin | Boston | John | Sales Reps | Hunter / Aaron | Bart | Tae | Richard | Donnie |
|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| **Public Website** (admin) | X | X | | | X | | | | | | | |
| **Check My Address** (use) | X | X | X | X | X | X | X | X | X | X | X | X |
| **Command Center** | X | X | X | | | X | | | | | | X |
| **Sales Portal** | X | X | | | | | X | X | X | | | |
| **Office Portal** | X | X | X | X | | X | | | | | | |
| **Delivery / Driver** | X | X | X | | | X | | | | X | X | |
| **Inventory** | X | X | X | X | | X | | | | X | | |
| **Billing & Invoicing** | X | X | X | X | | | | | | | | |
| **Training (admin)** | X | X | X | | X | | | | | | | |
| **Training (learner)** | X | X | X | X | X | X | X | X | X | X | X | X |

> **Note:** Chris and Michael have full access to everything. Other roles see only what they need. Cost data in Inventory and Billing is restricted to ownership and office management.

---

## What This Means for You

This is not extra work. This is less work, done better, with nothing falling through the cracks. Here is what changes for each role:

- **Chris (President/Owner):** You have a real-time cockpit for the entire business. No more waiting for end-of-month reports to know where you stand. Revenue, margins, pipeline, team performance — it is all live in the Command Center, every day.

- **Michael (VP/Owner):** Full visibility into every system, every integration, every data flow. The platform is built to scale with the business as we add markets and team members.

- **Sara (Office Manager):** The Office Portal is your new home base. Orders, delivery tickets, invoices, and scheduling are all in one place instead of scattered across apps, texts, and spreadsheets.

- **Tia and Destin (Admin):** Order entry, invoice processing, and lead intake are streamlined with forms that pre-fill data and validate inputs. Less re-typing, fewer errors.

- **Boston (Marketing Director):** 300+ pages of SEO content, full analytics, ad templates, email campaigns, and a content calendar — all managed from the Command Center marketing hub. Check My Address is a lead-generation machine you can promote everywhere.

- **John (Production Manager):** Delivery schedules, driver status, inventory levels, and job timelines are all visible without making phone calls or sending texts. You will know where every job stands.

- **Brendon, Greg, Travis (Sales Inspectors):** Your phone is now your office. Leads are prioritized for you, commissions update in real time, scheduling is one tap, and Check My Address gives you a conversation starter at every door.

- **Hunter and Aaron (Regional Managers):** Same Sales Portal power, optimized for managing your market. Your team's performance, your pipeline, your numbers — all in your pocket.

- **Bart (Insurance Claims):** Full customer history and document access through the CRM integration. Every inspection, every photo, every note is attached to the job record.

- **Tae (Materials Manager):** Real-time inventory with low-stock alerts means you will never get surprised by a shortage. Loading checklists ensure the right materials go on the right truck every time.

- **Richard (Driver):** Your route, your checklist, your navigation — all on one screen. Proof of delivery is as simple as snapping a photo. No more paper tickets.

- **Donnie (Strategic Advisor):** The Command Center gives you the same executive view as ownership. KPIs, trends, team performance, and financial reports are all accessible for your advisory sessions.

---

## Next Steps

1. **This week:** Log in to your portal at **www.rivercityroofingsolutions.com/portal** and explore your dashboard
2. **By Feb 21:** Complete the Interface Onboarding training path (8 sections, about 30 minutes)
3. **Sales team by Feb 28:** Begin Sales Training Module 1
4. **Questions or issues:** Talk to Michael or Sara

---

**This platform is how we go from a good roofing company to a great one. Every lead tracked. Every job visible. Every dollar accounted for. Let's go.**

---

*River City Roofing Solutions | (256) 274-8530 | rcrs@rivercityroofingsolutions.com*
