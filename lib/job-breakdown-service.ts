/**
 * Job Breakdown Management Service
 *
 * Comprehensive service for creating, managing, and tracking job breakdowns
 * including materials, labor, deliveries, and cost calculations.
 * Supports READ-ONLY import from JobNimbus for pre-populating breakdowns.
 */

import { jobNimbusService, isJobNimbusConfigured } from '@/lib/jobnimbus-service';
import type { JobNimbusJob, JobNimbusContact, JobNimbusEstimate } from '@/lib/jobnimbus-service';

// ============================================
// TYPE DEFINITIONS
// ============================================

export type ProjectType =
  | 'roof_replacement'
  | 'roof_repair'
  | 'gutter_install'
  | 'siding'
  | 'commercial'
  | 'insurance_claim';

export type BreakdownStatus =
  | 'draft'
  | 'pending_approval'
  | 'approved'
  | 'in_progress'
  | 'completed'
  | 'revised';

export interface Address {
  street: string;
  city: string;
  state: string;
  zip: string;
}

export interface MaterialItem {
  category: string;
  productName: string;
  quantity: number;
  unit: string;
  unitCost: number;
  totalCost: number;
  supplier: string;
  leadTime: string;
  inStock: boolean;
}

export interface LaborItem {
  role: string;
  hours: number;
  rate: number;
  totalCost: number;
  assignedTo: string;
}

export interface DeliveryItem {
  deliveryId: string;
  scheduledDate: string;
  materials: string[];
  status: 'scheduled' | 'loaded' | 'en_route' | 'delivered' | 'cancelled';
  driver: string;
}

export interface StatusHistoryEntry {
  status: BreakdownStatus;
  timestamp: string;
  updatedBy: string;
  notes: string;
}

export interface JobBreakdown {
  breakdownId: string;
  jobId: string;
  jobName: string;
  customerName: string;
  address: Address;
  projectType: ProjectType;
  status: BreakdownStatus;

  // Material breakdown
  materials: MaterialItem[];

  // Labor breakdown
  labor: LaborItem[];

  // Delivery breakdown
  deliveries: DeliveryItem[];

  // Cost summary
  materialTotal: number;
  laborTotal: number;
  deliveryFees: number;
  overhead: number;
  profit: number;
  totalEstimate: number;

  // Timeline
  estimatedStartDate: string;
  estimatedEndDate: string;
  actualStartDate?: string;
  actualEndDate?: string;

  // Tracking
  statusHistory: StatusHistoryEntry[];
  notes: string;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  approvedBy?: string;
}

export interface RoofMeasurements {
  sqFt: number;
  pitch: number;
  stories: number;
  perimeterFt: number;
  ridgeFt?: number;
  valleyFt?: number;
  pipeBoots?: number;
  skylights?: number;
}

export interface BreakdownComparison {
  field: string;
  category: 'material' | 'labor' | 'delivery' | 'cost' | 'timeline';
  original: string;
  revised: string;
  difference: string;
}

export interface BreakdownExport {
  breakdownId: string;
  jobName: string;
  customerName: string;
  address: string;
  projectType: string;
  status: string;
  materials: { item: string; qty: string; cost: string }[];
  labor: { role: string; hours: string; cost: string }[];
  materialTotal: string;
  laborTotal: string;
  deliveryFees: string;
  overhead: string;
  profit: string;
  totalEstimate: string;
  estimatedStart: string;
  estimatedEnd: string;
  notes: string;
}

// ============================================
// JOBNIMBUS INTEGRATION TYPES (READ-ONLY)
// ============================================

export interface JNJobSummary {
  jnid: string;
  jobNumber: string;
  jobName: string;
  customerName: string;
  address: string;
  status: string;
  salesRep: string;
  estimateTotal: number;
  createdAt: string;
}

export interface JNBreakdownSource {
  job: JobNimbusJob;
  contact: JobNimbusContact | null;
  estimates: JobNimbusEstimate[];
  totalEstimateValue: number;
}

// ============================================
// SUPPLIER DATA
// ============================================

const SUPPLIERS = {
  shingles: 'ABC Supply - Huntsville',
  underlayment: 'ABC Supply - Huntsville',
  flashing: 'Beacon Roofing - Decatur',
  nails: 'Home Depot Pro - Madison',
  gutters: 'Gutter Supply Co - Huntsville',
  plywood: 'Home Depot Pro - Madison',
  siding: 'Beacon Roofing - Decatur',
  general: 'ABC Supply - Huntsville',
};

// ============================================
// MOCK DATA
// ============================================

const MOCK_BREAKDOWNS: JobBreakdown[] = [
  {
    breakdownId: 'JB-2026-0001',
    jobId: 'JN-4521',
    jobName: 'Henderson Roof Replacement',
    customerName: 'Mark Henderson',
    address: { street: '1482 Oak Valley Dr', city: 'Huntsville', state: 'AL', zip: '35801' },
    projectType: 'roof_replacement',
    status: 'approved',
    materials: [
      { category: 'Shingles', productName: 'GAF Timberline HDZ (Charcoal)', quantity: 45, unit: 'bundles', unitCost: 38.50, totalCost: 1732.50, supplier: 'ABC Supply - Huntsville', leadTime: '1-2 days', inStock: true },
      { category: 'Underlayment', productName: 'GAF FeltBuster Synthetic', quantity: 6, unit: 'rolls', unitCost: 62.00, totalCost: 372.00, supplier: 'ABC Supply - Huntsville', leadTime: '1-2 days', inStock: true },
      { category: 'Starter Strip', productName: 'GAF Pro-Start Starter Strip', quantity: 8, unit: 'bundles', unitCost: 24.00, totalCost: 192.00, supplier: 'ABC Supply - Huntsville', leadTime: '1-2 days', inStock: true },
      { category: 'Ridge Cap', productName: 'GAF Seal-A-Ridge (Charcoal)', quantity: 6, unit: 'bundles', unitCost: 56.00, totalCost: 336.00, supplier: 'ABC Supply - Huntsville', leadTime: '1-2 days', inStock: true },
      { category: 'Drip Edge', productName: 'Drip Edge Flashing 10ft (White)', quantity: 30, unit: 'pieces', unitCost: 5.50, totalCost: 165.00, supplier: 'Beacon Roofing - Decatur', leadTime: '2-3 days', inStock: true },
      { category: 'Ice & Water Shield', productName: 'GAF StormGuard Double Layer', quantity: 4, unit: 'rolls', unitCost: 78.00, totalCost: 312.00, supplier: 'ABC Supply - Huntsville', leadTime: '1-2 days', inStock: true },
      { category: 'Nails', productName: '1.25" Galvanized Roofing Nails', quantity: 4, unit: 'boxes (5lb)', unitCost: 12.50, totalCost: 50.00, supplier: 'Home Depot Pro - Madison', leadTime: '1 day', inStock: true },
      { category: 'Flashing', productName: 'Step Flashing 4x4x8"', quantity: 50, unit: 'pieces', unitCost: 1.80, totalCost: 90.00, supplier: 'Beacon Roofing - Decatur', leadTime: '2-3 days', inStock: true },
      { category: 'Pipe Boots', productName: 'Master Flash 2" Pipe Boot', quantity: 3, unit: 'pieces', unitCost: 14.00, totalCost: 42.00, supplier: 'ABC Supply - Huntsville', leadTime: '1-2 days', inStock: true },
    ],
    labor: [
      { role: 'Lead Installer', hours: 16, rate: 45.00, totalCost: 720.00, assignedTo: 'James Wilson' },
      { role: 'Installer', hours: 32, rate: 35.00, totalCost: 1120.00, assignedTo: 'Team Alpha (2)' },
      { role: 'Helper', hours: 16, rate: 22.00, totalCost: 352.00, assignedTo: 'Day Labor' },
    ],
    deliveries: [
      { deliveryId: 'DL-2026-0041', scheduledDate: '2026-02-14', materials: ['GAF Timberline HDZ (Charcoal)', 'GAF FeltBuster Synthetic', 'GAF StormGuard Double Layer', '1.25" Galvanized Roofing Nails'], status: 'scheduled', driver: 'Carlos Rivera' },
      { deliveryId: 'DL-2026-0042', scheduledDate: '2026-02-14', materials: ['GAF Pro-Start Starter Strip', 'GAF Seal-A-Ridge (Charcoal)', 'Drip Edge Flashing 10ft (White)', 'Step Flashing 4x4x8"', 'Master Flash 2" Pipe Boot'], status: 'scheduled', driver: 'Carlos Rivera' },
    ],
    materialTotal: 3291.50,
    laborTotal: 2192.00,
    deliveryFees: 175.00,
    overhead: 848.78,
    profit: 1301.56,
    totalEstimate: 7808.84,
    estimatedStartDate: '2026-02-15',
    estimatedEndDate: '2026-02-17',
    statusHistory: [
      { status: 'draft', timestamp: '2026-02-06T09:00:00Z', updatedBy: 'Michael Torres', notes: 'Initial breakdown created' },
      { status: 'pending_approval', timestamp: '2026-02-06T14:30:00Z', updatedBy: 'Michael Torres', notes: 'Submitted for review' },
      { status: 'approved', timestamp: '2026-02-07T08:15:00Z', updatedBy: 'Sarah Mitchell', notes: 'Approved - materials ordered' },
    ],
    notes: 'Customer requested charcoal color to match neighbors. Gate code #4429. Dogs in yard - keep gate closed.',
    createdAt: '2026-02-06T09:00:00Z',
    updatedAt: '2026-02-07T08:15:00Z',
    createdBy: 'Michael Torres',
    approvedBy: 'Sarah Mitchell',
  },
  {
    breakdownId: 'JB-2026-0002',
    jobId: 'JN-4533',
    jobName: 'Whitfield Insurance Repair',
    customerName: 'Sarah Whitfield',
    address: { street: '305 Monroe St SW', city: 'Decatur', state: 'AL', zip: '35601' },
    projectType: 'insurance_claim',
    status: 'in_progress',
    materials: [
      { category: 'Shingles', productName: 'Owens Corning Duration (Onyx Black)', quantity: 18, unit: 'bundles', unitCost: 42.00, totalCost: 756.00, supplier: 'ABC Supply - Huntsville', leadTime: '1-2 days', inStock: true },
      { category: 'Underlayment', productName: 'Owens Corning ProArmor Synthetic', quantity: 3, unit: 'rolls', unitCost: 58.00, totalCost: 174.00, supplier: 'ABC Supply - Huntsville', leadTime: '1-2 days', inStock: true },
      { category: 'Plywood', productName: '4x8 CDX Plywood 1/2"', quantity: 6, unit: 'sheets', unitCost: 32.00, totalCost: 192.00, supplier: 'Home Depot Pro - Madison', leadTime: '1 day', inStock: true },
      { category: 'Ice & Water Shield', productName: 'Owens Corning WeatherLock G', quantity: 2, unit: 'rolls', unitCost: 72.00, totalCost: 144.00, supplier: 'ABC Supply - Huntsville', leadTime: '1-2 days', inStock: true },
      { category: 'Flashing', productName: 'Step Flashing 4x4x8"', quantity: 24, unit: 'pieces', unitCost: 1.80, totalCost: 43.20, supplier: 'Beacon Roofing - Decatur', leadTime: '2-3 days', inStock: true },
      { category: 'Nails', productName: '1.25" Galvanized Roofing Nails', quantity: 2, unit: 'boxes (5lb)', unitCost: 12.50, totalCost: 25.00, supplier: 'Home Depot Pro - Madison', leadTime: '1 day', inStock: true },
    ],
    labor: [
      { role: 'Lead Installer', hours: 10, rate: 45.00, totalCost: 450.00, assignedTo: 'James Wilson' },
      { role: 'Installer', hours: 20, rate: 35.00, totalCost: 700.00, assignedTo: 'Team Beta (2)' },
    ],
    deliveries: [
      { deliveryId: 'DL-2026-0038', scheduledDate: '2026-02-10', materials: ['Owens Corning Duration (Onyx Black)', 'Owens Corning ProArmor Synthetic', '4x8 CDX Plywood 1/2"', 'Owens Corning WeatherLock G'], status: 'delivered', driver: 'Marcus Johnson' },
      { deliveryId: 'DL-2026-0039', scheduledDate: '2026-02-10', materials: ['Step Flashing 4x4x8"', '1.25" Galvanized Roofing Nails'], status: 'delivered', driver: 'Marcus Johnson' },
    ],
    materialTotal: 1334.20,
    laborTotal: 1150.00,
    deliveryFees: 125.00,
    overhead: 391.38,
    profit: 600.12,
    totalEstimate: 3600.70,
    estimatedStartDate: '2026-02-10',
    estimatedEndDate: '2026-02-11',
    actualStartDate: '2026-02-10',
    statusHistory: [
      { status: 'draft', timestamp: '2026-02-04T10:00:00Z', updatedBy: 'Michael Torres', notes: 'Insurance claim breakdown - adjuster scope attached' },
      { status: 'pending_approval', timestamp: '2026-02-04T15:00:00Z', updatedBy: 'Michael Torres', notes: 'Submitted' },
      { status: 'approved', timestamp: '2026-02-05T09:00:00Z', updatedBy: 'Sarah Mitchell', notes: 'Approved per adjuster scope' },
      { status: 'in_progress', timestamp: '2026-02-10T07:30:00Z', updatedBy: 'James Wilson', notes: 'Crew on site, tear-off started' },
    ],
    notes: 'Insurance claim - Allstate policy. Adjuster approved 6 sq section replacement plus 6 sheets decking. Take before/after photos.',
    createdAt: '2026-02-04T10:00:00Z',
    updatedAt: '2026-02-10T07:30:00Z',
    createdBy: 'Michael Torres',
    approvedBy: 'Sarah Mitchell',
  },
  {
    breakdownId: 'JB-2026-0003',
    jobId: 'JN-4540',
    jobName: 'Martinez Gutter Install',
    customerName: 'Roberto Martinez',
    address: { street: '2210 Bailey Cove Rd', city: 'Huntsville', state: 'AL', zip: '35802' },
    projectType: 'gutter_install',
    status: 'pending_approval',
    materials: [
      { category: 'Gutters', productName: '5" K-Style Aluminum Gutter (White)', quantity: 18, unit: 'sections (10ft)', unitCost: 8.50, totalCost: 153.00, supplier: 'Gutter Supply Co - Huntsville', leadTime: '2-3 days', inStock: true },
      { category: 'Downspouts', productName: '2x3" Aluminum Downspout (White)', quantity: 6, unit: 'sections (10ft)', unitCost: 7.00, totalCost: 42.00, supplier: 'Gutter Supply Co - Huntsville', leadTime: '2-3 days', inStock: true },
      { category: 'Elbows', productName: '2x3" Downspout Elbow (White)', quantity: 16, unit: 'pieces', unitCost: 3.50, totalCost: 56.00, supplier: 'Gutter Supply Co - Huntsville', leadTime: '2-3 days', inStock: true },
      { category: 'Hangers', productName: 'Hidden Hanger w/ Screw', quantity: 60, unit: 'pieces', unitCost: 1.25, totalCost: 75.00, supplier: 'Gutter Supply Co - Huntsville', leadTime: '2-3 days', inStock: true },
      { category: 'End Caps', productName: '5" K-Style End Cap (White)', quantity: 8, unit: 'pieces', unitCost: 2.00, totalCost: 16.00, supplier: 'Gutter Supply Co - Huntsville', leadTime: '2-3 days', inStock: true },
      { category: 'Sealant', productName: 'Gutter Sealant Caulk', quantity: 6, unit: 'tubes', unitCost: 5.50, totalCost: 33.00, supplier: 'Home Depot Pro - Madison', leadTime: '1 day', inStock: true },
      { category: 'Splash Blocks', productName: 'Splash Block (24")', quantity: 6, unit: 'pieces', unitCost: 8.00, totalCost: 48.00, supplier: 'Home Depot Pro - Madison', leadTime: '1 day', inStock: true },
    ],
    labor: [
      { role: 'Gutter Tech', hours: 12, rate: 40.00, totalCost: 480.00, assignedTo: 'Danny Reeves' },
      { role: 'Helper', hours: 12, rate: 22.00, totalCost: 264.00, assignedTo: 'Day Labor' },
    ],
    deliveries: [
      { deliveryId: 'DL-2026-0050', scheduledDate: '2026-02-18', materials: ['5" K-Style Aluminum Gutter (White)', '2x3" Aluminum Downspout (White)', '2x3" Downspout Elbow (White)', 'Hidden Hanger w/ Screw', '5" K-Style End Cap (White)', 'Gutter Sealant Caulk', 'Splash Block (24")'], status: 'scheduled', driver: 'Carlos Rivera' },
    ],
    materialTotal: 423.00,
    laborTotal: 744.00,
    deliveryFees: 85.00,
    overhead: 187.80,
    profit: 287.96,
    totalEstimate: 1727.76,
    estimatedStartDate: '2026-02-19',
    estimatedEndDate: '2026-02-19',
    statusHistory: [
      { status: 'draft', timestamp: '2026-02-08T11:00:00Z', updatedBy: 'Alex Chen', notes: 'Gutter install - full house' },
      { status: 'pending_approval', timestamp: '2026-02-09T09:00:00Z', updatedBy: 'Alex Chen', notes: 'Ready for review' },
    ],
    notes: '180 linear ft house. Remove old gutters and install new. Customer wants white to match fascia. Add leaf guards if customer approves add-on.',
    createdAt: '2026-02-08T11:00:00Z',
    updatedAt: '2026-02-09T09:00:00Z',
    createdBy: 'Alex Chen',
  },
  {
    breakdownId: 'JB-2026-0004',
    jobId: 'JN-4515',
    jobName: 'Thompson Commercial Flat Roof',
    customerName: 'Thompson Auto Group',
    address: { street: '4800 University Dr NW', city: 'Huntsville', state: 'AL', zip: '35816' },
    projectType: 'commercial',
    status: 'draft',
    materials: [
      { category: 'Membrane', productName: 'GAF EverGuard TPO 60mil (White)', quantity: 48, unit: 'rolls (10x100ft)', unitCost: 285.00, totalCost: 13680.00, supplier: 'ABC Supply - Huntsville', leadTime: '5-7 days', inStock: false },
      { category: 'Insulation', productName: 'Polyiso Insulation Board 2.5"', quantity: 120, unit: 'sheets (4x8)', unitCost: 38.00, totalCost: 4560.00, supplier: 'ABC Supply - Huntsville', leadTime: '5-7 days', inStock: false },
      { category: 'Adhesive', productName: 'GAF HydroStik Adhesive', quantity: 36, unit: 'pails (5gal)', unitCost: 52.00, totalCost: 1872.00, supplier: 'ABC Supply - Huntsville', leadTime: '3-5 days', inStock: true },
      { category: 'Fasteners', productName: 'OMG RhinoBond Plates', quantity: 8, unit: 'boxes (500ct)', unitCost: 145.00, totalCost: 1160.00, supplier: 'ABC Supply - Huntsville', leadTime: '3-5 days', inStock: true },
      { category: 'Edge Metal', productName: 'Commercial Edge Metal 24ga (10ft)', quantity: 40, unit: 'pieces', unitCost: 18.00, totalCost: 720.00, supplier: 'Beacon Roofing - Decatur', leadTime: '5-7 days', inStock: false },
      { category: 'Termination Bar', productName: 'Aluminum Termination Bar (10ft)', quantity: 30, unit: 'pieces', unitCost: 6.50, totalCost: 195.00, supplier: 'Beacon Roofing - Decatur', leadTime: '3-5 days', inStock: true },
      { category: 'Caulk', productName: 'GAF Commercial Sealant', quantity: 24, unit: 'tubes', unitCost: 8.00, totalCost: 192.00, supplier: 'ABC Supply - Huntsville', leadTime: '1-2 days', inStock: true },
    ],
    labor: [
      { role: 'Lead Installer', hours: 40, rate: 50.00, totalCost: 2000.00, assignedTo: 'James Wilson' },
      { role: 'Commercial Installer', hours: 120, rate: 40.00, totalCost: 4800.00, assignedTo: 'Team Alpha (3)' },
      { role: 'Helper', hours: 80, rate: 22.00, totalCost: 1760.00, assignedTo: 'Day Labor (2)' },
    ],
    deliveries: [],
    materialTotal: 22379.00,
    laborTotal: 8560.00,
    deliveryFees: 450.00,
    overhead: 4708.35,
    profit: 7219.47,
    totalEstimate: 43316.82,
    estimatedStartDate: '2026-03-03',
    estimatedEndDate: '2026-03-14',
    statusHistory: [
      { status: 'draft', timestamp: '2026-02-09T14:00:00Z', updatedBy: 'Michael Torres', notes: 'Large commercial job - needs detailed scope review' },
    ],
    notes: 'Commercial flat roof replacement. 4,800 sq ft TPO. Existing EPDM tear-off required. Work during business hours only (7AM-5PM). Must coordinate crane rental for insulation delivery.',
    createdAt: '2026-02-09T14:00:00Z',
    updatedAt: '2026-02-09T14:00:00Z',
    createdBy: 'Michael Torres',
  },
  {
    breakdownId: 'JB-2026-0005',
    jobId: 'JN-4528',
    jobName: 'Davis Siding Replacement',
    customerName: 'Patricia Davis',
    address: { street: '812 Mountainview Dr', city: 'Madison', state: 'AL', zip: '35758' },
    projectType: 'siding',
    status: 'completed',
    materials: [
      { category: 'Siding', productName: 'James Hardie HardiePlank Lap (Arctic White)', quantity: 120, unit: 'planks (12ft)', unitCost: 12.50, totalCost: 1500.00, supplier: 'Beacon Roofing - Decatur', leadTime: '7-10 days', inStock: true },
      { category: 'Trim', productName: 'James Hardie HardieTrim 4" (Arctic White)', quantity: 40, unit: 'pieces (12ft)', unitCost: 8.00, totalCost: 320.00, supplier: 'Beacon Roofing - Decatur', leadTime: '7-10 days', inStock: true },
      { category: 'House Wrap', productName: 'Tyvek HomeWrap', quantity: 4, unit: 'rolls (9x150ft)', unitCost: 165.00, totalCost: 660.00, supplier: 'Home Depot Pro - Madison', leadTime: '1-2 days', inStock: true },
      { category: 'Nails', productName: 'Stainless Steel Siding Nails', quantity: 6, unit: 'boxes (5lb)', unitCost: 18.00, totalCost: 108.00, supplier: 'Home Depot Pro - Madison', leadTime: '1 day', inStock: true },
      { category: 'Caulk', productName: 'OSI Quad Max Caulk (White)', quantity: 24, unit: 'tubes', unitCost: 7.50, totalCost: 180.00, supplier: 'Home Depot Pro - Madison', leadTime: '1 day', inStock: true },
      { category: 'Flashing', productName: 'Window/Door Flashing Tape', quantity: 4, unit: 'rolls', unitCost: 22.00, totalCost: 88.00, supplier: 'Beacon Roofing - Decatur', leadTime: '2-3 days', inStock: true },
    ],
    labor: [
      { role: 'Lead Installer', hours: 24, rate: 45.00, totalCost: 1080.00, assignedTo: 'Danny Reeves' },
      { role: 'Siding Installer', hours: 48, rate: 38.00, totalCost: 1824.00, assignedTo: 'Team Charlie (2)' },
      { role: 'Helper', hours: 24, rate: 22.00, totalCost: 528.00, assignedTo: 'Day Labor' },
    ],
    deliveries: [
      { deliveryId: 'DL-2026-0030', scheduledDate: '2026-01-27', materials: ['James Hardie HardiePlank Lap (Arctic White)', 'James Hardie HardieTrim 4" (Arctic White)', 'Tyvek HomeWrap'], status: 'delivered', driver: 'Marcus Johnson' },
      { deliveryId: 'DL-2026-0031', scheduledDate: '2026-01-29', materials: ['Stainless Steel Siding Nails', 'OSI Quad Max Caulk (White)', 'Window/Door Flashing Tape'], status: 'delivered', driver: 'Carlos Rivera' },
    ],
    materialTotal: 2856.00,
    laborTotal: 3432.00,
    deliveryFees: 200.00,
    overhead: 973.20,
    profit: 1492.24,
    totalEstimate: 8953.44,
    estimatedStartDate: '2026-01-28',
    estimatedEndDate: '2026-02-03',
    actualStartDate: '2026-01-28',
    actualEndDate: '2026-02-02',
    statusHistory: [
      { status: 'draft', timestamp: '2026-01-20T10:00:00Z', updatedBy: 'Alex Chen', notes: 'Siding replacement - full house' },
      { status: 'pending_approval', timestamp: '2026-01-20T16:00:00Z', updatedBy: 'Alex Chen', notes: 'Submitted' },
      { status: 'approved', timestamp: '2026-01-21T09:00:00Z', updatedBy: 'Sarah Mitchell', notes: 'Approved' },
      { status: 'in_progress', timestamp: '2026-01-28T07:00:00Z', updatedBy: 'Danny Reeves', notes: 'Started tear-off' },
      { status: 'completed', timestamp: '2026-02-02T16:00:00Z', updatedBy: 'Danny Reeves', notes: 'Job complete - final inspection passed' },
    ],
    notes: 'Full house re-side with James Hardie fiber cement. Customer chose Arctic White. Remove existing vinyl siding. Preserve landscape beds during tear-off.',
    createdAt: '2026-01-20T10:00:00Z',
    updatedAt: '2026-02-02T16:00:00Z',
    createdBy: 'Alex Chen',
    approvedBy: 'Sarah Mitchell',
  },
  {
    breakdownId: 'JB-2026-0006',
    jobId: 'JN-4545',
    jobName: 'Cooper Roof Repair',
    customerName: 'William Cooper',
    address: { street: '510 Williams Ave SE', city: 'Huntsville', state: 'AL', zip: '35801' },
    projectType: 'roof_repair',
    status: 'revised',
    materials: [
      { category: 'Shingles', productName: 'GAF Timberline HDZ (Weathered Wood)', quantity: 6, unit: 'bundles', unitCost: 38.50, totalCost: 231.00, supplier: 'ABC Supply - Huntsville', leadTime: '1-2 days', inStock: true },
      { category: 'Plywood', productName: '4x8 CDX Plywood 1/2"', quantity: 4, unit: 'sheets', unitCost: 32.00, totalCost: 128.00, supplier: 'Home Depot Pro - Madison', leadTime: '1 day', inStock: true },
      { category: 'Cement', productName: 'Roof Cement 10.3oz', quantity: 6, unit: 'tubes', unitCost: 6.00, totalCost: 36.00, supplier: 'Home Depot Pro - Madison', leadTime: '1 day', inStock: true },
      { category: 'Flashing', productName: 'Step Flashing 4x4x8"', quantity: 20, unit: 'pieces', unitCost: 1.80, totalCost: 36.00, supplier: 'Beacon Roofing - Decatur', leadTime: '2-3 days', inStock: true },
      { category: 'Underlayment', productName: 'GAF FeltBuster Synthetic', quantity: 1, unit: 'rolls', unitCost: 62.00, totalCost: 62.00, supplier: 'ABC Supply - Huntsville', leadTime: '1-2 days', inStock: true },
      { category: 'Nails', productName: '1.25" Galvanized Roofing Nails', quantity: 1, unit: 'boxes (5lb)', unitCost: 12.50, totalCost: 12.50, supplier: 'Home Depot Pro - Madison', leadTime: '1 day', inStock: true },
    ],
    labor: [
      { role: 'Lead Installer', hours: 6, rate: 45.00, totalCost: 270.00, assignedTo: 'James Wilson' },
      { role: 'Helper', hours: 6, rate: 22.00, totalCost: 132.00, assignedTo: 'Day Labor' },
    ],
    deliveries: [
      { deliveryId: 'DL-2026-0055', scheduledDate: '2026-02-12', materials: ['GAF Timberline HDZ (Weathered Wood)', '4x8 CDX Plywood 1/2"', 'Roof Cement 10.3oz', 'Step Flashing 4x4x8"', 'GAF FeltBuster Synthetic', '1.25" Galvanized Roofing Nails'], status: 'scheduled', driver: 'Marcus Johnson' },
    ],
    materialTotal: 505.50,
    laborTotal: 402.00,
    deliveryFees: 75.00,
    overhead: 147.38,
    profit: 225.98,
    totalEstimate: 1355.86,
    estimatedStartDate: '2026-02-13',
    estimatedEndDate: '2026-02-13',
    statusHistory: [
      { status: 'draft', timestamp: '2026-02-07T08:00:00Z', updatedBy: 'Alex Chen', notes: 'Leak repair - valley and 2 damaged sections' },
      { status: 'pending_approval', timestamp: '2026-02-07T11:00:00Z', updatedBy: 'Alex Chen', notes: 'Submitted' },
      { status: 'approved', timestamp: '2026-02-07T14:00:00Z', updatedBy: 'Sarah Mitchell', notes: 'Approved' },
      { status: 'revised', timestamp: '2026-02-09T10:00:00Z', updatedBy: 'Michael Torres', notes: 'Added 2 extra sheets plywood after further inspection found additional rot' },
    ],
    notes: 'Leak repair in valley area + 2 damaged sections from storm. Revised after on-site inspection found additional decking rot. Original was 2 sheets plywood, now 4.',
    createdAt: '2026-02-07T08:00:00Z',
    updatedAt: '2026-02-09T10:00:00Z',
    createdBy: 'Alex Chen',
    approvedBy: 'Sarah Mitchell',
  },
];

// ============================================
// SERVICE CLASS
// ============================================

class JobBreakdownService {
  private breakdowns: JobBreakdown[] = [...MOCK_BREAKDOWNS];
  private nextId = 7;

  // ── Create ──────────────────────────────────────────────────────────────

  createBreakdown(jobData: {
    jobId: string;
    jobName: string;
    customerName: string;
    address: Address;
    projectType: ProjectType;
    materials?: MaterialItem[];
    labor?: LaborItem[];
    notes?: string;
    estimatedStartDate?: string;
    estimatedEndDate?: string;
    createdBy: string;
  }): JobBreakdown {
    const now = new Date().toISOString();
    const breakdownId = `JB-2026-${String(this.nextId++).padStart(4, '0')}`;

    const breakdown: JobBreakdown = {
      breakdownId,
      jobId: jobData.jobId,
      jobName: jobData.jobName,
      customerName: jobData.customerName,
      address: jobData.address,
      projectType: jobData.projectType,
      status: 'draft',
      materials: jobData.materials || [],
      labor: jobData.labor || [],
      deliveries: [],
      materialTotal: 0,
      laborTotal: 0,
      deliveryFees: 0,
      overhead: 0,
      profit: 0,
      totalEstimate: 0,
      estimatedStartDate: jobData.estimatedStartDate || '',
      estimatedEndDate: jobData.estimatedEndDate || '',
      statusHistory: [
        { status: 'draft', timestamp: now, updatedBy: jobData.createdBy, notes: 'Breakdown created' },
      ],
      notes: jobData.notes || '',
      createdAt: now,
      updatedAt: now,
      createdBy: jobData.createdBy,
    };

    this.calculateCosts(breakdown);
    this.breakdowns.push(breakdown);
    return breakdown;
  }

  // ── Update ──────────────────────────────────────────────────────────────

  updateBreakdown(
    id: string,
    updates: Partial<Pick<JobBreakdown, 'materials' | 'labor' | 'notes' | 'estimatedStartDate' | 'estimatedEndDate' | 'deliveryFees'>>
  ): JobBreakdown | null {
    const breakdown = this.breakdowns.find(b => b.breakdownId === id);
    if (!breakdown) return null;

    if (updates.materials !== undefined) breakdown.materials = updates.materials;
    if (updates.labor !== undefined) breakdown.labor = updates.labor;
    if (updates.notes !== undefined) breakdown.notes = updates.notes;
    if (updates.estimatedStartDate !== undefined) breakdown.estimatedStartDate = updates.estimatedStartDate;
    if (updates.estimatedEndDate !== undefined) breakdown.estimatedEndDate = updates.estimatedEndDate;
    if (updates.deliveryFees !== undefined) breakdown.deliveryFees = updates.deliveryFees;

    this.calculateCosts(breakdown);
    breakdown.updatedAt = new Date().toISOString();

    return breakdown;
  }

  // ── Approve ─────────────────────────────────────────────────────────────

  approveBreakdown(id: string, approvedBy: string): JobBreakdown | null {
    const breakdown = this.breakdowns.find(b => b.breakdownId === id);
    if (!breakdown) return null;
    if (breakdown.status !== 'pending_approval') return null;

    breakdown.status = 'approved';
    breakdown.approvedBy = approvedBy;
    breakdown.updatedAt = new Date().toISOString();
    breakdown.statusHistory.push({
      status: 'approved',
      timestamp: new Date().toISOString(),
      updatedBy: approvedBy,
      notes: 'Breakdown approved',
    });

    return breakdown;
  }

  // ── Revise ──────────────────────────────────────────────────────────────

  reviseBreakdown(
    id: string,
    revisions: {
      materials?: MaterialItem[];
      labor?: LaborItem[];
      notes?: string;
      revisedBy: string;
      revisionNotes: string;
    }
  ): JobBreakdown | null {
    const breakdown = this.breakdowns.find(b => b.breakdownId === id);
    if (!breakdown) return null;

    if (revisions.materials) breakdown.materials = revisions.materials;
    if (revisions.labor) breakdown.labor = revisions.labor;
    if (revisions.notes) breakdown.notes = revisions.notes;

    breakdown.status = 'revised';
    breakdown.updatedAt = new Date().toISOString();
    breakdown.statusHistory.push({
      status: 'revised',
      timestamp: new Date().toISOString(),
      updatedBy: revisions.revisedBy,
      notes: revisions.revisionNotes,
    });

    this.calculateCosts(breakdown);
    return breakdown;
  }

  // ── Calculate Costs ─────────────────────────────────────────────────────

  calculateCosts(breakdown: JobBreakdown): JobBreakdown {
    breakdown.materialTotal = breakdown.materials.reduce((sum, m) => {
      m.totalCost = Math.round(m.quantity * m.unitCost * 100) / 100;
      return sum + m.totalCost;
    }, 0);
    breakdown.materialTotal = Math.round(breakdown.materialTotal * 100) / 100;

    breakdown.laborTotal = breakdown.labor.reduce((sum, l) => {
      l.totalCost = Math.round(l.hours * l.rate * 100) / 100;
      return sum + l.totalCost;
    }, 0);
    breakdown.laborTotal = Math.round(breakdown.laborTotal * 100) / 100;

    const subtotal = breakdown.materialTotal + breakdown.laborTotal + breakdown.deliveryFees;
    breakdown.overhead = Math.round(subtotal * 0.15 * 100) / 100;
    breakdown.profit = Math.round((subtotal + breakdown.overhead) * 0.20 * 100) / 100;
    breakdown.totalEstimate = Math.round((subtotal + breakdown.overhead + breakdown.profit) * 100) / 100;

    return breakdown;
  }

  // ── Generate Material List ──────────────────────────────────────────────

  generateMaterialList(projectType: ProjectType, measurements: RoofMeasurements): MaterialItem[] {
    const materials: MaterialItem[] = [];

    switch (projectType) {
      case 'roof_replacement':
      case 'insurance_claim': {
        const shingleBundles = Math.ceil(measurements.sqFt / 33.3);
        materials.push({
          category: 'Shingles', productName: 'GAF Timberline HDZ (Charcoal)',
          quantity: shingleBundles, unit: 'bundles', unitCost: 38.50,
          totalCost: Math.round(shingleBundles * 38.50 * 100) / 100,
          supplier: SUPPLIERS.shingles, leadTime: '1-2 days', inStock: true,
        });

        const underlaymentRolls = Math.ceil(measurements.sqFt / 400);
        materials.push({
          category: 'Underlayment', productName: 'GAF FeltBuster Synthetic',
          quantity: underlaymentRolls, unit: 'rolls', unitCost: 62.00,
          totalCost: Math.round(underlaymentRolls * 62.00 * 100) / 100,
          supplier: SUPPLIERS.underlayment, leadTime: '1-2 days', inStock: true,
        });

        const starterBundles = Math.ceil(measurements.perimeterFt / 100);
        materials.push({
          category: 'Starter Strip', productName: 'GAF Pro-Start Starter Strip',
          quantity: starterBundles, unit: 'bundles', unitCost: 24.00,
          totalCost: Math.round(starterBundles * 24.00 * 100) / 100,
          supplier: SUPPLIERS.shingles, leadTime: '1-2 days', inStock: true,
        });

        const ridgeLen = measurements.ridgeFt || Math.ceil(Math.sqrt(measurements.sqFt));
        const ridgeBundles = Math.ceil(ridgeLen / 25);
        materials.push({
          category: 'Ridge Cap', productName: 'GAF Seal-A-Ridge (Charcoal)',
          quantity: ridgeBundles, unit: 'bundles', unitCost: 56.00,
          totalCost: Math.round(ridgeBundles * 56.00 * 100) / 100,
          supplier: SUPPLIERS.shingles, leadTime: '1-2 days', inStock: true,
        });

        const dripEdgePieces = Math.ceil(measurements.perimeterFt / 10);
        materials.push({
          category: 'Drip Edge', productName: 'Drip Edge Flashing 10ft (White)',
          quantity: dripEdgePieces, unit: 'pieces', unitCost: 5.50,
          totalCost: Math.round(dripEdgePieces * 5.50 * 100) / 100,
          supplier: SUPPLIERS.flashing, leadTime: '2-3 days', inStock: true,
        });

        const iceShieldRolls = Math.max(2, Math.ceil(measurements.perimeterFt / 75));
        materials.push({
          category: 'Ice & Water Shield', productName: 'GAF StormGuard Double Layer',
          quantity: iceShieldRolls, unit: 'rolls', unitCost: 78.00,
          totalCost: Math.round(iceShieldRolls * 78.00 * 100) / 100,
          supplier: SUPPLIERS.shingles, leadTime: '1-2 days', inStock: true,
        });

        const nailBoxes = Math.max(2, Math.ceil(shingleBundles / 10));
        materials.push({
          category: 'Nails', productName: '1.25" Galvanized Roofing Nails',
          quantity: nailBoxes, unit: 'boxes (5lb)', unitCost: 12.50,
          totalCost: Math.round(nailBoxes * 12.50 * 100) / 100,
          supplier: SUPPLIERS.nails, leadTime: '1 day', inStock: true,
        });

        const flashingPieces = Math.ceil(measurements.perimeterFt * 0.15) + (measurements.stories > 1 ? 20 : 0);
        materials.push({
          category: 'Flashing', productName: 'Step Flashing 4x4x8"',
          quantity: flashingPieces, unit: 'pieces', unitCost: 1.80,
          totalCost: Math.round(flashingPieces * 1.80 * 100) / 100,
          supplier: SUPPLIERS.flashing, leadTime: '2-3 days', inStock: true,
        });

        const pipeBoots = measurements.pipeBoots || 3;
        materials.push({
          category: 'Pipe Boots', productName: 'Master Flash 2" Pipe Boot',
          quantity: pipeBoots, unit: 'pieces', unitCost: 14.00,
          totalCost: Math.round(pipeBoots * 14.00 * 100) / 100,
          supplier: SUPPLIERS.shingles, leadTime: '1-2 days', inStock: true,
        });
        break;
      }

      case 'gutter_install': {
        const gutterSections = Math.ceil(measurements.perimeterFt / 10);
        materials.push({
          category: 'Gutters', productName: '5" K-Style Aluminum Gutter (White)',
          quantity: gutterSections, unit: 'sections (10ft)', unitCost: 8.50,
          totalCost: Math.round(gutterSections * 8.50 * 100) / 100,
          supplier: SUPPLIERS.gutters, leadTime: '2-3 days', inStock: true,
        });

        const downspoutCount = Math.max(4, Math.ceil(measurements.perimeterFt / 40));
        materials.push({
          category: 'Downspouts', productName: '2x3" Aluminum Downspout (White)',
          quantity: downspoutCount, unit: 'sections (10ft)', unitCost: 7.00,
          totalCost: Math.round(downspoutCount * 7.00 * 100) / 100,
          supplier: SUPPLIERS.gutters, leadTime: '2-3 days', inStock: true,
        });

        const elbowCount = downspoutCount * 3;
        materials.push({
          category: 'Elbows', productName: '2x3" Downspout Elbow (White)',
          quantity: elbowCount, unit: 'pieces', unitCost: 3.50,
          totalCost: Math.round(elbowCount * 3.50 * 100) / 100,
          supplier: SUPPLIERS.gutters, leadTime: '2-3 days', inStock: true,
        });

        const hangerCount = Math.ceil(measurements.perimeterFt / 3);
        materials.push({
          category: 'Hangers', productName: 'Hidden Hanger w/ Screw',
          quantity: hangerCount, unit: 'pieces', unitCost: 1.25,
          totalCost: Math.round(hangerCount * 1.25 * 100) / 100,
          supplier: SUPPLIERS.gutters, leadTime: '2-3 days', inStock: true,
        });

        const endCapCount = Math.max(4, Math.ceil(gutterSections * 0.4));
        materials.push({
          category: 'End Caps', productName: '5" K-Style End Cap (White)',
          quantity: endCapCount, unit: 'pieces', unitCost: 2.00,
          totalCost: Math.round(endCapCount * 2.00 * 100) / 100,
          supplier: SUPPLIERS.gutters, leadTime: '2-3 days', inStock: true,
        });

        const sealantTubes = Math.max(4, Math.ceil(gutterSections / 3));
        materials.push({
          category: 'Sealant', productName: 'Gutter Sealant Caulk',
          quantity: sealantTubes, unit: 'tubes', unitCost: 5.50,
          totalCost: Math.round(sealantTubes * 5.50 * 100) / 100,
          supplier: SUPPLIERS.general, leadTime: '1 day', inStock: true,
        });
        break;
      }

      case 'roof_repair': {
        const patchBundles = Math.max(3, Math.ceil(measurements.sqFt / 33.3));
        materials.push({
          category: 'Shingles', productName: 'GAF Timberline HDZ (Weathered Wood)',
          quantity: patchBundles, unit: 'bundles', unitCost: 38.50,
          totalCost: Math.round(patchBundles * 38.50 * 100) / 100,
          supplier: SUPPLIERS.shingles, leadTime: '1-2 days', inStock: true,
        });

        const plywoodSheets = Math.max(2, Math.ceil(measurements.sqFt / 32));
        materials.push({
          category: 'Plywood', productName: '4x8 CDX Plywood 1/2"',
          quantity: plywoodSheets, unit: 'sheets', unitCost: 32.00,
          totalCost: Math.round(plywoodSheets * 32.00 * 100) / 100,
          supplier: SUPPLIERS.plywood, leadTime: '1 day', inStock: true,
        });

        materials.push({
          category: 'Cement', productName: 'Roof Cement 10.3oz',
          quantity: 6, unit: 'tubes', unitCost: 6.00, totalCost: 36.00,
          supplier: SUPPLIERS.nails, leadTime: '1 day', inStock: true,
        });

        const repairFlashing = Math.max(10, Math.ceil(measurements.perimeterFt * 0.2));
        materials.push({
          category: 'Flashing', productName: 'Step Flashing 4x4x8"',
          quantity: repairFlashing, unit: 'pieces', unitCost: 1.80,
          totalCost: Math.round(repairFlashing * 1.80 * 100) / 100,
          supplier: SUPPLIERS.flashing, leadTime: '2-3 days', inStock: true,
        });

        materials.push({
          category: 'Underlayment', productName: 'GAF FeltBuster Synthetic',
          quantity: 1, unit: 'rolls', unitCost: 62.00, totalCost: 62.00,
          supplier: SUPPLIERS.underlayment, leadTime: '1-2 days', inStock: true,
        });

        materials.push({
          category: 'Nails', productName: '1.25" Galvanized Roofing Nails',
          quantity: 1, unit: 'boxes (5lb)', unitCost: 12.50, totalCost: 12.50,
          supplier: SUPPLIERS.nails, leadTime: '1 day', inStock: true,
        });
        break;
      }

      case 'siding': {
        const sidingPlanks = Math.ceil(measurements.sqFt / 8);
        materials.push({
          category: 'Siding', productName: 'James Hardie HardiePlank Lap (Arctic White)',
          quantity: sidingPlanks, unit: 'planks (12ft)', unitCost: 12.50,
          totalCost: Math.round(sidingPlanks * 12.50 * 100) / 100,
          supplier: SUPPLIERS.siding, leadTime: '7-10 days', inStock: true,
        });

        const trimPieces = Math.ceil(sidingPlanks / 3);
        materials.push({
          category: 'Trim', productName: 'James Hardie HardieTrim 4" (Arctic White)',
          quantity: trimPieces, unit: 'pieces (12ft)', unitCost: 8.00,
          totalCost: Math.round(trimPieces * 8.00 * 100) / 100,
          supplier: SUPPLIERS.siding, leadTime: '7-10 days', inStock: true,
        });

        const wrapRolls = Math.max(2, Math.ceil(measurements.sqFt / 1350));
        materials.push({
          category: 'House Wrap', productName: 'Tyvek HomeWrap',
          quantity: wrapRolls, unit: 'rolls (9x150ft)', unitCost: 165.00,
          totalCost: Math.round(wrapRolls * 165.00 * 100) / 100,
          supplier: SUPPLIERS.plywood, leadTime: '1-2 days', inStock: true,
        });

        const sidingNails = Math.max(4, Math.ceil(sidingPlanks / 20));
        materials.push({
          category: 'Nails', productName: 'Stainless Steel Siding Nails',
          quantity: sidingNails, unit: 'boxes (5lb)', unitCost: 18.00,
          totalCost: Math.round(sidingNails * 18.00 * 100) / 100,
          supplier: SUPPLIERS.nails, leadTime: '1 day', inStock: true,
        });

        const caulkTubes = Math.max(12, Math.ceil(sidingPlanks / 5));
        materials.push({
          category: 'Caulk', productName: 'OSI Quad Max Caulk (White)',
          quantity: caulkTubes, unit: 'tubes', unitCost: 7.50,
          totalCost: Math.round(caulkTubes * 7.50 * 100) / 100,
          supplier: SUPPLIERS.nails, leadTime: '1 day', inStock: true,
        });
        break;
      }

      case 'commercial': {
        const membraneRolls = Math.ceil(measurements.sqFt / 1000);
        materials.push({
          category: 'Membrane', productName: 'GAF EverGuard TPO 60mil (White)',
          quantity: membraneRolls, unit: 'rolls (10x100ft)', unitCost: 285.00,
          totalCost: Math.round(membraneRolls * 285.00 * 100) / 100,
          supplier: SUPPLIERS.shingles, leadTime: '5-7 days', inStock: false,
        });

        const insulationSheets = Math.ceil(measurements.sqFt / 32);
        materials.push({
          category: 'Insulation', productName: 'Polyiso Insulation Board 2.5"',
          quantity: insulationSheets, unit: 'sheets (4x8)', unitCost: 38.00,
          totalCost: Math.round(insulationSheets * 38.00 * 100) / 100,
          supplier: SUPPLIERS.shingles, leadTime: '5-7 days', inStock: false,
        });

        const adhesivePails = Math.max(12, Math.ceil(measurements.sqFt / 150));
        materials.push({
          category: 'Adhesive', productName: 'GAF HydroStik Adhesive',
          quantity: adhesivePails, unit: 'pails (5gal)', unitCost: 52.00,
          totalCost: Math.round(adhesivePails * 52.00 * 100) / 100,
          supplier: SUPPLIERS.shingles, leadTime: '3-5 days', inStock: true,
        });

        const edgeMetalPieces = Math.ceil(measurements.perimeterFt / 10);
        materials.push({
          category: 'Edge Metal', productName: 'Commercial Edge Metal 24ga (10ft)',
          quantity: edgeMetalPieces, unit: 'pieces', unitCost: 18.00,
          totalCost: Math.round(edgeMetalPieces * 18.00 * 100) / 100,
          supplier: SUPPLIERS.flashing, leadTime: '5-7 days', inStock: false,
        });
        break;
      }

      default:
        break;
    }

    return materials;
  }

  // ── Generate Delivery Schedule ──────────────────────────────────────────

  generateDeliverySchedule(breakdown: JobBreakdown): DeliveryItem[] {
    if (breakdown.materials.length === 0) return [];

    const deliveries: DeliveryItem[] = [];
    const startDate = breakdown.estimatedStartDate || new Date().toISOString().slice(0, 10);

    // Heavy items: shingles, membrane, insulation, plywood, siding
    const heavyMaterials = breakdown.materials.filter(m =>
      ['Shingles', 'Membrane', 'Insulation', 'Plywood', 'Siding'].includes(m.category)
    );
    // Medium items: underlayment, ice shield, ridge cap, gutters, wrap, adhesive
    const mediumMaterials = breakdown.materials.filter(m =>
      ['Underlayment', 'Ice & Water Shield', 'Ridge Cap', 'House Wrap', 'Gutters', 'Downspouts', 'Adhesive'].includes(m.category)
    );
    // Light items: everything else
    const lightMaterials = breakdown.materials.filter(m =>
      !heavyMaterials.includes(m) && !mediumMaterials.includes(m)
    );

    // Delivery 1: Heavy + Medium (day before start)
    const dayBefore = new Date(startDate);
    dayBefore.setDate(dayBefore.getDate() - 1);
    const deliveryDate1 = dayBefore.toISOString().slice(0, 10);

    if (heavyMaterials.length > 0 || mediumMaterials.length > 0) {
      deliveries.push({
        deliveryId: `DL-2026-${String(Math.floor(Math.random() * 9000) + 1000).padStart(4, '0')}`,
        scheduledDate: deliveryDate1,
        materials: [...heavyMaterials, ...mediumMaterials].map(m => m.productName),
        status: 'scheduled',
        driver: 'Carlos Rivera',
      });
    }

    // Delivery 2: Light / accessories (morning of start)
    if (lightMaterials.length > 0) {
      deliveries.push({
        deliveryId: `DL-2026-${String(Math.floor(Math.random() * 9000) + 1000).padStart(4, '0')}`,
        scheduledDate: startDate,
        materials: lightMaterials.map(m => m.productName),
        status: 'scheduled',
        driver: 'Marcus Johnson',
      });
    }

    return deliveries;
  }

  // ── Status Management ──────────────────────────────────────────────────

  getBreakdownStatus(id: string): { status: BreakdownStatus; history: StatusHistoryEntry[] } | null {
    const breakdown = this.breakdowns.find(b => b.breakdownId === id);
    if (!breakdown) return null;
    return { status: breakdown.status, history: breakdown.statusHistory };
  }

  updateStatus(id: string, status: BreakdownStatus, updatedBy: string, notes: string): JobBreakdown | null {
    const breakdown = this.breakdowns.find(b => b.breakdownId === id);
    if (!breakdown) return null;

    breakdown.status = status;
    breakdown.updatedAt = new Date().toISOString();
    breakdown.statusHistory.push({
      status,
      timestamp: new Date().toISOString(),
      updatedBy,
      notes,
    });

    if (status === 'in_progress' && !breakdown.actualStartDate) {
      breakdown.actualStartDate = new Date().toISOString().slice(0, 10);
    }
    if (status === 'completed' && !breakdown.actualEndDate) {
      breakdown.actualEndDate = new Date().toISOString().slice(0, 10);
    }

    return breakdown;
  }

  // ── Compare Breakdowns ─────────────────────────────────────────────────

  compareBreakdowns(id1: string, id2: string): BreakdownComparison[] | null {
    const b1 = this.breakdowns.find(b => b.breakdownId === id1);
    const b2 = this.breakdowns.find(b => b.breakdownId === id2);
    if (!b1 || !b2) return null;

    const comparisons: BreakdownComparison[] = [];

    comparisons.push({
      field: 'Material Total', category: 'cost',
      original: `$${b1.materialTotal.toFixed(2)}`,
      revised: `$${b2.materialTotal.toFixed(2)}`,
      difference: `${b2.materialTotal - b1.materialTotal >= 0 ? '+' : ''}$${(b2.materialTotal - b1.materialTotal).toFixed(2)}`,
    });
    comparisons.push({
      field: 'Labor Total', category: 'cost',
      original: `$${b1.laborTotal.toFixed(2)}`,
      revised: `$${b2.laborTotal.toFixed(2)}`,
      difference: `${b2.laborTotal - b1.laborTotal >= 0 ? '+' : ''}$${(b2.laborTotal - b1.laborTotal).toFixed(2)}`,
    });
    comparisons.push({
      field: 'Total Estimate', category: 'cost',
      original: `$${b1.totalEstimate.toFixed(2)}`,
      revised: `$${b2.totalEstimate.toFixed(2)}`,
      difference: `${b2.totalEstimate - b1.totalEstimate >= 0 ? '+' : ''}$${(b2.totalEstimate - b1.totalEstimate).toFixed(2)}`,
    });
    comparisons.push({
      field: 'Material Line Items', category: 'material',
      original: `${b1.materials.length} items`, revised: `${b2.materials.length} items`,
      difference: `${b2.materials.length - b1.materials.length >= 0 ? '+' : ''}${b2.materials.length - b1.materials.length}`,
    });

    const b1Hours = b1.labor.reduce((s, l) => s + l.hours, 0);
    const b2Hours = b2.labor.reduce((s, l) => s + l.hours, 0);
    comparisons.push({
      field: 'Total Labor Hours', category: 'labor',
      original: `${b1Hours} hrs`, revised: `${b2Hours} hrs`,
      difference: `${b2Hours - b1Hours >= 0 ? '+' : ''}${b2Hours - b1Hours} hrs`,
    });
    comparisons.push({
      field: 'Deliveries', category: 'delivery',
      original: `${b1.deliveries.length}`, revised: `${b2.deliveries.length}`,
      difference: `${b2.deliveries.length - b1.deliveries.length >= 0 ? '+' : ''}${b2.deliveries.length - b1.deliveries.length}`,
    });
    comparisons.push({
      field: 'Start Date', category: 'timeline',
      original: b1.estimatedStartDate || 'TBD', revised: b2.estimatedStartDate || 'TBD',
      difference: b1.estimatedStartDate !== b2.estimatedStartDate ? 'Changed' : 'Same',
    });
    comparisons.push({
      field: 'End Date', category: 'timeline',
      original: b1.estimatedEndDate || 'TBD', revised: b2.estimatedEndDate || 'TBD',
      difference: b1.estimatedEndDate !== b2.estimatedEndDate ? 'Changed' : 'Same',
    });

    // Compare individual materials
    const allMaterialNames = new Set([
      ...b1.materials.map(m => m.productName),
      ...b2.materials.map(m => m.productName),
    ]);
    for (const name of allMaterialNames) {
      const m1 = b1.materials.find(m => m.productName === name);
      const m2 = b2.materials.find(m => m.productName === name);
      if (m1 && m2 && (m1.quantity !== m2.quantity || m1.unitCost !== m2.unitCost)) {
        comparisons.push({
          field: name, category: 'material',
          original: `${m1.quantity} ${m1.unit} @ $${m1.unitCost}`,
          revised: `${m2.quantity} ${m2.unit} @ $${m2.unitCost}`,
          difference: `Qty: ${m2.quantity - m1.quantity >= 0 ? '+' : ''}${m2.quantity - m1.quantity}`,
        });
      } else if (m1 && !m2) {
        comparisons.push({ field: name, category: 'material', original: `${m1.quantity} ${m1.unit}`, revised: 'Removed', difference: 'Removed' });
      } else if (!m1 && m2) {
        comparisons.push({ field: name, category: 'material', original: 'N/A', revised: `${m2.quantity} ${m2.unit}`, difference: 'Added' });
      }
    }

    return comparisons;
  }

  // ── Export ──────────────────────────────────────────────────────────────

  exportBreakdown(id: string): BreakdownExport | null {
    const b = this.breakdowns.find(bd => bd.breakdownId === id);
    if (!b) return null;

    return {
      breakdownId: b.breakdownId,
      jobName: b.jobName,
      customerName: b.customerName,
      address: `${b.address.street}, ${b.address.city}, ${b.address.state} ${b.address.zip}`,
      projectType: b.projectType.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
      status: b.status.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
      materials: b.materials.map(m => ({
        item: `${m.productName} (${m.category})`,
        qty: `${m.quantity} ${m.unit}`,
        cost: `$${m.totalCost.toFixed(2)}`,
      })),
      labor: b.labor.map(l => ({
        role: `${l.role} - ${l.assignedTo}`,
        hours: `${l.hours} hrs @ $${l.rate}/hr`,
        cost: `$${l.totalCost.toFixed(2)}`,
      })),
      materialTotal: `$${b.materialTotal.toFixed(2)}`,
      laborTotal: `$${b.laborTotal.toFixed(2)}`,
      deliveryFees: `$${b.deliveryFees.toFixed(2)}`,
      overhead: `$${b.overhead.toFixed(2)}`,
      profit: `$${b.profit.toFixed(2)}`,
      totalEstimate: `$${b.totalEstimate.toFixed(2)}`,
      estimatedStart: b.estimatedStartDate,
      estimatedEnd: b.estimatedEndDate,
      notes: b.notes,
    };
  }

  // ── Query Methods ──────────────────────────────────────────────────────

  getBreakdown(id: string): JobBreakdown | null {
    return this.breakdowns.find(b => b.breakdownId === id) || null;
  }

  getBreakdownsByJob(jobId: string): JobBreakdown[] {
    return this.breakdowns.filter(b => b.jobId === jobId);
  }

  getAllBreakdowns(filters?: {
    status?: BreakdownStatus;
    projectType?: ProjectType;
    dateFrom?: string;
    dateTo?: string;
    search?: string;
  }): JobBreakdown[] {
    let results = [...this.breakdowns];
    if (filters?.status) results = results.filter(b => b.status === filters.status);
    if (filters?.projectType) results = results.filter(b => b.projectType === filters.projectType);
    if (filters?.dateFrom) results = results.filter(b => b.createdAt >= filters.dateFrom!);
    if (filters?.dateTo) results = results.filter(b => b.createdAt <= filters.dateTo!);
    if (filters?.search) {
      const q = filters.search.toLowerCase();
      results = results.filter(b =>
        b.jobName.toLowerCase().includes(q) ||
        b.customerName.toLowerCase().includes(q) ||
        b.breakdownId.toLowerCase().includes(q) ||
        b.address.street.toLowerCase().includes(q)
      );
    }
    return results.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  }

  // ── Statistics ─────────────────────────────────────────────────────────

  getStatistics(): {
    total: number;
    pendingApproval: number;
    activeJobs: number;
    totalValue: number;
    byStatus: Record<BreakdownStatus, number>;
    byType: Record<string, number>;
    monthlyValues: { month: string; value: number }[];
  } {
    const all = this.breakdowns;
    const byStatus: Record<BreakdownStatus, number> = {
      draft: 0, pending_approval: 0, approved: 0, in_progress: 0, completed: 0, revised: 0,
    };
    all.forEach(b => { byStatus[b.status]++; });

    const byType: Record<string, number> = {};
    all.forEach(b => {
      const label = b.projectType.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
      byType[label] = (byType[label] || 0) + 1;
    });

    const monthlyValues = [
      { month: 'Sep 2025', value: 28500 },
      { month: 'Oct 2025', value: 34200 },
      { month: 'Nov 2025', value: 22100 },
      { month: 'Dec 2025', value: 18900 },
      { month: 'Jan 2026', value: 41500 },
      { month: 'Feb 2026', value: Math.round(all.reduce((s, b) => s + b.totalEstimate, 0)) },
    ];

    return {
      total: all.length,
      pendingApproval: byStatus.pending_approval,
      activeJobs: byStatus.in_progress + byStatus.approved,
      totalValue: Math.round(all.reduce((s, b) => s + b.totalEstimate, 0) * 100) / 100,
      byStatus,
      byType,
      monthlyValues,
    };
  }

  // ── JobNimbus READ-ONLY Integration ────────────────────────────────────

  /**
   * Fetch jobs from JobNimbus that can have breakdowns created.
   * READ-ONLY - does not write to JN.
   */
  async fetchJNJobsForBreakdown(filters?: { status?: string; limit?: number }): Promise<JNJobSummary[]> {
    if (!isJobNimbusConfigured()) {
      return [];
    }

    try {
      const limit = filters?.limit || 50;
      const result = await jobNimbusService.getJobs({ limit });
      const jobs = result.results || [];

      // For each job, try to get estimate totals (batch fetch)
      const summaries: JNJobSummary[] = [];

      for (const job of jobs) {
        // If a status filter is provided, skip non-matching jobs
        if (filters?.status && job.status && job.status.toLowerCase() !== filters.status.toLowerCase()) {
          continue;
        }

        let estimateTotal = 0;
        // Try to get estimates for this job's contact
        if (job.primary?.jnid) {
          try {
            const estimates = await jobNimbusService.getEstimatesForContact(job.primary.jnid);
            estimateTotal = estimates.reduce((sum: number, est: JobNimbusEstimate) => sum + (est.total || est.amount || 0), 0);
          } catch {
            // Estimates not available, that's fine
          }
        }

        const customerName = job.name || 'Unknown';
        const addressParts = [job.address_line1, job.city, job.state_text, job.zip].filter(Boolean);

        summaries.push({
          jnid: job.jnid,
          jobNumber: job.number || '',
          jobName: job.name || job.description || `Job ${job.number || job.jnid}`,
          customerName,
          address: addressParts.join(', ') || 'No address',
          status: job.status || 'unknown',
          salesRep: job.sales_rep_name || '',
          estimateTotal,
          createdAt: job.created_at ? new Date(job.created_at * 1000).toISOString() : '',
        });
      }

      return summaries;
    } catch (error) {
      console.error('Failed to fetch JN jobs for breakdown:', error);
      return [];
    }
  }

  /**
   * Fetch full JN job detail to pre-populate a breakdown.
   * READ-ONLY - does not write to JN.
   */
  async fetchJNJobForBreakdown(jobJnid: string): Promise<JNBreakdownSource> {
    const job = await jobNimbusService.getJob(jobJnid);

    let contact: JobNimbusContact | null = null;
    let estimates: JobNimbusEstimate[] = [];

    // Fetch contact and estimates in parallel
    const contactJnid = job.primary?.jnid;
    if (contactJnid) {
      const [contactResult, estimatesResult] = await Promise.allSettled([
        jobNimbusService.getContact(contactJnid),
        jobNimbusService.getEstimatesForContact(contactJnid),
      ]);

      if (contactResult.status === 'fulfilled') {
        contact = contactResult.value;
      }
      if (estimatesResult.status === 'fulfilled') {
        estimates = estimatesResult.value || [];
      }
    }

    const totalEstimateValue = estimates.reduce((sum, est) => sum + (est.total || est.amount || 0), 0);

    return { job, contact, estimates, totalEstimateValue };
  }

  /**
   * Create a breakdown pre-populated from JN job data.
   * Does NOT write back to JN - purely local.
   */
  createBreakdownFromJNJob(jnData: JNBreakdownSource): JobBreakdown {
    const { job, contact, estimates, totalEstimateValue } = jnData;

    // Determine customer name
    const customerName = contact
      ? (contact.display_name || `${contact.first_name || ''} ${contact.last_name || ''}`.trim() || 'Customer')
      : (job.name || 'Unknown Customer');

    // Build address from job or contact
    const address: Address = {
      street: job.address_line1 || contact?.address_line1 || '',
      city: job.city || contact?.city || '',
      state: job.state_text || contact?.state_text || 'AL',
      zip: job.zip || contact?.zip || '',
    };

    // Try to determine project type from job name/description
    const searchText = `${job.name || ''} ${job.description || ''}`.toLowerCase();
    let projectType: ProjectType = 'roof_replacement'; // default

    if (searchText.includes('repair') || searchText.includes('leak') || searchText.includes('patch')) {
      projectType = 'roof_repair';
    } else if (searchText.includes('gutter')) {
      projectType = 'gutter_install';
    } else if (searchText.includes('siding') || searchText.includes('hardie')) {
      projectType = 'siding';
    } else if (searchText.includes('commercial') || searchText.includes('flat roof') || searchText.includes('tpo')) {
      projectType = 'commercial';
    } else if (searchText.includes('insurance') || searchText.includes('claim') || searchText.includes('adjuster')) {
      projectType = 'insurance_claim';
    } else if (searchText.includes('replacement') || searchText.includes('reroof') || searchText.includes('new roof')) {
      projectType = 'roof_replacement';
    }

    // Build job name
    const jobName = job.name || job.description || `Job ${job.number || job.jnid}`;

    // Build notes with estimate reference
    const notesParts: string[] = [];
    if (job.description) notesParts.push(`JN Description: ${job.description}`);
    if (totalEstimateValue > 0) {
      notesParts.push(`JN Estimate Total: $${totalEstimateValue.toFixed(2)}`);
    }
    if (estimates.length > 0) {
      notesParts.push(`JN Estimates: ${estimates.length} found`);
      estimates.forEach((est, i) => {
        const estDesc = est.description ? ` - ${est.description}` : '';
        notesParts.push(`  #${est.number || (i + 1)}: $${(est.total || est.amount || 0).toFixed(2)}${estDesc}`);
      });
    }

    const breakdown = this.createBreakdown({
      jobId: job.jnid,
      jobName,
      customerName,
      address,
      projectType,
      notes: notesParts.join('\n'),
      createdBy: 'System (JN Import)',
    });

    return breakdown;
  }

  // ── Backward Compatibility (for /api/breakdown/search) ─────────────────

  async searchBreakdowns(query: string): Promise<JobBreakdown[]> {
    return this.getAllBreakdowns({ search: query });
  }

  async getBreakdownsByRep(salesRep: string): Promise<JobBreakdown[]> {
    return this.breakdowns.filter(b =>
      b.createdBy.toLowerCase().includes(salesRep.toLowerCase())
    );
  }
}

// ============================================
// SINGLETON EXPORT
// ============================================

export const jobBreakdownService = new JobBreakdownService();
