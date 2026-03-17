// Generate unique placeholder images using a free service (placehold.co with text)
// These will be properly-sized colored images with descriptive text
// Michael can replace with real photos later, but at least each is unique now

const https = require('https');
const fs = require('fs');
const path = require('path');

const outputDir = 'C:/Users/Michael/river-city-roofing/public/uploads';

// Colors to cycle through for variety
const colors = [
  { bg: '1a1a1a', fg: '7FD02B' },  // dark + green (brand)
  { bg: '0d3b66', fg: 'ffffff' },  // navy + white
  { bg: '2d3436', fg: 'dfe6e9' },  // charcoal + light
  { bg: '1b4332', fg: 'b7e4c7' },  // forest + mint
  { bg: '3c1642', fg: 'f9c80e' },  // purple + yellow
  { bg: '0b3954', fg: 'ff6663' },  // teal + coral
];

const needed = [
  { file: 'blog-financing-your-roof.jpg', text: 'Roof Financing Options' },
  { file: 'blog-gutter-guards-worth-it.jpg', text: 'Gutter Guards Guide' },
  { file: 'blog-hail-damage-what-to-look-for.png', text: 'Spotting Hail Damage' },
  { file: 'blog-ice-dams-roof-warning-sign.jpg', text: 'Ice Dams Warning Signs' },
  { file: 'blog-iko-roofpro-difference.jpg', text: 'IKO RoofPro Difference' },
  { file: 'blog-metal-roofing-for-huntsville-homes.jpg', text: 'Metal Roofing Guide' },
  { file: 'blog-navigating-spring-storm-season-in-alabama.png', text: 'Spring Storm Season' },
  { file: 'blog-repair-vs-replacement.jpg', text: 'Repair vs Replace' },
  { file: 'blog-roof-replacement-process.png', text: 'Roof Replacement Process' },
  { file: 'blog-roofing-and-home-value.jpg', text: 'Roofing & Home Value' },
  { file: 'blog-roofing-myths.jpg', text: 'Roofing Myths Debunked' },
  { file: 'blog-spring-2026-checklist.jpg', text: 'Spring Roof Checklist' },
  { file: 'blog-summer-roof-care.jpg', text: 'Summer Roof Care Tips' },
  { file: 'blog-the-importance-of-attic-ventilation.jpg', text: 'Attic Ventilation' },
  { file: 'blog-understanding-roofing-warranties.jpg', text: 'Roofing Warranties' },
  { file: 'blog-why-we-love-iko-dynasty-shingles.jpg', text: 'IKO Dynasty Shingles' },
  { file: 'blog-wind-damage.jpg', text: 'Wind Damage Assessment' },
  { file: 'blog-dark-streaks-on-roof.jpg', text: 'Roof Streaks & Algae' },
  { file: 'blog-hail-damage-assessment.jpg', text: 'Hail Damage Assessment' },
];

function download(url, outPath) {
  return new Promise((resolve, reject) => {
    const follow = (u, depth = 0) => {
      if (depth > 5) return reject(new Error('redirects'));
      https.get(u, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          return follow(res.headers.location, depth + 1);
        }
        const chunks = [];
        res.on('data', c => chunks.push(c));
        res.on('end', () => {
          fs.writeFileSync(outPath, Buffer.concat(chunks));
          resolve();
        });
      }).on('error', reject);
    };
    follow(url);
  });
}

async function main() {
  for (let i = 0; i < needed.length; i++) {
    const item = needed[i];
    const c = colors[i % colors.length];
    const text = encodeURIComponent(item.text);
    const url = `https://placehold.co/1200x630/${c.bg}/${c.fg}/png?text=${text}&font=montserrat`;
    const outPath = path.join(outputDir, item.file);
    
    try {
      await download(url, outPath);
      const size = fs.statSync(outPath).size;
      console.log(`OK: ${item.file} (${Math.round(size/1024)}KB)`);
    } catch (err) {
      console.log(`FAIL: ${item.file} - ${err.message}`);
    }
    await new Promise(r => setTimeout(r, 300));
  }
  console.log('\nDone! These are branded placeholders - replace with real photos when available.');
}

main();
