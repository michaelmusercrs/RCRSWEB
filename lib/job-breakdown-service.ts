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
// GOOGLE SHEETS PERSISTENCE
// ============================================

import { googleSheetsService, type JobBreakdownRecord } from '@/lib/google-sheets-service';

/**
 * Serialize a full JobBreakdown to a flat Google Sheets record.
 * The full breakdown JSON is stored in materialsJson for round-trip fidelity.
 */
function toSheetRecord(b: JobBreakdown): JobBreakdownRecord {
  return {
    breakdownId: b.breakdownId,
    jobId: b.jobId,
    customerName: b.customerName,
    address: `${b.address.street}, ${b.address.city}, ${b.address.state} ${b.address.zip}`,
    rNumber: b.breakdownId,
    salesRep: b.createdBy,
    status: b.status,
    materialsJson: JSON.stringify(b),
    totals: JSON.stringify({
      materialTotal: b.materialTotal,
      laborTotal: b.laborTotal,
      deliveryFees: b.deliveryFees,
      overhead: b.overhead,
      profit: b.profit,
      totalEstimate: b.totalEstimate,
    }),
    createdAt: b.createdAt,
    updatedAt: b.updatedAt,
  };
}

/**
 * Deserialize a Google Sheets record back to a full JobBreakdown.
 */
function fromSheetRecord(record: JobBreakdownRecord): JobBreakdown | null {
  try {
    if (!record.materialsJson || record.materialsJson === '[]') return null;
    const breakdown = JSON.parse(record.materialsJson) as JobBreakdown;
    // Keep sheet columns as source of truth for mutable fields
    breakdown.status = (record.status || breakdown.status) as BreakdownStatus;
    breakdown.updatedAt = record.updatedAt || breakdown.updatedAt;
    return breakdown;
  } catch {
    return null;
  }
}

// ============================================
// SERVICE CLASS
// ============================================

class JobBreakdownService {
  private breakdowns: JobBreakdown[] = [];
  private nextId = 1;
  private loaded = false;

  // ── Load from Google Sheets ────────────────────────────────────────────

  private async ensureLoaded(): Promise<void> {
    if (this.loaded) return;
    this.loaded = true;
    try {
      const records = await googleSheetsService.getJobBreakdowns();
      const parsed: JobBreakdown[] = [];
      for (const record of records) {
        const bd = fromSheetRecord(record);
        if (bd) parsed.push(bd);
      }
      this.breakdowns = parsed;
      // Set nextId based on existing breakdown IDs
      if (parsed.length > 0) {
        const maxNum = parsed.reduce((max, b) => {
          const match = b.breakdownId.match(/JB-\d+-(\d+)/);
          return match ? Math.max(max, parseInt(match[1], 10)) : max;
        }, 0);
        this.nextId = maxNum + 1;
      }
    } catch (err) {
      console.error('Failed to load breakdowns from Google Sheets:', err);
      // Leave breakdowns empty - user sees empty state instead of mock data
    }
  }

  private async persistToSheet(breakdown: JobBreakdown): Promise<void> {
    try {
      const record = toSheetRecord(breakdown);
      // Try update first, then add if not found
      const updated = await googleSheetsService.updateJobBreakdown(breakdown.breakdownId, record);
      if (!updated) {
        await googleSheetsService.addJobBreakdown(record);
      }
    } catch (err) {
      console.error('Failed to persist breakdown to Google Sheets:', err);
    }
  }

  // ── Create ──────────────────────────────────────────────────────────────

  async createBreakdown(jobData: {
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
  }): Promise<JobBreakdown> {
    await this.ensureLoaded();
    const now = new Date().toISOString();
    const year = new Date().getFullYear();
    const breakdownId = `JB-${year}-${String(this.nextId++).padStart(4, '0')}`;

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
    await this.persistToSheet(breakdown);
    return breakdown;
  }

  // ── Update ──────────────────────────────────────────────────────────────

  async updateBreakdown(
    id: string,
    updates: Partial<Pick<JobBreakdown, 'materials' | 'labor' | 'notes' | 'estimatedStartDate' | 'estimatedEndDate' | 'deliveryFees'>>
  ): Promise<JobBreakdown | null> {
    await this.ensureLoaded();
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
    await this.persistToSheet(breakdown);

    return breakdown;
  }

  // ── Approve ─────────────────────────────────────────────────────────────

  async approveBreakdown(id: string, approvedBy: string): Promise<JobBreakdown | null> {
    await this.ensureLoaded();
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

    await this.persistToSheet(breakdown);
    return breakdown;
  }

  // ── Revise ──────────────────────────────────────────────────────────────

  async reviseBreakdown(
    id: string,
    revisions: {
      materials?: MaterialItem[];
      labor?: LaborItem[];
      notes?: string;
      revisedBy: string;
      revisionNotes: string;
    }
  ): Promise<JobBreakdown | null> {
    await this.ensureLoaded();
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
    await this.persistToSheet(breakdown);
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

  async getBreakdownStatus(id: string): Promise<{ status: BreakdownStatus; history: StatusHistoryEntry[] } | null> {
    await this.ensureLoaded();
    const breakdown = this.breakdowns.find(b => b.breakdownId === id);
    if (!breakdown) return null;
    return { status: breakdown.status, history: breakdown.statusHistory };
  }

  async updateStatus(id: string, status: BreakdownStatus, updatedBy: string, notes: string): Promise<JobBreakdown | null> {
    await this.ensureLoaded();
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

    await this.persistToSheet(breakdown);
    return breakdown;
  }

  // ── Compare Breakdowns ─────────────────────────────────────────────────

  async compareBreakdowns(id1: string, id2: string): Promise<BreakdownComparison[] | null> {
    await this.ensureLoaded();
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

  async exportBreakdown(id: string): Promise<BreakdownExport | null> {
    await this.ensureLoaded();
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

  async getBreakdown(id: string): Promise<JobBreakdown | null> {
    await this.ensureLoaded();
    return this.breakdowns.find(b => b.breakdownId === id) || null;
  }

  async getBreakdownsByJob(jobId: string): Promise<JobBreakdown[]> {
    await this.ensureLoaded();
    return this.breakdowns.filter(b => b.jobId === jobId);
  }

  async getAllBreakdowns(filters?: {
    status?: BreakdownStatus;
    projectType?: ProjectType;
    dateFrom?: string;
    dateTo?: string;
    search?: string;
  }): Promise<JobBreakdown[]> {
    await this.ensureLoaded();
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

  async getStatistics(): Promise<{
    total: number;
    pendingApproval: number;
    activeJobs: number;
    totalValue: number;
    byStatus: Record<BreakdownStatus, number>;
    byType: Record<string, number>;
    monthlyValues: { month: string; value: number }[];
  }> {
    await this.ensureLoaded();
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

    // Compute monthly values from real breakdown data grouped by creation month
    const monthMap = new Map<string, number>();
    all.forEach(b => {
      const d = new Date(b.createdAt);
      if (!isNaN(d.getTime())) {
        const key = d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
        monthMap.set(key, (monthMap.get(key) || 0) + b.totalEstimate);
      }
    });
    // Sort by date and take last 6 months
    const sortedMonths = Array.from(monthMap.entries())
      .sort((a, b) => new Date(a[0]).getTime() - new Date(b[0]).getTime())
      .slice(-6)
      .map(([month, value]) => ({ month, value: Math.round(value) }));

    return {
      total: all.length,
      pendingApproval: byStatus.pending_approval,
      activeJobs: byStatus.in_progress + byStatus.approved,
      totalValue: Math.round(all.reduce((s, b) => s + b.totalEstimate, 0) * 100) / 100,
      byStatus,
      byType,
      monthlyValues: sortedMonths,
    };
  }

  // ── JobNimbus READ-ONLY Integration ────────────────────────────────────

  /**
   * Fetch jobs from JobNimbus that can have breakdowns created.
   * READ-ONLY - does not write to JN.
   *
   * COST-PRIVACY: viewer threads to the underlying JN reads. Default
   * (undefined) => fail-safe redaction. Callers serving authenticated users
   * should pass viewerForRole(role).
   */
  async fetchJNJobsForBreakdown(filters?: { status?: string; limit?: number }, viewer?: import('./jn-redact').JNViewer): Promise<JNJobSummary[]> {
    if (!isJobNimbusConfigured()) {
      return [];
    }

    try {
      const limit = filters?.limit || 50;
      const result = await jobNimbusService.getJobs({ limit }, viewer);
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
        if (job.primary?.id) {
          try {
            const estimates = await jobNimbusService.getEstimatesForContact(job.primary.id, viewer);
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
   *
   * COST-PRIVACY: viewer threads to underlying JN reads. Breakdowns
   * legitimately need cost — owner/admin callers should pass viewerForRole
   * to preserve cost data; reps fall back to fail-safe redaction.
   */
  async fetchJNJobForBreakdown(jobJnid: string, viewer?: import('./jn-redact').JNViewer): Promise<JNBreakdownSource> {
    const job = await jobNimbusService.getJob(jobJnid, viewer);

    let contact: JobNimbusContact | null = null;
    let estimates: JobNimbusEstimate[] = [];

    // Fetch contact and estimates in parallel
    const contactJnid = job.primary?.id;
    if (contactJnid) {
      const [contactResult, estimatesResult] = await Promise.allSettled([
        jobNimbusService.getContact(contactJnid, viewer),
        jobNimbusService.getEstimatesForContact(contactJnid, viewer),
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
  async createBreakdownFromJNJob(jnData: JNBreakdownSource): Promise<JobBreakdown> {
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

    const breakdown = await this.createBreakdown({
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
    return await this.getAllBreakdowns({ search: query });
  }

  async getBreakdownsByRep(salesRep: string): Promise<JobBreakdown[]> {
    await this.ensureLoaded();
    return this.breakdowns.filter(b =>
      b.createdBy.toLowerCase().includes(salesRep.toLowerCase())
    );
  }
}

// ============================================
// SINGLETON EXPORT
// ============================================

export const jobBreakdownService = new JobBreakdownService();
