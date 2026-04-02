# RoofStack Master Status & Plan
### Last Updated: 2026-04-01 | Generated from full codebase audit

---

## System Size (Real Numbers)

| Metric | Count |
|--------|-------|
| Source files (.ts/.tsx/.js) | 898 |
| Total lines of code | 57,302 |
| API routes | 271 |
| Pages | 221 |
| Lib/service files | 154 |
| Reusable components | 100 |
| Google Sheet tabs (configured) | 33 |
| Data JSON files | 52 |
| API integrations | 11 (JobNimbus, Google Sheets, Maps, Gemini, GroupMe, TeamUp, HailRecon, Vercel Blob, GA4, + 2 disabled) |
| Meeting number records | 44,031 (all-time) + 1,990 (2026) |
| Commission records | 33,817 (2018-2026) |
| Training modules | 45 role-based + 8 onboarding + 7 guides |

---

## Section Status Overview

| # | Section | Status | % Done | Blocks |
|---|---------|--------|--------|--------|
| 1 | **Login & Auth** | Code written, NOT tested live | 70% | Needs dev server test |
| 2 | **Leaderboards (Commission)** | API exists, data stale | 40% | Commission JSON needs refresh from JN |
| 3 | **Leaderboards (Sales/Meeting)** | Working, no labels | 60% | Needs "ESTIMATED" vs "ACTUAL" labels |
| 4 | **Leaderboards (Weekly Activity)** | Widget exists | 50% | No auto-refresh, no averages |
| 5 | **Monday Meeting Presentation** | Pages exist, not finalized | 50% | Needs approval flow, scheduling |
| 6 | **Monday Meeting Notes (Dept Heads)** | Basic notes page exists | 30% | Needs scheduling system, approval |
| 7 | **Dashboard Simplification** | Not started | 0% | Needs design decisions |
| 8 | **Admin Panel Consolidation** | Scattered across pages | 10% | Major reorganization needed |
| 9 | **View-As Feature** | Not started | 0% | Needs Michael's profile page update |
| 10 | **Role Permissions (Expanded)** | Hardcoded in team-roles.ts | 30% | Needs UI + sheet storage |
| 11 | **Data Consolidation/Backup** | 33 tabs configured, some empty | 40% | Needs audit + import missing data |
| 12 | **Detailed Logging** | Basic audit log exists | 20% | Needs AI descriptions, detail expansion |
| 13 | **Sales Rep Interface** | Dashboard exists | 50% | Needs motivation, comparisons, accuracy |
| 14 | **Training (Role-Filtered)** | Working | 85% | Minor: don't show training first on login |
| 15 | **JobNimbus Sync** | API configured, endpoints working | 70% | Commission data needs auto-sync to JSON |

---

## Section Details

### 1. LOGIN & AUTH (70% — Code Written, Not Tested)

**What's done:**
- Multi-method login (password, PIN, picture password) — code written
- Credential service with PBKDF2 hashing — code written
- Google Sheets "UserCredentials" tab — code written, NOT verified
- Stay-signed-in (30-day sessions) — code written
- Login setup page (post-onboarding) — code written
- Admin credential reset with hierarchy — code written

**What's NOT done:**
- [ ] Actually run dev server and test login flow end-to-end
- [ ] Verify Google Sheets tab auto-creates
- [ ] Verify password hashing works against live sheet
- [ ] Test PIN setup → logout → PIN login cycle
- [ ] Test picture password setup → logout → picture login cycle
- [ ] Test "stay signed in" survives browser close
- [ ] Test admin reset hierarchy (Sara resets a sales rep)
- [ ] Verify existing users can still login during migration

**Needs from Michael:** Nothing — just testing time

---

### 2. COMMISSION LEADERBOARD (40% — Data Stale)

**What exists:**
- `/api/command-center/sales/route.ts` — reads from `data/commissions.json`
- `data/commissions.json` — 33,817 records but dates back to 2018
- `/api/portal/jobnimbus/commissions/route.ts` — LIVE data from JobNimbus API

**What's broken:**
- Commission leaderboard pulls from **static JSON file**, not live JN data
- No auto-sync from JobNimbus → commissions.json
- Numbers not labeled as "Actual 1099 Commission" on charts

**What needs to happen:**
- [ ] Wire commission leaderboard to use JN API (live) or auto-sync JSON
- [ ] Add clear label: "1099 Commission Payouts (Actual)" on all commission charts
- [ ] Add average reference line to charts
- [ ] Filter: individual transactions visible ONLY to that rep + admin/owner
- [ ] Auto-refresh (at least every 30 seconds like the weekly board)

**Needs from Michael:**
- [ ] Confirm: is `data/commissions.json` the latest export? When was it last updated?
- [ ] Confirm: do you want commission leaderboard to pull LIVE from JobNimbus each time, or sync to JSON on a schedule?

---

### 3. SALES/MEETING LEADERBOARD (60% — Working But Unlabeled)

**What exists:**
- `/api/command-center/meetings/leaderboard/route.ts` — reads from meeting-numbers JSON
- `data/meeting-numbers-2026.json` — 1,990 lines through 2026-03-30
- `data/meeting-numbers-all.json` — 44,031 lines (2018-2026)
- `SalesDashboardLeaderboard.tsx` component
- `WeeklyNumbersWidget.tsx` — reps can submit their own numbers

**What's broken:**
- $$$$$ column NOT labeled "Estimated Accrual" in UI
- No distinction between actual commission vs estimated sales
- No average/reference lines on charts
- No auto-sync — admin must manually trigger sync from Google Sheet

**What needs to happen:**
- [ ] Add prominent label: "$$$$$ = Estimated Sales (Accrual)" on all meeting number charts
- [ ] Add "Actual Commission (1099)" label on commission charts  
- [ ] Add average/median reference lines to every chart
- [ ] Auto-sync meeting numbers from Google Sheet (background, every 15 min or on webhook)
- [ ] Show $$$$$ per inspection ratio alongside raw numbers

**Needs from Michael:**
- [ ] Has the Monday meeting sheet been updated past 3/30? If so, run a manual sync
- [ ] Are there historical sheets I should import? (You mentioned 40-50 tabs per year back to 2019)

---

### 4. WEEKLY ACTIVITY LEADERBOARD (50%)

**What exists:**
- `WeeklyNumbersWidget.tsx` — 35KB component, reps enter numbers
- `RepWeeklyNumbers` Google Sheet tab
- API endpoints for submit and read

**What's broken:**
- No auto-refresh
- No motivational comparisons
- No trend indicators based on historical performance

**What needs to happen:**
- [ ] Add auto-refresh (30-second interval, already done for commission per memory)
- [ ] Add historical comparison ("You're up 15% vs last month")
- [ ] Add team average reference line
- [ ] Show encouraging messaging for reps trending up

---

### 5. MONDAY MEETING PRESENTATION (50%)

**What exists:**
- `/portal/monday-notes/` — User submission interface
- `/portal/monday-notes/admin/` — Admin approval view
- `/command-center/meetings/present/` — Presentation view (18 slides)
- `/command-center/meetings/prep/` — Meeting prep page
- `/command-center/meetings/auto-generate/` — Auto-generate from portal data
- 6 API endpoints for meeting operations

**What's broken/missing:**
- No scheduling system for notes (this week only / recurring / custom)
- No deadline enforcement (must be submitted by Friday noon)
- No Sara/Michael/Chris approval step before Monday 10am
- No metadata on slides showing data source + last update time
- No preview mode with notes in bottom corner

**What needs to happen:**
- [ ] Add scheduling options to dept head note submission (this week / every week / certain weeks / custom)
- [ ] Add calendar picker for "until" dates
- [ ] Add approval workflow: items need Sara/Michael/Chris sign-off after Friday noon
- [ ] Add metadata to each slide: "Source: [sheet/API], Last Updated: [timestamp]"
- [ ] Add preview mode with presenter notes
- [ ] Add "last time RoofStack updated" and "last time source data updated" indicators

**Needs from Michael:**
- [ ] Who are the "dept heads" that submit notes? Sara, Destin, Tia, Bart? Or all managers+?
- [ ] What categories should notes fall into? (delivery, sales, operations, office, general — currently)
- [ ] Does the presentation auto-generate slides from the notes, or is it manually arranged?

---

### 6. DEPT HEAD DASHBOARD NOTES BOX (30%)

**What exists:**
- Monday notes basic submission page
- MondayNotes Google Sheet tab

**What's NOT built:**
- The rich note box on each dept head's main dashboard
- Support for images, videos, charts, graphs in notes
- Scheduling UI (checkbox: this week / recurring with calendar picker)
- The "every other week" / "first/last of month" / "first X weeks before quarter" options

**What needs to happen:**
- [ ] Add rich note editor to dept head dashboards (support text, images, video, charts)
- [ ] Add scheduling system with all the options you described
- [ ] Wire to Monday meeting presentation system

---

### 7. DASHBOARD SIMPLIFICATION (0% — Not Started)

**Current state:** Each role's dashboard shows a mix of daily tools + admin features + settings

**What you want:**
- Sara: Monday notes, notifications, presentation preview/edit, quick link to Admin Panel
- Michael/Chris: Main uses up front, everything else deeper or on separate menu
- All roles: Only primary daily tasks on dashboard, everything else → Admin Panel

**What needs to happen:**
- [ ] Audit each dashboard page and categorize every widget as "daily use" vs "admin/settings"
- [ ] Move admin/settings widgets to centralized Admin Panel
- [ ] Redesign Sara's dashboard with Monday-meeting focus
- [ ] Add hamburger/dropdown/header link to Admin Panel from all dashboards

---

### 8. ADMIN PANEL CONSOLIDATION (10%)

**Current state:** Settings scattered across:
- `/portal/admin/team/` — CMS team management
- `/admin/team/` — User account management
- `/portal/admin/credentials/` — Credential resets (NEW)
- `/portal/admin/lead-distro/` — Lead distribution settings
- `/command-center/settings/` — Command center settings
- Various other admin pages

**What you want:** ONE Admin Panel with:
- User management (create, edit, deactivate)
- Role definitions + assignment
- Permission checkboxes (expanded, granular)
- Manual overrides for most systems
- ALL settings
- Status change permissions
- Credential management

**What needs to happen:**
- [ ] Design unified Admin Panel layout (sidebar nav with sections)
- [ ] Migrate all admin/settings pages under one roof
- [ ] Build expanded permission editor UI
- [ ] Build status change permission matrix (which roles can change which JN statuses)

---

### 9. VIEW-AS FEATURE (0%)

**What you want:** Dropdown on Michael's profile to "View RoofStack as [any user]"
- See exactly what they see
- Faint bypass button on password-change screens
- Make sure passwords actually save (don't make users redo it)

**What needs to happen:**
- [ ] Add "View As" dropdown to owner/admin profile pages
- [ ] Implement session impersonation (swap role + permissions temporarily)
- [ ] Add visible indicator "Viewing as: Tia Muse Morris" banner
- [ ] Add "Exit View-As" button to return to own session
- [ ] Faint bypass on password-change screen during impersonation

---

### 10. EXPANDED ROLE PERMISSIONS (30%)

**Current state:** 20 permissions hardcoded in `lib/team-roles.ts`, per-user arrays

**What you want:**
- Checkbox-based permissions per user per feature
- Status change permissions (per JN status, per role)
- Data visibility controls (lead response time = private, closing % = shared)
- Stored in Google Sheet, editable from Admin Panel UI

**What needs to happen:**
- [ ] Create "Permissions" Google Sheet tab with one row per user, columns per permission
- [ ] Build Admin Panel UI with checkboxes for each user × each permission
- [ ] Add new permissions: view_individual_transactions, view_lead_response_time, view_job_costs, etc.
- [ ] Wire permission checks into each leaderboard/report component
- [ ] Add status change permission matrix

---

### 11. DATA CONSOLIDATION & BACKUP (40%)

**Current state:**
- 33 Google Sheet tabs configured (auto-create pattern)
- 52 data JSON files (17 are EMPTY stubs)
- Meeting data: current through 3/30/2026
- Commission data: 33K records (needs verification)
- JobNimbus: API connected, can pull live

**What needs to happen:**
- [ ] Audit master Google Sheet — verify all 33 tabs exist and have data
- [ ] Import any missing historical meeting sheets (2019-2025)
- [ ] Sync commissions from JobNimbus to sheet + JSON
- [ ] Create custom evaluation sheets ($$$$$ per inspection, closing %, etc.)
- [ ] Set up hourly backup (Google Apps Script to duplicate sheet, or export to JSON)
- [ ] Verify all empty JSON files — which features actually need data?
- [ ] Import JobNimbus customer data to local Customers sheet

**Needs from Michael:**
- [ ] Which Google Sheets have you already shared with the service account as editor?
- [ ] Are the historical Monday meeting sheets (2019-2025) on the same Sheet ID or separate files?
- [ ] Do you want backups stored as: Google Sheet copies? JSON exports? Both?

---

### 12. DETAILED LOGGING (20%)

**Current state:** Basic AuditLog tab in Google Sheets (action, email, timestamp)

**What you want:**
- AI-generated description of each interaction
- Visible ONLY to Michael + Chris (not Sara, not anyone else)
- Username, time, what was accomplished, specific details

**What needs to happen:**
- [ ] Expand AuditLog schema: add AI description field, detailed changes field
- [ ] Add middleware to log every significant portal action
- [ ] Restrict log viewing to owner role only
- [ ] Build log viewer page (searchable, filterable, within Admin Panel)

---

### 13. SALES REP INTERFACE (50%)

**What exists:**
- Sales dashboard with stats
- Weekly numbers widget
- Commission tracking via JN
- Leaderboard component

**What you want:**
- Motivating, encouraging, informative
- Historical comparisons ("reps in similar situations improved by doing X")
- Accurate past data, projections, estimates
- Positive tone while honest
- Clear labeling of all numbers

**What needs to happen:**
- [ ] Add trend comparisons from historical data
- [ ] Add motivational messaging based on performance trajectory
- [ ] Add average reference lines to all charts
- [ ] Ensure accuracy of all displayed numbers (verify against source)
- [ ] Add privacy controls (individual transactions hidden from other reps)

---

### 14. TRAINING (85% — Minor Fix)

**What exists:** 7 training paths, 45 role-based modules, role filtering working

**What's wrong:**
- Training page may show before dashboard on some flows

**What needs to happen:**
- [ ] Verify login → dashboard (not training) for returning users
- [ ] Verify only applicable modules show per role

---

### 15. JOBNIMBUS AUTO-SYNC (70%)

**What exists:** 18 JN API endpoints, all configured and working

**What's broken:** No automatic sync — data pulled on-demand only

**What needs to happen:**
- [ ] Set up cron/scheduled sync: JN → commissions.json (every hour)
- [ ] Set up webhook listener for JN status changes (job approved, deposit received)
- [ ] Sync JN contacts → Customers sheet automatically
- [ ] Wire status change notifications based on role permissions

---

## Questions for Michael

*(Respond inline — type your answer after each question)*

**Q1: Commission data** — The `commissions.json` has 33K records back to 2018. When was it last synced from JobNimbus? Is this the latest data?

**Your answer:** _______________

**Q2: Historical meeting sheets** — You said 40-50 tabs per year back to 2019. Are these all on the same Google Sheet (`1tEbMVUrvrRIkptISumvIrcgUhSWN5X2ldYro9ADTXF0`), or are they separate spreadsheet files?

**Your answer:** _______________

**Q3: Dept head notes** — Who should have the "Monday meeting notes" box on their dashboard? Just Sara/Destin/Tia? Or all managers and above?

**Your answer:** _______________

**Q4: Backup strategy** — You want hourly backups. Preferred method: (A) Google Apps Script that copies the sheet hourly, (B) JSON export to a backup folder, (C) Both?

**Your answer:** _______________

**Q5: View-As** — When you "View as Greg," should it be full impersonation (you see everything exactly as Greg) or a preview mode (side-by-side comparison)?

**Your answer:** _______________

**Q6: Which section do you want to complete to 100% first?** Pick ONE and we'll nail it before moving on.

- [ ] A. Login & Auth (test + fix everything)
- [ ] B. Leaderboards (all 3 types, labeled, accurate, auto-updating)
- [ ] C. Monday Meeting System (notes + presentation + approval)
- [ ] D. Dashboard Simplification + Admin Panel
- [ ] E. Data Consolidation + Backup
- [ ] F. Other: _______________

**Your answer:** _______________

---

## What I Need From You

1. **Dev server test session** — Let me start `npm run dev` and we walk through the login flow together, fixing issues in real-time
2. **Google Sheet access confirmation** — Verify the service account can write to all needed tabs
3. **Answers to Q1-Q6 above**
4. **Your patience** — I'm going to do it right this time, not fast

---

## Suggested Build Order (After You Pick Section)

```
Phase 1: Stabilize (whatever section you pick → test → fix → deploy)
Phase 2: Data (consolidate, backup, verify accuracy)
Phase 3: Leaderboards (all 3, labeled, accurate, auto-refresh)
Phase 4: Admin Panel (consolidate settings, permissions UI)
Phase 5: Dashboard Simplification (per-role cleanup)
Phase 6: Monday Meeting (notes, scheduling, approval, presentation)
Phase 7: View-As + Logging
Phase 8: Polish (motivation messaging, historical comparisons, edge cases)
```

Each phase: build → test with real data → fix → test again → deploy → leave it alone → move on.
