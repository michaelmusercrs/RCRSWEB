/**
 * investigate-4-legacy-ridge-vent-2026-05-21.mjs
 *
 * READ-ONLY. For 4 legacy delivery tickets with suspect Ridge Vent qtys
 * (55-70), look up the source legacy row + the JobNimbus job to determine
 * whether the qty is in sticks (correct) or linear feet (needs ÷4).
 *
 * Targets:
 *   R# 10311 (2025-08-19, RV qty=70)
 *   R# 10365 (2025-09-16, RV qty=70)
 *   R# 10549 (2025-09-19, RV qty=65)
 *   R# 10290 (2025-08-22, RV qty=55)
 *
 * Cross-checks:
 *   - Pull legacy `Inventory` rows for that R# / date to read recorded
 *     Amount, Price, Cost — does cost align with qty-in-sticks at the
 *     catalog Items price?
 *   - Pull the master sheet `Material Orders Workflow` tab for any rows
 *     keyed to these R#s.
 *   - Pull JobNimbus job by number ("R-<num>") for customer, address,
 *     description, attachments. Pull files / activities for ridge length
 *     clues.
 *
 * NO writes. Outputs JSON + log to scripts/.
 */
import fs from 'fs';
import path from 'path';

// ---- load .env.local ----
const envPath = path.join(process.cwd(), '.env.local');
fs.readFileSync(envPath, 'utf8').split('\n').forEach((l) => {
  const m = l.match(/^([A-Z_]+)=(.*)$/);
  if (m) {
    let v = m[2];
    if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1);
    process.env[m[1]] = v;
  }
});

const LEGACY_SHEET_ID = process.env.LEGACY_INVENTORY_SHEETS_ID;
const MASTER_SHEET_ID = process.env.GOOGLE_SHEETS_ID;
const JN_API_KEY = process.env.JOBNIMBUS_API_KEY;
const JN_API_URL = process.env.JOBNIMBUS_API_URL || 'https://app.jobnimbus.com/api1';

const { JWT } = await import('google-auth-library');
const { GoogleSpreadsheet } = await import('google-spreadsheet');

const auth = new JWT({
  email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL?.trim(),
  key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n').trim(),
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

const TARGETS = [
  { rNum: '10311', date: '2025-08-19', ridgeQty: 70 },
  { rNum: '10365', date: '2025-09-16', ridgeQty: 70 },
  { rNum: '10549', date: '2025-09-19', ridgeQty: 65 },
  { rNum: '10290', date: '2025-08-22', ridgeQty: 55 },
];

const RIDGE_VENT_ITEM_ID = 'item-127';
const LF_PER_STICK = 4;

const logLines = [];
function log(s = '') {
  console.log(s);
  logLines.push(s);
}

function parseNum(v) {
  if (v == null || v === '') return 0;
  const n = parseFloat(String(v).replace(/[$,]/g, ''));
  return Number.isFinite(n) ? n : 0;
}

function parseLegacyDateTime(value) {
  if (value == null || value === '') return null;
  if (typeof value === 'number' && Number.isFinite(value) && value > 1000) {
    const d = new Date((value - 25569) * 86400000);
    if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  }
  const s = String(value).trim();
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/);
  if (m) {
    const [, mo, da, yr] = m;
    return `${yr}-${String(mo).padStart(2, '0')}-${String(da).padStart(2, '0')}`;
  }
  const isoM = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoM) return isoM[0];
  const d = new Date(s);
  if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  return null;
}

// ---- JN helper ----
async function jnApiRequest(endpoint) {
  if (!JN_API_KEY) return { error: 'no_api_key' };
  const url = `${JN_API_URL}${endpoint}`;
  try {
    const r = await fetch(url, {
      headers: {
        Authorization: `Bearer ${JN_API_KEY}`,
        'Content-Type': 'application/json',
      },
      signal: AbortSignal.timeout(15000),
    });
    if (!r.ok) {
      const txt = await r.text();
      return { error: `http_${r.status}`, body: txt.slice(0, 400) };
    }
    return await r.json();
  } catch (e) {
    return { error: String(e?.message || e) };
  }
}

async function jnGetJobByNumber(num) {
  const filter = { must: [{ term: { number: num } }] };
  const res = await jnApiRequest(`/jobs?filter=${encodeURIComponent(JSON.stringify(filter))}`);
  if (res?.error) return { error: res.error };
  const jobs = res?.results || [];
  return { job: jobs[0] || null, count: res?.count ?? jobs.length };
}

async function jnGetFilesForJob(jobJnid) {
  const filter = { must: [{ term: { 'related.id': jobJnid } }] };
  const res = await jnApiRequest(
    `/files?filter=${encodeURIComponent(JSON.stringify(filter))}&sort=-created_at`,
  );
  if (res?.error) return { error: res.error };
  return { files: res?.results || [] };
}

async function jnGetActivitiesForJob(jobJnid, limit = 100) {
  const filter = { must: [{ term: { 'related.id': jobJnid } }] };
  const res = await jnApiRequest(
    `/activities?filter=${encodeURIComponent(JSON.stringify(filter))}&sort=-created_at&limit=${limit}`,
  );
  if (res?.error) return { error: res.error };
  return { activities: res?.results || [] };
}

async function jnGetEstimatesForJob(jobJnid) {
  // try by related.id
  const filter = { must: [{ term: { 'related.id': jobJnid } }] };
  const res = await jnApiRequest(
    `/estimates?filter=${encodeURIComponent(JSON.stringify(filter))}`,
  );
  if (res?.error) return { error: res.error };
  return { estimates: res?.results || [] };
}

// ---- 1. Open legacy + master sheets ----
log('=== Open legacy sheet ===');
const legacyDoc = new GoogleSpreadsheet(LEGACY_SHEET_ID, auth);
await legacyDoc.loadInfo();
log(`Legacy doc: "${legacyDoc.title}"`);
log(`Tabs: ${Object.keys(legacyDoc.sheetsByTitle).join(', ')}`);

const itemsTab = legacyDoc.sheetsByTitle['Items'];
const itemsRows = itemsTab ? await itemsTab.getRows() : [];
const itemsCatalog = {};
for (const r of itemsRows) {
  const o = r.toObject();
  const id = (o['Item ID'] || o['ItemID'] || '').toString().trim();
  if (!id) continue;
  itemsCatalog[id] = {
    id,
    name: (o['Name'] || o['Item Name'] || o['Description'] || '').toString().trim(),
    price: parseNum(o['Price']),
    cost: parseNum(o['Cost']),
  };
}
const ridgeCatalog = itemsCatalog[RIDGE_VENT_ITEM_ID];
log(`Ridge Vent (${RIDGE_VENT_ITEM_ID}) catalog: ${JSON.stringify(ridgeCatalog)}`);

// All legacy inventory rows
const invTab = legacyDoc.sheetsByTitle['Inventory'];
await invTab.loadHeaderRow();
const invRows = await invTab.getRows();
log(`Legacy Inventory rows: ${invRows.length}`);

// Index by R#+date for fast lookup
const allLegacyRows = invRows.map((r) => {
  const o = r.toObject();
  return {
    invId: (o['Inventory ID'] || '').toString().trim(),
    itemId: (o['Item ID'] || '').toString().trim(),
    dateRaw: o['DateTime'],
    date: parseLegacyDateTime(o['DateTime']),
    amount: parseNum(o['Amount']),
    rNum: (o['R#'] || '').toString().trim(),
    price: parseNum(o['Price']),
    cost: parseNum(o['Cost']),
    photo: (o['Delivery Photo'] || '').toString().trim(),
  };
});

// Master sheet — Material Orders Workflow
log('');
log('=== Open master sheet ===');
const masterDoc = new GoogleSpreadsheet(MASTER_SHEET_ID, auth);
await masterDoc.loadInfo();
log(`Master doc: "${masterDoc.title}"`);
const mowTab = masterDoc.sheetsByTitle['Material Orders Workflow'];
let mowRows = [];
if (mowTab) {
  try {
    await mowTab.loadHeaderRow();
    const rows = await mowTab.getRows();
    mowRows = rows.map((r) => r.toObject());
    log(`Material Orders Workflow rows: ${mowRows.length}`);
    if (mowRows.length > 0) {
      log(`MOW headers: ${Object.keys(mowRows[0]).join(', ')}`);
    }
  } catch (e) {
    log(`Material Orders Workflow read error: ${e?.message || e}`);
  }
} else {
  log('Material Orders Workflow tab NOT found');
}

// ---- 2. Per target, gather everything ----
const reports = [];
for (const t of TARGETS) {
  log('');
  log('=' + '='.repeat(78));
  log(`TARGET: R# ${t.rNum} (date ${t.date}, Ridge Vent qty=${t.ridgeQty})`);
  log('=' + '='.repeat(78));

  // Find all legacy rows for this R#
  const legacyForR = allLegacyRows.filter((r) => r.rNum === t.rNum);
  log(`Legacy rows where R#=${t.rNum}: ${legacyForR.length}`);

  // Ridge vent rows specifically
  const ridgeRows = legacyForR.filter((r) => r.itemId === RIDGE_VENT_ITEM_ID);
  log(`Legacy Ridge Vent rows for R#${t.rNum}: ${ridgeRows.length}`);
  for (const r of ridgeRows) {
    log(
      `  invId=${r.invId} date=${r.date} amount=${r.amount} price=$${r.price} cost=$${r.cost} photo=${r.photo ? 'yes' : 'no'}`,
    );
  }

  // Full delivery makeup for this R#
  log(`Full material makeup for R#${t.rNum} (legacy):`);
  for (const r of legacyForR) {
    const cat = itemsCatalog[r.itemId];
    log(
      `  ${r.itemId.padEnd(10)} ${(cat?.name || '').slice(0,30).padEnd(30)} amt=${String(r.amount).padStart(6)} price=$${String(r.price).padStart(7)} cost=$${String(r.cost).padStart(7)}`,
    );
  }

  // Compute cost expectations
  let costAnalysis = null;
  if (ridgeRows.length > 0 && ridgeCatalog) {
    const ridge = ridgeRows[0];
    const qtyAbs = Math.abs(ridge.amount);
    const stickPrice = ridgeCatalog.price;
    const stickCost = ridgeCatalog.cost;
    const expectedCostIfSticks = qtyAbs * stickCost;
    const expectedCostIfLF = (qtyAbs / LF_PER_STICK) * stickCost;
    const expectedPriceIfSticks = qtyAbs * stickPrice;
    const expectedPriceIfLF = (qtyAbs / LF_PER_STICK) * stickPrice;
    costAnalysis = {
      qty: qtyAbs,
      recordedPrice: ridge.price,
      recordedCost: ridge.cost,
      catalogStickPrice: stickPrice,
      catalogStickCost: stickCost,
      expectedCostIfQtyIsSticks: Math.round(expectedCostIfSticks * 100) / 100,
      expectedCostIfQtyIsLF: Math.round(expectedCostIfLF * 100) / 100,
      expectedPriceIfQtyIsSticks: Math.round(expectedPriceIfSticks * 100) / 100,
      expectedPriceIfQtyIsLF: Math.round(expectedPriceIfLF * 100) / 100,
    };
    log(`Ridge cost analysis:`);
    log(`  qty=${qtyAbs}, catalog price=$${stickPrice}/stick, catalog cost=$${stickCost}/stick`);
    log(`  recorded price=$${ridge.price}, recorded cost=$${ridge.cost}`);
    log(`  expected cost if qty=sticks → $${costAnalysis.expectedCostIfQtyIsSticks}`);
    log(`  expected cost if qty=LF     → $${costAnalysis.expectedCostIfQtyIsLF}`);
  }

  // Material Orders Workflow rows for this R#
  const mowForR = mowRows.filter((r) => {
    const blob = JSON.stringify(r).toLowerCase();
    return blob.includes(t.rNum);
  });
  log(`Material Orders Workflow rows referencing R#${t.rNum}: ${mowForR.length}`);
  if (mowForR.length > 0) log(JSON.stringify(mowForR.slice(0, 3), null, 2));

  // JN lookup — try multiple number formats
  const jnAttempts = [];
  let jnJob = null;
  for (const candidate of [`R-${t.rNum}`, t.rNum, `R${t.rNum}`]) {
    const r = await jnGetJobByNumber(candidate);
    jnAttempts.push({ candidate, count: r.count ?? null, error: r.error ?? null, found: !!r.job });
    if (r.job) {
      jnJob = r.job;
      log(`JN: matched job ${candidate} → jnid=${r.job.jnid}`);
      break;
    }
  }
  if (!jnJob) {
    log(`JN: no match for any candidate ${JSON.stringify(jnAttempts)}`);
  }

  let jnSummary = null;
  let jnFiles = [];
  let jnActivities = [];
  let jnEstimates = [];
  if (jnJob) {
    jnSummary = {
      jnid: jnJob.jnid,
      number: jnJob.number,
      name: jnJob.name,
      description: jnJob.description,
      status_name: jnJob.status_name,
      sales_rep_name: jnJob.sales_rep_name,
      record_type_name: jnJob.record_type_name,
      address_line1: jnJob.address_line1,
      address_line2: jnJob.address_line2,
      city: jnJob.city,
      state_text: jnJob.state_text,
      zip: jnJob.zip,
      approved_estimate_total: jnJob.approved_estimate_total,
      approved_invoice_total: jnJob.approved_invoice_total,
      last_budget_revenue: jnJob.last_budget_revenue,
      // pull any custom-field keys that contain "ridge", "sqft", "squares", "lf", "length", "size"
    };
    const customKeysOfInterest = Object.keys(jnJob).filter((k) =>
      /ridge|sqft|square|\blf\b|length|size|scope|measure|valley|hip|eave/i.test(k),
    );
    const customs = {};
    for (const k of customKeysOfInterest) {
      const v = jnJob[k];
      if (v == null || v === '' || (typeof v === 'object' && Object.keys(v || {}).length === 0)) continue;
      customs[k] = v;
    }
    jnSummary.custom = customs;
    log(`JN job: ${jnJob.name || ''} | ${jnJob.address_line1 || ''}, ${jnJob.city || ''}, ${jnJob.state_text || ''} ${jnJob.zip || ''}`);
    log(`JN status: ${jnJob.status_name}, sales rep: ${jnJob.sales_rep_name}, type: ${jnJob.record_type_name}`);
    log(`JN description: ${(jnJob.description || '').slice(0, 200)}`);
    log(`JN totals: estimate=${jnJob.approved_estimate_total}, invoice=${jnJob.approved_invoice_total}, budget_revenue=${jnJob.last_budget_revenue}`);
    log(`JN custom fields (sqft/ridge/size related): ${JSON.stringify(customs)}`);

    // Files
    const filesRes = await jnGetFilesForJob(jnJob.jnid);
    if (filesRes.error) {
      log(`JN files: ERROR ${filesRes.error}`);
    } else {
      jnFiles = filesRes.files.map((f) => ({
        jnid: f.jnid,
        filename: f.filename,
        description: f.description,
        content_type: f.content_type,
        size: f.size,
      }));
      log(`JN files: ${jnFiles.length}`);
      for (const f of jnFiles.slice(0, 20)) {
        log(`  - ${f.filename || '(no name)'} | ${f.content_type || ''} | ${f.size || 0}B | ${f.description || ''}`);
      }
    }

    // Activities — search for ridge keywords
    const actRes = await jnGetActivitiesForJob(jnJob.jnid, 100);
    if (actRes.error) {
      log(`JN activities: ERROR ${actRes.error}`);
    } else {
      jnActivities = actRes.activities.map((a) => ({
        jnid: a.jnid,
        type: a.type,
        note: (a.note || a.content || '').slice(0, 500),
        created_at: a.created_at,
        created_by_name: a.created_by_name,
      }));
      log(`JN activities: ${jnActivities.length}`);
      const interesting = jnActivities.filter((a) =>
        /ridge|sqft|squares|\blf\b|linear|length|hip|gable|valley|eave/i.test(a.note || ''),
      );
      log(`  activities mentioning ridge/sqft/lf: ${interesting.length}`);
      for (const a of interesting.slice(0, 15)) {
        log(`  - [${a.type}] ${a.created_by_name}: ${a.note}`);
      }
    }

    // Estimates
    const estRes = await jnGetEstimatesForJob(jnJob.jnid);
    if (estRes.error) {
      log(`JN estimates: ERROR ${estRes.error}`);
    } else {
      jnEstimates = estRes.estimates.map((e) => ({
        jnid: e.jnid,
        number: e.number,
        total: e.total,
        description: (e.description || '').slice(0, 300),
        status: e.status,
      }));
      log(`JN estimates: ${jnEstimates.length}`);
      for (const e of jnEstimates.slice(0, 10)) {
        log(`  - ${e.number} status=${e.status} total=$${e.total}`);
        if (e.description) log(`    desc: ${e.description.slice(0, 200)}`);
      }
    }
  }

  reports.push({
    rNum: t.rNum,
    date: t.date,
    ridgeTicketQty: t.ridgeQty,
    legacyRows: legacyForR,
    ridgeLegacyRows: ridgeRows,
    costAnalysis,
    materialOrdersWorkflowRows: mowForR,
    jnAttempts,
    jnJobSummary: jnSummary,
    jnFiles,
    jnActivitiesSample: jnActivities.slice(0, 50),
    jnEstimates,
  });
}

// ---- 3. Write outputs ----
const outJson = path.join(
  process.cwd(),
  'scripts',
  'investigate-4-legacy-ridge-vent-2026-05-21.json',
);
const outLog = path.join(
  process.cwd(),
  'scripts',
  'investigate-4-legacy-ridge-vent-2026-05-21.log',
);
fs.writeFileSync(
  outJson,
  JSON.stringify(
    {
      generatedAt: new Date().toISOString(),
      ridgeCatalog,
      reports,
    },
    null,
    2,
  ),
);
fs.writeFileSync(outLog, logLines.join('\n'));
console.log('');
console.log(`Wrote ${outJson}`);
console.log(`Wrote ${outLog}`);
