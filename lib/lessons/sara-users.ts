/**
 * Sara's User & Team Management lesson — written 2026-08-18 against current
 * production behavior in lib/team-roles.ts, app/(tools)/portal/admin/users,
 * app/(tools)/portal/admin/credentials, app/(tools)/portal/admin/profile-approvals,
 * lib/profile-approval-service.ts, and lib/cost-visibility.ts.
 */
import type { Lesson } from './types';

export const saraUsersLesson: Lesson = {
  slug: 'sara-users',
  moduleId: 'lesson-sara-users-2026',
  title: 'User & Team Management — Roles, Access & Approvals',
  description:
    'How accounts, roles, permissions, and profile changes actually work: where you manage them, who can see what, and the approval queue that runs through you.',
  audience: 'Sara / Admin & Office',
  estimatedMinutes: 20,
  sections: [
    {
      title: 'Roles Are Just a Starting Point — Permissions Are What Actually Matters',
      blocks: [
        { type: 'p', text: 'Every person in the system has a **role** — owner, admin, manager, sales, office, project_manager, driver, or viewer. But the role name isn\'t what controls access. Each person also carries their own **permissions array**, a list of specific strings like `billing`, `inventory.manage`, or `team`. The role is a label; the permissions array is the lock.' },
        { type: 'p', text: 'You (Sara) are role **admin**, and your permissions array is: dashboard, sales, sales.leads, sales.customers, inventory, inventory.manage, delivery, delivery.driver, billing, billing.invoices, reports, schedule, **team**, customers.portal, command-center, monday-notes, training, blog. That last list is what actually grants you the User Management screen — the `team` permission.' },
        {
          type: 'bullets',
          items: [
            'Owners (Michael, Chris) have the wildcard `*` — every permission, always.',
            'A parent permission grants its children automatically: having `sales` also grants `sales.leads` and `sales.customers` without listing them separately.',
            'Some people carry more than one role — Richard "Rick" Geahr is driver + sales; Travis Wages is set up as sales with a driver flag. Multi-role people get a **role picker** at login (see below).',
          ],
        },
        { type: 'callout', tone: 'info', text: 'This is not the same system as the public "Team" page at /portal/admin/team. That screen edits the public-facing bios, photos, and social links shown on the website team directory (via the CMS team-members sheet) — it has nothing to do with login roles or permissions. Don\'t confuse the two.' },
      ],
      keyPoints: [
        'Role = label. Permissions array = actual access control.',
        'Parent permissions grant their sub-permissions automatically.',
        '/portal/admin/team is the public bio/photo page, not account management.',
      ],
    },
    {
      title: 'Where You Actually Manage Roles & Permissions',
      blocks: [
        { type: 'p', text: '**/portal/admin/users** is the real account-management screen, gated to owner and admin only (you\'ll get an Access Denied screen on anything less). Every person shows as a row you can expand:' },
        {
          type: 'steps',
          items: [
            'Search by name, email, or phone; filter by role or active/inactive status',
            'Click a row to expand it and see full controls for that person',
            'Toggle **Active / Inactive** — deactivating asks for confirmation and blocks that person from logging in (they can be reactivated any time)',
            'Under **Role Assignment**, check one or more role buttons — the page explicitly supports multi-role people the same way Rick is set up',
            'Use a **Quick Permission Template** button to instantly apply that role\'s standard permission set, overwriting whatever was there',
            'Or hand-edit **Granular Permissions** — checkboxes are grouped (Dashboard, Sales, Inventory, Delivery, Leads, Billing, Reports, Schedule, Team, Customers, Tickets, Monday, Training, Blog, Settings); a group checkbox checks/unchecks every permission in that group, and you can drill into individual permissions inside a group',
            'If someone already has the wildcard (`*`), the page tells you and offers a "Switch to granular" link before letting you fine-tune',
            'Changes are staged locally (marked with an amber "unsaved" dot) — click **Save Changes** to commit, or **Discard Changes** to revert to what was on file',
          ],
        },
        { type: 'callout', tone: 'tip', text: 'The stats bar at the top of the page gives you a running count: total users, active, inactive, and how many are multi-role — a fast way to eyeball drift (e.g. someone still marked active who shouldn\'t be).' },
      ],
      keyPoints: [
        '/portal/admin/users = the real roles/permissions screen (owner + admin only)',
        'Supports multi-role assignment, quick templates, and granular per-permission control',
        'Active/inactive toggle blocks or restores login without deleting the account',
      ],
      quiz: [
        {
          question: 'Where do you actually go to change someone\'s role or permissions?',
          options: [
            '/portal/admin/team',
            '/portal/admin/users',
            '/portal/admin/blog',
            '/portal/training',
          ],
          correct: 1,
          explanation: '/portal/admin/team is the public bio/photo CMS page. /portal/admin/users is the real account, role, and permission management screen — and it requires owner or admin access.',
        },
      ],
    },
    {
      title: 'Passwords & Login Methods — Credential Resets',
      blocks: [
        { type: 'p', text: '**/portal/admin/credentials** is a separate page for resetting how someone logs in. It\'s gated by a hierarchy, not a flat admin check:' },
        {
          type: 'table',
          headers: ['This role...', 'Can reset credentials for...'],
          rows: [
            ['owner', 'admin, manager, sales, office, project_manager, driver, viewer'],
            ['admin (you)', 'manager, sales, office, project_manager, driver, viewer'],
            ['manager', 'sales, office, project_manager, driver, viewer'],
            ['office', 'sales, driver, viewer'],
          ],
        },
        { type: 'p', text: 'For each person you have authority over, the page shows their current login method (Password, PIN, or Picture) and three actions: **Reset Password** (sets it back to the starter password), **Reset Method** (forces them back to password login, clearing any PIN/picture setup), and **Reset All** (both at once). Every reset can optionally fire an email notification to that person.' },
        { type: 'callout', tone: 'warn', text: 'You cannot reset your own credentials from this screen, and you cannot reset anyone at or above your own level (admin can\'t touch owner). If someone needs that, it has to come from Michael or Chris.' },
      ],
      keyPoints: [
        '/portal/admin/credentials resets password and/or login method by hierarchy',
        'Sara can reset manager, sales, office, project_manager, driver, and viewer — not owner or another admin',
        'Every reset is written to the audit log automatically',
      ],
    },
    {
      title: 'What a New or Reset Login Actually Looks Like',
      blocks: [
        {
          type: 'steps',
          items: [
            'Person enters their email and password and logs in',
            'If their account is flagged `mustChangePassword`, they\'re redirected straight to /portal/change-password before they can do anything else — same forced-reset behavior covered in the Office Operations lesson',
            'First-ever login (or anyone who hasn\'t finished onboarding) routes to /portal/welcome instead of the dashboard',
            'Only after onboarding is marked complete do they land on their real dashboard',
          ],
        },
        { type: 'p', text: 'People with more than one role — right now that\'s Richard "Rick" Geahr (Sales + Driver) — get a **role picker** on login instead of going straight to a dashboard: a choice between "Sales" (routes to /portal/dashboard) and "Delivery" (routes to /portal/warehouse).' },
        { type: 'callout', tone: 'tip', text: 'If someone says the portal "sent them to the wrong screen," check two things in order: (1) is `mustChangePassword` still set on their account, and (2) have they actually completed onboarding. Both live outside the normal dashboard routing and will override it every time.' },
      ],
      keyPoints: [
        'mustChangePassword forces a password reset before anything else works',
        'Unfinished onboarding routes to /portal/welcome, not the dashboard',
        'Multi-role users (currently Rick) get a role picker instead of one fixed landing page',
      ],
    },
    {
      title: 'Profile-Change Approvals — Your Queue',
      blocks: [
        { type: 'p', text: 'When a team member edits their own public profile (bio, tagline, phone, photo, social links, key strengths, responsibilities), the change does **not** go live immediately. It\'s submitted as a pending edit request and held for review — you and Michael both get notified by email the moment it\'s submitted.' },
        { type: 'p', text: 'You review it at **/portal/admin/profile-approvals**, which has three tabs: **Profile Edits**, **Reviews**, and **Images** — each shows a pending count badge. On the Profile Edits tab, expanding a request shows a clean before/after: every changed field with its current value in red and the proposed value in green, side by side.' },
        {
          type: 'bullets',
          items: [
            '**Approve** — the change is applied live immediately and the submitter gets an email that it\'s approved',
            '**Reject** — opens a reason box (optional); the submitter gets an email with your reason and can revise and resubmit',
            'If someone submits a second edit while their first is still pending, the system merges it into the same pending request rather than creating a duplicate',
          ],
        },
        { type: 'callout', tone: 'warn', text: 'You cannot approve your own profile edit — the system blocks self-approval by name and email match. A different admin has to review it if you\'re the one who submitted the change.' },
      ],
      keyPoints: [
        'Profile edits (bio, photo, socials, etc.) queue for approval — they never go live automatically',
        '/portal/admin/profile-approvals shows a red/green before-after diff for every pending edit',
        'Self-approval is blocked; someone else has to approve your own changes',
      ],
      quiz: [
        {
          question: 'A sales rep updates their bio and profile photo. What happens next?',
          options: [
            'It goes live on the website immediately',
            'It sits in a pending queue at /portal/admin/profile-approvals until an admin approves or rejects it',
            'It gets emailed to the customer for review',
            'Nothing — profile edits require Michael to type them in manually',
          ],
          correct: 1,
          explanation: 'Every profile edit is held as a pending request with a before/after diff. Michael and Sara are notified by email, and it only goes live once an admin approves it.',
        },
      ],
    },
    {
      title: 'Cost Visibility — A Hard Boundary You Sit Inside Of',
      blocks: [
        { type: 'p', text: 'What we pay a supplier for materials is treated as sensitive everywhere in the system. The rule is enforced in code, not just policy: **owner, admin, office, and manager** can see cost. Sales reps, project managers, and customers never see it — they only ever see the marked-up **price**.' },
        {
          type: 'table',
          headers: ['Surface', 'Who sees cost'],
          rows: [
            ['General reports / cost visibility', 'owner, admin, office, manager'],
            ['Inventory pricing entry (restocking)', 'owner, admin, office, manager, **plus driver** — Rick has to type the supplier price when stock comes in, and only on this one screen'],
            ['Delivery-side documents (work orders, delivery PDFs, ticket-print views)', 'owner, admin, office only — strictest tier, driver excluded here'],
          ],
        },
        { type: 'p', text: 'As admin, you (Sara) see cost everywhere it\'s allowed to appear. Reps never see it, project managers never see it (reconfirmed by Michael 2026-07-02), and anything sent to JobNimbus or a customer-facing surface has cost fields stripped before it leaves the server — never filtered client-side.' },
      ],
      keyPoints: [
        'Cost-visible roles: owner, admin, office, manager — you\'re in that group',
        'Driver sees cost ONLY on the inventory restock-entry screen, nowhere else',
        'Sales reps, project managers, and customers never see cost — price only',
      ],
      quiz: [
        {
          question: 'Which of these roles can see supplier cost (not just price) in reports?',
          options: [
            'Sales reps',
            'Project managers',
            'Owner, admin, office, and manager',
            'Everyone who is logged in',
          ],
          correct: 2,
          explanation: 'Cost visibility is restricted to owner, admin, office, and manager. Sales reps and project managers see price only; the driver is a narrow exception limited to the restock-entry screen.',
        },
      ],
    },
    {
      title: 'Nothing Happens Quietly — Everything Writes to the Audit Log',
      blocks: [
        { type: 'p', text: 'Every meaningful account action you take is logged automatically: creating a user, changing a role, changing active status, resetting a passcode or PIN, or resetting credentials from the hierarchy page. These are separate, purpose-built log calls (not something you have to remember to trigger) tied to your email, so there\'s always a record of who changed what and when.' },
        { type: 'callout', tone: 'tip', text: 'If Michael ever asks "who changed Destin\'s permissions" or "who reset Rick\'s password," the answer is in the audit trail — you don\'t have to reconstruct it from memory.' },
      ],
      keyPoints: [
        'Role changes, status changes, and credential resets are all auto-logged',
        'Logs are tied to the actor\'s email/name — always traceable',
      ],
    },
  ],
};

export default saraUsersLesson;
