import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-service';
import { inventoryTransactions as staticTransactions, InventoryTransaction } from '@/lib/inventoryTransactions';
import { getProductById } from '@/lib/inventoryData';
import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';

// =============================================================================
// GOOGLE SHEETS CONFIG
// =============================================================================

const SHEETS_ID = process.env.DELIVERY_SHEETS_ID || process.env.GOOGLE_SHEETS_ID;
const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n')?.replace(/\r\n/g, '\n');

const serviceAccountAuth = new JWT({
  email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
  key: privateKey,
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

const SHEET_NAME = 'InventoryLogs';

const isConfigured = !!(SHEETS_ID && process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL && privateKey);

// =============================================================================
// HELPERS
// =============================================================================

async function getOrCreateSheet(doc: GoogleSpreadsheet) {
  const headers = [
    'inventoryId', 'itemId', 'dateTime', 'amount', 'referenceNumber',
    'price', 'cost', 'status', 'type', 'notes',
  ];
  let sheet = doc.sheetsByTitle[SHEET_NAME];
  if (!sheet) {
    sheet = await doc.addSheet({ title: SHEET_NAME, headerValues: headers });
  }
  return sheet;
}

async function fetchTransactionsFromSheets(): Promise<InventoryTransaction[] | null> {
  if (!isConfigured) return null;
  try {
    const doc = new GoogleSpreadsheet(SHEETS_ID!, serviceAccountAuth);
    await doc.loadInfo();
    const sheet = await getOrCreateSheet(doc);
    const rows = await sheet.getRows();

    if (rows.length === 0) return null; // Fall back to static data if sheet is empty

    return rows.map(row => ({
      inventoryId: row.get('inventoryId') || '',
      itemId: row.get('itemId') || '',
      dateTime: row.get('dateTime') || '',
      amount: parseFloat(row.get('amount')) || 0,
      referenceNumber: row.get('referenceNumber') || '',
      price: parseFloat(row.get('price')) || 0,
      cost: parseFloat(row.get('cost')) || 0,
      status: (row.get('status') || 'completed') as InventoryTransaction['status'],
      type: (row.get('type') || 'adjustment') as InventoryTransaction['type'],
      notes: row.get('notes') || undefined,
    }));
  } catch (error) {
    console.error('Failed to fetch transactions from Sheets:', error);
    return null;
  }
}

async function logTransactionToSheets(tx: InventoryTransaction): Promise<boolean> {
  if (!isConfigured) return false;
  try {
    const doc = new GoogleSpreadsheet(SHEETS_ID!, serviceAccountAuth);
    await doc.loadInfo();
    const sheet = await getOrCreateSheet(doc);
    await sheet.addRow({
      inventoryId: tx.inventoryId,
      itemId: tx.itemId,
      dateTime: tx.dateTime,
      amount: tx.amount.toString(),
      referenceNumber: tx.referenceNumber,
      price: tx.price.toString(),
      cost: tx.cost.toString(),
      status: tx.status,
      type: tx.type,
      notes: tx.notes || '',
    });
    return true;
  } catch (error) {
    console.error('Failed to log transaction to Sheets:', error);
    return false;
  }
}

// =============================================================================
// ROUTES
// =============================================================================

export async function GET(request: NextRequest) {
  const auth = await requireAuth();
  if (!auth.authenticated) return auth.response;

  try {
    const { searchParams } = new URL(request.url);
    const itemId = searchParams.get('itemId');
    const type = searchParams.get('type');
    const status = searchParams.get('status');
    const limit = searchParams.get('limit');
    const offset = searchParams.get('offset');
    const from = searchParams.get('from');
    const to = searchParams.get('to');

    // Try Google Sheets first, fall back to static data
    const sheetsData = await fetchTransactionsFromSheets();
    let transactions: InventoryTransaction[] = sheetsData || [...staticTransactions];

    // Apply filters
    if (itemId) transactions = transactions.filter(t => t.itemId === itemId);
    if (type) transactions = transactions.filter(t => t.type === type);
    if (status) transactions = transactions.filter(t => t.status === status);
    if (from) transactions = transactions.filter(t => t.dateTime >= from);
    if (to) transactions = transactions.filter(t => t.dateTime <= to);

    // Sort by date descending
    transactions.sort((a, b) => new Date(b.dateTime).getTime() - new Date(a.dateTime).getTime());

    const total = transactions.length;

    // Pagination
    const offsetNum = parseInt(offset || '0');
    const limitNum = parseInt(limit || '50');
    transactions = transactions.slice(offsetNum, offsetNum + limitNum);

    // Enrich with product names
    const enriched = transactions.map(t => {
      const product = getProductById(t.itemId);
      return {
        ...t,
        productName: product?.productName || 'Unknown',
        productCategory: product?.category || 'Unknown',
      };
    });

    // Build running stock levels per item if filtering by item
    let runningStock: { date: string; quantity: number }[] = [];
    if (itemId) {
      const product = getProductById(itemId);
      const allSrc = sheetsData || staticTransactions;
      const allItemTransactions = allSrc
        .filter(t => t.itemId === itemId && t.status === 'completed')
        .sort((a, b) => new Date(a.dateTime).getTime() - new Date(b.dateTime).getTime());

      const currentQty = product?.currentQty || 0;
      const totalChange = allItemTransactions.reduce((sum, t) => sum + t.amount, 0);
      let startingQty = currentQty - totalChange;

      runningStock = allItemTransactions.map(t => {
        startingQty += t.amount;
        return { date: t.dateTime, quantity: startingQty };
      });
    }

    return NextResponse.json({
      transactions: enriched,
      total,
      offset: offsetNum,
      limit: limitNum,
      runningStock,
    });
  } catch (error) {
    console.error('Error fetching inventory history:', error);
    return NextResponse.json({ error: 'Failed to fetch inventory history' }, { status: 500 });
  }
}

// POST - Log a new inventory transaction (persists to Sheets)
export async function POST(request: NextRequest) {
  const auth = await requireAuth();
  if (!auth.authenticated) return auth.response;

  try {
    const data = await request.json();
    const { itemId, amount, type, referenceNumber, notes } = data;

    if (!itemId || amount === undefined || !type) {
      return NextResponse.json(
        { error: 'itemId, amount, and type are required' },
        { status: 400 }
      );
    }

    const product = getProductById(itemId);
    if (!product) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }

    const transaction: InventoryTransaction = {
      inventoryId: `tx-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      itemId,
      dateTime: new Date().toISOString(),
      amount,
      referenceNumber: referenceNumber || '',
      price: product.price,
      cost: product.cost,
      status: 'completed',
      type,
      notes,
    };

    // Persist to Google Sheets
    const persisted = await logTransactionToSheets(transaction);
    if (!persisted) {
      // Fallback: add to in-memory array (will be lost on cold start)
      staticTransactions.unshift(transaction);
    }

    return NextResponse.json({ success: true, transaction });
  } catch (error) {
    console.error('Error logging inventory transaction:', error);
    return NextResponse.json({ error: 'Failed to log transaction' }, { status: 500 });
  }
}
