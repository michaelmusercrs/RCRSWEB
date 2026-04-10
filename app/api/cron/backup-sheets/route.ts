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
import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';

// Skip static generation — this route hits Google Sheets and Blob storage,
// which must run at request time, not at build time.
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const MASTER_SHEET_ID = process.env.GOOGLE_SHEETS_ID || '1uMEdtHo3xMu2gs21p7dYAgYiPWuCZ3s4a8YU-gJZ31s';
const MEETINGS_SHEET_ID = '1tEbMVUrvrRIkptISumvIrcgUhSWN5X2ldYro9ADTXF0';

// Local JSON backup config
const LOCAL_JSON_MAX_BYTES = 5 * 1024 * 1024; // 5 MB safety cap
const LOCAL_JSON_SKIP = new Set<string>([
  // Auth secrets / signed tokens — never copy to public blob storage.
  'customer-tokens.json',
]);

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

interface LocalJsonFileResult {
  file: string;
  bytes: number;
  status: 'success' | 'skipped' | 'error';
  blobUrl?: string;
  reason?: string;
  error?: string;
}

interface LocalJsonBackupResult {
  rootDir: string;
  filesScanned: number;
  filesBacked: number;
  filesSkipped: number;
  filesFailed: number;
  totalBytes: number;
  files: LocalJsonFileResult[];
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

/**
 * Recursively collect all *.json files under a directory.
 * Returns paths relative to rootDir, using forward slashes.
 *
 * Avoids `withFileTypes: true` because newer @types/node produce a generic
 * Dirent<NonSharedBuffer> that fights with string concatenation. A plain
 * readdir + stat is uglier but type-clean.
 */
async function collectJsonFiles(rootDir: string): Promise<string[]> {
  const out: string[] = [];

  async function walk(dir: string, rel: string) {
    let names: string[];
    try {
      names = await readdir(dir);
    } catch {
      // Directory doesn't exist (e.g. brand-new deploy with empty data/)
      return;
    }
    for (const name of names) {
      const childAbs = path.join(dir, name);
      const childRel = rel ? `${rel}/${name}` : name;
      let stats;
      try {
        stats = await stat(childAbs);
      } catch {
        continue;
      }
      if (stats.isDirectory()) {
        await walk(childAbs, childRel);
      } else if (stats.isFile() && name.toLowerCase().endsWith('.json')) {
        out.push(childRel);
      }
    }
  }

  await walk(rootDir, '');
  return out;
}

/**
 * Snapshot every domain-data JSON file in `data/` to Vercel Blob.
 *
 * This is the safety net for the ~50 local JSON files that haven't yet been
 * migrated to actual Google Sheet tabs. On Vercel the data/ directory is
 * read-only and ships with the build, so this captures whatever state was
 * deployed plus any successful writes since the last redeploy.
 *
 * Files in LOCAL_JSON_SKIP (auth secrets) are deliberately excluded.
 * Files larger than LOCAL_JSON_MAX_BYTES are skipped to avoid runaway uploads.
 */
async function backupLocalJson(dateStr: string): Promise<LocalJsonBackupResult> {
  const { put } = await import('@vercel/blob');
  const rootDir = path.join(process.cwd(), 'data');

  const result: LocalJsonBackupResult = {
    rootDir,
    filesScanned: 0,
    filesBacked: 0,
    filesSkipped: 0,
    filesFailed: 0,
    totalBytes: 0,
    files: [],
  };

  const relativePaths = await collectJsonFiles(rootDir);
  result.filesScanned = relativePaths.length;

  for (const relPath of relativePaths) {
    const baseName = path.basename(relPath);
    const absPath = path.join(rootDir, relPath);

    if (LOCAL_JSON_SKIP.has(baseName)) {
      result.filesSkipped++;
      result.files.push({
        file: relPath,
        bytes: 0,
        status: 'skipped',
        reason: 'auth-secret-excluded',
      });
      continue;
    }

    try {
      const stats = await stat(absPath);
      if (stats.size > LOCAL_JSON_MAX_BYTES) {
        result.filesSkipped++;
        result.files.push({
          file: relPath,
          bytes: stats.size,
          status: 'skipped',
          reason: `over-${LOCAL_JSON_MAX_BYTES}-bytes`,
        });
        continue;
      }

      const content = await readFile(absPath, 'utf-8');
      // Use forward slashes in blob path even on Windows.
      const blobPath = `backups/${dateStr}/local-json/${relPath.replace(/\\/g, '/')}`;

      const blob = await put(blobPath, content, {
        access: 'public',
        contentType: 'application/json',
        addRandomSuffix: false,
      });

      result.filesBacked++;
      result.totalBytes += stats.size;
      result.files.push({
        file: relPath,
        bytes: stats.size,
        status: 'success',
        blobUrl: blob.url,
      });
    } catch (err) {
      result.filesFailed++;
      result.files.push({
        file: relPath,
        bytes: 0,
        status: 'error',
        error: err instanceof Error ? err.message : 'Unknown error',
      });
    }
  }

  return result;
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

    // Snapshot every local JSON file in data/ — safety net for stores that
    // haven't yet been migrated to actual Sheet tabs.
    let localJsonResult: LocalJsonBackupResult;
    try {
      localJsonResult = await backupLocalJson(dateStr);
      console.log(
        `[backup-sheets] LocalJSON: ${localJsonResult.filesBacked}/${localJsonResult.filesScanned} files, ${localJsonResult.totalBytes} bytes`,
      );
    } catch (err) {
      console.error('[backup-sheets] LocalJSON backup failed:', err);
      localJsonResult = {
        rootDir: '',
        filesScanned: 0,
        filesBacked: 0,
        filesSkipped: 0,
        filesFailed: 0,
        totalBytes: 0,
        files: [],
      };
    }

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
      localJson: {
        rootDir: localJsonResult.rootDir,
        filesScanned: localJsonResult.filesScanned,
        filesBacked: localJsonResult.filesBacked,
        filesSkipped: localJsonResult.filesSkipped,
        filesFailed: localJsonResult.filesFailed,
        totalBytes: localJsonResult.totalBytes,
        files: localJsonResult.files,
      },
      totals: {
        tabsBacked: masterResult.successCount + meetingsResult.successCount,
        tabsFailed: masterResult.errorCount + meetingsResult.errorCount,
        totalRows: masterResult.totalRows + meetingsResult.totalRows,
        localJsonFilesBacked: localJsonResult.filesBacked,
        localJsonFilesFailed: localJsonResult.filesFailed,
        localJsonBytes: localJsonResult.totalBytes,
      },
    };

    const { put } = await import('@vercel/blob');
    await put(`backups/${dateStr}/manifest.json`, JSON.stringify(manifest, null, 2), {
      access: 'public',
      contentType: 'application/json',
      addRandomSuffix: false,
    });

    console.log(
      `[backup-sheets] Complete: ${manifest.totals.tabsBacked} tabs, ${manifest.totals.totalRows} rows, ${manifest.totals.localJsonFilesBacked} local JSON files in ${elapsedSeconds}s`,
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
      localJson: {
        scanned: localJsonResult.filesScanned,
        backed: localJsonResult.filesBacked,
        skipped: localJsonResult.filesSkipped,
        failed: localJsonResult.filesFailed,
        bytes: localJsonResult.totalBytes,
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
