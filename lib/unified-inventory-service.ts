/**
 * Unified Inventory Management Service
 * 
 * THE single source of truth for all inventory operations at RCRS.
 * Consolidates 4 previously disconnected systems into one.
 * 
 * Canonical ID format: INV-XXXX
 * Persistence: Google Sheets ('Inventory' tab)
 * 
 * Features:
 * - Unified product catalog with legacy ID mapping
 * - Google Sheets persistence (read/write)
 * - Stock deduction on delivery confirmation
 * - Weekly count sessions with photo verification
 * - Restock order management
 * - Pricing verification and margin analysis
 * - Transaction logging
 * - Material hold system for pending orders
 * - Return ticket tracking
 */

import { GoogleSpreadsheet, GoogleSpreadsheetRow, GoogleSpreadsheetWorksheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';

// ============================================
// CONFIGURATION
// ============================================

const SHEETS_ID = process.env.DELIVERY_SHEETS_ID || process.env.GOOGLE_SHEETS_ID;
const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n')?.replace(/\r\n/g, '\n');
const serviceAuth = new JWT({
  email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
  key: privateKey,
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});
const SHEETS_CONFIGURED = !!(SHEETS_ID && process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL && privateKey);

const SHEET_TABS = {
  // Product catalog (definitions + current qty + pricing). This is WHERE
  // _persistItem writes. Was previously set to 'Inventory' which is the
  // TRANSACTION log tab — that's why pricing updates weren't saving.
  INVENTORY: 'Inventory_Products',
  TRANSACTIONS: 'InventoryTransactions',
  COUNT_SESSIONS: 'CountSessions',
  COUNT_RECORDS: 'CountRecords',
  RESTOCK_ORDERS: 'RestockOrders',
  RESTOCK_ITEMS: 'RestockItems',
  PRICING_HISTORY: 'PricingHistory',
  MATERIAL_HOLDS: 'MaterialHolds',
  RETURN_TICKETS: 'ReturnTickets',
  // Audit log — every state-changing inventory mutation gets a row here.
  // Was previously orphaned (defined in google-sheets-service but never written).
  INVENTORY_LOGS: 'InventoryLogs',
};

// ============================================
// TYPES
// ============================================

export type InventoryCategory =
  | 'shingles'
  | 'underlayment'
  | 'flashing'
  | 'gutters'
  | 'nails_fasteners'
  | 'sealants'
  | 'lumber'
  | 'ventilation'
  | 'accessories'
  | 'safety_equipment';

export const CATEGORY_LABELS: Record<InventoryCategory, string> = {
  shingles: 'Shingles',
  underlayment: 'Underlayment',
  flashing: 'Flashing',
  gutters: 'Gutters',
  nails_fasteners: 'Nails & Fasteners',
  sealants: 'Sealants',
  lumber: 'Lumber',
  ventilation: 'Ventilation',
  accessories: 'Accessories',
  safety_equipment: 'Safety Equipment',
};

export interface InventoryItem {
  productId: string;        // Canonical: INV-XXXX
  legacyId?: string;        // Old item-XXX or SKU-based ID
  legacySku?: string;       // Old SKU like NAIL-125-EG
  productName: string;
  description: string;
  category: InventoryCategory;
  sku: string;
  unit: string;
  currentQty: number;
  holdQty: number;          // Qty held for pending orders
  availableQty: number;     // currentQty - holdQty
  minStockLevel: number;
  maxStockLevel: number;
  reorderQty: number;
  /**
   * Trigger threshold for auto-restock. When `currentQty < reorderPoint`,
   * the item is flagged in getLowStock and a draft PO is auto-generated
   * by ensureRestockDrafts() (Phase 4). When 0 or unset, falls back to
   * minStockLevel for backward compatibility.
   */
  reorderPoint?: number;
  /** Optional vendor id from the Vendors sheet — auto-PO targets this vendor. */
  preferredVendorId?: string;
  unitCost: number;         // Purchase price (INTERNAL ONLY)
  unitPrice: number;        // Final/selling price
  supplier: string;
  supplierPartNumber: string;
  location: string;
  weight: number;
  lastCountDate: string;
  lastCountBy: string;
  lastRestockDate: string;
  notes: string;
  active: boolean;
}

export interface InventoryTransaction {
  transactionId: string;
  productId: string;
  productName: string;
  type: 'delivery' | 'restock' | 'return' | 'adjustment' | 'count' | 'hold' | 'release' | 'write_off';
  quantity: number;          // Positive for additions, negative for deductions
  referenceId: string;       // Order ID, ticket ID, count session ID, etc.
  referenceType: string;     // 'material_order', 'return_ticket', 'count_session', 'manual'
  performedBy: string;
  performedByName: string;
  timestamp: string;
  notes: string;
  previousQty: number;
  newQty: number;
  unitCost?: number;
  unitPrice?: number;
}

export type CountSessionType = 'full' | 'cycle' | 'item';

export interface CountSession {
  sessionId: string;
  startedAt: string;
  startedBy: string;
  startedByName: string;
  status: 'in_progress' | 'completed' | 'cancelled';
  /**
   * Phase 4:
   *   - 'full'  = weekly all-SKU count (legacy default)
   *   - 'cycle' = system-scheduled N random items (e.g. 5-10 per week)
   *   - 'item'  = single-SKU on-demand count
   * Legacy rows without a value are treated as 'full'.
   */
  countSessionType?: CountSessionType;
  /** For 'cycle' and 'item' sessions: the productIds in scope. */
  scopedProductIds?: string[];
  completedAt?: string;
  totalItems: number;
  countedItems: number;
  discrepancies: number;
  resolvedDiscrepancies: number;
  photoUrl?: string;
  notes?: string;
}

export interface CountRecord {
  recordId: string;
  sessionId: string;
  productId: string;
  productName: string;
  systemQty: number;
  countedQty: number;
  discrepancy: number;
  countedBy: string;
  countedByName: string;
  countedAt: string;
  photoUrl?: string;
  notes?: string;
  resolved: boolean;
  resolution?: 'adjust_system' | 'recount' | 'write_off' | 'no_action';
  adjustedQty?: number;
  resolvedBy?: string;
  resolvedAt?: string;
  reason?: 'damaged' | 'miscount' | 'theft' | 'received_not_logged' | 'used_not_logged' | 'other';
}

export type RestockOrderStatus = 'draft' | 'submitted' | 'approved' | 'ordered' | 'shipped' | 'received' | 'cancelled';

export interface RestockOrder {
  orderId: string;
  supplier: string;
  status: RestockOrderStatus;
  items: RestockOrderItem[];
  totalCost: number;
  createdAt: string;
  createdBy: string;
  createdByName: string;
  approvedBy?: string;
  approvedAt?: string;
  orderedAt?: string;
  shippedAt?: string;
  receivedAt?: string;
  receivedBy?: string;
  receivedByName?: string;
  /** Count-verification step: warehouse confirmed physical counts. */
  countVerifiedAt?: string;
  countVerifiedBy?: string;
  /** Cost-verification step: supplier invoice reconciled against quoted costs. */
  costVerifiedAt?: string;
  costVerifiedBy?: string;
  /** Sum of (actualUnitCost ?? unitCost) * receivedQty across items. */
  actualTotalCost?: number;
  expectedDelivery?: string;
  notes?: string;
}

export interface RestockOrderItem {
  productId: string;
  productName: string;
  sku: string;
  orderQty: number;
  unitCost: number;
  totalCost: number;
  receivedQty?: number;
  receivedAt?: string;
  /** Actual unit cost from supplier invoice. When set and ≠ unitCost,
   *  inventory.unitCost is updated and a PricingRecord is written. */
  actualUnitCost?: number;
  /** True when receivedQty === orderQty at receive time. */
  countMatchesOrder?: boolean;
  /** True when actualUnitCost === unitCost (or actualUnitCost not provided). */
  costMatchesQuote?: boolean;
}

export interface PricingRecord {
  recordId: string;
  productId: string;
  productName: string;
  date: string;
  oldCost: number;
  newCost: number;
  oldPrice: number;
  newPrice: number;
  changedBy: string;
  reason?: string;
}

export interface MaterialHold {
  holdId: string;
  productId: string;
  productName: string;
  quantity: number;
  orderId: string;
  orderType: string;
  createdAt: string;
  createdBy: string;
  status: 'active' | 'fulfilled' | 'released';
  fulfilledAt?: string;
  releasedAt?: string;
  // Set when the hold is fulfilled — tracks partial deliveries.
  // fulfilledQty + unfulfilledQty should always equal `quantity`.
  fulfilledQty?: number;
  unfulfilledQty?: number;
}

export type ReturnType = 'return_to_warehouse' | 'return_to_distributor';
export type ReturnStatus = 'created' | 'picked_up' | 'in_transit' | 'received' | 'credited' | 'completed' | 'cancelled';

export interface ReturnTicket {
  ticketId: string;
  type: ReturnType;
  status: ReturnStatus;
  orderId?: string;
  jobId?: string;
  jobName?: string;
  items: ReturnItem[];
  distributor?: string;         // For return_to_distributor
  creditMemoNumber?: string;
  creditAmount?: number;
  createdAt: string;
  createdBy: string;
  createdByName: string;
  pickupPhotos: string[];
  transitPhotos: string[];
  deliveryPhotos: string[];
  gpsPickup?: string;
  gpsDelivery?: string;
  notes: string;
  completedAt?: string;
}

export interface ReturnItem {
  productId: string;
  productName: string;
  quantity: number;
  unitCost: number;
  unitPrice: number;
  reason: string;
}

export type AlertSeverity = 'warning' | 'critical' | 'out_of_stock';

export interface StockAlert {
  productId: string;
  productName: string;
  category: InventoryCategory;
  currentQty: number;
  availableQty: number;
  minStockLevel: number;
  severity: AlertSeverity;
  daysUntilStockout: number;
  location: string;
  supplier: string;
}

export interface InventoryFilters {
  category?: InventoryCategory;
  search?: string;
  lowStock?: boolean;
  outOfStock?: boolean;
  supplier?: string;
  location?: string;
  active?: boolean;
}

export interface PricingReport {
  productId: string;
  productName: string;
  category: InventoryCategory;
  unitCost: number;
  unitPrice: number;
  markup: number;
  marginPercent: number;
  flag?: 'negative_margin' | 'low_markup' | 'high_markup';
}

// ============================================
// LEGACY ID MAPPING
// ============================================

// Maps old system IDs to canonical INV-XXXX IDs
const LEGACY_ID_MAP: Record<string, string> = {
  // System 1 (inventoryData.ts) item-XXX â†’ INV-XXXX
  'item-123': 'INV-0012',   // 1 1/4 EG Nails
  'item-124': 'INV-0013',   // Bottom Caps (plastic)
  'item-125': 'INV-0014',   // RCRS Syn Felt
  'item-126': 'INV-0015',   // Ice & Water Shield
  'item-127': 'INV-0016',   // Ridge Vent 4LF
  'item-128': 'INV-0017',   // 1 1/2" Black Bullet Boot
  'item-129': 'INV-0018',   // 2" Black Bullet Boot
  'item-130': 'INV-0019',   // 3" Black Bullet Boot
  'item-131': 'INV-0020',   // 4" Black Bullet Boot
  'item-132': 'INV-0021',   // Sealant
  'item-133': 'INV-0022',   // Zipper Boot
  // System 3 (data/inventory.json) SKU-based â†’ INV-XXXX
  'NAIL-125-EG': 'INV-0012',
  'FELT-SYN-10': 'INV-0014',
  'ICE-WATER-2': 'INV-0015',
  'SEAL-TUBE': 'INV-0021',
  'BOOT-ZIP': 'INV-0022',
  'BOOT-BLK-15': 'INV-0017',
  'BOOT-BLK-2': 'INV-0018',
  'BOOT-BLK-3': 'INV-0019',
  'BOOT-BLK-4': 'INV-0020',
  'CAP-PLST': 'INV-0013',
  'VENT-RIDGE-4': 'INV-0016',
};

// Reverse map for looking up canonical ID from any legacy ID
export function resolveProductId(id: string): string {
  if (id.startsWith('INV-')) return id;
  return LEGACY_ID_MAP[id] || id;
}

export function getLegacyIds(canonicalId: string): string[] {
  return Object.entries(LEGACY_ID_MAP)
    .filter(([, v]) => v === canonicalId)
    .map(([k]) => k);
}

// ============================================
// UNIFIED PRODUCT CATALOG
// ============================================

function mapCategoryString(cat: string): InventoryCategory {
  const lower = cat.toLowerCase();
  if (lower.includes('shingle')) return 'shingles';
  if (lower.includes('underlayment') || lower.includes('felt')) return 'underlayment';
  if (lower.includes('flash') || lower.includes('boot') || lower.includes('drip')) return 'flashing';
  if (lower.includes('gutter')) return 'gutters';
  if (lower.includes('fastener') || lower.includes('nail') || lower.includes('screw') || lower.includes('stapl')) return 'nails_fasteners';
  if (lower.includes('sealant') || lower.includes('caulk') || lower.includes('adhesive')) return 'sealants';
  if (lower.includes('lumber') || lower.includes('wood') || lower.includes('plywood') || lower.includes('osb')) return 'lumber';
  if (lower.includes('vent') || lower.includes('ridge')) return 'ventilation';
  if (lower.includes('safety') || lower.includes('harness') || lower.includes('rope')) return 'safety_equipment';
  return 'accessories';
}

// The canonical catalog â€” all 38+ items merged from all systems
// ═══════════════════════════════════════════════════════════════════════
// REAL INVENTORY — sourced from data/inventory-import/inventory-source.xlsx
// These are the ONLY items RCRS actually stocks in the warehouse.
// DO NOT add fake/placeholder items. If new stock arrives, Rick enters
// it via /portal/inventory/restock which calls addStock().
// ═══════════════════════════════════════════════════════════════════════
const UNIFIED_CATALOG: Omit<InventoryItem, 'availableQty'>[] = [
  // ═══ REAL RCRS INVENTORY — 11 items from inventory-source.xlsx ═══
  // Costs and prices are REAL from Michael's spreadsheet. Quantities are
  // starting values; the Sheets tab is the live source once seeded.
  // DO NOT ADD FAKE ITEMS. New stock goes through /portal/inventory/restock.
  // Quantities computed from 1991 transaction rows in inventory-source.xlsx
  { productId: 'INV-0001', legacyId: 'item-123', legacySku: 'NAIL-125-EG', productName: '1 1/4 EG Nails', description: '15-18 Sq. per box', category: 'nails_fasteners', sku: 'NAIL-125-EG', unit: 'box', currentQty: 44, holdQty: 0, minStockLevel: 10, maxStockLevel: 100, reorderQty: 30, reorderPoint: 0, unitCost: 27.50, unitPrice: 64.90, supplier: '', supplierPartNumber: '', location: 'Warehouse', weight: 30, lastCountDate: '', lastCountBy: '', lastRestockDate: '', notes: '', active: true },
  { productId: 'INV-0002', legacyId: 'item-124', legacySku: 'CAP-PLST', productName: 'Bottom Caps (plastic)', description: '25-35 SQ per bucket by pitch', category: 'nails_fasteners', sku: 'CAP-PLST', unit: 'bag', currentQty: 56, holdQty: 0, minStockLevel: 20, maxStockLevel: 200, reorderQty: 50, reorderPoint: 0, unitCost: 16.50, unitPrice: 29.15, supplier: '', supplierPartNumber: '', location: 'Warehouse', weight: 15, lastCountDate: '', lastCountBy: '', lastRestockDate: '', notes: '', active: true },
  { productId: 'INV-0003', legacyId: 'item-125', legacySku: 'FELT-SYN-10', productName: 'RCRS Syn Felt', description: '10 Sq', category: 'underlayment', sku: 'FELT-SYN-10', unit: 'roll', currentQty: 74, holdQty: 0, minStockLevel: 15, maxStockLevel: 150, reorderQty: 40, reorderPoint: 0, unitCost: 66.00, unitPrice: 79.86, supplier: '', supplierPartNumber: '', location: 'Warehouse', weight: 35, lastCountDate: '', lastCountBy: '', lastRestockDate: '', notes: '', active: true },
  { productId: 'INV-0004', legacyId: 'item-126', legacySku: 'ICE-WATER-2', productName: 'Ice & Water Shield', description: 'Peel and Stick, 67LF, 2 SQ., 200 SQFT', category: 'underlayment', sku: 'ICE-WATER-2', unit: 'roll', currentQty: 37, holdQty: 0, minStockLevel: 10, maxStockLevel: 100, reorderQty: 25, reorderPoint: 0, unitCost: 62.70, unitPrice: 114.22, supplier: '', supplierPartNumber: '', location: 'Warehouse', weight: 50, lastCountDate: '', lastCountBy: '', lastRestockDate: '', notes: '', active: true },
  { productId: 'INV-0005', legacyId: 'item-127', legacySku: 'VENT-RIDGE-4', productName: 'Ridge Vent 4LF', description: '', category: 'ventilation', sku: 'VENT-RIDGE-4', unit: 'piece', currentQty: 190, holdQty: 0, minStockLevel: 50, maxStockLevel: 500, reorderQty: 100, reorderPoint: 0, unitCost: 7.15, unitPrice: 10.20, supplier: '', supplierPartNumber: '', location: 'Warehouse', weight: 3, lastCountDate: '', lastCountBy: '', lastRestockDate: '', notes: '', active: true },
  { productId: 'INV-0006', legacyId: 'item-128', legacySku: 'BOOT-BLK-15', productName: '1 1/2” Black Bullet Boot', description: '', category: 'flashing', sku: 'BOOT-BLK-15', unit: 'each', currentQty: 54, holdQty: 0, minStockLevel: 25, maxStockLevel: 250, reorderQty: 50, reorderPoint: 0, unitCost: 16.67, unitPrice: 20.89, supplier: '', supplierPartNumber: '', location: 'Warehouse', weight: 1, lastCountDate: '', lastCountBy: '', lastRestockDate: '', notes: '', active: true },
  { productId: 'INV-0007', legacyId: 'item-129', legacySku: 'BOOT-BLK-2', productName: '2” Black Bullet Boot', description: '', category: 'flashing', sku: 'BOOT-BLK-2', unit: 'each', currentQty: 39, holdQty: 0, minStockLevel: 25, maxStockLevel: 250, reorderQty: 50, reorderPoint: 0, unitCost: 17.77, unitPrice: 22.54, supplier: '', supplierPartNumber: '', location: 'Warehouse', weight: 1, lastCountDate: '', lastCountBy: '', lastRestockDate: '', notes: '', active: true },
  { productId: 'INV-0008', legacyId: 'item-130', legacySku: 'BOOT-BLK-3', productName: '3” Black Bullet Boot', description: '', category: 'flashing', sku: 'BOOT-BLK-3', unit: 'each', currentQty: 33, holdQty: 0, minStockLevel: 20, maxStockLevel: 200, reorderQty: 50, reorderPoint: 0, unitCost: 20.19, unitPrice: 38.29, supplier: '', supplierPartNumber: '', location: 'Warehouse', weight: 1.5, lastCountDate: '', lastCountBy: '', lastRestockDate: '', notes: '', active: true },
  { productId: 'INV-0009', legacyId: 'item-131', legacySku: 'BOOT-BLK-4', productName: '4” Black Bullet Boot', description: '', category: 'flashing', sku: 'BOOT-BLK-4', unit: 'each', currentQty: 13, holdQty: 0, minStockLevel: 15, maxStockLevel: 150, reorderQty: 40, reorderPoint: 0, unitCost: 37.48, unitPrice: 42.50, supplier: '', supplierPartNumber: '', location: 'Warehouse', weight: 2, lastCountDate: '', lastCountBy: '', lastRestockDate: '', notes: '', active: true },
  { productId: 'INV-0010', legacyId: 'item-132', legacySku: 'SEAL-TUBE', productName: 'Sealant', description: 'Roofing sealant for flashing and repairs', category: 'sealants', sku: 'SEAL-TUBE', unit: 'tube', currentQty: 46, holdQty: 0, minStockLevel: 50, maxStockLevel: 500, reorderQty: 100, reorderPoint: 0, unitCost: 9.35, unitPrice: 10.00, supplier: '', supplierPartNumber: '', location: 'Warehouse', weight: 1, lastCountDate: '', lastCountBy: '', lastRestockDate: '', notes: '', active: true },
  { productId: 'INV-0011', legacyId: 'item-133', legacySku: 'BOOT-ZIP', productName: 'Zipper Boot', description: 'Split boot pipe flashing for retrofit installations', category: 'flashing', sku: 'BOOT-ZIP', unit: 'each', currentQty: 6, holdQty: 0, minStockLevel: 10, maxStockLevel: 100, reorderQty: 25, reorderPoint: 0, unitCost: 37.40, unitPrice: 48.00, supplier: '', supplierPartNumber: '', location: 'Warehouse', weight: 1.5, lastCountDate: '', lastCountBy: '', lastRestockDate: '', notes: '', active: true },
];

/**
 * Returns the effective reorder threshold for an item. When reorderPoint
 * is set (>0), use it. Otherwise fall back to minStockLevel for backward
 * compatibility with rows that pre-date Phase 4.
 */
export function effectiveReorderPoint(item: Pick<InventoryItem, 'reorderPoint' | 'minStockLevel'>): number {
  return item.reorderPoint && item.reorderPoint > 0 ? item.reorderPoint : item.minStockLevel;
}

// ============================================
// SHEETS HELPER
// ============================================

async function getSheet(tabName: string): Promise<{ sheet: GoogleSpreadsheetWorksheet; doc: GoogleSpreadsheet } | null> {
  if (!SHEETS_CONFIGURED) return null;
  try {
    const doc = new GoogleSpreadsheet(SHEETS_ID!, serviceAuth);
    await doc.loadInfo();
    let sheet = doc.sheetsByTitle[tabName];
    return sheet ? { sheet, doc } : null;
  } catch (error) {
    console.error(`Failed to get sheet ${tabName}:`, error);
    return null;
  }
}

async function getOrCreateSheet(tabName: string, headerValues: string[]): Promise<{ sheet: GoogleSpreadsheetWorksheet; doc: GoogleSpreadsheet } | null> {
  if (!SHEETS_CONFIGURED) return null;
  try {
    const doc = new GoogleSpreadsheet(SHEETS_ID!, serviceAuth);
    await doc.loadInfo();
    let sheet = doc.sheetsByTitle[tabName];
    if (!sheet) {
      sheet = await doc.addSheet({ title: tabName, headerValues });
    } else {
      // Ensure sheet has enough columns for our headers
      if (sheet.columnCount < headerValues.length) {
        await sheet.resize({ rowCount: sheet.rowCount, columnCount: headerValues.length });
      }
    }
    return { sheet, doc };
  } catch (error) {
    console.error(`Failed to get/create sheet ${tabName}:`, error);
    return null;
  }
}

// ============================================
// SERVICE CLASS
// ============================================

class UnifiedInventoryService {
  private inventory: InventoryItem[] = [];
  private transactions: InventoryTransaction[] = [];
  private countSessions: CountSession[] = [];
  private countRecords: CountRecord[] = [];
  private restockOrders: RestockOrder[] = [];
  private pricingHistory: PricingRecord[] = [];
  private materialHolds: MaterialHold[] = [];
  private returnTickets: ReturnTicket[] = [];
  private loaded = false;
  private loadPromise: Promise<void> | null = null;
  private nextIds = { inv: 12, txn: 1, cnt: 1, rec: 1, rst: 1, prc: 1, hld: 1, ret: 1 };

  // ============================================
  // INITIALIZATION
  // ============================================

  async ensureLoaded(): Promise<void> {
    if (this.loaded) return;
    if (this.loadPromise) return this.loadPromise;
    this.loadPromise = this._load();
    return this.loadPromise;
  }

  private async _load(): Promise<void> {
    try {
      // Load from Sheets first — use getOrCreateSheet so the tab is
      // auto-created with correct headers if it doesn't exist yet.
      // Previously used getSheet which returned null → silent fallback
      // to hardcoded catalog → pricing updates never persisted.
      const INVENTORY_HEADERS = [
        'productId', 'legacyId', 'legacySku', 'productName', 'description',
        'category', 'sku', 'unit', 'currentQty', 'holdQty',
        'minStockLevel', 'maxStockLevel', 'reorderQty',
        'reorderPoint', 'preferredVendorId',
        'unitCost', 'unitPrice', 'supplier', 'supplierPartNumber',
        'location', 'weight', 'lastCountDate', 'lastCountBy',
        'lastRestockDate', 'notes', 'active',
      ];
      const result = await getOrCreateSheet(SHEET_TABS.INVENTORY, INVENTORY_HEADERS);
      if (result) {
        const rows = await result.sheet.getRows();
        if (rows.length > 0) {
          this.inventory = rows.map((row: GoogleSpreadsheetRow) => this._rowToItem(row));
          // Update next ID
          const maxId = Math.max(...this.inventory.map(i => {
            const num = parseInt(i.productId.replace('INV-', ''));
            return isNaN(num) ? 0 : num;
          }));
          this.nextIds.inv = Math.max(this.nextIds.inv, maxId + 1);
        } else {
          // Seed from catalog
          await this._seedCatalog(result);
        }
      } else {
        // No Sheets access â€” use catalog as fallback
        this.inventory = UNIFIED_CATALOG.map(item => ({
          ...item,
          availableQty: item.currentQty - item.holdQty,
        }));
      }

      // Load transactions
      await this._loadTransactions();
      // Load count sessions
      await this._loadCountSessions();
      // Load return tickets
      await this._loadReturnTickets();
      // Load active material holds (preserves holds across server restart)
      await this._loadMaterialHolds();

      this.loaded = true;
    } catch (error) {
      console.error('Failed to load unified inventory:', error);
      // Fallback to catalog
      this.inventory = UNIFIED_CATALOG.map(item => ({
        ...item,
        availableQty: item.currentQty - item.holdQty,
      }));
      this.loaded = true;
    }
  }

  private _rowToItem(row: GoogleSpreadsheetRow): InventoryItem {
    const currentQty = parseFloat(row.get('currentQty')) || 0;
    const holdQty = parseFloat(row.get('holdQty')) || 0;
    const unitCost = parseFloat(row.get('unitCost')) || 0;
    const unitPrice = parseFloat(row.get('unitPrice')) || 0;
    const rawCat = (row.get('category') || '').toLowerCase();

    return {
      productId: row.get('productId') || '',
      legacyId: row.get('legacyId') || undefined,
      legacySku: row.get('legacySku') || undefined,
      productName: row.get('productName') || '',
      description: row.get('description') || '',
      category: mapCategoryString(rawCat || 'accessories'),
      sku: row.get('sku') || '',
      unit: row.get('unit') || 'each',
      currentQty,
      holdQty,
      availableQty: currentQty - holdQty,
      minStockLevel: parseFloat(row.get('minStockLevel')) || 10,
      maxStockLevel: parseFloat(row.get('maxStockLevel')) || 100,
      reorderQty: parseFloat(row.get('reorderQty')) || 10,
      reorderPoint: parseFloat(row.get('reorderPoint')) || 0,
      preferredVendorId: row.get('preferredVendorId') || undefined,
      unitCost,
      unitPrice,
      supplier: row.get('supplier') || '',
      supplierPartNumber: row.get('supplierPartNumber') || '',
      location: row.get('location') || '',
      weight: parseFloat(row.get('weight')) || 0,
      lastCountDate: row.get('lastCountDate') || '',
      lastCountBy: row.get('lastCountBy') || '',
      lastRestockDate: row.get('lastRestockDate') || '',
      notes: row.get('notes') || '',
      active: row.get('active') !== 'false',
    };
  }

  private async _seedCatalog(result: { sheet: GoogleSpreadsheetWorksheet; doc: GoogleSpreadsheet }): Promise<void> {
    const headers = [
      'productId', 'legacyId', 'legacySku', 'productName', 'description', 'category',
      'sku', 'unit', 'currentQty', 'holdQty', 'minStockLevel', 'maxStockLevel',
      'reorderQty', 'reorderPoint', 'preferredVendorId',
      'unitCost', 'unitPrice', 'supplier', 'supplierPartNumber',
      'location', 'weight', 'lastCountDate', 'lastCountBy', 'lastRestockDate', 'notes', 'active'
    ];

    // Check if sheet has headers, if not set them
    try {
      await result.sheet.setHeaderRow(headers);
    } catch {
      // Headers might already be set
    }

    // Write all catalog items
    const rows = UNIFIED_CATALOG.map(item => ({
      productId: item.productId,
      legacyId: item.legacyId || '',
      legacySku: item.legacySku || '',
      productName: item.productName,
      description: item.description,
      category: CATEGORY_LABELS[item.category] || item.category,
      sku: item.sku,
      unit: item.unit,
      currentQty: item.currentQty.toString(),
      holdQty: item.holdQty.toString(),
      minStockLevel: item.minStockLevel.toString(),
      maxStockLevel: item.maxStockLevel.toString(),
      reorderQty: item.reorderQty.toString(),
      reorderPoint: (item.reorderPoint ?? 0).toString(),
      preferredVendorId: item.preferredVendorId || '',
      unitCost: item.unitCost.toString(),
      unitPrice: item.unitPrice.toString(),
      supplier: item.supplier,
      supplierPartNumber: item.supplierPartNumber,
      location: item.location,
      weight: item.weight.toString(),
      lastCountDate: '',
      lastCountBy: '',
      lastRestockDate: '',
      notes: '',
      active: 'true',
    }));

    await result.sheet.addRows(rows);

    this.inventory = UNIFIED_CATALOG.map(item => ({
      ...item,
      availableQty: item.currentQty - item.holdQty,
    }));
  }

  private async _loadTransactions(): Promise<void> {
    const result = await getOrCreateSheet(SHEET_TABS.TRANSACTIONS, [
      'transactionId', 'productId', 'productName', 'type', 'quantity',
      'referenceId', 'referenceType', 'performedBy', 'performedByName',
      'timestamp', 'notes', 'previousQty', 'newQty', 'unitCost', 'unitPrice',
    ]);
    if (!result) return;
    try {
      const rows = await result.sheet.getRows();
      this.transactions = rows.map((row: GoogleSpreadsheetRow) => ({
        transactionId: row.get('transactionId') || '',
        productId: row.get('productId') || '',
        productName: row.get('productName') || '',
        type: row.get('type') || 'adjustment',
        quantity: parseFloat(row.get('quantity')) || 0,
        referenceId: row.get('referenceId') || '',
        referenceType: row.get('referenceType') || '',
        performedBy: row.get('performedBy') || '',
        performedByName: row.get('performedByName') || '',
        timestamp: row.get('timestamp') || '',
        notes: row.get('notes') || '',
        previousQty: parseFloat(row.get('previousQty')) || 0,
        newQty: parseFloat(row.get('newQty')) || 0,
        unitCost: parseFloat(row.get('unitCost')) || undefined,
        unitPrice: parseFloat(row.get('unitPrice')) || undefined,
      }));
      const maxId = Math.max(0, ...this.transactions.map(t => {
        const num = parseInt(t.transactionId.replace('TXN-', ''));
        return isNaN(num) ? 0 : num;
      }));
      this.nextIds.txn = Math.max(this.nextIds.txn, maxId + 1);
    } catch (error) {
      console.error('Failed to load transactions:', error);
    }
  }

  private async _loadCountSessions(): Promise<void> {
    const result = await getOrCreateSheet(SHEET_TABS.COUNT_SESSIONS, [
      'sessionId', 'startedAt', 'startedBy', 'startedByName', 'status',
      'countSessionType', 'scopedProductIds',
      'completedAt', 'totalItems', 'countedItems', 'discrepancies',
      'resolvedDiscrepancies', 'photoUrl', 'notes',
    ]);
    if (!result) return;
    try {
      const rows = await result.sheet.getRows();
      this.countSessions = rows.map((row: GoogleSpreadsheetRow) => {
        const rawType = (row.get('countSessionType') || 'full') as string;
        const type: CountSessionType = (['full', 'cycle', 'item'].includes(rawType) ? rawType : 'full') as CountSessionType;
        let scoped: string[] | undefined;
        const rawScoped = row.get('scopedProductIds');
        if (rawScoped) {
          try { scoped = JSON.parse(rawScoped); } catch { scoped = undefined; }
        }
        return {
          sessionId: row.get('sessionId') || '',
          startedAt: row.get('startedAt') || '',
          startedBy: row.get('startedBy') || '',
          startedByName: row.get('startedByName') || '',
          status: (row.get('status') || 'in_progress') as CountSession['status'],
          countSessionType: type,
          scopedProductIds: scoped,
          completedAt: row.get('completedAt') || undefined,
          totalItems: parseInt(row.get('totalItems')) || 0,
          countedItems: parseInt(row.get('countedItems')) || 0,
          discrepancies: parseInt(row.get('discrepancies')) || 0,
          resolvedDiscrepancies: parseInt(row.get('resolvedDiscrepancies')) || 0,
          photoUrl: row.get('photoUrl') || undefined,
          notes: row.get('notes') || undefined,
        };
      });
    } catch (error) {
      console.error('Failed to load count sessions:', error);
    }
  }

  private async _loadReturnTickets(): Promise<void> {
    const result = await getOrCreateSheet(SHEET_TABS.RETURN_TICKETS, [
      'ticketId', 'type', 'status', 'orderId', 'jobId', 'jobName',
      'items', 'distributor', 'creditMemoNumber', 'creditAmount',
      'createdAt', 'createdBy', 'createdByName',
      'pickupPhotos', 'transitPhotos', 'deliveryPhotos',
      'gpsPickup', 'gpsDelivery', 'notes', 'completedAt',
    ]);
    if (!result) return;
    try {
      const rows = await result.sheet.getRows();
      this.returnTickets = rows.map((row: GoogleSpreadsheetRow) => ({
        ticketId: row.get('ticketId') || '',
        type: (row.get('type') || 'return_to_warehouse') as ReturnType,
        status: (row.get('status') || 'created') as ReturnStatus,
        orderId: row.get('orderId') || undefined,
        jobId: row.get('jobId') || undefined,
        jobName: row.get('jobName') || undefined,
        items: JSON.parse(row.get('items') || '[]'),
        distributor: row.get('distributor') || undefined,
        creditMemoNumber: row.get('creditMemoNumber') || undefined,
        creditAmount: parseFloat(row.get('creditAmount')) || undefined,
        createdAt: row.get('createdAt') || '',
        createdBy: row.get('createdBy') || '',
        createdByName: row.get('createdByName') || '',
        pickupPhotos: JSON.parse(row.get('pickupPhotos') || '[]'),
        transitPhotos: JSON.parse(row.get('transitPhotos') || '[]'),
        deliveryPhotos: JSON.parse(row.get('deliveryPhotos') || '[]'),
        gpsPickup: row.get('gpsPickup') || undefined,
        gpsDelivery: row.get('gpsDelivery') || undefined,
        notes: row.get('notes') || '',
        completedAt: row.get('completedAt') || undefined,
      }));
    } catch (error) {
      console.error('Failed to load return tickets:', error);
    }
  }

  /**
   * Load active material holds from the MaterialHolds sheet so they survive
   * server restarts. Only loads holds with status='active' since fulfilled
   * and released holds have already affected currentQty/holdQty.
   */
  private async _loadMaterialHolds(): Promise<void> {
    const result = await getOrCreateSheet(SHEET_TABS.MATERIAL_HOLDS, [
      'holdId', 'productId', 'productName', 'quantity', 'orderId',
      'orderType', 'createdAt', 'createdBy', 'status',
      'fulfilledAt', 'releasedAt',
    ]);
    if (!result) return;
    try {
      const rows = await result.sheet.getRows();
      this.materialHolds = rows.map((row: GoogleSpreadsheetRow) => ({
        holdId: row.get('holdId') || '',
        productId: row.get('productId') || '',
        productName: row.get('productName') || '',
        quantity: parseFloat(row.get('quantity')) || 0,
        orderId: row.get('orderId') || '',
        orderType: row.get('orderType') || '',
        createdAt: row.get('createdAt') || '',
        createdBy: row.get('createdBy') || '',
        status: (row.get('status') || 'active') as MaterialHold['status'],
        fulfilledAt: row.get('fulfilledAt') || undefined,
        releasedAt: row.get('releasedAt') || undefined,
        fulfilledQty: row.get('fulfilledQty') ? parseFloat(row.get('fulfilledQty')) : undefined,
        unfulfilledQty: row.get('unfulfilledQty') ? parseFloat(row.get('unfulfilledQty')) : undefined,
      }));
      // Update next ID counter so we don't collide
      const maxHoldId = Math.max(0, ...this.materialHolds.map(h => {
        const num = parseInt(h.holdId.replace('HLD-', ''));
        return isNaN(num) ? 0 : num;
      }));
      this.nextIds.hld = Math.max(this.nextIds.hld, maxHoldId + 1);
    } catch (error) {
      console.error('Failed to load material holds:', error);
    }
  }

  // ============================================
  // PERSIST HELPERS
  // ============================================

  private async _persistItem(item: InventoryItem): Promise<void> {
    const INVENTORY_HEADERS = [
      'productId', 'legacyId', 'legacySku', 'productName', 'description',
      'category', 'sku', 'unit', 'currentQty', 'holdQty',
      'minStockLevel', 'maxStockLevel', 'reorderQty',
      'reorderPoint', 'preferredVendorId',
      'unitCost', 'unitPrice', 'supplier', 'supplierPartNumber',
      'location', 'weight', 'lastCountDate', 'lastCountBy',
      'lastRestockDate', 'notes', 'active',
    ];
    const result = await getOrCreateSheet(SHEET_TABS.INVENTORY, INVENTORY_HEADERS);
    if (!result) {
      console.error('[inventory] _persistItem: Sheets not available, data NOT saved');
      return;
    }
    try {
      const rows = await result.sheet.getRows();
      const existing = rows.find((r: GoogleSpreadsheetRow) => r.get('productId') === item.productId);
      const data = {
        productId: item.productId,
        legacyId: item.legacyId || '',
        legacySku: item.legacySku || '',
        productName: item.productName,
        description: item.description,
        category: CATEGORY_LABELS[item.category] || item.category,
        sku: item.sku,
        unit: item.unit,
        currentQty: item.currentQty.toString(),
        holdQty: item.holdQty.toString(),
        minStockLevel: item.minStockLevel.toString(),
        maxStockLevel: item.maxStockLevel.toString(),
        reorderQty: item.reorderQty.toString(),
        reorderPoint: (item.reorderPoint ?? 0).toString(),
        preferredVendorId: item.preferredVendorId || '',
        unitCost: item.unitCost.toString(),
        unitPrice: item.unitPrice.toString(),
        supplier: item.supplier,
        supplierPartNumber: item.supplierPartNumber,
        location: item.location,
        weight: item.weight.toString(),
        lastCountDate: item.lastCountDate,
        lastCountBy: item.lastCountBy,
        lastRestockDate: item.lastRestockDate,
        notes: item.notes,
        active: item.active ? 'true' : 'false',
      };

      if (existing) {
        Object.entries(data).forEach(([key, val]) => existing.set(key, val));
        await existing.save();
      } else {
        await result.sheet.addRow(data);
      }
    } catch (error) {
      console.error('Failed to persist inventory item:', error);
    }
  }

  private async _persistTransaction(txn: InventoryTransaction): Promise<void> {
    const result = await getOrCreateSheet(SHEET_TABS.TRANSACTIONS, [
      'transactionId', 'productId', 'productName', 'type', 'quantity',
      'referenceId', 'referenceType', 'performedBy', 'performedByName',
      'timestamp', 'notes', 'previousQty', 'newQty', 'unitCost', 'unitPrice'
    ]);
    if (!result) return;
    try {
      await result.sheet.addRow({
        transactionId: txn.transactionId,
        productId: txn.productId,
        productName: txn.productName,
        type: txn.type,
        quantity: txn.quantity.toString(),
        referenceId: txn.referenceId,
        referenceType: txn.referenceType,
        performedBy: txn.performedBy,
        performedByName: txn.performedByName,
        timestamp: txn.timestamp,
        notes: txn.notes,
        previousQty: txn.previousQty.toString(),
        newQty: txn.newQty.toString(),
        unitCost: txn.unitCost?.toString() || '',
        unitPrice: txn.unitPrice?.toString() || '',
      });
    } catch (error) {
      console.error('Failed to persist transaction:', error);
    }
  }

  /**
   * Persist a material hold to the MaterialHolds sheet so it survives restart.
   * Was previously in-memory only — restart = lost holds = double-allocation
   * the next time someone places an order against the same item.
   */
  private async _persistHold(hold: MaterialHold): Promise<void> {
    const result = await getOrCreateSheet(SHEET_TABS.MATERIAL_HOLDS, [
      'holdId', 'productId', 'productName', 'quantity', 'orderId', 'orderType',
      'createdAt', 'createdBy', 'status', 'fulfilledAt', 'releasedAt',
      'fulfilledQty', 'unfulfilledQty',
    ]);
    if (!result) return;
    try {
      const rows = await result.sheet.getRows();
      const existing = rows.find((r: GoogleSpreadsheetRow) => r.get('holdId') === hold.holdId);
      const data = {
        holdId: hold.holdId,
        productId: hold.productId,
        productName: hold.productName,
        quantity: hold.quantity.toString(),
        orderId: hold.orderId,
        orderType: hold.orderType,
        createdAt: hold.createdAt,
        createdBy: hold.createdBy,
        status: hold.status,
        fulfilledAt: hold.fulfilledAt || '',
        releasedAt: hold.releasedAt || '',
        fulfilledQty: hold.fulfilledQty?.toString() || '',
        unfulfilledQty: hold.unfulfilledQty?.toString() || '',
      };
      if (existing) {
        Object.entries(data).forEach(([key, val]) => existing.set(key, val));
        await existing.save();
      } else {
        await result.sheet.addRow(data);
      }
    } catch (error) {
      console.error('Failed to persist material hold:', error);
    }
  }

  /**
   * Append an audit row to the InventoryLogs tab.
   *
   * Fire-and-forget by design — every state-changing inventory operation
   * funnels through here so an admin can replay history from a single sheet
   * (instead of joining InventoryTransactions, MaterialHolds, ReturnTickets,
   * and CountRecords). Failures are logged but never block the caller.
   */
  private _writeInventoryLog(entry: {
    productId: string;
    productName: string;
    action: string;        // e.g. 'fulfill_hold', 'place_hold', 'deduct', 'add', 'count_adjust', 'return_received'
    delta: number;         // signed: positive = stock added, negative = stock removed
    balanceAfter: number;
    referenceId?: string;
    performedBy: string;
    notes?: string;
  }): void {
    (async () => {
      const result = await getOrCreateSheet(SHEET_TABS.INVENTORY_LOGS, [
        'timestamp', 'productId', 'productName', 'action', 'delta',
        'balanceAfter', 'referenceId', 'performedBy', 'notes',
      ]);
      if (!result) return;
      try {
        await result.sheet.addRow({
          timestamp: new Date().toISOString(),
          productId: entry.productId,
          productName: entry.productName,
          action: entry.action,
          delta: entry.delta.toString(),
          balanceAfter: entry.balanceAfter.toString(),
          referenceId: entry.referenceId || '',
          performedBy: entry.performedBy,
          notes: entry.notes || '',
        });
      } catch (error) {
        console.error('[inventory] InventoryLogs write failed:', error);
      }
    })();
  }

  private async _persistCountSession(session: CountSession): Promise<void> {
    const result = await getOrCreateSheet(SHEET_TABS.COUNT_SESSIONS, [
      'sessionId', 'startedAt', 'startedBy', 'startedByName', 'status',
      'countSessionType', 'scopedProductIds',
      'completedAt', 'totalItems', 'countedItems', 'discrepancies',
      'resolvedDiscrepancies', 'photoUrl', 'notes'
    ]);
    if (!result) return;
    try {
      const rows = await result.sheet.getRows();
      const existing = rows.find((r: GoogleSpreadsheetRow) => r.get('sessionId') === session.sessionId);
      const data = {
        sessionId: session.sessionId,
        startedAt: session.startedAt,
        startedBy: session.startedBy,
        startedByName: session.startedByName,
        status: session.status,
        countSessionType: session.countSessionType || 'full',
        scopedProductIds: session.scopedProductIds ? JSON.stringify(session.scopedProductIds) : '',
        completedAt: session.completedAt || '',
        totalItems: session.totalItems.toString(),
        countedItems: session.countedItems.toString(),
        discrepancies: session.discrepancies.toString(),
        resolvedDiscrepancies: session.resolvedDiscrepancies.toString(),
        photoUrl: session.photoUrl || '',
        notes: session.notes || '',
      };
      if (existing) {
        Object.entries(data).forEach(([key, val]) => existing.set(key, val));
        await existing.save();
      } else {
        await result.sheet.addRow(data);
      }
    } catch (error) {
      console.error('Failed to persist count session:', error);
    }
  }

  private async _persistReturnTicket(ticket: ReturnTicket): Promise<void> {
    const result = await getOrCreateSheet(SHEET_TABS.RETURN_TICKETS, [
      'ticketId', 'type', 'status', 'orderId', 'jobId', 'jobName', 'items',
      'distributor', 'creditMemoNumber', 'creditAmount', 'createdAt', 'createdBy',
      'createdByName', 'pickupPhotos', 'transitPhotos', 'deliveryPhotos',
      'gpsPickup', 'gpsDelivery', 'notes', 'completedAt'
    ]);
    if (!result) return;
    try {
      const rows = await result.sheet.getRows();
      const existing = rows.find((r: GoogleSpreadsheetRow) => r.get('ticketId') === ticket.ticketId);
      const data = {
        ticketId: ticket.ticketId,
        type: ticket.type,
        status: ticket.status,
        orderId: ticket.orderId || '',
        jobId: ticket.jobId || '',
        jobName: ticket.jobName || '',
        items: JSON.stringify(ticket.items),
        distributor: ticket.distributor || '',
        creditMemoNumber: ticket.creditMemoNumber || '',
        creditAmount: ticket.creditAmount?.toString() || '',
        createdAt: ticket.createdAt,
        createdBy: ticket.createdBy,
        createdByName: ticket.createdByName,
        pickupPhotos: JSON.stringify(ticket.pickupPhotos),
        transitPhotos: JSON.stringify(ticket.transitPhotos),
        deliveryPhotos: JSON.stringify(ticket.deliveryPhotos),
        gpsPickup: ticket.gpsPickup || '',
        gpsDelivery: ticket.gpsDelivery || '',
        notes: ticket.notes,
        completedAt: ticket.completedAt || '',
      };
      if (existing) {
        Object.entries(data).forEach(([key, val]) => existing.set(key, val));
        await existing.save();
      } else {
        await result.sheet.addRow(data);
      }
    } catch (error) {
      console.error('Failed to persist return ticket:', error);
    }
  }

  // ============================================
  // INVENTORY CRUD
  // ============================================

  async getInventory(filters?: InventoryFilters): Promise<InventoryItem[]> {
    await this.ensureLoaded();
    let items = [...this.inventory];

    if (filters) {
      if (filters.active !== undefined) items = items.filter(i => i.active === filters.active);
      else items = items.filter(i => i.active); // Default: only active
      if (filters.category) items = items.filter(i => i.category === filters.category);
      if (filters.search) {
        const q = filters.search.toLowerCase();
        items = items.filter(i =>
          i.productName.toLowerCase().includes(q) ||
          i.sku.toLowerCase().includes(q) ||
          i.productId.toLowerCase().includes(q) ||
          i.supplier.toLowerCase().includes(q) ||
          (i.legacyId || '').toLowerCase().includes(q) ||
          (i.legacySku || '').toLowerCase().includes(q)
        );
      }
      if (filters.lowStock) items = items.filter(i => i.currentQty <= i.minStockLevel && i.currentQty > 0);
      if (filters.outOfStock) items = items.filter(i => i.currentQty === 0);
      if (filters.supplier) items = items.filter(i => i.supplier === filters.supplier);
      if (filters.location) items = items.filter(i => i.location.includes(filters.location!));
    } else {
      items = items.filter(i => i.active);
    }

    return items;
  }

  async getItemById(productId: string): Promise<InventoryItem | undefined> {
    await this.ensureLoaded();
    const resolved = resolveProductId(productId);
    return this.inventory.find(i => i.productId === resolved || i.legacyId === productId || i.legacySku === productId);
  }

  async updateItem(productId: string, updates: Partial<InventoryItem>): Promise<InventoryItem | null> {
    await this.ensureLoaded();
    const resolved = resolveProductId(productId);
    const idx = this.inventory.findIndex(i => i.productId === resolved);
    if (idx === -1) return null;

    const old = this.inventory[idx];
    this.inventory[idx] = {
      ...old,
      ...updates,
      productId: old.productId, // Never change the canonical ID
      availableQty: (updates.currentQty ?? old.currentQty) - (updates.holdQty ?? old.holdQty),
    };

    // AWAIT — updateItem is called from many places, all of which need
    // the change to be durable before returning.
    await this._persistItem(this.inventory[idx]).catch((err) =>
      console.error('[inventory] updateItem persist failed:', err)
    );
    return this.inventory[idx];
  }

  async addItem(itemData: Omit<InventoryItem, 'productId' | 'availableQty'>): Promise<InventoryItem> {
    await this.ensureLoaded();
    const productId = `INV-${String(this.nextIds.inv++).padStart(4, '0')}`;
    const newItem: InventoryItem = {
      ...itemData,
      productId,
      availableQty: itemData.currentQty - itemData.holdQty,
    };
    this.inventory.push(newItem);
    // AWAIT — must be durable before responding
    await this._persistItem(newItem).catch((err) =>
      console.error('[inventory] addItem persist failed:', err)
    );
    return newItem;
  }

  async deactivateItem(productId: string): Promise<boolean> {
    const item = await this.updateItem(productId, { active: false });
    return item !== null;
  }

  // ============================================
  // STOCK OPERATIONS
  // ============================================

  /**
   * Deduct stock on delivery confirmation (Stage 11).
   * Creates a transaction record and persists to Sheets.
   */
  async deductStock(
    productId: string,
    quantity: number,
    referenceId: string,
    referenceType: string,
    performedBy: string,
    performedByName: string,
    notes: string = ''
  ): Promise<InventoryTransaction | null> {
    await this.ensureLoaded();
    const resolved = resolveProductId(productId);
    const item = this.inventory.find(i => i.productId === resolved);
    if (!item) return null;

    const previousQty = item.currentQty;
    item.currentQty = Math.max(0, item.currentQty - quantity);
    item.availableQty = item.currentQty - item.holdQty;

    const txn: InventoryTransaction = {
      transactionId: `TXN-${String(this.nextIds.txn++).padStart(6, '0')}`,
      productId: resolved,
      productName: item.productName,
      type: 'delivery',
      quantity: -quantity,
      referenceId,
      referenceType,
      performedBy,
      performedByName,
      timestamp: new Date().toISOString(),
      notes,
      previousQty,
      newQty: item.currentQty,
      unitCost: item.unitCost,
      unitPrice: item.unitPrice,
    };

    this.transactions.push(txn);
    // CRITICAL: AWAIT persists. On Vercel serverless, fire-and-forget
    // .catch() patterns get killed by the lambda dying after the response.
    const dsResults = await Promise.allSettled([
      this._persistItem(item),
      this._persistTransaction(txn),
    ]);
    for (const r of dsResults) {
      if (r.status === 'rejected') {
        console.error('[inventory] deductStock persist rejected:', r.reason);
      }
    }
    this._writeInventoryLog({
      productId: resolved,
      productName: item.productName,
      action: 'deduct',
      delta: -quantity,
      balanceAfter: item.currentQty,
      referenceId,
      performedBy: performedByName,
      notes: notes || `Deducted ${quantity} for ${referenceType}`,
    });
    return txn;
  }

  /**
   * Add stock (restock, return received).
   */
  async addStock(
    productId: string,
    quantity: number,
    type: 'restock' | 'return' | 'adjustment',
    referenceId: string,
    referenceType: string,
    performedBy: string,
    performedByName: string,
    notes: string = ''
  ): Promise<InventoryTransaction | null> {
    await this.ensureLoaded();
    const resolved = resolveProductId(productId);
    const item = this.inventory.find(i => i.productId === resolved);
    if (!item) return null;

    const previousQty = item.currentQty;
    item.currentQty += quantity;
    item.availableQty = item.currentQty - item.holdQty;
    if (type === 'restock') {
      item.lastRestockDate = new Date().toISOString().split('T')[0];
    }

    const txn: InventoryTransaction = {
      transactionId: `TXN-${String(this.nextIds.txn++).padStart(6, '0')}`,
      productId: resolved,
      productName: item.productName,
      type,
      quantity,
      referenceId,
      referenceType,
      performedBy,
      performedByName,
      timestamp: new Date().toISOString(),
      notes,
      previousQty,
      newQty: item.currentQty,
      unitCost: item.unitCost,
      unitPrice: item.unitPrice,
    };

    this.transactions.push(txn);
    // AWAIT persists — see deductStock for the rationale.
    const asResults = await Promise.allSettled([
      this._persistItem(item),
      this._persistTransaction(txn),
    ]);
    for (const r of asResults) {
      if (r.status === 'rejected') {
        console.error('[inventory] addStock persist rejected:', r.reason);
      }
    }
    this._writeInventoryLog({
      productId: resolved,
      productName: item.productName,
      action: type, // 'restock' | 'return' | 'adjustment'
      delta: quantity,
      balanceAfter: item.currentQty,
      referenceId,
      performedBy: performedByName,
      notes: notes || `Added ${quantity} via ${type}`,
    });
    return txn;
  }

  /**
   * Place a hold on inventory for a pending order.
   */
  async placeHold(
    productId: string,
    quantity: number,
    orderId: string,
    orderType: string,
    createdBy: string
  ): Promise<MaterialHold | null> {
    await this.ensureLoaded();
    const resolved = resolveProductId(productId);
    const item = this.inventory.find(i => i.productId === resolved);
    if (!item) return null;

    item.holdQty += quantity;
    item.availableQty = item.currentQty - item.holdQty;

    const hold: MaterialHold = {
      holdId: `HLD-${String(this.nextIds.hld++).padStart(5, '0')}`,
      productId: resolved,
      productName: item.productName,
      quantity,
      orderId,
      orderType,
      createdAt: new Date().toISOString(),
      createdBy,
      status: 'active',
    };

    this.materialHolds.push(hold);

    // Log transaction (push first so all 3 persists run in parallel below)
    const txn: InventoryTransaction = {
      transactionId: `TXN-${String(this.nextIds.txn++).padStart(6, '0')}`,
      productId: resolved,
      productName: item.productName,
      type: 'hold',
      quantity: -quantity,
      referenceId: orderId,
      referenceType: orderType,
      performedBy: createdBy,
      performedByName: createdBy,
      timestamp: new Date().toISOString(),
      notes: `Hold placed for order ${orderId}`,
      previousQty: item.availableQty + quantity,
      newQty: item.availableQty,
    };
    this.transactions.push(txn);

    // AWAIT all 3 persists in parallel before returning. Holds MUST be
    // durable — if a hold isn't written but the inventory item is, the
    // next request will see stale availableQty and double-allocate stock.
    const phResults = await Promise.allSettled([
      this._persistItem(item),
      this._persistHold(hold),
      this._persistTransaction(txn),
    ]);
    for (const r of phResults) {
      if (r.status === 'rejected') {
        console.error('[inventory] placeHold persist rejected:', r.reason);
      }
    }
    this._writeInventoryLog({
      productId: resolved,
      productName: item.productName,
      action: 'place_hold',
      delta: 0, // currentQty unchanged; only availableQty drops
      balanceAfter: item.currentQty,
      referenceId: orderId,
      performedBy: createdBy,
      notes: `Hold ${hold.holdId} placed for ${quantity} units (avail now ${item.availableQty})`,
    });

    return hold;
  }

  /**
   * Release a hold (order cancelled or materials returned).
   */
  async releaseHold(holdId: string): Promise<boolean> {
    await this.ensureLoaded();
    const hold = this.materialHolds.find(h => h.holdId === holdId);
    if (!hold || hold.status !== 'active') return false;

    const item = this.inventory.find(i => i.productId === hold.productId);
    if (item) {
      item.holdQty = Math.max(0, item.holdQty - hold.quantity);
      item.availableQty = item.currentQty - item.holdQty;
    }

    hold.status = 'released';
    hold.releasedAt = new Date().toISOString();

    // AWAIT both persists. Releasing a hold must be durable — otherwise
    // the next request will think the stock is still on hold.
    const rhResults = await Promise.allSettled([
      item ? this._persistItem(item) : Promise.resolve(),
      this._persistHold(hold),
    ]);
    for (const r of rhResults) {
      if (r.status === 'rejected') {
        console.error('[inventory] releaseHold persist rejected:', r.reason);
      }
    }

    if (item) {
      this._writeInventoryLog({
        productId: hold.productId,
        productName: hold.productName,
        action: 'release_hold',
        delta: 0,
        balanceAfter: item.currentQty,
        referenceId: hold.orderId,
        performedBy: 'system',
        notes: `Hold ${holdId} released (${hold.quantity} units returned to available)`,
      });
    }
    return true;
  }

  /**
   * Fulfill a hold (delivery confirmed → convert hold to deduction).
   *
   * @param actualQty - The quantity actually delivered. If less than the held
   *   quantity, the difference is released back to available stock instead of
   *   being silently lost. Defaults to the full held quantity.
   */
  async fulfillHold(
    holdId: string,
    performedBy: string,
    performedByName: string,
    actualQty?: number
  ): Promise<boolean> {
    await this.ensureLoaded();
    const hold = this.materialHolds.find(h => h.holdId === holdId);
    if (!hold || hold.status !== 'active') return false;

    // If caller didn't specify actual delivered qty, assume full hold was used
    const deliveredQty = Math.max(0, Math.min(actualQty ?? hold.quantity, hold.quantity));
    const undeliveredQty = hold.quantity - deliveredQty;

    const item = this.inventory.find(i => i.productId === hold.productId);
    if (item) {
      // Release the FULL hold (we're done with it either way)
      item.holdQty = Math.max(0, item.holdQty - hold.quantity);
      // Only deduct what was actually delivered
      item.currentQty = Math.max(0, item.currentQty - deliveredQty);
      item.availableQty = item.currentQty - item.holdQty;
    }

    hold.status = 'fulfilled';
    hold.fulfilledAt = new Date().toISOString();
    hold.fulfilledQty = deliveredQty;
    hold.unfulfilledQty = undeliveredQty;

    // Build the transaction record up front so we can persist it in parallel
    let txn: InventoryTransaction | null = null;
    if (item && deliveredQty > 0) {
      txn = {
        transactionId: `TXN-${String(this.nextIds.txn++).padStart(6, '0')}`,
        productId: hold.productId,
        productName: hold.productName,
        type: 'delivery',
        quantity: -deliveredQty,
        referenceId: hold.orderId,
        referenceType: hold.orderType,
        performedBy,
        performedByName,
        timestamp: new Date().toISOString(),
        notes: undeliveredQty > 0
          ? `Hold ${holdId} fulfilled for order ${hold.orderId} (${deliveredQty}/${hold.quantity} delivered, ${undeliveredQty} returned to stock)`
          : `Hold ${holdId} fulfilled for order ${hold.orderId}`,
        previousQty: item.currentQty + deliveredQty,
        newQty: item.currentQty,
        unitCost: item.unitCost,
        unitPrice: item.unitPrice,
      };
      this.transactions.push(txn);
    }

    // CRITICAL: AWAIT all persists in parallel. This is the most important
    // mutation in the system — every delivery hits this. If anything fails
    // silently, stock counts diverge from reality.
    const fhResults = await Promise.allSettled([
      item ? this._persistItem(item) : Promise.resolve(),
      this._persistHold(hold),
      txn ? this._persistTransaction(txn) : Promise.resolve(),
    ]);
    for (const r of fhResults) {
      if (r.status === 'rejected') {
        console.error('[inventory] fulfillHold persist rejected:', r.reason);
      }
    }

    if (item && txn) {
      this._writeInventoryLog({
        productId: hold.productId,
        productName: hold.productName,
        action: 'fulfill_hold',
        delta: -deliveredQty,
        balanceAfter: item.currentQty,
        referenceId: hold.orderId,
        performedBy: performedByName,
        notes: txn.notes,
      });
    }

    return true;
  }

  // ============================================
  // TRANSACTIONS
  // ============================================

  async getTransactions(productId?: string, limit: number = 50): Promise<InventoryTransaction[]> {
    await this.ensureLoaded();
    let txns = [...this.transactions];
    if (productId) {
      const resolved = resolveProductId(productId);
      txns = txns.filter(t => t.productId === resolved);
    }
    return txns.sort((a, b) => b.timestamp.localeCompare(a.timestamp)).slice(0, limit);
  }

  async getTransactionsByReference(referenceId: string): Promise<InventoryTransaction[]> {
    await this.ensureLoaded();
    return this.transactions.filter(t => t.referenceId === referenceId);
  }

  // ============================================
  // WEEKLY COUNT VERIFICATION
  // ============================================

  async initiateWeeklyCount(startedBy: string, startedByName: string): Promise<CountSession> {
    await this.ensureLoaded();
    const sessionId = `CNT-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${String(this.nextIds.cnt++).padStart(3, '0')}`;
    const session: CountSession = {
      sessionId,
      startedAt: new Date().toISOString(),
      startedBy,
      startedByName,
      status: 'in_progress',
      countSessionType: 'full',
      totalItems: this.inventory.filter(i => i.active).length,
      countedItems: 0,
      discrepancies: 0,
      resolvedDiscrepancies: 0,
    };
    this.countSessions.unshift(session);
    await this._persistCountSession(session).catch((err) =>
      console.error('[inventory] initiateWeeklyCount persist failed:', err)
    );
    return session;
  }

  /**
   * Phase 4: start a cycle count covering N randomly selected active SKUs.
   * The same N is the session's "totalItems" so the existing progress + auto-
   * complete logic works without changes.
   */
  async initiateCycleCount(
    startedBy: string,
    startedByName: string,
    targetCount: number = 7,
  ): Promise<CountSession> {
    await this.ensureLoaded();
    const active = this.inventory.filter(i => i.active);
    const n = Math.max(1, Math.min(targetCount, active.length));
    // Fisher-Yates shuffle, pick first N
    const pool = [...active];
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    const picked = pool.slice(0, n);

    const sessionId = `CYC-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${String(this.nextIds.cnt++).padStart(3, '0')}`;
    const session: CountSession = {
      sessionId,
      startedAt: new Date().toISOString(),
      startedBy,
      startedByName,
      status: 'in_progress',
      countSessionType: 'cycle',
      scopedProductIds: picked.map(i => i.productId),
      totalItems: n,
      countedItems: 0,
      discrepancies: 0,
      resolvedDiscrepancies: 0,
      notes: `Cycle count: ${n} random items`,
    };
    this.countSessions.unshift(session);
    await this._persistCountSession(session).catch((err) =>
      console.error('[inventory] initiateCycleCount persist failed:', err)
    );
    return session;
  }

  /**
   * Phase 4: start an on-demand single-SKU count session. Used when a driver
   * or PM picks an item from the search box and counts just that one.
   * Sessions are short-lived (totalItems = 1, auto-completes on recordCount).
   */
  async initiateItemCount(
    productId: string,
    startedBy: string,
    startedByName: string,
  ): Promise<CountSession | null> {
    await this.ensureLoaded();
    const resolved = resolveProductId(productId);
    const item = this.inventory.find(i => i.productId === resolved && i.active);
    if (!item) return null;

    const sessionId = `ITM-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${String(this.nextIds.cnt++).padStart(3, '0')}`;
    const session: CountSession = {
      sessionId,
      startedAt: new Date().toISOString(),
      startedBy,
      startedByName,
      status: 'in_progress',
      countSessionType: 'item',
      scopedProductIds: [item.productId],
      totalItems: 1,
      countedItems: 0,
      discrepancies: 0,
      resolvedDiscrepancies: 0,
      notes: `Item count: ${item.productName}`,
    };
    this.countSessions.unshift(session);
    await this._persistCountSession(session).catch((err) =>
      console.error('[inventory] initiateItemCount persist failed:', err)
    );
    return session;
  }

  async recordCount(
    sessionId: string,
    productId: string,
    countedQty: number,
    countedBy: string,
    countedByName: string,
    photoUrl?: string,
    notes?: string
  ): Promise<CountRecord | null> {
    await this.ensureLoaded();
    const session = this.countSessions.find(s => s.sessionId === sessionId && s.status === 'in_progress');
    if (!session) return null;

    const resolved = resolveProductId(productId);
    const item = this.inventory.find(i => i.productId === resolved);
    if (!item) return null;

    const existing = this.countRecords.findIndex(r => r.sessionId === sessionId && r.productId === resolved);
    const record: CountRecord = {
      recordId: `REC-${String(this.nextIds.rec++).padStart(6, '0')}`,
      sessionId,
      productId: resolved,
      productName: item.productName,
      systemQty: item.currentQty,
      countedQty,
      discrepancy: countedQty - item.currentQty,
      countedBy,
      countedByName,
      countedAt: new Date().toISOString(),
      photoUrl,
      notes,
      resolved: countedQty === item.currentQty,
      resolution: countedQty === item.currentQty ? 'no_action' : undefined,
    };

    if (existing >= 0) {
      this.countRecords[existing] = record;
    } else {
      this.countRecords.push(record);
      session.countedItems++;
    }

    session.discrepancies = this.countRecords.filter(r => r.sessionId === sessionId && r.discrepancy !== 0 && !r.resolved).length;

    if (session.countedItems >= session.totalItems) {
      session.status = 'completed';
      session.completedAt = new Date().toISOString();
    }

    await this._persistCountSession(session).catch((err) =>
      console.error('[inventory] recordCount persist failed:', err)
    );
    return record;
  }

  async resolveDiscrepancy(
    recordId: string,
    resolution: CountRecord['resolution'],
    adjustedQty: number,
    reason: CountRecord['reason'],
    resolvedBy: string
  ): Promise<boolean> {
    await this.ensureLoaded();
    const record = this.countRecords.find(r => r.recordId === recordId && !r.resolved);
    if (!record) return false;

    record.resolved = true;
    record.resolution = resolution;
    record.adjustedQty = adjustedQty;
    record.resolvedBy = resolvedBy;
    record.resolvedAt = new Date().toISOString();
    record.reason = reason;

    // Build all persists then await them in parallel at the end
    const persistPromises: Promise<unknown>[] = [];

    if (resolution === 'adjust_system') {
      const item = this.inventory.find(i => i.productId === record.productId);
      if (item) {
        const prevQty = item.currentQty;
        item.currentQty = adjustedQty;
        item.availableQty = item.currentQty - item.holdQty;
        item.lastCountDate = new Date().toISOString().split('T')[0];
        item.lastCountBy = resolvedBy;
        persistPromises.push(this._persistItem(item));

        // Log the adjustment
        const txn: InventoryTransaction = {
          transactionId: `TXN-${String(this.nextIds.txn++).padStart(6, '0')}`,
          productId: record.productId,
          productName: record.productName,
          type: 'count',
          quantity: adjustedQty - prevQty,
          referenceId: record.sessionId,
          referenceType: 'count_session',
          performedBy: resolvedBy,
          performedByName: resolvedBy,
          timestamp: new Date().toISOString(),
          notes: `Count adjustment: ${reason || 'count discrepancy'}`,
          previousQty: prevQty,
          newQty: adjustedQty,
        };
        this.transactions.push(txn);
        persistPromises.push(this._persistTransaction(txn));
      }
    }

    // Update session
    const session = this.countSessions.find(s => s.sessionId === record.sessionId);
    if (session) {
      session.resolvedDiscrepancies = this.countRecords.filter(r => r.sessionId === session.sessionId && r.discrepancy !== 0 && r.resolved).length;
      session.discrepancies = this.countRecords.filter(r => r.sessionId === session.sessionId && r.discrepancy !== 0 && !r.resolved).length;
      persistPromises.push(this._persistCountSession(session));
    }

    // AWAIT all persists in parallel before returning
    const results = await Promise.allSettled(persistPromises);
    for (const r of results) {
      if (r.status === 'rejected') {
        console.error('[inventory] resolveDiscrepancy persist rejected:', r.reason);
      }
    }

    return true;
  }

  async getCountSessions(): Promise<CountSession[]> {
    await this.ensureLoaded();
    return [...this.countSessions].sort((a, b) => b.startedAt.localeCompare(a.startedAt));
  }

  async getCountRecords(sessionId: string): Promise<CountRecord[]> {
    await this.ensureLoaded();
    return this.countRecords.filter(r => r.sessionId === sessionId);
  }

  async getActiveCountSession(): Promise<CountSession | undefined> {
    await this.ensureLoaded();
    return this.countSessions.find(s => s.status === 'in_progress');
  }

  // ============================================
  // STOCK ALERTS
  // ============================================

  async getStockAlerts(): Promise<StockAlert[]> {
    await this.ensureLoaded();
    return this.inventory
      .filter(i => i.active && i.currentQty < effectiveReorderPoint(i))
      .map(item => {
        const threshold = effectiveReorderPoint(item);
        let severity: AlertSeverity = 'warning';
        if (item.currentQty === 0) severity = 'out_of_stock';
        else if (item.currentQty <= threshold * 0.25) severity = 'critical';

        const dailyUsage = Math.max(1, (item.maxStockLevel - item.currentQty) / 30);
        return {
          productId: item.productId,
          productName: item.productName,
          category: item.category,
          currentQty: item.currentQty,
          availableQty: item.availableQty,
          minStockLevel: item.minStockLevel,
          severity,
          daysUntilStockout: item.currentQty > 0 ? Math.round(item.currentQty / dailyUsage) : 0,
          location: item.location,
          supplier: item.supplier,
        };
      })
      .sort((a, b) => {
        const order: Record<AlertSeverity, number> = { out_of_stock: 0, critical: 1, warning: 2 };
        return order[a.severity] - order[b.severity];
      });
  }

  /**
   * Phase 4: Items where currentQty < reorderPoint (or minStockLevel if no
   * reorderPoint set). Different from getCriticalItems — this is the trigger
   * threshold for auto-PO drafts, not the "we're nearly out" critical line.
   */
  async getLowStockItems(): Promise<InventoryItem[]> {
    await this.ensureLoaded();
    return this.inventory
      .filter(i => i.active && i.currentQty < effectiveReorderPoint(i))
      .sort((a, b) => {
        // Sort by deficit severity: largest gap first
        const aDeficit = effectiveReorderPoint(a) - a.currentQty;
        const bDeficit = effectiveReorderPoint(b) - b.currentQty;
        return bDeficit - aDeficit;
      });
  }

  async getCriticalItems(): Promise<InventoryItem[]> {
    await this.ensureLoaded();
    return this.inventory.filter(i => {
      const threshold = effectiveReorderPoint(i);
      return i.active && (i.currentQty === 0 || i.currentQty <= threshold * 0.25);
    });
  }

  /**
   * Phase 4: Auto-generate a draft restock PO for every low-stock item that
   * doesn't already have a draft PO for it. Drafts are grouped by
   * preferredVendorId (one PO per vendor). Returns the list of draft order
   * IDs created. Safe to call on every page load — it's idempotent because
   * it checks for an existing draft containing the productId before adding.
   */
  async ensureRestockDrafts(createdBy: string = 'system', createdByName: string = 'Auto-Reorder'): Promise<string[]> {
    await this.ensureLoaded();
    const lowItems = await this.getLowStockItems();
    if (lowItems.length === 0) return [];

    // Collect productIds already on draft POs so we don't double up.
    const draftedProductIds = new Set<string>();
    for (const order of this.restockOrders) {
      if (order.status === 'draft') {
        for (const line of order.items) draftedProductIds.add(line.productId);
      }
    }

    // Group items by vendor (preferredVendorId || supplier name || 'Unassigned')
    const byVendor = new Map<string, InventoryItem[]>();
    for (const item of lowItems) {
      if (draftedProductIds.has(item.productId)) continue;
      const vendorKey = item.preferredVendorId || item.supplier || 'Unassigned';
      if (!byVendor.has(vendorKey)) byVendor.set(vendorKey, []);
      byVendor.get(vendorKey)!.push(item);
    }

    const createdOrderIds: string[] = [];
    for (const [vendorKey, items] of byVendor) {
      const order = await this.createRestockOrder(
        items.map(i => ({
          productId: i.productId,
          orderQty: i.reorderQty > 0 ? i.reorderQty : Math.max(1, Math.ceil(effectiveReorderPoint(i) * 2 - i.currentQty)),
        })),
        createdBy,
        createdByName,
        vendorKey,
        'Auto-generated draft: items below reorder point.',
      );
      createdOrderIds.push(order.orderId);
    }
    return createdOrderIds;
  }

  // ============================================
  // PRICING
  // ============================================

  async getPricingReport(): Promise<PricingReport[]> {
    await this.ensureLoaded();
    return this.inventory.filter(i => i.active).map(item => {
      const markup = item.unitCost > 0 ? ((item.unitPrice - item.unitCost) / item.unitCost) * 100 : 0;
      const marginPercent = item.unitPrice > 0 ? ((item.unitPrice - item.unitCost) / item.unitPrice) * 100 : 0;
      let flag: PricingReport['flag'] = undefined;
      if (item.unitPrice < item.unitCost) flag = 'negative_margin';
      else if (markup < 10) flag = 'low_markup';
      else if (markup > 200) flag = 'high_markup';
      return {
        productId: item.productId,
        productName: item.productName,
        category: item.category,
        unitCost: item.unitCost,
        unitPrice: item.unitPrice,
        markup: Math.round(markup * 10) / 10,
        marginPercent: Math.round(marginPercent * 10) / 10,
        flag,
      };
    });
  }

  async updatePricing(
    productId: string,
    newCost: number,
    newPrice: number,
    changedBy: string,
    reason?: string
  ): Promise<InventoryItem | null> {
    await this.ensureLoaded();
    const resolved = resolveProductId(productId);
    const item = this.inventory.find(i => i.productId === resolved);
    if (!item) return null;

    const record: PricingRecord = {
      recordId: `PRC-${String(this.nextIds.prc++).padStart(5, '0')}`,
      productId: resolved,
      productName: item.productName,
      date: new Date().toISOString().split('T')[0],
      oldCost: item.unitCost,
      newCost,
      oldPrice: item.unitPrice,
      newPrice,
      changedBy,
      reason,
    };
    this.pricingHistory.push(record);

    item.unitCost = newCost;
    item.unitPrice = newPrice;
    await this._persistItem(item).catch((err) =>
      console.error('[inventory] updatePricing persist failed:', err)
    );
    return item;
  }

  async getPricingHistory(productId: string): Promise<PricingRecord[]> {
    await this.ensureLoaded();
    const resolved = resolveProductId(productId);
    return this.pricingHistory.filter(p => p.productId === resolved).sort((a, b) => b.date.localeCompare(a.date));
  }

  // ============================================
  // RESTOCK ORDERS
  // ============================================

  async createRestockOrder(
    items: { productId: string; orderQty: number }[],
    createdBy: string,
    createdByName: string,
    supplier?: string,
    notes?: string
  ): Promise<RestockOrder> {
    await this.ensureLoaded();
    const orderId = `PO-${new Date().getFullYear()}-${String(this.nextIds.rst++).padStart(3, '0')}`;

    const orderItems: RestockOrderItem[] = items.map(req => {
      const resolved = resolveProductId(req.productId);
      const inv = this.inventory.find(i => i.productId === resolved);
      return {
        productId: resolved,
        productName: inv?.productName || 'Unknown',
        sku: inv?.sku || '',
        orderQty: req.orderQty,
        unitCost: inv?.unitCost || 0,
        totalCost: (inv?.unitCost || 0) * req.orderQty,
      };
    });

    const order: RestockOrder = {
      orderId,
      supplier: supplier || orderItems[0]?.productName ? (this.inventory.find(i => i.productId === orderItems[0]?.productId)?.supplier || 'Unknown') : 'Unknown',
      status: 'draft',
      items: orderItems,
      totalCost: Math.round(orderItems.reduce((sum, i) => sum + i.totalCost, 0) * 100) / 100,
      createdAt: new Date().toISOString(),
      createdBy,
      createdByName,
      notes,
    };

    this.restockOrders.unshift(order);
    return order;
  }

  async getRestockOrders(status?: RestockOrderStatus): Promise<RestockOrder[]> {
    await this.ensureLoaded();
    let orders = [...this.restockOrders];
    if (status) orders = orders.filter(o => o.status === status);
    return orders.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async updateRestockStatus(orderId: string, status: RestockOrderStatus, updatedBy?: string): Promise<RestockOrder | null> {
    await this.ensureLoaded();
    const order = this.restockOrders.find(o => o.orderId === orderId);
    if (!order) return null;
    order.status = status;
    if (status === 'approved' && updatedBy) { order.approvedBy = updatedBy; order.approvedAt = new Date().toISOString(); }
    if (status === 'ordered') order.orderedAt = new Date().toISOString();
    if (status === 'shipped') order.shippedAt = new Date().toISOString();
    if (status === 'received') order.receivedAt = new Date().toISOString();
    return order;
  }

  async receiveRestock(orderId: string, receivedItems: { productId: string; receivedQty: number }[], receivedBy: string, receivedByName: string): Promise<RestockOrder | null> {
    // Legacy fast-path: trusts quoted unit cost. New code should call
    // receiveAndVerifyRestock to capture actual invoice costs.
    return this.receiveAndVerifyRestock(
      orderId,
      receivedItems.map(r => ({ productId: r.productId, receivedQty: r.receivedQty })),
      receivedBy,
      receivedByName,
    );
  }

  /**
   * Receive a restock order with explicit count + cost verification.
   *
   * Each line carries:
   *   - receivedQty: physical count taken at the warehouse
   *   - actualUnitCost?: supplier-invoiced cost. When provided AND ≠ the
   *     quoted unitCost on the order, inventory.unitCost is updated to the
   *     actual cost and a PricingRecord is written for audit. When omitted,
   *     the quoted cost is trusted.
   *
   * Sets the order's countVerifiedAt/By and costVerifiedAt/By markers so
   * downstream reporting can show both gates were passed. Discrepancies are
   * captured per-line (countMatchesOrder, costMatchesQuote) and returned to
   * the caller so admin UIs can highlight them.
   */
  async receiveAndVerifyRestock(
    orderId: string,
    receivedItems: { productId: string; receivedQty: number; actualUnitCost?: number }[],
    receivedBy: string,
    receivedByName: string,
    notes?: string,
  ): Promise<RestockOrder | null> {
    await this.ensureLoaded();
    const order = this.restockOrders.find(o => o.orderId === orderId);
    if (!order) return null;

    const now = new Date().toISOString();
    let actualTotalCost = 0;

    for (const received of receivedItems) {
      const resolved = resolveProductId(received.productId);
      const orderItem = order.items.find(i => i.productId === resolved);
      if (!orderItem) {
        // Line was received but not on the original order — log + continue;
        // do not silently drop, and do not increment inventory for it here.
        console.warn(`[restock] Received item not on order ${orderId}: ${resolved}`);
        continue;
      }

      orderItem.receivedQty = received.receivedQty;
      orderItem.receivedAt = now;
      orderItem.countMatchesOrder = received.receivedQty === orderItem.orderQty;

      if (typeof received.actualUnitCost === 'number') {
        orderItem.actualUnitCost = received.actualUnitCost;
        orderItem.costMatchesQuote =
          Math.abs(received.actualUnitCost - orderItem.unitCost) < 0.005;

        if (!orderItem.costMatchesQuote) {
          // Cost basis change. Carry forward existing unitPrice (selling
          // price) unchanged — that's a separate margin decision.
          const inv = this.inventory.find(i => i.productId === resolved);
          if (inv) {
            await this.updatePricing(
              resolved,
              received.actualUnitCost,
              inv.unitPrice,
              receivedByName,
              `Restock PO ${orderId}: supplier-invoiced cost ${received.actualUnitCost.toFixed(2)} ≠ quoted ${orderItem.unitCost.toFixed(2)}`,
            );
          }
        }
        actualTotalCost += received.actualUnitCost * received.receivedQty;
      } else {
        orderItem.costMatchesQuote = true;
        actualTotalCost += orderItem.unitCost * received.receivedQty;
      }

      await this.addStock(
        resolved,
        received.receivedQty,
        'restock',
        orderId,
        'restock_order',
        receivedBy,
        receivedByName,
        `Restock from PO ${orderId}` + (notes ? ` — ${notes}` : ''),
      );
    }

    order.status = 'received';
    order.receivedAt = now;
    order.receivedBy = receivedBy;
    order.receivedByName = receivedByName;
    order.countVerifiedAt = now;
    order.countVerifiedBy = receivedByName;
    order.costVerifiedAt = now;
    order.costVerifiedBy = receivedByName;
    order.actualTotalCost = Math.round(actualTotalCost * 100) / 100;
    if (notes) order.notes = order.notes ? `${order.notes}\n${notes}` : notes;

    return order;
  }

  async getRestockSuggestions(): Promise<{ productId: string; productName: string; currentQty: number; minStockLevel: number; reorderPoint: number; suggestedQty: number; supplier: string; preferredVendorId?: string; estimatedCost: number }[]> {
    await this.ensureLoaded();
    return this.inventory
      .filter(i => i.active && i.currentQty < effectiveReorderPoint(i))
      .map(item => ({
        productId: item.productId,
        productName: item.productName,
        currentQty: item.currentQty,
        minStockLevel: item.minStockLevel,
        reorderPoint: effectiveReorderPoint(item),
        suggestedQty: item.reorderQty,
        supplier: item.supplier,
        preferredVendorId: item.preferredVendorId,
        estimatedCost: Math.round(item.reorderQty * item.unitCost * 100) / 100,
      }));
  }

  // ============================================
  // RETURN TICKETS
  // ============================================

  async createReturnTicket(data: {
    type: ReturnType;
    orderId?: string;
    jobId?: string;
    jobName?: string;
    items: ReturnItem[];
    distributor?: string;
    createdBy: string;
    createdByName: string;
    notes: string;
  }): Promise<ReturnTicket> {
    await this.ensureLoaded();
    const ticketId = `RTN-${new Date().getFullYear()}-${String(this.nextIds.ret++).padStart(4, '0')}`;
    const ticket: ReturnTicket = {
      ticketId,
      type: data.type,
      status: 'created',
      orderId: data.orderId,
      jobId: data.jobId,
      jobName: data.jobName,
      items: data.items,
      distributor: data.distributor,
      createdAt: new Date().toISOString(),
      createdBy: data.createdBy,
      createdByName: data.createdByName,
      pickupPhotos: [],
      transitPhotos: [],
      deliveryPhotos: [],
      notes: data.notes,
    };
    this.returnTickets.unshift(ticket);
    await this._persistReturnTicket(ticket).catch((err) =>
      console.error('[inventory] createReturnTicket persist failed:', err)
    );
    return ticket;
  }

  async updateReturnStatus(
    ticketId: string,
    status: ReturnStatus,
    updates?: Partial<Pick<ReturnTicket, 'pickupPhotos' | 'transitPhotos' | 'deliveryPhotos' | 'gpsPickup' | 'gpsDelivery' | 'creditMemoNumber' | 'creditAmount' | 'notes'>>
  ): Promise<ReturnTicket | null> {
    await this.ensureLoaded();
    const ticket = this.returnTickets.find(t => t.ticketId === ticketId);
    if (!ticket) return null;

    ticket.status = status;
    if (updates) {
      if (updates.pickupPhotos) ticket.pickupPhotos.push(...updates.pickupPhotos);
      if (updates.transitPhotos) ticket.transitPhotos.push(...updates.transitPhotos);
      if (updates.deliveryPhotos) ticket.deliveryPhotos.push(...updates.deliveryPhotos);
      if (updates.gpsPickup) ticket.gpsPickup = updates.gpsPickup;
      if (updates.gpsDelivery) ticket.gpsDelivery = updates.gpsDelivery;
      if (updates.creditMemoNumber) ticket.creditMemoNumber = updates.creditMemoNumber;
      if (updates.creditAmount !== undefined) ticket.creditAmount = updates.creditAmount;
      if (updates.notes) ticket.notes = updates.notes;
    }

    // If return is received at warehouse, add stock back
    if (status === 'received' && ticket.type === 'return_to_warehouse') {
      for (const item of ticket.items) {
        await this.addStock(item.productId, item.quantity, 'return', ticketId, 'return_ticket', ticket.createdBy, ticket.createdByName, `Return from ${ticket.jobName || ticket.orderId || 'unknown'}`);
      }
    }

    // On any received transition, sync a material credit to the matching
    // CustomerBreakdown so job costing reflects the returned material.
    // Wrapped so a breakdown lookup failure never blocks inventory restock.
    if (status === 'received') {
      try {
        const { syncReturnToBreakdown } = await import('./customer-breakdown-service');
        const result = await syncReturnToBreakdown({
          ticketId: ticket.ticketId,
          jobNumber: (ticket as any).jobNumber || ticket.jobId,
          jobId: ticket.jobId,
          items: ticket.items,
          distributor: ticket.distributor,
        });
        if (!result.success) {
          console.warn('[returns] Breakdown sync skipped:', result.reason);
        } else {
          console.log('[returns] Breakdown synced:', result.breakdownId, 'credit:', result.creditAmount);
        }
      } catch (err) {
        console.error('[returns] Breakdown sync failed (non-fatal):', err);
      }
    }

    if (status === 'completed') {
      ticket.completedAt = new Date().toISOString();
    }

    await this._persistReturnTicket(ticket).catch((err) =>
      console.error('[inventory] updateReturnStatus persist failed:', err)
    );

    // Audit log — fire and forget, never break the underlying business logic
    try {
      const { auditLog } = await import('./audit-logger');
      const updatedBy = ticket.createdBy || 'system';
      auditLog(
        'RETURN_STATUS_CHANGED',
        updatedBy,
        `Return ticket ${ticketId} status changed to ${status}. Items: ${ticket.items.length}. Credit: $${ticket.creditAmount || 0}.`
      );
    } catch (err) {
      console.warn('[audit] RETURN_STATUS_CHANGED log failed:', err);
    }

    return ticket;
  }

  async getReturnTickets(type?: ReturnType, status?: ReturnStatus): Promise<ReturnTicket[]> {
    await this.ensureLoaded();
    let tickets = [...this.returnTickets];
    if (type) tickets = tickets.filter(t => t.type === type);
    if (status) tickets = tickets.filter(t => t.status === status);
    return tickets.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async getReturnTicketById(ticketId: string): Promise<ReturnTicket | undefined> {
    await this.ensureLoaded();
    return this.returnTickets.find(t => t.ticketId === ticketId);
  }

  // ============================================
  // REPORTS & STATS
  // ============================================

  async getInventoryValue(): Promise<{ totalCost: number; totalRetail: number; itemCount: number; holdValue: number }> {
    await this.ensureLoaded();
    const active = this.inventory.filter(i => i.active);
    return {
      totalCost: Math.round(active.reduce((sum, i) => sum + i.currentQty * i.unitCost, 0) * 100) / 100,
      totalRetail: Math.round(active.reduce((sum, i) => sum + i.currentQty * i.unitPrice, 0) * 100) / 100,
      itemCount: active.length,
      holdValue: Math.round(active.reduce((sum, i) => sum + i.holdQty * i.unitCost, 0) * 100) / 100,
    };
  }

  async getCategoryBreakdown(): Promise<{ category: InventoryCategory; label: string; itemCount: number; totalQty: number; totalCostValue: number; totalRetailValue: number }[]> {
    await this.ensureLoaded();
    const categories = Object.keys(CATEGORY_LABELS) as InventoryCategory[];
    return categories.map(cat => {
      const items = this.inventory.filter(i => i.active && i.category === cat);
      return {
        category: cat,
        label: CATEGORY_LABELS[cat],
        itemCount: items.length,
        totalQty: items.reduce((sum, i) => sum + i.currentQty, 0),
        totalCostValue: Math.round(items.reduce((sum, i) => sum + i.currentQty * i.unitCost, 0) * 100) / 100,
        totalRetailValue: Math.round(items.reduce((sum, i) => sum + i.currentQty * i.unitPrice, 0) * 100) / 100,
      };
    }).filter(c => c.itemCount > 0);
  }

  async getSuppliers(): Promise<string[]> {
    await this.ensureLoaded();
    return [...new Set(this.inventory.filter(i => i.active).map(i => i.supplier))].sort();
  }

  async getRecentActivity(limit: number = 20): Promise<{ type: string; description: string; timestamp: string; by: string }[]> {
    await this.ensureLoaded();
    const activities: { type: string; description: string; timestamp: string; by: string }[] = [];

    // Recent transactions
    const recentTxns = this.transactions.slice(-limit).reverse();
    for (const txn of recentTxns) {
      activities.push({
        type: txn.type,
        description: `${txn.type === 'delivery' ? 'Delivered' : txn.type === 'restock' ? 'Restocked' : txn.type === 'return' ? 'Returned' : 'Adjusted'} ${Math.abs(txn.quantity)} ${txn.productName}`,
        timestamp: txn.timestamp,
        by: txn.performedByName,
      });
    }

    // Alerts
    const alerts = await this.getStockAlerts();
    for (const alert of alerts.slice(0, 5)) {
      activities.push({
        type: 'alert',
        description: `${alert.productName} is ${alert.severity === 'out_of_stock' ? 'OUT OF STOCK' : 'low stock'} (${alert.currentQty} remaining)`,
        timestamp: new Date().toISOString(),
        by: 'System',
      });
    }

    return activities.sort((a, b) => b.timestamp.localeCompare(a.timestamp)).slice(0, limit);
  }

  // ============================================
  // MATERIAL HOLDS
  // ============================================

  async getActiveHolds(orderId?: string): Promise<MaterialHold[]> {
    await this.ensureLoaded();
    let holds = this.materialHolds.filter(h => h.status === 'active');
    if (orderId) holds = holds.filter(h => h.orderId === orderId);
    return holds;
  }

  // ============================================
  // BACKWARD COMPATIBILITY - expose as old interfaces
  // ============================================

  /**
   * Get inventory in the format expected by the old inventoryData.ts consumers.
   */
  async getInventoryLegacyFormat(): Promise<{
    productId: string;
    productName: string;
    description: string;
    imageUrl: string;
    cost: number;
    price: number;
    category: string;
    unit: string;
    minQty: number;
    maxQty: number;
    currentQty: number;
    supplier: string;
    location: string;
  }[]> {
    await this.ensureLoaded();
    return this.inventory.filter(i => i.active).map(item => ({
      productId: item.legacyId || item.productId,
      productName: item.productName,
      description: item.description,
      imageUrl: '',
      cost: item.unitCost,
      price: item.unitPrice,
      category: CATEGORY_LABELS[item.category] || item.category,
      unit: item.unit,
      minQty: item.minStockLevel,
      maxQty: item.maxStockLevel,
      currentQty: item.currentQty,
      supplier: item.supplier,
      location: item.location,
    }));
  }

  /**
   * Get inventory in Command Center format with role-based filtering.
   */
  async getInventoryForRole(role: string): Promise<Record<string, unknown>[]> {
    await this.ensureLoaded();
    const items = this.inventory.filter(i => i.active);

    if (role === 'driver' || role === 'warehouse') {
      return items.map(i => ({
        sku: i.sku,
        name: i.productName,
        quantity: i.currentQty,
        unit: i.unit,
        location: i.location,
      }));
    }

    if (role === 'sales' || role === 'pm') {
      return items.map(i => ({
        sku: i.sku,
        productId: i.productId,
        name: i.productName,
        description: i.description,
        category: CATEGORY_LABELS[i.category],
        quantity: i.currentQty,
        availableQty: i.availableQty,
        minStock: i.minStockLevel,
        unit: i.unit,
        location: i.location,
        price: i.unitPrice,
      }));
    }

    // Admin, office, owner â€” full details
    return items.map(i => ({
      productId: i.productId,
      legacyId: i.legacyId,
      sku: i.sku,
      name: i.productName,
      description: i.description,
      category: CATEGORY_LABELS[i.category],
      cost: i.unitCost,
      price: i.unitPrice,
      quantity: i.currentQty,
      holdQty: i.holdQty,
      availableQty: i.availableQty,
      minStock: i.minStockLevel,
      maxStock: i.maxStockLevel,
      reorderPoint: effectiveReorderPoint(i),
      preferredVendorId: i.preferredVendorId,
      unit: i.unit,
      supplier: i.supplier,
      location: i.location,
      lastUpdated: i.lastCountDate || i.lastRestockDate || '',
      weight: i.weight,
      notes: i.notes,
    }));
  }
}

// ============================================
// SINGLETON EXPORT
// ============================================

export const unifiedInventoryService = new UnifiedInventoryService();

// Re-export for backward compatibility
export { unifiedInventoryService as inventoryManagementService };
