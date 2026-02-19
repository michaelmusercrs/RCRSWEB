const http = require('http');

function req(method, path, cookie, body) {
  return new Promise((resolve) => {
    const data = body ? JSON.stringify(body) : null;
    const opts = {
      hostname: 'localhost', port: 3777, path, method,
      headers: { Cookie: cookie, 'Content-Type': 'application/json' },
      timeout: 15000
    };
    if (data) opts.headers['Content-Length'] = Buffer.byteLength(data);
    const r = http.request(opts, (res) => {
      let d = '';
      res.on('data', (c) => d += c);
      res.on('end', () => resolve(`${res.statusCode} ${d.substring(0, 400)}`));
    });
    r.on('error', (e) => resolve(`ERR ${e.message}`));
    if (data) r.write(data);
    r.end();
  });
}

function login(pin) {
  return new Promise((resolve) => {
    const data = JSON.stringify({ action: 'login-pin', pin });
    const opts = {
      hostname: 'localhost', port: 3777, path: '/api/portal/auth', method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) }
    };
    const r = http.request(opts, (res) => {
      let d = '';
      res.on('data', (c) => d += c);
      res.on('end', () => {
        const cookies = (res.headers['set-cookie'] || []).map(c => c.split(';')[0]).join('; ');
        resolve(cookies);
      });
    });
    r.write(data);
    r.end();
  });
}

(async () => {
  const cookie = await login('1135'); // Michael - owner
  
  // Response times
  console.log('=== RESPONSE TIMES ===');
  console.log('/api/analytics/response-times =>', await req('GET', '/api/analytics/response-times', cookie));
  console.log('/api/admin/response-times =>', await req('GET', '/api/admin/response-times', cookie));
  
  // Profile editing - test submit for approval
  console.log('\n=== PROFILE EDITING ===');
  console.log('GET profile =>', await req('GET', '/api/portal/profile', cookie));
  console.log('PUT profile =>', await req('PUT', '/api/portal/profile', cookie, { bio: 'Testing profile edit submission' }));
  
  // Blog
  console.log('\n=== BLOG ===');
  console.log('GET blog =>', await req('GET', '/api/portal/blog', cookie));
  
  // Competition  
  console.log('\n=== COMPETITION ===');
  console.log('GET competition =>', await req('GET', '/api/command-center/competition', cookie));
  
  // Profile approval endpoints
  console.log('\n=== PROFILE APPROVAL ===');
  console.log('GET pending =>', await req('GET', '/api/portal/profile/pending', cookie));
  console.log('GET approve =>', await req('GET', '/api/admin/profile-approvals', cookie));
})();
