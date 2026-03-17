/**
 * Work Order Management Service
 *
 * Manages work orders and delivery ticket creation for RCRS.
 * Supports standard, rush, return, and supplement work orders.
 * Includes job-to-ticket conversion, bulk creation, and upload parsing.
 * Supports READ-ONLY integration with JobNimbus for importing jobs.
 */

import { jobNimbusService, isJobNimbusConfigured } from '@/lib/jobnimbus-service';
import type { JobNimbusJob, JobNimbusContact, JobNimbusEstimate } from '@/lib/jobnimbus-service';

// ============================================
// TYPES
// ============================================

export type WorkOrderType = 'delivery' | 'pickup' | 'return' | 'supplement';
export type WorkOrderPriority = 'low' | 'normal' | 'rush' | 'urgent';
export type WorkOrderStatus =
  | 'draft'
  | 'submitted'
  | 'approved'
  | 'scheduled'
  | 'in_progress'
  | 'completed'
  | 'cancelled';

export interface WorkOrderAddress {
  street: string;
  city: string;
  state: string;
  zip: string;
}

export interface WorkOrderMaterial {
  id: string;
  productName: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  weight: number; // lbs
}

export interface WorkOrderStatusChange {
  from: WorkOrderStatus;
  to: WorkOrderStatus;
  changedAt: string;
  changedBy: string;
  notes?: string;
}

export interface WorkOrder {
  workOrderId: string;
  jobId: string;
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  address: WorkOrderAddress;
  type: WorkOrderType;
  priority: WorkOrderPriority;
  materials: WorkOrderMaterial[];
  scheduledDate: string;
  scheduledTime: string;
  notes: string;
  specialInstructions: string;
  assignedDriver: string;
  vehicleType: string;
  status: WorkOrderStatus;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  estimatedCost: number;
  actualCost: number | null;
  photos: string[];
  documents: string[];
  statusHistory: WorkOrderStatusChange[];
}

export interface JobData {
  jobId: string;
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  address: WorkOrderAddress;
  materials: WorkOrderMaterial[];
  jobType: string;
  notes: string;
  createdDate: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export interface ParsedUploadRow {
  rowNumber: number;
  data: Partial<WorkOrder>;
  validation: ValidationResult;
}

export interface ParseUploadResult {
  totalRows: number;
  validRows: number;
  invalidRows: number;
  rows: ParsedUploadRow[];
}

export interface CreateWorkOrderData {
  jobId?: string;
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
  address: WorkOrderAddress;
  type: WorkOrderType;
  priority: WorkOrderPriority;
  materials: Omit<WorkOrderMaterial, 'id'>[];
  scheduledDate?: string;
  scheduledTime?: string;
  notes?: string;
  specialInstructions?: string;
  assignedDriver?: string;
  vehicleType?: string;
  createdBy: string;
}

// ============================================
// JN INTEGRATION TYPES (read-only)
// ============================================

export interface JNJobForConversion {
  jnid: string;
  jobNumber: string;
  jobName: string;
  customerName: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  status: string;
  salesRep: string;
  createdAt: string;
  materialCount: number;
  estimateTotal: number;
}

export interface JNJobDetail {
  job: JobNimbusJob;
  contact: JobNimbusContact | null;
  estimates: JobNimbusEstimate[];
}

// ============================================
// PRODUCT CATALOG (for weight/cost lookups)
// ============================================

const PRODUCT_CATALOG: Record<string, { weightPerUnit: number; defaultPrice: number; unit: string }> = {
  'Architectural Shingles': { weightPerUnit: 70, defaultPrice: 95, unit: 'bundle' },
  '3-Tab Shingles': { weightPerUnit: 65, defaultPrice: 75, unit: 'bundle' },
  'Ridge Cap Shingles': { weightPerUnit: 28, defaultPrice: 55, unit: 'bundle' },
  'Starter Strip Shingles': { weightPerUnit: 22, defaultPrice: 45, unit: 'bundle' },
  'Synthetic Underlayment': { weightPerUnit: 35, defaultPrice: 85, unit: 'roll' },
  'Ice & Water Shield': { weightPerUnit: 65, defaultPrice: 145, unit: 'roll' },
  'Drip Edge 10ft': { weightPerUnit: 3, defaultPrice: 8, unit: 'piece' },
  'Step Flashing': { weightPerUnit: 0.5, defaultPrice: 2.5, unit: 'piece' },
  'Pipe Boot': { weightPerUnit: 2, defaultPrice: 18, unit: 'piece' },
  'Ridge Vent 4ft': { weightPerUnit: 4, defaultPrice: 22, unit: 'piece' },
  'Roofing Nails 1.25"': { weightPerUnit: 30, defaultPrice: 55, unit: 'box' },
  'Coil Nails': { weightPerUnit: 25, defaultPrice: 48, unit: 'box' },
  'Plywood 4x8 CDX': { weightPerUnit: 48, defaultPrice: 42, unit: 'sheet' },
  'OSB 4x8 7/16': { weightPerUnit: 44, defaultPrice: 35, unit: 'sheet' },
  'Roofing Felt 15#': { weightPerUnit: 45, defaultPrice: 35, unit: 'roll' },
  'Roofing Felt 30#': { weightPerUnit: 60, defaultPrice: 45, unit: 'roll' },
  'Metal Roofing Panel': { weightPerUnit: 15, defaultPrice: 65, unit: 'panel' },
  'Gutters 10ft': { weightPerUnit: 8, defaultPrice: 25, unit: 'piece' },
  'Downspout 10ft': { weightPerUnit: 4, defaultPrice: 18, unit: 'piece' },
  'Soffit Panel 12ft': { weightPerUnit: 6, defaultPrice: 28, unit: 'piece' },
  'Fascia Board 16ft': { weightPerUnit: 12, defaultPrice: 35, unit: 'piece' },
  'Roof Cement': { weightPerUnit: 10, defaultPrice: 12, unit: 'gallon' },
  'Caulking Tube': { weightPerUnit: 1, defaultPrice: 6, unit: 'tube' },
  'Turbine Vent': { weightPerUnit: 8, defaultPrice: 45, unit: 'piece' },
  'Skylight Flashing Kit': { weightPerUnit: 12, defaultPrice: 125, unit: 'kit' },
};

// ============================================
// MOCK DATA
// ============================================

const MOCK_DRIVERS = [
  { id: 'DRV-001', name: 'Marcus Johnson', vehicle: 'Flatbed Truck' },
  { id: 'DRV-002', name: 'Tony Williams', vehicle: 'Box Truck' },
  { id: 'DRV-003', name: 'Carlos Rivera', vehicle: 'Pickup w/ Trailer' },
  { id: 'DRV-004', name: 'James Mitchell', vehicle: 'Boom Truck' },
];

function generateWorkOrderId(): string {
  const year = new Date().getFullYear();
  const seq = Math.floor(1000 + Math.random() * 9000);
  return `WO-${year}-${seq}`;
}

function generateMaterialId(): string {
  return `MAT-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
}

function buildMockWorkOrders(): WorkOrder[] {
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const tomorrow = new Date(now.getTime() + 86400000).toISOString().slice(0, 10);
  const yesterday = new Date(now.getTime() - 86400000).toISOString().slice(0, 10);
  const twoDaysAgo = new Date(now.getTime() - 2 * 86400000).toISOString().slice(0, 10);
  const threeDaysAgo = new Date(now.getTime() - 3 * 86400000).toISOString().slice(0, 10);
  const nextWeek = new Date(now.getTime() + 5 * 86400000).toISOString().slice(0, 10);

  return [
    {
      workOrderId: 'WO-2026-1001',
      jobId: 'JOB-4521',
      customerName: 'David Richardson',
      customerPhone: '(256) 555-0142',
      customerEmail: 'drichardson@email.com',
      address: { street: '1205 Weatherly Rd SE', city: 'Huntsville', state: 'AL', zip: '35803' },
      type: 'delivery',
      priority: 'normal',
      materials: [
        { id: 'M1', productName: 'Architectural Shingles', quantity: 45, unit: 'bundle', unitPrice: 95, weight: 70 },
        { id: 'M2', productName: 'Synthetic Underlayment', quantity: 6, unit: 'roll', unitPrice: 85, weight: 35 },
        { id: 'M3', productName: 'Ridge Cap Shingles', quantity: 4, unit: 'bundle', unitPrice: 55, weight: 28 },
        { id: 'M4', productName: 'Drip Edge 10ft', quantity: 30, unit: 'piece', unitPrice: 8, weight: 3 },
        { id: 'M5', productName: 'Roofing Nails 1.25"', quantity: 3, unit: 'box', unitPrice: 55, weight: 30 },
      ],
      scheduledDate: tomorrow,
      scheduledTime: '07:30',
      notes: 'Full tear-off and replacement. 28 square roof.',
      specialInstructions: 'Park in driveway. Materials go on left side of house. Gate code: 4455.',
      assignedDriver: 'Marcus Johnson',
      vehicleType: 'Flatbed Truck',
      status: 'approved',
      createdAt: twoDaysAgo + 'T14:30:00Z',
      updatedAt: yesterday + 'T09:15:00Z',
      createdBy: 'Sara Hill',
      estimatedCost: 5225,
      actualCost: null,
      photos: [],
      documents: ['estimate-4521.pdf'],
      statusHistory: [
        { from: 'draft' as WorkOrderStatus, to: 'submitted', changedAt: twoDaysAgo + 'T14:30:00Z', changedBy: 'Sara Hill' },
        { from: 'submitted' as WorkOrderStatus, to: 'approved', changedAt: yesterday + 'T09:15:00Z', changedBy: 'Michael Muse' },
      ],
    },
    {
      workOrderId: 'WO-2026-1002',
      jobId: 'JOB-4518',
      customerName: 'Angela Martinez',
      customerPhone: '(256) 555-0198',
      customerEmail: 'amartinez@email.com',
      address: { street: '8832 Bailey Cove Rd', city: 'Huntsville', state: 'AL', zip: '35802' },
      type: 'delivery',
      priority: 'rush',
      materials: [
        { id: 'M6', productName: '3-Tab Shingles', quantity: 32, unit: 'bundle', unitPrice: 75, weight: 65 },
        { id: 'M7', productName: 'Roofing Felt 30#', quantity: 4, unit: 'roll', unitPrice: 45, weight: 60 },
        { id: 'M8', productName: 'Plywood 4x8 CDX', quantity: 10, unit: 'sheet', unitPrice: 42, weight: 48 },
        { id: 'M9', productName: 'Coil Nails', quantity: 2, unit: 'box', unitPrice: 48, weight: 25 },
      ],
      scheduledDate: today,
      scheduledTime: '06:00',
      notes: 'Storm damage repair. Insurance claim approved.',
      specialInstructions: 'Customer working from home. Knock before unloading. Dogs in backyard.',
      assignedDriver: 'Tony Williams',
      vehicleType: 'Box Truck',
      status: 'in_progress',
      createdAt: threeDaysAgo + 'T10:00:00Z',
      updatedAt: today + 'T06:15:00Z',
      createdBy: 'Michael Muse',
      estimatedCost: 3326,
      actualCost: null,
      photos: [],
      documents: ['insurance-claim-4518.pdf'],
      statusHistory: [
        { from: 'draft' as WorkOrderStatus, to: 'submitted', changedAt: threeDaysAgo + 'T10:00:00Z', changedBy: 'Michael Muse' },
        { from: 'submitted' as WorkOrderStatus, to: 'approved', changedAt: threeDaysAgo + 'T11:30:00Z', changedBy: 'Sara Hill' },
        { from: 'approved' as WorkOrderStatus, to: 'scheduled', changedAt: twoDaysAgo + 'T08:00:00Z', changedBy: 'System' },
        { from: 'scheduled' as WorkOrderStatus, to: 'in_progress', changedAt: today + 'T06:15:00Z', changedBy: 'Tony Williams' },
      ],
    },
    {
      workOrderId: 'WO-2026-1003',
      jobId: 'JOB-4515',
      customerName: 'Robert Chen',
      customerPhone: '(256) 555-0234',
      customerEmail: 'rchen@email.com',
      address: { street: '302 Chateau Dr SW', city: 'Huntsville', state: 'AL', zip: '35801' },
      type: 'supplement',
      priority: 'urgent',
      materials: [
        { id: 'M10', productName: 'Plywood 4x8 CDX', quantity: 8, unit: 'sheet', unitPrice: 42, weight: 48 },
        { id: 'M11', productName: 'Ice & Water Shield', quantity: 2, unit: 'roll', unitPrice: 145, weight: 65 },
      ],
      scheduledDate: today,
      scheduledTime: '10:00',
      notes: 'Supplement order - found additional rot during tear-off. Crew waiting on site.',
      specialInstructions: 'URGENT: Crew on site waiting. Call foreman Bart on arrival.',
      assignedDriver: 'Carlos Rivera',
      vehicleType: 'Pickup w/ Trailer',
      status: 'scheduled',
      createdAt: today + 'T08:30:00Z',
      updatedAt: today + 'T09:00:00Z',
      createdBy: 'Bart Roberts',
      estimatedCost: 626,
      actualCost: null,
      photos: ['rot-damage-1.jpg', 'rot-damage-2.jpg'],
      documents: [],
      statusHistory: [
        { from: 'draft' as WorkOrderStatus, to: 'submitted', changedAt: today + 'T08:30:00Z', changedBy: 'Bart Roberts' },
        { from: 'submitted' as WorkOrderStatus, to: 'approved', changedAt: today + 'T08:45:00Z', changedBy: 'Michael Muse', notes: 'Urgent supplement approved' },
        { from: 'approved' as WorkOrderStatus, to: 'scheduled', changedAt: today + 'T09:00:00Z', changedBy: 'System' },
      ],
    },
    {
      workOrderId: 'WO-2026-1004',
      jobId: 'JOB-4510',
      customerName: 'Patricia Walker',
      customerPhone: '(256) 555-0167',
      customerEmail: 'pwalker@email.com',
      address: { street: '5501 Calhoun Rd', city: 'Madison', state: 'AL', zip: '35756' },
      type: 'return',
      priority: 'low',
      materials: [
        { id: 'M12', productName: 'Architectural Shingles', quantity: 8, unit: 'bundle', unitPrice: 95, weight: 70 },
        { id: 'M13', productName: 'Drip Edge 10ft', quantity: 12, unit: 'piece', unitPrice: 8, weight: 3 },
      ],
      scheduledDate: nextWeek,
      scheduledTime: '09:00',
      notes: 'Leftover materials from completed job. Customer requested pickup.',
      specialInstructions: 'Materials stacked on left side of garage. Customer may not be home.',
      assignedDriver: '',
      vehicleType: '',
      status: 'submitted',
      createdAt: yesterday + 'T16:00:00Z',
      updatedAt: yesterday + 'T16:00:00Z',
      createdBy: 'Sara Hill',
      estimatedCost: 856,
      actualCost: null,
      photos: [],
      documents: [],
      statusHistory: [
        { from: 'draft' as WorkOrderStatus, to: 'submitted', changedAt: yesterday + 'T16:00:00Z', changedBy: 'Sara Hill' },
      ],
    },
    {
      workOrderId: 'WO-2026-1005',
      jobId: 'JOB-4508',
      customerName: 'Thomas Green',
      customerPhone: '(256) 555-0289',
      customerEmail: 'tgreen@email.com',
      address: { street: '125 Hughes Rd', city: 'Madison', state: 'AL', zip: '35758' },
      type: 'delivery',
      priority: 'normal',
      materials: [
        { id: 'M14', productName: 'Metal Roofing Panel', quantity: 48, unit: 'panel', unitPrice: 65, weight: 15 },
        { id: 'M15', productName: 'Ridge Vent 4ft', quantity: 12, unit: 'piece', unitPrice: 22, weight: 4 },
        { id: 'M16', productName: 'Pipe Boot', quantity: 3, unit: 'piece', unitPrice: 18, weight: 2 },
        { id: 'M17', productName: 'Roofing Nails 1.25"', quantity: 2, unit: 'box', unitPrice: 55, weight: 30 },
      ],
      scheduledDate: tomorrow,
      scheduledTime: '08:00',
      notes: 'Metal roof installation. 22 square barn/shop.',
      specialInstructions: 'Deliver to rear shop building, not main house. Gravel road - use 4WD.',
      assignedDriver: 'James Mitchell',
      vehicleType: 'Boom Truck',
      status: 'approved',
      createdAt: twoDaysAgo + 'T11:00:00Z',
      updatedAt: yesterday + 'T14:00:00Z',
      createdBy: 'Michael Muse',
      estimatedCost: 3544,
      actualCost: null,
      photos: [],
      documents: ['shop-layout.pdf'],
      statusHistory: [
        { from: 'draft' as WorkOrderStatus, to: 'submitted', changedAt: twoDaysAgo + 'T11:00:00Z', changedBy: 'Michael Muse' },
        { from: 'submitted' as WorkOrderStatus, to: 'approved', changedAt: yesterday + 'T14:00:00Z', changedBy: 'Sara Hill' },
      ],
    },
    {
      workOrderId: 'WO-2026-1006',
      jobId: 'JOB-4503',
      customerName: 'Karen Phillips',
      customerPhone: '(256) 555-0345',
      customerEmail: 'kphillips@email.com',
      address: { street: '2200 Governors Dr SW', city: 'Huntsville', state: 'AL', zip: '35805' },
      type: 'delivery',
      priority: 'normal',
      materials: [
        { id: 'M18', productName: 'Architectural Shingles', quantity: 38, unit: 'bundle', unitPrice: 95, weight: 70 },
        { id: 'M19', productName: 'Synthetic Underlayment', quantity: 5, unit: 'roll', unitPrice: 85, weight: 35 },
        { id: 'M20', productName: 'Starter Strip Shingles', quantity: 6, unit: 'bundle', unitPrice: 45, weight: 22 },
        { id: 'M21', productName: 'Ridge Cap Shingles', quantity: 3, unit: 'bundle', unitPrice: 55, weight: 28 },
        { id: 'M22', productName: 'Step Flashing', quantity: 40, unit: 'piece', unitPrice: 2.5, weight: 0.5 },
      ],
      scheduledDate: twoDaysAgo,
      scheduledTime: '07:00',
      notes: 'Completed delivery. 25 square residential.',
      specialInstructions: 'Delivered to rooftop via boom truck.',
      assignedDriver: 'James Mitchell',
      vehicleType: 'Boom Truck',
      status: 'completed',
      createdAt: threeDaysAgo + 'T09:00:00Z',
      updatedAt: twoDaysAgo + 'T08:30:00Z',
      createdBy: 'Sara Hill',
      estimatedCost: 4565,
      actualCost: 4565,
      photos: ['delivery-proof-1.jpg', 'delivery-proof-2.jpg'],
      documents: ['signed-receipt-4503.pdf'],
      statusHistory: [
        { from: 'draft' as WorkOrderStatus, to: 'submitted', changedAt: threeDaysAgo + 'T09:00:00Z', changedBy: 'Sara Hill' },
        { from: 'submitted' as WorkOrderStatus, to: 'approved', changedAt: threeDaysAgo + 'T10:00:00Z', changedBy: 'Michael Muse' },
        { from: 'approved' as WorkOrderStatus, to: 'scheduled', changedAt: threeDaysAgo + 'T10:15:00Z', changedBy: 'System' },
        { from: 'scheduled' as WorkOrderStatus, to: 'in_progress', changedAt: twoDaysAgo + 'T07:15:00Z', changedBy: 'James Mitchell' },
        { from: 'in_progress' as WorkOrderStatus, to: 'completed', changedAt: twoDaysAgo + 'T08:30:00Z', changedBy: 'James Mitchell' },
      ],
    },
    {
      workOrderId: 'WO-2026-1007',
      jobId: 'JOB-4499',
      customerName: 'William Harris',
      customerPhone: '(256) 555-0412',
      customerEmail: 'wharris@email.com',
      address: { street: '7710 Charlotte Dr NW', city: 'Huntsville', state: 'AL', zip: '35806' },
      type: 'delivery',
      priority: 'rush',
      materials: [
        { id: 'M23', productName: 'Architectural Shingles', quantity: 52, unit: 'bundle', unitPrice: 95, weight: 70 },
        { id: 'M24', productName: 'Ice & Water Shield', quantity: 4, unit: 'roll', unitPrice: 145, weight: 65 },
        { id: 'M25', productName: 'Synthetic Underlayment', quantity: 7, unit: 'roll', unitPrice: 85, weight: 35 },
        { id: 'M26', productName: 'Plywood 4x8 CDX', quantity: 15, unit: 'sheet', unitPrice: 42, weight: 48 },
        { id: 'M27', productName: 'Turbine Vent', quantity: 2, unit: 'piece', unitPrice: 45, weight: 8 },
      ],
      scheduledDate: today,
      scheduledTime: '06:30',
      notes: 'Large residential. 32 square. Storm damage with deck rot.',
      specialInstructions: 'HOA requires materials stored in garage overnight. Deliver to driveway.',
      assignedDriver: 'Marcus Johnson',
      vehicleType: 'Flatbed Truck',
      status: 'scheduled',
      createdAt: twoDaysAgo + 'T16:00:00Z',
      updatedAt: yesterday + 'T11:00:00Z',
      createdBy: 'Michael Muse',
      estimatedCost: 6785,
      actualCost: null,
      photos: [],
      documents: ['hoa-approval.pdf', 'insurance-scope.pdf'],
      statusHistory: [
        { from: 'draft' as WorkOrderStatus, to: 'submitted', changedAt: twoDaysAgo + 'T16:00:00Z', changedBy: 'Michael Muse' },
        { from: 'submitted' as WorkOrderStatus, to: 'approved', changedAt: yesterday + 'T08:00:00Z', changedBy: 'Sara Hill' },
        { from: 'approved' as WorkOrderStatus, to: 'scheduled', changedAt: yesterday + 'T11:00:00Z', changedBy: 'System' },
      ],
    },
    {
      workOrderId: 'WO-2026-1008',
      jobId: 'JOB-4495',
      customerName: 'Lisa Thompson',
      customerPhone: '(256) 555-0178',
      customerEmail: 'lthompson@email.com',
      address: { street: '4400 Bob Wallace Ave', city: 'Huntsville', state: 'AL', zip: '35805' },
      type: 'pickup',
      priority: 'normal',
      materials: [
        { id: 'M28', productName: 'Architectural Shingles', quantity: 5, unit: 'bundle', unitPrice: 95, weight: 70 },
        { id: 'M29', productName: 'Synthetic Underlayment', quantity: 1, unit: 'roll', unitPrice: 85, weight: 35 },
      ],
      scheduledDate: tomorrow,
      scheduledTime: '14:00',
      notes: 'Picking up unused materials from completed job.',
      specialInstructions: 'Materials on back porch. Ring doorbell on arrival.',
      assignedDriver: 'Carlos Rivera',
      vehicleType: 'Pickup w/ Trailer',
      status: 'approved',
      createdAt: yesterday + 'T10:00:00Z',
      updatedAt: today + 'T08:00:00Z',
      createdBy: 'Sara Hill',
      estimatedCost: 560,
      actualCost: null,
      photos: [],
      documents: [],
      statusHistory: [
        { from: 'draft' as WorkOrderStatus, to: 'submitted', changedAt: yesterday + 'T10:00:00Z', changedBy: 'Sara Hill' },
        { from: 'submitted' as WorkOrderStatus, to: 'approved', changedAt: today + 'T08:00:00Z', changedBy: 'Michael Muse' },
      ],
    },
    {
      workOrderId: 'WO-2026-1009',
      jobId: 'JOB-4490',
      customerName: 'James Anderson',
      customerPhone: '(256) 555-0523',
      customerEmail: 'janderson@email.com',
      address: { street: '100 Church St NW', city: 'Huntsville', state: 'AL', zip: '35801' },
      type: 'delivery',
      priority: 'normal',
      materials: [
        { id: 'M30', productName: 'Gutters 10ft', quantity: 20, unit: 'piece', unitPrice: 25, weight: 8 },
        { id: 'M31', productName: 'Downspout 10ft', quantity: 8, unit: 'piece', unitPrice: 18, weight: 4 },
        { id: 'M32', productName: 'Soffit Panel 12ft', quantity: 16, unit: 'piece', unitPrice: 28, weight: 6 },
        { id: 'M33', productName: 'Fascia Board 16ft', quantity: 10, unit: 'piece', unitPrice: 35, weight: 12 },
      ],
      scheduledDate: threeDaysAgo,
      scheduledTime: '08:00',
      notes: 'Gutter and soffit replacement. Historic district.',
      specialInstructions: 'Street parking only. No blocking sidewalk. Contact property manager.',
      assignedDriver: 'Tony Williams',
      vehicleType: 'Box Truck',
      status: 'completed',
      createdAt: new Date(now.getTime() - 5 * 86400000).toISOString().slice(0, 10) + 'T09:00:00Z',
      updatedAt: threeDaysAgo + 'T09:45:00Z',
      createdBy: 'Michael Muse',
      estimatedCost: 1342,
      actualCost: 1342,
      photos: ['gutter-delivery-1.jpg'],
      documents: ['signed-receipt-4490.pdf'],
      statusHistory: [
        { from: 'draft' as WorkOrderStatus, to: 'submitted', changedAt: new Date(now.getTime() - 5 * 86400000).toISOString().slice(0, 10) + 'T09:00:00Z', changedBy: 'Michael Muse' },
        { from: 'submitted' as WorkOrderStatus, to: 'approved', changedAt: new Date(now.getTime() - 4 * 86400000).toISOString().slice(0, 10) + 'T08:00:00Z', changedBy: 'Sara Hill' },
        { from: 'approved' as WorkOrderStatus, to: 'scheduled', changedAt: new Date(now.getTime() - 4 * 86400000).toISOString().slice(0, 10) + 'T10:00:00Z', changedBy: 'System' },
        { from: 'scheduled' as WorkOrderStatus, to: 'in_progress', changedAt: threeDaysAgo + 'T08:10:00Z', changedBy: 'Tony Williams' },
        { from: 'in_progress' as WorkOrderStatus, to: 'completed', changedAt: threeDaysAgo + 'T09:45:00Z', changedBy: 'Tony Williams' },
      ],
    },
    {
      workOrderId: 'WO-2026-1010',
      jobId: 'JOB-4487',
      customerName: 'Susan Davis',
      customerPhone: '(256) 555-0634',
      customerEmail: 'sdavis@email.com',
      address: { street: '3045 Memorial Pkwy NW', city: 'Huntsville', state: 'AL', zip: '35810' },
      type: 'delivery',
      priority: 'normal',
      materials: [
        { id: 'M34', productName: 'Architectural Shingles', quantity: 28, unit: 'bundle', unitPrice: 95, weight: 70 },
        { id: 'M35', productName: 'Synthetic Underlayment', quantity: 4, unit: 'roll', unitPrice: 85, weight: 35 },
        { id: 'M36', productName: 'Drip Edge 10ft', quantity: 24, unit: 'piece', unitPrice: 8, weight: 3 },
        { id: 'M37', productName: 'Starter Strip Shingles', quantity: 4, unit: 'bundle', unitPrice: 45, weight: 22 },
      ],
      scheduledDate: '',
      scheduledTime: '',
      notes: 'Standard re-roof. 18 square. Waiting on permit approval.',
      specialInstructions: 'Cannot schedule until city permit is approved.',
      assignedDriver: '',
      vehicleType: '',
      status: 'draft',
      createdAt: today + 'T11:00:00Z',
      updatedAt: today + 'T11:00:00Z',
      createdBy: 'Sara Hill',
      estimatedCost: 3240,
      actualCost: null,
      photos: [],
      documents: ['permit-application.pdf'],
      statusHistory: [],
    },
    {
      workOrderId: 'WO-2026-1011',
      jobId: 'JOB-4482',
      customerName: 'Michael Brown',
      customerPhone: '(256) 555-0756',
      customerEmail: 'mbrown@email.com',
      address: { street: '904 Regal Dr SE', city: 'Huntsville', state: 'AL', zip: '35801' },
      type: 'supplement',
      priority: 'rush',
      materials: [
        { id: 'M38', productName: 'OSB 4x8 7/16', quantity: 6, unit: 'sheet', unitPrice: 35, weight: 44 },
        { id: 'M39', productName: 'Architectural Shingles', quantity: 5, unit: 'bundle', unitPrice: 95, weight: 70 },
        { id: 'M40', productName: 'Pipe Boot', quantity: 2, unit: 'piece', unitPrice: 18, weight: 2 },
      ],
      scheduledDate: yesterday,
      scheduledTime: '11:00',
      notes: 'Supplement for additional damage found. Job in progress.',
      specialInstructions: 'Deliver to crew on site. Foreman: Destin.',
      assignedDriver: 'Marcus Johnson',
      vehicleType: 'Flatbed Truck',
      status: 'completed',
      createdAt: yesterday + 'T09:30:00Z',
      updatedAt: yesterday + 'T12:00:00Z',
      createdBy: 'Destin',
      estimatedCost: 721,
      actualCost: 721,
      photos: ['supplement-delivered.jpg'],
      documents: [],
      statusHistory: [
        { from: 'draft' as WorkOrderStatus, to: 'submitted', changedAt: yesterday + 'T09:30:00Z', changedBy: 'Destin' },
        { from: 'submitted' as WorkOrderStatus, to: 'approved', changedAt: yesterday + 'T09:45:00Z', changedBy: 'Michael Muse', notes: 'Rush supplement approved' },
        { from: 'approved' as WorkOrderStatus, to: 'scheduled', changedAt: yesterday + 'T10:00:00Z', changedBy: 'System' },
        { from: 'scheduled' as WorkOrderStatus, to: 'in_progress', changedAt: yesterday + 'T11:10:00Z', changedBy: 'Marcus Johnson' },
        { from: 'in_progress' as WorkOrderStatus, to: 'completed', changedAt: yesterday + 'T12:00:00Z', changedBy: 'Marcus Johnson' },
      ],
    },
    {
      workOrderId: 'WO-2026-1012',
      jobId: 'JOB-4478',
      customerName: 'Jennifer Wilson',
      customerPhone: '(256) 555-0891',
      customerEmail: 'jwilson@email.com',
      address: { street: '6100 University Dr NW', city: 'Huntsville', state: 'AL', zip: '35806' },
      type: 'delivery',
      priority: 'normal',
      materials: [
        { id: 'M41', productName: 'Architectural Shingles', quantity: 35, unit: 'bundle', unitPrice: 95, weight: 70 },
        { id: 'M42', productName: 'Synthetic Underlayment', quantity: 5, unit: 'roll', unitPrice: 85, weight: 35 },
        { id: 'M43', productName: 'Ridge Cap Shingles', quantity: 3, unit: 'bundle', unitPrice: 55, weight: 28 },
        { id: 'M44', productName: 'Skylight Flashing Kit', quantity: 2, unit: 'kit', unitPrice: 125, weight: 12 },
      ],
      scheduledDate: new Date(now.getTime() - 6 * 86400000).toISOString().slice(0, 10),
      scheduledTime: '07:00',
      notes: 'Completed. 23 square with 2 skylights.',
      specialInstructions: '',
      assignedDriver: 'Tony Williams',
      vehicleType: 'Box Truck',
      status: 'cancelled',
      createdAt: new Date(now.getTime() - 8 * 86400000).toISOString().slice(0, 10) + 'T14:00:00Z',
      updatedAt: new Date(now.getTime() - 6 * 86400000).toISOString().slice(0, 10) + 'T16:00:00Z',
      createdBy: 'Sara Hill',
      estimatedCost: 4200,
      actualCost: null,
      photos: [],
      documents: [],
      statusHistory: [
        { from: 'draft' as WorkOrderStatus, to: 'submitted', changedAt: new Date(now.getTime() - 8 * 86400000).toISOString().slice(0, 10) + 'T14:00:00Z', changedBy: 'Sara Hill' },
        { from: 'submitted' as WorkOrderStatus, to: 'approved', changedAt: new Date(now.getTime() - 7 * 86400000).toISOString().slice(0, 10) + 'T09:00:00Z', changedBy: 'Michael Muse' },
        { from: 'approved' as WorkOrderStatus, to: 'cancelled', changedAt: new Date(now.getTime() - 6 * 86400000).toISOString().slice(0, 10) + 'T16:00:00Z', changedBy: 'Sara Hill', notes: 'Customer postponed project to spring' },
      ],
    },
  ];
}

// Mock jobs available for ticket creation
function buildMockJobs(): JobData[] {
  return [
    {
      jobId: 'JOB-4530',
      customerName: 'Brian Foster',
      customerPhone: '(256) 555-0901',
      customerEmail: 'bfoster@email.com',
      address: { street: '1512 Pulaski Pike NW', city: 'Huntsville', state: 'AL', zip: '35816' },
      materials: [
        { id: 'J1', productName: 'Architectural Shingles', quantity: 40, unit: 'bundle', unitPrice: 95, weight: 70 },
        { id: 'J2', productName: 'Synthetic Underlayment', quantity: 5, unit: 'roll', unitPrice: 85, weight: 35 },
        { id: 'J3', productName: 'Ridge Cap Shingles', quantity: 4, unit: 'bundle', unitPrice: 55, weight: 28 },
        { id: 'J4', productName: 'Roofing Nails 1.25"', quantity: 3, unit: 'box', unitPrice: 55, weight: 30 },
      ],
      jobType: 'Full Replacement',
      notes: 'Approved estimate. Ready for scheduling.',
      createdDate: '2026-01-28',
    },
    {
      jobId: 'JOB-4529',
      customerName: 'Nancy Roberts',
      customerPhone: '(256) 555-0445',
      customerEmail: 'nroberts@email.com',
      address: { street: '3300 Triana Blvd SW', city: 'Huntsville', state: 'AL', zip: '35805' },
      materials: [
        { id: 'J5', productName: '3-Tab Shingles', quantity: 25, unit: 'bundle', unitPrice: 75, weight: 65 },
        { id: 'J6', productName: 'Roofing Felt 15#', quantity: 4, unit: 'roll', unitPrice: 35, weight: 45 },
        { id: 'J7', productName: 'Drip Edge 10ft', quantity: 20, unit: 'piece', unitPrice: 8, weight: 3 },
      ],
      jobType: 'Repair',
      notes: 'Partial replacement. Wind damage on south slope.',
      createdDate: '2026-01-25',
    },
    {
      jobId: 'JOB-4527',
      customerName: 'George Taylor',
      customerPhone: '(256) 555-0678',
      customerEmail: 'gtaylor@email.com',
      address: { street: '8200 Whitesburg Dr S', city: 'Huntsville', state: 'AL', zip: '35802' },
      materials: [
        { id: 'J8', productName: 'Metal Roofing Panel', quantity: 36, unit: 'panel', unitPrice: 65, weight: 15 },
        { id: 'J9', productName: 'Ridge Vent 4ft', quantity: 8, unit: 'piece', unitPrice: 22, weight: 4 },
        { id: 'J10', productName: 'Roofing Nails 1.25"', quantity: 2, unit: 'box', unitPrice: 55, weight: 30 },
      ],
      jobType: 'Metal Roof Install',
      notes: 'Detached garage metal roof. Customer providing color sample.',
      createdDate: '2026-01-22',
    },
    {
      jobId: 'JOB-4525',
      customerName: 'Dorothy Clark',
      customerPhone: '(256) 555-0234',
      customerEmail: 'dclark@email.com',
      address: { street: '200 Madison St SE', city: 'Huntsville', state: 'AL', zip: '35801' },
      materials: [
        { id: 'J11', productName: 'Architectural Shingles', quantity: 30, unit: 'bundle', unitPrice: 95, weight: 70 },
        { id: 'J12', productName: 'Ice & Water Shield', quantity: 3, unit: 'roll', unitPrice: 145, weight: 65 },
        { id: 'J13', productName: 'Synthetic Underlayment', quantity: 4, unit: 'roll', unitPrice: 85, weight: 35 },
        { id: 'J14', productName: 'Starter Strip Shingles', quantity: 5, unit: 'bundle', unitPrice: 45, weight: 22 },
      ],
      jobType: 'Full Replacement',
      notes: 'Insurance job. Supplement pending.',
      createdDate: '2026-01-20',
    },
    {
      jobId: 'JOB-4522',
      customerName: 'Steven Lee',
      customerPhone: '(256) 555-0567',
      customerEmail: 'slee@email.com',
      address: { street: '4900 Bradford Dr NW', city: 'Huntsville', state: 'AL', zip: '35810' },
      materials: [
        { id: 'J15', productName: 'Gutters 10ft', quantity: 16, unit: 'piece', unitPrice: 25, weight: 8 },
        { id: 'J16', productName: 'Downspout 10ft', quantity: 6, unit: 'piece', unitPrice: 18, weight: 4 },
        { id: 'J17', productName: 'Soffit Panel 12ft', quantity: 12, unit: 'piece', unitPrice: 28, weight: 6 },
      ],
      jobType: 'Gutter Replacement',
      notes: 'Full gutter system replacement.',
      createdDate: '2026-01-18',
    },
    {
      jobId: 'JOB-4520',
      customerName: 'Maria Gonzalez',
      customerPhone: '(256) 555-0890',
      customerEmail: 'mgonzalez@email.com',
      address: { street: '7200 Old Madison Pike', city: 'Huntsville', state: 'AL', zip: '35806' },
      materials: [
        { id: 'J18', productName: 'Architectural Shingles', quantity: 55, unit: 'bundle', unitPrice: 95, weight: 70 },
        { id: 'J19', productName: 'Synthetic Underlayment', quantity: 8, unit: 'roll', unitPrice: 85, weight: 35 },
        { id: 'J20', productName: 'Ridge Cap Shingles', quantity: 5, unit: 'bundle', unitPrice: 55, weight: 28 },
        { id: 'J21', productName: 'Plywood 4x8 CDX', quantity: 20, unit: 'sheet', unitPrice: 42, weight: 48 },
        { id: 'J22', productName: 'Ice & Water Shield', quantity: 4, unit: 'roll', unitPrice: 145, weight: 65 },
      ],
      jobType: 'Full Replacement',
      notes: 'Large residential. 35 square. Some deck rot expected.',
      createdDate: '2026-01-15',
    },
    {
      jobId: 'JOB-4516',
      customerName: 'Richard Adams',
      customerPhone: '(256) 555-0321',
      customerEmail: 'radams@email.com',
      address: { street: '510 Pratt Ave NE', city: 'Huntsville', state: 'AL', zip: '35801' },
      materials: [
        { id: 'J23', productName: 'Architectural Shingles', quantity: 22, unit: 'bundle', unitPrice: 95, weight: 70 },
        { id: 'J24', productName: 'Roofing Felt 30#', quantity: 3, unit: 'roll', unitPrice: 45, weight: 60 },
        { id: 'J25', productName: 'Drip Edge 10ft', quantity: 18, unit: 'piece', unitPrice: 8, weight: 3 },
      ],
      jobType: 'Repair',
      notes: 'Hail damage repair. Two slopes affected.',
      createdDate: '2026-01-12',
    },
    {
      jobId: 'JOB-4512',
      customerName: 'Elizabeth Wright',
      customerPhone: '(256) 555-0456',
      customerEmail: 'ewright@email.com',
      address: { street: '1800 Jeff Rd NW', city: 'Huntsville', state: 'AL', zip: '35806' },
      materials: [
        { id: 'J26', productName: 'Fascia Board 16ft', quantity: 14, unit: 'piece', unitPrice: 35, weight: 12 },
        { id: 'J27', productName: 'Soffit Panel 12ft', quantity: 20, unit: 'piece', unitPrice: 28, weight: 6 },
        { id: 'J28', productName: 'Caulking Tube', quantity: 12, unit: 'tube', unitPrice: 6, weight: 1 },
      ],
      jobType: 'Soffit/Fascia',
      notes: 'Complete soffit and fascia replacement. Wood rot.',
      createdDate: '2026-01-10',
    },
  ];
}

// ============================================
// VALID STATUS TRANSITIONS
// ============================================

const VALID_TRANSITIONS: Record<WorkOrderStatus, WorkOrderStatus[]> = {
  draft: ['submitted', 'cancelled'],
  submitted: ['approved', 'cancelled', 'draft'],
  approved: ['scheduled', 'cancelled'],
  scheduled: ['in_progress', 'cancelled', 'approved'],
  in_progress: ['completed', 'cancelled'],
  completed: [],
  cancelled: ['draft'],
};

// ============================================
// DELIVERY COST FACTORS
// ============================================

const DELIVERY_BASE_FEE = 75;
const RUSH_MULTIPLIER = 1.5;
const URGENT_MULTIPLIER = 2.0;
const WEIGHT_RATE_PER_LB = 0.05; // per lb over 2000 lbs

// ============================================
// SERVICE CLASS
// ============================================

class WorkOrderService {
  private workOrders: WorkOrder[];
  private mockJobs: JobData[];

  constructor() {
    this.workOrders = buildMockWorkOrders();
    this.mockJobs = buildMockJobs();
  }

  // --- Work Order CRUD ---

  getWorkOrders(filters?: {
    status?: WorkOrderStatus;
    type?: WorkOrderType;
    priority?: WorkOrderPriority;
    search?: string;
    dateFrom?: string;
    dateTo?: string;
    sortBy?: string;
    sortDir?: 'asc' | 'desc';
  }): WorkOrder[] {
    let results = [...this.workOrders];

    if (filters?.status) {
      results = results.filter(wo => wo.status === filters.status);
    }
    if (filters?.type) {
      results = results.filter(wo => wo.type === filters.type);
    }
    if (filters?.priority) {
      results = results.filter(wo => wo.priority === filters.priority);
    }
    if (filters?.search) {
      const q = filters.search.toLowerCase();
      results = results.filter(wo =>
        wo.customerName.toLowerCase().includes(q) ||
        wo.workOrderId.toLowerCase().includes(q) ||
        wo.jobId.toLowerCase().includes(q) ||
        wo.address.street.toLowerCase().includes(q) ||
        wo.address.city.toLowerCase().includes(q)
      );
    }
    if (filters?.dateFrom) {
      results = results.filter(wo => wo.scheduledDate >= filters.dateFrom!);
    }
    if (filters?.dateTo) {
      results = results.filter(wo => wo.scheduledDate <= filters.dateTo!);
    }

    // Sort
    const sortBy = filters?.sortBy || 'createdAt';
    const sortDir = filters?.sortDir || 'desc';
    results.sort((a, b) => {
      let aVal: string | number = '';
      let bVal: string | number = '';

      if (sortBy === 'priority') {
        const pOrder: Record<WorkOrderPriority, number> = { urgent: 0, rush: 1, normal: 2, low: 3 };
        aVal = pOrder[a.priority];
        bVal = pOrder[b.priority];
      } else if (sortBy === 'status') {
        const sOrder: Record<WorkOrderStatus, number> = {
          in_progress: 0, scheduled: 1, approved: 2, submitted: 3, draft: 4, completed: 5, cancelled: 6,
        };
        aVal = sOrder[a.status];
        bVal = sOrder[b.status];
      } else if (sortBy === 'scheduledDate') {
        aVal = a.scheduledDate || '9999';
        bVal = b.scheduledDate || '9999';
      } else if (sortBy === 'estimatedCost') {
        aVal = a.estimatedCost;
        bVal = b.estimatedCost;
      } else {
        aVal = a.createdAt;
        bVal = b.createdAt;
      }

      if (aVal < bVal) return sortDir === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });

    return results;
  }

  getWorkOrderById(id: string): WorkOrder | null {
    return this.workOrders.find(wo => wo.workOrderId === id) || null;
  }

  createWorkOrder(data: CreateWorkOrderData): { success: boolean; workOrder?: WorkOrder; errors?: string[] } {
    const validation = this.validateWorkOrder(data);
    if (!validation.valid) {
      return { success: false, errors: validation.errors };
    }

    const now = new Date().toISOString();
    const materials: WorkOrderMaterial[] = data.materials.map(m => ({
      ...m,
      id: generateMaterialId(),
    }));

    const workOrder: WorkOrder = {
      workOrderId: generateWorkOrderId(),
      jobId: data.jobId || `JOB-${Math.floor(4000 + Math.random() * 1000)}`,
      customerName: data.customerName,
      customerPhone: data.customerPhone,
      customerEmail: data.customerEmail || '',
      address: data.address,
      type: data.type,
      priority: data.priority,
      materials,
      scheduledDate: data.scheduledDate || '',
      scheduledTime: data.scheduledTime || '',
      notes: data.notes || '',
      specialInstructions: data.specialInstructions || '',
      assignedDriver: data.assignedDriver || '',
      vehicleType: data.vehicleType || '',
      status: 'draft',
      createdAt: now,
      updatedAt: now,
      createdBy: data.createdBy,
      estimatedCost: this.calculateWorkOrderCost({
        materials,
        priority: data.priority,
        type: data.type,
      }),
      actualCost: null,
      photos: [],
      documents: [],
      statusHistory: [],
    };

    this.workOrders.unshift(workOrder);
    return { success: true, workOrder };
  }

  // --- Validation ---

  validateWorkOrder(data: Partial<CreateWorkOrderData>): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!data.customerName?.trim()) {
      errors.push('Customer name is required');
    }
    if (!data.customerPhone?.trim()) {
      errors.push('Customer phone is required');
    }
    if (!data.address?.street?.trim()) {
      errors.push('Street address is required');
    }
    if (!data.address?.city?.trim()) {
      errors.push('City is required');
    }
    if (!data.address?.state?.trim()) {
      errors.push('State is required');
    }
    if (!data.address?.zip?.trim()) {
      errors.push('ZIP code is required');
    } else if (!/^\d{5}(-\d{4})?$/.test(data.address.zip.trim())) {
      errors.push('ZIP code must be a valid 5-digit format');
    }
    if (!data.type) {
      errors.push('Work order type is required');
    }
    if (!data.priority) {
      errors.push('Priority is required');
    }
    if (!data.materials || data.materials.length === 0) {
      errors.push('At least one material item is required');
    } else {
      data.materials.forEach((m, i) => {
        if (!m.productName?.trim()) {
          errors.push(`Material row ${i + 1}: Product name is required`);
        }
        if (!m.quantity || m.quantity <= 0) {
          errors.push(`Material row ${i + 1}: Quantity must be greater than 0`);
        }
        if (m.unitPrice < 0) {
          errors.push(`Material row ${i + 1}: Unit price cannot be negative`);
        }
      });
    }

    // Warnings
    if (!data.customerEmail?.trim()) {
      warnings.push('No customer email provided - notifications will be limited');
    }
    if (!data.scheduledDate) {
      warnings.push('No scheduled date set - work order will remain in draft');
    }
    if (data.priority === 'urgent' && !data.scheduledDate) {
      warnings.push('Urgent work order has no scheduled date');
    }

    return { valid: errors.length === 0, errors, warnings };
  }

  // --- Cost Calculation ---

  calculateWorkOrderCost(params: {
    materials: WorkOrderMaterial[] | Omit<WorkOrderMaterial, 'id'>[];
    priority: WorkOrderPriority;
    type: WorkOrderType;
  }): number {
    const materialCost = params.materials.reduce((sum: number, m) => sum + m.quantity * m.unitPrice, 0);
    const totalWeight = params.materials.reduce((sum: number, m) => sum + m.quantity * m.weight, 0);

    let deliveryFee = DELIVERY_BASE_FEE;
    if (totalWeight > 2000) {
      deliveryFee += (totalWeight - 2000) * WEIGHT_RATE_PER_LB;
    }

    if (params.priority === 'rush') {
      deliveryFee *= RUSH_MULTIPLIER;
    } else if (params.priority === 'urgent') {
      deliveryFee *= URGENT_MULTIPLIER;
    }

    // Returns/pickups are cheaper (just delivery fee, materials credited)
    if (params.type === 'return' || params.type === 'pickup') {
      return Math.round(deliveryFee);
    }

    return Math.round(materialCost + deliveryFee);
  }

  // --- Status Management ---

  getWorkOrderStatus(id: string): WorkOrderStatus | null {
    const wo = this.getWorkOrderById(id);
    return wo ? wo.status : null;
  }

  updateWorkOrderStatus(
    id: string,
    newStatus: WorkOrderStatus,
    changedBy: string,
    notes?: string
  ): { success: boolean; error?: string; workOrder?: WorkOrder } {
    const wo = this.getWorkOrderById(id);
    if (!wo) {
      return { success: false, error: 'Work order not found' };
    }

    const validNextStatuses = VALID_TRANSITIONS[wo.status];
    if (!validNextStatuses.includes(newStatus)) {
      return {
        success: false,
        error: `Cannot transition from "${wo.status}" to "${newStatus}". Valid transitions: ${validNextStatuses.join(', ') || 'none'}`,
      };
    }

    const change: WorkOrderStatusChange = {
      from: wo.status,
      to: newStatus,
      changedAt: new Date().toISOString(),
      changedBy,
      notes,
    };

    wo.statusHistory.push(change);
    wo.status = newStatus;
    wo.updatedAt = new Date().toISOString();

    if (newStatus === 'completed' && wo.actualCost === null) {
      wo.actualCost = wo.estimatedCost;
    }

    return { success: true, workOrder: wo };
  }

  getWorkOrderHistory(id: string): WorkOrderStatusChange[] | null {
    const wo = this.getWorkOrderById(id);
    return wo ? wo.statusHistory : null;
  }

  // --- Job-to-Ticket Conversion ---

  getAvailableJobs(): JobData[] {
    return [...this.mockJobs];
  }

  createTicketFromJob(jobData: JobData): { success: boolean; workOrder?: WorkOrder; errors?: string[] } {
    // Determine priority based on job age
    const jobAge = Math.floor((Date.now() - new Date(jobData.createdDate).getTime()) / 86400000);
    let priority: WorkOrderPriority = 'normal';
    if (jobAge > 21) priority = 'rush';
    if (jobAge > 30) priority = 'urgent';

    // Auto-populate weights from catalog
    const materials: Omit<WorkOrderMaterial, 'id'>[] = jobData.materials.map(m => {
      const catalog = PRODUCT_CATALOG[m.productName];
      return {
        productName: m.productName,
        quantity: m.quantity,
        unit: catalog?.unit || m.unit,
        unitPrice: catalog?.defaultPrice || m.unitPrice,
        weight: catalog?.weightPerUnit || m.weight,
      };
    });

    const type: WorkOrderType = jobData.jobType.toLowerCase().includes('return') ? 'return' :
      jobData.jobType.toLowerCase().includes('pickup') ? 'pickup' :
      jobData.jobType.toLowerCase().includes('supplement') ? 'supplement' : 'delivery';

    return this.createWorkOrder({
      jobId: jobData.jobId,
      customerName: jobData.customerName,
      customerPhone: jobData.customerPhone,
      customerEmail: jobData.customerEmail,
      address: jobData.address,
      type,
      priority,
      materials,
      notes: jobData.notes,
      createdBy: 'System (Job Conversion)',
    });
  }

  bulkCreateTickets(jobs: JobData[]): {
    total: number;
    successful: number;
    failed: number;
    results: Array<{ jobId: string; success: boolean; workOrderId?: string; error?: string }>;
  } {
    const results = jobs.map(job => {
      const result = this.createTicketFromJob(job);
      return {
        jobId: job.jobId,
        success: result.success,
        workOrderId: result.workOrder?.workOrderId,
        error: result.errors?.join(', '),
      };
    });

    return {
      total: results.length,
      successful: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length,
      results,
    };
  }

  // --- Upload Parsing ---

  parseWorkOrderUpload(fileData: string, format: 'csv' | 'json' = 'csv'): ParseUploadResult {
    const rows: ParsedUploadRow[] = [];

    if (format === 'json') {
      try {
        const parsed = JSON.parse(fileData);
        const items = Array.isArray(parsed) ? parsed : [parsed];
        items.forEach((item, index) => {
          const data = this.mapUploadRow(item);
          const validation = this.validateWorkOrder(data as CreateWorkOrderData);
          rows.push({ rowNumber: index + 1, data: data as Partial<WorkOrder>, validation });
        });
      } catch {
        return {
          totalRows: 0,
          validRows: 0,
          invalidRows: 0,
          rows: [{
            rowNumber: 1,
            data: {},
            validation: { valid: false, errors: ['Invalid JSON format'], warnings: [] },
          }],
        };
      }
    } else {
      // CSV parsing
      const lines = fileData.trim().split('\n');
      if (lines.length < 2) {
        return {
          totalRows: 0,
          validRows: 0,
          invalidRows: 0,
          rows: [{
            rowNumber: 1,
            data: {},
            validation: { valid: false, errors: ['CSV must have a header row and at least one data row'], warnings: [] },
          }],
        };
      }

      const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/"/g, ''));

      for (let i = 1; i < lines.length; i++) {
        const values = this.parseCSVLine(lines[i]);
        const record: Record<string, string> = {};
        headers.forEach((h, idx) => {
          record[h] = values[idx]?.trim().replace(/"/g, '') || '';
        });

        const data = this.mapUploadRow(record);
        const validation = this.validateWorkOrder(data as CreateWorkOrderData);
        rows.push({ rowNumber: i, data: data as Partial<WorkOrder>, validation });
      }
    }

    return {
      totalRows: rows.length,
      validRows: rows.filter(r => r.validation.valid).length,
      invalidRows: rows.filter(r => !r.validation.valid).length,
      rows,
    };
  }

  private parseCSVLine(line: string): string[] {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        inQuotes = !inQuotes;
      } else if (ch === ',' && !inQuotes) {
        result.push(current);
        current = '';
      } else {
        current += ch;
      }
    }
    result.push(current);
    return result;
  }

  private mapUploadRow(record: Record<string, string>): Partial<CreateWorkOrderData> {
    // Map common CSV/JSON field names to our format
    const customerName = record.customer_name || record.customerName || record.customer || '';
    const customerPhone = record.customer_phone || record.customerPhone || record.phone || '';
    const customerEmail = record.customer_email || record.customerEmail || record.email || '';
    const street = record.street || record.address || record.street_address || '';
    const city = record.city || '';
    const state = record.state || 'AL';
    const zip = record.zip || record.zipcode || record.zip_code || '';
    const type = (record.type || record.order_type || 'delivery') as WorkOrderType;
    const priority = (record.priority || 'normal') as WorkOrderPriority;
    const productName = record.product || record.product_name || record.material || '';
    const quantity = parseInt(record.quantity || record.qty || '0');
    const unit = record.unit || 'bundle';
    const unitPrice = parseFloat(record.unit_price || record.price || '0');
    const weight = parseFloat(record.weight || '0');
    const notes = record.notes || '';

    const materials: Omit<WorkOrderMaterial, 'id'>[] = [];
    if (productName) {
      const catalog = PRODUCT_CATALOG[productName];
      materials.push({
        productName,
        quantity: quantity || 1,
        unit: catalog?.unit || unit,
        unitPrice: unitPrice || catalog?.defaultPrice || 0,
        weight: weight || catalog?.weightPerUnit || 0,
      });
    }

    return {
      customerName,
      customerPhone,
      customerEmail,
      address: { street, city, state, zip },
      type: ['delivery', 'pickup', 'return', 'supplement'].includes(type) ? type : 'delivery',
      priority: ['low', 'normal', 'rush', 'urgent'].includes(priority) ? priority : 'normal',
      materials,
      notes,
    };
  }

  // --- Quick Actions ---

  approveWorkOrder(id: string, approvedBy: string): { success: boolean; error?: string } {
    const result = this.updateWorkOrderStatus(id, 'approved', approvedBy);
    return { success: result.success, error: result.error };
  }

  scheduleWorkOrder(
    id: string,
    scheduledDate: string,
    scheduledTime: string,
    driverName?: string,
    vehicleType?: string
  ): { success: boolean; error?: string } {
    const wo = this.getWorkOrderById(id);
    if (!wo) return { success: false, error: 'Work order not found' };

    wo.scheduledDate = scheduledDate;
    wo.scheduledTime = scheduledTime;
    if (driverName) wo.assignedDriver = driverName;
    if (vehicleType) wo.vehicleType = vehicleType;
    wo.updatedAt = new Date().toISOString();

    if (wo.status === 'approved') {
      return this.updateWorkOrderStatus(id, 'scheduled', 'System');
    }

    return { success: true };
  }

  assignDriver(id: string, driverName: string, vehicleType: string): { success: boolean; error?: string } {
    const wo = this.getWorkOrderById(id);
    if (!wo) return { success: false, error: 'Work order not found' };

    wo.assignedDriver = driverName;
    wo.vehicleType = vehicleType;
    wo.updatedAt = new Date().toISOString();
    return { success: true };
  }

  // --- JobNimbus Integration (READ-ONLY) ---

  async fetchJNJobs(filters?: { status?: string; rep?: string; limit?: number }): Promise<JNJobForConversion[]> {
    try {
      if (!isJobNimbusConfigured()) {
        console.warn('JobNimbus API key not configured, returning empty array');
        return [];
      }

      const result = await jobNimbusService.getJobs({ limit: filters?.limit || 50 });
      const jobs = result.results || [];

      // Map JN jobs to simplified shape for UI
      const mapped: JNJobForConversion[] = jobs.map((job: JobNimbusJob) => {
        // Try to parse material count from description
        let materialCount = 0;
        if (job.description) {
          // Look for lines that might be materials (e.g. "10 x Shingles" or "Shingles - 10")
          const lines = job.description.split('\n').filter((l: string) => l.trim());
          materialCount = lines.length;
        }

        // Format created_at timestamp (JN uses unix seconds)
        const createdAt = job.created_at
          ? new Date(job.created_at * 1000).toISOString().slice(0, 10)
          : '';

        return {
          jnid: job.jnid,
          jobNumber: job.number || '',
          jobName: job.name || '',
          customerName: job.name || 'Unknown Customer',
          address: job.address_line1 || '',
          city: job.city || '',
          state: job.state_text || 'AL',
          zip: job.zip || '',
          status: job.status || '',
          salesRep: job.sales_rep_name || '',
          createdAt,
          materialCount,
          estimateTotal: 0, // Will be populated if estimates are fetched separately
        };
      });

      // Apply optional filters
      let filtered = mapped;
      if (filters?.status) {
        const s = filters.status.toLowerCase();
        filtered = filtered.filter(j => j.status.toLowerCase().includes(s));
      }
      if (filters?.rep) {
        const r = filters.rep.toLowerCase();
        filtered = filtered.filter(j => j.salesRep.toLowerCase().includes(r));
      }

      return filtered;
    } catch (error) {
      console.error('Failed to fetch JN jobs:', error);
      return [];
    }
  }

  async fetchJNJobDetail(jobJnid: string): Promise<JNJobDetail> {
    if (!isJobNimbusConfigured()) {
      throw new Error('JobNimbus API key not configured');
    }

    // Fetch the job
    const job = await jobNimbusService.getJob(jobJnid);

    // Fetch contact info if the job has a primary contact
    let contact: JobNimbusContact | null = null;
    if (job.primary?.jnid) {
      try {
        contact = await jobNimbusService.getContact(job.primary.jnid);
      } catch (err) {
        console.warn(`Failed to fetch contact for job ${jobJnid}:`, err);
      }
    }

    // Fetch estimates for the contact (if we have one)
    let estimates: JobNimbusEstimate[] = [];
    if (contact?.jnid) {
      try {
        estimates = await jobNimbusService.getEstimatesForContact(contact.jnid);
      } catch (err) {
        console.warn(`Failed to fetch estimates for contact ${contact.jnid}:`, err);
      }
    }

    return { job, contact, estimates };
  }

  convertJNJobToWorkOrder(jnJob: JNJobDetail): Partial<WorkOrder> {
    const { job, contact, estimates } = jnJob;

    // Determine customer info from contact, falling back to job name
    const customerName = contact
      ? (contact.display_name || `${contact.first_name || ''} ${contact.last_name || ''}`.trim() || job.name || 'Unknown')
      : (job.name || 'Unknown');
    const customerPhone = contact
      ? (contact.mobile_phone || contact.home_phone || contact.work_phone || '')
      : '';
    const customerEmail = contact?.email || '';

    // Address from job first, then contact
    const street = job.address_line1 || contact?.address_line1 || '';
    const city = job.city || contact?.city || '';
    const state = job.state_text || contact?.state_text || 'AL';
    const zip = job.zip || contact?.zip || '';

    // Determine priority based on job age
    const createdAt = job.created_at ? new Date(job.created_at * 1000) : new Date();
    const ageInDays = Math.floor((Date.now() - createdAt.getTime()) / 86400000);
    let priority: WorkOrderPriority = 'normal';
    if (ageInDays > 30) priority = 'urgent';
    else if (ageInDays > 21) priority = 'rush';

    // Calculate estimate total
    const estimateTotal = estimates.reduce((sum, e) => sum + (e.total || e.amount || 0), 0);

    // Generate a new work order ID
    const workOrderId = generateWorkOrderId();

    return {
      workOrderId,
      jobId: job.number || job.jnid,
      customerName,
      customerPhone,
      customerEmail,
      address: { street, city, state, zip },
      type: 'delivery' as WorkOrderType,
      priority,
      materials: [], // Materials will need to be added manually - JN doesn't have structured material data
      scheduledDate: '',
      scheduledTime: '',
      notes: [
        job.description || '',
        job.status ? `JN Status: ${job.status}` : '',
        job.sales_rep_name ? `Sales Rep: ${job.sales_rep_name}` : '',
        estimateTotal > 0 ? `Estimate Total: $${estimateTotal.toLocaleString()}` : '',
      ].filter(Boolean).join('\n'),
      specialInstructions: '',
      assignedDriver: '',
      vehicleType: '',
      status: 'draft' as WorkOrderStatus,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: 'System (JN Import)',
      estimatedCost: estimateTotal || 0,
      actualCost: null,
      photos: [],
      documents: [],
      statusHistory: [],
    };
  }

  // --- Stats ---

  getStats(): Record<string, number> {
    const stats: Record<string, number> = {
      total: this.workOrders.length,
      draft: 0,
      submitted: 0,
      approved: 0,
      scheduled: 0,
      in_progress: 0,
      completed: 0,
      cancelled: 0,
    };
    this.workOrders.forEach(wo => {
      stats[wo.status] = (stats[wo.status] || 0) + 1;
    });
    return stats;
  }

  // --- Drivers ---

  getDrivers() {
    return MOCK_DRIVERS;
  }

  // --- Product Catalog ---

  getProductCatalog() {
    return Object.entries(PRODUCT_CATALOG).map(([name, info]) => ({
      productName: name,
      ...info,
    }));
  }

  // --- Sample CSV Template ---

  getSampleCSV(): string {
    return `customer_name,customer_phone,customer_email,street,city,state,zip,type,priority,product,quantity,unit,unit_price,notes
"Bobby Hargrove","(256) 301-8472","bhargrove@gmail.com","2914 Sandlin Rd SW","Decatur","AL","35603","delivery","normal","Architectural Shingles",30,"bundle",95,"Standard delivery"
"Tammy Richardson","(256) 722-9034","trichardson@yahoo.com","108 Shelton Rd","Madison","AL","35758","delivery","rush","3-Tab Shingles",25,"bundle",75,"Rush order - storm damage"`;
  }
}

// Export singleton
export const workOrderService = new WorkOrderService();
