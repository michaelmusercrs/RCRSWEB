// Test the real PDF measurement parser + coverage math on the sample report.
//   npx tsx scripts/gaf-test-parse.ts
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { extractMeasurementsFromPdf } from '../lib/gaf/pdf-measurements';
import { buildMaterialSummary } from '../lib/gaf/coverage-config';

async function main() {
  const pdf = fs.readFileSync(path.join(os.homedir(), 'Desktop', 'GAF-Samples', 'FullReport-sample.pdf'));
  const { measurements: m, ok, textLen } = await extractMeasurementsFromPdf(pdf);
  console.log('parse ok:', ok, ' textLen:', textLen);
  console.log('MEASUREMENTS:', JSON.stringify(m, null, 0));
  const summary = buildMaterialSummary(m, { city: 'huntsville', zip: '35802' });
  console.log('\nMATERIAL ORDER (5713 Macon Dr SE, Huntsville):');
  for (const l of summary.lines) console.log(`  ${String(l.qty).padStart(4)} ${l.unit.padEnd(7)} ${l.name}${l.estimated ? ' (est)' : ''}   [${l.basis}]`);
  console.log('ADVISORIES:'); for (const a of summary.advisories) console.log(`  - ${a}`);
  console.log('ASSUMPTIONS:'); for (const a of summary.assumptions) console.log(`  - ${a}`);
}
main().catch(e => { console.error(e); process.exit(1); });
