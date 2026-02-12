/**
 * Inventory Management Service
 *
 * Comprehensive inventory management with:
 * - Weekly count verification
 * - Low stock notifications and alerts
 * - Restock order management (PO workflow)
 * - Pricing verification and margin analysis
 * - Full CRUD with search and filtering
 *
 * Self-contained with mock data - no external API connections.
 */

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

export interface InventoryItem {
  productId: string;
  productName: string;
  category: InventoryCategory;
  sku: string;
  unit: string;
  currentQty: number;
  minStockLevel: number;
  maxStockLevel: number;
  reorderQty: number;
  unitCost: number;
  unitPrice: number;
  supplier: string;
  supplierPartNumber: string;
  location: string;
  weight: number;
  lastCountDate: string;
  lastCountBy: string;
  lastRestockDate: string;
  notes: string;
}

export interface CountSession {
  sessionId: string;
  startedAt: string;
  startedBy: string;
  status: 'in_progress' | 'completed' | 'cancelled';
  completedAt?: string;
  totalItems: number;
  countedItems: number;
  discrepancies: number;
  counts: CountRecord[];
}

export interface CountRecord {
  productId: string;
  productName: string;
  systemQty: number;
  countedQty: number;
  countedBy: string;
  countedAt: string;
  notes?: string;
  discrepancy: number;
  resolved: boolean;
  resolution?: string;
  adjustedQty?: number;
  resolvedBy?: string;
  resolvedAt?: string;
  reason?: string;
}

export type DiscrepancyResolution = 'adjust_system' | 'recount' | 'write_off' | 'no_action';
export type DiscrepancyReason = 'damaged' | 'miscount' | 'theft' | 'received_not_logged' | 'used_not_logged' | 'other';

export type AlertSeverity = 'warning' | 'critical' | 'out_of_stock';

export interface StockAlert {
  productId: string;
  productName: string;
  category: InventoryCategory;
  currentQty: number;
  minStockLevel: number;
  severity: AlertSeverity;
  daysUntilStockout: number;
  location: string;
  supplier: string;
}

export interface CustomAlertRule {
  ruleId: string;
  productId: string;
  threshold: number;
  notifyRoles: string[];
  createdAt: string;
  active: boolean;
}

export interface StockTrendPoint {
  date: string;
  qty: number;
}

export type RestockOrderStatus = 'draft' | 'submitted' | 'approved' | 'ordered' | 'shipped' | 'received' | 'cancelled';

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

export interface RestockOrder {
  orderId: string;
  supplier: string;
  status: RestockOrderStatus;
  items: RestockOrderItem[];
  totalCost: number;
  createdAt: string;
  createdBy: string;
  approvedBy?: string;
  approvedAt?: string;
  orderedAt?: string;
  shippedAt?: string;
  receivedAt?: string;
  expectedDelivery?: string;
  notes?: string;
}

export interface PricingRecord {
  productId: string;
  date: string;
  oldCost: number;
  newCost: number;
  oldPrice: number;
  newPrice: number;
  changedBy: string;
  reason?: string;
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

export interface CategoryMargin {
  category: InventoryCategory;
  itemCount: number;
  avgCost: number;
  avgPrice: number;
  avgMarkup: number;
  avgMarginPercent: number;
  totalCostValue: number;
  totalRetailValue: number;
}

export interface InventoryFilters {
  category?: InventoryCategory;
  search?: string;
  lowStock?: boolean;
  outOfStock?: boolean;
  supplier?: string;
  location?: string;
}

export interface RestockFilters {
  status?: RestockOrderStatus;
  supplier?: string;
  dateFrom?: string;
  dateTo?: string;
}

// ============================================
// CATEGORY LABELS
// ============================================

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

// ============================================
// MOCK DATA
// ============================================

const MOCK_INVENTORY: InventoryItem[] = [
  // SHINGLES
  {
    productId: 'INV-0001',
    productName: 'GAF Timberline HDZ - Charcoal',
    category: 'shingles',
    sku: 'GAF-THDZ-CHAR',
    unit: 'bundles',
    currentQty: 145,
    minStockLevel: 50,
    maxStockLevel: 300,
    reorderQty: 100,
    unitCost: 32.50,
    unitPrice: 48.75,
    supplier: 'ABC Supply Co.',
    supplierPartNumber: 'GAF-0681-CHAR',
    location: 'A1-1-A',
    weight: 62,
    lastCountDate: '2026-02-03',
    lastCountBy: 'David M.',
    lastRestockDate: '2026-01-28',
    notes: 'Best seller - always keep stocked',
  },
  {
    productId: 'INV-0002',
    productName: 'GAF Timberline HDZ - Weathered Wood',
    category: 'shingles',
    sku: 'GAF-THDZ-WW',
    unit: 'bundles',
    currentQty: 88,
    minStockLevel: 50,
    maxStockLevel: 300,
    reorderQty: 100,
    unitCost: 32.50,
    unitPrice: 48.75,
    supplier: 'ABC Supply Co.',
    supplierPartNumber: 'GAF-0681-WW',
    location: 'A1-1-B',
    weight: 62,
    lastCountDate: '2026-02-03',
    lastCountBy: 'David M.',
    lastRestockDate: '2026-01-20',
    notes: '',
  },
  {
    productId: 'INV-0003',
    productName: 'Owens Corning Duration - Onyx Black',
    category: 'shingles',
    sku: 'OC-DUR-OBK',
    unit: 'bundles',
    currentQty: 12,
    minStockLevel: 30,
    maxStockLevel: 200,
    reorderQty: 80,
    unitCost: 35.00,
    unitPrice: 52.50,
    supplier: 'ABC Supply Co.',
    supplierPartNumber: 'OC-TK09-OBK',
    location: 'A1-2-A',
    weight: 65,
    lastCountDate: '2026-02-03',
    lastCountBy: 'David M.',
    lastRestockDate: '2026-01-10',
    notes: 'Running low - reorder ASAP',
  },
  {
    productId: 'INV-0004',
    productName: 'CertainTeed Landmark - Moire Black',
    category: 'shingles',
    sku: 'CT-LM-MB',
    unit: 'bundles',
    currentQty: 0,
    minStockLevel: 25,
    maxStockLevel: 150,
    reorderQty: 60,
    unitCost: 34.25,
    unitPrice: 51.38,
    supplier: 'Beacon Roofing',
    supplierPartNumber: 'CT-LMK-MB-01',
    location: 'A1-2-B',
    weight: 63,
    lastCountDate: '2026-02-03',
    lastCountBy: 'David M.',
    lastRestockDate: '2025-12-15',
    notes: 'OUT OF STOCK - customer waiting',
  },
  // UNDERLAYMENT
  {
    productId: 'INV-0005',
    productName: 'GAF FeltBuster Synthetic Underlayment',
    category: 'underlayment',
    sku: 'GAF-FB-SYN',
    unit: 'rolls',
    currentQty: 35,
    minStockLevel: 15,
    maxStockLevel: 80,
    reorderQty: 30,
    unitCost: 68.00,
    unitPrice: 102.00,
    supplier: 'ABC Supply Co.',
    supplierPartNumber: 'GAF-FB10-SYN',
    location: 'A2-1-A',
    weight: 42,
    lastCountDate: '2026-02-03',
    lastCountBy: 'David M.',
    lastRestockDate: '2026-01-25',
    notes: '',
  },
  {
    productId: 'INV-0006',
    productName: 'Grace Ice & Water Shield',
    category: 'underlayment',
    sku: 'GR-IWS-225',
    unit: 'rolls',
    currentQty: 8,
    minStockLevel: 10,
    maxStockLevel: 50,
    reorderQty: 20,
    unitCost: 145.00,
    unitPrice: 210.00,
    supplier: 'ABC Supply Co.',
    supplierPartNumber: 'GR-IWS-225SF',
    location: 'A2-1-B',
    weight: 65,
    lastCountDate: '2026-02-03',
    lastCountBy: 'David M.',
    lastRestockDate: '2026-01-15',
    notes: 'Premium product - verify count carefully',
  },
  {
    productId: 'INV-0007',
    productName: '#30 Felt Underlayment',
    category: 'underlayment',
    sku: 'FELT-30-STD',
    unit: 'rolls',
    currentQty: 22,
    minStockLevel: 10,
    maxStockLevel: 60,
    reorderQty: 25,
    unitCost: 28.50,
    unitPrice: 42.75,
    supplier: 'Beacon Roofing',
    supplierPartNumber: 'BK-F30-432',
    location: 'A2-2-A',
    weight: 50,
    lastCountDate: '2026-02-03',
    lastCountBy: 'David M.',
    lastRestockDate: '2026-01-30',
    notes: '',
  },
  // FLASHING
  {
    productId: 'INV-0008',
    productName: 'Aluminum Step Flashing 4x4x8',
    category: 'flashing',
    sku: 'AL-SF-448',
    unit: 'pieces',
    currentQty: 320,
    minStockLevel: 100,
    maxStockLevel: 500,
    reorderQty: 200,
    unitCost: 0.85,
    unitPrice: 1.50,
    supplier: 'ABC Supply Co.',
    supplierPartNumber: 'AL-STEP-448',
    location: 'B1-1-A',
    weight: 0.2,
    lastCountDate: '2026-02-03',
    lastCountBy: 'David M.',
    lastRestockDate: '2026-01-20',
    notes: '',
  },
  {
    productId: 'INV-0009',
    productName: 'Galvanized Drip Edge 10ft - White',
    category: 'flashing',
    sku: 'GV-DE-10W',
    unit: 'pieces',
    currentQty: 45,
    minStockLevel: 30,
    maxStockLevel: 150,
    reorderQty: 50,
    unitCost: 4.50,
    unitPrice: 7.25,
    supplier: 'ABC Supply Co.',
    supplierPartNumber: 'GV-DRIP-10W',
    location: 'B1-1-B',
    weight: 3,
    lastCountDate: '2026-02-03',
    lastCountBy: 'David M.',
    lastRestockDate: '2026-01-22',
    notes: '',
  },
  {
    productId: 'INV-0010',
    productName: 'Galvanized Drip Edge 10ft - Brown',
    category: 'flashing',
    sku: 'GV-DE-10B',
    unit: 'pieces',
    currentQty: 5,
    minStockLevel: 30,
    maxStockLevel: 150,
    reorderQty: 50,
    unitCost: 4.50,
    unitPrice: 7.25,
    supplier: 'ABC Supply Co.',
    supplierPartNumber: 'GV-DRIP-10B',
    location: 'B1-1-C',
    weight: 3,
    lastCountDate: '2026-02-03',
    lastCountBy: 'David M.',
    lastRestockDate: '2025-12-20',
    notes: 'Very low - reorder immediately',
  },
  {
    productId: 'INV-0011',
    productName: 'Lead Pipe Flashing Boot 1.5-3 in',
    category: 'flashing',
    sku: 'LPF-BOOT-3',
    unit: 'pieces',
    currentQty: 18,
    minStockLevel: 10,
    maxStockLevel: 50,
    reorderQty: 20,
    unitCost: 12.75,
    unitPrice: 22.00,
    supplier: 'Beacon Roofing',
    supplierPartNumber: 'BK-LPF-153',
    location: 'B1-2-A',
    weight: 2.5,
    lastCountDate: '2026-02-03',
    lastCountBy: 'David M.',
    lastRestockDate: '2026-01-18',
    notes: '',
  },
  // GUTTERS
  {
    productId: 'INV-0012',
    productName: '5" K-Style Gutter - White (10ft)',
    category: 'gutters',
    sku: 'KG-5W-10',
    unit: 'pieces',
    currentQty: 28,
    minStockLevel: 20,
    maxStockLevel: 100,
    reorderQty: 40,
    unitCost: 8.75,
    unitPrice: 14.50,
    supplier: 'Gutter Supply Inc.',
    supplierPartNumber: 'GS-K5W-10',
    location: 'C1-1-A',
    weight: 5,
    lastCountDate: '2026-02-03',
    lastCountBy: 'Tony R.',
    lastRestockDate: '2026-01-25',
    notes: '',
  },
  {
    productId: 'INV-0013',
    productName: '5" K-Style Gutter - Brown (10ft)',
    category: 'gutters',
    sku: 'KG-5B-10',
    unit: 'pieces',
    currentQty: 3,
    minStockLevel: 15,
    maxStockLevel: 80,
    reorderQty: 30,
    unitCost: 8.75,
    unitPrice: 14.50,
    supplier: 'Gutter Supply Inc.',
    supplierPartNumber: 'GS-K5B-10',
    location: 'C1-1-B',
    weight: 5,
    lastCountDate: '2026-02-03',
    lastCountBy: 'Tony R.',
    lastRestockDate: '2025-12-10',
    notes: 'Critical low',
  },
  {
    productId: 'INV-0014',
    productName: 'Gutter Downspout 2x3 - White (10ft)',
    category: 'gutters',
    sku: 'DS-23W-10',
    unit: 'pieces',
    currentQty: 40,
    minStockLevel: 15,
    maxStockLevel: 80,
    reorderQty: 30,
    unitCost: 6.25,
    unitPrice: 10.50,
    supplier: 'Gutter Supply Inc.',
    supplierPartNumber: 'GS-DS23W-10',
    location: 'C1-2-A',
    weight: 3,
    lastCountDate: '2026-02-03',
    lastCountBy: 'Tony R.',
    lastRestockDate: '2026-01-25',
    notes: '',
  },
  // NAILS & FASTENERS
  {
    productId: 'INV-0015',
    productName: '1-1/4" Coil Roofing Nails (7200ct)',
    category: 'nails_fasteners',
    sku: 'CN-114-7200',
    unit: 'boxes',
    currentQty: 14,
    minStockLevel: 8,
    maxStockLevel: 40,
    reorderQty: 15,
    unitCost: 42.00,
    unitPrice: 62.00,
    supplier: 'ABC Supply Co.',
    supplierPartNumber: 'ABC-CN114-7200',
    location: 'B2-1-A',
    weight: 30,
    lastCountDate: '2026-02-03',
    lastCountBy: 'Tony R.',
    lastRestockDate: '2026-01-28',
    notes: '',
  },
  {
    productId: 'INV-0016',
    productName: '1" Plastic Cap Nails (3000ct)',
    category: 'nails_fasteners',
    sku: 'PCN-1-3000',
    unit: 'boxes',
    currentQty: 6,
    minStockLevel: 5,
    maxStockLevel: 25,
    reorderQty: 10,
    unitCost: 35.00,
    unitPrice: 52.50,
    supplier: 'ABC Supply Co.',
    supplierPartNumber: 'ABC-PCN1-3000',
    location: 'B2-1-B',
    weight: 18,
    lastCountDate: '2026-02-03',
    lastCountBy: 'Tony R.',
    lastRestockDate: '2026-01-20',
    notes: '',
  },
  {
    productId: 'INV-0017',
    productName: '#10 x 1-1/2" Deck Screws (5lb box)',
    category: 'nails_fasteners',
    sku: 'DS-10-15-5LB',
    unit: 'boxes',
    currentQty: 2,
    minStockLevel: 5,
    maxStockLevel: 20,
    reorderQty: 10,
    unitCost: 18.50,
    unitPrice: 28.00,
    supplier: 'Beacon Roofing',
    supplierPartNumber: 'BK-DS10-15',
    location: 'B2-2-A',
    weight: 5,
    lastCountDate: '2026-02-03',
    lastCountBy: 'Tony R.',
    lastRestockDate: '2025-12-28',
    notes: 'Low - need to reorder',
  },
  // SEALANTS
  {
    productId: 'INV-0018',
    productName: 'Henry 208 Wet Patch Roof Cement (gal)',
    category: 'sealants',
    sku: 'HEN-208-GAL',
    unit: 'cans',
    currentQty: 20,
    minStockLevel: 10,
    maxStockLevel: 40,
    reorderQty: 15,
    unitCost: 14.50,
    unitPrice: 24.00,
    supplier: 'ABC Supply Co.',
    supplierPartNumber: 'HEN-208-1G',
    location: 'B3-1-A',
    weight: 10,
    lastCountDate: '2026-02-03',
    lastCountBy: 'Tony R.',
    lastRestockDate: '2026-01-22',
    notes: '',
  },
  {
    productId: 'INV-0019',
    productName: 'DAP Dynaflex 230 Sealant - White',
    category: 'sealants',
    sku: 'DAP-230-W',
    unit: 'tubes',
    currentQty: 48,
    minStockLevel: 20,
    maxStockLevel: 100,
    reorderQty: 40,
    unitCost: 5.25,
    unitPrice: 8.50,
    supplier: 'ABC Supply Co.',
    supplierPartNumber: 'DAP-230W-101',
    location: 'B3-1-B',
    weight: 0.8,
    lastCountDate: '2026-02-03',
    lastCountBy: 'Tony R.',
    lastRestockDate: '2026-01-30',
    notes: '',
  },
  {
    productId: 'INV-0020',
    productName: 'Geocel Tripolymer Sealant - Clear',
    category: 'sealants',
    sku: 'GEO-TRI-CLR',
    unit: 'tubes',
    currentQty: 0,
    minStockLevel: 12,
    maxStockLevel: 60,
    reorderQty: 24,
    unitCost: 8.75,
    unitPrice: 14.50,
    supplier: 'Beacon Roofing',
    supplierPartNumber: 'BK-GEO-TRICLR',
    location: 'B3-2-A',
    weight: 0.9,
    lastCountDate: '2026-02-03',
    lastCountBy: 'Tony R.',
    lastRestockDate: '2025-12-05',
    notes: 'OUT OF STOCK',
  },
  // LUMBER
  {
    productId: 'INV-0021',
    productName: '1x6x8 CDX Plywood (4x8 sheet)',
    category: 'lumber',
    sku: 'PLY-CDX-48',
    unit: 'sheets',
    currentQty: 42,
    minStockLevel: 20,
    maxStockLevel: 100,
    reorderQty: 40,
    unitCost: 38.00,
    unitPrice: 56.00,
    supplier: 'Lowes Pro',
    supplierPartNumber: 'LP-CDX-4816',
    location: 'D1-1-A',
    weight: 48,
    lastCountDate: '2026-02-03',
    lastCountBy: 'David M.',
    lastRestockDate: '2026-01-27',
    notes: '',
  },
  {
    productId: 'INV-0022',
    productName: '7/16" OSB Sheathing (4x8 sheet)',
    category: 'lumber',
    sku: 'OSB-716-48',
    unit: 'sheets',
    currentQty: 30,
    minStockLevel: 15,
    maxStockLevel: 80,
    reorderQty: 30,
    unitCost: 24.50,
    unitPrice: 38.00,
    supplier: 'Lowes Pro',
    supplierPartNumber: 'LP-OSB-716',
    location: 'D1-1-B',
    weight: 44,
    lastCountDate: '2026-02-03',
    lastCountBy: 'David M.',
    lastRestockDate: '2026-01-27',
    notes: '',
  },
  {
    productId: 'INV-0023',
    productName: '2x4x8 Treated Lumber',
    category: 'lumber',
    sku: 'TL-248',
    unit: 'pieces',
    currentQty: 55,
    minStockLevel: 20,
    maxStockLevel: 100,
    reorderQty: 40,
    unitCost: 6.25,
    unitPrice: 10.00,
    supplier: 'Lowes Pro',
    supplierPartNumber: 'LP-TL-248',
    location: 'D1-2-A',
    weight: 12,
    lastCountDate: '2026-02-03',
    lastCountBy: 'David M.',
    lastRestockDate: '2026-01-27',
    notes: '',
  },
  // VENTILATION
  {
    productId: 'INV-0024',
    productName: 'Cobra Exhaust Vent (4ft section)',
    category: 'ventilation',
    sku: 'GAF-COBRA-4',
    unit: 'pieces',
    currentQty: 25,
    minStockLevel: 10,
    maxStockLevel: 60,
    reorderQty: 20,
    unitCost: 16.50,
    unitPrice: 26.00,
    supplier: 'ABC Supply Co.',
    supplierPartNumber: 'GAF-CVR-4FT',
    location: 'B4-1-A',
    weight: 3,
    lastCountDate: '2026-02-03',
    lastCountBy: 'Tony R.',
    lastRestockDate: '2026-01-18',
    notes: '',
  },
  {
    productId: 'INV-0025',
    productName: 'Turbine Vent 12" - Galvanized',
    category: 'ventilation',
    sku: 'TV-12-GV',
    unit: 'pieces',
    currentQty: 7,
    minStockLevel: 5,
    maxStockLevel: 25,
    reorderQty: 10,
    unitCost: 28.00,
    unitPrice: 45.00,
    supplier: 'ABC Supply Co.',
    supplierPartNumber: 'ABC-TV12-GV',
    location: 'B4-1-B',
    weight: 6,
    lastCountDate: '2026-02-03',
    lastCountBy: 'Tony R.',
    lastRestockDate: '2026-01-10',
    notes: '',
  },
  {
    productId: 'INV-0026',
    productName: 'Static Roof Vent 750 - Black',
    category: 'ventilation',
    sku: 'SRV-750-BK',
    unit: 'pieces',
    currentQty: 0,
    minStockLevel: 8,
    maxStockLevel: 30,
    reorderQty: 12,
    unitCost: 22.00,
    unitPrice: 35.00,
    supplier: 'Beacon Roofing',
    supplierPartNumber: 'BK-SRV750-BK',
    location: 'B4-2-A',
    weight: 4,
    lastCountDate: '2026-02-03',
    lastCountBy: 'Tony R.',
    lastRestockDate: '2025-11-20',
    notes: 'OUT OF STOCK - need for next week jobs',
  },
  // ACCESSORIES
  {
    productId: 'INV-0027',
    productName: 'GAF Starter Strip Plus',
    category: 'accessories',
    sku: 'GAF-SSP',
    unit: 'bundles',
    currentQty: 30,
    minStockLevel: 15,
    maxStockLevel: 80,
    reorderQty: 30,
    unitCost: 24.00,
    unitPrice: 38.00,
    supplier: 'ABC Supply Co.',
    supplierPartNumber: 'GAF-SSP-120',
    location: 'A3-1-A',
    weight: 20,
    lastCountDate: '2026-02-03',
    lastCountBy: 'David M.',
    lastRestockDate: '2026-01-28',
    notes: '',
  },
  {
    productId: 'INV-0028',
    productName: 'GAF TimberTex Hip & Ridge - Charcoal',
    category: 'accessories',
    sku: 'GAF-TTX-CHAR',
    unit: 'bundles',
    currentQty: 18,
    minStockLevel: 10,
    maxStockLevel: 50,
    reorderQty: 20,
    unitCost: 52.00,
    unitPrice: 78.00,
    supplier: 'ABC Supply Co.',
    supplierPartNumber: 'GAF-TTX-CHAR-20',
    location: 'A3-1-B',
    weight: 22,
    lastCountDate: '2026-02-03',
    lastCountBy: 'David M.',
    lastRestockDate: '2026-01-25',
    notes: '',
  },
  {
    productId: 'INV-0029',
    productName: 'Pipe Collar Flashing Kit',
    category: 'accessories',
    sku: 'PCF-KIT-STD',
    unit: 'kits',
    currentQty: 4,
    minStockLevel: 8,
    maxStockLevel: 30,
    reorderQty: 12,
    unitCost: 9.50,
    unitPrice: 16.00,
    supplier: 'ABC Supply Co.',
    supplierPartNumber: 'ABC-PCF-KIT',
    location: 'A3-2-A',
    weight: 1.5,
    lastCountDate: '2026-02-03',
    lastCountBy: 'David M.',
    lastRestockDate: '2025-12-20',
    notes: 'Low stock - reorder with next PO',
  },
  // SAFETY EQUIPMENT
  {
    productId: 'INV-0030',
    productName: 'Fall Protection Harness - Universal',
    category: 'safety_equipment',
    sku: 'FPH-UNI',
    unit: 'pieces',
    currentQty: 8,
    minStockLevel: 4,
    maxStockLevel: 15,
    reorderQty: 5,
    unitCost: 65.00,
    unitPrice: 95.00,
    supplier: 'Safety Direct',
    supplierPartNumber: 'SD-FPH-UNI-01',
    location: 'E1-1-A',
    weight: 5,
    lastCountDate: '2026-02-03',
    lastCountBy: 'Tony R.',
    lastRestockDate: '2026-01-15',
    notes: 'Inspect before each use',
  },
  {
    productId: 'INV-0031',
    productName: '50ft Vertical Lifeline w/ Rope Grab',
    category: 'safety_equipment',
    sku: 'VLL-50-RG',
    unit: 'pieces',
    currentQty: 6,
    minStockLevel: 3,
    maxStockLevel: 12,
    reorderQty: 4,
    unitCost: 85.00,
    unitPrice: 125.00,
    supplier: 'Safety Direct',
    supplierPartNumber: 'SD-VLL50-RG',
    location: 'E1-1-B',
    weight: 8,
    lastCountDate: '2026-02-03',
    lastCountBy: 'Tony R.',
    lastRestockDate: '2026-01-15',
    notes: '',
  },
  {
    productId: 'INV-0032',
    productName: 'Roof Anchor Point - Reusable',
    category: 'safety_equipment',
    sku: 'RAP-REUSE',
    unit: 'pieces',
    currentQty: 1,
    minStockLevel: 4,
    maxStockLevel: 15,
    reorderQty: 6,
    unitCost: 42.00,
    unitPrice: 65.00,
    supplier: 'Safety Direct',
    supplierPartNumber: 'SD-RAP-R01',
    location: 'E1-2-A',
    weight: 3,
    lastCountDate: '2026-02-03',
    lastCountBy: 'Tony R.',
    lastRestockDate: '2025-11-30',
    notes: 'Critical safety item - never let run out',
  },
  {
    productId: 'INV-0033',
    productName: 'Hard Hat - White (adjustable)',
    category: 'safety_equipment',
    sku: 'HH-WHT-ADJ',
    unit: 'pieces',
    currentQty: 12,
    minStockLevel: 6,
    maxStockLevel: 20,
    reorderQty: 8,
    unitCost: 12.00,
    unitPrice: 18.00,
    supplier: 'Safety Direct',
    supplierPartNumber: 'SD-HH-W-ADJ',
    location: 'E1-2-B',
    weight: 1,
    lastCountDate: '2026-02-03',
    lastCountBy: 'Tony R.',
    lastRestockDate: '2026-01-05',
    notes: '',
  },
  // Additional items for variety
  {
    productId: 'INV-0034',
    productName: 'GAF Timberline HDZ - Barkwood',
    category: 'shingles',
    sku: 'GAF-THDZ-BW',
    unit: 'bundles',
    currentQty: 60,
    minStockLevel: 30,
    maxStockLevel: 200,
    reorderQty: 80,
    unitCost: 32.50,
    unitPrice: 28.00,  // PRICING ERROR: price below cost
    supplier: 'ABC Supply Co.',
    supplierPartNumber: 'GAF-0681-BW',
    location: 'A1-3-A',
    weight: 62,
    lastCountDate: '2026-02-03',
    lastCountBy: 'David M.',
    lastRestockDate: '2026-01-28',
    notes: 'Pricing needs review',
  },
  {
    productId: 'INV-0035',
    productName: 'Gutter Guard Screen 3ft - White',
    category: 'gutters',
    sku: 'GGS-3W',
    unit: 'pieces',
    currentQty: 50,
    minStockLevel: 20,
    maxStockLevel: 120,
    reorderQty: 40,
    unitCost: 3.25,
    unitPrice: 8.00,
    supplier: 'Gutter Supply Inc.',
    supplierPartNumber: 'GS-GGS3-W',
    location: 'C1-3-A',
    weight: 0.5,
    lastCountDate: '2026-02-03',
    lastCountBy: 'Tony R.',
    lastRestockDate: '2026-01-25',
    notes: '',
  },
  {
    productId: 'INV-0036',
    productName: 'Roofing Tarp 20x30 Blue',
    category: 'accessories',
    sku: 'TARP-2030-BL',
    unit: 'pieces',
    currentQty: 15,
    minStockLevel: 5,
    maxStockLevel: 30,
    reorderQty: 10,
    unitCost: 22.00,
    unitPrice: 22.00,  // PRICING ISSUE: zero markup
    supplier: 'ABC Supply Co.',
    supplierPartNumber: 'ABC-TARP-2030',
    location: 'A3-3-A',
    weight: 8,
    lastCountDate: '2026-02-03',
    lastCountBy: 'David M.',
    lastRestockDate: '2026-01-30',
    notes: 'Emergency tarps - always keep in stock',
  },
  {
    productId: 'INV-0037',
    productName: 'Ridge Vent Nails 1-3/4" (1lb bag)',
    category: 'nails_fasteners',
    sku: 'RVN-134-1LB',
    unit: 'bags',
    currentQty: 25,
    minStockLevel: 10,
    maxStockLevel: 50,
    reorderQty: 20,
    unitCost: 6.50,
    unitPrice: 10.50,
    supplier: 'ABC Supply Co.',
    supplierPartNumber: 'ABC-RVN134-1',
    location: 'B2-2-B',
    weight: 1,
    lastCountDate: '2026-02-03',
    lastCountBy: 'Tony R.',
    lastRestockDate: '2026-01-20',
    notes: '',
  },
  {
    productId: 'INV-0038',
    productName: 'Chimney Flashing Kit - Large',
    category: 'flashing',
    sku: 'CFK-LG',
    unit: 'kits',
    currentQty: 3,
    minStockLevel: 5,
    maxStockLevel: 20,
    reorderQty: 8,
    unitCost: 35.00,
    unitPrice: 185.00,  // PRICING ISSUE: unusually high markup
    supplier: 'Beacon Roofing',
    supplierPartNumber: 'BK-CFK-LG01',
    location: 'B1-3-A',
    weight: 6,
    lastCountDate: '2026-02-03',
    lastCountBy: 'David M.',
    lastRestockDate: '2025-12-15',
    notes: 'Includes counter flashing, step, crickets',
  },
];

// Mock count sessions
const MOCK_COUNT_SESSIONS: CountSession[] = [
  {
    sessionId: 'CNT-2026-005',
    startedAt: '2026-02-03T08:00:00Z',
    startedBy: 'David M.',
    status: 'completed',
    completedAt: '2026-02-03T11:30:00Z',
    totalItems: 38,
    countedItems: 38,
    discrepancies: 3,
    counts: [
      {
        productId: 'INV-0003',
        productName: 'Owens Corning Duration - Onyx Black',
        systemQty: 18,
        countedQty: 12,
        countedBy: 'David M.',
        countedAt: '2026-02-03T09:15:00Z',
        discrepancy: -6,
        resolved: true,
        resolution: 'adjust_system',
        adjustedQty: 12,
        resolvedBy: 'Michael',
        resolvedAt: '2026-02-03T14:00:00Z',
        reason: 'used_not_logged',
      },
      {
        productId: 'INV-0015',
        productName: '1-1/4" Coil Roofing Nails (7200ct)',
        systemQty: 12,
        countedQty: 14,
        countedBy: 'Tony R.',
        countedAt: '2026-02-03T09:45:00Z',
        discrepancy: 2,
        resolved: true,
        resolution: 'adjust_system',
        adjustedQty: 14,
        resolvedBy: 'Michael',
        resolvedAt: '2026-02-03T14:00:00Z',
        reason: 'received_not_logged',
      },
      {
        productId: 'INV-0032',
        productName: 'Roof Anchor Point - Reusable',
        systemQty: 4,
        countedQty: 1,
        countedBy: 'Tony R.',
        countedAt: '2026-02-03T10:20:00Z',
        discrepancy: -3,
        resolved: true,
        resolution: 'adjust_system',
        adjustedQty: 1,
        resolvedBy: 'Michael',
        resolvedAt: '2026-02-03T14:00:00Z',
        reason: 'damaged',
      },
    ],
  },
  {
    sessionId: 'CNT-2026-004',
    startedAt: '2026-01-27T08:00:00Z',
    startedBy: 'Tony R.',
    status: 'completed',
    completedAt: '2026-01-27T10:45:00Z',
    totalItems: 38,
    countedItems: 38,
    discrepancies: 1,
    counts: [],
  },
  {
    sessionId: 'CNT-2026-003',
    startedAt: '2026-01-20T08:00:00Z',
    startedBy: 'David M.',
    status: 'completed',
    completedAt: '2026-01-20T11:00:00Z',
    totalItems: 36,
    countedItems: 36,
    discrepancies: 2,
    counts: [],
  },
];

// Mock restock orders
const MOCK_RESTOCK_ORDERS: RestockOrder[] = [
  {
    orderId: 'PO-2026-012',
    supplier: 'ABC Supply Co.',
    status: 'shipped',
    items: [
      { productId: 'INV-0003', productName: 'Owens Corning Duration - Onyx Black', sku: 'OC-DUR-OBK', orderQty: 80, unitCost: 35.00, totalCost: 2800.00 },
      { productId: 'INV-0010', productName: 'Galvanized Drip Edge 10ft - Brown', sku: 'GV-DE-10B', orderQty: 50, unitCost: 4.50, totalCost: 225.00 },
    ],
    totalCost: 3025.00,
    createdAt: '2026-02-05T10:00:00Z',
    createdBy: 'Michael',
    approvedBy: 'Michael',
    approvedAt: '2026-02-05T10:30:00Z',
    orderedAt: '2026-02-05T11:00:00Z',
    shippedAt: '2026-02-07T08:00:00Z',
    expectedDelivery: '2026-02-11',
    notes: 'Urgent - needed for upcoming jobs',
  },
  {
    orderId: 'PO-2026-011',
    supplier: 'Beacon Roofing',
    status: 'approved',
    items: [
      { productId: 'INV-0004', productName: 'CertainTeed Landmark - Moire Black', sku: 'CT-LM-MB', orderQty: 60, unitCost: 34.25, totalCost: 2055.00 },
      { productId: 'INV-0020', productName: 'Geocel Tripolymer Sealant - Clear', sku: 'GEO-TRI-CLR', orderQty: 24, unitCost: 8.75, totalCost: 210.00 },
      { productId: 'INV-0038', productName: 'Chimney Flashing Kit - Large', sku: 'CFK-LG', orderQty: 8, unitCost: 35.00, totalCost: 280.00 },
    ],
    totalCost: 2545.00,
    createdAt: '2026-02-06T09:00:00Z',
    createdBy: 'David M.',
    approvedBy: 'Michael',
    approvedAt: '2026-02-06T14:00:00Z',
    notes: 'Includes out of stock items',
  },
  {
    orderId: 'PO-2026-010',
    supplier: 'Safety Direct',
    status: 'received',
    items: [
      { productId: 'INV-0030', productName: 'Fall Protection Harness - Universal', sku: 'FPH-UNI', orderQty: 5, unitCost: 65.00, totalCost: 325.00, receivedQty: 5, receivedAt: '2026-02-01T14:00:00Z' },
      { productId: 'INV-0032', productName: 'Roof Anchor Point - Reusable', sku: 'RAP-REUSE', orderQty: 6, unitCost: 42.00, totalCost: 252.00, receivedQty: 6, receivedAt: '2026-02-01T14:00:00Z' },
    ],
    totalCost: 577.00,
    createdAt: '2026-01-25T10:00:00Z',
    createdBy: 'Tony R.',
    approvedBy: 'Michael',
    approvedAt: '2026-01-25T11:00:00Z',
    orderedAt: '2026-01-26T08:00:00Z',
    shippedAt: '2026-01-29T10:00:00Z',
    receivedAt: '2026-02-01T14:00:00Z',
    notes: 'Safety equipment restock',
  },
  {
    orderId: 'PO-2026-009',
    supplier: 'Gutter Supply Inc.',
    status: 'draft',
    items: [
      { productId: 'INV-0013', productName: '5" K-Style Gutter - Brown (10ft)', sku: 'KG-5B-10', orderQty: 30, unitCost: 8.75, totalCost: 262.50 },
    ],
    totalCost: 262.50,
    createdAt: '2026-02-08T15:00:00Z',
    createdBy: 'David M.',
    notes: 'Needs approval',
  },
];

// Mock pricing history
const MOCK_PRICING_HISTORY: PricingRecord[] = [
  { productId: 'INV-0001', date: '2026-01-15', oldCost: 30.00, newCost: 32.50, oldPrice: 45.00, newPrice: 48.75, changedBy: 'Michael', reason: 'Supplier price increase' },
  { productId: 'INV-0001', date: '2025-10-01', oldCost: 28.50, newCost: 30.00, oldPrice: 42.75, newPrice: 45.00, changedBy: 'Michael', reason: 'Quarterly adjustment' },
  { productId: 'INV-0005', date: '2026-01-20', oldCost: 62.00, newCost: 68.00, oldPrice: 95.00, newPrice: 102.00, changedBy: 'Michael', reason: 'Supplier price increase' },
  { productId: 'INV-0021', date: '2026-01-10', oldCost: 35.00, newCost: 38.00, oldPrice: 52.00, newPrice: 56.00, changedBy: 'Michael', reason: 'Lumber market increase' },
  { productId: 'INV-0034', date: '2025-11-01', oldCost: 30.00, newCost: 32.50, oldPrice: 45.00, newPrice: 28.00, changedBy: 'David M.', reason: 'Clearance pricing' },
];

// Mock custom alert rules
const MOCK_ALERT_RULES: CustomAlertRule[] = [
  { ruleId: 'ALR-001', productId: 'INV-0001', threshold: 60, notifyRoles: ['manager', 'warehouse'], createdAt: '2026-01-01', active: true },
  { ruleId: 'ALR-002', productId: 'INV-0030', threshold: 5, notifyRoles: ['manager', 'safety'], createdAt: '2026-01-01', active: true },
];

// ============================================
// SERVICE CLASS
// ============================================

class InventoryManagementService {
  private inventory: InventoryItem[];
  private countSessions: CountSession[];
  private restockOrders: RestockOrder[];
  private pricingHistory: PricingRecord[];
  private alertRules: CustomAlertRule[];
  private nextProductId: number;
  private nextCountId: number;
  private nextOrderId: number;
  private nextRuleId: number;

  constructor() {
    this.inventory = [...MOCK_INVENTORY];
    this.countSessions = [...MOCK_COUNT_SESSIONS];
    this.restockOrders = [...MOCK_RESTOCK_ORDERS];
    this.pricingHistory = [...MOCK_PRICING_HISTORY];
    this.alertRules = [...MOCK_ALERT_RULES];
    this.nextProductId = 39;
    this.nextCountId = 6;
    this.nextOrderId = 13;
    this.nextRuleId = 3;
  }

  // ============================================
  // GENERAL INVENTORY
  // ============================================

  getInventory(filters?: InventoryFilters): InventoryItem[] {
    let items = [...this.inventory];

    if (filters) {
      if (filters.category) {
        items = items.filter(i => i.category === filters.category);
      }
      if (filters.search) {
        const q = filters.search.toLowerCase();
        items = items.filter(i =>
          i.productName.toLowerCase().includes(q) ||
          i.sku.toLowerCase().includes(q) ||
          i.supplier.toLowerCase().includes(q) ||
          i.productId.toLowerCase().includes(q) ||
          i.location.toLowerCase().includes(q)
        );
      }
      if (filters.lowStock) {
        items = items.filter(i => i.currentQty <= i.minStockLevel);
      }
      if (filters.outOfStock) {
        items = items.filter(i => i.currentQty === 0);
      }
      if (filters.supplier) {
        items = items.filter(i => i.supplier === filters.supplier);
      }
      if (filters.location) {
        items = items.filter(i => i.location.startsWith(filters.location!));
      }
    }

    return items;
  }

  getItemById(productId: string): InventoryItem | undefined {
    return this.inventory.find(i => i.productId === productId);
  }

  updateItem(productId: string, updates: Partial<InventoryItem>): InventoryItem | null {
    const idx = this.inventory.findIndex(i => i.productId === productId);
    if (idx === -1) return null;
    this.inventory[idx] = { ...this.inventory[idx], ...updates, productId };
    return this.inventory[idx];
  }

  addItem(itemData: Omit<InventoryItem, 'productId'>): InventoryItem {
    const productId = `INV-${String(this.nextProductId++).padStart(4, '0')}`;
    const newItem: InventoryItem = { productId, ...itemData };
    this.inventory.push(newItem);
    return newItem;
  }

  getInventoryValue(): { totalCost: number; totalRetail: number; itemCount: number } {
    let totalCost = 0;
    let totalRetail = 0;
    for (const item of this.inventory) {
      totalCost += item.currentQty * item.unitCost;
      totalRetail += item.currentQty * item.unitPrice;
    }
    return {
      totalCost: Math.round(totalCost * 100) / 100,
      totalRetail: Math.round(totalRetail * 100) / 100,
      itemCount: this.inventory.length,
    };
  }

  getCategoryBreakdown(): {
    category: InventoryCategory;
    label: string;
    itemCount: number;
    totalQty: number;
    totalCostValue: number;
    totalRetailValue: number;
  }[] {
    const categories = Object.keys(CATEGORY_LABELS) as InventoryCategory[];
    return categories.map(cat => {
      const items = this.inventory.filter(i => i.category === cat);
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

  searchInventory(query: string): InventoryItem[] {
    return this.getInventory({ search: query });
  }

  getSuppliers(): string[] {
    const suppliers = new Set(this.inventory.map(i => i.supplier));
    return Array.from(suppliers).sort();
  }

  // ============================================
  // WEEKLY COUNT VERIFICATION
  // ============================================

  initiateWeeklyCount(countedBy: string): CountSession {
    const sessionId = `CNT-2026-${String(this.nextCountId++).padStart(3, '0')}`;
    const session: CountSession = {
      sessionId,
      startedAt: new Date().toISOString(),
      startedBy: countedBy,
      status: 'in_progress',
      totalItems: this.inventory.length,
      countedItems: 0,
      discrepancies: 0,
      counts: [],
    };
    this.countSessions.unshift(session);
    return session;
  }

  recordCount(productId: string, countedQty: number, countedBy: string, notes?: string): CountRecord | null {
    const activeSession = this.countSessions.find(s => s.status === 'in_progress');
    if (!activeSession) return null;

    const item = this.getItemById(productId);
    if (!item) return null;

    // Check if already counted in this session
    const existingIdx = activeSession.counts.findIndex(c => c.productId === productId);
    const record: CountRecord = {
      productId,
      productName: item.productName,
      systemQty: item.currentQty,
      countedQty,
      countedBy,
      countedAt: new Date().toISOString(),
      notes,
      discrepancy: countedQty - item.currentQty,
      resolved: countedQty === item.currentQty,
      resolution: countedQty === item.currentQty ? 'no_action' : undefined,
    };

    if (existingIdx >= 0) {
      activeSession.counts[existingIdx] = record;
    } else {
      activeSession.counts.push(record);
      activeSession.countedItems++;
    }

    activeSession.discrepancies = activeSession.counts.filter(c => c.discrepancy !== 0 && !c.resolved).length;

    // Auto-complete if all items counted
    if (activeSession.countedItems >= activeSession.totalItems) {
      activeSession.status = 'completed';
      activeSession.completedAt = new Date().toISOString();
    }

    return record;
  }

  getCountDiscrepancies(countSessionId: string): CountRecord[] {
    const session = this.countSessions.find(s => s.sessionId === countSessionId);
    if (!session) return [];
    return session.counts.filter(c => c.discrepancy !== 0);
  }

  resolveDiscrepancy(
    productId: string,
    resolution: DiscrepancyResolution,
    adjustedQty: number,
    reason: DiscrepancyReason,
    resolvedBy: string = 'Admin'
  ): boolean {
    const activeSession = this.countSessions.find(s => s.status === 'in_progress' || s.status === 'completed');
    if (!activeSession) return false;

    const record = activeSession.counts.find(c => c.productId === productId && !c.resolved);
    if (!record) return false;

    record.resolved = true;
    record.resolution = resolution;
    record.adjustedQty = adjustedQty;
    record.resolvedBy = resolvedBy;
    record.resolvedAt = new Date().toISOString();
    record.reason = reason;

    // If adjusting system, update inventory
    if (resolution === 'adjust_system') {
      const item = this.getItemById(productId);
      if (item) {
        item.currentQty = adjustedQty;
        item.lastCountDate = new Date().toISOString().split('T')[0];
        item.lastCountBy = resolvedBy;
      }
    }

    activeSession.discrepancies = activeSession.counts.filter(c => c.discrepancy !== 0 && !c.resolved).length;
    return true;
  }

  getCountHistory(): CountSession[] {
    return this.countSessions;
  }

  getCountProgress(sessionId: string): { total: number; counted: number; percent: number; discrepancies: number; resolved: number } | null {
    const session = this.countSessions.find(s => s.sessionId === sessionId);
    if (!session) return null;
    const resolved = session.counts.filter(c => c.discrepancy !== 0 && c.resolved).length;
    return {
      total: session.totalItems,
      counted: session.countedItems,
      percent: session.totalItems > 0 ? Math.round((session.countedItems / session.totalItems) * 100) : 0,
      discrepancies: session.counts.filter(c => c.discrepancy !== 0).length,
      resolved,
    };
  }

  getActiveCountSession(): CountSession | undefined {
    return this.countSessions.find(s => s.status === 'in_progress');
  }

  // ============================================
  // LOW STOCK NOTIFICATIONS
  // ============================================

  getLowStockItems(): InventoryItem[] {
    return this.inventory.filter(i => i.currentQty <= i.minStockLevel);
  }

  getCriticalItems(): InventoryItem[] {
    return this.inventory.filter(i => i.currentQty === 0 || i.currentQty <= i.minStockLevel * 0.25);
  }

  getStockAlerts(): StockAlert[] {
    const lowItems = this.getLowStockItems();
    return lowItems
      .map(item => {
        let severity: AlertSeverity = 'warning';
        if (item.currentQty === 0) {
          severity = 'out_of_stock';
        } else if (item.currentQty <= item.minStockLevel * 0.25) {
          severity = 'critical';
        }

        // Estimate days until stockout (simple: based on avg daily usage over 30 days)
        const dailyUsage = Math.max(1, (item.maxStockLevel - item.currentQty) / 30);
        const daysUntilStockout = item.currentQty > 0 ? Math.round(item.currentQty / dailyUsage) : 0;

        return {
          productId: item.productId,
          productName: item.productName,
          category: item.category,
          currentQty: item.currentQty,
          minStockLevel: item.minStockLevel,
          severity,
          daysUntilStockout,
          location: item.location,
          supplier: item.supplier,
        };
      })
      .sort((a, b) => {
        const severityOrder: Record<AlertSeverity, number> = { out_of_stock: 0, critical: 1, warning: 2 };
        return severityOrder[a.severity] - severityOrder[b.severity];
      });
  }

  setStockAlert(productId: string, threshold: number, notifyRoles: string[]): CustomAlertRule {
    const ruleId = `ALR-${String(this.nextRuleId++).padStart(3, '0')}`;
    const rule: CustomAlertRule = {
      ruleId,
      productId,
      threshold,
      notifyRoles,
      createdAt: new Date().toISOString().split('T')[0],
      active: true,
    };
    this.alertRules.push(rule);
    return rule;
  }

  getAlertRules(): CustomAlertRule[] {
    return this.alertRules;
  }

  getStockTrend(productId: string, days: number = 30): StockTrendPoint[] {
    const item = this.getItemById(productId);
    if (!item) return [];

    // Generate mock trend data going back N days
    const points: StockTrendPoint[] = [];
    const now = new Date();
    let qty = item.currentQty;

    // Work backwards from current qty, simulating usage and restocks
    for (let d = 0; d <= days; d++) {
      const date = new Date(now);
      date.setDate(date.getDate() - (days - d));
      const dateStr = date.toISOString().split('T')[0];

      // Simulate daily fluctuation
      if (d === 0) {
        qty = Math.max(0, item.currentQty + Math.floor(Math.random() * item.reorderQty * 0.3));
      } else {
        const dailyUse = Math.floor(Math.random() * 3) + 1;
        qty = Math.max(0, qty - dailyUse);
        // Simulate occasional restock
        if (qty < item.minStockLevel * 0.5 && Math.random() > 0.7) {
          qty += item.reorderQty;
        }
      }
      points.push({ date: dateStr, qty: Math.min(qty, item.maxStockLevel) });
    }

    // Make sure the last point matches current qty
    if (points.length > 0) {
      points[points.length - 1].qty = item.currentQty;
    }

    return points;
  }

  // ============================================
  // RESTOCK MANAGEMENT
  // ============================================

  createRestockOrder(items: { productId: string; orderQty: number }[], createdBy: string, supplier?: string, notes?: string): RestockOrder {
    const orderId = `PO-2026-${String(this.nextOrderId++).padStart(3, '0')}`;

    const orderItems: RestockOrderItem[] = items.map(reqItem => {
      const inv = this.getItemById(reqItem.productId);
      return {
        productId: reqItem.productId,
        productName: inv?.productName || 'Unknown',
        sku: inv?.sku || '',
        orderQty: reqItem.orderQty,
        unitCost: inv?.unitCost || 0,
        totalCost: (inv?.unitCost || 0) * reqItem.orderQty,
      };
    });

    const detectedSupplier = supplier || (this.getItemById(items[0]?.productId)?.supplier || 'Unknown');

    const order: RestockOrder = {
      orderId,
      supplier: detectedSupplier,
      status: 'draft',
      items: orderItems,
      totalCost: Math.round(orderItems.reduce((sum, i) => sum + i.totalCost, 0) * 100) / 100,
      createdAt: new Date().toISOString(),
      createdBy,
      notes,
    };

    this.restockOrders.unshift(order);
    return order;
  }

  getRestockSuggestions(): { productId: string; productName: string; currentQty: number; minStockLevel: number; suggestedQty: number; supplier: string; estimatedCost: number }[] {
    return this.getLowStockItems().map(item => ({
      productId: item.productId,
      productName: item.productName,
      currentQty: item.currentQty,
      minStockLevel: item.minStockLevel,
      suggestedQty: item.reorderQty,
      supplier: item.supplier,
      estimatedCost: Math.round(item.reorderQty * item.unitCost * 100) / 100,
    }));
  }

  approveRestockOrder(orderId: string, approvedBy: string): RestockOrder | null {
    const order = this.restockOrders.find(o => o.orderId === orderId);
    if (!order || order.status !== 'draft' && order.status !== 'submitted') return null;
    order.status = 'approved';
    order.approvedBy = approvedBy;
    order.approvedAt = new Date().toISOString();
    return order;
  }

  receiveRestock(orderId: string, receivedItems: { productId: string; receivedQty: number }[]): RestockOrder | null {
    const order = this.restockOrders.find(o => o.orderId === orderId);
    if (!order) return null;

    for (const received of receivedItems) {
      const orderItem = order.items.find(i => i.productId === received.productId);
      if (orderItem) {
        orderItem.receivedQty = received.receivedQty;
        orderItem.receivedAt = new Date().toISOString();
      }
      // Update inventory qty
      const invItem = this.getItemById(received.productId);
      if (invItem) {
        invItem.currentQty += received.receivedQty;
        invItem.lastRestockDate = new Date().toISOString().split('T')[0];
      }
    }

    order.status = 'received';
    order.receivedAt = new Date().toISOString();
    return order;
  }

  getRestockOrders(filters?: RestockFilters): RestockOrder[] {
    let orders = [...this.restockOrders];
    if (filters) {
      if (filters.status) orders = orders.filter(o => o.status === filters.status);
      if (filters.supplier) orders = orders.filter(o => o.supplier === filters.supplier);
      if (filters.dateFrom) orders = orders.filter(o => o.createdAt >= filters.dateFrom!);
      if (filters.dateTo) orders = orders.filter(o => o.createdAt <= filters.dateTo!);
    }
    return orders;
  }

  getRestockHistory(productId: string): RestockOrder[] {
    return this.restockOrders.filter(o => o.items.some(i => i.productId === productId));
  }

  updateRestockOrderStatus(orderId: string, status: RestockOrderStatus): RestockOrder | null {
    const order = this.restockOrders.find(o => o.orderId === orderId);
    if (!order) return null;
    order.status = status;
    if (status === 'ordered') order.orderedAt = new Date().toISOString();
    if (status === 'shipped') order.shippedAt = new Date().toISOString();
    return order;
  }

  // ============================================
  // PRICING VERIFICATION
  // ============================================

  verifyPricing(productId: string): { valid: boolean; issues: string[] } {
    const item = this.getItemById(productId);
    if (!item) return { valid: false, issues: ['Item not found'] };

    const issues: string[] = [];
    if (item.unitPrice <= item.unitCost) {
      issues.push('Selling price is at or below cost');
    }
    const markup = item.unitCost > 0 ? ((item.unitPrice - item.unitCost) / item.unitCost) * 100 : 0;
    if (markup > 200) {
      issues.push(`Unusually high markup: ${markup.toFixed(1)}%`);
    }
    if (markup < 10 && markup > 0) {
      issues.push(`Very low markup: ${markup.toFixed(1)}%`);
    }

    return { valid: issues.length === 0, issues };
  }

  getPricingReport(): PricingReport[] {
    return this.inventory.map(item => {
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

  updatePricing(productId: string, newCost: number, newPrice: number, changedBy: string = 'Admin', reason?: string): InventoryItem | null {
    const item = this.getItemById(productId);
    if (!item) return null;

    // Record history
    this.pricingHistory.push({
      productId,
      date: new Date().toISOString().split('T')[0],
      oldCost: item.unitCost,
      newCost,
      oldPrice: item.unitPrice,
      newPrice,
      changedBy,
      reason,
    });

    item.unitCost = newCost;
    item.unitPrice = newPrice;
    return item;
  }

  getPricingHistory(productId: string): PricingRecord[] {
    return this.pricingHistory.filter(p => p.productId === productId).sort((a, b) => b.date.localeCompare(a.date));
  }

  calculateMargins(): CategoryMargin[] {
    const categories = Object.keys(CATEGORY_LABELS) as InventoryCategory[];
    return categories
      .map(cat => {
        const items = this.inventory.filter(i => i.category === cat);
        if (items.length === 0) return null;
        const avgCost = items.reduce((sum, i) => sum + i.unitCost, 0) / items.length;
        const avgPrice = items.reduce((sum, i) => sum + i.unitPrice, 0) / items.length;
        const avgMarkup = avgCost > 0 ? ((avgPrice - avgCost) / avgCost) * 100 : 0;
        const avgMarginPercent = avgPrice > 0 ? ((avgPrice - avgCost) / avgPrice) * 100 : 0;
        return {
          category: cat,
          itemCount: items.length,
          avgCost: Math.round(avgCost * 100) / 100,
          avgPrice: Math.round(avgPrice * 100) / 100,
          avgMarkup: Math.round(avgMarkup * 10) / 10,
          avgMarginPercent: Math.round(avgMarginPercent * 10) / 10,
          totalCostValue: Math.round(items.reduce((sum, i) => sum + i.currentQty * i.unitCost, 0) * 100) / 100,
          totalRetailValue: Math.round(items.reduce((sum, i) => sum + i.currentQty * i.unitPrice, 0) * 100) / 100,
        };
      })
      .filter(Boolean) as CategoryMargin[];
  }

  flagPricingIssues(): PricingReport[] {
    return this.getPricingReport().filter(r => r.flag !== undefined);
  }

  // ============================================
  // ACTIVITY FEED (mock recent events)
  // ============================================

  getRecentActivity(): { type: string; description: string; timestamp: string; by: string }[] {
    return [
      { type: 'count', description: 'Weekly count completed - 3 discrepancies found', timestamp: '2026-02-03T11:30:00Z', by: 'David M.' },
      { type: 'restock', description: 'PO-2026-012 shipped - OC Duration + Drip Edge', timestamp: '2026-02-07T08:00:00Z', by: 'ABC Supply Co.' },
      { type: 'restock', description: 'PO-2026-011 approved for Beacon Roofing', timestamp: '2026-02-06T14:00:00Z', by: 'Michael' },
      { type: 'alert', description: 'Static Roof Vent 750 is OUT OF STOCK', timestamp: '2026-02-05T09:00:00Z', by: 'System' },
      { type: 'pricing', description: 'GAF FeltBuster pricing updated ($68.00 cost)', timestamp: '2026-01-20T10:00:00Z', by: 'Michael' },
      { type: 'restock', description: 'PO-2026-010 received - Safety equipment', timestamp: '2026-02-01T14:00:00Z', by: 'Tony R.' },
      { type: 'count', description: 'Weekly count completed - 1 discrepancy', timestamp: '2026-01-27T10:45:00Z', by: 'Tony R.' },
      { type: 'alert', description: 'CertainTeed Landmark Moire Black at 0 qty', timestamp: '2026-01-28T07:00:00Z', by: 'System' },
    ];
  }
}

// ============================================
// SINGLETON EXPORT
// ============================================

export const inventoryManagementService = new InventoryManagementService();
