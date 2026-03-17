const fs = require('fs');
const path = require('path');

const publicDir = 'C:/Users/Michael/river-city-roofing/public';
const blogData = fs.readFileSync('C:/Users/Michael/river-city-roofing/lib/blogData.ts', 'utf8');

// Extract all image paths
const imageMatches = [...blogData.matchAll(/image:\s*['"]([^'"]+)['"]/g)];
let missing = 0;
let found = 0;

imageMatches.forEach(m => {
  const imgPath = m[1];
  const fullPath = path.join(publicDir, imgPath);
  const exists = fs.existsSync(fullPath);
  if (!exists) {
    console.log('MISSING:', imgPath);
    missing++;
  } else {
    found++;
  }
});

console.log(`\nTotal: ${imageMatches.length} | Found: ${found} | Missing: ${missing}`);
