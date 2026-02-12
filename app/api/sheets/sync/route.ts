/**
 * RCRS Google Sheets Sync API
 *
 * POST /api/sheets/sync - Trigger manual sync between app and Google Sheets
 * GET /api/sheets/sync - Get sync status and last sync info
 *
 * @author RCRS Development Team
 * @version 1.0.0
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth-service';
import { googleSheetsService, isGoogleSheetsConfigured } from '@/lib/google-sheets-service';
import { promises as fs } from 'fs';
import path from 'path';

// Path to inventory JSON file for sync
const INVENTORY_JSON_PATH = path.join(process.cwd(), 'data', 'inventory.json');

interface SyncResponse {
  success: boolean;
  message: string;
  status?: {
    configured: boolean;
    connected: boolean;
    sheetTitle?: string;
  };
  results?: {
    inventory?: { synced: number; errors: string[] };
    team?: { synced: number; errors: string[] };
    commissions?: { synced: number; errors: string[] };
    customers?: { synced: number; errors: string[] };
  };
  timestamp: string;
}

/**
 * GET /api/sheets/sync
 *
 * Returns the current sync status and connection info
 */
export async function GET(): Promise<NextResponse<SyncResponse>> {
  const auth = await requireAdmin();
  if (!auth.authenticated) return auth.response as NextResponse<SyncResponse>;

  try {
    const status = googleSheetsService.getStatus();

    return NextResponse.json({
      success: true,
      message: status.connected
        ? `Connected to "${status.sheetTitle}"`
        : status.configured
          ? 'Configured but not connected'
          : 'Google Sheets not configured',
      status,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('GET /api/sheets/sync error:', error);
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to get sync status',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/sheets/sync
 *
 * Triggers a manual sync operation
 *
 * Body options:
 * - syncType: 'full' | 'inventory' | 'team' | 'commissions' | 'customers'
 * - direction: 'toSheets' | 'fromSheets' | 'both' (default: 'both')
 */
export async function POST(request: NextRequest): Promise<NextResponse<SyncResponse>> {
  const auth = await requireAdmin();
  if (!auth.authenticated) return auth.response as NextResponse<SyncResponse>;

  try {
    // Check if Google Sheets is configured
    if (!isGoogleSheetsConfigured()) {
      return NextResponse.json(
        {
          success: false,
          message: 'Google Sheets not configured. Please set GOOGLE_SERVICE_ACCOUNT_EMAIL, GOOGLE_PRIVATE_KEY, and GOOGLE_SHEETS_ID environment variables.',
          status: googleSheetsService.getStatus(),
          timestamp: new Date().toISOString(),
        },
        { status: 400 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const syncType = body.syncType || 'full';
    const direction = body.direction || 'both';

    const results: SyncResponse['results'] = {};

    // Sync inventory
    if (syncType === 'full' || syncType === 'inventory') {
      if (direction === 'toSheets' || direction === 'both') {
        try {
          // Read inventory from JSON and sync to sheets
          const inventoryData = await fs.readFile(INVENTORY_JSON_PATH, 'utf-8');
          const { items } = JSON.parse(inventoryData);
          const inventoryResult = await googleSheetsService.syncInventoryFromJson(items);
          results.inventory = {
            synced: inventoryResult.synced,
            errors: inventoryResult.errors,
          };
        } catch (e) {
          results.inventory = {
            synced: 0,
            errors: [`Failed to sync inventory: ${e}`],
          };
        }
      }

      if (direction === 'fromSheets' || direction === 'both') {
        try {
          // Get inventory from sheets
          const items = await googleSheetsService.getInventory();
          results.inventory = {
            synced: items.length,
            errors: [],
          };
        } catch (e) {
          results.inventory = {
            synced: 0,
            errors: [`Failed to fetch inventory from sheets: ${e}`],
          };
        }
      }
    }

    // Sync team
    if (syncType === 'full' || syncType === 'team') {
      try {
        const members = await googleSheetsService.getTeamMembers();
        results.team = {
          synced: members.length,
          errors: [],
        };
      } catch (e) {
        results.team = {
          synced: 0,
          errors: [`Failed to sync team: ${e}`],
        };
      }
    }

    // Sync commissions
    if (syncType === 'full' || syncType === 'commissions') {
      try {
        const commissions = await googleSheetsService.getCommissions();
        results.commissions = {
          synced: commissions.length,
          errors: [],
        };
      } catch (e) {
        results.commissions = {
          synced: 0,
          errors: [`Failed to sync commissions: ${e}`],
        };
      }
    }

    // Sync customers
    if (syncType === 'full' || syncType === 'customers') {
      try {
        const customers = await googleSheetsService.getCustomers();
        results.customers = {
          synced: customers.length,
          errors: [],
        };
      } catch (e) {
        results.customers = {
          synced: 0,
          errors: [`Failed to sync customers: ${e}`],
        };
      }
    }

    // Check for any errors
    const hasErrors = Object.values(results).some(r => r && r.errors.length > 0);

    return NextResponse.json({
      success: !hasErrors,
      message: hasErrors ? 'Sync completed with some errors' : 'Sync completed successfully',
      status: googleSheetsService.getStatus(),
      results,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('POST /api/sheets/sync error:', error);
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : 'Sync failed',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
