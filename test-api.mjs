// Test script for lead distribution API
const BASE = 'http://localhost:3001';

async function test() {
  // 1. Auth
  console.log('=== AUTH ===');
  const authRes = await fetch(`${BASE}/api/portal/auth`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'login-pin', pin: '1135' }),
  });
  const authData = await authRes.json();
  console.log(JSON.stringify(authData, null, 2));
  const cookies = authRes.headers.getSetCookie?.() || [];
  const cookieStr = cookies.map(c => c.split(';')[0]).join('; ');
  console.log('Cookies:', cookieStr);

  // 2. Check geocoded contacts
  console.log('\n=== GEOCODED CONTACTS COUNT ===');
  const geoRes = await fetch(`${BASE}/api/admin/populate-geocoded`, {
    headers: { Cookie: cookieStr },
  });
  const geoData = await geoRes.json();
  console.log(JSON.stringify(geoData, null, 2));

  // 3. Test distribute
  console.log('\n=== DISTRIBUTE ===');
  const distRes = await fetch(`${BASE}/api/leads/distribute`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: cookieStr },
    body: JSON.stringify({
      address: '123 Main St, Decatur, AL 35601',
      customerName: 'Test Customer',
      source: 'phone_call',
    }),
  });
  const distData = await distRes.json();
  console.log(JSON.stringify(distData, null, 2));

  // 4. Test config
  console.log('\n=== CONFIG ===');
  const cfgRes = await fetch(`${BASE}/api/leads/config`, {
    headers: { Cookie: cookieStr },
  });
  const cfgData = await cfgRes.json();
  console.log(JSON.stringify(cfgData, null, 2));

  // 5. Test metrics
  console.log('\n=== METRICS ===');
  const metRes = await fetch(`${BASE}/api/leads/metrics`, {
    headers: { Cookie: cookieStr },
  });
  const metData = await metRes.json();
  console.log(JSON.stringify(metData, null, 2));
}

test().catch(err => console.error('ERROR:', err));
