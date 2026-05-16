# RCRS SEO Playbook — 2026

**Drafted 2026-05-15. Source: fresh research on LLM SEO, generative-engine optimization (GEO), and 2026 local-business search trends.**

The game has shifted: traditional Google rankings still matter, but customers increasingly ask **ChatGPT, Google AI Overviews, Perplexity, and Gemini** for service recommendations. If RCRS isn't *cited* by those answers, we're invisible to a growing share of prospects regardless of our position in blue-link search.

## What's true in 2026 that wasn't in 2025

- **Citation frequency > page rank.** LLMs typically cite 2-7 sources per response. Getting into that 2-7 window is the new "page 1."
- **AI-generated content is now toxic for AI SEO.** LLMs are trained on the open web — generic AI prose sounds like everything else, so models have no reason to cite it. Original data, customer stories, and locally-specific content wins.
- **JavaScript-rendered content is invisible to AI crawlers.** They read raw HTML only, no JS execution. Anything behind tabs, accordions, client-side React state — invisible.
- **Schema markup is now ranking infrastructure**, not nice-to-have. A complete validated schema gives LLMs a citable summary they can trust.
- **EEAT (Experience, Expertise, Authoritativeness, Trust) signals matter more** for service businesses — reviews, named team members, photos with EXIF, completed-jobs galleries.

## RCRS-specific quick wins (this week)

### 1. Audit current AI visibility (30 min)
Manually search the following queries in ChatGPT, Google AI Overviews, and Perplexity. Screenshot results. Note which competitors get cited and which URLs:
- "best roofer in Athens AL"
- "best roofer in Madison AL"
- "best roofer in Huntsville AL"
- "roof repair near me Athens Alabama"
- "storm damage roofer in Decatur AL"
- "how much does a new roof cost in Alabama"
- "what roofers in Alabama are IKO certified"
- "who do I call for hail damage in Limestone County"

Capture into `seo-monitor/data/ai-visibility-baseline-2026-05.md`.

### 2. FAQ schema on top-traffic pages (1-2 hr)
Already partially done in March build. Verify on these pages and add if missing:
- `/` (homepage)
- `/services/roof-repair`
- `/services/roof-replacement`
- `/financing`
- `/storm-damage`
- All 10 city pages added in March (Albertville, Guntersville, Arab, etc.)

Use the Google Rich Results Test before deploying each.

### 3. Original data page: "2026 Alabama Roof Damage Report" (4-6 hr)
Pull anonymized stats from `commissions.json` + JN job data:
- Average roof age at replacement (by city)
- Top 5 storm-damage cities by claim count
- Average repair vs full-replacement ratio
- Seasonal damage patterns

This becomes a citable, unique data source LLMs reach for. Compounds over time.

### 4. Internal linking sweep (2-3 hr)
Use Screaming Frog (already installed) to find orphan pages. Build pillar+spoke architecture:
- Pillar: `/services/roof-replacement`
- Spokes: each city page, each material/brand page (IKO, OC, GAF), each financing partner
- Anchor text variants: "IKO Cambridge installation in Athens", "metal roof replacement in Madison", etc.

### 5. Kill JavaScript-rendered critical content (audit)
Scan rcrsal.com for content that only appears after JS executes (collapsibles, "read more" buttons, tabbed content). Convert critical info to static HTML. Anything LLMs can't see is gone.

### 6. Named-employee EEAT push (4-8 hr)
Every public-facing service page should mention real team members by name with bios + photos. Already partial via `lib/teamData.ts`. Audit which service pages reference whom.

LLMs cite content with verifiable named humans more readily than anonymous corporate content.

### 7. Review velocity (ongoing)
Memory flags reviews as biggest weakness: 47 vs competitors' 800+. **This won't fix overnight. But it's the biggest leverage point.** Suggested automations: post-job review-request SMS (with the customer portal flow), Google review screenshots auto-embedded in the customer's portal page.

### 8. Robots.txt + crawlability for AI bots (15 min)
Confirm robots.txt allows:
- `GPTBot` (OpenAI)
- `Google-Extended` (Bard/Gemini training)
- `PerplexityBot`
- `ClaudeBot` (Anthropic)
- `CCBot` (Common Crawl)

By default Next.js blocks none of these but verify the live robots.txt.

### 9. Sitemap completeness (15 min)
Memory flags `/check-my-address` and `/bni` missing from sitemap. Add them. Also confirm every city page, FAQ, gallery item, and review page is indexed.

### 10. Schema for individual reviews (2-3 hr)
Each review on rcrsal.com should have proper `Review` schema with `Person.name`, `reviewBody`, `reviewRating.ratingValue`, `datePublished`, `itemReviewed`. Currently most are static text. Convert.

## Medium-term (next 30 days)

- **"Ask RCRS" page** — public FAQ optimized for LLM citation. Long-tail questions answered in 2-3 sentence chunks with citations.
- **Comparison content** — "IKO Cambridge vs Owens Corning Duration in North Alabama climate" with hard data. These rank in AI Overviews because they answer real decision-time queries.
- **Local insurance-claim guide** — every Alabama insurer's process for hail/wind claims, what to expect, what RCRS does. Becomes the canonical local resource.
- **Crew-member spotlight series** — each foreman/installer gets a bio page with completed-job photos. Distinct EEAT signal nobody else in market has.

## What to STOP doing

- Don't publish more AI-generated marketing prose. It dilutes the unique-voice signal.
- Don't hide service info behind JS-rendered modals.
- Don't use generic city-name placeholders ("we serve [city]") — every city deserves its own URL with unique content.
- Don't rely on volume of pages — quality + structure + originality beat page count in 2026.

## Measurement (track weekly in seo-monitor)

- Citation count: # of unique LLM responses citing rcrsal.com
- Citation rank: position within the citation list (1-7 typical)
- AI Overview appearance rate for top 20 queries
- Branded query share: % of "river city roofing" queries returning RCRS-controlled content (vs review aggregator content)
- Review velocity: new reviews per week (target: 10+/wk to close the 47 vs 800 gap within 18 months)

The `seo-monitor/` system already tracks page-level SEO. Extend to include AI-citation tracking.
