import http from 'http';

function req(method, path, body, cookies) {
  return new Promise((resolve, reject) => {
    const opts = { hostname: 'localhost', port: 3001, path, method, headers: {} };
    if (body) opts.headers['Content-Type'] = 'application/json';
    if (cookies) opts.headers['Cookie'] = cookies;
    const r = http.request(opts, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: d }));
    });
    r.on('error', reject);
    if (body) r.write(JSON.stringify(body));
    r.end();
  });
}

async function login(pin) {
  const l = await req('POST', '/api/auth/pin', { pin });
  const ck = (l.headers['set-cookie'] || []).map(c => c.split(';')[0]).join('; ');
  let body; try { body = JSON.parse(l.body); } catch { body = { _raw: l.body.slice(0,200) }; }
  return { status: l.status, cookies: ck, body };
}

async function main() {
  // Admin login
  console.log('=== ADMIN LOGIN (1135) ===');
  const admin = await login('1135');
  console.log('Status:', admin.status);
  console.log('Cookies:', admin.cookies.slice(0, 100) + '...');

  if (admin.status !== 200) {
    console.log('LOGIN FAILED:', admin.body);
    return;
  }

  // Test command center endpoints
  console.log('\n=== COMMAND CENTER ENDPOINTS ===');
  const ccEndpoints = ['stats', 'sales', 'team', 'financial?action=summary', 'trends', 'calls', 'insights', 'agents'];
  for (const ep of ccEndpoints) {
    const r = await req('GET', `/api/command-center/${ep}`, null, admin.cookies);
    let b;
    try { b = JSON.parse(r.body); } catch { b = { _html: true }; }
    console.log(`/api/command-center/${ep} → ${r.status} ${b._html ? 'HTML!' : b.success !== undefined ? (b.success ? '✓' : '✗ ' + b.error) : (r.status === 200 ? '✓' : '✗')} ${r.body.slice(0,80)}`);
  }

  // Response times
  console.log('\n=== RESPONSE TIMES ===');
  const rt = await req('GET', '/api/admin/response-times', null, admin.cookies);
  let rtData; try { rtData = JSON.parse(rt.body); } catch { rtData = {}; }
  console.log(`Status: ${rt.status}`);
  if (rtData.success && rtData.data?.repAverages) {
    for (const rep of rtData.data.repAverages.slice(0, 5)) {
      console.log(`  ${rep.repName}: ${rep.avgMinutes?.toFixed(0)}min avg, grade=${rep.grade || 'N/A'}`);
    }
  }

  // Profile as sales rep
  console.log('\n=== SALES REP LOGIN (2020 - Aaron) ===');
  const aaron = await login('2020');
  console.log('Status:', aaron.status);
  
  if (aaron.status === 200) {
    const profile = await req('GET', '/api/portal/profile', null, aaron.cookies);
    console.log(`GET /api/portal/profile → ${profile.status}`);
    console.log('Body:', profile.body.slice(0, 200));

    // Submit edit
    const edit = await req('POST', '/api/profile/submit-edit', { field: 'phone', value: '555-1234' }, aaron.cookies);
    console.log(`POST /api/profile/submit-edit → ${edit.status} ${edit.body.slice(0, 200)}`);
  }

  // Pending edits as admin
  console.log('\n=== PROFILE PENDING (admin) ===');
  const pending = await req('GET', '/api/profile/pending', null, admin.cookies);
  console.log(`GET /api/profile/pending → ${pending.status}`);
  console.log('Body:', pending.body.slice(0, 300));
}

main().catch(e => console.error(e));
