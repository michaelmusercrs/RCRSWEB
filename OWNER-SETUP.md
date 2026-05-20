# Owner Setup — 5 things to do to finish the email/security rebuild

Everything below the code line is already shipped and inert. These 5 setup tasks turn on the features. **Do them in order. Each takes 5-15 minutes.**

The Vercel project list you'll need throughout: **`rcrsweb`, `rcrswebsite`, `rcrswebsite2`, `river-city-roofing`** (the 4 public-site projects). The 5th project `rcrs-portal` is internal-only and doesn't need any of these envs yet.

---

## ☐ 1. Resend — turn email back on

Currently no system email leaves. Resend is the new transport.

1. Go to **https://resend.com** → Sign up with `rivercityroofingsolutions@gmail.com`.
2. Click **Domains** → **Add Domain** → enter `rivercityroofingsolutions.com`.
3. Resend will show you DNS records to add. Add them to your domain DNS (wherever you manage DNS for `rivercityroofingsolutions.com` — could be Vercel, Cloudflare, GoDaddy, etc.). Typically:
   - 1 SPF record (TXT) — **be careful**: if you already have a Google SPF record, don't add a second one; merge them (Resend's setup screen shows exactly how).
   - 1 DKIM record (TXT or CNAME — Resend's screen will tell you which)
   - 1 DMARC record (TXT) — optional but strongly recommended
4. Click **Verify Domain** in Resend. Wait until it shows green checks (DNS can take 10 min - 24 hrs).
5. Go to **API Keys** in Resend → **Create API Key** → name it `rcrs-prod`. Copy the key — **you only see it once**.
6. In Vercel, for each of the 4 public-site projects, go to **Settings → Environment Variables** and add for **Production** environment:
   - `RESEND_API_KEY` = the key you just copied
   - `EMAIL_FROM` = `notifications@rivercityroofingsolutions.com` (or another address on the verified domain — your call)
   - `EMAIL_FROM_NAME` = `River City Roofing Solutions` (optional, defaults to this)
7. **Redeploy** each of the 4 projects (Deployments tab → top deployment → ⋯ menu → Redeploy). Env changes don't take effect until redeploy.

After this: contact-form, load-verified-invoice, and driver-new-order emails will fire. Everything else is still allowlist-blocked.

---

## ☐ 2. Cloudflare Turnstile — invisible bot challenge on all forms

Catches bots the honeypot + spam-filter miss. Free.

1. Go to **https://dash.cloudflare.com** → Sign up / log in with `rivercityroofingsolutions@gmail.com`.
2. Left nav → **Turnstile**.
3. **Add a Site** → Site Name: `RCRS Public Forms` → Domain: `rivercityroofingsolutions.com` → Widget Mode: **Managed** → **Create**.
4. Cloudflare shows a **Site Key** and **Secret Key**.
5. In Vercel, for each of the 4 public-site projects, add **Production** env vars:
   - `NEXT_PUBLIC_TURNSTILE_SITE_KEY` = the site key
   - `TURNSTILE_SECRET_KEY` = the secret key
6. **Redeploy** each project.

After this: every public form shows a small invisible challenge. Real users almost never see it. Bots get blocked at the gate.

---

## ☐ 3. Vercel KV — persistent rate limit across cold starts

Without this, the rate limiter is in-memory and cold-start-bypassable. KV closes that gap. Free tier is generous.

1. In Vercel, open one of the 4 public-site projects → **Storage** tab → **Create Database** → **KV (Vercel Marketplace)** → pick a region close to Huntsville (e.g. `iad1` US East).
2. Name it `rcrs-rate-limit`.
3. When it's created, click **Connect to project** and attach it to all 4 public-site projects.
4. Vercel auto-injects 3 env vars per project: `KV_REST_API_URL`, `KV_REST_API_TOKEN`, `KV_REST_API_READ_ONLY_TOKEN`. Confirm they appear in each project's env vars.
5. **Redeploy** each project.

After this: rate limits persist across Lambda cold starts. Bot bursts can't bypass by hitting cold instances.

---

## ☐ 4. Pick what to do about the dead-code triage

Open `docs/dead-code-triage.md`. There are **12 open questions** for you at the bottom and **3 sections** (page overlaps, unreferenced API routes, orphan components) with concrete recommendations. Decisions you make there feed Phase 4 execution.

You don't need to read everything — the highest-value asks:
- `/contact/thank-you` vs `/thank-you` — which one is the real thank-you page?
- `/awards-trip` (public) vs `/command-center/competition/awards-trip` (portal) — both real? Or merge?
- `/portal/profile` (827 LOC) vs `/portal/my-profile` (459 LOC) — they have divergent edit-save flows. Which one is the real one?

Reply with answers and I'll execute the cleanup.

---

## ☐ 5. Confirm the dead-domain warning (Vercel)

Per memory, `rivercityroofingsoutions.com` (missing 'l') is configured as an alias on Vercel. Easy to typosquat — remove it. Vercel → project → **Settings → Domains** → find the typo'd one → **Remove**.

---

## After all 5 are done

Reply here and the next sweep run will:
- Send a real test of each of the 3 enabled email templates from prod and confirm they arrive looking professional.
- Activate the remaining 5 email templates if you say so, one at a time, with the same redesign treatment.
- Phase 5 comparative research (inventory/CRM/portal UX/SEO) — already deferred to next session per priority order.

---

## What's deployed but still off

| Feature | State without setup | State after setup |
|---|---|---|
| Email transport (Resend) | All sends drop with `[EMAIL TRANSPORT NOT CONFIGURED]` log | 3 templates fire; rest drop via allowlist |
| Turnstile bot challenge | Widget renders nothing; server fails-open | Real users pass invisibly; bots blocked |
| Vercel KV rate limit | In-memory fallback (per-Lambda only) | Cross-instance persistent counters |
| Honeypot field | Always on (no setup needed) | — |
| Spam-filter hard-block | Always on (4 seed domains) | — |
| Role/auth fixes | Always on | — |

Honeypot + spam-filter + role fixes are already protecting you now. Steps 1-3 just unlock the full set.
