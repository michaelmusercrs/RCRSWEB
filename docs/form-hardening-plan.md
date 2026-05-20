# Public Form Hardening Plan

**Status:** SPEC — not yet implemented
**Owner:** Michael
**Triggered by:** Bot spam flood on the public contact form (e.g., `juliana@trustedbusinessawards.com`, a known mass-outreach tool that scrapes contact forms across the web).
**Goal:** Stop the spam at the source without breaking any legit lead.

---

## 1. Public form inventory

Every public-facing (no-auth) endpoint that accepts user-submitted data, grouped by the UI that hits it. **All of these are in scope for hardening.**

| # | API endpoint | UI page / component | Required fields | Downstream effects |
|---|---|---|---|---|
| 1 | `POST /api/forms/contact` | `components/ContactForm.tsx`, `components/LandingPageForm.tsx`, `components/Header.tsx` (header contact widget), `components/QuickContactForm.tsx`, `components/DogChatBot.tsx` (bot lead capture) | `name`, `subject`, `message`, `phone OR email` | Google Sheets row (`formService.submitContactForm`) **+** `POST /api/leads/new` fire-and-forget → All Lead Submissions tab, GroupMe ping, email to Michael/Sara/Tia, portal auto-generation |
| 2 | `POST /api/contact` | (legacy / not directly bound to a current UI form — kept around; some links / older clients may still POST here) | `name`, `email`, `subject`, `message` | Forwards to Google Apps Script → Sheets row, confirmation email to user, company notification, GroupMe, optional portal generation |
| 3 | `POST /api/forms/referral` | (NO UI binding found — `/referral-rewards` is content-only). Endpoint is currently orphaned but live. | `referrerName`, `referrerPhone`, `referralName`, `referralPhone`, `referralAddress` | Google Sheets row + fire-and-forget `POST /api/leads/new` |
| 4 | `POST /api/referral` | (legacy; no current UI binding) | same as #3 | Forwards to Google Apps Script |
| 5 | `POST /api/forms/careers` | `app/(site)/careers/ApplicationForm.tsx` | `firstName`, `lastName`, `email`, `phone`, `city`, `experience`, `whyJoin` | Sheets row (Contact pipeline), GroupMe ping, email to Michael |
| 6 | `POST /api/forms/bni-partner` | `app/(site)/bni/BNIPartnerForm.tsx` | `partner`, `name`, `phone` (email optional) | Sheets row via Contact pipeline |
| 7 | `POST /api/email-capture` | `components/Footer.tsx` (newsletter footer), `components/EmailCapturePopup.tsx` (exit-intent popup) | `name`, `email` | Sheets "Email Captures" tab **+** `POST /api/leads/new` |
| 8 | `POST /api/storm-report` | `app/(site)/check-my-address/page.tsx` (lead-magnet hero form) | `address` OR `zip` | Generates storm report. Then page-level `POST /api/leads/new` if email/phone collected. |
| 9 | `POST /api/storm-report/email` | `app/(site)/check-my-address/page.tsx` (emails the report to the user) | `email`, report payload | Sends the report PDF/link by email |
| 10 | `POST /api/leads/new` | Called server-side by #1, #7, #8 AND directly from a couple of portal pages (`/portal/leads/new`, `/portal/office/new-lead`). **No public UI hits it directly** today, but it's a public endpoint with no auth, so it must be treated as public. | `name`, `email` | Spam filter (`lib/spam-filter.ts`), Sheets log, geocode, JN sync, office email blast, portal generation |
| 11 | `GET/POST /api/honeypot` | Linked invisibly from `app/(site)/layout.tsx` | n/a | Emails Michael when a bot follows the hidden link. Already hardened — leave alone. |

### Customer-portal-token forms (lower priority — token-gated, not pure public)

These require a valid customer token in the body, so they aren't open-internet form-spammable in the same way, but they're still callable without a logged-in session and should get rate limits + size caps applied.

| API endpoint | UI | Notes |
|---|---|---|
| `POST /api/customer/service-request` | `components/customer-portal/ServiceRequestForm.tsx` | Token validation only; no rate limiter today. |
| `POST /api/customer/warranty-claim` | `components/customer-portal/WarrantyClaimForm.tsx` | Same. |
| `POST /api/customer/review` | review widget on customer portal pages | Same. |

### Out of scope

- `/api/portal/**`, `/api/admin/**`, `/api/calls/webhook`, `/api/webhooks/**`, `/api/auth/login`, `/api/auth/pin` — these are auth-gated, webhook-signed, or staff-only.
- `/api/honeypot` — already does its job.

### Existing protections (so we don't duplicate)

- `lib/rate-limiter.ts` — `createFormRateLimiter()` is already wired into `/api/forms/*`, `/api/contact`, `/api/storm-report`, and `/api/leads/new`. **5 requests per 5 minutes per IP**, in-memory only (per-warm-instance — see limitations in file's module doc).
- `lib/spam-filter.ts` — content-based spam scoring (gibberish names, disposable email domains, suspicious phrases). Only runs inside `/api/leads/new`. Threshold 70.
- `lib/request-size-limit.ts` — 50 KB body cap on `/api/forms/*`.
- Invisible honeypot links in `app/(site)/layout.tsx` → `/api/honeypot`.

**Gap:** No client-side honeypot field, no captcha gate, no domain block list, no shared rate-limit store across serverless instances, and the spam filter doesn't run on `/api/forms/contact` / `/api/forms/careers` / `/api/email-capture` — only on the downstream `/api/leads/new`.

---

## 2. Honeypot field (Layer 1 — zero friction)

### Design

Add a hidden text input named **`company_website`** (intentionally generic and "fillable-looking" so bots will populate it). Real users never see or touch it; bots that auto-fill every field will fill it in.

### Hiding strategy

CSS-only, no JS, no `display: none` (some bots skip `display:none`). Use the proven approach:

```html
<div aria-hidden="true" style="position:absolute;left:-9999px;top:auto;width:1px;height:1px;overflow:hidden">
  <label for="company_website">Leave this field empty</label>
  <input
    type="text"
    id="company_website"
    name="company_website"
    autocomplete="off"
    tabindex="-1"
  />
</div>
```

Key properties:
- `position:absolute; left:-9999px` — off-screen, but still in the DOM and submittable
- `tabindex="-1"` — keyboard users skip it
- `aria-hidden="true"` — screen readers skip it
- `autocomplete="off"` — password managers / autofill skip it
- The label "Leave this field empty" is a belt-and-suspenders cue for the rare assistive tech that still reads it

### Server-side rejection logic

In every form route, before any other work:

```ts
// In /api/forms/contact/route.ts (illustrative)
const body = await request.json();

// HONEYPOT: if filled, silently 200 (don't tell the bot it was caught)
if (typeof body.company_website === 'string' && body.company_website.trim() !== '') {
  console.warn('[honeypot] caught on /api/forms/contact', {
    ip: request.headers.get('x-forwarded-for') ?? 'unknown',
    ua: request.headers.get('user-agent') ?? '',
    filled: body.company_website.slice(0, 100),
  });
  // Return a plausible success so the bot doesn't retry or rotate strategy
  return NextResponse.json({ success: true, message: 'Thanks!' }, { status: 200 });
}
```

Why fake-success instead of 400/403: tells the bot operator nothing, doesn't surface in their error-monitoring, doesn't tip them off to try a different attack. Real lead is never created; we only log.

### Apply this pattern to

Every endpoint in §1 #1–#10. The client-side hidden input goes in the corresponding React component (`ContactForm`, `LandingPageForm`, `Header`, `QuickContactForm`, `DogChatBot`, `EmailCapturePopup`, `Footer`, `ApplicationForm`, `BNIPartnerForm`, and the check-my-address page). One shared component `<HoneypotField />` in `components/forms/HoneypotField.tsx` keeps the markup consistent.

### Log trail

Use a single tag prefix `[honeypot:rejected]` so we can grep Vercel logs and count blocks. Include endpoint, IP, UA, referer.

---

## 3. Bot-detection gate (Layer 2 — light friction)

### Comparison

| | **Cloudflare Turnstile** | **hCaptcha** | **Google reCAPTCHA v3** |
|---|---|---|---|
| **Cost** | Free, unlimited | Free up to 1M req/mo | Free up to 1M req/mo |
| **User friction** | Invisible / managed challenge (most users see nothing) | Usually invisible; sometimes shows a checkbox | Invisible (score-based) |
| **Privacy** | No tracking, no cookies, GDPR-friendly | Privacy-respecting | Heavy Google tracking; iffy under GDPR |
| **Vendor lock-in** | Cloudflare (we don't otherwise depend on them) | Independent | Google (we already use Google Sheets/Apps Script/Maps — but more tracking) |
| **Next.js DX** | `@marsidev/react-turnstile` widget + REST verify | `@hcaptcha/react-hcaptcha` + REST verify | `react-google-recaptcha-v3` provider + REST verify |
| **Bot detection quality (2025)** | Comparable to reCAPTCHA v3; improving fast | Comparable | Industry baseline |
| **Score vs binary** | Pass/fail | Pass/fail | 0.0–1.0 score (more nuanced) |
| **Requires JS on client** | Yes | Yes | Yes |

### Recommendation: **Cloudflare Turnstile**

Reasons:
1. **Free with no monthly cap** — best fit for our cost-sensitivity rule.
2. **Lowest user friction** — most legit visitors see literally nothing. Critical for a roofing lead form where every dropped submission is a $10k+ job lost.
3. **No third-party tracking added to the public site** — we already minimize external SDKs; adding Google reCAPTCHA would put a Google fingerprinting script on every form page.
4. **No vendor entanglement** with our existing stack.
5. **Domain reputation neutral** — Turnstile is built on the same engine that Cloudflare uses to gate their own login pages.

### Next.js integration pattern

1. **Env vars**
   - `NEXT_PUBLIC_TURNSTILE_SITE_KEY` — client widget key
   - `TURNSTILE_SECRET_KEY` — server verify key

2. **Client widget** in each form component:

   ```tsx
   import { Turnstile } from '@marsidev/react-turnstile';

   const [token, setToken] = useState('');
   // ... in form JSX, near the submit button:
   <Turnstile
     siteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY!}
     onSuccess={setToken}
     options={{ theme: 'light', size: 'flexible' }}
   />
   // Then include `turnstileToken: token` in the request body.
   ```

3. **Server verify helper** at `lib/turnstile.ts`:

   ```ts
   export async function verifyTurnstile(token: string, ip: string): Promise<boolean> {
     if (!process.env.TURNSTILE_SECRET_KEY) return true; // fail-open in dev
     const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
       method: 'POST',
       headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
       body: new URLSearchParams({
         secret: process.env.TURNSTILE_SECRET_KEY,
         response: token,
         remoteip: ip,
       }),
     });
     const data = await res.json();
     return data.success === true;
   }
   ```

4. **Route guard** — after honeypot, before any work:

   ```ts
   const ok = await verifyTurnstile(body.turnstileToken ?? '', ip);
   if (!ok) {
     console.warn('[turnstile:failed]', { endpoint, ip, ua });
     return NextResponse.json(
       { success: false, message: 'Verification failed. Please try again.' },
       { status: 403 }
     );
   }
   ```

### Rollout protections

- **Fail-open in dev** when the secret env var is missing, so local development doesn't break.
- **Soft-launch flag** `TURNSTILE_ENFORCE=false` for the first 24 hours — verify, log failures, but still accept the submission. Then flip to `true`.
- **Don't add Turnstile to `/api/email-capture`** for the popup/footer newsletter — that's a single-field "name + email" widget and the friction kills conversions. Honeypot + rate limit + domain block list are enough there. (Revisit if abuse continues.)

---

## 4. IP rate limit (Layer 3 — background)

### Assessment of the existing limiter

`lib/rate-limiter.ts` is fine **functionally**, but the module's own doc comment flags the issue: **it's per-warm-instance in-memory**. On Vercel serverless, concurrent invocations don't share state, so a bot hitting 10 concurrent connections can effectively get 10× the documented limit.

For "casual abuse" (the current trustedbusinessawards.com case where it's one outreach tool slowly drip-submitting) the in-memory limiter has been catching nothing because each submission likely lands on a cold/different instance. We need shared state.

### Recommendation: **thin Vercel KV-backed wrapper**

Vercel KV (Upstash Redis under the hood) has a generous free tier (~30k commands/day, plenty for form rate limiting). Add it as `@vercel/kv`. New file `lib/rate-limit-kv.ts` that exposes the same `withRateLimit(request, config, handler)` surface as the current limiter so swap-in is one-line per route.

```ts
// lib/rate-limit-kv.ts (skeleton)
import { kv } from '@vercel/kv';

export async function checkKvRateLimit(
  key: string,            // e.g. `form:contact:1.2.3.4`
  maxRequests: number,
  windowSeconds: number
): Promise<{ allowed: boolean; remaining: number; resetAt: number }> {
  const now = Math.floor(Date.now() / 1000);
  const bucket = `${key}:${Math.floor(now / windowSeconds)}`; // fixed window
  const count = await kv.incr(bucket);
  if (count === 1) await kv.expire(bucket, windowSeconds);
  const resetAt = (Math.floor(now / windowSeconds) + 1) * windowSeconds;
  return {
    allowed: count <= maxRequests,
    remaining: Math.max(0, maxRequests - count),
    resetAt,
  };
}
```

Use a **fixed window** (simpler than sliding window, cheaper KV ops — 1 INCR + 1 EXPIRE per request). The slight burst at window boundaries doesn't matter for form submissions.

### Default thresholds

| Endpoint | Limit | Window | Why |
|---|---|---|---|
| `/api/forms/contact` | **3** | 1 hour | Real customers fill the form once. 3 covers re-tries / typos. |
| `/api/forms/referral` | **3** | 1 hour | Same. |
| `/api/forms/careers` | **2** | 1 hour | One application per person. |
| `/api/forms/bni-partner` | **5** | 1 hour | A BNI member might intro multiple partners in a session. |
| `/api/email-capture` | **5** | 1 hour | Footer / popup might double-fire on session bugs. |
| `/api/storm-report` | **10** | 1 hour | Address lookup is the page's whole purpose; let people retry. |
| `/api/storm-report/email` | **5** | 1 hour | One per address is normal. |
| `/api/contact` | **3** | 1 hour | Legacy endpoint, low expected traffic. |
| `/api/referral` | **3** | 1 hour | Same. |
| `/api/leads/new` | **5** | 1 hour | Server-side fan-in from the above; still capped per public IP. |

**Global per-IP across ALL forms:** **15** / hour. Trips an alert (email to Michael) when exceeded — a single IP hitting 15 form submissions an hour is almost certainly a bot operator probing.

### Key generator

Use `x-forwarded-for` first value, fall back to `x-real-ip`, then a hash of `user-agent + accept-language` as a weak fallback (so we don't lump every "unknown" IP into one bucket). Existing `lib/rate-limiter.ts` already does the first two — port that.

### Log trail

`[ratelimit:blocked] endpoint=/api/forms/contact ip=1.2.3.4 count=4 window=3600s`

Returned response: `429 Too Many Requests` with `Retry-After` header (same as current behavior).

### Migration plan

- New code goes in `lib/rate-limit-kv.ts`; old `lib/rate-limiter.ts` and `lib/rate-limit.ts` stay until every public route is migrated.
- Add a `USE_KV_RATE_LIMIT=true` env flag; the `withRateLimit` wrapper checks it and routes to KV or in-memory. Lets us roll back instantly if KV misbehaves.
- KV is also the natural home for the domain block list cache (see §5) and any future bot-IP block list.

---

## 5. Domain block list (Layer 4 — surgical)

### File

`data/spam-domains.json`:

```json
{
  "version": 1,
  "updatedAt": "2026-05-20",
  "blockedDomains": [
    "trustedbusinessawards.com",
    "trustedawards.org",
    "businessawardsdirect.com",

    "growth-hackers.io",
    "outreach-leads.com",
    "leadgenius-pro.com",
    "saleshacker-outreach.com",
    "b2b-outreach.net",
    "cold-email-outreach.com",

    "seopromotion.io",
    "seo-boost-pro.com",
    "backlinks-pro.net",
    "linkbuilders-direct.com",
    "rank-higher.io",

    "webdesign-offers.com",
    "wpdesign-pro.net",
    "websiteaudit-free.com",

    "crypto-invest-now.com",
    "bitcoin-opportunity.io",

    "guest-post-pro.com",
    "content-syndicate.net"
  ],
  "blockedEmailLocalParts": [
    "juliana",
    "ashley.outreach",
    "samantha.partnerships"
  ],
  "notes": "Domains here are auto-rejected at /api/forms/* and /api/email-capture. Add new offenders here, no code change needed. Local parts are matched only when paired with a B2B outreach pattern (full email like juliana@SOMETHING.com triggers).",
  "lastReviewedBy": "Michael"
}
```

Seed list rationale: 20 entries covering the four most common B2B outreach categories that hit roofing contact forms:
1. **Fake "awards" outfits** (`trustedbusinessawards`-style) — current attacker.
2. **Outreach-as-a-service vendors** that send cold emails on behalf of clients.
3. **SEO / backlink farms** — perennial roofing-website spam.
4. **Web-design / "we noticed issues with your site"** scams.
5. **Crypto / guest-post** noise.

The exact 20 above are pattern-representative — real domain choice should be informed by reviewing the last 30 days of contact form submissions before launch and adding the actual top offenders. The point of the file is it's editable by Michael with no code deploy.

### Implementation pattern

New file `lib/spam-domains.ts`:

```ts
import { readFileSync } from 'fs';
import path from 'path';

let cache: { domains: Set<string>; locals: Set<string>; loadedAt: number } | null = null;
const TTL_MS = 5 * 60 * 1000;

function load() {
  if (cache && Date.now() - cache.loadedAt < TTL_MS) return cache;
  try {
    const raw = readFileSync(path.join(process.cwd(), 'data', 'spam-domains.json'), 'utf-8');
    const json = JSON.parse(raw);
    cache = {
      domains: new Set((json.blockedDomains ?? []).map((d: string) => d.toLowerCase())),
      locals: new Set((json.blockedEmailLocalParts ?? []).map((s: string) => s.toLowerCase())),
      loadedAt: Date.now(),
    };
  } catch {
    cache = { domains: new Set(), locals: new Set(), loadedAt: Date.now() };
  }
  return cache;
}

export function isBlockedEmail(email: string): { blocked: boolean; reason?: string } {
  if (!email || !email.includes('@')) return { blocked: false };
  const lower = email.toLowerCase();
  const [local, domain] = lower.split('@');
  const { domains, locals } = load();
  if (domains.has(domain)) return { blocked: true, reason: `domain:${domain}` };
  if (locals.has(local)) return { blocked: true, reason: `local:${local}` };
  return { blocked: false };
}
```

### Route guard (apply to every email-bearing endpoint)

```ts
const block = isBlockedEmail(body.email ?? body.referrerEmail ?? '');
if (block.blocked) {
  console.warn('[spam-domains:blocked]', { endpoint, reason: block.reason, ip });
  // Fake-success, same rationale as honeypot
  return NextResponse.json({ success: true, message: 'Thanks!' }, { status: 200 });
}
```

### Why not just extend the existing `lib/spam-filter.ts` `customBlockedDomains`?

Two reasons:
1. `customBlockedDomains` lives inside `data/lead-distro-config.json`, which is the lead-distribution config and is edited by office staff via a portal page. Mixing spam-domain edits there risks accidental config corruption.
2. The existing spam filter only runs inside `/api/leads/new`. By the time submissions reach it, they've already been logged to "All Lead Submissions" with full PII. We want to **reject at the front door** before any Sheets write.

We do, however, want **one-way sync**: when Michael adds a domain to `spam-domains.json`, it should be visible in the lead-distro config UI as "blocked". A read-only merge view is fine; that's a follow-up, not blocking.

### Log trail

`[spam-domains:blocked] endpoint=/api/forms/contact reason=domain:trustedbusinessawards.com ip=1.2.3.4`

Add a daily count to Michael's morning email so we can see if the list is doing work.

---

## 6. Order of operations / rollout

The defense layers stack in this order at request time:

```
1. request-size-limit   (already done, 50 KB cap)
2. honeypot field       ← Phase 1
3. spam-domains block   ← Phase 1
4. KV rate limit        ← Phase 2
5. Turnstile verify     ← Phase 3
6. existing spam-filter (content scoring, unchanged)
7. business logic
```

### Phase 1 — Land first (zero user friction, biggest immediate win)

**Day 1, single PR:**

- `components/forms/HoneypotField.tsx` (shared component)
- Add `<HoneypotField />` to all 10 form components listed in §1
- `lib/honeypot.ts` with `isHoneypotFilled(body)` helper
- `data/spam-domains.json` seeded with the §5 list (after Michael does a 30-day inbox review and confirms the actual top offenders)
- `lib/spam-domains.ts` with `isBlockedEmail()`
- Wire both checks into all 10 routes as the first two guards after body parse
- Logging tags `[honeypot:rejected]` and `[spam-domains:blocked]`
- **No env-var changes required, no third-party services. Ships safely.**

**Expected impact:** kills the trustedbusinessawards-class attack immediately. Honeypot alone typically blocks 60–80% of dumb-bot form spam at zero conversion cost.

### Phase 2 — KV rate limit (still zero user friction)

**Day 2–3, separate PR:**

- Add `@vercel/kv` to package.json
- Provision Vercel KV in the project dashboard, capture `KV_*` env vars
- `lib/rate-limit-kv.ts`
- `USE_KV_RATE_LIMIT` env flag for instant rollback
- Migrate every route from in-memory `withRateLimit` to KV version
- Apply the per-endpoint thresholds from §4
- Add the global per-IP-across-all-forms counter + alert email
- **Soft-launch:** flip `USE_KV_RATE_LIMIT=true` for 6 hours, monitor Vercel logs + KV usage, then leave it on.

**Expected impact:** caps any individual attacker IP regardless of which form they pivot to. Closes the "concurrent cold-start bypass" hole in the current in-memory limiter.

### Phase 3 — Turnstile (some user friction, defense-in-depth)

**Day 4–7, separate PR:**

- Register the site at Cloudflare Turnstile dashboard; capture site key + secret key
- Env vars: `NEXT_PUBLIC_TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY`, `TURNSTILE_ENFORCE`
- `lib/turnstile.ts` with `verifyTurnstile()`
- Add `<Turnstile />` widget to:
  - Contact forms (`ContactForm`, `LandingPageForm`, `Header`, `QuickContactForm`)
  - Careers form
  - BNI partner form
  - Check-my-address page
- **Skip** Turnstile on `/api/email-capture` (footer/popup) to preserve conversion rate
- **Skip** Turnstile inside `DogChatBot.tsx` (conversational UX — adding a captcha breaks the flow)
- Server-side: gate the route on `verifyTurnstile()`. Start with `TURNSTILE_ENFORCE=false` for 24h (verify + log only); flip to `true` after observing failure rate.

**Expected impact:** closes the remaining hole — sophisticated bots that bypass honeypot via JS-execution will still trip Turnstile's browser-fingerprint challenge.

### Phase 4 — Cleanup & observability

- Remove the legacy `lib/rate-limit.ts` (the simpler one) — fold its one user (`/api/email-capture`, `/api/honeypot`) onto the unified KV limiter.
- Add a `/portal/admin/spam-health` page showing daily counts: honeypot rejections, domain blocks, rate-limit blocks, Turnstile failures. One panel per layer so we can see which one is doing the work and which one needs tuning.
- Quarterly: review `data/spam-domains.json` against actual rejected submissions; prune false positives, add new offenders.

---

## Constraints check

| Constraint | How this plan honors it |
|---|---|
| Cost-sensitive | All four layers use free tools: honeypot (no cost), Vercel KV (free tier covers us by ~30×), Cloudflare Turnstile (free, no cap), domain list (file in repo). |
| Don't break legit submissions | Honeypot is invisible. Domain block list is curated by Michael. Rate limits are sized for real human behavior (3/hr per form is generous). Turnstile is the only visible-friction layer, and we skip it on the highest-conversion forms (footer/popup, chatbot). |
| Clear log trail on every rejection | Every layer emits a distinct grep-able tag: `[honeypot:rejected]`, `[spam-domains:blocked]`, `[ratelimit:blocked]`, `[turnstile:failed]`. Phase 4 admin dashboard surfaces counts. |
| Spec only, not implementation | Code in this doc is illustrative skeletons — no real files have been added or modified. |

---

## Open questions for Michael before implementation

1. **30-day inbox review** before seeding `spam-domains.json` — do you want to do this together so the seed list reflects your actual top offenders, not just my guess?
2. **Vercel KV provisioning** — confirm we want a new KV namespace in the existing project, or a separate project. (Recommendation: same project.)
3. **Alert threshold for global per-IP-across-all-forms** — 15/hr is my guess. Want it tighter (10) or looser (25)?
4. **Should `/api/contact` and `/api/referral` (the legacy endpoints) be deprecated entirely** rather than hardened? No current UI binds to them. Removing them is a one-PR shrink to the attack surface.
