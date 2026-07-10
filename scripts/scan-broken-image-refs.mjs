// Broken-image-reference scan: find EVERY local image path referenced anywhere in
// the codebase (code, css, json, html, md) and verify the file exists on disk.
// Catches dangling refs left by renames/deletions/format conversions.
import { readFileSync, readdirSync, existsSync } from 'fs';
import { join, extname } from 'path';

const ROOT = process.cwd();
const PUB = join(ROOT, 'public');
const SCAN_EXT = new Set(['.ts', '.tsx', '.js', '.jsx', '.json', '.css', '.md', '.html']);
const SKIP_DIR = new Set(['node_modules', '.next', '.git', 'out', 'backups', '.vercel']);

const files = [];
function walk(d) {
  for (const e of readdirSync(d, { withFileTypes: true })) {
    if (SKIP_DIR.has(e.name)) continue;
    const f = join(d, e.name);
    if (e.isDirectory()) walk(f);
    else if (SCAN_EXT.has(extname(e.name).toLowerCase())) files.push(f);
  }
}
walk(join(ROOT, 'app'));
walk(join(ROOT, 'components'));
walk(join(ROOT, 'lib'));
walk(PUB); // html/json/manifests under public

// match "/uploads/x.jpg", "/images/y.png", '/logos/..', etc. (root-relative local image paths)
const re = /["'`(](\/[A-Za-z0-9_@./-]*\.(?:jpg|jpeg|png|webp|gif|avif|svg))["'`)]/gi;
const broken = new Map(); // path -> Set(files)
let total = 0;
const seen = new Set();
for (const f of files) {
  const t = readFileSync(f, 'utf8');
  let m;
  while ((m = re.exec(t))) {
    const p = m[1];
    if (p.includes('${') || p.includes('*')) continue; // dynamic
    seen.add(p);
    total++;
    if (!existsSync(join(PUB, p))) {
      if (!broken.has(p)) broken.set(p, new Set());
      broken.get(p).add(f.replace(ROOT, '').split('\\').join('/'));
    }
  }
}

console.log(`\nScanned ${files.length} source files; ${seen.size} distinct local image paths referenced.`);
console.log(`\n===== BROKEN IMAGE REFERENCES (file does not exist on disk): ${broken.size} =====`);
for (const [p, fs] of [...broken.entries()].sort()) {
  console.log(`  ✗ ${p}`);
  for (const f of fs) console.log(`        in ${f}`);
}
if (broken.size === 0) console.log('  (none — every referenced image exists)');
process.exit(broken.size ? 1 : 0);
