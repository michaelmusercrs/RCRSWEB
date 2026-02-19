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
  // Fetch the full HTML to get the inline RSC data
  const html = await fetch('http://localhost:3000/');
  
  // Find embedded RSC data (usually in script tags with type="text/x-component" or inline)
  // Also check the __next_f push calls
  const pushCalls = html.match(/self\.__next_f\.push\(\[.*?\]\)/gs) || [];
  console.log('Found', pushCalls.length, 'RSC push calls');
  
  // Extract all module references from the pushes
  for (const push of pushCalls) {
    if (push.includes('"chunks"') || push.includes(':I[')) {
      // Decode the string content
      const content = push.substring(0, 500);
      console.log(content);
      console.log('---');
    }
  }
  
  // Also check for all chunk file references
  const chunkRefs = html.match(/static\/chunks\/[^"'\s]+/g) || [];
  const uniqueChunks = [...new Set(chunkRefs)];
  console.log('\nReferenced chunks:', uniqueChunks.length);
  for (const c of uniqueChunks) {
    console.log(' ', c);
  }
}

main().catch(console.error);
