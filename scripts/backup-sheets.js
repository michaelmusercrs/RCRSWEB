#!/usr/bin/env node

/**
 * Google Sheets Backup Script
 *
 * Backs up all 25 tabs from the RCRS master Google Sheet to local JSON files.
 * Uses the google-spreadsheet and google-auth-library packages already in the project.
 *
 * Usage: node scripts/backup-sheets.js
 *
 * Output: backups/sheets/YYYY-MM-DD/{tab-name}.json + manifest.json
 */

const fs = require('fs');
const path = require('path');

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

// Will be populated dynamically from the actual sheet
let TAB_NAMES = [];

async function main() {
  // Validate env vars
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const rawKey = process.env.GOOGLE_PRIVATE_KEY;
  const sheetId = process.env.GOOGLE_SHEETS_ID;

  if (!email || !rawKey || !sheetId) {
    console.error('[ERROR] Missing required environment variables:');
    if (!email) console.error('  - GOOGLE_SERVICE_ACCOUNT_EMAIL');
    if (!rawKey) console.error('  - GOOGLE_PRIVATE_KEY');
    if (!sheetId) console.error('  - GOOGLE_SHEETS_ID');
    process.exit(1);
  }

  // Handle private key - works with both escaped \n and actual newlines
  const privateKey = rawKey.replace(/\\n/g, '\n').replace(/\r\n/g, '\n');

  console.log(`[OK] Service account: ${email}`);
  console.log(`[OK] Sheet ID: ${sheetId}`);
  console.log(`[OK] Tabs to back up: ${TAB_NAMES.length}`);
  console.log('');

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

  // Authenticate
  const auth = new JWT({
    email,
    key: privateKey,
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  });

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
  TAB_NAMES = doc.sheetsByIndex.map(s => s.title);
  console.log(`[OK] Backing up ALL ${TAB_NAMES.length} tabs`);
  console.log('');

  // Create backup directory
  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  const backupDir = path.join(__dirname, '..', 'backups', 'sheets', today);
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
  for (let i = 0; i < TAB_NAMES.length; i++) {
    const tabName = TAB_NAMES[i];
    const progress = `[${i + 1}/${TAB_NAMES.length}]`;

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
    date: today,
    sheetId,
    sheetTitle: doc.title,
    tabsRequested: TAB_NAMES.length,
    tabsSucceeded: successCount,
    tabsFailed: errorCount,
    totalRecords,
    elapsedSeconds: parseFloat(elapsed),
    tabs: results,
  };

  const manifestPath = path.join(backupDir, 'manifest.json');
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf-8');

  // Summary
  console.log('');
  console.log('='.repeat(60));
  console.log('  BACKUP COMPLETE');
  console.log('='.repeat(60));
  console.log(`  Date:           ${today}`);
  console.log(`  Sheet:          ${doc.title}`);
  console.log(`  Tabs backed up: ${successCount}/${TAB_NAMES.length}`);
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

  process.exit(errorCount > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('[FATAL]', err);
  process.exit(1);
});
