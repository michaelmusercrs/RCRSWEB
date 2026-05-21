/**
 * Inspect Job_Breakdowns tab schema + existing rows.
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

const TABS = ['Job_Breakdowns', 'CustomerBreakdowns', 'Job_Material_Costs'];
const out = {};
for (const t of TABS) {
  const s = doc.sheetsByTitle[t];
  if (!s) { out[t] = 'missing'; continue; }
  try {
    await s.loadHeaderRow();
    const rows = await s.getRows({ limit: 3 });
    out[t] = {
      headers: s.headerValues,
      sampleRows: rows.map(r => {
        const o = {};
        for (const h of s.headerValues) o[h] = r.get(h);
        return o;
      }),
      totalRowsApprox: rows.length,
    };
  } catch (e) {
    out[t] = `error: ${e.message}`;
  }
}

console.log(JSON.stringify(out, null, 2));
