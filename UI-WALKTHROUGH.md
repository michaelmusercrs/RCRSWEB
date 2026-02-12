# RCRS SYSTEM WALKTHROUGH - Every Role, Every Screen
## What Each Person Sees From Login to Daily Use

**Created:** February 6, 2026
**Website:** www.rivercityroofingsolutions.com

---

## TABLE OF CONTENTS
1. [Public Website (What Customers See)](#1-public-website)
2. [Portal Login (All Staff)](#2-portal-login)
3. [Owner/Admin View (Michael, Chris, Sara)](#3-owneradmin-view)
4. [Manager View (Destin)](#4-manager-view)
5. [Office Staff View (Tia)](#5-office-staff-view)
6. [Project Manager View (Bart, John)](#6-project-manager-view)
7. [Sales Rep View (Hunter, Aaron, Greg, Brendon, Rick, Rudy, Adam)](#7-sales-rep-view)
8. [Driver View (Richard, Tae)](#8-driver-view)
9. [Customer Portal (External Customers)](#9-customer-portal)
10. [Command Center (Management Dashboard)](#10-command-center)

---

## 1. PUBLIC WEBSITE
**URL:** www.rivercityroofingsolutions.com
**Who sees this:** Anyone on the internet

### What They See:
- **Home Page** - Hero video background, service overview, call-to-action buttons
- **Promo Banner** (sticky top) - Current promotion or seasonal message
- **Header Navigation:**
  - Home
  - Services (dropdown: Roof Replacement, Repair, Storm Damage, etc.)
  - Service Areas (50+ city pages)
  - About / Team
  - Blog
  - Contact
  - BNI page
  - Financing
  - Referral Program
- **Footer** - Company info, links, social media, legal pages
- **Floating Contact Button** - Always visible, quick contact access
- **Cookie Consent Banner** - GDPR/privacy compliance

### Forms Available:
- **Contact Form** - Name, email, phone, service type, message
- **Referral Form** - Referrer info + referred person's info
- **Header Quick Form** - Compact contact form in the navigation

### What Happens When a Form is Submitted:
1. Data saved to Google Sheets (contact-submissions or referral-submissions tab)
2. Email sent to rcrs@rivercityroofingsolutions.com via Google Apps Script
3. Customer sees confirmation message

---

## 2. PORTAL LOGIN
**URL:** www.rivercityroofingsolutions.com/portal
**Who sees this:** All RCRS staff

### Login Screen:
- **Two login modes:**
  - **Staff Login** - Enter email address + 4-digit PIN
  - **Driver Login** - Enter 4-digit PIN only (simpler for field use)
- After successful login: redirected to role-specific dashboard
- **First-time login:** Shows role training popup explaining features
- **After updates:** Shows feature update popup with what's new

### Team Members & Their PINs:
| Name | Role | PIN | Email |
|------|------|-----|-------|
| Michael Muse | Owner | 1135 | michaelmuse@rcrsal.com |
| Chris Muse | Owner | 1138 | chrismuse@rcrsal.com |
| Sara Hill | Admin | 1131 | sara@rcrsal.com |
| Admin | Admin | 0000 | admin@rcrsal.com |
| Destin McCury | Manager | 1132 | destin@rcrsal.com |
| Tia Morris | Office | 1133 | tia@rcrsal.com |
| Bart Roberts | Project Manager | 1134 | bart@rcrsal.com |
| John Cordonis | Project Manager | 1137 | john@rcrsal.com |
| Richard Geahr | Driver | 1136 | richard@rivercityroofingsolutions.com |
| Tae Orr | Driver | 2033 | tae@rcrsal.com |
| Hunter | Sales | 2010 | hunter@rcrsal.com |
| Aaron | Sales | 2020 | aaron@rcrsal.com |
| Greg | Sales | 2030 | greg@rcrsal.com |
| Brendon Muse | Sales | 2040 | brendon@rcrsal.com |
| Rick | Sales | 2050 | rick@rcrsal.com |
| Rudy | Sales | 2060 | rudy@rcrsal.com |
| Adam | Sales | 2070 | adam@rcrsal.com |

---

## 3. OWNER/ADMIN VIEW
**Who:** Michael Muse, Chris Muse, Sara Hill
**Access:** Everything - full system control

### After Login -> Portal Dashboard (`/portal/dashboard`)
**What they see:**
- Stats cards: Active Deliveries, Completed Today, Pending Orders, Low Stock Items, Today's Schedule
- Quick access grid to ALL portals:
  - Admin Portal (content management)
  - Command Center (business metrics)
  - Office Portal (billing/orders)
  - PM Portal (job management)
  - Driver Portal (delivery view)
  - Sales Portal (lead management)
  - Manager Portal (operations)
  - Inventory Management
  - Schedule/Calendar
  - Reports
  - Settings
- Recent activity feed
- Logout button

### Admin Portal (`/portal/admin`)
**Content management hub with 6 sections:**

1. **Blog Posts** (`/portal/admin/blog`)
   - See list of all blog articles with title, date, author, status
   - Create new post: title, slug, content editor, featured image, keywords, excerpt
   - Edit existing posts
   - Toggle published/draft
   - Stats: total article count

2. **Team Members** (`/portal/admin/team`)
   - View all team member profiles
   - Edit: name, position, bio, phone, email, social links
   - Upload profile photos and truck photos
   - Set display order
   - Stats: total member count

3. **Image Gallery** (`/portal/admin/images`)
   - Upload new images
   - Browse by category (Team, Services, Blog, Certifications)
   - Set alt text for SEO
   - Delete images
   - Stats: total image count

4. **Service Areas** (`/portal/admin/areas`)
   - View all 50+ service area city pages
   - Edit city-specific content
   - Manage coverage zones

5. **Price Verification** (`/portal/admin/pricing`)
   - Audit incoming invoices from suppliers
   - Flag overcharges
   - Track pending credits
   - Compare quoted vs actual prices

6. **Inventory** (`/admin/inventory`)
   - Full stock management
   - Add/edit products (SKU, name, category, cost, price, quantity)
   - Set min/max stock levels
   - View low stock alerts
   - Supplier tracking

### Admin Settings (`/admin/settings`)
- **General:** Company name, phone, email, address
- **SEO:** Meta descriptions, keywords, Google Analytics ID
- **Integrations:** JobNimbus, Google Sheets, GroupMe, TeamUp
- **Notifications:** Email alerts, team notifications
- **Appearance:** Theme settings
- **Data Sync:** Trigger manual sync to Google Sheets

### Admin Approvals (`/admin/approvals`)
- Review pending team profile edits
- Approve or reject changes
- See who requested what changes and when
- Reviewer name logged automatically

### Admin System (`/admin/system`)
- System health status
- API endpoint status
- Database connectivity
- Error logs

### Legacy Admin Dashboard (`/admin/dashboard`)
- Quick stats overview
- Upcoming appointments
- System information

---

## 4. MANAGER VIEW
**Who:** Destin McCury
**Access:** View all operations, limited editing

### After Login -> Portal Dashboard
**Navigation sidebar shows:**
- Dashboard (home)
- Manager Portal
- Office Portal
- Billing
- Inventory
- Schedule
- Reports
- Command Center

### What Destin Can Do:
- **View** all dashboards, data, and reports
- **Manage** billing and invoices
- **Manage** inventory (stock levels, restock)
- **View/update** ticket status
- **Create** invoices
- **Manage** vendor purchases
- **View** reports and export data
- **View/edit** schedule
- **Assign** deliveries to drivers
- **View** team performance stats
- **View** inventory costs

### What Destin Cannot Do:
- Edit team member profiles
- Change system settings
- Access marketing tools
- Manage user accounts
- Approve profile changes

### Command Center Access:
Dashboard, Sales, Inventory, Phone, Meetings, Team, Reports, Schedule

---

## 5. OFFICE STAFF VIEW
**Who:** Tia Morris
**Access:** Billing, inventory, scheduling

### After Login -> Portal Dashboard
**Navigation sidebar shows:**
- Dashboard
- Office Portal
- Billing
- Inventory
- Schedule
- Command Center

### What Tia Can Do:
- **Manage** billing - create and track invoices
- **Manage** inventory - adjust stock levels, restock orders
- **View/update** all tickets
- **Create** invoices
- **Manage** vendor purchases
- **View** reports
- **View** schedule
- **Manage** stock quantities

### Office Portal (`/portal/office`)
- Order management interface
- Document management
- Billing integration panel

### Key Daily Tasks:
1. Check new contact form submissions in admin
2. Process material orders
3. Track delivery status
4. Update inventory after deliveries
5. Generate invoices for completed jobs
6. Manage vendor bills

### Command Center Access:
Dashboard, Inventory, Phone, Meetings, Billing, Schedule

---

## 6. PROJECT MANAGER VIEW
**Who:** Bart Roberts, John Cordonis
**Access:** Job scheduling, material ordering, delivery coordination

### After Login -> Portal Dashboard
**Navigation sidebar shows:**
- Dashboard
- PM Portal
- Inventory (view only)
- Schedule
- Command Center

### What PMs Can Do:
- **Create** material orders
- **Create** delivery/pickup/return tickets
- **Schedule** events and deliveries
- **View** schedule
- **View** own tickets and update them
- **View** inventory levels
- **View** driver information

### PM Portal (`/portal/pm`)
- **Material Order Form:**
  - Select customer/job
  - Choose materials from inventory (SKU lookup)
  - Set quantities
  - Choose delivery date
  - Assign to driver
  - Add special instructions
- **Order Tracking:**
  - See all active orders and their status
  - Track which orders are pending, in transit, delivered
- **Job Assignment:**
  - Assign jobs to available drivers
  - Set priority levels

### Creating a New Order (Step by Step):
1. Go to Portal > Orders > New Order
2. Select customer or enter job address
3. Search inventory for materials needed
4. Enter quantities for each material
5. Pick delivery date
6. Assign driver (Richard or Tae)
7. Add any special instructions
8. Submit order
9. Order appears in Driver's delivery queue
10. Inventory quantities automatically adjusted

### Command Center Access:
Dashboard, Inventory, Meetings, Schedule

---

## 7. SALES REP VIEW
**Who:** Hunter, Aaron, Greg, Brendon, Rick, Rudy, Adam
**Access:** Own leads, own stats, customer management

### After Login -> Portal Dashboard
**Navigation sidebar shows:**
- Dashboard
- Sales Portal
- Inventory (view only)
- Schedule
- Command Center (sales section only)

### What Sales Reps Can Do:
- **View/manage** their own assigned leads
- **Update** lead status (new, contacted, scheduled, quoted, closed)
- **Schedule** roof inspections
- **Create** and **send** quotes to customers
- **View** own performance stats and commissions
- **View** sales leaderboard (compare with team)
- **Upload** photos (inspection photos, damage photos)
- **View** customer portal data
- **Send** messages to customers
- **View** schedule

### Sales Portal (`/portal/sales`)
- **Dashboard:** Personal stats overview
  - Leads this month
  - Quotes sent
  - Jobs closed
  - Commission earned
- **Leads** (`/portal/sales/leads`):
  - List of assigned leads
  - Lead status pipeline
  - Contact info and notes
  - Follow-up reminders
- **Performance** (`/portal/sales/performance`):
  - Commission tracking
  - Close rate
  - Average deal size
  - Month-over-month trends
- **Customer Details** (`/portal/sales/customers/[id]`):
  - Full customer history
  - Past jobs and quotes
  - Communication log

### Daily Sales Workflow:
1. Login to portal
2. Check new leads assigned (from contact form submissions)
3. Follow up with leads (call, text, email)
4. Schedule inspections
5. Conduct inspections, take photos
6. Create and send quotes
7. Follow up on outstanding quotes
8. Close deals
9. Check leaderboard position
10. Review commission balance

### Command Center Access:
Dashboard, Sales only

---

## 8. DRIVER VIEW
**Who:** Richard Geahr, Tae Orr
**Access:** Delivery queue, route, proof capture

### After Login (PIN only) -> Portal Dashboard
**Navigation shows:**
- Dashboard (with "Today's Route" section)
- Driver Portal
- Inventory (view only)
- Monday Notes

### Driver Portal (`/portal/driver`)
**This is the main daily screen for drivers.**

- **Today's Deliveries List:**
  - Shows all deliveries assigned for today
  - Each delivery shows: customer name, address, time, status
  - Color-coded by status (pending, in progress, completed)

- **Delivery Detail View (tap a delivery):**
  - **Customer Info:** Name, phone number (tap to call), full address
  - **Materials List:** SKU, product name, quantity for each item
  - **Timeline:** When order was created, when it should arrive
  - **GPS Navigation:** Button to open maps app with delivery address
  - **Special Instructions:** Any notes from the PM
  - **7-Step Delivery Workflow:**
    1. **Load Verified** - Confirm all materials loaded on truck
    2. **En Route** - Mark departure, starts GPS tracking
    3. **Arrived** - Mark arrival at job site
    4. **Delivered** - Confirm materials unloaded
    5. **Proof Captured** - Upload delivery proof photos
    6. **QC Photos** - Upload quality control photos
    7. **Completed** - Final completion + customer signature capture
  - **Photo Upload:** Camera button to take/upload photos at each step
  - **Signature Capture:** Digital signature pad for customer sign-off
  - **Checklist:** Delivery checklist items to complete
  - **Notes:** Add delivery notes or issue reports

### Daily Driver Workflow:
1. Login with PIN (e.g., 1136 for Richard)
2. See today's delivery list
3. For each delivery:
   - Verify materials loaded -> tap "Load Verified"
   - Depart -> tap "En Route"
   - Arrive at site -> tap "Arrived"
   - Unload materials -> tap "Delivered"
   - Take proof photos -> upload
   - Take QC photos -> upload
   - Get customer signature -> tap "Completed"
4. Next delivery
5. End of day: all deliveries should show "Completed"

### What Drivers Cannot Do:
- View sales data
- Edit inventory
- View billing/financial info
- Access admin panels
- View other drivers' deliveries

---

## 9. CUSTOMER PORTAL
**Who:** External customers (homeowners)
**Access:** Own job status, weather alerts, documents

### How Customers Access:
- Receive access token/link from RCRS
- Login with email or token
- See only their own job information

### What Customers See:
- **Job Status** - Current progress of their roofing project
- **Documents** - Contracts, estimates, invoices, warranties
- **Weather Alerts** - Weather conditions affecting their project
- **Communication** - Messages from their sales rep
- **Photos** - Progress photos from inspections and work
- **Invoices** - Billing and payment information
- **Timeline** - Project milestones and dates

---

## 10. COMMAND CENTER
**URL:** www.rivercityroofingsolutions.com/command-center
**Who:** Management (Michael, Chris, Sara, Destin, + filtered access for others)

### Command Center Home (`/command-center`)
**The executive dashboard showing:**
- Welcome greeting with role badge
- Real-time stats: Today's Sales, Active Jobs, Inventory Alerts, Team Active
- **Financial KPIs** (Owner/Admin only):
  - Revenue MTD with growth %
  - Gross Margin
  - Outstanding AR with overdue count
  - Cash Flow
- Quick action buttons
- Recent activity feed
- Alerts (low stock, upcoming events)
- Today's schedule preview
- Weekly sales chart
- Top performers leaderboard

### Command Center Sections:

#### Sales (`/command-center/sales`)
- **Leaderboard** - All sales reps ranked by performance
  - Total earned, transaction count, avg transaction, % of total
- **Individual Rep View** (`/command-center/sales/[rep]`) - Deep dive into one rep
- **Achievements** (`/command-center/sales/achievements`) - Awards and milestones
- Data source: Google Sheets Commissions tab

#### Inventory (`/command-center/inventory`)
- Stock levels for all products
- Low stock alerts
- Inventory value calculation
- **SKU Details** (`/command-center/inventory/[sku]`) - Individual product view
- Data source: Google Sheets Inventory tab + data/inventory.json

#### Marketing (`/command-center/marketing`)
- **Ads** - Social media advertising dashboard
- **Calendar** - Content/campaign calendar
- **Emails** - Email campaign management
- Access: Owner/Admin only

#### Billing (`/command-center/billing`)
- **Invoices** - All invoices with payment status
- **Breakdowns** - Financial analysis
- **Financial Reports** (`/command-center/reports/financial`) - KPI dashboard
- Data source: Google Sheets Orders/Customers tabs

#### Phone (`/command-center/phone`)
- **Calls** - Call log history
- **Manage** - Extension/IVR configuration
- **Extension Details** - Per-extension view
- Data source: data/calls.json

#### Schedule (`/command-center/schedule`)
- Master calendar for all team members
- Job scheduling
- Delivery scheduling
- Data source: TeamUp calendar (when configured)

#### Team (`/command-center/team`)
- Team member status
- Role assignments
- Contact directory

#### Meetings (`/command-center/meetings`)
- **Prep** - Meeting preparation materials
- **Present** - Live presentation mode
- **Archives** - Past meeting recordings

#### Reports (`/command-center/reports`)
- Comprehensive reporting dashboard
- Export capabilities

#### Documents (`/command-center/documents`)
- File management
- Document sharing

---

## ROLE ACCESS SUMMARY MATRIX

| Feature | Owner | Admin | Manager | Office | PM | Sales | Driver |
|---------|-------|-------|---------|--------|-----|-------|--------|
| **Command Center** | Full | Full | Most | Some | Some | Sales only | Dashboard |
| **Admin Portal** | Full | Full | No | No | No | No | No |
| **Blog Management** | Edit | Edit | View | No | No | No | No |
| **Team Management** | Edit | Edit | View | No | No | No | No |
| **Inventory** | Full | Full | Full | Full | View | View | View |
| **Orders** | Full | Full | Full | Full | Create | No | View assigned |
| **Billing/Invoices** | Full | Full | Full | Full | No | No | No |
| **Sales Leaderboard** | View all | View all | View all | No | No | Own only | No |
| **Driver Deliveries** | View all | View all | Assign | No | Assign | No | Own only |
| **Schedule** | Edit | Edit | Edit | View | View | View | No |
| **Reports** | Full | Full | Full | View | No | No | No |
| **Settings** | Edit | Edit | No | No | No | No | No |
| **Profile Edits** | Approve | Approve | No | No | No | Request | Request |

---

## URLS QUICK REFERENCE

### Public Pages
| Page | URL |
|------|-----|
| Home | / |
| Contact | /contact |
| Services | /services |
| Service Areas | /service-areas |
| Team | /team |
| Blog | /blog |
| Referral | /referral |
| Financing | /financing |
| BNI | /bni |
| Privacy | /privacy-policy |
| Terms | /terms-of-service |

### Internal Pages
| Page | URL |
|------|-----|
| Portal Login | /portal |
| Portal Dashboard | /portal/dashboard |
| Admin Portal | /portal/admin |
| Admin Blog | /portal/admin/blog |
| Admin Team | /portal/admin/team |
| Admin Images | /portal/admin/images |
| Admin Areas | /portal/admin/areas |
| Admin Training | /portal/admin/training |
| Command Center | /command-center |
| Sales Leaderboard | /command-center/sales |
| Inventory | /command-center/inventory |
| Billing | /command-center/billing |
| Schedule | /command-center/schedule |
| Settings | /admin/settings |
| Driver Portal | /portal/driver |
| PM Portal | /portal/pm |
| Office Portal | /portal/office |
| Sales Portal | /portal/sales |
| My Profile | /portal/my-profile |
| Orders | /portal/orders |
| New Order | /portal/orders/new |
