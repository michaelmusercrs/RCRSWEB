# Suggested Automations & Agents for RCRS

**Drafted 2026-05-15. Built from everything I learned about Michael's business + the gaps surfaced in today's audit.**

Format: each item has Trigger / Action / Value / Effort.

## Tier 1 — Ship this week (high value, low effort)

### A1. Auto-review-request after job completion
- **Trigger:** Ticket status → `completed` AND `ticketType=delivery`
- **Action:** SMS to customer with a one-click link to Google + BBB review pages. Link includes job# so we can attribute.
- **Value:** Closes the 47 vs 800+ review gap. Reviews are the #1 SEO weakness per memory.
- **Effort:** 2-3 hr. Twilio + a new cron route + a tiny portal page for the auto-fill.

### A2. JN job-stage → portal ticket-status sync
- **Trigger:** JN job stage transitions to "Paid in Full" or "Job Closed"
- **Action:** Find matching portal ticket by R#####, update its status to a new terminal "closed-and-paid"
- **Value:** The #1 thing Michael described tonight as "future". Lets the portal show only OPEN jobs by default.
- **Effort:** 4-6 hr. JN webhook config + new endpoint. Needs JN account API permission.

### A3. Daily "what's stalled" digest
- **Trigger:** Cron, every morning at 6am
- **Action:** Email Michael+Sara a summary of any ticket stuck in non-terminal status >48 hours. Group by status (loading 5d, delivered-no-invoice 3d, etc.)
- **Value:** Catches the things that fall through the cracks. Today's inventory issues would have been caught earlier with this in place.
- **Effort:** 2-3 hr. Existing email-service + a cron route.

### A4. Inventory zero-stock alert
- **Trigger:** Cron, hourly check
- **Action:** Slack/SMS to Rick if any SKU drops to 0 or below reorderPoint
- **Value:** Per Michael's hard rule "nothing should be at zero." Direct enforcement.
- **Effort:** 1-2 hr. Hook into existing `lib/cost-visibility` or `unifiedInventoryService` getLowStockItems.

### A5. Weekly numbers no-submit nudge
- **Trigger:** Cron, Sunday 6pm + Monday 8am
- **Action:** SMS any rep who hasn't submitted their weekly numbers yet. Existing `cron/weekly-numbers-reminder` already does this for email — add SMS.
- **Value:** Reps remember the form exists. Higher Monday-meeting data quality.
- **Effort:** 1 hr. Just add Twilio call to the existing cron.

## Tier 2 — Big leverage (medium effort)

### B1. Photo-from-jobsite → JN attachment pipeline
- **Trigger:** Driver uploads photo via the portal during delivery or completion
- **Action:** Auto-upload to the corresponding JN job's attachments AND tag with delivery-type (e.g., "post-install photo", "damage assessment")
- **Value:** One step from the future plumbing Michael laid out tonight. Foundational for the JN-portal sync.
- **Effort:** 6-8 hr. JN attachment API + existing photo-upload flow.

### B2. AI competitor monitor (weekly)
- **Trigger:** Cron, every Monday morning
- **Action:** Fetch top 5 competitor websites + their AI-search visibility. Detect changes (new certs claimed, missing pages, review-count changes, new services). Slack-summary to Michael.
- **Value:** Today proved competitor sites change fast (Impact Roofing went dark!). Catching that within a week of it happening = SEO opportunity.
- **Effort:** 4-6 hr. Build on existing `seo-monitor/` infrastructure.

### B3. PDF parser improvement — handle the 1-in-19 edge cases
- **Trigger:** Webhook receives a parse-fail
- **Action:** Send the PDF to Gemini Vision (you have the API key) for AI extraction. If Gemini confidence > 90%, create ticket. Otherwise email Michael with the raw PDF.
- **Value:** Tonight 1 of 19 emails failed silently. Multiply over years = lost tickets.
- **Effort:** 3-4 hr. Existing webhook + Gemini call.

### B4. Lead-response-time real-time enforcer
- **Trigger:** New lead created (JN webhook or form submission)
- **Action:** Start a countdown timer. At 15 min unresponded → SMS to assigned rep. At 30 min → SMS to manager. At 60 min → SMS to Michael+Chris.
- **Value:** Industry data: leads contacted within 5 min are 21× more likely to qualify than 30+ min. Most competitors don't enforce this.
- **Effort:** 4-6 hr. Existing `cron/check-lead-timers` likely covers half of this.

### B5. Monday-meeting auto-prep
- **Trigger:** Cron, every Sunday 6pm
- **Action:** Auto-generate Monday meeting prep page — pulls latest weekly numbers, Bible verse rotation, weather, last-week vs this-week comparison, top performer call-outs, "stale lead" call-outs. Pre-fills the prep form so Michael just reviews instead of filling from scratch.
- **Value:** Saves 30-45 min every Sunday. Reduces missed-meeting risk.
- **Effort:** 2-3 hr. `auto-generate` endpoint already exists per Phase 2E audit — just wire up the auto-populate to actually fire.

## Tier 3 — Strategic (bigger lift, bigger return)

### C1. Customer portal: real-time job status with photo gallery
- **Trigger:** Customer logs into rcrsal.com with their job-specific link
- **Action:** Sees: current stage (estimate received → inspection scheduled → materials ordered → installation date → completed → invoiced → paid), live updates, all photos posted by crew + drone shots, certificate of completion download
- **Value:** Existing customer portal is partial. A best-in-class one is a sales conversion tool — show prospects screenshots of the experience.
- **Effort:** 12-20 hr. Lots of small pieces already in place.

### C2. AI roof-damage triage from photo upload
- **Trigger:** Lead submits photos via the public site contact form
- **Action:** Gemini Vision analyzes for visible damage type (hail, wind, age, debris), estimates severity, recommends inspection priority. Routes high-priority leads to top rep automatically.
- **Value:** Same business model as the abandoned roof-measure-tool but actually customer-facing and useful. $0 incremental cost (Gemini API already paid for).
- **Effort:** 6-8 hr. Reuse Gemini integration patterns from existing code.

### C3. Commission preview + dispute log
- **Trigger:** Sales rep logs into portal
- **Action:** Sees commission summary by week/month with the actual QB data + accrual data + weekly-numbers data side-by-side. Has a "report a discrepancy" button that creates a ticket for Sara.
- **Value:** Reduces commission disputes by making the data transparent. Today's three-leaderboard fix is the foundation; this is the rep-facing UX.
- **Effort:** 8-12 hr. Builds on the three-leaderboard work shipped tonight.

### C4. Inventory PO-to-receipt automation
- **Trigger:** Manager creates a restock order (PO) in the portal
- **Action:** When supplier emails confirmation/invoice, parse it (similar to material-order email flow). When materials arrive, driver scans QR codes to verify, system auto-updates inventory + cost basis.
- **Value:** Closes the "in" side of the inventory ledger to match the "out" side. The double-deduction issue today happened because in-side wasn't tracked.
- **Effort:** 10-15 hr. Reuse parse + webhook patterns.

### C5. JN ↔ Portal full sync (the big one)
- **Trigger:** Any change in either system
- **Action:** Bi-directional sync: notes, calls, texts, photos, status changes, invoices. Per Michael's roadmap tonight.
- **Value:** End of double-entry. Single source of truth. Foundation for everything else.
- **Effort:** 40-80 hr (it's the rebuild of the integration layer).

## Tier 4 — "Nice to have" agents

### D1. Daily personal briefing for Michael
- 6am every morning: Slack/email with the most important 5 things for today. Pulled from: open leads needing attention, weekly numbers gaps, low-stock alerts, ticket aging, calendar conflicts.

### D2. Smart inbox triage for stock@rcrsal.com
- Beyond the material-order parser: also catch supplier invoices (restock side), warranty claims, customer complaints. Route each to the right destination.

### D3. Auto-blog from completed jobs
- Once a week, pick 1-2 completed-and-photographed jobs. Generate a blog post draft (NOT auto-publish — Michael reviews). SEO value compounds.

### D4. "Where did I lose this deal" auto-analyzer
- For every lead marked "closed-lost", compare against won deals with similar profile (city, damage type, season). Highlights patterns: "lost deals took 18% longer to respond to" or "lost deals on Tuesday signed competitors at 4× rate."

## What I'd build FIRST if I had to pick one

**A2 (JN job-stage sync) → A1 (auto-review-request) → A4 (zero-stock alert)**.

Reasoning:
- A2 unlocks the workflow Michael explicitly described as the destination
- A1 attacks the #1 SEO weakness
- A4 is the safety net that prevents the inventory issue we hit tonight

All three together: ~7-10 hours of work, all use existing infrastructure, all immediately visible value to the team.
