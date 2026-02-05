import { NextRequest, NextResponse } from 'next/server';
import { deliveryPortalService } from '@/lib/delivery-portal-service';
import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';

// Service account auth for adding items
const DELIVERY_SHEETS_ID = process.env.DELIVERY_SHEETS_ID || process.env.GOOGLE_SHEETS_ID;
const serviceAccountAuth = new JWT({
  email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
  key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category') || undefined;
    const lowStock = searchParams.get('lowStock') === 'true';
    const search = searchParams.get('search')?.toLowerCase();

    let inventory = lowStock
      ? await deliveryPortalService.getLowStockItems()
      : await deliveryPortalService.getInventory(category);

    // Apply search filter if provided
    if (search && Array.isArray(inventory)) {
      inventory = inventory.filter(item =>
        item.productName?.toLowerCase().includes(search) ||
        item.productId?.toLowerCase().includes(search) ||
        item.sku?.toLowerCase().includes(search) ||
        item.supplier?.toLowerCase().includes(search)
      );
    }

    return NextResponse.json(inventory);
  } catch (error) {
    console.error('Error fetching inventory:', error);
    return NextResponse.json({ error: 'Failed to fetch inventory' }, { status: 500 });
  }
}

// POST - Add new inventory item
export async function POST(request: NextRequest) {
  try {
    const data = await request.json();
    const {
      productId,
      productName,
      category,
      sku,
      unit,
      currentQty,
      minQty,
      maxQty,
      unitCost,
      location,
      supplier,
      notes,
    } = data;

    if (!productName) {
      return NextResponse.json({ error: 'Product name is required' }, { status: 400 });
    }

    // Connect to Google Sheets
    const doc = new GoogleSpreadsheet(DELIVERY_SHEETS_ID!, serviceAccountAuth);
    await doc.loadInfo();

    let sheet = doc.sheetsByTitle['Inventory'];
    if (!sheet) {
      // Create the sheet if it doesn't exist
      sheet = await doc.addSheet({
        title: 'Inventory',
        headerValues: [
          'productId', 'productName', 'category', 'sku', 'unit', 'currentQty',
          'minQty', 'maxQty', 'unitCost', 'totalValue', 'location', 'supplier',
          'lastCountDate', 'lastRestockDate', 'notes'
        ]
      });
    }

    // Generate product ID if not provided
    const newProductId = productId || `item-${Date.now()}`;
    const totalValue = (currentQty || 0) * (unitCost || 0);

    // Add the new row
    await sheet.addRow({
      productId: newProductId,
      productName,
      category: category || '',
      sku: sku || '',
      unit: unit || 'each',
      currentQty: currentQty || 0,
      minQty: minQty || 10,
      maxQty: maxQty || 100,
      unitCost: unitCost || 0,
      totalValue: totalValue.toFixed(2),
      location: location || '',
      supplier: supplier || '',
      lastCountDate: '',
      lastRestockDate: '',
      notes: notes || '',
    });

    return NextResponse.json({
      success: true,
      item: {
        productId: newProductId,
        productName,
        category,
        sku,
        unit,
        currentQty,
        minQty,
        maxQty,
        unitCost,
        totalValue,
        location,
        supplier,
        notes,
      }
    });
  } catch (error) {
    console.error('Error adding inventory item:', error);
    return NextResponse.json({ error: 'Failed to add inventory item' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const data = await request.json();
    const { action, productId, ...params } = data;

    switch (action) {
      case 'updateQty':
        await deliveryPortalService.updateInventoryQty(productId, params.qtyChange, params.reason);
        return NextResponse.json({ success: true });

      case 'submitCount':
        const result = await deliveryPortalService.submitInventoryCount(
          productId,
          params.actualQty,
          params.countedBy,
          params.notes
        );
        return NextResponse.json(result);

      case 'updateItem':
        // Full item update - connect directly to sheet
        const doc = new GoogleSpreadsheet(DELIVERY_SHEETS_ID!, serviceAccountAuth);
        await doc.loadInfo();
        const sheet = doc.sheetsByTitle['Inventory'];

        if (!sheet) {
          return NextResponse.json({ error: 'Inventory sheet not found' }, { status: 404 });
        }

        const rows = await sheet.getRows();
        const row = rows.find(r => r.get('productId') === productId);

        if (!row) {
          return NextResponse.json({ error: 'Item not found' }, { status: 404 });
        }

        // Update fields
        if (params.productName !== undefined) row.set('productName', params.productName);
        if (params.category !== undefined) row.set('category', params.category);
        if (params.sku !== undefined) row.set('sku', params.sku);
        if (params.unit !== undefined) row.set('unit', params.unit);
        if (params.currentQty !== undefined) {
          row.set('currentQty', params.currentQty);
          const unitCost = parseFloat(row.get('unitCost')) || 0;
          row.set('totalValue', (params.currentQty * unitCost).toFixed(2));
        }
        if (params.minQty !== undefined) row.set('minQty', params.minQty);
        if (params.maxQty !== undefined) row.set('maxQty', params.maxQty);
        if (params.unitCost !== undefined) {
          row.set('unitCost', params.unitCost);
          const currentQty = parseFloat(row.get('currentQty')) || 0;
          row.set('totalValue', (currentQty * params.unitCost).toFixed(2));
        }
        if (params.location !== undefined) row.set('location', params.location);
        if (params.supplier !== undefined) row.set('supplier', params.supplier);
        if (params.notes !== undefined) row.set('notes', params.notes);

        await row.save();
        return NextResponse.json({ success: true });

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    console.error('Error updating inventory:', error);
    return NextResponse.json({ error: 'Failed to update inventory' }, { status: 500 });
  }
}
