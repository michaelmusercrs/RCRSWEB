/**
 * RCRS Warranty Tracking Service
 *
 * Manages roof warranties, expiration tracking, and warranty claims.
 * Supports manufacturer, workmanship, extended, and leak-free guarantee warranties.
 *
 * Persistence: Google Sheets (Warranties tab) via google-sheets-service.
 * Claims are stored as a JSON blob on the warranty row.
 *
 * @author RCRS Development Team
 * @version 2.0.0
 */

import crypto from 'crypto';
import { googleSheetsService, SHEET_NAMES } from './google-sheets-service';

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
// SHEET SCHEMA
// =============================================================================

const WARRANTY_HEADERS: string[] = [
  'id',
  'customerId',
  'customerName',
  'customerPhone',
  'customerEmail',
  'address',
  'jobId',
  'jobNimbusId',
  'type',
  'manufacturer',
  'productLine',
  'startDate',
  'endDate',
  'durationYears',
  'status',
  'claims',
  'certificateUrl',
  'documents',
  'installedBy',
  'inspectedBy',
  'notes',
  'createdAt',
  'updatedAt',
];

// =============================================================================
// HELPERS
// =============================================================================

function generateId(prefix: string): string {
  return `${prefix}-${crypto.randomBytes(6).toString('hex')}`;
}

function safeJsonArray<T>(value: string): T[] {
  try {
    const parsed = value ? JSON.parse(value) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
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

// =============================================================================
// SERVICE CLASS
// =============================================================================

class WarrantyService {
  private cache: Warranty[] | null = null;
  private cacheExpiresAt = 0;
  private readonly CACHE_TTL_MS = 60_000;

  // ---------------------------------------------------------------------------
  // Sheet I/O
  // ---------------------------------------------------------------------------

  private parseRow(row: Record<string, string>): Warranty {
    return {
      id: row.id || '',
      customerId: row.customerId || '',
      customerName: row.customerName || '',
      customerPhone: row.customerPhone || '',
      customerEmail: row.customerEmail || '',
      address: row.address || '',
      jobId: row.jobId || '',
      jobNimbusId: row.jobNimbusId || undefined,
      type: (row.type as Warranty['type']) || 'manufacturer',
      manufacturer: row.manufacturer || undefined,
      productLine: row.productLine || undefined,
      startDate: row.startDate || '',
      endDate: row.endDate || '',
      durationYears: Number(row.durationYears) || 0,
      status: (row.status as Warranty['status']) || 'active',
      claims: safeJsonArray<WarrantyClaim>(row.claims),
      certificateUrl: row.certificateUrl || undefined,
      documents: safeJsonArray<{ name: string; url: string; uploadedAt: string }>(row.documents),
      installedBy: row.installedBy || '',
      inspectedBy: row.inspectedBy || undefined,
      notes: row.notes || '',
      createdAt: row.createdAt || '',
      updatedAt: row.updatedAt || '',
    };
  }

  private async loadFromSheet(): Promise<Warranty[]> {
    const rows = await googleSheetsService.getGenericRows(
      SHEET_NAMES.WARRANTIES,
      WARRANTY_HEADERS,
    );
    return rows.map(r => this.parseRow(r));
  }

  private async loadCached(): Promise<Warranty[]> {
    if (this.cache && Date.now() < this.cacheExpiresAt) return this.cache;
    this.cache = await this.loadFromSheet();
    this.cacheExpiresAt = Date.now() + this.CACHE_TTL_MS;
    return this.cache;
  }

  private invalidateCache(): void {
    this.cache = null;
    this.cacheExpiresAt = 0;
  }

  private async upsert(warranty: Warranty): Promise<void> {
    await googleSheetsService.upsertGenericRow(
      SHEET_NAMES.WARRANTIES,
      WARRANTY_HEADERS,
      'id',
      warranty as unknown as Record<string, unknown>,
    );
    this.invalidateCache();
  }

  /**
   * Refresh statuses for a list of warranties, persisting any that changed.
   */
  private async refreshStatuses(warranties: Warranty[]): Promise<void> {
    for (const w of warranties) {
      const newStatus = computeStatus(w);
      if (w.status !== newStatus) {
        w.status = newStatus;
        w.updatedAt = new Date().toISOString();
        await this.upsert(w);
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Warranty CRUD
  // ---------------------------------------------------------------------------

  async createWarranty(input: {
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
  }): Promise<Warranty> {
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

    await this.upsert(warranty);
    return warranty;
  }

  async getWarranty(id: string): Promise<Warranty | null> {
    const all = await this.loadCached();
    await this.refreshStatuses(all);
    return all.find(w => w.id === id) || null;
  }

  async getWarrantiesByCustomer(customerId: string): Promise<Warranty[]> {
    const all = await this.loadCached();
    await this.refreshStatuses(all);
    return all.filter(w => w.customerId === customerId);
  }

  async updateWarranty(
    id: string,
    updates: Partial<Omit<Warranty, 'id' | 'claims' | 'createdAt'>>,
  ): Promise<Warranty | null> {
    const warranty = await this.getWarranty(id);
    if (!warranty) return null;

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
    await this.upsert(warranty);
    return warranty;
  }

  async archiveWarranty(id: string): Promise<boolean> {
    const warranty = await this.getWarranty(id);
    if (!warranty) return false;

    warranty.status = 'voided';
    warranty.updatedAt = new Date().toISOString();
    await this.upsert(warranty);
    return true;
  }

  // ---------------------------------------------------------------------------
  // Search & Filtering
  // ---------------------------------------------------------------------------

  async searchWarranties(query: {
    search?: string;
    status?: string;
    type?: string;
    manufacturer?: string;
    customerId?: string;
    expiringDays?: number;
  }): Promise<Warranty[]> {
    const all = await this.loadCached();
    await this.refreshStatuses(all);

    let results = [...all];

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

  async getExpiringWarranties(daysAhead: number = 30): Promise<Warranty[]> {
    return this.searchWarranties({ expiringDays: daysAhead });
  }

  async getAllWarranties(): Promise<Warranty[]> {
    const all = await this.loadCached();
    await this.refreshStatuses(all);
    return all;
  }

  // ---------------------------------------------------------------------------
  // Claims
  // ---------------------------------------------------------------------------

  async submitClaim(warrantyId: string, claimInput: {
    issueDescription: string;
    category: WarrantyClaim['category'];
    severity: WarrantyClaim['severity'];
    photos?: string[];
    notes?: string;
  }): Promise<WarrantyClaim | null> {
    const warranty = await this.getWarranty(warrantyId);
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
    await this.upsert(warranty);
    return claim;
  }

  async getClaimsForWarranty(warrantyId: string): Promise<WarrantyClaim[]> {
    const warranty = await this.getWarranty(warrantyId);
    if (!warranty) return [];
    return [...warranty.claims].sort((a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  async updateClaimStatus(
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
  ): Promise<WarrantyClaim | null> {
    const warranty = await this.getWarranty(warrantyId);
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
    await this.upsert(warranty);
    return claim;
  }

  // ---------------------------------------------------------------------------
  // Stats
  // ---------------------------------------------------------------------------

  async getWarrantyStats(): Promise<WarrantyStats> {
    const all = await this.loadCached();
    await this.refreshStatuses(all);

    const allClaims = all.flatMap(w => w.claims);

    return {
      active: all.filter(w => w.status === 'active').length,
      expiringSoon: all.filter(w => w.status === 'expiring_soon').length,
      expired: all.filter(w => w.status === 'expired').length,
      totalClaims: allClaims.length,
      openClaims: allClaims.filter(c =>
        ['submitted', 'under_review', 'approved'].includes(c.status)
      ).length,
      totalProtectedValue: all.filter(w =>
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
