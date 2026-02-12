# QUICK REFERENCE CARD: PRODUCTION MANAGER
## River City Roofing Solutions Platform

**For:** John Cordonis (Production Manager)
**Role:** `project_manager` -- Material ordering, crew scheduling, delivery coordination, quality control
**Last Updated:** February 10, 2026

---

## LOGIN

| Field | Value |
|-------|-------|
| **URL** | https://www.rivercityroofingsolutions.com/portal |
| **Email** | john@rcrsal.com |
| **PIN Location** | `lib/team-roles.ts` -- TEAM_MEMBERS array |
| **Login Method** | Email + 4-digit PIN |
| **Default Landing** | /portal |

---

## TOP 5 BOOKMARKS

1. **PM Order Portal** -- /portal/pm -- Create material orders (auto-generates delivery tickets)
2. **Schedule** -- /portal/schedule -- Day/week/month calendar, job dates, delivery dates
3. **Inventory** -- /portal/inventory -- Stock levels for all 11 products, low stock alerts
4. **Team Chat** -- /portal/chat -- GroupMe for real-time coordination with office, driver, crews
5. **Dashboard** -- /portal/dashboard -- Quick-access tiles: Monday Notes, Chat, Orders, Schedule, Leads

---

## DAILY CHECKLIST

### Morning (6:30-7:00 AM)
- [ ] Open /portal/dashboard -- check schedule tile: what jobs are today? Where? When do crews arrive?
- [ ] Review material order status -- any deliveries today? Check: Confirmed? Loaded? In Transit?
- [ ] Check /portal/inventory -- enough materials for today AND tomorrow?
- [ ] Check GroupMe (/portal/chat) for overnight crew messages
- [ ] Review Monday Notes -- weekly priorities from leadership

### Job Day (Throughout Day)
- [ ] Verify materials arrived at job site (delivery status should show "Delivered")
- [ ] If materials short or wrong -- create URGENT order immediately via /portal/pm + GroupMe @office
- [ ] Monitor delivery ETA for in-transit orders -- coordinate crew timing
- [ ] Update job status as work progresses (milestones: tear-off, install, cleanup)
- [ ] Report quality issues or material defects with photos in GroupMe

### End of Day (4:00-5:00 PM)
- [ ] Update status on completed jobs -- mark as complete
- [ ] Create material orders for jobs coming up in 2-3 days
- [ ] Check inventory -- flag anything running low to office
- [ ] Report issues in GroupMe (material quality, crew notes, customer feedback)

---

## WEEKLY CHECKLIST

- [ ] Review full week schedule -- identify all upcoming installations
- [ ] Submit material orders for all jobs 2-3 business days out
- [ ] Check inventory across all 11 products -- flag restock needs to office
- [ ] Verify delivery dates align with day BEFORE each installation
- [ ] Review Monday Notes and attend Monday meeting
- [ ] Coordinate with Tae on material availability for upcoming jobs

---

## KEY SHORTCUTS

| Action | How |
|--------|-----|
| **Create material order** | /portal/pm -> fill job info, customer, delivery details, materials -> Submit |
| **Check inventory** | /portal/inventory -> scan all 11 products, note low stock alerts (red/warning) |
| **Track a delivery** | Dashboard or delivery tracking -> status flow: Submitted -> Confirmed -> Loaded -> In Transit -> Delivered |
| **Submit urgent order** | /portal/pm -> Priority: URGENT -> Instructions: "SAME DAY - crew waiting at [address]" -> also GroupMe @office |
| **View/switch calendar** | /portal/schedule -> toggle between day/week/month views |
| **Submit a lead** | Dashboard -> New Lead tile -> enter info for neighbor or customer who asked about work |

---

## COMMON TASKS

| Task | Steps |
|------|-------|
| **Order materials for a job** | /portal/pm -> Job name + address -> Customer contact -> Delivery date (day BEFORE install) + time + priority -> Special instructions (gate codes, stacking location) -> Select all materials with quantities from 11-product grid -> Review running total -> Submit |
| **Handle missing materials on site** | Create URGENT order in /portal/pm -> set priority to URGENT -> instructions: "SAME DAY - crew waiting on site at [address]" -> also post in GroupMe: "@office URGENT order submitted - crew waiting" |
| **Check if stock covers a job** | /portal/inventory -> note quantities for each needed item -> compare against your job scope -> if low, order early or flag to office |
| **Coordinate delivery with installation** | /portal/schedule -> verify delivery is scheduled for day BEFORE installation -> flag conflicts to office via GroupMe or DM |
| **Report quality issue** | Take photos with phone -> post in GroupMe: "@office Quality issue at [address] - [description]" -> if work blocked, create URGENT order for replacement material |
| **View delivery ETA** | Check delivery tracking in portal -> when driver is In Transit, system shows ETA -> communicate timing to crew lead |

---

## ORDER PRIORITY GUIDE

| Priority | Lead Time | When to Use |
|----------|-----------|-------------|
| **Normal** | 2-3 business days | Standard job prep, materials needed for next week |
| **Rush** | Next business day | Job coming up sooner than expected, schedule change |
| **Urgent** | Same day | Crew waiting on site, missing/damaged materials discovered |

---

## TROUBLESHOOTING

| Problem | Solution |
|---------|----------|
| **Cannot log in** | Verify john@rcrsal.com and PIN. Clear browser cache. Contact Sara (256-810-3594) or Michael (256-221-4290) for PIN reset. |
| **Order won't submit** | Check all required fields are filled (job name, address, at least one material selected). Dates must be in the future. Refresh and retry. |
| **Delivery ticket not created after order** | After submitting, check delivery tracking. If missing, refresh the page. Contact office if still not visible. |
| **Inventory levels look wrong** | Stock updates may take a moment after delivery. Refresh the page. If persistent, ask office to verify the Google Sheets Inventory tab. |
| **Schedule not showing events** | Verify Google Calendar sync is connected (/portal/schedule -> Settings -> Connect Google Calendar). Try switching between day/week/month views. |
| **Portal not loading on phone** | Check internet connection. Close and reopen browser. Bookmark key URLs on your home screen for one-tap access. |

---

## WHO TO CONTACT

| Person | Role | Phone |
|--------|------|-------|
| Sara Hill | Office Manager (orders, scheduling) | 256-810-3594 |
| Richard Geahr | Driver (delivery coordination) | GroupMe DM |
| Tae Orr | Materials Manager (stock questions) | 256-200-3467 |
| Michael Muse | VP / Tech (system issues) | 256-221-4290 |
| Chris Muse | President | 256-648-1224 |
| Office Main Line | General | 256-274-8530 |

**GroupMe:** @office for order/scheduling issues | @richard for delivery coordination | @tae for stock questions

---

*RCRS Platform -- 367 pages, 180+ API routes, 85+ components*
*Office: 256-274-8530 | rcrs@rivercityroofingsolutions.com*
