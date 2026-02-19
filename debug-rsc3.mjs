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
  // Get RSC flight data directly
  const rsc = await fetch('http://localhost:3000/', {
    'RSC': '1',
    'Next-Router-State-Tree': encodeURIComponent('["",{}]'),
  });
  
  // Parse module references - format: ID:I["moduleId",["chunkName","chunkFile"],"export"]
  const lines = rsc.split('\n');
  const refs = [];
  for (const line of lines) {
    const match = line.match(/^([0-9a-f]+):I\[(.+)\]$/);
    if (match) {
      try {
        const parsed = JSON.parse('[' + match[2] + ']');
        refs.push({
          id: match[1],
          module: parsed[0],
          chunk: parsed[1],
          export: parsed[2],
        });
      } catch(e) {}
    }
  }
  
  console.log(`Found ${refs.length} client module references:\n`);
  
  const chunkModules = {};
  for (const ref of refs) {
    const shortMod = ref.module.replace('(app-pages-browser)/./', '');
    console.log(`  [${ref.id}] ${ref.export || 'default'} from ${shortMod}`);
    console.log(`       → chunk: ${ref.chunk[1]}`);
    
    const chunkFile = ref.chunk[1];
    if (!chunkModules[chunkFile]) chunkModules[chunkFile] = [];
    chunkModules[chunkFile].push({ module: ref.module, shortMod });
  }
  
  console.log('\nVerifying chunks contain their modules...');
  for (const [chunkFile, modules] of Object.entries(chunkModules)) {
    try {
      const chunk = await fetch(`http://localhost:3000/_next/${chunkFile}`);
      if (chunk.startsWith('<!DOCTYPE') || chunk.startsWith('<html')) {
        console.log(`  ❌ ${chunkFile} - 404`);
        continue;
      }
      for (const {module, shortMod} of modules) {
        // The module ID in the chunk would be the full path
        if (!chunk.includes(module)) {
          console.log(`  ⚠️  "${shortMod}" NOT in ${chunkFile}`);
        }
      }
      console.log(`  ✅ ${chunkFile} OK`);
    } catch(e) {
      console.log(`  ❌ ${chunkFile} - ${e.message}`);
    }
  }
}

main().catch(console.error);
