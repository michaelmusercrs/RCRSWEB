/**
 * RCRS Command Center - Inventory API
 *
 * Uses the central inventory-management-service and inventoryData as single source of truth.
 * Implements role-based field filtering per RCRS Command Center specifications.
 *
 * @version 2.0.0 - Unified with central inventory service
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-service';
import { Role, isValidRole } from '@/types/roles';
import { inventoryProducts, type InventoryProduct } from '@/lib/inventoryData';
import { inventoryManagementService } from '@/lib/inventory-management-service';
import { cache, CACHE_TTL } from '@/lib/cache';

// =============================================================================
// TYPE DEFINITIONS
// =============================================================================

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

interface InventoryItemDriver {
  sku: string;
  name: string;
  quantity: number;
  unit: string;
  location: string;
}

type InventoryItem = InventoryItemFull | InventoryItemSales | InventoryItemDriver;

interface InventoryApiResponse {
  success: boolean;
  data?: {
    items?: InventoryItem[];
    item?: InventoryItem;
    summary?: {
      totalItems: number;
      lowStockCount: number;
      totalValue?: number;
      totalCost?: number;
    };
  };
  error?: string;
  message?: string;
}

// =============================================================================
// HELPERS
// =============================================================================

const COST_VIEW_ROLES: Role[] = ['Owner', 'Admin', 'Manager'];
const PRICE_VIEW_ROLES: Role[] = ['Owner', 'Admin', 'Manager'];
const EDIT_ROLES: Role[] = ['Owner', 'Admin', 'Manager'];
const DELETE_ROLES: Role[] = ['Owner', 'Admin'];

function canViewCosts(role: Role): boolean { return COST_VIEW_ROLES.includes(role); }
function canViewPrices(role: Role): boolean { return PRICE_VIEW_ROLES.includes(role); }
function canEditInventory(role: Role): boolean { return EDIT_ROLES.includes(role); }
function canDeleteInventory(role: Role): boolean { return DELETE_ROLES.includes(role); }

function getRoleFromRequest(request: NextRequest): Role {
  const headerRole = request.headers.get('x-user-role');
  if (headerRole && isValidRole(headerRole)) return headerRole as Role;
  const { searchParams } = new URL(request.url);
  const queryRole = searchParams.get('role');
  if (queryRole && isValidRole(queryRole)) return queryRole as Role;
  return 'Driver';
}

function getUserFromRequest(request: NextRequest): { userId: string; userName: string } {
  return {
    userId: request.headers.get('x-user-id') || 'unknown',
    userName: request.headers.get('x-user-name') || 'Unknown User',
  };
}

/**
 * Convert central inventory item to command center format
 */
function convertToFullItem(product: InventoryProduct, mgmtItem?: { currentQty: number }): InventoryItemFull {
  return {
    sku: product.productId,
    name: product.productName,
    description: product.description,
    category: product.category,
    cost: product.cost,
    price: product.price,
    quantity: mgmtItem?.currentQty ?? product.currentQty,
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

function filterItemForRole(item: InventoryItemFull, role: Role): InventoryItem {
  if (role === 'Driver') {
    return { sku: item.sku, name: item.name, quantity: item.quantity, unit: item.unit, location: item.location } as InventoryItemDriver;
  }
  if (role === 'Sales' || role === 'Office') {
    return { sku: item.sku, name: item.name, description: item.description, category: item.category, quantity: item.quantity, minStock: item.minStock, unit: item.unit, location: item.location, imageUrl: item.imageUrl } as InventoryItemSales;
  }
  return item;
}

function filterSummaryForRole(
  summary: { totalItems: number; lowStockCount: number; totalValue: number; totalCost: number },
  role: Role
) {
  const filtered: { totalItems: number; lowStockCount: number; totalValue?: number; totalCost?: number } = {
    totalItems: summary.totalItems,
    lowStockCount: summary.lowStockCount,
  };
  if (canViewPrices(role)) filtered.totalValue = summary.totalValue;
  if (canViewCosts(role)) filtered.totalCost = summary.totalCost;
  return filtered;
}

// =============================================================================
// API ROUTE HANDLERS
// =============================================================================

export async function GET(request: NextRequest): Promise<NextResponse<InventoryApiResponse>> {
  const auth = await requireAuth();
  if (!auth.authenticated) return auth.response as NextResponse<InventoryApiResponse>;

  try {
    const role = getRoleFromRequest(request);
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category') || undefined;
    const lowStock = searchParams.get('lowStock') === 'true';
    const search = searchParams.get('search') || undefined;

    const cacheKey = `cc:inventory:${role}:${category || ''}:${lowStock}:${search || ''}`;
    const cached = cache.get<InventoryApiResponse>(cacheKey);
    if (cached) return NextResponse.json(cached);

    // Load from central management service (which uses real data + Sheets)
    await inventoryManagementService.ensureSheetsLoaded();
    const mgmtItems = inventoryManagementService.getInventory({
      category: category as any,
      search,
      lowStock: lowStock || undefined,
    });

    // Convert to command center format
    let items: InventoryItemFull[] = mgmtItems.map(mi => ({
      sku: mi.productId,
      name: mi.productName,
      description: inventoryProducts.find(p => p.productId === mi.productId)?.description || '',
      category: mi.category,
      cost: mi.unitCost,
      price: mi.unitPrice,
      quantity: mi.currentQty,
      minStock: mi.minStockLevel,
      maxStock: mi.maxStockLevel,
      unit: mi.unit,
      supplier: mi.supplier,
      location: mi.location,
      imageUrl: inventoryProducts.find(p => p.productId === mi.productId)?.imageUrl || '',
      lastUpdated: mi.lastCountDate || new Date().toISOString(),
      updatedBy: mi.lastCountBy || 'System',
    }));

    const filteredItems = items.map(item => filterItemForRole(item, role));
    const value = inventoryManagementService.getInventoryValue();
    const lowStockCount = inventoryManagementService.getLowStockItems().length;

    const summaryFull = {
      totalItems: items.length,
      lowStockCount,
      totalValue: value.totalRetail,
      totalCost: value.totalCost,
    };

    const response: InventoryApiResponse = {
      success: true,
      data: {
        items: filteredItems,
        summary: filterSummaryForRole(summaryFull, role),
      },
    };
    cache.set(cacheKey, response, CACHE_TTL.MEDIUM);
    return NextResponse.json(response);
  } catch (error) {
    console.error('GET /api/command-center/inventory error:', error);
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'Failed to fetch inventory' }, { status: 500 });
  }
}

export async function POST(request: NextRequest): Promise<NextResponse<InventoryApiResponse>> {
  const auth = await requireAuth();
  if (!auth.authenticated) return auth.response as NextResponse<InventoryApiResponse>;

  try {
    const role = getRoleFromRequest(request);
    if (!canEditInventory(role)) {
      return NextResponse.json({ success: false, error: 'Insufficient permissions.' }, { status: 403 });
    }

    const body = await request.json();
    if (!body.sku || !body.name || !body.category || body.cost === undefined || body.price === undefined || body.quantity === undefined) {
      return NextResponse.json({ success: false, error: 'Required: sku, name, category, cost, price, quantity' }, { status: 400 });
    }

    // Add via central service
    const newItem = inventoryManagementService.addItem({
      productName: body.name,
      category: body.category as any,
      sku: body.sku,
      unit: body.unit || 'each',
      currentQty: body.quantity,
      minStockLevel: body.minStock ?? 10,
      maxStockLevel: body.maxStock ?? 100,
      reorderQty: body.maxStock ? body.maxStock - body.quantity : 50,
      unitCost: body.cost,
      unitPrice: body.price,
      supplier: body.supplier || '',
      supplierPartNumber: '',
      location: body.location || '',
      weight: 0,
      lastCountDate: '',
      lastCountBy: '',
      lastRestockDate: '',
      notes: '',
    });

    const fullItem: InventoryItemFull = {
      sku: newItem.productId, name: newItem.productName, description: body.description || '',
      category: newItem.category, cost: newItem.unitCost, price: newItem.unitPrice,
      quantity: newItem.currentQty, minStock: newItem.minStockLevel, maxStock: newItem.maxStockLevel,
      unit: newItem.unit, supplier: newItem.supplier, location: newItem.location,
      imageUrl: body.imageUrl || '', lastUpdated: new Date().toISOString(), updatedBy: 'System',
    };

    cache.invalidatePattern('^cc:inventory:');
    return NextResponse.json({ success: true, data: { item: filterItemForRole(fullItem, role) }, message: `Created: ${newItem.productName}` });
  } catch (error) {
    console.error('POST /api/command-center/inventory error:', error);
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'Failed to create item' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest): Promise<NextResponse<InventoryApiResponse>> {
  const auth = await requireAuth();
  if (!auth.authenticated) return auth.response as NextResponse<InventoryApiResponse>;

  try {
    const role = getRoleFromRequest(request);
    if (!canEditInventory(role)) {
      return NextResponse.json({ success: false, error: 'Insufficient permissions.' }, { status: 403 });
    }

    const body = await request.json();
    if (!body.sku) {
      return NextResponse.json({ success: false, error: 'SKU is required' }, { status: 400 });
    }

    // Map sku to productId (they're the same in our system)
    const productId = body.sku;

    if (body.adjustment !== undefined) {
      if (!body.reason) {
        return NextResponse.json({ success: false, error: 'Reason required for adjustments' }, { status: 400 });
      }
      const item = inventoryManagementService.getItemById(productId);
      if (!item) return NextResponse.json({ success: false, error: 'Item not found' }, { status: 404 });
      inventoryManagementService.updateItem(productId, { currentQty: Math.max(0, item.currentQty + body.adjustment) });
    } else if (body.updates) {
      const updates: Record<string, any> = {};
      if (body.updates.name !== undefined) updates.productName = body.updates.name;
      if (body.updates.cost !== undefined) updates.unitCost = body.updates.cost;
      if (body.updates.price !== undefined) updates.unitPrice = body.updates.price;
      if (body.updates.quantity !== undefined) updates.currentQty = body.updates.quantity;
      if (body.updates.minStock !== undefined) updates.minStockLevel = body.updates.minStock;
      if (body.updates.maxStock !== undefined) updates.maxStockLevel = body.updates.maxStock;
      if (body.updates.unit !== undefined) updates.unit = body.updates.unit;
      if (body.updates.supplier !== undefined) updates.supplier = body.updates.supplier;
      if (body.updates.location !== undefined) updates.location = body.updates.location;
      inventoryManagementService.updateItem(productId, updates);
    } else {
      return NextResponse.json({ success: false, error: 'Either updates or adjustment required' }, { status: 400 });
    }

    cache.invalidatePattern('^cc:inventory:');
    return NextResponse.json({ success: true, message: `Updated ${productId}` });
  } catch (error) {
    console.error('PATCH /api/command-center/inventory error:', error);
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'Failed to update' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest): Promise<NextResponse<InventoryApiResponse>> {
  const auth = await requireAuth();
  if (!auth.authenticated) return auth.response as NextResponse<InventoryApiResponse>;

  try {
    const role = getRoleFromRequest(request);
    if (!canDeleteInventory(role)) {
      return NextResponse.json({ success: false, error: 'Requires Owner or Admin role.' }, { status: 403 });
    }

    const body = await request.json();
    if (!body.sku) {
      return NextResponse.json({ success: false, error: 'SKU is required' }, { status: 400 });
    }

    // Note: The management service doesn't have a delete method, so we set qty to 0
    const item = inventoryManagementService.getItemById(body.sku);
    if (!item) return NextResponse.json({ success: false, error: 'Item not found' }, { status: 404 });

    inventoryManagementService.updateItem(body.sku, { currentQty: 0, notes: 'DELETED' });

    cache.invalidatePattern('^cc:inventory:');
    return NextResponse.json({ success: true, message: `Deleted ${body.sku}` });
  } catch (error) {
    console.error('DELETE /api/command-center/inventory error:', error);
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'Failed to delete' }, { status: 500 });
  }
}
