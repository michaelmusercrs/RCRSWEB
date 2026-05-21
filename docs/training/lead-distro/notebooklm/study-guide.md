# Lead Distro Study Guide — NotebookLM Source

**How to use this file:** Upload this single document plus the four core training docs (`01-algorithm-explainer.md`, `02-admin-walkthrough.md`, `03-dispatcher-sop.md`, `04-faq-troubleshooting.md`) into a NotebookLM notebook. Generate the audio overview, mind map, study guide, and FAQs. Add the video scripts and infographic specs as additional sources for richer cross-referencing.

This file consolidates the key concepts in one pass so NotebookLM has a unified "primer" to reference when answering questions or generating media.

---

## Why the lead distro system exists

River City Roofing Solutions receives leads from many channels: web forms, JobNimbus, referrals from past customers, hail canvass crews, lead-vendor purchases, and walk-ins. Every lead has a 5-minute window in which speed-to-contact dramatically affects close rate — research consistently shows ~9× higher qualification when contacted under 5 minutes.

Manual dispatch can't move that fast at our volume. Pure round-robin is fair but ignores who's actually best positioned. The algorithmic distribution system splits the difference: every rep gets scored on measurable factors, the algorithm picks (or suggests), and a human can override when judgment beats the score.

The system has been ahead of every roofing-industry CRM surveyed (AccuLynx, Roofr, JobNimbus, JobProgress, RoofSnap) except ServiceTitan Dispatch Pro, which is an enterprise add-on costing $400–$2,000/mo. The RCRS algorithm is in-house and admin-tunable in real time.

---

## The seven factors (in plain language)

1. **Install Proximity** (weight 30) — has this rep finished a roof near here lately? The "we did your neighbor's roof" pitch is the highest-converting line in the business.
2. **Contact Proximity** (weight 15) — does this rep have any customer relationships nearby, even non-closing conversations?
3. **Door Knock Recency** (weight 10) — is this rep actively canvassing the neighborhood?
4. **Referral Bonus** (weight 25) — did this rep refer the lead in? Full 25 points to the originating rep.
5. **Meeting Attendance** (weight 10) — is the rep showing up and engaging? Measured via lead-response rates.
6. **Office Close Rate** (weight 5) — what % of *office-sourced* leads does this rep close? (Excludes self-gen / referrals so the metric is comparable across reps.)
7. **Response Time** (weight 5) — how fast does this rep make first contact? Sourced from JobNimbus mined data first, lead-response log second, defaults to 0.5 if neither.

Weights must total 100. Each factor can be **dismissed** entirely (toggled off) — only enabled factors count toward the 100% sum and toward the score.

---

## How a score gets calculated (worked example)

For a lead at 1819 5th Ave N, Birmingham:

1. Algorithm geocodes the address → lat/lng.
2. For each active sales rep:
   a. Pull all their `Geocoded_Contacts` records.
   b. For each factor, compute a 0–1 raw score multiplied by the weight.
   c. Sum all factor scores → total.
3. Sort reps by total descending.
4. If top score is more than 10% ahead of #2 → **clear winner** (auto-assign).
5. If within 10% → **tiebreaker**: rep who hasn't gotten a lead in the longest time wins.
6. If everyone has identical assignment history → round-robin counter.

Each scoring step is logged. Every assignment gets a `reason` string like:

> "Hunter Rivers: installProximity 16.8 (Harold Brown 0.18mi, recency 0.6x) + contactProximity 6.3 (Larry Osborn 1.06mi, recency 0.9x)"

---

## The recency decay (one of the more clever bits)

Old version: cliff at 90 / 365 / 730 days. Day 91 dropped 30% overnight.

New version: smooth exponential `multiplier = 0.1 + 0.9 × exp(-days / 180)`. Day-over-day changes are gentle.

| Days old | Multiplier |
|----------|-----------|
| Today | 1.0 |
| 30 days | 0.86 |
| 90 days | 0.55 |
| 180 days | 0.32 |
| 365 days | 0.18 |
| 730+ days | 0.10 (floor) |

This means a recent install nearby is worth roughly 10× a 2-year-old install. The "neighbor pitch" stays sharp.

---

## Suggest mode (the future of dispatching)

Admin can flip a switch: **Auto** (immediate assignment) or **Suggest** (top 3 candidates surfaced for dispatcher pick).

In Suggest mode:
- Algorithm produces top-N candidates with reasons.
- A dispatcher reviews and confirms.
- Until confirmation, the lead is `finalDisposition: pending-manager-pick`.
- Sweet spot use case: high-value insurance leads, where human judgment beats pure proximity.

---

## The outcome loop (what makes the system self-improving)

We don't just log "assigned to rep X." We log what happened afterward:

- First contact attempt time
- First customer connection time
- Estimate created (and dollar value)
- Job sold (and amount) OR job lost (and reason)
- Reassignment if any
- Final disposition: closed-won / closed-lost / ghosted / reassigned-out

Every 90 days, this lets us ask: "given these outcomes, which factor weights *would have* maximized closing rate?" That's the quarterly recalibration ritual — recommended by Claude, reviewed by Chris, applied by hand.

This is the realistic substitute for "AI self-tuning routing," which doesn't actually exist in any mature competitor product (LeadAngel claims it but the algorithm is undocumented; everyone else does manual recalibration).

---

## What's hardened, what's not (anti-gaming honesty)

| Gaming method | Currently | Defense planned |
|---------------|-----------|-----------------|
| Flip "contacted" without a real call | Possible | Require phone-system log entry |
| Refuse junk leads to inflate close rate | Possible | Auto-declines count as losses |
| Show up at meeting, leave early | Possible | Geofenced check-in + check-out |
| Activity stuffing (fake tasks/notes) | Possible | Count only verifiable activity |
| Sit on lead → auto-reassign to buddy | Possible | Reassignment skips referral cluster |
| GPS spoof proximity | Possible | Require 14-day real-site visits |
| Self-refer through buddy | Possible | Referrer must be verified prior contact |

These are all known. They're tracked in `docs/lead-distro-gap-analysis.md`. Most ship in v2.1 or v2.2.

---

## Glossary (NotebookLM should index these)

- **Algorithm** — the scoring logic in `lib/lead-distribution-service.ts`
- **Factor** — one of the 7 weighted inputs (install proximity, etc.)
- **Weight** — how much a factor contributes (0–100); enabled factors must sum to 100
- **Score** — a rep's total weighted score for a particular lead
- **Round-robin** — fallback rotation when scores tie
- **Tiebreaker** — secondary rule (default: longest-since-last assignment)
- **Suggest mode** — manager picks from top N instead of auto-assign
- **SLA** — Service Level Agreement; first-contact deadline (5/20/45/60 min escalation)
- **Outcome log** — what happened after assignment (first contact, sold, lost, etc.)
- **Geocoded contact** — a lead, contact, install, or door-knock with known lat/lng
- **Recency multiplier** — exponential decay factor for time since last interaction
- **New-rep boost** — first-30-days score boost for newly hired reps
- **Clear winner gap** — minimum % gap between top and runner-up to skip tiebreaker (default 10%)
- **Dismissed factor** — a factor toggled off; excluded from score and from 100% sum
- **Distribution Log** — sheet recording every assignment with reason + scores
- **Outcome Log** — sheet recording post-assignment events
- **Proximity radius** — distance cutoff for proximity scoring (default 2.0 mi)

---

## Suggested NotebookLM queries to test the notebook

Once uploaded, try these to verify the notebook gives good answers:

1. "Explain the algorithm to a new sales rep in 60 seconds."
2. "What's the difference between Auto and Suggest mode?"
3. "Why didn't I get the lead at 320 Church St SW Huntsville?"
4. "How do I add a new sales rep to the system?"
5. "What's the difference between the Distribution Log and the Outcome Log?"
6. "How does the new-rep boost work and when does it expire?"
7. "What gaming risks does the algorithm currently have?"
8. "Why does proximity matter more than close rate in the default weights?"
9. "What happens when scores are tied?"
10. "How would you recommend tuning if leads are going to far-away reps too often?"
