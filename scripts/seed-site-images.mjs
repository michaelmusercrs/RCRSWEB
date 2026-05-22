/**
 * Seed the Site_Images sheet with rows representing what's currently
 * referenced on the site. After this runs, getImage(key) returns the
 * CURRENT image (so the lookup works the day this ships), and Michael
 * can iteratively replace each row's `url` field as new images are
 * sourced — no page-level code changes needed for the swap.
 *
 * Idempotent — re-running upserts existing rows (matched by `key`)
 * without duplicating.
 *
 * Usage: node scripts/seed-site-images.mjs
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
const SA_EMAIL = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
const SA_KEY = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n');
if (!SA_EMAIL || !SA_KEY) { console.error('Missing Google credentials'); process.exit(1); }

const COLUMNS = [
  'imageId', 'key', 'category', 'subcategory',
  'url', 'alt', 'caption', 'intent',
  'aspectRatio', 'widthPx', 'heightPx',
  'standardized', 'approved',
  'uploadedBy', 'uploadedAt', 'approvedBy', 'approvedAt',
  'usageContexts', 'replacedBy', 'tags', 'licenseSource', 'notes',
];

const now = new Date().toISOString();
const nowDate = now.slice(0, 10);

// ─── Seed data — what's currently on the site ───────────────────────────
// Derived from docs/site-image-inventory.md. The `url` field is what's
// referenced TODAY. Michael will replace each `url` (via the admin UI or
// directly in the sheet) as new images get sourced.

const seedRows = [
  // ── CITIES (10 secondary markets currently sharing one generic photo) ──
  { key: 'city-albertville-hero',     category: 'city', subcategory: 'albertville',     url: '/images/north-alabama-generic.jpg', alt: 'Albertville, Alabama roofing service area',     intent: 'Distinctive Albertville landmark or neighborhood', notes: 'PLACEHOLDER — needs replacement; see docs/image-update-todo.md Section A' },
  { key: 'city-guntersville-hero',    category: 'city', subcategory: 'guntersville',    url: '/images/north-alabama-generic.jpg', alt: 'Guntersville, Alabama roofing service area',    intent: 'Lake Guntersville or bridge', notes: 'PLACEHOLDER' },
  { key: 'city-arab-hero',            category: 'city', subcategory: 'arab',            url: '/images/north-alabama-generic.jpg', alt: 'Arab, Alabama roofing service area',            intent: 'Brindlee Mountain or downtown Arab', notes: 'PLACEHOLDER' },
  { key: 'city-scottsboro-hero',      category: 'city', subcategory: 'scottsboro',      url: '/images/north-alabama-generic.jpg', alt: 'Scottsboro, Alabama roofing service area',      intent: 'Jackson County courthouse or Goose Pond', notes: 'PLACEHOLDER' },
  { key: 'city-fort-payne-hero',      category: 'city', subcategory: 'fort-payne',      url: '/images/north-alabama-generic.jpg', alt: 'Fort Payne, Alabama roofing service area',      intent: 'DeSoto State Park or Sock Capital sign', notes: 'PLACEHOLDER' },
  { key: 'city-muscle-shoals-hero',   category: 'city', subcategory: 'muscle-shoals',   url: '/images/north-alabama-generic.jpg', alt: 'Muscle Shoals, Alabama roofing service area',   intent: 'Wilson Dam or Singing River Bridge', notes: 'PLACEHOLDER' },
  { key: 'city-meridianville-hero',   category: 'city', subcategory: 'meridianville',   url: '/images/north-alabama-generic.jpg', alt: 'Meridianville, Alabama roofing service area',   intent: 'Highway 231 corridor neighborhood', notes: 'PLACEHOLDER' },
  { key: 'city-hazel-green-hero',     category: 'city', subcategory: 'hazel-green',     url: '/images/north-alabama-generic.jpg', alt: 'Hazel Green, Alabama roofing service area',     intent: 'Hazel Green Main Street or signature landmark', notes: 'PLACEHOLDER' },
  { key: 'city-priceville-hero',      category: 'city', subcategory: 'priceville',      url: '/images/north-alabama-generic.jpg', alt: 'Priceville, Alabama roofing service area',      intent: 'Priceville school or lake-area homes', notes: 'PLACEHOLDER' },
  { key: 'city-somerville-hero',      category: 'city', subcategory: 'somerville',      url: '/images/north-alabama-generic.jpg', alt: 'Somerville, Alabama roofing service area',      intent: 'Somerville historic district', notes: 'PLACEHOLDER' },

  // ── PRIMARY MARKETS (likely already have good images — verify after seed) ──
  { key: 'city-decatur-hero',         category: 'city', subcategory: 'decatur',         url: '/images/city-decatur.jpg',           alt: 'Decatur, Alabama roofing service area',         intent: 'Decatur landmark (river bridge, downtown)', notes: 'Verify URL' },
  { key: 'city-huntsville-hero',      category: 'city', subcategory: 'huntsville',      url: '/images/city-huntsville.jpg',        alt: 'Huntsville, Alabama roofing service area',      intent: 'Huntsville skyline or Saturn V', notes: 'Verify URL' },
  { key: 'city-madison-hero',         category: 'city', subcategory: 'madison',         url: '/images/city-madison.jpg',           alt: 'Madison, Alabama roofing service area',         intent: 'Madison downtown or signature area', notes: 'Verify URL' },
  { key: 'city-hartselle-hero',       category: 'city', subcategory: 'hartselle',       url: '/images/city-hartselle.jpg',         alt: 'Hartselle, Alabama roofing service area',       intent: 'Hartselle downtown', notes: 'Verify URL' },
  { key: 'city-athens-hero',          category: 'city', subcategory: 'athens',          url: '/images/city-athens.jpg',            alt: 'Athens, Alabama roofing service area',          intent: 'Athens courthouse or Limestone County landmark', notes: 'Verify URL' },
  { key: 'city-cullman-hero',         category: 'city', subcategory: 'cullman',         url: '/images/city-cullman.jpg',           alt: 'Cullman, Alabama roofing service area',         intent: 'Cullman downtown or Ave Maria Grotto', notes: 'Verify URL' },
  { key: 'city-florence-hero',        category: 'city', subcategory: 'florence',        url: '/images/city-florence.jpg',          alt: 'Florence, Alabama roofing service area',        intent: 'Florence downtown or UNA campus', notes: 'Verify URL' },

  // ── CITY DEFAULT (the catch-all fallback) ──
  { key: 'city-default-hero',         category: 'city', subcategory: '',                url: '/images/north-alabama-generic.jpg', alt: 'North Alabama roofing service area',           intent: 'Generic North Alabama scene — used when city-specific image not available', notes: 'Intentional fallback' },

  // ── SERVICES (3 known mismatches per inventory) ──
  { key: 'service-residential-hero',  category: 'service', subcategory: 'residential',       url: '/images/service-residential.png', alt: 'Residential roofing replacement', intent: 'Residential home with completed roof' },
  { key: 'service-commercial-hero',   category: 'service', subcategory: 'commercial',        url: '/images/service-commercial.png',  alt: 'Commercial roofing',              intent: 'Commercial flat or low-slope roof' },
  { key: 'service-storm-hero',        category: 'service', subcategory: 'storm-damage',      url: '/images/service-storm.jpg',       alt: 'Storm damage repair',             intent: 'Hail or wind-damaged roof / tarped roof' },
  { key: 'service-metal-hero',        category: 'service', subcategory: 'metal-roofing',     url: '/images/service-residential.png', alt: 'Metal roofing installation',      intent: 'Standing-seam or corrugated metal roof', notes: 'MISMATCH — currently shows residential photo; needs metal-specific image. See update-todo Section B.' },
  { key: 'service-coating-hero',      category: 'service', subcategory: 'roof-coating',      url: '/images/service-residential.png', alt: 'Roof coating maintenance',        intent: 'Roof coating application or before/after', notes: 'MISMATCH' },
  { key: 'service-emergency-hero',    category: 'service', subcategory: 'emergency',         url: '/images/service-storm.jpg',       alt: 'Emergency roofing services',      intent: 'Tarp on damaged roof / crew responding', notes: 'SHARES with storm-damage; consider distinct image' },
  { key: 'service-inspection-hero',   category: 'service', subcategory: 'inspection',        url: '/images/service-inspection.jpg',  alt: 'Roof inspection service',         intent: 'Inspector with clipboard / drone aerial' },
  { key: 'service-gutter-hero',       category: 'service', subcategory: 'gutter',            url: '/images/service-gutter.jpg',      alt: 'Gutter services',                 intent: 'Clean gutter or installation' },
  { key: 'service-skylights-hero',    category: 'service', subcategory: 'skylights',         url: '/images/service-skylights.jpg',   alt: 'Skylight installation',           intent: 'Skylight from interior or exterior' },
  { key: 'service-ventilation-hero',  category: 'service', subcategory: 'ventilation',       url: '/images/service-ventilation.jpg', alt: 'Roof ventilation',                intent: 'Ridge vent / attic ventilation' },
  { key: 'service-insulation-hero',   category: 'service', subcategory: 'insulation',        url: '/images/service-insulation.jpg',  alt: 'Attic insulation',                intent: 'Attic insulation installation' },

  // ── SERVICE DEFAULT ──
  { key: 'service-default-hero',      category: 'service', subcategory: '',                  url: '/images/service-residential.png', alt: 'Roofing service',                 intent: 'Generic roofing service shot — used when no service-specific image' },

  // ── OG / SOCIAL ──
  { key: 'og-site-default',           category: 'og', subcategory: 'site',     url: '/og-image.png',          alt: 'River City Roofing Solutions',                    intent: 'Brand-forward site-wide OG; current default', aspectRatio: '1.91:1' },
  { key: 'og-blog-default',           category: 'og', subcategory: 'blog',     url: '/og-image.png',          alt: 'RCRS blog — roofing tips and insights',           intent: 'Blog-flavored OG (clipboard / tips framing)', aspectRatio: '1.91:1', notes: 'PLACEHOLDER — uses site default. See update-todo Section C.' },
  { key: 'og-city-default',           category: 'og', subcategory: 'city',     url: '/og-image.png',          alt: 'RCRS — North Alabama service area',               intent: 'Map of service area or aerial', aspectRatio: '1.91:1', notes: 'PLACEHOLDER' },
  { key: 'og-service-default',        category: 'og', subcategory: 'service',  url: '/og-image.png',          alt: 'RCRS roofing services',                           intent: 'Crew at work framing', aspectRatio: '1.91:1', notes: 'PLACEHOLDER' },

  // ── HOMEPAGE HERO ──
  { key: 'hero-homepage',             category: 'hero', subcategory: 'home',   url: '/images/hero-home.jpg',  alt: 'River City Roofing Solutions — North Alabama\'s most trusted roofer', intent: 'Hero shot — crew, completed job, or aerial' },

  // ── ABOUT ──
  { key: 'hero-about',                category: 'hero', subcategory: 'about',  url: '/images/about-hero.jpg', alt: 'About River City Roofing Solutions',              intent: 'Family / leadership / story image' },
];

const auth = new JWT({
  email: SA_EMAIL,
  key: SA_KEY,
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});
const doc = new GoogleSpreadsheet(SHEET_ID, auth);
await doc.loadInfo();
console.log(`Master sheet: "${doc.title}"`);

let sheet = doc.sheetsByTitle['Site_Images'];
if (!sheet) {
  console.log('Creating Site_Images tab...');
  sheet = await doc.addSheet({ title: 'Site_Images', headerValues: COLUMNS });
} else {
  await sheet.loadHeaderRow().catch(() => {});
  const missing = COLUMNS.filter(c => !(sheet.headerValues || []).includes(c));
  if (missing.length) {
    if (sheet.columnCount < COLUMNS.length) {
      await sheet.resize({ rowCount: Math.max(sheet.rowCount, 200), columnCount: COLUMNS.length });
    }
    await sheet.setHeaderRow(COLUMNS);
    console.log(`Updated header to add: ${missing.join(', ')}`);
  }
}

const existingRows = await sheet.getRows();
const existingByKey = new Map(existingRows.map(r => [r.get('key'), r]));

let added = 0;
let updated = 0;
for (const seed of seedRows) {
  const row = existingByKey.get(seed.key);
  const full = {
    imageId: row?.get('imageId') || `img_${nowDate}_${Math.random().toString(36).slice(2, 10)}`,
    key: seed.key,
    category: seed.category,
    subcategory: seed.subcategory || '',
    url: seed.url || '',
    alt: seed.alt || '',
    caption: '',
    intent: seed.intent || '',
    aspectRatio: seed.aspectRatio || '16:9',
    widthPx: '',
    heightPx: '',
    standardized: 'false',
    approved: 'true',  // seeded entries reflect what's already live → mark approved
    uploadedBy: 'seed-script',
    uploadedAt: row?.get('uploadedAt') || now,
    approvedBy: 'seed-script',
    approvedAt: row?.get('approvedAt') || now,
    usageContexts: '',
    replacedBy: '',
    tags: '',
    licenseSource: '',
    notes: seed.notes || '',
  };
  if (row) {
    // Idempotent — update only fields the seed defines, preserve everything else
    for (const [k, v] of Object.entries(full)) {
      if (v !== undefined && v !== '' && k !== 'imageId' && k !== 'uploadedAt' && k !== 'approvedAt') {
        row.set(k, v);
      }
    }
    await row.save();
    updated++;
  } else {
    await sheet.addRow(full);
    added++;
  }
}

console.log(`\nSeed complete:`);
console.log(`  Added:   ${added}`);
console.log(`  Updated: ${updated}`);
console.log(`  Total seed rows: ${seedRows.length}`);
console.log(`\nNext: source replacement images per docs/image-update-todo.md`);
console.log(`Then update each row's 'url' field in the Site_Images tab to swap.`);
