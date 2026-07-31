# RCR PBX Bridge

Read-only bridge that pushes FreePBX call data from the office box ("Boston")
to the rcrsal portal. **It never changes anything on the PBX.** Outbound HTTPS
only; reads MariaDB over localhost and the Asterisk spool over the filesystem.

```
  cdr (MariaDB, localhost)  ─┐
  recordings (spool WAV)     ├─► bridge ──HTTPS──► https://rcrsal.com/api/calls/webhook
  voicemail (spool)         ─┘        (aggregates ~10 CDR legs per call into 1 event)
```

## What it does

- Polls `asteriskcdrdb.cdr`, groups legs by **linkedid** (one real call = many
  legs), and POSTs ONE normalized event per call (`call_end` / `call_missed` /
  `voicemail`) keyed on a deterministic id → the portal upserts idempotently.
- Uses the `CDR(userfield)` stage labels (`stage1/stage2/overflow/afterhours`,
  `gv:<ext>`) the PBX now stamps, so per-stage analytics are exact.
- Optionally transcodes recordings to Opus and uploads them (the portal stores
  them; the Blob token never touches this box).
- Heartbeats the portal each cycle so a dead bridge raises an alert instead of
  silently freezing the call log.

## Install (on Boston, inside WSL)

```bash
sudo mkdir -p /opt/rcr-pbx-bridge
sudo cp -r pbx-bridge/* /opt/rcr-pbx-bridge/     # from the RCRSWEB checkout
cd /opt/rcr-pbx-bridge
npm install --omit=dev                            # needs Node >=18 (Node 20 LTS recommended)
cp .env.example .env
# edit .env — set CALLS_WEBHOOK_API_KEY (from the portal) and confirm CDR_DB_*
```

### 1. Dry run first (safe on the live box — POSTs nothing)

```bash
node index.js --dry-run --once
```

Read the printed events and confirm they match reality (right caller, right
answered extension, right stage, inbound vs outbound). Nothing is written to the
portal in dry-run.

### 2. Backfill history (idempotent — safe to re-run)

```bash
node index.js --since 2026-07-31 --once      # CDRs exist since ~March; labels/recordings only from 2026-07-31
```

### 3. Run as a service

```bash
sudo cp rcr-pbx-bridge.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now rcr-pbx-bridge
journalctl -u rcr-pbx-bridge -f
```

## Enabling recordings / voicemail

Both are **off by default**. Turn on in `.env` once call events look right:

- `RECORDINGS_ENABLED=true` — needs `ffmpeg` (already installed) and read access
  to `/var/spool/asterisk/monitor`. Uploads one Opus file per answered call.
- `VOICEMAIL_ENABLED=true` — scans each mailbox's `INBOX` **and** `Old`
  (moveheard=yes means a heard message moves to Old — that's "heard", not
  deleted). NOTE: the portal side that files voicemail *messages* (audio +
  transcription) into the Voicemails tab is a follow-up; until it ships, these
  events only mark the matching call. Leave off unless coordinating with the
  portal work.

## Important notes

- **Timezone:** the service pins `TZ=America/Chicago`. The bridge converts CDR
  calldate to UTC using the process TZ, so this must match the PBX's local time.
- **Recordings before 2026-07-31 ~12:45 CT don't exist** — older calls have CDR
  rows but no audio. Expected, not an error.
- **linkedid is the key.** Confirmed populated. If a future Asterisk change ever
  stopped populating it, per-call aggregation would degrade to per-leg — tell
  the portal side.
- **State** lives in `./state/` (watermark, dead-letter, upload/seen sets). Keep
  it on persistent storage. Delete `watermark.json` only to force a full replay
  (safe — idempotent).
- **Dead letters:** events the portal rejected land in `state/deadletter.jsonl`
  for inspection/replay.

## Config reference

See `.env.example`. The only secret you must obtain from the portal side is
`CALLS_WEBHOOK_API_KEY` (must equal the portal's Vercel env var of the same name).
