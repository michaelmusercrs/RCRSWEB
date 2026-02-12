import {
  Truck,
  ClipboardCheck,
  Route,
  Package,
  RotateCcw,
  Warehouse,
} from 'lucide-react';
import type { WalkthroughData } from './types';

export const driversWalkthrough: WalkthroughData = {
  slug: 'drivers',
  name: 'Richard & Drivers',
  role: 'Delivery Team',
  greeting: 'Welcome, drivers! This walkthrough covers your daily delivery tools and workflows.',
  description: 'Driver dashboard, loading checklist, delivery workflow, route management, returns, and warehouse operations.',
  icon: Truck,
  accentColor: 'text-orange-400',
  accentGradient: 'from-orange-500/20 to-amber-500/20',
  borderColor: 'border-orange-500/30',
  sections: [
    {
      id: 'driver-dashboard',
      number: 1,
      title: 'Driver Dashboard',
      description: 'Your home screen — see today\'s deliveries, ticket queue, and quick status updates.',
      icon: Truck,
      iconColor: 'text-orange-400',
      steps: [
        {
          title: 'Accessing the Dashboard',
          bullets: [
            'Log in to the delivery portal at /portal/delivery to see your driver dashboard.',
            'The dashboard shows today\'s delivery tickets sorted by priority and scheduled time.',
            'Each ticket card shows: customer name, address, material count, and status.',
            'Urgent tickets appear at the top with a red priority badge.',
          ],
          tryItLink: { label: 'Open Delivery Dashboard', href: '/portal/delivery' },
        },
        {
          title: 'Understanding Ticket Status',
          bullets: [
            'ASSIGNED: Your ticket is ready — materials need to be pulled and loaded.',
            'LOADING: Materials are being loaded onto your truck in the warehouse.',
            'LOADED / QC_PASSED: Truck is loaded and quality checked — ready to roll.',
            'EN_ROUTE: You\'re on the way to the delivery site.',
            'DELIVERED: Materials dropped off, customer confirmed, photos taken.',
          ],
        },
        {
          title: 'Updating Status on the Go',
          bullets: [
            'Tap the status button on your ticket to advance it to the next stage.',
            'Each status change sends automatic notifications to the office and customer.',
            'Status updates also log your GPS location for delivery verification.',
            'If there\'s an issue, use the "Report Problem" button before advancing status.',
          ],
          tip: 'Update your ticket status in real-time as you progress. The office and customer rely on these updates for accurate ETAs.',
        },
      ],
    },
    {
      id: 'loading-checklist',
      number: 2,
      title: 'Loading Checklist',
      description: 'Step-by-step loading process to ensure everything gets on the truck correctly.',
      icon: ClipboardCheck,
      iconColor: 'text-green-400',
      steps: [
        {
          title: 'Using the Loading Assistant',
          bullets: [
            'Access the Loading Checklist from the delivery portal or your ticket detail page.',
            'The checklist shows every material on the ticket with quantities and handling notes.',
            'Check off each item as you load it — this ensures nothing gets missed.',
            'The system warns you if the total weight exceeds your vehicle\'s capacity.',
          ],
          tryItLink: { label: 'Try Loading Checklist', href: '/portal/delivery/loading-assist' },
        },
        {
          title: 'Loading Best Practices',
          bullets: [
            'Load heavy items first (shingle bundles) on the bottom and toward the front.',
            'Strap items securely — every load should have minimum 2 straps.',
            'Keep fragile items (vents, flashing) separated and padded.',
            'Take a photo of the loaded truck before departing for QC records.',
          ],
        },
        {
          title: 'Quality Check (QC)',
          bullets: [
            'After loading, the system prompts a QC review before marking QC_PASSED.',
            'Verify: all items loaded, straps secure, truck weight within limits, special items protected.',
            'If QC fails, note the issue and fix it before departing.',
            'QC-passed tickets are cleared for dispatch — you\'re good to go.',
          ],
          tip: 'Always double-check special instructions on the ticket before closing the tailgate. Gate codes, staging preferences, and hazards are easy to miss.',
        },
      ],
    },
    {
      id: 'delivery-workflow',
      number: 3,
      title: 'Delivery Workflow',
      description: 'The full delivery lifecycle from dispatch to completion.',
      icon: Package,
      iconColor: 'text-blue-400',
      steps: [
        {
          title: 'Pre-Departure',
          bullets: [
            'Review the delivery ticket for customer info, address, and special instructions.',
            'Verify your truck is loaded correctly using the loading checklist.',
            'Check the route and estimated drive time.',
            'Update ticket status to EN_ROUTE when you leave the warehouse.',
          ],
        },
        {
          title: 'On-Site Arrival',
          bullets: [
            'Update status to ARRIVED when you reach the job site.',
            'The customer receives an automatic "driver arrived" notification.',
            'Verify the delivery address matches the ticket.',
            'Locate the staging area per the ticket\'s special instructions.',
          ],
        },
        {
          title: 'Unloading & Delivery',
          bullets: [
            'Unload materials to the designated staging area.',
            'Place materials where the roofing crew can access them easily.',
            'Take photos of the delivered materials at their staging location.',
            'Have the customer (if present) confirm receipt on your device.',
          ],
        },
        {
          title: 'Post-Delivery',
          bullets: [
            'Update status to DELIVERED with delivery photos attached.',
            'Note any issues: damaged materials, customer concerns, site conditions.',
            'If materials need to be returned, mark the ticket as RETURN_PENDING.',
            'Head to your next delivery or return to the warehouse.',
          ],
          tip: 'Always take at least 3 photos: the full load on the truck, materials on the ground at the site, and a wide shot showing the house address.',
        },
      ],
    },
    {
      id: 'routes',
      number: 4,
      title: 'Route Management',
      description: 'Planning efficient delivery routes and managing multi-stop runs.',
      icon: Route,
      iconColor: 'text-cyan-400',
      steps: [
        {
          title: 'Route Overview',
          bullets: [
            'Your daily route shows all deliveries in optimized order.',
            'The system suggests the most efficient route based on addresses and time windows.',
            'Multi-stop routes are grouped by geographic area when possible.',
            'Check the route each morning to plan your day efficiently.',
          ],
        },
        {
          title: 'Route Adjustments',
          bullets: [
            'If a customer reschedules, the office updates the ticket and your route adjusts.',
            'For urgent add-on deliveries, the dispatcher will call and update your queue.',
            'If traffic or weather forces a route change, update the office via GroupMe.',
            'Log any route deviations in the ticket notes for records.',
          ],
        },
        {
          title: 'Multi-Stop Deliveries',
          bullets: [
            'When you have multiple stops, load them in reverse delivery order (last stop loaded first).',
            'Each stop has its own ticket — update each independently.',
            'Time between stops should account for unloading and customer interaction.',
            'Return any unused materials from all stops at end of day.',
          ],
          tip: 'Check Google Maps for traffic before each leg. A 5-minute traffic check can save 30 minutes of sitting in a jam.',
        },
      ],
    },
    {
      id: 'returns',
      number: 5,
      title: 'Returns & Special Situations',
      description: 'Handling material returns, damaged goods, and unexpected situations.',
      icon: RotateCcw,
      iconColor: 'text-red-400',
      steps: [
        {
          title: 'Initiating a Return',
          bullets: [
            'If materials need to come back, set the ticket status to RETURN_PENDING.',
            'Note the reason: wrong items, excess materials, damaged goods, or customer refusal.',
            'Take photos of the materials to be returned.',
            'The office coordinates the return pickup or you bring them back on your route.',
          ],
        },
        {
          title: 'Handling Damaged Materials',
          bullets: [
            'If materials are damaged during transit, document with photos immediately.',
            'Do not deliver damaged materials — customer satisfaction is the priority.',
            'Report the damage to the office so replacements can be arranged.',
            'File a damage report in the system with photos and description.',
          ],
        },
        {
          title: 'Difficult Situations',
          bullets: [
            'If a customer refuses delivery, note the reason and contact the office immediately.',
            'If you can\'t access the delivery site (locked gate, blocked road), call the customer.',
            'For safety concerns (aggressive dogs, unsafe conditions), do not proceed — call the office.',
            'Weather delays: if conditions are unsafe for unloading, wait or reschedule.',
          ],
          tip: 'When in doubt, call the office. It\'s always better to take a few minutes to confirm than to deliver to the wrong spot or leave materials unsecured.',
        },
      ],
    },
    {
      id: 'warehouse',
      number: 6,
      title: 'Warehouse Operations',
      description: 'End-of-day procedures, inventory returns, and warehouse coordination.',
      icon: Warehouse,
      iconColor: 'text-amber-400',
      steps: [
        {
          title: 'End-of-Day Procedures',
          bullets: [
            'Return all undelivered materials to their proper warehouse locations.',
            'Update any remaining ticket statuses — no ticket should be left in EN_ROUTE overnight.',
            'Log your mileage and any fuel receipts.',
            'Report any vehicle maintenance issues (tires, brakes, straps, etc.).',
          ],
        },
        {
          title: 'Inventory Returns',
          bullets: [
            'Returned materials must be checked back into inventory.',
            'Use the inventory adjustment feature to record returned items.',
            'Damaged returns go to the damage holding area, not back to stock.',
            'Complete the return process in the system so inventory counts stay accurate.',
          ],
        },
        {
          title: 'Warehouse Safety',
          bullets: [
            'Follow all forklift safety procedures — certification required.',
            'Keep loading bays clear of debris and properly lit.',
            'Report any safety hazards immediately to the warehouse manager.',
            'Wear proper PPE: steel-toe boots, gloves, and hard hat in the loading area.',
          ],
          tip: 'Spend 10 minutes at end of day tidying your truck and reviewing tomorrow\'s tickets. A clean start makes for a smooth day.',
        },
      ],
    },
  ],
};
