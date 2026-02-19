// Role-specific onboarding checklists for RCRS team members

export interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  link?: { href: string; label: string };
  tip?: string;
}

export interface OnboardingChecklist {
  slug: string;
  name: string;
  role: string;
  roleTag: string;
  emoji: string;
  description: string;
  steps: OnboardingStep[];
}

export const onboardingChecklists: OnboardingChecklist[] = [
  // ── Sara Hill ──────────────────────────────────────────────────────────
  {
    slug: 'sara-hill',
    name: 'Sara Hill',
    role: 'Office Manager / Admin',
    roleTag: 'HBIC',
    emoji: '👑',
    description: 'Full admin onboarding — dashboard, leads, team management, billing, inventory, and more.',
    steps: [
      {
        id: 'sara-1',
        title: 'Login & Change Password',
        description: 'Go to the portal login page. Use your temporary password (ChangeMe123!) to sign in, then change it immediately from your profile.',
        link: { href: '/portal/change-password', label: 'Change Password' },
      },
      {
        id: 'sara-2',
        title: 'Tour the Admin Dashboard',
        description: 'Visit the admin panel. This is your control center — blog, images, team profiles, portal settings, lead distribution, and training management all live here.',
        link: { href: '/portal/admin', label: 'Open Admin Panel' },
      },
      {
        id: 'sara-3',
        title: 'Lead Distribution Overview',
        description: 'See how incoming leads get assigned to sales reps. You can toggle rep availability, view the round-robin queue, and see assignment history.',
        link: { href: '/portal/admin/lead-distro', label: 'Lead Distribution' },
        tip: 'You can toggle reps on/off for lead distribution without changing their account status.',
      },
      {
        id: 'sara-4',
        title: 'Manage Team Profiles & Approvals',
        description: 'Review and approve team profile changes. See all team members, their roles, and contact info. You can edit profiles and manage access.',
        link: { href: '/portal/admin/team', label: 'Team Management' },
      },
      {
        id: 'sara-5',
        title: 'Billing & Invoicing Walkthrough',
        description: 'Learn how invoices are created from job breakdowns, sent to customers or insurance, and tracked through Sent → Viewed → Paid.',
        link: { href: '/portal/billing', label: 'Billing Dashboard' },
      },
      {
        id: 'sara-6',
        title: 'Inventory Management Basics',
        description: 'Check stock levels, see reorder alerts (red = urgent), and understand how materials flow from orders to deliveries to job sites.',
        link: { href: '/portal/inventory', label: 'Inventory' },
        tip: 'Green = healthy stock, Yellow = approaching reorder, Red = below minimum.',
      },
      {
        id: 'sara-7',
        title: 'Monday Notes Admin',
        description: 'View, manage, and compile Monday Notes submissions from the team. These are used for the weekly team sync.',
        link: { href: '/portal/monday-notes', label: 'Monday Notes' },
      },
      {
        id: 'sara-8',
        title: 'Customer Portal Overview',
        description: 'See what customers see when they visit their project portal (/my/[token]). Includes project status, weather alerts, documents, and messaging. No login required for them — it\'s token-based.',
        link: { href: '/portal/customers', label: 'Customer Management' },
        tip: 'Customer portals are read-only. Customers can\'t see internal notes, costs, or other customers.',
      },
    ],
  },

  // ── Chris Muse ─────────────────────────────────────────────────────────
  {
    slug: 'chris-muse',
    name: 'Chris Muse',
    role: 'Owner',
    roleTag: 'Lead Distribution Admin',
    emoji: '🎯',
    description: 'Owner onboarding focused on lead distribution configuration, rep territories, and sales oversight.',
    steps: [
      {
        id: 'chris-1',
        title: 'Login & Change Password',
        description: 'Sign in with your temporary password (ChangeMe123!) and change it right away.',
        link: { href: '/portal/change-password', label: 'Change Password' },
      },
      {
        id: 'chris-2',
        title: 'Lead Distribution Deep-Dive',
        description: 'This is your main tool. See how leads are distributed, the current algorithm settings, and assignment history. You have full admin control here.',
        link: { href: '/portal/admin/lead-distro', label: 'Lead Distribution' },
      },
      {
        id: 'chris-3',
        title: 'Configure Rep Territories & Weights',
        description: 'Set up which reps cover which areas. Adjust weight percentages to control how leads are split. Configure round-robin order and priority overrides.',
        link: { href: '/portal/admin/lead-distro', label: 'Territory Settings' },
        tip: 'Higher weight = more leads. A rep with weight 2 gets twice as many as weight 1.',
      },
      {
        id: 'chris-4',
        title: 'View & Override Lead Assignments',
        description: 'See where every lead went and why. You can manually reassign any lead to a different rep if needed.',
        link: { href: '/portal/leads', label: 'View Leads' },
      },
      {
        id: 'chris-5',
        title: 'Command Center Overview',
        description: 'RoofStack HQ is your high-level dashboard — sales pipeline, inventory, team performance, and quick links to everything.',
        link: { href: '/command-center', label: 'RoofStack HQ' },
      },
      {
        id: 'chris-6',
        title: 'Sales Reports & Leaderboard',
        description: 'Check rep performance, response times, conversion rates, and the sales leaderboard. Use this to spot who\'s crushing it and who needs coaching.',
        link: { href: '/portal/reports', label: 'Sales Reports' },
      },
    ],
  },

  // ── John Cordonis ──────────────────────────────────────────────────────
  {
    slug: 'john-cordonis',
    name: 'John Cordonis',
    role: 'Project Manager',
    roleTag: 'PM',
    emoji: '🔨',
    description: 'Project manager onboarding — material orders, delivery tickets, scheduling, and inventory.',
    steps: [
      {
        id: 'john-1',
        title: 'Login & Change Password',
        description: 'Sign in with your temporary password (ChangeMe123!) and change it from your profile.',
        link: { href: '/portal/change-password', label: 'Change Password' },
      },
      {
        id: 'john-2',
        title: 'Material Ordering Workflow',
        description: 'Learn how to create material orders. Check inventory first, then create an order specifying items, quantities, and vendor. Orders flow: Ordered → In Transit → Received.',
        link: { href: '/portal/orders', label: 'Material Orders' },
        tip: 'Always check current inventory before ordering — someone else may have already placed an order.',
      },
      {
        id: 'john-3',
        title: 'Delivery Ticket Creation',
        description: 'Create delivery tickets to get materials from warehouse to job site. Select the job address, add materials, set delivery date, and assign a driver.',
        link: { href: '/portal/delivery', label: 'Delivery Tickets' },
      },
      {
        id: 'john-4',
        title: 'Schedule Management',
        description: 'View and manage the schedule. See installations, deliveries, and inspections on the calendar. You can create and edit events for your jobs.',
        link: { href: '/portal/schedule', label: 'Schedule' },
      },
      {
        id: 'john-5',
        title: 'Inventory Viewing',
        description: 'Check what\'s in stock before ordering or scheduling. You can see quantities, reorder alerts, and item details. PMs have view access — contact the office for adjustments.',
        link: { href: '/portal/inventory', label: 'Inventory' },
      },
    ],
  },

  // ── Bart Roberts ───────────────────────────────────────────────────────
  {
    slug: 'bart-roberts',
    name: 'Bart Roberts',
    role: 'Project Manager',
    roleTag: 'PM',
    emoji: '🔨',
    description: 'Project manager onboarding — material orders, delivery tickets, scheduling, and inventory.',
    steps: [
      {
        id: 'bart-1',
        title: 'Login & Change Password',
        description: 'Sign in with your temporary password (ChangeMe123!) and change it from your profile.',
        link: { href: '/portal/change-password', label: 'Change Password' },
      },
      {
        id: 'bart-2',
        title: 'Material Ordering Workflow',
        description: 'Learn how to create material orders. Check inventory first, then create an order specifying items, quantities, and vendor. Orders flow: Ordered → In Transit → Received.',
        link: { href: '/portal/orders', label: 'Material Orders' },
        tip: 'Always check current inventory before ordering — someone else may have already placed an order.',
      },
      {
        id: 'bart-3',
        title: 'Delivery Ticket Creation',
        description: 'Create delivery tickets to get materials from warehouse to job site. Select the job address, add materials, set delivery date, and assign a driver.',
        link: { href: '/portal/delivery', label: 'Delivery Tickets' },
      },
      {
        id: 'bart-4',
        title: 'Schedule Management',
        description: 'View and manage the schedule. See installations, deliveries, and inspections on the calendar. You can create and edit events for your jobs.',
        link: { href: '/portal/schedule', label: 'Schedule' },
      },
      {
        id: 'bart-5',
        title: 'Inventory Viewing',
        description: 'Check what\'s in stock before ordering or scheduling. You can see quantities, reorder alerts, and item details. PMs have view access — contact the office for adjustments.',
        link: { href: '/portal/inventory', label: 'Inventory' },
      },
    ],
  },

  // ── Sales Rep Generic ──────────────────────────────────────────────────
  {
    slug: 'sales-rep',
    name: 'Sales Rep',
    role: 'Sales Representative',
    roleTag: 'Sales',
    emoji: '💰',
    description: 'Sales rep onboarding — your dashboard, leads, weekly numbers, customer portal, and Monday Notes.',
    steps: [
      {
        id: 'sales-1',
        title: 'Login with Your PIN',
        description: 'Use your 4-digit PIN to log in. If you don\'t know it, ask Sara or the office team. You can also use email + password.',
        link: { href: '/portal', label: 'Portal Login' },
      },
      {
        id: 'sales-2',
        title: 'Your Dashboard Overview',
        description: 'Your dashboard shows your assigned leads, response times, pipeline value, and commission tracking. This is your daily home base.',
        link: { href: '/portal/sales', label: 'Sales Dashboard' },
        tip: 'Check your dashboard first thing every morning. New leads won\'t wait.',
      },
      {
        id: 'sales-3',
        title: 'How to Enter Weekly Numbers',
        description: 'Submit your weekly activity — doors knocked, inspections completed, claims filed, and deals closed. These feed the leaderboard and reports.',
        link: { href: '/portal/sales', label: 'Weekly Numbers' },
      },
      {
        id: 'sales-4',
        title: 'Customer Portal — What Your Customers See',
        description: 'Each customer gets a unique portal link showing their project status, timeline, documents, and your contact info. Share this link after the inspection to keep them informed.',
        tip: 'Sharing the customer portal link reduces "where are we at?" calls by 50%+.',
      },
      {
        id: 'sales-5',
        title: 'Lead Notifications & Response Tracking',
        description: 'When you get a new lead, you\'ll be notified by text/email. Your response time is tracked — the faster you respond, the higher your conversion rate. Aim for under 5 minutes.',
        link: { href: '/portal/leads', label: 'Your Leads' },
        tip: 'Leads that sit get reassigned. Speed to lead = speed to money.',
      },
      {
        id: 'sales-6',
        title: 'Monday Notes Submission',
        description: 'Submit your Monday Notes before the weekly meeting. Include wins, pipeline updates, challenges, and what you need help with.',
        link: { href: '/portal/monday-notes', label: 'Monday Notes' },
      },
    ],
  },

  // ── Customer Portal Explainer ──────────────────────────────────────────
  {
    slug: 'customer-portal',
    name: 'Customer Portal',
    role: 'Training Document',
    roleTag: 'Reference',
    emoji: '📋',
    description: 'Not an onboarding checklist — a reference guide explaining what customers see in their portal.',
    steps: [
      {
        id: 'cp-1',
        title: 'What the Customer Portal Shows',
        description: 'Customers access their portal at /my/[token] — no login needed. They see: project status tracker, milestone timeline (inspection → claim → approved → scheduled → complete), assigned rep contact info, and company credentials.',
      },
      {
        id: 'cp-2',
        title: 'Project Status & Timeline',
        description: 'A visual progress bar shows where their project stands. Each milestone is timestamped. Customers can see current stage and what comes next — but not internal notes or costs.',
      },
      {
        id: 'cp-3',
        title: 'Weather Alerts',
        description: 'If severe weather is forecasted for their area, the portal shows an alert banner. This is automated based on their property address and helps set expectations around scheduling.',
      },
      {
        id: 'cp-4',
        title: 'Documents & Photos',
        description: 'Any documents or photos shared by the team appear here — inspection reports, insurance paperwork, before/after photos. Customers can view but not edit.',
      },
      {
        id: 'cp-5',
        title: 'Messaging',
        description: 'Customers can send messages through the portal to their assigned rep. Messages are logged and the rep gets notified. This keeps all communication in one place.',
      },
    ],
  },
];

export function getChecklistBySlug(slug: string): OnboardingChecklist | undefined {
  return onboardingChecklists.find(c => c.slug === slug);
}
