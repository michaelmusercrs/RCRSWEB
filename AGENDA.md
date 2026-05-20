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
- `[pending]` **1.3 Template redesign** — owner wants each email type to look distinctly professional, not "AI-generated lead notification." Tasks: (a) standardize on a header/footer system component, (b) move material-order invoice to a PDF attachment with a short HTML body, (c) make sure subjects and from-names match the email type, (d) audit for accidental leakage of cost data per `[[feedback_purchase_price_visibility]]`.
- `[pending]` **1.4 Recipient routing audit** — for every email type, the recipient address must be derived from the right source. Sales-rep reminders → rep email, not company email. Driver notifications → driver, not owner. Customer-facing → customer, never internal. Build a recipient-rules table and test each path.
- `[pending]` **1.5 Per-recipient rate limit (proper)** — re-add the cap in the new transport with persistence beyond Lambda warm state (Vercel Blob counter or KV).
- `[pending]` **1.6 Re-enable** — once transport is in, templates are clean, routing is audited, and rate-limit is in: flip the EMAIL_TRANSPORT_FORCE / migration switch and verify the first send of each type by sending a real test from prod.

---

## Phase 2 — Form-submission hardening `[deploy-ok]`

The flood was bot spam on the public contact form (`juliana@trustedbusinessawards.com` is a known outreach tool). Stop the source.

- `[done]` **2.1-2.4 Form-hardening plan** — see `docs/form-hardening-plan.md`. Found **10** public endpoints (more than the original 5). Recommended: Cloudflare Turnstile, 4-phase rollout (honeypot first → KV-backed rate limit → Turnstile → cleanup). Found that current `lib/rate-limiter.ts` is in-memory and silently bypassed by Vercel cold starts — that's why bot spam slipped through.
- `[pending]` **2.5 Implement Phase 1 of the hardening plan** — honeypot + 20-domain seed block list. Zero user friction. Land on `main` per `[deploy-ok]`.
- `[pending]` **2.6 Implement Phase 2** — Vercel KV rate limit across all 10 endpoints.
- `[needs-owner]` **2.7 Implement Phase 3** — Turnstile rollout. Needs owner Cloudflare account + site key.

---

## Phase 3 — Role/permission audit `[strict-branches]`

Owner flagged data-visibility cross-contamination as a security issue.

- `[pending]` **3.1 Catalog all user roles** — owner, admin, manager, office, PM, sales, driver, customer. List in a single doc with the access boundaries per role.
- `[pending]` **3.2 Map every page/API route → required role**.
- `[pending]` **3.3 Verify cost-data visibility** per `[[feedback_purchase_price_visibility]]` — material cost must never reach JN/reps/customers.
- `[pending]` **3.4 Verify portal vs. public-site boundary** per `[[feedback_rcrsal_separation]]`.
- `[pending]` **3.5 Login flow + onboarding** per `[[project_rcrs_login_flow]]`.

---

## Phase 4 — Duplicate / cruft inventory `[strict-branches]`

The codebase has accumulated. Find what to keep, retire, or merge.

- `[pending]` **4.1 Inventory duplicate pages** — overlapping URLs or near-duplicate routes. Report only; owner decides what merges/deletes.
- `[pending]` **4.2 Unused files / dead code** — components not imported anywhere, API routes with no caller, scripts that no longer run. Use a static analysis pass (depcheck / ts-prune / knip).
- `[pending]` **4.3 Stale docs** — `*.md` files in repo root. Many are old plans. Triage into `kept` / `archive` / `delete`.
- `[pending]` **4.4 Abandoned features** — features behind never-flipped flags or with no production usage. Identify, propose retire/finish.

---

## Phase 5 — Comparative research `[research-only]`

Owner explicitly asked for this — look at how others solve the same problems.

- `[pending]` **5.1 Inventory app patterns** — what do best-in-class warehouse/inventory apps do that we don't? (e.g., Sortly, Fishbowl, Cin7, Square for Retail).
- `[pending]` **5.2 Leaderboard / sales-board patterns** — gamification done right for sales teams.
- `[pending]` **5.3 CRM patterns** — what does JobNimbus / AccuLynx / RoofSnap do for the bits we duplicate? Where do we actually add value vs. just rebuild theirs?
- `[pending]` **5.4 Customer portal UX** — what good roofer customer portals look like; ours vs. the bar.
- `[pending]` **5.5 SEO** — current Google ranking factors 2026, schema markup we should add, content gaps per `[[reference_seo_monitor]]`.
- `[pending]` **5.6 Roofing-company web design** — visual references; what looks "trustworthy + premium" in this segment.

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
