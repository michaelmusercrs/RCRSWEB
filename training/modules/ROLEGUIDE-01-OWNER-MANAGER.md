# MODULE 1: Owner / Manager Training
## River City Roofing Solutions Platform

### Target Audience
**Chris Muse** (President) and **Michael Muse** (Vice President)

### Module Purpose
This training module covers every feature, workflow, and configuration setting available to the Owner role on the River City Roofing Solutions platform. After completing this module, you will be able to operate the entire platform confidently, manage your team, track financials, oversee leads and sales, and run your Monday meetings directly from the dashboard.

### Platform URL
**https://www.rivercityroofingsolutions.com**

### How to Use This Document
- **Section 1** catalogs every feature available to you.
- **Section 2** shows exactly how you use these features in your daily routine.
- **Section 3** walks through settings and configuration you should review and customize.
- **Section 4** provides hands-on exercises with exact click paths so you can practice.
- **NotebookLM Prompts** at the end generate mind maps, infographics, and video scripts from this content.

---

## SECTION 1: SYSTEM FEATURES & FUNCTIONS

Everything available to the Owner role. Each subsection describes a major area of the platform, what it contains, and what actions you can take.

---

### 1.1 Command Center — Your Executive Dashboard
**Path:** `/command-center`

The Command Center is the first thing you see when you log in. It is designed to give you a complete picture of the business in under 60 seconds.

#### KPI Cards (Top Row)
Five large metric cards displayed across the top of the dashboard:

| Card | What It Shows | Why It Matters |
|------|--------------|----------------|
| **Revenue MTD** | Total revenue closed this month to date | Are we on pace to hit monthly targets? |
| **Revenue YTD** | Total revenue closed this year to date | Are we on pace for annual goals? |
| **Gross Margin** | Percentage margin across all closed jobs | Is profitability healthy or slipping? |
| **Pipeline Value** | Total dollar value of all open/pending deals | What revenue is coming down the line? |
| **Cash Flow** | Current cash position and recent trend | Can we cover payroll, materials, and overhead? |

Each card includes a comparison indicator (up/down arrow with percentage) showing change from the prior period.

#### Revenue Trend Chart
- 12-month horizontal bar chart showing monthly revenue breakdown
- Hover over any bar to see the exact dollar amount for that month
- Visual comparison makes it easy to spot seasonal patterns, growth trends, or dips
- Use this to prepare for Monday meetings and quarterly reviews

#### Insights Panel
- 6 auto-generated business insight cards
- Each card highlights a specific trend, risk, or opportunity detected in your data
- Examples: "Lead response time increased 40% this week," "Rep X closed 3 deals in 2 days," "Inventory for shingles below reorder threshold"
- Cards are severity-coded: critical (red), warning (yellow), informational (blue)
- Click any insight card to navigate to the relevant detail page

#### Team Performance Leaderboard
- Full leaderboard showing every sales rep on the team
- Columns: Rep Name, Revenue, Deals Closed, Average Deal Size, Percentage of Total Revenue, Status
- Sortable by any column — click the column header to re-sort
- Color-coded status indicators: green (on target), yellow (behind pace), red (significantly behind)
- Click any rep name to drill into their individual performance page

#### Financial Alerts
- Real-time alert feed for financial issues requiring attention
- Three severity levels:
  - **Critical** (red): Overdue invoices past 60 days, margin below threshold, cash flow warning
  - **Warning** (yellow): Invoices approaching due date, margin trending down, unusual expense
  - **Info** (blue): New invoice paid, commission processed, budget milestone reached
- Each alert links directly to the relevant invoice, report, or setting

#### Today's Schedule
- Chronological list of all appointments and events for today
- Pulled from Google Calendar and TeamUp integrations
- Shows time, event title, location, and associated rep or customer
- Click any event to view full details or make changes

#### Quick Actions
- One-click buttons to jump to the most common tasks:
  - Assign a Lead
  - View Sales Report
  - Check Inventory
  - Open Calendar
  - Start Meeting Prep
  - View Invoices
  - Open Admin Panel
  - Open Chat

---

### 1.2 Sales Leaderboard
**Path:** `/command-center/sales`

#### Complete Team Rankings
- Historical data spanning 2019 through 2026
- Over $2.6M in tracked commissions across 4,199 transactions
- Each rep's total revenue, deal count, average deal size, and commission earnings
- Rankings update in real time as deals close

#### Rep DNA Profiles
- Each rep has a performance characteristics profile
- Metrics include: close rate, average deal cycle time, lead-to-close conversion, preferred deal size range, strongest lead sources
- Use Rep DNA to understand each person's selling style and assign leads accordingly

#### Achievement Wall
- Milestone badges displayed for each rep
- Examples: "First $100K Month," "$500K Year," "10 Deals in a Month," "Fastest Close"
- Visual recognition tool — display during Monday meetings to motivate the team

#### Period Filtering
- Toggle between Month, Quarter, and Year views
- Compare current period to same period last year
- Identify trends and seasonal performance shifts

#### Individual Rep Drill-Down
**Path:** `/command-center/sales/[rep-id]`
- Click any rep name from the leaderboard to see their full detail page
- Tabs: Overview, Commission History, Deal List, Customer Feedback, Trends
- Commission history shows every payment with date, amount, and associated job
- Deal list shows every job with status, value, and timeline
- Trends chart shows their revenue trajectory over 6/12/24 months

---

### 1.3 Financial Reports
**Path:** `/command-center/reports`

#### Revenue Metrics
- Revenue MTD and YTD with daily/weekly breakdowns
- 12-month trend line with month-over-month comparison
- Revenue by service type (roof replacement, repair, inspection, etc.)
- Revenue by lead source (referral, web, ad campaign, etc.)

#### Margin Analysis
- Gross margin percentage by job, by rep, and company-wide
- Material cost vs. labor cost breakdown
- Margin trends over time — are margins improving or declining?
- Flag jobs where margin fell below the target threshold

#### Cash Flow Tracking
- Current cash position
- Accounts receivable summary (what is owed to you)
- Accounts payable summary (what you owe)
- Projected cash flow for the next 30/60/90 days based on open invoices and pending deals

#### Invoice Aging
- Aging buckets: Current, 1-30 Days, 31-60 Days, 61-90 Days, 90+ Days
- Total dollar amount in each bucket
- List of overdue invoices with customer name, amount, and days overdue
- One-click to send payment reminder or escalate

#### Printable Team Performance Reports
**Path:** `/command-center/reports/team`
- Formatted report showing every rep's performance for a selected period
- Designed for print — clean layout, no navigation clutter
- Includes revenue, deals, margin, commission, and ranking
- Use for Monday meetings, quarterly reviews, or sharing with advisors

---

### 1.4 Lead Management
**Path:** `/command-center/leads`

#### Company-Wide Lead Dashboard
- Every lead in the system displayed in a filterable, searchable table
- Columns: Lead Name, Source, Status, Assigned Rep, Date Created, Last Activity, Value

#### Search & Filter
- Text search across lead name, address, phone, email, and notes
- Filter by:
  - **Status**: New, Contacted, Quoted, Won, Lost, Stale
  - **Source**: Website form, referral, ad campaign, Check My Address, phone call
  - **Assigned Rep**: Any team member or "Unassigned"
  - **Date Range**: Custom date picker or presets (today, this week, this month, this quarter)

#### Quick-Assign
- Select any unassigned lead and assign it to a rep with one click
- Assignment dropdown shows rep name, current lead count, and availability status
- Confirmation dialog shows the rep will be notified automatically

#### Lead Distribution Rules
- **Round-Robin**: Leads distributed evenly across all active reps in rotation
- **Proximity/Territory**: Leads assigned to the rep whose territory covers the lead's zip code
- **Priority Override**: Specific lead sources (e.g., referrals from key partners) can be routed to specific reps
- Configuration at: `/portal/admin/lead-distro`

#### Lead Source Analytics
- Breakdown of leads by source with conversion rates
- Which channels produce the most leads (volume)
- Which channels produce the highest-value leads (quality)
- Cost per lead by channel (when ad spend data is available)
- Use this to decide where to invest marketing dollars

#### Response Time Tracking
- Average time from lead creation to first rep contact
- Broken down by rep and by lead source
- Industry benchmark comparison
- Alerts when response time exceeds thresholds

---

### 1.5 Admin Portal (CMS)
**Path:** `/portal/admin`

#### Blog Management
**Path:** `/portal/admin/blog`
- Create, edit, preview, and publish blog articles
- 68+ existing articles in the content library
- Rich text editor with image embedding
- Category and tag management
- SEO fields: meta title, meta description, URL slug
- Schedule posts for future publication
- Save as draft for review before publishing

#### Team Profiles
**Path:** `/portal/admin/team`
- Manage bios, photos, and specialties for all 17 team members
- Edit any team member's public-facing profile
- Upload or change profile photos
- Set specialties, certifications, and years of experience
- Control which profiles appear on the public website

#### Service Pages
**Path:** `/portal/admin/services`
- Manage descriptions and content for each service offered
- Edit service titles, descriptions, pricing notes, and images
- Control the order services appear on the website
- Add or remove services as the business evolves

#### Service Areas
**Path:** `/portal/admin/areas`
- Manage 50+ cities and coverage zones
- Add new cities as expansion happens
- Remove or deactivate areas you no longer serve
- Each area has its own landing page for local SEO

#### Image Library
**Path:** `/portal/admin/media`
- Upload images (job photos, team photos, marketing assets)
- Organize into folders by category
- Images stored via Vercel Blob storage
- Copy image URLs for use in blog posts and pages

#### User Management
**Path:** `/portal/admin/users`
- View all team member accounts
- Assign roles: Owner, Manager, Sales Rep, Office Staff, Driver
- Enable or disable accounts
- Reset PINs for team members who are locked out
- Set permissions per role

#### Portal Settings
**Path:** `/portal/admin/settings`
- Configure customer portal features on a per-rep basis
- Toggle which widgets customers see (weather, hail reports, delivery tracking, documents, messaging)
- Set default notification preferences
- Configure system-wide settings (company name, logo, contact info)

#### Profile Approvals
- When a team member updates their profile, it enters a review queue
- Owner receives a notification to approve or reject the change
- Prevents unauthorized changes to public-facing team information

#### Lead Distribution Configuration
**Path:** `/portal/admin/lead-distro`
- Set and modify all lead distribution rules from one page
- Add/remove reps from the distribution pool
- Adjust round-robin order
- Define territory boundaries by zip code
- Set priority routing rules

---

### 1.6 Inventory Oversight
**Path:** `/command-center/inventory`

#### Stock Levels
- 11 product categories tracked: architectural shingles, 3-tab shingles, underlayment, flashing, ridge caps, drip edge, ice & water shield, nails/fasteners, vents, sealants, miscellaneous supplies
- Current quantity on hand for each category
- Unit cost and total value per category

#### Low Stock Alerts
- Configurable reorder threshold per product
- Alert appears on the Command Center dashboard when stock drops below threshold
- Alert includes current quantity, reorder point, and suggested order quantity

#### Cost Tracking
- Full cost visibility (owner-only feature — reps see quantity but not cost)
- Cost per unit, cost per category, total inventory value
- Cost trend tracking — are material prices increasing?

#### Transaction History
- Complete audit trail of every inventory transaction
- Types: Received, Issued to Job, Returned, Adjusted, Written Off
- Each transaction shows: date, type, product, quantity, user who recorded it, associated job (if applicable)
- Searchable and filterable by date range, product, transaction type, and user

#### Material Orders
- When materials are ordered, a delivery ticket is automatically created
- Delivery ticket includes: items, quantities, delivery address, requested date
- Links to driver loading checklist for fulfillment

#### Driver Loading Checklist
**Path:** `/portal/loading-checklist`
- Drivers see a checklist of items to load for each delivery
- Check off items as they are loaded onto the truck
- Owner can monitor loading status in real time

---

### 1.7 Billing Management
**Path:** `/command-center/billing`

#### Invoice Overview
- All invoices across all customers in one view
- Columns: Invoice Number, Customer, Amount, Date Issued, Due Date, Status (Paid, Pending, Overdue)
- Filter by status, date range, customer, or rep

#### Revenue Tracking & Forecasting
- Total revenue collected vs. total invoiced
- Projected revenue based on pending invoices and pipeline value
- Monthly and quarterly revenue forecasts

#### Commission Calculation & Tracking
- Commission rates configurable per rep
- Automatic calculation based on closed deal value
- Commission history per rep with payment dates
- Total commissions paid MTD, QTD, YTD

#### Job Invoice Breakdowns
- Click any invoice to see the full breakdown
- Materials cost (itemized from inventory)
- Labor cost (hours and rates)
- Margin calculation per job
- Notes and attachments

#### Overdue Invoice Monitoring
- Dedicated view for overdue invoices
- Sorted by days overdue (most overdue first)
- One-click to send payment reminder email
- Escalation workflow for severely overdue accounts

---

### 1.8 Marketing Hub
**Path:** `/command-center/marketing`

#### Q1 2026 Campaign Plan
- Strategic marketing plan for the current quarter
- Goals, target audience, budget allocation, and KPIs
- Timeline with milestones

#### Ad Variations
- 10 ad variations ready to deploy
- Platforms: Facebook, Instagram, Google Ads, Print
- Each ad includes: headline, body copy, image/creative, call to action, target audience
- A/B test notes and performance data when available

#### Email Campaign Templates
- 5 pre-built email templates:
  - New Customer Welcome
  - Seasonal Maintenance Reminder
  - Referral Request
  - Post-Job Follow-Up
  - Storm Damage Outreach
- Each template is customizable before sending

#### Content Calendar
- Monthly calendar showing planned blog posts, social media posts, email sends, and ad launches
- Drag and drop to reschedule
- Color-coded by content type

#### Ad Copy Management
- Library of approved ad copy organized by platform and campaign
- Version history so you can see what changed and when
- Performance notes attached to each variation

---

### 1.9 Meeting Module
**Path:** `/command-center/meetings`

#### Monday Meeting Dashboard
- Purpose-built page for running the weekly team meeting
- Pre-populated with current week's KPIs, alerts, and schedule

#### Meeting Prep Checklist
**Path:** `/command-center/meetings/prep`
- Step-by-step checklist to prepare for the meeting:
  - Review KPI cards
  - Check sales leaderboard
  - Review lead pipeline
  - Check inventory levels
  - Review upcoming schedule
  - Note any financial alerts
  - Prepare discussion topics
- Check off each item as you complete it

#### Presentation Mode
- Full-screen mode designed for displaying on a TV or projector during the meeting
- Clean, large-format display of KPIs, leaderboard, and schedule
- Navigate between sections with arrow keys or on-screen buttons
- No sidebar or navigation clutter — just the data

#### Meeting Archives
- Previous meetings saved with notes and action items
- Search past meetings by date or keyword
- Review what was discussed and what action items were assigned
- Track action item completion over time

---

### 1.10 Phone System
**Path:** `/command-center/phone`

#### Extension Overview
- 8 extensions configured for the team
- Each extension shows: number, assigned team member, status (online/offline/DND), and forwarding rules

#### Call History
- Inbound and outbound call logs
- Columns: Date/Time, Direction (In/Out), Caller, Duration, Extension, Status (Answered, Missed, Voicemail)
- Filter by date, extension, or direction

#### Voicemail Management
- Listen to voicemail recordings directly in the browser
- Mark as heard, flag for follow-up, or delete
- Voicemail-to-text transcription when available

#### Extension Configuration
- Assign extensions to team members
- Set forwarding rules (ring phone, then forward to cell after X seconds)
- Configure voicemail greetings
- Set business hours and after-hours routing

---

### 1.11 Team Chat (GroupMe Integration)
**Path:** `/portal/chat`

#### Group Channels
- All company group channels visible to owners
- Examples: General, Sales Team, Drivers, Office, Urgent
- Full message history with search

#### Direct Messages
- Send private messages to any team member
- Message history preserved and searchable

#### Chat Widget
- Floating chat widget available on all portal pages
- Quick access to messages without leaving your current page
- Notification badge shows unread message count
- Click to expand full chat interface

---

### 1.12 Calendar & Scheduling
**Path:** `/command-center/calendar`

#### Calendar Views
- **Month View**: Full month grid with event dots
- **Week View**: 7-day detailed view with time slots
- **Day View**: Single day with 30-minute time blocks

#### Google Calendar Integration
- Events sync to and from your Google Calendar (rcrsal.com domain)
- Create events in the platform and they appear in Google Calendar
- Events created in Google Calendar appear in the platform
- Google Calendar link format used for all event creation

#### TeamUp Sync
- Bi-directional sync with TeamUp calendar
- Company-wide visibility of all team schedules
- Color-coded by team member or event type

#### Conflict Detection
- System warns when scheduling overlaps with existing events
- Checks across all team members' calendars
- Suggests alternative times when conflicts are detected

#### Appointment Management
- Create, edit, and cancel appointments
- Assign to specific team members
- Set location (job site address)
- Add notes and attach documents
- Send calendar invites to customers and team members

---

### 1.13 Customer Portal (Owner View)
**Path:** `/portal/customer` (customer-facing) | Owner configures via `/portal/admin/settings`

#### What Customers See
As an owner, you should understand what your customers experience:
- **Job Timeline**: Visual progress tracker from estimate to completion
- **Weather Widget**: Current and forecast weather for their job site
- **Hail Report**: Recent hail activity in their area
- **Messages**: Direct messaging with their assigned rep
- **Documents**: Access to estimates, contracts, invoices, and warranty documents
- **Delivery Tracking**: Real-time status of material deliveries
- **Appointments**: Upcoming scheduled visits and inspections

#### Owner Controls
- Toggle features on/off per rep or company-wide
- View any customer's portal as they see it
- Monitor customer satisfaction through portal engagement metrics

---

### 1.14 Training Hub
**Path:** `/portal/training`

#### Three Training Paths
1. **Sales Training** — 7-module course with quizzes (70% pass rate required), certificates upon completion, results persisted to Google Sheets
2. **Interface Onboarding** — 8-section platform walkthrough with "Try It" links to each feature
3. **RCRS University** — Extended learning and professional development resources

#### Owner's Role in Training
- Monitor which team members have completed training
- Review quiz scores and completion rates
- Assign or recommend specific training paths to team members

---

### 1.15 Check My Address (Public Lead Capture)
**Path:** `/check-my-address`

#### How It Works
- Public-facing page linked from the website header, footer, and homepage CTA
- Visitors enter their address to check for recent storm/hail activity in their area
- System uses NWS (National Weather Service) data and storm-report-service.ts to generate a risk score
- If risk is elevated, the visitor is prompted to schedule a free inspection
- Lead is automatically captured and enters the lead management pipeline

#### Why Owners Should Know This
- This is a key lead generation tool — monitor its performance in Lead Source Analytics
- Understand the data behind risk scores so you can speak to it with customers
- The page drives organic traffic and converts visitors into inspections

---

### 1.16 Hail Reports & Storm Data
**Path:** `/command-center/hail` (admin view)

#### Storm Report Dashboard
- Recent hail events in your service area
- Severity, date, and affected zip codes
- Cross-referenced with customer addresses to identify proactive outreach opportunities

#### Outreach Integration
- Generate targeted outreach lists based on storm-affected areas
- Send storm damage awareness emails to customers in affected zones
- Track which customers responded and scheduled inspections

---

### 1.17 JobNimbus Integration (2-Way Sync)
**Path:** Runs in background; data visible throughout platform

#### What Syncs
- **Contacts**: Rep contacts and customer records sync between JobNimbus and the platform
- **Jobs**: Job records, statuses, and values sync bi-directionally
- **Notes**: Job notes sync so reps can update from either system
- **Status Push**: When a job status changes in one system, it updates the other

#### Commission Calculation
- Commission is calculated from synced job data
- Rates are configurable per rep
- Calculation runs automatically when jobs are marked complete

#### Owner Visibility
- You see the fully synced data on the Command Center, Sales Leaderboard, and Financial Reports
- No manual data entry required — JobNimbus is the source of truth for CRM data
- Sync engine (lib/jn-sync-engine.ts) handles all bi-directional updates

---

### 1.18 SEO & Structured Data
**Path:** Automatic on all public pages

#### JSON-LD Structured Data
- Every public page includes structured data for search engines
- StructuredData component automatically adds LocalBusiness, Service, and Article schema
- Improves search result appearance with rich snippets (star ratings, service areas, contact info)

#### 367 Pages for SEO
- 180+ API routes power dynamic content
- 50+ city-specific service area pages for local SEO
- 68+ blog articles for content marketing
- Each page optimized with meta titles, descriptions, and Open Graph tags

---

## SECTION 2: YOUR USE CASES — How Owners Use the Platform Daily

This section describes exactly how Chris and Michael use the platform throughout a typical workday. Each scenario includes specific actions and the pages involved.

---

### 2.1 Morning Routine (7:00 - 8:00 AM)

**Goal:** Get a complete snapshot of the business before the day starts.

1. **Open Command Center** (`/command-center`)
   - Glance at the 5 KPI cards across the top. Note Revenue MTD and compare it to where you were at this point last month. If the number is green and trending up, the team is on pace. If it is red or flat, you will want to investigate.

2. **Review Revenue Trends**
   - Look at the 12-month bar chart. Is this month's bar tracking above or below last month? Are you in a seasonal dip or a growth surge? Make a mental note of the trend to share with the team.

3. **Check Financial Alerts**
   - Scan the alert feed. If there is a critical alert (red), address it first. Common critical alerts: an invoice more than 60 days overdue, gross margin dropping below your threshold, or a cash flow warning. Click the alert to go directly to the issue.

4. **Scan the Team Leaderboard**
   - Who is at the top? Who has dropped? If a rep has zero activity for the week, that is a flag. If someone just closed a big deal, consider a shout-out in the team chat.

5. **Review Today's Schedule**
   - Check the schedule panel for key appointments. Are there any customer meetings, inspections, or deliveries today that you should be aware of? Any conflicts?

6. **Quick Check GroupMe** (`/portal/chat`)
   - Open the chat widget. Scan for any overnight messages from the team. Respond to anything urgent. The floating widget means you do not need to leave the Command Center.

**Time spent: 10-15 minutes. You now have a full picture of the business.**

---

### 2.2 Lead Management (As Needed Throughout the Day)

**Goal:** Ensure every lead is assigned and being worked promptly.

1. **Check the Lead Dashboard** (`/command-center/leads`)
   - Filter by Status: "New" to see any unassigned leads that came in overnight or this morning.
   - Check the count. If there are unassigned leads, they need attention immediately. Speed to lead matters.

2. **Review Lead Details**
   - Click on an unassigned lead to see the full details: name, address, phone, source, and any notes.
   - Check the address against your territory map. Which rep covers that area?

3. **Quick-Assign the Lead**
   - Use the quick-assign dropdown to assign the lead to the appropriate rep.
   - The rep will receive an automatic notification.
   - If you are unsure who should get it, check the leaderboard to see who has capacity.

4. **Check Lead Source Analytics**
   - Navigate to the analytics section of the lead dashboard.
   - Review which channels brought in leads this week: website form, Check My Address, referrals, ad campaigns.
   - If a channel is underperforming, consider adjusting the marketing spend. If a channel is overperforming, consider increasing investment.

5. **Adjust Distribution Rules (If Needed)**
   - Navigate to `/portal/admin/lead-distro`.
   - If you hired a new rep, add them to the round-robin rotation.
   - If a rep is on vacation or overloaded, temporarily remove them from distribution.
   - If a certain zip code is getting more leads, verify the territory assignment is correct.

---

### 2.3 Team Oversight (Throughout the Day)

**Goal:** Stay informed on team activity without micromanaging.

1. **Check Sales Rep Performance** (`/command-center/sales`)
   - Compare each rep's numbers to their goals for the month.
   - Click into any rep whose numbers look off to see their recent activity.
   - Look at their deal pipeline — are deals stuck in a stage? Are follow-ups overdue?

2. **Review Delivery Status** (`/command-center/inventory`)
   - Check if any deliveries are scheduled for today.
   - Open the driver loading checklist (`/portal/loading-checklist`) to see if materials are loaded and ready.
   - Verify the customer portal delivery tracking is showing the correct status.

3. **Monitor Inventory**
   - Check for any low stock alerts on the Command Center.
   - If a product is below the reorder threshold, initiate a material order.
   - Review the transaction history if anything looks unusual.

4. **Check GroupMe** (`/portal/chat`)
   - Monitor the team chat throughout the day.
   - Look for questions, updates, and field issues.
   - Use the General channel for company-wide updates, and direct messages for individual conversations.

5. **Review Customer Portal Feedback**
   - Navigate to Admin > Portal Settings to see customer engagement metrics.
   - Are customers using the portal? Which features are they engaging with most?
   - If a customer sent a message through the portal, ensure their rep responded.

---

### 2.4 Monday Meeting Prep (Sunday Evening or Monday Morning)

**Goal:** Walk into the Monday meeting fully prepared with data and talking points.

1. **Open Meeting Prep** (`/command-center/meetings/prep`)
   - The prep checklist gives you a structured walkthrough of everything to review before the meeting.
   - Work through each checklist item:

2. **Pull KPIs from the Executive Dashboard**
   - Open `/command-center` in a separate tab.
   - Note the 5 KPI card values. Write down or screenshot: Revenue MTD, Revenue YTD, Gross Margin, Pipeline Value, Cash Flow.
   - Note any significant changes from last week.

3. **Review the Sales Leaderboard**
   - Who is the top performer this week? This month?
   - Any reps who need encouragement or coaching?
   - Prepare specific callouts: "Sarah closed 4 deals this week, highest average deal size on the team."

4. **Check Team Performance Report** (`/command-center/reports/team`)
   - Open the printable report. Print it or have it ready to display.
   - This report shows every rep's numbers in a clean format.

5. **Review the Lead Pipeline**
   - How many new leads came in this week?
   - How many were assigned and contacted within 24 hours?
   - Any stale leads that need re-engagement?

6. **Check Inventory Levels**
   - Any products below reorder threshold?
   - Any large orders coming up that will require extra inventory?

7. **Review Upcoming Schedule**
   - What jobs are scheduled this week?
   - Any customer appointments that need owner attendance?
   - Any conflicts or scheduling issues?

8. **Enter Presentation Mode**
   - From the meeting prep page, click "Presentation Mode."
   - Walk through each section on the big screen during the meeting.
   - Use arrow keys to navigate between KPIs, leaderboard, pipeline, inventory, and schedule.

---

### 2.5 Administrative Tasks (Weekly or As Needed)

**Goal:** Keep the platform content, team access, and settings current.

1. **Approve Profile Updates** (`/portal/admin/team`)
   - Check the review queue for any pending profile changes from team members.
   - Review the changes (new photo, updated bio, added certification).
   - Approve or reject with a note.

2. **Review and Publish Blog Posts** (`/portal/admin/blog`)
   - Check for draft posts ready for review.
   - Read through the content for accuracy and brand voice.
   - Add or edit SEO fields (meta title, meta description).
   - Publish or schedule for a future date.

3. **Update Service Areas** (`/portal/admin/areas`)
   - As the business expands into new cities, add them here.
   - Each new city gets its own SEO-optimized landing page automatically.
   - Remove or deactivate cities you no longer serve.

4. **Configure Lead Distribution** (`/portal/admin/lead-distro`)
   - When you hire a new rep, add them to the rotation.
   - When a rep leaves or goes on leave, remove them.
   - Adjust territory boundaries as your service area changes.

5. **Manage User Access** (`/portal/admin/users`)
   - Add accounts for new team members.
   - Set the correct role (Owner, Manager, Sales Rep, Office Staff, Driver).
   - Disable accounts for departed team members immediately.
   - Reset PINs for anyone who is locked out.

6. **Review Marketing Campaigns** (`/command-center/marketing`)
   - Check the content calendar for upcoming posts and ads.
   - Review ad performance data if available.
   - Adjust campaign plans based on lead source analytics.

---

### 2.6 Quarterly Business Review

**Goal:** Deep analysis of business performance for strategic decisions.

1. **Pull Financial Reports** (`/command-center/reports`)
   - Revenue by month for the quarter.
   - Margin analysis — are margins stable, improving, or declining?
   - Cash flow trends — any seasonal patterns?

2. **Review Sales Leaderboard (Quarter View)**
   - Switch to quarterly filter on the leaderboard.
   - Identify top performers and underperformers.
   - Review Rep DNA profiles to understand performance patterns.

3. **Lead Source Analysis**
   - Which channels brought the most leads this quarter?
   - Which channels had the highest conversion rate?
   - Which channels had the highest average deal value?
   - Use this data to reallocate marketing budget.

4. **Inventory Review**
   - Review transaction history for the quarter.
   - Identify any waste, shrinkage, or cost increases.
   - Adjust reorder thresholds based on seasonal demand.

5. **Customer Portal Engagement**
   - How many customers used the portal this quarter?
   - Which features had the highest engagement?
   - Gather feedback for improvements.

---

## SECTION 3: SETTINGS & CONFIGURATION GUIDE

This section walks through every setting an owner should configure and maintain. Complete these in order for initial setup, then revisit as needed.

---

### 3.1 First-Time Setup

Complete these steps the first time you log in:

**Step 1: Log In**
- Go to `https://www.rivercityroofingsolutions.com/portal`
- Enter your email address (rcrsal.com domain)
- Enter your PIN
- You should land on the portal dashboard

**Step 2: Verify Your Profile**
- Click your name or profile icon in the top navigation
- Verify your photo is current and professional
- Verify your bio is accurate
- Confirm your contact information (phone, email)
- Save any changes

**Step 3: Verify Team Member Roles**
- Navigate to `/portal/admin/users`
- Review every team member in the list
- Confirm each person has the correct role:
  - **Owner**: Chris Muse, Michael Muse
  - **Manager**: (anyone with management responsibilities)
  - **Sales Rep**: All sales team members
  - **Office Staff**: Administrative personnel
  - **Driver**: Delivery drivers
- Correct any role assignments that are wrong

**Step 4: Set Up Lead Distribution**
- Navigate to `/portal/admin/lead-distro`
- Verify the list of reps in the distribution pool
- Choose your default distribution method (round-robin recommended)
- Define territories by zip code if applicable
- Set any priority routing rules (e.g., referrals from Partner X always go to Rep Y)
- Save the configuration

**Step 5: Configure Portal Settings**
- Navigate to `/portal/admin/settings`
- Review per-rep customer portal features
- Decide which widgets customers should see by default:
  - Job Timeline: ON (recommended)
  - Weather Widget: ON (recommended)
  - Hail Report: ON (recommended)
  - Messaging: ON (recommended)
  - Documents: ON (recommended)
  - Delivery Tracking: ON (recommended)
  - Appointments: ON (recommended)
- Save settings

**Step 6: Verify Quick Actions**
- Return to `/command-center`
- Click each Quick Action button to verify it navigates to the correct page
- If any link is broken, note it for the development team

---

### 3.2 Lead Distribution Setup (Detailed)

#### Round-Robin Configuration
1. Navigate to `/portal/admin/lead-distro`
2. Under "Distribution Method," select "Round-Robin"
3. The system will assign leads to each rep in order, rotating through the list
4. Set the rotation order by dragging rep names up or down
5. Reps at the top of the list get the first lead, then it cycles through

#### Territory/Proximity Configuration
1. Under "Distribution Method," select "Territory"
2. For each rep, define their territory by entering zip codes
3. When a lead comes in, the system matches the lead's zip code to the assigned territory
4. If a zip code is not assigned to any territory, the lead goes to the "Unassigned" queue for manual assignment

#### Adding or Removing Reps from Distribution
1. In the distribution pool, click "Add Rep" to include a new team member
2. Select the rep from the dropdown (only reps with the Sales Rep role appear)
3. To remove a rep, click the X next to their name
4. Removed reps stop receiving new leads immediately, but keep their existing leads

#### Priority Lead Routing
1. Under "Priority Rules," click "Add Rule"
2. Define the condition: Lead Source equals [specific source]
3. Define the action: Assign to [specific rep]
4. Example: "All leads from 'Partner Referral' source go to Chris Muse"
5. Priority rules override round-robin and territory assignments

---

### 3.3 Portal Settings (Detailed)

#### Per-Rep Feature Toggles
1. Navigate to `/portal/admin/settings`
2. Select a rep from the dropdown
3. Toggle ON or OFF each customer portal feature for that rep's customers
4. This allows you to customize the portal experience based on the rep's workflow

#### Customer Portal Default Settings
1. Under "Defaults," set the baseline feature set for all new customers
2. Individual rep settings override the defaults
3. Recommended defaults: all features ON

#### Notification Preferences
1. Under "Notifications," configure when and how notifications are sent
2. Options: Email, SMS, In-App, or combinations
3. Set notification types: Lead assigned, Invoice paid, Delivery scheduled, Customer message received
4. Set quiet hours (e.g., no notifications between 10 PM and 7 AM)

---

### 3.4 CMS Management (Detailed)

#### How to Create a Blog Post
1. Navigate to `/portal/admin/blog`
2. Click "Write New Post"
3. Enter the title (keep it under 60 characters for SEO)
4. Write or paste the content into the rich text editor
5. Add images by clicking the image icon and uploading from your computer or selecting from the image library
6. Set the category (e.g., Roofing Tips, Storm Damage, Company News)
7. Add tags (e.g., "shingles," "hail damage," "maintenance")
8. Fill in SEO fields:
   - Meta Title (displayed in search results, 50-60 characters)
   - Meta Description (displayed below the title in search results, 150-160 characters)
   - URL Slug (auto-generated from title, but editable)
9. Click "Preview" to see how the post will look on the website
10. Click "Save as Draft" to save without publishing, or "Publish" to go live immediately

#### How to Edit a Team Member Profile
1. Navigate to `/portal/admin/team`
2. Find the team member in the list and click "Edit"
3. Update any fields: name, title, bio, photo, specialties, certifications
4. Click "Save"
5. The changes will appear on the public website immediately (or after approval if the team member self-edited)

#### How to Manage Service Areas
1. Navigate to `/portal/admin/areas`
2. To add a new city: Click "Add City," enter the city name and state, define the zip codes covered, write a brief description for the landing page
3. To edit an existing city: Click the city name, update the information, click "Save"
4. To deactivate a city: Click the city name, toggle "Active" to OFF, click "Save"
5. Each active city automatically generates a landing page at `/services/[city-slug]`

#### How to Upload and Organize Images
1. Navigate to `/portal/admin/media`
2. Click "Upload" and select files from your computer
3. Supported formats: JPG, PNG, WebP
4. After upload, click the image to add a description and assign it to a folder
5. To use an image in a blog post or page, copy its URL from the image detail view

---

### 3.5 Financial Settings

#### Commission Rate Configuration
1. Navigate to `/command-center/billing` > "Commission Settings"
2. Set the default commission rate (percentage of deal value)
3. Override rates for specific reps if they have different agreements
4. Commission is calculated automatically when jobs are marked complete in JobNimbus

#### Invoice Settings
1. Review the invoice template for accuracy
2. Verify company name, address, phone, and email are correct
3. Confirm payment terms (Net 30, Net 60, etc.)
4. Set up automatic payment reminders at configurable intervals (e.g., 7 days before due, on due date, 7 days after due)

#### Billing Period Settings
1. Set the billing cycle: monthly or per-job
2. Configure when commission payments are processed
3. Set the reporting period boundaries (monthly close date, fiscal year start)

---

### 3.6 Security Settings

#### Password and Access
- Change your PIN regularly (at least every 90 days)
- Never share your PIN with anyone
- If you suspect unauthorized access, immediately change your PIN and review user access logs

#### Role-Based Access
- Owner role has full access to everything
- Manager role has access to reports and team management but not system configuration
- Sales Rep role has access to their own leads, deals, and customer portal
- Office Staff role has access to scheduling, inventory, and billing
- Driver role has access to loading checklists and delivery status

#### API Security
- HMAC webhook verification is enabled for all incoming webhooks
- Rate limiting is configured to prevent abuse
- Admin auth uses JWT tokens (no hardcoded credentials)

---

## SECTION 4: HANDS-ON PRACTICE EXERCISES

Complete these exercises in order. Each one walks you through a specific workflow with exact click paths. These are designed to be done on the live platform.

---

### Exercise 1: Morning Dashboard Check (5 minutes)

**Objective:** Become comfortable reading the Command Center at a glance.

1. Open your browser and navigate to `https://www.rivercityroofingsolutions.com/command-center`
2. Look at the top row of 5 KPI cards.
   - Write down the Revenue MTD value: $____________
   - Is it higher or lower than last month at this point? ____________
3. Look at the Revenue Trend Chart.
   - Which month in the last 12 had the highest revenue? ____________
   - Is the current month trending above or below the previous month? ____________
4. Read the 6 Insights Panel cards.
   - Are there any cards marked as critical (red)? Yes / No
   - Write down one actionable insight: ____________________________________________
5. Look at the Team Leaderboard.
   - Who is ranked #1 this month? ____________
   - Who has the highest average deal size? ____________
6. Check the Financial Alerts.
   - Are there any critical alerts? Yes / No
   - If yes, write down what the alert says: ____________________________________________

**You have now completed a full morning dashboard check.**

---

### Exercise 2: Assign a Lead (5 minutes)

**Objective:** Practice the lead assignment workflow.

1. Navigate to `/command-center/leads`
2. In the filter bar, set Status to "New"
3. Review the list of new leads. If there are no new leads, set the filter to "All" and pick any lead for practice.
4. Click on a lead to open the detail view.
   - Note the lead's name: ____________
   - Note the lead's source: ____________
   - Note the lead's zip code: ____________
5. Click the "Assign" or "Quick-Assign" button.
6. From the dropdown, select a sales rep.
   - Which rep did you assign it to? ____________
7. Click "Confirm Assignment."
8. Navigate back to the lead list and verify the lead now shows the assigned rep's name.

**You have now assigned a lead.**

---

### Exercise 3: Review Sales Performance (5 minutes)

**Objective:** Understand how to analyze individual rep performance.

1. Navigate to `/command-center/sales`
2. Look at the full leaderboard. Note the top 3 reps and their revenue:
   - #1: ____________ — $____________
   - #2: ____________ — $____________
   - #3: ____________ — $____________
3. Click on the #1 rep's name to open their detail page.
4. On the detail page, review:
   - Total commission earned: $____________
   - Number of deals closed: ____________
   - Average deal size: $____________
5. Click the "Trends" tab or section.
   - Is their revenue trending up or down over the last 6 months? ____________
6. Navigate back to the leaderboard.
7. Change the period filter to "Quarter."
   - Does the #1 rep change? Yes / No
   - Who is #1 for the quarter? ____________

**You have now reviewed sales performance data.**

---

### Exercise 4: Prep a Monday Meeting (10 minutes)

**Objective:** Walk through the complete meeting preparation process.

1. Navigate to `/command-center/meetings/prep`
2. Review the prep checklist. How many items are on the list? ____________
3. Open the Command Center (`/command-center`) in a new browser tab.
4. From the Command Center, note:
   - Revenue MTD: $____________
   - Pipeline Value: $____________
   - Number of critical alerts: ____________
5. Switch back to the meeting prep tab. Check off the "Review KPIs" item.
6. Navigate to `/command-center/sales` in the Command Center tab.
   - Note the #1 rep and their total for the week: ____________ — $____________
7. Switch back to meeting prep. Check off the "Review Sales Leaderboard" item.
8. Navigate to `/command-center/leads` in the Command Center tab.
   - How many leads are in "New" status? ____________
9. Check off the "Review Lead Pipeline" item.
10. Navigate to `/command-center/inventory` in the Command Center tab.
    - Are there any low stock alerts? Yes / No
11. Check off the "Check Inventory" item.
12. Now click "Presentation Mode" on the meeting prep page.
13. Practice navigating through each section using the arrow keys or on-screen buttons.
14. Exit Presentation Mode.

**You are now ready to run a Monday meeting.**

---

### Exercise 5: Manage a Blog Post (5 minutes)

**Objective:** Create, edit, and preview a blog post.

1. Navigate to `/portal/admin/blog`
2. Click "Write New Post"
3. Fill in the following:
   - Title: "Spring Roof Maintenance Tips for Alabama Homeowners"
   - Content: Write 2-3 sentences about checking your roof after winter storms.
   - Category: Select "Roofing Tips" (or the most appropriate category available)
4. Add SEO fields:
   - Meta Title: "Spring Roof Maintenance Tips | River City Roofing"
   - Meta Description: "Learn essential spring roof maintenance tips from River City Roofing Solutions to protect your Alabama home."
5. Click "Preview" to see how the post will look on the website.
6. Does the preview look correct? Yes / No
7. Click "Save as Draft" (do not publish unless you want this post to go live).

**You have now created a blog post draft.**

---

### Exercise 6: Configure Lead Distribution (5 minutes)

**Objective:** Understand and modify lead distribution rules.

1. Navigate to `/portal/admin/lead-distro`
2. Review the current configuration:
   - What distribution method is currently set? ____________ (Round-Robin / Territory / Other)
   - How many reps are in the distribution pool? ____________
3. Make a small change for practice:
   - If using Round-Robin, change the rotation order by moving a rep up or down one position.
   - If using Territory, note the zip codes assigned to one rep.
4. Click "Save" to save the configuration.
5. Verify the change is reflected by refreshing the page and checking the configuration again.
6. If you changed the rotation order, change it back to the original order and save again.

**You have now configured lead distribution rules.**

---

### Exercise 7: Review Inventory and Order Materials (5 minutes)

**Objective:** Check stock levels and understand the order workflow.

1. Navigate to `/command-center/inventory`
2. Review the stock levels for all 11 product categories.
   - Which product has the lowest stock? ____________
   - Is it below the reorder threshold? Yes / No
3. Click on a product category to see its transaction history.
   - What was the most recent transaction type? ____________ (Received / Issued / Adjusted)
   - When was it? ____________
4. Navigate back to the inventory overview.
5. If a product is below the reorder threshold, note the suggested order quantity: ____________

**You now understand inventory monitoring.**

---

### Exercise 8: Send a Message via GroupMe (3 minutes)

**Objective:** Use the platform's chat integration.

1. Navigate to `/portal/chat`
2. Select the "General" group channel.
3. Read the most recent 5 messages.
4. Type a test message: "Testing the chat system - please ignore."
5. Send the message.
6. Navigate to Direct Messages.
7. Select a team member and send a brief message.

**You are now comfortable with team chat.**

---

### Exercise 9: View the Customer Portal (5 minutes)

**Objective:** Understand what your customers see.

1. Navigate to `/portal/admin/settings`
2. Select any active rep from the dropdown.
3. Review which customer portal features are toggled ON for that rep.
   - Job Timeline: ON / OFF
   - Weather Widget: ON / OFF
   - Messaging: ON / OFF
   - Delivery Tracking: ON / OFF
4. Navigate to `/portal/customer` (or use the customer portal preview feature if available).
5. View the portal as a customer would see it.
6. Note which widgets appear and their layout.

**You now understand the customer experience.**

---

### Exercise 10: Full Workflow — Lead to Meeting (15 minutes)

**Objective:** Practice the complete workflow from receiving a lead to discussing it in a meeting.

1. Navigate to `/command-center/leads`. Find or identify a recent lead.
2. Quick-assign it to a rep.
3. Navigate to `/command-center/sales`. Check if the assigned rep's numbers updated.
4. Navigate to `/command-center/calendar`. Check if there are any scheduling conflicts for the rep today.
5. Navigate to `/portal/chat`. Send the rep a message: "New lead assigned to you — please follow up today."
6. Navigate to `/command-center/meetings/prep`. Note this lead in your meeting prep for Monday.
7. Navigate to `/command-center` (main dashboard). Verify the lead count in the pipeline KPI updated.

**You have now completed an end-to-end workflow.**

---

## NOTEBOOKLM GENERATION PROMPTS

Load this entire module into NotebookLM, then use the following prompts to generate training materials:

---

### Prompt 1: Feature Mind Map
```
Create a detailed mind map of ALL features available to the Owner role on the River City Roofing Solutions platform, organized by section: Command Center, Sales Leaderboard, Financial Reports, Lead Management, Admin Portal (CMS), Inventory, Billing, Marketing Hub, Meeting Module, Phone System, Team Chat, Calendar & Scheduling, Customer Portal, Training Hub, Check My Address, Hail Reports, JobNimbus Integration, and SEO. Include sub-features for each section.
```

### Prompt 2: Daily Workflow Infographic
```
Create an infographic showing the Owner's daily workflow through the River City Roofing Solutions platform. The workflow should include these phases: Morning KPI Check (/command-center), Lead Management (/command-center/leads), Team Oversight (/command-center/sales + /portal/chat), Monday Meeting Prep (/command-center/meetings/prep), and Administrative Tasks (/portal/admin). Include specific page paths, key actions at each phase, and estimated time per phase. Use a timeline format flowing from 7 AM to end of day.
```

### Prompt 3: Morning Routine Video Script
```
Write a 5-minute video script walking an owner of River City Roofing Solutions through their morning dashboard routine. Start at the Command Center (/command-center) and cover: reading the 5 KPI cards (Revenue MTD, Revenue YTD, Gross Margin, Pipeline Value, Cash Flow), interpreting the 12-month revenue trend chart, scanning financial alerts for critical issues, checking the team leaderboard for top performers, reviewing today's schedule, and doing a quick check of GroupMe messages. The tone should be professional but conversational, as if training a business partner. Include specific screen descriptions and what to look for at each step.
```

### Prompt 4: Quick-Reference Card
```
Create a one-page quick-reference card for the Owner role on the River City Roofing Solutions platform. Include: the 10 most important page paths with descriptions, 5 most common daily actions with click paths, 3 most important settings to configure, emergency actions (reset a PIN, disable an account, check critical alerts), and key shortcuts. Format it as a printable reference card with clear sections and minimal text.
```

### Prompt 5: Platform Presentation for Advisors
```
Generate a presentation outline (10 slides) that an owner of River City Roofing Solutions could use to demonstrate the platform to a business partner, investor, or advisor. Slide topics should include: Platform Overview (367 pages, 180+ API routes, full business management), Command Center and KPIs, Sales Tracking and Leaderboard ($2.6M+ commissions, 4,199 transactions), Lead Management and Distribution, Customer Portal Experience, Financial Reporting and Billing, Marketing and Content (68+ blog articles, 50+ city pages), Team Communication (GroupMe, Calendar, Meetings), Inventory and Delivery Management, and Integration Architecture (JobNimbus, Google Calendar, TeamUp, NWS data). Each slide should have 3-4 bullet points and a recommended screenshot or demo action.
```

---

## MODULE COMPLETION CHECKLIST

Before marking this module complete, verify you can do all of the following without assistance:

- [ ] Log in and navigate to the Command Center
- [ ] Read and interpret all 5 KPI cards
- [ ] Identify trends in the revenue chart
- [ ] Assign a lead to a sales rep
- [ ] Review a rep's detailed performance page
- [ ] Prepare for and run a Monday meeting in Presentation Mode
- [ ] Create and publish a blog post
- [ ] Add or remove a rep from lead distribution
- [ ] Check inventory levels and identify low stock items
- [ ] Send a message via GroupMe
- [ ] Review the customer portal as a customer sees it
- [ ] Configure portal settings for a rep
- [ ] Add a new team member account and set their role
- [ ] Review and approve a profile update
- [ ] Pull a printable team performance report

**Module 1 Complete.** Proceed to Module 2: Sales Rep Training.
