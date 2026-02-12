# River City Roofing Solutions - Architecture Documentation

**Last Updated:** February 9, 2026
**Framework:** Next.js 14.2 with TypeScript, Tailwind CSS
**Deployment:** Vercel (prj_7s9kclvyqkMQhOHS4fHWpBJLEruG)
**Domain:** www.rivercityroofingsolutions.com

---

## System Overview

River City Roofing Solutions (RCRS) is a full-stack web application combining a public marketing website with an internal operations portal. The public site handles SEO-optimized content, lead generation, and customer-facing features. The portal system manages sales operations, inventory, deliveries, billing, and team coordination.

### Architecture Diagram

```
                          +---------------------+
                          |      Vercel CDN     |
                          |   (Static + Edge)   |
                          +----------+----------+
                                     |
                    +----------------+----------------+
                    |                                 |
            +-------+-------+              +----------+---------+
            | PUBLIC PAGES  |              |   API ROUTES       |
            | (SSG / SSR)   |              |   /api/*           |
            +-------+-------+              +----------+---------+
                    |                                 |
                    |                    +------------+------------+
                    |                    |            |            |
              +-----------+     +--------+--+  +-----+-----+  +--+--------+
              | Static    |     | Google    |  | JobNimbus |  | Vercel    |
              | Data (TS) |     | Sheets    |  | CRM API   |  | Blob      |
              +-----------+     +-----------+  +-----------+  +-----------+
              blogData.ts       (17+ tabs)     Contacts/Jobs   File storage
              teamData.ts                      Estimates/Tasks
              servicesData.ts
              reviewsData.ts
```

---

## Data Flow

### 1. Google Sheets as Backend Database

Google Sheets serves as the primary data store for dynamic operations data. The application connects via a service account using the `google-spreadsheet` library.

**Connection:** `lib/google-sheets-service.ts` (main) and `lib/cms-sheets-service.ts` (CMS operations)

**Sheet Tabs (SHEET_NAMES from google-sheets-service.ts):**

| Sheet Name | Purpose |
|---|---|
| `team-members-import` | Team member data synced from CMS |
| `Inventory` | Current inventory levels and product catalog |
| `InventoryLogs` | Inventory change audit trail |
| `Commissions` | Sales commission tracking |
| `Customers` | Customer records and portal access |
| `Orders` | Material orders and status tracking |
| `Deliveries` | Delivery tickets and routing |
| `Geocoded_Contacts` | Location-indexed contacts for lead distribution |
| `Lead_Distribution_Log` | Lead assignment history |
| `Rep_Availability` | Sales rep availability/status |
| `Rep_Preferences` | Rep territory and lead preferences |
| `Lead_Response_Log` | Lead response time tracking |
| `Job_Breakdowns` | Job cost breakdowns and estimates |
| `Team_Access_Overrides` | Per-user permission overrides |
| `Agent_Directory` | Insurance agent contacts |
| `Agent_Visits` | Agent visit tracking |
| `Training_Progress` | Employee training completion |

**CMS Sheet Tabs (from cms-sheets-service.ts):**

| Sheet Name | Purpose |
|---|---|
| `blog-posts` | Blog post CMS management |
| `team-members-import` | Team data CMS sync |
| `images` | Image library management |
| `settings` | Site-wide settings |
| `page-views` | Page view analytics |
| `profile-views` | Team profile view tracking |

### 2. Static Data Files (TypeScript)

Public-facing content is stored as TypeScript files for build-time optimization:

- `lib/blogData.ts` - 68 blog posts with full content
- `lib/teamData.ts` - 17 team members with bios, photos, social links
- `lib/servicesData.ts` - Service definitions and service area data
- `lib/reviewsData.ts` - Customer reviews
- `lib/inventoryData.ts` - Product catalog base data

### 3. Data Flow: Form Submissions

```
User Form Submit
     |
     v
/api/forms/contact (or /referral)
     |
     v
form-service.ts
     |
     +---> Google Sheets (row append)
     |
     +---> Google Apps Script (email notification)
     |
     +---> GroupMe (team notification, when configured)
```

### 4. Data Flow: Lead Distribution

```
New Lead (form or JobNimbus webhook)
     |
     v
lead-distribution-service.ts
     |
     +---> Check Rep_Availability
     +---> Check Rep_Preferences (territory match)
     +---> Round-robin or proximity assignment
     +---> Log to Lead_Distribution_Log
     +---> Notify assigned rep
```

---

## Authentication System

### Admin Auth (JWT-based)

- **Entry point:** `/api/admin/auth` - POST with admin password
- **Token:** JWT signed with `JWT_SECRET`, stored in httpOnly cookie
- **Middleware:** `requireAdmin()` function in API routes
- **Bypass:** `AUTH_BYPASS_MODE=true` env var for pre-user testing
- **Single admin password** stored in `ADMIN_PASSWORD` env var

### Portal Auth (PIN + Email)

- **Entry point:** `/api/portal/auth` - POST with email + PIN
- **Team members:** Defined in `lib/team-roles.ts` with PINs
- **Roles:** owner, admin, manager, sales, office, project_manager, driver, viewer
- **Context:** `lib/auth-context.tsx` provides `useAuth()` hook
- **Route guards:** `ROLE_ROUTES` mapping in auth-context determines access

### Customer Auth (Token-based)

- **Entry point:** `/api/customer/dashboard` and `/my/[token]`
- **Token:** Generated per-customer, stored in Customers sheet
- **Portal generator:** `lib/portal-generator.ts` creates unique customer portals

### Role Hierarchy

```
owner > admin > manager > sales/office > project_manager > driver > viewer
```

**Key role assignments:**
- `owner`: Chris Muse, Michael Muse - full access
- `admin`: Sara Hill - full access
- `manager`: Destin - operations oversight
- `sales`: John, Bart, Tia, Boston - own leads/jobs
- `project_manager`: Job scheduling, inventory
- `driver`: Delivery queue, route navigation

---

## Key Services (lib/)

| Service | File | Purpose |
|---|---|---|
| **Google Sheets** | `google-sheets-service.ts` | Core data CRUD for all sheets |
| **CMS Sheets** | `cms-sheets-service.ts` | Blog/team/image CMS operations |
| **Form Service** | `form-service.ts` | Contact and referral form processing |
| **Portal Auth** | `portal-auth.ts` | Role-based permissions system |
| **Team Roles** | `team-roles.ts` | Team member definitions with PINs |
| **Auth Context** | `auth-context.tsx` | Client-side auth state and route guards |
| **Lead Distribution** | `lead-distribution-service.ts` | Automated lead assignment |
| **Lead Portal** | `lead-portal-service.ts` | Lead management API |
| **Order Workflow** | `order-workflow-service.ts` | Material order lifecycle |
| **Delivery Workflow** | `delivery-workflow-service.ts` | Delivery ticket management |
| **Delivery Portal** | `delivery-portal-service.ts` | Driver-facing delivery operations |
| **Route Optimization** | `route-optimization-service.ts` | Delivery route planning |
| **Billing Workflow** | `billing-workflow-service.ts` | Invoice and billing management |
| **Invoice PDF** | `invoice-pdf-service.ts` | PDF invoice generation |
| **Scheduling** | `scheduling-service.ts` | Job and calendar scheduling |
| **Job Sync** | `job-sync-service.ts` | JobNimbus CRM synchronization |
| **Inventory Sync** | `inventory-sheets-sync.ts` | Sheets-based inventory management |
| **Price Verification** | `price-verification-service.ts` | Material price checking |
| **Restock Workflow** | `restock-workflow-service.ts` | Inventory restock requests |
| **Return/Pickup** | `return-pickup-service.ts` | Material return processing |
| **Reports** | `reports-service.ts` | Business analytics and reporting |
| **Weather** | `weather-service.ts` | Weather alerts for service areas |
| **GroupMe** | `groupme-service.ts` | Team notification integration |
| **TeamUp** | `teamup-service.ts` | Calendar integration |
| **Tracking** | `tracking-service.ts` | GA/FB pixel consent-aware tracking |
| **SEO** | `seo.ts` | Metadata and structured data generation |
| **Analytics** | `analytics.ts` | Internal analytics tracking |
| **Feature Flags** | `feature-flags.ts` | Feature toggle system |
| **Cache** | `cache.ts` | Server-side caching layer |

---

## API Route Organization

All API routes are under `app/api/` with auth middleware applied via `requireAuth()` or `requireAdmin()`.

### Public Routes (no auth required)

| Route | Methods | Purpose |
|---|---|---|
| `/api/forms/contact` | POST | Contact form submission |
| `/api/forms/referral` | POST | Referral form submission |
| `/api/contact` | POST | Legacy contact endpoint |
| `/api/referral` | POST | Legacy referral endpoint |
| `/api/team-members` | GET | Public team member data |
| `/api/weather/*` | GET | Weather forecasts and alerts |

### Admin Routes (requireAdmin)

| Route | Methods | Purpose |
|---|---|---|
| `/api/admin/auth` | POST | Admin login |
| `/api/admin/settings` | GET, POST | System settings |
| `/api/admin/upload` | POST | File upload to Vercel Blob |
| `/api/admin/team-members` | GET, POST, PUT | Team management |
| `/api/admin/jobnimbus/*` | GET | JobNimbus CRM integration |
| `/api/admin/system/*` | GET, POST | System status, API keys, audit log, features, maintenance |
| `/api/admin/portal-management` | GET, POST | Portal administration |
| `/api/admin/lead-distro` | GET, POST | Lead distribution configuration |

### Portal Routes (requireAuth)

| Route | Methods | Purpose |
|---|---|---|
| `/api/portal/auth` | POST | Portal login (email + PIN) |
| `/api/portal/dashboard` | GET | Dashboard stats |
| `/api/portal/inventory` | GET, POST, PUT, DELETE | Inventory CRUD |
| `/api/portal/orders` | GET, POST | Material orders |
| `/api/portal/orders/workflow` | POST | Order status transitions |
| `/api/portal/delivery` | GET, POST | Delivery management |
| `/api/portal/deliveries` | GET | Delivery list |
| `/api/portal/drivers` | GET | Driver list |
| `/api/portal/tickets` | GET, POST | Delivery tickets |
| `/api/portal/tickets/checklist` | POST | Ticket checklist updates |
| `/api/portal/tickets/photos` | POST | Delivery photo uploads |
| `/api/portal/billing` | GET, POST | Billing records |
| `/api/portal/billing/pdf` | GET | Invoice PDF generation |
| `/api/portal/pricing` | GET, POST | Material pricing |
| `/api/portal/pricing/alerts` | GET | Price alert notifications |
| `/api/portal/pricing/verify` | POST | Price verification |
| `/api/portal/pricing/audit` | GET | Price audit trail |
| `/api/portal/tasks` | GET, POST | Task management |
| `/api/portal/schedule` | GET, POST | Scheduling |
| `/api/portal/locations` | GET | Location tracking |
| `/api/portal/users` | GET, POST | User management |
| `/api/portal/transactions` | GET | Transaction history |
| `/api/portal/restock` | GET, POST | Restock requests |
| `/api/portal/sync` | POST | Data synchronization |
| `/api/portal/generate` | POST | Portal generation |
| `/api/portal/invoices` | GET, POST | Invoice management |
| `/api/portal/workflow` | POST | Workflow transitions |
| `/api/portal/qr/[token]` | GET | QR code-based portal access |

### Profile Routes (requireAuth)

| Route | Methods | Purpose |
|---|---|---|
| `/api/profile` | GET, POST | User profile |
| `/api/profile/images` | GET, POST | Profile image management |
| `/api/profile/reviews` | GET, POST | Profile reviews |
| `/api/profile/submit-edit` | POST | Profile edit requests |
| `/api/profile/pending` | GET | Pending edits |
| `/api/profile/pending-count` | GET | Pending edit count |
| `/api/profile/approve` | POST | Approve profile edits |
| `/api/profile/my-edits` | GET | Own edit history |

### Utility Routes

| Route | Methods | Purpose |
|---|---|---|
| `/api/sheets/*` | GET, POST | Google Sheets sync, inventory, commissions, customers |
| `/api/cms/*` | GET, POST | Content management (blog, team, images, setup) |
| `/api/analytics/*` | GET, POST | Page and profile view tracking |
| `/api/calendar/*` | GET, POST | Calendar slots and scheduling |
| `/api/calls/*` | GET, POST | Call tracking and analytics |
| `/api/documents` | GET, POST | Document management |
| `/api/invoices/*` | GET, POST | Invoice CRUD and generation |
| `/api/breakdown` | GET, POST | Job cost breakdowns |
| `/api/jobnimbus/*` | GET | JobNimbus job and search |
| `/api/notifications/*` | POST | GroupMe and portal notifications |
| `/api/command-center/*` | GET | Sales, team, meetings, financial, calls, inventory, stats |
| `/api/customer/*` | GET | Customer dashboard and messages |
| `/api/leads/new` | POST | New lead creation |
| `/api/webhooks/*` | POST | External webhook handlers |

---

## Portal System Overview

The portal serves multiple user roles with distinct dashboards:

### Portal Pages (app/portal/)

| Page | Role(s) | Purpose |
|---|---|---|
| `/portal` | All | Login page (email + PIN) |
| `/portal/dashboard` | All | Role-specific dashboard |
| `/portal/sales` | Sales | Sales pipeline and stats |
| `/portal/sales/leads` | Sales | Lead management |
| `/portal/sales/customers` | Sales | Customer management |
| `/portal/sales/performance` | Sales | Performance metrics |
| `/portal/sales/settings` | Sales | Personal preferences |
| `/portal/manager` | Manager | Operations overview |
| `/portal/manager/lead-controls` | Manager | Lead distribution controls |
| `/portal/office` | Office | Office operations hub |
| `/portal/pm` | PM | Project management |
| `/portal/driver` | Driver | Delivery queue |
| `/portal/driver/loading` | Driver | Load verification |
| `/portal/delivery` | PM/Manager | Delivery management |
| `/portal/delivery/route` | Driver | Active route navigation |
| `/portal/delivery/[id]` | Driver | Individual delivery details |
| `/portal/inventory` | Multiple | Inventory management |
| `/portal/orders` | Multiple | Material orders |
| `/portal/orders/new` | PM/Manager | Create new order |
| `/portal/orders/[id]` | Multiple | Order details |
| `/portal/orders/[id]/return` | PM/Manager | Return processing |
| `/portal/billing` | Manager/Admin | Billing and invoicing |
| `/portal/schedule` | Multiple | Scheduling calendar |
| `/portal/reports` | Manager/Admin | Business reports |
| `/portal/tasks` | Multiple | Task management |
| `/portal/customers` | Multiple | Customer portal management |
| `/portal/documents` | Multiple | Document sharing |
| `/portal/directory` | All | Team directory |
| `/portal/locations` | Manager/Admin | Location tracking |
| `/portal/transactions` | Manager/Admin | Transaction history |
| `/portal/monday-notes` | All | Weekly meeting notes |
| `/portal/monday-notes/admin` | Admin | Meeting notes summary |
| `/portal/my-profile` | All | Personal profile |
| `/portal/my-profile/images` | All | Profile images |
| `/portal/my-profile/reviews` | All | Personal reviews |
| `/portal/training` | All | Training modules |
| `/portal/admin` | Admin/Owner | Admin dashboard |
| `/portal/admin/team` | Admin | Team management |
| `/portal/admin/blog` | Admin | Blog CMS |
| `/portal/admin/services` | Admin | Services CMS |
| `/portal/admin/areas` | Admin | Service areas CMS |
| `/portal/admin/images` | Admin | Image library |
| `/portal/admin/users` | Admin | User management |
| `/portal/admin/pricing` | Admin | Pricing management |
| `/portal/admin/operations` | Admin | Operations dashboard |
| `/portal/admin/training` | Admin | Training management |
| `/portal/admin/lead-distro` | Admin | Lead distribution config |
| `/portal/admin/portal-settings` | Admin | Portal settings |
| `/portal/admin/profile-approvals` | Admin | Profile edit approvals |

---

## External Integrations

| Integration | Purpose | Config |
|---|---|---|
| **Google Sheets** | Primary database | Service account + Sheet ID |
| **Google Apps Script** | Email notifications on form submit | Script endpoint URL |
| **Google Analytics** | Website analytics (G-Y8PB85BZC5) | GA ID in env |
| **JobNimbus** | CRM - contacts, jobs, estimates, tasks | API key + URL |
| **Vercel Blob** | File storage (images, documents) | Blob token |
| **GroupMe** | Team notifications | Bot ID + access token (not yet configured) |
| **TeamUp** | Calendar integration | API key + calendar key (not yet configured) |
| **Facebook Pixel** | Ad tracking | Pixel ID (not yet configured) |
| **Google Ads** | Ad conversion tracking | Ads ID (not yet configured) |
| **Twilio** | SMS notifications | Account SID + auth token (not yet configured) |
| **SendGrid** | Email service | API key (not yet configured) |

---

## SEO System

The SEO system is centralized in `lib/seo.ts` with reusable schema generators:

- **Metadata generation:** `generateMetadata()` - creates Next.js Metadata objects with OG, Twitter, canonical URLs
- **Structured data:** Multiple JSON-LD generators for RoofingContractor, Article, Service, Person, FAQ, Breadcrumb, etc.
- **Reusable component:** `components/StructuredData.tsx` - renders JSON-LD script tags
- **Site config:** Centralized in `siteConfig` object (name, URLs, phone, address, social links)

---

## Public Site Structure

```
/ .......................... Homepage (SSG)
/about .................... About page
/blog ..................... Blog index (68 posts)
/blog/[slug] .............. Individual blog post
/team ..................... Team listing (17 members)
/team/[slug] .............. Individual team member profile
/services ................. Services index
/services/[slug] .......... Individual service page
/service-areas ............ Service areas index
/service-areas/[slug] ..... Individual service area page
/locations/huntsville ..... Huntsville location page
/locations/decatur ........ Decatur location page
/locations/madison ........ Madison location page
/contact .................. Contact form
/contact/thank-you ........ Form submission thank you
/referral-rewards ......... Referral program
/bni ...................... BNI networking page
/privacy .................. Privacy policy
/terms .................... Terms of service
/p/[shortCode] ............ Short URL redirects
/my/[token] ............... Customer portal (token-based)
```

---

## Build and Deployment

- **Build:** `next build` generates 300+ static pages
- **Deployment:** Vercel auto-deploys from GitHub (main branch)
- **Environment:** Variables managed via Vercel dashboard and `.env.local`
- **Performance:** Vercel Speed Insights integrated, Image optimization via `next/image`
- **Caching:** Server-side cache layer in `lib/cache.ts`

---

## Component Library

### UI Components (components/ui/)
Standard shadcn/ui components (Button, Card, etc.)

### Custom Components (components/)
| Component | Purpose |
|---|---|
| `Header.tsx` | Site navigation header |
| `Footer.tsx` | Site footer with links |
| `StructuredData.tsx` | Reusable JSON-LD structured data injection |
| `ContactForm.tsx` | Multi-purpose contact form |
| `ReferralForm.tsx` | Referral submission form |
| `ReferralCalculator.tsx` | Referral reward calculator |
| `FloatingContactButton.tsx` | Fixed-position CTA button |
| `PromoBanner.tsx` | Top promotional banner |
| `CookieConsent.tsx` | GDPR/cookie consent banner |
| `TrackingProvider.tsx` | Analytics consent-aware wrapper |
| `GlobalVideoBackground.tsx` | Site-wide video background |
| `VideoBackground.tsx` | Per-page video background |
| `AnimatedHeroText.tsx` | Animated hero text effect |
| `RotatingText.tsx` | Rotating text carousel |
| `ScrollReveal.tsx` | Scroll-triggered animations |
| `WeatherWidget.tsx` | Weather display widget |
| `StormAlert.tsx` | Storm warning notifications |
| `AdminLayout.tsx` | Admin page layout wrapper |
| `TrainingPopup.tsx` | Training module popup |
| `RoleTrainingPopup.tsx` | Role-specific training |
| `FeatureUpdatesPopup.tsx` | Feature announcement popup |
| `MaintenanceBanner.tsx` | Maintenance mode banner |
| `EnvironmentBadge.tsx` | Dev/staging environment indicator |
| `Leaderboard.tsx` | Sales leaderboard |
| `CallHistory.tsx` | Call tracking display |
| `CustomerCallHistory.tsx` | Customer-specific call log |
| `AddressAutocomplete.tsx` | Address input with autocomplete |
| `SettingsMenu.tsx` | Portal settings menu |
