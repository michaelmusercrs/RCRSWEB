# Sweep-Branches Env-Inert / Safe-Default Check

**Date:** 2026-05-20
**Scope:** verify each `sweep/*` branch's new feature defaults to OFF or harmless behavior when its required env is unset, OR renders an empty state safely.
**Method:** static review via `git show <branch>:<file>`. No branches modified.

---

## Verdict Table

| Branch | Check | Verdict | Notes |
|---|---|:---:|---|
| `sweep/review-automation` | `ENABLE_REVIEW_REQUESTS` default-OFF | **INERT** | Two-env gate documented in cron header. Without `ENABLE_REVIEW_REQUESTS=true` the email-service template allowlist drops every `review-request` send; without `NEXT_PUBLIC_GOOGLE_REVIEW_URL` the sender refuses to fire. Cron is parked under `_disabledCrons` in vercel.json. |
| `sweep/storm-magic-link` | `NEXT_PUBLIC_SITE_URL` fallback works | **INERT** | `lib/storm-report-share.ts:buildShareUrl()` falls back to `https://www.rivercityroofingsolutions.com` when env unset. No crash. |
| `sweep/hail-canvass` | Canvass admin page doesn't crash if `Geocoded_Contacts` tab is empty | **INERT** | `findAddressesInZone()` returns `[]` cleanly when no contacts match (or sheet is empty). The generate-route response shape includes `addresses: [], count: 0`; the React page renders the results section but with empty list (no crash). Route gated behind `requireRoleAtLeast(['owner','admin','manager'])`. |
| `sweep/insurance-claims` | Customer-side empty state renders if no claim exists | **INERT** | `app/(tools)/customer/dashboard/page.tsx` insurance tab renders explicit empty-state copy: "No insurance claim on file" with rep-help guidance (line 2126). Fetch on tab open silently swallows errors per code comment ("Silent — the tab renders an empty-state when no claim exists"). |
| `sweep/portal-completion` | Billing tab renders if there are no invoices (empty state) | **INERT** | `invoices.length === 0` branch (line 1308) renders "No Invoices Yet" with Receipt icon and friendly copy. Token-auth check returns 401 cleanly; loading and error states are also covered. |
| `sweep/portal-messaging` | UI banner explains master kill-switch is active | **NEEDS-FOLLOWUP** | No always-visible static banner. Only shows a `sendBanner` AFTER a send attempt that returns 202 + `skipped: true`: "GroupMe sends are paused (master kill switch is on). Message recorded but not delivered." A quiet-hours banner exists but it's gated on the `quietHours` state (8pm-7am window) — separate concern from the master kill-switch. **Recommend:** add a persistent top-of-page banner when `GROUPME_FORCE_SEND !== 'true'` so reps know upfront before they type. |

---

## Branches NOT Covered by This Pass

The audit also flagged these as not env-inert; not in this task's scope but noted for owner review:

- `sweep/phone-system` — FreePBX/VoIP integration. Any outbound HTTP to the PBX would fire on first request unless the PBX hostname is unset (per audit M6).
- `sweep/monday-prep-autofill` — cron is parked under `_disabledCrons` (correct).
- `sweep/tv-leaderboard`, `sweep/design-refresh`, `sweep/profile-self-service` — no external service calls flagged.

---

## Summary

- **5 of 6 INERT** as required.
- **1 NEEDS-FOLLOWUP**: `sweep/portal-messaging` — add a persistent kill-switch banner. Do not fix on the sweep branch per owner instructions; address before/at merge.
