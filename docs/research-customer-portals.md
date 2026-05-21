# Customer-Portal Research — Roofing / Home-Services / GC Landscape

Research date: 2026-05-21. Purpose: inform the RCRS customer-portal build (rep introduction + curated photos/docs + engagement analytics, zero internal leakage).

---

## 1. Executive Summary

- **Table stakes (every mature product has these):** branded sub-domain or white-label URL, project status timeline, document storage, secure messaging, online payment, mobile-responsive web (no app required), email/SMS-based passwordless login.
- **Top differentiator #1:** a real **"preview / view as customer"** simulator. Only Houzz Pro markets this explicitly; everyone else makes the contractor guess. Building this is cheap and a huge trust lever.
- **Top differentiator #2:** **per-field visibility toggles** with sane defaults. Buildertrend and Knowify lead here. Most products treat "share with customer" as a binary, which is where leaks happen.
- **Top differentiator #3:** **technician/rep bio + photo before arrival** (ServiceTitan owns this in service trades). Roofing has not adopted it well — opening for RCRS.
- **Top differentiator #4:** **proposal/document view analytics** (Roofr is best in class — "viewed 15+ times" notifications drive close calls).
- **Industry blind spot:** **photo approval workflows are essentially non-existent.** Contractors upload to a job; "share gallery" is binary. Every product assumes the contractor curates before uploading, which is unrealistic. RCRS can win here with a two-stage `staged → approved → published` flow.
- **Industry blind spot #2:** **EXIF / GPS stripping on customer-facing photos is undocumented across all major players** (CompanyCam's policy confirms geolocation collection but is silent on stripping at the share edge).
- **Pricing pattern:** portals are almost always an *add-on* (AccuLynx, Buildertrend) — drives "nickel-and-diming" complaints. Bundling free is a sales hook.
- **Engagement ceiling:** competitors stop at "proposal opened" / "document signed." None expose tile-level interactions or repeat-visit cadence — clean differentiator if we don't make it creepy.
- **Native-app fatigue:** Roofr has no native app (PWA roadmap 2026). Stay PWA.

---

## 2. Per-Product Findings

### 1. CompanyCam (deep)
Photo-first SaaS, $19/user base. Customers see **Galleries** (curated photos) or **Reports** (photos + notes). 2026 added **Showcases** + **Portfolio** for marketing repurposing. **Hidden:** internal comments. GPS visible inside app; privacy policy silent on stripping at share boundary. **Approval workflow:** none. **Analytics:** thin on customer-share side; gallery is a public link, no view-analytics surfaced. **Loophole:** link-based, anyone with URL can view; no expiry, no email-gating by default.

### 2. AccuLynx Customer Portal (deep)
Marketed as the incumbent. Homeowner sees: project status, appointments, delivery dates, documents, **cost and payment history**, invoice balance, AccuPay financing application, secure messaging. Auto-updates from the CRM. **What's hidden:** the contractor manually decides what gets shared — but G2/Capterra reviewers complain about pricing opacity and that the portal is a **paid add-on** ("nickel-and-dime"). **Approval workflow:** none documented. **"Preview as customer":** not advertised. **Photo handling:** photos shared from job albums; no EXIF stripping documented. **Analytics:** auto-update events are tracked but contractor-facing engagement analytics are weak. **Loophole:** portal automatically reflects CRM changes — if a rep types a price comment in the wrong field, it can surface. **Tier:** premium add-on on top of $X/user base.

### 3. JobNimbus Customer Access (deep — our current CRM)
**Reality check: JobNimbus does not have a real customer portal in 2026.** UserVoice has open requests dating back years; the workaround is "share live job folder via link." This is exactly the gap RCRS is filling. JobNimbus offers per-job sharing of documents/photos but no branded homeowner login, no engagement analytics, no rep-bio, no approval workflow. **Implication for RCRS:** we are not duplicating an existing JN feature — we are building the layer JN never shipped. Integration risk is therefore lower (no overlap) and the upgrade path for our office staff is shorter.

### 4. Roofr Customer Portal (deep)
Modern UX, post-2024 entrant. Strong on **proposal tracking** — instant email when a customer opens a proposal, view-count exposed to rep ("viewed 15+ times" is a documented trigger for follow-up). Online payments (ACH + card) tied to approved proposals, e-sign, calendar-driven auto-notifications to homeowner on schedule changes. **No native app** as of April 2026; PWA on roadmap. **What's hidden:** no detail on per-field hiding; appears proposal-centric rather than full-project. **Analytics:** best-in-class for proposals (open count, time-to-open), weaker on photos/docs. **Loophole:** proposal-link-based — if forwarded, view-count attribution breaks.

### 5. Buildertrend Customer Portal
GC-oriented. Customer sees progress photos, schedule, selections (homeowner can approve choices in-portal), budget *if enabled*, daily logs. **Private notes are internal-only by design** — a clear contractor/client wall. Selections workflow with photos of options is unusually strong. **Approval workflow:** selections approval, yes; photo approval, no — photos uploaded to project surface in the portal. **Preview-as-client:** not advertised but per-field visibility toggles exist. **Loophole pattern in reviews:** confusion about default visibility — "we didn't realize budget was on by default." This is the #1 anti-pattern.

### 6. Houzz Pro Customer Portal
**The only product with an explicit "Preview Mode."** White-labeled to contractor's domain. Toggleable tiles: Financials, Selection Boards, Mood Boards, 3D Floor Plans, Tasks, Schedule, Files & Photos, Daily Logs. Cover image + video customization. QuickBooks Online sync. Light on roofing-specific (storm reports, supplements).

### 7. HOVER Customer Share
Not a portal — a **share link** to a 3D model + measurement report with photorealistic design choices. Enterprise tier embeds homeowner design tools on the contractor's site. **No project status, no payments, no docs** — plugs *into* a portal, doesn't replace one.

### 8. ServiceTitan Customer Experience
HVAC/plumbing/electrical lineage. Self-schedule, appointment confirm, **technician bio + photo + GPS-tracked ETA**, invoice history, online payment. The tech-bio-before-arrival pattern is their signature and absent in roofing — clear lift for RCRS.

### 9. Procore
Commercial GC. Heavy permissions matrix with "external user" templates for owners/subs. Not a homeowner portal — too complex. Reference only for permissions-matrix design.

### 10. Jobber / Hatch
**Jobber Client Hub:** branded portal, passwordless email/SMS login, appointments with **photos of the assigned crew**, online payment with tipping, self-request more work, referral prompts. **Hatch:** outreach automation, not a portal; reviews note post-sale support gaps and integration breakage.

---

## 3. Features RCRS Should Adopt (Ranked)

1. **Rep intro tile** — photo, bio, certifications, direct phone/SMS, "schedule a call" button. Borrow ServiceTitan tech-bio + Jobber crew-photo pattern. **No competitor in roofing does this well.**
2. **Per-field visibility toggles with sane defaults** — Buildertrend-style. Default OFF for cost, balance due, internal notes; default ON for status, photos (approved), schedule, rep contact.
3. **Two-stage photo approval workflow** — `staged → approved → published`. Rep uploads to job; admin/PM clicks Approve before it appears in the portal. Industry-wide gap.
4. **EXIF/GPS stripping at the gallery edge** — strip on upload to the customer-visible bucket. Keep the originals internal. Defensible privacy posture.
5. **"View as this customer" preview** — single button in admin that opens the exact customer URL in an iframe or impersonation cookie. Houzz Pro is the only product marketing this; it's a 1-day build and a massive trust win.
6. **First-photo-as-cover convention** — auto-pick first approved photo as the project hero image, override-able. Matches CompanyCam's gallery UX customers already expect.
7. **Engagement tracking, contractor-facing** — beat Roofr's "proposal opened" with: tile clicks, doc opens, time-on-page per visit, repeat-visit count, last-seen timestamp. Show in the rep's job view, not as a vanity dashboard.
8. **Passwordless login (email/SMS magic link)** — Jobber's pattern. No passwords for homeowners ever.
9. **Storm-report / weather tile** (roofing-specific) — none of the GC products have this. Pull NOAA / our existing hail report into a project tile.
10. **Branded sub-domain per project** (or at minimum `/portal/[token]`) — keep it off rcrsal.com (portal domain rule already in memory) and host on `rivercityroofingsolutions.com/p/[token]` per domain-separation rule.
11. **Customer download of approved photos only** — zip-bundle of just the approved set, never the raw bucket.
12. **Auto-notification on milestones** (Buildertrend pattern) — schedule change, photo published, document uploaded, payment received.

---

## 4. Anti-Patterns to Avoid

- **Binary "share entire job"** — CompanyCam's model. Leads to accidental leaks of pricing notes.
- **Default-on budget/cost visibility** — Buildertrend reviewer complaint pattern. Cost MUST be opt-in per-job.
- **Public link with no expiry, no email gate** — CompanyCam gallery model. If the customer forwards the link, anyone has access.
- **Live mirror of CRM fields** — AccuLynx auto-update model. A rep typo in the wrong field instantly leaks. Always go through a published-snapshot layer.
- **Pricing the portal as an add-on** — AccuLynx's "nickel-and-dime" complaint. Bundle ours for free, use it as a sales differentiator.
- **Forcing a native app install** — Roofr learned this; PWA only.
- **No "view as customer" preview** — every product except Houzz Pro fails here. Reps end up testing in production by emailing themselves.
- **Showing other customers' data anywhere** (rep performance dashboards, leaderboards, "recent jobs" tiles). Hard wall, per-customer auth scope only.
- **Internal note fields visible to "trusted" external users** — Procore's permission matrix has burned firms because the default external template still shows comment threads on RFIs. Default-deny internal notes; explicit allowlist only.
- **Surfacing GPS in photo metadata** — silent leak of crew member home addresses and other job sites.

---

## 5. Loophole Catalog (with Defenses)

| # | Loophole / Abuse Pattern | Where seen | Defense for RCRS |
|---|---|---|---|
| 1 | Public link with no expiry / no email gate | CompanyCam galleries | Token bound to email; 90-day default expiry; re-auth on new device |
| 2 | EXIF GPS leaks crew home / other jobs | All photo apps; not stripped at share | Strip EXIF on copy into customer bucket; keep originals internal |
| 3 | CRM live-mirror leaks rep typos | AccuLynx auto-update model | Two-stage staged→published snapshot; never live-render internal fields |
| 4 | Customer forwards link, view-count attribution breaks | Roofr proposals | Bind token to email; re-magic-link required on new device |
| 5 | Default-on cost/budget visibility | Buildertrend reviewer complaint | Cost fields default OFF globally; per-job opt-in by admin only |
| 6 | Internal comments visible to "trusted" externals | Procore | Hard separation of `internal_notes` table; never queried by portal API |
| 7 | Rep performance / leaderboards leak across customers | Hypothetical but easy bug | Tenant-scoped queries; row-level filter by `customer_id`, audited |
| 8 | Photos auto-publish before review | All photo-first products | Mandatory approval queue; `published_at IS NULL` filter on portal |
| 9 | Add-on creep / paywall basics | AccuLynx | Bundle everything; no SKU split |
| 10 | Rep abuses "customer view" to fake activity | Could affect engagement analytics | Distinguish `viewer_role=staff` events; exclude from customer-engagement metrics |
| 11 | Cancellation = lose all docs | AccuLynx BBB complaint pattern | Self-serve export of all photos+docs as ZIP, available always |
| 12 | Refund retaliation after BBB complaint | AccuLynx BBB | Policy, not technical: document refund SLA publicly |
| 13 | Pricing visible in PDF metadata even if hidden in UI | Common PDF leak | Re-render PDFs through a sanitizer; strip XMP/Producer metadata |
| 14 | Old shared link still works after job closed | Industry-wide | Token revoke on job close; portal shows read-only archive |
| 15 | Customer sees other customer's address via URL enumeration | Bad ID design | UUIDv4 tokens, never sequential IDs; 404 on cross-tenant access |

---

## 6. Approval-Workflow Patterns

Most mature products do **not** have photo approval; the assumption is that the rep uploads only what they want shared. This breaks in practice (reps upload everything, then someone has to clean up).

Best-of-breed compound pattern for RCRS:

1. **Photo lifecycle:** `uploaded` → `staged_for_customer` (rep flags) → `approved` (admin/PM sign-off) → `published` (visible in portal). Each transition logged with actor + timestamp.
2. **Bulk approve:** admin sees a queue of staged photos for the day, can approve in bulk with a single click per job.
3. **First-photo-as-cover:** the first `published` photo becomes the project cover, override-able.
4. **Customer comments on photos:** allow but moderate; comments are private-to-rep until rep replies (avoids customer-vs-customer drama in shared galleries).
5. **Documents:** same lifecycle — `uploaded` → `staged` → `approved` → `published`. PDFs re-rendered through sanitizer to strip metadata.
6. **Selections / change orders** (Buildertrend pattern): customer can approve or request change, with audit trail. Rep cannot edit a customer's approval — only invalidate and re-issue.
7. **Curated by default:** never auto-publish. The only auto-action is *staging* a photo into the queue when a rep tags it `customer-ready`.

---

## 7. Analytics Patterns — Worth vs Vanity

**Worth tracking (actionable):**

- **Time-to-first-view** after invitation sent — predicts engagement / churn risk.
- **Last-seen timestamp** per customer — surfaces in rep's job view, drives follow-up timing.
- **Document open events** per doc — confirms estimate / contract was actually read before signing.
- **Tile click distribution** — tells us which tiles matter; informs product roadmap.
- **Repeat-visit count + cadence** — engaged customers visit more; signals upsell window (warranty, gutters, future work).
- **Approval cycle time** — staged → published latency, exposes operational bottlenecks.
- **Photo views per published photo** — informs which "before/after" content to feature in marketing (with consent).

**Vanity / creepy (avoid):**

- **Precise dwell time per tile** — feels surveillance-y, low signal.
- **Geolocation of customer when viewing** — never collect; pure liability.
- **Mouse-move heatmaps** — Hotjar-style — creepy, GDPR/CCPA exposure.
- **Aggregated "engagement score" leaderboards** — encourages rep gaming; not customer-facing-friendly.
- **Predicting churn from engagement** — too noisy on small samples (most homeowners are one-and-done).

**Rule:** anything we'd be embarrassed to show the customer if they asked "what do you track about me?" should not be tracked. Publish a plain-English privacy notice listing exactly the events above.

---

## 8. Sources

- AccuLynx Customer Portal — https://acculynx.com/features/customer-portal-software/
- AccuLynx Spring 2026 updates — https://acculynx.com/spring-2026-product-updates/
- AccuLynx pricing analysis — https://www.roofingsoftwareguide.com/reviews/acculynx
- AccuLynx G2 reviews — https://www.g2.com/products/acculynx/reviews
- CompanyCam roofing — https://companycam.com/industries/roofing
- CompanyCam privacy policy — https://companycam.com/privacy-policy
- CompanyCam 2026 review — https://roofingsoftwareguide.com/reviews/companycam-review/
- JobNimbus G2 reviews — https://www.g2.com/products/jobnimbus/reviews
- JobNimbus customer-portal feature request — https://jobnimbus.uservoice.com/forums/136212-general/suggestions/49324985-customer-access-portal-in-jobnimbus
- JobNimbus improved share/portal request — https://jobnimbus.uservoice.com/forums/921079-communication/suggestions/35408959-improved-share-client-portal
- Roofr CRM — https://roofr.com/crm
- Roofr G2 reviews — https://www.g2.com/products/roofr/reviews
- Roofr 2026 review — https://www.spotsaas.com/blog/roofr-reviews/
- Buildertrend Client Portal — https://buildertrend.com/communication/construction-client-portal/
- Buildertrend Client Portal FAQs — https://buildertrend.com/help-article/client-portal-faqs/
- Buildertrend Selections overview — https://buildertrend.com/help-article/selections-overview/
- Houzz Pro Client Dashboard — https://pro.houzz.com/for-pros/feature-client-dashboards
- Houzz Pro Construction Portal — https://pro.houzz.com/for-pros/software-construction-client-portal
- Houzz Pro preview/share — https://www.houzz.com/pro-help/r/how-to-preview-and-share-the-client-dashboard
- HOVER product page — https://hover.to/product/
- HOVER reviews — https://www.capterra.com/p/239375/HOVER/reviews/
- ServiceTitan Customer Portal — https://www.servicetitan.com/features/customer-portal-software
- ServiceTitan New Portal docs — https://help.servicetitan.com/how-to/the-new-customer-portal-experience
- Procore User Permissions Matrix — https://en-ca.support.procore.com/references/user-permissions-matrix-web
- Jobber Client Hub — https://www.getjobber.com/features/client-hub/
- Jobber Client Hub Settings — https://help.getjobber.com/hc/en-us/articles/115009571307-Client-Hub-Settings
- Hatch G2 reviews — https://www.g2.com/products/hatchify-hatch/reviews
- EXIF privacy risk overview — https://beaglesecurity.com/blog/vulnerability/exif-data-information-leakage.html
- ISACA on EXIF risk — https://www.isaca.org/resources/news-and-trends/industry-news/2025/what-to-know-about-exif-data-a-more-subtle-cybersecurity-risk
