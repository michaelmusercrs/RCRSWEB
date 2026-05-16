# RCRS Consolidation Plan

**Drafted 2026-05-15 (overnight) based on Phase 1 + Phase 2 audit findings.**
**Status: DRAFT — needs Michael's review before any retire/delete action.**

Edit this file in place. Strike out anything you disagree with. When ready,
tell me "execute" and I'll do exactly what's left.

---

## Decision key

- ✅ **KEEP** — canonical, do not touch
- 🟡 **MERGE** — fold valuable bits into another canonical thing, then retire the source
- 🔴 **RETIRE** — delete from disk / archive Vercel project, no lift needed
- 🔵 **INVESTIGATE** — need more info before deciding
- ⏸ **DEFER** — separate work, don't address in this consolidation pass

---

## Vercel projects (under `river-city-roofing-solutions-incs-projects`)

| Project | Decision | Notes |
|---|---|---|
| `rcrs-portal` | ✅ KEEP | The live production portal (rcrsal.com). Deploys from `~/river-city-roofing/` |
| `rcrswebsite` | 🔴 RETIRE | Stale duplicate (last touched 18h ago — likely auto-deploy from a stale branch). Verify no unique custom domain. |
| `rcrsweb` | 🔴 RETIRE | Same as above |
| `rcrswebsite2` | 🔴 RETIRE | Same as above |
| `river-city-roofing` | 🔴 RETIRE | Stale shell that points at same code as `rcrs-portal`. Delete the Vercel project (NOT the local dir). |
| `roof-sales-trivia` | 🔵 INVESTIGATE | 99d stale. May be tied to an event (trivia night). Confirm not used before retire. |
| `monday-magic` | 🔴 RETIRE | 100d stale. In-portal Monday meeting system supersedes. |
| `rcrs-monday-meeting` | 🔴 RETIRE | 101d stale. Superseded. |
| `rcrs-meeting-system` | 🔴 RETIRE | 104d stale. The hardcoded link in `command-center/meetings/page.tsx:709` should be removed. |
| `rcrs-analytics` | 🟡 MERGE | Standalone Python sales analytics. Either integrate the dashboards into `/portal/sales/analytics` OR retire and rebuild in-portal. Has real value. |
| `battery-dashboard` | 🔴 RETIRE | Non-roofing (IoT). |
| `blog` | 🔵 INVESTIGATE | 105d stale. Confirm no live blog posts. Public RCRS blog lives in main portal under `/blog`. |
| `dist` | 🔴 RETIRE | Non-roofing build artifact deploy. |
| `storm-prep` | 🔵 INVESTIGATE | Unclear purpose. Could be marketing landing page or internal tool. |
| `winter-generator` | 🔵 INVESTIGATE | Same as storm-prep — unclear. |
| `ram1500-deploy` | 🔴 RETIRE | Vehicle diagnostic, non-roofing. |
| `rcrs-site` | 🔴 RETIRE | Old site, superseded by main portal. |
| `qr-code` | 🔵 INVESTIGATE | Could be a QR-code generator for marketing materials. Confirm. |
| `river-city-new-site` | 🔴 RETIRE | Old "new site" experiment, superseded. |

**Action sequence after approval:** for each RETIRE: `vercel project remove <name>` (this only deletes the Vercel project, not your code). For MERGE/INVESTIGATE items: pause for individual decision.

---

## GitHub repos

### Under `Michaelmuze82` account

| Repo | Decision | Notes |
|---|---|---|
| `michael-claude-hub` | ✅ KEEP | New sync infrastructure (built today). |
| `mwm` | ⏸ DEFER | Joke "fake hacker terminal" — personal, not roofing. |
| `GoalGetter` | 🔴 RETIRE | Empty README only. June 2024. No code. |
| `app` | 🔴 RETIRE | Empty `.gitattributes` only. June 2024. No code. |
| `Leaderboard` | 🔴 RETIRE | Single 675-line vanilla-HTML prototype, localStorage only. Lift the `darts = floor(repairs / 2)` gamification formula into a comment in the current leaderboard code, then retire. |

### Under `michaelmusercrs` account

| Repo | Decision | Notes |
|---|---|---|
| `RCRSWEB` | ✅ KEEP | Houses `river-city-roofing/` — the live portal codebase. |
| `rcrs-inventory-system` | 🟡 MERGE-OR-RETIRE | The parallel "Rick's inventory" app at `~/projects/inventory-system/`. **Decision needed:** is this meant to ship as a standalone app, or fold into main portal? Current state: ~80% built, never deployed, duplicates features in main portal. **Recommended:** retire — main portal's inventory pages are more mature and already production. |
| (other repos under this account) | 🔵 INVESTIGATE | Run `gh repo list michaelmusercrs --limit 100` to enumerate. |

---

## Local directories (`C:\Users\Michael\`)

| Path | Decision | Notes |
|---|---|---|
| `river-city-roofing/` | ✅ KEEP | Active code. |
| `rcrs-portal/` | 🔴 RETIRE (delete from disk) | Stale shell pointing at the same Vercel project. Confusing. Delete the directory; the live deploy is from `river-city-roofing/`. |
| `rcrs-deploy-tmp/` | 🔴 RETIRE (delete) | Replaced by the hub workflow. 50+ training/deploy docs are interesting historical context — pull the useful ones into the hub repo first, then delete. |
| `rcrs-analytics` (in `projects/`) | 🟡 MERGE | See Vercel decision above. |
| `inventory-system` (in `projects/`) | 🟡 MERGE-OR-RETIRE | See GitHub decision above. |
| `roof-measure-tool/` | 🔴 RETIRE | Per your earlier decision — paying $45 per measurement is cheaper than maintaining. Salvage the consensus algorithm into `~/.claude/memory/salvaged-ideas.md` first. |
| `Projects/voci/.../RiverCity-GoogleVoice-PBX/` | ⏸ DEFER | FreePBX setup docs. Separate workstream. |
| `Projects/freepbx-setup/` | ⏸ DEFER | Same as above. |
| `Projects/marketing/` | ⏸ DEFER | Q1 2026 plans, ad copy. Reference material. |
| `Backups/2026-02-21/` | 🟡 MERGE | Old .env + OpenClaw snapshot. Pull anything still useful into current memory, then delete. |
| `river/` | 🔴 RETIRE | Empty folder, 248 days old. |
| `bni-framework/` | 🔴 RETIRE (already gone) | Doesn't actually exist. Memory has a stale ref to clean up. |
| `boston-house/` | 🔴 RETIRE (already gone) | Same — stale memory ref. |

---

## Code-level consolidation (inside `river-city-roofing/`)

### Duplicate API routes (Phase 2B agent findings)

| Pair | Decision |
|---|---|
| `/api/admin/lead-distro/config` vs `/api/leads/config` | 🟡 MERGE: pick one as canonical (probably `/api/admin/lead-distro/config` since it's role-gated). Make the other a thin redirect that 308s for 30 days, then delete. |
| `/api/sheets/commissions` (legacy) vs `/api/portal/jobnimbus/commissions` (live) | 🔴 RETIRE the legacy `/api/sheets/commissions` route. Confirm no callers via `grep -r "/api/sheets/commissions"`. |
| `/api/profitability/analytics` vs command-center financial | 🔴 RETIRE the unused one (`/api/profitability/analytics` per the agent's analysis). |
| All `(tools)/api/*` routes | 🟡 MERGE: move every route under `(tools)/api/*` to `/app/api/*`. The `(tools)` route group is for layout grouping, not API scoping. |
| `/api/portal/profile` vs `/api/profile` | 🔵 INVESTIGATE: are these for different audiences (rep vs public customer)? Confirm before retiring either. |

### TODOs that risk data loss

| File:Line | Issue | Decision |
|---|---|---|
| `app/api/customer/warranty-claim/route.ts:6` | TODO persist to Sheets — not done | ✅ FIX: write to a `WarrantyClaims` sheet tab. Acknowledgment email to customer. |
| `app/api/customer/service-request/route.ts:5` | TODO persist to Sheets — not done | ✅ FIX: write to a `ServiceRequests` sheet tab. Notify office. |
| `app/(site)/layout.tsx:33` | Missing `NEXT_PUBLIC_FB_PIXEL_ID` | ⏸ DEFER until pixel ID is acquired. |
| `app/(site)/layout.tsx:37` | Missing `NEXT_PUBLIC_GOOGLE_ADS_ID` | ⏸ DEFER until Google Ads ID is acquired. |

### Trip security gaps

| Concern | Decision |
|---|---|
| `/trip`, `/trip/update`, `/trip/admin` all public | ⏸ DEFER per your earlier decision (you said "/trip is ok not secured for now") |
| `app/trip/admin/route.ts:18-22` client-side admin toggle | ⏸ DEFER — note for future hardening pass |

### Invoice numbering migration (from today's discussion)

| Item | Decision |
|---|---|
| Current `JMC-YYYYMMDD-XXXXXX` format in `Job_Material_Costs` | 🟡 MIGRATE to `IN<job-digits>-<n>` going forward. Keep historical JMC rows as-is. |
| Add credit-memo type `CM<job-digits>-<n>` | ✅ BUILD: separate migration task |
| Live portal's `generateInvoiceNumber` | ✅ REPLACE with the function in `~/projects/inventory-system/src/lib/utils.ts` (already written, just needs porting) |

---

## "Three Separate Leaderboards" hard-rule completion

Today's deploy fixed the view labels. Still pending:

| Piece | Decision |
|---|---|
| Activity leaderboard endpoint | ✅ BUILD: new endpoint reading `RepWeeklyNumbers` tab, aggregating per rep per period |
| Weekly/monthly commission breakdown | 🔵 INVESTIGATE: QB exports are monthly; need to confirm with Sara whether weekly is meaningful |
| Three-leaderboard cleanup on `/command-center/sales/leaderboard` | ✅ APPLY: same view-toggle pattern as the meetings page |

---

## Roof-measure retirement

Per your decision: retire both codebases.

1. Salvage "Michael's Rule" consensus algorithm into `~/.claude/memory/salvaged-ideas.md` (a memory file)
2. Add a "Get a Pro Measurement" button on the public site → form → submission stored in a `MeasurementRequests` sheet tab, alerts office
3. Delete `~/roof-measure-tool/` directory
4. Delete `~/river-city-roofing/app/api/roof-measure/` (the broken portal copy)
5. Delete `~/river-city-roofing/app/(tools)/roof-measure-page/`
6. Remove unused env vars (Ollama, Vertex, etc.) from `.env.local`

---

## What's NOT in this plan (deferred to separate sessions)

- **JN ↔ Portal plumbing** — captured in `project_job_breakdowns.md` memory. Large multi-week effort.
- **PDF-to-ticket parser improvements** — separate workstream once we find what broke the 19th email
- **FreePBX phone deployment** — separate workstream
- **Cabinet lock ESP32 hardware** — separate workstream
- **Inventory accuracy reconciliation** — needs your physical count with Rick first

---

## How to execute this plan

When you're ready:

1. Edit this file — strike out anything you don't want, add notes to anything to clarify
2. Tell me "execute the consolidation plan"
3. I'll:
   - Run `vercel project remove` for every 🔴 RETIRE Vercel project (prompts for confirmation each time)
   - `gh repo delete` for every 🔴 RETIRE GitHub repo (will prompt for "are you sure")
   - Delete every 🔴 RETIRE local directory (with `rm -rf` AFTER `tar`-archiving them to `~/Backups/2026-05-15-pre-consolidation/`)
   - Apply every ✅ FIX code change in a single commit
   - Skip every 🔵 INVESTIGATE item and bring back a 1-line question on each

**No destructive action is taken until you say "execute".**
