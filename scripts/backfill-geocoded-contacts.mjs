/**
 * One-shot backfill of Geocoded_Contacts on the master sheet from JN.
 * Uses JN's built-in geo (geo.lon — the field name JN actually returns) and
 * writes the extended 34-column schema defined in lib/google-sheets-service.ts.
 *
 * Idempotent: skips JN IDs already present in the sheet.
 */
import fs from 'fs';
import path from 'path';
import { JWT } from 'google-auth-library';
import { GoogleSpreadsheet } from 'google-spreadsheet';

const envPath = path.join(process.cwd(), '.env.local');
fs.readFileSync(envPath, 'utf8').split('\n').forEach(l => {
  const m = l.match(/^([A-Z_]+)=(.*)$/);
  if (m) { let v = m[2]; if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1); process.env[m[1]] = v; }
});

const JN_KEY = process.env.JOBNIMBUS_API_KEY;
const JN_URL = process.env.JOBNIMBUS_API_URL || 'https://app.jobnimbus.com/api1';
const SHEET_ID = process.env.GOOGLE_SHEETS_ID || process.env.GOOGLE_SHEET_ID || '1uMEdtHo3xMu2gs21p7dYAgYiPWuCZ3s4a8YU-gJZ31s';
const SA_EMAIL = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
const SA_KEY = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n');

if (!JN_KEY || !SA_EMAIL || !SA_KEY) {
  console.error('Missing env (JOBNIMBUS_API_KEY / GOOGLE_SERVICE_ACCOUNT_EMAIL / GOOGLE_PRIVATE_KEY)');
  process.exit(1);
}

// Mirrors lib/google-sheets-service.ts GEOCODED_CONTACT_COLUMNS
const COLUMNS = [
  'jnid', 'name', 'firstName', 'lastName', 'company',
  'address', 'city', 'state', 'zip',
  'lat', 'lng', 'placeId',
  'email', 'mobilePhone', 'homePhone',
  'type', 'recordType',
  'salesRep', 'salesRepName', 'salesRepId',
  'jobStatus', 'isClosed', 'isArchived',
  'source', 'tags',
  'approvedEstimateTotal', 'approvedInvoiceTotal', 'lastBudgetRevenue',
  'dateOfLoss',
  'dateCreated', 'dateUpdated', 'lastInteraction', 'interactionType',
  'createdAt',
];

const isoFromEpoch = n => (n ? new Date(n * 1000).toISOString() : '');
function classifyType(status) {
  const sl = (status || '').toLowerCase();
  if (sl.includes('complete') || sl.includes('closed') || sl.includes('paid')) return 'install';
  if (sl.includes('lead') || sl.includes('new')) return 'lead';
  return 'contact';
}
function repNameToSlug(n) {
  return (n || '').toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
}

async function fetchJNPage(from, size) {
  const url = `${JN_URL}/contacts?from=${from}&size=${size}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${JN_KEY}` } });
  if (!res.ok) throw new Error(`JN ${res.status}: ${await res.text()}`);
  return res.json();
}

function recordFromJN(c) {
  const name = c.display_name || `${c.first_name || ''} ${c.last_name || ''}`.trim() || 'Unknown';
  const status = c.status_name || c.status || '';
  const type = classifyType(status);
  const dateOfLossRaw = c['Date of Loss'] ?? c.cf_date_1;
  const updatedIso = isoFromEpoch(c.date_updated) || isoFromEpoch(c.updated_at);
  const address = [c.address_line1, c.city, c.state_text, c.zip].filter(Boolean).join(', ');
  return {
    jnid: c.jnid,
    name,
    firstName: c.first_name || '',
    lastName: c.last_name || '',
    company: c.company || '',
    address,
    city: c.city || '',
    state: c.state_text || '',
    zip: c.zip || '',
    lat: String(c.geo.lat),
    lng: String(c.geo.lng ?? c.geo.lon),
    placeId: '',
    email: c.email || '',
    mobilePhone: c.mobile_phone || '',
    homePhone: c.home_phone || '',
    type,
    recordType: c.record_type_name || c.record_type || '',
    salesRep: repNameToSlug(c.sales_rep_name),
    salesRepName: c.sales_rep_name || '',
    salesRepId: c.sales_rep || '',
    jobStatus: status,
    isClosed: c.is_closed ? 'true' : 'false',
    isArchived: c.is_archived ? 'true' : 'false',
    source: c.source_name || c.source || '',
    tags: Array.isArray(c.tags) ? c.tags.join('|') : '',
    approvedEstimateTotal: c.approved_estimate_total != null ? String(c.approved_estimate_total) : '',
    approvedInvoiceTotal: c.approved_invoice_total != null ? String(c.approved_invoice_total) : '',
    lastBudgetRevenue: c.last_budget_revenue != null ? String(c.last_budget_revenue) : '',
    dateOfLoss: isoFromEpoch(dateOfLossRaw),
    dateCreated: isoFromEpoch(c.date_created),
    dateUpdated: updatedIso,
    lastInteraction: isoFromEpoch(c.date_status_change) || updatedIso,
    interactionType: type,
    createdAt: new Date().toISOString(),
  };
}

async function main() {
  const auth = new JWT({
    email: SA_EMAIL,
    key: SA_KEY,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  const doc = new GoogleSpreadsheet(SHEET_ID, auth);
  await doc.loadInfo();
  console.log(`Master sheet: "${doc.title}"`);

  let sheet = doc.sheetsByTitle['Geocoded_Contacts'];
  if (!sheet) {
    console.log('Creating Geocoded_Contacts tab...');
    sheet = await doc.addSheet({ title: 'Geocoded_Contacts', headerValues: COLUMNS });
  } else {
    // Ensure header row matches the extended schema (add any missing columns)
    await sheet.loadHeaderRow().catch(() => {});
    const existing = sheet.headerValues || [];
    const missing = COLUMNS.filter(c => !existing.includes(c));
    if (missing.length) {
      console.log(`Updating header to add ${missing.length} new column(s): ${missing.join(', ')}`);
      // Ensure the grid is wide enough for the new header
      if (sheet.columnCount < COLUMNS.length) {
        await sheet.resize({ rowCount: Math.max(sheet.rowCount, 1000), columnCount: COLUMNS.length });
      }
      await sheet.setHeaderRow(COLUMNS);
    }
  }

  // Skip set of existing jnids
  const existingRows = await sheet.getRows();
  const existingIds = new Set(existingRows.map(r => r.get('jnid')).filter(Boolean));
  console.log(`Existing rows: ${existingIds.size}`);

  // Pull all JN contacts
  console.log('Pulling JN contacts...');
  const all = [];
  let page = 0;
  while (page < 100) {
    const data = await fetchJNPage(page * 100, 100);
    const results = data.results || data.contacts || [];
    if (!results.length) break;
    all.push(...results);
    if (page % 10 === 0) console.log(`  page ${page}: total ${all.length}`);
    if (results.length < 100) break;
    page++;
  }
  console.log(`Total JN contacts: ${all.length}`);

  // Filter to those with geo and not already in sheet
  const toAdd = [];
  let skippedNoGeo = 0, skippedExists = 0;
  for (const c of all) {
    const lat = c.geo?.lat;
    const lng = c.geo?.lng ?? c.geo?.lon;
    if (typeof lat !== 'number' || typeof lng !== 'number') { skippedNoGeo++; continue; }
    if (existingIds.has(c.jnid)) { skippedExists++; continue; }
    toAdd.push(recordFromJN(c));
  }
  console.log(`To add: ${toAdd.length}  |  skipped no-geo: ${skippedNoGeo}  |  skipped existing: ${skippedExists}`);

  if (!toAdd.length) { console.log('Nothing to add.'); return; }

  // Batch-add. google-spreadsheet's addRows accepts an array.
  console.log('Writing in batches of 200...');
  let added = 0;
  for (let i = 0; i < toAdd.length; i += 200) {
    const batch = toAdd.slice(i, i + 200);
    await sheet.addRows(batch);
    added += batch.length;
    console.log(`  ${added}/${toAdd.length}`);
  }
  console.log(`\nDone. Added ${added} rows to Geocoded_Contacts.`);
}

main().catch(e => { console.error('FATAL:', e); process.exit(1); });
