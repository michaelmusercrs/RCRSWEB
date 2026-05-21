# Lead Distro — Gap Analysis & Optimization Plan
**Date:** 2026-05-21
**Inputs:** `research-roofing-crm-lead-distro.md`, `research-general-lead-routing.md`

---

## TL;DR

Our current algorithm (`lib/lead-distribution-service.ts`) scores reps on 7 factors with admin-tunable weights — already **ahead of every roofing CRM surveyed** except ServiceTitan Dispatch Pro (enterprise, $400-$2,000/mo). What's missing falls into 4 buckets:

1. **Anti-gaming guards** — every reward we offer is gameable today (response-time auto-flip, close-rate via decline, meeting attendance without check-out, proximity GPS spoof, referral self-deal, reassignment shopping).
2. **Fairness rails** — no per-rep capacity caps, no soft floor. Top closers can monopolize the queue; new reps and bottom-quartile structurally starve.
3. **Explainability** — we don't emit a human-readable reason per assignment, runner-up isn't logged, no version pinning.
4. **Outcome feedback** — we log the assignment moment, but nothing about what happened after.

This doc is the action list. Sections 4-5 are what gets shipped now; Sections 6-7 feed the v2 build.

---

## 1. Current State (what we have)

✅ 7-factor weighted scoring (install proximity, contact proximity, door-knock recency, referral bonus, meeting attendance, close rate, response time)
✅ Admin weight sliders, must total 100 (`/portal/admin/lead-distro`)
✅ Recency multiplier (1.0/0.7/0.4/0.1 across 90d/1yr/2yr/older)
✅ Round-robin fallback when no clear winner (10% gap threshold)
✅ Live preview UI
✅ Distribution history log (last 20)
✅ Per-rep availability toggle + admin override
✅ Response-timer escalation (reminder/warning/urgent/reassign at 5/20/45/60 min)
✅ Lenient slug matching across `rep.slug`, `rep.name`, and full-name slugified (patched 2026-05-21)
✅ 9,986 records in `Geocoded_Contacts` (backfilled 2026-05-21)

## 2. What we DON'T have (the gaps)

### 2A. Anti-gaming (CRITICAL — every existing reward is gameable)

| Reward | Gaming method | Defense |
|---|---|---|
| Response time | Mobile-app status flip without real call | Require phone-system log entry (Twilio/CallRail/FreePBX) or outbound SMS to count |
| Close rate | Refuse junk leads to inflate % | Auto-decline counts as loss OR requires manager override + reason code |
| Meeting attendance | Show up, leave early | Require check-in AND check-out via geofence (we already have GPS hooks) |
| Activity stuffing | Fake tasks/notes | Weight only verifiable activity (call >30s, SMS reply, photo with EXIF, signed doc) |
| Reassignment shopping | Sit on lead → auto-reassigns to buddy → split commission | Skip prior assignee AND their referral cluster; flag 2-hop chains for manager |
| Proximity spoofing | Sit at office, claim local | Require recent (≤14d) job-site visit at real customer address |
| Referral self-deal | Refer lead through buddy back to self | Referrer must be a distinct verified contact with prior history; flag new-contact referrals |

### 2B. Fairness rails

- ❌ No hourly/daily/weekly per-rep cap. Top performers can hog the queue.
- ❌ No soft floor — bottom-quartile reps starve.
- ❌ No cross-queue counter unification (a rep in multiple pools is double-counted).
- ❌ No auto-skip on no-show / cancel / sick day in the rotation counter.

### 2C. Explainability / audit

- ❌ No reason string per assignment ("highest score under cap; tiebreak: longer since last").
- ❌ Runner-up rep + score not logged.
- ❌ No weight-set version pinning — when weights change, old assignments lose their explainability.
- ❌ Disabled-factor signal absent (can't tell "weight=0" from "intentionally off").
- ❌ Rep-facing view of "why you got this lead" doesn't exist.

### 2D. Outcome feedback

- ❌ Distribution log captures only the assignment event.
- ❌ No `firstContactAttempt` / `firstContactConnect` / `estimateCreated` / `jobSold` / `jobLost` / `reassigned` / `finalDisposition` fields.
- ❌ No way to ask "did our routing actually pick the right rep?"
- ❌ No quarterly-recalibration ritual (the actually-realistic substitute for "self-tuning ML").

### 2E. Must-have features we lack (from competitive research)

| Feature | Source | Value |
|---|---|---|
| AI lead-quality score before routing | AccuLynx Lead Intelligence / Faraday | **HIGH** — we treat $5k repairs same as $40k insurance |
| Predicted job value per lead | ServiceTitan Dispatch Pro | **HIGH** — optimizer uses expected $, not just proximity |
| "Smart Assign" decision-support dropdown for manual override | AccuLynx | **HIGH** — shows close rate / sales / queue / distance next to each rep on manual pick |
| SLA timer with auto-reassign on no-touch | General sales-ops | **HIGH** — we have escalation but not the "rep had no logged contact attempt" trigger |
| Suggestion mode (top-N + reasons, dispatcher picks) | SF Omni-Channel pull, rare elsewhere | **HIGH** — for high-value leads, manager picks from top 3 |
| Batch optimization across daily lead pool | ServiceTitan Dispatch Pro | **MEDIUM** — vs single-lead greedy; rebalance every 5-10 min |
| Re-optimize on a timer (not just events) | ServiceTitan | **MEDIUM** — surfaces canceled/sick reps |
| Calendar availability check | Improveit360 | **MEDIUM** — peek at rep's GCal before assigning |
| Segment model by job type | SF Einstein | **MEDIUM** — separate weight sets for storm/insurance/retail |
| Outcome-logged quarterly recalibration | LeanData best practice | **HIGH** — realistic substitute for "self-tuning ML" |

### 2F. Hard anti-patterns we currently avoid (don't undo)

- We log the algorithm scores — keep doing that.
- We have a round-robin fallback when no clear winner — keep that.
- We don't have black-box ML — good. Keep explanations human-readable.
- We have admin override path — keep it.

---

## 3. v3+ ideas (deferred, not in build queue)

- Skill matching (storm rep vs retail vs solar) — segment by `record_type_name` + roof type
- Lead-quality model trained on closed-won outcomes (after 3 months of outcome log)
- A/B routing (10% holdout for alternate weight set, compare conversion after 60d)
- Cross-queue counter unification (only matters once we have multiple distinct pools)
- Conversation-intelligence post-call scoring (third-party integration only)

---

## 4. SHIP NOW — low-risk algorithm tuning (Task #4)

These are pure-function adjustments to `lib/lead-distribution-service.ts`. No new tables, no UI changes, no schema migration.

### 4.1 Add a reason string per assignment (explainability)

Currently the algorithm picks a winner but no human-readable "why." Add a `reason` string assembled from the top 2 factors. Log to the distribution log. Surface in the existing history UI.

### 4.2 Tiebreaker: longest time since last assignment (LeanData pattern)

When the top score is within 10% of #2 (round-robin trigger), don't pick first-in-array. Pick the rep with the **longest time since their last lead** (from the response log). Falls back to current behavior if no logs.

### 4.3 Recency curve refinement

Current: 1.0 / 0.7 / 0.4 / 0.1 cliff at 90 / 365 / 730 days.
Issue: 91-day jobs drop 30% in a single day. Replace with smooth exponential decay: `0.1 + 0.9 * exp(-days/180)` — gives 1.0 at day 0, 0.55 at 90, 0.32 at 180, 0.18 at 365, 0.10 floor.

### 4.4 New-rep floor (Joseph/Alijah problem)

Reps with <30 days tenure currently score 10.0 (floor only) because they have no historical data. Add a "new rep" boost: if rep's `createdAt` is within last 30 days, treat their `meetingAttendance` / `closeRate` / `responseTime` defaults as 0.7 instead of 0.5 for the first 30 days. Sunsets automatically.

### 4.5 Distance gating (proximity radius enforcement)

Current: 2.0 mi default radius. Anti-gaming: ignore proximity hits where the contact's `lastInteraction` is older than 2 years AND there's no install at that location. Stale contacts shouldn't move scores.

### 4.6 Anti-gaming: require verifiable response

`scoreResponseTime` should only count log entries where `responseMinutes > 0` AND a corresponding verified contact event exists (call log, SMS log, or status change with a `verifiedBy` field). For now just log a warning if `responseMinutes` is set but no verified event — don't enforce hard yet (we don't have the verified events captured).

### 4.7 Round-robin gap threshold made configurable

Currently hardcoded at 10% in `lead-distribution-service.ts:720`. Move to `data/lead-distro-config.json` as `thresholds.clearWinnerGapPercent`. Default stays 10.

---

## 5. SHIP NOW — extend the distribution log (Task #4 continued)

Add fields to `LeadDistributionLogRecord` (and the corresponding sheet schema):

- `reason: string` — auto-generated explanation
- `runnerUpRep: string`
- `runnerUpScore: number`
- `weightSetVersion: string` — currently the `updatedAt` from config (cheap version pin)
- `tiebreakerApplied: string | ''` — e.g., "longest-since-last", "new-rep-boost", or empty

These slot into existing infrastructure. Backfill empty strings for old rows.

---

## 6. V2 BUILD (Tasks #6-8)

### 6.1 Dismissible metric toggles (Task #6)

Per-factor: slider 0–100 **plus** an on/off boolean. Disabling removes the factor from the sum (other enabled factors rebalance to total 100% of *enabled* weight). When disabled, the audit log shows "DISABLED (admin)" not "weight=0."

Config schema becomes:
```json
{
  "weights": {
    "installProximity": { "weight": 30, "enabled": true },
    "contactProximity": { "weight": 15, "enabled": true },
    ...
  }
}
```

Backwards compat: if value is a number (old format), treat as `{ weight: N, enabled: true }`.

### 6.2 Outcome log schema + writers (Task #7)

New sheet tab `Lead_Outcome_Log` with columns:
- `logId` (FK to distribution log)
- `leadId`, `assignedRep`
- `firstContactAttemptAt`, `firstContactConnectAt`, `firstContactMethod` (call/SMS/email)
- `estimateCreatedAt`, `estimateAmount`
- `jobSoldAt`, `jobSoldAmount`, `jobLostAt`, `jobLostReason`
- `reassignedAt`, `reassignedTo`, `reassignReason`
- `finalDisposition` (closed-won / closed-lost / ghosted / reassigned-out)
- `dispositionAt`

Writers triggered from:
- `lead-response-timer` events (first contact attempt logged on call/SMS event)
- JN webhook handlers (status change → estimate / sold / lost)
- Manual entry from dispatch page (catch-all)

### 6.3 Suggestion mode (Task #8)

Config: `routingMode: 'auto' | 'suggest'` (default `auto` for backwards compat).

In `suggest` mode:
- `distributeLead()` returns top 3 candidates with reasons, does NOT write an assignment to JN
- Dispatch page renders 3-up cards with "Assign" buttons
- Optional: per-source override (e.g., insurance leads → `suggest`, retail → `auto`)
- Auto-fallback: if no manager action within configurable minutes, assign top-1 anyway (so the lead doesn't sit)

### 6.4 Capacity caps (deferred to v2.1 — NOT in initial build)

Per-rep daily/weekly cap fields on rep availability record. Once hit, rep is skipped until window resets. Combine with a soft floor (minimum/week) for the bottom-quartile guard. Defer because it touches the algorithm + UI + rep-status table; can be its own milestone.

---

## 7. Quarterly recalibration ritual (V2.5 — script only, not interactive)

Script: `scripts/lead-distro-recalibrate.mjs`. Takes 90 days of outcome log. Runs regression: which factor weights *would have maximized* close-rate? Outputs recommended new weights with confidence intervals. Manager reviews and applies via the admin UI. **Not auto-applied.**

---

## 8. Build sequence (this session)

1. ✅ Research complete
2. ✅ Gap analysis complete (this doc)
3. 🔄 Apply tuning from §4 + §5
4. 🔄 Retest (Decatur/Hartselle/Madison + Athens/Cullman)
5. 🔄 Build v2.1: dismissible toggles
6. 🔄 Build v2.2: outcome log schema + writers
7. 🔄 Build v2.3: suggestion mode
8. 🔄 Training docs
9. 🔄 NotebookLM package

Capacity caps + recalibration script deferred.
