# Sales Rep Portal - Workflow Documentation

## Overview

The Sales Rep Portal is a mobile-optimized interface designed specifically for field sales representatives at River City Roofing Solutions. It provides quick access to lead management, customer communication, performance tracking, and scheduling tools.

## Access Routes

| Route | Description |
|-------|-------------|
| `/portal/sales` | Main sales dashboard (mobile command center) |
| `/portal/sales/leads` | Lead management and filtering |
| `/portal/sales/performance` | Performance stats, goals, and leaderboard |
| `/portal/sales/customers/[id]` | Individual customer detail view |

## User Authentication

- **Role**: `sales`
- **Login Methods**: Email or 4-digit PIN
- **Default Route After Login**: `/portal/sales`

### Sales Team Members (Configured in system)
- Hunter (PIN: 2010)
- Aaron (PIN: 2020)
- Greg (PIN: 2030)
- Brendon Muse (PIN: 2040)
- Rick (PIN: 2050)
- Rudy (PIN: 2060)
- Adam (PIN: 2070)

## Feature Overview

### 1. Main Dashboard (`/portal/sales`)

**Key Features:**
- Goal progress bar (monthly revenue vs target)
- Quick stats (leads, closed deals, rank, commission)
- Hot streak indicator
- Priority leads list with quick actions
- Today's scheduled inspections
- Quick call modal

**Quick Actions (Big Touch Targets):**
1. **Quick Call** - Opens contact list for one-tap calling
2. **Schedule** - Schedule an inspection
3. **Send Quote** - Send quote to customer
4. **Upload Photo** - Capture inspection photos

**Priority Lead Actions:**
- Call (logs call + initiates phone)
- Text (opens SMS)
- Portal (sends customer portal link via text)
- Details (navigates to customer detail)

### 2. Lead Management (`/portal/sales/leads`)

**Features:**
- Search by name, address, phone, email
- Filter by status (New, Contacted, Scheduled, Inspected, Quoted, Won, Lost)
- Filter by priority (Low, Medium, High, Urgent)
- Sort by priority, date, value, status, or name
- List/Grid view toggle

**Lead Statuses:**
| Status | Color | Description |
|--------|-------|-------------|
| New | Blue | Fresh lead, not yet contacted |
| Contacted | Purple | Initial contact made |
| Scheduled | Cyan | Inspection scheduled |
| Inspected | Orange | Inspection completed |
| Quoted | Yellow | Quote sent to customer |
| Won | Green | Deal closed successfully |
| Lost | Red | Deal lost to competitor or declined |

**Quick Actions Per Lead:**
- Call
- Text
- Map/Directions
- Update Status
- View Details

### 3. Performance Dashboard (`/portal/sales/performance`)

**Metrics Displayed:**
- Total Revenue (with trend indicator)
- Closed Deals (with trend indicator)
- Conversion Rate (with trend indicator)
- Average Deal Size (with trend indicator)

**Goal Progress:**
- Monthly goal progress bar
- Quarterly goal progress bar
- Yearly goal progress bar

**Commission Tracking:**
- Commission earned
- Commission pending
- Commission rate

**Activity Stats:**
- Calls made
- Inspections completed
- Quotes sent
- Follow-ups due

**Leaderboard:**
- Top 5 sales reps
- Current user highlighted
- Links to full Command Center leaderboard

**Achievements:**
- Earned badges displayed
- Progress toward next achievements

### 4. Customer Detail View (`/portal/sales/customers/[id]`)

**Tabs:**
1. **Overview** - Contact info, job details, insurance info, notes
2. **Activity** - Communication history timeline
3. **Quotes** - Quote history with resend option
4. **Photos** - Inspection photo gallery

**Quick Actions (Sticky Header):**
- Call (logged)
- Text
- Send Portal Link
- Directions/Map
- Schedule

**Information Sections:**
- Contact details (phone, email, address)
- Job details (type, roof type, estimated value, source)
- Insurance claim info (company, claim #, adjustor)
- Notes

## Mobile Optimization

### Design Principles
1. **Large Touch Targets** - All action buttons are minimum 44x44px
2. **Bottom Navigation** - Fixed nav bar for thumb-friendly access
3. **Floating Call Button** - Prominent call-to-action
4. **Swipe-friendly** - Lists designed for touch scrolling
5. **Offline-ready** - Note taking works offline (sync when online)

### Bottom Navigation Bar
- Home (Sales Dashboard)
- Leads
- Quick Call (floating center button)
- Stats (Performance)
- Portal (Main Dashboard)

## Permissions

Sales reps have the following permissions:
- `view_dashboard` - View main dashboard
- `view_leads` - View all leads
- `manage_leads` - Manage and update leads
- `view_own_leads` - View assigned leads
- `update_lead_status` - Update lead status
- `schedule_inspections` - Schedule inspections
- `create_quotes` - Create quotes
- `send_quotes` - Send quotes to customers
- `view_own_stats` - View personal stats
- `view_leaderboard` - View leaderboard
- `upload_photos` - Upload inspection photos
- `view_customer_portal` - View customer portal
- `send_customer_messages` - Send messages to customers
- `view_schedule` - View schedule

## Integration Points

### Phone System
- One-tap calling with automatic call logging
- SMS with pre-filled message templates
- Portal link sharing via text

### GPS/Maps
- One-tap directions to customer address
- Integration with Google Maps

### Customer Portal
- Generate and send portal links
- Customer can view job status, weather, documents

### Command Center
- Sales leaderboard synced with Command Center
- Performance metrics flow to management dashboards

## Data Flow

```
Lead Created (Website/Referral/Door Knock)
    |
    v
Assigned to Sales Rep
    |
    v
Contact Made --> Status: Contacted
    |
    v
Inspection Scheduled --> Status: Scheduled
    |
    v
Inspection Completed --> Status: Inspected
    |                    (Photos uploaded)
    v
Quote Created & Sent --> Status: Quoted
    |
    +---> Customer Accepts --> Status: Won
    |                         (Job created in system)
    |
    +---> Customer Declines --> Status: Lost
                               (Logged for reporting)
```

## Future Enhancements (Planned)

1. **Offline Mode** - Full offline capability with sync
2. **Push Notifications** - Real-time lead alerts
3. **Voice Notes** - Audio note recording
4. **AI Quote Generation** - Auto-generate quotes from inspection data
5. **Route Optimization** - Optimize daily inspection route
6. **Weather Integration** - Storm tracking for proactive outreach

## Technical Notes

- Built with Next.js 14 (App Router)
- React components with TypeScript
- Tailwind CSS for styling
- Session-based authentication
- Mobile-first responsive design
- PWA-ready structure

## Files Modified/Created

### New Files
- `/app/portal/sales/page.tsx` - Main sales dashboard
- `/app/portal/sales/leads/page.tsx` - Lead management
- `/app/portal/sales/performance/page.tsx` - Performance stats
- `/app/portal/sales/customers/[id]/page.tsx` - Customer detail

### Updated Files
- `/lib/team-roles.ts` - Added sales role and permissions
- `/lib/auth-context.tsx` - Added sales routes
- `/app/portal/dashboard/page.tsx` - Added sales navigation

---

Last Updated: February 2026
Version: 1.0.0
