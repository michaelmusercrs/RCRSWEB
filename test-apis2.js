const http = require('http');

function post(path, body) {
  return new Promise((resolve) => {
    const data = JSON.stringify(body);
    const opts = {
      hostname: 'localhost', port: 3777, path, method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': data.length },
      timeout: 10000
    };
    const req = http.request(opts, (r) => {
      let d = '';
      const cookies = r.headers['set-cookie'] || [];
      r.on('data', (c) => d += c);
      r.on('end', () => resolve({ status: r.statusCode, body: d, cookies }));
    });
    req.on('error', (e) => resolve({ status: 'ERR', body: e.message }));
    req.write(data);
    req.end();
  });
}

function get(path, cookie) {
  return new Promise((resolve) => {
    const opts = {
      hostname: 'localhost', port: 3777, path,
      headers: { Cookie: cookie },
      timeout: 10000
    };
    const req = http.get(opts, (r) => {
      let d = '';
      r.on('data', (c) => d += c);
      r.on('end', () => resolve(`${r.statusCode} ${d.substring(0, 300)}`));
    });
    req.on('error', (e) => resolve(`ERR ${e.message}`));
  });
}

(async () => {
  // Login as Michael (owner, PIN 1135)
  const login = await post('/api/portal/auth', { action: 'login-pin', pin: '1135' });
  console.log('LOGIN:', login.status);
  const cookie = login.cookies.map(c => c.split(';')[0]).join('; ');
  console.log('COOKIE:', cookie.substring(0, 80));
  
  const endpoints = [
    '/api/portal/competition',
    '/api/portal/profile',
    '/api/portal/blog',
    '/api/portal/response-times',
    '/api/meetings/competition',
    '/api/command-center/competition',
    '/api/portal/competition-tracking',
  ];
  
  for (const ep of endpoints) {
    console.log(`${ep} =>`, await get(ep, cookie));
  }
})();
