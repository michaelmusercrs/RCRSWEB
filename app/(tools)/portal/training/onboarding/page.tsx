'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Home,
  Command,
  LayoutDashboard,
  Users,
  UserCircle,
  Truck,
  FileSpreadsheet,
  CalendarDays,
  Package,
  BarChart3,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Award,
  Lightbulb,
  BookOpen,
  Trophy,
  AlertTriangle,
  Target,
  GraduationCap,
  Clock,
} from 'lucide-react';
import SettingsMenu from '@/components/SettingsMenu';

// ============================================================================
// TYPES
// ============================================================================

interface OnboardingStep {
  heading: string;
  content: string[];
  tryItLink?: { href: string; label: string };
  tips?: string[];
}

interface OnboardingQuizQuestion {
  question: string;
  options: string[];
  correctIndex: number;
}

interface OnboardingSection {
  id: string;
  title: string;
  description: string;
  icon: React.ElementType;
  color: string;
  estimatedMinutes: number;
  steps: OnboardingStep[];
  quiz: OnboardingQuizQuestion[];
}

// ============================================================================
// SECTION DATA
// ============================================================================

const onboardingSections: OnboardingSection[] = [
  // -------------------------------------------------------------------------
  // Section 1: Dashboard Overview
  // -------------------------------------------------------------------------
  {
    id: 'onboard_s1',
    title: 'Dashboard Overview',
    description: 'Understanding your main dashboard, key metrics, and navigation.',
    icon: LayoutDashboard,
    color: 'text-brand-green',
    estimatedMinutes: 10,
    quiz: [
      { question: 'What is the central hub for day-to-day operations?', options: ['Portal Home', 'Manager Dashboard', 'Inventory Page', 'Admin Panel'], correctIndex: 1 },
      { question: 'What does the "Completion Rate" metric measure?', options: ['Inventory accuracy', 'Percentage of orders completed on time', 'Number of deliveries today', 'Total revenue'], correctIndex: 1 },
      { question: 'Which page gives quick access to all major platform functions?', options: ['/portal', '/portal/admin', '/command-center', '/portal/inventory'], correctIndex: 2 },
    ],
    steps: [
      {
        heading: 'What You See on the Dashboard',
        content: [
          'The Manager Dashboard is the central hub for day-to-day operations. When you log in, you will see:',
          '',
          'TOP METRICS BAR:',
          '- Total active orders and their current status breakdown.',
          '- Pending deliveries waiting to be assigned or completed.',
          '- Inventory alerts for items below minimum stock levels.',
          '- Quick-action buttons for creating new orders and deliveries.',
          '',
          'RECENT ACTIVITY FEED:',
          '- Latest order updates, delivery completions, and inventory changes.',
          '- Timestamped entries so you can see what happened and when.',
          '',
          'QUICK ACTIONS:',
          '- Create new material order.',
          '- Schedule a delivery.',
          '- Check inventory levels.',
          '- View reports and analytics.',
        ],
        tryItLink: { href: '/portal/manager', label: 'Open Manager Dashboard' },
      },
      {
        heading: 'Key Metrics Explained',
        content: [
          'Understanding what each metric means helps you make better decisions:',
          '',
          'ACTIVE ORDERS: Jobs that have been created but not yet fully delivered and completed. This tells you how much work is in the pipeline.',
          '',
          'PENDING DELIVERIES: Deliveries that have been scheduled but not yet marked as delivered. High numbers here mean the delivery team is busy.',
          '',
          'INVENTORY ALERTS: Items that have dropped below their minimum stock level. These need to be reordered soon to avoid job delays.',
          '',
          'COMPLETION RATE: The percentage of orders that were completed on time. This is a key performance indicator for operations.',
        ],
      },
      {
        heading: 'Navigation Overview',
        content: [
          'The platform is organized into distinct sections accessible from the main navigation:',
          '',
          'PORTAL HOME (/portal): Landing page with links to all portal sections based on your role.',
          '',
          'MANAGER DASHBOARD (/portal/manager): Order management, delivery tracking, and operational controls.',
          '',
          'INVENTORY (/portal/inventory): Stock levels, counting, and reorder management.',
          '',
          'ADMIN (/portal/admin): Website management, blog, team profiles, images, and training.',
          '',
          'LOGISTICS (/portal/driver): Delivery assignments and proof-of-delivery for drivers.',
          '',
          'ROOFSTACK HQ (/command-center): High-level overview with links to all major platform functions.',
          '',
          'The header on every page has a back button, RoofStack HQ link, and a View Site link to see the public website.',
        ],
        tryItLink: { href: '/portal', label: 'Open Portal Home' },
        tips: [
          'Bookmark the RoofStack HQ page (/command-center) for quick access to everything from one place.',
          'The portal works on mobile devices, but the desktop view gives you the best experience for management tasks.',
        ],
      },
    ],
  },

  // -------------------------------------------------------------------------
  // Section 2: Lead Management
  // -------------------------------------------------------------------------
  {
    id: 'onboard_s2',
    title: 'Lead Management',
    description: 'How leads enter the system, distribution, claiming, and status updates.',
    icon: Users,
    color: 'text-blue-400',
    estimatedMinutes: 12,
    quiz: [
      { question: 'Which of these is NOT a lead source for RCRS?', options: ['Website contact form', 'Referral form', 'Social media DMs', 'Phone calls'], correctIndex: 2 },
      { question: 'What happens to unclaimed leads that sit too long?', options: ['They are deleted', 'They are reassigned', 'They stay indefinitely', 'They auto-close'], correctIndex: 1 },
      { question: 'When should lead status updates be made?', options: ['End of each day', 'Weekly', 'In real time as things happen', 'Monthly review'], correctIndex: 2 },
    ],
    steps: [
      {
        heading: 'How Leads Come In',
        content: [
          'Leads enter the RCRS platform through multiple channels:',
          '',
          'WEBSITE CONTACT FORM: When a visitor fills out the contact form on the public website, it is automatically recorded in Google Sheets and triggers an email notification.',
          '',
          'REFERRAL FORM: Existing customers or partners can submit referrals through the referral page. These are tracked separately for the referral program.',
          '',
          'PHONE CALLS: Calls to the main RCRS number are logged by the office team and entered into the system.',
          '',
          'MANUAL ENTRY: Sales reps can add leads they generate from door knocking, networking events, BNI meetings, or personal contacts.',
          '',
          'Each lead includes: name, phone, email, address, source (how they found us), and any initial notes.',
        ],
      },
      {
        heading: 'Lead Distribution',
        content: [
          'Leads are distributed to sales inspectors based on:',
          '',
          '- REGION: Leads are assigned to the regional partner or inspector covering that geographic area.',
          '- AVAILABILITY: If the primary inspector is unavailable, leads may be reassigned.',
          '- ROTATION: In areas with multiple inspectors, leads may be distributed in a round-robin rotation.',
          '',
          'The office team (Sara, Tia, Destin) manages lead distribution and ensures every lead gets assigned promptly.',
          '',
          'IMPORTANT: When you receive a lead, you are expected to make first contact within the response time targets covered in Sales Training.',
        ],
      },
      {
        heading: 'Claiming and Following Up',
        content: [
          'When a lead is assigned to you:',
          '',
          '1. You will receive a notification (text/email) with the lead details.',
          '2. Claim the lead by updating its status to "Contacted" once you make first contact.',
          '3. Schedule the inspection and update the status to "Inspection Scheduled".',
          '4. After the inspection, update to "Inspected" and add your notes and photos.',
          '5. Continue updating the status through the pipeline as the job progresses.',
          '',
          'Unclaimed or uncontacted leads that sit too long will be reassigned. Speed matters.',
        ],
        tips: [
          'Check for new leads first thing every morning and immediately after lunch. Do not let leads sit.',
        ],
      },
      {
        heading: 'Updating Lead Status',
        content: [
          'Every lead/job follows a pipeline of statuses. Keeping these updated is critical:',
          '',
          '- New Lead: Just received, not yet contacted.',
          '- Contacted: First call or text has been made.',
          '- Inspection Scheduled: Date and time set for the inspection.',
          '- Inspected: Inspection completed, report provided.',
          '- Claim Filed: Insurance claim submitted.',
          '- Approved: Insurance has approved the claim.',
          '- Work Scheduled: Installation date is set.',
          '- Complete: Job is finished.',
          '',
          'Status updates should be made in REAL TIME as things happen, not at the end of the day.',
        ],
      },
    ],
  },

  // -------------------------------------------------------------------------
  // Section 3: Customer Portal
  // -------------------------------------------------------------------------
  {
    id: 'onboard_s3',
    title: 'Customer Portal',
    description: 'How customer-facing portals work and what customers see.',
    icon: UserCircle,
    color: 'text-purple-400',
    estimatedMinutes: 8,
    quiz: [
      { question: 'How do customers access their portal?', options: ['Username and password', 'Google login', 'Unique token-based link', 'Mobile app'], correctIndex: 2 },
      { question: 'What CAN customers see in their portal?', options: ['Internal notes', 'Financial details', 'Project status and timeline', 'Other customers\' info'], correctIndex: 2 },
      { question: 'What is the phone response standard during business hours?', options: ['1 hour', '30 minutes', '2 hours', 'Same day'], correctIndex: 1 },
    ],
    steps: [
      {
        heading: 'How Customer Portals Work',
        content: [
          'Each customer can have a portal page where they can track the status of their roofing project.',
          '',
          'CUSTOMER PORTAL FEATURES:',
          '- Project status tracker showing current stage.',
          '- Timeline of key milestones (inspection, claim filed, approved, scheduled, completed).',
          '- Documents and photos shared by the RCRS team.',
          '- Direct contact information for their assigned sales inspector.',
          '- Company information and credentials.',
          '',
          'Customer portals are accessed via a unique token-based link. No username/password required for customers.',
        ],
      },
      {
        heading: 'What Customers Can See',
        content: [
          'Customers have a read-only view of their project. They can see:',
          '',
          '- Their project overview and current status.',
          '- Any documents or photos shared with them.',
          '- Contact details for their RCRS representative.',
          '- General company information and certifications.',
          '',
          'They CANNOT see:',
          '- Internal notes or comments between team members.',
          '- Financial details like costs, margins, or commission information.',
          '- Other customers\' information.',
          '- Administrative functions or settings.',
        ],
        tips: [
          'When sharing the customer portal link, explain that they can check their project status anytime without needing to call.',
          'This builds confidence and reduces inbound "where are we at?" calls.',
        ],
      },
      {
        heading: 'Managing Customer Communications',
        content: [
          'All customer communications should be logged and coordinated:',
          '',
          '- Log every call, text, and email in the job notes.',
          '- If a customer contacts the office, the office team will notify the assigned inspector.',
          '- Use the portal\'s messaging features when available.',
          '- Keep the customer updated proactively -- do not wait for them to ask.',
          '',
          'RESPONSE STANDARDS:',
          '- Phone: Return within 30 minutes during business hours.',
          '- Text: Respond within 2 hours.',
          '- Email: Respond within 4 hours.',
          '- Customer portal inquiries: Respond within 4 hours.',
        ],
      },
    ],
  },

  // -------------------------------------------------------------------------
  // Section 4: Delivery System
  // -------------------------------------------------------------------------
  {
    id: 'onboard_s4',
    title: 'Delivery System',
    description: 'Creating delivery tickets, material orders, driver assignments, and tracking.',
    icon: Truck,
    color: 'text-orange-400',
    estimatedMinutes: 10,
    quiz: [
      { question: 'What is included on a delivery ticket?', options: ['Just the address', 'Address, material list, date, driver, and instructions', 'Only material list', 'Driver name only'], correctIndex: 1 },
      { question: 'Who coordinates with suppliers for ordering materials?', options: ['Sales reps', 'Drivers', 'Tae (Materials Manager)', 'Customers'], correctIndex: 2 },
      { question: 'Why should drivers take photos at the job site?', options: ['For social media', 'To prove delivery and prevent disputes', 'For insurance only', 'Company policy with no purpose'], correctIndex: 1 },
    ],
    steps: [
      {
        heading: 'Creating Delivery Tickets',
        content: [
          'Delivery tickets are created when materials need to go from the warehouse to a job site.',
          '',
          'TO CREATE A DELIVERY TICKET:',
          '1. Go to the Manager Dashboard.',
          '2. Click "New Delivery" or "Create Delivery Ticket".',
          '3. Select the job/address from the dropdown.',
          '4. Add the materials to be delivered (pulled from inventory).',
          '5. Set the delivery date and priority level.',
          '6. Assign a driver (or leave unassigned for the office to assign).',
          '7. Save the ticket.',
          '',
          'The delivery ticket includes: job address, material list, delivery date, driver assignment, and any special instructions.',
        ],
        tryItLink: { href: '/portal/manager', label: 'Open Manager Dashboard' },
      },
      {
        heading: 'Material Orders',
        content: [
          'When inventory is low or a job requires special-order materials:',
          '',
          '1. Check current inventory levels in the Inventory section.',
          '2. Create a material order from the Manager Dashboard.',
          '3. Specify quantities, vendor, and expected delivery date.',
          '4. The order will be tracked through: Ordered -> In Transit -> Received.',
          '',
          'Tae (Materials Manager) coordinates with suppliers for ordering and receiving. Contact him for vendor questions, pricing, or availability issues.',
        ],
      },
      {
        heading: 'Driver Assignments & Tracking',
        content: [
          'ASSIGNING DRIVERS:',
          '- Delivery tickets can be assigned to specific drivers.',
          '- Drivers access their assignments through Logistics.',
          '- Each driver logs in with a secure PIN.',
          '',
          'DELIVERY TRACKING:',
          '- Deliveries move through statuses: Assigned -> En Route -> Delivered.',
          '- Drivers can update their status and add notes in real time.',
          '- The management team can see all active deliveries on the dashboard.',
          '',
          'PROOF OF DELIVERY:',
          '- Drivers are expected to take photos at the job site showing materials placed.',
          '- Photos are uploaded to the delivery record.',
          '- This protects against "we never received the materials" disputes.',
        ],
        tryItLink: { href: '/portal/driver', label: 'View Logistics' },
        tips: [
          'If you are coordinating a delivery for your customer, communicate the expected delivery time to the homeowner so they are not surprised by a truck showing up.',
        ],
      },
    ],
  },

  // -------------------------------------------------------------------------
  // Section 5: Job Breakdowns & Invoicing
  // -------------------------------------------------------------------------
  {
    id: 'onboard_s5',
    title: 'Job Breakdowns & Invoicing',
    description: 'Creating breakdowns, material/labor costs, approval workflow, and invoicing.',
    icon: FileSpreadsheet,
    color: 'text-cyan-400',
    estimatedMinutes: 12,
    quiz: [
      { question: 'What should happen before a job is scheduled?', options: ['Nothing special', 'Breakdown must be approved', 'Customer must call', 'Materials must arrive'], correctIndex: 1 },
      { question: 'Why is using current material pricing important?', options: ['It looks professional', 'Outdated pricing can cost thousands', 'Customers prefer it', 'It is a legal requirement'], correctIndex: 1 },
      { question: 'What are the invoice status stages?', options: ['Created, Sent, Done', 'Sent, Viewed, Paid', 'Draft, Final, Closed', 'Pending, Active, Complete'], correctIndex: 1 },
    ],
    steps: [
      {
        heading: 'Creating Job Breakdowns',
        content: [
          'A job breakdown is a detailed cost analysis of every line item in a roofing job.',
          '',
          'WHAT A BREAKDOWN INCLUDES:',
          '- Material costs (shingles, underlayment, flashing, ice & water, etc.).',
          '- Labor costs (crew wages, per-square rates).',
          '- Equipment costs (dumpster rental, crane if needed).',
          '- Overhead allocation.',
          '- Profit margin.',
          '',
          'TO CREATE A BREAKDOWN:',
          '1. Navigate to the job in the system.',
          '2. Open the Breakdown section.',
          '3. Add each line item with quantity, unit cost, and category.',
          '4. The system calculates totals, margins, and the final price.',
          '5. Submit for approval.',
        ],
      },
      {
        heading: 'Material and Labor Costs',
        content: [
          'MATERIAL COSTS:',
          '- Pulled from current inventory pricing or supplier quotes.',
          '- Include waste factor in the quantity calculation.',
          '- Track unit prices over time to catch price increases.',
          '',
          'LABOR COSTS:',
          '- Based on per-square rates for different job types.',
          '- Factor in pitch difficulty, number of layers, and complexity.',
          '- Include cleanup and haul-off labor.',
          '',
          'Always use current pricing. Material costs change frequently. An estimate based on outdated pricing can cost the company thousands.',
        ],
      },
      {
        heading: 'Approval Workflow',
        content: [
          'Job breakdowns go through an approval process before work begins:',
          '',
          '1. CREATED: Inspector creates the initial breakdown.',
          '2. SUBMITTED: Breakdown submitted for management review.',
          '3. REVIEWED: Management checks pricing, margins, and completeness.',
          '4. APPROVED: Breakdown is approved and the job can be scheduled.',
          '5. (or) REVISION NEEDED: Sent back with comments for corrections.',
          '',
          'Only approved breakdowns should proceed to scheduling. This ensures pricing accuracy and protects company margins.',
        ],
      },
      {
        heading: 'Generating Invoices',
        content: [
          'Invoices are generated from approved job breakdowns:',
          '',
          '1. Open the completed job.',
          '2. Navigate to the Invoicing section.',
          '3. Review the line items (they should match the approved breakdown).',
          '4. Add any change orders or supplement amounts.',
          '5. Generate the invoice.',
          '6. Send to the customer or insurance company.',
          '',
          'For insurance claims, the invoice is typically sent directly to the insurance company, with the homeowner responsible only for their deductible.',
          '',
          'Track invoice status: Sent -> Viewed -> Paid.',
        ],
        tips: [
          'Double-check every invoice before sending. Errors delay payment and damage credibility.',
        ],
      },
    ],
  },

  // -------------------------------------------------------------------------
  // Section 6: Calendar & Scheduling
  // -------------------------------------------------------------------------
  {
    id: 'onboard_s6',
    title: 'Calendar & Scheduling',
    description: 'Viewing schedules, creating appointments, and Google Calendar integration.',
    icon: CalendarDays,
    color: 'text-pink-400',
    estimatedMinutes: 8,
    quiz: [
      { question: 'What color indicates urgent/high priority calendar events?', options: ['Green', 'Blue', 'Yellow', 'Red'], correctIndex: 3 },
      { question: 'What format does RCRS use for calendar event links?', options: ['.ics files', 'Outlook invites', 'Google Calendar URL links', 'PDF attachments'], correctIndex: 2 },
      { question: 'How far in advance should you set inspection reminders?', options: ['1 hour', '30 minutes', '15 minutes', '1 day'], correctIndex: 1 },
    ],
    steps: [
      {
        heading: 'Viewing the Schedule',
        content: [
          'The calendar shows all scheduled inspections, installations, deliveries, and meetings.',
          '',
          'CALENDAR VIEWS:',
          '- Day view: See everything happening today with time slots.',
          '- Week view: Overview of the upcoming week.',
          '- Month view: High-level planning view.',
          '',
          'COLOR CODING:',
          '- Green: Confirmed appointments.',
          '- Yellow: Pending / needs confirmation.',
          '- Blue: Deliveries.',
          '- Red: Urgent / high priority.',
          '',
          'You can filter the calendar by team member, type of event, or region.',
        ],
      },
      {
        heading: 'Creating Appointments',
        content: [
          'TO SCHEDULE AN APPOINTMENT:',
          '1. Click on the desired date/time slot.',
          '2. Select the appointment type (Inspection, Adjuster Meeting, Installation, etc.).',
          '3. Enter the customer name and property address.',
          '4. Assign the team member.',
          '5. Add any special notes or instructions.',
          '6. Save the appointment.',
          '',
          'The assigned team member will receive a notification. The customer can also be sent an automated confirmation.',
        ],
      },
      {
        heading: 'Google Calendar Integration',
        content: [
          'RCRS uses Google Workspace. Calendar events can sync with Google Calendar.',
          '',
          'HOW IT WORKS:',
          '- Appointments created in the platform can generate Google Calendar links.',
          '- Team members can add events directly to their Google Calendar.',
          '- This ensures your personal schedule stays in sync with company appointments.',
          '',
          'FORMAT: Google Calendar event links are used (not .ics files). When you receive a calendar link, clicking it will open Google Calendar with the event pre-filled.',
          '',
          'BEST PRACTICE: Add every work appointment to your Google Calendar immediately. Set a reminder for 30 minutes before inspections and 1 day before installations.',
        ],
        tips: [
          'If you use a personal calendar app, add your RCRS Google Calendar as a secondary calendar so you can see everything in one view.',
        ],
      },
    ],
  },

  // -------------------------------------------------------------------------
  // Section 7: Inventory Management
  // -------------------------------------------------------------------------
  {
    id: 'onboard_s7',
    title: 'Inventory Management',
    description: 'Checking stock, ordering materials, and managing adjustments.',
    icon: Package,
    color: 'text-emerald-400',
    estimatedMinutes: 10,
    quiz: [
      { question: 'What does a red indicator mean for inventory?', options: ['Overstocked', 'Healthy levels', 'Below minimum, needs immediate reorder', 'Approaching reorder point'], correctIndex: 2 },
      { question: 'Why should all stock adjustments include notes?', options: ['For fun', 'For accountability and audit trail', 'Company policy only', 'Not required'], correctIndex: 1 },
      { question: 'How often should inventory counts be performed?', options: ['Monthly', 'Weekly or bi-weekly', 'Annually', 'Only when issues arise'], correctIndex: 1 },
    ],
    steps: [
      {
        heading: 'Checking Stock Levels',
        content: [
          'The Inventory section shows real-time stock levels for all materials.',
          '',
          'KEY INFORMATION:',
          '- Item name, SKU, and category.',
          '- Current quantity on hand.',
          '- Minimum stock level (reorder point).',
          '- Maximum stock level.',
          '- Unit of measure (bundles, rolls, pieces, linear feet).',
          '',
          'VISUAL INDICATORS:',
          '- Green: Stock is at healthy levels.',
          '- Yellow: Stock is approaching the reorder point.',
          '- Red: Stock is below minimum -- needs immediate reorder.',
          '',
          'You can search and filter inventory by category, supplier, or stock status.',
        ],
        tryItLink: { href: '/portal/inventory', label: 'Open Inventory' },
      },
      {
        heading: 'Ordering Materials',
        content: [
          'When stock is low or a job needs specific materials:',
          '',
          '1. Check current stock to confirm what is needed.',
          '2. Create a purchase order specifying items, quantities, and supplier.',
          '3. Submit the order for approval (if required by your role).',
          '4. Track the order status: Ordered -> In Transit -> Received.',
          '5. When materials arrive, update the inventory to reflect the new stock.',
          '',
          'Tae (Materials Manager) is your go-to person for supplier relationships, pricing questions, and coordinating large orders.',
        ],
      },
      {
        heading: 'Stock Adjustments',
        content: [
          'Sometimes inventory counts do not match the system. Adjustments handle this:',
          '',
          'REASONS FOR ADJUSTMENTS:',
          '- Physical count reveals a discrepancy.',
          '- Materials were damaged or returned.',
          '- Items were used but not properly deducted from inventory.',
          '- Leftover materials returned from a job site.',
          '',
          'TO MAKE AN ADJUSTMENT:',
          '1. Go to the item in the Inventory section.',
          '2. Click "Adjust Stock" or "Stock Adjustment".',
          '3. Enter the new quantity or the adjustment amount (+/-).',
          '4. Select a reason for the adjustment.',
          '5. Add any notes explaining the change.',
          '6. Submit the adjustment.',
          '',
          'All adjustments are logged with timestamps and user information for accountability.',
        ],
        tips: [
          'Regular inventory counts (weekly or bi-weekly) keep the system accurate and prevent surprise stockouts.',
        ],
      },
    ],
  },

  // -------------------------------------------------------------------------
  // Section 8: Reports & Analytics
  // -------------------------------------------------------------------------
  {
    id: 'onboard_s8',
    title: 'Reports & Analytics',
    description: 'Sales performance, commission tracking, and financial reports.',
    icon: BarChart3,
    color: 'text-violet-400',
    estimatedMinutes: 10,
    quiz: [
      { question: 'Which metric measures how fast you respond to new leads?', options: ['Conversion rate', 'Revenue generated', 'Speed to lead / response time', 'Average job size'], correctIndex: 2 },
      { question: 'Commission tracking includes which status?', options: ['Earned, Pending, and Paid', 'Active and Inactive', 'Open and Closed', 'Current and Historical'], correctIndex: 0 },
      { question: 'Which two reports are most critical for weekly review?', options: ['Inventory and delivery', 'Monthly revenue and outstanding invoices', 'Commission and team', 'Daily and quarterly'], correctIndex: 1 },
    ],
    steps: [
      {
        heading: 'Sales Performance',
        content: [
          'Track your sales performance and compare against goals:',
          '',
          'METRICS AVAILABLE:',
          '- Total inspections performed.',
          '- Inspection-to-claim conversion rate.',
          '- Total jobs closed.',
          '- Revenue generated.',
          '- Average job size.',
          '- Response time metrics (speed to lead).',
          '',
          'VIEWS:',
          '- Individual: Your personal performance.',
          '- Team: Compare performance across the sales team.',
          '- Time period: Filter by week, month, quarter, or custom date range.',
          '',
          'Review your performance metrics regularly. Know your numbers better than anyone else.',
        ],
        tips: [
          'Set personal weekly goals: number of inspections, number of claims filed, and number of signed contracts. Track against these weekly.',
        ],
      },
      {
        heading: 'Commission Tracking',
        content: [
          'The platform tracks commissions based on job completions and payments:',
          '',
          'COMMISSION STRUCTURE:',
          '- Commissions are calculated based on the company\'s commission plan.',
          '- They are tied to completed and paid jobs.',
          '- The system tracks: Earned, Pending, and Paid commissions.',
          '',
          'COMMISSION DETAILS:',
          '- View commission amount per job.',
          '- See breakdown by job type.',
          '- Track year-to-date earnings.',
          '- View pending commissions (jobs completed but not yet paid).',
          '',
          'If you have questions about your commission calculations, reach out to the office team or management.',
        ],
      },
      {
        heading: 'Financial Reports',
        content: [
          'For managers and leadership, financial reports provide business-level insights:',
          '',
          'AVAILABLE REPORTS:',
          '- Revenue by period (daily, weekly, monthly, quarterly).',
          '- Revenue by sales rep.',
          '- Revenue by region.',
          '- Material costs and margins.',
          '- Outstanding invoices and accounts receivable.',
          '- Average job profitability.',
          '',
          'Reports can be filtered, exported, and shared. Use them for team meetings, performance reviews, and strategic planning.',
          '',
          'Not all reports are available to all roles. Your access level determines which reports you can view.',
        ],
        tips: [
          'The monthly revenue report and the outstanding invoices report are the two most critical for weekly review. Make a habit of checking both.',
        ],
      },
    ],
  },
];

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

const STORAGE_KEY = 'rcrs-onboarding-progress';
const USER_SETTINGS_KEY = 'rcrs-user-settings';

function getUserIdentity(): { userId: string; userName: string } {
  if (typeof window === 'undefined') return { userId: 'anonymous', userName: 'Team Member' };
  try {
    const raw = localStorage.getItem(USER_SETTINGS_KEY);
    if (raw) {
      const settings = JSON.parse(raw);
      return {
        userId: settings.email || settings.userId || 'anonymous',
        userName: settings.displayName || settings.name || 'Team Member',
      };
    }
  } catch { /* ignore */ }
  return { userId: 'anonymous', userName: 'Team Member' };
}

function loadCompletedSections(): Set<string> {
  if (typeof window === 'undefined') return new Set();
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? new Set(JSON.parse(saved)) : new Set();
  } catch {
    return new Set();
  }
}

function saveCompletedSections(completed: Set<string>) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(completed)));
}

// ============================================================================
// MAIN PAGE COMPONENT
// ============================================================================

export default function OnboardingPage() {
  const [completed, setCompleted] = useState<Set<string>>(new Set());
  const [activeSectionId, setActiveSectionId] = useState<string | null>(null);
  const [expandedSteps, setExpandedSteps] = useState<Set<number>>(new Set([0]));
  const [syncError, setSyncError] = useState(false);
  const [activeTab, setActiveTab] = useState<'content' | 'quiz'>('content');
  const [quizAnswers, setQuizAnswers] = useState<Record<number, number>>({});
  const [quizSubmitted, setQuizSubmitted] = useState(false);

  // Load on mount
  useEffect(() => {
    const loaded = loadCompletedSections();
    setCompleted(loaded);

    // Try to sync with server
    syncWithServer(loaded);
  }, []);

  const syncWithServer = useCallback(async (localCompleted: Set<string>) => {
    try {
      const res = await fetch('/api/portal/training');
      if (!res.ok) return;
      const data = await res.json();
      if (data.success && Array.isArray(data.completedModules)) {
        const onboardModules = (data.completedModules as string[]).filter((m: string) => m.startsWith('onboard_'));
        if (onboardModules.length > 0) {
          const merged = new Set([...localCompleted, ...onboardModules]);
          if (merged.size > localCompleted.size) {
            setCompleted(merged);
            saveCompletedSections(merged);
          }
        }
      }
    } catch {
      // Silent fail
    }
  }, []);

  const activeSection = onboardingSections.find(s => s.id === activeSectionId) || null;

  const completedCount = onboardingSections.filter(s => completed.has(s.id)).length;
  const overallProgress = Math.round((completedCount / onboardingSections.length) * 100);
  const allComplete = completedCount === onboardingSections.length;

  // Toggle step expansion
  const toggleStep = (idx: number) => {
    setExpandedSteps(prev => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  // Open a section
  const openSection = (sectionId: string) => {
    setActiveSectionId(sectionId);
    setExpandedSteps(new Set([0]));
    setActiveTab('content');
    setQuizAnswers({});
    setQuizSubmitted(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Quiz helpers
  const getQuizScore = (section: OnboardingSection): { correct: number; total: number; pct: number } => {
    let correct = 0;
    for (let i = 0; i < section.quiz.length; i++) {
      if (quizAnswers[i] === section.quiz[i].correctIndex) correct++;
    }
    const total = section.quiz.length;
    return { correct, total, pct: total > 0 ? Math.round((correct / total) * 100) : 0 };
  };

  // Mark section complete
  const markComplete = async (sectionId: string) => {
    const newCompleted = new Set([...completed, sectionId]);
    setCompleted(newCompleted);
    saveCompletedSections(newCompleted);

    // Persist to server with quiz answers for server-side validation
    try {
      const { userId, userName } = getUserIdentity();
      await fetch('/api/portal/training', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          userName,
          moduleId: sectionId,
          moduleName: onboardingSections.find(s => s.id === sectionId)?.title || sectionId,
          score: '100',
          passed: true,
          answers: quizAnswers, // Server validates these for onboard_ modules
          completedAt: new Date().toISOString(),
        }),
      });
      setSyncError(false);
    } catch {
      setSyncError(true);
      setTimeout(() => setSyncError(false), 5000);
    }
  };

  // Unmark section
  const unmarkComplete = (sectionId: string) => {
    const newCompleted = new Set(completed);
    newCompleted.delete(sectionId);
    setCompleted(newCompleted);
    saveCompletedSections(newCompleted);
  };

  // Back to list
  const backToList = () => {
    setActiveSectionId(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // =========================================================================
  // RENDER: Section Detail View
  // =========================================================================
  if (activeSection) {
    const isCompleted = completed.has(activeSection.id);
    const sectionIndex = onboardingSections.findIndex(s => s.id === activeSection.id);
    const nextSection = onboardingSections[sectionIndex + 1];
    const quizScore = quizSubmitted ? getQuizScore(activeSection) : null;
    const quizPassed = quizScore !== null && quizScore.pct >= 80;
    const canMarkComplete = isCompleted || quizPassed;

    return (
      <div className="min-h-screen bg-gradient-to-br from-neutral-950 via-neutral-900 to-neutral-950">
        <div className="fixed inset-0 opacity-30 pointer-events-none">
          <div className="absolute inset-0" style={{ backgroundImage: 'radial-gradient(circle at 25px 25px, rgba(255,255,255,0.03) 2px, transparent 0)', backgroundSize: '50px 50px' }} />
        </div>
        <div className="relative z-10">
          {/* Sync error banner */}
          {syncError && (
            <div className="fixed top-0 left-0 right-0 z-50 flex justify-center pt-2 animate-in fade-in slide-in-from-top-2 duration-300">
              <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-500/20 border border-amber-500/30 text-amber-400 text-sm font-medium shadow-lg backdrop-blur-xl">
                <AlertTriangle size={14} />
                Progress saved locally. Server sync will retry later.
              </div>
            </div>
          )}
          <header className="border-b border-white/5 backdrop-blur-xl bg-black/20 sticky top-0 z-20">
            <div className="max-w-4xl mx-auto px-6 py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <button onClick={backToList} className="w-10 h-10 rounded-xl bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors">
                    <ArrowLeft size={18} className="text-neutral-400" />
                  </button>
                  <div>
                    <h1 className="text-lg font-bold text-white">{activeSection.title}</h1>
                    <p className="text-xs text-neutral-400">{activeSection.description}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setActiveTab('content')}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${activeTab === 'content' ? 'bg-brand-green/20 text-blue-400 border border-blue-500/30' : 'text-neutral-400 hover:text-white'}`}
                  >
                    Content
                  </button>
                  <button
                    onClick={() => setActiveTab('quiz')}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${activeTab === 'quiz' ? 'bg-brand-green/20 text-blue-400 border border-blue-500/30' : 'text-neutral-400 hover:text-white'}`}
                  >
                    Quiz ({activeSection.quiz.length})
                  </button>
                  {isCompleted ? (
                    <button
                      onClick={() => unmarkComplete(activeSection.id)}
                      className="flex items-center gap-2 px-4 py-2 rounded-xl bg-green-500/20 border border-green-500/30 text-green-400 text-sm font-medium ml-2"
                    >
                      <CheckCircle2 size={16} />
                      Completed
                    </button>
                  ) : canMarkComplete ? (
                    <button
                      onClick={() => markComplete(activeSection.id)}
                      className="flex items-center gap-2 px-4 py-2 rounded-xl bg-brand-green text-black text-sm font-semibold hover:bg-brand-green/90 transition-colors ml-2"
                    >
                      <CheckCircle2 size={16} />
                      Mark as Complete
                    </button>
                  ) : null}
                </div>
              </div>
            </div>
          </header>

          <main className="max-w-4xl mx-auto px-6 py-8">
            {/* CONTENT TAB */}
            {activeTab === 'content' && (
              <div className="space-y-4">
                {activeSection.steps.map((step, idx) => {
                  const isExpanded = expandedSteps.has(idx);
                  const panelId = `step-panel-${activeSection.id}-${idx}`;
                  const buttonId = `step-btn-${activeSection.id}-${idx}`;
                  return (
                    <div key={idx} className="rounded-xl border border-white/5 bg-white/[0.02] overflow-hidden">
                      <button
                        id={buttonId}
                        onClick={() => toggleStep(idx)}
                        aria-expanded={isExpanded}
                        aria-controls={panelId}
                        className="w-full px-6 py-4 flex items-center justify-between hover:bg-white/[0.02] transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-7 h-7 rounded-lg bg-brand-green/10 flex items-center justify-center text-blue-400 text-sm font-bold">
                            {idx + 1}
                          </div>
                          <span className="text-white font-medium text-left">{step.heading}</span>
                        </div>
                        {isExpanded ? <ChevronDown size={18} className="text-neutral-400" /> : <ChevronRight size={18} className="text-neutral-400" />}
                      </button>
                      {isExpanded && (
                        <div id={panelId} role="region" aria-labelledby={buttonId} className="px-6 pb-5 border-t border-white/5">
                          <div className="mt-4 space-y-2">
                            {step.content.map((line, i) => {
                              if (line === '') return <div key={i} className="h-3" />;
                              if (line.startsWith('- ')) return <p key={i} className="text-sm text-neutral-300 pl-4 before:content-['\2022'] before:mr-2 before:text-blue-400">{line.slice(2)}</p>;
                              if (line.match(/^\d+\./)) return <p key={i} className="text-sm text-neutral-300 pl-4">{line}</p>;
                              if (line === line.toUpperCase() && line.length > 3 && !line.startsWith('"') && !line.includes('/')) return <p key={i} className="text-sm font-semibold text-white mt-3">{line}</p>;
                              return <p key={i} className="text-sm text-neutral-300">{line}</p>;
                            })}
                          </div>

                          {step.tryItLink && (
                            <div className="mt-4">
                              <Link
                                href={step.tryItLink.href}
                                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-brand-green/10 border border-blue-500/20 text-blue-400 text-sm font-medium hover:bg-brand-green/20 transition-colors"
                              >
                                <ExternalLink size={14} />
                                Try It: {step.tryItLink.label}
                              </Link>
                            </div>
                          )}

                          {step.tips && step.tips.length > 0 && (
                            <div className="mt-4 rounded-lg bg-brand-green/5 border border-blue-500/20 p-4">
                              <div className="flex items-center gap-2 mb-2">
                                <Lightbulb size={16} className="text-blue-400" />
                                <span className="text-sm font-semibold text-blue-400">Tips</span>
                              </div>
                              {step.tips.map((tip, i) => (
                                <p key={i} className="text-sm text-neutral-300 mt-1">{tip}</p>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* Prompt to take quiz */}
                {!isCompleted && (
                  <div className="flex justify-end pt-4">
                    <button
                      onClick={() => { setActiveTab('quiz'); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                      className="flex items-center gap-2 px-6 py-3 rounded-xl bg-brand-green text-black font-semibold hover:bg-brand-green/90 transition-colors"
                    >
                      Take the Quiz
                      <ChevronRight size={18} />
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* QUIZ TAB */}
            {activeTab === 'quiz' && (
              <div className="space-y-6">
                <div className="rounded-xl border border-white/10 bg-white/[0.02] p-6">
                  <h2 className="text-xl font-bold text-white mb-1">{activeSection.title} Quiz</h2>
                  <p className="text-sm text-neutral-400">
                    Answer all {activeSection.quiz.length} questions. You need 80% to pass and unlock completion.
                  </p>
                </div>

                {/* Score banner */}
                {quizSubmitted && quizScore && (
                  <div className={`rounded-xl p-4 border flex items-center gap-3 ${quizPassed ? 'bg-green-500/10 border-green-500/30' : 'bg-red-500/10 border-red-500/30'}`}>
                    {quizPassed ? <CheckCircle2 size={22} className="text-green-400 flex-shrink-0" /> : <AlertTriangle size={22} className="text-red-400 flex-shrink-0" />}
                    <div className="flex-1">
                      <p className={`text-sm font-semibold ${quizPassed ? 'text-green-400' : 'text-red-400'}`}>
                        {quizPassed ? 'Passed!' : 'Not quite.'} {quizScore.correct}/{quizScore.total} correct ({quizScore.pct}%)
                      </p>
                      <p className="text-xs text-neutral-400 mt-0.5">
                        {quizPassed ? 'You can now mark this section as complete.' : 'You need 80% to pass. Review the content and try again.'}
                      </p>
                    </div>
                    {!quizPassed && (
                      <button
                        onClick={() => { setQuizAnswers({}); setQuizSubmitted(false); }}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-xs text-neutral-300 transition-colors flex-shrink-0"
                      >
                        Retry
                      </button>
                    )}
                  </div>
                )}

                {/* Questions */}
                {activeSection.quiz.map((q, qIdx) => {
                  const selected = quizAnswers[qIdx];
                  return (
                    <div key={qIdx} className={`rounded-xl border p-6 ${quizSubmitted ? (selected === q.correctIndex ? 'border-green-500/30 bg-green-500/5' : 'border-red-500/30 bg-red-500/5') : 'border-white/5 bg-white/[0.02]'}`}>
                      <p className="text-white font-medium mb-4">
                        <span className="text-blue-400 mr-2">{qIdx + 1}.</span>
                        {q.question}
                      </p>
                      <div className="space-y-2">
                        {q.options.map((opt, oIdx) => {
                          const isSelected = selected === oIdx;
                          const showCorrect = quizSubmitted && oIdx === q.correctIndex;
                          const showWrong = quizSubmitted && isSelected && oIdx !== q.correctIndex;
                          return (
                            <button
                              key={oIdx}
                              onClick={() => { if (!quizSubmitted) setQuizAnswers(prev => ({ ...prev, [qIdx]: oIdx })); }}
                              disabled={quizSubmitted}
                              className={`w-full text-left px-4 py-3 rounded-lg text-sm transition-colors border ${
                                showCorrect ? 'border-green-500/50 bg-green-500/10 text-green-300' :
                                showWrong ? 'border-red-500/50 bg-red-500/10 text-red-300' :
                                isSelected ? 'border-blue-500/50 bg-brand-green/10 text-white' :
                                'border-white/5 bg-white/[0.02] text-neutral-300 hover:bg-white/[0.05]'
                              } ${quizSubmitted ? 'cursor-default' : ''}`}
                            >
                              {String.fromCharCode(65 + oIdx)}. {opt}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}

                {/* Submit / Actions */}
                <div className="flex items-center justify-between pt-4">
                  <button
                    onClick={() => { setActiveTab('content'); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                    className="text-neutral-400 hover:text-white text-sm transition-colors"
                  >
                    Back to Content
                  </button>
                  <div className="flex items-center gap-3">
                    {!quizSubmitted && (
                      <button
                        onClick={() => setQuizSubmitted(true)}
                        disabled={Object.keys(quizAnswers).length < activeSection.quiz.length}
                        className={`flex items-center gap-2 px-6 py-3 rounded-xl font-semibold transition-colors ${
                          Object.keys(quizAnswers).length >= activeSection.quiz.length
                            ? 'bg-brand-green text-black hover:bg-brand-green/90'
                            : 'bg-neutral-700 text-neutral-400 cursor-not-allowed'
                        }`}
                      >
                        Submit Quiz
                      </button>
                    )}
                    {quizPassed && !isCompleted && (
                      <button
                        onClick={() => markComplete(activeSection.id)}
                        className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-brand-green text-black font-semibold text-sm hover:bg-brand-green/90 transition-colors"
                      >
                        <CheckCircle2 size={16} />
                        Mark as Complete
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Bottom Actions */}
            <div className="flex items-center justify-between mt-8 pt-6 border-t border-white/5">
              <button
                onClick={backToList}
                className="text-neutral-400 hover:text-white text-sm transition-colors"
              >
                Back to All Sections
              </button>
              <div className="flex items-center gap-3">
                {nextSection && (
                  <button
                    onClick={() => openSection(nextSection.id)}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl border border-white/10 text-white text-sm font-medium hover:bg-white/5 transition-colors"
                  >
                    Next: {nextSection.title}
                    <ChevronRight size={16} />
                  </button>
                )}
              </div>
            </div>
          </main>
        </div>
      </div>
    );
  }

  // =========================================================================
  // RENDER: Section List View
  // =========================================================================
  return (
    <div className="min-h-screen bg-gradient-to-br from-neutral-950 via-neutral-900 to-neutral-950">
      <div className="fixed inset-0 opacity-30 pointer-events-none">
        <div className="absolute inset-0" style={{ backgroundImage: 'radial-gradient(circle at 25px 25px, rgba(255,255,255,0.03) 2px, transparent 0)', backgroundSize: '50px 50px' }} />
      </div>
      <div className="relative z-10">
        {/* Sync error banner */}
        {syncError && (
          <div className="fixed top-0 left-0 right-0 z-50 flex justify-center pt-2 animate-in fade-in slide-in-from-top-2 duration-300">
            <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-500/20 border border-amber-500/30 text-amber-400 text-sm font-medium shadow-lg backdrop-blur-xl">
              <AlertTriangle size={14} />
              Progress saved locally. Server sync will retry later.
            </div>
          </div>
        )}

        {/* Header */}
        <header className="border-b border-white/5 backdrop-blur-xl bg-black/20 sticky top-0 z-20">
          <div className="max-w-4xl mx-auto px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Link href="/portal/training" className="w-10 h-10 rounded-xl bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors">
                  <ArrowLeft size={18} className="text-neutral-400" />
                </Link>
                <div>
                  <h1 className="text-xl font-bold text-white tracking-tight">Platform Onboarding</h1>
                  <p className="text-sm text-neutral-400">Learn the RCRS Interface</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Link href="/command-center" className="hidden sm:flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-brand-green/20 to-emerald-500/20 hover:from-brand-green/30 hover:to-emerald-500/30 border border-brand-green/30 text-brand-green text-sm font-medium transition-all">
                  <Command size={16} />
                  RoofStack HQ
                </Link>
                <Link href="/" target="_blank" className="hidden sm:flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-neutral-400 text-sm transition-colors">
                  <Home size={16} />
                  View Site
                </Link>
                <SettingsMenu />
              </div>
            </div>
          </div>
        </header>

        <main className="max-w-4xl mx-auto px-6 py-8">
          {/* Overall Progress */}
          <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-6 mb-8">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-bold text-white">Your Progress</h2>
                <p className="text-sm text-neutral-400">{completedCount} of {onboardingSections.length} sections completed</p>
              </div>
              {allComplete && (
                <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-blue-500/20 to-cyan-500/20 border border-blue-500/30">
                  <Trophy size={18} className="text-blue-400" />
                  <span className="text-sm font-semibold text-blue-400">Onboarding Complete!</span>
                </div>
              )}
            </div>
            <div
              className="w-full h-3 rounded-full bg-neutral-800 overflow-hidden"
              role="progressbar"
              aria-valuenow={overallProgress}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={`Onboarding progress: ${overallProgress}%`}
            >
              <div
                className="h-full rounded-full bg-gradient-to-r from-blue-500 to-cyan-500 transition-all duration-500"
                style={{ width: `${overallProgress}%` }}
              />
            </div>
            <p className="text-right text-xs text-neutral-500 mt-1">{overallProgress}%</p>
          </div>

          {/* Certificate Banner */}
          {allComplete && (
            <div className="rounded-2xl border border-blue-500/30 bg-gradient-to-br from-blue-500/10 to-cyan-500/10 p-6 mb-8 text-center">
              <Award size={48} className="mx-auto text-blue-400 mb-3" />
              <h3 className="text-xl font-bold text-white mb-2">Platform Onboarding Complete</h3>
              <p className="text-neutral-300 mb-1">You have completed all platform onboarding sections.</p>
              <p className="text-sm text-neutral-400">You are ready to use the full RCRS platform.</p>
            </div>
          )}

          {/* Section List */}
          <div className="space-y-3">
            {onboardingSections.map((section, idx) => {
              const Icon = section.icon;
              const isSectionCompleted = completed.has(section.id);

              return (
                <button
                  key={section.id}
                  onClick={() => openSection(section.id)}
                  className={`w-full text-left rounded-xl border p-5 transition-all hover:scale-[1.01] ${
                    isSectionCompleted
                      ? 'border-green-500/30 bg-green-500/5 hover:bg-green-500/10'
                      : 'border-white/10 bg-white/[0.02] hover:bg-white/[0.05]'
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${
                      isSectionCompleted ? 'bg-green-500/20' : 'bg-white/5'
                    }`}>
                      {isSectionCompleted ? (
                        <CheckCircle2 size={24} className="text-green-400" />
                      ) : (
                        <Icon size={24} className={section.color} />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-neutral-500 font-medium">SECTION {idx + 1}</span>
                        {isSectionCompleted && <span className="text-xs text-green-400 font-medium">Completed</span>}
                      </div>
                      <h3 className="text-white font-semibold">{section.title}</h3>
                      <p className="text-sm text-neutral-400 truncate">{section.description}</p>
                    </div>
                    <div className="flex-shrink-0 flex items-center gap-2 text-neutral-500">
                      <BookOpen size={14} />
                      <span className="text-xs">{section.steps.length} steps</span>
                      <span className="text-xs text-neutral-600">~{section.estimatedMinutes} min</span>
                      <ChevronRight size={16} className="ml-2" />
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Continue Learning - Cross Navigation */}
          <div className="mt-8">
            <h3 className="text-sm font-semibold text-neutral-400 uppercase tracking-wider mb-3">Continue Learning</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Link href="/portal/training/sales" className="rounded-xl border border-white/10 bg-white/[0.02] p-4 hover:bg-white/[0.05] transition-colors group">
                <Target size={20} className="text-brand-green mb-2" />
                <h4 className="text-sm font-semibold text-white group-hover:text-brand-green transition-colors">Sales Training</h4>
                <p className="text-xs text-neutral-500 mt-1">7-module sales certification program</p>
              </Link>
              <Link href="/portal/training/library" className="rounded-xl border border-white/10 bg-white/[0.02] p-4 hover:bg-white/[0.05] transition-colors group">
                <GraduationCap size={20} className="text-purple-400 mb-2" />
                <h4 className="text-sm font-semibold text-white group-hover:text-purple-400 transition-colors">Training Library</h4>
                <p className="text-xs text-neutral-500 mt-1">Audio, video, quizzes, and flashcards</p>
              </Link>
              <Link href="/portal/training" className="rounded-xl border border-white/10 bg-white/[0.02] p-4 hover:bg-white/[0.05] transition-colors group">
                <BookOpen size={20} className="text-blue-400 mb-2" />
                <h4 className="text-sm font-semibold text-white group-hover:text-blue-400 transition-colors">Training Hub</h4>
                <p className="text-xs text-neutral-500 mt-1">All training paths in one place</p>
              </Link>
            </div>
          </div>

          {/* Info Footer */}
          <div className="mt-8 rounded-xl border border-white/5 bg-white/[0.02] p-5">
            <div className="flex items-start gap-3">
              <Lightbulb size={18} className="text-blue-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-white">Tips</p>
                <ul className="text-xs text-neutral-400 mt-1 space-y-1">
                  <li>- You can complete sections in any order.</li>
                  <li>- Each section has a short quiz (80% to pass) before you can mark it complete.</li>
                  <li>- Use the &quot;Try It&quot; links to jump directly to the platform features being discussed.</li>
                  <li>- Your progress is saved automatically.</li>
                  <li>- Complete all 8 sections for full platform onboarding.</li>
                </ul>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

