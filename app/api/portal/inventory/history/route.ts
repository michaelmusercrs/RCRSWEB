import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-service';
import { inventoryTransactions, InventoryTransaction } from '@/lib/inventoryTransactions';
import { inventoryProducts, getProductById } from '@/lib/inventoryData';

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

    let transactions: InventoryTransaction[] = [...inventoryTransactions];

    // Filter by item
    if (itemId) {
      transactions = transactions.filter(t => t.itemId === itemId);
    }

    // Filter by type
    if (type) {
      transactions = transactions.filter(t => t.type === type);
    }

    // Filter by status
    if (status) {
      transactions = transactions.filter(t => t.status === status);
    }

    // Filter by date range
    if (from) {
      transactions = transactions.filter(t => t.dateTime >= from);
    }
    if (to) {
      transactions = transactions.filter(t => t.dateTime <= to);
    }

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
      const allItemTransactions = inventoryTransactions
        .filter(t => t.itemId === itemId && t.status === 'completed')
        .sort((a, b) => new Date(a.dateTime).getTime() - new Date(b.dateTime).getTime());

      // Calculate running total from the current quantity working backwards
      const currentQty = product?.currentQty || 0;
      let runningTotal = currentQty;

      // First calculate what the starting quantity was
      const totalChange = allItemTransactions.reduce((sum, t) => sum + t.amount, 0);
      let startingQty = currentQty - totalChange;

      // Build forward from starting
      runningStock = allItemTransactions.map(t => {
        startingQty += t.amount;
        return {
          date: t.dateTime,
          quantity: startingQty,
        };
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

// POST - Log a new inventory transaction
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

    // In production, this would persist to Google Sheets InventoryLogs
    // For now, add to in-memory array
    inventoryTransactions.unshift(transaction);

    return NextResponse.json({ success: true, transaction });
  } catch (error) {
    console.error('Error logging inventory transaction:', error);
    return NextResponse.json({ error: 'Failed to log transaction' }, { status: 500 });
  }
}
