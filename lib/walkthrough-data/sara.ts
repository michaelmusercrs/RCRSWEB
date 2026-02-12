import {
  LayoutDashboard,
  UserPlus,
  CalendarDays,
  Receipt,
  MessageSquare,
  FileBarChart,
} from 'lucide-react';
import type { WalkthroughData } from './types';

export const saraWalkthrough: WalkthroughData = {
  slug: 'sara',
  name: 'Sara',
  role: 'Office Manager',
  greeting: 'Hey Sara! This walkthrough covers everything you use day-to-day in RoofStack.',
  description: 'Office dashboard, lead management, scheduling, billing, customer communications, and reports.',
  icon: LayoutDashboard,
  accentColor: 'text-pink-400',
  accentGradient: 'from-pink-500/20 to-rose-500/20',
  borderColor: 'border-pink-500/30',
  sections: [
    {
      id: 'office-dashboard',
      number: 1,
      title: 'Office Dashboard Overview',
      description: 'Your daily command center — see what needs attention, track tasks, and stay on top of everything.',
      icon: LayoutDashboard,
      iconColor: 'text-pink-400',
      steps: [
        {
          title: 'Dashboard Layout',
          bullets: [
            'The Command Center is your home base — access it from the sidebar or the top nav.',
            'Top metrics show today\'s key numbers: open tickets, pending leads, upcoming deliveries.',
            'The activity feed shows recent actions across the team in real time.',
            'Quick-action buttons let you create tickets, add leads, and send messages without navigating away.',
          ],
          tryItLink: { label: 'Open Command Center', href: '/command-center' },
        },
        {
          title: 'Daily Priorities Widget',
          bullets: [
            'The priorities section highlights items that need your attention right now.',
            'Overdue follow-ups, unsigned contracts, and unassigned leads appear here first.',
            'Click any item to jump directly to it and take action.',
            'Items automatically clear once resolved.',
          ],
        },
        {
          title: 'Notifications & Alerts',
          bullets: [
            'The bell icon shows unread notifications from across the platform.',
            'Delivery status changes, new leads, and team messages all trigger notifications.',
            'Click a notification to jump to the relevant page.',
            'Configure notification preferences in Settings to reduce noise.',
          ],
          tip: 'Start each morning by reviewing the Command Center before checking email — it gives you a complete picture faster.',
        },
      ],
    },
    {
      id: 'lead-management',
      number: 2,
      title: 'Lead Management',
      description: 'Handle incoming leads, assign them to reps, and track follow-ups.',
      icon: UserPlus,
      iconColor: 'text-blue-400',
      steps: [
        {
          title: 'Incoming Leads',
          bullets: [
            'New leads arrive from the website contact form, Check My Address page, and referrals.',
            'Each lead shows: name, phone, email, address, source, and submission time.',
            'The lead quality score helps prioritize which leads to assign first.',
            'Unassigned leads show a red "Unassigned" badge — assign these ASAP.',
          ],
          tryItLink: { label: 'View Lead Dashboard', href: '/portal/admin/leads' },
        },
        {
          title: 'Assigning Leads to Reps',
          bullets: [
            'Use the quick-assign dropdown on any lead to select a sales rep.',
            'Consider the rep\'s territory, current workload, and availability.',
            'The rep gets an instant notification with the lead\'s details.',
            'Track assignment-to-first-contact time to ensure fast follow-up.',
          ],
        },
        {
          title: 'Managing Lead Status',
          bullets: [
            'Update lead status as it progresses: New → Contacted → Inspected → Quoted → Sold.',
            'Add notes to leads for context that helps the assigned rep.',
            'Set follow-up reminders on leads that need a callback.',
            'Review "stale" leads weekly — anything uncontacted for 48+ hours needs escalation.',
          ],
          tip: 'Check for new leads at least 3 times per day: morning, after lunch, and before end of day.',
        },
        {
          title: 'Referral Leads',
          bullets: [
            'Referral leads come through the website\'s referral form.',
            'They include both the referrer\'s info and the new prospect\'s details.',
            'Tag these as "Referral" source for accurate tracking and commission splits.',
            'Send a thank-you to the referrer once the lead is contacted.',
          ],
        },
      ],
    },
    {
      id: 'scheduling',
      number: 3,
      title: 'Scheduling & Calendar',
      description: 'Manage appointments, inspections, deliveries, and team schedules.',
      icon: CalendarDays,
      iconColor: 'text-cyan-400',
      steps: [
        {
          title: 'Calendar Navigation',
          bullets: [
            'Access the calendar from the sidebar or the admin calendar page.',
            'Toggle between month, week, and day views using the top buttons.',
            'Color-coded events: blue = meetings, green = inspections, orange = deliveries, red = urgent.',
            'Click any event to see full details and edit.',
          ],
          tryItLink: { label: 'Open Calendar', href: '/portal/admin/calendar' },
        },
        {
          title: 'Scheduling Inspections',
          bullets: [
            'When a lead is ready for inspection, create an event on the calendar.',
            'Assign the inspection to the appropriate sales rep.',
            'The system generates a Google Calendar link to share with the homeowner.',
            'Set a reminder 1 hour before so the rep gets a heads-up.',
          ],
        },
        {
          title: 'Delivery Scheduling',
          bullets: [
            'Delivery dates are set when material orders are created.',
            'Check the calendar for conflicts before confirming delivery windows.',
            'Driver assignments show on the calendar so you can see capacity.',
            'Reschedule deliveries by dragging them to a new date (drag-and-drop).',
          ],
        },
        {
          title: 'Team Availability',
          bullets: [
            'View all team members\' schedules on the team calendar view.',
            'Check for conflicts before scheduling new events.',
            'Time-off requests and blocked days appear as gray bars.',
            'Use the "Find Available" tool to see which reps have open slots.',
          ],
          tip: 'Review tomorrow\'s schedule at end of each day to catch conflicts before they happen.',
        },
      ],
    },
    {
      id: 'billing',
      number: 4,
      title: 'Billing & Invoices',
      description: 'Create invoices, track payments, manage material orders, and handle billing workflows.',
      icon: Receipt,
      iconColor: 'text-green-400',
      steps: [
        {
          title: 'Creating Invoices',
          bullets: [
            'Navigate to Admin > Billing to access the billing dashboard.',
            'Click "New Invoice" to create an invoice from a job breakdown.',
            'The system auto-populates line items from the job\'s material and labor costs.',
            'Review totals, add any adjustments, then save or send to the customer.',
          ],
          tryItLink: { label: 'Open Billing', href: '/portal/admin/billing' },
        },
        {
          title: 'Payment Tracking',
          bullets: [
            'Track invoice status: Draft, Sent, Viewed, Paid, Overdue.',
            'Overdue invoices are highlighted in red with days outstanding.',
            'Send payment reminders directly from the billing dashboard.',
            'Record payments when received to keep records current.',
          ],
        },
        {
          title: 'Material Orders',
          bullets: [
            'Material orders auto-create delivery tickets in the system.',
            'Review the materials list against the job breakdown before confirming.',
            'Track supplier pricing and compare against budget estimates.',
            'Material costs flow into job profitability reports automatically.',
          ],
          tryItLink: { label: 'View Inventory', href: '/portal/admin/inventory' },
        },
        {
          title: 'Job Breakdowns',
          bullets: [
            'Access job breakdowns from the job detail page.',
            'Breakdowns itemize: materials, labor, equipment, overhead, and margin.',
            'Use the approval workflow for breakdowns over the standard threshold.',
            'Approved breakdowns become the basis for customer invoices.',
          ],
          tip: 'Process invoices within 24 hours of job completion to keep cash flow healthy.',
        },
      ],
    },
    {
      id: 'customer-comms',
      number: 5,
      title: 'Customer Communications',
      description: 'Manage customer messages, portal access, and document sharing.',
      icon: MessageSquare,
      iconColor: 'text-violet-400',
      steps: [
        {
          title: 'Customer Portal Overview',
          bullets: [
            'Customers access their own portal to track job progress, view documents, and communicate.',
            'The customer portal shows: job timeline, upcoming appointments, weather alerts, and messages.',
            'You can view what any customer sees by navigating to their portal page.',
            'Customer portal access is managed through token-based authentication.',
          ],
          tryItLink: { label: 'Customer Portal', href: '/portal/customer' },
        },
        {
          title: 'Sending Messages',
          bullets: [
            'Send updates to customers through the portal messaging system.',
            'Messages appear in the customer\'s portal and trigger email notifications.',
            'Use templates for common messages: appointment confirmations, delivery updates, etc.',
            'Track message read receipts to know when customers have seen your updates.',
          ],
        },
        {
          title: 'Document Sharing',
          bullets: [
            'Upload contracts, inspection reports, and photos to the customer\'s portal.',
            'Documents are organized by category and date for easy reference.',
            'Customers can download documents directly from their portal.',
            'Keep sensitive documents (like insurance claim details) in the internal-only section.',
          ],
        },
        {
          title: 'GroupMe Team Chat',
          bullets: [
            'Use GroupMe chat for quick internal team communication.',
            'Access the chat from the sidebar or the floating chat widget.',
            'Send direct messages or post in the team channel.',
            'Use @mentions to get specific team members\' attention.',
          ],
          tryItLink: { label: 'Open Team Chat', href: '/portal/chat' },
          tip: 'Set up message templates for common customer updates to save time and ensure consistency.',
        },
      ],
    },
    {
      id: 'reports',
      number: 6,
      title: 'Reports & Analytics',
      description: 'Generate reports, track metrics, and export data for record-keeping.',
      icon: FileBarChart,
      iconColor: 'text-orange-400',
      steps: [
        {
          title: 'Available Reports',
          bullets: [
            'Access reports from Command Center > Reports in the sidebar.',
            'Available reports: Sales Performance, Team Activity, Lead Sources, Financial Summary.',
            'Each report can be filtered by date range, rep, territory, and status.',
            'Reports update in real-time as new data flows into the system.',
          ],
          tryItLink: { label: 'View Reports', href: '/command-center/reports/team' },
        },
        {
          title: 'Generating Reports',
          bullets: [
            'Select the report type and set your desired filters.',
            'Click "Generate" to build the report with current data.',
            'Reports can be viewed on-screen, printed, or exported as PDF.',
            'Schedule recurring reports to be generated and emailed automatically.',
          ],
        },
        {
          title: 'Key Metrics to Track',
          bullets: [
            'Lead conversion rate: How many leads become inspections, then jobs.',
            'Average time-to-close: Days from lead entry to job sold.',
            'Revenue by rep: Who\'s bringing in the most business.',
            'Customer satisfaction: Based on portal engagement and feedback.',
          ],
          tip: 'Pull a quick sales report every Friday afternoon to prep for Monday\'s team meeting.',
        },
      ],
    },
  ],
};
