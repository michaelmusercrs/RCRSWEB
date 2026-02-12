# QUICK REFERENCE CARD: SALES REP
## River City Roofing Solutions Platform

**For:** Brendon, Greg, Travis, Hunter, Aaron, Rick, Rudy, Adam (Sales Inspectors & Regional Partners)
**Role:** `sales` -- Lead management, inspections, quotes, customer CRM
**Last Updated:** February 10, 2026

---

## LOGIN

| Field | Value |
|-------|-------|
| **URL** | https://www.rivercityroofingsolutions.com/portal |
| **Email** | yourname@rcrsal.com |
| **PIN Location** | `lib/team-roles.ts` -- TEAM_MEMBERS array |
| **Login Method** | Email + 4-digit PIN |
| **Default Landing** | /portal/sales |

---

## TOP 5 BOOKMARKS

1. **Sales Dashboard** -- /portal/sales -- Commission progress, quick stats, priority leads, today's inspections
2. **My Leads** -- /portal/sales/leads -- All assigned leads with status filters and search
3. **Check My Address** -- /check-my-address -- Hail/storm risk reports for door-knocking and lead generation
4. **Performance** -- /portal/sales/performance -- Personal KPIs, conversion rate, leaderboard position
5. **Team Chat** -- /portal/chat -- GroupMe team channel, DMs, @mentions

---

## DAILY CHECKLIST

### Morning (Before Heading Out)
- [ ] Open /portal/sales -- check dashboard quick stats and commission progress bar
- [ ] Check **Priority Leads** -- who needs a call TODAY? (Urgent and High first)
- [ ] Check **Today's Inspections** -- where are you going? Tap Map for directions
- [ ] Scan **Recent Activity** -- any new leads assigned overnight?
- [ ] Check GroupMe (/portal/chat) for team messages

### On the Road (Throughout Day)
- [ ] Use **Quick Call** button to dial leads between stops
- [ ] Update lead status after each contact (New -> Contacted -> Scheduled -> Inspected -> Quoted)
- [ ] Use **Check My Address** at doors -- show homeowners their hail risk report
- [ ] After each inspection: upload photos + update status + share Customer Portal link
- [ ] Schedule next appointment via **Schedule** button -> Google Calendar link

### End of Day (5:00 PM)
- [ ] Check /portal/sales/performance -- how did today go?
- [ ] Update all remaining lead statuses to current
- [ ] Review tomorrow's inspections on /portal/schedule
- [ ] Check commission tracker -- any pending deals close?
- [ ] Check GroupMe for end-of-day messages

---

## WEEKLY CHECKLIST

- [ ] Check leaderboard ranking on /portal/sales/performance -- moving up or down?
- [ ] Review conversion rate -- are you closing enough?
- [ ] Check commission trends -- on track for the month?
- [ ] Review lead sources -- where are your best leads coming from?
- [ ] Update lead preferences (territory, notification frequency) if needed

---

## KEY SHORTCUTS

| Action | How |
|--------|-----|
| **Quick Call** | Tap Quick Call button on dashboard -- opens priority contact list, tap to dial |
| **Schedule Inspection** | Tap Schedule -> pick date/time -> Google Calendar link auto-created |
| **Upload Photo** | Tap Upload Photo button -> snap and upload inspection photos |
| **Send Quote** | Tap Send Quote from dashboard or lead detail page |
| **Share Customer Portal** | From lead/CRM detail -> "Send Portal Link" -> customer gets unique tracking URL |
| **Navigate to Inspection** | Today's Inspections -> tap Map button -> Google Maps opens with directions |

---

## COMMON TASKS

| Task | Steps |
|------|-------|
| **Move a lead through the pipeline** | /portal/sales/leads -> tap lead -> update status dropdown (New / Contacted / Scheduled / Inspected / Quoted / Won / Lost) -> save |
| **Look up a customer (CRM)** | /portal/sales/customers -> search by name or address -> 6-tab detail view (Overview, Active Jobs, History, Documents, Messages, Transactions) |
| **Generate a storm report at a door** | /check-my-address on your phone -> enter homeowner address -> show them risk score, hail events, recommendations -> if interested, capture their contact info to auto-create a lead |
| **Share customer portal with homeowner** | Customer detail -> generate portal link -> send to customer -> they track job timeline, docs, deliveries, weather (no password needed) |
| **Schedule an inspection from a lead** | Lead detail -> tap Schedule -> pick date/time -> Google Calendar link created -> share with homeowner |
| **Check your performance** | /portal/sales/performance -> view revenue, conversion rate, avg deal size, leaderboard position, commission trends |
| **Send a team message** | /portal/chat -> post in main channel or DM individual -> use @mention for urgent items |

---

## TROUBLESHOOTING

| Problem | Solution |
|---------|----------|
| **Cannot log in** | Verify your @rcrsal.com email and PIN. Try clearing browser cache. Contact Sara (256-810-3594) or Michael (256-221-4290) for PIN reset. |
| **No leads showing** | Check status filters on /portal/sales/leads -- make sure "All" is selected. If still empty, contact office -- you may need to be toggled "available" in lead distribution (/portal/admin/lead-distro). |
| **Check My Address not loading** | Verify internet connection. Try refreshing the page. NWS data may be temporarily unavailable -- try again in a few minutes. Must be a valid US address with street, city, state. |
| **Photos not uploading** | Check camera permissions in your phone browser settings. Check internet connection. Try a smaller image. If still failing, take photos with regular camera app and notify office. |
| **Leaderboard not updating** | Stats sync from Google Sheets and JobNimbus. Updates may take a few minutes. If numbers seem wrong, ask the office to verify Sheets data. |
| **Portal shows blank page** | Hard refresh (Ctrl+Shift+R on desktop, pull-to-refresh on mobile). Try closing and reopening the browser. Check internet connection. |

---

## WHO TO CONTACT

| Person | Role | Phone |
|--------|------|-------|
| Sara Hill | Office Manager / Admin | 256-810-3594 |
| Michael Muse | VP / Tech | 256-221-4290 |
| Chris Muse | President | 256-648-1224 |
| Bart Roberts | Insurance Claims Specialist | 256-654-0747 |
| Office Main Line | General | 256-274-8530 |

**GroupMe:** @office for urgent requests | @sara for admin help | @bart for insurance questions

---

*RCRS Platform -- 367 pages, 180+ API routes, 85+ components*
*Office: 256-274-8530 | rcrs@rivercityroofingsolutions.com*
