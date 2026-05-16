# Phase 3 — Domain Separation Audit

**Read-only audit, 2026-05-15. No code changes.**

Per Michael's hard rule:
- `rivercityroofingsolutions.com` → public marketing site only
- `rcrsal.com` → portal + `/trip` only (never public site content)
- All redirects must be 307 (temporary), never 308 (permanent — browsers cache forever)
- Portal domain must be checked **first** in middleware

## Findings

### ✅ Middleware ordering (correct)

`middleware.ts` checks the portal domain (`rcrsal.com`) **before** the public domain. Verified by reading the conditional flow lines 320-415. Portal-domain branch handles its own routes and returns/redirects before falling through to public-domain logic.

### ✅ All redirects are 307

| File:Line | Type | Notes |
|---|---|---|
| `middleware.ts:349` | 307 | Portal authed-root → /portal/dashboard |
| `middleware.ts:372` | 307 | /trip path preservation |
| `middleware.ts:378` | 307 | Non-portal path on rcrsal.com → public site |
| `middleware.ts:405` | 307 | Portal route on public domain → rcrsal.com |
| `app/api/trip/excluded-reps-form/route.ts:15,22` | 303 | Form POST → GET redirect, intentional for form submissions |

**Zero 308 redirects found.** ✅ Hard rule satisfied.

The two `303` redirects in the trip form are correct HTTP semantics — 303 is the right status for a form POST that should result in a subsequent GET (avoids re-submission on refresh). Not a violation.

### ✅ rcrsal.com root → portal login

`middleware.ts:333-335` — rcrsal.com root rewrites (not redirects) to `/portal`. The login page is rendered server-side under the original URL — exactly matches your "no intermediate page" rule.

### ✅ Domain isolation per route group

Routes are organized in 4 isolated groups inside `app/`:
- `(site)` — public marketing site
- `(lp)` — Google Ads landing pages (public domain)
- `(tools)` — portal + command-center (portal domain only)
- `trip` — special trip feature (both domains, public access per current spec)

Middleware respects these groupings: portal-only paths get the cross-domain redirect dance; public paths flow through normally.

### 🟡 One thing worth knowing (not a violation)

The `/trip` path is explicitly allowed on BOTH domains (line 372 + the public-domain branch lets it through). That's intentional per your earlier decision ("trip is ok not secured for now"), but worth noting because it's the one route that breaks the otherwise clean domain separation.

If you later want to lock `/trip` to a specific domain, that's a 2-line middleware change.

### 🔵 What I did not audit (deferred)

- CSP headers per domain (whether they correctly distinguish portal vs public)
- Cookie scope (whether portal auth cookies are correctly scoped to rcrsal.com)
- CORS headers on API routes when called cross-domain
- robots.txt rules per domain

If any of these are concerns, they're separate Phase 3 sub-audits.

## Conclusion

**Phase 3 domain isolation hard rules pass.** Middleware correctly enforces:
- Portal-first check ordering ✅
- 307 (never 308) redirects ✅
- rcrsal.com root = login (no intermediate) ✅
- Clear separation between public and portal routes ✅
