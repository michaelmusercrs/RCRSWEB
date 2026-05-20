/**
 * RCRS Training Module Definitions — Organized by Role
 *
 * Each module has: title, description, role, estimatedMinutes, status, and content placeholder.
 * Roles: sales_rep, admin, office_staff, driver, owner, manager, customer, production_crew
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type TrainingModuleStatus = 'draft' | 'ready' | 'coming-soon';

export type TrainingRole =
  | 'sales_rep'
  | 'admin'
  | 'office_staff'
  | 'driver'
  | 'owner'
  | 'manager'
  | 'customer'
  | 'production_crew';

export interface TrainingModuleDef {
  id: string;
  title: string;
  description: string;
  /** Primary role this module is for */
  role: TrainingRole;
  /** Additional roles that can access this module */
  additionalRoles?: TrainingRole[];
  estimatedMinutes: number;
  status: TrainingModuleStatus;
  /** Category grouping within the role */
  category: string;
  /** Order within the role's module list */
  order: number;
  /** Content type: 'lesson' | 'quiz' | 'flashcards' */
  contentType: 'lesson' | 'quiz' | 'flashcards';
  /** Number of questions (for quiz type) or terms (for flashcards) */
  itemCount?: number;
  /** URL/path to content if available */
  contentUrl?: string;
  /** Icon name hint for the UI */
  icon?: string;
}

// ---------------------------------------------------------------------------
// Role metadata
// ---------------------------------------------------------------------------

export interface TrainingRoleMeta {
  role: TrainingRole;
  label: string;
  description: string;
  color: string;
  borderColor: string;
  iconColor: string;
}

export const TRAINING_ROLES: TrainingRoleMeta[] = [
  {
    role: 'sales_rep',
    label: 'Sales Rep',
    description: 'Complete sales training from portal basics to insurance claims',
    color: 'from-brand-green/20 to-emerald-500/20',
    borderColor: 'border-brand-green/30',
    iconColor: 'text-brand-green',
  },
  {
    role: 'admin',
    label: 'Admin / Office',
    description: 'Full platform administration and backend systems',
    color: 'from-blue-500/20 to-cyan-500/20',
    borderColor: 'border-blue-500/30',
    iconColor: 'text-blue-400',
  },
  {
    role: 'driver',
    label: 'Delivery Driver',
    description: 'Loading, delivery, route optimization, and safety',
    color: 'from-amber-500/20 to-orange-500/20',
    borderColor: 'border-amber-500/30',
    iconColor: 'text-amber-400',
  },
  {
    role: 'owner',
    label: 'Owner / Manager',
    description: 'Executive dashboards, reporting, and strategic planning',
    color: 'from-purple-500/20 to-pink-500/20',
    borderColor: 'border-purple-500/30',
    iconColor: 'text-purple-400',
  },
  {
    role: 'customer',
    label: 'Customer-Facing',
    description: 'Guides and walkthroughs for homeowners',
    color: 'from-teal-500/20 to-cyan-500/20',
    borderColor: 'border-teal-500/30',
    iconColor: 'text-teal-400',
  },
  {
    role: 'production_crew',
    label: 'Production Crew',
    description: 'Field operations, job breakdowns, and quality control',
    color: 'from-red-500/20 to-rose-500/20',
    borderColor: 'border-red-500/30',
    iconColor: 'text-red-400',
  },
];

// ---------------------------------------------------------------------------
// Sales Rep Modules (10)
// ---------------------------------------------------------------------------

const SALES_REP_MODULES: TrainingModuleDef[] = [
  {
    id: 'sales-portal-onboarding',
    title: 'Portal Onboarding',
    description: 'Get started with the RoofStack portal — login, navigation, settings, and your personal dashboard.',
    role: 'sales_rep',
    estimatedMinutes: 30,
    status: 'ready',
    category: 'Getting Started',
    order: 1,
    contentType: 'lesson',
    icon: 'Monitor',
  },
  {
    id: 'sales-lead-management',
    title: 'Lead Management',
    description: 'How to receive, work, and convert leads. Understand the lead lifecycle, status updates, and follow-up cadence.',
    role: 'sales_rep',
    estimatedMinutes: 45,
    status: 'ready',
    category: 'Core Skills',
    order: 2,
    contentType: 'lesson',
    icon: 'Users',
  },
  {
    id: 'sales-check-my-address',
    title: 'Check My Address as a Sales Tool',
    description: 'Use the Check My Address tool to qualify leads, show storm history, and build trust with homeowners during the sales pitch.',
    role: 'sales_rep',
    estimatedMinutes: 30,
    status: 'ready',
    category: 'Core Skills',
    order: 3,
    contentType: 'lesson',
    icon: 'MapPin',
  },
  {
    id: 'sales-roof-measurement',
    title: 'Roof Measurement & Job Breakdown',
    description: 'Reading measurement reports, understanding job breakdowns, material calculations, and creating accurate estimates.',
    role: 'sales_rep',
    estimatedMinutes: 60,
    status: 'ready',
    category: 'Core Skills',
    order: 4,
    contentType: 'lesson',
    icon: 'Ruler',
  },
  {
    id: 'sales-performance-dashboard',
    title: 'Performance Dashboard',
    description: 'Track your sales metrics, conversion rates, commission earnings, and leaderboard position in real time.',
    role: 'sales_rep',
    estimatedMinutes: 20,
    status: 'ready',
    category: 'Tools',
    order: 5,
    contentType: 'lesson',
    icon: 'BarChart3',
  },
  {
    id: 'sales-customer-communication',
    title: 'Customer Communication',
    description: 'Best practices for customer outreach, follow-ups, objection handling, and maintaining professional communication.',
    role: 'sales_rep',
    estimatedMinutes: 40,
    status: 'ready',
    category: 'Core Skills',
    order: 6,
    contentType: 'lesson',
    icon: 'MessageSquare',
  },
  {
    id: 'sales-insurance-claims',
    title: 'Insurance Claims Process',
    description: 'Step-by-step guide to the insurance claim lifecycle: filing, adjuster meetings, supplements, and approval tracking.',
    role: 'sales_rep',
    estimatedMinutes: 50,
    status: 'ready',
    category: 'Advanced',
    order: 7,
    contentType: 'lesson',
    icon: 'Shield',
  },
  {
    id: 'sales-calendar-scheduling',
    title: 'Calendar & Scheduling',
    description: 'Using the calendar system for inspections, follow-ups, and installations. Integrates with Google Calendar and TeamUp.',
    role: 'sales_rep',
    estimatedMinutes: 20,
    status: 'ready',
    category: 'Tools',
    order: 8,
    contentType: 'lesson',
    icon: 'Calendar',
  },
  {
    id: 'sales-quiz',
    title: 'Sales Knowledge Quiz',
    description: 'Test your knowledge across all sales modules. 20 questions — score 70% or higher to pass.',
    role: 'sales_rep',
    estimatedMinutes: 25,
    status: 'ready',
    category: 'Assessment',
    order: 9,
    contentType: 'quiz',
    itemCount: 20,
    icon: 'Brain',
  },
  {
    id: 'sales-flashcards',
    title: 'Sales Terminology Flashcards',
    description: '50 key terms every sales rep needs to know — roofing materials, insurance terms, CRM concepts, and more.',
    role: 'sales_rep',
    estimatedMinutes: 30,
    status: 'ready',
    category: 'Study Aids',
    order: 10,
    contentType: 'flashcards',
    itemCount: 50,
    icon: 'CreditCard',
  },
];

// ---------------------------------------------------------------------------
// Admin / Office Modules (11)
// ---------------------------------------------------------------------------

const ADMIN_MODULES: TrainingModuleDef[] = [
  {
    id: 'admin-platform-onboarding',
    title: 'Full Platform Onboarding',
    description: 'Complete walkthrough of the RoofStack platform from an admin perspective — all features, settings, and permissions.',
    role: 'admin',
    additionalRoles: ['office_staff'],
    estimatedMinutes: 60,
    status: 'ready',
    category: 'Getting Started',
    order: 1,
    contentType: 'lesson',
    icon: 'Monitor',
  },
  {
    id: 'admin-dashboard-command-center',
    title: 'Dashboard & Command Center',
    description: 'Master the admin dashboard, command center widgets, real-time metrics, and KPI monitoring.',
    role: 'admin',
    additionalRoles: ['office_staff'],
    estimatedMinutes: 30,
    status: 'ready',
    category: 'Core',
    order: 2,
    contentType: 'lesson',
    icon: 'LayoutDashboard',
  },
  {
    id: 'admin-user-team-management',
    title: 'User & Team Management',
    description: 'Adding users, assigning roles, managing teams, setting permissions, and handling access control.',
    role: 'admin',
    estimatedMinutes: 35,
    status: 'ready',
    category: 'Core',
    order: 3,
    contentType: 'lesson',
    icon: 'Users',
  },
  {
    id: 'admin-billing-invoicing',
    title: 'Billing & Invoicing',
    description: 'Creating invoices, tracking payments, managing billing statuses (Sent/Viewed/Paid), and financial reconciliation.',
    role: 'admin',
    additionalRoles: ['office_staff'],
    estimatedMinutes: 40,
    status: 'ready',
    category: 'Financial',
    order: 4,
    contentType: 'lesson',
    icon: 'DollarSign',
  },
  {
    id: 'admin-inventory-management',
    title: 'Inventory Management',
    description: 'Tracking materials, reorder points, warehouse stock levels, and inventory audit trails.',
    role: 'admin',
    additionalRoles: ['office_staff'],
    estimatedMinutes: 35,
    status: 'ready',
    category: 'Operations',
    order: 5,
    contentType: 'lesson',
    icon: 'Package',
  },
  {
    id: 'admin-lead-management',
    title: 'Lead Management (Admin View)',
    description: 'Lead distribution, assignment rules, pipeline oversight, and lead source analytics from the admin perspective.',
    role: 'admin',
    additionalRoles: ['office_staff'],
    estimatedMinutes: 40,
    status: 'ready',
    category: 'Operations',
    order: 6,
    contentType: 'lesson',
    icon: 'Target',
  },
  {
    id: 'admin-google-sheets-backend',
    title: 'Google Sheets Backend',
    description: 'Understanding the Google Sheets data layer — structure, formulas, sync behavior, and troubleshooting.',
    role: 'admin',
    estimatedMinutes: 45,
    status: 'ready',
    category: 'Technical',
    order: 7,
    contentType: 'lesson',
    icon: 'FileSpreadsheet',
  },
  {
    id: 'admin-jobnimbus-integration',
    title: 'JobNimbus Integration',
    description: 'How RoofStack syncs with JobNimbus CRM — contacts, jobs, workflows, and data mapping.',
    role: 'admin',
    estimatedMinutes: 40,
    status: 'ready',
    category: 'Technical',
    order: 8,
    contentType: 'lesson',
    icon: 'Zap',
  },
  {
    id: 'admin-scheduling-calendar',
    title: 'Scheduling & Calendar',
    description: 'Managing the company calendar, scheduling inspections and installations, and TeamUp/Google Calendar sync.',
    role: 'admin',
    additionalRoles: ['office_staff'],
    estimatedMinutes: 25,
    status: 'ready',
    category: 'Operations',
    order: 9,
    contentType: 'lesson',
    icon: 'Calendar',
  },
  {
    id: 'admin-security',
    title: 'Security & Access Control',
    description: 'Authentication system, JWT tokens, role-based permissions, password policies, and security best practices.',
    role: 'admin',
    estimatedMinutes: 30,
    status: 'ready',
    category: 'Technical',
    order: 10,
    contentType: 'lesson',
    icon: 'Shield',
  },
  {
    id: 'admin-quiz',
    title: 'Admin Knowledge Quiz',
    description: 'Comprehensive assessment covering all admin modules. 30 questions — score 70% or higher to pass.',
    role: 'admin',
    additionalRoles: ['office_staff'],
    estimatedMinutes: 35,
    status: 'ready',
    category: 'Assessment',
    order: 11,
    contentType: 'quiz',
    itemCount: 30,
    icon: 'Brain',
  },
];

// ---------------------------------------------------------------------------
// Delivery Driver Modules (8)
// ---------------------------------------------------------------------------

const DRIVER_MODULES: TrainingModuleDef[] = [
  {
    id: 'driver-portal-onboarding',
    title: 'Driver Portal Onboarding',
    description: 'Getting started with the driver portal — login, delivery queue, status updates, and mobile usage.',
    role: 'driver',
    estimatedMinutes: 25,
    status: 'ready',
    category: 'Getting Started',
    order: 1,
    contentType: 'lesson',
    icon: 'Monitor',
  },
  {
    id: 'driver-loading-process',
    title: 'Loading Process',
    description: 'Step-by-step loading procedures, material verification checklists, weight distribution, and vehicle capacity planning.',
    role: 'driver',
    estimatedMinutes: 30,
    status: 'ready',
    category: 'Core Operations',
    order: 2,
    contentType: 'lesson',
    icon: 'Package',
  },
  {
    id: 'driver-delivery-workflow',
    title: 'Delivery Workflow',
    description: 'The complete 12-status delivery lifecycle from assignment to completion, including photo documentation and customer sign-off.',
    role: 'driver',
    estimatedMinutes: 40,
    status: 'ready',
    category: 'Core Operations',
    order: 3,
    contentType: 'lesson',
    icon: 'Truck',
  },
  {
    id: 'driver-route-optimization',
    title: 'Route Optimization',
    description: 'Planning efficient delivery routes, using GPS integration, managing multi-stop deliveries, and handling schedule changes.',
    role: 'driver',
    estimatedMinutes: 25,
    status: 'ready',
    category: 'Efficiency',
    order: 4,
    contentType: 'lesson',
    icon: 'Map',
  },
  {
    id: 'driver-returns-pickups',
    title: 'Returns & Pickups',
    description: 'Handling material returns, pickup requests, restocking procedures, and return documentation.',
    role: 'driver',
    estimatedMinutes: 20,
    status: 'ready',
    category: 'Core Operations',
    order: 5,
    contentType: 'lesson',
    icon: 'RotateCcw',
  },
  {
    id: 'driver-communication',
    title: 'Communication',
    description: 'Using GroupMe, updating delivery statuses, communicating with office staff, and notifying customers.',
    role: 'driver',
    estimatedMinutes: 15,
    status: 'ready',
    category: 'Tools',
    order: 6,
    contentType: 'lesson',
    icon: 'MessageSquare',
  },
  {
    id: 'driver-warehouse-safety',
    title: 'Warehouse Operations & Safety',
    description: 'Warehouse layout, inventory locations, safety protocols, PPE requirements, and emergency procedures.',
    role: 'driver',
    estimatedMinutes: 30,
    status: 'ready',
    category: 'Safety',
    order: 7,
    contentType: 'lesson',
    icon: 'AlertTriangle',
  },
  {
    id: 'driver-quiz',
    title: 'Driver Knowledge Quiz',
    description: 'Test your knowledge of delivery operations. 15 questions — score 70% or higher to pass.',
    role: 'driver',
    estimatedMinutes: 15,
    status: 'ready',
    category: 'Assessment',
    order: 8,
    contentType: 'quiz',
    itemCount: 15,
    icon: 'Brain',
  },
];

// ---------------------------------------------------------------------------
// Owner / Manager Modules (8)
// ---------------------------------------------------------------------------

const OWNER_MODULES: TrainingModuleDef[] = [
  {
    id: 'owner-executive-overview',
    title: 'Executive Overview',
    description: 'High-level overview of the RoofStack platform, business metrics, and how technology drives operations.',
    role: 'owner',
    additionalRoles: ['manager'],
    estimatedMinutes: 30,
    status: 'ready',
    category: 'Getting Started',
    order: 1,
    contentType: 'lesson',
    icon: 'Building2',
  },
  {
    id: 'owner-dashboard',
    title: 'Owner Dashboard',
    description: 'Using the owner dashboard — revenue tracking, team performance at a glance, and key business health indicators.',
    role: 'owner',
    additionalRoles: ['manager'],
    estimatedMinutes: 25,
    status: 'ready',
    category: 'Core',
    order: 2,
    contentType: 'lesson',
    icon: 'LayoutDashboard',
  },
  {
    id: 'owner-team-performance',
    title: 'Team Performance Management',
    description: 'Reviewing team metrics, individual performance, sales leaderboards, and identifying coaching opportunities.',
    role: 'owner',
    additionalRoles: ['manager'],
    estimatedMinutes: 35,
    status: 'ready',
    category: 'Management',
    order: 3,
    contentType: 'lesson',
    icon: 'Users',
  },
  {
    id: 'owner-financial-reporting',
    title: 'Financial Reporting',
    description: 'Revenue reports, outstanding invoices, commission calculations, and monthly financial summaries.',
    role: 'owner',
    additionalRoles: ['manager'],
    estimatedMinutes: 40,
    status: 'ready',
    category: 'Financial',
    order: 4,
    contentType: 'lesson',
    icon: 'DollarSign',
  },
  {
    id: 'owner-lead-distribution',
    title: 'Lead Distribution Configuration',
    description: 'Setting up lead distribution rules, territory assignments, round-robin settings, and lead source priorities.',
    role: 'owner',
    additionalRoles: ['manager'],
    estimatedMinutes: 30,
    status: 'ready',
    category: 'Configuration',
    order: 5,
    contentType: 'lesson',
    icon: 'Settings',
  },
  {
    id: 'owner-strategic-planning',
    title: 'Strategic Planning',
    description: 'Using platform data for territory expansion, seasonal planning, marketing ROI analysis, and growth forecasting.',
    role: 'owner',
    estimatedMinutes: 45,
    status: 'coming-soon',
    category: 'Advanced',
    order: 6,
    contentType: 'lesson',
    icon: 'TrendingUp',
  },
  {
    id: 'owner-customer-portal',
    title: 'Customer Portal Management',
    description: 'How the customer-facing portal works, what homeowners see, and how to customize the experience.',
    role: 'owner',
    additionalRoles: ['manager'],
    estimatedMinutes: 25,
    status: 'ready',
    category: 'Core',
    order: 7,
    contentType: 'lesson',
    icon: 'Globe',
  },
  {
    id: 'owner-quiz',
    title: 'Owner/Manager Knowledge Quiz',
    description: 'Assessment covering dashboards, reporting, team management, and platform configuration. 20 questions.',
    role: 'owner',
    additionalRoles: ['manager'],
    estimatedMinutes: 25,
    status: 'ready',
    category: 'Assessment',
    order: 8,
    contentType: 'quiz',
    itemCount: 20,
    icon: 'Brain',
  },
];

// ---------------------------------------------------------------------------
// Customer-Facing Modules (5)
// ---------------------------------------------------------------------------

const CUSTOMER_MODULES: TrainingModuleDef[] = [
  {
    id: 'customer-welcome-guide',
    title: 'Welcome Guide',
    description: 'Welcome to River City Roofing Solutions! Learn what to expect during your roofing project and how to use your customer portal.',
    role: 'customer',
    estimatedMinutes: 10,
    status: 'ready',
    category: 'Getting Started',
    order: 1,
    contentType: 'lesson',
    icon: 'Home',
  },
  {
    id: 'customer-project-tracking',
    title: 'Project Tracking Walkthrough',
    description: 'How to track your roofing project status, view timelines, and see real-time updates through the customer portal.',
    role: 'customer',
    estimatedMinutes: 10,
    status: 'ready',
    category: 'Portal',
    order: 2,
    contentType: 'lesson',
    icon: 'BarChart3',
  },
  {
    id: 'customer-measurement-report',
    title: 'Understanding Your Measurement Report',
    description: 'How to read your roof measurement report — what the numbers mean, materials listed, and how it affects your estimate.',
    role: 'customer',
    estimatedMinutes: 15,
    status: 'ready',
    category: 'Education',
    order: 3,
    contentType: 'lesson',
    icon: 'Ruler',
  },
  {
    id: 'customer-storm-report',
    title: 'Understanding Your Storm Report',
    description: 'Learn how storm data affects your claim, what hail size and wind speed mean for your roof, and next steps.',
    role: 'customer',
    estimatedMinutes: 10,
    status: 'ready',
    category: 'Education',
    order: 4,
    contentType: 'lesson',
    icon: 'CloudRain',
  },
  {
    id: 'customer-faq',
    title: 'Frequently Asked Questions',
    description: 'Answers to common questions about the roofing process, insurance claims, timelines, warranties, and payments.',
    role: 'customer',
    estimatedMinutes: 10,
    status: 'ready',
    category: 'Reference',
    order: 5,
    contentType: 'lesson',
    icon: 'HelpCircle',
  },
];

// ---------------------------------------------------------------------------
// Production Crew Modules (3)
// ---------------------------------------------------------------------------

const PRODUCTION_CREW_MODULES: TrainingModuleDef[] = [
  {
    id: 'crew-onboarding',
    title: 'Production Crew Onboarding',
    description: 'Getting started as a production crew member — safety orientation, equipment overview, and daily workflow expectations.',
    role: 'production_crew',
    estimatedMinutes: 30,
    status: 'ready',
    category: 'Getting Started',
    order: 1,
    contentType: 'lesson',
    icon: 'HardHat',
  },
  {
    id: 'crew-job-breakdowns',
    title: 'Job Breakdowns in the Field',
    description: 'Reading job breakdown sheets on-site, understanding material lists, scope of work, and documenting completed work.',
    role: 'production_crew',
    estimatedMinutes: 25,
    status: 'ready',
    category: 'Core',
    order: 2,
    contentType: 'lesson',
    icon: 'ClipboardList',
  },
  {
    id: 'crew-quality-control',
    title: 'Quality Control',
    description: 'Quality standards, inspection checklists, photo documentation requirements, and common issues to watch for.',
    role: 'production_crew',
    estimatedMinutes: 30,
    status: 'ready',
    category: 'Quality',
    order: 3,
    contentType: 'lesson',
    icon: 'CheckCircle',
  },
];

// ---------------------------------------------------------------------------
// Inventory App — role-specific training (2026-05-20)
// ---------------------------------------------------------------------------
//
// One module per role describing exactly what that role does in the new
// inventory UI: live counts, low-stock alerts, transaction log, quick-actions
// bar, and (for PMs) the auto-generated Delivery Schedule entry.
// Primary role is the most-affected viewer; additionalRoles makes the lesson
// visible from sibling role trees so e.g. Office can see the PM module too.

const INVENTORY_APP_MODULES: TrainingModuleDef[] = [
  {
    id: 'inventory-app-driver',
    title: 'Inventory App — Driver View',
    description:
      'Your delivery schedule, today\'s loads, and verify-load workflow on phone. No edits — you only confirm what you delivered. Tap the (?) on any field for a plain-language hint.',
    role: 'driver',
    estimatedMinutes: 10,
    status: 'ready',
    category: 'Inventory',
    order: 9,
    contentType: 'lesson',
    icon: 'Package',
    contentUrl: '/portal/driver',
  },
  {
    id: 'inventory-app-warehouse',
    title: 'Inventory App — Warehouse',
    description:
      'Pull lists, load verification, return intake, stock count adjustments. Use the Adjust Stock and Record Return quick-action tiles. All actions log who/when/why.',
    role: 'driver',
    additionalRoles: ['admin', 'office_staff'],
    estimatedMinutes: 15,
    status: 'ready',
    category: 'Inventory',
    order: 10,
    contentType: 'lesson',
    icon: 'Warehouse',
    contentUrl: '/portal/inventory/warehouse',
  },
  {
    id: 'inventory-app-pm',
    title: 'Inventory App — Project Manager',
    description:
      'Material order creation. Submitting auto-emails stock@rcrsal.com AND creates a Delivery Schedule row. Use Credit Memo for returns and Order History to track every job.',
    role: 'admin',
    additionalRoles: ['office_staff', 'owner', 'manager'],
    estimatedMinutes: 15,
    status: 'ready',
    category: 'Inventory',
    order: 11,
    contentType: 'lesson',
    icon: 'ClipboardList',
    contentUrl: '/portal/pm',
  },
  {
    id: 'inventory-app-office',
    title: 'Inventory App — Office / Billing',
    description:
      'Reading the Transaction History tab, low-stock dashboard, reconciliation, and invoicing tied to load-verified events. You see cost; reps and customers do not.',
    role: 'admin',
    additionalRoles: ['office_staff', 'owner', 'manager'],
    estimatedMinutes: 15,
    status: 'ready',
    category: 'Inventory',
    order: 12,
    contentType: 'lesson',
    icon: 'FileSpreadsheet',
    contentUrl: '/portal/inventory',
  },
  {
    id: 'inventory-app-owner',
    title: 'Inventory App — Owner Snapshot',
    description:
      'Per-SKU drill-down: lifetime delivered + average monthly burn rate. Use this to size restock orders and spot SKUs that are bleeding without restock coverage.',
    role: 'owner',
    additionalRoles: ['manager'],
    estimatedMinutes: 10,
    status: 'ready',
    category: 'Inventory',
    order: 13,
    contentType: 'lesson',
    icon: 'TrendingUp',
    contentUrl: '/command-center/inventory',
  },
];

// ---------------------------------------------------------------------------
// Combined exports
// ---------------------------------------------------------------------------

export const ALL_TRAINING_MODULES: TrainingModuleDef[] = [
  ...SALES_REP_MODULES,
  ...ADMIN_MODULES,
  ...DRIVER_MODULES,
  ...OWNER_MODULES,
  ...CUSTOMER_MODULES,
  ...PRODUCTION_CREW_MODULES,
  ...INVENTORY_APP_MODULES,
];

/**
 * Get modules accessible to a given role.
 * A module is accessible if role matches the primary role OR is in additionalRoles.
 */
export function getModulesForTrainingRole(role: TrainingRole): TrainingModuleDef[] {
  return ALL_TRAINING_MODULES
    .filter(
      (m) => m.role === role || (m.additionalRoles && m.additionalRoles.includes(role)),
    )
    .sort((a, b) => a.order - b.order);
}

/**
 * Map a user's auth role string to the training role(s) they should see.
 */
export function mapAuthRoleToTrainingRoles(authRole: string): TrainingRole[] {
  switch (authRole) {
    case 'admin':
      return ['admin'];
    case 'owner':
      return ['owner'];
    case 'manager':
      return ['owner']; // managers see owner/manager modules
    case 'sales_rep':
      return ['sales_rep'];
    case 'driver':
      return ['driver'];
    case 'office_staff':
      return ['admin']; // office staff see admin modules
    default:
      return ['sales_rep']; // default fallback
  }
}

/**
 * Get all modules a user can access based on their auth role.
 */
export function getModulesForAuthRole(authRole: string): TrainingModuleDef[] {
  const trainingRoles = mapAuthRoleToTrainingRoles(authRole);
  const seen = new Set<string>();
  const result: TrainingModuleDef[] = [];

  for (const role of trainingRoles) {
    for (const mod of getModulesForTrainingRole(role)) {
      if (!seen.has(mod.id)) {
        seen.add(mod.id);
        result.push(mod);
      }
    }
  }

  return result;
}

/**
 * Get a single module by ID.
 */
export function getTrainingModuleById(id: string): TrainingModuleDef | undefined {
  return ALL_TRAINING_MODULES.find((m) => m.id === id);
}

/**
 * Group modules by category for display.
 */
export function groupModulesByCategory(
  modules: TrainingModuleDef[],
): Record<string, TrainingModuleDef[]> {
  const groups: Record<string, TrainingModuleDef[]> = {};
  for (const mod of modules) {
    if (!groups[mod.category]) groups[mod.category] = [];
    groups[mod.category].push(mod);
  }
  return groups;
}
