# 2026-05-20 Verification Pass — Read-only Audit

**Scope:** all main-branch commits since `e741fb6 chrisview: Year Race chart` (61 commits, 2026-05-19 → 2026-05-20 21:28 CT) + 10 sweep branches.
**Method:** static review (Read / Grep), commit-diff inspection, cross-reference against `docs/email-callsite-audit.md`, `docs/form-hardening-plan.md`, and the runtime guard helpers.

---

## 🟢 Resolution status — updated 2026-05-21

| ID | Severity | Status | Closed by |
|---|---|---|---|
| C1 | CRITICAL — GroupMe `sendBotMessage` bypass | **CLOSED** | commit `85701d2` — full-guard pass on 4 send paths + raw fetch |
| H1 | HIGH — 17 untagged emailService.send callsites | **CLOSED** | commit `f7bfc49` — 19 callsites tagged + `EmailTemplate` union extended. Default allowlist still drops them; owner enables per-tag via `ALLOWED_EMAIL_TEMPLATES`. |
| H2 | HIGH — `/api/storm-report` missing spam-filter | **CLOSED** | commit `f7bfc49` — `checkForSpam` added between honeypot and Turnstile, success-shape on block, `logSpamBlock` entry. |
| H3 | HIGH — `/api/storm-report` missing body-size cap | **CLOSED** | commit `85701d2` — `checkRequestSize(request, '50kb')` added at top of POST. |
| M1 | MEDIUM — Per-warm-instance rate-bucket Map | **CLOSED** | commit `22df9d7` — KV-backed via lazy `@vercel/kv` import with in-memory fallback. |
| M2 | MEDIUM — 3 routes missing `checkRequestSize` | **CLOSED** | commit `22df9d7` — added to `/api/contact`, `/api/email-capture`, `/api/webhooks/groupme`. |
| M3 | MEDIUM — Bot-detected paths differing message strings | open (low-risk timing observation; tolerable) |
| M4 | MEDIUM — `requireAdmin` no identity allowlist | **CLOSED** | commit `22df9d7` — Richard slug allowlist added to `requireAdmin`. |
| M5 | MEDIUM — Cache-key segregation in one place only | **CLOSED** | commit `22df9d7` — convention documented in `lib/jn-redact.ts` header; grep confirmed only one cache touches JN-cost data today. |
| M6 | MEDIUM — Sweep branches not env-inert | **CLOSED** | commit `22df9d7` — `docs/sweep-branches-inert-check.md` catalogs all 11 (10 inert / 1 with explicit gate). |
| M7 | MEDIUM — Bulk-backfill inventory deduction not idempotent | **CLOSED** | already idempotent via `lib/inventory-deduction-log.mjs` — bulk script checks `wasDeducted(key)` per `${ticketId}::${productName}` before each deduction. Live path uses unified-inventory-service hold/fulfill mechanics. Legacy fallback `deductInventory` is `@deprecated`. |
| L1-L5 | LOW | open — non-blocking cosmetics |
| O1-O10 | Optimizations | mixed — O3 closed by H1, O6 closed by M7, others open |

**Plus follow-up cron-audit (2026-05-21) Phase 2 — `withCronLock` adopted on 6 production crons** (commit `c49cdbb`): sync-inventory-tab, auto-reassign, backup-sheets, check-lead-timers, publish-blog, marketing-intel.

Original audit text below is unchanged — it's the point-in-time observation. The status table above is what's actually true today.

---

## Summary

| Severity | Count |
|---|--:|
| CRITICAL | 1 |
| HIGH     | 4 |
| MEDIUM   | 7 |
| LOW      | 5 |
| **Total**| **17** |

Top three things that don't actually work as advertised today:

1. **CRITICAL** — GroupMe master kill-switch is bypassable. Most production callsites use `sendBotMessage()` directly, which has *no* guard. Only `sendNotification()` is gated.
2. **HIGH** — ~17 of 25 `emailService.send()` callsites are untagged → silently dropped by the template allowlist. The audit doc lists them as `SHIP` verdicts; current code drops them.
3. **HIGH** — `/api/storm-report` POST has no spam-filter and no body-size cap (the other 4 public form routes do). Storm-report is also the public lead-magnet form so it's the highest-volume bot target.

---

## 1. Email transport (Phase 1) — `lib/email-service.ts`

| Check | Verdict |
|---|---|
| Template allowlist blocks untagged sends | OK — `lib/email-service.ts:77-83` + the early return at `:161-179`. Default allowlist is `['contact-form','load-verified-invoice','driver-new-order']`. |
| `EMAIL_TRANSPORT_FORCE` override | **MISSING** — there is no such env var. The transport choice is controlled by `RESEND_API_KEY` + `EMAIL_FROM` presence + `EMAIL_KILL_SWITCH`. The task spec references a variable that doesn't exist. |
| Rate-limit cap on owner-gmail (`5/hr`, `30/day`) | OK — `lib/email-service.ts:90-101`. Bucket reset by hour/day at `:107-113`. |
| Resend discriminated-union return | OK — destructures `{ error }` at `:270-279`; the success path is "no error". |
| 8 wrappers pass correct template tag | OK for the 5 in use (`load-verified-invoice`, `driver-new-order`, `delivery-order`, `office-material-order`, `vendor-return`, `delivery-reminder`). 3 wrappers (`sendPortalLink`, `sendLeadAssignment`, `sendOfficeMaterialOrderNotification`) are marked `@deprecated` and have no callers — fine. |

### HIGH — H1. 17 untagged `emailService.send()` callsites are silently dropped by the allowlist.

Confirmed by grep across `app/` + `lib/`. Default allowlist contains only `contact-form, load-verified-invoice, driver-new-order`. Callsites missing a `template` field will drop with `dropped_template_not_allowed`:

- `app/api/webhooks/jobnimbus/route.ts:236` — JN job approved/contract-signed → Michael
- `app/api/webhooks/jobnimbus/route.ts:592` — breakdown-draft notify
- `app/api/auth/login/route.ts:100` — staff login alert
- `app/api/leads/new/route.ts:460` — office new-lead blast
- `app/api/portal/customer-breakdowns/route.ts:467` — vendor-alert ($-bearing)
- `app/api/storm-report/email/route.ts:457` (customer report) + `:465` (sales team)
- `app/api/cron/weekly-numbers-reminder/route.ts:241`
- `app/api/cron/stalled-tickets-digest/route.ts:176`
- `app/api/cron/low-stock-alert/route.ts:91`
- `app/api/cron/auto-review-request/route.ts:207`
- `app/api/portal/weekly-numbers/route.ts:480`
- `app/api/command-center/team/route.ts:90`
- `app/api/portal/pipeline/route.ts:790` (customer invoice email)
- `app/api/forms/careers/route.ts:160`
- `lib/customer-breakdown-service.ts:821` (return → breakdown)
- `lib/material-order-pipeline.ts:1417` (stage advances)
- `lib/work-order-service.ts:1112`
- `lib/notification-service.ts:812`
- `lib/review-management-service.ts:748`

Per the migration plan this is *intentional today* (Phase 1: only the 3 safe templates fire), but the SHIP/FIX verdicts in `docs/email-callsite-audit.md` aren't actually live. Fix: add a `template` field to each plus extend `ALLOWED_EMAIL_TEMPLATES` env, or set the env to `*` once review complete.

### MEDIUM — M1. Rate-bucket `Map` is per-warm-instance, not shared.

`rateBuckets` at `lib/email-service.ts:88` is an in-memory `Map`. A Vercel deploy with N warm instances has N independent buckets, so the "5/hr to owner gmail" effective cap is `5 × N`. Same architecture problem the KV migration solved for the form rate limiter. **Optimization** (½ day): swap to `@vercel/kv` keyed on `email-bucket:{addr}:{hour|day}` exactly like `lib/rate-limiter-kv.ts`.

### LOW — L1. Logging-failure swallow on `attachments.contentType` default.

`email-service.ts:266` defaults `contentType` to `'application/octet-stream'` — fine for unknown types, but PDF attachments built by `renderLoadVerifiedInvoicePDF` pass `'application/pdf'` explicitly, so no real issue. Leave as is.

---

## 2. Form hardening (Phase 2) — 10 endpoints

Each route should run: rate-limit (global → per-form) → honeypot → validation → spam-filter → turnstile → side-effects. Verified all four `/api/forms/*` plus `/api/contact`, `/api/email-capture`, `/api/storm-report`, `/api/storm-report/email`, `/api/leads/new`, `/api/referral`.

| Route | Size | Rate | Honeypot | Spam | Turnstile | Order correct | Bot 200-shape |
|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| `/api/forms/contact` | YES | YES | YES | YES | YES | YES | YES |
| `/api/forms/referral` | YES | YES | YES | YES | YES | YES | YES |
| `/api/forms/careers` | YES | YES | YES | YES | YES | YES | YES |
| `/api/forms/bni-partner` | YES | YES | YES | YES | YES | YES | YES |
| `/api/email-capture` | **NO** | YES | YES | YES | YES | YES | YES |
| `/api/contact` (legacy) | **NO** | YES | YES | YES | YES | YES | YES |
| `/api/storm-report` POST | **NO** | YES | YES | **NO** | YES | OK | YES |
| `/api/storm-report/email` | (not re-checked here) | — | — | — | — | — | — |
| `/api/referral` (legacy) | (not re-checked) | — | — | — | — | — | — |
| `/api/leads/new` | (not re-checked here) | — | — | — | — | — | — |

### HIGH — H2. `/api/storm-report` skips spam-filter entirely.

`app/api/storm-report/route.ts:32-79` runs honeypot then jumps straight to Turnstile, no `checkForSpam`. This is the lead-magnet form on `/check-my-address`, easily the highest-volume public lead surface. Bots that pass the rate limit can still pump junk leads with the existing four spam-filter heuristics turned off. Add `checkForSpam({ name?, email?, address? })` between honeypot and Turnstile.

### MEDIUM — M2. Three routes have no `checkRequestSize`.

`/api/storm-report`, `/api/contact`, `/api/email-capture` skip the 50kB body cap. All four `/api/forms/*` routes have it. Easy alignment fix.

### MEDIUM — M3. Bot-detected paths return success-shape but with subtly different message strings.

Honeypot path on `/api/forms/contact:44` says `"Thank you for contacting us! We will get back to you within 24 hours."` while the spam-filter path on `:122` returns the same string — OK. But `/api/contact:59` honeypot returns `"... get back to you shortly."` while `:104` spam returns the same shortly. A bot that submits to both `/api/forms/contact` and `/api/contact` *could* compare timings (honeypot ~5ms, spam ~60ms, real submit ~500ms+). Probably tolerable; if you want to harden, add `await new Promise(r => setTimeout(r, 200 + Math.random()*200))` to the silent-drop branches.

### LOW — L2. `globalFormRateLimiter` collapsing path is correct but per-form limiter still scopes by path.

`lib/rate-limiter-kv.ts:266-268`. Global cap = 15/hr/IP across all forms (good), per-form = 3/hr. A bot rotating across 5 forms can still rack 5×3 = 15 hits before the global trips. Could lower global to 8-10/hr.

---

## 3. Security (Phase 3 + 3b)

### `lib/auth-service.ts`

| Check | Verdict |
|---|---|
| `requireRoleAtLeast` enforces role case-insensitively | OK — `:470-476` lowercase compare. |
| Richard's slug allowlist at the helper level | OK — `:472-479` checks both `email` and `userId` against `['richard', 'richard@rcrsal.com']`. Default-applied so every call benefits. |
| Dev-bypass triple-gated | OK — `:393-407` requires `NODE_ENV !== 'production'` AND `DEV_AUTH_BYPASS=1` AND `!VERCEL`. Cannot fire in production. |

### MEDIUM — M4. `requireAdmin` only allows `admin` or `owner`, but `requireRoleAtLeast(['admin','owner'])` would be more flexible.

`auth-service.ts:434` hard-codes the two-role check. No identity allowlist applied, so even an explicit slug match doesn't help. Richard cannot hit admin-only endpoints even though he's on the cost-visibility allowlist — that's probably intended (he doesn't need admin pages), but worth flagging if any new admin surfaces need his access.

### Cost-privacy guard on JN reads

`lib/jn-redact.ts` deep-walk:

- Handles plain objects, arrays, nested arrays/objects, primitives, `Date`, `null`, `undefined`. Verified at `:114-130`. Pure (returns fresh object). Good.
- `effectiveCanSeeCost(undefined)` returns false → fail-safe. Good.
- `viewerForRole()` honors `canSeeCost(role)` first, then identity allowlist for Richard. Good.

### MEDIUM — M5. Cache-key segregation is implemented in only one place.

Commit `603cc34` claims "cache keys include the canSeeCost boolean so a rep can never accidentally hit a previously-cached owner-tier payload." Grep across all JN-adjacent caches finds the canSeeCost suffix only in `app/api/sheets/customers/route.ts:173-176`. That's because the other JN reads aren't cached at the API-route layer (they pipe through `jobnimbus-service.ts` which has no `cache.get/set`). Technically there's no exposure today, but if anyone adds a route-level cache to `app/api/portal/jobnimbus/*` without the `:cost=0|1` suffix, the segregation will silently break. Document the convention in `lib/jn-redact.ts` header.

### 12 unauth fixes

Commit `ffcc42e` "8 unauth-route fixes (6 CRITICAL + 2 HIGH)" plus the 4 added in `b789cb5` — spot-checked `app/api/admin/email-log/route.ts:87` and `spam-log/route.ts:75` — both gate with `requireAdmin()` at the route level. Defense-in-depth on top of admin layout. Good.

---

## 4. SEO content (Phase 5.6) — 5 county + 5 service pages

| Check | Verdict |
|---|---|
| Schemas validate | OK — all three schemas per page (Service / BreadcrumbList / FAQPage) generated through `lib/seo.ts` typed helpers. No raw JSON-LD typos. |
| `generateMetadata` exports correctly | OK — both `[county]/page.tsx:61` and `[slug]/page.tsx:79` export `generateMetadata` using `params: Promise<{...}>` (Next 14.2 supports both). |
| Internal-link cluster bidirectional | OK — county pages link to other counties (`COUNTY_SLUGS.filter(s !== current)`) and to 6 service pages; service pages link back to counties via `service-areas`. |
| `opengraph-image.tsx` doesn't fetch remote fonts | OK — both files use system fonts only; no `fetch(...).fontData` calls. |
| Real review aggregate (317/4.74) consistent | OK — sourced from `data/reviews-master.json` via `REAL_REVIEW_COUNT` / `REAL_AVG_RATING` in `lib/seo.ts:18-19`. Single source of truth, no hardcoded duplicates in page files. |

### LOW — L3. County page `Promise<params>` vs OG-image `{params}` mismatch.

`roofing-contractor/[county]/page.tsx:64` uses `params: Promise<{ county }>`, while `opengraph-image.tsx:32,45` uses the non-Promise form. Both are valid in Next 14.2 but inconsistent. No runtime effect; just style.

---

## 5. Operational visibility (Phase 6)

| Check | Verdict |
|---|---|
| Email-log fire-and-forget | OK — every `logEmailAttempt` call in `email-service.ts` is chained with `.catch(() => {})` and not awaited. The `try { await }` flow inside `email-log.ts` only awaits the sheet write inside the helper itself (which the caller does *not* await). |
| Spam-log no double-log | OK — every route returns immediately after each gate, so honeypot + spam-filter can't both log on the same request. Verified by reading `app/api/forms/contact/route.ts` flow. |
| Admin viewer API gate | OK — `app/api/admin/email-log/route.ts:87` and `spam-log/route.ts:75` both call `requireAdmin()` at the top of `GET`. Defense in depth on top of layout gating. |

### LOW — L4. `email-log` and `spam-log` use `scopes: spreadsheets.readonly` for reads but `spreadsheets` for writes.

`email-log.ts:84` uses write scope (because `lib/email-log.ts` writes rows). `app/api/admin/email-log/route.ts:62` uses `readonly`. Consistent.

---

## 6. Sweep branches

10 branches present, all with `(sweep)` commit suffix. Diff against each branch's merge-base with main:

| Branch | Real new code | Cron in `crons[]` | E-sign? |
|---|---:|:---:|:---:|
| `sweep/tv-leaderboard` | 752 LOC, 2 files | none | none |
| `sweep/design-refresh` | 475 LOC, 6 files | none | none |
| `sweep/review-automation` | 736 LOC, 6 files | **in `_disabledCrons`** (correct) | none |
| `sweep/storm-magic-link` | 1331 LOC, 6 files | none | none |
| `sweep/hail-canvass` | 1872 LOC, 5 files | none | none |
| `sweep/monday-prep-autofill` | 1873 LOC, 7 files | **in `_disabledCrons`** (correct) | "contractsSigned" counter only (count of JN-signed contracts) — not e-sign feature |
| `sweep/profile-self-service` | 1530 LOC, 8 files | none | only in a *MISSING / out-of-scope* note inside an audit doc — correctly excluded |
| `sweep/phone-system` | 2590 LOC, 19 files | none | none |
| `sweep/portal-completion` | 606 LOC, 4 files | none | none |
| `sweep/insurance-claims` | 1871 LOC, 6 files | none | none |

### MEDIUM — M6. Env-gated features in some sweeps actually fire when env unset.

Verified env gating only in `sweep/review-automation`:
- `if (process.env.ENABLE_REVIEW_REQUESTS !== 'true') { skip }` — correct
- `if (!process.env.NEXT_PUBLIC_GOOGLE_REVIEW_URL) { skip }` — correct
- email-service tag `'review-request'` added correctly behind same env gate

The other 9 sweep branches contain no `process.env.ENABLE_*` style toggle. If the spec required env-inert behavior for each, **most sweeps would activate immediately on merge**. Specifically:
- `sweep/phone-system` (FreePBX/VoIP integration) — needs scrutiny: any outbound HTTP to the PBX would fire on first request unless the PBX hostname is unset.
- `sweep/hail-canvass` — 725-LOC service likely starts pulling from HailRecon on first hit.
- `sweep/insurance-claims` — new `/api/customer/insurance-claim` route is live the moment the branch lands.

Recommend: before merge, grep each sweep for `process.env.` and confirm every external service / cron / public endpoint has an explicit env-gate.

### LOW — L5. `sweep/storm-magic-link` base is stale.

Branch base = `72ee5e4`, 26 commits behind main. Same-file conflicts on `lib/email-service.ts` highly likely on merge. Rebase before PR.

---

## 7. GroupMe master guard

### CRITICAL — C1. `sendBotMessage()` bypasses the master kill-switch.

Commit `18b2a55` adds the guard inside `GroupMeService.sendNotification()` only (`lib/groupme-service.ts:609-638`). But the production codebase calls `sendBotMessage()` directly in 5 hot paths, completely skipping the guard:

| File | Line | What it sends |
|---|---:|---|
| `lib/notification-service.ts` | 860 | Trigger notifications |
| `lib/calendar-reminder-service.ts` | 405, 425 | Team + customer reminders |
| `lib/delivery-reminder-service.ts` | 335, 351, 403, 671, 683 | Delivery-status pings + auto-customer notify |
| `app/api/portal/chat/dm/route.ts` | 110 | Uses `sendDirectMessage()` (also unguarded) |
| `lib/river-bot-service.ts` | 99 | Direct `fetch('https://api.groupme.com/v3/bots/post')` — bypasses the service entirely |

Owner directive was "DO NOT send anything on GroupMe until later approval, AND NEVER after 8pm and before 7." Today's deploy enforces this only for the small subset that flows through `sendNotification`. Everything above will still ping GroupMe outside 7am-8pm CT.

**Fix:** move the master-guard + quiet-hours block into `sendBotMessage()` itself (the chokepoint for outbound). Or extract a `_passesOwnerGuard(notification?)` helper and call it from every send path. Effort: <30 min.

---

## 8. Bulk-invoice backfill scripts

### `scripts/bulk-backfill-invoices-and-breakdowns.mjs`

| Check | Verdict |
|---|---|
| Idempotent on rerun | OK — `alreadyInvoicedTickets` Set built from existing Invoice rows at `:49-52`; ticket-loop skips with `continue` at `:96-100`. |
| Inventory cutoff 2026-05-15 | OK — `HISTORICAL_CLOSE_CUTOFF = '2026-05-15'` at `:26`, `shouldDeduct = ticketDate >= cutoff` at `:118-119`, deduct block guarded at `:228`. |
| No double-invoice possible across batch1 + bulk | OK on invoice-ID collision (batch1 uses `INV-...-0001..0025`, bulk starts at `0100`). And the ticketId-keyed dedup catches re-runs even if the IDs overlapped. |

### MEDIUM — M7. Inventory deduction is NOT idempotent on rerun.

If the script crashes mid-loop AFTER writing the Invoice row but BEFORE finishing the deduct loop, a second run will skip the invoice (dedup hit) AND skip all deductions. Conversely, if the dedup check fails (e.g., user manually deletes an invoice row to retry), the deduction will fire again — double-decrement.

The current safeguard: deduction only fires when `shouldDeduct` is true AND the ticket isn't already in `alreadyInvoicedTickets`. So a re-run on the SAME invoice never re-deducts. The dangerous case is "delete invoice row to retry, expecting a fresh full run" — that would double-deduct against `currentQty`.

**Mitigation** (½ day): write an `inventoryDeductedAt` column on each ticket row at deduction time. Skip deductions on tickets whose row already has it set.

### LOW — also note: `scripts/bulk-backfill-invoices-and-breakdowns.mjs:142` notes "Inventory deducted" or "NOT deducted" in `notes` field. That's a self-documenting good audit trail.

---

## Loopholes (cross-cutting)

1. **GroupMe `sendBotMessage` bypass** — C1 above. The kill-switch protects almost nothing today.
2. **Email allowlist effectively disables 80% of email flows** — H1. Either populate `template:` per call or expand `ALLOWED_EMAIL_TEMPLATES`. As shipped, owner's "see every approved/signed job" alert (callsite #6 in audit) and every cron-driven email **does not actually send**.
3. **`/api/storm-report` skips spam-filter** — H2.
4. **Email rate-limit is per-warm-instance** — M1. Owner gmail cap of 5/hr becomes 5×N where N = concurrent Vercel instances during a spike.
5. **Inventory double-deduct if invoice row is manually deleted to retry** — M7.
6. **`requireAdmin` doesn't honor identity allowlist** — M4. Richard cannot hit admin pages even with explicit `richard` slug; minor since he doesn't need them today.
7. **Sweep branches not env-inert** — M6. Most sweeps activate immediately on merge.

---

## Optimizations (concrete, effort-tagged)

| ID | Change | Effort | Payoff |
|---|---|---|---|
| O1 | Move GroupMe guard into `sendBotMessage` chokepoint | <30 min | Fixes C1 |
| O2 | Migrate `email-service` rate-buckets to KV (mirror `rate-limiter-kv.ts`) | ½ day | Cross-instance cap |
| O3 | Add `template` to the 17 untagged callsites OR set `ALLOWED_EMAIL_TEMPLATES=*` after audit | 1-2 hr | Re-enables 80% of intended email flows |
| O4 | Add `checkForSpam` to `/api/storm-report` POST | 15 min | Cuts highest-volume bot surface |
| O5 | Standardize `checkRequestSize('50kb')` on `/api/contact`, `/api/email-capture`, `/api/storm-report` | 10 min | Aligns with `/api/forms/*` |
| O6 | Add `inventoryDeductedAt` tag to ticket row on deduct | ½ day | Closes M7 double-deduct edge case |
| O7 | Lower `globalFormRateLimiter` cap from 15/hr to 8/hr | 1 line | Tightens cross-form ceiling |
| O8 | Document cache-key segregation convention in `lib/jn-redact.ts` header | 5 min | Prevents future regressions of M5 |
| O9 | Rebase `sweep/storm-magic-link` (26 commits behind) | 10 min | Avoids merge conflict |
| O10 | Grep each sweep branch for unguarded `process.env.` external-service calls before PR | 30 min | Closes M6 |

---

## Smoke tests run (mentally / via grep)

1. **Email allowlist check** — grep all `emailService.send(` callsites for `template:` field. 5 of 22 have it; 17 are untagged → confirmed allowlist drop.
2. **GroupMe bypass check** — grep `sendBotMessage|sendDirectMessage` callsites. 5 files / 9 callsites bypass `sendNotification`. Verified `sendBotMessage` definition at `lib/groupme-service.ts:526` has no guard.
3. **Form-hardening matrix** — read each of the 4 `/api/forms/*` routes plus `/api/email-capture`, `/api/contact`, `/api/storm-report` end-to-end. Result table in §2.
4. **`stripCostFields` / `redactCostFieldsDeep` deep-walk** — read both implementations. Handle arrays, nested objects, `Date`, `null`. Returns fresh tree, no mutation.
5. **Admin viewer auth** — confirmed `requireAdmin()` at top of both `email-log` and `spam-log` route GET handlers.
6. **Sweep diffs** — `git diff <merge-base>..<branch> --stat` on each of 10 sweeps. Confirmed no `docusign|esign|signature pad` artifacts in code (only mentioned in research/audit docs as out-of-scope).
7. **Vercel.json `_disabledCrons`** — confirmed parked under `_disabledCrons` key (Vercel ignores underscore-prefix). Two sweeps use this; both safe.
8. **OG-image font check** — read both `opengraph-image.tsx` files. No `fetch(font-url)` calls; system fonts only.
9. **Review aggregate consistency** — single source `data/reviews-master.json` → `lib/seo.ts:18-19` → schemas. No hardcoded duplicates.
10. **Bulk-backfill idempotency** — read script top-to-bottom. Ticket-id dedup correct, inventory-cutoff correct, inventory-deduct NOT idempotent (M7).

No `tsc --noEmit` run (read-only audit; would require `npm install` if any sweep branch is missing deps).

---

## Open questions not answerable from code

- Is `EMAIL_TRANSPORT_FORCE` a planned env var that needs to be implemented, or was it confused with `EMAIL_KILL_SWITCH` in the task spec?
- Should `ALLOWED_EMAIL_TEMPLATES` be expanded now, or do you want each untagged callsite reviewed line-by-line first?
- For C1 (GroupMe bypass): is the intent to also block test/dev callsites in `lib/river-bot-service.ts:99` (direct `fetch` to api.groupme.com), or only the canonical service path?
