/**
 * Duplicate-image detector.
 *
 * Reads Site_Images, flags:
 *   - Any URL referenced by ≥2 registry rows (potential duplicate use)
 *   - Rows with no URL (incomplete entries)
 *   - Approved rows still pointing at the seed-time generic placeholder
 *     `/images/north-alabama-generic.jpg` (PLACEHOLDER not yet replaced)
 *
 * Writes findings to docs/image-duplicates-{date}.md so we have a
 * snapshot to share. Re-runnable any time.
 *
 * Usage: node scripts/find-duplicate-images.mjs
 */
import fs from 'fs';
import path from 'path';
import { JWT } from 'google-auth-library';
import { GoogleSpreadsheet } from 'google-spreadsheet';

const envPath = path.join(process.cwd(), '.env.local');
fs.readFileSync(envPath, 'utf8').split('\n').forEach(l => {
  const m = l.match(/^([A-Z_]+)=(.*)$/);
  if (m) {
    let v = m[2];
    if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1);
    process.env[m[1]] = v;
  }
});

const SHEET_ID = process.env.GOOGLE_SHEETS_ID || process.env.GOOGLE_SHEET_ID || '1uMEdtHo3xMu2gs21p7dYAgYiPWuCZ3s4a8YU-gJZ31s';
const auth = new JWT({
  email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
  key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
});
const doc = new GoogleSpreadsheet(SHEET_ID, auth);
await doc.loadInfo();

const sheet = doc.sheetsByTitle['Site_Images'];
if (!sheet) {
  console.error('Site_Images tab not found. Run scripts/seed-site-images.mjs first.');
  process.exit(2);
}

await sheet.loadHeaderRow().catch(() => {});
const rows = await sheet.getRows();
console.log(`Total registry rows: ${rows.length}`);

const byUrl = new Map();
const noUrl = [];
const placeholders = [];

const PLACEHOLDER_URLS = new Set([
  '/images/north-alabama-generic.jpg',
  '/images/placeholder.jpg',
  '/og-image.png', // when used by category-specific OG entries (not the site default)
]);

for (const r of rows) {
  const url = r.get('url') || '';
  const key = r.get('key') || '';
  const category = r.get('category') || '';
  const approved = r.get('approved') === 'true' || r.get('approved') === 'TRUE';

  if (!url) {
    noUrl.push({ key, category });
    continue;
  }
  const bucket = byUrl.get(url) || [];
  bucket.push({ key, category, approved, intent: r.get('intent') || '', notes: r.get('notes') || '' });
  byUrl.set(url, bucket);

  // Flag placeholder URLs still in approved rows (unless it's the site-wide default itself)
  if (PLACEHOLDER_URLS.has(url) && approved && key !== 'og-site-default' && key !== 'city-default-hero') {
    placeholders.push({ key, category, url, intent: r.get('intent') || '' });
  }
}

const duplicates = [...byUrl.entries()]
  .filter(([, rows]) => rows.length > 1)
  .sort((a, b) => b[1].length - a[1].length);

// Write report
const todayStr = new Date().toISOString().slice(0, 10);
const outPath = path.join(process.cwd(), 'docs', `image-duplicates-${todayStr}.md`);
fs.mkdirSync(path.dirname(outPath), { recursive: true });

const lines = [];
lines.push(`# Image Duplicate Report — ${todayStr}`);
lines.push('');
lines.push(`**Total registry rows:** ${rows.length}`);
lines.push(`**Unique URLs:** ${byUrl.size}`);
lines.push(`**Duplicate URLs (used by 2+ keys):** ${duplicates.length}`);
lines.push(`**Rows with no URL:** ${noUrl.length}`);
lines.push(`**Approved rows still on placeholder URLs:** ${placeholders.length}`);
lines.push('');

if (duplicates.length === 0) {
  lines.push('## ✅ No URL duplicates found');
  lines.push('');
} else {
  lines.push('## Duplicates — same URL used by multiple keys');
  lines.push('');
  lines.push('| URL | Used by (keys) | Categories |');
  lines.push('|---|---|---|');
  for (const [url, list] of duplicates) {
    const keys = list.map(r => `\`${r.key}\``).join(' · ');
    const cats = [...new Set(list.map(r => r.category))].join(', ');
    lines.push(`| \`${url}\` | ${keys} | ${cats} |`);
  }
  lines.push('');
  lines.push('**What to do:** if these keys SHOULD share an image (e.g. multiple OG defaults pointing at the site default), it\'s fine. If they shouldn\'t (e.g. 10 cities all using the same generic photo), each city needs its own image — see `docs/image-update-todo.md` Section A.');
  lines.push('');
}

if (placeholders.length > 0) {
  lines.push('## Approved rows still on placeholder URLs');
  lines.push('');
  lines.push('These rows are marked `approved=true` but their `url` is still a known placeholder. Re-source the image and update the row.');
  lines.push('');
  lines.push('| Key | Category | URL | Intent |');
  lines.push('|---|---|---|---|');
  for (const p of placeholders) {
    lines.push(`| \`${p.key}\` | ${p.category} | \`${p.url}\` | ${p.intent || '—'} |`);
  }
  lines.push('');
}

if (noUrl.length > 0) {
  lines.push('## Rows with no URL');
  lines.push('');
  lines.push('| Key | Category |');
  lines.push('|---|---|');
  for (const r of noUrl) lines.push(`| \`${r.key}\` | ${r.category} |`);
  lines.push('');
  lines.push('**What to do:** either delete these rows or upload an image to populate them.');
  lines.push('');
}

if (duplicates.length === 0 && placeholders.length === 0 && noUrl.length === 0) {
  lines.push('## 🎉 Registry is clean — no duplicates, no placeholders, no empty rows.');
  lines.push('');
}

fs.writeFileSync(outPath, lines.join('\n'), 'utf-8');
console.log(`\nReport written to ${outPath}`);
console.log(`\nSummary:`);
console.log(`  Duplicates:   ${duplicates.length}`);
console.log(`  Placeholders: ${placeholders.length}`);
console.log(`  Empty rows:   ${noUrl.length}`);
