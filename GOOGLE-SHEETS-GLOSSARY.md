# RCRS DATA GLOSSARY & GOOGLE SHEETS INDEX
## River City Roofing Solutions - Master Data Reference

**Created:** February 6, 2026
**Spreadsheet ID:** `1uMEdtHo3xMu2gs21p7dYAgYiPWuCZ3s4a8YU-gJZ31s`
**Service Account:** `sheets-access@gen-lang-client-0821717467.iam.gserviceaccount.com`

---

## HOW TO USE THIS DOCUMENT
This is the master index for ALL data in the RCRS system. For each data source, it tells you:
- **Where** the data lives
- **How** it gets there (manual entry, form submission, API sync, etc.)
- **When** it updates (real-time, on sync, manual)
- **What** it connects to (which pages, charts, tables display it)

---

## GOOGLE SHEETS TABS (All in one spreadsheet)

### Tab 1: `contact-submissions`
| Field | Details |
|-------|---------|
| **What it stores** | Every contact form submission from the website |
| **How data enters** | Automatically when someone fills out the Contact Form on the website |
| **Update frequency** | Real-time (every form submission) |
| **Columns** | id, timestamp, status, sourcePage, name, email, phone, subject, message, preferredInspector, serviceType, serviceArea, leadSource, leadSourceDetail, marketingSource |
| **Connected to** | Admin Leads page, Command Center dashboard, Google Apps Script email notifications |
| **Who uses it** | Michael, Sara, Sales Reps (to follow up on leads) |
| **Notes** | Also triggers email notification via Google Apps Script endpoint |

---

### Tab 2: `referral-submissions`
| Field | Details |
|-------|---------|
| **What it stores** | Every referral form submission from the website |
| **How data enters** | Automatically when someone submits a Referral Form |
| **Update frequency** | Real-time (every form submission) |
| **Columns** | id, timestamp, status, sourcePage, referrerName, referrerPhone, referrerEmail, referralName, referralPhone, referralEmail, referralAddress, salesRep, notes |
| **Connected to** | Admin dashboard, email notifications |
| **Who uses it** | Michael, Sara, Sales Reps |
| **Notes** | Referrer is the person making the referral; Referral is the potential customer |

---

### Tab 3: `Commissions`
| Field | Details |
|-------|---------|
| **What it stores** | Sales rep commission records and payment history |
| **How data enters** | Synced from `data/commissions.json` via manual sync, or direct entry |
| **Update frequency** | On manual sync (POST /api/sheets/sync) |
| **Columns** | salesRep, date, amount, balance, jobId, jobName, description, status |
| **Connected to** | Command Center > Sales Leaderboard, Command Center > Financial, Sales Portal > Performance, Individual Rep dashboards |
| **Who uses it** | Michael, Sara (admin view), Sales Reps (own data only) |
| **Notes** | This is the main source for all sales leaderboard rankings and commission payouts |

---

### Tab 4: `Inventory`
| Field | Details |
|-------|---------|
| **What it stores** | Current inventory of all materials and products |
| **How data enters** | Synced from `data/inventory.json`, or direct entry in sheets |
| **Update frequency** | On manual sync or when inventory is updated in portal |
| **Columns** | sku, name, description, category, cost, price, quantity, minStock, maxStock, unit, supplier, location, imageUrl, lastUpdated, updatedBy |
| **Connected to** | Command Center > Inventory, Portal > Inventory, Admin > Inventory, Low Stock Alerts, Order Workflow |
| **Who uses it** | Tia (office), Destin (manager), Michael/Sara (admin), Bart/John (PM for orders) |
| **Notes** | Low stock alert triggers when quantity < minStock |

---

### Tab 5: `InventoryLogs`
| Field | Details |
|-------|---------|
| **What it stores** | Every inventory transaction (additions, removals, adjustments) |
| **How data enters** | Automatically when inventory changes via portal or API |
| **Update frequency** | Real-time with each inventory action |
| **Columns** | id, sku, action, quantity, previousQty, newQty, reason, performedBy, timestamp |
| **Connected to** | Inventory audit trail, Admin reports |
| **Who uses it** | Michael, Sara, Tia (for auditing) |
| **Notes** | Used to track who changed what and when |

---

### Tab 6: `Customers`
| Field | Details |
|-------|---------|
| **What it stores** | Customer records and contact information |
| **How data enters** | Created from contact form submissions, manual entry, or JobNimbus sync |
| **Update frequency** | On creation/sync |
| **Columns** | customerId, name, email, phone, address, city, state, zip, jobCount, totalSpent, lastJobDate, notes, source, salesRep, createdAt, updatedAt |
| **Connected to** | Customer Portal, Sales > Customers, Command Center, Invoices |
| **Who uses it** | All staff (role-filtered views) |
| **Notes** | Links to JobNimbus contacts when synced |

---

### Tab 7: `Orders`
| Field | Details |
|-------|---------|
| **What it stores** | Material orders and delivery requests |
| **How data enters** | Created by Project Managers or Office Staff via Portal > Orders |
| **Update frequency** | Real-time (on order creation/update) |
| **Columns** | orderId, customerId, customerName, jobId, jobAddress, status, items (JSON), totalCost, totalPrice, createdBy, deliveryDate, deliveredBy |
| **Connected to** | Driver Portal (delivery queue), Office Portal (order tracking), Inventory (stock deduction) |
| **Who uses it** | Bart/John (create), Tia (track), Richard/Tae (deliver) |
| **Notes** | Items column is JSON array of materials with SKU and quantity |

---

### Tab 8: `team-members-import`
| Field | Details |
|-------|---------|
| **What it stores** | Team member profiles, bios, and photos |
| **How data enters** | Synced from `lib/teamData.ts` on CMS setup, or edited via Admin > Team |
| **Update frequency** | On manual edit or sync |
| **Columns** | slug, name, company, category, position, phone, email, altEmail, displayOrder, tagline, bio, region, launchDate, profileImage, truckImage, facebook, instagram, x, tiktok, linkedin |
| **Connected to** | Website /team page, Individual profile pages /team/[slug], Admin > Team editor |
| **Who uses it** | Michael, Sara (editing), Public (viewing on website) |
| **Notes** | Profile edits go through approval workflow before publishing |

---

### Tab 9: `blog-posts`
| Field | Details |
|-------|---------|
| **What it stores** | Blog articles for the website |
| **How data enters** | Created via Admin > Blog editor, or synced from `lib/blogData.ts` |
| **Update frequency** | On publish/edit |
| **Columns** | id, slug, title, date, author, image, keywords, excerpt, content, published |
| **Connected to** | Website /blog page, Individual posts /blog/[slug], SEO sitemap |
| **Who uses it** | Michael, Sara (writing/editing), Public (reading) |
| **Notes** | `published` field controls visibility; unpublished posts are drafts |

---

### Tab 10: `images`
| Field | Details |
|-------|---------|
| **What it stores** | Metadata for all uploaded images |
| **How data enters** | Automatically on image upload via Admin > Images or profile uploads |
| **Update frequency** | Real-time (each upload) |
| **Columns** | id, filename, path, category, uploadedBy, uploadedAt, altText |
| **Connected to** | Admin > Image Gallery, Blog post images, Team profile images |
| **Who uses it** | Michael, Sara (managing media library) |
| **Notes** | Actual image files stored in Vercel Blob; this tab stores metadata only |

---

### Tab 11: `settings`
| Field | Details |
|-------|---------|
| **What it stores** | CMS configuration settings |
| **How data enters** | Admin > Settings panel |
| **Update frequency** | On settings change |
| **Columns** | key, value |
| **Connected to** | Site-wide configuration, SEO settings |
| **Who uses it** | Michael, Sara (admin only) |

---

### Tab 12: `page-views`
| Field | Details |
|-------|---------|
| **What it stores** | Website page view tracking (internal analytics) |
| **How data enters** | Automatically on every page load (via tracking component) |
| **Update frequency** | Real-time |
| **Columns** | id, path, timestamp, referrer |
| **Connected to** | Command Center > Reports, Admin analytics |
| **Who uses it** | Michael (analytics review) |
| **Notes** | Auto-rotates to keep last 10,000 views. Separate from Google Analytics. |

---

### Tab 13: `profile-views`
| Field | Details |
|-------|---------|
| **What it stores** | Individual team member profile page views |
| **How data enters** | Automatically when someone views a /team/[slug] page |
| **Update frequency** | Real-time |
| **Columns** | id, slug, teamMemberName, timestamp, source |
| **Connected to** | Team member analytics, Admin reports |
| **Who uses it** | Michael, individual team members (own stats) |
| **Notes** | Auto-rotates to keep last 10,000 views |

---

## OTHER DATA SOURCES

### Local JSON Files (`data/` directory)

| File | What It Stores | Syncs To | Update Method |
|------|---------------|----------|---------------|
| `inventory.json` | Master inventory list | Google Sheets `Inventory` tab | Portal updates + manual sync |
| `commissions.json` | All commission history (25K+ lines) | Google Sheets `Commissions` tab | Manual sync |
| `documents.json` | Document records | Not synced | API updates |
| `calls.json` | Phone call logs | Not synced | API logging |
| `audit-log.json` | System audit trail | Not synced | Automatic logging |
| `system-config.json` | System settings | Not synced | Admin settings panel |
| `pending-profile-changes.json` | Staged profile edits | N/A | Profile edit workflow |
| `pending-profile-edits.json` | Pending edits | N/A | Profile edit workflow |
| `profile-notifications.json` | Edit notifications | N/A | Profile workflow |
| `profile-overrides.json` | Profile display overrides | N/A | Admin actions |
| `profile-reviews.json` | Profile review queue | N/A | Approval workflow |
| `profile-updates.json` | Profile update history | N/A | Automatic |

### Hardcoded Data Files (`lib/` directory)

| File | What It Stores | Notes |
|------|---------------|-------|
| `lib/teamData.ts` | Team member profiles (30KB+) | Primary source, syncs TO sheets |
| `lib/blogData.ts` | Blog post content (365KB+) | Primary source, syncs TO sheets |
| `lib/inventoryData.ts` | Fallback inventory data | Used if sheets unavailable |
| `lib/inventoryTransactions.ts` | Transaction history | Hardcoded reference |
| `lib/team-roles.ts` | Role definitions & PINs | Auth system, not synced |

---

## EXTERNAL SERVICES

### JobNimbus CRM
| Field | Details |
|-------|---------|
| **What it stores** | Contacts, Jobs, Estimates, Tasks, Invoices |
| **API URL** | `https://app.jobnimbus.com/api1` |
| **How it connects** | API calls from `/api/admin/jobnimbus/*` routes |
| **Sync direction** | Read from JobNimbus → display in portal/admin |
| **Who uses it** | Michael, Sara, Sales Reps |
| **Webhook** | `/api/webhooks/jobnimbus` receives real-time updates |

### Google Apps Script (Email)
| Field | Details |
|-------|---------|
| **What it does** | Sends email notifications for form submissions |
| **Trigger** | Contact form or referral form submission |
| **Sends to** | rcrs@rivercityroofingsolutions.com |
| **Data sent** | Form fields via POST request |

### Vercel Blob Storage
| Field | Details |
|-------|---------|
| **What it stores** | Uploaded files: images, photos, documents |
| **How files get there** | Admin uploads, profile photos, ticket photos, customer uploads |
| **Connected to** | Image Gallery, Team Profiles, Delivery Proof Photos |

### Google Analytics
| Field | Details |
|-------|---------|
| **Tracking ID** | G-Y8PB85BZC5 |
| **What it tracks** | All public website traffic, page views, events |
| **Connected to** | Admin > Settings (ID display), Website layout (tracking script) |
| **Notes** | Respects cookie consent; default is denied until user consents |

---

## DATA FLOW DIAGRAMS

### Lead Flow (New Customer Contact)
```
Customer visits website
    |
    v
Fills out Contact Form (/contact or header form)
    |
    v
POST /api/forms/contact
    |
    +---> Google Sheets "contact-submissions" tab (stored)
    |
    +---> Google Apps Script (email to rcrs@rivercityroofingsolutions.com)
    |
    v
Admin sees new lead in dashboard
    |
    v
Sales rep assigned, follows up
    |
    v
(Manual) Create contact in JobNimbus
    |
    v
Job created in JobNimbus -> tracked through completion
```

### Inventory Flow (Material Order to Delivery)
```
Project Manager creates order (Portal > Orders > New)
    |
    v
POST /api/portal/orders/workflow
    |
    +---> Google Sheets "Orders" tab (order record)
    |
    +---> Inventory quantities updated (Google Sheets "Inventory" + data/inventory.json)
    |
    +---> Google Sheets "InventoryLogs" tab (transaction logged)
    |
    v
Driver sees delivery in Driver Portal
    |
    v
Driver: Load Verified -> En Route -> Arrived -> Delivered
    |
    v
Driver uploads proof photos (Vercel Blob)
    |
    v
Driver captures signature
    |
    v
Delivery marked complete -> Order status updated
```

### Sales/Commission Flow
```
Sales rep closes deal (tracked in JobNimbus)
    |
    v
Commission record added to data/commissions.json
    |
    v
Manual sync: POST /api/sheets/sync
    |
    v
Google Sheets "Commissions" tab updated
    |
    v
Command Center > Sales Leaderboard calculates rankings
    |
    v
Individual rep sees their performance in Sales Portal
```

### Blog Post Flow
```
Admin writes post in Admin > Blog editor
    |
    v
POST /api/cms/blog
    |
    v
Google Sheets "blog-posts" tab (saved)
    |
    v
Published = true -> appears on /blog page
    |
    v
Sitemap.xml regenerated on build
    |
    v
Google indexes new page
```

### Team Profile Edit Flow
```
Team member requests edit via Portal > My Profile
    |
    v
POST /api/profile/submit-edit
    |
    v
data/pending-profile-edits.json (staged)
    |
    v
Admin sees pending edit in Admin > Approvals
    |
    v
Admin approves: POST /api/profile/approve
    |
    v
Google Sheets "team-members-import" tab (updated)
    |
    v
Website /team/[slug] page shows updated info
```

---

## BACKUP RECOMMENDATIONS

### Current State
- **Google Sheets**: No automatic backup (Google provides version history)
- **Local JSON files**: In git repository (backed up on push)
- **Vercel Blob**: No backup system
- **Hardcoded data files**: In git repository

### Recommended Backup Plan
1. **Google Sheets** - Enable Google Takeout scheduled export, or set up Apps Script to copy sheet daily to a backup spreadsheet
2. **data/ directory** - Already in git; ensure regular commits
3. **Vercel Blob** - Set up periodic download of blob contents
4. **Environment variables** - Document in `.env.local.configured` (already done, in gitignore)

---

## SYNC COMMANDS REFERENCE

| Action | How to Trigger | What It Does |
|--------|---------------|--------------|
| Sync all data to Sheets | POST `/api/sheets/sync` | Pushes inventory, team, commissions, customers to Google Sheets |
| Sync inventory only | POST `/api/sheets/sync?syncType=inventory` | Pushes inventory data to Sheets |
| Sync from portal | POST `/api/portal/sync?action=sync&type=inventory` | Portal-triggered inventory sync |
| Setup CMS sheets | GET `/api/cms/setup` | Creates all CMS tabs and imports initial data from hardcoded files |
| Manual page in admin | Visit `/admin/settings` > Data Sync section | UI for triggering syncs |

---

## THINGS TO FILL IN (Michael's Input Needed)

- [ ] **LeadSpeed** - What is it? How does it connect? Add to this glossary.
- [ ] **Review data** - CSV with real review count/data to update SEO schema (currently shows 47)
- [ ] **Job Breakdown format** - Define fields for the new job breakdown form/portal based on examples at `G:\My Drive\...\BREAKDOWNEXAMPLES`
- [ ] **Additional Google Sheets tabs** - Any tabs you've manually created that aren't listed here?
- [ ] **Backup frequency preference** - Daily? Weekly? How many versions to keep?
- [ ] **Which data should be consolidated** vs kept separate?
