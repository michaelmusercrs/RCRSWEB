# RCRS Role / Permission Audit

**Audit date:** 2026-05-20
**Repo root:** `C:\Users\Michael\river-city-roofing\`
**Scope:** read-only inspection of `lib/permissions.ts`, `lib/team-roles.ts`, `lib/auth-service.ts`, `lib/portal-auth.ts`, `lib/auth-context.tsx`, `lib/cost-visibility.ts`, `middleware.ts`, and the full `app/api/admin/**`, `app/api/portal/**`, `app/api/customer/**`, `app/(tools)/admin/**`, and `app/(tools)/portal/**` trees.

---

## Summary

- The codebase has **three parallel role systems** that don't agree with each other: the 8-role `TeamRole` set in `lib/team-roles.ts:19` (canonical), the 6-role `Role` set in `lib/permissions.ts` / `types/roles.ts:25`, and the 5-role `UserRole` in `lib/portal-auth.ts:16`. The second and third are legacy but still imported.
- Login flow per owner memory (email/pw -> mustChangePassword -> welcome/onboarding -> dashboard, with role picker for Rick, audit-logged) **matches the code** end-to-end.
- **Two `/api/portal/*` endpoints have no auth at all** (`meeting-data`, `monday-notes/announcements`); the first leaks the sales leaderboard and revenue totals to anyone who can reach the URL.
- **Cost-visibility rules drift from the owner's rule** in three places. The codebase grants cost visibility to `project_manager` (Bart, John) in two Command Center inventory pages; meanwhile **Office (Tia) cannot see cost on those same pages** even though the owner explicitly listed her. `cost-visibility.ts` itself includes `project_manager`/`pm` in `COST_VISIBLE_ROLES`, contradicting the rule.
- `/chrisview` and `/api/chrisview` are intentionally public per owner choice but expose unit cost, supplier cost, stock value, margin%, and full commission tables to anyone with the URL — flagged here for the record, not as a bug.
- The `Role` set in `lib/permissions.ts` does not include `Project Manager` or `Viewer`, so anyone with `TeamRole = 'project_manager'` or `'viewer'` fails `isValidRole()` and gets `false` from `hasPermission()` / `canAccess()`. That partly explains the inventory pages bypassing `canViewCosts` with hardcoded role string checks.
- All 35 routes under `app/api/admin/**` enforce auth; **two enforce only `requireAuth` (any logged-in user), not `requireAdmin`** — `app/api/admin/response-times/route.ts:15` (filters by rep server-side, intentional) and `app/api/admin/lead-distro/history/route.ts:9` (no filter, returns full distribution log to any authenticated user).
- The `middleware.ts` page-level role gate has a sane prefix table but does **not** verify the JWT signature (`middleware.ts:14`) — that's documented as a UX-only gate and OK since APIs re-check, but it means a tampered token can render pages with broken data.

---

## Roles defined in the codebase

| Role token | Defined in | Display | Notes |
| --- | --- | --- | --- |
| `owner` / `Owner` | `lib/team-roles.ts:19`, `types/roles.ts:25` | Owner | Michael, Chris. Full access. |
| `admin` / `Admin` | `lib/team-roles.ts:19`, `types/roles.ts:25` | Administrator | Sara. Full except inventory.delete, settings. |
| `manager` / `Manager` | `lib/team-roles.ts:19`, `types/roles.ts:25` | Manager | Destin. |
| `office` / `Office` | `lib/team-roles.ts:19`, `types/roles.ts:25` | Office Staff | Tia. |
| `project_manager` | `lib/team-roles.ts:19` only | Project Manager | Bart, John. **Missing from `types/roles.ts`** → all `hasPermission()` calls return false for this role. |
| `sales` / `Sales` | `lib/team-roles.ts:19`, `types/roles.ts:25` | Sales Rep | Hunter, Aaron, Greg, Brendon, Adam, Joseph, Alijah, Travis. |
| `driver` / `Driver` | `lib/team-roles.ts:19`, `types/roles.ts:25` | Driver | Rick (dual sales+driver), Tae (inactive). |
| `viewer` | `lib/team-roles.ts:19` only | Viewer | Boston (marketing). **Missing from `types/roles.ts`**. |
| `customer` | implicit, no enum entry | Customer | Token-gated via `leadPortalService.getLeadByToken()`. |
| `pm` | only referenced in `middleware.ts:38` and `cost-visibility.ts:39` | — | Alias for project_manager; no team member uses this string. |

Hierarchy weights in `lib/team-roles.ts:684` (owner 100 -> viewer 10) vs `types/roles.ts:36` (Owner 6 -> Driver 1) — different scales but ordering is consistent.

---

## Protected routes -> required role

Page-level (rendered HTML) gating is enforced by `middleware.ts` longest-prefix match plus the in-component `useAuth()` `canAccessRoute()` check.

### Pages (middleware + auth-context)

| Route prefix | Min role (middleware) | Role-route allowlist (auth-context.tsx) | Source |
| --- | --- | --- | --- |
| `/` (public) | none | n/a (rcrsal.com rewrites to `/portal`) | `middleware.ts:334` |
| `/portal` (login) | none | always | `middleware.ts:334` |
| `/portal/welcome`, `/portal/change-password` | authenticated | all roles | `middleware.ts:402` |
| `/portal/dashboard` | authenticated (no min) | all except sales/driver land elsewhere | `lib/auth-context.tsx:48-101` |
| `/portal/admin/**` | Admin | owner, admin | `middleware.ts:45`, `auth-context.tsx:48` |
| `/portal/admin/credentials` | Admin (via prefix) | owner, admin, manager, office | `auth-context.tsx:59,76` |
| `/portal/admin/lead-distro` | Admin | owner, admin, manager | `auth-context.tsx:56` |
| `/portal/billing` | Office | owner, admin, manager, office, project_manager | `middleware.ts:46`, `auth-context.tsx` |
| `/portal/office` | Office | owner, admin, manager, office | `middleware.ts:47` |
| `/portal/manager` | Manager | owner, admin, manager | `middleware.ts:51` |
| `/portal/inventory` | Driver (intentional, Rick needs it) | owner, admin, manager, office, sales, driver, pm | `middleware.ts:54` |
| `/portal/pm` | none in middleware | owner, admin, project_manager | `auth-context.tsx:80` |
| `/portal/sales/**` | none in middleware | owner, admin, sales, project_manager, driver, manager | `auth-context.tsx:62-95` |
| `/portal/driver` | none in middleware | owner, admin, driver | `auth-context.tsx:89` |
| `/command-center/admin` | Admin | only `*`-allowed roles | `middleware.ts:48` |
| `/command-center/settings` | Admin | `*`-allowed | `middleware.ts:49` |
| `/command-center/**` (default) | authenticated | owner, admin, manager, office | `lib/permissions.ts:455-462` |
| `/admin/**` (legacy) | admin-password gate | n/a (shared password) | `app/(tools)/admin/layout.tsx:30` |
| `/chrisview`, `/api/chrisview` | **public** | n/a | `middleware.ts:376` |
| `/trip`, `/api/trip/*` | **public** | n/a | `middleware.ts:368` |
| `/my/[token]`, `/view/[token]` | customer token | token-resolves-to-lead | `middleware.ts:225-227`, `lib/lead-portal-service.ts` |
| Public domain (`rivercityroofingsolutions.com`) | n/a | only `PUBLIC_ROUTES` set + `/portal` login | `middleware.ts:120-156, 392-421` |

### API routes -> auth check

All 35 routes under `app/api/admin/**` import an auth helper. Spot-checked enforcement:

| Route | Method | Required role | Source |
| --- | --- | --- | --- |
| `/api/admin/*` (33 of 35) | any | admin or owner | `requireAdmin()` in `lib/auth-service.ts:428` |
| `/api/admin/response-times` | GET | any authenticated; admin sees all reps, others see only own | `app/api/admin/response-times/route.ts:15-31` |
| `/api/admin/lead-distro/history` | GET | any authenticated (no role check) | `app/api/admin/lead-distro/history/route.ts:9` |
| `/api/admin/auth` | POST | shared-password login | `app/api/admin/auth/route.ts:35-43` (separate from per-user auth) |
| `/api/auth/login` | POST | none (login endpoint) | `app/api/auth/login/route.ts:22` |
| `/api/auth/pin` | POST | deprecated, returns 410 | `app/api/auth/pin/route.ts:10` |
| `/api/portal/*` (110 of 112) | any | authenticated user | `requireAuth()` or `portalAuthService` |
| `/api/portal/meeting-data` | GET | **none** | `app/api/portal/meeting-data/route.ts:44` |
| `/api/portal/monday-notes/announcements` | GET | **none** | `app/api/portal/monday-notes/announcements/route.ts` |
| `/api/customer/[token]/**` | any | customer token resolves to lead | `lib/lead-portal-service.ts.getLeadByToken()` |
| `/api/customer/portal-analytics` | GET | admin or owner | `app/api/customer/portal-analytics/route.ts:24` |
| `/api/chrisview` | GET | **none** (intentional) | `app/api/chrisview/route.ts:11` |

---

## Findings

### CRITICAL

1. **`/api/portal/meeting-data` leaks sales leaderboard + revenue totals with no auth** — `app/api/portal/meeting-data/route.ts:44`. The handler reads `commissions.json` and `getRepWeeklyNumbers()` and returns a payload containing top-10 rep totals, total real revenue, total estimated revenue, and per-rep numbers. There is no `requireAuth()` call. Anyone who can hit the URL on either domain gets the full leaderboard. Per owner memory (`project_rcrs_leaderboards`), this is "internal-only" data.

2. **`/api/admin/lead-distro/history` returns full distribution log to any authenticated user** — `app/api/admin/lead-distro/history/route.ts:9` uses `requireAuth()` not `requireAdmin()`. A sales rep (or any logged-in user) can read every lead assignment, including assignments to other reps. Conflicts with the sibling `/api/admin/lead-distro/config` and `/api/admin/lead-distro/settings` which both correctly use `requireAdmin()`.

### HIGH

3. **Cost visibility allowlist disagrees with owner rule in three layers**:
   - `lib/cost-visibility.ts:33-40` puts `project_manager` + `pm` in `COST_VISIBLE_ROLES`. Owner's rule (`feedback_purchase_price_visibility.md`): only owner, admin, office, manager, Richard. PMs (Bart, John) should not see cost.
   - `app/(tools)/command-center/inventory/page.tsx:128` and `app/(tools)/command-center/inventory/[sku]/page.tsx:384` hardcode `showCost = canViewCosts || userRole === 'owner' || userRole === 'admin' || userRole === 'project_manager'`. Same drift — PM yes, but **`office` and `manager` are absent** from the OR, so they rely on `canViewCosts` (the `inventory.viewCosts` permission). Office does NOT have that permission (`lib/permissions.ts:156-175`), so Tia is silently blocked from cost on these pages — contradicting the rule.
   - `app/(tools)/portal/pm/page.tsx:558` (`canSeeCost = role === 'admin' || 'owner' || 'office'`) is the most correct of the three but still omits `manager` and Richard.

4. **`project_manager` and `viewer` roles fail `isValidRole()` and produce silent `false` from `hasPermission()`/`canAccess()`** — `types/roles.ts:25` only lists `Owner|Admin|Manager|Sales|Driver|Office`. Bart, John (project_manager) and Boston (viewer) have JWT role strings that match neither casing in the validator, so `lib/permissions.ts:241` warns and returns false. Their access today only works because most call sites bypass the permission system with role-string checks (e.g. the PM page) or because middleware uses its own `ROLE_RANK` table. Any new code that uses `hasPermission()` will lock these users out.

5. **`/chrisview` exposes cost, margin, supplier cost, full commission history publicly** — `app/chrisview/page.tsx` and `app/api/chrisview/route.ts` are intentionally public per owner choice (`middleware.ts:376`). The page renders columns "Cost", "Stock Value (cost)", "margin%" (`app/chrisview/page.tsx:1149,1174,314`). Recorded as intentional but flagged so it's not surprising in a future audit — competitors finding this URL see purchase-price truth and full rep commission breakdown.

### MEDIUM

6. **`/api/portal/monday-notes/announcements` has no auth check** — `app/api/portal/monday-notes/announcements/route.ts`. Lower impact (announcement text is not material cost) but still on the portal namespace, where the convention is `requireAuth()`. Anyone can read pending and approved Monday-meeting announcements.

7. **`middleware.ts:80-88` reads role from JWT payload without verifying the signature** — explicitly documented as UX-only at `middleware.ts:5-15`. A forged cookie can pass middleware and render the page shell; API requests will still be rejected by `requireAuth()`. This is OK in isolation but means the page-load role gate is advisory, not security.

8. **Three role-routing tables can drift independently** — `lib/permissions.ts:318` `ROUTE_PERMISSIONS`, `lib/team-roles.ts:409` `ROLE_PORTAL_ACCESS`, and `lib/auth-context.tsx:48` `ROLE_ROUTES` all list portal paths. Today they roughly agree, but adding a new route requires touching all three. E.g. `/portal/customers` is allowed by `team-roles.ts` for owner/admin only but `auth-context.tsx:55,81` lets manager and PM through.

9. **Dev auth bypass triple-gate works but is easy to misread** — `lib/auth-service.ts:393-407` and `lib/auth-context.tsx:189-209`. The flags `DEV_AUTH_BYPASS=1` (server) and `NEXT_PUBLIC_DEV_AUTH_BYPASS=1` (client) must both be set, and Vercel must be absent. If either flag is set in prod by accident, only the lack of `VERCEL` env var protects against an admin-impersonation backdoor. Worth a CI guard.

### LOW

10. **`/api/admin/auth` shared password coexists with per-user `/api/portal/auth`** — the legacy `app/(tools)/admin/**` pages share one `ADMIN_PASSWORD` env. The portal at `app/(tools)/portal/**` uses per-user creds. There is no audit-log linkage between them, so a legacy-admin login does not appear in the AuditLog Google Sheet.

11. **`canAccessRoute()` in `auth-context.tsx:549` uses `startsWith`, so `/portal/admin-foo` would match an entry for `/portal/admin`** — no current route collides, but it's a footgun for future naming.

12. **`PortalAuthService` (`lib/portal-auth.ts`) defines its own `UserRole` and `ROLE_PERMISSIONS` table** that is never reconciled with `team-roles.ts`. The workflow approval routing at `lib/portal-auth.ts:617-620` assigns `'manager'` or `'owner'` as approver roles — those strings match team-roles.ts, but `'project_manager'`, `'sales'`, `'office'` are silently ignored here.

13. **All rep entries in `team-roles.ts:85-405` ship with `password: 'ChangeMe123!'` and `mustChangePassword: false`** — most have `mustChangePassword: false`, so the change-password gate never fires on first login. The flow per owner memory (`project_rcrs_login_flow`) expects email/pw -> mustChangePassword -> onboarding. In practice, mustChangePassword is `false` for every active member, so only the welcome/onboarding step runs.

---

## Login flow verification

Owner memory: **email/pw -> mustChangePassword -> onboarding -> dashboard; multi-role users get a role picker; all events logged to AuditLog.**

Walkthrough of `app/(tools)/portal/page.tsx`:

- `handleEmailContinue()` (line 470) calls `/api/portal/auth` action `get-login-method` to pick password vs PIN vs picture. **OK.**
- `handlePasswordLogin()` (line 497) calls `login()` from `auth-context.tsx:329`, which in turn calls `/api/portal/auth` action `login-password`. On success, posts an `AUDIT LOGIN` to `/api/portal/audit-log` (line 517) and the server-side `/api/auth/login` route ALSO writes a Sheets AuditLog row at `app/api/auth/login/route.ts:94` and emails Michael. **OK** — AuditLog dual-written. Note: the password login flow currently routes through `/api/portal/auth` (Sheets-backed creds via `credentialService`), not through `/api/auth/login` (TEAM_MEMBERS array) — the two are parallel paths. Both log.
- `if (result.mustChangePassword) router.push('/portal/change-password')` (line 529). **OK** — per memory.
- `handlePostLogin()` (line 580) reads `localStorage.onboarding_complete_<id>` and pushes to `/portal/welcome` if missing. **OK** — onboarding step exists.
- Dual-role check (line 590) — hard-coded only for `richard@rcrsal.com`. **OK for Rick** but the `team-roles.ts:209-226` already encodes `roles: ['driver','sales']` — the picker should be data-driven off that field instead of a literal email check. Minor.
- Final redirect: `router.push(ROLE_DEFAULT_ROUTES[member.role])` at line 605. Driver -> `/portal/driver`, PM -> `/portal/pm`, everyone else -> `/portal/dashboard`. **OK.**

Drift to note:
- The middleware uses its own `PROTECTED_PAGE_RULES` table (`middleware.ts:43`) that does not include `/portal/welcome` or `/portal/change-password`, but both are explicitly let through on the public-domain branch (`middleware.ts:402`). On the portal domain (`rcrsal.com`), they go through `isPortalRoute` and pass without min-role. Consistent.
- `mustChangePassword: false` on every active TEAM_MEMBERS entry means the gate never fires for current users (Finding 13).

---

## Open questions for owner — `[needs-owner]`

1. **PM (Bart, John) cost visibility** — `lib/cost-visibility.ts:33-40` grants them cost access. Your rule says owner/admin/office/manager/Richard only. Should PMs see cost (they coordinate material orders and might need it) or strip them?
2. **Office (Tia) cost on Command Center inventory pages** — `lib/permissions.ts:156-175` does NOT give Office the `inventory.viewCosts` permission, and the Command Center inventory pages don't hardcode `office` in the cost gate. Tia can't see cost on `/command-center/inventory`. Intentional, or should `inventory.viewCosts` be added to Office?
3. **Rick (driver) cost** — owner rule lists Richard explicitly. `lib/cost-visibility.ts:64` returns `false` for `driver`. `canSeeCostOnInventoryEntry()` returns true. Is "Rick sees cost only when receiving stock" still the rule, or has it expanded?
4. **`/chrisview` public exposure of cost/commissions** — confirmed intentional in `middleware.ts:376` comment. Should it stay public, or move to a long random URL / IP allowlist?
5. **`/api/portal/meeting-data` no auth** — Finding 1. Was this intentionally public for the Monday-presentation kiosk, or an oversight? If kiosk-only, suggest a single-token gate.
6. **`/api/admin/lead-distro/history`** — Finding 2. Should this be admin-only, or do you want managers/office to see distribution history?
7. **mustChangePassword always false** — every active TEAM_MEMBERS entry has `mustChangePassword: false`. Should new hires be added with `true`, or is this gated by the Sheets-backed `credentialService` now (in which case the in-memory flag is dead code)?
8. **`viewer` role for Boston** — `team-roles.ts:348` puts Boston in `viewer` to exclude from sales leaderboards. But `viewer` has access to `/portal/office` and `/portal/reports` (`team-roles.ts:417`). Is that intended?
