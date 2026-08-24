// Read-only status check for the GAF pipeline. No writes, no emails.
//   node scripts/gaf-status-check.mjs
import fs from 'node:fs';
import { JWT } from 'google-auth-library';
import { GoogleSpreadsheet } from 'google-spreadsheet';

for (const f of ['.env.local', '.env']) {
  if (!fs.existsSync(f)) continue;
  for (const line of fs.readFileSync(f, 'utf8').split('\n')) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}
const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
const key = (process.env.GOOGLE_PRIVATE_KEY || '').replace(/\\n/g, '\n');
const sheetId = process.env.GOOGLE_SHEETS_ID;
const mailbox = process.env.GAF_INGEST_MAILBOX || 'rcrs@rivercityroofingsolutions.com';

console.log('SA:', email, '\nmailbox:', mailbox, '\n');

// 1) Gmail domain-wide delegation test
console.log('=== 1. Gmail delegation (can the cron read rcrs@?) ===');
try {
  const jwt = new JWT({ email, key, scopes: ['https://www.googleapis.com/auth/gmail.readonly'], subject: mailbox });
  const { access_token } = await jwt.authorize();
  const url = `https://gmail.googleapis.com/gmail/v1/users/${encodeURIComponent(mailbox)}/messages?q=${encodeURIComponent('from:services@gaf.com subject:"GAF QuickMeasure"')}&maxResults=3`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${access_token}` } });
  if (res.ok) {
    const j = await res.json();
    console.log(`  ✅ WORKING — Gmail readable. ${j.resultCountEstimate ?? (j.messages?.length||0)} QuickMeasure msgs visible.`);
  } else {
    const t = await res.text();
    console.log(`  ❌ NOT WORKING — HTTP ${res.status}: ${t.slice(0,200)}`);
    if (/unauthorized_client|access_denied|delegation/i.test(t)) console.log('     → domain-wide delegation NOT authorized yet.');
  }
} catch (e) {
  console.log('  ❌ token/auth error:', e.message.slice(0, 200));
  if (/unauthorized_client|delegation/i.test(e.message)) console.log('     → domain-wide delegation NOT authorized yet.');
}

// 2) Pipeline state sheets
console.log('\n=== 2. Pipeline activity (GAF_Report_Queue / GAF_Ingest_Log) ===');
try {
  const auth = new JWT({ email, key, scopes: ['https://www.googleapis.com/auth/spreadsheets'] });
  const doc = new GoogleSpreadsheet(sheetId, auth);
  await doc.loadInfo();
  for (const tab of ['GAF_Report_Queue', 'GAF_Ingest_Log']) {
    const sheet = doc.sheetsByTitle[tab];
    if (!sheet) { console.log(`  ${tab}: (not created yet — cron hasn't processed anything)`); continue; }
    const rows = await sheet.getRows({ limit: 100000 });
    console.log(`  ${tab}: ${rows.length} rows`);
    if (tab === 'GAF_Report_Queue') {
      const by = {};
      for (const r of rows) { const s = r.get('status') || '?'; by[s] = (by[s]||0)+1; }
      console.log('    status:', JSON.stringify(by));
      for (const r of rows.slice(-8)) console.log(`      ${r.get('status')}  ${r.get('jobNumber')||'—'}  ${r.get('address')}`);
    } else {
      for (const r of rows.slice(-6)) console.log(`      ${(r.get('timestamp')||'').slice(0,16)}  ${r.get('status')}  ${r.get('jobNumber')||''}  ${r.get('address')}`);
    }
  }
} catch (e) {
  console.log('  sheet read error:', e.message.slice(0, 200));
}
