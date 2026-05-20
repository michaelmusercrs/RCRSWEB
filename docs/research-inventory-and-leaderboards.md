# Inventory & Leaderboards: Comparative Research

> Read-only research for Phase 5.1 (inventory) and Phase 5.2 (leaderboards).
> Goal: feature ideas worth rebuilding ourselves. No SaaS purchases recommended.
> Sources are linked inline so each claim can be verified.

---

## Part 1 — Inventory app patterns (Phase 5.1)

**What RCRS has today** (per codebase + memory): warehouse-based material orders, Rick mobile load + GPS, X88 display, stock@rcrsal.com email-webhook intake, vendor returns, ticket flow, Tuya stub, two INV catalogs (`Inventory_Products` = 11 stock items, `Inventory` = 26 job materials), load-verified → Sara invoice + deduct.

### Sortly — [sortly.com/features](https://www.sortly.com/features/)
- **Better than us:** (1) Native QR/barcode label generation tied to item create — we generate no labels today. (2) Camera-first item photos with versioning — we have `imageUrl` field but no capture UI. (3) Per-item custom fields without code changes.
- **Skip:** Their "in-app folder hierarchy" model (Sortly is folder-based) is over-engineered for 11 stock SKUs.

### Fishbowl — [fishbowlinventory.com/features](https://www.fishbowlinventory.com/features)
- **Better than us:** (1) Cycle-count workflows (scan N items per week, system reconciles) instead of full counts. (2) Lot/serial tracking — useful for shingle batches (UV warranty claims). (3) Pick-pack-ship with verified scan-out.
- **Skip:** Manufacturing BOM, 3PL ownership tracking. Both are wholesaler-scale.

### Cin7 Core — [cin7.com](https://www.cin7.com/)
- **Better than us:** (1) Demand forecasting from rolling sales — we have no reorder math beyond static `minStock`. (2) Multi-channel order ingestion (we get tickets via email-webhook only).
- **Skip:** 700+ integrations, B2B portal, assembly manufacturing.

### inFlow — [inflowinventory.com/features](https://www.inflowinventory.com/features/)
- **Better than us:** (1) Recommended reorder points calculated from velocity, not hard-coded. (2) One-click PO from low-stock alert → vendor email. (3) Pick lists generated from job materials lists.
- **Skip:** B2B showroom, multi-warehouse transfers.

### Square for Retail (POS) — public capability page
- **Better than us:** (1) Print Avery-compatible barcode labels from desktop without third-party software. (2) Vendor-grouped low-stock view (re-order one vendor at a time).
- **Skip:** Everything else — it's a register, not a warehouse tool.

### JobNimbus inventory module
- **Conclusion:** JN does **not** ship a real inventory module — only a "Materials" line-item on jobs ([jobnimbus.com/features](https://www.jobnimbus.com/features/)). Not worth replicating; we already exceed it.

### Top 5 RCRS inventory improvements (ranked by impact / effort)

1. **Auto-generate QR labels per SKU + scan-to-adjust on Rick mobile.** One QR per `Inventory_Products` row, taped to bin. Rick scans → opens stock-adjust modal pre-filled. (~1.5 days; eliminates wrong-SKU-deducted bugs.) Inspiration: Sortly QR.
2. **Velocity-based reorder-point recommender.** Replace static `minStock` with rolling 30/60/90-day burn-rate from `inventory-transactions.json`; surface as "suggested min" on the SKU page. (~1 day; cuts stockouts without guesswork.) Inspiration: inFlow.
3. **Photo-on-load-verify.** Rick mobile snaps a load photo at `load_verified` event; attached to JN ticket + included in Sara's invoice email. (~0.5 day; kills the "what got delivered?" disputes.) Inspiration: Sortly item photos.
4. **Weekly cycle-count rotation.** Auto-pick 3 SKUs/week, push to Rick's mobile as a "count these today" card; variance auto-creates a `reconciliation` transaction. (~1 day; we currently never reconcile.) Inspiration: Fishbowl cycle counts.
5. **One-click "reorder from low-stock" email to vendor.** Low-stock GroupMe alert already exists in `groupme-service.ts`; add a button on the alert link that pre-fills a PO email to that SKU's supplier. (~0.5 day; closes the loop.) Inspiration: inFlow one-click PO.

---

## Part 2 — Leaderboard / sales-board patterns (Phase 5.2)

**What RCRS has today**: `/command-center/sales/leaderboard` with rank cards, tier badges, points, streak, achievements; three distinct boards (Commission/Sales/Weekly per `[[project_rcrs_leaderboards]]`); GroupMe service wired for new-lead / SLA alerts but not wins; **no TV-rotation mode**; `/chrisview` is a static admin dashboard, not a floor display.

### Spinify — [spinify.com/features](https://spinify.com/features)
- **Worth stealing:** (1) "TV, web, mobile" multi-surface render of same board — same data, three layouts. (2) Tiered mini-targets ("daily goal → weekly goal → monthly goal") with badges per tier, not just total-month rank.
- **Skip:** 500+ template designs, AI layout generator. We need one good TV view, not 500.

### Ambition — [ambition.com](https://ambition.com/)
- **Worth stealing:** (1) **Scorecards** — each rep has 4-6 weighted KPIs (calls, inspections, signed, revenue) shown as a single "score" rather than raw rank. Handles the "Sales vs Commission vs Weekly are different numbers" problem elegantly. (2) Coaching cards: rep + manager 1:1 history on each profile.
- **Skip:** Forecasting orchestration, enterprise risk detection.

### Hoopla / Raydeo
- **Worth stealing:** "Newsflashes" — full-screen takeover of TV when a deal closes, with rep photo + dollar amount + a sound effect. 8 seconds, then back to board. Reps watch the TV waiting for their face.
- **Skip:** Their full-broadcast TV "channel" model (24/7 scheduled content).

### SalesScreen — [salesscreen.com](https://www.salesscreen.com/)
- **Worth stealing:** (1) **Missions** that decompose a monthly goal into daily micro-targets ("knock 8 doors today"); the leaderboard tracks mission completion, not just $. (2) Endorsements — peers can give kudos that show on the feed (cheap dopamine, no $ cost).
- **Skip:** Reward Shop (digital coin economy) — too much admin overhead.

### CompetitionLabs — [competitionlabs.com](https://www.competitionlabs.com/)
- **Worth stealing:** Anonymous-by-default for bottom half of the board; only top performers are named publicly. Solves the "low-performer shame" problem without killing competition.
- **Skip:** White-label gaming SDK.

### HubSpot / Salesforce native
- **Worth stealing:** HubSpot's "deal velocity" metric (avg days from inspected → signed → revenue) per rep — more actionable than rank.
- **Skip:** Salesforce's `_PerformanceCycle` object soup. Way too much for 8-12 reps.

### Top 5 RCRS leaderboard improvements (ranked)

1. **TV-mode at `/chrisview/board` (or a new `/tv` route).** Auto-rotate every 30s through: top-5 Commission, top-5 Sales (Monday accrual), top-5 Weekly self-report, last-30-min activity ticker. Reuses existing data from `/api/command-center/competition` + `/api/command-center/weekly-leaderboard`. Lock to fullscreen, hide chrome. (~1.5 days; biggest visible-wins-per-hour return.) Inspiration: Spinify multi-surface, Hoopla newsflashes.
2. **Win takeover via GroupMe + TV.** When `signed_contract` event fires, GroupMe post + TV mode displays a 6-second full-screen "Rep X signed $Y" card with photo. Hook into existing `lib/groupme-service.ts` `job_status_change` handler. (~1 day; cheapest dopamine win available.)
3. **Composite scorecard view per rep.** New `/portal/sales/scorecard/[rep]` page that shows Commission $, Sales accrual, Weekly self-report, plus three velocity metrics (response time, close rate, days-to-signed) as a single weighted "score" — never combine the three boards' numbers, but expose them side-by-side. (~2 days; ends the "which number is real?" arguments.) Inspiration: Ambition scorecards.
4. **Daily missions, not just monthly ranks.** Add a "today's mission" card to the rep dashboard: e.g. "Inspect 3 roofs by 5pm — 2/3 done." Completing a mission gives mission-points separate from sales-points. Storage = new `data/missions.json` keyed by date. (~1.5 days; converts monthly competition into daily wins.) Inspiration: SalesScreen missions.
5. **Anonymous-tail leaderboard mode.** On `/portal/sales/leaderboard`, hide names below rank 5 by default — show "Rep #6, Rep #7..." with their own name visible only to themselves. Owner/admin/manager see full names. Toggle in admin settings. (~0.5 day; lets you keep public competition without naming-and-shaming.) Inspiration: CompetitionLabs.

---

## Constraints honored
- Zero SaaS purchases recommended. Every feature above is rebuildable in existing Next.js + Sheets + Blob stack.
- All five inventory items fit `lib/inventory-*` and Rick mobile; no new infra.
- All five leaderboard items reuse existing routes (`/command-center/sales/leaderboard`, `/chrisview`, `lib/groupme-service.ts`, `data/*.json`) — no new auth surface, no new role.
- Total scope estimate: ~10 dev-days across both phases.
