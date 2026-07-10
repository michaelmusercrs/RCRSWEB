// Precise check: among images ACTUALLY served on public pages (blog covers +
// city heroes), which distinct topics render a byte-identical image?
import { createHash } from 'crypto';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const ROOT = process.cwd();
const PUB = join(ROOT, 'public');
const md5 = (p) => (existsSync(p) ? createHash('md5').update(readFileSync(p)).digest('hex') : 'MISSING');

// pull blog {slug,image} and city {slug,image} straight from source via regex
const idx = readFileSync(join(ROOT, 'lib/blogPostIndex.ts'), 'utf8');
const svc = readFileSync(join(ROOT, 'lib/servicesData.ts'), 'utf8');

function pairs(src, kind) {
  const out = [];
  const re = /slug:\s*'?"?([a-z0-9-]+)'?"?[\s\S]{0,400}?image:\s*'([^']+)'|slug:\s*"([a-z0-9-]+)"[\s\S]{0,400}?image:\s*"([^"]+)"/g;
  let m;
  while ((m = re.exec(src))) {
    const slug = m[1] || m[3];
    const img = m[2] || m[4];
    if (slug && img && img.startsWith('/uploads')) out.push({ kind, slug, img });
  }
  return out;
}
const items = [...pairs(idx, 'blog'), ...pairs(svc, 'city')];

const byHash = new Map();
for (const it of items) {
  it.hash = md5(join(PUB, it.img));
  if (!byHash.has(it.hash)) byHash.set(it.hash, []);
  byHash.get(it.hash).push(it);
}

const dupeGroups = [...byHash.entries()]
  .filter(([h, g]) => g.length > 1 && h !== 'MISSING')
  .sort((a, b) => b[1].length - a[1].length);

console.log(`\nParsed ${items.length} served images (${items.filter((i) => i.kind === 'blog').length} blog covers + ${items.filter((i) => i.kind === 'city').length} city heroes).`);
const missing = items.filter((i) => i.hash === 'MISSING');
console.log(`Missing files: ${missing.length}${missing.length ? ' -> ' + missing.map((m) => m.img).join(', ') : ''}`);
console.log(`\n===== DISTINCT TOPICS SHARING A PIXEL-IDENTICAL IMAGE: ${dupeGroups.length} groups =====`);
let affected = 0;
for (const [h, g] of dupeGroups) {
  affected += g.length;
  console.log(`\n[${g.length} pages share ${g[0].img}]`);
  for (const it of g) console.log(`   ${it.kind}: ${it.slug}`);
}
console.log(`\nTOTAL pages showing a non-unique image: ${affected}`);
