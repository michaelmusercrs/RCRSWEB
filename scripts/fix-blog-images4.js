const https = require('https');
const fs = require('fs');
const path = require('path');

const outputDir = 'C:/Users/Michael/river-city-roofing/public/uploads';

// Pixabay free API - no key needed for small usage
const needed = [
  { file: 'blog-financing-your-roof.jpg', q: 'house+money+finance' },
  { file: 'blog-gutter-guards-worth-it.jpg', q: 'rain+gutter+roof' },
  { file: 'blog-hail-damage-what-to-look-for.png', q: 'hail+storm+roof' },
  { file: 'blog-ice-dams-roof-warning-sign.jpg', q: 'ice+roof+winter' },
  { file: 'blog-iko-roofpro-difference.jpg', q: 'roofer+work+shingles' },
  { file: 'blog-metal-roofing-for-huntsville-homes.jpg', q: 'metal+roof+modern+house' },
  { file: 'blog-navigating-spring-storm-season-in-alabama.png', q: 'thunderstorm+lightning+house' },
  { file: 'blog-repair-vs-replacement.jpg', q: 'old+roof+damaged' },
  { file: 'blog-roof-replacement-process.png', q: 'roof+construction+building' },
  { file: 'blog-roofing-and-home-value.jpg', q: 'beautiful+house+exterior' },
  { file: 'blog-roofing-myths.jpg', q: 'question+mark+house' },
  { file: 'blog-spring-2026-checklist.jpg', q: 'spring+house+garden' },
  { file: 'blog-summer-roof-care.jpg', q: 'summer+sun+hot+house' },
  { file: 'blog-the-importance-of-attic-ventilation.jpg', q: 'attic+ventilation+roof' },
  { file: 'blog-understanding-roofing-warranties.jpg', q: 'contract+document+signing' },
  { file: 'blog-why-we-love-iko-dynasty-shingles.jpg', q: 'roof+shingles+close' },
  { file: 'blog-wind-damage.jpg', q: 'storm+wind+tree+damage' },
  { file: 'blog-dark-streaks-on-roof.jpg', q: 'dirty+roof+moss+algae' },
  { file: 'blog-hail-damage-assessment.jpg', q: 'inspector+roof+checking' },
];

const PIXABAY_KEY = '46204513-4d8fc4f8ac8d9bc78e62f40ed'; // Free tier key

function fetchImage(query, filename, idx) {
  return new Promise((resolve, reject) => {
    // Use idx to pick different image from results for uniqueness
    const pickIdx = idx % 3;
    const url = `https://pixabay.com/api/?key=${PIXABAY_KEY}&q=${encodeURIComponent(query)}&image_type=photo&orientation=horizontal&min_width=1200&per_page=5`;
    
    https.get(url, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (!json.hits || json.hits.length === 0) {
            return reject(new Error(`No results for: ${query}`));
          }
          const hit = json.hits[Math.min(pickIdx, json.hits.length - 1)];
          const imgUrl = hit.largeImageURL || hit.webformatURL;
          
          // Download
          https.get(imgUrl, (imgRes) => {
            if (imgRes.statusCode >= 300 && imgRes.statusCode < 400 && imgRes.headers.location) {
              https.get(imgRes.headers.location, (r2) => {
                const chunks = [];
                r2.on('data', c => chunks.push(c));
                r2.on('end', () => {
                  const buf = Buffer.concat(chunks);
                  fs.writeFileSync(path.join(outputDir, filename), buf);
                  console.log(`OK: ${filename} (${Math.round(buf.length/1024)}KB)`);
                  resolve();
                });
              }).on('error', reject);
              return;
            }
            const chunks = [];
            imgRes.on('data', c => chunks.push(c));
            imgRes.on('end', () => {
              const buf = Buffer.concat(chunks);
              fs.writeFileSync(path.join(outputDir, filename), buf);
              console.log(`OK: ${filename} (${Math.round(buf.length/1024)}KB)`);
              resolve();
            });
          }).on('error', reject);
        } catch (e) { reject(e); }
      });
    }).on('error', reject);
  });
}

async function main() {
  for (let i = 0; i < needed.length; i++) {
    try {
      await fetchImage(needed[i].q, needed[i].file, i);
      await new Promise(r => setTimeout(r, 500));
    } catch (err) {
      console.log(`FAIL: ${needed[i].file} - ${err.message}`);
    }
  }
  console.log('\nDone!');
}

main();
