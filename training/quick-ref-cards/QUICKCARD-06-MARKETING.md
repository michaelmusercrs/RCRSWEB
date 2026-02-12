# QUICK REFERENCE CARD: MARKETING DIRECTOR
## River City Roofing Solutions Platform

**For:** Boston (Marketing Director)
**Role:** `admin` -- Campaigns, content creation, blog CMS, SEO, analytics, lead generation tools
**Last Updated:** February 10, 2026

---

## LOGIN

| Field | Value |
|-------|-------|
| **URL** | https://www.rivercityroofingsolutions.com/portal |
| **Email** | boston@rcrsal.com |
| **PIN Location** | `lib/team-roles.ts` -- TEAM_MEMBERS array |
| **Login Method** | Email + 4-digit PIN |
| **Default Landing** | /portal/admin |

---

## TOP 5 BOOKMARKS

1. **Marketing Hub** -- /command-center/marketing -- Campaign management, ad tracking, budget monitoring, content calendar
2. **Blog CMS** -- /portal/admin/blog -- 68 articles, create/edit posts, SEO settings, publish controls
3. **Content Calendar** -- /command-center/marketing/calendar -- Monthly content planning, post scheduling
4. **Check My Address** -- /check-my-address -- Lead generation tool to promote across all channels
5. **Image Library** -- /portal/admin/images -- Upload and manage marketing assets, photos, graphics

---

## DAILY CHECKLIST

### Morning (8:00 AM)
- [ ] Open Google Analytics (analytics.google.com, GA ID: G-Y8PB85BZC5) -- check yesterday's traffic
- [ ] Check traffic sources -- any spikes from ads or social?
- [ ] Check top pages -- which blog posts are performing best?
- [ ] Check conversion rate -- how many form submissions?
- [ ] Open /command-center/marketing -- review active campaign performance

### Content Work (Throughout Day)
- [ ] Review /command-center/marketing/calendar -- what content is scheduled?
- [ ] Write or edit blog posts in /portal/admin/blog
- [ ] Upload new images to /portal/admin/images
- [ ] Schedule and post social media content
- [ ] Draft email campaigns using templates at /command-center/marketing/emails

### End of Day (5:00 PM)
- [ ] Review ad spend vs budget for active campaigns
- [ ] Check for new leads from Check My Address submissions
- [ ] Update content calendar with completed and upcoming items
- [ ] Check GroupMe (/portal/chat) for team messages

---

## WEEKLY CHECKLIST

- [ ] Google Analytics full review -- traffic trends, top content, conversion rates, device split
- [ ] Review blog performance -- which articles drive the most organic traffic?
- [ ] Plan next week's content across all platforms (blog, social, email, ads)
- [ ] Check ad performance across Facebook, Instagram, Google -- adjust budgets based on ROI
- [ ] Review and A/B test ad variations at /command-center/marketing/ads
- [ ] Prepare BNI presentation materials (if meeting this week)
- [ ] Review referral program activity at /referral-rewards
- [ ] Update service area pages (/portal/admin/areas) if expanding to new cities

---

## KEY SHORTCUTS

| Action | How |
|--------|-----|
| **Write a blog post** | /portal/admin/blog -> "Write New Post" -> title, content, category, SEO fields -> Save/Publish |
| **Upload an image** | /portal/admin/images -> upload file -> add title, alt text, category -> stored on Vercel Blob |
| **Check ad performance** | /command-center/marketing/ads -> view clicks, impressions, conversions per ad and platform |
| **Send email campaign** | /command-center/marketing/emails -> select template -> customize subject, body, recipients -> send |
| **View content calendar** | /command-center/marketing/calendar -> plan monthly schedule, coordinate with campaigns |
| **Update team bios** | /portal/admin/team -> select team member -> edit bio, photo, specialties -> save (shows on public site) |
| **Add service area** | /portal/admin/areas -> add new city -> SEO-optimized page auto-generated |

---

## COMMON TASKS

| Task | Steps |
|------|-------|
| **Create and publish a blog post** | /portal/admin/blog -> "Write New Post" -> title + 3-4 paragraphs + category -> set SEO fields (title tag, meta description, focus keyword) -> add images from Image Library -> Publish (auto-generates JSON-LD Article schema) |
| **Launch an ad campaign** | /command-center/marketing -> create campaign -> set platform (Facebook, Instagram, Google, Print), budget, ad variations -> launch -> monitor at /command-center/marketing/ads |
| **Promote Check My Address** | Create social post: "Check your address for a FREE hail risk report!" with link to /check-my-address -> works for social media, email, BNI, door hangers, Google/Facebook ads -> every submission auto-creates a lead |
| **Review website analytics** | analytics.google.com -> Property G-Y8PB85BZC5 -> check page views, sessions, traffic sources, device breakdown, top pages, conversion tracking |
| **Manage service areas for SEO** | /portal/admin/areas -> browse 50+ configured cities -> add new areas for expansion (Birmingham, Nashville) -> each gets its own SEO-optimized page |
| **Send a referral promotion email** | /command-center/marketing/emails -> select referral program template -> customize messaging -> send to customer list |
| **Update team profiles** | /portal/admin/team -> select member -> update photo, bio, specialties -> save (team pages drive trust and local SEO) |

---

## MARKETING TOOLKIT

| Tool | URL | Purpose |
|------|-----|---------|
| Marketing Hub | /command-center/marketing | Campaign management HQ |
| Ad Manager | /command-center/marketing/ads | Track and manage ads across 4 platforms |
| Email Center | /command-center/marketing/emails | 5 email campaign templates |
| Content Calendar | /command-center/marketing/calendar | Monthly content scheduling |
| Blog CMS | /portal/admin/blog | 68 articles, create/edit/publish |
| Image Library | /portal/admin/images | Media asset management (Vercel Blob) |
| Check My Address | /check-my-address | Public lead generation tool (NWS data) |
| Referral Program | /referral-rewards | Customer referral capture page |
| BNI Page | /bni | Partner referral page |
| Team Profiles | /portal/admin/team | Team bio management (public pages) |
| Service Areas | /portal/admin/areas | 50+ location SEO pages |
| Google Analytics | analytics.google.com | GA ID: G-Y8PB85BZC5 |

---

## TROUBLESHOOTING

| Problem | Solution |
|---------|----------|
| **Cannot log in** | Verify boston@rcrsal.com and PIN. Clear browser cache. Contact Michael (256-221-4290) for PIN reset. |
| **Blog post not showing on site** | Check all required fields (title, content, slug). After saving, it may take 1-2 minutes for the build to update. Verify at /blog/[slug]. |
| **Image upload fails** | Check file size (keep under 5MB). Supported formats: JPG, PNG, WebP. Upload goes to Vercel Blob storage. Try a different format if failing. |
| **Google Analytics not showing data** | Verify GA ID G-Y8PB85BZC5 is active. Access via rcrsal.com Google account. Analytics may take 24-48 hours for first data to appear. |
| **Campaign metrics not updating** | Platform metrics may refresh on a delay. Refresh the page. For real-time ad data, check the ad platform directly (Facebook Ads Manager, Google Ads). |
| **Facebook Pixel / Google Ads not tracking** | These are NOT YET CONFIGURED. Env vars needed: NEXT_PUBLIC_FB_PIXEL_ID, NEXT_PUBLIC_GOOGLE_ADS_ID. Coordinate with Michael to set up. |
| **Portal shows blank page** | Hard refresh (Ctrl+Shift+R). Try a different browser. Check internet connection. |

---

## WHO TO CONTACT

| Person | Role | Phone |
|--------|------|-------|
| Michael Muse | VP / Tech (platform, SEO, analytics) | 256-221-4290 |
| Sara Hill | Office Manager (team coordination) | 256-810-3594 |
| Chris Muse | President (brand, strategy) | 256-648-1224 |
| Office Main Line | General | 256-274-8530 |

**Brand Color:** #39FF14 (Neon Green) = `brand-green` in Tailwind
**Domain:** www.rivercityroofingsolutions.com
**Vercel Dashboard:** vercel.com (project: prj_7s9kclvyqkMQhOHS4fHWpBJLEruG)

---

*RCRS Platform -- 367 pages, 180+ API routes, 85+ components*
*Office: 256-274-8530 | rcrs@rivercityroofingsolutions.com*
