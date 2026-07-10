// Duplicate & reused image scanner for SEO hygiene.
// Catches: (1) byte-identical files on disk, (2) same image referenced by many
// pages/components, (3) distinct filenames that are byte-identical AND both
// referenced (the worst case for SEO — looks like unique images but isn't).
import { createHash } from 'crypto';
import { readFileSync, readdirSync, existsSync } from 'fs';
import { join, extname } from 'path';

const ROOT = process.cwd();
const PUB = join(ROOT, 'public');
const IMG_EXT = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif', '.avif']);

function walk(d) {
  let out = [];
  for (const e of readdirSync(d, { withFileTypes: true })) {
    const f = join(d, e.name);
    if (e.isDirectory()) out = out.concat(walk(f));
    else if (IMG_EXT.has(extname(e.name).toLowerCase())) out.push(f);
  }
  return out;
}

const rel = (f) => f.replace(ROOT, '').split('\\').join('/');
const md5 = (f) => createHash('md5').update(readFileSync(f)).digest('hex');

// (1) hash every image on disk
const files = walk(PUB);
const byHash = new Map();
for (const f of files) {
  const h = md5(f);
  if (!byHash.has(h)) byHash.set(h, []);
  byHash.get(h).push(rel(f));
}
const identical = [...byHash.values()].filter((g) => g.length > 1).sort((a, b) => b.length - a.length);

// (2) collect image references from source
const srcFiles = [];
function walkSrc(d) {
  for (const e of readdirSync(d, { withFileTypes: true })) {
    if (['node_modules', '.next', '.git', 'out', 'backups'].includes(e.name)) continue;
    const f = join(d, e.name);
    if (e.isDirectory()) walkSrc(f);
    else if (/\.(tsx?|jsx?|json)$/.test(e.name)) srcFiles.push(f);
  }
}
for (const d of ['app', 'components', 'lib']) walkSrc(join(ROOT, d));

const refCount = new Map();
const refRe = /["'`](\/(?:uploads|images|logos|vendor)\/[^"'`)]+?\.(?:jpg|jpeg|png|webp|gif|avif))["'`]/gi;
for (const f of srcFiles) {
  const t = readFileSync(f, 'utf8');
  let m;
  while ((m = refRe.exec(t))) refCount.set(m[1], (refCount.get(m[1]) || 0) + 1);
}
const reused = [...refCount.entries()].filter(([, n]) => n > 1).sort((a, b) => b[1] - a[1]);

// (3) referenced paths that are byte-identical under different filenames
const pathHash = new Map();
for (const [p] of refCount) {
  const abs = join(PUB, p);
  if (existsSync(abs)) pathHash.set(p, md5(abs));
}
const refByHash = new Map();
for (const [p, h] of pathHash) {
  if (!refByHash.has(h)) refByHash.set(h, []);
  refByHash.get(h).push(p);
}
const crossRefDupes = [...refByHash.values()].filter((g) => g.length > 1).sort((a, b) => b.length - a.length);

console.log('\n===== IMAGE DUPLICATE / REUSE SCAN =====');
console.log(`Scanned ${files.length} image files on disk; ${refCount.size} distinct image paths referenced in source.\n`);

console.log(`--- (A) BYTE-IDENTICAL FILES ON DISK: ${identical.length} groups ---`);
for (const g of identical) {
  console.log(`  [${g.length}x] ${g[0]}`);
  g.slice(1).forEach((x) => console.log(`         = ${x}`));
}

console.log(`\n--- (B) SAME IMAGE PATH USED BY MULTIPLE PAGES/COMPONENTS: ${reused.length} ---`);
for (const [p, n] of reused.slice(0, 50)) console.log(`  ${n}x  ${p}`);

console.log(`\n--- (C) DISTINCT FILENAMES THAT ARE BYTE-IDENTICAL & BOTH REFERENCED (worst for SEO): ${crossRefDupes.length} groups ---`);
for (const g of crossRefDupes) console.log(`  IDENTICAL: ${g.join('  ==  ')}`);

console.log(`\nSUMMARY: ${identical.length} identical-file groups | ${reused.length} over-reused paths | ${crossRefDupes.length} distinct-name-but-identical groups.`);
