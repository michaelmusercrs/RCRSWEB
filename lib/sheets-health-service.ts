/**
 * RCRS Google Sheets Health Monitor Service
 * 
 * Monitors all connected Google Sheets tabs for:
 * - Connection health (can we reach the sheet?)
 * - Staleness (has data been updated recently?)
 * - Row counts
 * - Auto-repair with retry logic
 * 
 * @author RCRS Development Team
 * @version 1.0.0
 */

import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';

// =============================================================================
// TYPES
// =============================================================================

export type SheetHealthStatus = 'healthy' | 'stale' | 'error' | 'empty';

export interface SheetHealthRecord {
  sheetName: string;
  status: SheetHealthStatus;
  rowCount: number;
  lastModified: string | null;
  staleDays: number | null;
  staleThresholdDays: number;
  connectionOk: boolean;
  error: string | null;
  checkedAt: string;
  description: string;
}

export interface SheetsHealthReport {
  spreadsheetId: string;
  spreadsheetTitle: string;
  overallStatus: SheetHealthStatus;
  totalSheets: number;
  healthyCount: number;
  staleCount: number;
  errorCount: number;
  emptyCount: number;
  sheets: SheetHealthRecord[];
  checkedAt: string;
  apiKeyValid: boolean;
  isBusinessHours: boolean;
}

export interface RepairResult {
  sheetName: string;
  step: string;
  success: boolean;
  message: string;
}

// =============================================================================
// CONFIGURATION - All known sheets and their expected freshness
// =============================================================================

interface SheetConfig {
  name: string;
  description: string;
  /** Max days before considered stale. null = no staleness check (static/config data) */
  staleThresholdDays: number | null;
}

const MONITORED_SHEETS: SheetConfig[] = [
  { name: 'team-members-import', description: 'Team member profiles & contact info', staleThresholdDays: 30 },
  { name: 'Inventory', description: 'Material inventory levels & pricing', staleThresholdDays: 7 },
  { name: 'InventoryLogs', description: 'Inventory change audit trail', staleThresholdDays: 7 },
  { name: 'Commissions', description: 'Sales rep commission entries', staleThresholdDays: 14 },
  { name: 'Customers', description: 'Customer records & contact info', staleThresholdDays: 14 },
  { name: 'Orders', description: 'Material orders & delivery tracking', staleThresholdDays: 7 },
  { name: 'Deliveries', description: 'Delivery scheduling & status', staleThresholdDays: 7 },
  { name: 'Geocoded_Contacts', description: 'Map pins for all contacts', staleThresholdDays: 30 },
  { name: 'Lead_Distribution_Log', description: 'Lead assignment audit trail', staleThresholdDays: 7 },
  { name: 'Rep_Availability', description: 'Rep lead-receiving status', staleThresholdDays: null },
  { name: 'Rep_Preferences', description: 'Rep county/area preferences', staleThresholdDays: null },
  { name: 'Lead_Response_Log', description: 'Lead response time tracking', staleThresholdDays: 7 },
  { name: 'Job_Breakdowns', description: 'Job material breakdowns & pricing', staleThresholdDays: 14 },
  { name: 'Team_Access_Overrides', description: 'Per-member permission overrides', staleThresholdDays: null },
  { name: 'Agent_Directory', description: 'Insurance agent contacts', staleThresholdDays: 30 },
  { name: 'Agent_Visits', description: 'Agent visit logs', staleThresholdDays: 14 },
  { name: 'Training_Progress', description: 'Team training completion tracking', staleThresholdDays: 14 },
  { name: 'Invoices', description: 'Generated invoices', staleThresholdDays: 14 },
  { name: 'RepWeeklyNumbers', description: 'Weekly sales activity reports', staleThresholdDays: 10 },
  { name: 'CustomerPortalLog', description: 'Customer portal activity log', staleThresholdDays: 7 },
  { name: 'CustomerPortalData', description: 'Customer portal records', staleThresholdDays: 14 },
];

// =============================================================================
// SERVICE
// =============================================================================

class SheetsHealthService {
  private getAuth(): JWT {
    const privateKey = process.env.GOOGLE_PRIVATE_KEY
      ?.replace(/\\n/g, '\n')
      ?.replace(/\r\n/g, '\n');

    return new JWT({
      email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      key: privateKey,
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    });
  }

  private isConfigured(): boolean {
    return !!(
      process.env.GOOGLE_SHEETS_ID &&
      process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL &&
      process.env.GOOGLE_PRIVATE_KEY
    );
  }

  /**
   * Check if current time is business hours (7am-8pm CST)
   */
  isBusinessHours(): boolean {
    const now = new Date();
    // Convert to CST (UTC-6)
    const cstOffset = -6 * 60;
    const utcMinutes = now.getUTCHours() * 60 + now.getUTCMinutes();
    const cstMinutes = ((utcMinutes + cstOffset) % 1440 + 1440) % 1440;
    const cstHour = Math.floor(cstMinutes / 60);
    const day = now.getUTCDay();
    // Mon-Sat, 7am-8pm
    return day >= 1 && day <= 6 && cstHour >= 7 && cstHour < 20;
  }

  /**
   * Run full health check on all monitored sheets
   */
  async checkHealth(): Promise<SheetsHealthReport> {
    const checkedAt = new Date().toISOString();
    const sheetsId = process.env.GOOGLE_SHEETS_ID || '';

    if (!this.isConfigured()) {
      return {
        spreadsheetId: sheetsId,
        spreadsheetTitle: 'NOT CONFIGURED',
        overallStatus: 'error',
        totalSheets: 0,
        healthyCount: 0,
        staleCount: 0,
        errorCount: 0,
        emptyCount: 0,
        sheets: [],
        checkedAt,
        apiKeyValid: false,
        isBusinessHours: this.isBusinessHours(),
      };
    }

    let doc: GoogleSpreadsheet;
    let apiKeyValid = true;

    try {
      doc = new GoogleSpreadsheet(sheetsId, this.getAuth());
      await doc.loadInfo();
    } catch (error) {
      apiKeyValid = false;
      return {
        spreadsheetId: sheetsId,
        spreadsheetTitle: 'CONNECTION FAILED',
        overallStatus: 'error',
        totalSheets: 0,
        healthyCount: 0,
        staleCount: 0,
        errorCount: 0,
        emptyCount: 0,
        sheets: MONITORED_SHEETS.map(cfg => ({
          sheetName: cfg.name,
          status: 'error' as const,
          rowCount: 0,
          lastModified: null,
          staleDays: null,
          staleThresholdDays: cfg.staleThresholdDays ?? 0,
          connectionOk: false,
          error: `Failed to connect: ${error instanceof Error ? error.message : String(error)}`,
          checkedAt,
          description: cfg.description,
        })),
        checkedAt,
        apiKeyValid: false,
        isBusinessHours: this.isBusinessHours(),
      };
    }

    const sheetResults: SheetHealthRecord[] = [];

    for (const cfg of MONITORED_SHEETS) {
      try {
        const sheet = doc.sheetsByTitle[cfg.name];
        if (!sheet) {
          sheetResults.push({
            sheetName: cfg.name,
            status: 'error',
            rowCount: 0,
            lastModified: null,
            staleDays: null,
            staleThresholdDays: cfg.staleThresholdDays ?? 0,
            connectionOk: true,
            error: 'Sheet tab not found in spreadsheet',
            checkedAt,
            description: cfg.description,
          });
          continue;
        }

        // Get row count (gridProperties gives total rows including header)
        const rowCount = Math.max(0, (sheet.gridProperties.rowCount || 1) - 1);

        // Try to detect last modified by checking if there are any rows
        let lastModified: string | null = null;
        let staleDays: number | null = null;
        let status: SheetHealthStatus = 'healthy';

        if (rowCount === 0) {
          status = 'empty';
        } else if (cfg.staleThresholdDays !== null) {
          // For sheets with staleness checking, try to read last row's timestamp
          try {
            const rows = await sheet.getRows({ limit: 1, offset: Math.max(0, rowCount - 1) });
            if (rows.length > 0) {
              // Look for common timestamp columns
              const timestampFields = ['updatedAt', 'createdAt', 'timestamp', 'lastUpdated', 'date', 'submittedAt', 'visitDate', 'assignedAt'];
              for (const field of timestampFields) {
                const val = rows[0].get(field);
                if (val && !isNaN(Date.parse(val))) {
                  lastModified = val;
                  break;
                }
              }
            }
          } catch {
            // Can't read rows - might be permission or format issue
          }

          if (lastModified) {
            const modDate = new Date(lastModified);
            const now = new Date();
            staleDays = Math.floor((now.getTime() - modDate.getTime()) / (1000 * 60 * 60 * 24));
            if (staleDays > cfg.staleThresholdDays) {
              status = 'stale';
            }
          }
        }

        sheetResults.push({
          sheetName: cfg.name,
          status,
          rowCount,
          lastModified,
          staleDays,
          staleThresholdDays: cfg.staleThresholdDays ?? 0,
          connectionOk: true,
          error: null,
          checkedAt,
          description: cfg.description,
        });
      } catch (error) {
        sheetResults.push({
          sheetName: cfg.name,
          status: 'error',
          rowCount: 0,
          lastModified: null,
          staleDays: null,
          staleThresholdDays: cfg.staleThresholdDays ?? 0,
          connectionOk: false,
          error: error instanceof Error ? error.message : String(error),
          checkedAt,
          description: cfg.description,
        });
      }
    }

    const healthyCount = sheetResults.filter(s => s.status === 'healthy').length;
    const staleCount = sheetResults.filter(s => s.status === 'stale').length;
    const errorCount = sheetResults.filter(s => s.status === 'error').length;
    const emptyCount = sheetResults.filter(s => s.status === 'empty').length;

    const overallStatus: SheetHealthStatus =
      errorCount > 0 ? 'error' :
      staleCount > 0 ? 'stale' :
      'healthy';

    // Log warnings for stale sheets during business hours
    if (this.isBusinessHours()) {
      for (const sheet of sheetResults) {
        if (sheet.status === 'stale') {
          console.warn(
            `[SHEETS-HEALTH] ⚠️ STALE: "${sheet.sheetName}" - last updated ${sheet.staleDays} days ago (threshold: ${sheet.staleThresholdDays} days)`
          );
        }
        if (sheet.status === 'error') {
          console.warn(
            `[SHEETS-HEALTH] 🔴 ERROR: "${sheet.sheetName}" - ${sheet.error}`
          );
        }
      }
    }

    return {
      spreadsheetId: sheetsId,
      spreadsheetTitle: doc.title,
      overallStatus,
      totalSheets: sheetResults.length,
      healthyCount,
      staleCount,
      errorCount,
      emptyCount,
      sheets: sheetResults,
      checkedAt,
      apiKeyValid,
      isBusinessHours: this.isBusinessHours(),
    };
  }

  /**
   * Auto-repair: retry connection, validate API key, log details
   */
  async attemptRepair(sheetName: string): Promise<RepairResult[]> {
    const results: RepairResult[] = [];
    const sheetsId = process.env.GOOGLE_SHEETS_ID || '';

    // Step 1: Retry connection
    try {
      const doc = new GoogleSpreadsheet(sheetsId, this.getAuth());
      await doc.loadInfo();
      const sheet = doc.sheetsByTitle[sheetName];
      if (sheet) {
        results.push({ sheetName, step: 'retry_connection', success: true, message: 'Connection successful on retry' });
        return results;
      } else {
        results.push({ sheetName, step: 'retry_connection', success: false, message: `Tab "${sheetName}" not found in spreadsheet` });
      }
    } catch (error) {
      results.push({
        sheetName,
        step: 'retry_connection',
        success: false,
        message: `Retry failed: ${error instanceof Error ? error.message : String(error)}`,
      });
    }

    // Step 2: Validate API key
    try {
      const auth = this.getAuth();
      await auth.authorize();
      results.push({ sheetName, step: 'validate_api_key', success: true, message: 'Service account credentials are valid' });
    } catch (error) {
      results.push({
        sheetName,
        step: 'validate_api_key',
        success: false,
        message: `API key invalid: ${error instanceof Error ? error.message : String(error)}`,
      });
    }

    // Step 3: Log for manual investigation
    const errorDetails = results.filter(r => !r.success).map(r => `${r.step}: ${r.message}`).join('; ');
    console.error(`[SHEETS-HEALTH] 🔧 REPAIR FAILED for "${sheetName}": ${errorDetails}`);
    console.error(`[SHEETS-HEALTH] Manual investigation needed. Check:`);
    console.error(`  - Google Sheets ID: ${sheetsId}`);
    console.error(`  - Service Account: ${process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL}`);
    console.error(`  - Sheet tab name: ${sheetName}`);
    console.error(`  - AppScript: Verify doGet/doPost triggers are still deployed`);
    console.error(`  - Sharing: Ensure service account has edit access to the spreadsheet`);

    results.push({
      sheetName,
      step: 'log_for_investigation',
      success: true,
      message: 'Detailed error logged. AppScript checks needed: verify triggers are deployed, check execution logs at script.google.com, ensure spreadsheet sharing permissions include the service account.',
    });

    return results;
  }
}

export const sheetsHealthService = new SheetsHealthService();
