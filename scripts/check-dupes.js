const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const dir = 'C:/Users/Michael/river-city-roofing/public/uploads';
const files = fs.readdirSync(dir).filter(f => f.startsWith('blog-'));
const hashes = {};
let dupes = 0;

files.forEach(f => {
  const data = fs.readFileSync(path.join(dir, f));
  const hash = crypto.createHash('md5').update(data).digest('hex');
  if (hashes[hash]) {
    console.log('DUPE:', f, '===', hashes[hash]);
    dupes++;
  } else {
    hashes[hash] = f;
  }
});

console.log(`\nTotal files: ${files.length} | Unique: ${Object.keys(hashes).length} | Dupes: ${dupes}`);
