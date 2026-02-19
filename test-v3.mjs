import http from 'http';
const PORT = 3001;
function req(m,p,b,c){return new Promise((res,rej)=>{const o={hostname:'localhost',port:PORT,path:p,method:m,headers:{}};if(b)o.headers['Content-Type']='application/json';if(c)o.headers['Cookie']=c;const r=http.request(o,s=>{let d='';s.on('data',x=>d+=x);s.on('end',()=>res({status:s.statusCode,headers:s.headers,body:d}))});r.setTimeout(120000,()=>{r.destroy();rej(new Error('timeout'))});r.on('error',rej);if(b)r.write(JSON.stringify(b));r.end()})}

async function login(pin) {
  const l = await req('POST', '/api/auth/pin', { pin });
  const ck = (l.headers['set-cookie'] || []).map(c => c.split(';')[0]).join('; ');
  return { status: l.status, cookies: ck };
}

async function main() {
  // Admin login
  const admin = await login('1135');
  console.log('Admin login:', admin.status);
  if (admin.status !== 200) { console.log('FAIL'); return; }

  // Command center endpoints
  console.log('\n=== COMMAND CENTER ===');
  for (const ep of ['stats','sales','team','financial?action=summary','trends','calls','insights','agents']) {
    const r = await req('GET', `/api/command-center/${ep}`, null, admin.cookies);
    const ok = r.status === 200 && !r.body.startsWith('<!');
    console.log(`  ${ep}: ${r.status} ${ok ? '✓' : '✗'}`);
  }

  // Response times (30 days to avoid timeout)
  console.log('\n=== RESPONSE TIMES (30d) ===');
  const rt = await req('GET', '/api/admin/response-times?days=30', null, admin.cookies);
  console.log('Status:', rt.status);
  try {
    const d = JSON.parse(rt.body);
    if (d.data?.repAverages) {
      for (const r of d.data.repAverages) console.log(`  ${r.repName}: avg=${r.avgMinutes}min grade=${r.grade} leads=${r.totalLeads}`);
      console.log('  Summary:', JSON.stringify(d.data.summary));
    } else console.log('  Body:', rt.body.slice(0,200));
  } catch { console.log('  Not JSON:', rt.body.slice(0,200)); }

  // Aaron login + profile
  console.log('\n=== PROFILE SYSTEM ===');
  const aaron = await login('2020');
  console.log('Aaron login:', aaron.status);
  if (aaron.status === 200) {
    const p = await req('GET', '/api/portal/profile', null, aaron.cookies);
    console.log('GET profile:', p.status, p.body.slice(0,200));
    const edit = await req('POST', '/api/profile/submit-edit', {field:'phone',value:'555-0123',reason:'test'}, aaron.cookies);
    console.log('Submit edit:', edit.status, edit.body.slice(0,200));
  }

  // Admin pending
  const pending = await req('GET', '/api/profile/pending', null, admin.cookies);
  console.log('Pending:', pending.status, pending.body.slice(0,200));

  // Approve endpoint check
  const approve = await req('POST', '/api/profile/approve', {editId:'test-123'}, admin.cookies);
  console.log('Approve:', approve.status, approve.body.slice(0,200));
}

main().catch(e => console.error('ERR:', e.message));
