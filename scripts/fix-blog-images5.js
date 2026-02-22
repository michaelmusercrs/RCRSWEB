// Download free images from Pexels direct URLs (no API key needed for individual photos)
const https = require('https');
const fs = require('fs');
const path = require('path');

const outputDir = 'C:/Users/Michael/river-city-roofing/public/uploads';

// Pre-selected free Pexels image URLs (all free to use commercially)
const images = [
  { file: 'blog-financing-your-roof.jpg', url: 'https://images.pexels.com/photos/7821486/pexels-photo-7821486.jpeg?auto=compress&cs=tinysrgb&w=1200' },
  { file: 'blog-gutter-guards-worth-it.jpg', url: 'https://images.pexels.com/photos/5008394/pexels-photo-5008394.jpeg?auto=compress&cs=tinysrgb&w=1200' },
  { file: 'blog-hail-damage-what-to-look-for.png', url: 'https://images.pexels.com/photos/1162251/pexels-photo-1162251.jpeg?auto=compress&cs=tinysrgb&w=1200' },
  { file: 'blog-ice-dams-roof-warning-sign.jpg', url: 'https://images.pexels.com/photos/688660/pexels-photo-688660.jpeg?auto=compress&cs=tinysrgb&w=1200' },
  { file: 'blog-iko-roofpro-difference.jpg', url: 'https://images.pexels.com/photos/8961214/pexels-photo-8961214.jpeg?auto=compress&cs=tinysrgb&w=1200' },
  { file: 'blog-metal-roofing-for-huntsville-homes.jpg', url: 'https://images.pexels.com/photos/2219024/pexels-photo-2219024.jpeg?auto=compress&cs=tinysrgb&w=1200' },
  { file: 'blog-navigating-spring-storm-season-in-alabama.png', url: 'https://images.pexels.com/photos/1118869/pexels-photo-1118869.jpeg?auto=compress&cs=tinysrgb&w=1200' },
  { file: 'blog-repair-vs-replacement.jpg', url: 'https://images.pexels.com/photos/5582867/pexels-photo-5582867.jpeg?auto=compress&cs=tinysrgb&w=1200' },
  { file: 'blog-roof-replacement-process.png', url: 'https://images.pexels.com/photos/8961438/pexels-photo-8961438.jpeg?auto=compress&cs=tinysrgb&w=1200' },
  { file: 'blog-roofing-and-home-value.jpg', url: 'https://images.pexels.com/photos/1396122/pexels-photo-1396122.jpeg?auto=compress&cs=tinysrgb&w=1200' },
  { file: 'blog-roofing-myths.jpg', url: 'https://images.pexels.com/photos/5582597/pexels-photo-5582597.jpeg?auto=compress&cs=tinysrgb&w=1200' },
  { file: 'blog-spring-2026-checklist.jpg', url: 'https://images.pexels.com/photos/2079234/pexels-photo-2079234.jpeg?auto=compress&cs=tinysrgb&w=1200' },
  { file: 'blog-summer-roof-care.jpg', url: 'https://images.pexels.com/photos/2469122/pexels-photo-2469122.jpeg?auto=compress&cs=tinysrgb&w=1200' },
  { file: 'blog-the-importance-of-attic-ventilation.jpg', url: 'https://images.pexels.com/photos/5582869/pexels-photo-5582869.jpeg?auto=compress&cs=tinysrgb&w=1200' },
  { file: 'blog-understanding-roofing-warranties.jpg', url: 'https://images.pexels.com/photos/7821495/pexels-photo-7821495.jpeg?auto=compress&cs=tinysrgb&w=1200' },
  { file: 'blog-why-we-love-iko-dynasty-shingles.jpg', url: 'https://images.pexels.com/photos/8961232/pexels-photo-8961232.jpeg?auto=compress&cs=tinysrgb&w=1200' },
  { file: 'blog-wind-damage.jpg', url: 'https://images.pexels.com/photos/1446076/pexels-photo-1446076.jpeg?auto=compress&cs=tinysrgb&w=1200' },
  { file: 'blog-dark-streaks-on-roof.jpg', url: 'https://images.pexels.com/photos/259588/pexels-photo-259588.jpeg?auto=compress&cs=tinysrgb&w=1200' },
  { file: 'blog-hail-damage-assessment.jpg', url: 'https://images.pexels.com/photos/5582598/pexels-photo-5582598.jpeg?auto=compress&cs=tinysrgb&w=1200' },
];

function download(url, outPath) {
  return new Promise((resolve, reject) => {
    const follow = (u, depth = 0) => {
      if (depth > 5) return reject(new Error('too many redirects'));
      https.get(u, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          return follow(res.headers.location, depth + 1);
        }
        if (res.statusCode !== 200) return reject(new Error(`HTTP ${res.statusCode}`));
        const chunks = [];
        res.on('data', c => chunks.push(c));
        res.on('end', () => {
          const buf = Buffer.concat(chunks);
          if (buf.length < 1000) return reject(new Error('too small'));
          fs.writeFileSync(outPath, buf);
          console.log(`OK: ${path.basename(outPath)} (${Math.round(buf.length/1024)}KB)`);
          resolve();
        });
      }).on('error', reject);
    };
    follow(url);
  });
}

async function main() {
  for (const img of images) {
    try {
      await download(img.url, path.join(outputDir, img.file));
      await new Promise(r => setTimeout(r, 300));
    } catch (err) {
      console.log(`FAIL: ${img.file} - ${err.message}`);
    }
  }
  console.log('\nDone!');
}

main();
