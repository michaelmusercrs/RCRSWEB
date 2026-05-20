# Email Service Callsite Audit

**Date:** 2026-05-20
**Scope:** Every callsite of `emailService.send()` and the convenience wrappers (`sendPortalLink`, `sendLeadAssignment`, `sendDeliveryOrder`, `sendOfficeMaterialOrderNotification`, `sendLoadVerifiedInvoice`, `sendDriverMaterialOrderNotification`, `sendVendorReturnNotification`, `sendDeliveryReminderEmail`) in `C:\Users\Michael\river-city-roofing\`.
**Read-only audit. No code modified.**

**Background:** `emailService.send()` is hard-disabled as of commit `7787779` (lib/email-service.ts line 96-120). The legacy Google Apps Script transport amplifies every payload to `rivercityroofingsolutions@gmail.com` as a malformed "NEW CONTACT FORM SUBMISSION." When we re-enable with a new transport (Resend / nodemailer-SMTP / direct Gmail API), every callsite below must be reviewed against current intent.

---

## Summary Tables

### Count by template / wrapper

| Template / Wrapper                                | Count |
|---------------------------------------------------|------:|
| `emailService.send` (ad-hoc HTML)                 |    20 |
| `sendDeliveryReminderEmail`                       |     1 |
| `sendDriverMaterialOrderNotification`             |     1 |
| `sendLoadVerifiedInvoice`                         |     1 |
| `sendDeliveryOrder`                               |     1 |
| `sendVendorReturnNotification`                    |     1 |
| `sendOfficeMaterialOrderNotification`             |     0 (defined, never called) |
| `sendPortalLink`                                  |     0 (defined, never called) |
| `sendLeadAssignment`                              |     0 (defined, never called) |
| **TOTAL active callsites**                        |    **25** |

### Count by trigger type

| Trigger type                          | Count |
|---------------------------------------|------:|
| HTTP POST (user/admin action)         |    13 |
| HTTP GET cron (vercel.json scheduled) |     2 |
| HTTP GET cron (drafted, NOT scheduled)|     2 |
| Webhook (JobNimbus / email-forwarder) |     3 |
| Service-layer fire-and-forget         |     5 |

### Count by recipient kind

| Recipient kind                                          | Count |
|---------------------------------------------------------|------:|
| Owner gmail / Michael personal (`michaelmuse@rcrsal.com`) |     7 |
| Office hardcoded list (Sara, Tia, Destin, etc.)         |     6 |
| Sales rep (variable per call)                           |     2 |
| Driver (Rick or stock@ fallback)                        |     2 |
| Stock inbox (`stock@rcrsal.com`)                        |     3 |
| Customer (variable)                                     |     5 |
| External company address (`rcrs@rivercityroofingsolutions.com`) |     1 |
| Admin/office/owner role-resolved (dynamic)              |     3 |

(Some callsites have multiple recipients; counts overlap.)

---

## Callsite Detail

### 1. `app\api\auth\login\route.ts:100`

| | |
|---|---|
| Function | `POST /api/auth/login` (anonymous handler) |
| Trigger | HTTP POST when any team member logs into the portal |
| Recipient | **Hardcoded** `michaelmuse@rcrsal.com` (skipped if Michael himself is logging in) |
| Subject | `Portal Login: ${member.name}` |
| Template | Ad-hoc HTML inline (login alert table: role, email, time, IP) |
| Cost data? | No |
| **Verdict** | **SHIP** — owner asked for login visibility; this is the cleanest signal of who-is-using-the-portal. Caps are already tight on the owner gmail (5/hr, 30/day). Low volume by nature (only successful staff logins). |

---

### 2. `lib\delivery-reminder-service.ts:390`

| | |
|---|---|
| Function | `processReminder` (delivery reminder dispatcher) |
| Trigger | Service-layer call when a scheduled delivery reminder fires for a customer with an email contact. Reminders are queued by `scheduleDeliveryReminder` and processed by the worker loop. |
| Recipient | **Variable** — `reminder.recipientContact` (the customer's email pulled from the ticket / lead record at schedule-time) |
| Subject | `Delivery Scheduled - River City Roofing` (in wrapper) |
| Template | `sendDeliveryReminderEmail` wrapper |
| Cost data? | No (delivery date + address only) |
| **Verdict** | **SHIP** — legitimate customer-facing reminder. Wrapper signature is correct. One bug worth noting: `address: ''` is passed empty (line 394) with a TODO comment. **FIX-TEMPLATE secondary fix**: populate address from ticket before re-enable. |

---

### 3. `lib\form-service.ts:266`

| | |
|---|---|
| Function | `FormService.sendEmailNotification` |
| Trigger | Every public contact-form / referral-form submission (`POST /api/contact` chain via `formService.submitContactForm`) |
| Recipient | **Hardcoded** module constant `COMPANY_EMAIL = 'rcrs@rivercityroofingsolutions.com'` (lib/form-service.ts:7). The gmail BCC was removed 2026-05-20 as part of the flood mitigation. |
| Subject | `New Contact Form: ${subject} - ${name}` or `New Referral: ${referralName} (from ${referrerName})` |
| Template | Ad-hoc HTML (contact form table or referral form table) |
| Cost data? | No |
| **Verdict** | **SHIP** — single recipient is the legit company-wide inbox. Source-of-truth bot-attack channel was the parallel GAS POST (lines 210-212 in the same file), which is already commented out. Per-recipient cap protects it going forward. |

---

### 4. `lib\customer-breakdown-service.ts:821`

| | |
|---|---|
| Function | `syncReturnToBreakdown` |
| Trigger | Service-layer call when a return ticket transitions to "received" and a material credit is posted to the job breakdown (called from the return-receipt code path) |
| Recipient | **Hardcoded** `to: 'stock@rcrsal.com', cc: 'sara@rcrsal.com'` |
| Subject | `Return credited to breakdown: ${rNumber} - $${creditAmount.toFixed(2)}` |
| Template | Ad-hoc HTML (table with Return Ticket, R-Number, Breakdown ID, Customer, Distributor, Credit Amount + Items Returned list with `unitCost`) |
| Cost data? | **YES — leaks unitCost and credit dollar amount in body** (lines 816-818 + 824) |
| **Verdict** | **FIX-TEMPLATE** — stock@rcrsal.com is the right inventory inbox (per `project_rcrs_stock_workflow` memory), and Sara is allowed cost per `feedback_purchase_price_visibility`. So recipients are fine. But verify no rep or PM gets auto-forwarded from stock@ before re-enable; if they do, strip the `@ $X` and credit `$Y` figures from the items list, leaving qty + name only. |

---

### 5. `app\api\webhooks\material-order-email\route.ts:228`

| | |
|---|---|
| Function | `POST /api/webhooks/material-order-email` (Gmail-forwarder webhook) |
| Trigger | Apps Script forwards every email landing in `stock@rcrsal.com` to this endpoint with `X-Webhook-Secret`. Webhook parses the body and creates a ticket. |
| Recipient | **Variable with hardcoded default** — `data.driverEmail || process.env.DRIVER_NOTIFY_EMAIL || 'rick@RiverCityRoofingSolutions.com'` (from the wrapper, line 522 of email-service.ts). This call passes no `driverEmail` so it falls through to env or hardcoded Rick. |
| Subject | `New Delivery: ${jobNumber} — ${customerName}` (wrapper) |
| Template | `sendDriverMaterialOrderNotification` wrapper |
| Cost data? | No (wrapper signature explicitly omits cost — driver view) |
| **Verdict** | **SHIP** — exactly the intended flow per `project_rcrs_stock_workflow`. JN → email PDF to stock@ → parser → driver notified. Recipient fallback to Rick matches the project rule. |

---

### 6. `app\api\webhooks\jobnimbus\route.ts:224`

| | |
|---|---|
| Function | `POST /api/webhooks/jobnimbus` (`job.created` / `job.updated` case) |
| Trigger | JobNimbus webhook fires when a job status transitions to "approved" or "contract signed" |
| Recipient | **Hardcoded** `michaelmuse@rcrsal.com` |
| Subject | `Job ${jobStatus}: ${customerName} — ${jobName || jobId}` |
| Template | Ad-hoc HTML (Customer / Job / Status / Rep / Address table) |
| Cost data? | No |
| **Verdict** | **SHIP** — owner wants to see every approved/signed job in real time. Pairs with the auto-breakdown-create on the same trigger. Low volume. |

---

### 7. `app\api\webhooks\jobnimbus\route.ts:577`

| | |
|---|---|
| Function | `handleDepositWebhook` (in same JN webhook file) |
| Trigger | JobNimbus webhook for a customer deposit event (auto-creates a draft job breakdown) |
| Recipient | **Hardcoded** `stock@rcrsal.com` |
| Subject | `New breakdown draft: ${rNumber} - ${customerName}` |
| Template | Ad-hoc HTML (R-Number / Customer / Address / Sales Rep / Breakdown ID table) |
| Cost data? | No |
| **Verdict** | **FIX-RECIPIENT** — `stock@rcrsal.com` is for **inventory/stock/material-order emails only** per `project_rcrs_stock_workflow` ("must never be used for anything else"). Breakdown drafts are an office/admin concern, not a stock concern. Change recipient to office (Sara / Tia) before re-enable. |

---

### 8. `lib\load-verified-aftermath.ts:170`

| | |
|---|---|
| Function | `runLoadVerifiedAftermath` |
| Trigger | Called from `POST /api/portal/tickets` when a ticket transitions to `load_verified`, and from `POST /api/admin/stock-backfill` for historical backfill (silent mode skips email) |
| Recipient | **Variable with hardcoded default** — falls back to `process.env.OFFICE_NOTIFY_EMAIL || 'rcrs@rcrsal.com'` (wrapper, line 433 of email-service.ts) |
| Subject | `Invoice ${invoiceId}: ${jobNumber} — ${customerName}` |
| Template | `sendLoadVerifiedInvoice` wrapper — **price-only by design** (no cost, no margin) |
| Cost data? | No (wrapper schema is price-only by design and is safe to share) |
| **Verdict** | **SHIP** — this is the canonical "office invoice fires at load_verified, price only" callsite per `project_rcrs_stock_workflow`. Note: default recipient `rcrs@rcrsal.com` does not match any known mailbox in `lib/team-roles.ts` — see **Open questions**. |

---

### 9. `lib\material-order-pipeline.ts:1390`

| | |
|---|---|
| Function | `_notifyStageAdvance` (private method of `MaterialOrderPipeline`) |
| Trigger | Fires on every pipeline stage advance (`advanceStage` / `transitionStage`). 18 stages, each with its own `notifyRoles` array in `STAGE_CONFIG` (lines 84-101). |
| Recipient | **Variable, role-resolved** — `TEAM_MEMBERS` filtered by role from `notifyRoles`, sent one-per-recipient in `Promise.allSettled` |
| Subject | `Delivery Update: ${stage.label} — ${jobName || orderId}` |
| Template | Ad-hoc HTML (Job / Customer / Address / Driver / Updated-by table) |
| Cost data? | No |
| **Verdict** | **SHELVE** (re-evaluate before re-enable) — 18 stages × notifications per advance = highest-volume emitter in the app. Every order generates 30+ emails. Per `project_rcrs_stock_workflow` and `project_warehouse_inventory_system` the real notification channel is the dashboards/in-app + Rick's mobile + GroupMe, not stage-advance emails. Recommend: cut to 3-4 milestones (`LOAD_VERIFIED`, `DELIVERY_CONFIRMED`, `INVOICE_SENT`, `PAYMENT_RECEIVED`) AND remove `office` from inner stages. Also: the `billing` role maps to `office` (line 1331) — verify intent before re-enable. |

---

### 10. `lib\notification-service.ts:812`

| | |
|---|---|
| Function | `NotificationService.sendNotification` |
| Trigger | The catch-all notification dispatcher. Called by anything that resolves user preferences via `resolvePreferences`. Recipient + channels driven entirely by per-user prefs (`triggerPrefs.channels.email`). |
| Recipient | **Variable** — `recipientEmail || getRepEmail(repSlug)`. Rep slug resolves to a TEAM_MEMBERS email. Customer ID path also supported. |
| Subject | `payload.emailSubject || '[RCRS] ${title}'` |
| Template | `payload.emailHtml || buildEmailHtml(title, message, data)` |
| Cost data? | Depends on caller payload. Default `buildEmailHtml` does not render cost. |
| **Verdict** | **SHIP** — preference-cascade design is correct; rep gets email iff rep opted in. Per "reminders to sales reps should go to the sales rep, not the comp email" — this respects that already. Before re-enable, audit every caller of `sendNotification` to make sure none of them pass cost in `payload.data` rendered by `buildEmailHtml`. |

---

### 11. `lib\review-management-service.ts:748`

| | |
|---|---|
| Function | `ReviewManagementService.sendReviewRequest` |
| Trigger | Manual / API call when staff sends a customer review request |
| Recipient | **Variable** — `data.customerEmail` |
| Subject | `How was your experience with River City Roofing?` |
| Template | Ad-hoc HTML built by `buildReviewEmailBody` |
| Cost data? | No |
| **Verdict** | **SHIP** — closes the 47-vs-800 reviews gap (per `reference_seo_monitor`). `replyTo: 'rcrs@rivercityroofingsolutions.com'` is correct. |

---

### 12. `app\api\forms\careers\route.ts:68`

| | |
|---|---|
| Function | `POST /api/forms/careers` |
| Trigger | Public careers application form submission |
| Recipient | **Hardcoded** `michaelmuse@rcrsal.com` |
| Subject | `Career Application: ${name} — ${city}` |
| Template | Ad-hoc HTML (name / email / phone / city / experience / why-join table) |
| Cost data? | No |
| **Verdict** | **SHIP** — owner wants applications direct. Low volume. Already covered by GroupMe notification too (lines 51-65). |

---

### 13. `lib\work-order-service.ts:1112`

| | |
|---|---|
| Function | `WorkOrderService` dispatch email method (within create/email-work-order code path) |
| Trigger | Created when a work order is created in the warehouse system |
| Recipient | **Variable** — `wo.assignedDriverEmail` (if assigned) with `cc: stock@rcrsal.com`; otherwise sends `to: stock@rcrsal.com` |
| Subject | `[STOCK]` or `[VENDOR PICKUP]` prefix + `New Work Order: ${jobNumber} - ${customerName}` (or "Unassigned Work Order") |
| Template | Ad-hoc dark-theme HTML (materials list, special instructions, notes, "Open in Portal" + Google Maps directions) |
| Cost data? | **Need to verify** — materials rows reference `materialsRows` built earlier in the function; could not see definition in this view. Driver view should be qty/unit/name only. |
| **Verdict** | **FIX-TEMPLATE (pending verification)** — confirm `materialsRows` strips unit price / line cost before re-enable, since driver and stock@ receive this and **drivers must not see cost**. Recipient resolution is correct. |

---

### 14. `app\api\storm-report\email\route.ts:331`

| | |
|---|---|
| Function | `POST /api/storm-report/email` (customer-facing partial report) |
| Trigger | After a storm report is generated (called from the report-result page) |
| Recipient | **Variable** — `data.customerEmail` |
| Subject | `Your Storm Damage Risk Report – ${riskLevel} Risk | River City Roofing Solutions` |
| Template | `buildCustomerEmailHtml(data)` — partial/teaser report |
| Cost data? | No |
| **Verdict** | **SHIP** — legit customer-facing report. |

---

### 15. `app\api\storm-report\email\route.ts:339`

| | |
|---|---|
| Function | Same handler — sales team full report |
| Trigger | Same POST, fires in parallel with customer email |
| Recipient | **Variable env / hardcoded fallback** — `SALES_TEAM_EMAIL = process.env.SALES_TEAM_EMAIL || 'michaelmuse@rcrsal.com'` |
| Subject | `New Storm Report Lead - ${riskLevel} - ${fullAddress}` |
| Template | `buildSalesEmailHtml(data)` — full report |
| Cost data? | No |
| **Verdict** | **FIX-RECIPIENT** — per owner directive "reminders to sales reps should go to the sales rep, not the comp email," and per the comment that this is the "sales team full report," sending to Michael personally is the wrong default. **Should distribute to the assigned rep** (when a rep can be resolved) and CC office. If env var is unset in production, every storm report goes only to Michael — confirm `SALES_TEAM_EMAIL` is populated in Vercel before re-enable. |

---

### 16. `app\api\cron\weekly-numbers-reminder\route.ts:241`

| | |
|---|---|
| Function | `GET /api/cron/weekly-numbers-reminder` |
| Trigger | **Cron in vercel.json** — `0 15 * * 3` (midweek, Wed 9am CT) and `0 0 * * 1` (final, Mon 12am CT) |
| Recipient | **Variable** — `rep.email` (each active sales rep who hasn't submitted weekly numbers for the upcoming Monday meeting) |
| Subject | from `buildReminderEmail` (e.g., "Hey Adam - Log Your Numbers This Week") |
| Template | from `buildReminderEmail(rep.name, type)` |
| Cost data? | No |
| **Verdict** | **SHIP** — exactly matches owner directive ("reminders to sales reps should go to the sales rep, not the comp email"). This is the canonical example of correct routing. Cross-references `project_monday_meeting_sheet`. |

---

### 17. `app\api\cron\stalled-tickets-digest\route.ts:176`

| | |
|---|---|
| Function | `GET /api/cron/stalled-tickets-digest` |
| Trigger | **Drafted, NOT yet in vercel.json** (file header notes `0 12 * * *` proposed). |
| Recipient | **Variable, role-resolved** — `TEAM_MEMBERS.filter(m => m.isActive && ['owner', 'admin', 'office'].includes(m.role))` (Michael, Chris, Sara, Tia + any future office hires) |
| Subject | `[RCRS] N tickets stalled · oldest Xd` |
| Template | `buildDigestHtml(byStatus)` — table of stalled tickets grouped by status |
| Cost data? | No |
| **Verdict** | **SHIP** — would have caught the "17 tickets in created status for weeks" incident. Skips email entirely if no stalled tickets (no-spam-on-quiet-days). Note: not scheduled yet — add to vercel.json when re-enabling transport. |

---

### 18. `app\api\cron\low-stock-alert\route.ts:91`

| | |
|---|---|
| Function | `GET /api/cron/low-stock-alert` |
| Trigger | **Cron in vercel.json** — `0 13 * * *` (daily 7am CT) |
| Recipient | **Variable, role-resolved** — `TEAM_MEMBERS.filter(m => m.isActive && ['office', 'admin', 'owner'].includes(m.role))` |
| Subject | `[RCRS Inventory] N items need restocking · M OUT` |
| Template | `buildEmailBody(outOfStock, critical, warning)` |
| Cost data? | No (qty-on-hand and thresholds only — no unit cost) |
| **Verdict** | **SHIP** — fires daily, recipient set correctly. Skips entirely when no alerts. |

---

### 19. `app\api\cron\auto-review-request\route.ts:207`

| | |
|---|---|
| Function | `GET /api/cron/auto-review-request` |
| Trigger | **Drafted, NOT yet in vercel.json** (file header notes `0 19 * * *` proposed) |
| Recipient | **Variable** — `ticket.customerEmail` for each ticket completed in the last 24h, idempotent via `ReviewRequests` sheet |
| Subject | `How did we do? — Job ${referenceNumber}` |
| Template | `buildEmailHtml({ customerName, jobNumber, googleLink, bbbLink })` |
| Cost data? | No |
| **Verdict** | **SHIP** — directly addresses the 47-vs-800 reviews gap. Idempotent. Both this and the manual `sendReviewRequest` (callsite #11) exist; that overlap is fine. Need `NEXT_PUBLIC_GOOGLE_PLACE_ID` set before scheduling. |

---

### 20. `app\api\command-center\team\route.ts:89`

| | |
|---|---|
| Function | `POST /api/command-center/team` (submit profile edit for approval) |
| Trigger | Any team member submits a profile edit that requires admin approval |
| Recipient | **Hardcoded array** `['michael@rcrsal.com', 'sara@rcrsal.com']` (loop sends one email per recipient) |
| Subject | `Profile Edit Request: ${memberName}` |
| Template | Ad-hoc HTML (changes summary + "Review in Command Center" link) |
| Cost data? | No |
| **Verdict** | **FIX-RECIPIENT** — uses `michael@rcrsal.com`, but the team-roles entry for Michael is `michaelmuse@rcrsal.com` (lib/team-roles.ts:91). One of those two addresses is bouncing/aliased; reconcile before re-enable. Sara's address is correct. |

---

### 21. `app\api\contact\route.ts:184`

| | |
|---|---|
| Function | `POST /api/contact` |
| Trigger | Public contact form submission (the production path) |
| Recipient | **Hardcoded** `to: michaelmuse@rcrsal.com, cc: sara@rcrsal.com,tia@rcrsal.com` |
| Subject | `Website Lead: ${name} — ${subject}` |
| Template | Ad-hoc HTML (Name/Email/Phone/Subject/Source/Message + portal link) |
| Cost data? | No |
| **Verdict** | **SHIP** — owner + office both need new-lead visibility. Note: parallel `formService.sendEmailNotification` (callsite #3) also fires for contact forms, so the company inbox gets a copy too. That overlap is acceptable but verify there's no duplicate-by-design after re-enable. |

---

### 22. `app\api\portal\customer-breakdowns\route.ts:467`

| | |
|---|---|
| Function | `notifyVendorAlerts` (called from POST handler when a breakdown is saved with new-vendor alerts above threshold) |
| Trigger | HTTP POST when staff creates/updates a customer breakdown that introduces a new vendor over the threshold from `data/breakdown-dropdowns.json` |
| Recipient | **Variable** — `config.newEntryThresholds.notifyRecipients.join(',')` (configured per-org in the dropdown JSON file) |
| Subject | `New Vendor Alert: ${rNumber} - N vendor(s) over threshold` |
| Template | Ad-hoc dark-theme HTML (vendor table + job context) |
| Cost data? | **YES — leaks dollar amounts** (Job Total, vendor amounts, thresholds). |
| **Verdict** | **FIX-RECIPIENT** (pending review) — depends on who is in `notifyRecipients` in the JSON. If it's owner/admin/office/manager only, ship as-is. If sales reps are in there, redact dollar amounts. See **Open questions**. |

---

### 23. `app\api\portal\weekly-numbers\route.ts:480`

| | |
|---|---|
| Function | `notifyWeeklyNumbersSubmitted` (called from POST handler when a rep submits or updates weekly numbers) |
| Trigger | HTTP POST when a sales rep submits weekly numbers in the portal |
| Recipient | **Hardcoded** `michaelmuse@rcrsal.com` |
| Subject | `Weekly Numbers Submitted/Updated: ${repName} (${week})` |
| Template | Ad-hoc HTML (Inspected/Damage/Signed/Repair/Gutter/Revenue/Approved/Referrals/Agents table) |
| Cost data? | No (revenue is self-reported accrual, which the owner already sees on the Monday sheet) |
| **Verdict** | **SHIP** — owner wants instant notification when reps submit numbers (pairs with the cron reminder in callsite #16). |

---

### 24. `app\api\portal\vendor-returns\route.ts:120`

| | |
|---|---|
| Function | `POST /api/portal/vendor-returns` |
| Trigger | HTTP POST when Rick records a vendor return (materials picked up from a job site that came from an outside vendor — SRS, ABC, etc.) |
| Recipient | **Variable with hardcoded default** — wrapper falls back to `process.env.OFFICE_NOTIFY_EMAIL || 'rcrs@rcrsal.com'` (line 593 of email-service.ts) |
| Subject | `Vendor Return: ${vendorName} — ${jobNumber} ${customerName}` |
| Template | `sendVendorReturnNotification` wrapper |
| Cost data? | **YES — passes `estimatedValue` per line + `estimatedTotalValue`** to wrapper, which renders them. This is intentional per the wrapper's "internal only" header comment. |
| **Verdict** | **SHIP** — Sara handles vendor credit chasing, and cost visibility is fine for her per `feedback_purchase_price_visibility`. Verify default recipient `rcrs@rcrsal.com` resolves to Sara (see Open questions on this mailbox). |

---

### 25. `app\api\portal\pipeline\route.ts:790`

| | |
|---|---|
| Function | `POST /api/portal/pipeline` (`emailInvoice` action) |
| Trigger | HTTP POST when office/admin/owner clicks "Email to Customer" on an invoice page (`app/(tools)/portal/delivery/invoices/[id]/page.tsx`). Refuses for `invoice.type === 'internal'`. |
| Recipient | **Variable** — `invoice.customerEmail || order?.customerEmail` |
| Subject | `Invoice ${invoiceId} from River City Roofing Solutions` |
| Template | Ad-hoc HTML (customer-friendly invoice with item rows + total). Uses `unitPrice` / `totalPrice` (final price), not cost. |
| Cost data? | No (explicit guard blocks internal invoices to prevent cost leak) |
| **Verdict** | **SHIP** — explicit safeguard against cost leak is in place (line 716-720). Customer-facing, manually triggered. |

---

### 26. `app\api\portal\tickets\route.ts:281`

| | |
|---|---|
| Function | `POST /api/portal/tickets` (delivery-ticket creation case) |
| Trigger | HTTP POST when staff creates a delivery ticket from the portal |
| Recipient | **Hardcoded default in wrapper** — `data.driverEmail || process.env.DEFAULT_DELIVERY_ORDER_EMAIL || 'stock@rcrsal.com'` (wrapper, lines 290-293 of email-service.ts). Caller passes no `driverEmail`, so falls to env / `stock@`. |
| Subject | `Delivery Order: ${ticketId} - ${customerName}` |
| Template | `sendDeliveryOrder` wrapper (qty/unit/name only — explicit "NO cost" comment in wrapper) |
| Cost data? | No (wrapper enforces qty+unit+name strings only) |
| **Verdict** | **SHIP** — wrapper design explicitly safe ("work order PDF physically rides out with the truck and could be left at a job site"). |

---

### 27. `app\api\leads\new\route.ts:460`

| | |
|---|---|
| Function | `POST /api/leads/new` |
| Trigger | HTTP POST when a new lead is created (any source — contact form, JN, phone, referral, etc.) |
| Recipient | **Hardcoded list** `OFFICE_NOTIFY_EMAILS = ['michaelmuse@rcrsal.com', 'sara@rcrsal.com', 'destin@rcrsal.com', 'tia@rcrsal.com']` (loop sends one email per recipient) |
| Subject | `New Lead: ${name} — ${serviceType || source}` |
| Template | Ad-hoc HTML (lead details + JobNimbus match warning + "Review & Distribute" CTA) |
| Cost data? | No |
| **Verdict** | **SHIP** — office + manager + owner need new-lead visibility. Per-recipient cap protects against runaway. Note: the lead is sent "UNASSIGNED — Needs Review" — the rep doesn't get notified until the distribution step (separate flow). |

---

## Stale / Unused Wrappers (defined in email-service.ts but never called)

| Wrapper | Defined at | Verdict |
|---|---|---|
| `emailService.sendPortalLink` | lib/email-service.ts:185 | **DELETE** — no callsite. Portal links go through SMS today (`smsService.sendPortalLink` at lib/sms-service.ts:437). If we ever want email portal links, rebuild against the new transport. |
| `emailService.sendLeadAssignment` | lib/email-service.ts:232 | **DELETE** — no callsite. Lead assignment notifications run through `lib/notification-service.ts` and GroupMe today. |
| `emailService.sendOfficeMaterialOrderNotification` | lib/email-service.ts:328 | **DELETE** — no callsite. Architecture explicitly chose to NOT email office on ticket-create (`app/api/webhooks/material-order-email/route.ts:223-225` comment: "the office does NOT get a create-time email — the office invoice fires later, at load_verified, with price-only data"). The cost-bearing office variant is dead by design. |

Also note: `lib/profile-approval-service.ts` imports `emailService` and calls `.send()` at line 487, but only behind an `if (params.recipientEmail)` guard inside `createNotification`. I did not include it as a numbered callsite because the calling sites of `createNotification` never pass `recipientEmail`. If that changes, it becomes a real callsite — **SHELVE** until a caller actually populates `recipientEmail`.

---

## Cross-reference: vercel.json crons that send email

| Cron path | Schedule | Email callsite |
|---|---|---|
| `/api/cron/weekly-numbers-reminder?type=midweek` | `0 15 * * 3` (Wed 9am CT) | #16 |
| `/api/cron/weekly-numbers-reminder?type=final` | `0 0 * * 1` (Mon 12am CT) | #16 |
| `/api/cron/low-stock-alert` | `0 13 * * *` (daily 7am CT) | #18 |
| `/api/cron/check-lead-timers` | `*/2 * * * *` | No emailService.send (uses GroupMe / SMS — verified by grep) |
| `/api/cron/auto-reassign` | `*/5 * * * *` | No emailService.send |
| `/api/cron/publish-blog` | `0 6 * * *` | No emailService.send |
| `/api/cron/meeting-reset` | `0 16 * * 1` | No emailService.send |
| `/api/cron/backup-sheets` | `0 * * * *` | No emailService.send |
| `/api/cron/sync-inventory-tab` | `*/10 * * * *` | No emailService.send |

**Drafted but NOT in vercel.json** (won't auto-fire until added):
- `/api/cron/stalled-tickets-digest` (#17)
- `/api/cron/auto-review-request` (#19)

---

## Open Questions for Owner

1. **What mailbox is `rcrs@rcrsal.com`?** This is the default `OFFICE_NOTIFY_EMAIL` fallback for three wrappers (`sendOfficeMaterialOrderNotification`, `sendLoadVerifiedInvoice`, `sendVendorReturnNotification`), but it does not appear in `lib/team-roles.ts` — no team member has that address. Is it a Google Workspace group (`rcrs@` distribution list) that fans out to office staff? Or is it a typo for `sara@rcrsal.com` / `office@rcrsal.com`? If it's a real group, document the membership; if not, change the default to `sara@rcrsal.com`.

2. **What is `michael@rcrsal.com` vs `michaelmuse@rcrsal.com`?** Callsite #20 (command-center/team) uses `michael@rcrsal.com`; every other callsite uses `michaelmuse@rcrsal.com`. team-roles.ts has only `michaelmuse@rcrsal.com`. Confirm which is canonical and reconcile.

3. **Who is in `data/breakdown-dropdowns.json` → `newEntryThresholds.notifyRecipients`?** Callsite #22 sends dollar amounts to this list. Owner/admin/office/manager OK per memory; need to confirm no sales rep is on it.

4. **`SALES_TEAM_EMAIL` env var (callsite #15) — is it set in Vercel?** If not, every storm-report-lead email defaults to Michael only, which contradicts the "full report to the sales team" intent.

5. **`work-order-service.ts:1112` (callsite #13) — does the email body include `unitPrice` / `lineCost`?** Driver and stock@ get this email. The materials-row builder is upstream of the callsite view; please confirm it strips cost columns before re-enabling. If cost is present, this is a hard FIX-TEMPLATE blocker.

6. **`material-order-pipeline._notifyStageAdvance` (callsite #9) is the highest-volume emitter.** 18 stages × multiple recipients per stage = dozens of emails per order. Is this really desired? Recommended: cut to milestone stages only (`LOAD_VERIFIED`, `DELIVERY_CONFIRMED`, `INVOICE_SENT`, `PAYMENT_RECEIVED`) and rely on in-app / GroupMe for everything else. Final call is yours.

7. **`syncReturnToBreakdown` email (callsite #4)** — stock@rcrsal.com is auto-forwarded somewhere per the Apps Script setup. Who is on the receiving end of stock@ forwards? If anyone outside owner/admin/office/manager/Richard sees it, the unit-cost figures in the items list need to come out.

8. **GAS notification path** is commented out in `form-service.ts` (lines 210-212). When you migrate transport, do you want the GAS-side `[Contact Page] New Lead:` channel re-enabled with the GAS code fixed, or is the direct `emailService.send` path (callsite #3) the permanent replacement?
