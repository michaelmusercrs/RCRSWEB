const http = require('http');

const endpoints = [
  '/api/health',
  '/api/portal/competition',
  '/api/portal/profile', 
  '/api/portal/blog',
  '/api/portal/response-times',
];

async function test(path) {
  return new Promise((resolve) => {
    const opts = {
      hostname: 'localhost',
      port: 3777,
      path,
      headers: { Cookie: 'access_token=test' },
      timeout: 10000
    };
    const req = http.get(opts, (r) => {
      let d = '';
      r.on('data', (c) => d += c);
      r.on('end', () => resolve(`${path} => ${r.statusCode} ${d.substring(0, 200)}`));
    });
    req.on('error', (e) => resolve(`${path} => ERR ${e.message}`));
    req.on('timeout', () => { req.destroy(); resolve(`${path} => TIMEOUT`); });
  });
}

(async () => {
  for (const ep of endpoints) {
    console.log(await test(ep));
  }
})();
