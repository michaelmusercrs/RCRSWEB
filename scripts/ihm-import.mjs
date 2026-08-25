#!/usr/bin/env node
/**
 * Interactive Hail Maps (Hail Recon) -- Address Marker Importer
 * ------------------------------------------------------------------
 * Pushes addresses into IHM as monitored address markers. When a
 * `salesman_email` is supplied the marker is assigned to that rep, and if the
 * account's JobNimbus integration is enabled IHM creates the JN job too.
 *
 * VERIFIED WORKING 2026-08-25:
 *   POST /WebHook/AddressMarkerImport?IhmAccessKey&IhmAccessSecret
 *        &IntegrationType=ihmjson&MonitoringSize=<n>
 *   -> {"success":true,"AddressMarker_id":<id>}
 *
 * Auth is via QUERY PARAMS (not Basic Auth). The /ExternalApi/* Basic-Auth
 * endpoints return 401 for this account, so this importer uses the WebHook.
 *
 * Usage:
 *   node scripts/ihm-import.mjs <input.json|input.csv> [--dry-run] [--size N] [--rep email]
 *
 * Input JSON: an array of objects. Required: street, city, state, zip.
 *   Optional: customer_name, customer_phone, customer_mobile, customer_email,
 *             comment1, comment2, comment3, address_monitoring_size, status,
 *             salesman_email, external_key, latitude, longitude, AddressMarker_id
 * Input CSV: header row with those same column names.
 *
 * Env (from .env.local): IHM_ACCESS_KEY / IHM_ACCESS_SECRET
 *   (falls back to HAILRECON_API_KEY / HAILRECON_API_SECRET)
 *
 * Writes: <input>.results.json  (one row per input with AddressMarker_id or error)
 */

import fs from 'node:fs';
import path from 'node:path';

// --- load .env.local without a dependency -----------------------------------
function loadEnv() {
  const candidates = ['.env.local', '.env'];
  for (const rel of candidates) {
    const p = path.resolve(process.cwd(), rel);
    if (!fs.existsSync(p)) continue;
    for (const line of fs.readFileSync(p, 'utf8').split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
      if (!m) continue;
      let [, k, v] = m;
      v = v.replace(/^["']|["']$/g, '');
      if (!(k in process.env)) process.env[k] = v;
    }
  }
}
loadEnv();

const KEY = process.env.IHM_ACCESS_KEY || process.env.HAILRECON_API_KEY;
const SECRET = process.env.IHM_ACCESS_SECRET || process.env.HAILRECON_API_SECRET;
if (!KEY || !SECRET) {
  console.error('ERROR: IHM_ACCESS_KEY / IHM_ACCESS_SECRET not found in env (.env.local).');
  process.exit(1);
}

const BASE = 'https://maps.interactivehailmaps.com/WebHook/AddressMarkerImport';

// --- args -------------------------------------------------------------------
const argv = process.argv.slice(2);
const inputFile = argv.find((a) => !a.startsWith('--'));
const dryRun = argv.includes('--dry-run');
const defaultRep = (() => {
  const i = argv.indexOf('--rep');
  return i >= 0 ? argv[i + 1] : undefined;
})();
const defaultSize = (() => {
  const i = argv.indexOf('--size');
  return i >= 0 ? Number(argv[i + 1]) : 0;
})();

if (!inputFile) {
  console.error('Usage: node scripts/ihm-import.mjs <input.json|input.csv> [--dry-run] [--size N] [--rep email]');
  process.exit(1);
}

// --- tiny CSV parser (handles quoted fields) --------------------------------
function parseCsv(text) {
  const rows = [];
  let row = [], field = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') q = false;
      else field += c;
    } else if (c === '"') q = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      if (field !== '' || row.length) { row.push(field); rows.push(row); row = []; field = ''; }
    } else field += c;
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  if (!rows.length) return [];
  const header = rows.shift().map((h) => h.trim());
  return rows.map((r) => Object.fromEntries(header.map((h, i) => [h, (r[i] ?? '').trim()])));
}

function loadInput(file) {
  const text = fs.readFileSync(file, 'utf8');
  if (file.toLowerCase().endsWith('.csv')) return parseCsv(text);
  const data = JSON.parse(text);
  return Array.isArray(data) ? data : data.markers || data.rows || [];
}

// --- build the ihmjson payload for one record -------------------------------
function buildPayload(rec) {
  const num = (v) => (v === '' || v == null ? null : Number(v));
  return {
    street: rec.street,
    city: rec.city,
    state: rec.state,
    zip: String(rec.zip ?? ''),
    customer_name: rec.customer_name || null,
    customer_phone: rec.customer_phone || null,
    customer_mobile: rec.customer_mobile || null,
    customer_email: rec.customer_email || null,
    comment1: rec.comment1 || null,
    comment2: rec.comment2 || null,
    comment3: rec.comment3 || null,
    address_monitoring_size:
      rec.address_monitoring_size != null && rec.address_monitoring_size !== ''
        ? Number(rec.address_monitoring_size)
        : defaultSize,
    status: rec.status || null,
    salesman_email: rec.salesman_email || defaultRep || null,
    AddressMarker_id: rec.AddressMarker_id ? Number(rec.AddressMarker_id) : null,
    external_key: rec.external_key || null,
    // Default to 0 = JobNimbus so IHM syncs each marker into JobNimbus natively.
    integration_partner:
      rec.integration_partner != null && rec.integration_partner !== ''
        ? Number(rec.integration_partner)
        : 0,
    latitude: num(rec.latitude),
    longitude: num(rec.longitude),
  };
}

async function importOne(payload, size) {
  const url =
    `${BASE}?IhmAccessKey=${encodeURIComponent(KEY)}` +
    `&IhmAccessSecret=${encodeURIComponent(SECRET)}` +
    `&IntegrationType=ihmjson&MonitoringSize=${encodeURIComponent(size)}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* non-JSON error page */ }
  return { httpStatus: res.status, json, raw: json ? undefined : text.slice(0, 300) };
}

// --- run --------------------------------------------------------------------
const records = loadInput(inputFile);
console.log(`Loaded ${records.length} record(s) from ${inputFile}`);
if (dryRun) console.log('DRY RUN — no requests will be sent.\n');

const results = [];
let ok = 0, fail = 0;

for (let i = 0; i < records.length; i++) {
  const rec = records[i];
  const label = `${rec.street}, ${rec.city}, ${rec.state} ${rec.zip}`;
  const missing = ['street', 'city', 'state', 'zip'].filter((f) => !rec[f]);
  if (missing.length) {
    console.log(`  [${i + 1}/${records.length}] SKIP  ${label}  (missing: ${missing.join(', ')})`);
    results.push({ input: rec, error: `missing required: ${missing.join(', ')}` });
    fail++;
    continue;
  }

  const payload = buildPayload(rec);
  const size = payload.address_monitoring_size ?? defaultSize;

  if (dryRun) {
    console.log(`  [${i + 1}/${records.length}] DRY   ${label}` + (payload.salesman_email ? ` -> ${payload.salesman_email}` : ''));
    results.push({ input: rec, payload, dryRun: true });
    continue;
  }

  try {
    const r = await importOne(payload, size);
    if (r.httpStatus === 200 && r.json?.success) {
      ok++;
      console.log(`  [${i + 1}/${records.length}] OK    ${label}  -> marker ${r.json.AddressMarker_id}` + (payload.salesman_email ? ` (rep: ${payload.salesman_email})` : ''));
      results.push({ input: rec, AddressMarker_id: r.json.AddressMarker_id, salesman_email: payload.salesman_email || null });
    } else {
      fail++;
      console.log(`  [${i + 1}/${records.length}] FAIL  ${label}  (HTTP ${r.httpStatus}) ${r.raw || JSON.stringify(r.json)}`);
      results.push({ input: rec, error: r.raw || r.json, httpStatus: r.httpStatus });
    }
  } catch (e) {
    fail++;
    console.log(`  [${i + 1}/${records.length}] ERROR ${label}  ${e.message}`);
    results.push({ input: rec, error: e.message });
  }

  // be polite to the API
  await new Promise((res) => setTimeout(res, 350));
}

const outFile = inputFile.replace(/\.(json|csv)$/i, '') + '.results.json';
fs.writeFileSync(outFile, JSON.stringify(results, null, 2));
console.log(`\nDone. OK=${ok} FAIL=${fail}. Results -> ${outFile}`);
