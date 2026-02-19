/**
 * Inventory Service - Reads Items.xlsx directly and computes real stock levels
 * 
 * Single source of truth: Items.xlsx → Items sheet (products) + Inventory sheet (transactions)
 * Stock = sum of all transaction amounts per product
 */

import * as XLSX from 'xlsx';
import fs from 'fs';
import path from 'path';
import { type InventoryProduct } from './inventoryData';

// =============================================================================
// XLSX PATH
// =============================================================================

const XLSX_PATH = path.join('C:', 'Users', 'Michael', 'Downloads', 'Items.xlsx');

// =============================================================================
// TYPES
// =============================================================================

export interface ComputedInventoryItem extends InventoryProduct {
  computedQty: number;
  totalValue: number;
  totalCost: number;
  transactionCount: number;
  isLowStock: boolean;
  lastTransaction?: string;
}

export interface InventorySummary {
  totalItems: number;
  totalValue: number;
  totalCost: number;
  lowStockCount: number;
  totalTransactions: number;
}

export interface InventoryTransaction {
  inventoryId: string;
  itemId: string;
  dateTime: string;
  amount: number;
  referenceNumber: string;
  price: number;
  cost: number;
  deliveryPhoto?: string;
  status: 'completed' | 'pending' | 'cancelled';
  type: 'delivery' | 'restock' | 'return' | 'adjustment' | 'count';
  notes?: string;
}

// =============================================================================
// METADATA ENRICHMENT (fields not in xlsx)
// =============================================================================

const PRODUCT_META: Record<string, { category: string; unit: string; minQty: number; maxQty: number; supplier: string; location: string }> = {
  'item-123': { category: 'Fasteners', unit: 'box', minQty: 10, maxQty: 100, supplier: 'ABC Supply', location: 'Warehouse A' },
  'item-124': { category: 'Fasteners', unit: 'bag', minQty: 20, maxQty: 200, supplier: 'ABC Supply', location: 'Warehouse A' },
  'item-125': { category: 'Underlayment', unit: 'roll', minQty: 15, maxQty: 150, supplier: 'IKO Industries', location: 'Warehouse B' },
  'item-126': { category: 'Underlayment', unit: 'roll', minQty: 10, maxQty: 100, supplier: 'GAF Materials', location: 'Warehouse B' },
  'item-127': { category: 'Ventilation', unit: 'piece', minQty: 50, maxQty: 500, supplier: 'Air Vent Inc', location: 'Warehouse A' },
  'item-128': { category: 'Flashing', unit: 'each', minQty: 25, maxQty: 250, supplier: 'Oatey', location: 'Warehouse A' },
  'item-129': { category: 'Flashing', unit: 'each', minQty: 25, maxQty: 250, supplier: 'Oatey', location: 'Warehouse A' },
  'item-130': { category: 'Flashing', unit: 'each', minQty: 20, maxQty: 200, supplier: 'Oatey', location: 'Warehouse A' },
  'item-131': { category: 'Flashing', unit: 'each', minQty: 15, maxQty: 150, supplier: 'Oatey', location: 'Warehouse A' },
  'item-132': { category: 'Sealants', unit: 'tube', minQty: 50, maxQty: 500, supplier: 'Geocel', location: 'Warehouse A' },
  'item-133': { category: 'Flashing', unit: 'each', minQty: 10, maxQty: 100, supplier: 'Oatey', location: 'Warehouse A' },
};

const DEFAULT_META = { category: 'Uncategorized', unit: 'each', minQty: 10, maxQty: 100, supplier: 'Unknown', location: 'Warehouse A' };

// =============================================================================
// XLSX PARSING
// =============================================================================

function excelDateToISO(serial: number): string {
  // Excel serial date to JS Date
  const utcDays = Math.floor(serial - 25569);
  const utcValue = utcDays * 86400;
  const fractionalDay = serial - Math.floor(serial);
  const totalSeconds = Math.round(fractionalDay * 86400);
  const date = new Date((utcValue + totalSeconds) * 1000);
  return date.toISOString().replace('Z', '');
}

interface XlsxData {
  products: InventoryProduct[];
  transactions: InventoryTransaction[];
}

let _cache: XlsxData | null = null;
let _cacheTime = 0;
const CACHE_TTL = 60_000; // 1 minute

function readXlsx(): XlsxData {
  const now = Date.now();
  if (_cache && (now - _cacheTime) < CACHE_TTL) return _cache;

  const fileBuffer = fs.readFileSync(XLSX_PATH);
  const wb = XLSX.read(fileBuffer, { type: 'buffer' });

  // Parse Items sheet
  const itemsRaw = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets['Items']);
  const products: InventoryProduct[] = itemsRaw.map(row => {
    const id = String(row['Item ID'] || '');
    const meta = PRODUCT_META[id] || DEFAULT_META;
    return {
      productId: id,
      productName: String(row['Name'] || ''),
      description: String(row['Description'] || ''),
      imageUrl: String(row['Image'] || ''),
      cost: Number(row['Cost']) || 0,
      price: Number(row['Price']) || 0,
      category: meta.category,
      unit: meta.unit,
      minQty: meta.minQty,
      maxQty: meta.maxQty,
      currentQty: 0,
      supplier: meta.supplier,
      location: meta.location,
    };
  });

  // Parse Inventory sheet
  const invRaw = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets['Inventory']);
  const transactions: InventoryTransaction[] = invRaw.map(row => {
    const amount = Number(row['Amount']) || 0;
    const dt = row['DateTime'];
    const dateTime = typeof dt === 'number' ? excelDateToISO(dt) : String(dt || '');

    return {
      inventoryId: String(row['Inventory ID'] || ''),
      itemId: String(row['Item ID'] || ''),
      dateTime,
      amount,
      referenceNumber: String(row['R#'] || ''),
      price: Number(row['Price']) || 0,
      cost: Number(row['Cost']) || 0,
      deliveryPhoto: row['Delivery Photo'] ? String(row['Delivery Photo']) : undefined,
      status: 'completed' as const,
      type: (amount > 0 ? 'restock' : 'delivery') as InventoryTransaction['type'],
    };
  });

  _cache = { products, transactions };
  _cacheTime = now;
  return _cache;
}

// =============================================================================
// CORE COMPUTATION
// =============================================================================

function computeStockLevels(data: XlsxData): Map<string, { qty: number; count: number; lastDate: string }> {
  const stock = new Map<string, { qty: number; count: number; lastDate: string }>();

  for (const p of data.products) {
    stock.set(p.productId, { qty: 0, count: 0, lastDate: '' });
  }

  for (const tx of data.transactions) {
    const entry = stock.get(tx.itemId);
    if (entry) {
      entry.qty += tx.amount;
      entry.count++;
      if (!entry.lastDate || tx.dateTime > entry.lastDate) {
        entry.lastDate = tx.dateTime;
      }
    }
  }

  return stock;
}

// =============================================================================
// PUBLIC API
// =============================================================================

export function getInventory(filters?: {
  category?: string;
  lowStock?: boolean;
  search?: string;
}): ComputedInventoryItem[] {
  const data = readXlsx();
  const stock = computeStockLevels(data);

  let items: ComputedInventoryItem[] = data.products.map(p => {
    const s = stock.get(p.productId) || { qty: 0, count: 0, lastDate: '' };
    const qty = Math.max(0, s.qty);
    return {
      ...p,
      currentQty: qty,
      computedQty: qty,
      totalValue: qty * p.price,
      totalCost: qty * p.cost,
      transactionCount: s.count,
      isLowStock: qty <= p.minQty,
      lastTransaction: s.lastDate || undefined,
    };
  });

  if (filters?.category) {
    items = items.filter(i => i.category.toLowerCase() === filters.category!.toLowerCase());
  }
  if (filters?.lowStock) {
    items = items.filter(i => i.isLowStock);
  }
  if (filters?.search) {
    const q = filters.search.toLowerCase();
    items = items.filter(i =>
      i.productName.toLowerCase().includes(q) ||
      i.productId.toLowerCase().includes(q) ||
      i.description.toLowerCase().includes(q) ||
      i.supplier.toLowerCase().includes(q)
    );
  }

  return items;
}

export function getProduct(productId: string): ComputedInventoryItem | undefined {
  return getInventory().find(i => i.productId === productId);
}

export function getLowStockItems(): ComputedInventoryItem[] {
  return getInventory({ lowStock: true });
}

export function getTransactionHistory(itemId?: string, limit?: number): InventoryTransaction[] {
  const data = readXlsx();
  let txs = [...data.transactions];
  if (itemId) {
    txs = txs.filter(t => t.itemId === itemId);
  }
  txs.sort((a, b) => b.dateTime.localeCompare(a.dateTime));
  if (limit) {
    txs = txs.slice(0, limit);
  }
  return txs;
}

export function getInventorySummary(): InventorySummary {
  const items = getInventory();
  const data = readXlsx();
  return {
    totalItems: items.length,
    totalValue: items.reduce((sum, i) => sum + i.totalValue, 0),
    totalCost: items.reduce((sum, i) => sum + i.totalCost, 0),
    lowStockCount: items.filter(i => i.isLowStock).length,
    totalTransactions: data.transactions.length,
  };
}
