const https = require('https');
const fs = require('fs');
const path = require('path');

const outputDir = 'C:/Users/Michael/river-city-roofing/public/uploads';

const needed = [
  { file: 'blog-financing-your-roof.jpg', query: 'home+financing' },
  { file: 'blog-gutter-guards-worth-it.jpg', query: 'rain+gutter+house' },
  { file: 'blog-hail-damage-what-to-look-for.png', query: 'hail+storm+damage' },
  { file: 'blog-ice-dams-roof-warning-sign.jpg', query: 'icicles+roof+winter' },
  { file: 'blog-iko-roofpro-difference.jpg', query: 'roofer+installing+shingles' },
  { file: 'blog-metal-roofing-for-huntsville-homes.jpg', query: 'metal+roof+house' },
  { file: 'blog-navigating-spring-storm-season-in-alabama.png', query: 'thunderstorm+house' },
  { file: 'blog-repair-vs-replacement.jpg', query: 'old+roof+repair' },
  { file: 'blog-roof-replacement-process.png', query: 'roof+construction+workers' },
  { file: 'blog-roofing-and-home-value.jpg', query: 'beautiful+house+curb+appeal' },
  { file: 'blog-roofing-myths.jpg', query: 'roof+inspection+ladder' },
  { file: 'blog-spring-2026-checklist.jpg', query: 'spring+home+maintenance' },
  { file: 'blog-summer-roof-care.jpg', query: 'summer+heat+house' },
  { file: 'blog-the-importance-of-attic-ventilation.jpg', query: 'attic+ventilation' },
  { file: 'blog-understanding-roofing-warranties.jpg', query: 'warranty+document+signing' },
  { file: 'blog-why-we-love-iko-dynasty-shingles.jpg', query: 'architectural+shingles+roof' },
  { file: 'blog-wind-damage.jpg', query: 'wind+storm+damage+tree' },
  { file: 'blog-dark-streaks-on-roof.jpg', query: 'algae+streaks+roof' },
  { file: 'blog-hail-damage-assessment.jpg', query: 'roof+inspector+checking' },
];

// Use Pexels API (free)
const PEXELS_KEY = 'lJoJhYk7ELh3QCxVefJLMk0n8GKj0mhkA3nSoKgYPpVHbmqJOdaC5uMI';

function downloadFromPexels(query, filename) {
  return new Promise((resolve, reject) => {
    const searchUrl = `https://api.pexels.com/v1/search?query=${query}&per_page=3&orientation=landscape`;
    
    https.get(searchUrl, { headers: { Authorization: PEXELS_KEY } }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (!json.photos || json.photos.length === 0) {
            return reject(new Error(`No results for: ${query}`));
          }
          // Pick a random one from top 3
          const photo = json.photos[Math.floor(Math.random() * json.photos.length)];
          const imgUrl = photo.src.large2x || photo.src.large || photo.src.original;
          
          // Download the image
          https.get(imgUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (imgRes) => {
            if (imgRes.statusCode >= 300 && imgRes.statusCode < 400 && imgRes.headers.location) {
              https.get(imgRes.headers.location, (r2) => {
                const chunks = [];
                r2.on('data', c => chunks.push(c));
                r2.on('end', () => {
                  const buf = Buffer.concat(chunks);
                  fs.writeFileSync(path.join(outputDir, filename), buf);
                  console.log(`OK: ${filename} (${Math.round(buf.length/1024)}KB) - "${photo.alt || query}"`);
                  resolve();
                });
              });
              return;
            }
            const chunks = [];
            imgRes.on('data', c => chunks.push(c));
            imgRes.on('end', () => {
              const buf = Buffer.concat(chunks);
              fs.writeFileSync(path.join(outputDir, filename), buf);
              console.log(`OK: ${filename} (${Math.round(buf.length/1024)}KB) - "${photo.alt || query}"`);
              resolve();
            });
          }).on('error', reject);
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

async function main() {
  for (const item of needed) {
    try {
      await downloadFromPexels(item.query, item.file);
      await new Promise(r => setTimeout(r, 500));
    } catch (err) {
      console.log(`FAIL: ${item.file} - ${err.message}`);
    }
  }
  console.log('\nDone!');
}

main();
