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
// REAL INVENTORY DATA (from Items.xlsx)
// ============================================

import { inventoryProducts } from './inventoryData';
import { inventoryTransactions } from './inventoryTransactions';

/**
 * Calculate current stock for each item by summing all transactions.
 */
function calculateCurrentStock(): Map<string, number> {
  const stock = new Map<string, number>();
  for (const tx of inventoryTransactions) {
    const current = stock.get(tx.itemId) || 0;
    stock.set(tx.itemId, current + tx.amount);
  }
  return stock;
}

/**
 * Map category strings from inventoryData.ts to InventoryCategory.
 */
function mapCategory(cat: string): InventoryCategory {
  const lower = cat.toLowerCase();
  if (lower.includes('fastener') || lower === 'fasteners') return 'nails_fasteners';
  if (lower.includes('underlayment')) return 'underlayment';
  if (lower.includes('flash')) return 'flashing';
  if (lower.includes('ventilation')) return 'ventilation';
  if (lower.includes('sealant')) return 'sealants';
  return 'accessories';
}

/**
 * Build the real inventory from inventoryData.ts products + transaction-based stock levels.
 */
function buildRealInventory(): InventoryItem[] {
  const stockLevels = calculateCurrentStock();

  return inventoryProducts.map(p => ({
    productId: p.productId,
    productName: p.productName,
    category: mapCategory(p.category),
    sku: p.productId, // Use item ID as SKU
    unit: p.unit,
    currentQty: stockLevels.get(p.productId) ?? p.currentQty,
    minStockLevel: p.minQty,
    maxStockLevel: p.maxQty,
    reorderQty: Math.max(10, p.maxQty - (stockLevels.get(p.productId) ?? p.currentQty)),
    unitCost: p.cost,
    unitPrice: p.price,
    supplier: p.supplier,
    supplierPartNumber: '',
    location: p.location,
    weight: 0,
    lastCountDate: '',
    lastCountBy: '',
    lastRestockDate: '',
    notes: '',
  }));
}

// Empty initial data - real data comes from Sheets or transactions
const INITIAL_COUNT_SESSIONS: CountSession[] = [];
const INITIAL_RESTOCK_ORDERS: RestockOrder[] = [];
const INITIAL_PRICING_HISTORY: PricingRecord[] = [];
const INITIAL_ALERT_RULES: CustomAlertRule[] = [];

// ============================================
// GOOGLE SHEETS INTEGRATION
// ============================================

import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';

const MGMT_SHEETS_ID = process.env.DELIVERY_SHEETS_ID || process.env.GOOGLE_SHEETS_ID;
const mgmtPrivateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n')?.replace(/\r\n/g, '\n');
const mgmtServiceAuth = new JWT({
  email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
  key: mgmtPrivateKey,
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

const MGMT_SHEETS_CONFIGURED = !!(MGMT_SHEETS_ID && process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL && mgmtPrivateKey);

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
  private sheetsLoaded: boolean;
  private sheetsLoadPromise: Promise<void> | null;

  constructor() {
    this.inventory = buildRealInventory();
    this.countSessions = [...INITIAL_COUNT_SESSIONS];
    this.restockOrders = [...INITIAL_RESTOCK_ORDERS];
    this.pricingHistory = [...INITIAL_PRICING_HISTORY];
    this.alertRules = [...INITIAL_ALERT_RULES];
    this.nextProductId = 134; // Next after item-133
    this.nextCountId = 1;
    this.nextOrderId = 1;
    this.nextRuleId = 1;
    this.sheetsLoaded = false;
    this.sheetsLoadPromise = null;
  }

  /**
   * Load inventory from Google Sheets 'Inventory' tab.
   * Merges with mock data: Sheets items take priority, mock items fill gaps.
   */
  private async loadFromSheets(): Promise<void> {
    if (this.sheetsLoaded || !MGMT_SHEETS_CONFIGURED) return;
    if (this.sheetsLoadPromise) return this.sheetsLoadPromise;

    this.sheetsLoadPromise = (async () => {
      try {
        const doc = new GoogleSpreadsheet(MGMT_SHEETS_ID!, mgmtServiceAuth);
        await doc.loadInfo();

        const sheet = doc.sheetsByTitle['Inventory'];
        if (!sheet) {
          this.sheetsLoaded = true;
          return;
        }

        const rows = await sheet.getRows();
        if (rows.length === 0) {
          this.sheetsLoaded = true;
          return;
        }

        // Map Sheets rows to InventoryItem format
        const sheetsItems: InventoryItem[] = rows.map((row, idx) => {
          const productId = row.get('productId') || `SHEET-${idx}`;
          const currentQty = parseFloat(row.get('currentQty')) || 0;
          const unitCost = parseFloat(row.get('unitCost')) || 0;
          const minQty = parseFloat(row.get('minQty')) || 10;
          const maxQty = parseFloat(row.get('maxQty')) || 100;

          // Map category string to InventoryCategory enum
          const rawCat = (row.get('category') || '').toLowerCase();
          let category: InventoryCategory = 'accessories';
          if (rawCat.includes('fastener') || rawCat.includes('nail')) category = 'nails_fasteners';
          else if (rawCat.includes('underlayment')) category = 'underlayment';
          else if (rawCat.includes('flash')) category = 'flashing';
          else if (rawCat.includes('gutter')) category = 'gutters';
          else if (rawCat.includes('sealant')) category = 'sealants';
          else if (rawCat.includes('lumber') || rawCat.includes('wood')) category = 'lumber';
          else if (rawCat.includes('vent')) category = 'ventilation';
          else if (rawCat.includes('shingle')) category = 'shingles';
          else if (rawCat.includes('safety')) category = 'safety_equipment';

          return {
            productId,
            productName: row.get('productName') || 'Unknown',
            category,
            sku: row.get('sku') || '',
            unit: row.get('unit') || 'each',
            currentQty,
            minStockLevel: minQty,
            maxStockLevel: maxQty,
            reorderQty: Math.max(10, maxQty - currentQty),
            unitCost,
            unitPrice: unitCost * 1.5, // Default 50% markup if not stored
            supplier: row.get('supplier') || '',
            supplierPartNumber: '',
            location: row.get('location') || '',
            weight: 0,
            lastCountDate: row.get('lastCountDate') || '',
            lastCountBy: '',
            lastRestockDate: row.get('lastRestockDate') || '',
            notes: row.get('notes') || '',
          };
        });

        if (sheetsItems.length > 0) {
          // Merge: use Sheets items as primary, keep mock items that don't overlap
          const sheetsIds = new Set(sheetsItems.map(i => i.productId));
          const nonOverlapping = this.inventory.filter(i => !sheetsIds.has(i.productId));
          this.inventory = [...sheetsItems, ...nonOverlapping];
          this.nextProductId = Math.max(this.nextProductId, sheetsItems.length + 39);
        }

        this.sheetsLoaded = true;
      } catch (error) {
        console.error('Failed to load inventory from Google Sheets:', error);
        this.sheetsLoaded = true; // Don't retry on error, use mock data
      }
    })();

    return this.sheetsLoadPromise;
  }

  /**
   * Persist an inventory item change to Google Sheets.
   */
  private async persistToSheets(item: InventoryItem): Promise<void> {
    if (!MGMT_SHEETS_CONFIGURED) return;
    try {
      const doc = new GoogleSpreadsheet(MGMT_SHEETS_ID!, mgmtServiceAuth);
      await doc.loadInfo();

      let sheet = doc.sheetsByTitle['Inventory'];
      if (!sheet) {
        sheet = await doc.addSheet({
          title: 'Inventory',
          headerValues: [
            'productId', 'productName', 'category', 'sku', 'unit', 'currentQty',
            'minQty', 'maxQty', 'unitCost', 'totalValue', 'location', 'supplier',
            'lastCountDate', 'lastRestockDate', 'notes'
          ]
        });
      }

      const rows = await sheet.getRows();
      const existingRow = rows.find(r => r.get('productId') === item.productId);

      if (existingRow) {
        existingRow.set('productName', item.productName);
        existingRow.set('category', CATEGORY_LABELS[item.category] || item.category);
        existingRow.set('sku', item.sku);
        existingRow.set('unit', item.unit);
        existingRow.set('currentQty', item.currentQty.toString());
        existingRow.set('minQty', item.minStockLevel.toString());
        existingRow.set('maxQty', item.maxStockLevel.toString());
        existingRow.set('unitCost', item.unitCost.toString());
        existingRow.set('totalValue', (item.currentQty * item.unitCost).toFixed(2));
        existingRow.set('location', item.location);
        existingRow.set('supplier', item.supplier);
        existingRow.set('lastCountDate', item.lastCountDate);
        existingRow.set('lastRestockDate', item.lastRestockDate);
        existingRow.set('notes', item.notes);
        await existingRow.save();
      } else {
        await sheet.addRow({
          productId: item.productId,
          productName: item.productName,
          category: CATEGORY_LABELS[item.category] || item.category,
          sku: item.sku,
          unit: item.unit,
          currentQty: item.currentQty.toString(),
          minQty: item.minStockLevel.toString(),
          maxQty: item.maxStockLevel.toString(),
          unitCost: item.unitCost.toString(),
          totalValue: (item.currentQty * item.unitCost).toFixed(2),
          location: item.location,
          supplier: item.supplier,
          lastCountDate: item.lastCountDate,
          lastRestockDate: item.lastRestockDate,
          notes: item.notes,
        });
      }
    } catch (error) {
      console.error('Failed to persist inventory item to Sheets:', error);
    }
  }

  // ============================================
  // GENERAL INVENTORY
  // ============================================

  async ensureSheetsLoaded(): Promise<void> {
    await this.loadFromSheets();
  }

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
    // Persist to Google Sheets in background
    this.persistToSheets(this.inventory[idx]).catch(() => {});
    return this.inventory[idx];
  }

  addItem(itemData: Omit<InventoryItem, 'productId'>): InventoryItem {
    const productId = `item-${this.nextProductId++}`;
    const newItem: InventoryItem = { productId, ...itemData };
    this.inventory.push(newItem);
    // Persist to Google Sheets in background
    this.persistToSheets(newItem).catch(() => {});
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
        // Persist to Google Sheets in background
        this.persistToSheets(item).catch(() => {});
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
        // Persist to Google Sheets in background
        this.persistToSheets(invItem).catch(() => {});
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
    // Persist to Google Sheets in background
    this.persistToSheets(item).catch(() => {});
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
    // Build recent activity from actual transaction data
    const recent: { type: string; description: string; timestamp: string; by: string }[] = [];

    // Get low stock alerts
    for (const item of this.getLowStockItems()) {
      recent.push({
        type: 'alert',
        description: `${item.productName} is ${item.currentQty === 0 ? 'OUT OF STOCK' : 'low stock'} (${item.currentQty} remaining)`,
        timestamp: new Date().toISOString(),
        by: 'System',
      });
    }

    return recent.slice(0, 10);
  }
}

// ============================================
// SINGLETON EXPORT
// ============================================

export const inventoryManagementService = new InventoryManagementService();
