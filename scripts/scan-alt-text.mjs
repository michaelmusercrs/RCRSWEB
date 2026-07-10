// Alt-text hygiene scanner. Flags: empty/missing-ish alts, generic alts, and the
// same alt string reused across many DIFFERENT images (duplicate alt text, which
// Google treats like duplicate content). Logo/brand alts repeating is expected and
// down-weighted.
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

const ROOT = process.cwd();
const GENERIC = new Set(['', 'image', 'photo', 'picture', 'img', 'logo', 'icon', 'roof', 'roofing', 'banner', 'hero', 'background', 'thumbnail']);

// 1) data-driven altText fields (services + service areas)
const svc = readFileSync(join(ROOT, 'lib/servicesData.ts'), 'utf8');
const dataAlts = [];
for (const m of svc.matchAll(/slug:\s*['"]([a-z0-9-]+)['"][\s\S]{0,400}?altText:\s*['"]([^'"]*)['"]/g)) {
  dataAlts.push({ where: `servicesData:${m[1]}`, alt: m[2] });
}

// 2) alt="..."/alt={'...'}/alt={`...`} literals in JSX
const srcFiles = [];
function walk(d) {
  for (const e of readdirSync(d, { withFileTypes: true })) {
    if (['node_modules', '.next', '.git', 'out', 'backups'].includes(e.name)) continue;
    const f = join(d, e.name);
    if (e.isDirectory()) walk(f);
    else if (/\.(tsx?|jsx?)$/.test(e.name)) srcFiles.push(f);
  }
}
for (const d of ['app', 'components']) walk(join(ROOT, d));
const jsxAlts = [];
for (const f of srcFiles) {
  const t = readFileSync(f, 'utf8');
  const rel = f.replace(ROOT, '').split('\\').join('/');
  for (const m of t.matchAll(/\balt=(?:"([^"]*)"|'([^']*)'|\{\s*['"`]([^'"`]*)['"`]\s*\})/g)) {
    jsxAlts.push({ where: rel, alt: (m[1] ?? m[2] ?? m[3] ?? '') });
  }
}

const all = [...dataAlts, ...jsxAlts];
const norm = (s) => s.trim().toLowerCase();

// empty / generic
const empty = all.filter((a) => a.alt.trim() === '');
const generic = all.filter((a) => a.alt.trim() !== '' && GENERIC.has(norm(a.alt)));

// duplicate alt across different locations (ignore dynamic {var} and brand/logo lines)
const byAlt = new Map();
for (const a of all) {
  const k = norm(a.alt);
  if (!k) continue;
  if (!byAlt.has(k)) byAlt.set(k, []);
  byAlt.get(k).push(a.where);
}
const brandy = (s) => /river city roofing|logo|rcrs/i.test(s);
const dupAlts = [...byAlt.entries()].filter(([k, w]) => w.length > 1 && !brandy(k)).sort((a, b) => b[1].length - a[1].length);

console.log('\n===== ALT-TEXT HYGIENE SCAN =====');
console.log(`Scanned ${all.length} alt values (${dataAlts.length} data-driven + ${jsxAlts.length} JSX literals).\n`);
console.log(`--- (A) EMPTY alt strings: ${empty.length} ---`);
for (const a of empty.slice(0, 30)) console.log(`   ${a.where}`);
console.log(`\n--- (B) GENERIC alt strings: ${generic.length} ---`);
for (const a of generic) console.log(`   "${a.alt}"  @ ${a.where}`);
console.log(`\n--- (C) SAME alt on multiple images (non-brand): ${dupAlts.length} ---`);
for (const [k, w] of dupAlts.slice(0, 30)) console.log(`   ${w.length}x  "${k}"   [${[...new Set(w)].join(', ')}]`);
console.log(`\nSUMMARY: ${empty.length} empty | ${generic.length} generic | ${dupAlts.length} duplicated.`);
