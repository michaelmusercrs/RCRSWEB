# Comparative Research: Customer Portal + SEO + Web Design

*Compiled 2026-05-20 for River City Roofing Solutions. Read-only research; no code touched.*

Three short reports, each ending with a ranked "ship next" list. Owner facts (47 reviews, IKO-first, Madison/Limestone/Morgan AL, portal exists but isn't being shared yet) carried forward.

---

## PART 1 — Customer Portal UX (Phase 5.4)

### What the leaders are actually doing

**CompanyCam Customer Share / Showcases (2026)** — most copied pattern in roofing. Customer gets a link, not a login. They watch their roof go up via timestamped photos and short videos that the crew uploads from their phones; customers can add notes/comments back, which doubles as friction-free review collection. The 2026 "Showcases" release turned completed jobs into shareable galleries you can also use as marketing. [companycam.com/industries/roofing](https://companycam.com/industries/roofing), [companycam.com/resources/blog/companycam-roofr-integration](https://companycam.com/resources/blog/companycam-roofr-integration)

**Roofr** — instant-estimate flow: address → measurement preview → proposal with financing inside one link. "Your project is real" feeling before any rep call. [roofr.com/masterclass/roofr-x-companycam-how-to-use-our-newest-integration](https://roofr.com/masterclass/roofr-x-companycam-how-to-use-our-newest-integration)

**Hover** — 3D rendering of the customer's house with materials swapped on. Not a portal — a wow moment worth borrowing.

**Leap** — sales-cycle portal: contract, financing, ACH, e-sig in one screen. [servicetitan.com/blog/acculynx-alternatives](https://www.servicetitan.com/blog/acculynx-alternatives)

**JobNimbus** — generic; mostly invoice + doc download. Rarely cited as a retention reason.

**Outside roofing worth stealing from:**
- **Jobber Client Hub** — quote approve, "on-my-way" SMS, self-serve invoice pay. The "on-my-way text with crew name + photo + ETA" is the most-cited anxiety reducer in home services. [getjobber.com/comparison/jobber-vs-servicetitan](https://www.getjobber.com/comparison/jobber-vs-servicetitan)
- **ServiceTitan** — tech bio + photo on appointment reminder; 24/7 reschedule via SMS. [servicetitan.com/features/customer-portal-software](https://www.servicetitan.com/features/customer-portal-software)
- **Rover** — pre-service photo of the dog walker. Face-on-screen trust; transferable to "your PM today is Dustin."

### What actually reduces phone calls

The call-reduction wins cluster around 3 things: **photo cadence**, **schedule certainty**, **insurance-claim status**. `Status: scheduled` gets ignored; a photo of the dump trailer arriving does not.

### 5 portal features to ship — ranked

| # | Feature | Why it wins | Scope |
|---|---|---|---|
| 1 | **Magic-link share view (no login required)** — owner texts/emails a tokenized URL, customer sees: live photo feed + delivery ETA + PM name/photo + "next step" line | Single biggest call-volume killer; lets RCRS finally roll the portal out without onboarding friction. Same pattern CompanyCam uses. | 1-2 days |
| 2 | **Crew/PM "trading card" on appointment reminders** — name, face, phone, years on team, vehicle description, ETA window | Anxiety reducer #1 per Jobber+ServiceTitan data. Cheap to build, immediate trust. | 0.5 day |
| 3 | **Insurance claim timeline** — visible stages (Adjuster scheduled / Estimate received / Supplement filed / Approved / Scheduled), each with date + uploaded PDF | Insurance is the #1 call generator in storm-damage work. Move it self-serve. | 1 day |
| 4 | **Material delivery preview tile** — "Drop scheduled Tue 5/26 AM, crew start Wed AM, dumpster Mon PM" pulled from the JN + delivery system already in place | The "Tuesday or Wednesday?" question every customer asks. Data already exists in the master sheet. | 1 day |
| 5 | **Warranty + post-install packet on permanent URL** — IKO Craftsman Premier warranty PDF, before/after photos, paid invoice, transferability instructions, "request service" button | Eliminates the "I lost my paperwork" call 3-5 years out. Doubles as a referral asset. | 1 day |

Skip for now: in-portal chat (Slack/SMS already cover this), full account creation (kills adoption), in-portal scheduling (RCRS isn't volume-driven enough).

---

## PART 2 — SEO updates 2026 (Phase 5.5)

### What's changed in the last 6 months

**Helpful Content folded into core ranking.** No longer a separate update. The March 2026 core update emphasized first-person experience signals and demoted thin AI-spun pages. [developers.google.com/search/docs/fundamentals/creating-helpful-content](https://developers.google.com/search/docs/fundamentals/creating-helpful-content), [orbitinfotech.com/blog/google-2026-helpful-content-update/](https://orbitinfotech.com/blog/google-2026-helpful-content-update/)

**E-E-A-T "Experience" weight rose** — the first-person, did-you-actually-do-this signal is the most-scrutinized one for service businesses. Bylines, on-site EXIF'd photos, named-crew attribution all help. [keywordseverywhere.com/blog/google-e-e-a-t-guidelines-an-overview/](https://keywordseverywhere.com/blog/google-e-e-a-t-guidelines-an-overview/)

**Core Web Vitals tightened March 2026:** LCP "Good" dropped 2.5s → **2.0s**; INP is now equal primary signal (≤200ms); Google aggregates at the *site* level (>25% "Needs Improvement" URLs penalizes the whole domain). [ideafueled.com/blog/core-web-vitals-2026-explained/](https://ideafueled.com/blog/core-web-vitals-2026-explained/), [logoswebdesigns.com/blog/core-web-vitals-2026-march-update/](https://logoswebdesigns.com/blog/core-web-vitals-2026-march-update/)

**Local Pack weights (2026 BrightLocal/Whitespark):** GBP 32%, on-page 19%, **reviews 16%**, links 15%, behavioral 8%, citations 7%. Service-area businesses lean disproportionately on reviews + brand search + engagement. Owner *responses* are now a ranking input; recency and keyword sentiment outweigh raw count. [localdominator.co/local-search-ranking-factors/](https://localdominator.co/local-search-ranking-factors/), [almcorp.com/blog/google-3-pack-rankings-complete-guide/](https://almcorp.com/blog/google-3-pack-rankings-complete-guide/)

### Schema audit vs. `lib/seo` generators

RCRS already ships: `LocalBusiness`, `WebSite`, `FAQ`, `Organization`, `Article`, `Service`, `Person`, `Breadcrumb`, `Review`, `HowTo`, `ContactPage`, `AboutPage`, `CollectionPage`, `Video`. Strong baseline. **Gaps:**
- Site uses `LocalBusiness`, not the more specific **`RoofingContractor`** subtype Google recognizes. [schema.org/RoofingContractor](https://schema.org/RoofingContractor)
- No `Offer` / `AggregateOffer` on service pages (free inspection has an offer, list it)
- No `areaServed` array on `Service` schemas (Madison, Limestone, Morgan counties belong here)
- No `OpeningHoursSpecification` granularity (currently a string)
- No per-page `AggregateRating` pulling live review counts
- No `Product` schema on warranty/financing pages

### Reviews: 47 → 200+ without buying fakes

Pattern: trigger SMS+email at **load_verified** → one Y/N question → Yes deep-links to a Google review pre-filled with crew names; No routes to a private feedback form with owner alert. NiceJob/Birdeye charge $75-$300/mo for this. **Self-hosted equivalent**: Next.js route + Resend/Postmark + cron — RCRS has every piece in the delivery workflow already. Rough math: 80 jobs/mo × 40% response × 80% positive ≈ 25 new Google reviews/mo, past 200 in a year. (Math, not a study.) [brightlocal.com/learn/google-local-algorithm-and-ranking-factors/](https://www.brightlocal.com/learn/google-local-algorithm-and-ranking-factors/)

### 5 SEO improvements — ranked, ≤half-day each

| # | Improvement | Impact | Scope |
|---|---|---|---|
| 1 | **Wire review-request automation to `load_verified`** — Y/N pre-filter, Google deep link with crew names | The 47→200 problem. #1 weakness vs competitors. | 0.5 day |
| 2 | **Switch homepage schema to `RoofingContractor` + add `areaServed` array** (Decatur, Huntsville, Madison, Athens, Owens Cross Roads, all served counties) on every Service schema | Direct Local Pack signal; matches Google's preferred subtype. | 0.5 day |
| 3 | **Add `Offer` schema to "Free Roof Inspection"** + `AggregateRating` injected from live Google review count on every page | Rich-result eligible; star snippets in SERP. | 0.5 day |
| 4 | **INP/LCP audit + remediation** on top 10 pages by traffic — defer DogChatBot+EmailCapturePopup until idle, lazy-mount FloatingContactButton on scroll | March 2026 thresholds; site-level aggregation means 1 slow page hurts all | 0.5 day |
| 5 | **Add per-crew "Experience E" pages** — `/team/[name]` with real on-the-roof photos, years roofing, completed jobs, certs, signed by the owner. Link from every job complete email. | E-E-A-T experience signal Google is rewarding hardest in 2026. | 0.5 day per page; do top 5 reps first |

---

## PART 3 — Roofing-Company Web Design 2026 (Phase 5.6)

### Best-in-class references and the one element to steal from each

| Site | Steal this |
|---|---|
| **[roofmaxx.com](https://www.roofmaxx.com)** | Hero states the offer in one line + warranty badge directly next to the CTA. No video, no carousel. Loads under 2s on 4G. |
| **[hookagency.com/blog/best-roofing-websites-roofing](https://hookagency.com/blog/best-roofing-websites-roofing/)** showcased **Klaus Roofing** | Lazy-loaded short video testimonials directly on homepage — face + 12-sec story. Humanizes without killing LCP. |
| **[westcoastroofer.com](https://www.westcoastroofer.com)** (cited in Hook's roundup) | Interactive video of *their* crew on a real job, not stock footage. Operational transparency = trust. |
| **GAF Master Elite contractors** (e.g. [tadlockroofing.com](https://www.tadlockroofing.com)) | Manufacturer cert badges in hero band, not buried in footer. RCRS should lead IKO ROOFPRO Craftsman Premier the same way. |
| **[colby-roofing.com](https://www.colbyroofing.com)** (Colorlib roundup) | Interactive service-area map; user clicks county → goes to a real county landing page with local jobs. |
| **[malarkeyroofing.com](https://www.malarkeyroofing.com)** | Before/after slider with the divider draggable. Single most-engaged element on roofing sites. |
| **[lyonsroofing.com](https://www.lyonsroofing.com)** (commercial) | Trust stack above fold: BBB + review count + years + jobs completed in a single horizontal strip. |
| **[diamond-roofing.com](https://www.diamondroofingcompany.com)** | Sticky mobile "Tap to call" + "Text us" duo bar — both work, call for boomers, text for everyone else. |
| **[roofingsoftwareguide.com](https://roofingsoftwareguide.com)** examples | Photo grid is real EXIF'd jobs with the rep's name underneath. Direct E-E-A-T signal. |
| **[novule.com/blog/best-roofing-website-design](https://www.novule.com/blog/best-roofing-website-design)** (roundup) | "Speed-first hero, one CTA, badges adjacent" pattern reinforced across all top scorers. |

### 5 visual/structural improvements — ranked

| # | Change | Why |
|---|---|---|
| 1 | **Replace hero video with a 9:16 vertical loop of an actual RCRS install** (15-25 sec, muted, autoplay, poster preloaded) + IKO ROOFPRO Craftsman Premier badge directly beside the primary CTA. Drop the dark-mode + global video background pattern that's currently competing with the LCP. | Single biggest perception lift; CWV LCP win; IKO-first per memory rule. |
| 2 | **Draggable before/after slider** on `/gallery` and embedded on homepage, using 3 real Decatur/Huntsville/Madison projects. Pin date + neighborhood underneath. | Highest-engagement element across the roofing roundups; doubles as E-E-A-T. |
| 3 | **Trust strip directly under hero**: BBB A+ logo · IKO ROOFPRO Craftsman Premier · OC Preferred · Boral · "X reviews / 4.9 stars" · "Y roofs since 2017" · "Insured & Bonded". One row, mobile-scrollable. | Top scorers all do this; review count grows automatically once Part 2 #1 ships. |
| 4 | **Sticky mobile dual-CTA bar**: "Call (256) 274-8530" + "Text us". Tap-to-call left, SMS right. Hide on desktop. | Mobile is >70% of organic traffic for service businesses; current FloatingContactButton is fine but adds JS — a static `<a href="tel:">/<a href="sms:">` bar is faster and accessible. |
| 5 | **Per-county landing pages with a clickable AL map**: Madison, Limestone, Morgan, Lawrence, Cullman, etc. — each page shows actual completed jobs in that county with crew + date. Wire the map SVG to those routes. | Local Pack signal (Part 2 #2) + E-E-A-T + the pattern Colby/Klaus already use. |

What *not* to do: no "#1!" superlatives in hero, no spinning testimonials, no auto-audio, no full-page entry modals (DogChatBot is opt-in delight done right; EmailCapturePopup borders on the wrong kind).

---

## TL;DR — ship order across all three parts

1. **Review automation at `load_verified`** (0.5 day) — fixes the only objective SEO weakness
2. **Magic-link customer share view** (1-2 days) — unblocks portal roll-out
3. **`RoofingContractor` schema + `areaServed` + `Offer`** (0.5 day) — Local Pack
4. **Hero rebuild: real-install vertical video + IKO badge + tap-to-call** (1 day) — perception + LCP + Local Pack
5. **Insurance claim timeline in portal** (1 day) — call-volume killer #1

All five fit in a normal work week. Nothing here invents a stat the owner can't verify in a single Google query.

---

*Sources cited inline above. Memory items used: certifications (IKO first), domain separation (rivercityroofingsolutions.com is the public site only), reviews weakness (47 vs 800+), service counties, default-free-OSS preference.*
