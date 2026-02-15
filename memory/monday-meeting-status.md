# Monday Meeting Data Status — 2026-02-14

## Presentation System
✅ `app/command-center/meetings/present/page.tsx` — Fully built, 9 rotating views:
- Early Announcements, Podium, Leaderboard, Competition, Weekly Numbers, Stats, Goals, Milestones, Late Announcements
- Auto-rotates every 15s, fullscreen mode, period toggle (Weekly/Monthly/YTD)
- Refreshes data every 60 seconds

## Data Sources

### Commissions Data (`data/commissions.json`)
⚠️ **STALE** — Last entry is **12/16/2024** (2 months old)
- 25,196 lines, 6 reps total
- Reps in data: Aaron Lussi, Adam Rudell, Brendon Muse, Gregory Ray Muse, Hunter Rivers, Richard Geahr

### ❌ CRITICAL: Michael, Sara, and Chris are NOT in commissions data
- No records whatsoever for these three
- They will show nothing on the leaderboard
- **ACTION NEEDED**: Add their commission records to `data/commissions.json` or update the Google Sheets source

### API Routes
✅ `/api/command-center/meetings/leaderboard` — Works, reads from `data/commissions.json`
✅ `/api/command-center/meetings/stats` — Works, reads from `data/commissions.json`
⚠️ `/api/portal/monday-notes` — **In-memory storage only** (resets on server restart, no persistence)
✅ `/api/portal/monday-notes/announcements` — Functional but also in-memory
✅ `/api/portal/weekly-numbers` — Used for weekly sales numbers view

### Monday Notes System
⚠️ Notes are stored in-memory (`let mondayNotes: MondayNote[] = []`)
- Data is lost on every server restart/deploy
- No database or file persistence
- **ACTION NEEDED**: Add persistent storage (database, file system, or Google Sheets)

## Summary of Gaps
1. **Commissions data is 2 months stale** — needs fresh data through Feb 2025+
2. **Michael, Sara, Chris have zero records** — won't appear on leaderboard at all
3. **Monday notes have no persistence** — reset on restart
4. **Weekly numbers** — depends on reps submitting via portal

## Recommendations
- Update `data/commissions.json` with current data (export from Google Sheets?)
- Ensure Michael, Sara, Chris are added with their actual commission records
- Consider migrating Monday notes to Google Sheets or a database for persistence
