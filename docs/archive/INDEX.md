# Archive Index

Files moved here from the repo root on 2026-05-20 per `docs/dead-code-triage.md`. All moves are reversible via `git mv`; nothing has been deleted.

| Original path | Moved to | Triage tag | Reason from triage |
|---|---|---|---|
| `MASTER_STRATEGY.md` | `docs/archive/MASTER_STRATEGY.md` | ARCHIVE | "Market Domination" roadmap — read-once strategic doc, no day-to-day use. |
| `PROJECT-OVERVIEW.md` | `docs/archive/PROJECT-OVERVIEW.md` | ARCHIVE | "Priority 1 Complete: Header/Navigation" — early-build status snapshot. |
| `RCRS-SITE-INDEX.md` | `docs/archive/RCRS-SITE-INDEX.md` | ARCHIVE | Build estimate doc; estimate already executed. |
| `RCRS-ROLLOUT-PLAN.md` | `docs/archive/RCRS-ROLLOUT-PLAN.md` | ARCHIVE | Rollout plan; mostly executed. |
| `RCRS-HONEST-AUDIT.md` | `docs/archive/RCRS-HONEST-AUDIT.md` | ARCHIVE | Feb 8, 2026 audit — superseded by April security audits. |
| `ROOFSTACK-MASTER-STATUS.md` | `docs/archive/ROOFSTACK-MASTER-STATUS.md` | ARCHIVE | Apr 1, 2026 status snapshot. |
| `BNI-PRESENTATION-GUIDE.md` | `docs/archive/BNI-PRESENTATION-GUIDE.md` | ARCHIVE | One-off event guide. |
| `BOSTON-PIXEL-SETUP-GUIDE.md` | `docs/archive/BOSTON-PIXEL-SETUP-GUIDE.md` | ARCHIVE | March 2026 one-off Pixel setup. |
| `PUNCHOUT-LIST.md` | `docs/archive/PUNCHOUT-LIST.md` | ARCHIVE | Pre-launch checklist; launched. |
| `OVERNIGHT-BUILD-SUMMARY.md` | `docs/archive/OVERNIGHT-BUILD-SUMMARY.md` | ARCHIVE | March 16-17 session log. |
| `OPTIMIZATION_COMPLETE.md` | `docs/archive/OPTIMIZATION_COMPLETE.md` | ARCHIVE | One-shot "OPTIMIZATION COMPLETE!" — historical. |
| `UI_UX_UPGRADE_COMPLETE.md` | `docs/archive/UI_UX_UPGRADE_COMPLETE.md` | ARCHIVE | One-shot completion doc. |
| `IMAGE-CHECKLIST.md` | `docs/archive/IMAGE-CHECKLIST.md` | ARCHIVE | List of images to upload — likely done. |
| `IMAGE-SETUP-GUIDE.md` | `docs/archive/IMAGE-SETUP-GUIDE.md` | ARCHIVE | Image setup walkthrough. |
| `STEP-BY-STEP-GUIDE.md` | `docs/archive/STEP-BY-STEP-GUIDE.md` | ARCHIVE | Color-system implementation walkthrough. |
| `FILE-STRUCTURE-GUIDE.md` | `docs/archive/FILE-STRUCTURE-GUIDE.md` | ARCHIVE | Early file-layout doc; codebase has evolved. |
| `COMMAND-LINE-SETUP.txt` | `docs/archive/COMMAND-LINE-SETUP.txt` | ARCHIVE | One-time CLI bootstrap notes. |
| `SECURITY-AUDIT-REPORT.md` | `docs/archive/SECURITY-AUDIT-REPORT.md` | ARCHIVE | Superseded by `SECURITY_AUDIT_2026_04_14.md`. |
| `SECURITY_FIX_SUMMARY.txt` | `docs/archive/SECURITY_FIX_SUMMARY.txt` | ARCHIVE | Historical. |
| `INTEGRATION-TEST-REPORT.md` | `docs/archive/INTEGRATION-TEST-REPORT.md` | ARCHIVE | Historical test report. |
| `E2E-TEST-REPORT-2026-04-03.md` | `docs/archive/E2E-TEST-REPORT-2026-04-03.md` | ARCHIVE | Dated test report. |
| `REVIEW_AND_TEST.md` | `docs/archive/REVIEW_AND_TEST.md` | ARCHIVE | Old implementation review. |
| `MORNING-QUESTIONS.md` | `docs/archive/MORNING-QUESTIONS.md` | DELETE | "Morning Status - March 17, 2026 (Meeting Day)" — single-day status. |
| `FINAL-SUMMARY.md` | `docs/archive/FINAL-SUMMARY.md` | DELETE | Generic "color system + location pages" wrap-up. |
| `OLD-TO-NEW-CHANGES.md` | `docs/archive/OLD-TO-NEW-CHANGES.md` | DELETE | Color-system migration notes; migration done. |
| `HEADER-PREVIEW.md` | `docs/archive/HEADER-PREVIEW.md` | DELETE | Visual preview of an old header. |
| `QUICK-IMAGE-FIX.md` | `docs/archive/QUICK-IMAGE-FIX.md` | DELETE | "GET YOUR IMAGES WORKING NOW!" — emergency fix doc. |
| `SETUP-FIX.md` | `docs/archive/SETUP-FIX.md` | DELETE | "SETUP FIX - Directory Structure Issue" — historical fix. |
| `IMPLEMENTATION-SUMMARY.txt` | `docs/archive/IMPLEMENTATION-SUMMARY.txt` | DELETE | Decorative banner-art "implementation guide" for the color system. |
| `install-dependencies.md` | `docs/archive/install-dependencies.md` | DELETE | "ADD THESE DEPENDENCIES TO YOUR PROJECT" — superseded by `package.json`. |
| `cookies.txt` | `docs/archive/cookies.txt` | DELETE | Stray `curl` cookie jar. |
| `curl-debug.txt` | `docs/archive/curl-debug.txt` | DELETE | UTF-16-encoded curl stderr capture. Garbage. |

## Items intentionally NOT moved

- `SECURITY_PATCH_users-api.diff` — triage tagged DELETE but conditioned on "after confirming applied". Ambiguous; left for owner sign-off.
- All `KEEP` items.
- All code files (`.ts`, `.tsx`, `.js`, `.jsx`).
- All `[needs-owner]` items: orphan API routes, orphan components, ts-prune unused-export candidates, `scripts/` retirement candidates, duplicate-page-route consolidations.
