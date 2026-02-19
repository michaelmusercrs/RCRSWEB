import http from 'http';
function req(m,p,b,c){return new Promise((res,rej)=>{const o={hostname:'localhost',port:3001,path:p,method:m,headers:{}};if(b)o.headers['Content-Type']='application/json';if(c)o.headers['Cookie']=c;const r=http.request(o,s=>{let d='';s.on('data',x=>d+=x);s.on('end',()=>res({status:s.statusCode,headers:s.headers,body:d}))});r.setTimeout(60000,()=>{r.destroy();rej(new Error('timeout'))});r.on('error',rej);if(b)r.write(JSON.stringify(b));r.end()})}

async function login(pin) {
  const l = await req('POST', '/api/auth/pin', { pin });
  const ck = (l.headers['set-cookie'] || []).map(c => c.split(';')[0]).join('; ');
  return { status: l.status, cookies: ck };
}

async function main() {
  // Test 1: Response times with 30 days
  console.log('=== Response Times (30 days) ===');
  const admin = await login('1135');
  console.log('Admin login:', admin.status);
  const rt = await req('GET', '/api/admin/response-times?days=30', null, admin.cookies);
  let rtData; try { rtData = JSON.parse(rt.body); } catch { rtData = null; }
  console.log('RT status:', rt.status);
  if (rtData?.data?.repAverages) {
    for (const r of rtData.data.repAverages) {
      console.log(`  ${r.repName}: avg=${r.avgMinutes}min grade=${r.grade} leads=${r.totalLeads}`);
    }
    console.log('Summary:', JSON.stringify(rtData.data.summary));
  } else {
    console.log('RT body:', rt.body.slice(0, 300));
  }

  // Test 2: Aaron login + profile
  console.log('\n=== Aaron Profile ===');
  const aaron = await login('2020');
  console.log('Aaron login:', aaron.status);
  if (aaron.status === 200) {
    const p = await req('GET', '/api/portal/profile', null, aaron.cookies);
    console.log('Profile:', p.status, p.body.slice(0, 300));
    
    // Submit edit
    const edit = await req('POST', '/api/profile/submit-edit', 
      { field: 'phone', value: '555-0123', reason: 'test' }, aaron.cookies);
    console.log('Submit edit:', edit.status, edit.body.slice(0, 300));
  }

  // Test 3: Admin pending
  console.log('\n=== Admin Pending ===');
  const admin2 = await login('1135');
  const pending = await req('GET', '/api/profile/pending', null, admin2.cookies);
  console.log('Pending:', pending.status, pending.body.slice(0, 300));
}

main().catch(e => console.error('ERR:', e.message));
