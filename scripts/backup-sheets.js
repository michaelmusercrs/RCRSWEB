#!/usr/bin/env node

/**
 * Google Sheets Backup Script
 *
 * Backs up RCRS Google Sheets to local JSON files.
 *
 * Usage:
 *   node scripts/backup-sheets.js           - backs up master sheet (default)
 *   node scripts/backup-sheets.js meetings  - backs up Monday meeting numbers sheet
 *   node scripts/backup-sheets.js all       - backs up both
 *
 * Output:
 *   Master:   backups/sheets/YYYY-MM-DD/{tab-name}.json + manifest.json
 *   Meetings: backups/sheets/YYYY-MM-DD/meetings/{tab-name}.json + manifest.json
 */

const fs = require('fs');
const path = require('path');

// Monday Meeting Numbers sheet ID (one tab per Monday, format: M.DD.YYYY)
const MEETINGS_SHEET_ID = '1tEbMVUrvrRIkptISumvIrcgUhSWN5X2ldYro9ADTXF0';

// Load .env.local from project root
const envPath = path.join(__dirname, '..', '.env.local');
try {
  const envContent = fs.readFileSync(envPath, 'utf-8');
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    // Skip comments and empty lines
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIndex = trimmed.indexOf('=');
    if (eqIndex === -1) continue;
    const key = trimmed.slice(0, eqIndex).trim();
    let value = trimmed.slice(eqIndex + 1).trim();
    // Strip surrounding quotes if present
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
  console.log('[OK] Loaded environment from .env.local');
} catch (err) {
  console.error('[ERROR] Could not read .env.local:', err.message);
  console.error('  Make sure .env.local exists in the project root with:');
  console.error('    GOOGLE_SERVICE_ACCOUNT_EMAIL');
  console.error('    GOOGLE_PRIVATE_KEY');
  console.error('    GOOGLE_SHEETS_ID');
  process.exit(1);
}

// Parse command line argument
const arg = (process.argv[2] || '').toLowerCase();
const validArgs = ['', 'master', 'meetings', 'all'];
if (!validArgs.includes(arg)) {
  console.error(`[ERROR] Unknown argument: "${process.argv[2]}"`);
  console.error('  Usage:');
  console.error('    node scripts/backup-sheets.js           - backs up master sheet (default)');
  console.error('    node scripts/backup-sheets.js meetings  - backs up Monday meeting numbers sheet');
  console.error('    node scripts/backup-sheets.js all       - backs up both');
  process.exit(1);
}

const backupMaster = arg === '' || arg === 'master' || arg === 'all';
const backupMeetings = arg === 'meetings' || arg === 'all';

/**
 * Initialize auth and import packages. Shared by both backup functions.
 */
async function initAuth() {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const rawKey = process.env.GOOGLE_PRIVATE_KEY;

  if (!email || !rawKey) {
    console.error('[ERROR] Missing required environment variables:');
    if (!email) console.error('  - GOOGLE_SERVICE_ACCOUNT_EMAIL');
    if (!rawKey) console.error('  - GOOGLE_PRIVATE_KEY');
    process.exit(1);
  }

  const privateKey = rawKey.replace(/\\n/g, '\n').replace(/\r\n/g, '\n');

  // Import packages (ESM-style google-spreadsheet v5 needs dynamic import)
  let GoogleSpreadsheet, JWT;
  try {
    const gsPkg = await import('google-spreadsheet');
    GoogleSpreadsheet = gsPkg.GoogleSpreadsheet;
    const authPkg = await import('google-auth-library');
    JWT = authPkg.JWT;
  } catch (err) {
    console.error('[ERROR] Failed to import google-spreadsheet or google-auth-library.');
    console.error('  Run: npm install google-spreadsheet google-auth-library');
    console.error('  Details:', err.message);
    process.exit(1);
  }

  const auth = new JWT({
    email,
    key: privateKey,
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  });

  console.log(`[OK] Service account: ${email}`);

  return { GoogleSpreadsheet, auth };
}

/**
 * Back up all tabs from a Google Sheet to a target directory.
 * Returns { successCount, errorCount, totalRecords, results, doc }.
 */
async function backupSheet(GoogleSpreadsheet, auth, sheetId, backupDir) {
  console.log(`[OK] Sheet ID: ${sheetId}`);
  console.log('');

  // Connect to the spreadsheet
  console.log('[...] Connecting to Google Sheets...');
  const doc = new GoogleSpreadsheet(sheetId, auth);

  try {
    await doc.loadInfo();
  } catch (err) {
    console.error('[ERROR] Failed to connect to Google Sheets:', err.message);
    console.error('  Check that the service account has access to the sheet.');
    process.exit(1);
  }

  console.log(`[OK] Connected: "${doc.title}"`);
  console.log(`[OK] Sheets found: ${doc.sheetCount}`);

  // Dynamically get ALL tab names from the sheet
  const tabNames = doc.sheetsByIndex.map(s => s.title);
  console.log(`[OK] Backing up ALL ${tabNames.length} tabs`);
  console.log('');

  // Create backup directory
  fs.mkdirSync(backupDir, { recursive: true });
  console.log(`[OK] Backup directory: ${backupDir}`);
  console.log('');

  // Track results for manifest
  const startTime = Date.now();
  const results = [];
  let totalRecords = 0;
  let successCount = 0;
  let errorCount = 0;

  // Process each tab
  for (let i = 0; i < tabNames.length; i++) {
    const tabName = tabNames[i];
    const progress = `[${i + 1}/${tabNames.length}]`;

    try {
      // Find the sheet by title
      const sheet = doc.sheetsByTitle[tabName];
      if (!sheet) {
        console.warn(`${progress} SKIP: Tab "${tabName}" not found in spreadsheet`);
        results.push({
          tab: tabName,
          status: 'not_found',
          rows: 0,
          error: 'Tab not found in spreadsheet',
        });
        errorCount++;
        continue;
      }

      // Load all rows (header row becomes keys)
      const rows = await sheet.getRows();
      const headers = sheet.headerValues || [];

      // Convert rows to plain objects using header values as keys
      const data = rows.map((row) => {
        const obj = {};
        for (const header of headers) {
          const val = row.get(header);
          // Store value as-is (string), preserve empty strings as empty
          obj[header] = val !== undefined && val !== null ? val : '';
        }
        return obj;
      });

      // Save to JSON file
      const safeName = tabName.replace(/[^a-zA-Z0-9_-]/g, '_');
      const filePath = path.join(backupDir, `${safeName}.json`);
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');

      const rowCount = data.length;
      totalRecords += rowCount;
      successCount++;

      console.log(`${progress} OK: ${tabName} - ${rowCount} rows, ${headers.length} columns`);

      results.push({
        tab: tabName,
        file: `${safeName}.json`,
        status: 'success',
        rows: rowCount,
        columns: headers.length,
        headers,
      });
    } catch (err) {
      console.error(`${progress} ERROR: ${tabName} - ${err.message}`);
      results.push({
        tab: tabName,
        status: 'error',
        rows: 0,
        error: err.message,
      });
      errorCount++;
    }
  }

  // Create manifest
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  const manifest = {
    timestamp: new Date().toISOString(),
    date: new Date().toISOString().slice(0, 10),
    sheetId,
    sheetTitle: doc.title,
    tabsRequested: tabNames.length,
    tabsSucceeded: successCount,
    tabsFailed: errorCount,
    totalRecords,
    elapsedSeconds: parseFloat(elapsed),
    tabs: results,
  };

  const manifestPath = path.join(backupDir, 'manifest.json');
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf-8');

  return { successCount, errorCount, totalRecords, results, doc, tabNames, elapsed };
}

/**
 * Print a summary block for a completed backup.
 */
function printSummary(label, doc, tabNames, successCount, errorCount, totalRecords, elapsed, backupDir, results) {
  console.log('');
  console.log('='.repeat(60));
  console.log(`  ${label} BACKUP COMPLETE`);
  console.log('='.repeat(60));
  console.log(`  Date:           ${new Date().toISOString().slice(0, 10)}`);
  console.log(`  Sheet:          ${doc.title}`);
  console.log(`  Tabs backed up: ${successCount}/${tabNames.length}`);
  console.log(`  Tabs failed:    ${errorCount}`);
  console.log(`  Total records:  ${totalRecords.toLocaleString()}`);
  console.log(`  Time elapsed:   ${elapsed}s`);
  console.log(`  Output:         ${backupDir}`);
  console.log('='.repeat(60));

  if (errorCount > 0) {
    console.log('');
    console.log('Failed/skipped tabs:');
    for (const r of results) {
      if (r.status !== 'success') {
        console.log(`  - ${r.tab}: ${r.error}`);
      }
    }
  }
}

async function main() {
  const { GoogleSpreadsheet, auth } = await initAuth();

  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  let hasErrors = false;

  // ---- Master Sheet Backup ----
  if (backupMaster) {
    const sheetId = process.env.GOOGLE_SHEETS_ID;
    if (!sheetId) {
      console.error('[ERROR] Missing GOOGLE_SHEETS_ID environment variable for master sheet backup.');
      process.exit(1);
    }

    console.log('');
    console.log('#'.repeat(60));
    console.log('  MASTER SHEET BACKUP');
    console.log('#'.repeat(60));
    console.log('');

    const masterDir = path.join(__dirname, '..', 'backups', 'sheets', today);
    const result = await backupSheet(GoogleSpreadsheet, auth, sheetId, masterDir);
    printSummary('MASTER', result.doc, result.tabNames, result.successCount,
      result.errorCount, result.totalRecords, result.elapsed, masterDir, result.results);

    if (result.errorCount > 0) hasErrors = true;
  }

  // ---- Monday Meeting Numbers Backup ----
  if (backupMeetings) {
    console.log('');
    console.log('#'.repeat(60));
    console.log('  MONDAY MEETING NUMBERS BACKUP');
    console.log('#'.repeat(60));
    console.log('');

    const meetingsDir = path.join(__dirname, '..', 'backups', 'sheets', today, 'meetings');
    const result = await backupSheet(GoogleSpreadsheet, auth, MEETINGS_SHEET_ID, meetingsDir);
    printSummary('MEETINGS', result.doc, result.tabNames, result.successCount,
      result.errorCount, result.totalRecords, result.elapsed, meetingsDir, result.results);

    if (result.errorCount > 0) hasErrors = true;
  }

  process.exit(hasErrors ? 1 : 0);
}

main().catch((err) => {
  console.error('[FATAL]', err);
  process.exit(1);
});
