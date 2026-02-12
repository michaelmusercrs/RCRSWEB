# QUICK REFERENCE CARD: INSURANCE CLAIMS SPECIALIST
## River City Roofing Solutions Platform

**For:** Bart Roberts (Insurance Claims Specialist)
**Role:** `sales` (insurance focused) -- Claims management, adjuster coordination, storm data, customer CRM
**Last Updated:** February 10, 2026

---

## LOGIN

| Field | Value |
|-------|-------|
| **URL** | https://www.rivercityroofingsolutions.com/portal |
| **Email** | bart@rcrsal.com |
| **PIN Location** | `lib/team-roles.ts` -- TEAM_MEMBERS array |
| **Login Method** | Email + 4-digit PIN |
| **Default Landing** | /portal |

---

## TOP 5 BOOKMARKS

1. **Customer Records** -- /portal/sales/customers -- Full CRM with 6-tab detail view (synced with JobNimbus)
2. **Check My Address** -- /check-my-address -- NWS hail/storm data for any address, risk scores for claims support
3. **Schedule** -- /portal/schedule -- Adjuster meetings, inspection coordination, Google Calendar links
4. **Team Chat** -- /portal/chat -- GroupMe for coordinating with sales reps, office, and leadership
5. **Dashboard** -- /portal/dashboard -- Quick-access tiles: Monday Notes, Chat, Profile, Schedule, Leads

---

## DAILY CHECKLIST

### Morning (8:00 AM)
- [ ] Open /portal/dashboard -- check for new claim assignments or updates
- [ ] Review /portal/sales/customers -- check active claims for status changes
- [ ] Check /portal/schedule -- any adjuster meetings or inspections scheduled today?
- [ ] Prepare documentation packages for today's adjuster meetings
- [ ] Check GroupMe (/portal/chat) for messages from sales reps about new insurance customers

### Claim Work (Throughout Day)
- [ ] Pull storm data from /check-my-address for active claims
- [ ] Upload documents to customer records (adjuster reports, supplement requests, photos)
- [ ] Schedule adjuster meetings via /portal/schedule -> Google Calendar link
- [ ] Share customer portal links with homeowners for claim progress transparency
- [ ] Update customer record Messages tab after every adjuster visit or phone call
- [ ] Coordinate with sales reps on claim progress and next steps

### End of Day (5:00 PM)
- [ ] Update all customer records with today's activity and progress notes
- [ ] Note any pending supplements or appeal deadlines
- [ ] Check GroupMe for team messages
- [ ] Review tomorrow's adjuster meetings and prepare documentation packages

---

## WEEKLY CHECKLIST

- [ ] Review all active claims -- identify any approaching deadlines (appeals, supplements)
- [ ] Follow up on pending supplement requests
- [ ] Check for new customers with insurance involvement (coordinate with reps)
- [ ] Review denied claims -- prepare appeals with additional documentation
- [ ] Update Monday Notes with claim status summary for leadership
- [ ] Review conversion rate on insurance claims (approved vs denied)

---

## KEY SHORTCUTS

| Action | How |
|--------|-----|
| **Look up customer** | /portal/sales/customers -> search by name, address, phone, or email -> 6-tab detail view |
| **Pull storm data** | /check-my-address -> enter address -> view risk score, hail events, wind events, recommendations |
| **Upload document** | Customer record -> Documents tab -> upload PDF, JPG, PNG -> stored on Vercel Blob |
| **Schedule adjuster meeting** | /portal/schedule -> create event -> set date/time/title -> Google Calendar link auto-generated |
| **Share customer portal** | Customer record -> generate portal link -> send to homeowner (they track claim progress without calling) |
| **Message a rep** | /portal/chat -> DM the sales rep about their customer's claim |

---

## COMMON TASKS

| Task | Steps |
|------|-------|
| **Work a new insurance claim** | Open customer in /portal/sales/customers -> review Overview tab (insurance company, policy details) -> pull storm data from /check-my-address -> prepare documentation (inspection photos + estimate + storm report) -> upload all to Documents tab -> schedule adjuster meeting via /portal/schedule |
| **Prepare for adjuster meeting** | Customer record -> Documents tab (gather all photos, estimates, storm data) -> /check-my-address (pull fresh storm report for the address) -> compile documentation package -> add meeting to /portal/schedule with Google Calendar link |
| **File a supplement** | Document additional damage with photos -> prepare supplement request -> upload to customer Documents tab -> update Messages tab with details and timeline -> notify office for billing coordination via GroupMe |
| **Share portal with homeowner** | Customer record -> generate customer portal link -> send to homeowner via text or email -> they can track: job timeline, documents, delivery status, messages (no password needed, unique token URL) |
| **Support a sales rep** | Rep contacts you about potential insurance customer -> pull /check-my-address for the property -> review storm history and risk data -> advise on claim likelihood and strategy -> provide talking points about insurance process |
| **Appeal a denied claim** | Review denial reason in customer record -> gather additional documentation (more photos, detailed storm data, second opinions) -> upload everything to Documents tab -> prepare appeal letter -> schedule re-inspection with adjuster |

---

## CUSTOMER CRM -- 6 TABS

| Tab | What's There | How You Use It |
|-----|-------------|----------------|
| **Overview** | Contact info, address, insurance company, policy details, assigned rep | Verify insurance info, get contact details, see job summary |
| **Active Jobs** | Current projects with status tracking | Track claim-related job progress through completion |
| **Job History** | Past completed work | Reference for repeat customers, prior claim history |
| **Documents** | Contracts, estimates, inspection photos, adjuster reports, claim docs | Upload/download ALL claim documentation -- this is your filing cabinet |
| **Messages** | Full communication log with customer and team | Document every interaction, update, and status change |
| **Transactions** | Payments, insurance payouts, invoicing | Track insurance payments, deductibles, and billing status |

---

## CLAIM WORKFLOW

```
Homeowner reports damage
  -> Sales rep inspects + documents with photos
  -> Check My Address report pulled (storm data, risk score)
  -> Bart assigned to claim
  -> Documentation prepared (photos + storm data + estimate)
  -> Adjuster meeting scheduled (Google Calendar)
  -> Adjuster inspects -> findings documented in customer record
  -> APPROVED -> Job proceeds -> materials ordered -> work completed -> invoice -> payment
  -> PARTIAL -> Supplement prepared -> uploaded -> re-submitted -> negotiate -> resolve
  -> DENIED -> Review denial -> appeal with additional documentation -> schedule re-inspection
  -> Throughout: Customer tracks via portal link, Bart updates status in Messages tab
```

---

## TROUBLESHOOTING

| Problem | Solution |
|---------|----------|
| **Cannot log in** | Verify bart@rcrsal.com and PIN. Clear browser cache. Contact Sara (256-810-3594) or Michael (256-221-4290) for PIN reset. |
| **Customer record not found** | Try different search terms (first name, last name, address, phone). Customer may not be in the system yet -- ask the sales rep to create the lead/customer record first. |
| **Check My Address not returning data** | NWS data may be temporarily unavailable. Try again in a few minutes. Verify the address is complete (street, city, state, ZIP). Must be a valid US address. If area had no recent storms, "Low" risk is correct. |
| **Document upload fails** | Check file size (keep under 10MB). Supported types: PDF, JPG, PNG. Try a different format. Check internet connection. |
| **Customer portal link not working** | Token URLs are unique per customer. Try generating a new link from the customer record. If persistent, contact Michael. Customer accesses via /my/[token]. |
| **JobNimbus data not syncing** | Two-way sync may take a moment. Refresh the page. If data is stale for more than a few minutes, check with Michael about sync status. |
| **Schedule shows conflicting times** | Calendar has conflict detection. Reschedule the lower-priority event. Coordinate with office for priority decisions on shared time slots. |

---

## WHO TO CONTACT

| Person | Role | Phone |
|--------|------|-------|
| Sara Hill | Office Manager (billing, scheduling) | 256-810-3594 |
| Michael Muse | VP / Tech (system issues, data) | 256-221-4290 |
| Chris Muse | President (escalations) | 256-648-1224 |
| Sales Reps | Customer coordination | GroupMe DM or phone |
| Office Main Line | General | 256-274-8530 |

**GroupMe:** @office for billing/scheduling coordination | DM individual reps for their customer claims
**Your insurance expertise combined with Check My Address data makes every claim stronger.**

---

*RCRS Platform -- 367 pages, 180+ API routes, 85+ components*
*Office: 256-274-8530 | rcrs@rivercityroofingsolutions.com*
