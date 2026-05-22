# Image Update To-Do — What Needs to Be Sourced
**Date:** 2026-05-21
**Generated from:** `docs/site-image-inventory.md` (audit) + `docs/site-image-system-spec.md` (system design)
**Audience:** Michael — this is your shopping list before you go out shooting / commissioning.

## How to use this doc

For each block below, you need ONE good photo of the stated subject, at the stated dimensions, sourced however makes sense (your phone, a photographer, drone shots, vendor-supplied stock, paid stock from Shutterstock / Getty, etc.).

**Recommendation:** prioritize Section A (cities) first — biggest SEO/conversion impact. Then C (OG images — fastest win). Then B (services). Then D (blogs — lowest priority, mostly cosmetic).

When you have images ready, drop them in `public/images-staging/` named with the suggested filename and I'll wire them into the registry + the right pages in one pass.

---

## Section A — 10 city pages stuck on a generic photo

**Problem:** every secondary market currently shows the same generic "North Alabama" image. That's bad for local SEO (Google can tell the page is generic) and bad for trust (a customer in Scottsboro doesn't see Scottsboro).

**Target dimensions:** 1600×900 (16:9 aspect)
**Format:** JPG or WebP, max 400KB
**Subject:** an unmistakable shot of that town. Doesn't have to be a roof — could be the courthouse, water tower, main intersection, downtown, river view, signature landmark. Authentic > pretty. Phone shots are fine.

| # | City | Suggested filename | Subject idea |
|---|------|-------------------|--------------|
| 1 | Albertville | `city-albertville-hero.webp` | Highway 75 area, Marshall County courthouse, "Fire Hydrant Capital" sign |
| 2 | Guntersville | `city-guntersville-hero.webp` | Lake Guntersville bridge, marina, dam, lake-view homes |
| 3 | Arab | `city-arab-hero.webp` | Brindlee Mountain water tower, downtown Main Street, city sign |
| 4 | Scottsboro | `city-scottsboro-hero.webp` | Goose Pond Colony, Jackson County courthouse, Unclaimed Baggage area |
| 5 | Fort Payne | `city-fort-payne-hero.webp` | DeSoto State Park, Little River Canyon, "Sock Capital" sign |
| 6 | Muscle Shoals | `city-muscle-shoals-hero.webp` | Wilson Dam, FAME studios, Singing River Bridge |
| 7 | Meridianville | `city-meridianville-hero.webp` | Hwy 231 corridor, rural-residential — harder, may have to do a generic neighborhood shot tagged as Meridianville |
| 8 | Hazel Green | `city-hazel-green-hero.webp` | Main Street, fire station, signature church or school |
| 9 | Priceville | `city-priceville-hero.webp` | I-65 corridor, Priceville High School, lake-area homes |
| 10 | Somerville | `city-somerville-hero.webp` | Morgan County courthouse (in Decatur but the original county seat), historic district |

**Note:** if a city has no obvious landmark, a clean shot of a residential neighborhood with the city sign or a recognizable street feature is fine. Authenticity matters more than postcard-perfection.

**Bonus:** for each city, a SECOND image (`city-{slug}-secondary.webp`) showing a completed RCRS job in that area would be ideal — but Section A is the must-have; secondaries are nice-to-have.

---

## Section B — service pages misusing one image

**Problem:** three service tiers share one generic "residential" photo. Metal roofing should look premium. Coating should look maintenance/protective.

**Target dimensions:** 1600×900 (16:9 aspect)
**Format:** JPG or WebP, max 400KB

| # | Service | Suggested filename | Subject idea |
|---|---------|-------------------|--------------|
| 11 | Metal roofing | `service-metal-roofing-hero.webp` | A finished standing-seam or corrugated metal roof — clean lines, premium look, ideally with the sky in the frame so it reads "high-end" |
| 12 | Roof coating / maintenance | `service-roof-coating-hero.webp` | A crew applying coating, OR a before/after split of a coated vs uncoated roof, OR a close-up of a freshly coated flat roof |
| 13 | (Optional) Emergency / storm | `service-emergency-hero.webp` | A tarped roof at dusk, a crew in rain gear, an aerial of storm-damaged shingles — distinct from generic storm-damage repair |

If you have existing job photos from your portfolio that match these, perfect. Otherwise paid stock works (Shutterstock has good roof imagery).

---

## Section C — OG images (social previews) — fastest impact

**Problem:** 105+ pages all use the same site-wide `/og-image.png` as their social-preview image. When anyone shares a blog post or city page on Facebook / Twitter / LinkedIn, they see the generic logo instead of a compelling page-specific image.

**Target dimensions:** 1200×630 (1.91:1 aspect — Facebook + Twitter standard)
**Format:** JPG or PNG, max 300KB

This is the SHORTEST list because the SYSTEM auto-generates page OG images from the page's own hero image. So we only need a few **fallback / default OGs**, plus a handful of dedicated ones.

| # | Purpose | Suggested filename | Subject idea |
|---|---------|-------------------|--------------|
| 14 | Site-wide default OG | `og-site-default.jpg` | Brand-forward shot — logo + a hero roof or crew photo + "River City Roofing Solutions / North Alabama's Most Trusted" text. Can use Canva. |
| 15 | Blog category default | `og-blog-default.jpg` | Generic-but-good "roofing tips & insights" framing — could be a clipboard + roof inspection scene |
| 16 | City category default | `og-city-default.jpg` | Map of North Alabama with RCRS service area highlighted, or a hero crew + Tennessee River shot |
| 17 | Service category default | `og-service-default.jpg` | Crew at work — "We do the job right" feeling |

Once these four exist + the cities in Section A are sourced, the system can auto-derive OG images for every blog post and city page from their existing hero. No additional per-page OGs needed unless you want a specific post to have a custom one.

---

## Section D — blog post images (3 known duplicates to fix)

**Problem:** three blog posts about "Choosing a Contractor (Huntsville variants)" share one image. Two about "Family-Owned Roofer" share one. Two about "Materials Compared" share one.

**Target dimensions:** 1200×900 (4:3)
**Format:** JPG or WebP, max 350KB
**Priority:** LOW — these are cosmetic. Section A + C move the needle more.

| # | Affected blog topic | Suggested filename | Subject idea |
|---|---------------------|-------------------|--------------|
| 18 | "Choosing a contractor" Huntsville variant A | `blog-choosing-contractor-huntsville-a.webp` | A homeowner shaking hands with a rep on a porch, Huntsville-area home in background |
| 19 | "Choosing a contractor" Huntsville variant B | `blog-choosing-contractor-huntsville-b.webp` | A rep showing a tablet/quote to a homeowner |
| 20 | "Family-owned roofer" variant | `blog-family-owned-roofer-2.webp` | Multi-generational crew photo, or a casual team-portrait |
| 21 | "Materials compared" variant | `blog-materials-compared-2.webp` | Side-by-side shingles or a close-up of different roofing materials |

**Lower-priority alternative:** instead of sourcing new images, consolidate the duplicate posts. Three near-identical blog posts about "choosing a contractor in Huntsville" probably should be ONE good post, not three.

---

## Section E — nice-to-haves (do these once A-D are done)

| # | Purpose | Filename | Subject |
|---|---------|----------|---------|
| 22 | Homepage hero refresh | `hero-homepage.webp` | Iconic crew shot, sunset over Tennessee Valley, or aerial of completed job — current homepage hero is the lone Achilles heel that everyone sees |
| 23 | About page hero | `about-hero.webp` | Family/leadership shot — owner-operated angle |
| 24 | Gallery "before" template | `gallery-before-template.webp` | One clean "before" framing pattern to set the gallery style standard |
| 25 | Gallery "after" template | `gallery-after-template.webp` | Matching "after" pattern |
| 26-N | Per-rep truck photos | `team-{slug}-truck.webp` | Each rep with their own truck (already covered by Team_Profiles flow if reps upload via portal) |

---

## Total source list

- **Must-have:** 17 images (Sections A + B + C 14-17)
- **Should-have:** 4 more images (Section D)
- **Nice-to-have:** 5+ images (Section E)

**Recommended budget for a photographer:** half-day shoot can cover 6-8 cities if you're driving the route. ~$300-500. Stock-photo gaps (the harder city shots, generic blog imagery) — paid stock licenses run $20-150 per image.

## What I'll do once you start sending images

1. Drop each in `public/images-staging/` with the suggested filename
2. Tell me to "wire it up" — I'll:
   - Run it through the standardizer (EXIF strip, crop to spec, upload to Blob)
   - Add the row to `Site_Images` sheet
   - Update the page(s) that reference it to use `getImage('city-decatur-hero')` instead of the hardcoded URL
   - Commit + push
3. Verify it's live on the public site
4. Generate the OG image for that page from the new hero

You can send images one at a time or in batches — system handles both.

## Things to NOT spend time on

- High-end commercial photography for blogs (Section D) — diminishing returns
- Drone shots of every city (cool but expensive; 1-2 hero cities max)
- Stock photos that look like stock photos (worse than the current generic — at least the current image is brand-aligned)
- Updating reviewers' photos on testimonials (separate problem, separate fix)

## Cleanup once new images are sourced

After all of Section A's cities are replaced, the old generic `city-default-hero.jpg` (or whatever it's named) becomes the legitimate "any new city we haven't shot yet" fallback. Keep it; mark `subcategory: ''` in the registry; it's the catch-all.

After Sections B and C ship, the OG images problem is fully solved system-wide. After Section D ships, blog visual variety is decent.

Section E is "polish" and can run as ongoing maintenance — no rush.
