import http from 'http';

function fetch(url, headers = {}) {
  return new Promise((resolve, reject) => {
    http.get(url, { headers }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

async function main() {
  const html = await fetch('http://localhost:3000/');
  
  // Extract all __next_f.push data and concatenate
  const pushes = [];
  const pushRegex = /self\.__next_f\.push\(\[(\d+),"((?:[^"\\]|\\.)*)"\]\)/g;
  let m;
  while ((m = pushRegex.exec(html)) !== null) {
    if (m[1] === '1') {
      // Unescape the string
      const unescaped = m[2].replace(/\\n/g, '\n').replace(/\\"/g, '"').replace(/\\\\/g, '\\');
      pushes.push(unescaped);
    }
  }
  
  const fullData = pushes.join('');
  
  // Find all I[ references
  const iRegex = /([0-9a-f]+):I\["([^"]+)",\["([^"]+)","([^"]+)"\],"([^"]*)"\]/g;
  const refs = [];
  while ((m = iRegex.exec(fullData)) !== null) {
    refs.push({
      id: m[1],
      module: m[2],
      chunkName: m[3],
      chunkFile: m[4],
      export: m[5],
    });
  }
  
  console.log(`Found ${refs.length} client module references in HTML:\n`);
  
  const chunkModules = {};
  for (const ref of refs) {
    const shortMod = ref.module.replace('(app-pages-browser)/./', '');
    console.log(`  [${ref.id}] ${ref.export || 'default'} from ${shortMod}`);
    console.log(`       chunk: ${ref.chunkFile}`);
    
    if (!chunkModules[ref.chunkFile]) chunkModules[ref.chunkFile] = [];
    chunkModules[ref.chunkFile].push({ module: ref.module, shortMod });
  }
  
  console.log('\n--- Verifying chunks ---');
  for (const [chunkFile, modules] of Object.entries(chunkModules)) {
    try {
      const chunk = await fetch(`http://localhost:3000/_next/${chunkFile}`);
      if (chunk.startsWith('<!DOCTYPE') || chunk.startsWith('<html') || chunk.length < 100) {
        console.log(`  ❌ ${chunkFile} - MISSING or invalid (${chunk.length} bytes)`);
        continue;
      }
      const missing = [];
      for (const {module, shortMod} of modules) {
        if (!chunk.includes(module)) {
          missing.push(shortMod);
        }
      }
      if (missing.length > 0) {
        console.log(`  ⚠️  ${chunkFile} - MISSING modules:`);
        missing.forEach(m => console.log(`       - ${m}`));
      } else {
        console.log(`  ✅ ${chunkFile} - all ${modules.length} modules found`);
      }
    } catch(e) {
      console.log(`  ❌ ${chunkFile} - ${e.message}`);
    }
  }
}

main().catch(console.error);
