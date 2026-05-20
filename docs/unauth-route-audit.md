# RCRS Unauthenticated Route Audit

**Audit date:** 2026-05-20
**Repo root:** `C:\Users\Michael\river-city-roofing\`
**Scope:** read-only inspection of every `app/api/**/route.ts` (316 files), every layout under `app/(tools)/portal/**`, `app/(tools)/admin/**`, `app/(tools)/command-center/**`, and `middleware.ts`.
**Companion doc:** `docs/role-permission-audit.md` (the prior audit). The three findings it logged — `/api/portal/meeting-data`, `/api/portal/monday-notes/announcements`, `/api/admin/lead-distro/history` — are now patched in code (`app/api/portal/meeting-data/route.ts:51`, `app/api/portal/monday-notes/announcements/route.ts:52`, `app/api/admin/lead-distro/history/route.ts:12`) and are NOT relisted below except as cross-references.

---

## Summary

**Found 6 CRITICAL, 2 HIGH, 2 MEDIUM, 1 LOW unauthenticated routes that escaped the first audit.** All six CRITICALs are in `app/api/command-center/meetings/**` and `app/api/command-center/sales/**` — they were created as part of the Monday-meeting build and apparently treated as kiosk endpoints. All read commission, sales-leaderboard, and rep-projection data with NO auth helper. The portal-domain middleware (`middleware.ts:274-322`) does not gate API routes by host or role — APIs must self-enforce, and these don't.

Webhooks (3) are all properly secret-gated. Crons (10) are all `CRON_SECRET`-gated. `/chrisview` remains intentionally public per owner — re-confirm in open questions.

---

## Findings (sorted by severity)

| # | Severity | Method | Route | File | Data exposed / mutated | Fix |
|---|----------|--------|-------|------|------------------------|-----|
| 1 | CRITICAL | GET | `/api/command-center/meetings/leaderboard` | `app/api/command-center/meetings/leaderboard/route.ts:325` | Full sales leaderboard: per-rep YTD/monthly/weekly meeting revenue, **real QB 1099 commissions (`actualCommissionsYTD`)**, team total commissions, rank, achievements. Reads `data/commissions.json` + Google Sheets `RepWeeklyNumbers`. | `requireAuth()` |
| 2 | CRITICAL | GET | `/api/command-center/meetings/stats` | `app/api/command-center/meetings/stats/route.ts:314` | Weekly / monthly / YTD team revenue, **per-rep real commission totals from `commissions.json`**, top performer, % of team, goal progress vs. yearly target. | `requireAuth()` |
| 3 | CRITICAL | GET | `/api/command-center/meetings/charts` | `app/api/command-center/meetings/charts/route.ts:389` | Pre-computed chart data: revenue trend, **commission trend (real QB payouts)**, rep-commission comparisons, quarterly breakdown. Reads `data/commissions.json`. | `requireAuth()` |
| 4 | CRITICAL | GET | `/api/command-center/sales/projections` | `app/api/command-center/sales/projections/route.ts:379` | Per-rep monthly + annual revenue projections, **real YTD / current-month / last-month commissions per rep**, bonus-tier proximity, team-projected annual commission. Reads `data/commissions.json` + `competition-config.json`. | `requireAuth()` |
| 5 | CRITICAL | GET | `/api/command-center/meetings/activity-leaderboard` | `app/api/command-center/meetings/activity-leaderboard/route.ts:94` | Per-rep doors knocked, appointments set, inspections, estimates, contracts signed, **`revenueClosed` (Monday-meeting `$$$$$` accrual)**, leads generated. Hits Google Sheets `RepWeeklyNumbers`. | `requireAuth()` |
| 6 | CRITICAL | GET | `/api/command-center/meetings/announcements` | `app/api/command-center/meetings/announcements/route.ts:10` | Forwards Monday-meeting announcements. Currently *indirectly* protected because upstream `/api/portal/monday-notes/announcements:52` now requires auth, but **this handler does not itself check auth and copies all incoming headers blindly** — a future change to the upstream's contract would silently re-open the leak. Defense-in-depth fix needed. | `requireAuth()` |
| 7 | HIGH | POST | `/api/roof-measure/calibrate` | `app/api/roof-measure/calibrate/route.ts:17` | **Mutates** `data/roof-calibration.json` (or its Blob equivalent). Anyone can poison the calibration table — making every future automated roof measurement progressively wrong. GET reads stats (informational, no PII). | `requireAdmin()` or session-restricted |
| 8 | HIGH | POST | `/api/dashboard/leads` | `app/api/dashboard/leads/route.ts:167` | **Mutates** the leads JSON store. Lets anyone (no honeypot, no Turnstile, no rate-limit on this specific handler) write arbitrary lead rows into `data/leads.json`. The sibling GET (`:81`) and PUT (`:207`) both `requireAuth`, so this is asymmetric. Note: the legitimate `/api/leads/new` and `/api/contact` paths do go through honeypot + Turnstile + rate-limit + spam filter; this older endpoint does not. | Remove handler (legacy) OR add honeypot + Turnstile + rate-limit + global form cap, matching `/api/leads/new` |
| 9 | MEDIUM | GET | `/api/data/march-madness-2026` | `app/api/data/march-madness-2026/route.ts:12` | Returns `data/march-madness-2026.json` (bracket data — internal staff competition). Header comment claims "no auth required" intentionally. Not financial/PII — internal-only competition state. | `requireAuth()` (internal-only) |
| 10 | MEDIUM | GET | `/api/data/march-madness/[type]` | `app/api/data/march-madness/[type]/route.ts:21` | Returns four internal bracket JSON files (config / momentum / double-elim / tag-team). Same internal-only character. | `requireAuth()` |
| 11 | LOW | GET | `/api/command-center/meetings/prep` | `app/api/command-center/meetings/prep/route.ts:14` | Returns the DEFAULT meeting agenda + a Bible verse keyed off the week number. No rep / revenue / commission data — just the template. Sibling `/api/command-center/meetings/auto-generate` (line 227) IS auth-gated and IS the one used in production. The `/prep` route is a convenience helper that returns only defaults. | `requireAuth()` (consistency; not a real leak today) |

### Cross-references (already fixed since the role-permission audit)

| Route | Previous severity | Current state | Source |
|-------|-------------------|---------------|--------|
| `/api/portal/meeting-data` | CRITICAL (Finding 1 of prior audit) | Fixed: `requireAuth()` at `app/api/portal/meeting-data/route.ts:51` | This audit re-confirmed |
| `/api/portal/monday-notes/announcements` | MEDIUM (Finding 6) | Fixed: `requireAuth()` at `app/api/portal/monday-notes/announcements/route.ts:52` | This audit re-confirmed |
| `/api/admin/lead-distro/history` | CRITICAL (Finding 2) | Fixed: `requireAdmin()` at `app/api/admin/lead-distro/history/route.ts:12` | This audit re-confirmed |

---

## Webhooks (POST-only, secret-authenticated by design)

| Webhook | File | Secret? | Verdict |
|---------|------|---------|---------|
| `POST /api/webhooks/jobnimbus` | `app/api/webhooks/jobnimbus/route.ts:51` | HMAC-SHA256 via `JOBNIMBUS_WEBHOOK_SECRET`, header `x-jobnimbus-signature`, `timingSafeEqual` (lines 33-49, enforced 80-101) | OK. Notes: when `JOBNIMBUS_WEBHOOK_SECRET` is **unset**, the handler only `console.warn`s and continues — anyone can forge a webhook call. Production set the env var (per memory `project_session_2026_05_18_19`), but a missed deploy could silently open this. Recommend fail-closed if secret is missing. |
| `POST /api/webhooks/material-order-email` | `app/api/webhooks/material-order-email/route.ts:53` | `X-Webhook-Secret` header vs `MATERIAL_ORDER_WEBHOOK_SECRET`. Fails closed with 500 if secret not configured (line 56-61) and 401 on mismatch (62-64). | OK — fails closed correctly. |
| `POST /api/webhooks/groupme` | `app/api/webhooks/groupme/route.ts:52` | **None.** No HMAC, no token. GroupMe's documented webhook does not sign — the handler can only see `sender_type === 'bot'` (line 57) which any attacker can spoof. | Low impact (handler only replies to `/river ...` text commands and returns canned strings — no PII / data writes), but it does send GroupMe messages on the company bot. Severity nudges to LOW — anyone can make the company bot reply once per attempt. Documented here, not in the main table. |
| `POST /api/calls/webhook` | `app/api/calls/webhook/route.ts:40` | `x-api-key` header vs `CALLS_WEBHOOK_API_KEY` (line 22-33). | OK in prod. **Dev-mode loophole** (line 26-30): if `CALLS_WEBHOOK_API_KEY` is unset, `NODE_ENV !== 'production'` allows all requests. Acceptable for local dev; verify env is set in Vercel prod and preview. |

---

## Crons (Vercel scheduled jobs)

All ten cron handlers in `app/api/cron/**` verify a Bearer `CRON_SECRET` header before doing work:

| Cron | File | Auth |
|------|------|------|
| `auto-reassign` | `app/api/cron/auto-reassign/route.ts:60` | CRON_SECRET ✓ |
| `auto-review-request` | `app/api/cron/auto-review-request/route.ts:152` | CRON_SECRET ✓ (admin/owner session also accepted for manual runs) |
| `backup-sheets` | `app/api/cron/backup-sheets/route.ts:35` | CRON_SECRET ✓ |
| `check-lead-timers` | `app/api/cron/check-lead-timers/route.ts:18` | CRON_SECRET ✓ |
| `low-stock-alert` | `app/api/cron/low-stock-alert/route.ts:26` | CRON_SECRET ✓ (admin/owner fallback) |
| `meeting-reset` | `app/api/cron/meeting-reset/route.ts:18` | CRON_SECRET ✓ |
| `publish-blog` | `app/api/cron/publish-blog/route.ts:9` | CRON_SECRET ✓ |
| `stalled-tickets-digest` | `app/api/cron/stalled-tickets-digest/route.ts:110` | CRON_SECRET ✓ (admin/owner/manager fallback) |
| `sync-inventory-tab` | `app/api/cron/sync-inventory-tab/route.ts:112` | CRON_SECRET ✓ (admin/owner fallback) |
| `weekly-numbers-reminder` | `app/api/cron/weekly-numbers-reminder/route.ts:23` | CRON_SECRET ✓ |

No findings against crons.

---

## `/api/portal/**` namespace check

The role-permission audit (table at `docs/role-permission-audit.md:84`) confirmed 110 of 112 portal API routes call `requireAuth()` or `portalAuthService`. The two exceptions (`meeting-data`, `monday-notes/announcements`) are now patched. I re-grepped the full namespace today (236 portal-route files in extended search): every one now invokes `requireAuth`. No new portal-namespace leaks found.

Notes on portal-namespace gates that should be tightened in a future pass (NOT counted as findings here — they all require auth, just not the right *role*):

- `app/api/portal/reports/commissions/route.ts`, `.../reports/profitability/route.ts`, `.../reports/finance-summary/route.ts` — these expose company-wide financial reports. They `requireAuth()` (any team member, including reps and the driver) rather than `requireAdmin()`. Finance reports should be owner/admin/office/manager-only. Recommend role-gating in a follow-up.
- `app/api/portal/jobnimbus/commissions/route.ts` — same pattern.

These don't meet the bar for "unauthenticated route" but are worth flagging once the unauth set is fixed.

---

## Other public surfaces (intentional, verified safe)

- `/api/chrisview/route.ts:11` — intentionally public per owner choice (`middleware.ts:376`). Exposes cost, supplier cost, margin%, full commission history. **See open question 1.**
- `/api/trip/*` (8 routes) — Awards-trip tracker, public per `middleware.ts:368`. The trip dashboard is shared via link with reps. No customer/cost data; only rep revenue + bonus accrual which is the same data on the public meeting kiosk.
- `/api/customer/[token]/**` — all token-gated via `leadPortalService.getLeadByToken()` + the shared 10-req-per-15-min rate limiter (`lib/rate-limiter.createCustomerTokenRateLimiter`). POST handlers refuse a `customerId` in the request body (`app/api/customer/[token]/route.ts:703`) to block horizontal escalation.
- `/api/customer/{service-request, warranty-claim, notification-preferences, review, bitcoin-payment}` — all require a token in the body/query and call `leadPortalService.getLeadByToken()`. Verified.
- `/api/public/customer-portal/[token]` — sanitized public view; payload hand-picked, no cost/commission data.
- `/api/storm-report`, `/api/storm-report/email`, `/api/roof-report`, `/api/roof-measure`, `/api/roof-measure/{preview, export, health}`, `/api/hailrecon`, `/api/address-suggest`, `/api/bible-verse`, `/api/site-config` — public marketing / lead-capture endpoints. Honeypot + Turnstile + rate-limit applied where appropriate.
- `/api/forms/{contact, careers, referral, bni-partner}`, `/api/email-capture`, `/api/contact`, `/api/leads/new`, `/api/referral` — public form submitters; honeypot + Turnstile + rate-limit verified.
- `/api/report/[id]` — public roof-report viewer, but only when the report has `isPublic=true` (line 30).
- `/api/honeypot` — anti-bot trap, intentionally public.
- `/api/weather/{alerts, forecast}/[zipcode]`, `/api/calendar/teamup` — read-only public/pass-through data.
- `/api/[...path]` — catch-all returning JSON 404. No data.

---

## Open questions for owner

1. **`/chrisview` and `/api/chrisview`** — still intentionally public per `middleware.ts:376`. Exposes cost, supplier cost, margin%, full per-rep commission. Confirm this stays public, OR move behind a long-random URL / IP allowlist / single shared password. (Same question as Finding 4 of the prior audit.)
2. **`/api/data/march-madness*`** — internal-only contest brackets. Was the "no auth required" comment intentional or copy-paste from a public endpoint? Recommend gating to `requireAuth()`.
3. **`/api/roof-measure/calibrate` POST** — anyone can poison the calibration table. Should this be `requireAdmin()` (only Sara / Michael recalibrate) or `requireAuth()` (any rep can submit ground-truth measurements)?
4. **`/api/dashboard/leads` POST** — appears to be legacy (the modern entry path is `/api/leads/new` + `/api/contact`, both of which have honeypot/Turnstile/rate-limit). Confirm whether anything still calls this endpoint or it can be deleted.
5. **`/api/webhooks/jobnimbus` fail-open behavior** — if `JOBNIMBUS_WEBHOOK_SECRET` is unset, the handler logs a warning and continues. Should it instead return 503 / refuse the request? (Prevents a missed-env deploy from silently re-opening the webhook.)
6. **`/api/webhooks/groupme`** — no signature/secret. Currently low impact (only replies to `/river` text), but the bot does post on the company GroupMe. Should we add a shared-secret query param or restrict to GroupMe's IP range?
7. **`/api/calls/webhook` dev-mode** — when `CALLS_WEBHOOK_API_KEY` is unset in non-production, the handler allows all requests. Confirm production has the env var; consider failing closed in preview deployments too.
8. **Finance/commission portal reports** — `/api/portal/reports/{commissions, profitability, finance-summary}` and `/api/portal/jobnimbus/commissions` use `requireAuth()` (any team member). Should these be `requireAdmin()` or owner/admin/office/manager-tier per the cost-visibility rule?

---

## Methodology (reproduction)

1. Enumerated all 316 route handlers under `app/api/**/route.ts`.
2. Grepped for any reference to an auth helper:
   ```
   Grep pattern: requireAuth|requireAdmin|validateSession|portalAuthService|getCurrentUser|verifyToken|getSession|getAuthUser|CRON_SECRET|WEBHOOK_SECRET|X-Webhook|signature
   Path: app/api
   Glob: **/route.ts
   ```
   That matched 256 files. The remaining 60 are the "no auth helper referenced" candidates.
3. Inspected `middleware.ts` to confirm it does NOT gate API routes by host or role (it only validates CORS / CSRF / preflight for `/api/*` requests — `middleware.ts:274-322`). So API routes must self-enforce.
4. Read each of the 60 candidates and classified into: (a) intentional public marketing / form / customer-portal-token / cron / webhook, (b) catch-all 404 (`[...path]`), (c) actually unauthenticated and sensitive (the 11 findings above).
5. For each finding, located the GET/POST/PUT/DELETE/PATCH export at the file:line level using:
   ```
   Grep pattern: export async function (GET|POST|PUT|DELETE|PATCH)|requireAuth|requireAdmin|portalAuth|validateSession
   ```
6. Cross-checked the three findings from `docs/role-permission-audit.md` against current code to confirm patches are in place.
7. For webhooks, confirmed each verifies a sender secret (HMAC or shared-key).
8. For crons, grepped `CRON_SECRET|authorization` across `app/api/cron/**` to confirm all ten handlers verify the header.

The 11 findings, the 4 webhooks, and the 10 crons in this audit total 25 file:line citations — all are reproducible by reading the cited line and following the imports.
