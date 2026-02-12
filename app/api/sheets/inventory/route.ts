/**
 * RCRS Google Sheets Inventory API
 *
 * GET /api/sheets/inventory - Get inventory from Google Sheets
 * POST /api/sheets/inventory - Create/update inventory item in Sheets
 * DELETE /api/sheets/inventory - Delete inventory item from Sheets
 *
 * @author RCRS Development Team
 * @version 1.0.0
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-service';
import {
  googleSheetsService,
  isGoogleSheetsConfigured,
  InventoryItem,
} from '@/lib/google-sheets-service';

interface InventoryResponse {
  success: boolean;
  data?: {
    items?: InventoryItem[];
    item?: InventoryItem;
    summary?: {
      totalItems: number;
      lowStockCount: number;
      categories: string[];
    };
  };
  error?: string;
  message?: string;
}

/**
 * GET /api/sheets/inventory
 *
 * Query Parameters:
 * - category: Filter by category
 * - lowStock: If "true", only return low stock items
 * - search: Search term
 */
export async function GET(request: NextRequest): Promise<NextResponse<InventoryResponse>> {
  const auth = await requireAuth();
  if (!auth.authenticated) return auth.response as NextResponse<InventoryResponse>;

  try {
    if (!isGoogleSheetsConfigured()) {
      return NextResponse.json(
        {
          success: false,
          error: 'Google Sheets not configured',
        },
        { status: 400 }
      );
    }

    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category') || undefined;
    const lowStock = searchParams.get('lowStock') === 'true';
    const search = searchParams.get('search') || undefined;

    const items = await googleSheetsService.getInventory({
      category,
      lowStock,
      search,
    });

    // Calculate summary
    const categories = [...new Set(items.map(i => i.category))];
    const lowStockCount = items.filter(i => i.quantity <= i.minStock).length;

    return NextResponse.json({
      success: true,
      data: {
        items,
        summary: {
          totalItems: items.length,
          lowStockCount,
          categories,
        },
      },
    });
  } catch (error) {
    console.error('GET /api/sheets/inventory error:', error);
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
 * POST /api/sheets/inventory
 *
 * Create or update an inventory item in Google Sheets
 *
 * Body: InventoryItem
 */
export async function POST(request: NextRequest): Promise<NextResponse<InventoryResponse>> {
  const auth = await requireAuth();
  if (!auth.authenticated) return auth.response as NextResponse<InventoryResponse>;

  try {
    if (!isGoogleSheetsConfigured()) {
      return NextResponse.json(
        {
          success: false,
          error: 'Google Sheets not configured',
        },
        { status: 400 }
      );
    }

    const body = await request.json();

    // Validate required fields
    if (!body.sku || !body.name) {
      return NextResponse.json(
        {
          success: false,
          error: 'SKU and name are required',
        },
        { status: 400 }
      );
    }

    const item: InventoryItem = {
      sku: body.sku,
      name: body.name,
      description: body.description || '',
      category: body.category || 'Uncategorized',
      cost: parseFloat(body.cost) || 0,
      price: parseFloat(body.price) || 0,
      quantity: parseInt(body.quantity) || 0,
      minStock: parseInt(body.minStock) || 10,
      maxStock: parseInt(body.maxStock) || 100,
      unit: body.unit || 'each',
      supplier: body.supplier || '',
      location: body.location || '',
      imageUrl: body.imageUrl || '',
      lastUpdated: new Date().toISOString(),
      updatedBy: body.updatedBy || 'API',
    };

    const success = await googleSheetsService.updateInventoryItem(item);

    if (!success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to save inventory item to Google Sheets',
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: { item },
      message: `Successfully saved inventory item: ${item.name}`,
    });
  } catch (error) {
    console.error('POST /api/sheets/inventory error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to save inventory item',
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/sheets/inventory
 *
 * Delete an inventory item from Google Sheets
 *
 * Body: { sku: string }
 */
export async function DELETE(request: NextRequest): Promise<NextResponse<InventoryResponse>> {
  const auth = await requireAuth();
  if (!auth.authenticated) return auth.response as NextResponse<InventoryResponse>;

  try {
    if (!isGoogleSheetsConfigured()) {
      return NextResponse.json(
        {
          success: false,
          error: 'Google Sheets not configured',
        },
        { status: 400 }
      );
    }

    const body = await request.json();

    if (!body.sku) {
      return NextResponse.json(
        {
          success: false,
          error: 'SKU is required',
        },
        { status: 400 }
      );
    }

    const success = await googleSheetsService.deleteInventoryItem(body.sku);

    if (!success) {
      return NextResponse.json(
        {
          success: false,
          error: `Item with SKU ${body.sku} not found`,
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `Successfully deleted inventory item: ${body.sku}`,
    });
  } catch (error) {
    console.error('DELETE /api/sheets/inventory error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to delete inventory item',
      },
      { status: 500 }
    );
  }
}
