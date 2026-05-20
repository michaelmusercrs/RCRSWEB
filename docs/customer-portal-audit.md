# Customer Portal Audit

**Audit date:** 2026-05-20
**Auditor:** Claude (Opus 4.7, 1M context)
**Scope:** Public-facing customer portal at `/customer` + `/customer/dashboard` (the homeowner-facing portal — not the internal `/portal/customers` admin list).
**Memory references:** `[[project_customer_portal_finish]]` — service request, warranty claim, notification prefs Sheets-backed.

---

## Topology

There is **no** `app/(portal)/` route group. The actual customer-facing portal lives at:

- `app/(tools)/customer/page.tsx:1` — login screen (email / phone / access code)
- `app/(tools)/customer/dashboard/page.tsx:1` — authenticated dashboard with tabs (Status, Rep, Documents, Upload, Appointments, Weather, Messages, Support)
- `app/(tools)/my/[token]/page.tsx:1` — direct token-link entry (homeowner gets URL via email/SMS)
- `app/(site)/view/[token]/page.tsx:1` — public read-only customer view by token
- `app/api/customer/**` — 18+ API routes powering the above

There is also a separate **public read-only token portal** at `app/api/public/customer-portal/[token]/route.ts:1`.

The `/portal/customers` page under `(tools)` is the INTERNAL admin customer list (used by reps), NOT the customer portal.

---

## Feature-by-feature status

Ranked roughly by impact / surface area. Status legend: **DONE** = wired end-to-end with persistence; **PARTIAL** = UI + API present but persistence is stubbed; **STUB** = handler returns success without writing anything durable; **MISSING** = no UI or API yet.

### 1. Project status view + photos — DONE (mostly)

- **UI:** `app/(tools)/customer/dashboard/page.tsx:594-808` (Status tab, JOB_PHASES timeline, Next-Steps card, reminder buttons → Google Calendar URLs)
- **Source of truth:** `/api/customer/dashboard?customerId=...` (`app/api/customer/dashboard/route.ts`) fetches JobNimbus state via the lead-portal service.
- **Photos:** Documents tab (`app/(tools)/customer/dashboard/page.tsx:1525-1709`) renders job photos via `/api/documents?action=customer-documents` (separate doc service).
- **Gaps:**
  - Hard-coded ZIP fallback `35640` in `app/(tools)/customer/page.tsx:276` (Hartselle) for weather/hail when address parse fails — acceptable.
  - No customer-side ability to add photos to specific phases (general "Upload" tab is a flat dump).
  - "Estimated completion" date is only displayed when JobNimbus returns one; otherwise the field disappears (correct behavior).

### 2. Documents (view + download) — DONE

- **UI:** `app/(tools)/customer/dashboard/page.tsx:1525-1709` (categorized: photos, invoices, contracts, warranties, inspections, insurance)
- **API:** `/api/documents?action=customer-documents&customerId=...`
- **Persistence:** Backed by the documents service (Vercel Blob + Sheets `Documents` tab per memory).
- **Logging:** Every view and download logs to `/api/customer/portal-log` → Google Sheets (`app/(tools)/customer/dashboard/page.tsx:1641-1656` and `:1664-1683`).
- **Gaps:** None functional. Minor polish — `repNotes` displays as static text; no acknowledgment button.

### 3. Document / photo upload by customer — DONE

- **UI:** Upload tab (`app/(tools)/customer/dashboard/page.tsx:1711-1822`).
- **API:** `/api/customer/upload` (general) and `/api/customer/[token]/upload` (token-scoped) — see `app/api/customer/[token]/upload/route.ts:1`.
- **Persistence:** Vercel Blob storage.
- **Gap:** Uploaded-files list (`uploadFiles` state, `app/(tools)/customer/dashboard/page.tsx:1783-1808`) is **session-only** — refresh wipes it. Files DO persist on the server; the customer just can't see their own past uploads listed back. Wire `uploadFiles` to GET `/api/customer/[token]/uploads` (does not exist yet).

### 4. Appointments — DONE

- **UI:** Appointments tab (`app/(tools)/customer/dashboard/page.tsx:1057-1190`) with ScheduleInspection form (`components/calendar/ScheduleInspection`).
- **API:** `/api/calendar/events?customerId=...` (TeamUp) + JobNimbus appointments merged in `loadDashboardData()`.
- **Google Calendar add-to-calendar:** Working URLs built per appointment.
- **Gap:** "Reschedule" button just dials the office (`app/(tools)/customer/dashboard/page.tsx:1093-1094`). Reschedule self-service would be a nice-to-have, not blocking.

### 5. Messages (customer ↔ rep) — DONE

- **UI:** `app/(tools)/customer/dashboard/page.tsx:1461-1523` and the v1 dashboard at `app/(tools)/customer/page.tsx:1104-1260`.
- **API:** POST `/api/customer/messages`, POST `/api/customer/[token]` for token-scoped.
- **Persistence:** Sheets (per memory). `portal_log` audit fires on send.
- **Gap:** No realtime delivery; customer must refresh to see rep replies. (Out of scope for portal-finish; chat polling would solve.)

### 6. Weather + hail + storm risk — DONE

- **UI:** Weather tab (`app/(tools)/customer/dashboard/page.tsx:1192-1458`); current conditions, 7-day forecast with workability flags, alerts, storm-risk banner, hail reports.
- **API:** Aggregated by `/api/customer/dashboard`.
- **Gap:** None — most polished feature in the portal.

### 7. Sales rep "My Rep" view — DONE

- **UI:** Rep tab (`app/(tools)/customer/dashboard/page.tsx:810-1037`): photo, position, rating, contact buttons, bio, truck image, reviews list, social links, portal QR code.
- **Gap:** Review list here is read-only; no path for the customer to submit a review of their own rep from this tab. Component `components/customer-portal/ReviewSubmission.tsx` exists but is **not** mounted in the dashboard. **Wiring blocker: 1 file, 5 minutes.**

### 8. Service request submission — PARTIAL → effectively STUB

- **UI:** Support tab → `ServiceRequestForm` (`components/customer-portal/ServiceRequestForm.tsx`) — mounted at `app/(tools)/customer/dashboard/page.tsx:1858-1860`.
- **API:** `app/api/customer/service-request/route.ts:55-120`
- **Persistence:** **NOT persisted.** Line 103-104:
  ```
  // TODO: persist serviceRequest once leadPortalService has createServiceRequest.
  console.log('[service-request] received (not persisted):', serviceRequest.id);
  ```
  The record is built in memory, an ID is generated, and the route returns `success: true` — but nothing is written to Sheets or to any database.
- **Blocker:** `leadPortalService` lacks `createServiceRequest` / `getServiceRequestsByCustomer`. Add a `ServiceRequests` tab to the master sheet (recommended headers below) and wire it up via `googleSheetsService.appendGenericRow` + `getGenericRows`.

  **Suggested columns for `ServiceRequests` tab:**
  `id, customerId, customerName, customerAddress, customerPhone, customerEmail, repSlug, repName, type, description, preferredDate, urgency, photos, status, assignedTo, scheduledDate, resolution, createdAt, updatedAt`

### 9. Warranty claim submission — PARTIAL (in-memory durable, Sheets stub)

- **UI:** Support tab → `WarrantyClaimForm` (mounted `app/(tools)/customer/dashboard/page.tsx:1875`).
- **API:** `app/api/customer/warranty-claim/route.ts:59-167`
- **Persistence:**
  - `warrantyService.submitClaim()` writes to in-memory / local copy at line 113 → **survives in-process but not across container restarts**.
  - The Sheets row construction at line 127-146 is built and then **discarded** (line 148-150):
    ```
    // TODO: persist sheetClaim once leadPortalService has createWarrantyClaim.
    console.log('[warranty-claim] received (not persisted to Sheets):', sheetClaim.id);
    ```
- **Blocker:** Add a `WarrantyClaims` tab to the master sheet and wire `appendGenericRow` / `getGenericRows`. Schema is already laid out in `WarrantyClaimRecord` (lines 8-29).

  **Suggested columns for `WarrantyClaims` tab:**
  `id, warrantyId, customerId, customerName, customerAddress, customerPhone, customerEmail, repSlug, repName, jobId, category, severity, issueDescription, photos, status, resolution, repairDate, coveredByWarranty, createdAt, updatedAt`

### 10. Notification preferences (email opt-in/out per type) — STUB

- **UI:** Support tab → `NotificationPreferences` component (`components/customer-portal/NotificationPreferences.tsx`) — mounted `app/(tools)/customer/dashboard/page.tsx:1891`.
- **API:** `app/api/customer/notification-preferences/route.ts`
  - GET returns the **hard-coded `DEFAULT_PREFERENCES`** (line 7-12, 44-51) regardless of the customer.
  - PUT echoes back the submitted prefs but **does not persist** (line 84-87):
    ```
    // TODO: persist updatedPrefs once leadPortalService has upsertNotificationPrefs.
    ```
- **Net effect:** Customer toggles a switch, sees "Saved" — but next time they load the portal they see defaults again. The dashboard ignores the saved value when deciding whether to send notifications.
- **Blocker:** Add a `NotificationPrefs` tab to the master sheet keyed by `customerId`, and have `/api/notifications/send-portal` consult it before sending. Recommend `upsertGenericRow` for idempotent writes.

  **Suggested columns for `NotificationPrefs` tab:**
  `customerId, emailNotifications, smsNotifications, weatherAlerts, statusUpdates, updatedAt`

### 11. Insurance claim coordination — MISSING (passive only)

- Insurance documents *appear* in the Documents tab when uploaded by a rep (category `insurance_document`, `claim_documentation`, `adjuster_report`, `approval_letter`).
- The customer **cannot**:
  - View claim status timeline
  - See current adjuster contact info
  - See claim number / policy number prominently
  - Submit additional insurance docs tagged to the claim
- **Workaround:** Documents Upload tab covers ad-hoc paperwork.
- **Effort to add:** Medium — would need a `InsuranceClaims` tab + new dashboard sub-tab.

### 12. Estimate / contract review (with e-sign or accept) — MISSING

- **What works:** Estimates and signed contracts appear in Documents as PDFs the customer can view/download.
- **What's missing:**
  - No "Accept Estimate" button in the customer portal.
  - No e-sign flow.
  - No version history (if the rep replaces a contract PDF, no audit trail visible to the customer).
- **Effort:** Large — likely needs HelloSign / Dropbox Sign integration. Out of scope for current portal-finish.

### 13. Payment status — MISSING (large gap)

- The internal `/portal/billing` page (`app/(tools)/portal/billing/page.tsx`) has rich invoice tracking, but **the customer dashboard has no Billing tab** at all.
- Invoices appear in Documents (as PDFs) but the customer cannot see:
  - Balance owed
  - Payments received
  - Payment due dates
  - Direct pay-online link (Bitcoin payment route exists at `app/api/customer/bitcoin-payment/route.ts` but isn't surfaced)
- **Effort to add:** Medium. Add a Billing tab + `/api/customer/billing` endpoint that summarizes from QB / Sheets, plus a "Pay Now" CTA.

### 14. Audit logging — DONE (excellent coverage)

- `app/api/customer/portal-log/route.ts` is called from every notable action (page open, document view, document download, message send, etc.). Logs flow to Sheets and provide the portal-engagement signal feeding the rep dashboard.

---

## Priority list to finish the customer portal

Ordered by **impact** for the homeowner experience.

| # | Item                                         | Status      | Effort  | Blocker |
|---|----------------------------------------------|-------------|---------|---------|
| 1 | Persist service requests to Sheets           | STUB        | Small   | Add `createServiceRequest`/`getServiceRequestsByCustomer` on `leadPortalService` (or call `googleSheetsService.appendGenericRow` directly). |
| 2 | Persist warranty claims to Sheets            | PARTIAL     | Small   | Same — `createWarrantyClaim`/`getWarrantyClaimsByCustomer`. |
| 3 | Persist notification preferences to Sheets   | STUB        | Small   | Same — `upsertNotificationPrefs`/`getNotificationPrefs`, plus consult them in `/api/notifications/send-portal`. |
| 4 | Wire ReviewSubmission into the Rep tab       | UNMOUNTED   | Trivial | Component exists; just mount it. |
| 5 | Show customer's own past uploads list        | PARTIAL     | Small   | Add GET `/api/customer/[token]/uploads`. |
| 6 | Customer Billing tab + Pay-Now CTA           | MISSING     | Medium  | Need `/api/customer/billing` aggregator. |
| 7 | Insurance Claim sub-tab                      | MISSING     | Medium  | Needs InsuranceClaims tab + form. |
| 8 | Accept Estimate / Sign Contract              | MISSING     | Large   | Third-party integration. |
| 9 | Reschedule self-service                      | MISSING     | Small   | Already calls TeamUp; just need PATCH. |

---

## Files referenced (absolute paths)

- `C:/Users/Michael/river-city-roofing/app/(tools)/customer/page.tsx`
- `C:/Users/Michael/river-city-roofing/app/(tools)/customer/dashboard/page.tsx`
- `C:/Users/Michael/river-city-roofing/app/api/customer/service-request/route.ts`
- `C:/Users/Michael/river-city-roofing/app/api/customer/warranty-claim/route.ts`
- `C:/Users/Michael/river-city-roofing/app/api/customer/notification-preferences/route.ts`
- `C:/Users/Michael/river-city-roofing/app/api/customer/dashboard/route.ts`
- `C:/Users/Michael/river-city-roofing/app/api/customer/portal-log/route.ts`
- `C:/Users/Michael/river-city-roofing/components/customer-portal/ServiceRequestForm.tsx`
- `C:/Users/Michael/river-city-roofing/components/customer-portal/WarrantyClaimForm.tsx`
- `C:/Users/Michael/river-city-roofing/components/customer-portal/NotificationPreferences.tsx`
- `C:/Users/Michael/river-city-roofing/components/customer-portal/ReviewSubmission.tsx` *(exists, not mounted)*
- `C:/Users/Michael/river-city-roofing/lib/lead-portal-service.ts`
- `C:/Users/Michael/river-city-roofing/lib/warranty-service.ts`
- `C:/Users/Michael/river-city-roofing/lib/google-sheets-service.ts` (`appendGenericRow`, `upsertGenericRow`, `getGenericRows` at lines 3415-3569)
