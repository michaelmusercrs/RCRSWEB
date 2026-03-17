/**
 * RCRS Warranty Tracking Service
 *
 * Manages roof warranties, expiration tracking, and warranty claims.
 * Supports manufacturer, workmanship, extended, and leak-free guarantee warranties.
 *
 * Data stored in data/warranties.json
 *
 * @author RCRS Development Team
 * @version 1.0.0
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

// =============================================================================
// TYPES
// =============================================================================

export interface Warranty {
  id: string;
  customerId: string;
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  address: string;
  jobId: string;
  jobNimbusId?: string;

  // Warranty details
  type: 'manufacturer' | 'workmanship' | 'extended' | 'leak_free';
  manufacturer?: string;
  productLine?: string;
  startDate: string;
  endDate: string;
  durationYears: number;

  // Status
  status: 'active' | 'expiring_soon' | 'expired' | 'claimed' | 'voided';

  // Claims
  claims: WarrantyClaim[];

  // Documents
  certificateUrl?: string;
  documents: { name: string; url: string; uploadedAt: string }[];

  // Metadata
  installedBy: string;
  inspectedBy?: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export interface WarrantyClaim {
  id: string;
  warrantyId: string;
  claimDate: string;
  issueDescription: string;
  category: 'leak' | 'shingle_damage' | 'flashing' | 'gutter' | 'ventilation' | 'other';
  severity: 'minor' | 'moderate' | 'major' | 'emergency';
  status: 'submitted' | 'under_review' | 'approved' | 'denied' | 'completed';
  resolution?: string;
  repairDate?: string;
  repairCost?: number;
  coveredByWarranty: boolean;
  photos: string[];
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export interface WarrantyStats {
  active: number;
  expiringSoon: number;
  expired: number;
  totalClaims: number;
  openClaims: number;
  totalProtectedValue: number;
}

interface WarrantyData {
  warranties: Warranty[];
  lastUpdated: string;
}

// =============================================================================
// CONSTANTS
// =============================================================================

const WARRANTY_TYPE_LABELS: Record<string, string> = {
  manufacturer: 'Manufacturer',
  workmanship: 'Workmanship',
  extended: 'Extended',
  leak_free: 'Leak-Free Guarantee',
};

const MANUFACTURER_LIST = [
  'GAF',
  'Owens Corning',
  'CertainTeed',
  'IKO',
  'Atlas',
  'Tamko',
  'Malarkey',
  'Boral',
  'DaVinci',
  'DECRA',
];

const EXPIRING_SOON_DAYS = 90; // Flag warranties expiring within 90 days

// =============================================================================
// DATA HELPERS
// =============================================================================

const DATA_FILE_PATH = path.join(process.cwd(), 'data', 'warranties.json');

function readData(): WarrantyData {
  try {
    if (fs.existsSync(DATA_FILE_PATH)) {
      const content = fs.readFileSync(DATA_FILE_PATH, 'utf-8');
      return JSON.parse(content);
    }
  } catch (error) {
    console.error('[WarrantyService] Error reading data:', error);
  }
  return { warranties: [], lastUpdated: new Date().toISOString() };
}

function writeData(data: WarrantyData): void {
  try {
    const dir = path.dirname(DATA_FILE_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    data.lastUpdated = new Date().toISOString();
    fs.writeFileSync(DATA_FILE_PATH, JSON.stringify(data, null, 2));
  } catch (error) {
    console.error('[WarrantyService] Error writing data:', error);
    throw error;
  }
}

function generateId(prefix: string): string {
  return `${prefix}-${crypto.randomBytes(6).toString('hex')}`;
}

/**
 * Compute the real-time status of a warranty based on dates and claims.
 */
function computeStatus(warranty: Warranty): Warranty['status'] {
  if (warranty.status === 'voided') return 'voided';

  const now = new Date();
  const endDate = new Date(warranty.endDate);
  const daysUntilExpiry = Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

  if (daysUntilExpiry < 0) return 'expired';

  const hasOpenClaims = warranty.claims.some(c =>
    ['submitted', 'under_review', 'approved'].includes(c.status)
  );
  if (hasOpenClaims) return 'claimed';

  if (daysUntilExpiry <= EXPIRING_SOON_DAYS) return 'expiring_soon';

  return 'active';
}

/**
 * Refresh statuses on all warranties in-place and persist if any changed.
 */
function refreshStatuses(data: WarrantyData): void {
  let changed = false;
  for (const w of data.warranties) {
    const newStatus = computeStatus(w);
    if (w.status !== newStatus) {
      w.status = newStatus;
      w.updatedAt = new Date().toISOString();
      changed = true;
    }
  }
  if (changed) writeData(data);
}

// =============================================================================
// SERVICE CLASS
// =============================================================================

class WarrantyService {
  // ---------------------------------------------------------------------------
  // Warranty CRUD
  // ---------------------------------------------------------------------------

  createWarranty(input: {
    customerId: string;
    customerName: string;
    customerPhone: string;
    customerEmail: string;
    address: string;
    jobId: string;
    jobNimbusId?: string;
    type: Warranty['type'];
    manufacturer?: string;
    productLine?: string;
    startDate: string;
    durationYears: number;
    installedBy: string;
    inspectedBy?: string;
    notes?: string;
    certificateUrl?: string;
  }): Warranty {
    const data = readData();
    const now = new Date().toISOString();

    const startDate = new Date(input.startDate);
    const endDate = new Date(startDate);
    // Handle "lifetime" as 50 years
    const years = input.durationYears >= 99 ? 50 : input.durationYears;
    endDate.setFullYear(endDate.getFullYear() + years);

    const warranty: Warranty = {
      id: generateId('WRN'),
      customerId: input.customerId,
      customerName: input.customerName,
      customerPhone: input.customerPhone,
      customerEmail: input.customerEmail,
      address: input.address,
      jobId: input.jobId,
      jobNimbusId: input.jobNimbusId,
      type: input.type,
      manufacturer: input.manufacturer,
      productLine: input.productLine,
      startDate: input.startDate,
      endDate: endDate.toISOString().split('T')[0],
      durationYears: input.durationYears,
      status: 'active',
      claims: [],
      certificateUrl: input.certificateUrl,
      documents: [],
      installedBy: input.installedBy,
      inspectedBy: input.inspectedBy,
      notes: input.notes || '',
      createdAt: now,
      updatedAt: now,
    };

    // Compute initial status
    warranty.status = computeStatus(warranty);

    data.warranties.unshift(warranty);
    writeData(data);
    return warranty;
  }

  getWarranty(id: string): Warranty | null {
    const data = readData();
    refreshStatuses(data);
    return data.warranties.find(w => w.id === id) || null;
  }

  getWarrantiesByCustomer(customerId: string): Warranty[] {
    const data = readData();
    refreshStatuses(data);
    return data.warranties.filter(w => w.customerId === customerId);
  }

  updateWarranty(id: string, updates: Partial<Omit<Warranty, 'id' | 'claims' | 'createdAt'>>): Warranty | null {
    const data = readData();
    const idx = data.warranties.findIndex(w => w.id === id);
    if (idx < 0) return null;

    const warranty = data.warranties[idx];
    const allowed: (keyof typeof updates)[] = [
      'customerName', 'customerPhone', 'customerEmail', 'address',
      'jobId', 'jobNimbusId', 'type', 'manufacturer', 'productLine',
      'startDate', 'endDate', 'durationYears', 'status',
      'certificateUrl', 'documents', 'installedBy', 'inspectedBy', 'notes',
    ];

    for (const key of allowed) {
      if (updates[key] !== undefined) {
        (warranty as any)[key] = updates[key];
      }
    }

    // Recalculate end date if start or duration changed
    if (updates.startDate || updates.durationYears) {
      const start = new Date(warranty.startDate);
      const years = warranty.durationYears >= 99 ? 50 : warranty.durationYears;
      const end = new Date(start);
      end.setFullYear(end.getFullYear() + years);
      warranty.endDate = end.toISOString().split('T')[0];
    }

    warranty.status = computeStatus(warranty);
    warranty.updatedAt = new Date().toISOString();
    data.warranties[idx] = warranty;
    writeData(data);
    return warranty;
  }

  archiveWarranty(id: string): boolean {
    const data = readData();
    const idx = data.warranties.findIndex(w => w.id === id);
    if (idx < 0) return false;

    data.warranties[idx].status = 'voided';
    data.warranties[idx].updatedAt = new Date().toISOString();
    writeData(data);
    return true;
  }

  // ---------------------------------------------------------------------------
  // Search & Filtering
  // ---------------------------------------------------------------------------

  searchWarranties(query: {
    search?: string;
    status?: string;
    type?: string;
    manufacturer?: string;
    customerId?: string;
    expiringDays?: number;
  }): Warranty[] {
    const data = readData();
    refreshStatuses(data);

    let results = [...data.warranties];

    if (query.customerId) {
      results = results.filter(w => w.customerId === query.customerId);
    }

    if (query.status) {
      results = results.filter(w => w.status === query.status);
    }

    if (query.type) {
      results = results.filter(w => w.type === query.type);
    }

    if (query.manufacturer) {
      results = results.filter(w =>
        w.manufacturer?.toLowerCase() === query.manufacturer!.toLowerCase()
      );
    }

    if (query.expiringDays !== undefined) {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() + query.expiringDays);
      results = results.filter(w => {
        const end = new Date(w.endDate);
        return end <= cutoff && end >= new Date();
      });
    }

    if (query.search) {
      const q = query.search.toLowerCase();
      results = results.filter(w =>
        w.customerName.toLowerCase().includes(q) ||
        w.address.toLowerCase().includes(q) ||
        w.manufacturer?.toLowerCase().includes(q) ||
        w.jobId.toLowerCase().includes(q) ||
        w.id.toLowerCase().includes(q)
      );
    }

    return results.sort((a, b) =>
      new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );
  }

  getExpiringWarranties(daysAhead: number = 30): Warranty[] {
    return this.searchWarranties({ expiringDays: daysAhead });
  }

  getAllWarranties(): Warranty[] {
    const data = readData();
    refreshStatuses(data);
    return data.warranties;
  }

  // ---------------------------------------------------------------------------
  // Claims
  // ---------------------------------------------------------------------------

  submitClaim(warrantyId: string, claimInput: {
    issueDescription: string;
    category: WarrantyClaim['category'];
    severity: WarrantyClaim['severity'];
    photos?: string[];
    notes?: string;
  }): WarrantyClaim | null {
    const data = readData();
    const warranty = data.warranties.find(w => w.id === warrantyId);
    if (!warranty) return null;

    const now = new Date().toISOString();
    const claim: WarrantyClaim = {
      id: generateId('CLM'),
      warrantyId,
      claimDate: now.split('T')[0],
      issueDescription: claimInput.issueDescription,
      category: claimInput.category,
      severity: claimInput.severity,
      status: 'submitted',
      coveredByWarranty: warranty.status !== 'expired' && warranty.status !== 'voided',
      photos: claimInput.photos || [],
      notes: claimInput.notes || '',
      createdAt: now,
      updatedAt: now,
    };

    warranty.claims.push(claim);
    warranty.status = computeStatus(warranty);
    warranty.updatedAt = now;
    writeData(data);
    return claim;
  }

  getClaimsForWarranty(warrantyId: string): WarrantyClaim[] {
    const data = readData();
    const warranty = data.warranties.find(w => w.id === warrantyId);
    if (!warranty) return [];
    return warranty.claims.sort((a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  updateClaimStatus(
    warrantyId: string,
    claimId: string,
    updates: {
      status?: WarrantyClaim['status'];
      resolution?: string;
      repairDate?: string;
      repairCost?: number;
      coveredByWarranty?: boolean;
      notes?: string;
    }
  ): WarrantyClaim | null {
    const data = readData();
    const warranty = data.warranties.find(w => w.id === warrantyId);
    if (!warranty) return null;

    const claim = warranty.claims.find(c => c.id === claimId);
    if (!claim) return null;

    if (updates.status) claim.status = updates.status;
    if (updates.resolution !== undefined) claim.resolution = updates.resolution;
    if (updates.repairDate !== undefined) claim.repairDate = updates.repairDate;
    if (updates.repairCost !== undefined) claim.repairCost = updates.repairCost;
    if (updates.coveredByWarranty !== undefined) claim.coveredByWarranty = updates.coveredByWarranty;
    if (updates.notes !== undefined) claim.notes = updates.notes;
    claim.updatedAt = new Date().toISOString();

    warranty.status = computeStatus(warranty);
    warranty.updatedAt = new Date().toISOString();
    writeData(data);
    return claim;
  }

  // ---------------------------------------------------------------------------
  // Stats
  // ---------------------------------------------------------------------------

  getWarrantyStats(): WarrantyStats {
    const data = readData();
    refreshStatuses(data);

    const warranties = data.warranties;
    const allClaims = warranties.flatMap(w => w.claims);

    return {
      active: warranties.filter(w => w.status === 'active').length,
      expiringSoon: warranties.filter(w => w.status === 'expiring_soon').length,
      expired: warranties.filter(w => w.status === 'expired').length,
      totalClaims: allClaims.length,
      openClaims: allClaims.filter(c =>
        ['submitted', 'under_review', 'approved'].includes(c.status)
      ).length,
      totalProtectedValue: warranties.filter(w =>
        w.status === 'active' || w.status === 'expiring_soon' || w.status === 'claimed'
      ).length * 15000, // Rough average roof value
    };
  }
}

// =============================================================================
// EXPORTS
// =============================================================================

export const warrantyService = new WarrantyService();
export { WARRANTY_TYPE_LABELS, MANUFACTURER_LIST, EXPIRING_SOON_DAYS };
