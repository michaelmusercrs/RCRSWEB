# Roofing CRM Comparison: RCRS In-House Portal vs Industry Tools

**Date:** 2026-05-20
**Audience:** Owner / Admin (RCRS, ~8-12 reps, residential, Decatur AL)
**Scope:** Where the in-house portal at `rcrsal.com` duplicates effort vs adds unique value.
**Status:** Read-only research; no code changes.

---

## Why this doc exists

RCRS already pays for JobNimbus (`lib/jobnimbus-service.ts`, `lib/jn-sync-engine.ts`) and uses it as the job/CRM source of truth for parts of the flow. At the same time the in-house portal has grown to 51 portal sections, 174 service files in `lib/`, and a full warehouse pipeline (`lib/material-order-pipeline.ts` - 18 stages). The owner needs to know which pieces are worth maintaining vs which are reinventing what a paid CRM already does well.

---

## CRM-by-CRM breakdown

### 1. JobNimbus (current)
**#1 differentiator:** Mature, opinionated job/sales boards with deep supplier integrations (Beacon PRO+, SRS Distribution, QuickBooks Online/Desktop, EagleView, HOVER) and a real iOS/Android app rated 4.8 stars. It is the contractor-CRM default.
**What RCRS doesn't do that JN does:** A real mobile field app (photo capture with geotag + annotation, offline-tolerant) and native 2-way QuickBooks sync. RCRS currently has no first-party mobile app - reps use the web portal.
**What RCRS does better today:** Lead distribution scoring (`lib/lead-distribution-service.ts` weights proximity, response time, attendance, referrals) - JN routing is dumber. RCRS also has GroupMe push (`lib/groupme-service.ts`), per-rep response-timer enforcement (`app/api/leads/response-timer/`), and the three separate leaderboards (Commission / Sales / Weekly) which JN cannot model without heavy custom reports.
**Pricing:** No public per-user list. Third-party reporting (ProJul, QuoteIQ, May 2026) shows ~$225/mo base (Growing) or $550/mo (Established, required for API access) + $30-$75 per user/mo + texting add-on $49-$249. A 10-user shop with API access lands around $1,000-$1,400/mo.

### 2. AccuLynx (acculynx.com)
**#1 differentiator:** Tightest end-to-end supplier + measurement loop in the industry - one click to order EagleView, HOVER, Geospan, or GAF QuickMeasure and auto-populate the estimate, plus direct ordering from ABC Supply, SRS, and QXO with preferred pricing baked in.
**What RCRS doesn't do that AccuLynx does:** Direct supplier catalog with one-click PO (RCRS sends material orders by email - `lib/material-order-email-parser.ts`). Also: SmartDocs e-signature for contracts/supplements, native insurance supplement workflow, mortgage check tracking.
**What RCRS does better:** Lead-distribution intelligence, our 3-leaderboard model, public-facing storm reports (`lib/storm-report-service.ts` + `app/api/hailrecon/`), and Monday meeting accumulation (`lib/meeting-numbers-service.ts`). AccuLynx has no concept of a weekly-numbers self-report.
**Pricing:** Sales-call only. Aggregator data (ITQlick, RoofingSoftwareGuide, April 2026) puts the Elite tier at ~$100-$120/user/mo + ~$250/mo Essential base + add-ons. A 10-user shop is ~$1,000-$1,500/mo, often with annual commit.

### 3. RoofSnap (roofsnap.com)
**#1 differentiator:** On-demand outsourced roof measurement reports - 4-hour standard / 30-min rush - bundled with editing and estimating. It is a measurement-first product, not a CRM.
**What RCRS doesn't do that RoofSnap does:** Human-verified measurement reports at scale. RCRS's `lib/roof-measure-service.ts` is AI-consensus (Vertex/Gemini/Claude/Ollama) - fast and free but not adjuster-grade.
**What RCRS does better:** Everything outside measurement - lead distro, CRM, portals, leaderboards. RoofSnap is not a competitor for the whole workflow.
**Pricing:** Public on roofsnap.com - $52/user/mo annual or $105/user/mo monthly. Roughly $520/mo annual for 10 users plus per-report fees (~$20-$45/report depending on speed).

### 4. Leap (leaptodigital.com)
**#1 differentiator:** Mobile-first sales rep workflow - dynamic digital contracts, in-home estimate-to-signature on a tablet, integrated financing offer at the kitchen table, and LeapPay processing.
**What RCRS doesn't do that Leap does:** In-home digital contract + e-sign + financing offer in one flow. RCRS estimate-calculator exists (`lib/estimate-calculator-service.ts`) but there is no contract-signature surface for reps.
**What RCRS does better:** Operations after the sale - warehouse pipeline, delivery-driver portal (`app/(tools)/portal/delivery/driver/`), 18-stage material order tracking. Leap is thin on production.
**Pricing:** Public - $79/mo single user (Essential), $298/mo + $99/user for Team. A 10-user shop is ~$1,189/mo.

### 5. Improveit 360 (improveit360.com)
**#1 differentiator:** Built on Salesforce, so reporting and pipeline customization are deeper than any roofing-native CRM. Targeted at multi-location remodelers.
**What RCRS doesn't do that Improveit does:** Real BI reporting (Salesforce dashboards), multi-location pipelines, formal lead-source attribution accounting.
**What RCRS does better:** Cost. RCRS has cost-visibility rules baked in (`lib/cost-visibility.ts`), three-leaderboard logic, and roofing-specific flows (storm reports, hail data via Iowa State Mesonet). Improveit is generic home-services.
**Pricing:** Sales-call only. ITQlick (May 2026) estimates ~$85/user/mo with a typical floor near $500/mo. For a 10-user shop expect $850-$1,200/mo plus implementation.

### 6. Followup CRM (followupcrm.com)
**#1 differentiator:** Bid/proposal tracking aimed at commercial contractors - strong for sales-pipeline accountability and rep activity logging.
**What RCRS doesn't do that Followup does:** Bid-stage tracking and a long-cycle sales-activity dashboard built for outside reps.
**What RCRS does better:** Almost everything residential-roofing-specific: hail data, storm reports, GroupMe push, customer portals, Monday meeting accumulation. Followup is built for a different sale.
**Pricing:** No public list. Third-party (Capterra, G2, 2026) aggregates: ~$49-$199/user/mo across Basic/Pro/Enterprise; one source quotes ~$4,500/yr for 5 users. A 10-user shop likely lands $700-$1,500/mo.

---

## Capability matrix - What RCRS does vs best-in-class

| Capability | What RCRS does | Best-in-class CRM does |
|---|---|---|
| Lead intake forms | Custom Next.js forms with Turnstile + honeypot + spam filter (`lib/turnstile.ts`, `lib/honeypot.ts`, `lib/spam-filter.ts`) | JobNimbus webforms (basic) - RCRS forms are stronger |
| Lead distribution | Weighted scoring: proximity + referrals + attendance + response time + close rate (`lib/lead-distribution-service.ts`) | AccuLynx / JN: round-robin or manual - **RCRS wins** |
| Lead response timer | `lib/lead-response-timer.ts` + cron `/api/cron/check-lead-timers` auto-reassigns stale leads | JN has no automatic reassignment - **RCRS wins** |
| Job creation | Reads from JobNimbus as source of truth (`lib/jn-sync-engine.ts`) | JN native - **JN wins** |
| Estimating | `lib/estimate-calculator-service.ts` + internal pricing page | AccuLynx + Leap have richer estimate UIs and e-sign - **CRM wins** |
| Aerial measurements | AI consensus (5 models) via `lib/roof-measure-service.ts` - free, fast, not adjuster-grade | AccuLynx/JN: 1-click EagleView/HOVER/QuickMeasure - **CRM wins for insurance work** |
| Material orders | 18-stage pipeline (`lib/material-order-pipeline.ts`) + PDF emails to stock@rcrsal.com - cost hidden from JN/reps | AccuLynx ABC/SRS catalogs - **AccuLynx wins on supplier catalog, RCRS wins on cost hiding** |
| Material cost privacy | `lib/cost-visibility.ts` strips cost for rep/customer roles | No CRM enforces this - **RCRS wins** |
| Customer portal | Token-based access (`lib/customer-portal-service.ts`), service request, warranty claim, notification prefs | AccuLynx/Leap have polished portals - **roughly tied** |
| Commission tracking | Reads QuickBooks 1099 sheet (separate from accrual) (`app/(tools)/portal/sales/commissions/`) | JN/AccuLynx track in-CRM only - **RCRS wins on QB truth** |
| Sales leaderboard | Three separate boards: Commission / Sales accrual / Weekly self-report | CRMs collapse to one number - **RCRS wins** |
| Monday meeting numbers | Auto-sheet from `1tEbMVUrvrRIkptISumvIrcgUhSWN5X2ldYro9ADTXF0` + slides + weather (`lib/meeting-numbers-service.ts`) | No CRM does this - **RCRS unique** |
| Storm/hail reports | NWS + Iowa State Mesonet via `lib/hailrecon-service.ts` and `lib/storm-report-service.ts`, shareable on public site | HailTrace / Interactive Hail Maps are separate paid tools - **RCRS wins** |
| GroupMe push | `lib/groupme-service.ts` posts to rep group on lead assignment | No CRM has GroupMe; JN does SMS only - **RCRS wins** |
| PDF invoices | `lib/invoice-pdf-service.ts` HTML-to-PDF, `lib/email-templates/load-verified-invoice-pdf.ts` | JN/AccuLynx native invoicing tied to QB - **CRM wins on QB tie** |
| Mobile app | None - responsive web only | JN 4.8-star native iOS/Android, AccuLynx native mobile - **CRM wins** |
| Photo annotation | Upload + tagging in admin; no in-field draw tools | JN/AccuLynx native annotation, geotag, offline cache - **CRM wins** |
| Customer breakdowns | `lib/customer-breakdown-service.ts` + `app/(tools)/portal/customer-breakdowns/` - per-customer view of every job, message, doc | JN has customer pages but lacks the auto-rolled breakdown view - **roughly tied** |
| Warehouse / loading | Driver portal, route tracker, X88 warehouse display, GPS pings (`app/(tools)/portal/warehouse/`) | No CRM has this - **RCRS unique** |
| Public website + SEO | Same Next.js app as portal - blog, services, BNI pages, infographics | CRMs do not include a public website - **RCRS unique** |
| Audit log | `lib/audit-logger.ts` + `lib/audit-sheet-logger.ts` writes every event to a sheet tab | JN/AccuLynx have CRM audit logs but not exportable to sheets - **roughly tied** |

---

## Recommendation

Three options:

**A) All in-house** - Close every gap (mobile app, e-sign, supplier API, EagleView 1-click). 6+ months of work; permanently competes with vendors that ship daily.

**B) Lean into JobNimbus** - Defer customer portal, estimating, photos, mobile to JN. Keep only the surfaces JN cannot do. Means deprecating ~30 of 51 portal sections.

**C) Hybrid - explicit ownership** - Declare which system owns each capability and stop double-building.

**Pick C.** For an 8-12 rep residential shop the right split is: **JN owns** job records, estimates, e-sign, mobile field photos, QB sync, supplier orders to Beacon/SRS. **RCRS owns** lead distribution + scoring, the three leaderboards, Monday meeting numbers, storm/hail reports, public website + SEO, warehouse pipeline, cost-privacy enforcement, GroupMe. This stops the duplication on the estimating/mobile/portal fronts (where JN is years ahead and improving) and doubles down on the surfaces where the in-house code already wins and a CRM literally cannot follow - meeting numbers, storm reports, leaderboards, warehouse - because they encode RCRS-specific business rules that no vendor will ever support.

---

## Strategic moat - 5 wins no CRM does better (1-2 days each)

1. **Hail-event auto-canvass list** - Use existing `lib/hailrecon-service.ts` + `lib/geocoding-service.ts` to auto-generate a door-knock list of homes within X miles of a 1"+ hail event, push to the rep's portal as a Map view. Files exist; needs a route + GroupMe ping. No CRM does this for North Alabama specifically.

2. **Monday meeting prep auto-fill** - Already half-built (`lib/meeting-numbers-service.ts`, `lib/monday-notes-service.ts`). Lock in the prep-sheet persistence and auto-generate the slide deck Sunday night using `tmp-slides/` infrastructure. Owner already has the format settled in memory.

3. **Cost-privacy guard on JN exports** - JN cannot enforce that material cost stays away from reps. Wrap every JN job read through `lib/cost-visibility.ts.stripCostFields` at the API boundary (`lib/jobnimbus-service.ts`). One-day hardening that no CRM can replicate.

4. **Three-leaderboard live dashboard** - The boards exist (`app/(tools)/portal/sales/leaderboard/`, `commissions/`, `weekly-numbers/`) but are pulled separately. Build one Command Center widget that shows all three side-by-side with the "never combine" rule visible. Reuses `lib/rep-stats-service.ts` and the QB sheet.

5. **Storm-report shareable PDF + magic link** - `lib/storm-report-service.ts` generates reports; `lib/customer-portal-service.ts` issues tokens. Wire them together so a rep at the door texts a magic link showing the actual hail history at THIS address. AccuLynx and JN do not have address-specific storm history baked in.

---

## Sources

- JobNimbus pricing: [ProJul 2026 breakdown](https://projul.com/blog/jobnimbus-pricing-analysis-2026/), [QuoteIQ 2025 breakdown](https://myquoteiq.com/jobnimbus-pricing-breakdown-2025/), [JobNimbus pricing page](https://www.jobnimbus.com/pricing)
- AccuLynx: [ITQlick 2026](https://www.itqlick.com/acculynx/pricing), [RoofingSoftwareGuide 2026](https://roofingsoftwareguide.com/guides/acculynx-pricing/), [AccuLynx features](https://www.acculynx.com/features/)
- RoofSnap: [RoofSnap pricing](https://www.roofsnap.com/pricing)
- Leap: [Leap pricing](https://leaptodigital.com/pricing/)
- Improveit 360: [ITQlick 2026](https://www.itqlick.com/improveit-360/pricing)
- Followup CRM: [Followup CRM pricing](https://www.followupcrm.com/pricing), [Capterra](https://www.capterra.com/p/137381/FollowUp-Power/)
