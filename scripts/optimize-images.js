const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const PUBLIC_DIR = path.join(__dirname, '..', 'public');
const SIZE_THRESHOLD = 200 * 1024;
const MAX_WIDTH = 2000;
const QUALITY = 80;
const IMAGE_EXTS = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];

function findImages(dir) {
  const results = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) results.push(...findImages(full));
    else if (IMAGE_EXTS.includes(path.extname(entry.name).toLowerCase())) {
      results.push(full);
    }
  }
  return results;
}

async function optimize() {
  const images = findImages(PUBLIC_DIR);
  const large = images.filter(f => fs.statSync(f).size > SIZE_THRESHOLD);
  
  console.log(`Found ${images.length} images, ${large.length} over 200KB\n`);
  
  let totalSaved = 0;
  const results = [];

  for (const file of large) {
    const ext = path.extname(file).toLowerCase();
    const origSize = fs.statSync(file).size;
    if (ext === '.svg') continue;
    
    try {
      // Read file into buffer first to avoid lock issues
      const inputBuf = fs.readFileSync(file);
      const meta = await sharp(inputBuf).metadata();
      
      const needsResize = meta.width > MAX_WIDTH;
      
      if (ext === '.webp') {
        let pipeline = sharp(inputBuf);
        if (needsResize) pipeline = pipeline.resize({ width: MAX_WIDTH, withoutEnlargement: true });
        const buf = await pipeline.webp({ quality: QUALITY }).toBuffer();
        if (buf.length < origSize) {
          fs.writeFileSync(file, buf);
          const saved = origSize - buf.length;
          totalSaved += saved;
          results.push({ file: path.relative(PUBLIC_DIR, file), origSize, newSize: buf.length, saved });
        } else {
          results.push({ file: path.relative(PUBLIC_DIR, file), origSize, newSize: origSize, saved: 0, note: 'already optimal' });
        }
      } else {
        // Optimize original in place
        let origPipeline = sharp(inputBuf);
        if (needsResize) origPipeline = origPipeline.resize({ width: MAX_WIDTH, withoutEnlargement: true });
        
        let origBuf;
        if (ext === '.png') {
          origBuf = await origPipeline.png({ compressionLevel: 9 }).toBuffer();
        } else {
          origBuf = await origPipeline.jpeg({ quality: QUALITY, mozjpeg: true }).toBuffer();
        }
        
        // Create webp version
        let webpPipeline = sharp(inputBuf);
        if (needsResize) webpPipeline = webpPipeline.resize({ width: MAX_WIDTH, withoutEnlargement: true });
        const webpBuf = await webpPipeline.webp({ quality: QUALITY }).toBuffer();
        
        // Write optimized original if smaller
        if (origBuf.length < origSize) {
          fs.writeFileSync(file, origBuf);
        }
        const newOrigSize = origBuf.length < origSize ? origBuf.length : origSize;
        
        // Write webp alongside
        const webpPath = file.replace(/\.(jpg|jpeg|png|gif)$/i, '.webp');
        // Don't overwrite if existing webp is already smaller
        const existingWebp = fs.existsSync(webpPath) ? fs.statSync(webpPath).size : Infinity;
        if (webpBuf.length < Math.min(existingWebp, origSize)) {
          fs.writeFileSync(webpPath, webpBuf);
        }
        
        const saved = origSize - newOrigSize;
        totalSaved += saved;
        results.push({ 
          file: path.relative(PUBLIC_DIR, file), 
          origSize, 
          newSize: newOrigSize, 
          saved,
          webpSize: webpBuf.length
        });
      }
    } catch (err) {
      console.error(`Error: ${path.relative(PUBLIC_DIR, file)}: ${err.message}`);
    }
  }

  console.log('=== RESULTS ===\n');
  for (const r of results) {
    const pct = r.origSize > 0 ? ((r.saved / r.origSize) * 100).toFixed(1) : '0';
    console.log(`${r.file}: ${(r.origSize/1024).toFixed(0)}KB → ${(r.newSize/1024).toFixed(0)}KB (${pct}% saved)${r.webpSize ? ` | WebP: ${(r.webpSize/1024).toFixed(0)}KB` : ''}${r.note ? ` [${r.note}]` : ''}`);
  }
  
  console.log(`\nTOTAL SAVED (originals): ${(totalSaved / 1024 / 1024).toFixed(2)} MB`);
}

optimize().catch(console.error);
