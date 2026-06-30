/**
 * Test: matchCatalogItem must distinguish products that differ only by a
 * numeric size (boots: 1½/2/3/4 inch). Bug: size token dropped, all boots
 * collapse to the first SKU (INV-0006).
 *
 * Run: node --experimental-strip-types tests/match-catalog-item.test.mjs
 * (imports the REAL function from lib/material-order-email-parser.ts)
 */
import { matchCatalogItem } from '../lib/match-catalog-item.ts';

// Real catalog shape (subset of Inventory_Products) the webhook passes in.
const catalog = [
  { productId: 'INV-0001', productName: '1 1/4 EG Nails' },
  { productId: 'INV-0002', productName: 'Bottom Caps (plastic)' },
  { productId: 'INV-0003', productName: 'RCRS Syn Felt' },
  { productId: 'INV-0004', productName: 'Ice & Water Shield' },
  { productId: 'INV-0005', productName: 'Ridge Vent 4LF' },
  { productId: 'INV-0006', productName: '1 1/2” Black Bullet Boot' },
  { productId: 'INV-0007', productName: '2” Black Bullet Boot' },
  { productId: 'INV-0008', productName: '3” Black Bullet Boot' },
  { productId: 'INV-0009', productName: '4” Black Bullet Boot' },
  { productId: 'INV-0010', productName: 'Sealant' },
  { productId: 'INV-0011', productName: 'Zipper Boot' },
];

const cases = [
  // [parsed name from PDF, expected SKU]
  ['1 1/2” Black Bullet Boot', 'INV-0006'],
  ['1 1/2 Black Bullet Boot',  'INV-0006'],
  ['2” Black Bullet Boot',     'INV-0007'],
  ['2 Black Bullet Boot',      'INV-0007'],
  ['3” Black Bullet Boot',     'INV-0008'],
  ['4” Black Bullet Boot',     'INV-0009'],
  // size-less products must still resolve correctly
  ['Sealant',                  'INV-0010'],
  ['Zipper Boot',              'INV-0011'],
  ['Ridge Vent 4LF',           'INV-0005'],
  ['1 1/4 EG Nails',           'INV-0001'],
  ['Ice & Water Shield',       'INV-0004'],
];

let failed = 0;
for (const [name, expected] of cases) {
  const got = matchCatalogItem(name, catalog);
  const ok = got === expected;
  if (!ok) failed++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  "${name}"  expected=${expected}  got=${got}`);
}

// --- edge cases ---
function check(label, got, expected) {
  const ok = got === expected;
  if (!ok) failed++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}  expected=${expected}  got=${got}`);
}
// decimal size form
check('"1.5 Black Bullet Boot" -> INV-0006', matchCatalogItem('1.5 Black Bullet Boot', catalog), 'INV-0006');
// empty / falsy input
check('"" -> null', matchCatalogItem('', catalog), null);
// SAFETY: a size with no matching SKU must return null, never a wrong size.
// Catalog has only the 1½" boot; a 3" boot must NOT collapse onto it.
const onlySmallBoot = [{ productId: 'INV-0006', productName: '1 1/2” Black Bullet Boot' }];
check('3" boot w/ only 1½" in catalog -> null', matchCatalogItem('3” Black Bullet Boot', onlySmallBoot), null);

console.log(`\n${failed === 0 ? 'ALL PASS' : failed + ' FAILED'}`);
process.exit(failed === 0 ? 0 : 1);
