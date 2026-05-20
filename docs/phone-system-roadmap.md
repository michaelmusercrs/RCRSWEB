# RCRS Phone System Roadmap

## Where we are

- **PBX**: FreePBX 16+ on the owner's son's Ubuntu PC.
- **Trunk**: VoIP DIDs from a SIP provider (owner-managed). One number proven
  ringing at the time of writing.
- **Portal UI**: command-center phone dashboard at
  `app/(tools)/command-center/phone/*` — extensions, ring groups,
  feature codes, calls, voicemail.
- **Integration**: `lib/freepbx-service.ts` talks to the FreePBX 16+ REST
  API at `/admin/api/api/*` using Bearer-token auth. Env-gated — falls
  back to stub data when env is missing.
- **Sheets**: `Phone Call Log` tab persists every click-to-call originate
  via `lib/phone-call-log.ts`. The existing `Calls` tab continues to
  mirror the FreePBX CDR for historical analytics.

## What ships in this sweep

| Surface                                   | Status |
| ----------------------------------------- | ------ |
| FreePBX REST client (extensions/queues/routes/CDR/originate/recordings) | env-gated, builds |
| Phone dashboard (live registration + queue strip) | updated |
| Extension manage page (live device + queue badges) | updated |
| Extension detail page (live PBX status + click-to-call test) | updated |
| Queue dashboard sub-page                  | new    |
| Routing sub-page                          | new    |
| Recording playback sub-page               | new    |
| VoIP number management sub-page           | new    |
| Click-to-call component                   | new    |
| Sheets-backed Phone Call Log              | new    |

## What ships next (env-gated, not yet wired)

1. **Live AMI bridge** — REST is enough for read endpoints, but
   originate has higher fidelity over AMI (call-state events for
   live "ringing → bridged → hung-up" UI updates). Build a side-car
   that proxies AMI events to Vercel via Pusher/webhooks; not worth
   it until call volume justifies the extra moving part.
2. **Voicemail-to-email piping into the portal** — FreePBX already
   emails the recipient, but we want a copy posted to the
   `Voicemails` sheet tab + the customer's job thread. Webhook from
   FreePBX `voicemail_received` → `/api/webhooks/voicemail`.
3. **Per-rep call recording retention rules** — IRS retention spec
   says 7 years for any call referencing a financial transaction.
   Implement a nightly Vercel cron that moves >90-day recordings to
   Vercel Blob cold storage and rotates active recording storage on
   the FreePBX box.
4. **JN integration: phone field → ClickToCallButton everywhere.**
   The button is built and reusable. Need to sweep the JN lead/
   contact/job views and replace static phone strings with
   `<ClickToCallButton fromExt={user.ext} toNumber={lead.phone} />`.
5. **Real-time ringing toasts.** Use FreePBX webhook (or a small
   Asterisk dialplan AGI hook) to push `incoming-call` events to the
   portal via the existing notification channel so the UI flashes
   "Call from (256) … — ext 104 is ringing".

## Feature comparison — what to adopt

I scoped this against five "other functioning phone system programs"
to pick the patterns we should adopt. None require leaving FreePBX —
all of these are configurable inside FreePBX itself, we just need
the portal UI to expose them well.

### FusionPBX (open-source, FreeSWITCH)
- **Multi-tenant strong suit** — not relevant for us (single tenant)
- **What to steal**: per-domain call recording bucket + auto-purge
  retention policy. Cleaner than FreePBX's "set in two places, hope".
- **Skip**: their UI is dated and we already have a better one.

### 3CX (commercial, polished)
- **Click-to-call browser extension** — Chrome/Firefox extension that
  highlights any phone number on any web page and turns it into a
  click-to-call button. Worth building for RCRS reps who live in
  Gmail + JN web UI. **Picked: add to roadmap.**
- **Visual call routing canvas** — drag-and-drop IVR/routing tree.
  Way overkill for our 1-2 routes; skip.
- **Chat-as-first-class** — they treat SMS, WhatsApp, Webchat and
  voice as a unified inbox. RCRS already routes SMS to Sara via
  Google Voice; bringing it into the portal "inbox" is a future
  improvement. **Picked: aspirational.**

### Wazo (open-source, Asterisk fork)
- **Switchboard view** — a single screen for the receptionist that
  shows every ringing/active call as a draggable card. Sara would
  love this. FreePBX 16 has FOP2 (Flash Operator Panel 2) but it's
  paid and ugly. **Picked: build our own switchboard view in the
  portal — uses the queue dashboard we already shipped + an
  Originate-on-drag handler.**
- **Per-user softphone provisioning page** — extension comes up,
  user clicks "configure my softphone", QR code provisions Linphone/
  Acrobits on their mobile. **Picked: build a "Setup my phone"
  page under the extension detail.**

### Yeastar P-Series (commercial)
- **Per-call notes panel** — the answering user gets a sidebar that
  pre-fills with CRM data (matched by caller ID) and lets them type
  notes that stick to the CDR row. **Picked: extend our existing
  CALLS tab `notes` column with a portal write path.**
- **Wallboard mode** — TV-friendly call queue display for the
  warehouse / office. **Picked: build a `/command-center/phone/wallboard`
  full-screen variant of the queue dashboard.**

### Vodia + VitalPBX (lower priority)
- **Vodia's ML-based ring strategy** ("if Sara answered this number
  last time, ring her first this time") is interesting. **Skip
  for now — not enough call volume to train it.**
- **VitalPBX's outbound recording disclaimer** auto-plays a TTS
  blurb on every outbound call. RCRS legal hasn't asked for this;
  defer.

### Best-feature picks (TL;DR)

In priority order:

1. **Voicemail-to-email + portal copy** (FreePBX → Sheets webhook).
2. **JN ClickToCallButton sweep** (use the component we just built).
3. **Switchboard view for Sara/Tia** (one-screen receptionist UI).
4. **"Setup my phone" QR/provisioning page** per extension.
5. **Per-call notes side panel** during active calls.
6. **Wallboard mode** for the office TV.
7. **Chrome extension click-to-call** (sniff phone-number patterns on
   any page → POST `/api/freepbx/originate`).

## FreePBX configuration items the owner controls (not portal)

These never belong in code — they're owner-only PBX admin tasks:

- Adding/removing a SIP trunk
- DID purchase + porting
- E911 address registration (required by FCC)
- Time-of-day rule definitions (business hours)
- Voicemail PINs

The portal _displays_ all of these but never edits them.

## Provisioning checklist (for the owner)

When ready to wire this up, paste these into Vercel env:

```
FREEPBX_URL=https://<your-tailscale-or-wan-host>:<port>
FREEPBX_API_USER=admin
FREEPBX_API_KEY=<from FreePBX → Admin → API>
FREEPBX_API_SECRET=<optional>
FREEPBX_RECORDINGS_BASE=<URL where /var/spool/asterisk/monitor is served>
FREEPBX_VOIP_NUMBERS=[{"did":"+12565154245","label":"Main","ringsTo":"queue:600","provider":"VoIP.ms","status":"active","monthlyCostUsd":0.99}]
```

Then enable the REST API module in FreePBX:
1. Module Admin → "Rest Api" (and "Rest Api Module Phpgangsta")
   → Install + enable
2. Admin → API → Add Application → grant scopes for
   `cdr`, `extensions`, `queues`, `inbound-routes`, `originate`.
3. Copy the key into `FREEPBX_API_KEY` and redeploy.

## Open questions for the owner (`[needs-owner]`)

1. **WAN access vs Tailscale** — is the FreePBX box reachable from
   Vercel? If not, we need to either expose it through Cloudflare
   Tunnel or have Vercel hit a portal-side proxy that lives on
   Tailscale.
2. **DID provider** — Twilio, VoIP.ms, Bandwidth? Determines whether
   we should add a provider-specific endpoint for live DID status
   (e.g. balance, recent CDR) rather than just trust the env JSON.
3. **Recording retention policy** — keep all forever? 7 years? 90 days?
   Affects how we size the storage path and whether we need cold
   storage in Vercel Blob.
4. **E911 address per extension** — mobile/softphone users at
   different sites need different E911 registration. Worth a
   separate "Update my E911 address" portal page if reps work from
   multiple locations.
5. **Mobile softphone of choice** — Linphone (free, OSS) vs Zoiper
   (free + paid) vs Acrobits (paid). The "setup my phone" page
   should generate provisioning config for one of these.
