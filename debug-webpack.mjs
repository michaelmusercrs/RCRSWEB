// Fetch the page and find which chunk is failing
import http from 'http';

function fetch(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

async function main() {
  const html = await fetch('http://localhost:3000/');
  
  // Find all script tags
  const scriptSrcs = html.match(/src="([^"]*\/_next\/[^"]*)"/g) || [];
  console.log('Script sources:', scriptSrcs.length);
  
  // Find the webpack chunk
  for (const src of scriptSrcs) {
    const url = src.match(/src="([^"]*)"/)[1];
    if (url.includes('webpack')) {
      console.log('\nWebpack chunk:', url);
      const content = await fetch('http://localhost:3000' + url);
      
      // Find line 715 area
      const lines = content.split('\n');
      console.log('Total lines:', lines.length);
      
      // Find the options.factory line
      for (let i = 710; i < 720 && i < lines.length; i++) {
        console.log(`Line ${i+1}: ${lines[i].substring(0, 120)}`);
      }
    }
  }
  
  // Now check the page-specific chunk
  // Find the main-app chunk
  for (const src of scriptSrcs) {
    const url = src.match(/src="([^"]*)"/)[1];
    if (url.includes('main-app')) {
      console.log('\nMain app chunk:', url);
    }
  }
}

main().catch(console.error);
