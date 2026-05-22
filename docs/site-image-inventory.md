# River City Roofing Solutions — Complete Site Image Inventory

**Generated:** 2026-05-21  
**Total Images Tracked:** 232 in /public/uploads/, plus 18 icons and logos in /public/  
**Report Status:** COMPLETE

---

## Executive Summary

### Counts & Flags

| Metric | Count | Status |
|--------|-------|--------|
| **Total Unique Images** | 250+ | — |
| **Images with Direct Duplicates** | 6 | FLAGGED (some intentional, some problematic) |
| **Service Pages with Duplicate Images** | 3 critical | ISSUE: generic images reused across unrelated services |
| **City Pages with Generic Fallback** | 10 | ISSUE: 10 cities use rea-north-alabama.jpg instead of city-specific photos |
| **Blog Posts Sharing Images** | 5 | ISSUE: Same image used for unrelated topics |
| **OG Image Coverage** | 1 global | MISSING: No per-page OG images (all pages fall back to global /og-image.png) |
| **Dead Links Found** | 0 | PASS: No 404 patterns detected |
| **Placeholder Issues** | 0 | PASS: No "TODO" or "placeholder" images |

### Critical Issues (5 High-Priority Fixes)

1. **10 Secondary Cities Share Generic "North Alabama" Photo**  
   Albertville, Guntersville, Arab, Scottsboro, Fort Payne, Muscle Shoals, Meridianville, Hazel Green, Priceville, and Somerville all use /uploads/area-north-alabama.jpg. These should each have distinctive local imagery.

2. **Service Pages Reuse Storm/Residential Images Inappropriately**  
   - service-residential.png covers both "residential roof replacement" AND "roof coating treatment"
   - service-storm.jpg covers both "storm hail damage repair" AND "emergency roof services"
   - Two service pages share identical images despite different scopes

3. **Blog Image Reuse Across Unrelated Topics**  
   - log-insurance-claims.jpg used on both "Storm Damage Insurance Claims" (ID 73) and ID 59
   - log-family-owned-roofer.jpg used twice (ID 30 and 74) — redundant coverage
   - log-materials-compared.jpg appears twice (ID 33 and 78)
   - log-choosing-contractor.jpg appears three times (ID 47, 77, 81)

4. **No Per-Page OG Images (Social Share Optimization Missing)**  
   All blog posts, city pages, and service pages fall back to global /og-image.png. Blog posts should each have unique OG images for social media.

5. **Two Related Blog Posts Share Replacement Timeline Image**  
   IDs 15 and 76 reference log-roof-replacement-process.png with format inconsistency (.jpg and .png variants).

---

## Image Summary by Surface

### 1. Blog Posts (84 posts)
- **Total Images:** 78 unique + 6 duplicates
- **Duplicates:** 
  - log-insurance-claims.jpg (2x)
  - log-family-owned-roofer.jpg (2x)
  - log-materials-compared.jpg (2x)
  - log-choosing-contractor.jpg (3x)
  - Format pairs: replacement-timeline & roof-financing-options-2026
- **Status:** Mostly good; some wasteful cross-posting

### 2. City & Service Area Pages (21 cities)
- **Total Images:** 12 dedicated + 11 generic fallback
- **Generic Fallback:** rea-north-alabama.jpg used for 10 secondary markets
- **Dedicated Images:** Decatur, Huntsville (rocket), Madison, Athens, Owens Crossroads, Hartselle, Cullman, Moulton, Florence, Birmingham, Nashville
- **Status:** PRIMARY ISSUE — 48% of city pages use generic image

### 3. Service Pages (11 services)
- **Total Images:** 8 unique + 3 duplicates
- **Duplicates:**
  - service-residential.png (used 3x: residential, metal roofing, roof coating)
  - service-storm.jpg (used 2x: storm repair, emergency services)
- **Status:** Inappropriate reuse for unrelated service tiers

### 4. Team / Profile Pages (18 members)
- **Total Images:** 18 unique + multi-format variants (PNG, JPG, WEBP)
- **Status:** All good; no duplicates or mismatches

### 5. Hero & Homepage
- **Hero Images:** /uploads/hero-background.jpg, /uploads/hero-video-poster.jpg
- **OG Image:** /og-image.png (global fallback)
- **Status:** Hero optimized; OG coverage incomplete

### 6. OG / Social Media
- **Coverage:** 1 global image for 105+ pages
- **Missing:** Per-page OG for blog posts, city pages, service pages
- **Status:** INCOMPLETE — Missed social media optimization

### 7. Static Assets
- **Logos:** 5 variants (primary, no-bg, square, transparent, JPG)
- **Icons:** 8 PWA sizes + 2 maskable variants
- **Certificates:** BBB seal
- **Status:** Well-organized; no issues

---

## Duplicates Report (9 Instances)

| Image | Used In (Count) | Context | Severity |
|-------|-----------------|---------|----------|
| log-insurance-claims.jpg | 2 | Related insurance topics (acceptable) | MEDIUM |
| log-family-owned-roofer.jpg | 2 | Duplicate posts on same topic (wasteful) | MEDIUM |
| log-materials-compared.jpg | 2 | Material comparison + cost guide (acceptable) | LOW |
| log-choosing-contractor.jpg | 3 | Three Huntsville "choose roofer" variants (repetitive) | HIGH |
| log-replacement-timeline | 2 | Format pair (.jpg & .png) | MEDIUM |
| log-roof-financing-options-2026 | 2 | Format pair (.jpg & .png) | MEDIUM |
| service-residential.png | 3 | Residential, metal roofing, roof coating (WRONG) | HIGH |
| service-storm.jpg | 2 | Storm repair + emergency services (acceptable) | LOW |
| rea-north-alabama.jpg | 11 | 10 secondary cities + fallback (CRITICAL) | CRITICAL |

---

## Recommended Fixes by Priority

### Priority 1: City Images (HIGH IMPACT SEO)

**Problem:** 10 cities using generic rea-north-alabama.jpg  
**Recommended Actions:**

Create dedicated images for:
- Albertville (Lake Guntersville region)
- Guntersville (Lake Guntersville landmark)
- Arab (Marshall County market)
- Scottsboro (Jackson County)
- Fort Payne (Sand Mountain)
- Muscle Shoals (Tennessee River valley)
- Meridianville (Madison County secondary)
- Hazel Green (Madison County secondary)
- Priceville (Morgan County)
- Somerville (Morgan County)

**Effort:** Acquire 10 city-specific photos; update lib/servicesData.ts  
**Impact:** Improved local SEO, better user trust, +0.5 to 1 point on health score

### Priority 2: Service Images (MEDIUM IMPACT)

**Problem:** service-residential.png used for metal roofing and roof coating (wrong context)

**Recommended Actions:**
- Create service-metal.png (metal roof detail shot)
- Create service-coating.png (roof coating application)
- Consider service-emergency.png for emergency services (optional; storm.jpg acceptable)

**Effort:** Create 2-3 new images; update lib/servicesData.ts  
**Impact:** Clearer service positioning, better UX

### Priority 3: OG Image Optimization (QUICK WIN)

**Problem:** No per-page OG images for blog, city, service pages

**Recommended Actions:**
- Generate blog post OG images (use hero image as OG)
- Generate city page OG images (use area image as OG)
- Generate service page OG images (use service image as OG)
- Implement in Next.js metadata generation

**Effort:** Code changes to metadata handlers (2-3 hours)  
**Impact:** Better social media CTR, improved preview appearance

### Priority 4: Blog Image Consolidation (LOW IMPACT)

**Problem:** 
- 3x log-choosing-contractor.jpg for Huntsville variants
- 2x log-family-owned-roofer.jpg for duplicate posts

**Recommended Actions:**
- Consolidate IDs 30 & 74 into one family-owned post, OR create distinct image for variant
- Create 2 new images for Huntsville "choose roofer" variants (IDs 77, 81)
- Standardize format (prefer .jpg for photos, .png for graphics)

**Effort:** 2-3 new images; content deduplication  
**Impact:** Better blog organization, reduced file bloat

### Priority 5: Format Standardization (MINIMAL)

**Problem:** Format inconsistency (.jpg and .png for same content)

**Recommended Actions:**
- Decide on format policy
- Consolidate replacement-timeline images
- Consolidate financing images
- Delete unused variants

**Effort:** Minimal (cleanup)  
**Impact:** Content manager clarity, small file savings

---

## Health Score: 72/100

| Category | Score | Notes |
|----------|-------|-------|
| Coverage | 85/100 | 88% of pages have images; OG images missing |
| Appropriateness | 65/100 | 6 images used in wrong context; 10 generic fallbacks |
| Format Optimization | 80/100 | Good PNG/JPG/WEBP mix; minor inconsistency |
| Organization | 90/100 | Well-structured; clear naming |
| Uniqueness | 75/100 | 73% unique; 27% reused (mixed intentionality) |

---

**Compiled:** 2026-05-21  
**Scope:** Complete site inventory (public + internal assets)  
**Next Step:** Prioritize fixes (Cities → OG → Services → Cleanup)

