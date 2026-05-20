/**
 * Read pending material-order tickets from the master sheet.
 * Targets specific known tabs to avoid empty-header sheets.
 * Outputs JSON to stdout.
 */
import { config } from 'dotenv';
import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';

config({ path: '.env.local', quiet: true });

const auth = new JWT({
  email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
  key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
  scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
});

const doc = new GoogleSpreadsheet(process.env.GOOGLE_SHEETS_ID, auth);
await doc.loadInfo();

const TARGET_TABS = [
  'Tickets',
  'Delivery Tickets',
  'Material Orders Workflow',
  'Orders',
  'Invoices',
  'PipelineOrders',
  'Inventory_Products',
  'Inventory',
];

const result = { sheet: doc.title, tabs: {} };

for (const tabName of TARGET_TABS) {
  const sheet = doc.sheetsByTitle[tabName];
  if (!sheet) {
    result.tabs[tabName] = { error: 'tab not found' };
    continue;
  }
  try {
    await sheet.loadHeaderRow();
  } catch (err) {
    result.tabs[tabName] = { error: 'no header row', rowCount: sheet.rowCount };
    continue;
  }
  const headers = sheet.headerValues;
  const rows = await sheet.getRows();
  // Filter to non-empty rows
  const data = rows
    .map(r => {
      const obj = {};
      let hasContent = false;
      for (const h of headers) {
        const v = r.get(h);
        if (v !== '' && v !== undefined && v !== null) hasContent = true;
        obj[h] = v;
      }
      return hasContent ? obj : null;
    })
    .filter(Boolean);

  result.tabs[tabName] = { headers, rowCount: data.length, rows: data };
}

console.log(JSON.stringify(result, null, 2));
