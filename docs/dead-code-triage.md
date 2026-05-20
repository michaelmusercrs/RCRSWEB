# Dead-Code & Duplicate-Page Triage

**Generated:** 2026-05-20
**Mode:** READ-ONLY research. No files were moved or deleted. Owner reviews this doc, later sweep passes do the actual removal.
**Scope:** Next.js app at `C:\Users\Michael\river-city-roofing\` per AGENDA Phase 4.

---

## Summary

| Category | Candidates flagged |
|---|---|
| Overlapping/duplicate page routes | 8 |
| Unused exports (ts-prune, after filtering Next conventions) | 691 raw; ~40 highest-value listed |
| API routes with zero callers | 8 (out of 370 total `route.ts`) |
| Root-level stale docs flagged | 56 markdown/txt files triaged |
| Orphan components (no importer) | 11 |
| `scripts/` candidates to retire | ~30 one-shot scripts |

Totals scanned: 259 `page.tsx`, 370 `route.ts`, 106 component `.tsx`, 83 entries in `scripts/`, 56 `.md`/`.txt` at repo root.

Notable confirmations:
- `/ram` is single-canonical (no `/ram2`). The consolidation noted in `reference_common_lessons` has NOT regressed. Source: only `app/ram/page.tsx` exists; no sibling `ram2/`.
- No two `page.tsx` files compile to the same URL after stripping route groups. The duplicates below are content-overlap, not route collisions.

---

## 1. Duplicate / overlapping page routes

| Candidate URLs | Evidence | Recommendation | Risk |
|---|---|---|---|
| `/contact/thank-you` vs `/thank-you` | `app/(site)/contact/thank-you/page.tsx:1-30` (181 LOC, lime hero, IKO/warranty trust-signals) vs `app/(site)/thank-you/page.tsx:1-30` (113 LOC, "We Got Your Message", different theme). Both `noindex`. | Keep `/contact/thank-you` (richer, on-brand). Update any form `action`/`redirect` that points to `/thank-you` then retire it. Search for `'/thank-you'` callers before delete. | Low. Both are post-submit destinations; need to grep form redirects. |
| `/awards-trip` vs `/command-center/competition/awards-trip` | `app/awards-trip/page.tsx:1-15` (361 LOC, public route) vs `app/(tools)/command-center/competition/awards-trip/page.tsx:1-15` (370 LOC, near-identical client). Same `Tier/Period/Rules` types, same `cn()` helper. | Keep `/command-center/competition/awards-trip` (in-portal, authenticated). The public `/awards-trip` looks like a leftover that escaped the portal-only domain. Confirm with owner — `[[project_rcrs_domain_separation]]` says rcrsal.com = portal only. | Medium. Owner may have linked `/awards-trip` publicly for reps. Check Vercel access logs before retiring. |
| `/portal/my-profile` vs `/portal/profile` | `app/(tools)/portal/my-profile/page.tsx` (827 LOC, edit UI w/ `Save/Clock`) vs `app/(tools)/portal/profile/page.tsx` (459 LOC, also edit UI w/ `Save`). Both `'use client'`. | Keep `/portal/my-profile` (larger, newer feature set incl. reviews subroute). Audit nav links to `/portal/profile`, redirect-stub it like `portal/sales/leaderboard`. | Medium. Both write to profile data — risk of divergent writes if both active. |
| `/dashboard` vs `/portal/dashboard` vs `/customer/dashboard` vs `/admin/dashboard` | `app/(tools)/dashboard/page.tsx:1-14` (14 LOC, just renders `DashboardClient` — "Lead Management Dashboard"); `app/(tools)/portal/dashboard/page.tsx` (299 LOC); `app/(tools)/customer/dashboard/page.tsx` (1932 LOC); `app/(tools)/admin/dashboard/page.tsx` (242 LOC). | Probably legitimate (different audiences). But `/dashboard` (lead-mgmt) overlaps with `/portal/dashboard` purpose — confirm which one is the canonical landing after login. The 14-line wrapper at `/dashboard` may be a leftover from before route-group split. | Medium. Login redirect target. |
| `/admin` vs `/admin/dashboard` | `app/(tools)/admin/page.tsx` (337 LOC) and `app/(tools)/admin/dashboard/page.tsx` (242 LOC) — both look like admin home. | Pick one as canonical, redirect the other. Sample both rendered output to identify the keeper. | Low–medium. |
| `/lp/roof-replacement`, `/lp/roof-repair`, `/lp/gutter-guards`, `/lp/storm-damage` vs `/services/[slug]` | `app/(lp)/lp/roof-replacement/page.tsx:1-12` is a dedicated landing-page funnel ("$0 Down" angle, `LandingPageForm`). `app/(site)/services/[slug]/page.tsx:1-15` covers same content topics via `servicesData`. | Likely intentional split (paid ads → `/lp/*`, organic → `/services/*`). KEEP both, but flag for owner: confirm `/lp/*` are linked from paid creatives and not accidentally drawing organic crawl. Add `noindex` to `/lp/*` if not already. | Low. |
| `/awards-trip` content vs `/trip/update` | `app/trip/update/page.tsx` (188 LOC), `app/awards-trip/page.tsx` (361 LOC), and `app/chrisview/page.tsx:1-10` all live at top-level (outside route groups) — same era of "public read-only" stuff Chris uses. | Group these into one route group like `app/(public-readonly)/` or move to portal. They sit at top-level alongside `api/`, `(site)`, `(tools)` and clutter the routing tree. | Low (cosmetic). |
| `/portal/sales/leaderboard` (already redirects) | `app/(tools)/portal/sales/leaderboard/page.tsx:1-7` is a 7-line `redirect('/portal/sales/performance')`. Note: not duplicate; this is the *correct* pattern. | Use this as the template when collapsing the other duplicates above. | N/A — exemplar. |

---

## 2. Unused exports (ts-prune)

Ran `npx -y ts-prune` with no project flags. Total findings: 2,126 lines, of which 1,591 are "not used in module" (probable dead exports) and the rest are intra-module references. After filtering out Next.js conventional exports (`default` from `page.tsx`/`route.ts`/`layout.tsx`, `metadata`, `generateMetadata`, `generateStaticParams`, `middleware`, `config`, `sitemap`, etc.), 691 candidates remain.

**Top 40 highest-value (filtered) — components and main lib files first:**

| File / export | Recommendation | Risk |
|---|---|---|
| `components/ChatBot.tsx:14 default` | DELETE. `app/(site)/layout.tsx:10-11` has the import explicitly commented out ("ChatBot disabled — not yet configured (2026-02-17)"). `DogChatBot.tsx` is the live one. | Low. |
| `components/FeatureUpdatesPopup.tsx:39 default` + `:240 useFeatureUpdates` | DELETE. Zero importers in `app/`/`components/`/`lib/`. Referenced only in docs (`RCRS-HONEST-AUDIT.md`, `RCRS-SITE-INDEX.md`) and `rcrs-notebooklm/`. | Low. |
| `components/RoleTrainingPopup.tsx:393 default` | DELETE. Same situation — zero code importers. | Low. |
| `components/customer-portal/PhotoGallery.tsx:40 default` | DELETE. Zero importers. | Low. |
| `components/customer-portal/ReviewSubmission.tsx:22 default` | DELETE. Zero importers. The customer-portal flow uses `ReviewRequestForm` elsewhere. | Low. |
| `components/forms/TurnstileWidget.tsx:49 default` | INVESTIGATE. Cloudflare Turnstile widget — if site has bot-protection on forms, this should be wired. May be feature-flagged off. | Medium — confirm forms have anti-bot coverage before deleting. |
| `components/leads/DistributionCalculator.tsx`, `LeadCard.tsx`, `LeadTimerBadge.tsx`, `RepAvailabilityToggle.tsx`, `RepPerformanceTable.tsx` (all `:n default`) | INVESTIGATE. Leads is an active feature (`/portal/leads/*` exists). These look like first-draft components superseded by inlined JSX. Diff against in-page implementations before deleting. | Medium. |
| `components/portal/DailyActivityTracker.tsx:155 default` | INVESTIGATE. "Daily activity" is on the agenda for the meeting system. Could be a half-finished feature. | Medium. |
| `components/portal/MondaySubmissionWidget.tsx:45 default` | INVESTIGATE. "Monday submission" is core to `[[project_meeting_numbers_flow]]`. Confirm not used or a dropped UI experiment. | Medium. |
| `components/command-center/index.ts` barrel — 40+ re-exports flagged unused | NOISE. ts-prune mis-reports barrel re-exports when consumers import via the symbol directly. Verify a couple before acting (e.g., `StatCard` IS used). Do NOT bulk-delete from `index.ts`. | High if acted on naively. |
| `components/ui/index.ts` barrel — 35+ re-exports flagged | NOISE. Same as above — shadcn barrel. Skip. | High. |
| `lib/analytics.ts` — `pageview`, `trackFormSubmission`, `trackPhoneClick`, `trackEmailClick`, `trackLeadScore`, `trackAdminAction`, etc. | INVESTIGATE. If GA4/Vercel Analytics is the only telemetry, these custom helpers may genuinely be dead. Check if any client component calls them. | Medium. |
| `lib/api-response.ts` — `apiValidationError`, `apiCachedSuccess`, `ApiResponse` | KEEP. Public API surface for route handlers. ts-prune can't always trace dynamic usage. Low confidence flag. | Low — leave. |
| `lib/blogData.ts` — `getBlogPost`, `getAllBlogSlugs`, `getRecentPosts`, `getPostsByAuthor`, `blogPosts`, types | INVESTIGATE. Note that `lib/blogPostIndex.ts` (separate file) flags the same names. This is a probable duplication of blog data layers — one is dead. Compare both, keep one. | Medium. |
| `lib/blogPostIndex.ts:894-906` — `getBlogPostMeta`, `getAllBlogSlugs`, `getRecentPostsMeta`, `getPostsByAuthorMeta` | See above — pick blogData.ts OR blogPostIndex.ts, not both. | Medium. |
| `lib/bitcoin-service.ts:68 getBitcoinAddress` + helpers | DELETE entire file? Bitcoin payments aren't in active scope (per owner memory, payments go through standard channels). | Medium — confirm with owner that crypto payment plan was shelved. |
| `lib/cost-visibility.ts:84 canSeeCostOnDeliveryDoc` | INVESTIGATE. `[[feedback_purchase_price_visibility]]` is a hard rule — make sure the active enforcement path doesn't accidentally use a different helper. If this is the canonical helper and isn't called, the rule isn't being enforced. | **HIGH.** Check before acting. |
| `lib/delivery-ai-agent.ts:1183 deliveryAIAgent` | INVESTIGATE. AI agent for delivery flow — `[[project_warehouse_inventory_system]]` mentions Tuya/Rick mobile but unclear if this agent shipped. | Medium. |
| `lib/delivery-pipeline.ts` — `getBillingVisibility`, `DISTRIBUTORS`, `ReturnDestination` | KEEP. Delivery is live; ts-prune likely missed dynamic lookup. | Low. |
| `lib/employeeDirectory.ts:311-392` — `getEmployeeById`, `getEmployeeByEmail`, `getEmployeesByRole`, `getDrivers`, `getVendors`, `getContractors`, `getAdmins`, etc. | INVESTIGATE. Helpers look canonical but unused. If lookups go through `/api/team-members` instead, these are dead. | Medium. |
| `lib/email-templates.ts` — `welcomeEmail`, `quoteFollowUpEmail`, `jobCompleteReviewEmail`, `referralRequestEmail`, `stormAlertEmail`, `EMAIL_TEMPLATE_CATALOG` | **HIGH PRIORITY INVESTIGATE.** Phase 1 of AGENDA is the email rebuild. Confirm whether these templates are the keepers or the discards before any deletion. | **HIGH.** |
| `lib/feature-flags.ts` — `isProduction`, `isDevelopment`, `isStaging`, `getFeaturesByCategory`, `getEnvironmentBadge`, `canPerformDestructiveOperation` | KEEP. Standard env helpers — used dynamically in admin UIs. | Low. |
| `lib/featureUpdates.ts` — `getUnreadUpdates`, `getHighPriorityUpdates`, `getUpdatesByCategory`, `featureUpdates` | DELETE (companion to `FeatureUpdatesPopup.tsx`). | Low. |
| `lib/form-service.ts:40 FormSubmission` type | KEEP. Type-only export. | Low. |
| `lib/google-calendar.ts` — three `generateGoogleCalendarLinkFromX` helpers | INVESTIGATE. Per `[[CLAUDE.md global]]` "use Google Calendar URL links, never .ics files" — these helpers should be the live path. If unused, calendar links may be broken. | Medium–high. |
| `lib/github-utils.ts:20 commitFileToGitHub` | INVESTIGATE. Self-commit feature — may have been an experiment. | Low. |
| `lib/geocoding-service.ts:45 isGeocodingConfigured` | KEEP. Defensive check. | Low. |
| `tailwind.config.ts:113 default` | KEEP. Tailwind reads this directly. False positive. | None. |

Full raw `ts-prune` output: 2126 lines. Suggest re-running after the easy wins are cleared.

---

## 3. API routes with no caller

Walked all 370 `route.ts` files (316 under `app/api/`, 54 under `app/(tools)/api/`). Built reference list by extracting `/api/...` literals from all `.ts`/`.tsx`/`.js`/`.jsx` source. After excluding self-references (the route file's own URL comments) and confirming each with a direct grep, the following are flagged:

| Route | Evidence | Recommendation | Risk |
|---|---|---|---|
| `app/api/admin/seed-reviews/route.ts` | Zero callers anywhere in source. Name suggests one-shot seed script. | DELETE or move to `scripts/`. | Low. |
| `app/api/command-center/meetings/admin-update-numbers/route.ts` | Only self-reference. | INVESTIGATE — the meeting numbers flow is active per `[[project_meeting_numbers_flow]]`; may be a never-wired admin override. Confirm if `meetings/prep` covers this. | Medium. |
| `app/api/roof-measure/health/route.ts` | Zero callers. | DELETE. Looks like a leftover healthcheck stub. | Low. |
| `app/api/portal/admin/backups/route.ts` | Zero callers. | INVESTIGATE. Backup is critical (`vercel.json` cron `backup-sheets` exists) — but this route is at `/portal/admin/backups`, not the cron path. Likely an abandoned admin UI endpoint. | Medium — keep if admin UI was planned. |
| `app/api/trip/preview-insights/route.ts` | Zero callers. | DELETE. Sibling `trip/commit`, `trip/diff`, `trip/excluded-reps` all have callers; this one looks like a dropped feature. | Low. |
| `app/(tools)/api/notifications/center/count/route.ts` | Zero callers. Only self-doc references. | INVESTIGATE — notification center may not yet have UI. The `/api/notifications/center` and `.../preferences` siblings exist too; confirm whether they're called. | Medium. |
| `app/(tools)/api/roof-measure/status/route.ts` | Zero callers. | DELETE. The roof-measure compare/main endpoints are used; `status` is unused. | Low. |
| `app/api/[...path]/route.ts` | Catch-all by definition; ts-prune flags but it IS used. | KEEP. | None — false positive. |

External-webhook check: none of the flagged routes have a `// webhook from X` comment. Owner should confirm before any retire.

---

## 4. Stale docs in repo root

56 `.md` / `.txt` files at repo root. Categorized below. **No files moved.** Owner reviews then later sweep moves the `ARCHIVE` set into `docs/archive/`.

| File | Triage | Reason |
|---|---|---|
| `AGENDA.md` | KEEP | Active sweep agenda. |
| `LOG.md` | KEEP | Active action log (Phase 6). |
| `README.md` | KEEP — but rewrite | Currently lists "color system & location pages" — stale framing for a project that's grown well beyond that. Refresh content, don't delete. |
| `SETUP.md` | KEEP | Onboarding for env vars; still valid. |
| `ROLE-MATRIX.md` | KEEP | Referenced from portal docs. |
| `RCRS-PLATFORM-INDEX.md` | KEEP | Master index, updated 2026-02-10. |
| `RCRS-SYSTEM-OVERVIEW.md` | KEEP | NotebookLM training source. |
| `COMPETITIVE-ANALYSIS.md` | KEEP | April 2026 research, still relevant. Note `docs/COMPETITIVE_ANALYSIS.md` also exists — consolidate. |
| `INVENTORY-FLOW-SPEC.md` | KEEP | Live spec for warehouse system. |
| `INVENTORY-APP-MASTER-PLAN.md` | KEEP | Live plan. |
| `SECURITY_AUDIT_2026_04_14.md` | KEEP | Recent audit, refer back. |
| `SECURITY_CHECKLIST_FINAL.md` | KEEP | Companion checklist. |
| `GOOGLE-SHEETS-GLOSSARY.md` | KEEP | Master data reference. |
| `MASTER_STRATEGY.md` | ARCHIVE | "Market Domination" roadmap — read-once strategic doc, no day-to-day use. |
| `PROJECT-OVERVIEW.md` | ARCHIVE | "Priority 1 Complete: Header/Navigation" — early-build status snapshot. |
| `RCRS-SITE-INDEX.md` | ARCHIVE | Build estimate doc; estimate already executed. |
| `RCRS-ROLLOUT-PLAN.md` | ARCHIVE | Rollout plan; mostly executed. |
| `RCRS-HONEST-AUDIT.md` | ARCHIVE | Feb 8, 2026 audit — superseded by April security audits. |
| `ROOFSTACK-MASTER-STATUS.md` | ARCHIVE | Apr 1, 2026 status snapshot. |
| `BNI-PRESENTATION-GUIDE.md` | ARCHIVE | One-off event guide. |
| `BOSTON-PIXEL-SETUP-GUIDE.md` | ARCHIVE | March 2026 one-off Pixel setup. |
| `PORTAL-TRAINING-GUIDE.md` | KEEP | Onboarding doc for team. |
| `TRAINING-PLAN.md` | KEEP | Meeting agenda template. |
| `SALES-PORTAL-DOCUMENTATION.md` | KEEP | Active sales-rep portal docs. |
| `UI-WALKTHROUGH.md` | KEEP | Every-role walkthrough — useful. |
| `PUNCHOUT-LIST.md` | ARCHIVE | Pre-launch checklist; launched. |
| `MORNING-QUESTIONS.md` | DELETE | "Morning Status - March 17, 2026 (Meeting Day)" — single-day status. |
| `OVERNIGHT-BUILD-SUMMARY.md` | ARCHIVE | March 16-17 session log. |
| `OPTIMIZATION_COMPLETE.md` | ARCHIVE | One-shot "🎉 OPTIMIZATION COMPLETE!" — historical. |
| `UI_UX_UPGRADE_COMPLETE.md` | ARCHIVE | One-shot completion doc. |
| `FINAL-SUMMARY.md` | DELETE | Generic "color system + location pages" wrap-up. |
| `OLD-TO-NEW-CHANGES.md` | DELETE | Color-system migration notes; migration done. |
| `HEADER-PREVIEW.md` | DELETE | Visual preview of an old header. |
| `IMAGE-CHECKLIST.md` | ARCHIVE | List of images to upload — likely done. |
| `IMAGE-SETUP-GUIDE.md` | ARCHIVE | Image setup walkthrough. |
| `QUICK-IMAGE-FIX.md` | DELETE | "GET YOUR IMAGES WORKING NOW!" — emergency fix doc. |
| `SETUP-FIX.md` | DELETE | "🚨 SETUP FIX - Directory Structure Issue" — historical fix. |
| `STEP-BY-STEP-GUIDE.md` | ARCHIVE | Color-system implementation walkthrough. |
| `COLOR-SCHEME-GUIDE.md` | KEEP | Reference for the color system. |
| `COLOR-SCHEME-VISUAL-REFERENCE.md` | KEEP | Visual ref. |
| `COLOR-PALETTE.txt` | KEEP | Quick palette ref. |
| `FILE-STRUCTURE-GUIDE.md` | ARCHIVE | Early file-layout doc; codebase has evolved. |
| `COMMAND-CENTER-README.md` | KEEP | If command-center is active. |
| `COMMAND-LINE-SETUP.txt` | ARCHIVE | One-time CLI bootstrap notes. |
| `IMPLEMENTATION-SUMMARY.txt` | DELETE | Decorative banner-art "implementation guide" for the color system. |
| `SECURITY-AUDIT-REPORT.md` | ARCHIVE | Superseded by `SECURITY_AUDIT_2026_04_14.md`. |
| `SECURITY_FIX_SUMMARY.txt` | ARCHIVE | Historical. |
| `SECURITY_PATCH_users-api.diff` | DELETE (after confirming applied) | One-off patch diff at repo root. |
| `INTEGRATION-TEST-REPORT.md` | ARCHIVE | Historical test report. |
| `E2E-TEST-REPORT-2026-04-03.md` | ARCHIVE | Dated test report. |
| `REVIEW_AND_TEST.md` | ARCHIVE | Old implementation review. |
| `ENV-CONFIGURATION-STATUS.md` | KEEP | Live env config tracker. |
| `GOOGLE-APPS-SCRIPT-SETUP.md` | KEEP | Apps Script setup ref. |
| `GOOGLE-SHEETS-TEMPLATE.txt` | KEEP | Template data. |
| `install-dependencies.md` | DELETE | "ADD THESE DEPENDENCIES TO YOUR PROJECT" — superseded by `package.json`. |
| `notebooklm-prompts.txt` | KEEP | Active NotebookLM prompts. |
| `roof-report-template.txt` | KEEP | Template still in use. |
| `cookies.txt` | DELETE | Stray `curl` cookie jar. |
| `curl-debug.txt` | DELETE | UTF-16-encoded curl stderr capture. Garbage. |

Counts: **KEEP 22, ARCHIVE 22, DELETE 12.**

---

## 5. Components not imported anywhere

Verified by ripgrep for `from .*Name|import .*Name` outside the component's own file:

| Component | Path | Notes |
|---|---|---|
| `ChatBot` | `components/ChatBot.tsx` | Import is commented out in `app/(site)/layout.tsx:11`. `DogChatBot` is the live one. |
| `FeatureUpdatesPopup` | `components/FeatureUpdatesPopup.tsx` | No importers. |
| `RoleTrainingPopup` | `components/RoleTrainingPopup.tsx` | No importers. |
| `PhotoGallery` | `components/customer-portal/PhotoGallery.tsx` | No importers. |
| `ReviewSubmission` | `components/customer-portal/ReviewSubmission.tsx` | No importers (different `ReviewRequestForm` is used). |
| `TurnstileWidget` | `components/forms/TurnstileWidget.tsx` | INVESTIGATE — bot protection may be needed; check before delete. |
| `DistributionCalculator` | `components/leads/DistributionCalculator.tsx` | No importers. |
| `LeadCard` | `components/leads/LeadCard.tsx` | No importers. |
| `LeadTimerBadge` | `components/leads/LeadTimerBadge.tsx` | No importers (timer logic may be inlined). |
| `RepAvailabilityToggle` | `components/leads/RepAvailabilityToggle.tsx` | No importers. |
| `RepPerformanceTable` | `components/leads/RepPerformanceTable.tsx` | No importers. |

The five `components/leads/*` orphans suggest an early leads-UI iteration was replaced by inlined JSX. Worth a focused review — diff against current `/portal/leads/page.tsx` to confirm nothing got lost.

`DailyActivityTracker` and `MondaySubmissionWidget` under `components/portal/` are also flagged by ts-prune but tie into active features (`[[project_meeting_numbers_flow]]`) — keep in INVESTIGATE bucket, not orphan.

---

## 6. `scripts/` triage

Total: 83 entries. None are referenced from `package.json` (only `dev`/`build`/`start`/`lint` defined), `vercel.json`, or other scripts. The cron jobs in `vercel.json` all hit `/api/cron/*` routes, not these scripts.

**Likely one-shot (delete or archive to `scripts/archive/`):**
- `fix-blog-images.js`, `fix-blog-images2.js`, ..., `fix-blog-images5.js` — five sequential variants. Worst-case keep the last one.
- `test-jn-api-shapes.mjs`, `test-jn-filter-json.mjs`, `test-jn-lookup-full.mjs`, `test-jn-lookup.mjs`, `test-jn-nested-filter.mjs`, `test-jn-portal-endpoints.mjs`, `test-jn-search-shapes.mjs` — JobNimbus API exploration scripts, all read-only probes.
- `backfill-historical-batch-2026-05-15.mjs` — dated batch.
- `backfill-historical-restocks.mjs`, `backfill-historical-tickets.js`, `backfill-email-tickets.mjs` — historical backfills, likely done.
- `find-all-restock-data.mjs`, `find-any-email-ticket.mjs`, `find-email-tickets.mjs`, `find-historical-sheets.mjs`, `find-missing-19th-email.mjs`, `find-restocks-everywhere.mjs` — exploration scripts.
- `inspect-1099-detail.mjs`, `inspect-commissions-export.mjs`, `inspect-email-ticket-materials.mjs`, `inspect-jn-job-shape.mjs`, `inspect-ticket-materials.mjs`, `inspect-ticket.mjs`, `inspect-transactions.mjs` — inspection probes.
- `probe-master-meetings.mjs`, `scan-master-history.mjs`, `scan-master-targeted.mjs` — one-shot probes.
- `rededuct-the-17.mjs` — date-specific recovery script.
- `rollback-historical-batch-deductions.mjs` — companion to a single backfill.
- `seed-reviews.mjs` — matches the orphan `app/api/admin/seed-reviews/route.ts` above.
- `rebuild-trip-xlsx-from-pdf.mjs` — one-shot rebuild.
- `audit-data-coverage.mjs`, `audit-ticket-aftermath.mjs`, `compare-inventory-tabs.mjs` — audit reports.
- `setup-twilio.py`, `setup-sheets.js` — initial-setup scripts.

**Probably keep (operational tools):**
- `backup-all.bat`, `backup-sheets.js`, `backup.js` — backup tooling (cron also exists, but manual run is useful).
- `refresh-all-data.mjs`, `refresh-commissions-full.mjs`, `refresh-commissions.mjs` — ops refreshers.
- `verify-breakdown-calcs.js`, `verify-inventory-live.mjs`, `verify-migration-tabs.mjs` — verification utilities.
- `aggregate-transactions.mjs`, `sync-meeting-numbers-2026.mjs` — periodic ops.
- `optimize-images.js`, `download-images.py`, `create-og-image.js` — asset pipeline.
- `add-geotags.py`, `build-reviews-master.py`, `rep-response-report.py` — reporting helpers.
- `check-blog-images.js`, `check-dupes.js`, `check-pending-tickets.mjs`, `check-team.js` — checks.
- `bonus-dashboard-2026.mjs`, `bonus-tracker-2026.mjs` — annual but currently relevant.
- `Modelfile.roof-llava` — Ollama model definition. Keep.
- `parse-inventory.js`, `restore-inventory-tab-final.mjs`, `analyze-historical-restocks.mjs`, `open-snapshot.mjs`, `diagnose-commissions.mjs`, `remove-prices.mjs`, `pull-2026-monthly.mjs`, `pull-2026-sales.mjs`, `test-parser.mjs`, `create-jn-test-token.mjs`, `create-test-token.mjs`, `fix-banner.mjs` — mixed; owner check needed.

The 5 in-repo planning docs (`scripts/CONSOLIDATION-PLAN.md`, `OVERNIGHT-STATUS.md`, `PHASE3-DOMAIN-AUDIT.md`, `SECRETS-ROTATION.md`, `SEO-2026-PLAYBOOK.md`, `SUGGESTED-AUTOMATIONS.md`) belong in `docs/`, not `scripts/`.

Recommend: create `scripts/archive/` and move the ~30 one-shot/historical scripts there in a future sweep. Keep `scripts/` itself for currently-operational tools.

---

## Open questions for owner

1. **`/awards-trip` public route** — was this intentionally public-facing, or did it escape the portal-only boundary? Per the domain-separation rule, anything tools-related belongs on rcrsal.com. Same question for `/chrisview` and `/trip/update` at top-level.
2. **`/dashboard` vs `/portal/dashboard`** — which is the canonical post-login landing? The 14-line wrapper at `/dashboard` looks vestigial.
3. **`/portal/profile` vs `/portal/my-profile`** — which is canonical? Both have edit/save UIs and both will write to the same backing data, so divergence risk is real.
4. **Email templates in `lib/email-templates.ts`** — `welcomeEmail`, `quoteFollowUpEmail`, `jobCompleteReviewEmail`, `referralRequestEmail`, `stormAlertEmail` all flagged as unused. Phase 1 of AGENDA is the email rebuild — are these the templates to keep, the ones to throw away, or were they never wired? **Resolve before touching email code.**
5. **`lib/cost-visibility.ts:canSeeCostOnDeliveryDoc`** — flagged unused. The purchase-price visibility rule is load-bearing (`[[feedback_purchase_price_visibility]]`). If this is the canonical helper and nothing imports it, the rule may not be enforced today. **Check the active enforcement path.**
6. **`components/forms/TurnstileWidget.tsx`** — orphan. Did Turnstile bot protection ever ship, or is it in the Phase 2 "Form-submission hardening" backlog?
7. **`lib/google-calendar.ts` calendar-link helpers** — flagged unused. Per CLAUDE.md global instructions ("use Google Calendar URL links, never .ics files"), these helpers should be the live path. If unused, calendar event surfaces may be broken or using `.ics`.
8. **`lib/bitcoin-service.ts`** — entire bitcoin payment path looks dormant. Confirm crypto payments are off the roadmap before deleting.
9. **`lib/blogData.ts` vs `lib/blogPostIndex.ts`** — two parallel blog data layers with overlapping export names. Which is the keeper?
10. **`/lp/*` landing pages** — confirm they're linked from paid creatives. If not, they're orphan landing pages collecting dust under a route group.
11. **Five `components/leads/*` orphans** — were they intentionally replaced by inlined JSX in `/portal/leads/page.tsx`, or did the refactor leave functionality on the floor?
12. **`scripts/` archival** — green-light moving the ~30 one-shot scripts into `scripts/archive/`? They're not run from `package.json`/`vercel.json`, but owner may still invoke them manually.

---

*End of triage. Read-only. No files modified.*
