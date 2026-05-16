/**
 * Diagnose: Apps Script forwarded 19 emails but only 18 tickets were created.
 *
 * Reads `material-order-webhook-events` tab (if it exists) OR falls back to
 * Apps Script execution log inspection guidance. Then cross-references against
 * the Tickets tab to find which email did NOT produce a ticket.
 *
 * Read-only. No writes.
 *
 * Usage:  node scripts/find-missing-19th-email.mjs
 */
import fs from 'fs';
import path from 'path';

const envPath = path.join(process.cwd(), '.env.local');
fs.readFileSync(envPath, 'utf8').split('\n').forEach(l => {
  const m = l.match(/^([A-Z_]+)=(.*)$/);
  if (m) {
    let v = m[2];
    if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1);
    process.env[m[1]] = v;
  }
});

const { JWT } = await import('google-auth-library');
const { GoogleSpreadsheet } = await import('google-spreadsheet');

const sheetsId = process.env.DELIVERY_SHEETS_ID || process.env.GOOGLE_SHEETS_ID;
const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n');
const auth = new JWT({
  email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL?.trim(),
  key: privateKey?.trim(),
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

const doc = new GoogleSpreadsheet(sheetsId, auth);
await doc.loadInfo();

// List all tabs
console.log('Available tabs:');
Object.keys(doc.sheetsByTitle).forEach(t => console.log(`  ${t}`));
console.log('');

// Look for a webhook events / log tab
const candidateLogTabs = Object.keys(doc.sheetsByTitle).filter(t =>
  /webhook|email.event|material.order.log|inbox/i.test(t)
);

if (candidateLogTabs.length === 0) {
  console.log('No webhook-event log tab found in this sheet.');
  console.log('');
  console.log('To find the missing 19th email, check Apps Script execution logs:');
  console.log('  1. https://script.google.com → open the stock-email-forwarder project');
  console.log('  2. Left sidebar → "Executions"');
  console.log('  3. Filter by date today / yesterday');
  console.log('  4. Look for an execution that did NOT result in "POST 200 OK" — that\'s the one');
  console.log('  5. Click into the execution to see the email subject + the error');
  console.log('');
  console.log('Common reasons one email out of a batch fails:');
  console.log('  - PDF was an image scan, not a text PDF → parser returns 0 lines');
  console.log('  - Email had multiple PDFs and the wrong one was the order');
  console.log('  - JN job number missing from the email body');
  console.log('  - Email subject did not match the expected pattern');
  console.log('  - Network blip → webhook returned 5xx, but Apps Script labels it processed anyway');
  console.log('');

  // Try to find any "failed" or "error" rows in Tickets
  const ticketsTab = doc.sheetsByTitle['Tickets'];
  if (ticketsTab) {
    const rows = await ticketsTab.getRows();
    const recentEmail = rows
      .filter(r => r.get('createdBy') === 'email-webhook')
      .sort((a, b) => (b.get('createdAt') || '').localeCompare(a.get('createdAt') || ''));

    console.log(`Email-webhook tickets in Sheet: ${recentEmail.length}`);
    console.log(`Apps Script forwarded:          19 (per user report)`);
    console.log(`Likely lost in transit:         ${19 - recentEmail.length}`);
  }
  process.exit(0);
}

for (const logTab of candidateLogTabs) {
  console.log(`\n=== Tab: ${logTab} ===`);
  const tab = doc.sheetsByTitle[logTab];
  const rows = await tab.getRows();
  console.log(`  Rows: ${rows.length}`);
  if (rows.length > 0) {
    console.log(`  Headers: ${Object.keys(rows[0].toObject()).join(', ')}`);
    console.log(`  First 3 rows:`);
    rows.slice(0, 3).forEach((r, i) => {
      console.log(`    [${i}] ${JSON.stringify(r.toObject()).slice(0, 200)}`);
    });
  }
}
