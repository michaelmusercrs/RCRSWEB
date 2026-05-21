# Customer Portal v2 — Spec + Recommendations
**Date:** 2026-05-21
**Status:** PLAN ONLY — do not build until Michael approves
**Companion reading:** `docs/research-customer-portals.md` (competitive scan)

---

## North star — one source of truth, three audiences

Today rep info lives in three places, with three different shapes:
- **Public website** `/meet-the-team` (marketing copy, SEO-friendly)
- **Internal portal** profile (training, HR-adjacent)
- **Customer portal** (the new welcome page)

That's a maintenance trap. Hunter shouldn't have to update his bio three times.

**Single source of truth:** `Team_Profiles` sheet tab + an image library in Vercel Blob. Every surface reads from the same record; each surface RENDERS what's appropriate for its audience.

```
              ┌─── Public meet-the-team ──── (SEO copy + reviews + cert chips)
              │
Team_Profiles ┼─── Internal portal profile ── (full record + training fields)
   (sheet)    │
              └─── Customer portal page ───── (curated subset, rep-approved)
                                              ↑
                                       admin & rep visibility filters
```

Same data, three views. Edits propagate everywhere on approval.

---

## Data model

### `Team_Profiles` sheet — extended

Existing fields (just shipped today): `repSlug, bio, headshotUrl, truckPicUrl, certifications, yearsExperience, favoriteQuote, updatedAt, updatedBy`.

**Add:**
- `status` — `draft` | `pending-approval` | `published` | `needs-changes`
- `pendingDraft` — JSON blob of unapproved edits (so rep edits don't clobber published copy)
- `approvedBy` — Michael / Chris / Sara (whoever clicked Approve)
- `approvedAt`
- `rejectionNotes` — when admin sends back for changes
- `version` — incrementing integer, bumped on every approval (for audit & rollback)
- `personalReviewIds` — pipe-delimited list of review IDs the rep selected to display
- `fallbackToCompanyReviews` — boolean — when true, supplement with general company reviews if personal pool is thin
- `publishedAt` — when the current version went live

### New: `Rep_Photo_Library`

A separate tab so photo uploads don't bloat the profile row. Per photo:
- `photoId` — short ID
- `repSlug` — owner
- `url` — Vercel Blob URL
- `caption`
- `kind` — `headshot` | `truck` | `job-completed` | `job-progress` | `team`
- `jobJnid` — when tied to a JN job
- `status` — `staged` | `pending-approval` | `approved` | `rejected`
- `submittedAt`, `approvedBy`, `approvedAt`
- `tags` — pipe-delimited
- `isFirstPhotoOnJob` — boolean — first photo taken on a job auto-flags here (becomes the proposed cover image; still needs approval per Michael's stated rule)

### New: `Customer_Portal_Config`

Single-row sheet (admin-controlled). Defines what's available globally:
- `enabledTiles` — pipe-delimited list of tile keys (e.g. `rep-intro|next-steps|iko-visualizer|photo-gallery|doc-library|weather|storm-report`)
- `allowedRepDataFields` — what fields from `Team_Profiles` the customer portal is allowed to render
- `allowedDocTypes` — what file types reps can attach to a customer portal (e.g. `inspection-report|proposal|warranty|completion-cert` — NOT `internal-pricing|cost-breakdown`)
- `maxPhotosPerJob` — sanity cap to keep portals from becoming galleries
- `tokenExpiryDays` — how long a customer portal link stays valid (default 180)
- `layoutOrder` — JSON array defining tile order
- `analyticsEnabled` — toggle for the event log
- `updatedAt`, `updatedBy`

### New: `Rep_Customer_Portal_Prefs`

Per-rep override of admin defaults. Reps can only DISABLE tiles admin enabled — they can't enable tiles admin disabled. Fields per rep:
- `repSlug`
- `tilesEnabledOverride` — JSON: per-tile enabled boolean (only valid for admin-enabled tiles)
- `defaultJobPhotoBehavior` — `auto-approve-first-photo` | `manual-approval-always`
- `reviewDisplayMode` — `personal-only` | `personal-plus-company-fallback` | `company-only`
- `customWelcomeMessage` — optional rep-personalized message overriding the default

### New: `Customer_Portal_Events`

Analytics log — one row per event:
- `eventId`
- `portalToken` (hashed for privacy in long-term archive)
- `customerName` (so we can attribute without storing the customer email here)
- `jobJnid`
- `assignedRep`
- `eventType` — `portal_view` | `tile_interact` | `doc_view` | `doc_download` | `photo_view` | `iko_clickthrough` | `call_clicked` | `review_viewed` | `repeat_visit`
- `tileKey` — when applicable
- `userAgent` (truncated for privacy)
- `ipHash` (hashed — no raw IPs stored)
- `referrer` (truncated)
- `timeOnPageMs` — set on page-unload beacon for `portal_view` events
- `createdAt`

---

## Approval workflow

The pattern (drawing on Houzz Pro + Buildertrend research):

```
Rep edits profile or uploads photo
              │
              ▼
        status = 'draft'
              │
   (rep clicks "Submit for approval")
              ▼
   status = 'pending-approval'
              │
   ┌──────────┴───────────┐
   ▼                      ▼
Approver clicks         Approver clicks
"Approve" + optional    "Needs Changes"
note                    + rejection note
   │                      │
   ▼                      ▼
status='published'      status='needs-changes'
publishedAt set         rejectionNotes set
version++               → rep sees notes, edits, resubmits
propagates to all 3
surfaces (cache busted)
```

**Approvers:** Michael, Chris, Sara (configurable, but those three to start).

**Per-asset approval level:**
- Bio edits → full review (text scan for internal terms, competitor mentions, prices)
- Headshot / truck pic → admin glance (1-click approve, looks legit)
- Job photos → admin glance + EXIF/GPS scan (auto-reject if location data still embedded)
- Review selections → admin reads each review (5 sec each — catches anything weird)

**Approver UI:** new page `/portal/admin/approvals` — single queue listing every pending change across all reps. Approve/Reject inline. No context-switching to find them.

**Auto-approval rules (Michael toggleable, default OFF):**
- A rep can replace their own headshot with another headshot — no approval needed (low-risk)
- A rep can edit their favorite quote — no approval (low-risk)
- Everything else (bio, certifications, job photos, reviews) → always approval

---

## Settings hierarchy — three-level

```
ADMIN  ┐
       │ (Customer_Portal_Config — global)
       │  • which tiles EXIST and CAN BE used
       │  • which doc types are allowed
       │  • token expiry, max photos, layout order
       │  • field allowlist for rep data
       ▼
REP    ┐
       │ (Rep_Customer_Portal_Prefs — per rep)
       │  • which of the admin-allowed tiles ARE used for MY customers
       │  • personal vs company review fallback
       │  • photo auto-approval preference
       │  • custom welcome message
       ▼
CUSTOMER ┐
       │ (per-portal flags — set on lead creation)
       │  • specific docs/photos curated for THIS customer
       │  • specific reviews shown (rep can swap per job)
       ▼
Rendered page
```

**The hard rule:** a rep cannot enable a tile that admin has disabled. The admin layer is the ceiling; rep selects within it.

---

## V1 feature scope — keep it basic per stated direction

What ships in v1 (and is enough to delight without overloading):

| Feature | What it does | Why basic now |
|---------|--------------|---------------|
| **Rep profile editor** (rep-side) | Bio, photos, certs, quote, save-as-draft, submit-for-approval | Today's admin page becomes the rep self-service version + an approval flow |
| **Approval queue** | Single page for Michael/Chris/Sara — pending bio edits + photo uploads + review selections | Industry blind spot — clean win |
| **Profile sync to public site** | The `/meet-the-team` page reads from `Team_Profiles` instead of hardcoded copy | Single source of truth, immediate |
| **Customer portal tile registry** | 5 tiles: Rep Intro, Next Steps, IKO Visualizer, Contact, Photo Gallery (rep-curated) | Matches what the welcome page already builds |
| **Field-level visibility config** | Admin-editable list of which rep fields appear on customer portal | Defense in depth |
| **First-photo-on-job auto-flag** | Mobile photo uploads on a job mark the FIRST one as `isFirstPhotoOnJob=true` → goes to approval queue as proposed cover | Per stated rule |
| **EXIF/GPS strip on customer share** | When a photo is approved for the customer portal, server strips EXIF before serving | Industry-wide gap; cheap to add |
| **"View as customer" simulator** | Admin/rep clicks "Preview as customer" → opens portal in iframe styled exactly as the customer sees | Only Houzz Pro has this; one-day build |
| **Token-based access** | Long URL token, 180-day expiry, hashed in long-term storage | Standard |
| **Basic analytics** | Page view, time on page, tile interactions, doc views, repeat visits | All other vendors stop at "opened" — even slightly better is a real lever |
| **Audit trail per portal view** | `Customer_Portal_Events` rows visible to the assigned rep on their job dashboard | Builds trust + helps reps follow up |

That's it for v1. Everything else is deferred.

---

## Deferred to v2+ (intentionally cut)

- Real-time storm tracking tile
- Customer document upload (insurance docs, etc.)
- In-portal messaging with rep
- "Request a callback" form
- Custom branded URL per customer
- Email/SMS notifications driven by portal events ("Sarah viewed your photos!")
- Video bios
- Multi-language portal
- Calendar embed (rep availability)
- E-signature / proposal acceptance
- Payment portal

Each of these is its own beast. Better to ship v1 + watch how customers use it for 60 days, then prioritize v2 from real data.

---

## Loophole catalog + safety nets

Drawn from the research scan (15 patterns flagged in the competitive review):

| # | Risk | Defense |
|---|------|---------|
| 1 | Rep writes internal pricing into their bio | Approval workflow + text scanner that flags currency symbols, "$", "cost", "margin" |
| 2 | Job photo shows another customer's house in background | Admin photo-review step; reject before approval |
| 3 | Photo EXIF includes GPS coords leaking job address | Server strips EXIF on customer share (keep originals in internal bucket) |
| 4 | Rep selects a review that mentions a competitor | Reviews approved one-by-one, not in bulk |
| 5 | Admin enables a tile that surfaces an internal field | Tile schema enforcement — each tile declares which fields it reads; admin sees the declared set before enabling |
| 6 | Customer shares portal URL with a stranger | Token expiry + IP-distinct-count alert ("this token has been hit from 7 different IPs — investigate?") |
| 7 | Sequential token IDs allow enumeration | Use UUID/random 32-char tokens (already do); never sequential |
| 8 | Rep profile stale, content out of date | Auto-flag for review after 180 days without edit |
| 9 | Reviews from before rep joined RCRS | `personalReviewIds` only includes reviews dated after rep's `createdAt` |
| 10 | Pre-rendered HTML caches internal data | All customer-portal HTML is server-rendered on demand from approved fields only |
| 11 | Doc with internal notes uploaded | Whitelisted doc types only; no "internal notes" type in the list |
| 12 | Browser caches portal page → stranger on same network sees | `Cache-Control: private, no-store` on all portal responses |
| 13 | Customer screenshot share | Watermark with customer name in the corner (subtle — discourages abuse, doesn't insult honest customers) |
| 14 | URL probe attack — flood random tokens looking for a valid one | Rate-limit `/customer/welcome/[token]` to 30 attempts per IP per hour |
| 15 | Pricing/cost leaks via photo annotation tools | Don't allow free-form annotations on customer-portal photos; admins approve the photo and a caption, that's it |

**Cross-cutting safety nets:**
- **NEW fields default to "internal-only."** Adding a field to the system doesn't expose it. Admin has to explicitly add it to `allowedRepDataFields`.
- **"View as customer" simulator** for admins/reps — opens the portal as the customer to verify nothing leaked.
- **Field-level audit log** — every customer-portal API response logs which fields were included, so we can grep for surprises.
- **Photo originals never leak** — uploads land in an internal Vercel Blob path (`team-profiles/internal/`); approval copies a stripped version to a public path (`team-profiles/public/`). Customer URLs only reference the public path.

---

## Analytics — what's worth tracking, what's vanity

**Worth tracking (and showing to the rep on their dashboard):**
- Portal opened (first view + repeat views)
- Time on page (real engagement signal)
- Tile interactions (which sections the customer reads)
- Document views / downloads
- Phone click (very high intent)
- IKO visualizer clickthroughs
- Review viewed
- Returning visit (came back after 24 hr) — strong intent signal

**What the REP sees** (on their job view):
> "Sarah opened the portal 4 times in the last 6 days. Last seen yesterday at 8pm. She clicked through to the IKO visualizer and viewed your truck photo twice. She hasn't clicked the call button yet."

That's not creepy if framed as job-progress signal, not surveillance. Same data a sales tool like HubSpot shows reps about lead email opens. The "live" feeling helps the rep follow up at the right moment.

**What the CUSTOMER never sees:**
- That they're being tracked at all (no "your sales rep can see you opened this email"-style messaging)
- No "score" or "engagement level" labels
- Just a clean, friendly portal

**Vanity metrics to skip:**
- Bounce rate (doesn't apply — single-page portal)
- "Engagement score" composite (false confidence)
- Geographic data beyond city (no need; we know the address)

---

## Build sequence (when greenlit)

Phase 1 (1-2 days):
- Extend `Team_Profiles` schema with status/version/pendingDraft fields
- Add `Rep_Photo_Library` + `Customer_Portal_Config` + `Rep_Customer_Portal_Prefs` sheet schemas
- Migrate the existing admin page to support draft/submit flow

Phase 2 (1-2 days):
- Approval queue page (`/portal/admin/approvals`) + APIs
- EXIF strip pipeline on photo approval
- Migrate `/meet-the-team` to read from `Team_Profiles`

Phase 3 (1-2 days):
- Customer portal tile registry
- Field-level visibility config UI
- "View as customer" simulator
- Token-based access + rate limit

Phase 4 (1 day):
- Analytics event logging
- Rep-facing job dashboard with the engagement panel

Phase 5 (half day):
- Loophole audit pass — verify each of the 15 risks has its defense in place
- Update memory + training docs

Total: ~7 days of focused work. Ship behind a feature flag, soft-launch to 1 rep (Hunter) for a real customer, then roll wider once Michael's seen the actual UX in the wild.

---

## Open decisions for Michael

Things I'd want explicit calls on before building:

1. **Which 3 approvers?** Default in this spec: Michael, Chris, Sara. Add anyone? Remove anyone?
2. **Token expiry** — 180 days default. Should expired-but-recent tokens auto-renew on re-engagement, or require a fresh send?
3. **Watermark on photos** — yes or no? Light watermark with customer's first name discourages screenshot abuse. Aggressive watermarks read as paranoid.
4. **Auto-approve "low-risk" edits** (headshot replacement, favorite-quote change) — yes or no? Saves admin time but lowers the wall.
5. **Public meet-the-team migration** — should we cut over the production site to read from `Team_Profiles` in phase 1, or build the new portal first and migrate as a follow-up?
6. **First-photo-on-job** — should it auto-go-to-approval queue with NO rep involvement, or sit in rep's queue first so they can reject it before it hits admin?
7. **Reviews source** — pulling from Google reviews? BBB? Both? Internal review-collection page on rcrsal.com? Need to decide where the canonical review list lives.

---

## What I'd ship first if forced to pick just one piece

If you can only build ONE thing from this spec, build the **approval queue + draft/published profile schema** (phase 1 + 2 combined, ~2 days).

Reason: every other feature depends on this foundation. Without the draft/published split, you can't safely let reps edit anything. Once it's in place, every subsequent feature is additive and reversible.
