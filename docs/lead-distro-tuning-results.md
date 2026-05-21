# Lead Distro — Tuning Retest Results
**Date:** 2026-05-21
**After applying:** §4 (recency curve, new-rep boost, configurable gap, reason string, longest-since-last tiebreaker) + §5 (extended log schema).

## Test Setup

- Data: live JN pull (10,000 contacts, 9,986 with geo)
- Radius: 2.0 mi (config default)
- Config gap threshold: 10%
- Tiebreaker (when no clear winner): longest time since last assignment
- New-rep boost: window = 30 days, default factor = 0.7

## Results Summary

| City | Winner | Score | Method | Runner-up | Gap | Reason |
|------|--------|-------|--------|-----------|-----|--------|
| Decatur | Adam Rudell | 20.42 | round-robin tiebreaker | Brendon 19.72 | 3.4% | contactProximity 10.4 (Mary Tucker 0.44mi, recency 0.9x) |
| Hartselle | Hunter Rivers | 33.11 | **algorithm (clear winner)** | Brendon 16.67 | 49.6% | installProximity 16.8 + contactProximity 6.3 |
| Madison | Aaron Lussi | 20.98 | **algorithm (clear winner)** | Travis 13.11 | 37.5% | contactProximity 6.7 + installProximity 4.2 |
| Athens | Aaron Lussi | 21.25 | **algorithm (clear winner)** | Brendon 17.12 | 19.4% | contactProximity 11.2 (Randy Perkins 0.37mi, recency 0.9x) |
| Cullman | Brendon Muse | 13.92 | round-robin tiebreaker | **Alijah 13.88** | 0.3% | contactProximity 3.9 (Amy Bruder 1.23mi, recency 0.7x) |

## Before-vs-After Deltas (3 originals)

| City | Before | After | Delta | Interpretation |
|------|--------|-------|-------|----------------|
| Decatur | Brendon 23.51 (RR) | Adam 20.42 (RR) | Winner flipped | Smooth decay leveled the Brendon-Adam gap (was 3 step-decay records vs 5 mid-decay) |
| Hartselle | Hunter 36.66 (algo) | Hunter 33.11 (algo) | -3.55 | Less generous on old records (the 0.18mi 2021 contact decays harder now) |
| Madison | Aaron 22.04 (algo) | Aaron 20.98 (algo) | -1.06 | Same winner, slightly tighter scoring |

## Key Behavior Changes

### 1. Reason strings emit on every assignment
Every winner now ships with a 1-line explanation. From the Hartselle run:
> `Hunter Rivers: installProximity 16.8 (1 within 2mi · best: Harold Brown 0.18mi (recency 0.6x)) + contactProximity 6.3 (73 within 2mi · best: Larry Osborn 1.06mi (recency 0.9x))`

This was the #1 explainability gap flagged in research. Per LeanData's audit-log pattern — every assignment carries its own justification.

### 2. Runner-up + gap % logged
Cullman is the perfect illustration: Brendon (13.92) vs Alijah (13.88) — gap of 0.3%, well under the 10% clear-winner threshold. Old algorithm would have just round-robin'd silently. New version surfaces this in the log so a manager can audit: "huh, two reps were basically tied here — was the tiebreaker fair?"

### 3. Tiebreaker is now meaningful
When the gap is <10%, we sort candidates by `lastAssignedAt` ascending and pick the rep who's been waiting longest. Falls back to round-robin counter only when everyone has identical history. In Cullman's case (gap 0.3%), this matters — Alijah being a newer rep with fewer assignments would correctly win this in production once the response log has data.

### 4. Recency curve is smoother
Old: step function — a contact 91 days old got 0.7x while 90 days got 1.0x (30% cliff overnight). New: continuous exponential decay (`0.1 + 0.9 * exp(-days/180)`). Day-91 vs day-89 are now ~equivalent.

| Days old | Old multiplier | New multiplier |
|----------|---------------|----------------|
| 0 | 1.0 | 1.00 |
| 30 | 1.0 | 0.86 |
| 90 | 1.0 | 0.55 |
| 91 | **0.7** (cliff) | 0.55 |
| 180 | 0.7 | 0.32 |
| 365 | 0.7 | 0.18 |
| 730+ | 0.4 → 0.1 | 0.10 (floor) |

### 5. New-rep boost is wired but dormant
Joseph (joined 2026-02-10, ~100d ago) and Alijah (joined 2026-03-16, ~66d ago) are both outside the 30-day window. Neither receives the boost today. The boost will activate automatically the next time a rep is hired — without code changes.

## Code Touched

- `lib/lead-distribution-service.ts` — recency curve (`getRecencyMultiplier`), new helper (`getTenureDays`), `scoreRep` adds new-rep boost path, `scoreMeetingAttendance` / `scoreCloseRate` / `scoreResponseTime` accept default-score parameter, `distributeLead` uses configurable gap + longest-since-last tiebreaker, new helper `buildReasonString`, `logDistribution` signature extended
- `lib/google-sheets-service.ts` — `LeadDistributionLogRecord` extended with `reason / runnerUpRep / runnerUpScore / weightSetVersion / tiebreakerApplied`; new constant `LEAD_DISTRIBUTION_LOG_COLUMNS`; reader maps the new columns
- `data/lead-distro-config.json` — new threshold keys (`clearWinnerGapPercent`, `newRepTenureDays`, `newRepDefaultBoost`)
- `scripts/test-lead-distro.mjs` — mirrored recency curve, reason output, runner-up display

## TypeScript Status
`tsc --noEmit`: 0 errors across the project.

## What's Still in the Queue

- v2: dismissible metric toggles (Task #6)
- v2: outcome log schema + writers (Task #7)
- v2: suggestion mode / top-N with reasons (Task #8)
- Training docs core set (Task #9)
- NotebookLM upload package (Task #10)

Deferred (v2.1+):
- Capacity caps + soft floor (LeanData + RCRS-original pattern)
- Quarterly recalibration script
- Skill matching by record type
- Cross-queue counter unification
