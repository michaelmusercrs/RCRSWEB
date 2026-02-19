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
  // Fetch the RSC payload
  const rscPayload = await fetch('http://localhost:3000/', {
    'RSC': '1',
    'Next-Router-State-Tree': '%5B%22%22%2C%7B%7D%5D',
  });
  
  // Look for module references (they start with "I" in the flight format)
  const lines = rscPayload.split('\n');
  for (const line of lines) {
    // Module references contain "chunks" and module paths
    if (line.includes('"chunks"') || line.includes('webpack')) {
      console.log(line.substring(0, 300));
    }
  }
  
  // Also look for all client references
  console.log('\n--- Client References ---');
  for (const line of lines) {
    if (line.startsWith('I:') || line.match(/^[0-9a-f]+:I/)) {
      console.log(line.substring(0, 300));
    }
  }
}

main().catch(console.error);
