# River City Roofing Solutions - System Overview

## Introduction

River City Roofing Solutions (RCRS) is a comprehensive Next.js 14 web application that serves as both a public-facing website and an internal operations platform for a roofing company based in Hartselle, Alabama. The system integrates multiple third-party services to streamline operations from lead generation to job completion.

---

## Architecture Diagram

```
                                    +----------------------------------+
                                    |         RCRS Platform            |
                                    |         (Next.js 14)             |
                                    +----------------------------------+
                                                   |
         +-------------------------+---------------+---------------+-------------------------+
         |                         |               |               |                         |
         v                         v               v               v                         v
+----------------+       +----------------+  +------------+  +----------------+     +----------------+
|  Public Site   |       | Admin Portal   |  |  Command   |  | Team Portal    |     | Customer Portal|
|                |       |                |  |  Center    |  |                |     |                |
| - Home         |       | - Dashboard    |  | - Sales    |  | - PM Portal    |     | - Job Status   |
| - Services     |       | - Inventory    |  | - Inventory|  | - Office Portal|     | - Appointments |
| - About        |       | - Team Mgmt    |  | - Phone    |  | - Driver Portal|     | - Weather      |
| - Contact      |       | - Blog/CMS     |  | - Meetings |  | - Billing      |     | - Messages     |
| - Locations    |       | - Marketing    |  | - Reports  |  | - Schedule     |     |                |
+----------------+       +----------------+  +------------+  +----------------+     +----------------+
         |                         |               |               |                         |
         +-------------------------+---------------+---------------+-------------------------+
                                                   |
                          +------------------------+------------------------+
                          |                        |                        |
                          v                        v                        v
                +------------------+     +------------------+     +------------------+
                |   Integrations   |     |    Data Layer    |     |   File Storage   |
                |                  |     |                  |     |                  |
                | - JobNimbus CRM  |     | - Google Sheets  |     | - Vercel Blob    |
                | - TeamUp Calendar|     | - Local JSON     |     |                  |
                | - GroupMe        |     |                  |     |                  |
                | - Weather APIs   |     |                  |     |                  |
                +------------------+     +------------------+     +------------------+
```

---

## Core Components

### 1. Public Website (`/app`)
The customer-facing website showcasing services, team, and contact information.

| Route | Purpose |
|-------|---------|
| `/` | Homepage with service overview |
| `/about` | Company information and history |
| `/services` | Roofing services offered |
| `/services/[slug]` | Individual service details |
| `/team/[slug]` | Team member profiles |
| `/contact` | Contact form |
| `/blog` | Blog posts |
| `/locations` | Service area pages |
| `/service-areas` | Geographic coverage |

### 2. Admin Portal (`/app/admin`)
Content management and administrative functions.

| Route | Purpose |
|-------|---------|
| `/admin` | Admin dashboard |
| `/admin/inventory` | Inventory management |
| `/admin/team` | Team member management |
| `/admin/blog` | Blog post editor |
| `/admin/upload` | File/image uploads |
| `/admin/marketing` | Marketing tools |
| `/admin/social-ads` | Social media ad management |
| `/admin/jobnimbus` | CRM integration settings |

### 3. Command Center (`/app/command-center`)
Internal operations dashboard for management.

| Route | Purpose |
|-------|---------|
| `/command-center` | Main dashboard |
| `/command-center/sales` | Sales leaderboard |
| `/command-center/inventory` | Inventory overview |
| `/command-center/marketing` | Marketing campaigns |
| `/command-center/phone` | Phone system |
| `/command-center/meetings` | Meeting management |
| `/command-center/schedule` | Calendar view |
| `/command-center/reports` | Business reports |

### 4. Team Portal (`/app/portal`)
Role-based internal portal for employees.

| Route | Role | Purpose |
|-------|------|---------|
| `/portal` | All | Login page |
| `/portal/dashboard` | All | Personal dashboard |
| `/portal/driver` | Driver | Delivery workflow |
| `/portal/pm` | PM | Project management |
| `/portal/office` | Office | Office operations |
| `/portal/manager` | Manager | Manager dashboard |
| `/portal/billing` | Office+ | Billing management |
| `/portal/inventory` | Office+ | Inventory management |
| `/portal/admin` | Admin | System administration |

### 5. Customer Portal (`/app/customer`)
Self-service portal for customers.

| Route | Purpose |
|-------|---------|
| `/customer` | Customer login |
| `/customer/dashboard` | Job status, weather, messages |
| `/my/[token]` | Token-based access |

---

## Data Flow

### Lead Generation Flow
```
Contact Form --> /api/contact --> JobNimbus CRM
                           |
                           +--> GroupMe Notification
                           |
                           +--> Google Sheets (backup)
```

### Delivery Workflow
```
Material Order --> Schedule Delivery --> Assign Driver
        |                                    |
        v                                    v
   Inventory Check            Driver Mobile View
        |                           |
        v                           +---> GPS Tracking
   Pull Materials                   |
        |                           +---> Photo Upload
        v                           |
   Load Verification                +---> Signature Capture
        |                           |
        v                           v
   Dispatch ----------------> Delivery Complete
                                    |
                                    v
                            GroupMe Notification
```

### Customer Portal Flow
```
Customer Login --> Email/Phone/Access Code
        |
        +--> Lookup in JobNimbus
        |
        v
   Dashboard View
        |
        +---> Job Status (from JobNimbus)
        +---> Weather (from Open-Meteo)
        +---> Appointments (from TeamUp)
        +---> Messages (in-app)
```

---

## Technology Stack

### Frontend
- **Framework**: Next.js 14 (App Router)
- **UI Library**: React 18
- **Styling**: Tailwind CSS
- **UI Components**: Radix UI, Lucide Icons
- **Charts**: Recharts

### Backend
- **Runtime**: Node.js (Next.js API Routes)
- **Authentication**: Session-based (PIN + Email)
- **File Storage**: Vercel Blob

### Integrations
| Service | Purpose | Library |
|---------|---------|---------|
| Google Sheets | Data persistence | `google-spreadsheet` |
| JobNimbus | CRM | REST API |
| TeamUp | Calendar | REST API |
| GroupMe | Team notifications | REST API |
| Open-Meteo | Weather data | REST API |
| NWS | Weather alerts | REST API |

### Hosting
- **Platform**: Vercel
- **Analytics**: Vercel Analytics
- **Speed Insights**: Vercel Speed Insights

---

## Authentication & Roles

### Role Hierarchy
```
owner > admin > office > project_manager > driver > viewer
```

### Role Capabilities

| Role | Portal Access | Permissions |
|------|--------------|-------------|
| Owner | All | Full system access |
| Admin | All | Full system access |
| Office | Office, Billing, Inventory | Manage billing, inventory, view reports |
| Project Manager | PM Portal | Create orders, schedule, view inventory |
| Driver | Driver Portal | View assigned tickets, update status, photos |
| Viewer | Read-only | View dashboards only |

### Authentication Methods
1. **Email Login**: For staff (office, PM, admin, owner)
2. **PIN Login**: 4-digit PIN for drivers (quick mobile access)
3. **Access Code**: Customer portal access

---

## Environment Variables

```env
# Google Sheets
GOOGLE_SHEETS_ID=
GOOGLE_SERVICE_ACCOUNT_EMAIL=
GOOGLE_PRIVATE_KEY=

# JobNimbus CRM
JOBNIMBUS_API_KEY=
JOBNIMBUS_API_URL=

# TeamUp Calendar
TEAMUP_API_KEY=
TEAMUP_CALENDAR_KEY=
TEAMUP_SUBCAL_INSPECTIONS=
TEAMUP_SUBCAL_INSTALLATIONS=
TEAMUP_SUBCAL_DELIVERIES=
TEAMUP_SUBCAL_MEETINGS=

# GroupMe Notifications
GROUPME_BOT_ID=
GROUPME_ACCESS_TOKEN=
GROUPME_ENABLED=

# Vercel Blob Storage
BLOB_READ_WRITE_TOKEN=
```

---

## Key Files & Directories

```
river-city-roofing/
├── app/                    # Next.js App Router pages
│   ├── admin/              # Admin portal
│   ├── api/                # API routes
│   ├── command-center/     # Command center
│   ├── customer/           # Customer portal
│   ├── portal/             # Team portal
│   └── ...                 # Public pages
├── components/             # React components
├── lib/                    # Business logic & services
│   ├── jobnimbus-service.ts
│   ├── google-sheets-service.ts
│   ├── groupme-service.ts
│   ├── teamup-service.ts
│   ├── weather-service.ts
│   ├── team-roles.ts
│   ├── auth-context.tsx
│   └── ...
├── public/                 # Static assets
└── docs/                   # Documentation
```

---

## Security Considerations

1. **API Key Protection**: All third-party API keys stored as environment variables
2. **Session-Based Auth**: User sessions stored in browser sessionStorage
3. **Role-Based Access Control**: Routes protected by role checks
4. **PIN Hashing**: Driver PINs stored for quick lookup (consider hashing in production)
5. **Rate Limiting**: API endpoints include rate limiting service

---

## Deployment

The application is designed for Vercel deployment:

1. Connect GitHub repository to Vercel
2. Configure environment variables in Vercel dashboard
3. Deploy automatically on push to main branch

Build command: `npm run build`
Output directory: `.next`
