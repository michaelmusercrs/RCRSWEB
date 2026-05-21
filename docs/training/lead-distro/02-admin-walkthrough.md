# Lead Distro Admin Panel — Walkthrough

**Audience:** Chris, Michael, and any other owner/admin who tunes the system.
**Where:** `/portal/admin/lead-distro` (owner/admin role required).

---

## 1. Layout overview

The admin panel is a single scrolling page with these sections:

1. **Routing Mode** — auto-assign or suggest mode
2. **Algorithm Weights** — seven sliders (must total 100 when enabled), each with on/off toggle
3. **Thresholds** — proximity radius, recency windows, min reps, clear-winner gap %
4. **Response Timers** — escalation timeline (reminder → warning → urgent → reassign)
5. **Live Preview** — type an address, see how the algorithm would score it right now
6. **Rep Availability** — toggle reps in/out of the distribution pool
7. **Geocode Sync** — backfill new contacts into the proximity index
8. **Distribution History** — last 20 assignments with score breakdowns

Save button is in the top-right; changes take effect on save. The button stays disabled until enabled weights total exactly 100.

---

## 2. Routing Mode

The big toggle at the top decides how leads get assigned.

- **Auto-assign** (default): immediate assignment to the algorithm winner. Notifications and SLA timer fire instantly. Best for high-volume, low-touch lead sources.
- **Suggest** (manager picks): algorithm surfaces the top N candidates (default 3, range 2–5) with reasons. The lead is held in a "pending-manager-pick" state until someone confirms in the dispatch queue. Best for high-value leads where human judgment matters.

You can switch back and forth at any time. Existing pending-pick leads keep their state regardless of the toggle.

---

## 3. Tuning weights (the most important section)

Each factor has:
- An **on/off toggle** (the green/grey pill on the left). Off = the factor is fully dismissed from the score and the 100% sum.
- A **number input** (0–100) for the weight.
- A **slider** for visual adjustment.
- A static description below the label (hover-tooltips coming soon — see [[feedback_hover_tooltip_explainers]]).

**The 100% rule applies only to enabled factors.** If you disable Door Knock Recency entirely, the remaining 6 factors must total 100. Re-enable it and the 7 must total 100 again.

### When to adjust weights

| If you observe | Consider adjusting |
|----------------|-------------------|
| Leads going to far-away reps too often | Bump Install Proximity / Contact Proximity, drop Response Time |
| New reps starving | Lower the clear-winner gap % (more ties → more round-robin) |
| Reps gaming response time | Drop Response Time weight or dismiss until phone-log verification is wired |
| Referrers losing leads they sourced | Bump Referral Bonus |
| Reps skipping Monday meetings | Bump Meeting Attendance (immediate consequence) |
| Top closers monopolizing the queue | Lower Office Close Rate weight (the rich-get-richer guard) |

### When to *dismiss* a factor entirely

- The factor's data source is broken or stale (e.g., Door Knock Recency if the canvass team isn't logging hits).
- The factor is being actively gamed and you haven't yet wired the anti-gaming guard.
- You want to experiment with a simpler model (proximity-only) for a week to see what changes.

Dismissed factors show "DISABLED (admin)" in the audit log — clearer than "weight=0" because the intent is captured.

---

## 4. Thresholds

| Setting | Default | What it does |
|---------|---------|--------------|
| Proximity Radius | 2.0 mi | Max distance for any proximity-based factor. Contacts beyond this distance get a score of 0 for proximity purposes (but still count for other factors). |
| Recent Interaction | 90 days | Used in the door-knock recency factor as the "decay window." |
| Stale Interaction | 730 days | Future use — defines the cliff at which contacts are excluded entirely. Not currently enforced; the exponential recency curve handles it smoothly. |
| Min Reps for Distribution | 2 | If fewer than this many reps are eligible (available + within county), the assignment fails. Prevents single-rep over-loading. |
| Clear Winner Gap % | 10 | If the top rep's score is within this % of the runner-up, the algorithm treats it as a tie and falls to the longest-since-last tiebreaker. |
| New Rep Tenure Days | 30 | First 30 days of a rep's tenure they get the new-rep boost on default factors. |
| New Rep Default Boost | 0.7 | Boost value applied to attendance / close-rate / response-time defaults for new reps (vs the standard 0.5). |

**Most-tuned setting:** Proximity Radius. 2.0 mi is the right default for the Tennessee Valley footprint. Bump to 3–5 mi if you start working broader territory (Birmingham, Atlanta). Drop to 1.0 mi in dense urban work where literal neighbors matter.

---

## 5. Response Timers

Four-stage escalation for unacknowledged leads:

| Stage | Default | What fires |
|-------|---------|-----------|
| 1. Reminder | 5 min | Gentle nudge to the assigned rep |
| 2. Warning | 20 min | Escalation to manager (cc'd) |
| 3. Urgent | 45 min | Final "about to be reassigned" warning to rep |
| 4. Reassign | 60 min | Lead auto-reassigns to next-best rep and notifies manager |

Don't drop the Reassign timer below 45 minutes during business hours unless you've validated it with reps — false-reassigns make people angry. **After-hours, consider lengthening to 2-4 hours** so reps aren't punished for being off the clock.

---

## 6. Live Preview

Type an address, hit Preview. The system runs the algorithm with current (unsaved) weights and shows:
- Top rep (highlighted green) and total score
- Every rep's rank + score + reason
- Disqualified reps with the disqualify reason

Use this before saving big weight changes to sanity-check that the result still makes sense. **It's the single best way to avoid breaking lead distribution with a bad tune.**

---

## 7. Rep Availability

Each rep has a toggle. Off = removed from the pool entirely (no leads assigned, period). The toggle persists with the admin's name and a timestamp; reps can also set their own availability from their dashboard (vacation, sick, training).

When a rep is toggled off, an `adminOverride: true` flag is set. The rep can't override that from their side — only admin can re-enable. Use it for performance issues or HR actions.

---

## 8. Geocode Sync

When new contacts come into JobNimbus, they need to be added to the proximity index. The **Geocode All** button:

1. Pulls all JN contacts with built-in geo coordinates (most have these for free).
2. For any without geo, runs them through Nominatim (free, 1 req/sec — rate-limited).
3. Writes them to the `Geocoded_Contacts` master sheet tab.

You should rarely need to click this manually — the system populates incrementally as new leads come in. Click it after a bulk import, or if you suspect the index is stale.

---

## 9. Distribution History

Last 20 assignments with the score breakdown for each. Useful for:
- Audit ("did the algorithm pick the right rep for this address?")
- Spotting patterns (one rep winning every assignment — probably need to bump caps when those ship)
- Debugging complaints ("why did Joseph not get this lead?")

Each row has the timestamp, customer, assigned rep, method (auto / round-robin / manual), and the top 4 factor scores as chips. Click into a row in the future v2.5 release for the full breakdown.

---

## 10. Save flow

1. Make your changes.
2. The save button stays grey if enabled weights don't total 100. Fix the math first.
3. Click Save. The button shows a spinner; settings persist to disk and the response timer config is synced.
4. A green toast confirms success. A red toast shows the error if something failed (most common: weights not summing to 100 because a hidden disabled factor was zero-ed in the form).
5. Changes take effect immediately on the next inbound lead. No restart needed.

**Best practice:** before changing weights significantly, run the Live Preview on 3–5 known-result addresses and screenshot the output. If post-save behavior diverges, you can revert by re-entering the previous numbers.

---

## 11. Things you can't do here yet (coming in v2.1+)

- **Capacity caps** (hourly/daily/weekly per rep). Currently a top closer can hog the queue indefinitely.
- **Soft floor** (minimum leads/week per rep) — the bottom-quartile starvation guard.
- **Per-source overrides** (insurance leads → suggest mode, retail → auto).
- **Quarterly recalibration recommendations** — Claude looks at the outcome log and suggests weight tweaks. Outcome log is shipping now; the recommendation script is next.
- **Hover-tooltip explainers** on every metric. Static descriptions for now; hover tooltips coming.
