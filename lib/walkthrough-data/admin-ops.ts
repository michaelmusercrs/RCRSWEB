import {
  LayoutGrid,
  Database,
  Users,
  Boxes,
  CalendarClock,
} from 'lucide-react';
import type { WalkthroughData } from './types';

export const adminOpsWalkthrough: WalkthroughData = {
  slug: 'admin-ops',
  name: 'Destin & Tia',
  role: 'Administrative Support',
  greeting: 'Welcome, Destin and Tia! Here\'s your guide to the admin tools you use every day.',
  description: 'Dashboard navigation, data entry, customer portal management, inventory, and scheduling.',
  icon: LayoutGrid,
  accentColor: 'text-teal-400',
  accentGradient: 'from-teal-500/20 to-cyan-500/20',
  borderColor: 'border-teal-500/30',
  sections: [
    {
      id: 'admin-dashboard',
      number: 1,
      title: 'Admin Dashboard & Navigation',
      description: 'Learn the layout of the admin portal and how to find everything you need quickly.',
      icon: LayoutGrid,
      iconColor: 'text-teal-400',
      steps: [
        {
          title: 'Portal Layout',
          bullets: [
            'The admin portal is your daily workspace — access it at /portal/admin.',
            'The sidebar navigation organizes everything by category: Dashboard, Leads, Billing, Inventory, Calendar, Reports.',
            'The top bar shows your name, notifications bell, and quick-action buttons.',
            'Use the Command Center for a high-level overview of all operations.',
          ],
          tryItLink: { label: 'Open Admin Portal', href: '/portal/admin' },
        },
        {
          title: 'Quick Actions',
          bullets: [
            'Create a new lead, delivery ticket, or calendar event from any page using the "+" button.',
            'The search bar at the top lets you find customers, leads, and tickets by name or ID.',
            'Keyboard shortcut: press "/" to focus the search bar instantly.',
            'Recent items are saved in your quick-access history for easy return.',
          ],
        },
        {
          title: 'Settings & Preferences',
          bullets: [
            'Access your settings from the gear icon in the top-right corner.',
            'Configure notification preferences to control what alerts you receive.',
            'Set your default calendar view (month, week, or day).',
            'Adjust display preferences like compact vs. expanded table views.',
          ],
          tip: 'Pin your most-used pages to the sidebar favorites for one-click access.',
        },
      ],
    },
    {
      id: 'data-entry',
      number: 2,
      title: 'Data Entry & Records',
      description: 'Entering leads, updating customer records, and maintaining data accuracy.',
      icon: Database,
      iconColor: 'text-blue-400',
      steps: [
        {
          title: 'Adding New Leads Manually',
          bullets: [
            'Click "New Lead" from the lead dashboard or use the quick-action button.',
            'Required fields: name, phone number, address, and lead source.',
            'Optional fields: email, notes, preferred contact time, and referral source.',
            'The system auto-checks for duplicate addresses to prevent double entries.',
          ],
          tryItLink: { label: 'View Lead Dashboard', href: '/portal/admin/leads' },
        },
        {
          title: 'Updating Customer Records',
          bullets: [
            'Search for the customer by name, phone, or address.',
            'Click the customer record to open the detail view.',
            'Update contact info, add notes, or change the assigned rep.',
            'All changes are logged with timestamps for audit trail purposes.',
          ],
        },
        {
          title: 'Data Quality Tips',
          bullets: [
            'Always use proper capitalization for names and addresses.',
            'Verify phone numbers have 10 digits and include area code.',
            'Add lead source accurately — this powers the marketing analytics.',
            'Include notes about customer preferences or special circumstances.',
          ],
          tip: 'If a customer calls and you can\'t find their record, search by phone number — it\'s usually the most reliable field.',
        },
      ],
    },
    {
      id: 'customer-portal-mgmt',
      number: 3,
      title: 'Customer Portal Management',
      description: 'Help customers with portal access, share documents, and manage their experience.',
      icon: Users,
      iconColor: 'text-violet-400',
      steps: [
        {
          title: 'Customer Portal Basics',
          bullets: [
            'Each customer gets a portal page where they can track their job progress.',
            'The portal shows: job timeline, weather alerts, upcoming appointments, messages, and documents.',
            'Customers access their portal via a unique token link — no password needed.',
            'You can preview what the customer sees from the admin side.',
          ],
          tryItLink: { label: 'Customer Portal', href: '/portal/customer' },
        },
        {
          title: 'Sharing Portal Links',
          bullets: [
            'Generate a customer portal link from their job detail page.',
            'Send the link via text or email — the customer clicks it to access their portal.',
            'Portal links are tied to the customer\'s job and don\'t expire.',
            'If a customer has multiple jobs, each one gets its own portal link.',
          ],
        },
        {
          title: 'Uploading Documents',
          bullets: [
            'Upload inspection photos, contracts, and reports to the customer\'s portal.',
            'Supported file types: PDF, JPG, PNG — max 10MB per file.',
            'Organize documents by category: Contracts, Photos, Reports, Insurance.',
            'Customers receive a notification when new documents are added.',
          ],
        },
        {
          title: 'Handling Customer Questions',
          bullets: [
            'Customer messages come through the portal messaging system.',
            'Respond to messages within the platform for a complete communication history.',
            'For urgent questions, note the customer\'s phone number and call directly.',
            'Escalate technical or pricing questions to the assigned rep or manager.',
          ],
          tip: 'When a customer calls asking about their job, pull up their portal page — it has everything you need to answer their questions.',
        },
      ],
    },
    {
      id: 'inventory',
      number: 4,
      title: 'Inventory & Material Orders',
      description: 'Track stock levels, process material orders, and manage warehouse inventory.',
      icon: Boxes,
      iconColor: 'text-amber-400',
      steps: [
        {
          title: 'Checking Inventory Levels',
          bullets: [
            'Navigate to Admin > Inventory to see current stock levels.',
            'Items are organized by category: Shingles, Underlayment, Flashing, Accessories.',
            'Low-stock items are highlighted in amber; out-of-stock items show in red.',
            'Click any item to see transaction history and recent usage.',
          ],
          tryItLink: { label: 'View Inventory', href: '/portal/admin/inventory' },
        },
        {
          title: 'Processing Material Orders',
          bullets: [
            'Material orders are typically created by sales reps or production managers.',
            'Review the order details: items, quantities, delivery address, and scheduled date.',
            'Confirmed orders automatically generate a delivery ticket.',
            'Track order status from placement to delivery completion.',
          ],
        },
        {
          title: 'Inventory Adjustments',
          bullets: [
            'Record inventory adjustments for returns, damaged goods, or manual counts.',
            'Each adjustment requires a reason code: Return, Damage, Count Correction, Other.',
            'Adjustments are logged with your name and timestamp for accountability.',
            'Run monthly inventory counts to keep digital records accurate.',
          ],
          tip: 'Check the low-stock alert list at the start of each week to flag items that need reordering.',
        },
      ],
    },
    {
      id: 'scheduling',
      number: 5,
      title: 'Scheduling & Coordination',
      description: 'Manage the team calendar, coordinate appointments, and handle scheduling conflicts.',
      icon: CalendarClock,
      iconColor: 'text-cyan-400',
      steps: [
        {
          title: 'Calendar Management',
          bullets: [
            'Access the team calendar from Admin > Calendar.',
            'All team events, inspections, deliveries, and meetings appear here.',
            'Use the team view to see everyone\'s schedule at once.',
            'Click any time slot to create a new event.',
          ],
          tryItLink: { label: 'Open Calendar', href: '/portal/admin/calendar' },
        },
        {
          title: 'Scheduling Appointments',
          bullets: [
            'When scheduling a customer appointment, check the rep\'s availability first.',
            'Create the event with: customer name, address, rep, type (inspection/meeting/delivery).',
            'The system generates a Google Calendar link — send it to both the rep and customer.',
            'Set appropriate reminders: 1 day before and 1 hour before.',
          ],
        },
        {
          title: 'Handling Conflicts & Reschedules',
          bullets: [
            'The calendar highlights scheduling conflicts with a red warning badge.',
            'When rescheduling, update both the calendar event and notify the customer.',
            'For rain delays on inspections, check the weather widget and proactively reschedule.',
            'Keep a note on rescheduled appointments about the reason for the change.',
          ],
          tip: 'Review tomorrow\'s full schedule at 4 PM each day. Confirm appointments and catch conflicts before they become problems.',
        },
      ],
    },
  ],
};
