# Social-Media Auto-Post + Auto-Blog Audit

**Date:** 2026-05-20
**Branch target:** `sweep/social-blog-revival` (files staged in working tree only)
**Investigator:** Claude audit pass

---

## TL;DR

- The **auto-blog system is real and 80% wired** but had two critical bugs that prevented rep posts from ever reaching the public site. **Both are now fixed.**
- The **social-media auto-post system was never actually built in this repo**. What looked like a social system (`lib/socialAds.ts`) is static ad-copy data — there is no API integration with Facebook / Instagram / LinkedIn / X anywhere in the codebase, and no env vars for social tokens. Owner's recollection of "auto-posting" likely refers to an external tool (Buffer, Meta Business Suite scheduler, Zapier) or a prior repo.
- A stub social-publish service has been added so the pipeline is ready to light up the moment the owner provides credentials.

---

## 1. Inventory of Files Involved

### Auto-blog (rep submission → review → schedule → publish)

| File | Purpose | Status |
|---|---|---|
| `app/(tools)/portal/blog/page.tsx` | Rep + admin blog list, "Pending Review" panel | OK |
| `app/(tools)/portal/blog/new/page.tsx` | Rep new-post editor (≥30 char title, ≥1500 char body, ≥300 words, ≥120 char meta, ≥1 image) | OK |
| `app/(tools)/portal/blog/[id]/page.tsx` | Rep edit / admin review-preview | OK |
| `app/(tools)/portal/admin/blog/page.tsx` | Admin overview | OK |
| `app/api/portal/blog/route.ts` | GET list / POST new — writes to `Blog_Posts` sheet | OK |
| `app/api/portal/blog/[id]/route.ts` | GET / PUT / DELETE individual post | OK |
| `app/api/portal/blog/approve/route.ts` | Admin approve/reject — schedules next Friday, enforces 7-day cooldown | OK |
| `app/api/portal/blog/publish/route.ts` | Manual publish (Fridays only) | OK |
| `app/api/portal/blog/pending/route.ts` | Admin "Pending Review" list | **FIXED** — was reading dead local JSON |
| `app/api/cron/publish-blog/route.ts` | Daily cron 06:00 UTC, flips approved+due posts → published | **FIXED** — now mirrors to public `blog-posts` tab |
| `app/api/cms/blog/route.ts` | Legacy admin CMS endpoint (writes to public `blog-posts` tab directly) | OK |
| `lib/blog-posts-store.ts` | Wrapper for `Blog_Posts` sheet (rep pipeline) | OK |
| `lib/cms-sheets-service.ts` | Wrapper for `blog-posts` sheet (public site source) | OK |
| `lib/blog-loader.ts` | Public site loader — merges static `blogContent.ts` with CMS rows | OK |
| `lib/blogContent.ts` / `lib/blogData.ts` / `lib/blogPostIndex.ts` | Static blog post data baked into build | OK |
| `app/(site)/blog/page.tsx` + `app/(site)/blog/[slug]/page.tsx` | Public blog index + detail | OK |
| `vercel.json` | Cron schedule `/api/cron/publish-blog` daily 06:00 UTC | OK |

### Social media

| File | Purpose | Status |
|---|---|---|
| `lib/socialAds.ts` | **Static** array of 5 ad-copy templates with hashtags + image briefs. **Not an API client.** | OK as data |
| `lib/social-publish.ts` | **NEW** — stub publish service for FB/IG/LinkedIn/X. All methods return `skipped:true` until env vars set. | **NEW** |
| `lib/cms-sheets-service.ts` (TeamMember interface) | Holds `facebook`/`instagram`/`x`/`tiktok`/`linkedin` URL fields per team member. Display-only. | OK |
| `app/(tools)/command-center/marketing/page.tsx` | External links to Meta Ads Manager, Google Ads, GA. No posting. | OK |
| `app/(tools)/command-center/marketing/calendar/page.tsx` | Local-state content calendar UI (`ContentType` includes `social`). Pure UI, no API. | OK |

---

## 2. Per-Platform Social Status

| Platform | File:line | Status | Cause of failure |
|---|---|---|---|
| Facebook Page | `lib/social-publish.ts:62` | **NOT WIRED** | No code ever existed. `FB_PAGE_ID` + `FB_PAGE_ACCESS_TOKEN` env vars not set, no Graph API client. |
| Instagram | `lib/social-publish.ts:93` | **NOT WIRED** | Same — no client. Requires IG Business account + Page token. |
| LinkedIn Company | `lib/social-publish.ts:125` | **NOT WIRED** | No client. Requires LinkedIn Developer App + OAuth. |
| X (Twitter) | `lib/social-publish.ts:155` | **NOT WIRED** | No client. **Also:** X free tier no longer permits posting (paid tier required). |
| Nextdoor | n/a | **NOT WIRED** | Nextdoor has no posting API for business profiles — manual only. |
| TikTok | n/a | **NOT WIRED** | Display URL slot exists per team member; no posting integration. |
| Google Business Profile | n/a | **NOT WIRED** | GBP posts API was deprecated in 2026; manual posting via business.google.com is the current path. |
| Facebook Pixel | `.env.example:78` (`NEXT_PUBLIC_FB_PIXEL_ID`) | Tracking-only, NOT posting | n/a — analytics, not the same system |

**There is no evidence the auto-post system was ever wired in this repo.** Git history (`git log --grep="social|facebook|instagram"`) shows only ad-copy data, team-member social-link fields, and OG meta-tag improvements. The owner's memory may be of an external scheduler (Meta Business Suite, Buffer, Hootsuite) or a different codebase.

---

## 3. Per-Trigger Status

| Trigger | Should fire | Currently fires | Notes |
|---|---|---|---|
| Rep submits blog post for review | Email/GroupMe to admin | **No automatic notification** | Pending review only visible if admin happens to open `/portal/blog`. Recommend wiring `notification-service` to alert admin on `BLOG_CREATE` w/ `status=review`. |
| Admin approves blog post | Schedule for next Friday | Yes | `approve/route.ts` works. |
| Cron `publish-blog` (daily 06:00 UTC) | Flip approved+due → published + mirror to public site | Yes (after today's fix) | Was previously flipping status only — public site never saw the post. |
| Blog post published | Auto-post link to FB/IG/LinkedIn | **No** | `lib/social-publish.ts` ready; not yet invoked anywhere. See "Recommended improvements" §5. |
| New lead won | Auto-post celebration | **No** | Never built. |
| New 5-star review | Auto-post testimonial | **No** | Never built. Note: `[[feedback_never_invent_brand_data]]` rule — only post real verified reviews. |

---

## 4. Bugs Fixed In This Pass

### Bug A — Pending review list never showed rep posts
- **File:** `app/api/portal/blog/pending/route.ts`
- **Cause:** Read from `data/blog-posts.json` which doesn't persist on Vercel. Every other blog route writes to the `Blog_Posts` sheet via `lib/blog-posts-store.ts`.
- **Fix:** Switched to `readBlogPosts()` from the store. Admins now see all `status=review` posts.

### Bug B — Published rep posts never appeared on the public site
- **File:** `app/api/cron/publish-blog/route.ts`
- **Cause:** Two distinct sheet tabs, two distinct service layers:
  - `Blog_Posts` (capital, underscore) — rep submissions, via `blog-posts-store.ts`
  - `blog-posts` (lowercase, dash) — public-site CMS, via `cms-sheets-service.ts`
  Public blog pages (`app/(site)/blog/**`) read from the `blog-posts` tab via `lib/blog-loader.ts`. The cron only flipped status in `Blog_Posts`, so published rep posts were invisible on the live site.
- **Fix:** Cron now mirrors published rows into the public `blog-posts` tab (update if slug exists, else create). Mirror failures are recorded in the cron heartbeat but do not block the status flip.

### Files modified
- `app/api/portal/blog/pending/route.ts`
- `app/api/cron/publish-blog/route.ts`
- `lib/social-publish.ts` (NEW)

`npx tsc --noEmit -p .` passes after all changes.

---

## 5. Required Owner Action

### To turn on real social-media auto-posting

The owner must decide which platforms matter, then complete the wiring per the comments in `lib/social-publish.ts`. Recommended priority for a Hartselle, AL roofing business:

1. **Facebook Page** — biggest local reach. Steps:
   - Meta Business App → long-lived Page Access Token
   - Set Vercel env: `FB_PAGE_ID`, `FB_PAGE_ACCESS_TOKEN`
   - Implement the `publishFacebook()` body (POST to `graph.facebook.com/v19.0/{pageId}/feed`)
   - Tokens last ~60 days — set a calendar reminder to refresh

2. **Instagram Business** — visual job photos. Requires IG Business account linked to FB Page.
   - Set Vercel env: `IG_BUSINESS_ACCOUNT_ID`, `IG_ACCESS_TOKEN` (often same as FB page token)
   - Implement 2-step create-container then publish flow

3. **LinkedIn Company Page** — B2B / commercial leads.
   - LinkedIn Developer App → OAuth → token w/ `w_organization_social`
   - Set Vercel env: `LINKEDIN_ORG_URN`, `LINKEDIN_TOKEN`

4. **Skip X (Twitter)** unless someone specifically asks for it — paid API tier required as of 2026, low ROI for local roofing.

5. **Nextdoor + Google Business Profile** — no posting API. Keep these manual.

### Env vars to add to Vercel (once tokens obtained)

```
FB_PAGE_ID=
FB_PAGE_ACCESS_TOKEN=
IG_BUSINESS_ACCOUNT_ID=
IG_ACCESS_TOKEN=
LINKEDIN_ORG_URN=urn:li:organization:XXXXXXXX
LINKEDIN_TOKEN=
```

Add these to `.env.example` as commented stubs when the owner is ready.

### One-time data backfill

If there are already approved-but-orphaned rep posts in the `Blog_Posts` sheet (posts that the old broken cron flipped to `published` but never mirrored), they need a one-time backfill into the public `blog-posts` tab. Quickest path: open the sheet, find rows where `Blog_Posts.status = 'published'` and slug is not present in `blog-posts`, and either re-run the cron after temporarily resetting them to `approved`, or copy them across by hand.

---

## 6. Recommended Improvements

### A. Wire social fan-out into the blog publish flow
Once at least one platform is live, add this to `app/api/cron/publish-blog/route.ts` after the mirror succeeds:

```ts
import { publishToAllSocial } from '@/lib/social-publish';
// ...inside the for-loop, after mirrorToPublicBlog(post)...
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.rivercityroofingsolutions.com';
await publishToAllSocial({
  text: `New on the RCRS blog: ${post.title}`,
  link: `${siteUrl}/blog/${post.slug}`,
  imageUrl: post.images[0] ? `${siteUrl}${post.images[0]}` : undefined,
  source: `blog:${post.slug}`,
});
```

Hold off until at least Facebook is wired and the owner confirms — per audit instructions, never burn social quota during agent work.

### B. Notify admin when a rep submits for review
The Pending Review list is silent. Wire `lib/notification-service` (or GroupMe) to alert admins on `BLOG_CREATE` with `status=review` so reviews don't sit for days.

### C. Consider consolidating the two blog tabs
The split between `Blog_Posts` (rep workflow) and `blog-posts` (public CMS) is the root cause of Bug B. Long-term, collapsing them into a single tab with a `workflow_status` column would eliminate the mirror step. Out of scope for this pass.

### D. Surface platform readiness in admin UI
Use `getSocialPlatformStatus()` from `lib/social-publish.ts` in a new card on `/portal/admin` or `/command-center/marketing` so the owner can see at a glance which credentials are missing.

### E. Per `[[feedback_never_invent_brand_data]]`
When social posting goes live, the post text MUST come from real content — a real blog excerpt, a real campaign approved by the owner, etc. Do NOT have a model auto-generate post copy ("RCRS replaced 47 roofs this month!") because that risks fabricating numbers, testimonials, or capabilities RCRS doesn't actually have. The stub takes raw `text` for this reason.

---

## 7. Out of Scope (not done in this pass)

- Re-adding `low-stock-alert`, `weekly-numbers-reminder`, `auto-review-request`, `stalled-tickets-digest` crons to `vercel.json` — separate audit decision.
- Implementing real FB/IG/LinkedIn API calls — needs owner credentials.
- Backfilling historical published rep posts into the public tab — manual sheet work.
- Wiring admin notifications for new rep submissions — separate change.
- Building a "post to social" button on individual blog posts — needs platform wired first.
