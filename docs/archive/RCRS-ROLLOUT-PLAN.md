# RCRS Platform Rollout Plan

**Created:** February 10, 2026
**Target Full Integration:** Monday, February 23, 2026

---

## TIMELINE OVERVIEW

```
TODAY (Mon Feb 10)     → Build, Test, Prep + Load NotebookLM
TOMORROW (Tue Feb 11)  → New Lead Training Launch + Phone System Setup
NEXT MONDAY (Feb 17)   → New Presentation + Portal Training for Sales Reps
FOLLOWING MONDAY (Feb 23) → Fully Integrated Operations
```

---

## PHASE 1: BUILD, TEST & PREP — Monday, February 10

### Morning: Final Build & Bug Fixes
- [ ] Fix horizontal privilege escalation in customer token routes
- [ ] Fix customer auth rate limit bypass
- [ ] End-to-end test: Contact form → Google Sheets + email notification
- [ ] End-to-end test: Referral form → Google Sheets + email notification
- [ ] Verify all portal logins work (each team member PIN)
- [ ] Verify Google Sheets read/write for inventory, commissions, orders
- [ ] Verify JobNimbus API connection and 2-way sync
- [ ] Test customer portal token generation and sharing

### Afternoon: Content & Material Prep
- [ ] Replace AI headshots with real team photos (or flag to team)
- [ ] Compress oversized blog images (5-6MB → under 500KB)
- [ ] Verify all 68 blog posts render correctly
- [ ] Review/update service area pages for accuracy
- [ ] Load ALL source material into NotebookLM (see Section below)
- [ ] Generate NotebookLM outputs: Brief, Mid-Dive, Deep-Dive system overviews
- [ ] Begin generating role-specific training modules from NotebookLM

### Evening: Testing Blitz
- [ ] Mobile testing on real devices (sales portal is mobile-first)
- [ ] Test GroupMe chat integration (send/receive messages)
- [ ] Test delivery workflow end-to-end (create order → assign driver → complete)
- [ ] Test billing workflow (create invoice → mark paid)
- [ ] Test lead distribution (new lead → auto-assign → rep notification)
- [ ] Verify Google Calendar link generation works
- [ ] Test Check My Address hail report page
- [ ] Screenshot all portals for training decks

---

## PHASE 2: NEW LEAD TRAINING & LAUNCH — Tuesday, February 11

### Morning: Lead System Training & Go-Live
- [ ] **Lead Training Session** (All sales reps + office staff)
  - How leads enter the system (website forms, Check My Address, manual entry)
  - Lead distribution rules (round-robin, proximity, territory)
  - Lead status workflow: New → Contacted → Scheduled → Inspected → Quoted → Won/Lost
  - Quick-assign from admin portal
  - Rep lead preferences and notification settings
  - Response time expectations and tracking

- [ ] **Website Launch Checklist**
  - DNS/domain verification (www.rivercityroofingsolutions.com)
  - SSL certificate valid
  - Google Analytics firing (G-Y8PB85BZC5)
  - Sitemap and robots.txt accessible
  - Contact form live and tested
  - Cookie consent banner active

### Afternoon: Phone System Setup
- [ ] **FreePBX / Google Voice Configuration**
  - Configure 8 extensions (from command-center/phone)
  - Set up IVR (auto-attendant) menu
  - Configure call routing rules
  - Set up voicemail for each extension
  - Test inbound/outbound calls
  - Configure call forwarding to mobile
  - Set business hours and after-hours routing
  - Document extension assignments:

| Extension | Name | Role |
|-----------|------|------|
| 101 | Main Line | IVR |
| 102 | Sara Hill | Office Manager |
| 103 | Tia | Admin |
| 104 | Destin | Admin |
| 105 | Chris Muse | President |
| 106 | Michael Muse | VP |
| 107 | John | Production |
| 108 | Sales Queue | Ring Group |

### Evening: Verify & Document
- [ ] Verify all phone extensions ring correctly
- [ ] Test voicemail-to-email
- [ ] Update phone system page in command center with live extensions
- [ ] Send team announcement: "Website is LIVE + new phone system"

---

## PHASE 3: PRESENTATION & PORTAL TRAINING — Monday, February 17

### Morning: New Presentation (All Hands)
- [ ] **System Overview Presentation** (Full team - 30-45 min)
  - Use NotebookLM "Mid-Dive" overview as presentation backbone
  - Cover all 9 major system sections
  - Show integration map (Google Sheets ↔ JobNimbus ↔ Portal ↔ Calendar)
  - Live demo of key workflows
  - Q&A

### Mid-Morning: Role-Specific Training Sessions

#### Session 1: Sales Reps (Brendon, Greg, Travis, Hunter, Aaron) — 60 min
- [ ] Sales Portal walkthrough (mobile-first demo)
- [ ] Lead management: viewing, filtering, status updates
- [ ] Customer CRM: JobNimbus integration, customer detail tabs
- [ ] Performance dashboard: commissions, leaderboard, goals
- [ ] Quick actions: Quick Call, Schedule, Send Quote, Upload Photo
- [ ] Check My Address: how to use it as a sales tool
- [ ] Customer Portal: generating and sharing portal links with customers
- [ ] GroupMe chat and team communication
- [ ] Hands-on: each rep logs in, views their leads, updates a status

#### Session 2: Office Staff (Sara, Tia, Destin) — 60 min
- [ ] Office Portal dashboard walkthrough
- [ ] Order management: creating, tracking, assigning
- [ ] Billing: invoices, payments, aging reports
- [ ] Scheduling: calendar views, Google Calendar sync
- [ ] Lead management from office perspective
- [ ] Phone system operations (transfer, voicemail, call logs)
- [ ] Customer portal management
- [ ] Hands-on: create a test order, generate an invoice

#### Session 3: Production & Delivery (John, Richard, Tae) — 45 min
- [ ] PM Portal: creating material orders
- [ ] Delivery portal: route management, stop tracking
- [ ] Driver loading checklist walkthrough
- [ ] Proof of delivery: photo upload, signature
- [ ] Inventory management: stock levels, reorder alerts
- [ ] Hands-on: create order → assign to driver → complete delivery

### Afternoon: Owner/Manager Deep Dive (Chris, Michael) — 60 min
- [ ] Command Center executive dashboard
- [ ] KPI tracking: revenue, pipeline, margins
- [ ] Sales leaderboard and rep performance comparison
- [ ] Financial reports and billing management
- [ ] Lead distribution configuration and rules
- [ ] Admin portal: CMS, settings, user management
- [ ] Marketing hub: campaigns, ads, email
- [ ] Meeting module: Monday prep, presentations
- [ ] Team reports and analytics
- [ ] System settings and configuration

### Supplemental Sessions (As Needed)
- [ ] **Marketing (Boston)** — 30 min: Marketing hub, ad management, content calendar, email campaigns, social media integration
- [ ] **Insurance (Bart)** — 30 min: Customer records, claims workflow, JobNimbus integration, document management

---

## PHASE 4: INTEGRATION WEEK — Feb 17-21

### Daily Goals
| Day | Focus |
|-----|-------|
| Mon Feb 17 | Training (see above) |
| Tue Feb 18 | Reps use sales portal for ALL new leads. Office processes orders through portal |
| Wed Feb 19 | First full delivery tracked end-to-end through system. Billing through portal |
| Thu Feb 20 | All customer communications through GroupMe. Calendar fully synced |
| Fri Feb 21 | Full day of integrated operations. Identify any gaps. Fix issues |

### Integration Checkpoints
- [ ] Every new lead enters through the website or portal (no paper/text leads)
- [ ] Every order created in the portal (not verbal/text)
- [ ] Every delivery tracked with proof-of-delivery photos
- [ ] Every invoice generated from the billing portal
- [ ] All scheduling through the calendar system
- [ ] Phone system handling all business calls
- [ ] GroupMe used for all team communication
- [ ] Customer portals shared with every active customer

---

## PHASE 5: FULLY INTEGRATED — Monday, February 23

### Full Operations Day
- [ ] Monday meeting run through command center meeting module
- [ ] All leads, orders, deliveries, billing running through platform
- [ ] Command center KPIs reflecting real data
- [ ] Sales leaderboard showing current week performance
- [ ] All team members comfortable with their portals
- [ ] Customer portals actively being used

### Success Metrics
- [ ] 100% of new leads entered through system
- [ ] 100% of orders created through portal
- [ ] 100% of deliveries tracked with photos
- [ ] 100% of invoices generated from billing
- [ ] All team members logged in and active within past 24 hours
- [ ] Zero "I don't know how to..." questions going unanswered
- [ ] Customer portal links shared with at least 5 active customers

---

## NOTEBOOKLM TRAINING MATERIAL PLAN

### What to Load into NotebookLM

Load ALL of the following as source material so NotebookLM can generate training content:

#### Source Documents to Upload
1. **ARCHITECTURE.md** — Complete system architecture documentation
2. **PUNCHOUT-LIST.md** — Feature list and system capabilities
3. **RCRS-UNIFIED-PLATFORM-PLAN.md** — Integration roadmap
4. **RCRS-BUILD-STATUS.md** — Current build state
5. **This rollout plan** (RCRS-ROLLOUT-PLAN.md)
6. **The System Overview Document** (RCRS-SYSTEM-OVERVIEW.md — see below)
7. **Screenshots** of every portal/dashboard (take today)
8. **Team roster** with roles, PINs, contact info

#### First Priority: Three-Tier System Overview

Once all material is loaded, have NotebookLM create:

##### 1. BRIEF OVERVIEW (2-3 min read / 1-page handout)
> "What is the RCRS Platform?"
- One-paragraph elevator pitch
- List of 9 major sections with one-line descriptions
- Key integrations mentioned
- "Why this matters" closing statement
- **Use for:** Quick team email, handout at meetings, intro before training

##### 2. MID-DIVE OVERVIEW (10-15 min read / presentation backbone)
> "The RCRS Platform: How It All Works Together"
- Section-by-section walkthrough with feature highlights
- Integration map showing data flow between systems
- Role-based access explanation (who sees what)
- Key workflows illustrated (lead → sale → delivery → billing)
- Benefits per role
- **Use for:** All-hands presentation on Feb 17, new hire orientation

##### 3. DEEP DIVE OVERVIEW (30+ min read / reference document)
> "RCRS Platform Complete Reference Guide"
- Every section detailed with all features
- API integrations explained with data flow diagrams
- Security model and authentication explained
- Configuration options and settings
- Troubleshooting common issues
- Admin procedures (adding users, changing settings, etc.)
- **Use for:** Admin reference, troubleshooting guide, onboarding deep-read

---

### Role-Specific Training Modules

Each module follows this structure:
1. **System Features & Functions** — What exists, what it does
2. **Your Use Cases** — How YOU use it in your role
3. **Settings & Configuration** — Guided setup walkthrough
4. **Hands-On Practice** — Try it yourself exercises

---

#### MODULE 1: OWNER / MANAGER (Chris, Michael)
**NotebookLM Outputs:** Mind map, infographic, walkthrough video script

| Section | Content |
|---------|---------|
| **Features** | Command Center dashboard, KPI tracking, revenue trends, pipeline, cash flow, team performance, leaderboard, financial reports, lead distribution, admin CMS, blog/team/services/areas management, user management, portal settings, meeting module, phone system overview |
| **Use Cases** | Morning KPI check, weekly team performance review, lead assignment rules, Monday meeting prep, financial reporting, customer portal oversight, marketing campaign management |
| **Settings** | Admin password, portal settings per rep, lead distribution rules, meeting templates, notification preferences, Google Sheets access, JobNimbus sync config |
| **Practice** | View command center → check KPIs → review leaderboard → adjust lead distribution → prep Monday meeting → generate financial report |

**NotebookLM Prompts:**
- "Create a mind map of all features available to the Owner role in the RCRS platform"
- "Create an infographic showing the Owner's daily workflow through the platform"
- "Write a video script walking an owner through their morning dashboard routine"

---

#### MODULE 2: SALES REP (Brendon, Greg, Travis, Hunter, Aaron)
**NotebookLM Outputs:** Mind map, infographic, walkthrough video script, quick-reference card

| Section | Content |
|---------|---------|
| **Features** | Mobile sales dashboard, lead list with filters, customer CRM (6-tab view), performance stats, commission tracking, leaderboard rank, Quick Call, Schedule, Send Quote, Upload Photo, Check My Address tool, customer portal link sharing, GroupMe chat |
| **Use Cases** | Check morning leads, call priority leads, schedule inspections, update lead status, view commission progress, share customer portal with homeowner, use Check My Address as door-knocking tool, team communication via chat |
| **Settings** | Lead preferences (territory, notification), profile photo/bio, contact info, notification settings |
| **Practice** | Log in on phone → view leads → call a lead → update status → check performance → share customer portal link → send a chat message |

**NotebookLM Prompts:**
- "Create a mind map of the Sales Rep portal features in RCRS"
- "Create an infographic showing a sales rep's typical day using the RCRS platform"
- "Write a quick-reference card (front and back) for sales reps using the mobile portal"
- "Create a video script: 'Your First Day Using the RCRS Sales Portal'"

---

#### MODULE 3: OFFICE STAFF (Sara, Tia, Destin)
**NotebookLM Outputs:** Mind map, infographic, walkthrough video script, process flowcharts

| Section | Content |
|---------|---------|
| **Features** | Office portal dashboard (4 tabs), delivery ticket management, invoice management, material order creation, scheduling/calendar, lead entry, phone system operations, customer portal management, document management, team directory |
| **Use Cases** | Process incoming calls → create leads, create material orders for jobs, track deliveries, generate and send invoices, manage schedule and appointments, handle customer inquiries via portal, coordinate with drivers |
| **Settings** | Calendar sync (Google Calendar), notification preferences, invoice templates, order form defaults |
| **Practice** | Create a material order → assign driver → track delivery → generate invoice → mark paid → schedule follow-up |

**NotebookLM Prompts:**
- "Create a mind map of Office Staff features in the RCRS platform"
- "Create a flowchart: 'Processing a New Customer Order from Start to Finish'"
- "Create an infographic showing the Office Portal's 4 main tabs and what each does"
- "Write a video script: 'Office Portal Mastery - Your Complete Walkthrough'"

---

#### MODULE 4: PRODUCTION MANAGER (John)
**NotebookLM Outputs:** Mind map, infographic, walkthrough video script

| Section | Content |
|---------|---------|
| **Features** | PM order portal, material order creation, delivery coordination, crew scheduling, job timeline, inventory visibility, task management, Monday notes |
| **Use Cases** | Review upcoming jobs, create material orders, coordinate delivery timing with crews, check inventory for availability, update job status, communicate schedule changes |
| **Settings** | Notification preferences, calendar sync, order form defaults |
| **Practice** | Review schedule → create material order → check inventory → coordinate delivery → update job status |

**NotebookLM Prompts:**
- "Create a mind map of Production Manager features in RCRS"
- "Create a flowchart: 'Material Order to Job Site Delivery'"
- "Write a video script: 'Production Manager Portal - Daily Operations Guide'"

---

#### MODULE 5: DRIVER (Richard)
**NotebookLM Outputs:** Mind map, quick-reference card, walkthrough video script

| Section | Content |
|---------|---------|
| **Features** | Driver portal, assigned routes with stops, Google Maps navigation, loading checklist, proof-of-delivery photos, delivery status updates, real-time ETA, customer notifications |
| **Use Cases** | Morning: check assigned routes, verify loading checklist. During delivery: navigate to stops, update status, take delivery photos. End of day: confirm all deliveries complete |
| **Settings** | Notification preferences, vehicle assignment |
| **Practice** | Check route → complete loading checklist → navigate to first stop → mark arrived → take delivery photo → complete delivery → move to next stop |

**NotebookLM Prompts:**
- "Create a simple quick-reference card for drivers using the RCRS delivery portal"
- "Create a step-by-step infographic: 'Your Delivery Day from Start to Finish'"
- "Write a video script: 'Driver Delivery Portal - Everything You Need to Know in 5 Minutes'"

---

#### MODULE 6: MARKETING (Boston)
**NotebookLM Outputs:** Mind map, infographic, walkthrough video script

| Section | Content |
|---------|---------|
| **Features** | Marketing hub, ad management (Facebook/Instagram/Google/Print), email campaigns with templates, content calendar, blog CMS, Check My Address lead generation, Google Analytics, social media integration points, SEO tools (JSON-LD structured data on all pages) |
| **Use Cases** | Plan weekly content, manage ad campaigns, send email blasts, publish blog posts, monitor Check My Address leads, review analytics, coordinate with BNI outreach |
| **Settings** | Facebook Pixel (to configure), Google Ads (to configure), email template customization, blog categories, content calendar setup |
| **Practice** | Review marketing dashboard → check ad performance → draft blog post → schedule email → review Check My Address leads → check analytics |

**NotebookLM Prompts:**
- "Create a mind map of Marketing features in the RCRS platform"
- "Create an infographic: 'RCRS Digital Marketing Toolkit - Everything at Your Fingertips'"
- "Write a video script: 'Marketing Hub Tour - Managing Campaigns, Content & Leads'"

---

#### MODULE 7: MATERIALS MANAGER (Tae)
**NotebookLM Outputs:** Mind map, infographic, process flowchart

| Section | Content |
|---------|---------|
| **Features** | Inventory management (11 products), stock levels and alerts, reorder thresholds, transaction history, material order fulfillment, vendor/supplier tracking, delivery coordination, cost visibility |
| **Use Cases** | Morning inventory check, process material orders, coordinate with vendors for restocking, verify loading checklists, track material usage trends, manage returns |
| **Settings** | Reorder thresholds, stock alerts, vendor contacts, cost visibility preferences |
| **Practice** | Check inventory levels → review low stock alerts → process pending order → verify loading checklist → update stock after delivery |

**NotebookLM Prompts:**
- "Create a mind map of Inventory and Materials Management features in RCRS"
- "Create a flowchart: 'Material Order Lifecycle - From Request to Delivery'"
- "Write a video script: 'Inventory Management - Keeping RCRS Stocked and Ready'"

---

#### MODULE 8: INSURANCE SPECIALIST (Bart)
**NotebookLM Outputs:** Mind map, infographic, walkthrough video script

| Section | Content |
|---------|---------|
| **Features** | Customer records via JobNimbus, claims documentation, job history and status, document sharing via customer portal, hail/storm data (Check My Address), communication logs, estimate tracking |
| **Use Cases** | Pull customer claim history, share storm reports with adjusters, document damage with photos, track claim status through JobNimbus, share portal access with homeowners for transparency |
| **Settings** | JobNimbus access, document upload preferences, notification settings |
| **Practice** | Look up customer → review storm report data → pull JobNimbus job details → share customer portal → document claim notes |

**NotebookLM Prompts:**
- "Create a mind map of Insurance Claims features accessible in the RCRS platform"
- "Create an infographic: 'Using RCRS Data to Support Insurance Claims'"
- "Write a video script: 'Insurance Claims Workflow in the RCRS Platform'"

---

## NOTEBOOKLM CONTENT CREATION CHECKLIST

### Step 1: Load Sources (Today)
- [ ] Upload ARCHITECTURE.md
- [ ] Upload PUNCHOUT-LIST.md
- [ ] Upload RCRS-UNIFIED-PLATFORM-PLAN.md
- [ ] Upload RCRS-BUILD-STATUS.md
- [ ] Upload RCRS-ROLLOUT-PLAN.md (this file)
- [ ] Upload RCRS-SYSTEM-OVERVIEW.md (create today — see companion doc)
- [ ] Upload portal screenshots (take today)
- [ ] Upload team roster data

### Step 2: Generate System Overviews (Today)
- [ ] Brief Overview (2-3 min read)
- [ ] Mid-Dive Overview (10-15 min, presentation-ready)
- [ ] Deep Dive Overview (30+ min reference)

### Step 3: Generate Role Modules (Today/Tomorrow)
- [ ] Module 1: Owner/Manager — mind map, infographic, video script
- [ ] Module 2: Sales Rep — mind map, infographic, video script, quick-ref card
- [ ] Module 3: Office Staff — mind map, infographic, video script, flowcharts
- [ ] Module 4: Production Manager — mind map, infographic, video script
- [ ] Module 5: Driver — mind map, quick-ref card, video script
- [ ] Module 6: Marketing — mind map, infographic, video script
- [ ] Module 7: Materials Manager — mind map, infographic, flowchart
- [ ] Module 8: Insurance Specialist — mind map, infographic, video script

### Step 4: Package for Training Sessions
- [ ] Print brief overviews as handouts for all team
- [ ] Build Feb 17 all-hands presentation from mid-dive
- [ ] Prepare role-specific packets (mind map + infographic + quick-ref)
- [ ] Load video scripts for recording (or have NotebookLM generate audio)
- [ ] Create login cheat sheet (name, email, PIN, portal URL) per person

---

## TEAM LOGIN REFERENCE

| Name | Email | PIN | Role | Primary Portal |
|------|-------|-----|------|----------------|
| Chris Muse | chrismuse@rcrsal.com | 1138 | Owner | Command Center |
| Michael Muse | michaelmuse@rcrsal.com | 1135 | Owner | Command Center |
| Sara Hill | sara@rcrsal.com | 1131 | Admin | Office Portal |
| Tia | tia@rcrsal.com | (team-roles.ts) | Office | Office Portal |
| Destin | destin@rcrsal.com | (team-roles.ts) | Office | Office Portal |
| Boston | boston@rcrsal.com | (team-roles.ts) | Marketing | Admin/Marketing |
| John | john@rcrsal.com | (team-roles.ts) | PM | PM Portal |
| Brendon | brendon@rcrsal.com | (team-roles.ts) | Sales | Sales Portal |
| Greg | greg@rcrsal.com | (team-roles.ts) | Sales | Sales Portal |
| Travis | travis@rcrsal.com | (team-roles.ts) | Sales | Sales Portal |
| Hunter | hunter@rcrsal.com | (team-roles.ts) | Sales | Sales Portal |
| Aaron | aaron@rcrsal.com | (team-roles.ts) | Sales | Sales Portal |
| Bart | bart@rcrsal.com | (team-roles.ts) | Specialist | Sales/Customer |
| Tae | tae@rcrsal.com | (team-roles.ts) | Materials | Inventory |
| Richard | richard@rivercityroofingsolutions.com | (team-roles.ts) | Driver | Driver Portal |

**Portal URL:** https://www.rivercityroofingsolutions.com/portal

---

## EMERGENCY CONTACTS & ESCALATION

- **Platform Issues:** Michael Muse (256-221-4290)
- **Vercel Dashboard:** Accessible via GitHub login
- **Google Sheets:** Shared via rcrsal.com workspace
- **JobNimbus:** Admin login with Chris or Michael
- **Phone System:** Michael manages FreePBX/GV config
