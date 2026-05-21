# Roofing CRM Lead Distribution — Competitive Research

**Date:** 2026-05-21
**Author:** Research pass for RCRS in-house lead-distro algorithm
**Scope:** AccuLynx, Roofr, JobNimbus, JobProgress, ServiceTitan, MarketSharp, Improveit360, RoofSnap

---

## 1. Executive Summary

**Table stakes (every product has these):**
- Manual assignment via dropdown + email/SMS notification to the assigned rep.
- Lead source capture and basic status workflow (New → Contacted → etc.).
- Some form of "automation rule" tied to a status or contact-created trigger.
- Map view of leads (varies in sophistication).

**Differentiators (where products separate):**
- **ML-driven assignment with profit optimization** — only ServiceTitan Dispatch Pro does this end-to-end (simulates thousands of scenarios; reshuffles every 10 min).
- **AI lead *scoring* before assignment** — AccuLynx Lead Intelligence (Faraday API) ranks lead likelihood-to-close from third-party consumer/property data, *weekly*. Most CRMs have nothing like this.
- **Decision-support UX (not auto-assign)** — AccuLynx "Smart Assign" surfaces close-rate YTD + 30/90-day sales + nearby jobs *next to each rep* on the assignment dropdown. This is the single best "human in the loop" pattern we found.
- **Speed-to-lead SLA timers with auto-reassignment** — concept is well-documented in general CRM literature (Salesforce, LeadSquared, RevOps blogs); *no* roofing CRM ships this natively as a first-class feature. Roofr advertises "speed-to-lead" but has no documented reassignment-on-timeout.
- **True round-robin with territory + load-balancing** — not native in any roofing CRM. Has to be hacked with automations (JobNimbus) or built in Zapier.

**Bottom line:** Our RCRS algorithm (proximity + recency + referral + meeting attendance + close rate + response time) is **already more sophisticated than what any roofing CRM ships natively**, with three exceptions: (a) we don't have AI lead-quality scoring, (b) we don't have a published SLA-timer/auto-reassign loop, (c) we don't simulate scenarios across the whole day's job board the way Dispatch Pro does.

---

## 2. Per-Product Findings

### 2.1 AccuLynx (dominant; ~50%+ market share roofing CRM)
- **Three modes:** *Assign* (dumb dropdown), *Smart Assign* (decision-support dropdown showing each rep's close-rate YTD, sales 30/90 days, nearby jobs), *Map Assign* (visual lead map with milestone overlays). **Smart Assign is a suggestion, not auto-assignment** — dispatcher still clicks.
- **Lead Intelligence** (launched late 2024, powered by Faraday prediction API): scores every lead weekly using consumer/financial/property demographics → "Lead Rank" indicator bar visible on lead/prospect records and list view. Available to all customers.
- **Notifications:** auto-alerts to assigned salesperson; no documented SLA-timer / auto-reassign.
- **Audit trail:** 28+ canned reports incl. closing % and job profitability; no explicit assignment audit log in marketing material.
- **Anti-gaming:** none documented.
- **Pricing:** per-seat $60–$120/user/mo. Many table-stakes features (SmartDocs, texting, customer portal, aerial measurements, material ordering) are paid add-ons. Per-seat model widely criticized for "punishing growth."
- **Top complaints (Capterra):** clunky mobile app; per-seat scaling; outdated UI; notification gaps (emails missed); search limitations (can't search by material).

### 2.2 Roofr (modern UX challenger)
- **Assignment:** assign up to 10 teammates to a job, one designated "Job Owner" (commission credit), changeable anytime. That's it — no routing rules, no round-robin.
- **Automations:** can change job status / assign tasks / update proposals. Reviewers score automation 3.5/5 — *"no deep automation triggers, no drip campaigns, no lead-routing rules."*
- **Speed-to-lead marketing:** lots of speed-to-lead *content*, but the product only does email/SMS notification on new lead. No SLA timer or auto-reassign.
- **Pricing (March 2026 overhaul):** Starter free + $19/report; Essentials & Scale tiers paid (prices not public — sales-call gated). Scale tier unlocks "advanced workflow automation."
- **Verdict:** Roofr is best-in-class for *estimating UX*, weakest in this comparison for *distribution logic*.

### 2.3 JobNimbus (our system of record)
- **Native routing:** None. There is no built-in round-robin, territory router, or SLA timer.
- **What it offers:** event-based **automations** — trigger on Contact-created + Status=New → Create Task → assign to "Sales Rep" / specific user / current assignee / related contact. That's the routing primitive. Anything fancier requires chained automations or external (Zapier/our code).
- **Outcome tracking:** task completion + status changes are logged; reporting module (Insights) is widely panned — JN itself publicly told reviewers to evaluate carefully until 2026 roadmap ships.
- **Anti-gaming:** none.
- **Top complaints:** weak Insights/reporting, weak built-in email (formatting + deliverability), no campaign attribution, finicky integrations.
- **Implication for RCRS:** our algorithm doing the routing *outside* JN and writing the assignment back is the correct architecture — JN cannot do this natively.

### 2.4 JobProgress
- Generic task/CRM platform sold to home-improvement contractors. Manual assignment + task delegation. **No documented lead-routing algorithm, no AI, no scoring.** Reviewer consensus: clunky, dated, steeper learning curve than Roofr or JN. Not a source of inspiration.

### 2.5 ServiceTitan (Dispatch Pro) — the gold standard
- **Algorithm:** ML simulates *thousands of daily scenarios* to find max-profit assignment. Inputs: technician skills, location/drive time, predicted job value (Titan Intelligence), short- and long-term technician performance (sales, avg ticket, sold memberships, lead-generation probability).
- **Constraints applied:** correct business unit/zone, skill match.
- **Refresh cadence:** **every 10 min during business hours**, hourly off-hours; optimizes up to 3 days forward, re-optimizes future days hourly.
- **Two UX modes:** Dispatch Assist (full automation) vs Dispatch Pro Console (recommendations + dispatcher override).
- **Data warmup:** 3–4 months of customer history before predictions kick in; falls back to industry baselines for new customers.
- **Pricing:** Pro add-on on top of ServiceTitan base ($400–$2,000+/mo). Real cost is enterprise-class.
- **Gap:** no public audit-trail or anti-gaming documentation.

### 2.6 MarketSharp (older home-improvement CRM)
- Built-in assignment-rules configuration + lead-provider auto-sync (HomeAdvisor, Angi-style). Job-site radius lead generation, automated follow-up sequences. **Logic is rule-based, not ML.** Solid for marketing automation, weak for sophisticated routing. Aging UI per reviewers.

### 2.7 Improveit360
- Strong on **appointment scheduling**: drag-and-drop calendars, block scheduling, mobile sync, auto-reminders. Lead management: dup-prevention, web-to-lead, email-to-lead. Territory filtering by region for managers. Routing logic is rule-based, no AI scoring. Best feature relative to peers: **calendar-aware** dispatch.

### 2.8 RoofSnap / Roofnest
- RoofSnap is fundamentally a *measurement + estimating* tool with a lightweight lead tracker bolted on. No real routing logic. "Roofnest" appears to be a brand confusion — not a roofing CRM product (it's a rooftop tent company).

---

## 3. Must-Have Features We Should Copy (ranked by value)

1. **AI lead-quality scoring before routing.** AccuLynx's Faraday integration scores leads on property + demographic data weekly. Our algorithm currently treats every lead as equal-value. **Action:** add a "lead score" input — even a simple model on lead source × ZIP × roof age (from aerial) × prior contact would beat nothing. Score multiplies expected commission in our optimizer.
2. **"Smart Assign" decision-support dropdown for office override.** When office staff manually pick a rep, show inline: close rate (YTD), sales last 30/90 days, current open-lead count, distance to lead, last contact recency. AccuLynx nails this UX. We should add this view to the JN-to-RCRS assignment screen.
3. **SLA timer with auto-reassign on no-touch.** None of the roofing CRMs ship it natively but it's a sales-ops best practice. Concrete rule: if assigned rep has no logged contact attempt within 15 min (business hours) or 2 hr (after hours), reassign to next-best rep and notify manager. Track SLA-breach rate as a rep KPI.
4. **Scenario simulation across the daily lead pool (Dispatch Pro pattern).** Instead of assigning each lead the moment it arrives, batch incoming leads in a 5-min window and run a global optimizer (Hungarian / linear assignment) maximizing total expected commission across all reps for the batch. Single-lead greedy assignment is leaving money on the table when two reps could be swapped to cut drive time in half.
5. **Predicted job value per lead.** ServiceTitan predicts $ value before assignment. We have the data: ZIP × historical avg ticket × roof age × storm history. Feed predicted $ into the assignment optimizer (proximity matters less if the job is $40k vs $8k).
6. **Re-optimize the board hourly, not just on event.** Today our algorithm fires on lead creation. Pull a Dispatch Pro page from the playbook: re-run assignment optimization on a timer so reps who cancel appointments or get sick are surfaced quickly.
7. **Reason explanation on each assignment.** Auto-generate a short string ("assigned to Mike: closest [4.2 mi], best close rate [38% YTD], lowest open queue [3]"). This is for trust/audit; AccuLynx Smart Assign implies the reasoning visually, we should make it explicit + logged.
8. **Calendar-availability check.** Improveit360 ties routing to calendar. Before assigning a lead, peek at the rep's Google Calendar for the next 24 hr — if they have no available estimate slot, skip them. We have Google Workspace; this is achievable.
9. **Top-N suggestions, dispatcher confirms.** ServiceTitan offers both auto and assisted modes. For high-value leads ($20k+) we should switch from auto-assign to "top-3 candidates, sales manager picks." Reduces algorithm risk on big jobs.

## 4. Loopholes / Gaming Risks To Adopt Defenses For

Our algorithm rewards meeting attendance, response time, and close rate. Each is gameable. Specific risks + defenses:

- **Response-time gaming:** rep auto-marks "contacted" via mobile app the second the lead drops, no actual call. **Defense:** require a phone-system log entry (CallRail / Twilio / FreePBX call record) or outbound SMS to count as "contacted." Manual status-flip alone is no longer sufficient.
- **Close-rate gaming via lead refusal:** rep refuses junk leads to keep close-rate inflated. **Defense:** auto-decline counts as a loss for close-rate purposes (or requires a manager override with reason code).
- **Meeting-attendance gaming:** rep shows up but mentally checks out / leaves early. **Defense:** require check-in *and* check-out timestamps via geofence (we already have GPS hooks).
- **Activity-stuffing:** rep creates fake tasks/notes to look busy. **Defense:** weight only *verifiable* activity (outbound calls with >30s duration, SMS replies, photos with EXIF, signed docs). LinkedIn's "Gaming Your CRM" piece (Ciesielski, MBA) lists this as the #1 abuse pattern.
- **Reassignment shopping:** rep claims a lead, sits on it past the SLA so it auto-reassigns to a teammate they're colluding with, then splits commission privately. **Defense:** auto-reassignment skips the prior assignee *and their referral cluster*; flag any 2-hop reassignment chain for manager review.
- **Proximity gaming via GPS spoofing:** if proximity rewards reps physically close to the job, a rep can sit at the office address. **Defense:** require *recent job site visit* (within 14 days) at a real customer address, not arbitrary GPS pings.
- **Referral self-dealing:** rep refers a lead to themselves through a buddy. **Defense:** referrer must be a distinct verified contact with prior history; flag referrals from new contacts.

## 5. Anti-Patterns To Avoid

- **Black-box ML with no explainability.** ServiceTitan dispatchers complain they can't tell *why* Dispatch Pro assigned a tech. Our algorithm must always emit a reason string the rep + manager can see.
- **Auto-assign without an override path.** Field sales teams revolt when the system can't be overridden. AccuLynx kept Smart Assign as suggestion-only — that's the right default.
- **Per-seat pricing punishing growth.** Not a feature issue but a design philosophy. Our system is internal so this is fine, but never expose per-seat-style throttling to managers ("pay more to assign more leads").
- **Greedy single-lead assignment.** Assigning each lead the millisecond it lands looks fast but is suboptimal across a batch. Batch + global optimize.
- **Ignoring lead quality.** Round-robin treats a $5k repair the same as a $40k insurance replacement. Don't ship distribution without expected-$ in the score.
- **Notification spam.** Roofr/JN ship dumb "new lead" notifications. Better: one notification with the *reason* it was assigned and a one-tap accept/decline.
- **No SLA enforcement.** Lead sits, rep is "on it," 4 days later customer hires a competitor. Force a contact-attempt within 15 min during business hours or reassign.
- **Treating reps as fungible.** Skill match (storm vs retail vs insurance vs solar) matters. Two reps with same close rate can have wildly different close rates *on a given lead type*. Track close rate by *segment*, not aggregate.
- **Reporting blind spots.** JN's Insights is the cautionary tale. Build assignment dashboards: assignments/day, SLA-breach %, reassignment rate, time-to-first-contact, accept/decline rate.
- **No audit trail.** Every assignment, reassignment, override, and reason must be logged to AuditLog (we already have the table — make sure the lead-distro writer hits it).

## 6. Sources

- AccuLynx — "How to Assign the Right Roofing Sales Reps to Jobs": https://acculynx.com/assign-the-right-roofing-sales-reps-to-jobs/
- AccuLynx Lead Intelligence (Faraday): https://acculynx.com/roofing-sales-lead-intelligence/ and https://faraday.ai/blog/acculynx-lead-intelligence-powered-by-faraday-api
- AccuLynx Capterra reviews (accessed 2026-05): https://www.capterra.com/p/116187/Acculynx/reviews/
- AccuLynx vs JobNimbus 2026 comparison: https://contractorsoftwarehub.com/acculynx-vs-jobnimbus/
- Roofr CRM marketing: https://roofr.com/crm  and  https://roofr.com/more-info/speed-to-lead-roofing-software
- Roofr 2026 pricing review (Mar 2026 overhaul): https://roofingsoftwareguide.com/reviews/roofr  and  https://contractortoolstack.com/software/roofr/
- JobNimbus automation docs: https://support.jobnimbus.com/automations  and  https://support.jobnimbus.com/how-do-i-create-an-automation-to-notify-a-sales-rep-of-a-new-lead
- JobNimbus 2026 review (Insights weakness): https://roofingsoftwareguide.com/reviews/jobnimbus-review/  and  https://www.rivetops.io/jobnimbus-review-roofing-crm
- ServiceTitan Dispatch Pro: https://www.servicetitan.com/features/pro/dispatch  and  https://help.servicetitan.com/v1/docs/dispatch-pro-overview  and  https://mypowerhouse.group/servicetitan-dispatch-pro-what-you-need-to-know/
- ServiceTitan AI / Titan Intelligence: https://www.servicetitan.com/features/ai
- ServiceTitan pricing 2026: https://fieldcamp.ai/reviews/servicetitan/  and  https://vertexhub.app/blog/servicetitan-pricing-2026.html
- MarketSharp lead-gen & integrations: https://www.marketsharp.com/features/lead-generation/  and  https://www.marketsharp.com/integrations/lead-providers/
- Improveit360 features (scheduling-first): https://www.improveit360.com/features/  and  https://www.improveit360.com/features/remodeling-scheduling-software/
- JobProgress overview: https://www.jobprogress.com/  and  https://www.roofingcrm.net/top-software-options-jobprogress
- RoofSnap: https://roofsnap.com/
- Speed-to-lead best practices (general): https://roofr.com/blog/speed-to-lead-in-roofing  and  https://www.jobnimbus.com/blog/speed-to-lead-the-simplest-way-to-win-more-roofing-jobs-without-more-leads
- Gaming-your-CRM patterns (Ciesielski, LinkedIn): https://www.linkedin.com/pulse/gaming-your-crm-how-identify-suspicious-activities-ciesielski-mba
- Lead-gen fraud (Cheq, ActiveProspect): https://cheq.ai/blog/fake-lead-fraud-protection/  and  https://activeprospect.com/blog/fake-leads/
- SLA-based routing & auto-reassign: https://nc-squared.com/blog/article/sla-based-lead-routing-how-to-automate-and-boost-conversions  and  https://resources.rework.com/libraries/lead-management/lead-assignment-sla
