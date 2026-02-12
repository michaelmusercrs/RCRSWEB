import {
  BarChart3,
  Users,
  DollarSign,
  UserCheck,
  Calendar,
} from 'lucide-react';
import type { WalkthroughData } from './types';

export const chrisWalkthrough: WalkthroughData = {
  slug: 'chris',
  name: 'Chris',
  role: 'President',
  greeting: 'Welcome, Chris! Here\'s your executive overview of RoofStack.',
  description: 'High-level KPIs, team performance, financial reports, lead approvals, and calendar management.',
  icon: BarChart3,
  accentColor: 'text-amber-400',
  accentGradient: 'from-amber-500/20 to-orange-500/20',
  borderColor: 'border-amber-500/30',
  sections: [
    {
      id: 'kpis',
      number: 1,
      title: 'Executive KPI Dashboard',
      description: 'Your bird\'s-eye view of company performance — revenue, close rates, and team metrics at a glance.',
      icon: BarChart3,
      iconColor: 'text-amber-400',
      steps: [
        {
          title: 'Accessing the Owner Dashboard',
          bullets: [
            'Navigate to Command Center > Owner Dashboard from the sidebar.',
            'The top row shows real-time KPIs: total revenue, active jobs, close rate, and average ticket size.',
            'Trend arrows show week-over-week changes — green up is good, red down needs attention.',
            'Click any KPI card to drill into the detailed breakdown.',
          ],
          tryItLink: { label: 'Open Owner Dashboard', href: '/command-center/owner' },
        },
        {
          title: 'Revenue & Pipeline Overview',
          bullets: [
            'The revenue chart shows monthly actuals vs. targets with a 12-month rolling view.',
            'Pipeline value shows total dollar amount of leads in each stage.',
            'Use the date range picker to compare different periods.',
            'Export any chart as a report using the download button in the top-right corner.',
          ],
        },
        {
          title: 'Quick Actions from the Dashboard',
          bullets: [
            'Approve pending leads directly from the dashboard notification badge.',
            'View flagged items that need your attention in the alerts panel.',
            'Jump to any team member\'s performance page from the team summary cards.',
          ],
          tip: 'Bookmark the Owner Dashboard as your browser homepage for instant access every morning.',
        },
      ],
    },
    {
      id: 'team-performance',
      number: 2,
      title: 'Team Performance & Reports',
      description: 'Track individual and team metrics, compare reps, and identify coaching opportunities.',
      icon: Users,
      iconColor: 'text-blue-400',
      steps: [
        {
          title: 'Team Leaderboard',
          bullets: [
            'The leaderboard ranks all sales reps by revenue, close rate, and activity score.',
            'Toggle between weekly, monthly, and quarterly views.',
            'Click a rep\'s name to see their full performance profile.',
            'Use the comparison tool to stack two reps side by side.',
          ],
          tryItLink: { label: 'View Leaderboard', href: '/command-center/leaderboard' },
        },
        {
          title: 'Team Reports',
          bullets: [
            'Navigate to Command Center > Reports > Team for the printable team performance report.',
            'Reports include: leads assigned, inspections completed, jobs sold, revenue generated.',
            'Filter by date range, rep, or territory for targeted analysis.',
            'Schedule automatic weekly report emails from the report settings.',
          ],
          tryItLink: { label: 'View Team Reports', href: '/command-center/reports/team' },
        },
        {
          title: 'Identifying Coaching Opportunities',
          bullets: [
            'Look for reps with high lead volume but low close rates — they may need sales coaching.',
            'Check average time-to-close to spot reps who may be stalling in the pipeline.',
            'Review the activity log to ensure reps are making follow-up calls and site visits.',
          ],
          tip: 'Set a recurring Monday morning review of the team leaderboard to start each week informed.',
        },
      ],
    },
    {
      id: 'financial',
      number: 3,
      title: 'Financial Reports',
      description: 'Revenue tracking, commission calculations, and financial summaries.',
      icon: DollarSign,
      iconColor: 'text-green-400',
      steps: [
        {
          title: 'Revenue Dashboard',
          bullets: [
            'The financial dashboard shows total revenue, expenses, and profit margins.',
            'Break down revenue by source: insurance claims, retail, commercial.',
            'View commission summaries for each rep to verify payroll accuracy.',
            'Compare month-over-month and year-over-year growth trends.',
          ],
          tryItLink: { label: 'View Financial Dashboard', href: '/command-center/owner' },
        },
        {
          title: 'Invoice & Billing Management',
          bullets: [
            'Review pending invoices from the billing section.',
            'Approve or flag invoices that need attention before sending to customers.',
            'Track payment status: sent, viewed, paid, overdue.',
            'Export financial data for your accountant or bookkeeper.',
          ],
          tryItLink: { label: 'View Billing', href: '/portal/admin/billing' },
        },
        {
          title: 'Commission Tracking',
          bullets: [
            'View commission calculations per rep in the sales reports section.',
            'Commissions are auto-calculated based on job value and rep assignment.',
            'Verify commission splits for co-sold deals.',
            'Download commission reports for payroll processing.',
          ],
        },
      ],
    },
    {
      id: 'lead-approvals',
      number: 4,
      title: 'Lead Management & Approvals',
      description: 'Review incoming leads, approve assignments, and monitor the sales pipeline.',
      icon: UserCheck,
      iconColor: 'text-purple-400',
      steps: [
        {
          title: 'Reviewing Incoming Leads',
          bullets: [
            'New leads appear in the Lead Dashboard with source, contact info, and location.',
            'Leads come from: website forms, Check My Address, referrals, and manual entry.',
            'Each lead shows a quality score based on location, storm data, and engagement.',
            'High-priority leads are flagged with an urgent badge for immediate attention.',
          ],
          tryItLink: { label: 'View Lead Dashboard', href: '/portal/admin/leads' },
        },
        {
          title: 'Approving & Assigning Leads',
          bullets: [
            'Use the quick-assign dropdown to assign a lead to the best available rep.',
            'Consider territory, workload, and expertise when assigning.',
            'The rep receives an instant notification with the lead details.',
            'Track assignment-to-contact time in the lead metrics.',
          ],
        },
        {
          title: 'Pipeline Monitoring',
          bullets: [
            'The pipeline view shows leads grouped by stage: New, Contacted, Inspected, Quoted, Sold, Lost.',
            'Drag and drop leads between stages for quick updates.',
            'Set follow-up reminders on leads that have been idle too long.',
            'Review lost leads periodically to identify patterns and improve win rates.',
          ],
          tip: 'Check the lead dashboard every morning and after lunch to ensure nothing sits unassigned for more than 30 minutes.',
        },
      ],
    },
    {
      id: 'calendar',
      number: 5,
      title: 'Calendar & Scheduling',
      description: 'Manage your calendar, view team schedules, and coordinate appointments.',
      icon: Calendar,
      iconColor: 'text-cyan-400',
      steps: [
        {
          title: 'Your Calendar View',
          bullets: [
            'Access the calendar from the sidebar or Command Center.',
            'Toggle between month, week, and day views.',
            'Your calendar syncs with Google Calendar for a unified schedule.',
            'Color-coded events: blue for meetings, green for inspections, orange for deliveries.',
          ],
          tryItLink: { label: 'Open Calendar', href: '/portal/admin/calendar' },
        },
        {
          title: 'Team Schedule Overview',
          bullets: [
            'View all team members\' schedules on a single view using the team calendar toggle.',
            'Check for scheduling conflicts before booking new appointments.',
            'See who\'s available for emergency inspections or site visits.',
            'Filter by team member or event type to find what you need.',
          ],
        },
        {
          title: 'Creating Events',
          bullets: [
            'Click any time slot to create a new event.',
            'Events generate Google Calendar links that can be shared with clients.',
            'Add attendees to automatically send calendar invites.',
            'Set reminders for important meetings and deadlines.',
          ],
          tip: 'Block off "Dashboard Review" time each morning on your calendar so you consistently start the day with data.',
        },
      ],
    },
  ],
};
