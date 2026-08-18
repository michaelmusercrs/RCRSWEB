# GAF QuickMeasure → JobNimbus automation — setup

Pulls GAF QuickMeasure reports out of the `rcrs@rivercityroofingsolutions.com`
inbox, attaches the measurement PDF to the matching JobNimbus job, drops a
material cheat-sheet note on the job, and emails the ordering rep the summary.
No-match reports retry and escalate instead of getting lost.

## How it works

1. **Cron** `/api/cron/gaf-report-sync` runs every 15 min (`vercel.json`).
2. **Ingest** — Gmail search of `rcrs@` for `from:services@gaf.com subject:"GAF QuickMeasure" has:attachment`. Real reports only (skips Reopened / Error / Takeoff / Account-Link). Deduped by GAF **Order #**.
3. **Match** — the property address is read straight from the email subject and matched to a JN job (house # + street + zip/city, rep tie-break). No address lookup exists in JN, so a recent-jobs window is pulled once per run and matched in memory.
4. **Attach** — high-confidence match → the *Full Report* PDF is attached to the job (`uploadFileToJob`, file-type EagleView slot), a material cheat-sheet note is added, and the rep is emailed the summary.
5. **No match** — the rep is emailed once ("create the job"), retried at ~15/30/60 min, then the office (`rcrs@rcrsal.com`) is emailed once. The report stays queued and keeps retrying until it's matched (auto, or manually on the review page).
6. **Verify** — a follow-up run confirms the file is actually on the job before the report is marked `done`.

State lives in the master sheet: `GAF_Report_Queue` (one row per report) + `GAF_Ingest_Log` (every action). Office review UI: **`/portal/gaf-reports`**.

## One-time setup

### 1. Gmail access for the cron (Workspace super-admin) — REQUIRED

The cron reads `rcrs@` using the **existing** Google service account
(`GOOGLE_SERVICE_ACCOUNT_EMAIL` / `GOOGLE_PRIVATE_KEY`) via **domain-wide
delegation**. Grant it read-only Gmail:

1. Google Admin console → **Security → Access and data control → API controls → Domain-wide delegation**.
2. **Add new**. Client ID = the service account's **OAuth client ID** (numeric, from the service-account key / Google Cloud console).
3. Scope: `https://www.googleapis.com/auth/gmail.readonly`
4. Authorize.

The service account then impersonates the mailbox (read-only). Nothing else in
the mailbox is touched. Until this is done, the cron logs
`Gmail service account not configured`/token errors and simply does nothing —
it never breaks other crons.

### 2. Environment variables

| Var | Required | Default | Purpose |
|-----|----------|---------|---------|
| `GAF_INGEST_MAILBOX` | no | `rcrs@rivercityroofingsolutions.com` | Mailbox to read |
| `GAF_OFFICE_LOCALPARTS` | no | `rcrs,sara,destin` | Recipients that are office (not the rep) |
| `GAF_OFFICE_NOTIFY_EMAIL` | no | `OFFICE_NOTIFY_EMAIL` → `rcrs@rcrsal.com` | Escalation recipient |
| `GAF_LOOKBACK_DAYS` | no | `4` | How far back to scan the inbox |
| `GAF_JOB_LOOKBACK_DAYS` | no | `120` | JN job window to match against |
| `CRON_SECRET` | yes (already set) | — | Cron auth |
| `RESEND_API_KEY` / `EMAIL_FROM` | yes (already set) | — | Rep/office email transport |
| `GOOGLE_SERVICE_ACCOUNT_EMAIL` / `GOOGLE_PRIVATE_KEY` / `GOOGLE_SHEETS_ID` | yes (already set) | — | Sheets + Gmail auth |
| `JOBNIMBUS_API_KEY` | yes (already set) | — | JN read/write |

The three email templates (`gaf-report-summary`, `gaf-no-match-rep`,
`gaf-office-escalation`) are **internal** — not gated by `CUSTOMER_EMAIL_ENABLED`.

## Coverage numbers — from the official handbook cheat sheet

The material math in `lib/gaf/coverage-config.ts` uses the AUTHORITATIVE RCRS
"Material Order Cheat Sheet" (SALES REP HANDBOOK, Drive id
`1Vbk9TBlggz4N3ORh-obi522e10pFXLf3`):

| Material | Coverage |
|----------|----------|
| Architectural shingles | 3 bundles / square |
| Synthetic underlayment | 10 sq / roll |
| Coil nails (1¼") | 16 sq / box |
| Button/cap nails | 35 sq/bucket flat · 25 sq/bucket steep (≥7/12) |
| Ice & Water (Stormguard) | 60 LF / roll |
| Hip & Ridge cap (IKO) | 33 LF / bundle (OC DuraRidge alt 20) |
| Starter shingles | 100 LF / bundle |
| Ridge vent | 4 LF / piece (advisory, not auto-ordered) |
| Drip edge | 10' sticks, ~9.5 LF usable / stick |

**Placement rules (Michael 2026-08-18):**
- Starter → all eaves **+ rakes**. Drip edge → full perimeter (eaves + rakes).
- Ice & Water → every job: valleys + walls + chimneys + penetrations. In
  **Madison County / Madison / Huntsville** (+ code areas) also the **full
  perimeter** (eaves + rakes). Code areas set by city/zip:
  `GAF_ICE_WATER_CODE_CITIES` (default `huntsville,madison`) +
  `GAF_ICE_WATER_CODE_ZIP_PREFIXES` (default `357,358`).

**Still `(est)`-flagged (only unconfirmed value):** shingle **waste factor 10%**.
Walls/chimneys/penetrations I&W footage is surfaced as an advisory (not in the
measurement report — add field-measured LF).

## Verifying the XML schema

QuickMeasure emails include an `Xml_*.xml` data file. The parser
(`lib/gaf/quickmeasure-parse.ts`) reads measurements from it defensively and
logs the raw XML key list to `GAF_Ingest_Log` (status `xml_keys`) the first time
it sees a report. If squares/ridge/eave come out blank, check that log row and
add the real tag names to the synonym lists in `measurementsFromXml`.
