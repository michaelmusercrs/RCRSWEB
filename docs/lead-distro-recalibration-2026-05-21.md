# Lead Distro Recalibration — 2026-05-21

**Window:** last 90 days
**Total assignments analyzed:** 2
**With outcome data:** closed-won 0 · closed-lost 0 · ghosted 0 · still-open 0 · pending-pick 0
**Parsed factor rows:** 0 of 2

## Method

For each completed outcome we examined the winning rep's factor-score breakdown (the `factors` column on the distribution log). We then averaged each factor's contribution across closed-won vs closed-lost outcomes. A factor that contributes meaningfully more to wins than losses is a candidate for a weight increase; the inverse is a candidate for trimming. **Recommendations are never auto-applied** — a manager reviews and decides.

Heuristic floor: each bucket needs ≥10 rows before any recommendation fires. Below that, the report says "insufficient data" — no recalibration is justified.

## Recommendations

| Factor | Action | Δ (won − lost) | won avg | lost avg | Rationale |
|--------|--------|----------------|---------|----------|-----------|
| `installProximity` | **INSUFFICIENT DATA** | 0.00 | 0.00 | 0.00 | Need ≥10 closed-won and ≥10 closed-lost rows; have 0/0. |
| `contactProximity` | **INSUFFICIENT DATA** | 0.00 | 0.00 | 0.00 | Need ≥10 closed-won and ≥10 closed-lost rows; have 0/0. |
| `doorKnockRecency` | **INSUFFICIENT DATA** | 0.00 | 0.00 | 0.00 | Need ≥10 closed-won and ≥10 closed-lost rows; have 0/0. |
| `referralBonus` | **INSUFFICIENT DATA** | 0.00 | 0.00 | 0.00 | Need ≥10 closed-won and ≥10 closed-lost rows; have 0/0. |
| `meetingAttendance` | **INSUFFICIENT DATA** | 0.00 | 0.00 | 0.00 | Need ≥10 closed-won and ≥10 closed-lost rows; have 0/0. |
| `closeRate` | **INSUFFICIENT DATA** | 0.00 | 0.00 | 0.00 | Need ≥10 closed-won and ≥10 closed-lost rows; have 0/0. |
| `responseTime` | **INSUFFICIENT DATA** | 0.00 | 0.00 | 0.00 | Need ≥10 closed-won and ≥10 closed-lost rows; have 0/0. |

## Sample sizes

- **Closed-won**: 0
- **Closed-lost**: 0
- **Ghosted**: 0 (no contact attempt logged — these are leads we never even tried on)
- **Still open**: 0 (not yet resolved; excluded from analysis)
- **Pending manager pick**: 0 (suggest-mode; excluded)

## How to apply

1. Open `/portal/admin/lead-distro` in the admin panel.
2. Review the recommendations above. Sanity-check each against your read of the team.
3. For each `RAISE` recommendation, increase that weight by 3–5 points; for each `LOWER`, decrease by the same. Redistribute to factors marked `HOLD`.
4. Use Live Preview on 3–5 known-result addresses to confirm the new weights still produce sensible results.
5. Save. Changes take effect on the next inbound lead.
6. Re-run this script in 90 days. The system learns from outcomes; you tune the response.

Script: `scripts/lead-distro-recalibrate.mjs` · run any time, no side effects.