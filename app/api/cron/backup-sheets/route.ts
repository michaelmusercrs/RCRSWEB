/**
 * Cron Job: Daily Google Sheets Backup
 *
 * Runs daily at 11:00 UTC (6:00 AM CDT / 5:00 AM CST).
 * Reads all tabs from both the master sheet and meeting numbers sheet,
 * serializes each tab as JSON, and stores in Vercel Blob storage.
 *
 * Blob path format: backups/{date}/{sheetName}/{tabName}.json
 * Also stores: backups/{date}/manifest.json with metadata
 */

import { NextRequest, NextResponse } from 'next/server';
import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';

// Skip static generation — this route hits Google Sheets and Blob storage,
// which must run at request time, not at build time.
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const MASTER_SHEET_ID = process.env.GOOGLE_SHEETS_ID || '1uMEdtHo3xMu2gs21p7dYAgYiPWuCZ3s4a8YU-gJZ31s';
const MEETINGS_SHEET_ID = '1tEbMVUrvrRIkptISumvIrcgUhSWN5X2ldYro9ADTXF0';

// Verify the request is from Vercel Cron or has the correct secret
function verifyCronAuth(request: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return true; // If no secret configured, allow (dev mode)

  const authHeader = request.headers.get('authorization');
  return authHeader === `Bearer ${cronSecret}`;
}

// Initialize Google Sheets auth
function getAuth(): JWT {
  const privateKey = process.env.GOOGLE_PRIVATE_KEY
    ?.replace(/\\n/g, '\n')
    ?.replace(/\r\n/g, '\n');

  return new JWT({
    email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    key: privateKey,
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  });
}

interface TabBackupResult {
  tab: string;
  file: string;
  status: 'success' | 'error';
  rows: number;
  columns: number;
  blobUrl?: string;
  error?: string;
}

interface SheetBackupResult {
  sheetId: string;
  sheetTitle: string;
  sheetKey: string;
  tabCount: number;
  successCount: number;
  errorCount: number;
  totalRows: number;
  tabs: TabBackupResult[];
}

/**
 * Back up all tabs from a single Google Sheet to Vercel Blob.
 */
async function backupSheet(
  auth: JWT,
  sheetId: string,
  sheetKey: string,
  dateStr: string,
): Promise<SheetBackupResult> {
  const { put } = await import('@vercel/blob');

  const doc = new GoogleSpreadsheet(sheetId, auth);
  await doc.loadInfo();

  const tabs: TabBackupResult[] = [];
  let successCount = 0;
  let errorCount = 0;
  let totalRows = 0;

  for (const sheet of doc.sheetsByIndex) {
    const tabName = sheet.title;
    const safeName = tabName.replace(/[^a-zA-Z0-9_.-]/g, '_');

    try {
      const rows = await sheet.getRows();
      const headers = sheet.headerValues || [];

      // Convert rows to plain objects
      const data = rows.map((row) => {
        const obj: Record<string, string> = {};
        for (const header of headers) {
          const val = row.get(header);
          obj[header] = val !== undefined && val !== null ? val : '';
        }
        return obj;
      });

      const content = JSON.stringify(data, null, 2);
      const blobPath = `backups/${dateStr}/${sheetKey}/${safeName}.json`;

      const blob = await put(blobPath, content, {
        access: 'public',
        contentType: 'application/json',
        addRandomSuffix: false,
      });

      totalRows += data.length;
      successCount++;

      tabs.push({
        tab: tabName,
        file: `${safeName}.json`,
        status: 'success',
        rows: data.length,
        columns: headers.length,
        blobUrl: blob.url,
      });
    } catch (err) {
      errorCount++;
      tabs.push({
        tab: tabName,
        file: `${safeName}.json`,
        status: 'error',
        rows: 0,
        columns: 0,
        error: err instanceof Error ? err.message : 'Unknown error',
      });
    }
  }

  return {
    sheetId,
    sheetTitle: doc.title,
    sheetKey,
    tabCount: doc.sheetsByIndex.length,
    successCount,
    errorCount,
    totalRows,
    tabs,
  };
}

export async function GET(request: NextRequest) {
  if (!verifyCronAuth(request)) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 },
    );
  }

  const startTime = Date.now();
  const dateStr = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

  console.log(`[backup-sheets] Daily backup triggered for ${dateStr}`);

  try {
    const auth = getAuth();

    // Back up both sheets
    const masterResult = await backupSheet(auth, MASTER_SHEET_ID, 'master', dateStr);
    console.log(
      `[backup-sheets] Master: ${masterResult.successCount}/${masterResult.tabCount} tabs, ${masterResult.totalRows} rows`,
    );

    const meetingsResult = await backupSheet(auth, MEETINGS_SHEET_ID, 'meetings', dateStr);
    console.log(
      `[backup-sheets] Meetings: ${meetingsResult.successCount}/${meetingsResult.tabCount} tabs, ${meetingsResult.totalRows} rows`,
    );

    // Build and store manifest
    const elapsedSeconds = ((Date.now() - startTime) / 1000).toFixed(1);
    const manifest = {
      timestamp: new Date().toISOString(),
      date: dateStr,
      elapsedSeconds: parseFloat(elapsedSeconds),
      sheets: {
        master: {
          sheetId: masterResult.sheetId,
          sheetTitle: masterResult.sheetTitle,
          tabCount: masterResult.tabCount,
          successCount: masterResult.successCount,
          errorCount: masterResult.errorCount,
          totalRows: masterResult.totalRows,
          tabs: masterResult.tabs.map((t) => ({
            tab: t.tab,
            file: t.file,
            status: t.status,
            rows: t.rows,
            columns: t.columns,
            ...(t.error ? { error: t.error } : {}),
          })),
        },
        meetings: {
          sheetId: meetingsResult.sheetId,
          sheetTitle: meetingsResult.sheetTitle,
          tabCount: meetingsResult.tabCount,
          successCount: meetingsResult.successCount,
          errorCount: meetingsResult.errorCount,
          totalRows: meetingsResult.totalRows,
          tabs: meetingsResult.tabs.map((t) => ({
            tab: t.tab,
            file: t.file,
            status: t.status,
            rows: t.rows,
            columns: t.columns,
            ...(t.error ? { error: t.error } : {}),
          })),
        },
      },
      totals: {
        tabsBacked: masterResult.successCount + meetingsResult.successCount,
        tabsFailed: masterResult.errorCount + meetingsResult.errorCount,
        totalRows: masterResult.totalRows + meetingsResult.totalRows,
      },
    };

    const { put } = await import('@vercel/blob');
    await put(`backups/${dateStr}/manifest.json`, JSON.stringify(manifest, null, 2), {
      access: 'public',
      contentType: 'application/json',
      addRandomSuffix: false,
    });

    console.log(
      `[backup-sheets] Complete: ${manifest.totals.tabsBacked} tabs, ${manifest.totals.totalRows} rows in ${elapsedSeconds}s`,
    );

    return NextResponse.json({
      success: true,
      message: `Backup complete for ${dateStr}`,
      date: dateStr,
      elapsedSeconds: parseFloat(elapsedSeconds),
      master: {
        title: masterResult.sheetTitle,
        tabs: masterResult.successCount,
        rows: masterResult.totalRows,
        errors: masterResult.errorCount,
      },
      meetings: {
        title: meetingsResult.sheetTitle,
        tabs: meetingsResult.successCount,
        rows: meetingsResult.totalRows,
        errors: meetingsResult.errorCount,
      },
      totals: manifest.totals,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[backup-sheets] Failed:', message);

    return NextResponse.json(
      {
        success: false,
        error: `Backup failed: ${message}`,
        date: dateStr,
      },
      { status: 500 },
    );
  }
}
