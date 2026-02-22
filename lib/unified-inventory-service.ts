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

import { GoogleSpreadsheet, GoogleSpreadsheetRow } from 'google-spreadsheet';
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
  INVENTORY: 'Inventory',
  TRANSACTIONS: 'InventoryTransactions',
  COUNT_SESSIONS: 'CountSessions',
  COUNT_RECORDS: 'CountRecords',
  RESTOCK_ORDERS: 'RestockOrders',
  RESTOCK_ITEMS: 'RestockItems',
  PRICING_HISTORY: 'PricingHistory',
  MATERIAL_HOLDS: 'MaterialHolds',
  RETURN_TICKETS: 'ReturnTickets',
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

export interface CountSession {
  sessionId: string;
  startedAt: string;
  startedBy: string;
  startedByName: string;
  status: 'in_progress' | 'completed' | 'cancelled';
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
  // System 1 (inventoryData.ts) item-XXX → INV-XXXX
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
  // System 3 (data/inventory.json) SKU-based → INV-XXXX
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

// The canonical catalog — all 38+ items merged from all systems
const UNIFIED_CATALOG: Omit<InventoryItem, 'availableQty'>[] = [
  // === SHINGLES (from System 2's comprehensive catalog) ===
  { productId: 'INV-0001', legacyId: undefined, legacySku: 'GAF-THDZ-CHAR', productName: 'GAF Timberline HDZ - Charcoal', description: 'Architectural shingles, charcoal color', category: 'shingles', sku: 'GAF-THDZ-CHAR', unit: 'bundle', currentQty: 0, holdQty: 0, minStockLevel: 20, maxStockLevel: 200, reorderQty: 50, unitCost: 32.50, unitPrice: 48.75, supplier: 'GAF Materials', supplierPartNumber: 'THDZ-CHAR', location: 'Warehouse A - Bay 1', weight: 70, lastCountDate: '', lastCountBy: '', lastRestockDate: '', notes: '', active: true },
  { productId: 'INV-0002', legacyId: undefined, legacySku: 'GAF-THDZ-WGRY', productName: 'GAF Timberline HDZ - Weathered Wood', description: 'Architectural shingles, weathered wood color', category: 'shingles', sku: 'GAF-THDZ-WGRY', unit: 'bundle', currentQty: 0, holdQty: 0, minStockLevel: 20, maxStockLevel: 200, reorderQty: 50, unitCost: 32.50, unitPrice: 48.75, supplier: 'GAF Materials', supplierPartNumber: 'THDZ-WWOOD', location: 'Warehouse A - Bay 1', weight: 70, lastCountDate: '', lastCountBy: '', lastRestockDate: '', notes: '', active: true },
  { productId: 'INV-0003', legacyId: undefined, legacySku: 'GAF-THDZ-BARK', productName: 'GAF Timberline HDZ - Barkwood', description: 'Architectural shingles, barkwood color', category: 'shingles', sku: 'GAF-THDZ-BARK', unit: 'bundle', currentQty: 0, holdQty: 0, minStockLevel: 15, maxStockLevel: 150, reorderQty: 40, unitCost: 32.50, unitPrice: 48.75, supplier: 'GAF Materials', supplierPartNumber: 'THDZ-BARK', location: 'Warehouse A - Bay 1', weight: 70, lastCountDate: '', lastCountBy: '', lastRestockDate: '', notes: '', active: true },
  { productId: 'INV-0004', legacyId: undefined, legacySku: 'GAF-THDZ-SLATE', productName: 'GAF Timberline HDZ - Slate', description: 'Architectural shingles, slate color', category: 'shingles', sku: 'GAF-THDZ-SLATE', unit: 'bundle', currentQty: 0, holdQty: 0, minStockLevel: 15, maxStockLevel: 150, reorderQty: 40, unitCost: 32.50, unitPrice: 48.75, supplier: 'GAF Materials', supplierPartNumber: 'THDZ-SLATE', location: 'Warehouse A - Bay 1', weight: 70, lastCountDate: '', lastCountBy: '', lastRestockDate: '', notes: '', active: true },
  { productId: 'INV-0005', legacyId: undefined, legacySku: 'GAF-THDZ-PEWTR', productName: 'GAF Timberline HDZ - Pewter Gray', description: 'Architectural shingles, pewter gray color', category: 'shingles', sku: 'GAF-THDZ-PEWTR', unit: 'bundle', currentQty: 0, holdQty: 0, minStockLevel: 10, maxStockLevel: 100, reorderQty: 30, unitCost: 32.50, unitPrice: 48.75, supplier: 'GAF Materials', supplierPartNumber: 'THDZ-PEWTR', location: 'Warehouse A - Bay 1', weight: 70, lastCountDate: '', lastCountBy: '', lastRestockDate: '', notes: '', active: true },
  { productId: 'INV-0006', legacyId: undefined, legacySku: 'GAF-SRR-CHAR', productName: 'GAF Seal-A-Ridge - Charcoal', description: 'Hip and ridge cap shingles, charcoal', category: 'shingles', sku: 'GAF-SRR-CHAR', unit: 'bundle', currentQty: 0, holdQty: 0, minStockLevel: 10, maxStockLevel: 100, reorderQty: 25, unitCost: 58.00, unitPrice: 87.00, supplier: 'GAF Materials', supplierPartNumber: 'SRR-CHAR', location: 'Warehouse A - Bay 2', weight: 35, lastCountDate: '', lastCountBy: '', lastRestockDate: '', notes: '', active: true },
  { productId: 'INV-0007', legacyId: undefined, legacySku: 'GAF-SRR-WGRY', productName: 'GAF Seal-A-Ridge - Weathered Wood', description: 'Hip and ridge cap shingles, weathered wood', category: 'shingles', sku: 'GAF-SRR-WGRY', unit: 'bundle', currentQty: 0, holdQty: 0, minStockLevel: 10, maxStockLevel: 100, reorderQty: 25, unitCost: 58.00, unitPrice: 87.00, supplier: 'GAF Materials', supplierPartNumber: 'SRR-WWOOD', location: 'Warehouse A - Bay 2', weight: 35, lastCountDate: '', lastCountBy: '', lastRestockDate: '', notes: '', active: true },
  { productId: 'INV-0008', legacyId: undefined, legacySku: 'GAF-STRT-SA', productName: 'GAF Pro-Start Starter Strip', description: 'Starter strip shingles for eaves and rakes', category: 'shingles', sku: 'GAF-STRT-SA', unit: 'bundle', currentQty: 0, holdQty: 0, minStockLevel: 15, maxStockLevel: 150, reorderQty: 40, unitCost: 45.00, unitPrice: 67.50, supplier: 'GAF Materials', supplierPartNumber: 'STRT-SA', location: 'Warehouse A - Bay 2', weight: 25, lastCountDate: '', lastCountBy: '', lastRestockDate: '', notes: '', active: true },

  // === UNDERLAYMENT ===
  { productId: 'INV-0009', legacyId: undefined, legacySku: 'GAF-DECK-ARM', productName: 'GAF Deck-Armor Premium', description: 'Premium breathable roof deck protection', category: 'underlayment', sku: 'GAF-DECK-ARM', unit: 'roll', currentQty: 0, holdQty: 0, minStockLevel: 10, maxStockLevel: 80, reorderQty: 20, unitCost: 125.00, unitPrice: 187.50, supplier: 'GAF Materials', supplierPartNumber: 'DA-PREM', location: 'Warehouse B - Bay 1', weight: 40, lastCountDate: '', lastCountBy: '', lastRestockDate: '', notes: '', active: true },
  { productId: 'INV-0010', legacyId: undefined, legacySku: 'GAF-FELTR-15', productName: 'GAF FeltBuster 15# Synthetic', description: '#15 synthetic underlayment', category: 'underlayment', sku: 'GAF-FELTR-15', unit: 'roll', currentQty: 0, holdQty: 0, minStockLevel: 15, maxStockLevel: 120, reorderQty: 30, unitCost: 55.00, unitPrice: 82.50, supplier: 'GAF Materials', supplierPartNumber: 'FB-15', location: 'Warehouse B - Bay 1', weight: 30, lastCountDate: '', lastCountBy: '', lastRestockDate: '', notes: '', active: true },
  { productId: 'INV-0011', legacyId: undefined, legacySku: 'GAF-SGLR', productName: 'GAF StormGuard Leak Barrier', description: 'Film-surfaced leak barrier', category: 'underlayment', sku: 'GAF-SGLR', unit: 'roll', currentQty: 0, holdQty: 0, minStockLevel: 8, maxStockLevel: 60, reorderQty: 15, unitCost: 95.00, unitPrice: 142.50, supplier: 'GAF Materials', supplierPartNumber: 'SG-LB', location: 'Warehouse B - Bay 1', weight: 55, lastCountDate: '', lastCountBy: '', lastRestockDate: '', notes: '', active: true },

  // === Items from System 1 (inventoryData.ts) — now with INV IDs ===
  { productId: 'INV-0012', legacyId: 'item-123', legacySku: 'NAIL-125-EG', productName: '1 1/4 EG Nails', description: 'Electro-galvanized roofing nails, 1-1/4 inch. 15-18 Sq. per box', category: 'nails_fasteners', sku: 'NAIL-125-EG', unit: 'box', currentQty: 0, holdQty: 0, minStockLevel: 10, maxStockLevel: 100, reorderQty: 30, unitCost: 27.50, unitPrice: 64.90, supplier: 'ABC Supply', supplierPartNumber: '', location: 'Warehouse A', weight: 30, lastCountDate: '', lastCountBy: '', lastRestockDate: '', notes: '', active: true },
  { productId: 'INV-0013', legacyId: 'item-124', legacySku: 'CAP-PLST', productName: 'Bottom Caps (plastic)', description: 'Plastic cap nails for underlayment. 25-35 SQ per bucket by pitch', category: 'nails_fasteners', sku: 'CAP-PLST', unit: 'bag', currentQty: 0, holdQty: 0, minStockLevel: 20, maxStockLevel: 200, reorderQty: 50, unitCost: 16.50, unitPrice: 29.15, supplier: 'ABC Supply', supplierPartNumber: '', location: 'Warehouse A', weight: 15, lastCountDate: '', lastCountBy: '', lastRestockDate: '', notes: '', active: true },
  { productId: 'INV-0014', legacyId: 'item-125', legacySku: 'FELT-SYN-10', productName: 'RCRS Syn Felt', description: 'River City Roofing Solutions synthetic underlayment felt', category: 'underlayment', sku: 'FELT-SYN-10', unit: 'roll', currentQty: 0, holdQty: 0, minStockLevel: 15, maxStockLevel: 150, reorderQty: 40, unitCost: 66.00, unitPrice: 79.86, supplier: 'IKO Industries', supplierPartNumber: '', location: 'Warehouse B', weight: 35, lastCountDate: '', lastCountBy: '', lastRestockDate: '', notes: '', active: true },
  { productId: 'INV-0015', legacyId: 'item-126', legacySku: 'ICE-WATER-2', productName: 'Ice & Water Shield', description: 'Self-adhering ice and water barrier membrane', category: 'underlayment', sku: 'ICE-WATER-2', unit: 'roll', currentQty: 0, holdQty: 0, minStockLevel: 10, maxStockLevel: 100, reorderQty: 25, unitCost: 62.70, unitPrice: 114.22, supplier: 'GAF Materials', supplierPartNumber: '', location: 'Warehouse B', weight: 50, lastCountDate: '', lastCountBy: '', lastRestockDate: '', notes: '', active: true },
  { productId: 'INV-0016', legacyId: 'item-127', legacySku: 'VENT-RIDGE-4', productName: 'Ridge Vent 4LF', description: '4 linear feet ridge vent for attic ventilation', category: 'ventilation', sku: 'VENT-RIDGE-4', unit: 'piece', currentQty: 0, holdQty: 0, minStockLevel: 50, maxStockLevel: 500, reorderQty: 100, unitCost: 7.15, unitPrice: 10.20, supplier: 'Air Vent Inc', supplierPartNumber: '', location: 'Warehouse A', weight: 3, lastCountDate: '', lastCountBy: '', lastRestockDate: '', notes: '', active: true },
  { productId: 'INV-0017', legacyId: 'item-128', legacySku: 'BOOT-BLK-15', productName: '1 1/2" Black Bullet Boot', description: '1.5 inch black EPDM pipe boot flashing', category: 'flashing', sku: 'BOOT-BLK-15', unit: 'each', currentQty: 0, holdQty: 0, minStockLevel: 25, maxStockLevel: 250, reorderQty: 50, unitCost: 16.67, unitPrice: 20.89, supplier: 'Oatey', supplierPartNumber: '', location: 'Warehouse A', weight: 1, lastCountDate: '', lastCountBy: '', lastRestockDate: '', notes: '', active: true },
  { productId: 'INV-0018', legacyId: 'item-129', legacySku: 'BOOT-BLK-2', productName: '2" Black Bullet Boot', description: '2 inch black EPDM pipe boot flashing', category: 'flashing', sku: 'BOOT-BLK-2', unit: 'each', currentQty: 0, holdQty: 0, minStockLevel: 25, maxStockLevel: 250, reorderQty: 50, unitCost: 17.77, unitPrice: 22.54, supplier: 'Oatey', supplierPartNumber: '', location: 'Warehouse A', weight: 1, lastCountDate: '', lastCountBy: '', lastRestockDate: '', notes: '', active: true },
  { productId: 'INV-0019', legacyId: 'item-130', legacySku: 'BOOT-BLK-3', productName: '3" Black Bullet Boot', description: '3 inch black EPDM pipe boot flashing', category: 'flashing', sku: 'BOOT-BLK-3', unit: 'each', currentQty: 0, holdQty: 0, minStockLevel: 20, maxStockLevel: 200, reorderQty: 50, unitCost: 20.19, unitPrice: 38.29, supplier: 'Oatey', supplierPartNumber: '', location: 'Warehouse A', weight: 1.5, lastCountDate: '', lastCountBy: '', lastRestockDate: '', notes: '', active: true },
  { productId: 'INV-0020', legacyId: 'item-131', legacySku: 'BOOT-BLK-4', productName: '4" Black Bullet Boot', description: '4 inch black EPDM pipe boot flashing', category: 'flashing', sku: 'BOOT-BLK-4', unit: 'each', currentQty: 0, holdQty: 0, minStockLevel: 15, maxStockLevel: 150, reorderQty: 40, unitCost: 37.48, unitPrice: 42.50, supplier: 'Oatey', supplierPartNumber: '', location: 'Warehouse A', weight: 2, lastCountDate: '', lastCountBy: '', lastRestockDate: '', notes: '', active: true },
  { productId: 'INV-0021', legacyId: 'item-132', legacySku: 'SEAL-TUBE', productName: 'Sealant', description: 'Roofing sealant for flashing and repairs', category: 'sealants', sku: 'SEAL-TUBE', unit: 'tube', currentQty: 0, holdQty: 0, minStockLevel: 50, maxStockLevel: 500, reorderQty: 100, unitCost: 9.35, unitPrice: 10.00, supplier: 'Geocel', supplierPartNumber: '', location: 'Warehouse A', weight: 1, lastCountDate: '', lastCountBy: '', lastRestockDate: '', notes: '', active: true },
  { productId: 'INV-0022', legacyId: 'item-133', legacySku: 'BOOT-ZIP', productName: 'Zipper Boot', description: 'Split boot pipe flashing for retrofit installations', category: 'flashing', sku: 'BOOT-ZIP', unit: 'each', currentQty: 0, holdQty: 0, minStockLevel: 10, maxStockLevel: 100, reorderQty: 25, unitCost: 37.40, unitPrice: 48.00, supplier: 'Oatey', supplierPartNumber: '', location: 'Warehouse A', weight: 1.5, lastCountDate: '', lastCountBy: '', lastRestockDate: '', notes: '', active: true },

  // === FLASHING (additional from System 2) ===
  { productId: 'INV-0023', legacyId: undefined, legacySku: 'FLASH-STEP-AL', productName: 'Step Flashing - Aluminum', description: '4x4 aluminum step flashing', category: 'flashing', sku: 'FLASH-STEP-AL', unit: 'piece', currentQty: 0, holdQty: 0, minStockLevel: 100, maxStockLevel: 1000, reorderQty: 200, unitCost: 0.75, unitPrice: 1.50, supplier: 'ABC Supply', supplierPartNumber: 'SF-AL-4', location: 'Warehouse A', weight: 0.1, lastCountDate: '', lastCountBy: '', lastRestockDate: '', notes: '', active: true },
  { productId: 'INV-0024', legacyId: undefined, legacySku: 'FLASH-DRIP-AL', productName: 'Drip Edge - Aluminum', description: '10ft aluminum drip edge', category: 'flashing', sku: 'FLASH-DRIP-AL', unit: 'piece', currentQty: 0, holdQty: 0, minStockLevel: 50, maxStockLevel: 500, reorderQty: 100, unitCost: 4.50, unitPrice: 8.00, supplier: 'ABC Supply', supplierPartNumber: 'DE-AL-10', location: 'Warehouse A', weight: 2, lastCountDate: '', lastCountBy: '', lastRestockDate: '', notes: '', active: true },
  { productId: 'INV-0025', legacyId: undefined, legacySku: 'FLASH-VALLEY', productName: 'Valley Flashing - W-Valley', description: '10ft W-valley metal flashing', category: 'flashing', sku: 'FLASH-VALLEY', unit: 'piece', currentQty: 0, holdQty: 0, minStockLevel: 20, maxStockLevel: 200, reorderQty: 50, unitCost: 12.00, unitPrice: 22.00, supplier: 'ABC Supply', supplierPartNumber: 'VF-W-10', location: 'Warehouse A', weight: 5, lastCountDate: '', lastCountBy: '', lastRestockDate: '', notes: '', active: true },

  // === LUMBER ===
  { productId: 'INV-0026', legacyId: undefined, legacySku: 'PLY-CDX-48', productName: 'Plywood CDX 4x8 1/2"', description: '4x8 ft CDX plywood, 1/2 inch thick', category: 'lumber', sku: 'PLY-CDX-48', unit: 'sheet', currentQty: 0, holdQty: 0, minStockLevel: 20, maxStockLevel: 100, reorderQty: 30, unitCost: 28.00, unitPrice: 45.00, supplier: "Lowe's", supplierPartNumber: '', location: 'Warehouse A - Lumber Rack', weight: 48, lastCountDate: '', lastCountBy: '', lastRestockDate: '', notes: '', active: true },
  { productId: 'INV-0027', legacyId: undefined, legacySku: 'OSB-48', productName: 'OSB 4x8 7/16"', description: '4x8 ft OSB sheathing, 7/16 inch thick', category: 'lumber', sku: 'OSB-48', unit: 'sheet', currentQty: 0, holdQty: 0, minStockLevel: 15, maxStockLevel: 80, reorderQty: 25, unitCost: 22.00, unitPrice: 38.00, supplier: "Lowe's", supplierPartNumber: '', location: 'Warehouse A - Lumber Rack', weight: 45, lastCountDate: '', lastCountBy: '', lastRestockDate: '', notes: '', active: true },
  { productId: 'INV-0028', legacyId: undefined, legacySku: 'LBR-2X4-8', productName: '2x4x8 SPF Lumber', description: '2x4 SPF stud grade, 8 foot', category: 'lumber', sku: 'LBR-2X4-8', unit: 'piece', currentQty: 0, holdQty: 0, minStockLevel: 30, maxStockLevel: 200, reorderQty: 50, unitCost: 3.75, unitPrice: 7.50, supplier: 'Home Depot', supplierPartNumber: '', location: 'Warehouse A - Lumber Rack', weight: 10, lastCountDate: '', lastCountBy: '', lastRestockDate: '', notes: '', active: true },
  { productId: 'INV-0029', legacyId: undefined, legacySku: 'LBR-1X6-8', productName: '1x6x8 Pine Board', description: '1x6 pine fascia board, 8 foot', category: 'lumber', sku: 'LBR-1X6-8', unit: 'piece', currentQty: 0, holdQty: 0, minStockLevel: 20, maxStockLevel: 150, reorderQty: 40, unitCost: 5.50, unitPrice: 11.00, supplier: 'Home Depot', supplierPartNumber: '', location: 'Warehouse A - Lumber Rack', weight: 8, lastCountDate: '', lastCountBy: '', lastRestockDate: '', notes: '', active: true },

  // === GUTTERS ===
  { productId: 'INV-0030', legacyId: undefined, legacySku: 'GUT-5-WHT', productName: '5" K-Style Gutter - White', description: '10ft white aluminum K-style gutter', category: 'gutters', sku: 'GUT-5-WHT', unit: 'piece', currentQty: 0, holdQty: 0, minStockLevel: 20, maxStockLevel: 200, reorderQty: 50, unitCost: 8.50, unitPrice: 16.00, supplier: 'ABC Supply', supplierPartNumber: '', location: 'Warehouse B - Bay 2', weight: 4, lastCountDate: '', lastCountBy: '', lastRestockDate: '', notes: '', active: true },
  { productId: 'INV-0031', legacyId: undefined, legacySku: 'GUT-5-BRN', productName: '5" K-Style Gutter - Brown', description: '10ft brown aluminum K-style gutter', category: 'gutters', sku: 'GUT-5-BRN', unit: 'piece', currentQty: 0, holdQty: 0, minStockLevel: 15, maxStockLevel: 150, reorderQty: 40, unitCost: 8.50, unitPrice: 16.00, supplier: 'ABC Supply', supplierPartNumber: '', location: 'Warehouse B - Bay 2', weight: 4, lastCountDate: '', lastCountBy: '', lastRestockDate: '', notes: '', active: true },
  { productId: 'INV-0032', legacyId: undefined, legacySku: 'GUT-DS-WHT', productName: 'Downspout 2x3 - White', description: '10ft white aluminum downspout', category: 'gutters', sku: 'GUT-DS-WHT', unit: 'piece', currentQty: 0, holdQty: 0, minStockLevel: 15, maxStockLevel: 150, reorderQty: 40, unitCost: 6.00, unitPrice: 12.00, supplier: 'ABC Supply', supplierPartNumber: '', location: 'Warehouse B - Bay 2', weight: 3, lastCountDate: '', lastCountBy: '', lastRestockDate: '', notes: '', active: true },

  // === NAILS & FASTENERS (additional) ===
  { productId: 'INV-0033', legacyId: undefined, legacySku: 'NAIL-COIL-120', productName: 'Coil Roofing Nails 1-1/4"', description: 'Coil roofing nails for pneumatic nailer', category: 'nails_fasteners', sku: 'NAIL-COIL-120', unit: 'coil', currentQty: 0, holdQty: 0, minStockLevel: 15, maxStockLevel: 100, reorderQty: 25, unitCost: 42.00, unitPrice: 65.00, supplier: 'ABC Supply', supplierPartNumber: '', location: 'Warehouse A', weight: 25, lastCountDate: '', lastCountBy: '', lastRestockDate: '', notes: '', active: true },
  { productId: 'INV-0034', legacyId: undefined, legacySku: 'SCRW-DECK-3', productName: 'Deck Screws 3"', description: '#10 x 3" coated deck screws, 1lb box', category: 'nails_fasteners', sku: 'SCRW-DECK-3', unit: 'box', currentQty: 0, holdQty: 0, minStockLevel: 10, maxStockLevel: 80, reorderQty: 20, unitCost: 8.50, unitPrice: 15.00, supplier: 'Home Depot', supplierPartNumber: '', location: 'Warehouse A', weight: 1, lastCountDate: '', lastCountBy: '', lastRestockDate: '', notes: '', active: true },

  // === SEALANTS (additional) ===
  { productId: 'INV-0035', legacyId: undefined, legacySku: 'SEAL-ROOF-GAL', productName: 'Roof Cement - Gallon', description: 'Plastic roof cement, 1 gallon', category: 'sealants', sku: 'SEAL-ROOF-GAL', unit: 'gallon', currentQty: 0, holdQty: 0, minStockLevel: 10, maxStockLevel: 60, reorderQty: 15, unitCost: 12.00, unitPrice: 22.00, supplier: 'GAF Materials', supplierPartNumber: '', location: 'Warehouse A', weight: 10, lastCountDate: '', lastCountBy: '', lastRestockDate: '', notes: '', active: true },

  // === VENTILATION (additional) ===
  { productId: 'INV-0036', legacyId: undefined, legacySku: 'VENT-BOX-750', productName: 'Box Vent - 750 sq in', description: 'Static box vent, 750 sq inch net free area', category: 'ventilation', sku: 'VENT-BOX-750', unit: 'each', currentQty: 0, holdQty: 0, minStockLevel: 10, maxStockLevel: 80, reorderQty: 20, unitCost: 18.00, unitPrice: 32.00, supplier: 'Air Vent Inc', supplierPartNumber: '', location: 'Warehouse A', weight: 5, lastCountDate: '', lastCountBy: '', lastRestockDate: '', notes: '', active: true },
  { productId: 'INV-0037', legacyId: undefined, legacySku: 'VENT-TURB-12', productName: 'Turbine Vent 12"', description: '12 inch wind turbine vent', category: 'ventilation', sku: 'VENT-TURB-12', unit: 'each', currentQty: 0, holdQty: 0, minStockLevel: 5, maxStockLevel: 40, reorderQty: 10, unitCost: 25.00, unitPrice: 45.00, supplier: 'Air Vent Inc', supplierPartNumber: '', location: 'Warehouse A', weight: 8, lastCountDate: '', lastCountBy: '', lastRestockDate: '', notes: '', active: true },

  // === SAFETY EQUIPMENT ===
  { productId: 'INV-0038', legacyId: undefined, legacySku: 'SAFE-HARN', productName: 'Safety Harness', description: 'Fall protection safety harness, OSHA compliant', category: 'safety_equipment', sku: 'SAFE-HARN', unit: 'each', currentQty: 0, holdQty: 0, minStockLevel: 4, maxStockLevel: 20, reorderQty: 5, unitCost: 65.00, unitPrice: 95.00, supplier: 'Home Depot', supplierPartNumber: '', location: 'Warehouse A - Safety', weight: 5, lastCountDate: '', lastCountBy: '', lastRestockDate: '', notes: '', active: true },
  { productId: 'INV-0039', legacyId: undefined, legacySku: 'SAFE-ROPE-50', productName: 'Safety Rope 50ft', description: '50ft lifeline rope with snap hooks', category: 'safety_equipment', sku: 'SAFE-ROPE-50', unit: 'each', currentQty: 0, holdQty: 0, minStockLevel: 4, maxStockLevel: 20, reorderQty: 5, unitCost: 45.00, unitPrice: 70.00, supplier: 'Home Depot', supplierPartNumber: '', location: 'Warehouse A - Safety', weight: 8, lastCountDate: '', lastCountBy: '', lastRestockDate: '', notes: '', active: true },
  { productId: 'INV-0040', legacyId: undefined, legacySku: 'SAFE-ANCHOR', productName: 'Roof Anchor', description: 'Temporary roof anchor point', category: 'safety_equipment', sku: 'SAFE-ANCHOR', unit: 'each', currentQty: 0, holdQty: 0, minStockLevel: 4, maxStockLevel: 20, reorderQty: 5, unitCost: 28.00, unitPrice: 45.00, supplier: 'Home Depot', supplierPartNumber: '', location: 'Warehouse A - Safety', weight: 3, lastCountDate: '', lastCountBy: '', lastRestockDate: '', notes: '', active: true },

  // === ACCESSORIES ===
  { productId: 'INV-0041', legacyId: undefined, legacySku: 'TARP-10X12', productName: 'Tarp 10x12', description: '10x12 ft heavy-duty blue tarp', category: 'accessories', sku: 'TARP-10X12', unit: 'each', currentQty: 0, holdQty: 0, minStockLevel: 10, maxStockLevel: 60, reorderQty: 15, unitCost: 15.00, unitPrice: 28.00, supplier: 'Home Depot', supplierPartNumber: '', location: 'Warehouse A', weight: 5, lastCountDate: '', lastCountBy: '', lastRestockDate: '', notes: '', active: true },
  { productId: 'INV-0042', legacyId: undefined, legacySku: 'TARP-20X30', productName: 'Tarp 20x30', description: '20x30 ft heavy-duty blue tarp', category: 'accessories', sku: 'TARP-20X30', unit: 'each', currentQty: 0, holdQty: 0, minStockLevel: 5, maxStockLevel: 30, reorderQty: 10, unitCost: 35.00, unitPrice: 55.00, supplier: 'Home Depot', supplierPartNumber: '', location: 'Warehouse A', weight: 15, lastCountDate: '', lastCountBy: '', lastRestockDate: '', notes: '', active: true },
];

// ============================================
// SHEETS HELPER
// ============================================

async function getSheet(tabName: string): Promise<{ sheet: any; doc: GoogleSpreadsheet } | null> {
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

async function getOrCreateSheet(tabName: string, headerValues: string[]): Promise<{ sheet: any; doc: GoogleSpreadsheet } | null> {
  if (!SHEETS_CONFIGURED) return null;
  try {
    const doc = new GoogleSpreadsheet(SHEETS_ID!, serviceAuth);
    await doc.loadInfo();
    let sheet = doc.sheetsByTitle[tabName];
    if (!sheet) {
      sheet = await doc.addSheet({ title: tabName, headerValues });
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
  private nextIds = { inv: 43, txn: 1, cnt: 1, rec: 1, rst: 1, prc: 1, hld: 1, ret: 1 };

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
      // Load from Sheets first
      const result = await getSheet(SHEET_TABS.INVENTORY);
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
        // No Sheets access — use catalog as fallback
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

  private async _seedCatalog(result: { sheet: any; doc: GoogleSpreadsheet }): Promise<void> {
    const headers = [
      'productId', 'legacyId', 'legacySku', 'productName', 'description', 'category',
      'sku', 'unit', 'currentQty', 'holdQty', 'minStockLevel', 'maxStockLevel',
      'reorderQty', 'unitCost', 'unitPrice', 'supplier', 'supplierPartNumber',
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
    const result = await getSheet(SHEET_TABS.TRANSACTIONS);
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
    const result = await getSheet(SHEET_TABS.COUNT_SESSIONS);
    if (!result) return;
    try {
      const rows = await result.sheet.getRows();
      this.countSessions = rows.map((row: GoogleSpreadsheetRow) => ({
        sessionId: row.get('sessionId') || '',
        startedAt: row.get('startedAt') || '',
        startedBy: row.get('startedBy') || '',
        startedByName: row.get('startedByName') || '',
        status: (row.get('status') || 'in_progress') as CountSession['status'],
        completedAt: row.get('completedAt') || undefined,
        totalItems: parseInt(row.get('totalItems')) || 0,
        countedItems: parseInt(row.get('countedItems')) || 0,
        discrepancies: parseInt(row.get('discrepancies')) || 0,
        resolvedDiscrepancies: parseInt(row.get('resolvedDiscrepancies')) || 0,
        photoUrl: row.get('photoUrl') || undefined,
        notes: row.get('notes') || undefined,
      }));
    } catch (error) {
      console.error('Failed to load count sessions:', error);
    }
  }

  private async _loadReturnTickets(): Promise<void> {
    const result = await getSheet(SHEET_TABS.RETURN_TICKETS);
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

  // ============================================
  // PERSIST HELPERS
  // ============================================

  private async _persistItem(item: InventoryItem): Promise<void> {
    const result = await getSheet(SHEET_TABS.INVENTORY);
    if (!result) return;
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

  private async _persistCountSession(session: CountSession): Promise<void> {
    const result = await getOrCreateSheet(SHEET_TABS.COUNT_SESSIONS, [
      'sessionId', 'startedAt', 'startedBy', 'startedByName', 'status',
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

    this._persistItem(this.inventory[idx]).catch(() => {});
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
    this._persistItem(newItem).catch(() => {});
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
    this._persistItem(item).catch(() => {});
    this._persistTransaction(txn).catch(() => {});
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
    this._persistItem(item).catch(() => {});
    this._persistTransaction(txn).catch(() => {});
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
    this._persistItem(item).catch(() => {});

    // Log transaction
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
    this._persistTransaction(txn).catch(() => {});

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
      this._persistItem(item).catch(() => {});
    }

    hold.status = 'released';
    hold.releasedAt = new Date().toISOString();
    return true;
  }

  /**
   * Fulfill a hold (delivery confirmed → convert hold to deduction).
   */
  async fulfillHold(
    holdId: string,
    performedBy: string,
    performedByName: string
  ): Promise<boolean> {
    await this.ensureLoaded();
    const hold = this.materialHolds.find(h => h.holdId === holdId);
    if (!hold || hold.status !== 'active') return false;

    const item = this.inventory.find(i => i.productId === hold.productId);
    if (item) {
      item.holdQty = Math.max(0, item.holdQty - hold.quantity);
      item.currentQty = Math.max(0, item.currentQty - hold.quantity);
      item.availableQty = item.currentQty - item.holdQty;
      this._persistItem(item).catch(() => {});
    }

    hold.status = 'fulfilled';
    hold.fulfilledAt = new Date().toISOString();

    // Log transaction
    if (item) {
      const txn: InventoryTransaction = {
        transactionId: `TXN-${String(this.nextIds.txn++).padStart(6, '0')}`,
        productId: hold.productId,
        productName: hold.productName,
        type: 'delivery',
        quantity: -hold.quantity,
        referenceId: hold.orderId,
        referenceType: hold.orderType,
        performedBy,
        performedByName,
        timestamp: new Date().toISOString(),
        notes: `Hold ${holdId} fulfilled for order ${hold.orderId}`,
        previousQty: item.currentQty + hold.quantity,
        newQty: item.currentQty,
        unitCost: item.unitCost,
        unitPrice: item.unitPrice,
      };
      this.transactions.push(txn);
      this._persistTransaction(txn).catch(() => {});
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
      totalItems: this.inventory.filter(i => i.active).length,
      countedItems: 0,
      discrepancies: 0,
      resolvedDiscrepancies: 0,
    };
    this.countSessions.unshift(session);
    this._persistCountSession(session).catch(() => {});
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

    this._persistCountSession(session).catch(() => {});
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

    if (resolution === 'adjust_system') {
      const item = this.inventory.find(i => i.productId === record.productId);
      if (item) {
        const prevQty = item.currentQty;
        item.currentQty = adjustedQty;
        item.availableQty = item.currentQty - item.holdQty;
        item.lastCountDate = new Date().toISOString().split('T')[0];
        item.lastCountBy = resolvedBy;
        this._persistItem(item).catch(() => {});

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
        this._persistTransaction(txn).catch(() => {});
      }
    }

    // Update session
    const session = this.countSessions.find(s => s.sessionId === record.sessionId);
    if (session) {
      session.resolvedDiscrepancies = this.countRecords.filter(r => r.sessionId === session.sessionId && r.discrepancy !== 0 && r.resolved).length;
      session.discrepancies = this.countRecords.filter(r => r.sessionId === session.sessionId && r.discrepancy !== 0 && !r.resolved).length;
      this._persistCountSession(session).catch(() => {});
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
      .filter(i => i.active && i.currentQty <= i.minStockLevel)
      .map(item => {
        let severity: AlertSeverity = 'warning';
        if (item.currentQty === 0) severity = 'out_of_stock';
        else if (item.currentQty <= item.minStockLevel * 0.25) severity = 'critical';

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

  async getLowStockItems(): Promise<InventoryItem[]> {
    await this.ensureLoaded();
    return this.inventory.filter(i => i.active && i.currentQty <= i.minStockLevel);
  }

  async getCriticalItems(): Promise<InventoryItem[]> {
    await this.ensureLoaded();
    return this.inventory.filter(i => i.active && (i.currentQty === 0 || i.currentQty <= i.minStockLevel * 0.25));
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
    this._persistItem(item).catch(() => {});
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
    await this.ensureLoaded();
    const order = this.restockOrders.find(o => o.orderId === orderId);
    if (!order) return null;

    for (const received of receivedItems) {
      const orderItem = order.items.find(i => i.productId === resolveProductId(received.productId));
      if (orderItem) {
        orderItem.receivedQty = received.receivedQty;
        orderItem.receivedAt = new Date().toISOString();
      }
      await this.addStock(received.productId, received.receivedQty, 'restock', orderId, 'restock_order', receivedBy, receivedByName, `Restock from PO ${orderId}`);
    }

    order.status = 'received';
    order.receivedAt = new Date().toISOString();
    return order;
  }

  async getRestockSuggestions(): Promise<{ productId: string; productName: string; currentQty: number; minStockLevel: number; suggestedQty: number; supplier: string; estimatedCost: number }[]> {
    await this.ensureLoaded();
    return this.inventory
      .filter(i => i.active && i.currentQty <= i.minStockLevel)
      .map(item => ({
        productId: item.productId,
        productName: item.productName,
        currentQty: item.currentQty,
        minStockLevel: item.minStockLevel,
        suggestedQty: item.reorderQty,
        supplier: item.supplier,
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
    this._persistReturnTicket(ticket).catch(() => {});
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

    if (status === 'completed') {
      ticket.completedAt = new Date().toISOString();
    }

    this._persistReturnTicket(ticket).catch(() => {});
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

    // Admin, office, owner — full details
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
