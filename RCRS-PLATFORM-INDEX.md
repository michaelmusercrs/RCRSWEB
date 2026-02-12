# RCRS Platform Index - River City Roofing Solutions
## Master Reference Guide (Updated 2026-02-10)

---

## DOMAINS
- **Public Site**: www.rivercityroofingsolutions.com (customer-facing)
- **Portal/Office**: rcrsal.com (team portal, admin, command center)
- **Customer Portals**: /my/[token] (works on both domains)
- **Vercel Project**: prj_7s9kclvyqkMQhOHS4fHWpBJLEruG

---

## ACCOUNTS & CREDENTIALS

### Google Workspace (rcrsal.com)
- 16 active users, 2 suspended (Anna Carroll, Brittany Hutchison)
- Admin: michaelmuse@rivercityroofingsolutions.com
- Company account: rcrs@rivercityroofingsolutions.com

### GroupMe Bot (River)
- Bot ID: e7867d05283705dd95d3bb4061
- Webhook: https://rcrsal.com/api/webhooks/groupme
- Commands: /river help, /river status, /river leads

### SMS Gateway (Spare Phone)
- App: "SMS Gateway API" (smsgateway.me) - TO SET UP
- Device ID: (pending)
- API Key: (pending)
- Cost: FREE (uses phone's cell plan)

### Twilio (Paid Backup)
- Account SID: (not yet configured)
- Auth Token: (not yet configured)
- Phone Number: (not yet configured)
- Cost: ~$0.0079/msg + $1.15/mo number

### Google Analytics
- GA ID: G-Y8PB85BZC5

### TeamUp Calendar
- API Key: ksgfxermrxee1jz1fw

### Vercel Blob Storage
- Auto-configured via Vercel

---

## TEAM ROSTER (16 Active)

### Owners
| Name | Email | Phone | PIN |
|------|-------|-------|-----|
| Michael Muse | michaelmuse@rivercityroofingsolutions.com | 256-221-4290 | 1135 |
| Chris Muse | chrismuse@rivercityroofingsolutions.com | 256-648-1224 | 1138 |

### Admin
| Name | Email | Phone | PIN |
|------|-------|-------|-----|
| Sara Hill | sara@rivercityroofingsolutions.com | 256-810-3594 | 1131 |

### Manager
| Name | Email | Phone | PIN |
|------|-------|-------|-----|
| Destin Mccary | destin@rivercityroofingsolutions.com | 256-905-7738 | 1132 |

### Office
| Name | Email | Phone | PIN |
|------|-------|-------|-----|
| Tia Muse Morris | tia@rivercityroofingsolutions.com | 256-394-8396 | 1133 |

### Project Managers
| Name | Email | Phone | PIN |
|------|-------|-------|-----|
| Bart Roberts | bart@rivercityroofingsolutions.com | 256-654-0747 | 1134 |
| John Cordonis | john@rivercityroofingsolutions.com | 256-654-0875 | 1137 |

### Sales Reps
| Name | Email | Phone | PIN |
|------|-------|-------|-----|
| Aaron Lussi | aaron@rivercityroofingsolutions.com | 256-656-7856 | 2020 |
| Adam Rudell | adam@rivercityroofingsolutions.com | 256-654-3631 | 2070 |
| Boston Muse | boston@rivercityroofingsolutions.com | - | 2080 |
| Brendon Muse | brendon@rivercityroofingsolutions.com | 256-616-6174 | 2040 |
| Greg Muse | greg@rivercityroofingsolutions.com | 256-221-1809 | 2030 |
| Hunter Rivers | hunter@rivercityroofingsolutions.com | 256-221-0548 | 2010 |
| Joseph Dowd | joseph@rivercityroofingsolutions.com | 256-751-7297 | 2090 |

### Drivers
| Name | Email | Phone | PIN |
|------|-------|-------|-----|
| Richard Geahr | richard@rivercityroofingsolutions.com | 256-701-7376 | 1136 |
| Travis Wages | travis@rivercityroofingsolutions.com | 256-466-0956 | 1140 |

### Inactive
- Tae Orr, Rick, Rudy (not in Google Workspace)

---

## NOTIFICATION FLOW

### New Lead (Check My Address or Contact Form)
1. Customer submits form
2. Storm report generates (real NWS data, risk score 0-100)
3. Lead auto-created, rep auto-assigned via lead distribution
4. Customer receives: portal link EMAIL + SMS
5. Rep receives: lead assignment EMAIL + River bot DM
6. Team receives: River bot GROUP POST
7. Response timer starts (10min remind, 30min warn, 60min reassign)

### Missed Lead Escalation
- 10 min: River DM to assigned rep only
- 30 min: River DM to rep + Chris + Michael
- 60 min: Escalation DM + group post, lead needs reassignment

### Delivery Orders
- Material order created -> auto-generates delivery ticket
- Email sent to richard+orders@rivercityroofingsolutions.com (Gmail+ alias)
- River bot posts delivery update to group
- Customer gets SMS + email delivery reminder

### Customer SMS Controls
- Admin master toggle: ON by default
- Default topics ON: delivery reminders, appointments, status updates, portal links
- Default topics OFF: weather alerts, document sharing
- Per-customer: reps can toggle topics individually in portal settings

---

## KEY PAGES & URLS

### Public Site (rivercityroofingsolutions.com)
- / - Homepage
- /services - All services
- /about - About/team
- /check-my-address - Free storm report (lead capture)
- /referral-rewards - Referral program
- /contact - Contact form
- /blog - Blog
- /locations - Service areas
- /service-areas/[slug] - Individual area pages

### Portal (rcrsal.com)
- /portal - Main dashboard
- /portal/sales - Sales dashboard
- /portal/sales/leads - Lead management
- /portal/sales/customers - Customer list
- /portal/sales/customers/[id] - Customer detail (6 tabs)
- /portal/schedule - Calendar (month/week/day)
- /portal/orders - Material orders
- /portal/orders/new - New order form
- /portal/transactions - Transaction history
- /portal/training - Training hub (3 paths)
- /portal/training/sales - 7-module sales course
- /portal/training/onboarding - Platform walkthrough
- /portal/chat - GroupMe chat integration

### Admin (rcrsal.com)
- /admin - Admin dashboard
- /admin/sales - Sales analytics
- /portal/admin/portal-settings - Portal settings & controls

### Command Center (rcrsal.com)
- /command-center - Main command center
- /command-center/sales - Sales leaderboard
- /command-center/sales/[rep] - Rep detail
- /command-center/sales/achievements - Achievements
- /command-center/reports/team - Team reports

### Customer Portal
- /my/[token] - Customer portal (token-based auth)

---

## API ROUTES (180+)

### Lead Management
- POST /api/leads/new - Create lead + auto-notify
- GET /api/leads - List leads (admin)
- POST /api/leads/distribute - Manual lead distribution
- GET/POST /api/leads/response-timer - Timer check + escalation
- POST /api/leads/contact-made - Record first contact
- GET /api/leads/search - Search leads
- GET /api/leads/metrics - Lead metrics

### Storm Reports
- POST /api/storm-report - Generate report (public, no auth)
- GET /api/storm-report - Fetch existing report

### Forms
- POST /api/forms/contact - Contact form -> Sheets + lead creation
- POST /api/forms/referral - Referral form

### Delivery & Orders
- GET/POST /api/portal/material-orders - Orders + auto-ticket + Gmail+ email
- GET/POST /api/portal/orders/workflow - Full order lifecycle
- GET/POST /api/portal/delivery/reminders - SMS + email reminders
- GET /api/portal/deliveries - Delivery list
- GET /api/portal/tickets - Delivery tickets

### Webhooks
- POST /api/webhooks/groupme - River bot callback
- POST /api/webhooks/jobnimbus - JN sync

### Calendar
- GET/POST /api/calendar/events - Calendar events
- GET/POST /api/calendar/teamup - TeamUp sync

---

## TECH STACK
- **Framework**: Next.js 14.2.33, React 18, TypeScript
- **Styling**: Tailwind CSS (brand-green: #39FF14)
- **Deployment**: Vercel (both domains)
- **Data**: Google Sheets backend
- **CRM**: JobNimbus (2-way sync)
- **Files**: Vercel Blob storage
- **Auth**: JWT admin, token-based customer portal
- **Email**: Google Apps Script (consolidated)
- **SMS**: Phone Gateway (free) > Twilio (backup) > Apps Script
- **Chat**: GroupMe + River bot
- **Calendar**: TeamUp API + Google Calendar links
- **PWA**: Service worker, offline page, dual manifests
- **Middleware**: Domain-based routing (308 redirects)

---

## FILES TO KNOW
- `.env.local` - Active environment config
- `.env.local.configured` - Reference template with all vars
- `PUNCHOUT-LIST.md` - Outstanding items tracker
- `lib/ARCHITECTURE.md` - System architecture docs
- `lib/team-roles.ts` - Team roster + roles + permissions
- `lib/teamData.ts` - Team bios + contact info
- `middleware.ts` - Domain routing logic
- `public/manifest.json` - PWA manifest (public site)
- `public/manifest-portal.json` - PWA manifest (portal)
- `public/sw.js` - Service worker

---

## PENDING SETUP
1. [ ] SMS Gateway - Install app on spare phone, get device ID + API key
2. [ ] PWA Icons - Generate PNGs from logo (72-512px) in public/icons/
3. [ ] rcrsal.com DNS - Point to Vercel
4. [ ] Google Maps API Key - For address autocomplete
5. [ ] Play Store - Package with PWABuilder after icons + assetlinks.json
6. [ ] Gmail Filter - Set up filter for richard+orders@ to auto-label delivery orders
