# Site-Wide Image System — Spec
**Date:** 2026-05-21
**Companion reading:** `docs/site-image-inventory.md` (audit of current state)

---

## Why this exists

Today images are scattered: `lib/servicesData.ts`, `lib/blogContent.ts`, `public/images/`, hardcoded URLs in page files, Vercel Blob URLs in a few places. The result: 10 secondary-market cities all share one generic photo, 3 service tiers share one image, 3 blog topics share another, **zero per-page OG images**. No single place tells you "which image is being used where, and is it the right one?"

This spec is the central registry that fixes all of that. One source of truth, one lookup helper, one admin UI for upload + approval.

## North star

Every image rendered anywhere on the public site (`rivercityroofingsolutions.com` + customer portal) comes through ONE function:

```ts
const img = getImage('city-decatur-hero');
// → { url, alt, aspectRatio, intent }
```

If `city-decatur-hero` doesn't exist, the lookup falls back:
1. Exact key (`city-decatur-hero`)
2. Category default (`city-default-hero`)
3. Site-wide default (`site-hero-default`)

Pages stop hardcoding URLs. Re-sourcing an image becomes a sheet edit, not a code change.

## Data model

### `Site_Images` sheet — single source of truth

| Column | Purpose |
|--------|---------|
| `imageId` | UUID-style ID (`img_01HK…`) — internal stable ref |
| `key` | Semantic lookup key (`city-decatur-hero`, `blog-gutters-2026-cover`, `service-metal-hero`, `og-default`) |
| `category` | `city` / `blog` / `service` / `team` / `gallery` / `hero` / `og` / `icon` / `misc` |
| `subcategory` | The slug it relates to (`decatur`, `gutter-cleaning-tips`, `metal-roofing`) — empty for site-wide defaults |
| `url` | Blob URL or `/images/...` path (canonical) |
| `alt` | Descriptive alt text — SEO + accessibility |
| `caption` | Optional human-readable caption |
| `intent` | One-line "this should depict X" (sanity check vs URL — flags mismatches) |
| `aspectRatio` | `16:9` / `4:3` / `1:1` / `21:9` etc. |
| `widthPx` | Source width |
| `heightPx` | Source height |
| `standardized` | Boolean — has it been through the photo-standardizer pipeline (EXIF strip, crop, optional watermark)? |
| `approved` | Boolean — admin approved for public use |
| `uploadedBy` | Slug of uploader |
| `uploadedAt` | ISO |
| `approvedBy` | Approver slug |
| `approvedAt` | ISO |
| `usageContexts` | Pipe-delimited list of where it's referenced (`city/decatur|service-areas/decatur|og:city/decatur`) — populated by migration script + maintained by lookup wrapper |
| `replacedBy` | When swapped out, points to the new imageId (audit trail) |
| `tags` | Pipe-delimited — `before-after`, `team`, `truck`, `aerial`, `crew`, `winter`, etc. |
| `licenseSource` | `owned` / `purchased-stock` / `customer-permission` / `vendor-supplied` — important for legal |
| `notes` | Free-form |

### Naming convention for `key`

```
{category}-{subcategory}-{variant?}
```

Examples:
- `city-decatur-hero`
- `city-decatur-secondary`
- `blog-gutter-cleaning-tips-cover`
- `service-metal-roofing-hero`
- `service-metal-roofing-detail-1`
- `team-hunter-headshot` (already covered by Team_Profiles for reps; this is for non-rep team members like office staff)
- `og-blog-default`
- `og-city-default`
- `og-site-default`
- `hero-homepage`
- `gallery-decatur-job-2025-03`

## Lookup helper

```ts
// lib/site-images.ts
export function getImage(key: string): SiteImage | null
export function getImageWithFallback(key: string, ...fallbackKeys: string[]): SiteImage | null
export function getOgImage(pagePath: string, contextKey?: string): SiteImage | null
```

`getOgImage()` is the per-page social-preview helper:
- `/blog/gutter-cleaning-tips` → tries `blog-gutter-cleaning-tips-cover` → `og-blog-default` → `og-site-default`
- `/service-areas/decatur` → tries `city-decatur-hero` → `og-city-default` → `og-site-default`
- Solves the "zero per-page OG images" finding from the inventory.

All lookups read from a 60-second in-memory cache (sheet read once per minute per warm instance).

## Category presets — aspect ratios + standardization

Each category has a target spec the standardizer applies on upload:

| Category | Target aspect | Target dim | Background canvas | EXIF strip |
|----------|---------------|------------|-------------------|------------|
| `city` | 16:9 | 1600×900 | none (city should be authentic) | yes |
| `blog` | 4:3 | 1200×900 | none | yes |
| `service` | 16:9 | 1600×900 | none | yes |
| `team` headshot | 1:1 | 800×800 | dark-grey (existing pattern) | yes |
| `team` truck | 16:9 | 1200×675 | dark-grey | yes |
| `gallery` job | 4:3 | 1600×1200 | none | yes |
| `og` | 1.91:1 | 1200×630 | none | yes |
| `icon` | 1:1 | 512×512 | varies | yes |

Anything not matching its category's target is auto-cropped on standardization. Originals stay in `site-images/internal/`; public versions in `site-images/public/`.

## Admin UI — `/portal/admin/site-images`

Three views, single page:

### Browse
- Grid view of every image, filterable by category / subcategory / approved-status / standardized-status
- Click an image → side panel with full record (URL, alt, key, intent, usage contexts, replace-history)
- Quick filters: "missing alt text" / "duplicates" / "needs OG variant" / "low-resolution"

### Upload
- Drop one or many files
- Form: category, subcategory (auto-fills `key`), alt, intent, license source
- Server pipeline: standardize (crop + EXIF strip + canvas) → Blob upload → sheet row insert with `approved=false`

### Approval queue
- Pending images listed here (same queue as profile approvals — extend the existing page or add a tab)
- Side-by-side: current image at that key (if any) vs proposed
- Approve → flips `approved=true`, the new image takes effect on next page render

## How pages call the lookup

Today:
```tsx
<img src="/images/service-residential.png" alt="Residential roofing" />
```

After migration:
```tsx
const img = getImage('service-residential-hero');
<img src={img.url} alt={img.alt} width={img.widthPx} height={img.heightPx} />
```

Or for fallback:
```tsx
const img = getImageWithFallback(`city-${slug}-hero`, 'city-default-hero', 'site-hero-default');
```

Migration is incremental — pages keep working today (hardcoded URLs aren't broken). As each page is touched, swap the hardcoded reference for `getImage(key)`. No big-bang cutover needed.

## OG image generation

Two paths:
1. **Static OG** (today): set the page's existing hero image as the OG image via `getOgImage()`. Solves the "zero per-page OG" finding immediately.
2. **Dynamic OG** (v2): Next.js's `@vercel/og` generates a custom OG image at request time with the page's title overlaid. Defer until a real need.

## Migration plan

1. **Schema + lookup helper** (this commit) — sheet schema, reader/writer, `getImage()` + fallback.
2. **Seed the registry** — migration script crawls current image refs, populates the sheet with `approved=true` for existing ones (so the lookup works the day this ships).
3. **Update list to Michael** — the shopping list (`docs/image-update-todo.md`) tells you what to source.
4. **Bulk-upload tool** (when images arrive) — drop a folder, system distributes by filename pattern, auto-fills sheet rows.
5. **Page migration** — incremental, page by page. Start with the 10 cities trapped on the generic photo (highest-ROI fix).
6. **OG defaults wired** — single `<Head>` helper in `lib/seo.ts` calls `getOgImage()` per page.

## What this gives us

- **Single edit point.** Re-source the Decatur photo? Sheet edit. Done.
- **Detect duplicates automatically.** A duplicate-detection script can flag any `url` used in >N rows and warn.
- **Approval workflow.** Same gate pattern as rep profiles — nothing goes live without Chris / Michael / Sara.
- **License tracking.** `licenseSource` per image — if a vendor sues, we know which photos are which.
- **Per-page OG images.** `getOgImage()` handles every page's social preview.
- **Audit trail.** `replacedBy` chain lets you trace why an image changed.

## What it deliberately doesn't include (v2+)

- **Bulk-find-and-replace.** Don't auto-migrate every page. Each migration is a sanity check — "is this still the right image for this page?"
- **AI-generated alt text.** Manual for accuracy. v2: auto-suggest, human approves.
- **CDN beyond Vercel Blob.** Blob serves over a CDN already. No need to add Cloudinary / imgix unless we hit a scale ceiling.
- **Image search by visual content.** Out of scope.
- **Customer-portal photo handling.** Already covered by the rep-profile + photo-gallery pipeline. This system handles the public website + general content only.

## Safety nets

- **Default to "internal-only" for new fields**, same pattern as customer-portal-config. A new column doesn't get exposed publicly until explicitly added to a render path.
- **Approval required for public images** — no unapproved image renders on a public page.
- **Image-not-found fallback chain** — never serves a broken-image icon to a customer; falls back to category default → site default.
- **Cache-bust on approval** — when an image gets approved or replaced, the lookup cache invalidates so the new version shows immediately.
- **Replace-history audit log** — every swap is captured. If someone changes Decatur's hero to a wrong photo, you can see who did it and roll back.
