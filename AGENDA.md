# RCRS System Sweep — AGENDA

**Started:** 2026-05-20
**Owner directive:** Take the entire codebase apart, examine each piece, clean it up, put it back together more sensibly. Don't deploy except form-submission / email / security fixes. Continue working between sessions via scheduled routine.

This is the canonical task tracker for the multi-day sweep. Each scheduled-routine run reads this file, picks the next `[pending]` item, works on it, and updates status. Items marked `[deploy-ok]` can ship to prod; everything else stays on isolated branches.

---

## Operating constraints

- **Deploy boundary** — Only form-submission, email, and security fixes go to production `main`. All other work lives on `sweep/<topic>` branches with Vercel preview URLs for review.
- **No destructive ops** without explicit owner go-ahead (deletes, schema migrations, mass renames).
- **Verification before completion** — claims of "done" require evidence (test output, screenshot, log line). See `[[feedback_real_testing_required]]`.
- **Memory + this file = the comms channel** — no email pings to owner during autonomous runs.
- **Worktrees are encouraged** for parallel branches when topics are independent.

---

## Phase 0 — Stop-the-bleed (DONE 2026-05-20)

- `[done]` Per-recipient rate cap in `emailService.send()` — commit `3325653`
- `[done]` Remove gmail CC from `form-service.ts` — commit `3325653`
- `[done]` Disable GAS fetch in `form-service.ts:sendEmailNotification` — commit `232fddd`
- `[done]` Hard-disable `emailService.send()` pending transport migration — commit `7787779`
- `[done]` Document incident at `[[project_rcrs_email_flood_safeguard]]`

---

## Phase 1 — Email system rebuild (HIGHEST PRIORITY) `[deploy-ok]`

The whole transport is currently dead. Until rebuilt, no system email leaves. Each item below is a discrete, verifiable step.

- `[done]` **1.1 Transport selection** — see `docs/email-transport-comparison.md`. Recommended: **Resend** (free at our volume, ~30-line swap in `EmailService.send()`, real deliverability without Postmark price). `[needs-owner]` confirm before integration.
- `[done]` **1.2 Catalog every callsite of `emailService.send()`** — see `docs/email-callsite-audit.md`. 25 callsites in 17 files. Surfaced: storm-report violates rep-routing rule (sends to sales-team comp email), stock@ misused for breakdown notifications, michael@ vs michaelmuse@ address mismatch, 3 cost-data leak hotspots, 18-stage pipeline emitter likely over-firing, 3 dead wrappers.
- `[done]` **1.3 Template redesign (3 active templates)** — new `lib/email-templates/` system with shared header/footer/button/table helpers; clean professional look (no neon-green band); single accent `#0066CC`; mobile-friendly. Wired into `sendLoadVerifiedInvoice`, `sendDriverMaterialOrderNotification`, and the inline contact-form callsites. Other 5 templates intentionally untouched (outside the active allowlist). PDF-invoice rebuild deferred to Phase 1.3b.
- `[done]` **1.3b PDF-invoice attachment** — `lib/email-templates/load-verified-invoice-pdf.ts` builds a real PDF via `pdfmake` (pure-JS, Vercel-friendly). HTML body trimmed to a short cover note + summary; full invoice ships as PDF attachment. `Attachment` interface added to `EmailOptions`; wired through to Resend's `attachments` array. PDF render failure falls back to cover-note-only with a log line (office still gets the heads-up). `pdfmake` + `@types/pdfmake` installed.
- `[done]` **1.4 Recipient routing audit + fixes** — storm-report now resolves `?rep=<slug>` → assigned rep email via `TEAM_MEMBERS`; JN breakdown-draft moved from `stock@rcrsal.com` to `rcrs@rcrsal.com`; `michael@rcrsal.com` typo fixed to `michaelmuse@rcrsal.com` in `command-center/team` (other 2 occurrences in report-templates and reports/dashboard pages are `[needs-owner]` — different recipient config); cost-leak hotspots verified safe; `material-order-pipeline._notifyStageAdvance` now gated by `NOTIFY_STAGES` set (4 milestones, not 18 stages); dead-wrapper `@deprecated` tags deferred to Phase 4.
- `[pending]` **1.5 Per-recipient rate limit (proper)** — existing in-memory cap is retained as defense-in-depth on Resend. Promote to Vercel Blob counter or KV for cold-start resilience.
- `[done]` **1.6 Resend transport integration** — commit `<this-commit>`. `lib/email-service.ts` swapped from Google Apps Script `fetch()` to the Resend SDK. Template allowlist gates sends — default allowlist = `contact-form`, `load-verified-invoice`, `driver-new-order` (per owner directive 2026-05-20). Untagged sends drop with `[EMAIL TEMPLATE NOT ALLOWED]` log. Transport activates once `RESEND_API_KEY` + `EMAIL_FROM` are set on Vercel envs. Eight wrappers + two inline callsites tagged with their templates. `[needs-owner]` provision Resend account at https://resend.com (login via rivercityroofingsolutions@gmail.com), verify rivercityroofingsolutions.com domain, set the three env vars across the 4 public-site Vercel projects.

---

## Phase 2 — Form-submission hardening `[deploy-ok]`

The flood was bot spam on the public contact form (`juliana@trustedbusinessawards.com` is a known outreach tool). Stop the source.

- `[done]` **2.1-2.4 Form-hardening plan** — see `docs/form-hardening-plan.md`. Found **10** public endpoints (more than the original 5). Recommended: Cloudflare Turnstile, 4-phase rollout (honeypot first → KV-backed rate limit → Turnstile → cleanup). Found that current `lib/rate-limiter.ts` is in-memory and silently bypassed by Vercel cold starts — that's why bot spam slipped through.
- `[done]` **2.5a Hard-block customBlockedDomains in `lib/spam-filter.ts`** — domains in the list now short-circuit to `isSpam: true` (was 25-point soft score). Seeded with `trustedbusinessawards.com` + 3 known cold-email tools (`mailshake.com`, `woodpecker.co`, `lemlist.com`). `/api/forms/contact` now runs `checkForSpam` BEFORE sheet/email; bots get 200 OK so they can't probe.
- `[done]` **2.5b Spam-check pre-gate on all remaining form endpoints** — 8 endpoints hardened: `/api/contact`, `/api/email-capture`, `/api/forms/referral`, `/api/forms/careers`, `/api/forms/bni-partner`, `/api/referral` (legacy), `/api/leads/new` (response normalized), `/api/storm-report/email`. `/api/storm-report` skipped (no email field — nothing to check). Each returns generic 200 OK so bots can't probe.
- `[done]` **2.5c Honeypot field across all 10 form endpoints** — new `components/forms/HoneypotField.tsx` + `lib/honeypot.ts` helper. 10 API routes check `checkHoneypot(body)` BEFORE validation/spam-filter; 10 UI form components carry the hidden `website` field. Bots get a 200 OK identical to legit. Field hidden via absolute positioning + `aria-hidden` + `tabIndex={-1}` so accessibility isn't broken.
- `[done]` **2.6 Vercel KV-backed rate limiter** — new `lib/rate-limiter-kv.ts`. Public interface preserved; per-route factories (3/hr contact/referral/careers/bni-partner; 10/hr storm-report; cross-form 15/hr per IP global cap). Lazy `import('@vercel/kv')` with in-memory fallback if KV env not set. `@vercel/kv@^3.0.0` installed. `[needs-owner]` set `KV_REST_API_URL` + `KV_REST_API_TOKEN` on Vercel to activate KV-backed; until then it transparently uses the existing in-memory limiter.
- `[pending]` **2.6b Migrate the 10 form endpoints from `lib/rate-limiter` to `lib/rate-limiter-kv`** — one-line import swap per route; opt in per-route gradually.
- `[done]` **2.7 Cloudflare Turnstile integration** — `lib/turnstile.ts` + `components/forms/TurnstileWidget.tsx` wired into all 10 API routes + 9 form components. INERT until `NEXT_PUBLIC_TURNSTILE_SITE_KEY` + `TURNSTILE_SECRET_KEY` env vars are set. `@marsidev/react-turnstile@^1.x` installed. `[needs-owner]` provision site at https://dash.cloudflare.com → Turnstile → Add Site (Widget Mode: Managed, domain: rivercityroofingsolutions.com), set the two env vars on the 4 public-site Vercel projects, redeploy.
- `[done]` **2.6b 10 form endpoints migrated to KV rate limiter** — per-route limits (3/hr contact/referral/careers/bni-partner; 10/hr storm-report) + global 15/hr cross-form IP cap wrapped outside each per-form wrap. `RateLimiter.check()` is now async; `withRateLimit` handles it transparently.

---

## Phase 3 — Role/permission audit `[strict-branches]`

Owner flagged data-visibility cross-contamination as a security issue.

- `[done]` **3.1-3.5 Role/permission audit** — `docs/role-permission-audit.md`. Cataloged all roles, mapped routes, verified login flow against memory. Identified 2 CRITICAL + 5 HIGH issues.
- `[done]` **3.6 CRITICAL FIX: `/api/portal/meeting-data` now requires auth** — was leaking full sales leaderboard / revenue / per-rep weekly numbers to anyone with the URL. Now requires `requireAuth`. TODO tighten to owner/admin/office/manager once role-check helper is in place.
- `[done]` **3.7 CRITICAL FIX: `/api/admin/lead-distro/history` now requires admin** — was `requireAuth` (any logged-in user including reps could read distribution logs).
- `[pending]` **3.8 HIGH: Cost-visibility drift** — `lib/cost-visibility.ts:33-40` adds `project_manager`/`pm` to allowlist (not in owner's rule); inventory pages omit Office/Manager; `permissions.ts:156-175` doesn't grant Office `inventory.viewCosts`. Needs owner decision on whether PMs see cost.
- `[done]` **3.9 `project_manager` + `viewer` added to `types/roles.ts`** — also added `ROLE_PERMISSIONS`, `ROLE_HIERARCHY`, `ROLE_DISPLAY_NAMES` entries. PM mirrors Manager minus `inventory.viewCosts` + billing (per `feedback_purchase_price_visibility`). Viewer is `*.view`-only.
- `[done]` **3.10 `/api/portal/monday-notes/announcements` now `requireAuth`** — same fix pattern as 3.6.
- `[needs-owner]` **3.11 `mustChangePassword: false` hard-coded on every active team member** — login gate never fires today.

---

## Phase 4 — Duplicate / cruft inventory `[strict-branches]`

The codebase has accumulated. Find what to keep, retire, or merge.

- `[done]` **4.1-4.3 Phase 4 triage** — `docs/dead-code-triage.md`. Findings: 8 duplicate page pairs (most actionable: `/contact/thank-you` vs `/thank-you`, `/awards-trip` vs `/command-center/competition/awards-trip`, `/portal/profile` vs `/portal/my-profile`); 8 unreferenced API routes; 56 root docs triaged (22 KEEP, 22 ARCHIVE, 12 DELETE); 11 orphan components (5 in `components/leads/*`); 83 script entries (none referenced from package.json/vercel.json — ~30 clearly one-shot). 12 owner-decision questions surfaced.
- `[pending]` **4.4 Apply the triage** — execute the `KEEP`/`ARCHIVE`/`DELETE` actions from the triage doc. Owner approves the list first. `[needs-owner]`

---

## Phase 5 — Comparative research `[research-only]`

Owner explicitly asked for this — look at how others solve the same problems.

- `[done]` **5.1+5.2 Inventory + leaderboard research** — `docs/research-inventory-and-leaderboards.md`. 5 inventory improvements + 5 leaderboard improvements, all rebuildable in-stack, no SaaS. Highlights: QR-scan-to-adjust, TV-mode `/chrisview/board`, GroupMe-wired win-takeovers, anonymous-tail mode.
- `[done]` **5.3 CRM comparison** — `docs/research-crm-comparison.md`. Compares JN, AccuLynx, RoofSnap, Leap, Improveit 360, Followup. Recommendation: Option C hybrid — JN owns jobs/estimates/QB/supplier orders; RCRS owns lead scoring + 3-board leaderboard system + Monday meetings + storm reports + warehouse + GroupMe. 5 moat wins identified.

## Phase 3b — Second security pass (deeper unauth audit)

- `[done]` **3b.1 Deeper unauth audit** — `docs/unauth-route-audit.md`. Found 6 CRITICAL + 2 HIGH + 2 MEDIUM + 1 LOW. All webhooks verified for signature/secret. All 10 crons verify CRON_SECRET.
- `[done]` **3b.2 CRITICAL fixes (6 routes)** — `requireAuth` added to all 6 command-center meeting routes that were leaking QB commission data + sales leaderboard + revenue (leaderboard, stats, charts, activity-leaderboard, announcements, sales/projections).
- `[done]` **3b.3 HIGH fixes (2 routes)** — `roof-measure/calibrate` POST gated (was vulnerable to calibration poisoning); `dashboard/leads` POST gated (legacy lead-write endpoint without form-hardening).
- `[pending]` **3b.4 Portal namespace cost-data visibility tightening** — `/api/portal/reports/{commissions, profitability, finance-summary}` + `/api/portal/jobnimbus/commissions` allow ANY logged-in user; per `[[feedback_purchase_price_visibility]]` should be owner/admin/office/manager-tier only. `[needs-owner]` confirm tier.
- `[needs-owner]` **3b.5 `march-madness-2026` routes intent** — currently public; reclassify as internal or shelve.
- `[done]` **3b.6 Webhook fail-mode hardened** — JN webhook now returns 503 if signing secret missing (was fail-open, CRITICAL). Material-order-email tightened (cosmetic). Calls webhook had a dev-mode loophole that accepted any request when key was unset — closed (HIGH). GroupMe documented as intentionally unsigned (no signing protocol on inbound; read-only routing).

## Phase 6 — Operational visibility

- `[done]` **6.1 Email send-log to master sheet** — `lib/email-log.ts` appends to `Email Log` tab on every `emailService.send()` outcome (template-not-allowed, kill-switch, transport-not-configured, rate-limit, send-failed, sent). Fire-and-forget; never blocks the email path. Owner gets a sortable real-time view of every send attempt once Resend goes live.
- `[done]` **6.2 `/admin/email-log` viewer page** — app/(tools)/admin/email-log/page.tsx + app/api/admin/email-log/route.ts. Filters: status, template, recipient substring, date range (24h/7d/30d/all), limit (default 200, cap 500). 30s auto-refresh. Status badges (green sent, gray dropped_*, red send_failed). Summary tiles per filter. requireAdmin gate at API route + admin layout gate at page level. Renders "not configured" banner if sheet env unset.
- `[done]` **6.3 Spam-log infrastructure** — `lib/spam-log.ts` (mirrors `lib/email-log.ts`). `logSpamBlock(entry)` appends to `Spam Log` tab. Wired into all 10 honeypot + spam-filter + turnstile gate sites (10 routes × 3 gates = ~30 call sites). Fire-and-forget; gate logic unchanged.
- `[done]` **6.4 `/admin/spam-log` viewer page** — app/(tools)/admin/spam-log/page.tsx + app/api/admin/spam-log/route.ts. Mirrors the email-log viewer. Filters: gate, route, submitter substring (matches email/name/ip), date range, limit. 30s auto-refresh. Color-coded gate badges (honeypot purple, spam-filter amber, turnstile blue, rate-limit rose). Summary tiles per gate. requireAdmin gate.
- `[done]` **5.4+5.5+5.6 Portal + SEO + design research** — `docs/research-portal-seo-design.md`. 5 portal features (CompanyCam-style share, PM trading card, insurance timeline, delivery preview, warranty packet), 5 SEO wins (load-verified review automation, RoofingContractor schema, Core Web Vitals tightening), 5 design wins (vertical install video hero, before-after slider, trust strip, mobile CTA bar, county landing pages).
- `[done]` **5.6a County landing pages (5)** — `app/(site)/roofing-contractor/[county]/page.tsx` + `data/county-landing.json`. Madison, Morgan, Marshall, Limestone, Cullman. Each: H1, hero with county seat + geographic context, cities-served list, 3 service cards, IKO-led trust signals, county-tailored CTA `/contact?source=county-<slug>`, 6 FAQs (one county-specific), Service + BreadcrumbList + FAQPage schemas. Sitemap + Footer wired. Internal-link cluster between the 5 pages.

## Phase 7 — Feature work on sweep branches (not yet deployed)

- `[done]` **7.1 TV-mode `/chrisview/board`** — `sweep/tv-leaderboard` branch. Full-screen office TV display; auto-rotating top-5 across 3 leaderboards (Commission / Sales / Weekly) per `[[project_rcrs_leaderboards]]`; activity ticker bottom strip; pause-on-hover; gold/silver/bronze podium; 60s data poll. Reads only data that `/chrisview` already publicly serves — no new leak. `[needs-owner]` review preview URL → merge if approved.
- `[done]` **7.2 Mobile CTA bar + before-after slider** — `sweep/design-refresh` branch. `MobileCTABar` sticky bottom strip on mobile (Call + Text buttons, scroll-aware reveal/hide). `BeforeAfterSlider` interactive drag-comparison with keyboard support. Wired into homepage, storm-damage service page, gallery. Slider has TODO placeholders for real before/after pairs (no fabrication per `[[feedback_never_invent_brand_data]]`). `[needs-owner]` drop in real photo pairs to `public/uploads/` + review preview → merge.
- `[done]` **7.3 Review-request automation (sweep)** — `sweep/review-automation` branch. Template + sheet-backed queue + daily cron + load-verified-aftermath enqueue hook. Entirely env-gated: no-op until `ENABLE_REVIEW_REQUESTS=true` + `NEXT_PUBLIC_GOOGLE_REVIEW_URL` set. `vercel.json` cron entry parked in `_disabledCrons` until owner moves it live. Once activated, closes the 47-vs-800 review gap that's the public site's biggest SEO weakness.
- `[done]` **7.4 Storm-report magic-link share (sweep)** — `sweep/storm-magic-link` branch. Tokenized public URL at `/share/storm-report/[token]` so the customer revisits without login + rep can text/email the link. 24-char base62 token (~143 bits entropy), sheet-backed storage on new `Storm Report Shares` tab, 90-day default TTL, access tracking. Rep-side regen endpoint at `/api/admin/storm-report-share` (POST, requireAuth). Public view rate-limited 60/hr per IP via KV. Wired into existing storm-report email so customer + sales team both get the share URL. Test plan in commit body. `[needs-owner]` review preview → merge.
- `[done]` **5.6b Service-page SEO depth (5 pages)** — process / includes-excludes / related-services / county callouts / ServiceChannel schema upgrade on the 5 priority service pages. Shipped to main. 2 `[needs-owner verification]` placeholders left (24/7 phone-coverage claim, pre-purchase inspection fee).

Deliverable per item: 1-page summary + 3-5 concrete suggestions that would actually move the needle for RCRS, ranked by impact/effort.

---

## Phase 6 — Action log

Every change made by the routine, on any platform, is appended to `LOG.md` (sibling file). Format: timestamp, actor (claude / owner / cron), what changed, where, why, link to commit if any. This is the action log the owner asked for.

- `[pending]` **6.1 Bootstrap LOG.md** with today's incident timeline (from `[[project_rcrs_email_flood_safeguard]]`).
- `[pending]` **6.2 Routine appends to LOG.md every run** with a single-line entry per action.

---

## Routine instructions (read me first on every scheduled run)

1. `git pull origin main` — sync.
2. Read this AGENDA.md.
3. Pick the next `[pending]` item (top-to-bottom in priority order: Phase 1 > 2 > 3 > 4 > 5 > 6). Skip items requiring owner input (any line tagged `[needs-owner]`).
4. Work on it for up to ~20 min. If finished, mark `[done]` and append a one-line LOG.md entry. If partial, leave at `[in-progress]` with a short note of where you stopped.
5. Commit to `sweep/<topic>` branch unless the item is tagged `[deploy-ok]`, in which case commit to `main` and let Vercel deploy.
6. **Never deploy a non-`[deploy-ok]` item to `main`.**
7. **Never call `emailService.send()` without `EMAIL_TRANSPORT_FORCE=true`** until Phase 1.6 is complete.
8. If blocked or unclear, add `[needs-owner]` tag and write a short blocker note. Move on.
9. End-of-run: commit + push; update LOG.md.

---

## Owner-blocking decisions parked here (resolve next time we're synchronous)

- `[needs-owner]` **Transport choice** — pick one of Resend / Postmark / nodemailer-Gmail / Gmail API. Recommendation will be in Phase 1.1 deliverable.
- `[needs-owner]` **GAS endpoint future** — can owner recover edit access? If yes, the GAS code can be patched as a faster path than full migration.
- `[needs-owner]` **Portal redeploy?** — push the transport disable into `rcrs-portal` too? It emails fewer things but the same bug applies.
- `[needs-owner]` **Customer-portal email shutoff during migration** — losing the new-customer portal-link email for a few days is the cost of stopping the flood. Confirm OK.
