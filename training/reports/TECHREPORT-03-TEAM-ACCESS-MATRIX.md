# RCRS Team Access & Permissions Matrix

**River City Roofing Solutions | www.rivercityroofingsolutions.com**
**Report Version:** February 2026
**Classification:** Internal Reference Document -- Access Control
**Contact:** rcrs@rivercityroofingsolutions.com | (256) 274-8530

---

## Executive Summary

The RCRS platform implements a comprehensive Role-Based Access Control (RBAC) system that governs what each of the 17+ team members can see, create, edit, and delete across the platform's 9 major sections, 367+ pages, and 180+ API routes. The hierarchy spans 7 role levels -- from owner (Level 100, full wildcard access) down to viewer (Level 10, read-only) -- with each role precisely scoped to its operational needs. Authentication is layered: admin access uses JWT with httpOnly cookies, team portal access uses email + 4-digit PIN with JWT session tokens, and the customer portal uses unique URL tokens requiring no password. This report provides the definitive reference for who can access what, including the full team roster, permission matrices for every platform section, detailed URL access by role, the complete authentication flow, and security policies governing sessions, rate limiting, and webhook verification.

---

## Table of Contents

1. [RBAC Hierarchy](#1-rbac-hierarchy)
2. [Full Team Roster](#2-full-team-roster)
3. [Master Permission Matrix](#3-master-permission-matrix)
4. [Section Access Details](#4-section-access-details)
5. [Data Visibility Matrix](#5-data-visibility-matrix)
6. [Command Center Module Access](#6-command-center-module-access)
7. [Authentication Flow](#7-authentication-flow)
8. [Admin Capabilities](#8-admin-capabilities)
9. [Security Policies](#9-security-policies)
10. [Permission Overrides](#10-permission-overrides)

---

## 1. RBAC Hierarchy

### Role Levels

```
owner (Level 100)
  |   Wildcard (*) permissions. Full access to every feature, page, and data point.
  |   Can manage users, system settings, and all administrative functions.
  |
admin (Level 90)
  |   Full access with approval authority. Can manage all portal sections,
  |   approve profile edits, manage team members, and access all admin tools.
  |
manager (Level 80)
  |   Operations oversight. View-all access to most data, limited editing.
  |   Can manage billing, inventory, schedules, team performance, and lead distribution.
  |
sales (Level 50)
  |   Own leads, own jobs, personal stats, leaderboard access.
  |   Can manage their assigned leads, schedule inspections, create quotes.
  |
office (Level 50)
  |   Billing, inventory, schedule management, lead entry.
  |   Can manage delivery tickets, invoices, material orders, and stock.
  |
project_manager (Level 50)
  |   Job scheduling, material orders, delivery coordination.
  |   Can create orders, manage delivery tickets, view inventory, enter leads.
  |
driver (Level 30)
  |   Delivery queue, route navigation, photo uploads, signature capture.
  |   Can view assigned tickets, update delivery status, adjust stock with logging.
  |
viewer (Level 10)
      Read-only access to dashboards and reports. No editing capabilities.
```

### Role Assignment Rules
- Each team member is assigned exactly one role in `lib/team-roles.ts`
- Roles determine the base level of access
- Per-user overrides can add or remove specific module access (stored in `Team_Access_Overrides` Google Sheets tab)
- The `permissions` array in team-roles.ts provides granular permission strings
- Wildcard `['*']` grants all permissions (used for owner and admin roles)

---

## 2. Full Team Roster

### Leadership

| Name | Title | Role | Email | Phone | Portal PIN | System ID | Primary Portal |
|------|-------|------|-------|-------|------------|-----------|----------------|
| Chris Muse | President | **owner** | chrismuse@rcrsal.com | 256-648-1224 | 1138 | RVR-138 | Command Center + All |
| Michael Muse | Vice President | **owner** | michaelmuse@rcrsal.com | 256-221-4290 | 1135 | RVR-135 | Command Center + All |

**Access:** Full wildcard (*) permissions. Complete access to every page, feature, and data point across the entire platform including system settings, user management, financial data, all portals, and admin tools.

### Administration

| Name | Title | Role | Email | Phone | Portal PIN | System ID | Primary Portal |
|------|-------|------|-------|-------|------------|-----------|----------------|
| Sara Hill | Office Manager | **admin** | sara@rcrsal.com | 256-810-3594 | 1131 | RVR-131 | Command Center + Office Portal |
| Admin (System) | System Admin | **admin** | admin@rcrsal.com | -- | 0000 | RVR-139 | All (system account) |

**Access:** Full wildcard (*) permissions. Same access as owner. Can manage billing, inventory, users, blog CMS, system settings, lead distribution, and all portal sections. Has approval authority for profile edits.

### Management

| Name | Title | Role | Email | Phone | Portal PIN | System ID | Primary Portal |
|------|-------|------|-------|-------|------------|-----------|----------------|
| Destin McCury | Admin / Manager | **manager** | destin@rcrsal.com | 256-905-7738 | 1132 | RVR-132 | Command Center + Office Portal |

**Access:** Operations oversight with view-all data access. Can manage billing, inventory, tickets, invoices, vendors, reports, schedules, stock, team performance, deliveries, leads, and lead distribution settings. Cannot manage system settings or user accounts.

**Specific Permissions:** `view_dashboard`, `view_all_data`, `manage_billing`, `manage_inventory`, `view_tickets`, `update_ticket_status`, `create_invoices`, `manage_vendors`, `view_reports`, `export_reports`, `view_schedule`, `edit_schedule`, `manage_stock`, `view_team_performance`, `assign_deliveries`, `view_inventory_costs`, `enter_leads`, `lead_distro_manage`

### Office Staff

| Name | Title | Role | Email | Phone | Portal PIN | System ID | Primary Portal |
|------|-------|------|-------|-------|------------|-----------|----------------|
| Tia Morris | Admin / Office | **office** | tia@rcrsal.com | 256-394-8396 | 1133 | RVR-133 | Office Portal |

**Access:** Office operations focus. Can manage billing, inventory, tickets, invoices, vendors, reports, schedules, stock, lead entry, and lead distribution. Cannot view inventory costs, team performance analytics, or financial reports.

**Specific Permissions:** `view_dashboard`, `manage_billing`, `manage_inventory`, `view_tickets`, `update_ticket_status`, `create_invoices`, `manage_vendors`, `view_reports`, `view_schedule`, `manage_stock`, `enter_leads`, `lead_distro_manage`

### Marketing

| Name | Title | Role | Email | Phone | Portal PIN | System ID | Primary Portal |
|------|-------|------|-------|-------|------------|-----------|----------------|
| Boston | Marketing Director | **office** | boston@rcrsal.com | -- | -- | -- | Admin Panel (blog, SEO, analytics) |

**Access:** Office-level portal access. Primary focus on admin panel features: blog CMS, marketing hub, content calendar, SEO management, and analytics. Access level determined by admin-granted permissions.

### Production & Field

| Name | Title | Role | Email | Phone | Portal PIN | System ID | Primary Portal |
|------|-------|------|-------|-------|------------|-----------|----------------|
| John Cordonis | Production Manager | **project_manager** | john@rcrsal.com | 256-654-0875 | 1137 | RVR-137 | PM Portal + Delivery |
| Bart Roberts | Insurance Claims Specialist | **project_manager** | bart@rcrsal.com | 256-654-0747 | 1134 | RVR-134 | PM Portal + Delivery |

**Access:** Job scheduling and delivery coordination. Can create material orders, delivery/pickup/return tickets, schedule events, view own tickets, update own tickets, view inventory quantities (not costs), view drivers, and enter leads.

**Specific Permissions:** `view_dashboard`, `create_material_orders`, `create_delivery_tickets`, `create_pickup_tickets`, `create_return_tickets`, `schedule_events`, `view_schedule`, `view_own_tickets`, `update_own_tickets`, `view_inventory`, `view_drivers`, `enter_leads`

### Sales Representatives

| Name | Title | Role | Email | Phone | Portal PIN | System ID | Primary Portal |
|------|-------|------|-------|-------|------------|-----------|----------------|
| Hunter | Regional Partner (Birmingham) | **sales** | hunter@rcrsal.com | 256-221-0548 | 2010 | RVR-201 | Sales Portal |
| Aaron | Regional Partner (Nashville) | **sales** | aaron@rcrsal.com | 256-656-7856 | 2020 | RVR-202 | Sales Portal |
| Greg | Sales Inspector | **sales** | greg@rcrsal.com | 256-221-1809 | 2030 | RVR-203 | Sales Portal |
| Brendon Muse | Sales Inspector | **sales** | brendon@rcrsal.com | 256-616-6174 | 2040 | RVR-204 | Sales Portal |
| Rick | Sales Rep | **sales** | rick@rcrsal.com | -- | 2050 | RVR-205 | Sales Portal |
| Rudy | Sales Rep | **sales** | rudy@rcrsal.com | -- | 2060 | RVR-206 | Sales Portal |
| Adam | Sales Rep | **sales** | adam@rcrsal.com | -- | 2070 | RVR-207 | Sales Portal |

**Access:** Own leads and personal performance data. Can view and manage their assigned leads, update lead status, schedule inspections, create and send quotes, view own stats, view leaderboard, upload photos, view and send customer portal messages, and view schedule.

**Specific Permissions:** `view_dashboard`, `view_leads`, `manage_leads`, `view_own_leads`, `update_lead_status`, `schedule_inspections`, `create_quotes`, `send_quotes`, `view_own_stats`, `view_leaderboard`, `upload_photos`, `view_customer_portal`, `send_customer_messages`, `view_schedule`

### Drivers & Materials

| Name | Title | Role | Email | Phone | Portal PIN | System ID | Primary Portal |
|------|-------|------|-------|-------|------------|-----------|----------------|
| Richard Geahr | Driver | **driver** | richard@rivercityroofingsolutions.com | -- | 1136 | RVR-136 | Driver Portal |
| Tae Orr | Materials Manager | **driver** | tae@rcrsal.com | 256-200-3467 | 2033 | a8ad2e33 | Driver Portal + Inventory |

**Access:** Delivery operations. Can view assigned tickets, update delivery status, upload photos, capture customer signatures, view route, view and complete loading checklists, edit stock quantities (all changes logged), create pickup/return tickets, and log GPS activity.

**Specific Permissions:** `view_assigned_tickets`, `update_delivery_status`, `upload_photos`, `capture_signature`, `view_route`, `view_checklist`, `complete_checklist`, `edit_stock_qty`, `create_pickup_tickets`, `create_return_tickets`, `log_gps_activity`

### Public Profile Only (No Portal Access)

| Name | Title | Notes |
|------|-------|-------|
| Travis | Sales Inspector | Public team page profile; no portal login configured |
| Donnie Dotson | Strategic Advisor | Public team page profile; advisory role only |
| Danny Ray "Pops" Muse | In Loving Memory | Memorial profile on team page |

---

## 3. Master Permission Matrix

### Portal Section Access by Role

| Section | Owner | Admin | Manager | Sales | Office | PM | Driver | Viewer |
|---------|:-----:|:-----:|:-------:|:-----:|:------:|:--:|:------:|:------:|
| **Command Center** | Full | Full | Full | Read (limited) | -- | -- | -- | -- |
| **Sales Leaderboard** | Full | Full | Full | Own stats | -- | -- | -- | -- |
| **Lead Management** | Full | Full | Full | Own leads | Create | -- | -- | -- |
| **Sales Portal** | View All | View All | View All | Full | -- | -- | -- | -- |
| **Office Portal** | Full | Full | Full | -- | Full | -- | -- | View |
| **Delivery Management** | Full | Full | View | -- | View | View | Full | -- |
| **Inventory** | Full | Full | Full | View (qty) | Full | View (qty) | -- | -- |
| **Billing** | Full | Full | Full | -- | Full | -- | -- | -- |
| **Admin CMS** | Full | Full | Full | -- | -- | -- | -- | -- |
| **User Management** | Full | Full | -- | -- | -- | -- | -- | -- |
| **Phone System** | Full | Full | Full | Use | Use | -- | -- | -- |
| **Calendar** | Full | Full | Full | Own | Full | Own | Own | View |
| **Chat (GroupMe)** | Full | Full | Full | Full | Full | Full | Full | -- |
| **Training** | Manage | Manage | View | Full | Full | Full | Full | Full |
| **Customer Portal** | Manage | Manage | View | Share | View | -- | -- | -- |

### Permission Legend

| Symbol | Meaning |
|--------|---------|
| **Full** | Read, write, create, delete, and configure |
| **View All** | Read access to all data (not just own) |
| **View** | Read access to relevant data only |
| **Own** | Access limited to own data/records |
| **Create** | Can create new records but limited edit |
| **Use** | Can use the feature but not configure it |
| **Share** | Can share portal links with customers |
| **Manage** | Full control plus admin/configuration |
| **--** | No access |

---

## 4. Section Access Details

### 4.1 Public Website (No Authentication Required)

All public pages are accessible without login:

| URL Pattern | Description | Auth Required |
|-------------|-------------|:-------------:|
| `/` | Homepage | No |
| `/blog`, `/blog/[slug]` | Blog articles | No |
| `/team`, `/team/[slug]` | Team profiles | No |
| `/services`, `/services/[slug]` | Service pages | No |
| `/locations/[city]` | Location pages | No |
| `/service-areas/[area]` | Service area pages | No |
| `/contact` | Contact form | No |
| `/referral-rewards` | Referral program | No |
| `/check-my-address` | Storm report tool | No |
| `/bni` | BNI networking page | No |
| `/privacy-policy` | Privacy policy | No |
| `/terms-of-service` | Terms of service | No |

### 4.2 Command Center URLs

| URL | Description | Owner | Admin | Manager | Sales | Office | PM | Driver | Viewer |
|-----|-------------|:-----:|:-----:|:-------:|:-----:|:------:|:--:|:------:|:------:|
| `/command-center` | Executive dashboard | RW | RW | RW | R | R | R | R | R |
| `/command-center/sales` | Sales leaderboard | RW | RW | RW | R | -- | -- | -- | -- |
| `/command-center/leads` | Lead management | RWD | RWD | RWD | R(own) | RW | -- | -- | -- |
| `/command-center/inventory` | Inventory overview | RW | RW | RW | -- | RW | R | -- | -- |
| `/command-center/inventory/[sku]` | SKU detail | RW | RW | RW | -- | RW | R | -- | -- |
| `/command-center/marketing` | Marketing hub | RW | RW | -- | -- | -- | -- | -- | -- |
| `/command-center/marketing/ads` | Ad management | RW | RW | -- | -- | -- | -- | -- | -- |
| `/command-center/marketing/emails` | Email campaigns | RW | RW | -- | -- | -- | -- | -- | -- |
| `/command-center/marketing/calendar` | Content calendar | RW | RW | -- | -- | -- | -- | -- | -- |
| `/command-center/meetings` | Meeting module | RW | RW | RW | R | R | R | -- | -- |
| `/command-center/meetings/prep` | Meeting prep | RW | RW | RW | R | R | R | -- | -- |
| `/command-center/meetings/present` | Presentation mode | RW | RW | RW | R | R | R | -- | -- |
| `/command-center/meetings/archives` | Meeting archives | RW | RW | RW | R | R | R | -- | -- |
| `/command-center/phone` | Phone system | RW | RW | RW | R | R | -- | -- | -- |
| `/command-center/phone/calls` | Call history | RW | RW | RW | R | R | -- | -- | -- |
| `/command-center/phone/[ext]` | Extension detail | RW | RW | RW | R | R | -- | -- | -- |
| `/command-center/phone/manage` | Phone config | RW | RW | -- | -- | -- | -- | -- | -- |
| `/command-center/reports/financial` | Financial reports | RW | RW | -- | -- | -- | -- | -- | -- |
| `/command-center/reports/team` | Team reports | RW | RW | RW | -- | -- | -- | -- | R |
| `/command-center/schedule` | Master calendar | RW | RW | RW | R | RW | R | -- | -- |
| `/command-center/billing` | Billing overview | RW | RW | -- | -- | RW | -- | -- | -- |
| `/command-center/billing/invoices` | Invoice list | RW | RW | -- | -- | RW | -- | -- | -- |
| `/command-center/billing/breakdowns` | Job breakdowns | RW | RW | -- | -- | -- | -- | -- | -- |
| `/command-center/documents` | Document library | RW | RW | R | -- | R | -- | -- | -- |
| `/command-center/agents` | Agent directory | RW | RW | RW | R | R | -- | -- | -- |
| `/command-center/team` | Team performance | RW | RW | RW | -- | -- | -- | -- | -- |

**Legend:** R = Read, W = Write, D = Delete, RW = Read+Write, RWD = Read+Write+Delete

### 4.3 Sales Portal URLs

| URL | Description | Owner | Admin | Manager | Sales | Others |
|-----|-------------|:-----:|:-----:|:-------:|:-----:|:------:|
| `/portal/sales` | Sales dashboard | View All | View All | View All | Own | -- |
| `/portal/sales/leads` | Lead management | View All | View All | View All | Own | -- |
| `/portal/sales/customers` | Customer CRM | View All | View All | View All | Assigned | -- |
| `/portal/sales/customers/[id]` | Customer detail (6 tabs) | Full | Full | View | Assigned | -- |
| `/portal/sales/performance` | Performance dashboard | View All | View All | View All | Own | -- |
| `/portal/sales/settings` | Rep settings | All reps | All reps | All reps | Own | -- |

### 4.4 Office Portal URLs

| URL | Description | Owner | Admin | Manager | Office | Viewer | Others |
|-----|-------------|:-----:|:-----:|:-------:|:------:|:------:|:------:|
| `/portal/office` | Office dashboard (4 tabs) | Full | Full | Full | Full | View | -- |
| `/portal/office` (Dashboard tab) | Stats and activity | RW | RW | RW | RW | R | -- |
| `/portal/office` (Delivery Tickets tab) | Ticket management | RWD | RWD | RW | RW | R | -- |
| `/portal/office` (Invoices tab) | Invoice management | RW | RW | RW | RW | R | -- |
| `/portal/office` (Create Order tab) | New material orders | RW | RW | RW | RW | -- | -- |
| `/portal/schedule` | Schedule management | RW | RW | RW | RW | R | -- |
| `/portal/transactions` | Transaction history | R | R | R | R | -- | -- |

### 4.5 Delivery & Driver Portal URLs

| URL | Description | Owner | Admin | Manager | PM | Driver | Others |
|-----|-------------|:-----:|:-----:|:-------:|:--:|:------:|:------:|
| `/portal/delivery` | Delivery hub | Full | Full | View | View | Own | -- |
| `/portal/delivery/route` | Active route | View | View | View | View | Own | -- |
| `/portal/delivery/[id]` | Stop detail | Full | Full | View | View | Own | -- |
| Loading checklist (within delivery) | Material verification | View | View | View | View | Own (complete) | -- |
| Proof of delivery (within delivery) | Photo/signature capture | View | View | View | View | Own (capture) | -- |

### 4.6 Billing Portal URLs

| URL | Description | Owner | Admin | Manager | Office | Sales | Others |
|-----|-------------|:-----:|:-----:|:-------:|:------:|:-----:|:------:|
| `/portal/billing` | Portal billing | Full | Full | Full | Full | Own | -- |
| `/api/portal/billing/pdf` | PDF generation | Yes | Yes | Yes | Yes | Own | -- |

### 4.7 Training URLs

| URL | Description | Owner | Admin | Manager | Sales | Office | PM | Driver | Viewer |
|-----|-------------|:-----:|:-----:|:-------:|:-----:|:------:|:--:|:------:|:------:|
| `/portal/training` | Training hub | Manage | Manage | View | Full | Full | Full | Full | Full |
| `/portal/training/sales` | Sales course (7 modules) | Manage | Manage | View | Full | Full | Full | Full | Full |
| `/portal/training/onboarding` | Interface onboarding (8 sections) | Manage | Manage | View | Full | Full | Full | Full | Full |
| `/portal/admin/training` | Admin training view | Yes | Yes | -- | -- | -- | -- | -- | -- |

### 4.8 Chat URL

| URL | Description | Owner | Admin | Manager | Sales | Office | PM | Driver | Viewer |
|-----|-------------|:-----:|:-----:|:-------:|:-----:|:------:|:--:|:------:|:------:|
| `/portal/chat` | Full GroupMe chat | Full | Full | Full | Full | Full | Full | Full | -- |
| Floating chat widget | All portal pages | Yes | Yes | Yes | Yes | Yes | Yes | Yes | -- |

### 4.9 Admin URLs

| URL | Description | Owner | Admin | Manager | Others |
|-----|-------------|:-----:|:-----:|:-------:|:------:|
| `/portal/admin/blog` | Blog CMS | Full | Full | Full | -- |
| `/portal/admin/team` | Team management | Full | Full | -- | -- |
| `/portal/admin/services` | Service CMS | Full | Full | -- | -- |
| `/portal/admin/areas` | Service area CMS | Full | Full | -- | -- |
| `/portal/admin/images` | Image library | Full | Full | -- | -- |
| `/portal/admin/operations` | System settings | Full | Full | -- | -- |
| `/portal/admin/training` | Training admin | Full | Full | -- | -- |
| `/portal/admin/lead-distro` | Lead distribution rules | Full | Full | -- | -- |
| `/portal/manager/lead-controls` | Manager lead controls | Full | Full | RW | -- |

### 4.10 Customer Portal URLs

| URL | Description | Auth | Access |
|-----|-------------|------|--------|
| `/my/[token]` | Customer portal dashboard | Token in URL | Customer's own job data only |
| `/api/customer/dashboard` | Customer data API | Token validation | Own data only |

---

## 5. Data Visibility Matrix

### What Each Role Can See

| Data Type | Owner | Admin | Manager | Sales | Office | PM | Driver | Customer |
|-----------|:-----:|:-----:|:-------:|:-----:|:------:|:--:|:------:|:--------:|
| **All leads** | Yes | Yes | Yes | No | Yes | Yes | No | No |
| **Own leads** | Yes | Yes | Yes | Yes | Yes | No | No | No |
| **All customer data** | Yes | Yes | Yes | No | Yes | No | No | No |
| **Assigned customer data** | Yes | Yes | Yes | Yes | No | Yes | No | Own |
| **Job costs (materials + labor)** | Yes | Yes | Yes | No | No | No | No | No |
| **Inventory costs** | Yes | Yes | Yes | No | No | No | No | No |
| **Inventory prices** | Yes | Yes | Yes | No | Yes | Yes | No | No |
| **Inventory quantities** | Yes | Yes | Yes | Qty only | Yes | Yes | Yes | No |
| **All commissions** | Yes | Yes | No | No | No | No | No | No |
| **Own commissions** | Yes | Yes | No | Yes | No | No | No | No |
| **All deliveries** | Yes | Yes | Yes | No | No | Yes | No | No |
| **Own deliveries** | Yes | Yes | Yes | No | No | No | Yes | No |
| **Financial reports** | Yes | Yes | No | No | No | No | No | No |
| **Revenue MTD/YTD** | Yes | Yes | Yes | No | No | No | No | No |
| **Team performance** | Yes | Yes | Yes | Leaderboard | No | No | No | No |
| **User management** | Yes | Yes | No | No | No | No | No | No |
| **System settings** | Yes | Yes | No | No | No | No | No | No |
| **Audit logs** | Yes | Yes | No | No | No | No | No | No |
| **Customer job status** | Yes | Yes | Yes | Assigned | Yes | Assigned | No | Own |
| **Customer documents** | Yes | Yes | Yes | Assigned | Yes | No | No | Own |
| **Phone system** | Yes | Yes | Yes | Use | Use | No | No | No |
| **Marketing data** | Yes | Yes | No | No | No | No | No | No |
| **Training progress (all)** | Yes | Yes | Yes | No | No | No | No | No |
| **Training progress (own)** | Yes | Yes | Yes | Yes | Yes | Yes | Yes | No |

---

## 6. Command Center Module Access

### Module-Level Access

| Module | URL | Owner | Admin | Manager | Sales | Office | PM | Driver | Viewer |
|--------|-----|:-----:|:-----:|:-------:|:-----:|:------:|:--:|:------:|:------:|
| Dashboard | `/command-center` | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Yes |
| Sales | `/command-center/sales` | Yes | Yes | Yes | Yes | No | No | No | No |
| Inventory | `/command-center/inventory` | Yes | Yes | Yes | No | Yes | Yes | No | No |
| Marketing | `/command-center/marketing` | Yes | Yes | No | No | No | No | No | No |
| Phone | `/command-center/phone` | Yes | Yes | Yes | Yes | Yes | No | No | No |
| Meetings | `/command-center/meetings` | Yes | Yes | Yes | Yes | Yes | Yes | No | No |
| Team | `/command-center/team` | Yes | Yes | Yes | No | No | No | No | No |
| Leads | `/command-center/leads` | Yes | Yes | Yes | Yes | Yes | No | No | No |
| Reports | `/command-center/reports` | Yes | Yes | Yes | No | No | No | No | Yes |
| Billing | `/command-center/billing` | Yes | Yes | No | No | Yes | No | No | No |
| Schedule | `/command-center/schedule` | Yes | Yes | Yes | Yes | Yes | Yes | No | No |
| Settings | Admin settings | Yes | Yes | No | No | No | No | No | No |

---

## 7. Authentication Flow

### 7.1 Admin Authentication (JWT-Based)

```
User navigates to admin page
        |
        v
Is JWT cookie present and valid?
        |
    +---+---+
    |       |
   Yes      No
    |       |
    v       v
  Access   Redirect to admin login
  granted         |
                  v
           User enters admin password
                  |
                  v
           POST /api/admin/auth
           (password validated against ADMIN_PASSWORD env var)
                  |
              +---+---+
              |       |
           Valid   Invalid
              |       |
              v       v
         JWT created  Error: "Invalid password"
         (signed with
          JWT_SECRET,
          128-char hex)
              |
              v
         JWT stored in
         httpOnly cookie
         (not accessible
          to JavaScript)
              |
              v
         Redirect to admin dashboard
              |
              v
         All /api/admin/* routes
         check: requireAdmin() middleware
              |
              v
         JWT validated on every request
```

### 7.2 Portal Authentication (Email + PIN)

```
Team member navigates to portal
        |
        v
Is portal JWT session active?
        |
    +---+---+
    |       |
   Yes      No
    |       |
    v       v
  Access   Show portal login page
  granted  (email + PIN fields)
                  |
                  v
           User enters email + 4-digit PIN
                  |
                  v
           POST /api/portal/auth
                  |
                  v
           Lookup in lib/team-roles.ts:
           - Find member by email (case-insensitive)
           - Validate PIN matches
           - Check isActive === true
                  |
              +---+---+
              |       |
           Valid   Invalid
              |       |
              v       v
         JWT created  Error: "Invalid credentials"
         with role and
         permissions
         embedded
              |
              v
         JWT stored in session
         (auth-context.tsx provides
          useAuth() React hook)
              |
              v
         ROLE_ROUTES mapping checked:
         Which portals can this role access?
              |
              v
         Redirect to appropriate portal:
         - Owner/Admin -> Command Center
         - Manager -> Command Center
         - Sales -> Sales Portal
         - Office -> Office Portal
         - PM -> PM Portal
         - Driver -> Driver Portal
              |
              v
         All portal API routes check:
         requireAuth() middleware validates
         JWT + role + permissions
```

### 7.3 Customer Portal Authentication (Token-Based)

```
Customer receives unique URL from sales rep
(format: /my/[token])
        |
        v
Customer clicks the link
        |
        v
Token extracted from URL
        |
        v
Token validated against Customers
Google Sheets tab
        |
    +---+---+
    |       |
  Valid   Invalid
    |       |
    v       v
  Customer  Error page
  dashboard
  loaded with
  own job data
        |
        v
  Read-only access:
  - Job timeline
  - Weather alerts
  - Documents
  - Messages
  - Delivery tracking
  - Appointments
```

**Key Points:**
- No password required for customer portal
- Token in URL serves as the authentication credential
- Tokens are auto-generated per customer via `lib/portal-generator.ts`
- Each customer gets a unique token stored in Google Sheets
- Access is read-only, limited to own job data

---

## 8. Admin Capabilities

### System Administration

| Capability | URL / Method | Owner | Admin | Manager |
|-----------|-------------|:-----:|:-----:|:-------:|
| **User Management** | `lib/team-roles.ts` (code) | Yes | Yes | No |
| Add new team member | Edit team-roles.ts + deploy | Yes | Yes | No |
| Change role/permissions | Edit team-roles.ts + deploy | Yes | Yes | No |
| Disable user | Set `isActive: false` + deploy | Yes | Yes | No |
| Reset PIN | Edit team-roles.ts + deploy | Yes | Yes | No |
| **Permission Overrides** | `/portal/admin/team` | Yes | Yes | No |
| Per-user module overrides | Team_Access_Overrides sheet | Yes | Yes | No |
| **System Settings** | `/portal/admin/operations` | Yes | Yes | No |
| System health check | `/api/admin/system` | Yes | Yes | No |
| Feature flags | `/api/admin/system/features` | Yes | Yes | No |
| Maintenance mode | `/api/admin/system/maintenance` | Yes | Yes | No |
| Audit log | `/api/admin/system/audit-log` | Yes | Yes | No |
| **Content Management** | | | | |
| Blog CMS | `/portal/admin/blog` | Yes | Yes | Yes |
| Team profiles | `/portal/admin/team` | Yes | Yes | No |
| Service pages | `/portal/admin/services` | Yes | Yes | No |
| Service areas | `/portal/admin/areas` | Yes | Yes | No |
| Image library | `/portal/admin/images` | Yes | Yes | No |
| **Lead Distribution** | | | | |
| Algorithm weights | `/portal/admin/lead-distro` | Yes | Yes | No |
| Rep availability | `/portal/manager/lead-controls` | Yes | Yes | Yes |
| Distribution rules | `/portal/admin/lead-distro` | Yes | Yes | No |
| **Pricing & Inventory** | | | | |
| Product costs/prices | `/command-center/inventory` | Yes | Yes | Yes |
| Reorder thresholds | Inventory product settings | Yes | Yes | Yes |
| **Integrations** | | | | |
| JN connection test | `/api/admin/jobnimbus/test` | Yes | Yes | No |
| Environment variables | Vercel dashboard | Yes | Yes | No |
| API key rotation | Vercel dashboard | Yes | Yes | No |

### Lead Distribution Algorithm Configuration (Admin Only)

Configurable at `/portal/admin/lead-distro`:

| Weight | Description | Range |
|--------|-------------|-------|
| Install Proximity | Geographic closeness to rep's past installs | 0-100% |
| Contact Proximity | Closeness to rep's existing contacts | 0-100% |
| Door Knock Recency | Bonus for recent activity in the area | 0-100% |
| Referral Bonus | Extra weight for referral leads | 0-100% |
| Meeting Attendance | Reward reps who attend meetings | 0-100% |
| Close Rate | Favor reps with higher close rates | 0-100% |
| Response Time | Favor reps who respond quickly | 0-100% |

**Thresholds:**
- Proximity radius (miles)
- Recent interaction window (days)
- Minimum reps for distribution

All changes logged with admin ID and timestamp.

---

## 9. Security Policies

### 9.1 Session Management

| Policy | Setting |
|--------|---------|
| **Admin JWT** | Signed with `JWT_SECRET` (128-character hex string) |
| **Token storage** | httpOnly cookies (not accessible to client-side JavaScript) |
| **Portal JWT** | Contains role and permissions; validated on every API request |
| **Customer token** | URL-based, no expiration (valid as long as token exists in Sheets) |
| **AUTH_BYPASS_MODE** | Available for pre-launch testing only; must be disabled before real users |

### 9.2 Rate Limiting

| Endpoint | Limit | Method |
|----------|-------|--------|
| `POST /api/admin/auth` | Rate limited | In-memory (Redis planned) |
| `POST /api/portal/auth` | Rate limited | In-memory (Redis planned) |
| All authentication endpoints | Throttled on repeated failures | In-memory tracking |

**Note:** Current rate limiting uses in-memory storage. Redis upgrade is planned for production to handle distributed rate limiting across serverless function instances.

### 9.3 HMAC Webhook Verification

| Webhook Source | Endpoint | Verification |
|---------------|----------|-------------|
| JobNimbus | `/api/webhooks/jobnimbus` | HMAC signature validation |

- Webhook requests must include a valid HMAC signature
- Signature is computed from the request body using a shared secret
- Invalid signatures result in 401 Unauthorized response
- Prevents webhook spoofing and unauthorized data injection

### 9.4 Input Validation

- All API routes validate request bodies before processing
- TypeScript types enforce data structure requirements
- Invalid inputs return appropriate error responses (400 Bad Request)

### 9.5 Access Control Enforcement

| Control | Implementation |
|---------|---------------|
| **Admin routes** | `requireAdmin()` middleware on all `/api/admin/*` routes |
| **Portal routes** | `requireAuth()` middleware with role validation on 50+ routes |
| **Route guards** | `ROLE_ROUTES` mapping in `lib/auth-context.tsx` |
| **Permission checks** | Individual permission strings checked at the API level |
| **Data scoping** | Queries filtered by user ID/role to prevent data leakage |

### 9.6 Security Hardening Measures

| Measure | Status |
|---------|--------|
| No hardcoded credentials | Removed (`admin123` fallback eliminated) |
| No test credentials in UI | Removed (quick login buttons, demo credentials) |
| No team enumeration | Quick Login buttons removed from portal login |
| PIN required for portal | Email-only login disabled; both email + PIN required |
| httpOnly cookies | JWT tokens not accessible to JavaScript |
| Restricted image domains | `placehold.co` removed from allowed domains |
| Server-side API keys | Google Maps API key moved server-side |
| Environment variable auth | All secrets in env vars, never in code |
| CORS / origin checks | Standard Next.js / Vercel security headers |

---

## 10. Permission Overrides

### How Overrides Work

The base access level for each team member is determined by their `role` in `lib/team-roles.ts`. However, admins can apply per-user overrides that add or remove specific Command Center modules without changing the base role.

### Override System

| Aspect | Details |
|--------|---------|
| **Admin UI** | `/portal/admin/team` |
| **Storage** | `Team_Access_Overrides` Google Sheets tab |
| **Granularity** | Per-user, per-module |
| **Operations** | Add module access, remove module access |
| **Audit** | Override records include: admin who set it, timestamp |

### Example Overrides

| Scenario | Override |
|----------|---------|
| Give a sales rep access to marketing hub | Add `marketing` module to their override |
| Remove billing access from an office staff member | Remove `billing` module via override |
| Grant a PM temporary access to financial reports | Add `financial-reports` module override |
| Restrict a manager from phone system | Remove `phone` module via override |

### Override Precedence

```
Base role permissions (from team-roles.ts)
        +
Module additions (from Team_Access_Overrides)
        -
Module removals (from Team_Access_Overrides)
        =
Effective access level for the user
```

Overrides are additive or subtractive to the base role. They do not replace the role entirely -- they modify specific module access on top of the existing permissions.

---

## Appendix A: Quick Reference -- Who Can Do What

### Common Actions by Role

| Action | Who Can Do It |
|--------|---------------|
| **View executive KPIs** | Owner, Admin, Manager |
| **View sales leaderboard** | Owner, Admin, Manager, Sales |
| **Assign leads to reps** | Owner, Admin, Manager |
| **Enter a new lead** | Owner, Admin, Manager, Office, PM |
| **Update lead status** | Owner, Admin, Manager, Sales (own) |
| **View inventory stock** | Owner, Admin, Manager, Office, PM, Sales (qty only) |
| **See inventory costs** | Owner, Admin, Manager |
| **Adjust stock quantities** | Owner, Admin, Manager, Office, Driver (logged) |
| **Create material order** | Owner, Admin, Manager, Office, PM |
| **Assign driver to delivery** | Owner, Admin, Manager, Office |
| **Complete loading checklist** | Driver |
| **Upload proof of delivery** | Driver |
| **Generate invoice** | Owner, Admin, Manager, Office |
| **Mark invoice paid** | Owner, Admin, Manager, Office |
| **View financial reports** | Owner, Admin |
| **View team reports** | Owner, Admin, Manager, Viewer |
| **Manage blog content** | Owner, Admin, Manager |
| **Manage user accounts** | Owner, Admin |
| **Configure system settings** | Owner, Admin |
| **Change lead distribution rules** | Owner, Admin |
| **Toggle rep availability** | Owner, Admin, Manager |
| **Send GroupMe chat** | All except Viewer |
| **Complete training modules** | All roles |
| **View own training progress** | All roles |
| **View all training progress** | Owner, Admin, Manager |
| **Share customer portal link** | Owner, Admin, Sales |
| **Schedule inspection** | Owner, Admin, Manager, Sales |
| **Create Google Calendar event** | Owner, Admin, Manager, Sales, Office, PM |

---

## Appendix B: Permission Strings Reference

The following permission strings are used in `lib/team-roles.ts` to define granular access:

### Universal
- `*` -- Wildcard, grants all permissions (owner, admin)

### Dashboard & Viewing
- `view_dashboard` -- View the main dashboard
- `view_all_data` -- View all data across the platform
- `view_reports` -- View reports
- `export_reports` -- Export reports to printable formats
- `view_team_performance` -- View team performance metrics

### Lead Management
- `view_leads` -- View lead listings
- `manage_leads` -- Full lead management
- `view_own_leads` -- View only assigned leads
- `update_lead_status` -- Change lead status
- `enter_leads` -- Create new leads
- `lead_distro_manage` -- Manage lead distribution settings

### Sales
- `schedule_inspections` -- Schedule inspection appointments
- `create_quotes` -- Create price quotes
- `send_quotes` -- Send quotes to customers
- `view_own_stats` -- View personal performance stats
- `view_leaderboard` -- View the sales leaderboard
- `view_customer_portal` -- View customer portal data
- `send_customer_messages` -- Send messages to customers

### Inventory & Orders
- `manage_inventory` -- Full inventory management
- `view_inventory` -- View inventory (quantities)
- `view_inventory_costs` -- View inventory cost data
- `manage_stock` -- Adjust stock levels
- `edit_stock_qty` -- Edit stock quantities (with logging)
- `create_material_orders` -- Create new material orders
- `manage_vendors` -- Manage vendor information

### Delivery
- `view_tickets` -- View all delivery tickets
- `view_own_tickets` -- View only own tickets
- `update_ticket_status` -- Change ticket status
- `update_own_tickets` -- Update own ticket details
- `view_assigned_tickets` -- View assigned delivery tickets
- `update_delivery_status` -- Update delivery progress
- `assign_deliveries` -- Assign drivers to deliveries
- `create_delivery_tickets` -- Create delivery tickets
- `create_pickup_tickets` -- Create pickup tickets
- `create_return_tickets` -- Create return tickets
- `view_drivers` -- View driver listings
- `view_route` -- View delivery routes
- `view_checklist` -- View loading checklists
- `complete_checklist` -- Complete loading checklists

### Billing
- `manage_billing` -- Full billing management
- `create_invoices` -- Create new invoices

### Media & Communication
- `upload_photos` -- Upload photos (delivery, inspection)
- `capture_signature` -- Capture customer signatures
- `log_gps_activity` -- Log GPS coordinates

### Scheduling
- `view_schedule` -- View schedules
- `edit_schedule` -- Modify schedules
- `schedule_events` -- Create calendar events

---

*This report was generated February 2026. For the most current team roster and role assignments, see `lib/team-roles.ts` in the project source code. For permission overrides, check the `Team_Access_Overrides` tab in Google Sheets.*

*River City Roofing Solutions -- www.rivercityroofingsolutions.com -- (256) 274-8530 -- rcrs@rivercityroofingsolutions.com*
