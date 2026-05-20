# RCRS Sweep — Action Log

Single-line per action, in reverse-chronological order (newest at top). Each entry: `YYYY-MM-DD HH:MM` · actor · component · what · why · commit-or-link.

The scheduled routine appends an entry per action.

---

## 2026-05-20

- `19:00` · claude · lib/spam-log.ts (new) + 10 gate-site routes · Phase 6.3 spam-block audit log to master sheet — `logSpamBlock` calls added at every honeypot, spam-filter, and Turnstile rejection across the 10 public form endpoints · fire-and-forget; gate logic unchanged · commit pending
- `18:45` · claude · app/(tools)/admin/email-log/page.tsx + app/api/admin/email-log/route.ts (new) · Phase 6.2 `/admin/email-log` browseable viewer — filters by status/template/recipient/date, 30s auto-refresh, badges, summary tiles, requireAdmin gate · commit pending
- `18:15` · claude · lib/email-log.ts (new) + lib/email-service.ts · Phase 6.1 email send-log to master sheet — appends to "Email Log" tab for every send attempt (5 status paths); fire-and-forget so it never blocks · gives owner real-time audit of email behavior once Resend is live · commit 3eea308
- `18:00` · claude · 4 webhook routes · Phase 3b.6 webhook fail-closed hardening — JN was CRITICAL fail-open on missing signing secret (now 503), calls webhook had HIGH dev-mode loophole (closed), material-order-email tightened, GroupMe documented as intentionally unsigned · commit pending
- `17:30` · claude · 8 routes · Second security pass — 6 CRITICAL unauth routes in command-center/meetings + sales/projections + 2 HIGH POST endpoints (roof-measure/calibrate, dashboard/leads) all gated with requireAuth · QB commission + leaderboard + revenue were leaking · commit ffcc42e
- `17:15` · claude · docs/unauth-route-audit.md + docs/research-crm-comparison.md + lib/seo.ts + 4 layout/page files · Deeper unauth audit + CRM hybrid recommendation + SEO schema upgrades (15-county areaServed, real 317-review aggregateRating, IKO-led award order, BreadcrumbList on legal/careers/check-my-address, $0 Free Inspection Offer) · also fixed prior fabrication of 270/5.0 review stats → real 317/4.74 · commit pending
- `16:45` · claude · 32 files repo root → docs/archive/ · Phase 4 safe archive (cookies.txt, curl-debug.txt, 22 ARCHIVE-tagged + 10 non-code DELETE-tagged docs) · cleans root noise; reversible via git history; INDEX.md added · commit e26c2e8
- `16:30` · claude · lib/email-templates/load-verified-invoice-pdf.ts (new) + load-verified-invoice.ts (trimmed) + email-service.ts (Attachment interface + Resend attachment wiring) + package.json (pdfmake + @types/pdfmake) · Phase 1.3b PDF invoice — pdfmake-based real PDF attachment with cover-note HTML body; PDF-fail fallback sends cover-note alone · commit pending
- `16:00` · claude · OWNER-SETUP.md + docs/research-inventory-and-leaderboards.md + docs/research-portal-seo-design.md · 5-step owner setup checklist + Phase 5 research (inventory, leaderboards, portal UX, SEO 2026, design) — 15 ranked, scoped improvements · commit 798e71a
- `15:15` · claude · docs/dead-code-triage.md (new) · Phase 4 dead-code + duplicate-page triage — 8 page overlaps, 8 unreferenced API routes, 56 root docs scored, 11 orphan components, 83 script entries, 12 owner questions · commit 3678aa8
- `15:00` · claude · 10 API routes · Phase 2.6b — migrated forms from `lib/rate-limiter` (in-memory) to `lib/rate-limiter-kv` (Vercel KV with in-memory fallback) · cold-start bypass that let spam through is now closed when KV envs set · commit pending
- `14:45` · claude · lib/turnstile.ts + TurnstileWidget.tsx + 10 routes + 9 form components · Cloudflare Turnstile fully wired, inert until `NEXT_PUBLIC_TURNSTILE_SITE_KEY` + `TURNSTILE_SECRET_KEY` are set · `@marsidev/react-turnstile` installed; layered order honeypot → spam → turnstile → side-effects · commit pending
- `14:30` · claude · lib/rate-limiter-kv.ts (new) + package.json · Phase 2.6 Vercel KV-backed rate limiter — per-route factories with form-hardening thresholds; transparent in-memory fallback when KV env unset · cold-start bypass that let spam through is now closed when KV is provisioned · commit ddd3bc2
- `14:15` · claude · types/roles.ts + lib/permissions.ts + RoleBadge.tsx · Phase 3.9 — added project_manager + viewer to Role union + hierarchy + permissions + display names · PM mirrors Manager minus cost/billing per purchase-price rule · commit pending
- `14:10` · claude · monday-notes/announcements · Phase 3.10 — requireAuth gate added · was unauthenticated like meeting-data · commit pending
- `14:05` · claude · lib/email-service.ts · Phase 4 deprecation tags — @deprecated JSDoc on sendPortalLink + sendLeadAssignment + sendOfficeMaterialOrderNotification (3 dead wrappers) · keeps code, signals removal target · commit pending
- `14:00` · claude · 10 API routes + 10 form components + 2 new files · Phase 2.5c honeypot across all public forms — `website` invisible field, server-side `checkHoneypot()` gates BEFORE validation, generic 200 OK on trigger so bots can't probe · commit pending
- `13:45` · claude · 2 routes · CRITICAL security fixes — `/api/portal/meeting-data` now requireAuth (was unauthenticated, leaked leaderboard); `/api/admin/lead-distro/history` now requireAdmin (was requireAuth, reps could read distro logs) · per role audit findings · commit ec460cd
- `13:30` · claude · 8 form routes · Spam pre-gate applied across email-capture, contact, referral × 2, careers, bni-partner, leads/new, storm-report/email · `/api/forms/contact` pattern replicated; legit success-shape preserved on bot drop · commit pending
- `13:15` · claude · 4 routes · Recipient routing fixes from Phase 1.4 — storm-report → assigned rep (was comp email); JN webhook stock@ → rcrs@; michael@ typo → michaelmuse@ in command-center/team; material-order-pipeline gated to 4 milestone stages (was 18) · commit pending
- `13:00` · claude · lib/email-templates/ + email-service.ts wiring · Phase 1.3 template redesign for the 3 active templates — shared header/footer/button/table helpers, single accent color #0066CC, no neon-green band, mobile-friendly · commit pending
- `12:30` · claude · vercel.json · Removed weekly-numbers-reminder (× 2) + low-stock-alert crons · they fired emails that drop via allowlist anyway; saves cron quota · commit pending
- `12:15` · claude · lib/spam-filter.ts + data/lead-distro-config.json + app/api/forms/contact/route.ts · Hard-block customBlockedDomains + seed 4 known spam domains + apply spam check to contact form route · stop bot pitches at the door before they reach email · commit 2059755
- `12:00` · claude · lib/email-service.ts · Migrated from Google Apps Script to Resend SDK with per-template allowlist (default = contact-form, load-verified-invoice, driver-new-order) · finishes Phase 1.6 transport migration; awaits owner Resend env vars · commit pending
- `11:45` · claude · routine `rcrs-sweep` · Disabled all routine-side email (success + failure) per owner directive · zero-noise mode; ops failures surface via LOG.md instead · trigger trig_01VkrK3zux6G11GxgGjxYEJ9
- `11:05` · claude · docs/ · Added email-transport-comparison.md, email-callsite-audit.md, form-hardening-plan.md from parallel research agents · Phase 1.1, 1.2, 2 spec items done · commit f292368
- `10:35` · claude · repo · AGENDA.md + LOG.md created · canonical plan + action log for the multi-day sweep · commit 6fa9a3f
- `10:30` · claude · lib/email-service.ts · hard-disabled emailService.send() pending transport migration · GAS endpoint server-side amplifies every payload to owner gmail as malformed "NEW CONTACT FORM SUBMISSION" · commit 7787779
- `10:20` · claude · lib/form-service.ts · disabled GAS fetch in sendEmailNotification · stops "[Contact Page] New Lead:" amplifier path · commit 232fddd
- `10:18` · claude · lib/email-service.ts + lib/form-service.ts · per-recipient rate cap + removed gmail CC · first-pass safeguard; later proven insufficient (GAS injects gmail server-side, bypasses JS-side cap) · commit 3325653

---

## Format notes

- Use 24h local time.
- One action per line. Multiple related edits in one commit = one entry referencing the commit.
- For deploys: include the Vercel deployment URL or "auto-deploy on push".
- For owner-blocking decisions: use `actor=owner` and link the prompt/answer if possible.
