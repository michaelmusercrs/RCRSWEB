/**
 * Inventory Transaction History API
 * 
 * Uses unified-inventory-service for transaction data.
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-service';
import { unifiedInventoryService, resolveProductId } from '@/lib/unified-inventory-service';

export async function GET(request: NextRequest) {
  const auth = await requireAuth();
  if (!auth.authenticated) return auth.response;

  try {
    const { searchParams } = new URL(request.url);
    const productId = searchParams.get('productId') || searchParams.get('itemId') || undefined;
    const limit = parseInt(searchParams.get('limit') || '50');
    const referenceId = searchParams.get('referenceId');

    if (referenceId) {
      const transactions = await unifiedInventoryService.getTransactionsByReference(referenceId);
      return NextResponse.json({ transactions, total: transactions.length });
    }

    const transactions = await unifiedInventoryService.getTransactions(productId, limit);

    // Enrich with product details for backward compat
    const enriched = await Promise.all(transactions.map(async (txn) => {
      const item = await unifiedInventoryService.getItemById(txn.productId);
      return {
        ...txn,
        // Legacy field names
        inventoryId: txn.transactionId,
        itemId: txn.productId,
        dateTime: txn.timestamp,
        amount: txn.quantity,
        referenceNumber: txn.referenceId,
        price: txn.unitPrice || 0,
        cost: txn.unitCost || 0,
        status: 'completed',
        productName: txn.productName,
        productCategory: item ? item.category : undefined,
      };
    }));

    return NextResponse.json({
      transactions: enriched,
      total: enriched.length,
    });
  } catch (error) {
    console.error('Transaction history error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
