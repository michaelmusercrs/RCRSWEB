# RCRS Email Transport Comparison

**Audience:** Owner (decision-maker)
**Status:** Spec only — no code changes yet
**Date:** 2026-05-20
**Context:** Replace the broken Google Apps Script transport (see `lib/email-service.ts` — transport is currently disabled because the GAS endpoint amplifies every send to `rivercityroofingsolutions@gmail.com` as a malformed "NEW CONTACT FORM SUBMISSION"). Owner has no edit access to the GAS app.

**Volume:** 50–200 sends/day. **Sender ID wanted:** `rcrs@rivercityroofingsolutions.com` or `noreply@rivercityroofingsolutions.com` (Google Workspace).
**Stack:** Next.js on Vercel paid plan, 4 public + 1 portal project in one monorepo.
**Hard requirement:** PDF attachments for material order invoices.

---

## Comparison Matrix

| Dimension | **Resend** | **nodemailer + Gmail SMTP** | **Postmark** | **Gmail API (googleapis)** |
|---|---|---|---|---|
| **Setup** | Add domain, paste 3 DNS records, generate API key | Create Workspace app password OR set up OAuth2 client | Add domain, paste 3 DNS records, generate server token | GCP project + service account + domain-wide delegation in Workspace admin |
| **Credentials** | `RESEND_API_KEY` | `GMAIL_USER` + `GMAIL_APP_PASSWORD` (or OAuth refresh token) | `POSTMARK_SERVER_TOKEN` | service-account JSON + impersonated user email |
| **Cost @ 50–200/day (~1.5k–6k/mo)** | **Free** (3k/mo free; $20/mo for 50k after) | **Free** (uses existing Workspace seat) | $15/mo (10k included) | **Free** (uses existing Workspace quota: 2k recipients/day per user) |
| **Deliverability** | Excellent — dedicated transactional IPs, SPF/DKIM/DMARC auto-aligned | Good for low volume; degrades fast if marked spam (Workspace shared IPs, no warm-up) | Best-in-class — separates transactional/broadcast streams, public delivery stats | Very good — Google's own IPs, same reputation as your real Gmail |
| **HTML / plain-text** | Yes | Yes | Yes | Yes |
| **Attachments (PDF)** | Yes (up to 40 MB) | Yes | Yes (up to 10 MB) | Yes (up to 25 MB) |
| **Templates** | First-class React Email integration (JSX components) | None — bring-your-own | Mustache server-side templates with version history | None — bring-your-own |
| **Auth model** | API key (single secret) | SMTP password OR OAuth2 (refresh token rotation) | API key (single secret) | Service account JWT + DWD (admin-console grant) |
| **Vercel / Next.js fit** | Designed for it — official Vercel partner, edge runtime supported, server-action friendly | Node-runtime only (TCP SMTP not available in edge); a few hundred ms per send | Works fine via HTTP API; edge-compatible with `fetch` | Works via HTTP; `googleapis` SDK is heavyweight; can `fetch` REST directly for edge |
| **Lock-in / switching cost** | Low — standard SMTP fallback available; templates are React (portable) | None — `nodemailer` is the industry abstraction; swap host anytime | Low — same shape as Resend; templates are vendor-specific | Medium — DWD setup is non-trivial; sender identity tied to Workspace user |
| **DNS to add** | SPF, DKIM (2 CNAMEs), DMARC | SPF (already present), DKIM in Workspace admin, DMARC | SPF, DKIM, Return-Path CNAME, DMARC | None new (Workspace already authorized) |
| **Quota visibility** | Dashboard with per-email status, bounce/complaint webhooks | None — bounces land in the sender's inbox | Dashboard with delivery, open, bounce, spam-complaint metrics | GCP console quota page; no per-email status UI |
| **Ops burden** | Low — one key, dashboard tells you everything | Medium — Workspace app passwords rotate manually; no delivery visibility | Low — but separate vendor invoice | High — service-account JSON rotation, DWD scopes, no per-send dashboard |

---

## Option Notes

### 1. Resend
Built for exactly this use case: a Next.js app on Vercel that needs reliable transactional email. React Email lets us replace the inline-styled HTML strings in `lib/email-service.ts` with real components (the existing portal-link, delivery, invoice, vendor-return templates port one-to-one). Free tier covers RCRS's whole volume with headroom (3k/mo free; we'd hit ~6k/mo at the 200/day ceiling, so worst case $20/mo). Bounce/complaint webhooks fire into our own API route, so we can surface delivery failures inside the portal instead of finding out from an angry customer. Sender identity is whatever address on `rivercityroofingsolutions.com` we want, after DNS verification.

### 2. nodemailer + Gmail SMTP
Cheapest in raw dollars (free, uses the Workspace seat we're already paying for), and zero new vendors. Real downsides for transactional use: (a) Gmail SMTP throttles aggressively if any meaningful share of sends bounce or get marked spam, and at 50–200/day we will eventually hit a customer who marks one as spam; (b) no deliverability dashboard — when something stops arriving, we're guessing; (c) app passwords are a sharp edge in Workspace (require 2FA, can silently revoke); (d) SMTP requires Node runtime, so any future edge-route migration breaks. This is what we'd build if we wanted "exactly the GAS setup, but correctly written" — and it has the same long-term problem GAS had.

### 3. Postmark
The deliverability gold standard. If we ever do customer-facing receipts where landing in the inbox is non-negotiable, Postmark is the safe choice. Downside: cheapest paid tier is $15/mo for 10k sends, and we wouldn't use 30% of that. For RCRS volume it's overkill, and we'd be paying for a feature (separated transactional/broadcast streams) we don't need yet — we don't send broadcast.

### 4. Gmail API (googleapis + domain-wide delegation)
Most "native" to Workspace — sends literally come from a Workspace user as if that user typed them. No new vendor. But: setting up domain-wide delegation requires GCP project + service-account JSON + scope grant in the Workspace admin console, the `googleapis` package is large (~1 MB cold-start hit on Vercel), and there's no per-send delivery dashboard. We'd also be tying RCRS's outbound to one Workspace user's 2k recipient/day quota — fine today, but a single bad cron loop burns the whole day's allowance. The only real win over option 2 is OAuth instead of SMTP password, which doesn't matter much for a server-side single-sender setup.

---

## Recommendation: **Resend**

**Three reasons:**

1. **Free at our volume, paid tier is trivial if we grow.** 3k/mo is free; if 200/day becomes 400/day we pay $20/mo. Cheaper than any scenario where deliverability problems cost us a customer.
2. **Best Vercel/Next.js ergonomics.** Single API key, edge-runtime compatible, official Vercel partner. The existing inline-HTML templates in `lib/email-service.ts` (portal link, delivery, invoice, vendor return, etc.) port directly, and we can upgrade them to React Email components incrementally — no rewrite required to migrate.
3. **Real deliverability for customer-facing mail without paying Postmark prices.** Dedicated transactional IPs, automatic SPF/DKIM/DMARC alignment, bounce/complaint webhooks. Solves the GAS deliverability blindspot that let the amplification bug run for weeks before anyone noticed.

(One satisfied free-/open-source preference note: Resend isn't OSS, but at this volume it's free, and the alternative that satisfies "OSS / self-hosted" — running our own Postfix on a VPS — adds an entire ops surface area we don't want. nodemailer-over-Workspace is the closest "no new vendor" option and is documented above; rejected for the deliverability reasons in option 2.)

---

## Next Steps (exact)

### 1. Env vars to add (Vercel project settings, all 5 projects)

```
RESEND_API_KEY=re_...                          # from Resend dashboard after sign-up
EMAIL_FROM=rcrs@rivercityroofingsolutions.com  # or noreply@... — pick one
EMAIL_FROM_NAME=River City Roofing Solutions
```

Keep existing anti-flood vars (`EMAIL_KILL_SWITCH`, `EMAIL_CAP_PER_HOUR`, `EMAIL_CAP_PER_DAY`, `EMAIL_CAP_OWNER_PER_HOUR`, `EMAIL_CAP_OWNER_PER_DAY`) — the rate limiter in `lib/email-service.ts` is transport-agnostic and still wanted.

Remove (or leave dead) `NEXT_PUBLIC_GOOGLE_SCRIPT_ENDPOINT`.

### 2. Packages to install

```
npm install resend
# Optional, for React Email templates (recommended for the next sweep):
npm install @react-email/components @react-email/render
```

### 3. DNS records to create (in the `rivercityroofingsolutions.com` zone)

Resend will display the exact values after you add the domain in their dashboard. The three records:

| Type | Host | Purpose |
|---|---|---|
| `TXT` | `send.rivercityroofingsolutions.com` | SPF (Resend's sending domain) |
| `CNAME` | `resend._domainkey.rivercityroofingsolutions.com` | DKIM |
| `TXT` | `_dmarc.rivercityroofingsolutions.com` | DMARC policy (`v=DMARC1; p=none; rua=mailto:dmarc@rivercityroofingsolutions.com`) — start at `p=none`, tighten to `p=quarantine` after 30 days of clean reports |

Existing SPF for Google Workspace stays. If the apex `TXT` already has an SPF record for Google, **do not add a second one** — merge Resend's `include:` into the existing record.

### 4. Code migration (out of scope for this doc, but for sizing)

`lib/email-service.ts` already has the right shape — a single `send(options)` method with convenience wrappers. Swap the `fetch(this.endpoint, ...)` body for `resend.emails.send({...})`. Add an `attachments?: Array<{ filename, content }>` field to `EmailOptions` for the upcoming PDF invoice sweep. Roughly a 30-line diff plus tests.

### 5. Sign-up + verification (owner action)

1. Sign up at resend.com with `rivercityroofingsolutions@gmail.com`.
2. Add `rivercityroofingsolutions.com` as a sending domain.
3. Paste the three DNS records above into the domain registrar.
4. Wait for verification (usually < 1 hour).
5. Generate a production API key, paste into Vercel env vars.

---

**File written:** `C:\Users\Michael\river-city-roofing\docs\email-transport-comparison.md`
