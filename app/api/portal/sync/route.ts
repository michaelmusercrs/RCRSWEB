// API Route for Google Sheets Sync
// Handles 2-way sync between portal data and Google Sheets

import { NextRequest, NextResponse } from 'next/server';
import { inventorySheetsSync } from '@/lib/inventory-sheets-sync';

// GET - Check sync status or fetch data from sheets
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const action = searchParams.get('action');
  const type = searchParams.get('type');

  try {
    switch (action) {
      case 'status':
        // Check if Google Sheets is configured
        const hasCredentials = !!(
          process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL &&
          process.env.GOOGLE_PRIVATE_KEY &&
          (process.env.INVENTORY_SHEETS_ID || process.env.GOOGLE_SHEETS_ID)
        );

        return NextResponse.json({
          configured: hasCredentials,
          sheetsId: process.env.INVENTORY_SHEETS_ID || process.env.GOOGLE_SHEETS_ID || null,
          email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || null
        });

      case 'fetch':
        // Fetch data from sheets
        if (!type) {
          return NextResponse.json({ error: 'Type parameter required' }, { status: 400 });
        }

        switch (type) {
          case 'inventory':
            const inventory = await inventorySheetsSync.getInventoryFromSheets();
            return NextResponse.json({ success: true, data: inventory, count: inventory.length });

          case 'transactions':
            const transactions = await inventorySheetsSync.getTransactionsFromSheets();
            return NextResponse.json({ success: true, data: transactions, count: transactions.length });

          case 'employees':
            const employees = await inventorySheetsSync.getEmployeesFromSheets();
            return NextResponse.json({ success: true, data: employees, count: employees.length });

          default:
            return NextResponse.json({ error: 'Invalid type' }, { status: 400 });
        }

      case 'changes':
        // Check for changes in sheets
        const changes = await inventorySheetsSync.checkForUpdates();
        return NextResponse.json(changes);

      default:
        return NextResponse.json({
          error: 'Invalid action. Use: status, fetch, or changes'
        }, { status: 400 });
    }
  } catch (error) {
    console.error('Sync GET error:', error);
    return NextResponse.json(
      { error: 'Failed to process sync request', details: String(error) },
      { status: 500 }
    );
  }
}

// POST - Sync data to Google Sheets
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, type, data } = body;

    switch (action) {
      case 'sync':
        // Sync specific type or all
        if (type === 'all' || !type) {
          const result = await inventorySheetsSync.syncAllToSheets();
          return NextResponse.json({
            success: result.success,
            message: result.success ? 'All data synced successfully' : 'Sync completed with errors',
            details: {
              inventory: result.inventory,
              transactions: result.transactions,
              tickets: result.tickets,
              employees: result.employees
            }
          });
        }

        // Sync specific type
        switch (type) {
          case 'inventory':
            const invResult = await inventorySheetsSync.syncInventoryToSheets();
            return NextResponse.json({
              success: invResult.success,
              message: invResult.success ? `Synced ${invResult.synced} inventory items` : invResult.error,
              synced: invResult.synced
            });

          case 'transactions':
            const txResult = await inventorySheetsSync.syncTransactionsToSheets();
            return NextResponse.json({
              success: txResult.success,
              message: txResult.success ? `Synced ${txResult.synced} transactions` : txResult.error,
              synced: txResult.synced
            });

          case 'tickets':
            const ticketResult = await inventorySheetsSync.syncTicketsToSheets();
            return NextResponse.json({
              success: ticketResult.success,
              message: ticketResult.success ? `Synced ${ticketResult.synced} tickets` : ticketResult.error,
              synced: ticketResult.synced
            });

          case 'employees':
            const empResult = await inventorySheetsSync.syncEmployeesToSheets();
            return NextResponse.json({
              success: empResult.success,
              message: empResult.success ? `Synced ${empResult.synced} employees` : empResult.error,
              synced: empResult.synced
            });

          default:
            return NextResponse.json({ error: 'Invalid type' }, { status: 400 });
        }

      case 'add-transaction':
        // Add a new transaction
        if (!data) {
          return NextResponse.json({ error: 'Transaction data required' }, { status: 400 });
        }
        const addResult = await inventorySheetsSync.addTransaction(data);
        return NextResponse.json({
          success: addResult,
          message: addResult ? 'Transaction added to sheets' : 'Failed to add transaction'
        });

      case 'update-inventory':
        // Update inventory item
        if (!data) {
          return NextResponse.json({ error: 'Inventory data required' }, { status: 400 });
        }
        const updateResult = await inventorySheetsSync.updateInventoryItem(data);
        return NextResponse.json({
          success: updateResult,
          message: updateResult ? 'Inventory item updated in sheets' : 'Failed to update inventory item'
        });

      default:
        return NextResponse.json({
          error: 'Invalid action. Use: sync, add-transaction, or update-inventory'
        }, { status: 400 });
    }
  } catch (error) {
    console.error('Sync POST error:', error);
    return NextResponse.json(
      { error: 'Failed to process sync request', details: String(error) },
      { status: 500 }
    );
  }
}
