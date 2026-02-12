import {
  Crown,
  TrendingUp,
  DollarSign,
  Users,
  Boxes,
  Settings,
  Megaphone,
} from 'lucide-react';
import type { WalkthroughData } from './types';

export const michaelWalkthrough: WalkthroughData = {
  slug: 'michael',
  name: 'Michael',
  role: 'VP / Owner',
  greeting: 'Welcome, Michael! Here\'s your full-admin overview of every RoofStack system.',
  description: 'Full HQ overview, sales operations, financial management, team oversight, inventory, admin settings, and marketing analytics.',
  icon: Crown,
  accentColor: 'text-brand-green',
  accentGradient: 'from-brand-green/20 to-emerald-500/20',
  borderColor: 'border-brand-green/30',
  sections: [
    {
      id: 'hq-overview',
      number: 1,
      title: 'RoofStack HQ Overview',
      description: 'Your master control panel — the full Command Center with all dashboards and systems.',
      icon: Crown,
      iconColor: 'text-brand-green',
      steps: [
        {
          title: 'Command Center Navigation',
          bullets: [
            'The Command Center at /command-center is the operational hub for the entire company.',
            'Top-level KPIs show: revenue, active jobs, pipeline value, team activity, and lead flow.',
            'The sidebar gives you access to every subsystem: Owner Dashboard, Manager Dashboard, Leaderboard, Reports.',
            'Quick-action buttons let you jump to any section without navigating through menus.',
          ],
          tryItLink: { label: 'Open Command Center', href: '/command-center' },
        },
        {
          title: 'Owner Dashboard',
          bullets: [
            'The Owner Dashboard shows executive-level KPIs with trend indicators.',
            'Revenue, profit margins, close rates, and growth metrics are all here.',
            'Compare current period vs. previous period with automatic trend analysis.',
            'The insights panel highlights anomalies and opportunities worth your attention.',
          ],
          tryItLink: { label: 'Owner Dashboard', href: '/command-center/owner' },
        },
        {
          title: 'Manager Dashboard',
          bullets: [
            'The Manager Dashboard focuses on operational metrics and team performance.',
            'See real-time team activity: who\'s working leads, who\'s in the field, who\'s idle.',
            'Operational bottlenecks are highlighted: stale leads, delayed deliveries, overdue invoices.',
            'Use this view for daily standup meetings and weekly team reviews.',
          ],
          tryItLink: { label: 'Manager Dashboard', href: '/command-center/manager' },
        },
      ],
    },
    {
      id: 'sales-ops',
      number: 2,
      title: 'Sales Operations',
      description: 'Lead management, pipeline oversight, rep performance, and sales strategy.',
      icon: TrendingUp,
      iconColor: 'text-blue-400',
      steps: [
        {
          title: 'Lead Flow Management',
          bullets: [
            'Monitor all incoming leads from every source: website, referrals, Check My Address, manual entry.',
            'The lead dashboard shows assignment status, response times, and conversion rates.',
            'Identify bottlenecks: unassigned leads, slow follow-ups, stale pipeline items.',
            'Use the quick-assign tool to distribute leads efficiently across the team.',
          ],
          tryItLink: { label: 'View Lead Dashboard', href: '/portal/admin/leads' },
        },
        {
          title: 'Rep Performance Comparison',
          bullets: [
            'The leaderboard ranks all reps by revenue, close rate, and activity metrics.',
            'Click any rep to see their full performance profile with detailed stats.',
            'Compare two reps side-by-side using the comparison tool.',
            'Identify coaching opportunities: high volume but low close rate needs technique work.',
          ],
          tryItLink: { label: 'View Leaderboard', href: '/command-center/leaderboard' },
        },
        {
          title: 'JobNimbus Sync',
          bullets: [
            'RoofStack maintains bi-directional sync with JobNimbus for contacts, jobs, and notes.',
            'The sync engine runs automatically — check the sync status page for health monitoring.',
            'If sync issues arise, the dashboard shows alerts with resolution steps.',
            'Commission calculations pull from synced job data for accurate payroll.',
          ],
        },
      ],
    },
    {
      id: 'financial',
      number: 3,
      title: 'Financial Management',
      description: 'Revenue tracking, invoicing, commission management, and financial reporting.',
      icon: DollarSign,
      iconColor: 'text-green-400',
      steps: [
        {
          title: 'Revenue & Profitability',
          bullets: [
            'Track total revenue, cost of goods sold, and profit margins across all jobs.',
            'Break down revenue by: job type, territory, rep, and time period.',
            'The owner dashboard shows month-over-month and year-over-year growth trends.',
            'Set revenue targets and track progress against goals.',
          ],
        },
        {
          title: 'Billing & Invoicing',
          bullets: [
            'The billing dashboard shows all invoices: draft, sent, paid, and overdue.',
            'Approve invoices before they\'re sent to customers for quality control.',
            'Track payment aging: 30, 60, 90 day buckets for accounts receivable.',
            'Download financial exports for your accountant or bookkeeper.',
          ],
          tryItLink: { label: 'View Billing', href: '/portal/admin/billing' },
        },
        {
          title: 'Commission Management',
          bullets: [
            'Commission calculations are automatic based on job value and rep assignment.',
            'Review commission reports before payroll processing.',
            'Handle splits for co-sold deals and referral bonuses.',
            'Historical commission data is available for tax and record-keeping purposes.',
          ],
        },
        {
          title: 'Financial Reports',
          bullets: [
            'Pull comprehensive financial reports from Command Center > Reports.',
            'Available reports: P&L Summary, Revenue by Rep, Commission Detail, AR Aging.',
            'Export reports as PDF or CSV for external accounting software.',
            'Schedule recurring reports for automatic generation and email delivery.',
          ],
          tryItLink: { label: 'View Reports', href: '/command-center/reports/team' },
          tip: 'Review the financial dashboard weekly on Mondays. Catch issues early — a missed invoice today becomes a cash flow problem next month.',
        },
      ],
    },
    {
      id: 'team',
      number: 4,
      title: 'Team Management',
      description: 'Team performance, hiring, training oversight, and communication tools.',
      icon: Users,
      iconColor: 'text-violet-400',
      steps: [
        {
          title: 'Team Overview',
          bullets: [
            'View all team members, their roles, and current activity from the team management section.',
            'Performance dashboards show each person\'s key metrics for their role.',
            'Use the team calendar to see everyone\'s schedule and availability.',
            'Access employee directory with contact info and role details.',
          ],
        },
        {
          title: 'Training Oversight',
          bullets: [
            'Monitor training progress for every team member from the training hub.',
            'The RoofStack Academy tracks module completion, quiz scores, and certifications.',
            'Ensure new hires complete onboarding within their first two weeks.',
            'These personalized walkthroughs are part of the training ecosystem — track who\'s completed theirs.',
          ],
          tryItLink: { label: 'Training Hub', href: '/portal/training' },
        },
        {
          title: 'Team Communication',
          bullets: [
            'GroupMe chat is integrated into the portal for team messaging.',
            'Use @mentions to get specific team members\' attention.',
            'The floating chat widget is available on every portal page.',
            'Direct messages are available for private conversations.',
          ],
          tryItLink: { label: 'Open Team Chat', href: '/portal/chat' },
        },
        {
          title: 'Performance Reviews',
          bullets: [
            'Use the team reports to prepare for performance conversations.',
            'Compare individual metrics against team averages and targets.',
            'Track improvement over time with historical performance data.',
            'Document coaching sessions and action items in the system.',
          ],
          tip: 'Hold a weekly 15-minute 1:1 with each direct report. Use their RoofStack metrics as the agenda — it keeps conversations data-driven and productive.',
        },
      ],
    },
    {
      id: 'inventory-admin',
      number: 5,
      title: 'Inventory & Operations',
      description: 'Warehouse operations, stock management, delivery oversight, and supply chain.',
      icon: Boxes,
      iconColor: 'text-amber-400',
      steps: [
        {
          title: 'Inventory Management',
          bullets: [
            'The inventory system tracks all materials by category, brand, and quantity.',
            'Low-stock alerts trigger automatically when items fall below reorder points.',
            'Transaction history shows every movement: incoming orders, outgoing deliveries, adjustments.',
            'Monthly inventory counts keep digital records aligned with physical stock.',
          ],
          tryItLink: { label: 'View Inventory', href: '/portal/admin/inventory' },
        },
        {
          title: 'Delivery Operations',
          bullets: [
            'Monitor all active deliveries from the delivery dashboard.',
            'Track driver locations and delivery statuses in real time.',
            'Review delivery performance: on-time rate, customer satisfaction, damage incidents.',
            'The loading checklist ensures consistent quality for every delivery.',
          ],
          tryItLink: { label: 'Delivery Dashboard', href: '/portal/delivery' },
        },
        {
          title: 'Supply Chain',
          bullets: [
            'Track supplier pricing and compare against budget estimates.',
            'Monitor material costs over time to catch price increases early.',
            'Maintain relationships with multiple suppliers for competitive pricing.',
            'Order in bulk for common items to reduce per-unit costs.',
          ],
          tip: 'Review inventory levels and delivery performance every Friday. Weekend planning prevents Monday morning surprises.',
        },
      ],
    },
    {
      id: 'admin-settings',
      number: 6,
      title: 'Admin & Platform Settings',
      description: 'User management, system configuration, permissions, and platform administration.',
      icon: Settings,
      iconColor: 'text-neutral-400',
      steps: [
        {
          title: 'User Management',
          bullets: [
            'Add, edit, and deactivate user accounts from the admin section.',
            'Assign roles and permissions: Admin, Manager, Sales, Driver, Office.',
            'Reset passwords and manage login credentials.',
            'Review login activity for security monitoring.',
          ],
        },
        {
          title: 'System Configuration',
          bullets: [
            'Configure notification preferences, email templates, and automation rules.',
            'Manage integration settings: JobNimbus, Google Calendar, GroupMe, TeamUp.',
            'Set up feature flags to enable/disable features for specific roles.',
            'Environment variables and API keys are managed in the deployment settings.',
          ],
        },
        {
          title: 'Security & Permissions',
          bullets: [
            'The portal uses JWT authentication with role-based access control.',
            'Admin sessions have configurable timeouts for security.',
            'Rate limiting protects against brute-force login attempts.',
            'HMAC webhook verification ensures data integrity from external services.',
          ],
        },
        {
          title: 'Platform Health',
          bullets: [
            'Monitor API response times and error rates from the Vercel dashboard.',
            'Google Sheets backend has rate limits — monitor usage during peak times.',
            'Check deployment status after code updates to verify successful builds.',
            'Review the PUNCHOUT-LIST.md for known issues and planned improvements.',
          ],
          tip: 'Set up Vercel deployment notifications so you know immediately when builds succeed or fail.',
        },
      ],
    },
    {
      id: 'marketing-analytics',
      number: 7,
      title: 'Marketing & Analytics',
      description: 'Website analytics, lead source performance, SEO monitoring, and campaign ROI.',
      icon: Megaphone,
      iconColor: 'text-fuchsia-400',
      steps: [
        {
          title: 'Website Analytics',
          bullets: [
            'Google Analytics (G-Y8PB85BZC5) tracks all website traffic and user behavior.',
            'Monitor top pages, traffic sources, and conversion paths.',
            'The website has 367+ pages — track which content drives the most leads.',
            'Check real-time analytics during active campaigns and after social media posts.',
          ],
        },
        {
          title: 'Lead Source Performance',
          bullets: [
            'Every lead is tagged with a source for attribution tracking.',
            'Compare sources by volume, conversion rate, and cost-per-acquisition.',
            'The Check My Address tool is a key lead generation channel — monitor its performance.',
            'Referral leads typically have the highest conversion rate — invest in your referral program.',
          ],
        },
        {
          title: 'SEO & Content',
          bullets: [
            'All public pages have JSON-LD structured data for search engine optimization.',
            'Service area pages target local keywords for each city and county.',
            'Blog content drives organic traffic — monitor top-performing posts.',
            'Track search ranking improvements for target keywords monthly.',
          ],
        },
        {
          title: 'Campaign ROI',
          bullets: [
            'Calculate ROI for each marketing campaign: (Revenue - Cost) / Cost.',
            'Track campaigns from spend to lead to close for true cost-per-acquisition.',
            'Compare digital vs. traditional marketing channels for budget allocation.',
            'Share ROI reports with Boston for collaborative marketing strategy planning.',
          ],
          tip: 'Marketing ROI is measured in months, not days. Give campaigns at least 30 days before evaluating performance, but monitor leading indicators (traffic, leads) weekly.',
        },
      ],
    },
  ],
};
