# Lead Distribution Algorithm — Plain-English Explainer

**Audience:** Sales reps, office staff, anyone curious about *why* a particular lead landed in their queue.
**Read time:** ~10 minutes.

---

## 1. What the algorithm is trying to do

When a new lead enters the system — from a web form, JobNimbus, a referral, or a hail-canvass crew — somebody has to decide which sales rep gets it. We could:

- **Round-robin** — alternate down a list. Fair, but ignores who's actually best positioned.
- **Manual assign** — a dispatcher picks. Slow and biased.
- **Algorithm** — score every rep on a few measurable factors, pick the best fit. Fast, consistent, and the reasoning is auditable.

We do the third. The algorithm produces a score per rep, ranks them, and either auto-assigns the top one or hands a short list of suggestions to a dispatcher (depending on **Routing Mode** — see §6).

The key principle: **every assignment must be explainable.** Every lead that gets assigned writes a row to the Distribution Log with the winner, the runner-up, the score breakdown, and a one-sentence reason. If a rep disputes an assignment, that row is the answer.

---

## 2. The 7 factors and what each means

| # | Factor | What it measures | Default weight |
|---|--------|------------------|----------------|
| 1 | **Install Proximity** | How close is the lead to a job this rep has *completed*? | 30 |
| 2 | **Contact Proximity** | How close is the lead to other customers/leads in this rep's book? | 15 |
| 3 | **Door Knock Recency** | Has this rep been knocking nearby recently? | 10 |
| 4 | **Referral Bonus** | Did this rep refer the lead? | 25 |
| 5 | **Meeting Attendance** | Has the rep been showing up for Monday meetings and engaging with leads? | 10 |
| 6 | **Office Lead Close Rate** | Of *office-sourced* leads (Sara/Destin's), what % does the rep close? | 5 |
| 7 | **Response Time** | How quickly does the rep make first contact with new leads? | 5 |

**Weights total 100.** They're admin-editable (Chris can adjust them anytime in the admin panel). Any factor can be **dismissed** entirely (turned off) — the remaining factors still have to total 100 on their own.

---

## 3. How each factor turns into a score

Each factor is normalized to a 0.0–1.0 raw score, then multiplied by its weight. The total is the sum of all weighted contributions.

### 3.1 Install Proximity (×30 default)

The algorithm looks at every roof this rep has *completed* (status = closed/paid) within the **proximity radius** (default 2.0 miles). For each one, it computes:

> `distance_score = 1 - (distance / radius)`
> `recency_score = exp(-days_since / 180)` (smooth decay)
> `combined = distance_score × recency_score`

The rep's install-proximity score is the **best** combined value among all their nearby completed jobs. So a rep who finished a roof at 0.2mi yesterday scores much higher than one who finished a roof at 1.8mi three years ago.

**Why this matters:** The "we just did your neighbor's roof" pitch is the highest-converting line in the business. Reps with recent, nearby completions are best positioned to close the next one.

### 3.2 Contact Proximity (×15 default)

Same formula as install, but counts *contacts and leads* (not just completed jobs). A rep with prior conversations in the area — even if those didn't close — still has more context than a stranger.

### 3.3 Door Knock Recency (×10 default)

If a rep has been canvassing this neighborhood in the last 90 days, they're rewarded. Same proximity + recency math, applied to door-knock records.

### 3.4 Referral Bonus (×25 default)

If a contact came in *because* this rep made the connection (referral source captured), they get a full 25-point bonus. This is one of the few factors that's binary — either the bonus applies or it doesn't.

**Why this matters:** Referrals close at the highest rate of any source. The originating rep already has trust built in. Honoring the referral bonus keeps reps motivated to bring in their network.

### 3.5 Meeting Attendance (×10 default)

Based on the rep's engagement rate from the response log (the % of assigned leads they actually respond to within the SLA). High engagement = high score. Reps with fewer than 3 logged responses default to 0.5 (insufficient data).

**Why this matters:** Monday meetings are non-optional. A rep who skips meetings or ghosts leads is signaling they're not committed; the algorithm reflects that.

### 3.6 Office Lead Close Rate (×5 default)

Specifically tracks the rep's close rate on **office-sourced** leads (created by Sara/Destin) — not self-gen or referrals. This isolates the "could you close a stranger?" skill from the "could you close your buddy?" relationship work.

### 3.7 Response Time (×5 default)

How fast the rep makes first contact. Sourced from two places, in priority order:
1. JobNimbus mined response times (when available)
2. Lead response log (in-portal data)
3. Default 0.5 if neither has data

Scoring curve (faster = higher):
- ≤15 min → 1.0
- ≤30 min → 0.8
- ≤60 min → 0.6
- ≤2hr → 0.4
- ≤4hr → 0.2
- >4hr → 0.1

---

## 4. Tiebreakers and round-robin fallback

If the top rep's score is within **10%** of the runner-up (configurable — `clearWinnerGapPercent`), it's effectively a tie. The algorithm doesn't just pick first-in-list. Instead:

1. **Longest-since-last assignment.** Among the candidates within the gap, pick the rep who's been waiting longest for a lead. Fair to whoever's been overlooked.
2. **Round-robin counter.** If everyone has identical history, fall back to a simple counter that rotates through the eligible candidates.

This is what prevents the "rich get richer" failure mode — top performers don't get to monopolize the queue when others are scoring nearly as well.

---

## 5. New-rep boost

Reps within their first **30 days** at the company get a small boost: their default attendance / close-rate / response-time scores are set to **0.7** instead of the usual 0.5. This compensates for the fact that brand-new reps don't have any historical performance data yet — without this, they'd structurally score at the floor and only ever win round-robin tiebreakers.

The boost sunsets automatically on day 31. No code changes needed.

---

## 6. Auto vs Suggest routing mode

The admin panel has a **Routing Mode** toggle:

- **Auto-assign** (default): the algorithm winner is immediately assigned. Response timer starts. Notifications fire. Done in milliseconds.
- **Suggest mode**: the algorithm produces the top 3 (configurable, 2–5) candidates with reasons. No assignment, no timer. A dispatcher (Chris, Sara, Destin) reviews and confirms.

Suggest mode is right for high-value or complex leads where human judgment beats the algorithm. Auto mode is right when speed-to-lead matters more than perfect routing.

---

## 7. Anti-gaming guardrails

Every reward we offer is theoretically gameable. The system is being hardened over time to prevent abuse — current and planned guards:

| Gaming method | Defense |
|---------------|---------|
| Marking "contacted" without making a real call | Require phone-system log entry (Twilio/CallRail/FreePBX) |
| Refusing junk leads to inflate close rate | Auto-declines count as losses |
| Showing up at meetings but leaving early | Check-in **and** check-out via geofence |
| Fake tasks / notes to look busy | Only count verifiable activity (call >30s, SMS reply, photo with EXIF) |
| Sitting on a lead until it auto-reassigns to a buddy | Reassignment skips prior assignee and their referral cluster |
| GPS spoofing to fake proximity | Proximity requires a real customer address within 14 days |
| Self-referring through a buddy | Referrer must be a distinct verified contact with prior history |

---

## 8. What gets logged on every assignment

Every assignment writes a row to the **Distribution Log** with:
- `logId`, `leadId`, `timestamp`, `address`, `customerName`
- `assignedRep` — the winner
- `algorithmScores` — JSON map of every rep's total score
- `factors` — JSON of the winner's factor breakdown
- `reason` — human-readable one-liner
- `runnerUpRep`, `runnerUpScore` — for transparency
- `weightSetVersion` — which version of the weights drove this decision
- `tiebreakerApplied` — `''` / `'longest-since-last'` / `'round-robin-counter'` / `'pending-manager-pick'`
- `overrideReason` — when a human overrode the algorithm

Separately, the **Outcome Log** tracks what happened *after* assignment:
- First contact attempt + method
- First customer connection
- Estimate created + amount
- Job sold / lost + amount + reason
- Reassignment if any
- Final disposition (closed-won / closed-lost / ghosted / reassigned-out)

The Outcome Log is what makes the system capable of self-improvement over time. Every quarter, we can review which factor weights *would have* maximized closing rate against actual outcomes — and recommend adjustments to Chris.

---

## 9. Glossary

- **Lead** — an unassigned inbound inquiry (form submission, phone call, walk-in, referral note).
- **Distribution** — the moment a lead is assigned to a rep.
- **Score** — a rep's total weighted score for a particular lead (sum of factor scores).
- **Round-robin** — rotate through candidates in order.
- **Tiebreaker** — when scores are within the configured gap %, secondary rule to break the tie (default: longest-since-last assignment).
- **SLA** — Service Level Agreement; how fast the rep must make first contact (currently 5 / 20 / 45 / 60 min escalation).
- **Geocoded contact** — a record (lead, contact, install, door-knock) with a known latitude/longitude.
- **Proximity radius** — the distance (default 2.0 mi) within which contacts count toward proximity scoring.

---

## 10. Cross-references

- Admin walkthrough: `02-admin-walkthrough.md`
- Dispatcher SOP: `03-dispatcher-sop.md`
- FAQ + troubleshooting: `04-faq-troubleshooting.md`
- Algorithm source: `lib/lead-distribution-service.ts`
- Config: `data/lead-distro-config.json`
- Admin UI: `/portal/admin/lead-distro`
