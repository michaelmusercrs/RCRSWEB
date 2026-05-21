# Lead Distro — FAQ + Troubleshooting

---

## General questions

### Q: Why didn't I get that lead?

Open `/portal/admin/lead-distro` → Distribution History. Find the lead. Read the `reason` field — it tells you the winner's top contributing factors. Your score is in the `algorithmScores` JSON map. The most common reasons you didn't win:

- **You had no contacts within the proximity radius** (default 2.0 mi). Your install/contact proximity scored 0.
- **Your contacts were old.** The exponential recency decay means a 2-year-old contact is worth 1/10 of a fresh one.
- **The runner-up had a recent install nearby** while you had only contacts. Install proximity is weighted 2× contact proximity by default.
- **You were within 10% of the winner** and lost the tiebreaker because you'd had an assignment more recently than the winner.

### Q: Why is so much going to round-robin?

If the **clear-winner gap %** threshold (default 10) isn't being beaten often, it usually means the algorithm is over-weighted on factors that don't differentiate reps much. Increase the weight on factors with high variance (typically install proximity, referrals) and decrease the weight on factors with low variance (response time defaults at 0.5 for everyone with no data).

### Q: How do I add a new rep to the system?

1. Add them to `lib/team-roles.ts` with `role: 'sales'` and `isActive: true`.
2. Set their `createdAt` to today's date — the new-rep boost will kick in for 30 days.
3. Add their slug to county preferences in the `Rep_Preferences` sheet (or leave blank for all counties).
4. Add them to `Rep_Availability` sheet with `isReceivingLeads: true`.
5. Test by hitting Live Preview with a test address — they should appear in the ranked list.

### Q: Can I add a new factor?

Not from the UI yet. You'd need to:
1. Add the factor to `LeadDistroConfig.weights` (and `weightsEnabled`).
2. Add a scoring method in `lib/lead-distribution-service.ts`.
3. Wire it into `scoreRep` so it contributes to factors + total.
4. Add metadata to `WEIGHT_META` in the admin page.
5. Default its weight in `data/lead-distro-config.json`.

Track this as a v3 feature: "user-defined factors with formula editor."

---

## Troubleshooting

### "Save button is grey and won't save"

Enabled weights don't total 100. Look at the running count next to the section header. Fix the math.

If they DO total 100 by your math but the save still won't fire: you might have a disabled factor with a non-zero value. The UI ignores it, but the value persists. Click into each disabled factor's input and zero it.

### "The algorithm assigned to someone who shouldn't get leads"

Check rep availability:
- Are they toggled off in the admin Rep Availability panel?
- Is their `adminOverride` flag set in the `Rep_Availability` sheet?
- Did Chris recently re-enable them by mistake?

If they SHOULD be in the pool but a specific lead shouldn't go to them, look at `Rep_Preferences` for that rep — counties they've enabled. The lead's county might not be filtered out.

### "Geocode Sync says 'No new contacts'"

That's correct if nothing has been added to JN since the last sync. If you know new contacts exist:

1. Check JN API status. Open the admin panel; if Geocode Sync errors with "JobNimbus API not configured," the JN key has expired or rotated.
2. Verify by running `node scripts/test-proximity-dryrun.mjs` from the project root — that hits JN directly and shows what records it can see.

### "Distribution History is empty"

The log writes to the `Lead_Distribution_Log` master-sheet tab. If empty:
- No leads have been distributed yet (new system / fresh deploy)
- The service account doesn't have write access (unusual but possible after a credential rotation)
- The sheet was renamed or deleted (look in the master sheet directly)

### "Lead got assigned but no one was notified"

Two possible causes:
1. GroupMe bot not configured. Check `getGroupMeConfigFromEnv()` returns `enabled: true`.
2. Rep's email is missing in `team-roles.ts`. The River Bot DM falls through silently.

Both are non-blocking — assignment still happens, just no comms.

### "Response timer fired but rep says they responded"

Verify what the timer considers "responding." Currently it's based on `lead-response-log.firstContactAt`, which is written by:
- `recordContact(leadId)` API call from the rep's app
- (Future) phone-system log integration
- (Future) JN status change to "Contacted"

If the rep made the call from their cell phone but the system didn't capture it, the timer doesn't know. **This is a known anti-gaming risk** — to be hardened by requiring a verifiable contact event before counting "responded."

### "Two reps got assigned the same lead"

Should be impossible — `distributeLead` is single-writer. If you see it:
1. Check if a manual override was applied AFTER an automatic assignment. The override writes a new log row with the same leadId.
2. Check if the response timer auto-reassigned. The original assigned rep + the reassigned rep both have records.

Neither is a bug; the system shows the most recent owner. Make sure both reps aren't currently working it.

### "Brand new rep is winning every lead"

The new-rep boost gives them 0.7 defaults on attendance / close-rate / response-time (vs 0.5 for everyone else). If they ALSO happen to have recent proximity (e.g., they live in the office's primary territory), they can briefly dominate.

**This is intentional for 30 days** — they need to build a book. After day 30, the boost sunsets and the normal floor applies. If it's a persistent problem, lower the `newRepDefaultBoost` value in the config (default 0.7 → 0.6 or 0.55).

### "Algorithm picked the wrong county"

Check the lead's geocoded `county` field. Nominatim/Google sometimes return the wrong county for border addresses. If a lead is genuinely in Madison County but geocoded as Limestone, county-based rep filtering will misroute it. Manual override is the right fix; reporting it to Michael lets him add a geocoding override rule.

---

## Performance + load

### Q: How fast is an assignment?

Typical: 500–1500ms. Breakdown:
- Address geocode: 100–300ms (cached)
- Sheet reads (parallel): 200–600ms (geocoded contacts, availability, preferences, response logs)
- Scoring: <10ms
- Sheet write (distribution log): 100–300ms
- Notifications (fire-and-forget): 50–200ms

If it ever exceeds 5 seconds, check the sheet API for rate limiting (60 reqs/min/user by default).

### Q: Does it scale?

10K geocoded contacts (current state) is no problem. The per-rep proximity loop is O(contacts/rep × reps), so currently ~10K × 8 reps = 80K distance calcs per assignment — runs in ~5ms.

If we hit 100K+ contacts, we'd want spatial indexing (geohash or quadtree) rather than the linear scan. That's a v3 optimization.

---

## When something is on fire

1. **All assignments failing** — likely the master sheet is down or rate-limited. Check Google's status page; check the sheet directly in a browser.
2. **No leads showing in the queue** — JN webhook might be broken. Check `/api/webhooks/jobnimbus` for recent activity.
3. **Wrong rep getting everything** — rep availability table is corrupted. Check `Rep_Availability` sheet directly. Restore from yesterday's hourly Blob backup if needed.
4. **Customers getting no contact** — SLA timer service is down. Check `/api/cron/check-lead-timers` last run timestamp. If stale, the cron failed.

In any "on fire" scenario: **switch Routing Mode to "Auto"** if it's currently "Suggest" — at least the algorithm will keep assigning while you fix the broken piece.

---

## Related docs

- Algorithm explainer: `01-algorithm-explainer.md`
- Admin walkthrough: `02-admin-walkthrough.md`
- Dispatcher SOP: `03-dispatcher-sop.md`
- Gap analysis (system status + roadmap): `../../lead-distro-gap-analysis.md`
- Tuning retest results: `../../lead-distro-tuning-results.md`
