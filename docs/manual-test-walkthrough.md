# Manual End-to-End Test Walkthrough
**Date:** 2026-05-21
**Use this when:** before flipping any gate (CUSTOMER_EMAIL_ENABLED, REASSIGN_NOTIFY_ENABLED, JN_AUTOCREATE_ENABLED, RESPONSE_TIME_REPORT_ENABLED). Walk through everything below; if anything fails, hold the flip.

**Time required:** ~30–45 min.

**Gates that should stay OFF for this run:**
```
CUSTOMER_EMAIL_ENABLED          ← unset / false
REASSIGN_NOTIFY_ENABLED         ← unset / false
RESPONSE_TIME_REPORT_ENABLED    ← unset / false
JN_AUTOCREATE_ENABLED           ← unset / false
```

Verify in Vercel project settings → Environment Variables.

---

## 1. Lead distro admin (`/portal/admin/lead-distro`)

Open as Michael (or any owner/admin role).

- [ ] Page loads, no console errors
- [ ] **Routing Mode card** at the top — toggle Auto ↔ Suggest and confirm the "Current behavior:" line updates. Leave on **Auto**.
- [ ] **SLA Breach Queue** panel — shows the 3 synthetic test entries from earlier (TEST — Aaron, TEST — Brendon, TEST — No eligible rep). If you haven't cleaned them up yet, do that now: `node scripts/test-reassignment-queue.mjs --cleanup`.
- [ ] **Calibration Recommendations** — shows "insufficient data" for every factor (correct — no outcome data yet)
- [ ] **Lead Quality Scoring BETA** section — 10 sliders w/ toggles. Toggle one off and confirm:
  - The slider greys out
  - The 100% sum recalculates from the enabled ones
  - The Save Quality Weights button stays disabled if the remaining don't sum to 100
  - Hover the InfoTooltip on each factor to verify the explainer reads cleanly
- [ ] **Algorithm Weights** — same toggle behavior on the 7 main factors
- [ ] **Hover any threshold** (Proximity Radius, Clear-Winner Gap, etc.) — tooltips show recommended ranges
- [ ] **Live Preview** — type "200 Sparkman St NW, Hartselle, AL 35640", hit Preview. Confirm Hunter Rivers ranks #1 with a real score, factor breakdown is visible, no NaN values anywhere.
- [ ] **Geocode Sync stats** — shows ~10K geocoded (or whatever current count is)
- [ ] **Distribution History** — shows recent assignments with the Q-score BETA badge. Hover the badge → factor breakdown tooltip. If empty, no real assignments yet.

**Pass condition:** every interactive element responds; nothing throws; live preview produces sensible scores.

---

## 2. Approval queue (`/portal/admin/approvals`)

Open as Chris, Michael, or Sara. (Other roles → 403.)

- [ ] Page loads
- [ ] **Empty state:** "No pending approvals. All caught up." with a green checkmark icon
- [ ] **Wrong role test:** open as a sales rep (Hunter / Aaron / etc.) — should see 403

To populate it for testing:
1. Open as Hunter or any rep in another tab: `/portal/admin/team-profiles`
2. Select your own rep on the left, edit bio, click **Submit for approval**
3. Refresh the approval queue tab — your edit should appear as an item
4. Verify the **side-by-side diff** renders: current (left) vs proposed (right)
5. Click **Needs changes** with a note like "test reject" — entry disappears, rep sees the rejection note next time
6. Submit again → click **Approve & publish** — entry disappears, sheet row flips to `status: 'published'`, version bumps

**Pass condition:** at least one approval cycle works end-to-end. Sheet row reflects each transition.

---

## 3. Rep profile editor (`/portal/admin/team-profiles`)

Open as any rep (or admin).

- [ ] Rep selector on the left shows the 8 active sales reps
- [ ] **Save draft** keeps editing private (doesn't fire approval)
- [ ] **Submit for approval** flips status — banner shows "Awaiting approval from Chris, Michael, or Sara"
- [ ] **Headshot upload** — pick a JPG, wait for the spinner. Verify the URL written into the field is on `*.public.blob.vercel-storage.com` and the path includes `team-profiles/public/`. The dark-grey-canvas / EXIF-strip happens server-side; the rendered preview should be the standardized WebP.
- [ ] **Truck photo upload** — same behavior, 16:9 aspect
- [ ] **Status banner** appears correctly for: published / pending-approval / needs-changes / draft

**Pass condition:** the photo upload completes, the rendered URL serves a dark-grey-bordered standardized image (not the raw uploaded JPG with EXIF intact).

**Quick verification of EXIF strip:** if you have `exiftool` installed:
```
exiftool <downloaded-standardized.webp>
```
Should show no GPS / camera serial / artist tags — only the WebP basics. If GPS data is still there, that's a regression.

---

## 4. Customer welcome page — preview as customer

Open `/portal/admin/customer-portal-preview` as admin.

- [ ] Page loads, lead picker on left shows recent leads
- [ ] Pick any lead with an `accessToken` — iframe loads showing the customer portal
- [ ] Amber **PREVIEW MODE** banner visible at top of iframe AND bordering the entire panel
- [ ] Tiles render in the order set by `customer-portal-config.json` (default: rep-intro, next-steps, photo-gallery, iko-visualizer, weather-forecast, about-rcrs, contact)
- [ ] **Rep Intro tile** — shows headshot (or initials if no profile uploaded yet), name, bio, certs chips, call button
- [ ] **Next Steps** — green callout with the customer's first name personalized
- [ ] **Photo Gallery** — empty state "Once your project gets underway, photos from the work will appear here"
- [ ] **IKO Visualizer** — black button labeled "Open IKO Roof Visualizer →"
- [ ] **5-Day Forecast** — if the weather cron has run at least once, shows 5 daytime cards. If not, the tile auto-fetches NWS as fallback. Amber disclaimer banner visible.
- [ ] **About RCRS** — chips + phone + website + gallery links
- [ ] **Contact** — call / text / email buttons all use `tel:` / `sms:` / `mailto:` URIs
- [ ] **Footer** — "This page was generated for {customer name}…"
- [ ] **Click any button** — should fire a `tile_interact` event (check `Customer_Portal_Events` sheet a moment later — `isPreview: true` on this row)

**Pass condition:** every tile renders without errors, no internal data leaks (no scores, no factor breakdowns, no rep performance metrics, no lead quality info), no `undefined` strings, no broken images.

**Then test live customer view (not preview):** open `/customer/welcome/[token]?preview=0` directly in an incognito window. Same render, but events fire as `isPreview: false`. This is what an actual customer would see.

---

## 5. Customer Portal Config (`/portal/admin/customer-portal-config`)

Open as owner/admin.

- [ ] **Tiles section** — 7 tiles listed, each toggleable
- [ ] **Toggle "weather-forecast" off** → save → re-open the customer welcome preview → weather tile is gone
- [ ] **Toggle it back on** → save → weather tile returns
- [ ] **Field allowlist** — toggle `favoriteQuote` OFF → save → the welcome page's RepIntroTile no longer renders the quote even if the rep has one
- [ ] **Toggle back ON** → quote returns
- [ ] **Disclaimer text** — edit the weather disclaimer, save, re-open the customer portal preview → the new text appears in the amber banner
- [ ] **Watermark customer first name** — toggle has UI presence (actual watermark fires when photos go through approval pipeline)

**Pass condition:** every toggle has a visible downstream effect on the customer-facing render. NEW fields default to OFF (try adding a random field to Team_Profiles via the sheet directly; it should NOT appear on the customer page).

---

## 6. SLA breach queue end-to-end

- [ ] Run: `node scripts/test-reassignment-queue.mjs` — creates 3 synthetic breaches
- [ ] Open `/portal/admin/lead-distro` → SLA Breach Queue panel
- [ ] Count badge shows **3**
- [ ] Each entry shows: customer name, address, elapsed minutes, original rep, suggested rep with reason
- [ ] Click **Decline** on one — disappears
- [ ] Click **Confirm reassign** on the next — disappears + would have called `recordReassignment` (timer doesn't exist for synthetic leadIds, so it's a no-op downstream — safe)
- [ ] Run `node scripts/test-reassignment-queue.mjs --cleanup` to mark the remaining synthetic ones as resolved-declined

**Pass condition:** UI responds, sheet rows transition through `pending → resolved-reassigned` or `resolved-declined`.

---

## 7. Rep dashboard widgets (`/portal/sales`)

Open as Hunter (or any sales rep).

- [ ] **Response Time card** loads. If no response logs yet, shows empty state.
- [ ] If the rep has logs: shows avg/median/p95 with the SLA breach color (red if any, green if zero)
- [ ] **Leaderboard bars** below — your bar labeled "You", others labeled "Rep A", "Rep B", etc. — no values, no names

**Pass condition:** privacy is preserved — no other rep's actual minutes are visible.

---

## 8. Weather cron + cache

- [ ] Hit `https://rcrsal.com/api/cron/refresh-weather-forecast` with `Authorization: Bearer $CRON_SECRET` — should respond `{ success: true, results: [...] }` with one entry for huntsville-al, status `refreshed` or `skipped-not-due`
- [ ] Check the master sheet `Weather_Forecast_Cache` tab — one row, `fetchedAt` is fresh, `forecastJson` is valid JSON
- [ ] Hit `/api/customer/forecast` (no auth needed) — returns the cached forecast + disclaimer

**Pass condition:** cache populated; one row per location.

---

## 9. Email kill switches — verify nothing fires

In Vercel logs, search for `[CUSTOMER EMAIL BLOCKED]` and `dropped_customer_email_disabled` — if you've triggered ANY customer-touching code path, you should see these log lines. If you see actual `sent` lines for a customer-facing template, that's a bug — investigate immediately.

- [ ] `/api/leads/new` POST with any test payload → check Vercel logs → should see "Would create JN contact for X — JN_AUTOCREATE_ENABLED not set" in the audit log, NOT a real JN write
- [ ] SLA breach cron firing → should see GroupMe announce (if configured) but NO emails to Tia/Destin/Sara/etc.

**Pass condition:** every gate honored. Zero customer-facing emails fire.

---

## 10. Lead distro live algorithm test

Run the existing test harness:
```
node scripts/test-lead-distro.mjs "200 Sparkman St NW, Hartselle, AL 35640"
```

- [ ] Hunter wins with installProximity contribution > 10
- [ ] Reason string emits cleanly
- [ ] Runner-up + gap % logged
- [ ] No NaN anywhere

Then 3 more cities:
- [ ] Decatur (`402 Lee St NE, Decatur, AL 35601`)
- [ ] Madison (`100 Hughes Rd, Madison, AL 35758`)
- [ ] Athens (`100 N Marion St, Athens, AL 35611`)

**Pass condition:** scores match the values in `docs/lead-distro-tuning-results.md` (±0.1 for float jitter).

---

## What success looks like

Everything above checks out. Then you can:

1. **Flip the first email gate** — `REASSIGN_NOTIFY_ENABLED=true` is the lowest-risk because recipients are all internal staff (Tia/Destin/Sara/John/Bart/Chris/Michael). Run for a week, watch the volume.
2. **Flip the weekly report gate** — `RESPONSE_TIME_REPORT_ENABLED=true`. Only Chris + Michael receive. Wait for Monday 7am Central.
3. **Test customer welcome on yourself first** — set up a fake lead with your own email + an `accessToken`, manually trigger `emailService.sendCustomerWelcome()` from a one-off script, verify the email looks right in your inbox. THEN flip `CUSTOMER_EMAIL_ENABLED=true`.
4. **JN auto-create last** — write a test lead through `/api/leads/new`, verify the JN contact appears in JN with all fields correctly mapped, THEN flip `JN_AUTOCREATE_ENABLED=true`.

## If something fails

- **Log into Vercel** → check the recent deployment logs for the error
- **Sheet-related error** → check Google Sheets API quota + service account permissions
- **JN-related error** → check `JOBNIMBUS_API_KEY` is still valid (sometimes rotated)
- **Photo upload fails** → check `BLOB_READ_WRITE_TOKEN` is set
- **Stuck typecheck** → `npx tsc --noEmit` locally to reproduce

Anything that doesn't fit one of these categories: paste the error into the next Claude session, I'll triage.

---

## Cleanup after test pass

- [ ] Run `node scripts/test-reassignment-queue.mjs --cleanup` if any synthetic SLA breaches are still pending
- [ ] Delete any test profiles you created (or leave them with empty bios — won't render)
- [ ] Note any tile/field config changes you made — save them if intentional, revert otherwise

---

## What I'd watch over the first week of real traffic

Once the first gate flips:
- `Customer_Portal_Events` sheet growing — confirms analytics are recording
- `Lead_Reassignment_Queue` rows accumulating (or not — ideally not, that means SLAs are being hit)
- Email-log sheet for `dropped_*` rows — if you see a real customer-facing template DROPPED that should have sent, the gate is too strict
- Vercel function logs for unexpected errors
