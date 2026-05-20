/**
 * Inventory Transactions API
 *
 * Pulls transactions from the unified inventory service (canonical source)
 * and shapes them into the legacy format the /portal/transactions page
 * expects. Previously this route read from a hardcoded 1660-row JSON file
 * (lib/inventoryTransactions.ts) — that's mock data and has been removed
 * from the read path.
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireRoleAtLeast } from '@/lib/auth-service';
import {
  unifiedInventoryService,
  type InventoryTransaction as UnifiedTxn,
  type InventoryItem,
} from '@/lib/unified-inventory-service';

// Legacy shape the existing /portal/transactions page consumes
interface LegacyTransaction {
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
  product?: {
    productId: string;
    productName: string;
    category: string;
  };
}

interface TransactionStats {
  totalTransactions: number;
  deliveryCount: number;
  restockCount: number;
  totalDeliveryValue: number;
  totalRestockCost: number;
  profitMargin: number;
}

// Map a unified-service transaction into the legacy shape the page expects
function toLegacy(txn: UnifiedTxn, item: InventoryItem | undefined): LegacyTransaction {
  // Unified types include 'hold' and 'release' which aren't in the legacy
  // type union. Drop them by mapping to 'adjustment'.
  const legacyType: LegacyTransaction['type'] =
    txn.type === 'hold' || txn.type === 'release' || txn.type === 'write_off'
      ? 'adjustment'
      : txn.type;

  return {
    inventoryId: txn.transactionId,
    itemId: txn.productId,
    dateTime: txn.timestamp,
    amount: Math.abs(txn.quantity),
    referenceNumber: txn.referenceId || '',
    price: txn.unitPrice ?? 0,
    cost: txn.unitCost ?? 0,
    status: 'completed',
    type: legacyType,
    product: item
      ? {
          productId: item.productId,
          productName: item.productName,
          category: item.category,
        }
      : undefined,
  };
}

function buildStats(transactions: LegacyTransaction[]): TransactionStats {
  let deliveryCount = 0;
  let restockCount = 0;
  let totalDeliveryValue = 0;
  let totalRestockCost = 0;
  for (const t of transactions) {
    if (t.type === 'delivery') {
      deliveryCount++;
      totalDeliveryValue += (t.price || 0) * t.amount;
    } else if (t.type === 'restock') {
      restockCount++;
      totalRestockCost += (t.cost || 0) * t.amount;
    }
  }
  const profitMargin = totalDeliveryValue > 0
    ? Math.round(((totalDeliveryValue - totalRestockCost) / totalDeliveryValue) * 1000) / 10
    : 0;
  return {
    totalTransactions: transactions.length,
    deliveryCount,
    restockCount,
    totalDeliveryValue: Math.round(totalDeliveryValue * 100) / 100,
    totalRestockCost: Math.round(totalRestockCost * 100) / 100,
    profitMargin,
  };
}

export async function GET(request: NextRequest) {
  // SECURITY 2026-05-20: every transaction row exposes unit cost and the
  // stats payload computes profit margin — owner/admin/office/manager tier
  // only per cost-visibility rule. Richard ('driver') allowed by slug.
  const auth = await requireRoleAtLeast(['owner', 'admin', 'office', 'manager']);
  if (!auth.authenticated) return auth.response;

  try {
    const { searchParams } = new URL(request.url);
    const itemId = searchParams.get('itemId');
    const type = searchParams.get('type') as LegacyTransaction['type'] | null;
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const limit = searchParams.get('limit');
    const stats = searchParams.get('stats');
    const month = searchParams.get('month');
    const year = searchParams.get('year');

    // Pull all transactions from the canonical store (capped to keep memory sane)
    const allTxns = await unifiedInventoryService.getTransactions(undefined, 5000);
    const inventory = await unifiedInventoryService.getInventory();
    const itemMap = new Map(inventory.map(i => [i.productId, i]));

    let legacyTxns = allTxns.map(t => toLegacy(t, itemMap.get(t.productId)));

    // Apply filters
    if (itemId) {
      legacyTxns = legacyTxns.filter(t => t.itemId === itemId);
    }
    if (type) {
      legacyTxns = legacyTxns.filter(t => t.type === type);
    }
    if (startDate && endDate) {
      legacyTxns = legacyTxns.filter(t => t.dateTime >= startDate && t.dateTime <= endDate);
    }
    if (month && year) {
      const m = parseInt(month, 10);
      const y = parseInt(year, 10);
      legacyTxns = legacyTxns.filter(t => {
        const d = new Date(t.dateTime);
        return d.getFullYear() === y && d.getMonth() + 1 === m;
      });
    }

    // Sort newest first
    legacyTxns.sort((a, b) => b.dateTime.localeCompare(a.dateTime));

    if (stats === 'true') {
      return NextResponse.json(buildStats(legacyTxns));
    }
    if (limit) {
      const n = parseInt(limit, 10);
      legacyTxns = legacyTxns.slice(0, n);
    }

    if (itemId) {
      const product = itemMap.get(itemId);
      return NextResponse.json({
        product: product
          ? {
              productId: product.productId,
              productName: product.productName,
              category: product.category,
            }
          : null,
        transactions: legacyTxns,
      });
    }

    return NextResponse.json({
      transactions: legacyTxns,
      total: legacyTxns.length,
      stats: buildStats(legacyTxns),
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
  // SECURITY 2026-05-20: same cost/profit exposure as GET — owner/admin/
  // office/manager tier only. Richard ('driver') allowed by slug.
  const auth = await requireRoleAtLeast(['owner', 'admin', 'office', 'manager']);
  if (!auth.authenticated) return auth.response;

  try {
    const data = await request.json();
    const { action, ...params } = data;

    // Reuse the GET pipeline for stats by calling our own logic
    const allTxns = await unifiedInventoryService.getTransactions(undefined, 5000);
    const inventory = await unifiedInventoryService.getInventory();
    const itemMap = new Map(inventory.map(i => [i.productId, i]));
    const legacyTxns = allTxns.map(t => toLegacy(t, itemMap.get(t.productId)));

    switch (action) {
      case 'getStats':
        return NextResponse.json(buildStats(legacyTxns));

      case 'getMonthlySummary': {
        const { year, month } = params;
        const filtered = legacyTxns.filter(t => {
          const d = new Date(t.dateTime);
          return d.getFullYear() === year && d.getMonth() + 1 === month;
        });
        return NextResponse.json({
          year,
          month,
          ...buildStats(filtered),
          transactions: filtered,
        });
      }

      case 'getItemHistory': {
        const itemTxns = legacyTxns
          .filter(t => t.itemId === params.itemId)
          .sort((a, b) => b.dateTime.localeCompare(a.dateTime));
        const product = itemMap.get(params.itemId);
        return NextResponse.json({
          product: product
            ? {
                productId: product.productId,
                productName: product.productName,
                category: product.category,
              }
            : null,
          transactions: itemTxns,
        });
      }

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
