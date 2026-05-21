# Lead Distro — Stage-by-Stage Inspection
**Date:** 2026-05-21 (session 2 — pre-deploy QA pass)
**Scope:** Every stage of the pipeline traced for edge cases, loopholes, and silent failures. Findings + fixes applied in this same pass.

---

## Method

Walked every code path in `lib/lead-distribution-service.ts` + `lib/google-sheets-service.ts` + `lib/geocode-sync.ts` + `lib/lead-response-timer.ts` + the admin UI page. For each function I asked: what happens with empty input? bad input? missing fields? upstream failure? concurrent calls? server restart?

Issues found and **fixed in the same commit**. Issues found and deferred (low-risk or out of scope) are tagged "DEFERRED" with a rationale.

---

## Stage 1: Geocoding (lib/geocoding-service.ts + Nominatim)

| Input | Result | Status |
|-------|--------|--------|
| Empty address | Returns null (Nominatim no-results) — caller already handles | ✅ OK |
| Missing Google Maps key | Falls through to Nominatim (free, no key) | ✅ OK |
| Address with unicode | URL-encoded correctly via `encodeURIComponent` | ✅ OK |
| Nominatim 429 rate limit | Caller does not retry; error propagates | DEFERRED — low traffic, real users get rate-limited at 1 req/sec which we honor |
| Coords (0, 0) "null island" | Would be valid in haversine math; meaningless in practice | DEFERRED — no Birmingham address would geocode to 0,0 |
| Truncated/abbreviated address | Nominatim is forgiving; falls back to coarse match | ✅ OK |

## Stage 2: Geocoded contacts read (`getGeocodedContacts`)

| Input | Result | Status |
|-------|--------|--------|
| Sheet empty | Returns `[]` | ✅ OK |
| Row with lat="" / lng="" | Filtered by `c.lat && c.lng` (truthy check) | ⚠️ **Half-correct** — strings filter okay, but malformed strings like "abc" pass through |
| Row with lat="abc" / lng="def" | `parseFloat` returns NaN; downstream haversine produces NaN scores → algorithm corrupts | 🔴 **BUG — FIXED** (filter post-parse for NaN) |
| Row with stray whitespace | parseFloat handles leading whitespace; trailing units like "34.6N" cause NaN | 🔴 **BUG — FIXED** (NaN filter catches it) |
| Service-account auth failure | Caller already has try/catch | ✅ OK |
| 10K+ rows | Currently fine; O(n) scan but n is small | ✅ OK at current scale |

## Stage 3: `calculateRepScores`

| Scenario | Result | Status |
|-------|--------|--------|
| `getSalesReps()` returns empty | Loop doesn't run; returns `[]`; `distributeLead` throws "No eligible sales reps" | ✅ OK |
| `config.weights.installProximity` missing (manual JSON edit) | Multiplies undefined → NaN propagates | 🔴 **BUG — FIXED** (`?? 0` default per factor) |
| All reps score 0 | `hasClearWinner = top.totalScore > 0` is false → tiebreaker → all `lastAssignedAt` empty → round-robin counter picks first eligible | ✅ OK (correct degraded behavior) |
| All reps score identical | gap = 0 → tiebreaker → longest-since-last sorted; if tied, round-robin counter | ✅ OK |
| Server cold start, round-robin counter at 0 | First several leads go to first rep in array — uneven start | ⚠️ **Known limitation** — DEFERRED (persistent counter is v2.1) |
| Concurrent assignments | Round-robin counter is process-local, not synchronized across Vercel function instances | ⚠️ **Known limitation** — DEFERRED to v2.1 (Redis/KV counter) |

## Stage 4: `scoreRep`

| Scenario | Result | Status |
|-------|--------|--------|
| Rep with no `createdAt` | `getTenureDays` returns Infinity → never isNewRep — safe | ✅ OK |
| Missing `config.thresholds` keys | All reads use `?? default` — safe | ✅ OK |
| Lead county unknown (geocode returned empty county) | `if (preferences && leadCounty)` skips county filter — rep stays eligible | ✅ OK |
| Rep has `countiesEnabled` JSON malformed | `try/catch` swallows — rep stays eligible | ✅ OK |
| Rep has 0 contacts at all | All proximity factors return 0; default factors fire (0.5 or new-rep boost) | ✅ OK |
| Distance > radius for every contact | Proximity scores 0 | ✅ OK |

## Stage 5: Tiebreaker (longest-since-last)

| Scenario | Result | Status |
|-------|--------|--------|
| All `lastAssignedAt` empty | Sort is stable, all equal → falls to round-robin | ✅ OK |
| Some empty, some populated | Empty strings sort before any ISO date → never-assigned wins | ✅ Correct intent |
| Date strings malformed | `new Date(invalid).getTime() = NaN` → NaN-aware sort treats them as min — empty-string-equivalent | ⚠️ Acceptable, but document |
| Two reps with identical `lastAssignedAt` | Stable sort keeps array order; falls into round-robin path correctly | ✅ OK |

## Stage 6: Manual override

| Scenario | Result | Status |
|-------|--------|--------|
| `overrideRepSlug` not in active reps | Throws "Override rep not found" | ✅ OK |
| `overrideRepSlug` is a real rep but marked unavailable | **Currently no check** — assignment goes through to a rep who shouldn't get leads | 🔴 **BUG — FIXED** (warn but allow with `[OVERRIDE-AVAIL]` flag in log) |
| `overrideRepSlug` is admin-overridden off | Same as above | 🔴 **FIXED** in same patch |

## Stage 7: Suggest mode

| Scenario | Result | Status |
|-------|--------|--------|
| 0 eligible reps | Same throw as auto mode | ✅ OK |
| <suggestionCount eligible | Returns whatever is available | ✅ OK |
| Log row writes `assignedRep` = winner even though no one is actually assigned | Misleading — log says X was assigned, but no timer / no notifications fired | 🔴 **BUG — FIXED** (assignedRep written as empty in suggest mode; `overrideReason` set to `Suggest mode — awaiting manager pick`) |
| Suggest mode + manual override | The override path runs first (before mode check) so manual still works | ✅ OK |

## Stage 8: Distribution log write

| Scenario | Result | Status |
|-------|--------|--------|
| Sheet write fails | try/catch logs, does not throw — assignment still proceeds | ✅ OK (intended: writes are best-effort) |
| logId collision | Possible but extremely unlikely (date + 6-char random base36) — would overwrite | ⚠️ Document; DEFERRED — increase entropy if it ever happens |
| Schema mismatch (old sheet, new code) | `getOrCreateSheet` updates header; existing rows missing new columns return empty string for those fields | ✅ OK |

## Stage 9: Outcome log stub

| Scenario | Result | Status |
|-------|--------|--------|
| Outcome write fails before log write succeeds | logId exists in distribution log, no outcome row — recoverable (next event upserts) | ✅ OK |
| Suggest mode: stub written with `pending-manager-pick` | Correct | ✅ OK |
| Auto mode override path: stub written with `finalDisposition: open` | Correct | ✅ OK |
| Manual override: **no outcome stub written today** | The manual path skips the stub write that the auto path does | 🔴 **BUG — FIXED** (manual override also writes outcome stub) |

## Stage 10: Notifications

| Scenario | Result | Status |
|-------|--------|--------|
| GroupMe config missing | `if (gmConfig.enabled && gmConfig.botId)` guards | ✅ OK |
| Rep email missing | `if (repEmail)` guards | ✅ OK |
| All notifications fail | Fire-and-forget; logged | ✅ OK |
| Suggest mode | No notifications fire (we return early) — but a dispatcher would need to know there's a pending pick | ⚠️ **Future feature** — DEFERRED to v2.5 when pending-pick UI ships |

## Stage 11: Admin dashboard

| Scenario | Result | Status |
|-------|--------|--------|
| User disables a factor while remaining weights total 100 | Save button STAYS disabled because enabled total drops below 100 — user has to manually rebalance | ⚠️ **UX wart — FIXED** (auto-rebalance prompt: when toggling off, show inline hint to redistribute) |
| Hover tooltips on metrics | Static descriptions only today; no hover-tooltip pattern | 🔴 **Per [[feedback_hover_tooltip_explainers]]** — adding now |
| "Recommended range" hints | Absent on threshold/timer inputs | 🔴 **Adding now** |
| Routing mode toggle has no "current behavior" indicator | Hidden behind the dropdown — user can't see at-a-glance | 🔴 **Adding now** |
| Configuration is admin-editable per [[update-config]] pattern | Yes via API | ✅ OK |

---

## Fixes Applied (this pass)

1. **Lat/lng NaN filter** — parse first, filter out NaN. Prevents algorithm corruption from malformed geocode rows.
2. **Missing weight defaults** — every `config.weights.X` reference now `?? 0`. Prevents NaN from manual JSON edits.
3. **Override availability check** — when admin manually overrides to an unavailable rep, the log captures `[OVERRIDE-AVAIL-WARN]` so audit shows the bypass.
4. **Suggest mode log clarity** — `assignedRep` empty (not the algorithmic winner) when pending; `overrideReason` set to "Suggest mode — awaiting manager pick" for unambiguous audit.
5. **Manual override outcome stub** — parity with auto mode; every assignment creates an outcome log row.
6. **Hover tooltips** — every metric, weight, threshold, and timer in the admin panel now has a Radix Tooltip explaining: what it measures, recommended range, effect of changing.
7. **Recommended-range hints** — inline next to threshold/timer inputs.
8. **Routing mode current-state indicator** — visible at the top of the panel ("Current mode: Auto — leads assigned in milliseconds").
9. **Disable-and-rebalance hint** — when toggling off a factor, panel shows a one-line hint with the new sum and how to redistribute.

## Deferred (with rationale)

- **Round-robin counter persistence** — needs Redis/KV; v2.1.
- **logId collision** — astronomically unlikely; revisit if it happens.
- **Suggest mode notifications** — needs pending-pick queue UI to be useful; v2.5.
- **Null-island geocode (0,0)** — no Alabama address geocodes there.
- **JN 429 retry** — low actual rate.

---

## Verification Plan

Same retest as before (5 cities) plus three negative tests:
1. Synthetic record with `lat="abc"` injected into the test script — should be filtered out.
2. Manual override to an admin-disabled rep slug — should log warning, still assign (admin's choice).
3. Suggest mode flag set in test script — should return top 3 with reasons, no actual "assigned" claim.

Results in: `docs/lead-distro-tuning-results.md` (appended).
