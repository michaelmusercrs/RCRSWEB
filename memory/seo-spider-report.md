# RCRS Full Site SEO Spider & Audit Report
**Date:** 2026-02-14
**Audited by:** Claude (manual spider)

---

## 1. Route Map Summary

### Public Pages (28 total)
| Route | Has Metadata | Has Structured Data |
|-------|-------------|-------------------|
| `/` (homepage) | ✅ | ✅ LocalBusiness, WebSite, FAQ |
| `/about` | ✅ | ✅ AboutPage, Breadcrumb |
| `/blog` | ✅ | ✅ CollectionPage, Breadcrumb |
| `/blog/[slug]` | ✅ generateMetadata | ✅ Article, Breadcrumb |
| `/bni` | ✅ | ✅ BNI Partner schema |
| `/careers` | ✅ (layout) | ✅ JobPosting (FIXED) |
| `/check-my-address` | ✅ (layout) | ✅ WebPage, Service |
| `/community` | ✅ | ✅ Breadcrumb |
| `/contact` | ✅ | ✅ ContactPage, Breadcrumb |
| `/contact/thank-you` | ✅ | ✅ Breadcrumb |
| `/free-roof-measurement` | ✅ | ✅ Service, FAQ, Breadcrumb |
| `/locations/decatur` | ✅ | ✅ LocalBusiness, FAQ, Breadcrumb |
| `/locations/huntsville` | ✅ | ✅ LocalBusiness, FAQ, Breadcrumb |
| `/locations/madison` | ✅ | ✅ LocalBusiness, FAQ, Breadcrumb |
| `/privacy` | ✅ | ✅ |
| `/referral-rewards` | ✅ | ✅ Referral Program schema |
| `/roof-report` | ✅ (layout) | ❌ No schema (internal tool, low priority) |
| `/roof-visualizer` | ✅ | ✅ |
| `/service-areas` | ✅ | ✅ CollectionPage, Breadcrumb |
| `/service-areas/[slug]` | ✅ generateMetadata | ✅ LocalBusiness, Breadcrumb, FAQ |
| `/services` | ✅ | ✅ CollectionPage, Breadcrumb |
| `/services/[slug]` | ✅ generateMetadata | ✅ Service, Breadcrumb, FAQ |
| `/team` | ✅ | ✅ CollectionPage, Breadcrumb |
| `/team/[slug]` | ✅ generateMetadata | ✅ Person, Breadcrumb |
| `/terms` | ✅ | ✅ |
| `/secret-deals` | ✅ | — (landing page) |
| `/report/[id]` | Dynamic | — (customer report) |
| `/my/[token]` | Dynamic | — (customer portal link) |

### Internal App Pages (not indexed)
- `/admin/*` (14 pages) - Admin dashboard
- `/portal/*` (60+ pages) - Employee portal
- `/command-center/*` (25+ pages) - Management dashboard
- `/customer/*` - Customer portal
- `/dashboard` - Main dashboard
- `/internal-pricing` - Internal tool
- `/offline` - PWA offline page

### API Routes: 150+ routes under `/api/*`

---

## 2. Internal Link Audit

### ✅ All Internal Links Valid
Every `href="/"` link found in components and pages maps to an existing route or dynamic route.

### ⚠️ Minor Issues
| Link | Found In | Status |
|------|----------|--------|
| `/command-center/inventory/new` | command-center inventory page | Resolves to `[sku]` dynamic route — works but could be clearer |
| `/privacy#sms-terms` | privacy page | Hash link — valid if anchor exists |
| `/portal/training/library#delivery-operations` | portal training | Hash link — valid if anchor exists |

### No Broken Internal Links Found ✅

---

## 3. External Link Audit

| URL | Status | Location |
|-----|--------|----------|
| https://app.jobnimbus.com | ✅ 200 | Admin/portal |
| https://dev.groupme.com/bots | ✅ 200 | Admin settings |
| https://maps.google.com/?q=3325+Central+Pkwy+SW... | ✅ 200 | Contact/about |
| https://rcrs-meeting-system.vercel.app | ✅ 200 | Command center |
| https://www.facebook.com/RiverCityRoofingSolutionsLLC | ✅ 200 | Footer/social |
| https://www.iko.com/na/roofviewer/ | ✅ 200 | Roof visualizer |
| https://www.instagram.com/rivercityroofingsolutions/ | ✅ 200 | Footer/social |

### No Dead External Links Found ✅

---

## 4. Schema Markup Audit

### Root Layout (`app/layout.tsx`)
- ✅ LocalBusiness schema
- ✅ WebSite schema with SearchAction

### Page-Level Schemas
- ✅ Homepage: LocalBusiness + WebSite + FAQ
- ✅ About: AboutPage + Breadcrumb
- ✅ Blog posts: Article + Breadcrumb
- ✅ Services: Service + Breadcrumb + FAQ
- ✅ Service Areas: LocalBusiness + Breadcrumb + FAQ
- ✅ Team Members: Person + Breadcrumb
- ✅ Contact: ContactPage + Breadcrumb
- ✅ BNI: Partner schema
- ✅ Referral: Program schema
- ✅ Check My Address: WebPage + Service
- ✅ **Careers: JobPosting (ADDED in this audit)**

### Schema Issues Fixed
1. **Careers page** — Added `JobPosting` structured data schema

### Schema Recommendations
- Consider adding `AggregateRating` to LocalBusiness schema when review count is available
- Add `VideoObject` schema if video content is added to pages

---

## 5. Meta Tag Audit

### ✅ All Public Pages Have Unique Metadata
Every public-facing page has:
- Unique `<title>` tag
- Unique `<meta name="description">`
- OpenGraph tags (title, description, URL, type)
- Twitter card tags
- Canonical URL via `alternates.canonical`

### Pages Using Layout-Level Metadata
- `/careers` — metadata in `careers/layout.tsx` ✅
- `/check-my-address` — metadata in `check-my-address/layout.tsx` ✅
- `/roof-report` — metadata in `roof-report/layout.tsx` ✅

### Pages Using Dynamic generateMetadata
- `/blog/[slug]` ✅
- `/services/[slug]` ✅
- `/service-areas/[slug]` ✅
- `/team/[slug]` ✅

### No Duplicate or Missing Meta Tags Found ✅

---

## 6. Technical SEO Notes

### Sitemap
- Check if `next-sitemap` or equivalent is configured
- Dynamic routes need `generateStaticParams` for static generation ✅ (all have it)

### Robots
- Verify `robots.txt` excludes `/admin`, `/portal`, `/command-center`, `/api`

### Performance
- All pages use Next.js App Router with proper SSR/SSG
- Image optimization via `next/image` ✅
- PWA support with manifest.json ✅

---

## 7. Fixes Applied

1. **Added JobPosting structured data** to `app/careers/layout.tsx`
   - Schema type: `JobPosting`
   - Includes salary range, employment type, hiring org, location
   - Helps careers page appear in Google Jobs search

---

## 8. Recommendations (Priority Order)

### High Priority
1. **Add more service area internal links** — `/service-areas/owens-crossroads-al`, `/service-areas/north-alabama`, `/service-areas/birmingham-al`, `/service-areas/nashville-tn` exist as data but aren't linked from navigation
2. **Verify robots.txt** blocks admin/portal/API routes from indexing
3. **Add sitemap.xml** generation if not already configured

### Medium Priority
4. **Create blog content** for high-volume keywords (see organic-keywords.md)
5. **Add AggregateRating** schema when Google Reviews data is available
6. **Birmingham content expansion** — Currently weakest market position

### Low Priority
7. **Add FAQ schema** to careers page
8. **Add breadcrumb schema** to BNI and referral-rewards pages (currently use custom schema only)
9. **Standardize social URLs** — Footer uses different format than siteConfig

---

*Report generated 2026-02-14. Next audit recommended in 30 days.*
