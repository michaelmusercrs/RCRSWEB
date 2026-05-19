/**
 * Probe JN /jobs search shapes for an autocomplete endpoint.
 * Need: partial R-number prefix match + name fuzzy match + address match.
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
const JN_KEY = process.env.JOBNIMBUS_API_KEY;
const BASE = process.env.JOBNIMBUS_API_URL || 'https://app.jobnimbus.com/api1';

async function probe(label, filterObj) {
  const url = `${BASE}/jobs?filter=${encodeURIComponent(JSON.stringify(filterObj))}&limit=5`;
  try {
    const res = await fetch(url, { headers: { Authorization: `Bearer ${JN_KEY}` } });
    const body = await res.text();
    if (res.ok) {
      try {
        const json = JSON.parse(body);
        const count = json.count ?? json.results?.length ?? '?';
        const preview = (json.results || [])
          .slice(0, 3)
          .map(r => `${r.number}=${r.name}`)
          .join(' | ');
        console.log(`[${res.status}]  ${label}  (count=${count})`);
        console.log(`         ${preview}`);
      } catch {
        console.log(`[${res.status}]  ${label}  parse fail`);
      }
    } else {
      console.log(`[${res.status}]  ${label}  -- ${body.slice(0, 120)}`);
    }
  } catch (err) {
    console.log(`[ERR]   ${label}: ${err.message}`);
  }
}

console.log('--- R-number prefix shapes ---');
await probe('prefix on number',          { must: [{ prefix: { number: 'R-109' } }] });
await probe('prefix on number lowercase', { must: [{ prefix: { number: 'r-109' } }] });
await probe('match on number',           { must: [{ match: { number: 'R-10997' } }] });
await probe('query_string number wildcard', { query_string: { query: 'number:R-109*' } });
await probe('query_string number',       { query_string: { query: 'number:"R-10997"' } });

console.log('\n--- Name fuzzy shapes ---');
await probe('match on name',             { must: [{ match: { name: 'hooper' } }] });
await probe('match_phrase_prefix name',  { must: [{ match_phrase_prefix: { name: 'hoo' } }] });
await probe('prefix on name',            { must: [{ prefix: { name: 'hoo' } }] });
await probe('query_string name wildcard', { query_string: { query: 'name:hoo*' } });

console.log('\n--- Multi-field shapes ---');
await probe('should match name+number+address', {
  should: [
    { match: { name: 'hooper' } },
    { match: { number: 'hooper' } },
    { match: { address_line1: 'hooper' } },
  ],
});
await probe('multi_match name+address',  {
  multi_match: { query: 'hooper', fields: ['name', 'address_line1', 'city', 'primary.display_name'] },
});
await probe('query_string multi-field',  { query_string: { query: 'hooper', fields: ['name', 'address_line1'] } });

console.log('\n--- Limit + sort sanity ---');
await probe('plain match_all (5)',       { match_all: {} });
