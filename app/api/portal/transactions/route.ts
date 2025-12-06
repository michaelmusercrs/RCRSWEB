import { NextRequest, NextResponse } from 'next/server';
import {
  inventoryTransactions,
  getTransactionsByItem,
  getTransactionsByDateRange,
  getTransactionsByType,
  getRecentTransactions,
  getTransactionStats,
  getMonthlySummary,
  InventoryTransaction
} from '@/lib/inventoryTransactions';
import { inventoryProducts, getProductById } from '@/lib/inventoryData';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const itemId = searchParams.get('itemId');
    const type = searchParams.get('type') as InventoryTransaction['type'] | null;
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const limit = searchParams.get('limit');
    const stats = searchParams.get('stats');
    const month = searchParams.get('month');
    const year = searchParams.get('year');

    // Return transaction statistics
    if (stats === 'true') {
      const transactionStats = getTransactionStats();
      return NextResponse.json(transactionStats);
    }

    // Return monthly summary
    if (month && year) {
      const summary = getMonthlySummary(parseInt(year), parseInt(month));
      return NextResponse.json(summary);
    }

    // Filter by item
    if (itemId) {
      const transactions = getTransactionsByItem(itemId);
      const product = getProductById(itemId);
      return NextResponse.json({
        product,
        transactions: transactions.sort((a, b) =>
          new Date(b.dateTime).getTime() - new Date(a.dateTime).getTime()
        )
      });
    }

    // Filter by type
    if (type) {
      const transactions = getTransactionsByType(type);
      return NextResponse.json(
        transactions.sort((a, b) =>
          new Date(b.dateTime).getTime() - new Date(a.dateTime).getTime()
        )
      );
    }

    // Filter by date range
    if (startDate && endDate) {
      const transactions = getTransactionsByDateRange(startDate, endDate);
      return NextResponse.json(
        transactions.sort((a, b) =>
          new Date(b.dateTime).getTime() - new Date(a.dateTime).getTime()
        )
      );
    }

    // Return recent transactions with limit
    if (limit) {
      const transactions = getRecentTransactions(parseInt(limit));
      return NextResponse.json(transactions);
    }

    // Return all transactions (most recent first) with product info
    const transactionsWithProducts = inventoryTransactions
      .map(t => ({
        ...t,
        product: getProductById(t.itemId)
      }))
      .sort((a, b) => new Date(b.dateTime).getTime() - new Date(a.dateTime).getTime());

    return NextResponse.json({
      transactions: transactionsWithProducts,
      total: transactionsWithProducts.length,
      stats: getTransactionStats()
    });

  } catch (error) {
    console.error('Error fetching transactions:', error);
    return NextResponse.json(
      { error: 'Failed to fetch transactions' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const data = await request.json();
    const { action, ...params } = data;

    switch (action) {
      case 'getStats':
        return NextResponse.json(getTransactionStats());

      case 'getMonthlySummary':
        const { year, month } = params;
        return NextResponse.json(getMonthlySummary(year, month));

      case 'getItemHistory':
        const itemTransactions = getTransactionsByItem(params.itemId);
        const product = getProductById(params.itemId);
        return NextResponse.json({
          product,
          transactions: itemTransactions
        });

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    console.error('Error processing transaction request:', error);
    return NextResponse.json(
      { error: 'Failed to process request' },
      { status: 500 }
    );
  }
}
