'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  CheckCircle,
  ChevronDown,
  ChevronUp,
  Package,
  Truck,
  Users,
  FileText,
  Shield,
  Wifi,
  RotateCcw,
  Play,
  BookOpen,
  Phone,
  AlertTriangle,
  Clock,
  Camera,
  MessageCircle,
  Monitor,
  Volume2,
  DoorOpen,
  Lightbulb,
  Sparkles,
  ArrowRight,
  MapPin,
  Clipboard,
  Award,
  Star,
  Eye,
  CheckSquare,
  Square,
  Zap,
  HardHat,
  CircleDot,
} from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

interface OnboardingSection {
  id: string;
  number: number;
  title: string;
  icon: typeof Package;
  iconColor: string;
  content: SectionContent;
  tryItLink?: { label: string; href: string };
}

interface SectionContent {
  intro: string;
  subsections: {
    title: string;
    bullets: string[];
    note?: string;
    visual?: 'status-flow' | 'bay-colors' | 'roles-grid' | 'first-delivery-steps';
  }[];
}

// ============================================================================
// Section Data
// ============================================================================

const SECTIONS: OnboardingSection[] = [
  {
    id: 'welcome',
    number: 1,
    title: 'Welcome to RCRS Delivery',
    icon: Star,
    iconColor: 'text-[#39FF14]',
    tryItLink: { label: 'View Delivery Dashboard', href: '/portal/delivery' },
    content: {
      intro: 'Welcome to River City Roofing Solutions! This guide will walk you through everything you need to know about our delivery ecosystem. The delivery team is the backbone of our operation -- you ensure crews have the right materials at the right place and time.',
      subsections: [
        {
          title: 'System Overview',
          bullets: [
            'RCRS uses a fully digital delivery management system accessible from any phone or computer.',
            'Delivery tickets are created automatically when material orders are placed by the office.',
            'Every delivery follows a consistent workflow with real-time status tracking.',
            'The system notifies customers, drivers, and office staff at every stage.',
            'AI-powered assistance is available to help with loading procedures and safety tips.',
          ],
        },
        {
          title: 'Team Roles',
          visual: 'roles-grid',
          bullets: [
            'Driver: Loads materials, delivers to job sites, interacts with customers, takes photos.',
            'Warehouse: Pulls materials, manages inventory, operates forklift, maintains loading bays.',
            'Office: Creates tickets, manages schedules, communicates with customers, handles returns.',
            'Manager: Oversees operations, reviews QC reports, manages team performance metrics.',
          ],
        },
        {
          title: 'Key Contacts',
          bullets: [
            'Dispatch Office: (256) 274-8530 ext 1',
            'Warehouse Manager: (256) 274-8530 ext 3',
            'Emergency Line: (256) 274-8530 ext 9',
            'Customer Service: rcrs@rivercityroofingsolutions.com',
          ],
        },
        {
          title: 'System Requirements',
          bullets: [
            'Smartphone with camera (Android or iPhone)',
            'Access to the RCRS portal (URL provided at onboarding)',
            'Your login credentials (issued by office admin)',
            'Reliable cellular data or WiFi connection',
          ],
        },
      ],
    },
  },
  {
    id: 'work-orders',
    number: 2,
    title: 'Understanding Work Orders',
    icon: FileText,
    iconColor: 'text-blue-400',
    tryItLink: { label: 'View Sample Tickets', href: '/portal/delivery/loading' },
    content: {
      intro: 'Work orders (delivery tickets) are the core documents that drive every delivery. Understanding how they flow through the system is essential to doing your job effectively.',
      subsections: [
        {
          title: 'How Work Orders Are Created',
          bullets: [
            'Office staff or sales reps place a material order through the portal or CRM.',
            'The system generates a delivery ticket with a unique ID (format: DT-YYYY-XXXX).',
            'Materials are listed with quantities, weights, and handling instructions.',
            'Driver and vehicle are assigned based on route, availability, and vehicle capacity.',
            'Tickets appear in the Loading Queue automatically.',
          ],
        },
        {
          title: 'Work Order Statuses',
          bullets: [
            'ASSIGNED: Ticket created, driver/vehicle assigned, materials not yet pulled.',
            'MATERIALS_PULLED: Warehouse has gathered all items from inventory.',
            'LOADING: Materials are being loaded onto the vehicle in a loading bay.',
            'LOADED: All materials on the truck, awaiting quality check.',
            'QC_PASSED: Quality control inspection passed, ready for dispatch.',
            'EN_ROUTE: Driver is heading to the delivery site.',
            'ARRIVED: Driver has arrived at the job site.',
            'UNLOADING: Materials are being unloaded and staged.',
            'DELIVERED: All materials placed, customer confirmed receipt.',
            'RETURN_PENDING: Some materials need to come back to warehouse.',
            'RETURNED: Return materials received back at warehouse.',
            'COMPLETED: Ticket fully closed, all documentation done.',
          ],
        },
        {
          title: 'Reading a Work Order',
          bullets: [
            'Ticket ID: Unique identifier shown at the top of every ticket.',
            'Priority: URGENT (red), RUSH (amber), NORMAL (gray) -- determines loading order.',
            'Customer Info: Name, phone, address -- always verify before departure.',
            'Materials List: Item name, quantity, unit, weight, handling category.',
            'Special Instructions: Gate codes, staging preferences, hazards, customer notes.',
            'Driver & Vehicle: Your assigned truck and any multi-stop route info.',
            'Scheduled Time: When the customer expects delivery -- plan your loading accordingly.',
          ],
        },
        {
          title: 'Priority Levels',
          bullets: [
            'URGENT: Emergency repairs, tarp jobs, active leaks. Load first, deliver immediately.',
            'RUSH: Insurance deadlines, crew waiting on-site. Load before normal priority.',
            'NORMAL: Standard scheduled deliveries. Load in scheduled time order.',
          ],
          note: 'Always check priority before loading. An urgent ticket that arrived after a normal ticket still gets loaded first.',
        },
      ],
    },
  },
  {
    id: 'loading-process',
    number: 3,
    title: 'The Loading Process',
    icon: Package,
    iconColor: 'text-amber-400',
    tryItLink: { label: 'Try Loading Assistant', href: '/portal/delivery/loading-assist' },
    content: {
      intro: 'Loading is the most hands-on part of the delivery process. Proper loading ensures materials arrive safely, the vehicle handles correctly, and the job site is set up for success.',
      subsections: [
        {
          title: 'Warehouse Layout Overview',
          bullets: [
            'Loading Bays: 3 bays, numbered 1-3. Bay status shows on the warehouse display.',
            'Shingle Storage: Back wall, organized by brand and color.',
            'Underlayment & Rolls: Middle aisle, stored upright on racks.',
            'Flashing & Accessories: Front bins, organized by type and size.',
            'Fragile / Small Items: Enclosed shelving near the office window.',
            'Forklift Aisle: Center lane -- KEEP CLEAR at all times.',
          ],
        },
        {
          title: 'Material Categories & Handling',
          bullets: [
            'HEAVY (Red): Shingles, plywood, TPO rolls. Lift with legs, use buddy system. Max 50 lbs solo per OSHA.',
            'MEDIUM (Amber): Underlayment, ridge caps, starter strips. Standard handling, protect from crushing.',
            'LIGHT (Blue): Nails, flashing, edge metal, small hardware. Keep contained, secure loose items.',
            'FRAGILE (Purple): Skylights, pipe boots, sealant, caulk. Load last on top, protect from impact.',
          ],
        },
        {
          title: 'Step-by-Step Loading Walkthrough',
          bullets: [
            '1. PPE Check: Steel-toe boots, gloves, safety glasses. Hard hat if forklift is nearby.',
            '2. Review Ticket: Read entire ticket including special instructions before touching materials.',
            '3. Pull Materials: Gather all items from warehouse. Verify quantities match ticket.',
            '4. Organize by Load Order: Heavy items first (bottom/cab-side), fragile items last (top).',
            '5. Load Truck: Place items methodically. Distribute weight evenly side to side.',
            '6. Secure Load: Ratchet straps every 4 feet. Cross-strap shingle stacks.',
            '7. Verification Photos: Full truck shot + ticket next to load.',
            '8. Confirm in System: Mark load complete in the portal.',
          ],
        },
        {
          title: 'Safety Equipment Requirements',
          bullets: [
            'Required always: Steel-toe boots, work gloves, safety glasses.',
            'When forklift is active: Hard hat.',
            'Near roadways: High-visibility vest.',
            'Keep in cab: First aid kit, fire extinguisher, emergency contact card.',
          ],
        },
        {
          title: 'Weight Limits & Vehicle Capacity',
          bullets: [
            'Cargo Van: 3,000 lbs max. Small repairs, gutter jobs.',
            'Pickup Truck: 4,000 lbs max. Medium residential jobs.',
            'Flatbed Truck: 6,000 lbs max. Full reroofs, multi-material loads.',
            'Box Truck: 10,000 lbs max. Large residential or commercial jobs.',
            'Trailer: 14,000 lbs max. Major commercial projects.',
            'Warning at 80% capacity (yellow). Hard stop at 95% (red).',
          ],
        },
        {
          title: 'Photo Requirements',
          bullets: [
            'Photo 1: Full loaded truck from rear angle showing all materials.',
            'Photo 2: Ticket/paperwork placed next to load for reference.',
            'Photo 3: Close-up of strap/securing points.',
            'Upload all photos through the portal before marking load complete.',
          ],
        },
      ],
    },
  },
  {
    id: 'delivery-workflow',
    number: 4,
    title: 'Delivery Workflow',
    icon: Truck,
    iconColor: 'text-cyan-400',
    tryItLink: { label: 'View Delivery Tracker', href: '/portal/delivery' },
    content: {
      intro: 'The delivery workflow is a 12-status lifecycle that tracks every delivery from creation to completion. Understanding when to advance status and what happens at each stage is critical.',
      subsections: [
        {
          title: 'The 12-Status Delivery Lifecycle',
          visual: 'status-flow',
          bullets: [
            'assigned -> materials_pulled -> loading -> loaded -> qc_passed -> en_route',
            'en_route -> arrived -> unloading -> delivered -> completed',
            'At any point after delivered: return_pending -> returned -> completed',
          ],
        },
        {
          title: 'Status Descriptions & Requirements',
          bullets: [
            'ASSIGNED: Auto-set when ticket is created. No action needed yet.',
            'MATERIALS_PULLED: Set by warehouse when all items are gathered. Triggers queue notification.',
            'LOADING: Set when you tap "Start Loading" and select a bay. Starts the loading timer.',
            'LOADED: Set when all materials are checked off and load is complete. Triggers QC queue.',
            'QC_PASSED: Set by QC inspector after checklist is complete. Triggers dispatch readiness.',
            'EN_ROUTE: Set by driver when leaving warehouse. Sends ETA notification to customer.',
            'ARRIVED: Set by driver at job site. Triggers "driver arrived" customer notification.',
            'UNLOADING: Set when you begin placing materials. Optional status for longer unloads.',
            'DELIVERED: Set when materials are placed and customer confirms. Requires delivery photo.',
            'RETURN_PENDING: Set if any materials need to come back. Requires reason entry.',
            'RETURNED: Set when return materials are checked back into warehouse.',
            'COMPLETED: Auto-set when all documentation is finished.',
          ],
        },
        {
          title: 'Notification Triggers',
          bullets: [
            'LOADING: Office sees ticket move to active loading view.',
            'QC_PASSED: Dispatch is notified that truck is ready to roll.',
            'EN_ROUTE: Customer gets SMS/email with ETA and driver info.',
            'ARRIVED: Customer gets "your driver is here" notification.',
            'DELIVERED: Office gets delivery confirmation. Customer gets receipt.',
            'RETURN_PENDING: Warehouse is alerted to prepare for incoming return.',
          ],
        },
        {
          title: 'Customer Interaction Guidelines',
          bullets: [
            'Always introduce yourself by name and company when arriving.',
            'Confirm the delivery with the customer before unloading.',
            'Ask where they want materials staged (driveway, garage, backyard).',
            'Take before-photos of the property to document existing condition.',
            'Be professional, courteous, and responsive to questions.',
            'If the customer has a complaint, listen, acknowledge, and report to office.',
            'Never argue with a customer -- escalate to your manager.',
          ],
        },
      ],
    },
  },
  {
    id: 'ai-assistant',
    number: 5,
    title: 'Using the AI Assistant',
    icon: Sparkles,
    iconColor: 'text-purple-400',
    tryItLink: { label: 'Open AI Loading Assistant', href: '/portal/delivery/loading-assist' },
    content: {
      intro: 'The RCRS Loading Assistant is an AI-powered chat tool built into the loading interface. It provides real-time guidance, safety tips, and answers to common questions while you work.',
      subsections: [
        {
          title: 'What the AI Assistant Can Help With',
          bullets: [
            'Loading order recommendations for specific material types.',
            'Weight limits and capacity calculations.',
            'Material handling tips and best practices.',
            'Safety reminders and PPE requirements.',
            'Weather preparation (tarping, cold/hot weather handling).',
            'Customer interaction guidelines.',
            'Troubleshooting shortages and substitutions.',
          ],
        },
        {
          title: 'How to Ask Questions',
          bullets: [
            'Use natural language -- type questions like you would ask a coworker.',
            'Quick question buttons are available for the most common topics.',
            'Be specific when asking about a material: "How do I load skylights?"',
            'The assistant matches keywords to the best response in its database.',
            'If it doesn\'t understand, try rephrasing with different keywords.',
          ],
        },
        {
          title: 'Coaching & Reminders',
          bullets: [
            'The assistant can remind you about PPE before loading starts.',
            'It provides handling tips specific to the materials on your current ticket.',
            'Safety warnings are highlighted prominently for high-risk activities.',
            'Fun roofing facts keep things interesting during downtime.',
            'The assistant does not replace human judgment -- always follow your training.',
          ],
        },
        {
          title: 'Example Conversations',
          bullets: [
            '"What PPE do I need?" -> Full safety gear list with situational requirements.',
            '"How do I secure shingle bundles?" -> Cross-strap technique, max stack height, cold weather tips.',
            '"Tips for loading in rain?" -> Tarping procedures, moisture-sensitive materials list.',
            '"What if materials are missing?" -> Stop, notify warehouse manager, document shortage.',
          ],
        },
      ],
    },
  },
  {
    id: 'iot-displays',
    number: 6,
    title: 'Warehouse IoT & Displays',
    icon: Monitor,
    iconColor: 'text-orange-400',
    tryItLink: { label: 'View Warehouse Display', href: '/portal/delivery/warehouse-display' },
    content: {
      intro: 'The RCRS warehouse uses IoT (Internet of Things) devices to enhance loading operations. These smart systems communicate status changes automatically and keep everyone informed.',
      subsections: [
        {
          title: 'Loading Bay Lights',
          visual: 'bay-colors',
          bullets: [
            'GREEN: Bay is available. You can pull your vehicle in.',
            'AMBER (pulsing): Bay is occupied, loading in progress.',
            'RED: Bay is blocked or under maintenance. Do not enter.',
            'WHITE (flashing): Loading complete, QC inspection needed.',
            'The bay lights update automatically when you change ticket status in the app.',
          ],
        },
        {
          title: 'Warehouse TV / Display',
          bullets: [
            'Located above the loading bays on the main wall.',
            'Shows the loading queue: upcoming tickets, priorities, assigned drivers.',
            'Displays bay status: which bay has which ticket.',
            'Auto-updates every 30 seconds from the delivery system.',
            'Shows weather alerts relevant to today\'s deliveries.',
          ],
        },
        {
          title: 'Speaker Announcements',
          bullets: [
            'Audible announcements when a new URGENT ticket enters the queue.',
            'Bay assignment announcements when loading starts.',
            'QC complete announcements when a load passes inspection.',
            'Volume is adjustable by the warehouse manager.',
          ],
        },
        {
          title: 'Door Controls',
          bullets: [
            'Bay doors can be opened via the warehouse display or physical buttons.',
            'Doors auto-close after 5 minutes if no motion is detected.',
            'Emergency stop button is next to each bay door -- red, clearly labeled.',
            'Report any door malfunctions immediately to the warehouse manager.',
          ],
        },
        {
          title: 'How Status Changes Trigger IoT Actions',
          bullets: [
            'When you tap "Start Loading": Bay light turns amber, door opens, display updates.',
            'When you tap "Mark Load Complete": Bay light turns white (flashing), QC audio announcement.',
            'When QC passes: Bay light turns green, door opens for vehicle exit, display clears.',
            'When URGENT ticket is created: Speaker announces priority load incoming.',
          ],
        },
      ],
    },
  },
  {
    id: 'returns-special',
    number: 7,
    title: 'Returns & Special Situations',
    icon: RotateCcw,
    iconColor: 'text-red-400',
    tryItLink: { label: 'View Returns Page', href: '/portal/delivery/returns' },
    content: {
      intro: 'Not every delivery goes perfectly. Returns, damage, weather delays, and other special situations are a normal part of operations. Knowing how to handle them keeps the team running smoothly.',
      subsections: [
        {
          title: 'Return / Pickup Workflow',
          bullets: [
            '1. Office or driver creates a return ticket with reason (over-order, wrong color, damage).',
            '2. Ticket status set to RETURN_PENDING.',
            '3. Driver picks up materials from job site or customer.',
            '4. Materials inspected at warehouse for restock-ability.',
            '5. Warehouse logs returned items into inventory system.',
            '6. Ticket updated to RETURNED, then COMPLETED.',
          ],
        },
        {
          title: 'Handling Damaged Materials',
          bullets: [
            'If you discover damage during loading: Pull the item, photograph it, notify warehouse.',
            'If damage happens during transit: Photograph at job site, report to office immediately.',
            'If customer reports damage on delivery: Document everything, do not argue.',
            'Damaged materials should never be left at a job site unless customer explicitly accepts.',
            'File a damage report in the system before end of day.',
          ],
        },
        {
          title: 'Customer Complaints',
          bullets: [
            'Listen fully before responding. Do not interrupt.',
            'Acknowledge their concern: "I understand, and I want to help resolve this."',
            'If it is something you can fix on-site, do it (e.g., re-stage materials).',
            'If it requires office action, call dispatch immediately.',
            'Always document complaints in the ticket notes.',
            'Follow up with the customer if instructed by the office.',
          ],
        },
        {
          title: 'Weather Delays',
          bullets: [
            'Check weather forecast before loading in the morning.',
            'If rain is expected: Tarp all loads, even for short trips.',
            'If severe weather warnings: Pause deliveries, secure warehouse doors.',
            'Notify office and affected customers of any delays immediately.',
            'Do not deliver during lightning, high winds (40+ mph), or active hail.',
          ],
        },
        {
          title: 'Emergency Procedures',
          bullets: [
            'Vehicle breakdown: Pull over safely, call dispatch, set reflective triangles.',
            'Traffic accident: Ensure safety, call 911, then call office. Do not admit fault.',
            'Load shift/spill: Pull over, re-secure if safe, photograph, call dispatch.',
            'Injury on site: First aid if trained, call 911 for serious injury, report to manager.',
            'Keep emergency numbers saved in your phone and posted in the cab.',
          ],
        },
        {
          title: 'Who to Contact for Issues',
          bullets: [
            'Wrong materials on ticket: Warehouse Manager ext 3',
            'Customer not home / access issue: Dispatch ext 1',
            'Vehicle problem: Office Manager ext 2',
            'Safety concern: Manager on duty, then Safety Hotline ext 9',
            'Billing / payment question from customer: "I\'ll have the office follow up with you."',
          ],
        },
      ],
    },
  },
  {
    id: 'first-delivery',
    number: 8,
    title: 'Your First Delivery',
    icon: Award,
    iconColor: 'text-[#39FF14]',
    tryItLink: { label: 'Open Loading Assistant', href: '/portal/delivery/loading-assist' },
    content: {
      intro: 'Congratulations on completing the onboarding guide! Here is a summary walkthrough for your first real delivery, plus tips from experienced drivers to help you succeed.',
      subsections: [
        {
          title: 'Pre-Delivery Checklist',
          bullets: [
            'Login to RCRS portal and check your assigned tickets for the day.',
            'Verify your vehicle is clean, fueled, and has necessary equipment (straps, tarps, first aid).',
            'Review each ticket: materials, addresses, priority levels, special instructions.',
            'Check the weather forecast and prepare tarps if needed.',
            'Confirm your phone is charged and has data connectivity.',
            'Report to the warehouse at your scheduled start time.',
          ],
        },
        {
          title: 'Step-by-Step First Delivery Walkthrough',
          visual: 'first-delivery-steps',
          bullets: [
            '1. ARRIVE at warehouse. Check in with warehouse manager.',
            '2. REVIEW your first ticket on the portal Loading Queue.',
            '3. PULL materials from shelves. Verify every item and quantity.',
            '4. LOAD vehicle following the load order (heavy first, fragile last).',
            '5. SECURE load with ratchet straps. Get buddy-check from coworker.',
            '6. PHOTO the loaded truck. Upload to system.',
            '7. CONFIRM load complete in the portal. Wait for QC pass.',
            '8. DEPART warehouse. Set GPS to delivery address.',
            '9. ARRIVE at job site. Update status to ARRIVED.',
            '10. GREET customer. Confirm delivery and staging location.',
            '11. UNLOAD materials. Take before/after photos of property.',
            '12. GET customer confirmation. Update status to DELIVERED.',
            '13. RETURN to warehouse for next ticket or end of day.',
          ],
        },
        {
          title: 'Common Mistakes to Avoid',
          bullets: [
            'Not reading special instructions (gate codes, staging preferences).',
            'Loading fragile items under heavy items.',
            'Forgetting to strap the load (even for a "short trip").',
            'Not taking photos at every required stage.',
            'Skipping the QC process to save time.',
            'Not confirming delivery address before departure.',
            'Leaving without customer confirmation of received materials.',
          ],
        },
        {
          title: 'Tips from Experienced Drivers',
          bullets: [
            '"Always do a walk-around before leaving the warehouse. One missed item means a return trip." -- Carlos R.',
            '"Talk to the customer. A 30-second conversation builds trust and prevents complaints." -- Marcus J.',
            '"Keep your cab organized. You\'ll need your phone, ticket, pen, and sometimes the first aid kit quickly." -- Tony R.',
            '"When in doubt, call dispatch. They would rather answer a question than deal with a mistake." -- Carlos R.',
            '"Take pride in your loads. A well-loaded truck is safer and makes you look professional." -- Marcus J.',
          ],
        },
        {
          title: 'Test Run: Interactive Simulator',
          bullets: [
            'Ready to practice? The Loading Assistant page has a full interactive loading simulation.',
            'You can select a mock delivery ticket and walk through every step.',
            'The AI assistant is there to help with questions along the way.',
            'Time yourself to build efficiency before your first real load.',
            'No mistakes count here -- it is all for learning!',
          ],
          note: 'Click "Try It" to open the Loading Assistant and practice your first simulated load.',
        },
      ],
    },
  },
];

// ============================================================================
// Visual Components
// ============================================================================

function StatusFlowVisual() {
  const statuses = [
    { label: 'Assigned', color: 'bg-brand-green' },
    { label: 'Pulled', color: 'bg-purple-500' },
    { label: 'Loading', color: 'bg-amber-500' },
    { label: 'Loaded', color: 'bg-green-500' },
    { label: 'QC Pass', color: 'bg-[#39FF14]' },
    { label: 'En Route', color: 'bg-cyan-500' },
    { label: 'Arrived', color: 'bg-teal-500' },
    { label: 'Unloading', color: 'bg-orange-500' },
    { label: 'Delivered', color: 'bg-emerald-500' },
    { label: 'Completed', color: 'bg-[#39FF14]' },
  ];

  return (
    <div className="my-4 overflow-x-auto pb-2">
      <div className="flex items-center gap-1 min-w-max">
        {statuses.map((s, i) => (
          <div key={s.label} className="flex items-center gap-1">
            <div className="flex flex-col items-center">
              <div className={`w-8 h-8 rounded-full ${s.color} flex items-center justify-center text-[9px] font-bold text-black`}>
                {i + 1}
              </div>
              <span className="text-[9px] text-zinc-500 mt-1 whitespace-nowrap">{s.label}</span>
            </div>
            {i < statuses.length - 1 && (
              <ArrowRight className="w-3 h-3 text-zinc-600 flex-shrink-0 mb-4" />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function BayColorsVisual() {
  const bays = [
    { color: 'bg-green-500', label: 'Available', meaning: 'Bay is free' },
    { color: 'bg-amber-500 animate-pulse', label: 'Occupied', meaning: 'Loading in progress' },
    { color: 'bg-red-500', label: 'Blocked', meaning: 'Maintenance/blocked' },
    { color: 'bg-white animate-pulse', label: 'QC Needed', meaning: 'Load complete, inspect' },
  ];

  return (
    <div className="my-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
      {bays.map(b => (
        <div key={b.label} className="bg-zinc-800/50 rounded-lg p-3 text-center">
          <div className={`w-6 h-6 rounded-full ${b.color} mx-auto mb-2`} />
          <p className="text-xs font-semibold text-white">{b.label}</p>
          <p className="text-[10px] text-zinc-500">{b.meaning}</p>
        </div>
      ))}
    </div>
  );
}

function RolesGridVisual() {
  const roles = [
    { icon: Truck, label: 'Driver', color: 'text-cyan-400', bg: 'bg-cyan-500/10' },
    { icon: Package, label: 'Warehouse', color: 'text-amber-400', bg: 'bg-amber-500/10' },
    { icon: Phone, label: 'Office', color: 'text-blue-400', bg: 'bg-brand-green/10' },
    { icon: Users, label: 'Manager', color: 'text-purple-400', bg: 'bg-purple-500/10' },
  ];

  return (
    <div className="my-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
      {roles.map(r => {
        const Icon = r.icon;
        return (
          <div key={r.label} className={`${r.bg} rounded-lg p-3 text-center border border-white/5`}>
            <Icon className={`w-6 h-6 ${r.color} mx-auto mb-2`} />
            <p className="text-xs font-semibold text-white">{r.label}</p>
          </div>
        );
      })}
    </div>
  );
}

function FirstDeliveryStepsVisual() {
  const steps = [
    { num: 1, label: 'Arrive', icon: MapPin },
    { num: 2, label: 'Review', icon: Eye },
    { num: 3, label: 'Pull', icon: Package },
    { num: 4, label: 'Load', icon: Truck },
    { num: 5, label: 'Secure', icon: Shield },
    { num: 6, label: 'Photo', icon: Camera },
    { num: 7, label: 'Confirm', icon: CheckCircle },
    { num: 8, label: 'Depart', icon: Play },
    { num: 9, label: 'Arrive', icon: MapPin },
    { num: 10, label: 'Greet', icon: MessageCircle },
    { num: 11, label: 'Unload', icon: Package },
    { num: 12, label: 'Deliver', icon: CheckCircle },
  ];

  return (
    <div className="my-4 grid grid-cols-4 sm:grid-cols-6 gap-2">
      {steps.map(s => {
        const Icon = s.icon;
        return (
          <div key={s.num} className="bg-zinc-800/50 rounded-lg p-2 text-center">
            <div className="w-7 h-7 rounded-full bg-[#39FF14]/20 flex items-center justify-center mx-auto mb-1">
              <Icon className="w-3.5 h-3.5 text-[#39FF14]" />
            </div>
            <p className="text-[9px] text-zinc-400">{s.num}. {s.label}</p>
          </div>
        );
      })}
    </div>
  );
}

// ============================================================================
// Component
// ============================================================================

const LS_KEY = 'rcrs-delivery-onboarding-progress';

export default function DeliveryOnboardingPage() {
  const [completedSections, setCompletedSections] = useState<Set<string>>(new Set());
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['welcome']));

  // Load progress from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem(LS_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          setCompletedSections(new Set(parsed));
        }
      }
    } catch {
      // Ignore
    }
  }, []);

  // Save progress to localStorage
  const saveProgress = (updated: Set<string>) => {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(Array.from(updated)));
    } catch {
      // Ignore
    }
  };

  const toggleComplete = (sectionId: string) => {
    setCompletedSections(prev => {
      const next = new Set(prev);
      if (next.has(sectionId)) {
        next.delete(sectionId);
      } else {
        next.add(sectionId);
      }
      saveProgress(next);
      return next;
    });
  };

  const toggleExpanded = (sectionId: string) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      if (next.has(sectionId)) {
        next.delete(sectionId);
      } else {
        next.add(sectionId);
      }
      return next;
    });
  };

  const progress = SECTIONS.length > 0 ? Math.round((completedSections.size / SECTIONS.length) * 100) : 0;
  const allComplete = completedSections.size === SECTIONS.length;

  const handleReset = () => {
    setCompletedSections(new Set());
    saveProgress(new Set());
  };

  return (
    <div className="min-h-screen bg-zinc-950">
      {/* Header */}
      <header className="bg-zinc-900 border-b border-zinc-800 px-4 lg:px-6 py-4">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Link href="/portal/delivery" className="text-zinc-400 hover:text-white transition-colors">
                <ArrowLeft className="w-5 h-5" />
              </Link>
              <div>
                <h1 className="text-xl font-bold text-white flex items-center gap-2">
                  <BookOpen className="w-5 h-5 text-[#39FF14]" />
                  Delivery Team Onboarding
                </h1>
                <p className="text-sm text-zinc-400">Complete guide for new delivery team members</p>
              </div>
            </div>
            <button
              onClick={handleReset}
              className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors flex items-center gap-1"
              title="Reset all progress"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Reset
            </button>
          </div>

          {/* Progress Bar */}
          <div className="mt-4">
            <div className="flex items-center justify-between text-sm mb-1.5">
              <span className="text-zinc-400">Onboarding Progress</span>
              <span className="text-white font-semibold">{completedSections.size}/{SECTIONS.length} sections ({progress}%)</span>
            </div>
            <div className="w-full bg-zinc-800 rounded-full h-3">
              <div
                className="h-3 rounded-full transition-all duration-500 ease-out bg-[#39FF14]"
                style={{ width: `${progress}%` }}
              />
            </div>
            {allComplete && (
              <div className="mt-3 flex items-center gap-2 text-[#39FF14] bg-[#39FF14]/10 rounded-lg px-4 py-2 border border-[#39FF14]/30">
                <Award className="w-5 h-5" />
                <span className="text-sm font-semibold">Onboarding Complete! You are ready for your first delivery.</span>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Sections */}
      <main className="max-w-4xl mx-auto px-4 lg:px-6 py-6 space-y-3">
        {SECTIONS.map(section => {
          const Icon = section.icon;
          const isExpanded = expandedSections.has(section.id);
          const isCompleted = completedSections.has(section.id);

          return (
            <div key={section.id} className={`bg-zinc-900 border rounded-xl overflow-hidden transition-colors ${
              isCompleted ? 'border-[#39FF14]/30' : 'border-zinc-800'
            }`}>
              {/* Section Header (Accordion trigger) */}
              <button
                onClick={() => toggleExpanded(section.id)}
                className="w-full px-5 py-4 flex items-center justify-between hover:bg-zinc-800/30 transition-colors"
              >
                <div className="flex items-center gap-4">
                  {/* Completion indicator */}
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                    isCompleted ? 'bg-[#39FF14] text-black' : 'bg-zinc-800 text-zinc-400'
                  }`}>
                    {isCompleted ? (
                      <CheckCircle className="w-5 h-5" />
                    ) : (
                      <span className="text-sm font-bold">{section.number}</span>
                    )}
                  </div>
                  <div className="text-left">
                    <div className="flex items-center gap-2">
                      <Icon className={`w-4 h-4 ${section.iconColor}`} />
                      <h2 className={`text-sm font-semibold ${isCompleted ? 'text-[#39FF14]' : 'text-white'}`}>
                        {section.title}
                      </h2>
                    </div>
                    <p className="text-xs text-zinc-500 mt-0.5">
                      Section {section.number} of {SECTIONS.length}
                      {isCompleted && ' -- Completed'}
                    </p>
                  </div>
                </div>
                {isExpanded ? (
                  <ChevronUp className="w-5 h-5 text-zinc-500 flex-shrink-0" />
                ) : (
                  <ChevronDown className="w-5 h-5 text-zinc-500 flex-shrink-0" />
                )}
              </button>

              {/* Section Content */}
              {isExpanded && (
                <div className="border-t border-zinc-800">
                  <div className="px-5 py-5 space-y-6">
                    {/* Intro text */}
                    <p className="text-sm text-zinc-300 leading-relaxed">{section.content.intro}</p>

                    {/* Subsections */}
                    {section.content.subsections.map((sub, i) => (
                      <div key={i}>
                        <h3 className="text-sm font-semibold text-white mb-2 flex items-center gap-2">
                          <CircleDot className="w-3.5 h-3.5 text-[#39FF14]" />
                          {sub.title}
                        </h3>

                        {/* Visual aids */}
                        {sub.visual === 'status-flow' && <StatusFlowVisual />}
                        {sub.visual === 'bay-colors' && <BayColorsVisual />}
                        {sub.visual === 'roles-grid' && <RolesGridVisual />}
                        {sub.visual === 'first-delivery-steps' && <FirstDeliveryStepsVisual />}

                        {/* Bullet points */}
                        <ul className="space-y-1.5 ml-5">
                          {sub.bullets.map((bullet, j) => (
                            <li key={j} className="text-xs text-zinc-400 leading-relaxed list-disc">
                              {bullet}
                            </li>
                          ))}
                        </ul>

                        {/* Optional note */}
                        {sub.note && (
                          <div className="mt-2 flex items-start gap-2 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2">
                            <Lightbulb className="w-3.5 h-3.5 text-amber-400 flex-shrink-0 mt-0.5" />
                            <p className="text-[11px] text-amber-300">{sub.note}</p>
                          </div>
                        )}
                      </div>
                    ))}

                    {/* Footer: Mark Complete + Try It */}
                    <div className="flex items-center justify-between pt-4 border-t border-zinc-800">
                      <button
                        onClick={() => toggleComplete(section.id)}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                          isCompleted
                            ? 'bg-[#39FF14]/10 text-[#39FF14] border border-[#39FF14]/30'
                            : 'bg-zinc-800 text-zinc-300 border border-zinc-700 hover:bg-zinc-700'
                        }`}
                      >
                        {isCompleted ? (
                          <>
                            <CheckSquare className="w-4 h-4" />
                            Completed
                          </>
                        ) : (
                          <>
                            <Square className="w-4 h-4" />
                            Mark Complete
                          </>
                        )}
                      </button>

                      {section.tryItLink && (
                        <Link
                          href={section.tryItLink.href}
                          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-zinc-800 text-[#39FF14] border border-[#39FF14]/20 hover:bg-[#39FF14]/10 transition-colors"
                        >
                          <Play className="w-3.5 h-3.5" />
                          {section.tryItLink.label}
                        </Link>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {/* Bottom CTA */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 text-center mt-8">
          <h3 className="text-lg font-bold text-white mb-2">Ready to Get Started?</h3>
          <p className="text-sm text-zinc-400 mb-4 max-w-md mx-auto">
            Once you have completed all sections, head to the Loading Assistant to practice your first simulated delivery.
          </p>
          <div className="flex items-center justify-center gap-3">
            <Link
              href="/portal/delivery/loading-assist"
              className="px-6 py-3 bg-[#39FF14] text-black font-bold rounded-xl hover:bg-[#39FF14]/90 transition-colors text-sm flex items-center gap-2"
            >
              <Play className="w-4 h-4" />
              Start Practice Delivery
            </Link>
            <Link
              href="/portal/training/library#delivery-operations"
              className="px-6 py-3 bg-zinc-800 text-zinc-300 font-semibold rounded-xl hover:bg-zinc-700 transition-colors text-sm border border-zinc-700 flex items-center gap-2"
            >
              <BookOpen className="w-4 h-4" />
              Take the Quiz
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
