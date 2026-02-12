import {
  TrendingUp,
  Filter,
  Building2,
  ClipboardList,
  Trophy,
  GraduationCap,
} from 'lucide-react';
import type { WalkthroughData } from './types';

export const salesWalkthrough: WalkthroughData = {
  slug: 'sales',
  name: 'Brendon, Greg & Travis',
  role: 'Sales Team',
  greeting: 'Hey sales team! Here\'s your guide to crushing it with RoofStack.',
  description: 'Sales dashboard, lead pipeline, CRM/JobNimbus integration, inspections, leaderboard, and training.',
  icon: TrendingUp,
  accentColor: 'text-brand-green',
  accentGradient: 'from-brand-green/20 to-emerald-500/20',
  borderColor: 'border-brand-green/30',
  sections: [
    {
      id: 'sales-dashboard',
      number: 1,
      title: 'Sales Dashboard',
      description: 'Your personal sales hub — see your numbers, assigned leads, and daily priorities.',
      icon: TrendingUp,
      iconColor: 'text-brand-green',
      steps: [
        {
          title: 'Your Sales Overview',
          bullets: [
            'The Command Center shows your personal sales KPIs: revenue, close rate, pipeline value.',
            'Today\'s action items appear at the top: follow-ups due, new leads assigned, inspections scheduled.',
            'Your monthly target and progress toward it are displayed as a progress bar.',
            'Click "My Leads" to see only your assigned leads and their current status.',
          ],
          tryItLink: { label: 'Open Command Center', href: '/command-center' },
        },
        {
          title: 'Daily Workflow',
          bullets: [
            'Morning: Check for new leads assigned to you overnight.',
            'Review today\'s scheduled inspections and customer follow-ups.',
            'Update lead statuses as you make progress throughout the day.',
            'Evening: Log notes on all customer interactions and set tomorrow\'s follow-ups.',
          ],
        },
        {
          title: 'Mobile Access',
          bullets: [
            'Access RoofStack from your phone\'s browser — it\'s fully responsive.',
            'Update lead status and add notes from the field.',
            'Take and upload inspection photos directly from your device.',
            'Receive push notifications for new lead assignments.',
          ],
          tip: 'Set a 15-minute morning routine: check new leads, review today\'s schedule, and prioritize your top 3 actions. This single habit will boost your close rate.',
        },
      ],
    },
    {
      id: 'lead-pipeline',
      number: 2,
      title: 'Lead Pipeline',
      description: 'Managing your leads from first contact to closed deal.',
      icon: Filter,
      iconColor: 'text-blue-400',
      steps: [
        {
          title: 'New Lead Notifications',
          bullets: [
            'When a lead is assigned to you, you receive a notification with their details.',
            'Lead info includes: name, phone, email, address, source, and storm/hail data if available.',
            'Contact new leads within 30 minutes of assignment — speed to lead is everything.',
            'Log your first contact attempt in the lead notes immediately.',
          ],
        },
        {
          title: 'Working Your Pipeline',
          bullets: [
            'Advance leads through stages: New → Contacted → Inspected → Quoted → Sold.',
            'Update status after every meaningful interaction.',
            'Add detailed notes: what was discussed, customer concerns, next steps.',
            'Set follow-up dates for every lead that isn\'t closed or lost.',
          ],
          tryItLink: { label: 'View Lead Dashboard', href: '/portal/admin/leads' },
        },
        {
          title: 'Following Up Effectively',
          bullets: [
            'The system flags leads that haven\'t been contacted in 48+ hours.',
            'Use the "My Follow-ups" view to see all leads needing attention.',
            'Vary your follow-up methods: call, text, email, door knock.',
            'After 5 unsuccessful contact attempts, escalate to the office for a different approach.',
          ],
        },
        {
          title: 'Closing the Sale',
          bullets: [
            'When a customer is ready, update the lead to "Sold" with the contract value.',
            'Upload the signed contract to the customer\'s portal documents.',
            'The production team is automatically notified when a job is sold.',
            'Your commission is calculated automatically based on the job value.',
          ],
          tip: 'The #1 predictor of close rate is speed to first contact. Leads contacted within 15 minutes close at 3x the rate of those contacted after 1 hour.',
        },
      ],
    },
    {
      id: 'crm-jobnimbus',
      number: 3,
      title: 'CRM & JobNimbus',
      description: 'How RoofStack syncs with JobNimbus for contacts, jobs, and status updates.',
      icon: Building2,
      iconColor: 'text-violet-400',
      steps: [
        {
          title: 'JobNimbus Integration',
          bullets: [
            'RoofStack syncs bi-directionally with JobNimbus — changes flow both ways.',
            'Customer contacts, jobs, notes, and status updates sync automatically.',
            'You can work in either system, but RoofStack has more features and better mobile UX.',
            'The sync runs periodically, so changes may take a few minutes to appear in both systems.',
          ],
        },
        {
          title: 'Managing Contacts',
          bullets: [
            'Customer contact info is maintained in JobNimbus and synced to RoofStack.',
            'Add new contacts in either system — they\'ll sync to the other.',
            'Keep contact info accurate: phone, email, and address are used for notifications and scheduling.',
            'Flag duplicate contacts for the office to merge.',
          ],
        },
        {
          title: 'Job Status Sync',
          bullets: [
            'When you update a job status in RoofStack, it pushes to JobNimbus automatically.',
            'Status mapping ensures consistent tracking across both platforms.',
            'Notes added in RoofStack also sync to the JobNimbus job record.',
            'If you see a sync discrepancy, report it to the office — they can trigger a manual sync.',
          ],
          tip: 'Make RoofStack your primary tool for daily work — it has everything you need in one place and syncs back to JobNimbus automatically.',
        },
      ],
    },
    {
      id: 'inspections',
      number: 4,
      title: 'Inspections & Site Visits',
      description: 'Scheduling inspections, documenting damage, and creating estimates.',
      icon: ClipboardList,
      iconColor: 'text-amber-400',
      steps: [
        {
          title: 'Scheduling an Inspection',
          bullets: [
            'When a lead is ready for inspection, schedule it through the calendar.',
            'The system sends the customer a Google Calendar link with the appointment details.',
            'Check weather forecasts before scheduling — avoid rainy days for roof inspections.',
            'Allow at least 1.5 hours per inspection including drive time.',
          ],
          tryItLink: { label: 'Open Calendar', href: '/portal/admin/calendar' },
        },
        {
          title: 'On-Site Inspection Process',
          bullets: [
            'Introduce yourself and explain the inspection process to the homeowner.',
            'Document all damage with detailed photos — roof, gutters, siding, fences.',
            'Use a systematic approach: start at one corner and work around the entire property.',
            'Note the roof\'s age, material type, and overall condition.',
          ],
        },
        {
          title: 'Creating the Estimate',
          bullets: [
            'After the inspection, create a detailed estimate in the system.',
            'Include: scope of work, materials, timeline, and pricing.',
            'Upload all inspection photos to the customer\'s portal.',
            'Present the estimate to the customer within 24 hours of the inspection.',
          ],
        },
        {
          title: 'Insurance Claims',
          bullets: [
            'For storm damage, guide the customer through the insurance claim process.',
            'Document all damage thoroughly — insurance adjusters rely on your photos and notes.',
            'Coordinate with the insurance adjuster for the joint inspection.',
            'Bart handles claim management — loop him in for complex claims.',
          ],
          tip: 'Take more photos than you think you need. 50 detailed photos is better than 10 vague ones. Insurance adjusters and customers both appreciate thoroughness.',
        },
      ],
    },
    {
      id: 'leaderboard',
      number: 5,
      title: 'Leaderboard & Competition',
      description: 'Track your ranking, compete with teammates, and earn recognition.',
      icon: Trophy,
      iconColor: 'text-yellow-400',
      steps: [
        {
          title: 'The Sales Leaderboard',
          bullets: [
            'The leaderboard ranks all sales reps by key metrics.',
            'Primary ranking: total revenue generated this period.',
            'Secondary metrics: close rate, leads worked, inspections completed.',
            'Toggle between weekly, monthly, and quarterly views.',
          ],
          tryItLink: { label: 'View Leaderboard', href: '/command-center/leaderboard' },
        },
        {
          title: 'Your Performance Metrics',
          bullets: [
            'Revenue: total dollar value of jobs you\'ve closed.',
            'Close Rate: percentage of assigned leads that become sold jobs.',
            'Activity Score: based on calls made, follow-ups sent, inspections completed.',
            'Speed-to-Lead: average time from lead assignment to first contact.',
          ],
        },
        {
          title: 'Climbing the Ranks',
          bullets: [
            'Focus on speed-to-lead — it\'s the highest-leverage metric you can control.',
            'Keep your pipeline clean — update statuses and close out dead leads.',
            'Follow up consistently — most deals close after the 3rd-5th contact.',
            'Ask for referrals from every happy customer to build your own lead pipeline.',
          ],
          tip: 'Check the leaderboard every morning. Healthy competition makes everyone better. If you\'re not #1, study what the top performer is doing differently.',
        },
      ],
    },
    {
      id: 'training',
      number: 6,
      title: 'Sales Training & Development',
      description: 'Ongoing training resources, certifications, and skill development.',
      icon: GraduationCap,
      iconColor: 'text-purple-400',
      steps: [
        {
          title: 'Sales Training Program',
          bullets: [
            'The 7-module sales training program covers everything from roofing basics to closing techniques.',
            'Complete all modules and pass the quizzes (70%+ to pass) to earn your certification.',
            'Training is self-paced — work through it during downtime or scheduled training blocks.',
            'Your progress is tracked and visible to management.',
          ],
          tryItLink: { label: 'Start Sales Training', href: '/portal/training/sales' },
        },
        {
          title: 'Ongoing Development',
          bullets: [
            'New training modules are added regularly — check the training hub for updates.',
            'The Training Library has AI-generated deep dives on specific topics.',
            'RoofStack Academy offers gamified training with points and badges.',
            'Ask your manager about ride-alongs and mentorship opportunities.',
          ],
          tryItLink: { label: 'Training Hub', href: '/portal/training' },
        },
        {
          title: 'Certifications & Badges',
          bullets: [
            'Earn certifications by completing training programs and maintaining performance standards.',
            'Certifications show on your profile and in the team directory.',
            'Some certifications are required for specific activities (like insurance claim inspections).',
            'Recertification may be required annually — check your certificate expiration dates.',
          ],
          tip: 'Complete the sales training program within your first two weeks. The ROI on training time is massive — trained reps close 40% more than untrained ones.',
        },
      ],
    },
  ],
};
