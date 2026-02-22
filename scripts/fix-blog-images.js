const https = require('https');
const fs = require('fs');
const path = require('path');

const outputDir = 'C:/Users/Michael/river-city-roofing/public/uploads';

// Blog posts that need new unique images (dupes or mismatched)
const needed = [
  { file: 'blog-financing-your-roof.jpg', query: 'home financing calculator' },
  { file: 'blog-gutter-guards-worth-it.jpg', query: 'rain gutter guard close up' },
  { file: 'blog-hail-damage-what-to-look-for.png', query: 'hail damage roof shingles' },
  { file: 'blog-ice-dams-roof-warning-sign.jpg', query: 'ice dam roof winter icicles' },
  { file: 'blog-iko-roofpro-difference.jpg', query: 'professional roofer installing shingles' },
  { file: 'blog-metal-roofing-for-huntsville-homes.jpg', query: 'metal roof house residential' },
  { file: 'blog-navigating-spring-storm-season-in-alabama.png', query: 'spring thunderstorm dark clouds house' },
  { file: 'blog-repair-vs-replacement.jpg', query: 'old damaged roof repair' },
  { file: 'blog-roof-replacement-process.png', query: 'roof replacement workers crew' },
  { file: 'blog-roofing-and-home-value.jpg', query: 'beautiful house new roof curb appeal' },
  { file: 'blog-roofing-myths.jpg', query: 'roof inspection professional ladder' },
  { file: 'blog-spring-2026-checklist.jpg', query: 'spring home maintenance checklist roof' },
  { file: 'blog-summer-roof-care.jpg', query: 'hot summer sun roof heat' },
  { file: 'blog-the-importance-of-attic-ventilation.jpg', query: 'attic ventilation ridge vent' },
  { file: 'blog-understanding-roofing-warranties.jpg', query: 'warranty document paperwork contractor' },
  { file: 'blog-why-we-love-iko-dynasty-shingles.jpg', query: 'beautiful architectural shingles roof close' },
  { file: 'blog-wind-damage.jpg', query: 'wind damage tree fallen roof' },
  { file: 'blog-dark-streaks-on-roof.jpg', query: 'black streaks algae roof shingles' },
  { file: 'blog-hail-damage-assessment.jpg', query: 'inspector checking hail damage roof' },
];

async function downloadImage(query, filename) {
  const url = `https://source.unsplash.com/1200x800/?${encodeURIComponent(query)}`;
  const outPath = path.join(outputDir, filename);
  
  return new Promise((resolve, reject) => {
    const follow = (url, depth = 0) => {
      if (depth > 5) return reject(new Error('Too many redirects'));
      const mod = url.startsWith('https') ? https : require('http');
      mod.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          return follow(res.headers.location, depth + 1);
        }
        if (res.statusCode !== 200) {
          return reject(new Error(`HTTP ${res.statusCode} for ${query}`));
        }
        const chunks = [];
        res.on('data', c => chunks.push(c));
        res.on('end', () => {
          const buf = Buffer.concat(chunks);
          if (buf.length < 5000) {
            return reject(new Error(`Too small (${buf.length}b) for ${query}`));
          }
          fs.writeFileSync(outPath, buf);
          console.log(`OK: ${filename} (${Math.round(buf.length/1024)}KB)`);
          resolve();
        });
        res.on('error', reject);
      }).on('error', reject);
    };
    follow(url);
  });
}

async function main() {
  for (const item of needed) {
    try {
      await downloadImage(item.query, item.file);
      // Rate limit - wait 1.5s between requests
      await new Promise(r => setTimeout(r, 1500));
    } catch (err) {
      console.log(`FAIL: ${item.file} - ${err.message}`);
    }
  }
  console.log('\nDone!');
}

main();
