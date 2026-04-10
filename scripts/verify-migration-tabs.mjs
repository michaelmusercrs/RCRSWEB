#!/usr/bin/env node
/**
 * One-shot verification: list all tabs on the master sheet and report which
 * of the 28 new persistence-migration tabs actually exist on the sheet.
 *
 * Run: node scripts/verify-migration-tabs.mjs
 *
 * Requires GOOGLE_SHEETS_ID, GOOGLE_SERVICE_ACCOUNT_EMAIL, GOOGLE_PRIVATE_KEY
 * in .env.local (already configured for dev).
 */

import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';
import { config as loadDotenv } from 'dotenv';

loadDotenv({ path: '.env.local' });

const NEW_TABS = [
  'Gamification',
  'MarchMadness_Brackets',
  'MarchMadness_Settings',
  'Inventory_Transactions',
  'Inventory_Products',
  'Pipeline_Orders',
  'Blog_Posts',
  'Notifications',
  'Notification_Preferences',
  'Profile_Notifications',
  'Inspections',
  'Job_Progress',
  'Job_Costs',
  'Subcontractors',
  'Time_Entries',
  'Routes',
  'Calls',
  'Documents',
  'Survey_Responses',
  'Customer_Reviews',
  'Weather_Events',
  'Generated_Reports',
  'Profile_Updates',
  'Lead_Distro_Reassignments',
  'Voicemails',
  'Customer_Survey_Tokens',
  'Warranties',
  'Estimates',
];

const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n').replace(/\r\n/g, '\n');

const auth = new JWT({
  email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
  key: privateKey,
  scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
});

const doc = new GoogleSpreadsheet(process.env.GOOGLE_SHEETS_ID, auth);
await doc.loadInfo();

const existingTabs = new Set(doc.sheetsByIndex.map((s) => s.title));

console.log(`Master sheet: "${doc.title}"`);
console.log(`Total tabs: ${existingTabs.size}\n`);

const present = [];
const missing = [];
for (const t of NEW_TABS) {
  if (existingTabs.has(t)) present.push(t);
  else missing.push(t);
}

console.log(`Present (${present.length}/${NEW_TABS.length}):`);
for (const t of present) {
  const sheet = doc.sheetsByTitle[t];
  console.log(`  ✓ ${t.padEnd(32)} ${sheet.rowCount} rows × ${sheet.columnCount} cols`);
}

if (missing.length > 0) {
  console.log(`\nNot yet created (${missing.length}):`);
  for (const t of missing) console.log(`  - ${t}`);
}
