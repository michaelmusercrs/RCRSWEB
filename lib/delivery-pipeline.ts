// ============================================================
// 18-Stage Delivery Pipeline Configuration
// River City Roofing Solutions - Delivery Management System
// ============================================================

export type DeliveryStage =
  | 'ORDER_CREATED'
  | 'ORDER_REVIEWED'
  | 'DRIVER_ASSIGNED'
  | 'WAREHOUSE_NOTIFIED'
  | 'MATERIALS_PULLED'
  | 'LOAD_VERIFIED'
  | 'DEPARTURE_CONFIRMED'
  | 'EN_ROUTE'
  | 'ARRIVED_AT_SITE'
  | 'UNLOADING'
  | 'DELIVERY_CONFIRMED'
  | 'QC_PHOTOS'
  | 'OFFICE_NOTIFIED'
  | 'BILLING_REVIEW'
  | 'INVOICE_SENT'
  | 'PAYMENT_RECEIVED'
  | 'JOB_CLOSED';

export interface StageConfig {
  key: DeliveryStage;
  label: string;
  shortLabel: string;
  description: string;
  color: string;
  bgColor: string;
  borderColor: string;
  icon: string; // lucide icon name
  requiresPhoto: boolean;
  requiresGPS: boolean;
  requiresVerification: boolean;
  actionLabel: string;
  role: 'office' | 'warehouse' | 'driver' | 'admin' | 'billing';
  group: 'order' | 'warehouse' | 'transit' | 'delivery' | 'closeout';
}

export const PIPELINE_STAGES: StageConfig[] = [
  {
    key: 'ORDER_CREATED',
    label: 'Order Created',
    shortLabel: 'Created',
    description: 'Delivery order has been created from job breakdown',
    color: 'text-zinc-400',
    bgColor: 'bg-zinc-700/30',
    borderColor: 'border-zinc-600',
    icon: 'FilePlus',
    requiresPhoto: false,
    requiresGPS: false,
    requiresVerification: false,
    actionLabel: 'Create Order',
    role: 'office',
    group: 'order',
  },
  {
    key: 'ORDER_REVIEWED',
    label: 'Order Reviewed',
    shortLabel: 'Reviewed',
    description: 'Materials list and quantities verified by office',
    color: 'text-blue-400',
    bgColor: 'bg-blue-500/15',
    borderColor: 'border-blue-500/30',
    icon: 'ClipboardCheck',
    requiresPhoto: false,
    requiresGPS: false,
    requiresVerification: true,
    actionLabel: 'Review Order',
    role: 'office',
    group: 'order',
  },
  {
    key: 'DRIVER_ASSIGNED',
    label: 'Driver Assigned',
    shortLabel: 'Assigned',
    description: 'Driver and vehicle assigned to delivery',
    color: 'text-cyan-400',
    bgColor: 'bg-cyan-500/15',
    borderColor: 'border-cyan-500/30',
    icon: 'UserCheck',
    requiresPhoto: false,
    requiresGPS: false,
    requiresVerification: false,
    actionLabel: 'Assign Driver',
    role: 'office',
    group: 'order',
  },
  {
    key: 'WAREHOUSE_NOTIFIED',
    label: 'Warehouse Notified',
    shortLabel: 'Notified',
    description: 'Warehouse team notified to prepare materials',
    color: 'text-indigo-400',
    bgColor: 'bg-indigo-500/15',
    borderColor: 'border-indigo-500/30',
    icon: 'Bell',
    requiresPhoto: false,
    requiresGPS: false,
    requiresVerification: false,
    actionLabel: 'Notify Warehouse',
    role: 'office',
    group: 'warehouse',
  },
  {
    key: 'MATERIALS_PULLED',
    label: 'Materials Pulled',
    shortLabel: 'Pulled',
    description: 'Materials pulled from inventory and staged for loading',
    color: 'text-yellow-400',
    bgColor: 'bg-yellow-500/15',
    borderColor: 'border-yellow-500/30',
    icon: 'PackageOpen',
    requiresPhoto: true,
    requiresGPS: false,
    requiresVerification: true,
    actionLabel: 'Confirm Pulled',
    role: 'warehouse',
    group: 'warehouse',
  },
  {
    key: 'LOAD_VERIFIED',
    label: 'Load Verified',
    shortLabel: 'Loaded',
    description: 'Truck loaded and verified — photo + GPS required',
    color: 'text-amber-400',
    bgColor: 'bg-amber-500/15',
    borderColor: 'border-amber-500/30',
    icon: 'ShieldCheck',
    requiresPhoto: true,
    requiresGPS: true,
    requiresVerification: true,
    actionLabel: 'Verify Load',
    role: 'driver',
    group: 'warehouse',
  },
  {
    key: 'DEPARTURE_CONFIRMED',
    label: 'Departure Confirmed',
    shortLabel: 'Departed',
    description: 'Driver confirmed departure from warehouse — GPS captured',
    color: 'text-orange-400',
    bgColor: 'bg-orange-500/15',
    borderColor: 'border-orange-500/30',
    icon: 'LogOut',
    requiresPhoto: false,
    requiresGPS: true,
    requiresVerification: false,
    actionLabel: 'Confirm Departure',
    role: 'driver',
    group: 'transit',
  },
  {
    key: 'EN_ROUTE',
    label: 'En Route',
    shortLabel: 'En Route',
    description: 'Driver is en route to job site — GPS tracking active',
    color: 'text-purple-400',
    bgColor: 'bg-purple-500/15',
    borderColor: 'border-purple-500/30',
    icon: 'Navigation',
    requiresPhoto: false,
    requiresGPS: true,
    requiresVerification: false,
    actionLabel: 'Start Route',
    role: 'driver',
    group: 'transit',
  },
  {
    key: 'ARRIVED_AT_SITE',
    label: 'Arrived at Site',
    shortLabel: 'Arrived',
    description: 'Driver arrived at job site — photo + GPS + address verification',
    color: 'text-rose-400',
    bgColor: 'bg-rose-500/15',
    borderColor: 'border-rose-500/30',
    icon: 'MapPin',
    requiresPhoto: true,
    requiresGPS: true,
    requiresVerification: true,
    actionLabel: 'Mark Arrived',
    role: 'driver',
    group: 'delivery',
  },
  {
    key: 'UNLOADING',
    label: 'Unloading',
    shortLabel: 'Unloading',
    description: 'Materials being unloaded at job site — photo required',
    color: 'text-pink-400',
    bgColor: 'bg-pink-500/15',
    borderColor: 'border-pink-500/30',
    icon: 'PackageOpen',
    requiresPhoto: true,
    requiresGPS: false,
    requiresVerification: false,
    actionLabel: 'Start Unloading',
    role: 'driver',
    group: 'delivery',
  },
  {
    key: 'DELIVERY_CONFIRMED',
    label: 'Delivery Confirmed',
    shortLabel: 'Delivered',
    description: 'All materials delivered and confirmed — photo + GPS',
    color: 'text-emerald-400',
    bgColor: 'bg-emerald-500/15',
    borderColor: 'border-emerald-500/30',
    icon: 'PackageCheck',
    requiresPhoto: true,
    requiresGPS: true,
    requiresVerification: true,
    actionLabel: 'Confirm Delivery',
    role: 'driver',
    group: 'delivery',
  },
  {
    key: 'QC_PHOTOS',
    label: 'QC Photos',
    shortLabel: 'QC',
    description: 'Quality control photos uploaded and reviewed',
    color: 'text-teal-400',
    bgColor: 'bg-teal-500/15',
    borderColor: 'border-teal-500/30',
    icon: 'Camera',
    requiresPhoto: true,
    requiresGPS: false,
    requiresVerification: true,
    actionLabel: 'Upload QC Photos',
    role: 'driver',
    group: 'closeout',
  },
  {
    key: 'OFFICE_NOTIFIED',
    label: 'Office Notified',
    shortLabel: 'Notified',
    description: 'Office has been notified of delivery completion',
    color: 'text-sky-400',
    bgColor: 'bg-sky-500/15',
    borderColor: 'border-sky-500/30',
    icon: 'BellRing',
    requiresPhoto: false,
    requiresGPS: false,
    requiresVerification: false,
    actionLabel: 'Notify Office',
    role: 'driver',
    group: 'closeout',
  },
  {
    key: 'BILLING_REVIEW',
    label: 'Billing Review',
    shortLabel: 'Billing',
    description: 'Invoice and costs under review by billing team',
    color: 'text-violet-400',
    bgColor: 'bg-violet-500/15',
    borderColor: 'border-violet-500/30',
    icon: 'Receipt',
    requiresPhoto: false,
    requiresGPS: false,
    requiresVerification: true,
    actionLabel: 'Start Billing Review',
    role: 'billing',
    group: 'closeout',
  },
  {
    key: 'INVOICE_SENT',
    label: 'Invoice Sent',
    shortLabel: 'Invoiced',
    description: 'Invoice sent to customer',
    color: 'text-fuchsia-400',
    bgColor: 'bg-fuchsia-500/15',
    borderColor: 'border-fuchsia-500/30',
    icon: 'Send',
    requiresPhoto: false,
    requiresGPS: false,
    requiresVerification: false,
    actionLabel: 'Send Invoice',
    role: 'billing',
    group: 'closeout',
  },
  {
    key: 'PAYMENT_RECEIVED',
    label: 'Payment Received',
    shortLabel: 'Paid',
    description: 'Payment received from customer',
    color: 'text-lime-400',
    bgColor: 'bg-lime-500/15',
    borderColor: 'border-lime-500/30',
    icon: 'BadgeDollarSign',
    requiresPhoto: false,
    requiresGPS: false,
    requiresVerification: true,
    actionLabel: 'Record Payment',
    role: 'billing',
    group: 'closeout',
  },
  {
    key: 'JOB_CLOSED',
    label: 'Job Closed',
    shortLabel: 'Closed',
    description: 'Delivery job fully closed',
    color: 'text-green-400',
    bgColor: 'bg-green-500/15',
    borderColor: 'border-green-500/30',
    icon: 'CheckCircle2',
    requiresPhoto: false,
    requiresGPS: false,
    requiresVerification: false,
    actionLabel: 'Close Job',
    role: 'admin',
    group: 'closeout',
  },
];

export const STAGE_GROUPS = [
  { key: 'order', label: 'Order Setup', color: 'text-blue-400' },
  { key: 'warehouse', label: 'Warehouse', color: 'text-yellow-400' },
  { key: 'transit', label: 'Transit', color: 'text-purple-400' },
  { key: 'delivery', label: 'On Site', color: 'text-rose-400' },
  { key: 'closeout', label: 'Closeout', color: 'text-green-400' },
] as const;

export function getStageIndex(stage: DeliveryStage): number {
  return PIPELINE_STAGES.findIndex(s => s.key === stage);
}

export function getStageConfig(stage: DeliveryStage): StageConfig {
  return PIPELINE_STAGES.find(s => s.key === stage) || PIPELINE_STAGES[0];
}

export function getNextStage(stage: DeliveryStage): DeliveryStage | null {
  const idx = getStageIndex(stage);
  if (idx < 0 || idx >= PIPELINE_STAGES.length - 1) return null;
  return PIPELINE_STAGES[idx + 1].key;
}

export function isStageComplete(currentStage: DeliveryStage, checkStage: DeliveryStage): boolean {
  return getStageIndex(currentStage) > getStageIndex(checkStage);
}

export function isStageCurrent(currentStage: DeliveryStage, checkStage: DeliveryStage): boolean {
  return currentStage === checkStage;
}

// Return ticket types
export type ReturnDestination = 'internal' | 'distributor';

export interface DistributorInfo {
  name: string;
  locations: string[];
}

export const DISTRIBUTORS: DistributorInfo[] = [
  { name: 'Advance Build Products', locations: ['Huntsville, AL', 'Decatur, AL'] },
  { name: 'Beacon', locations: ['Huntsville, AL', 'Decatur, AL', 'Birmingham, AL'] },
  { name: 'Gold Eagle', locations: ['Huntsville, AL', 'Decatur, AL'] },
  { name: "Lowe's", locations: ['Huntsville, AL', 'Madison, AL', 'Decatur, AL'] },
  { name: 'Home Depot', locations: ['Huntsville, AL', 'Madison, AL', 'Decatur, AL'] },
];

// Billing visibility rules
export type UserRole = 'driver' | 'warehouse' | 'office' | 'admin' | 'billing';

export interface BillingVisibility {
  showPurchasePrice: boolean;
  showFinalPrice: boolean;
  showMargin: boolean;
  showJobNimbusPrice: boolean;
}

export function getBillingVisibility(role: UserRole): BillingVisibility {
  switch (role) {
    case 'admin':
    case 'office':
    case 'billing':
      return { showPurchasePrice: true, showFinalPrice: true, showMargin: true, showJobNimbusPrice: true };
    case 'driver':
    case 'warehouse':
    default:
      return { showPurchasePrice: false, showFinalPrice: false, showMargin: false, showJobNimbusPrice: false };
  }
}

// Friday inventory reminder
export function isFridayReminderDue(): boolean {
  const now = new Date();
  return now.getDay() === 5; // Friday
}

export function getNextFriday(): Date {
  const now = new Date();
  const dayOfWeek = now.getDay();
  const daysUntilFriday = dayOfWeek <= 5 ? 5 - dayOfWeek : 7 - dayOfWeek + 5;
  const nextFriday = new Date(now);
  nextFriday.setDate(now.getDate() + (daysUntilFriday === 0 ? 7 : daysUntilFriday));
  nextFriday.setHours(8, 0, 0, 0);
  return nextFriday;
}
