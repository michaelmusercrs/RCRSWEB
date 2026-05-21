# Mind Map Outline — Lead Distro System

**For NotebookLM:** After uploading the study guide + core docs, use NotebookLM's Mind Map feature. This file gives the hierarchy NotebookLM should produce — use it as a reference to verify the auto-generated map captures the right structure, or paste sections as customization prompts.

---

## Top-level node: Lead Distribution System

### Branch 1: Why it exists
- Speed-to-lead matters (~9× qualification rate under 5min)
- Manual dispatch too slow at our volume
- Pure round-robin ignores fit
- Roofing CRMs don't ship this natively (except ServiceTitan @ $400-2000/mo)
- RCRS in-house, admin-tunable

### Branch 2: The 7 factors
- Install Proximity (×30)
  - Killer "neighbor pitch"
  - Recent + close = highest score
- Contact Proximity (×15)
  - Customer relationships nearby
- Door Knock Recency (×10)
  - Active canvassing in area
- Referral Bonus (×25)
  - Binary — full bonus or none
  - Originating rep credit
- Meeting Attendance (×10)
  - Lead-response engagement rate
  - Monday meetings non-optional
- Office Close Rate (×5)
  - Office-sourced leads only
  - Isolates closing skill
- Response Time (×5)
  - JN mined → response log → default 0.5
  - Curve: ≤15min = 1.0 down to >4hr = 0.1

### Branch 3: Scoring math
- Each factor: 0–1 raw × weight
- Sum = total score
- Sort reps desc
- Top vs runner-up gap → winner or tiebreaker

### Branch 4: Tiebreakers + fallbacks
- Clear winner gap % (default 10)
- Longest-since-last assignment
- Round-robin counter fallback
- New-rep boost (30-day window, 0.7 defaults)

### Branch 5: Recency decay
- Old: step function with cliffs at 90/365/730 days
- New: exponential `0.1 + 0.9 × exp(-days/180)`
- Smooth day-over-day
- 2yr+ records floor at 0.10

### Branch 6: Routing modes
- Auto — immediate assignment
- Suggest — top N + reasons → dispatcher picks
- Per-source override (v2.1)

### Branch 7: Dismissible toggles (v2 feature)
- Per-factor on/off
- Off = excluded from 100% sum
- Audit log shows "DISABLED (admin)"
- Different from weight=0

### Branch 8: Audit + explainability
- Reason string every assignment
- Runner-up rep + score
- Weight-set version pinned
- Tiebreaker type recorded
- LeanData audit-log pattern

### Branch 9: Outcome loop (v2 feature)
- First contact attempt + method
- First customer connection
- Estimate created + amount
- Job sold/lost + amount + reason
- Reassignment if any
- Final disposition

### Branch 10: Anti-gaming (planned defenses)
- Response time → require phone log
- Close rate → auto-decline = loss
- Attendance → geofence check-in + out
- Activity stuffing → verifiable only
- Reassignment shopping → skip cluster
- GPS spoof → require 14d site visit
- Referral self-deal → verified prior contact

### Branch 11: Admin panel
- Routing Mode select
- Weight sliders + toggles
- Thresholds
- Response Timers
- Live Preview
- Rep Availability
- Geocode Sync
- Distribution History

### Branch 12: Self-improvement (realistic)
- "AI self-tuning" is mostly hype
- LeadAngel claims it, undocumented
- Real practice: quarterly recalibration
- Outcome log → regression → recommended weights
- Manager approves manually

### Branch 13: Defer (v2.1+ roadmap)
- Capacity caps + soft floor
- Per-source overrides
- AI lead-quality scoring (Faraday-style)
- Predicted job value
- Scenario simulation across batch
- Calendar availability check
- Segment by job type (storm/insurance/retail)
- Hover tooltips system-wide

### Branch 14: Glossary
- Factor, weight, score, tiebreaker
- SLA, escalation timeline
- Geocoded contact, proximity radius
- Dismissed factor, new-rep boost
- Distribution log, outcome log
- Auto vs Suggest mode

---

## NotebookLM customization prompt (for Mind Map)

If the auto-generated map is too flat or too granular, regenerate with this:

> "Build a hierarchical mind map of the lead distribution system. Top-level branches: Why it exists, The 7 factors, Scoring math, Tiebreakers, Recency decay, Routing modes, Dismissible toggles, Audit/explainability, Outcome loop, Anti-gaming defenses, Admin panel, Self-improvement, v2.1+ roadmap, Glossary. Each branch should have 3–6 sub-nodes max. Keep terminology consistent with the study guide. Don't expand the 'Anti-gaming' branch beyond the listed methods — those are the canonical list."
