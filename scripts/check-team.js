const fs = require('fs');
const f = fs.readFileSync('C:/Users/Michael/river-city-roofing/lib/teamData.ts', 'utf8');
// Find hunter and aaron sections
const hunterMatch = f.match(/slug: 'hunter'[\s\S]*?(?=slug: ')/);
const aaronMatch = f.match(/slug: 'aaron'[\s\S]*?(?=slug: ')/);
if (hunterMatch) {
  const lines = hunterMatch[0].split('\n').filter(l => /region|area|birm|nash|north/i.test(l));
  console.log('HUNTER:', lines.map(l => l.trim()));
}
if (aaronMatch) {
  const lines = aaronMatch[0].split('\n').filter(l => /region|area|birm|nash|north/i.test(l));
  console.log('AARON:', lines.map(l => l.trim()));
}
