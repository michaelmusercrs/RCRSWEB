import {
  HardHat,
  FileSpreadsheet,
  Package,
  Shield,
  CalendarDays,
} from 'lucide-react';
import type { WalkthroughData } from './types';

export const productionWalkthrough: WalkthroughData = {
  slug: 'production',
  name: 'John & Bart',
  role: 'Production & Claims',
  greeting: 'Hey John and Bart! Here\'s your guide to the production and claims tools.',
  description: 'Production dashboard, job breakdowns, material orders, insurance claims management, and scheduling.',
  icon: HardHat,
  accentColor: 'text-sky-400',
  accentGradient: 'from-sky-500/20 to-blue-500/20',
  borderColor: 'border-sky-500/30',
  sections: [
    {
      id: 'production-dashboard',
      number: 1,
      title: 'Production Dashboard',
      description: 'Your daily view of active jobs, production pipeline, and crew schedules.',
      icon: HardHat,
      iconColor: 'text-sky-400',
      steps: [
        {
          title: 'Dashboard Overview',
          bullets: [
            'The production section of Command Center shows all active jobs and their current status.',
            'Jobs are organized by stage: Sold, Materials Ordered, In Production, QC Complete.',
            'The timeline view shows when each job is scheduled for production.',
            'Red flags indicate jobs at risk of missing their scheduled dates.',
          ],
          tryItLink: { label: 'Open Command Center', href: '/command-center' },
        },
        {
          title: 'Job Pipeline',
          bullets: [
            'New sold jobs enter the production pipeline automatically when marked Sold by sales.',
            'Each job shows: customer name, address, scope of work, scheduled date, and assigned crew.',
            'Click any job to see the full detail view with breakdown, materials, and notes.',
            'Use filters to view by date range, status, or assigned crew.',
          ],
        },
        {
          title: 'Production Metrics',
          bullets: [
            'Track jobs completed per week/month to monitor production throughput.',
            'Average time from Sold to Production Start shows scheduling efficiency.',
            'Material order accuracy prevents job-site delays and costly returns.',
            'Customer satisfaction scores after job completion reveal quality trends.',
          ],
          tip: 'Review the production pipeline every morning. Focus on jobs scheduled for this week and next week to catch issues before they become problems.',
        },
      ],
    },
    {
      id: 'job-breakdowns',
      number: 2,
      title: 'Job Breakdowns & Costs',
      description: 'Creating detailed job breakdowns with materials, labor, and cost tracking.',
      icon: FileSpreadsheet,
      iconColor: 'text-green-400',
      steps: [
        {
          title: 'Creating a Job Breakdown',
          bullets: [
            'Navigate to the job detail page and click "Create Breakdown".',
            'The breakdown template auto-fills common line items based on job type.',
            'Add line items for: materials (by type and quantity), labor (by crew/hours), equipment, and overhead.',
            'Each line item has a cost and a customer-facing price for margin tracking.',
          ],
        },
        {
          title: 'Material Calculations',
          bullets: [
            'Calculate material quantities based on roof measurements and pitch.',
            'The system suggests material quantities for common roof sizes.',
            'Always add 10-15% waste factor for cuts, ridge caps, and unexpected damage.',
            'Special materials (custom colors, specialty products) need longer lead times.',
          ],
        },
        {
          title: 'Approval Workflow',
          bullets: [
            'Completed breakdowns go through an approval workflow before materials are ordered.',
            'Breakdowns over the standard threshold require manager or owner approval.',
            'Approved breakdowns lock the scope — changes require a change order.',
            'The approved breakdown becomes the basis for invoicing the customer.',
          ],
          tip: 'Double-check your material quantities before submitting for approval. An accurate breakdown prevents job-site delays and return trips to the supplier.',
        },
        {
          title: 'Cost Tracking',
          bullets: [
            'Actual costs are tracked against the breakdown estimate as the job progresses.',
            'Material costs update automatically as orders are placed and priced.',
            'Labor costs are logged based on crew assignments and hours worked.',
            'Variance reports show where jobs come in over or under budget.',
          ],
        },
      ],
    },
    {
      id: 'material-orders',
      number: 3,
      title: 'Material Orders & Delivery',
      description: 'Ordering materials, tracking deliveries, and coordinating with the warehouse.',
      icon: Package,
      iconColor: 'text-amber-400',
      steps: [
        {
          title: 'Placing Material Orders',
          bullets: [
            'From the approved job breakdown, click "Order Materials" to create a material order.',
            'The order auto-populates from the breakdown with the correct items and quantities.',
            'Review the order for accuracy — check quantities, brands, and colors.',
            'Submit the order to create a delivery ticket and notify the warehouse.',
          ],
          tryItLink: { label: 'View Inventory', href: '/portal/admin/inventory' },
        },
        {
          title: 'Tracking Deliveries',
          bullets: [
            'Material orders generate delivery tickets that appear in the delivery system.',
            'Track delivery status: Ordered → Warehouse → Loading → En Route → Delivered.',
            'Delivery notifications go to: office, driver, and customer automatically.',
            'Coordinate delivery timing with crew schedules for smooth production starts.',
          ],
        },
        {
          title: 'Handling Issues',
          bullets: [
            'If materials arrive damaged, document with photos and report immediately.',
            'Short shipments: note what\'s missing and order replacements urgently.',
            'Wrong materials: do not install — notify the office for a swap delivery.',
            'Keep a buffer inventory of common items for emergency situations.',
          ],
          tip: 'Order materials at least 3 business days before the scheduled production start. Rush orders cost more and risk availability issues.',
        },
      ],
    },
    {
      id: 'insurance-claims',
      number: 4,
      title: 'Insurance Claims Management',
      description: 'Managing insurance claims, adjuster coordination, and documentation (Bart\'s specialty).',
      icon: Shield,
      iconColor: 'text-purple-400',
      steps: [
        {
          title: 'Claim Initiation',
          bullets: [
            'Insurance claims start when a customer reports storm damage and files with their carrier.',
            'Document all damage thoroughly with photos, measurements, and detailed notes.',
            'Help the customer understand the claim process and timeline expectations.',
            'Track the claim number, insurance carrier, and adjuster assignment in the system.',
          ],
        },
        {
          title: 'Adjuster Coordination',
          bullets: [
            'Schedule the adjuster inspection and be present for the meeting.',
            'Walk the property with the adjuster, pointing out all documented damage.',
            'Provide your inspection report and photos to support the claim.',
            'If the adjuster misses damage, request a re-inspection with additional documentation.',
          ],
        },
        {
          title: 'Supplement Process',
          bullets: [
            'After the initial approval, review the adjuster\'s scope vs. actual damage.',
            'If additional work is needed, submit a supplement with documentation.',
            'Track supplement status: Submitted, Under Review, Approved, Denied.',
            'Supplements can take 2-4 weeks — set follow-up reminders and keep the customer informed.',
          ],
        },
        {
          title: 'Claim Documentation',
          bullets: [
            'Maintain a complete file for every claim: photos, reports, correspondence, approvals.',
            'Upload all documents to the customer\'s portal for transparency.',
            'Track deductible amounts and payment schedules.',
            'Close the claim file only after final payment is received and the job is 100% complete.',
          ],
          tip: 'Take 50+ photos per inspection for insurance claims. Over-documentation is far better than under-documentation when supplements are needed.',
        },
      ],
    },
    {
      id: 'production-scheduling',
      number: 5,
      title: 'Production Scheduling',
      description: 'Scheduling crews, coordinating with deliveries, and managing the production calendar.',
      icon: CalendarDays,
      iconColor: 'text-cyan-400',
      steps: [
        {
          title: 'Scheduling a Job',
          bullets: [
            'Once materials are ordered and a crew is available, schedule the production date.',
            'Create a calendar event with: job address, crew assignment, start time, and estimated duration.',
            'Verify that material delivery is scheduled before or on the production start date.',
            'Send the schedule to the crew lead and notify the customer of the production date.',
          ],
          tryItLink: { label: 'Open Calendar', href: '/portal/admin/calendar' },
        },
        {
          title: 'Crew Management',
          bullets: [
            'Assign crews based on job type, size, and crew availability.',
            'Check the team calendar for crew conflicts before scheduling.',
            'Factor in weather when scheduling — avoid scheduling multiple days for weather-sensitive work.',
            'Maintain a backup plan for weather delays to keep the pipeline moving.',
          ],
        },
        {
          title: 'Production Day Coordination',
          bullets: [
            'Confirm with the crew lead the evening before production.',
            'Verify materials are on-site and staged correctly.',
            'Be available by phone for any issues that arise during production.',
            'Do a final quality check when the crew reports completion.',
          ],
          tip: 'Build a 1-day weather buffer into every production schedule. It\'s better to finish early than to push a job back because of a surprise rain day.',
        },
      ],
    },
  ],
};
