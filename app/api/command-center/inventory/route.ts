/**
 * RCRS Command Center - Inventory API
 *
 * Enterprise-grade inventory management with Google Sheets integration.
 * Implements strict role-based field filtering per RCRS Command Center specifications.
 *
 * Data Storage Hierarchy:
 * 1. Primary: Google Sheets (when GOOGLE_SERVICE_ACCOUNT_EMAIL and GOOGLE_PRIVATE_KEY are configured)
 * 2. Secondary: Local JSON file (data/inventory.json)
 * 3. Fallback: inventoryData.ts (11 built-in items from PDF inventory list)
 *
 * The API automatically selects the appropriate storage backend at runtime.
 *
 * @author RCRS Development Team
 * @version 1.2.0
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-service';
import { GoogleSpreadsheet, GoogleSpreadsheetRow } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';
import { Role, isValidRole, ROLE_HIERARCHY } from '@/types/roles';
import { promises as fs } from 'fs';
import path from 'path';
import { inventoryProducts, InventoryProduct } from '@/lib/inventoryData';

// =============================================================================
// CONFIGURATION
// =============================================================================

const SHEETS_ID = process.env.INVENTORY_SHEETS_ID || process.env.DELIVERY_SHEETS_ID || process.env.GOOGLE_SHEETS_ID;

const privateKey = process.env.GOOGLE_PRIVATE_KEY
  ?.replace(/\\n/g, '\n')
  ?.replace(/\r\n/g, '\n');

const serviceAccountAuth = new JWT({
  email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
  key: privateKey,
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

const INVENTORY_SHEET_NAME = 'Inventory';
const INVENTORY_LOGS_SHEET_NAME = 'InventoryLogs';

// Path to fallback JSON inventory file
const INVENTORY_JSON_PATH = path.join(process.cwd(), 'data', 'inventory.json');

// Check if Google Sheets is properly configured
const isGoogleSheetsConfigured = !!(
  SHEETS_ID &&
  process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL &&
  privateKey
);

// =============================================================================
// TYPE DEFINITIONS
// =============================================================================

/**
 * Full inventory item as stored in Google Sheets
 */
interface InventoryItemFull {
  sku: string;
  name: string;
  description: string;
  category: string;
  cost: number;
  price: number;
  quantity: number;
  minStock: number;
  maxStock: number;
  unit: string;
  supplier: string;
  location: string;
  imageUrl: string;
  lastUpdated: string;
  updatedBy: string;
}

/**
 * Inventory item for Sales role (no cost/price)
 */
interface InventoryItemSales {
  sku: string;
  name: string;
  description: string;
  category: string;
  quantity: number;
  minStock: number;
  unit: string;
  location: string;
  imageUrl: string;
}

/**
 * Inventory item for Driver role (minimal fields)
 */
interface InventoryItemDriver {
  sku: string;
  name: string;
  quantity: number;
  unit: string;
  location: string;
}

/**
 * Union type for filtered inventory items
 */
type InventoryItem = InventoryItemFull | InventoryItemSales | InventoryItemDriver;

/**
 * Inventory adjustment log entry
 */
interface InventoryLog {
  logId: string;
  sku: string;
  itemName: string;
  previousQty: number;
  newQty: number;
  adjustment: number;
  reason: string;
  userId: string;
  userName: string;
  timestamp: string;
}

/**
 * API Response format
 */
interface InventoryApiResponse {
  success: boolean;
  data?: {
    items?: InventoryItem[];
    item?: InventoryItem;
    summary?: {
      totalItems: number;
      lowStockCount: number;
      totalValue?: number; // Only for permitted roles
      totalCost?: number;  // Only for permitted roles
    };
  };
  error?: string;
  message?: string;
}

/**
 * Create item request body
 */
interface CreateItemRequest {
  sku: string;
  name: string;
  description?: string;
  category: string;
  cost: number;
  price: number;
  quantity: number;
  minStock?: number;
  maxStock?: number;
  unit?: string;
  supplier?: string;
  location?: string;
  imageUrl?: string;
}

/**
 * Update item request body
 */
interface UpdateItemRequest {
  sku: string;
  updates?: Partial<Omit<InventoryItemFull, 'sku' | 'lastUpdated' | 'updatedBy'>>;
  adjustment?: number;
  reason?: string;
}

/**
 * Delete item request body
 */
interface DeleteItemRequest {
  sku: string;
}

/**
 * JSON file data structure
 */
interface InventoryJsonData {
  items: InventoryItemFull[];
  logs: InventoryLog[];
}

// =============================================================================
// JSON FALLBACK SERVICE
// =============================================================================

/**
 * Fallback service that uses local JSON file when Google Sheets is not configured.
 * Provides read/write operations for development and testing without cloud dependencies.
 */
class JsonInventoryService {
  private data: InventoryJsonData | null = null;

  private generateId(prefix: string): string {
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `${prefix}-${timestamp}-${random}`;
  }

  /**
   * Convert InventoryProduct from inventoryData.ts to InventoryItemFull format
   */
  private convertInventoryProduct(product: InventoryProduct): InventoryItemFull {
    return {
      sku: product.productId,
      name: product.productName,
      description: product.description,
      category: product.category,
      cost: product.cost,
      price: product.price,
      quantity: product.currentQty,
      minStock: product.minQty,
      maxStock: product.maxQty,
      unit: product.unit,
      supplier: product.supplier,
      location: product.location,
      imageUrl: product.imageUrl,
      lastUpdated: new Date().toISOString(),
      updatedBy: 'System',
    };
  }

  /**
   * Get default inventory items from inventoryData.ts
   */
  private getDefaultInventoryItems(): InventoryItemFull[] {
    return inventoryProducts.map(product => this.convertInventoryProduct(product));
  }

  private async loadData(): Promise<InventoryJsonData> {
    if (this.data && this.data.items.length > 0) return this.data;

    try {
      const fileContent = await fs.readFile(INVENTORY_JSON_PATH, 'utf-8');
      const jsonData = JSON.parse(fileContent) as InventoryJsonData;

      // If JSON file has items, use them
      if (jsonData.items && jsonData.items.length > 0) {
        this.data = jsonData;
        return this.data;
      }
    } catch (error) {
      console.log('JSON file not found or invalid, using inventoryData.ts as source');
    }

    // Fallback to inventoryProducts from inventoryData.ts
    console.log('Loading inventory from inventoryData.ts (11 items)');
    this.data = {
      items: this.getDefaultInventoryItems(),
      logs: []
    };
    return this.data;
  }

  private async saveData(): Promise<void> {
    if (!this.data) return;

    try {
      await fs.writeFile(INVENTORY_JSON_PATH, JSON.stringify(this.data, null, 2), 'utf-8');
    } catch (error) {
      console.error('Failed to save inventory JSON:', error);
      throw new Error('Failed to save inventory data');
    }
  }

  async getInventory(options?: {
    category?: string;
    lowStock?: boolean;
    search?: string;
  }): Promise<InventoryItemFull[]> {
    const data = await this.loadData();
    let items = [...data.items];

    // Apply filters
    if (options?.category) {
      items = items.filter(item =>
        item.category.toLowerCase() === options.category!.toLowerCase()
      );
    }

    if (options?.lowStock) {
      items = items.filter(item => item.quantity <= item.minStock);
    }

    if (options?.search) {
      const searchLower = options.search.toLowerCase();
      items = items.filter(item =>
        item.sku.toLowerCase().includes(searchLower) ||
        item.name.toLowerCase().includes(searchLower) ||
        item.description.toLowerCase().includes(searchLower) ||
        item.category.toLowerCase().includes(searchLower) ||
        item.supplier.toLowerCase().includes(searchLower)
      );
    }

    return items.sort((a, b) => a.name.localeCompare(b.name));
  }

  async getItemBySku(sku: string): Promise<InventoryItemFull | null> {
    const data = await this.loadData();
    return data.items.find(item => item.sku === sku) || null;
  }

  async createItem(itemData: CreateItemRequest, userId: string, userName: string): Promise<InventoryItemFull> {
    const data = await this.loadData();

    // Check for duplicate SKU
    const existing = data.items.find(item => item.sku === itemData.sku);
    if (existing) {
      throw new Error(`Item with SKU ${itemData.sku} already exists`);
    }

    const now = new Date().toISOString();
    const item: InventoryItemFull = {
      sku: itemData.sku,
      name: itemData.name,
      description: itemData.description || '',
      category: itemData.category,
      cost: itemData.cost,
      price: itemData.price,
      quantity: itemData.quantity,
      minStock: itemData.minStock ?? 10,
      maxStock: itemData.maxStock ?? 100,
      unit: itemData.unit || 'each',
      supplier: itemData.supplier || '',
      location: itemData.location || '',
      imageUrl: itemData.imageUrl || '',
      lastUpdated: now,
      updatedBy: userName,
    };

    data.items.push(item);

    // Log the creation
    data.logs.push({
      logId: this.generateId('LOG'),
      sku: item.sku,
      itemName: item.name,
      previousQty: 0,
      newQty: item.quantity,
      adjustment: item.quantity,
      reason: 'Initial inventory creation',
      userId,
      userName,
      timestamp: now,
    });

    await this.saveData();
    return item;
  }

  async updateItem(
    sku: string,
    updates: Partial<Omit<InventoryItemFull, 'sku' | 'lastUpdated' | 'updatedBy'>>,
    userId: string,
    userName: string
  ): Promise<InventoryItemFull> {
    const data = await this.loadData();
    const itemIndex = data.items.findIndex(item => item.sku === sku);

    if (itemIndex === -1) {
      throw new Error(`Item with SKU ${sku} not found`);
    }

    const item = data.items[itemIndex];
    const previousQty = item.quantity;
    const now = new Date().toISOString();

    // Apply updates
    if (updates.name !== undefined) item.name = updates.name;
    if (updates.description !== undefined) item.description = updates.description;
    if (updates.category !== undefined) item.category = updates.category;
    if (updates.cost !== undefined) item.cost = updates.cost;
    if (updates.price !== undefined) item.price = updates.price;
    if (updates.quantity !== undefined) item.quantity = updates.quantity;
    if (updates.minStock !== undefined) item.minStock = updates.minStock;
    if (updates.maxStock !== undefined) item.maxStock = updates.maxStock;
    if (updates.unit !== undefined) item.unit = updates.unit;
    if (updates.supplier !== undefined) item.supplier = updates.supplier;
    if (updates.location !== undefined) item.location = updates.location;
    if (updates.imageUrl !== undefined) item.imageUrl = updates.imageUrl;

    item.lastUpdated = now;
    item.updatedBy = userName;

    // Log quantity changes
    if (updates.quantity !== undefined && updates.quantity !== previousQty) {
      data.logs.push({
        logId: this.generateId('LOG'),
        sku,
        itemName: item.name,
        previousQty,
        newQty: updates.quantity,
        adjustment: updates.quantity - previousQty,
        reason: 'Manual quantity update',
        userId,
        userName,
        timestamp: now,
      });
    }

    await this.saveData();
    return item;
  }

  async adjustQuantity(
    sku: string,
    adjustment: number,
    reason: string,
    userId: string,
    userName: string
  ): Promise<InventoryItemFull> {
    const data = await this.loadData();
    const item = data.items.find(i => i.sku === sku);

    if (!item) {
      throw new Error(`Item with SKU ${sku} not found`);
    }

    const previousQty = item.quantity;
    const newQty = Math.max(0, previousQty + adjustment);
    const now = new Date().toISOString();

    item.quantity = newQty;
    item.lastUpdated = now;
    item.updatedBy = userName;

    // Log the adjustment
    data.logs.push({
      logId: this.generateId('LOG'),
      sku,
      itemName: item.name,
      previousQty,
      newQty,
      adjustment,
      reason,
      userId,
      userName,
      timestamp: now,
    });

    await this.saveData();
    return item;
  }

  async deleteItem(sku: string, userId: string, userName: string): Promise<boolean> {
    const data = await this.loadData();
    const itemIndex = data.items.findIndex(item => item.sku === sku);

    if (itemIndex === -1) {
      throw new Error(`Item with SKU ${sku} not found`);
    }

    const item = data.items[itemIndex];
    const now = new Date().toISOString();

    // Log the deletion
    data.logs.push({
      logId: this.generateId('LOG'),
      sku,
      itemName: item.name,
      previousQty: item.quantity,
      newQty: 0,
      adjustment: -item.quantity,
      reason: 'Item deleted',
      userId,
      userName,
      timestamp: now,
    });

    data.items.splice(itemIndex, 1);
    await this.saveData();
    return true;
  }

  async getSummary(): Promise<{
    totalItems: number;
    lowStockCount: number;
    totalValue: number;
    totalCost: number;
  }> {
    const data = await this.loadData();

    return {
      totalItems: data.items.length,
      lowStockCount: data.items.filter(item => item.quantity <= item.minStock).length,
      totalValue: data.items.reduce((sum, item) => sum + (item.quantity * item.price), 0),
      totalCost: data.items.reduce((sum, item) => sum + (item.quantity * item.cost), 0),
    };
  }
}

// =============================================================================
// GOOGLE SHEETS SERVICE
// =============================================================================

class InventoryService {
  private doc: GoogleSpreadsheet | null = null;
  private initialized = false;

  async init(): Promise<boolean> {
    if (this.initialized && this.doc) return true;

    if (!SHEETS_ID || !process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || !privateKey) {
      console.error('Google Sheets credentials not configured');
      return false;
    }

    try {
      this.doc = new GoogleSpreadsheet(SHEETS_ID, serviceAccountAuth);
      await this.doc.loadInfo();
      this.initialized = true;
      return true;
    } catch (error) {
      console.error('Failed to initialize Google Sheets:', error);
      return false;
    }
  }

  private async getOrCreateSheet(name: string, headers: string[]) {
    if (!this.doc) throw new Error('Google Sheets not initialized');

    let sheet = this.doc.sheetsByTitle[name];
    if (!sheet) {
      sheet = await this.doc.addSheet({ title: name, headerValues: headers });
    }
    return sheet;
  }

  private generateId(prefix: string): string {
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `${prefix}-${timestamp}-${random}`;
  }

  /**
   * Get all inventory items from Google Sheets
   */
  async getInventory(options?: {
    category?: string;
    lowStock?: boolean;
    search?: string;
  }): Promise<InventoryItemFull[]> {
    const ready = await this.init();
    if (!ready || !this.doc) {
      throw new Error('Google Sheets not initialized');
    }

    const sheet = await this.getOrCreateSheet(INVENTORY_SHEET_NAME, [
      'sku', 'name', 'description', 'category', 'cost', 'price',
      'quantity', 'minStock', 'maxStock', 'unit', 'supplier',
      'location', 'imageUrl', 'lastUpdated', 'updatedBy'
    ]);

    const rows = await sheet.getRows();
    let items: InventoryItemFull[] = rows.map(row => ({
      sku: row.get('sku') || '',
      name: row.get('name') || '',
      description: row.get('description') || '',
      category: row.get('category') || '',
      cost: parseFloat(row.get('cost')) || 0,
      price: parseFloat(row.get('price')) || 0,
      quantity: parseInt(row.get('quantity')) || 0,
      minStock: parseInt(row.get('minStock')) || 10,
      maxStock: parseInt(row.get('maxStock')) || 100,
      unit: row.get('unit') || 'each',
      supplier: row.get('supplier') || '',
      location: row.get('location') || '',
      imageUrl: row.get('imageUrl') || '',
      lastUpdated: row.get('lastUpdated') || '',
      updatedBy: row.get('updatedBy') || '',
    }));

    // Apply filters
    if (options?.category) {
      items = items.filter(item =>
        item.category.toLowerCase() === options.category!.toLowerCase()
      );
    }

    if (options?.lowStock) {
      items = items.filter(item => item.quantity <= item.minStock);
    }

    if (options?.search) {
      const searchLower = options.search.toLowerCase();
      items = items.filter(item =>
        item.sku.toLowerCase().includes(searchLower) ||
        item.name.toLowerCase().includes(searchLower) ||
        item.description.toLowerCase().includes(searchLower) ||
        item.category.toLowerCase().includes(searchLower) ||
        item.supplier.toLowerCase().includes(searchLower)
      );
    }

    return items.sort((a, b) => a.name.localeCompare(b.name));
  }

  /**
   * Get a single inventory item by SKU
   */
  async getItemBySku(sku: string): Promise<InventoryItemFull | null> {
    const items = await this.getInventory();
    return items.find(item => item.sku === sku) || null;
  }

  /**
   * Create a new inventory item
   */
  async createItem(data: CreateItemRequest, userId: string, userName: string): Promise<InventoryItemFull> {
    const ready = await this.init();
    if (!ready || !this.doc) {
      throw new Error('Google Sheets not initialized');
    }

    // Check for duplicate SKU
    const existing = await this.getItemBySku(data.sku);
    if (existing) {
      throw new Error(`Item with SKU ${data.sku} already exists`);
    }

    const sheet = await this.getOrCreateSheet(INVENTORY_SHEET_NAME, [
      'sku', 'name', 'description', 'category', 'cost', 'price',
      'quantity', 'minStock', 'maxStock', 'unit', 'supplier',
      'location', 'imageUrl', 'lastUpdated', 'updatedBy'
    ]);

    const now = new Date().toISOString();
    const item: InventoryItemFull = {
      sku: data.sku,
      name: data.name,
      description: data.description || '',
      category: data.category,
      cost: data.cost,
      price: data.price,
      quantity: data.quantity,
      minStock: data.minStock ?? 10,
      maxStock: data.maxStock ?? 100,
      unit: data.unit || 'each',
      supplier: data.supplier || '',
      location: data.location || '',
      imageUrl: data.imageUrl || '',
      lastUpdated: now,
      updatedBy: userName,
    };

    await sheet.addRow({
      ...item,
      cost: item.cost.toString(),
      price: item.price.toString(),
      quantity: item.quantity.toString(),
      minStock: item.minStock.toString(),
      maxStock: item.maxStock.toString(),
    });

    // Log the creation
    await this.logInventoryChange({
      sku: item.sku,
      itemName: item.name,
      previousQty: 0,
      newQty: item.quantity,
      adjustment: item.quantity,
      reason: 'Initial inventory creation',
      userId,
      userName,
    });

    return item;
  }

  /**
   * Update an inventory item
   */
  async updateItem(
    sku: string,
    updates: Partial<Omit<InventoryItemFull, 'sku' | 'lastUpdated' | 'updatedBy'>>,
    userId: string,
    userName: string
  ): Promise<InventoryItemFull> {
    const ready = await this.init();
    if (!ready || !this.doc) {
      throw new Error('Google Sheets not initialized');
    }

    const sheet = this.doc.sheetsByTitle[INVENTORY_SHEET_NAME];
    if (!sheet) {
      throw new Error('Inventory sheet not found');
    }

    const rows = await sheet.getRows();
    const row = rows.find(r => r.get('sku') === sku);

    if (!row) {
      throw new Error(`Item with SKU ${sku} not found`);
    }

    const previousQty = parseInt(row.get('quantity')) || 0;
    const now = new Date().toISOString();

    // Apply updates
    if (updates.name !== undefined) row.set('name', updates.name);
    if (updates.description !== undefined) row.set('description', updates.description);
    if (updates.category !== undefined) row.set('category', updates.category);
    if (updates.cost !== undefined) row.set('cost', updates.cost.toString());
    if (updates.price !== undefined) row.set('price', updates.price.toString());
    if (updates.quantity !== undefined) row.set('quantity', updates.quantity.toString());
    if (updates.minStock !== undefined) row.set('minStock', updates.minStock.toString());
    if (updates.maxStock !== undefined) row.set('maxStock', updates.maxStock.toString());
    if (updates.unit !== undefined) row.set('unit', updates.unit);
    if (updates.supplier !== undefined) row.set('supplier', updates.supplier);
    if (updates.location !== undefined) row.set('location', updates.location);
    if (updates.imageUrl !== undefined) row.set('imageUrl', updates.imageUrl);

    row.set('lastUpdated', now);
    row.set('updatedBy', userName);

    await row.save();

    // Log quantity changes
    if (updates.quantity !== undefined && updates.quantity !== previousQty) {
      await this.logInventoryChange({
        sku,
        itemName: row.get('name'),
        previousQty,
        newQty: updates.quantity,
        adjustment: updates.quantity - previousQty,
        reason: 'Manual quantity update',
        userId,
        userName,
      });
    }

    // Return updated item
    return {
      sku: row.get('sku'),
      name: row.get('name'),
      description: row.get('description'),
      category: row.get('category'),
      cost: parseFloat(row.get('cost')) || 0,
      price: parseFloat(row.get('price')) || 0,
      quantity: parseInt(row.get('quantity')) || 0,
      minStock: parseInt(row.get('minStock')) || 10,
      maxStock: parseInt(row.get('maxStock')) || 100,
      unit: row.get('unit') || 'each',
      supplier: row.get('supplier') || '',
      location: row.get('location') || '',
      imageUrl: row.get('imageUrl') || '',
      lastUpdated: row.get('lastUpdated'),
      updatedBy: row.get('updatedBy'),
    };
  }

  /**
   * Adjust inventory quantity
   */
  async adjustQuantity(
    sku: string,
    adjustment: number,
    reason: string,
    userId: string,
    userName: string
  ): Promise<InventoryItemFull> {
    const ready = await this.init();
    if (!ready || !this.doc) {
      throw new Error('Google Sheets not initialized');
    }

    const sheet = this.doc.sheetsByTitle[INVENTORY_SHEET_NAME];
    if (!sheet) {
      throw new Error('Inventory sheet not found');
    }

    const rows = await sheet.getRows();
    const row = rows.find(r => r.get('sku') === sku);

    if (!row) {
      throw new Error(`Item with SKU ${sku} not found`);
    }

    const previousQty = parseInt(row.get('quantity')) || 0;
    const newQty = Math.max(0, previousQty + adjustment);
    const now = new Date().toISOString();

    row.set('quantity', newQty.toString());
    row.set('lastUpdated', now);
    row.set('updatedBy', userName);
    await row.save();

    // Log the adjustment
    await this.logInventoryChange({
      sku,
      itemName: row.get('name'),
      previousQty,
      newQty,
      adjustment,
      reason,
      userId,
      userName,
    });

    return {
      sku: row.get('sku'),
      name: row.get('name'),
      description: row.get('description'),
      category: row.get('category'),
      cost: parseFloat(row.get('cost')) || 0,
      price: parseFloat(row.get('price')) || 0,
      quantity: newQty,
      minStock: parseInt(row.get('minStock')) || 10,
      maxStock: parseInt(row.get('maxStock')) || 100,
      unit: row.get('unit') || 'each',
      supplier: row.get('supplier') || '',
      location: row.get('location') || '',
      imageUrl: row.get('imageUrl') || '',
      lastUpdated: now,
      updatedBy: userName,
    };
  }

  /**
   * Delete an inventory item
   */
  async deleteItem(sku: string, userId: string, userName: string): Promise<boolean> {
    const ready = await this.init();
    if (!ready || !this.doc) {
      throw new Error('Google Sheets not initialized');
    }

    const sheet = this.doc.sheetsByTitle[INVENTORY_SHEET_NAME];
    if (!sheet) {
      throw new Error('Inventory sheet not found');
    }

    const rows = await sheet.getRows();
    const row = rows.find(r => r.get('sku') === sku);

    if (!row) {
      throw new Error(`Item with SKU ${sku} not found`);
    }

    const itemName = row.get('name');
    const quantity = parseInt(row.get('quantity')) || 0;

    await row.delete();

    // Log the deletion
    await this.logInventoryChange({
      sku,
      itemName,
      previousQty: quantity,
      newQty: 0,
      adjustment: -quantity,
      reason: 'Item deleted',
      userId,
      userName,
    });

    return true;
  }

  /**
   * Log inventory changes for audit trail
   */
  private async logInventoryChange(data: Omit<InventoryLog, 'logId' | 'timestamp'>): Promise<void> {
    if (!this.doc) return;

    try {
      const sheet = await this.getOrCreateSheet(INVENTORY_LOGS_SHEET_NAME, [
        'logId', 'sku', 'itemName', 'previousQty', 'newQty',
        'adjustment', 'reason', 'userId', 'userName', 'timestamp'
      ]);

      await sheet.addRow({
        logId: this.generateId('LOG'),
        sku: data.sku,
        itemName: data.itemName,
        previousQty: data.previousQty.toString(),
        newQty: data.newQty.toString(),
        adjustment: data.adjustment.toString(),
        reason: data.reason,
        userId: data.userId,
        userName: data.userName,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Failed to log inventory change:', error);
      // Don't throw - logging failure shouldn't break the main operation
    }
  }

  /**
   * Calculate inventory summary
   */
  async getSummary(): Promise<{
    totalItems: number;
    lowStockCount: number;
    totalValue: number;
    totalCost: number;
  }> {
    const items = await this.getInventory();

    return {
      totalItems: items.length,
      lowStockCount: items.filter(item => item.quantity <= item.minStock).length,
      totalValue: items.reduce((sum, item) => sum + (item.quantity * item.price), 0),
      totalCost: items.reduce((sum, item) => sum + (item.quantity * item.cost), 0),
    };
  }
}

// =============================================================================
// ROLE-BASED FIELD FILTERING
// =============================================================================

/**
 * Roles that can view cost information
 */
const COST_VIEW_ROLES: Role[] = ['Owner', 'Admin', 'Manager'];

/**
 * Roles that can view price information
 */
const PRICE_VIEW_ROLES: Role[] = ['Owner', 'Admin', 'Manager'];

/**
 * Roles that can edit inventory
 */
const EDIT_ROLES: Role[] = ['Owner', 'Admin', 'Manager'];

/**
 * Roles that can delete inventory
 */
const DELETE_ROLES: Role[] = ['Owner', 'Admin'];

/**
 * Check if a role can view costs
 */
function canViewCosts(role: Role): boolean {
  return COST_VIEW_ROLES.includes(role);
}

/**
 * Check if a role can view prices
 */
function canViewPrices(role: Role): boolean {
  return PRICE_VIEW_ROLES.includes(role);
}

/**
 * Check if a role can edit inventory
 */
function canEditInventory(role: Role): boolean {
  return EDIT_ROLES.includes(role);
}

/**
 * Check if a role can delete inventory
 */
function canDeleteInventory(role: Role): boolean {
  return DELETE_ROLES.includes(role);
}

/**
 * Filter inventory item fields based on role
 */
function filterItemForRole(item: InventoryItemFull, role: Role): InventoryItem {
  // Driver: minimal fields only
  if (role === 'Driver') {
    return {
      sku: item.sku,
      name: item.name,
      quantity: item.quantity,
      unit: item.unit,
      location: item.location,
    } as InventoryItemDriver;
  }

  // Sales: no cost or price
  if (role === 'Sales') {
    return {
      sku: item.sku,
      name: item.name,
      description: item.description,
      category: item.category,
      quantity: item.quantity,
      minStock: item.minStock,
      unit: item.unit,
      location: item.location,
      imageUrl: item.imageUrl,
    } as InventoryItemSales;
  }

  // Office: same as sales (no cost/price visibility for billing staff per spec)
  if (role === 'Office') {
    return {
      sku: item.sku,
      name: item.name,
      description: item.description,
      category: item.category,
      quantity: item.quantity,
      minStock: item.minStock,
      unit: item.unit,
      location: item.location,
      imageUrl: item.imageUrl,
    } as InventoryItemSales;
  }

  // Owner, Admin, Manager: full access
  return item;
}

/**
 * Filter summary for role
 */
function filterSummaryForRole(
  summary: { totalItems: number; lowStockCount: number; totalValue: number; totalCost: number },
  role: Role
): { totalItems: number; lowStockCount: number; totalValue?: number; totalCost?: number } {
  const filtered: { totalItems: number; lowStockCount: number; totalValue?: number; totalCost?: number } = {
    totalItems: summary.totalItems,
    lowStockCount: summary.lowStockCount,
  };

  if (canViewPrices(role)) {
    filtered.totalValue = summary.totalValue;
  }

  if (canViewCosts(role)) {
    filtered.totalCost = summary.totalCost;
  }

  return filtered;
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Extract role from request headers or query params
 */
function getRoleFromRequest(request: NextRequest): Role {
  // Try headers first (set by auth middleware)
  const headerRole = request.headers.get('x-user-role');
  if (headerRole && isValidRole(headerRole)) {
    return headerRole as Role;
  }

  // Fall back to query param (for testing)
  const { searchParams } = new URL(request.url);
  const queryRole = searchParams.get('role');
  if (queryRole && isValidRole(queryRole)) {
    return queryRole as Role;
  }

  // Default to most restrictive
  return 'Driver';
}

/**
 * Extract user info from request
 */
function getUserFromRequest(request: NextRequest): { userId: string; userName: string } {
  const userId = request.headers.get('x-user-id') || 'unknown';
  const userName = request.headers.get('x-user-name') || 'Unknown User';
  return { userId, userName };
}

/**
 * Validate required fields
 */
function validateCreateRequest(data: unknown): data is CreateItemRequest {
  if (!data || typeof data !== 'object') return false;

  const d = data as Record<string, unknown>;
  return (
    typeof d.sku === 'string' && d.sku.length > 0 &&
    typeof d.name === 'string' && d.name.length > 0 &&
    typeof d.category === 'string' && d.category.length > 0 &&
    typeof d.cost === 'number' && d.cost >= 0 &&
    typeof d.price === 'number' && d.price >= 0 &&
    typeof d.quantity === 'number' && d.quantity >= 0
  );
}

// =============================================================================
// API ROUTE HANDLERS
// =============================================================================

// Use Google Sheets if configured, otherwise fall back to JSON file
const googleSheetsService = new InventoryService();
const jsonService = new JsonInventoryService();

/**
 * Get the appropriate inventory service based on configuration.
 * Returns Google Sheets service if configured, otherwise JSON fallback.
 */
async function getInventoryService(): Promise<InventoryService | JsonInventoryService> {
  if (isGoogleSheetsConfigured) {
    const initialized = await googleSheetsService.init();
    if (initialized) {
      return googleSheetsService;
    }
    console.warn('Google Sheets initialization failed, falling back to JSON');
  }
  return jsonService;
}

/**
 * GET /api/command-center/inventory
 *
 * Returns all inventory items with role-based field filtering.
 *
 * Query Parameters:
 * - category: Filter by category
 * - lowStock: If "true", only return low stock items
 * - search: Search term for SKU, name, description, category, or supplier
 * - role: Override role for testing (use header x-user-role in production)
 */
export async function GET(request: NextRequest): Promise<NextResponse<InventoryApiResponse>> {
  const auth = await requireAuth();
  if (!auth.authenticated) return auth.response as NextResponse<InventoryApiResponse>;

  try {
    const role = getRoleFromRequest(request);
    const { searchParams } = new URL(request.url);

    const category = searchParams.get('category') || undefined;
    const lowStock = searchParams.get('lowStock') === 'true';
    const search = searchParams.get('search') || undefined;

    // Get the appropriate service (Google Sheets or JSON fallback)
    const service = await getInventoryService();

    // Get full inventory
    const items = await service.getInventory({ category, lowStock, search });

    // Get summary
    const summaryFull = await service.getSummary();

    // Apply role-based filtering
    const filteredItems = items.map(item => filterItemForRole(item, role));
    const filteredSummary = filterSummaryForRole(summaryFull, role);

    return NextResponse.json({
      success: true,
      data: {
        items: filteredItems,
        summary: filteredSummary,
      },
    });
  } catch (error) {
    console.error('GET /api/command-center/inventory error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch inventory',
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/command-center/inventory
 *
 * Create a new inventory item.
 * Requires Owner, Admin, or Manager role.
 *
 * Body:
 * - sku: string (required)
 * - name: string (required)
 * - description: string (optional)
 * - category: string (required)
 * - cost: number (required)
 * - price: number (required)
 * - quantity: number (required)
 * - minStock: number (optional, default 10)
 * - maxStock: number (optional, default 100)
 * - unit: string (optional, default "each")
 * - supplier: string (optional)
 * - location: string (optional)
 * - imageUrl: string (optional)
 */
export async function POST(request: NextRequest): Promise<NextResponse<InventoryApiResponse>> {
  const auth = await requireAuth();
  if (!auth.authenticated) return auth.response as NextResponse<InventoryApiResponse>;

  try {
    const role = getRoleFromRequest(request);

    // Check permission
    if (!canEditInventory(role)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Insufficient permissions. Requires Owner, Admin, or Manager role.',
        },
        { status: 403 }
      );
    }

    const body = await request.json();

    // Validate request
    if (!validateCreateRequest(body)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid request. Required fields: sku, name, category, cost, price, quantity',
        },
        { status: 400 }
      );
    }

    const { userId, userName } = getUserFromRequest(request);

    // Get the appropriate service (Google Sheets or JSON fallback)
    const service = await getInventoryService();

    // Create item
    const item = await service.createItem(body, userId, userName);

    // Filter response based on role
    const filteredItem = filterItemForRole(item, role);

    return NextResponse.json({
      success: true,
      data: {
        item: filteredItem,
      },
      message: `Successfully created inventory item: ${item.name}`,
    });
  } catch (error) {
    console.error('POST /api/command-center/inventory error:', error);

    const status = error instanceof Error && error.message.includes('already exists') ? 409 : 500;

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create inventory item',
      },
      { status }
    );
  }
}

/**
 * PATCH /api/command-center/inventory
 *
 * Update an inventory item or adjust stock.
 * Requires Owner, Admin, or Manager role.
 *
 * Body Option 1 - Update fields:
 * - sku: string (required)
 * - updates: { name?, description?, category?, cost?, price?, quantity?, minStock?, maxStock?, unit?, supplier?, location?, imageUrl? }
 *
 * Body Option 2 - Adjust stock:
 * - sku: string (required)
 * - adjustment: number (positive to add, negative to subtract)
 * - reason: string (required for adjustments)
 */
export async function PATCH(request: NextRequest): Promise<NextResponse<InventoryApiResponse>> {
  const auth = await requireAuth();
  if (!auth.authenticated) return auth.response as NextResponse<InventoryApiResponse>;

  try {
    const role = getRoleFromRequest(request);

    // Check permission
    if (!canEditInventory(role)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Insufficient permissions. Requires Owner, Admin, or Manager role.',
        },
        { status: 403 }
      );
    }

    const body: UpdateItemRequest = await request.json();

    // Validate SKU
    if (!body.sku || typeof body.sku !== 'string') {
      return NextResponse.json(
        {
          success: false,
          error: 'SKU is required',
        },
        { status: 400 }
      );
    }

    const { userId, userName } = getUserFromRequest(request);
    let item: InventoryItemFull;

    // Get the appropriate service (Google Sheets or JSON fallback)
    const service = await getInventoryService();

    // Handle stock adjustment
    if (body.adjustment !== undefined) {
      if (typeof body.adjustment !== 'number') {
        return NextResponse.json(
          {
            success: false,
            error: 'Adjustment must be a number',
          },
          { status: 400 }
        );
      }

      if (!body.reason || typeof body.reason !== 'string') {
        return NextResponse.json(
          {
            success: false,
            error: 'Reason is required for stock adjustments',
          },
          { status: 400 }
        );
      }

      item = await service.adjustQuantity(
        body.sku,
        body.adjustment,
        body.reason,
        userId,
        userName
      );
    }
    // Handle field updates
    else if (body.updates && typeof body.updates === 'object') {
      item = await service.updateItem(
        body.sku,
        body.updates,
        userId,
        userName
      );
    }
    // Invalid request
    else {
      return NextResponse.json(
        {
          success: false,
          error: 'Either updates object or adjustment number is required',
        },
        { status: 400 }
      );
    }

    // Filter response based on role
    const filteredItem = filterItemForRole(item, role);

    return NextResponse.json({
      success: true,
      data: {
        item: filteredItem,
      },
      message: `Successfully updated inventory item: ${item.name}`,
    });
  } catch (error) {
    console.error('PATCH /api/command-center/inventory error:', error);

    const status = error instanceof Error && error.message.includes('not found') ? 404 : 500;

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update inventory item',
      },
      { status }
    );
  }
}

/**
 * DELETE /api/command-center/inventory
 *
 * Delete an inventory item.
 * Requires Owner or Admin role.
 *
 * Body:
 * - sku: string (required)
 */
export async function DELETE(request: NextRequest): Promise<NextResponse<InventoryApiResponse>> {
  const auth = await requireAuth();
  if (!auth.authenticated) return auth.response as NextResponse<InventoryApiResponse>;

  try {
    const role = getRoleFromRequest(request);

    // Check permission - only Owner and Admin can delete
    if (!canDeleteInventory(role)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Insufficient permissions. Requires Owner or Admin role.',
        },
        { status: 403 }
      );
    }

    const body: DeleteItemRequest = await request.json();

    // Validate SKU
    if (!body.sku || typeof body.sku !== 'string') {
      return NextResponse.json(
        {
          success: false,
          error: 'SKU is required',
        },
        { status: 400 }
      );
    }

    const { userId, userName } = getUserFromRequest(request);

    // Get the appropriate service (Google Sheets or JSON fallback)
    const service = await getInventoryService();

    // Delete item
    await service.deleteItem(body.sku, userId, userName);

    return NextResponse.json({
      success: true,
      message: `Successfully deleted inventory item with SKU: ${body.sku}`,
    });
  } catch (error) {
    console.error('DELETE /api/command-center/inventory error:', error);

    const status = error instanceof Error && error.message.includes('not found') ? 404 : 500;

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to delete inventory item',
      },
      { status }
    );
  }
}
