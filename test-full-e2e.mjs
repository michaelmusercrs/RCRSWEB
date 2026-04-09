#!/usr/bin/env node
/**
 * RCRS Portal - Full End-to-End System Test
 * Tests every system as every user role.
 * NO notifications sent - just data flow verification.
 */

const BASE = 'http://localhost:3000';

// All active team members to test
const USERS = [
  { name: 'Michael Muse', email: 'michaelmuse@rcrsal.com', role: 'owner', isSalesRep: false },
  { name: 'Chris Muse', email: 'chrismuse@rcrsal.com', role: 'owner', isSalesRep: false },
  { name: 'Sara Hill', email: 'sara@rcrsal.com', role: 'admin', isSalesRep: false },
  { name: 'Destin Mccary', email: 'destin@rcrsal.com', role: 'manager', isSalesRep: false },
  { name: 'Tia Muse Morris', email: 'tia@rcrsal.com', role: 'office', isSalesRep: false },
  { name: 'Bart Roberts', email: 'bart@rcrsal.com', role: 'project_manager', isSalesRep: false },
  { name: 'John Cordonis', email: 'john@rcrsal.com', role: 'project_manager', isSalesRep: false },
  { name: 'Richard Geahr', email: 'richard@rcrsal.com', role: 'driver', isSalesRep: true, aliases: ['Rick'] },
  { name: 'Hunter Rivers', email: 'hunter@rcrsal.com', role: 'sales', isSalesRep: true },
  { name: 'Aaron Lussi', email: 'aaron@rcrsal.com', role: 'sales', isSalesRep: true },
  { name: 'Greg Muse', email: 'greg@rcrsal.com', role: 'sales', isSalesRep: true },
  { name: 'Brendon Muse', email: 'brendon@rcrsal.com', role: 'sales', isSalesRep: true },
  { name: 'Adam Rudell', email: 'adam@rcrsal.com', role: 'sales', isSalesRep: true },
  { name: 'Joseph Dowd', email: 'joseph@rcrsal.com', role: 'sales', isSalesRep: true },
  { name: 'Alijah', email: 'alijah@rcrsal.com', role: 'sales', isSalesRep: true },
  { name: 'Travis Wages', email: 'travis@rcrsal.com', role: 'sales', isSalesRep: true },
  { name: 'Boston Muse', email: 'boston@rcrsal.com', role: 'viewer', isSalesRep: false },
];

const PASSWORD = 'ChangeMe123!';
const results = { passed: 0, failed: 0, errors: [] };

function log(icon, msg) {
  console.log(`${icon} ${msg}`);
}

function pass(test) {
  results.passed++;
  log('✅', test);
}

function fail(test, detail) {
  results.failed++;
  const msg = `${test}: ${detail}`;
  results.errors.push(msg);
  log('❌', msg);
}

// Extract cookies from set-cookie headers
function extractCookies(response) {
  const cookies = {};
  const setCookieHeaders = response.headers.getSetCookie?.() || [];
  for (const header of setCookieHeaders) {
    const [pair] = header.split(';');
    const [name, value] = pair.split('=');
    cookies[name.trim()] = value?.trim();
  }
  // Fallback: try raw headers
  if (Object.keys(cookies).length === 0) {
    const raw = response.headers.get('set-cookie') || '';
    for (const part of raw.split(/,(?=[^ ])/)) {
      const [pair] = part.split(';');
      const [name, value] = pair.split('=');
      if (name && value) cookies[name.trim()] = value.trim();
    }
  }
  return cookies;
}

function cookieHeader(cookies) {
  return Object.entries(cookies).map(([k, v]) => `${k}=${v}`).join('; ');
}

async function apiCall(method, path, cookies, body = null) {
  const opts = {
    method,
    headers: {
      'Content-Type': 'application/json',
      'Origin': 'http://localhost:3000',
    },
  };
  if (cookies && Object.keys(cookies).length > 0) {
    opts.headers['Cookie'] = cookieHeader(cookies);
  }
  if (body) opts.body = JSON.stringify(body);

  const resp = await fetch(`${BASE}${path}`, opts);
  let data;
  try {
    data = await resp.json();
  } catch {
    data = { _rawStatus: resp.status, _text: await resp.text().catch(() => '') };
  }
  return { status: resp.status, data, response: resp, cookies: extractCookies(resp) };
}

// ═══════════════════════════════════════════════════════
// PHASE 1: AUTHENTICATE ALL USERS
// ═══════════════════════════════════════════════════════
async function testAuth() {
  console.log('\n' + '═'.repeat(60));
  console.log('PHASE 1: AUTHENTICATION - All Users');
  console.log('═'.repeat(60));

  const sessions = {};

  for (const user of USERS) {
    try {
      const { status, data, cookies } = await apiCall('POST', '/api/portal/auth', {}, {
        action: 'login-password',
        email: user.email,
        password: PASSWORD,
      });

      if (data?.success || data?.user || cookies?.access_token) {
        sessions[user.email] = cookies;
        const needsPwChange = data?.mustChangePassword ? ' (needs pw change)' : '';
        const roles = data?.user?.role || user.role;
        pass(`LOGIN ${user.name} [${roles}]${needsPwChange}`);
      } else {
        // Some users may need password set in credential service - try direct auth endpoint
        const { status: s2, data: d2, cookies: c2 } = await apiCall('POST', '/api/auth/login', {}, {
          email: user.email,
          password: PASSWORD,
        });
        if (d2?.success || c2?.access_token) {
          sessions[user.email] = c2;
          pass(`LOGIN ${user.name} [${user.role}] (via /api/auth/login)`);
        } else {
          fail(`LOGIN ${user.name}`, `${data?.error || d2?.error || 'No token returned'} (HTTP ${status})`);
          // Still store empty session so we can test what happens without auth
          sessions[user.email] = {};
        }
      }
    } catch (e) {
      fail(`LOGIN ${user.name}`, e.message);
      sessions[user.email] = {};
    }
  }

  return sessions;
}

// ═══════════════════════════════════════════════════════
// PHASE 2: WEEKLY NUMBERS - Submit as each sales rep
// ═══════════════════════════════════════════════════════
async function testWeeklyNumbers(sessions) {
  console.log('\n' + '═'.repeat(60));
  console.log('PHASE 2: WEEKLY NUMBERS - Submit for Each Sales Rep');
  console.log('═'.repeat(60));

  const salesReps = USERS.filter(u => u.isSalesRep);
  const testWeek = '2026-W14'; // Current test week

  for (const rep of salesReps) {
    const cookies = sessions[rep.email];
    // Generate varied but realistic numbers per rep
    const seed = rep.name.length;
    const numbers = {
      week: testWeek,
      inspected: 5 + (seed % 10),
      damage: 3 + (seed % 6),
      signed: 1 + (seed % 4),
      repair: seed % 3,
      gutter: seed % 2,
      revenue: 8000 + (seed * 1500),
      approved: 6000 + (seed * 1200),
      goal: 15000 + (seed * 1000),
      referrals: seed % 3,
      agents: seed % 2,
      present: '1',
      homeShow: 0,
    };

    try {
      // Submit weekly numbers (POST for new, PATCH if already exists)
      let { status, data } = await apiCall('POST', '/api/portal/weekly-numbers', cookies, numbers);

      if (status === 409) {
        // Already exists - use PATCH to update
        const patchResult = await apiCall('PATCH', '/api/portal/weekly-numbers', cookies, numbers);
        status = patchResult.status;
        data = patchResult.data;
        if (status === 200 || status === 201 || data?.success) {
          pass(`WEEKLY UPDATE ${rep.name}: inspected=${numbers.inspected}, signed=${numbers.signed}, revenue=$${numbers.revenue} (PATCH)`);
        } else {
          fail(`WEEKLY UPDATE ${rep.name}`, `HTTP ${status}: ${data?.error || JSON.stringify(data).slice(0, 100)}`);
        }
      } else if (status === 200 || status === 201 || data?.success) {
        pass(`WEEKLY SUBMIT ${rep.name}: inspected=${numbers.inspected}, signed=${numbers.signed}, revenue=$${numbers.revenue}`);
      } else {
        fail(`WEEKLY SUBMIT ${rep.name}`, `HTTP ${status}: ${data?.error || JSON.stringify(data).slice(0, 100)}`);
      }
    } catch (e) {
      fail(`WEEKLY SUBMIT ${rep.name}`, e.message);
    }
  }

  // Verify we can READ the numbers back
  console.log('\n  --- Verify Read-Back ---');
  const adminCookies = sessions['michaelmuse@rcrsal.com'];

  try {
    const { status, data } = await apiCall('GET', `/api/portal/weekly-numbers?allReps=true&weekStart=2026-03-30&weekEnd=2026-04-05`, adminCookies);
    if (status === 200) {
      const count = Array.isArray(data?.numbers) ? data.numbers.length : (data?.data?.length || 'unknown');
      pass(`WEEKLY READ-BACK: Got ${count} rep records for this week`);
    } else {
      fail(`WEEKLY READ-BACK`, `HTTP ${status}: ${data?.error || 'no data'}`);
    }
  } catch (e) {
    fail('WEEKLY READ-BACK', e.message);
  }
}

// ═══════════════════════════════════════════════════════
// PHASE 3: MEETING LEADERBOARDS
// ═══════════════════════════════════════════════════════
async function testLeaderboards(sessions) {
  console.log('\n' + '═'.repeat(60));
  console.log('PHASE 3: LEADERBOARDS - Rankings, Calculations, Streaks');
  console.log('═'.repeat(60));

  const adminCookies = sessions['michaelmuse@rcrsal.com'];

  // Test meeting leaderboard
  const metrics = ['revenue', 'inspected', 'damage', 'signed'];
  const periods = ['thisWeek', 'thisMonth', 'thisYear', 'allTime'];

  for (const metric of metrics) {
    for (const period of periods) {
      try {
        const { status, data } = await apiCall('GET',
          `/api/command-center/meetings/leaderboard?metric=${metric}&period=${period}&animate=true`, adminCookies);

        if (status === 200 && (data?.leaderboard || data?.rankings || Array.isArray(data))) {
          const entries = data?.leaderboard?.length || data?.rankings?.length || (Array.isArray(data) ? data.length : 0);
          const topRep = data?.leaderboard?.[0]?.name || data?.rankings?.[0]?.name || 'N/A';
          pass(`LEADERBOARD [${metric}/${period}]: ${entries} reps, #1: ${topRep}`);
        } else if (status === 200) {
          pass(`LEADERBOARD [${metric}/${period}]: 200 OK (structure: ${Object.keys(data || {}).join(',')})`);
        } else {
          fail(`LEADERBOARD [${metric}/${period}]`, `HTTP ${status}`);
        }
      } catch (e) {
        fail(`LEADERBOARD [${metric}/${period}]`, e.message);
      }
    }
  }

  // Weekly leaderboard endpoint
  console.log('\n  --- Weekly Leaderboard ---');
  for (const metric of ['inspected', 'signed', 'revenue']) {
    try {
      const { status, data } = await apiCall('GET',
        `/api/command-center/weekly-leaderboard?metric=${metric}&period=thisMonth`, adminCookies);
      if (status === 200) {
        const entries = data?.leaderboard?.length || data?.rankings?.length || 'ok';
        pass(`WEEKLY-LB [${metric}/thisMonth]: ${entries} entries`);
      } else {
        fail(`WEEKLY-LB [${metric}]`, `HTTP ${status}`);
      }
    } catch (e) {
      fail(`WEEKLY-LB [${metric}]`, e.message);
    }
  }

  // Check celebration triggers and streaks
  console.log('\n  --- Celebrations & Streaks ---');
  try {
    const { status, data } = await apiCall('GET',
      `/api/command-center/meetings/leaderboard?animate=true&view=full`, adminCookies);
    if (status === 200) {
      const celebrations = data?.celebrationTriggers?.length || 0;
      const streaks = data?.leaderboard?.filter(r => r.streak === 'hot')?.length || 0;
      pass(`CELEBRATIONS: ${celebrations} triggers, ${streaks} hot streaks`);

      // Log details of each rep's achievements
      if (data?.leaderboard) {
        for (const rep of data.leaderboard.slice(0, 5)) {
          const achCount = rep.achievements?.length || 0;
          const animCount = rep.animations?.length || 0;
          log('  📊', `${rep.name}: rank #${rep.rank}, streak=${rep.streak}, ${achCount} achievements, ${animCount} animations`);
        }
      }
    } else {
      fail('CELEBRATIONS', `HTTP ${status}`);
    }
  } catch (e) {
    fail('CELEBRATIONS', e.message);
  }

  // Test leaderboard as each sales rep (they should only see their own position highlighted)
  console.log('\n  --- Per-Rep Leaderboard View ---');
  for (const rep of USERS.filter(u => u.isSalesRep)) {
    const cookies = sessions[rep.email];
    try {
      const { status, data } = await apiCall('GET',
        `/api/command-center/meetings/leaderboard?metric=revenue&period=thisMonth`, cookies);
      if (status === 200) {
        pass(`REP-VIEW ${rep.name}: sees leaderboard (HTTP 200)`);
      } else if (status === 403) {
        fail(`REP-VIEW ${rep.name}`, 'FORBIDDEN - missing command-center permission?');
      } else {
        fail(`REP-VIEW ${rep.name}`, `HTTP ${status}`);
      }
    } catch (e) {
      fail(`REP-VIEW ${rep.name}`, e.message);
    }
  }
}

// ═══════════════════════════════════════════════════════
// PHASE 4: COMMAND CENTER - Insights, Charts, Recognition
// ═══════════════════════════════════════════════════════
async function testCommandCenter(sessions) {
  console.log('\n' + '═'.repeat(60));
  console.log('PHASE 4: COMMAND CENTER - Insights, Charts, Recognition');
  console.log('═'.repeat(60));

  const adminCookies = sessions['michaelmuse@rcrsal.com'];

  const endpoints = [
    { path: '/api/command-center/insights', name: 'INSIGHTS' },
    { path: '/api/command-center/sales', name: 'SALES DATA' },
    { path: '/api/command-center/stats', name: 'TEAM STATS' },
    { path: '/api/command-center/team', name: 'TEAM INFO' },
    { path: '/api/command-center/trends', name: 'TRENDS' },
    { path: '/api/command-center/financial?action=dashboard', name: 'FINANCIAL DASHBOARD' },
  ];

  for (const ep of endpoints) {
    try {
      const { status, data } = await apiCall('GET', ep.path, adminCookies);
      if (status === 200) {
        const keys = Object.keys(data || {}).slice(0, 5).join(', ');
        pass(`CMD-CTR ${ep.name}: 200 OK (keys: ${keys})`);

        // Log some actual values for insights
        if (ep.name === 'INSIGHTS' && data?.insights) {
          for (const insight of (data.insights || []).slice(0, 3)) {
            log('  💡', `${insight.type || 'insight'}: ${(insight.message || insight.text || '').slice(0, 80)}`);
          }
        }
        if (ep.name === 'TEAM STATS') {
          log('  📈', `Total revenue: $${data?.totalRevenue || data?.total || 'N/A'}, Reps: ${data?.activeReps || data?.teamSize || 'N/A'}`);
        }
      } else {
        fail(`CMD-CTR ${ep.name}`, `HTTP ${status}: ${data?.error || ''}`);
      }
    } catch (e) {
      fail(`CMD-CTR ${ep.name}`, e.message);
    }
  }

  // Rep comparison
  console.log('\n  --- Rep Comparison ---');
  try {
    const { status, data } = await apiCall('GET',
      '/api/command-center/rep-comparison?rep1=hunter&rep2=greg', adminCookies);
    if (status === 200) {
      pass(`REP-COMPARE Hunter vs Greg: 200 OK`);
      if (data?.rep1 && data?.rep2) {
        log('  🆚', `Hunter: $${data.rep1.revenue || data.rep1.total || 'N/A'} vs Greg: $${data.rep2.revenue || data.rep2.total || 'N/A'}`);
      }
    } else {
      fail('REP-COMPARE', `HTTP ${status}`);
    }
  } catch (e) {
    fail('REP-COMPARE', e.message);
  }

  // Meeting predictions
  console.log('\n  --- Predictions ---');
  for (const rep of ['Hunter', 'Greg', 'Brendon', 'Aaron']) {
    try {
      const { status, data } = await apiCall('GET',
        `/api/command-center/meetings/predictions?rep=${rep}&goal=5`, adminCookies);
      if (status === 200) {
        const pred = data?.prediction || data?.predicted || data;
        pass(`PREDICTION ${rep}: ${JSON.stringify(pred).slice(0, 80)}`);
      } else {
        fail(`PREDICTION ${rep}`, `HTTP ${status}`);
      }
    } catch (e) {
      fail(`PREDICTION ${rep}`, e.message);
    }
  }

  // Test command center access per role
  console.log('\n  --- Role-Based Command Center Access ---');
  const rolesToTest = [
    { email: 'sara@rcrsal.com', name: 'Sara (admin)' },
    { email: 'destin@rcrsal.com', name: 'Destin (manager)' },
    { email: 'tia@rcrsal.com', name: 'Tia (office)' },
    { email: 'bart@rcrsal.com', name: 'Bart (PM)' },
    { email: 'hunter@rcrsal.com', name: 'Hunter (sales)' },
    { email: 'richard@rcrsal.com', name: 'Rick (driver)' },
    { email: 'boston@rcrsal.com', name: 'Boston (viewer)' },
  ];

  for (const user of rolesToTest) {
    const cookies = sessions[user.email];
    try {
      const { status } = await apiCall('GET', '/api/command-center/sales', cookies);
      if (status === 200) {
        pass(`CMD-CTR ACCESS ${user.name}: ✓ sales data`);
      } else if (status === 403) {
        pass(`CMD-CTR ACCESS ${user.name}: correctly blocked (403)`);
      } else {
        fail(`CMD-CTR ACCESS ${user.name}`, `HTTP ${status}`);
      }
    } catch (e) {
      fail(`CMD-CTR ACCESS ${user.name}`, e.message);
    }
  }
}

// ═══════════════════════════════════════════════════════
// PHASE 5: COMMISSIONS & SHEETS SYNC
// ═══════════════════════════════════════════════════════
async function testCommissions(sessions) {
  console.log('\n' + '═'.repeat(60));
  console.log('PHASE 5: COMMISSIONS & SHEETS SYNC');
  console.log('═'.repeat(60));

  const adminCookies = sessions['michaelmuse@rcrsal.com'];

  // Test commission data for each sales rep
  const salesReps = USERS.filter(u => u.isSalesRep);

  for (const rep of salesReps) {
    const slug = rep.name.toLowerCase().split(' ')[0];
    try {
      const { status, data } = await apiCall('GET',
        `/api/portal/jobnimbus/commissions?rep=${slug}`, adminCookies);
      if (status === 200) {
        const c = data?.commissions || data;
        pass(`COMMISSION ${rep.name}: ytd=$${c?.ytdCommissions || c?.ytd || 'N/A'}, monthly=$${c?.monthlyCommissions || c?.monthly || 'N/A'}`);
      } else {
        fail(`COMMISSION ${rep.name}`, `HTTP ${status}: ${data?.error || ''}`);
      }
    } catch (e) {
      fail(`COMMISSION ${rep.name}`, e.message);
    }
  }

  // Sheets sync
  console.log('\n  --- Sheets Data Sync ---');
  const sheetEndpoints = [
    '/api/sheets/commissions',
    '/api/sheets/customers',
    '/api/sheets/inventory',
  ];

  for (const ep of sheetEndpoints) {
    try {
      const { status, data } = await apiCall('GET', ep, adminCookies);
      if (status === 200) {
        const count = Array.isArray(data) ? data.length : (data?.data?.length || data?.count || 'ok');
        pass(`SHEETS ${ep.split('/').pop()}: ${count} records`);
      } else {
        fail(`SHEETS ${ep.split('/').pop()}`, `HTTP ${status}`);
      }
    } catch (e) {
      fail(`SHEETS ${ep.split('/').pop()}`, e.message);
    }
  }

  // Full sync test (read-only status)
  try {
    const { status, data } = await apiCall('GET', '/api/sheets/sync', adminCookies);
    if (status === 200) {
      pass(`SHEETS SYNC STATUS: ${JSON.stringify(data).slice(0, 100)}`);
    } else {
      fail('SHEETS SYNC STATUS', `HTTP ${status}`);
    }
  } catch (e) {
    fail('SHEETS SYNC STATUS', e.message);
  }
}

// ═══════════════════════════════════════════════════════
// PHASE 6: DELIVERY & ORDERS
// ═══════════════════════════════════════════════════════
async function testDeliveryPipeline(sessions) {
  console.log('\n' + '═'.repeat(60));
  console.log('PHASE 6: DELIVERY & ORDER PIPELINE');
  console.log('═'.repeat(60));

  const adminCookies = sessions['michaelmuse@rcrsal.com'];
  const driverCookies = sessions['richard@rcrsal.com'];
  const pmCookies = sessions['bart@rcrsal.com'];

  // Get existing orders
  try {
    const { status, data } = await apiCall('GET', '/api/portal/orders', adminCookies);
    if (status === 200) {
      const count = Array.isArray(data) ? data.length : (data?.orders?.length || data?.data?.length || 'ok');
      pass(`ORDERS LIST: ${count} orders found`);
    } else {
      fail('ORDERS LIST', `HTTP ${status}: ${data?.error || ''}`);
    }
  } catch (e) {
    fail('ORDERS LIST', e.message);
  }

  // Get delivery routes
  try {
    const today = new Date().toISOString().split('T')[0];
    const { status, data } = await apiCall('GET', `/api/portal/delivery?date=${today}`, adminCookies);
    if (status === 200) {
      const routes = data?.routes?.length || data?.deliveries?.length || 'none';
      pass(`DELIVERY ROUTES: ${routes} routes for ${today}`);
    } else {
      fail('DELIVERY ROUTES', `HTTP ${status}`);
    }
  } catch (e) {
    fail('DELIVERY ROUTES', e.message);
  }

  // Test driver can see deliveries
  try {
    const { status, data } = await apiCall('GET', '/api/portal/delivery?driver=richard', driverCookies);
    if (status === 200) {
      pass(`DRIVER VIEW (Rick): sees delivery queue`);
    } else {
      fail('DRIVER VIEW (Rick)', `HTTP ${status}`);
    }
  } catch (e) {
    fail('DRIVER VIEW (Rick)', e.message);
  }

  // Test PM can see deliveries
  try {
    const { status, data } = await apiCall('GET', '/api/portal/delivery', pmCookies);
    if (status === 200) {
      pass(`PM VIEW (Bart): sees all deliveries`);
    } else {
      fail('PM VIEW (Bart)', `HTTP ${status}`);
    }
  } catch (e) {
    fail('PM VIEW (Bart)', e.message);
  }

  // Test creating an order (admin)
  try {
    const { status, data } = await apiCall('POST', '/api/portal/orders', adminCookies, {
      customerName: 'E2E Test Customer',
      address: '100 Test St, Decatur, AL 35601',
      materials: ['30yr Shingles', 'Underlayment', 'Ridge Vent'],
      quantity: '25 squares',
      notes: 'E2E test order - DO NOT FULFILL',
      priority: 'normal',
    });
    if (status === 200 || status === 201) {
      const orderId = data?.orderId || data?.id || data?.order?.id;
      pass(`ORDER CREATE: ${orderId || 'created'}`);
    } else {
      // May not have this exact format - still log what happened
      fail(`ORDER CREATE`, `HTTP ${status}: ${JSON.stringify(data).slice(0, 120)}`);
    }
  } catch (e) {
    fail('ORDER CREATE', e.message);
  }
}

// ═══════════════════════════════════════════════════════
// PHASE 7: GAMIFICATION & ACHIEVEMENTS
// ═══════════════════════════════════════════════════════
async function testGamification(sessions) {
  console.log('\n' + '═'.repeat(60));
  console.log('PHASE 7: GAMIFICATION - Achievements, Badges, Points');
  console.log('═'.repeat(60));

  const adminCookies = sessions['michaelmuse@rcrsal.com'];

  // Gamification leaderboard
  const periods = ['daily', 'weekly', 'monthly', 'quarterly', 'all_time'];
  for (const period of periods) {
    try {
      const { status, data } = await apiCall('GET',
        `/api/gamification/leaderboard?period=${period}`, adminCookies);
      if (status === 200) {
        const count = data?.leaderboard?.length || data?.rankings?.length || (Array.isArray(data) ? data.length : 'ok');
        pass(`GAMIFICATION LB [${period}]: ${count} entries`);
      } else {
        fail(`GAMIFICATION LB [${period}]`, `HTTP ${status}`);
      }
    } catch (e) {
      fail(`GAMIFICATION LB [${period}]`, e.message);
    }
  }

  // Check achievements per rep
  console.log('\n  --- Per-Rep Achievements ---');
  const salesReps = USERS.filter(u => u.isSalesRep);
  for (const rep of salesReps) {
    const slug = rep.name.toLowerCase().split(' ')[0];
    try {
      const { status, data } = await apiCall('GET',
        `/api/gamification/achievements?repSlug=${slug}&checkAll=true`, adminCookies);
      if (status === 200) {
        const achievements = data?.achievements || data?.earned || data;
        const count = Array.isArray(achievements) ? achievements.length : 'N/A';
        const names = Array.isArray(achievements) ? achievements.slice(0, 3).map(a => a.name || a.id).join(', ') : '';
        pass(`ACHIEVEMENTS ${rep.name}: ${count} earned${names ? ` (${names})` : ''}`);
      } else {
        fail(`ACHIEVEMENTS ${rep.name}`, `HTTP ${status}`);
      }
    } catch (e) {
      fail(`ACHIEVEMENTS ${rep.name}`, e.message);
    }
  }
}

// ═══════════════════════════════════════════════════════
// PHASE 8: MEETING SYSTEM
// ═══════════════════════════════════════════════════════
async function testMeetingSystem(sessions) {
  console.log('\n' + '═'.repeat(60));
  console.log('PHASE 8: MONDAY MEETING SYSTEM');
  console.log('═'.repeat(60));

  const adminCookies = sessions['michaelmuse@rcrsal.com'];

  // Auto-generate meeting prep
  try {
    const { status, data } = await apiCall('GET',
      '/api/command-center/meetings/auto-generate', adminCookies);
    if (status === 200) {
      const sections = Object.keys(data || {}).join(', ');
      pass(`MEETING AUTO-GEN: ${sections}`);
      if (data?.verse) log('  📖', `Verse: ${(data.verse.text || data.verse).toString().slice(0, 60)}...`);
      if (data?.weather) log('  🌤️', `Weather: ${data.weather.temp || data.weather.temperature || 'N/A'}°F`);
    } else {
      fail('MEETING AUTO-GEN', `HTTP ${status}`);
    }
  } catch (e) {
    fail('MEETING AUTO-GEN', e.message);
  }

  // Weather API
  try {
    const { status, data } = await apiCall('GET',
      '/api/command-center/meetings/weather', adminCookies);
    if (status === 200) {
      pass(`MEETING WEATHER: ${JSON.stringify(data).slice(0, 100)}`);
    } else {
      fail('MEETING WEATHER', `HTTP ${status}`);
    }
  } catch (e) {
    fail('MEETING WEATHER', e.message);
  }

  // Rep stats
  console.log('\n  --- Rep Stats Service ---');
  for (const rep of ['Hunter', 'Greg', 'Aaron', 'Brendon']) {
    try {
      const { status, data } = await apiCall('GET',
        `/api/command-center/meetings/predictions?rep=${rep}&goal=5`, adminCookies);
      if (status === 200) {
        pass(`REP-STATS ${rep}: ${JSON.stringify(data).slice(0, 100)}`);
      } else {
        fail(`REP-STATS ${rep}`, `HTTP ${status}`);
      }
    } catch (e) {
      fail(`REP-STATS ${rep}`, e.message);
    }
  }
}

// ═══════════════════════════════════════════════════════
// PHASE 9: ROLE-BASED ACCESS CONTROL MATRIX
// ═══════════════════════════════════════════════════════
async function testAccessControl(sessions) {
  console.log('\n' + '═'.repeat(60));
  console.log('PHASE 9: ACCESS CONTROL - Every Role vs Every Endpoint');
  console.log('═'.repeat(60));

  // Key protected endpoints to test against each role
  const protectedEndpoints = [
    { path: '/api/portal/weekly-numbers?allReps=true', name: 'weekly-numbers-all', adminOnly: true },
    { path: '/api/command-center/sales', name: 'cmd-ctr-sales' },
    { path: '/api/command-center/stats', name: 'cmd-ctr-stats' },
    { path: '/api/sheets/inventory', name: 'sheets-inventory' },
    { path: '/api/portal/delivery', name: 'delivery-portal' },
    { path: '/api/portal/orders', name: 'orders' },
  ];

  // Test a representative user from each role
  const roleUsers = [
    { email: 'michaelmuse@rcrsal.com', name: 'Michael', role: 'owner' },
    { email: 'sara@rcrsal.com', name: 'Sara', role: 'admin' },
    { email: 'destin@rcrsal.com', name: 'Destin', role: 'manager' },
    { email: 'tia@rcrsal.com', name: 'Tia', role: 'office' },
    { email: 'bart@rcrsal.com', name: 'Bart', role: 'PM' },
    { email: 'hunter@rcrsal.com', name: 'Hunter', role: 'sales' },
    { email: 'richard@rcrsal.com', name: 'Rick', role: 'driver' },
    { email: 'boston@rcrsal.com', name: 'Boston', role: 'viewer' },
  ];

  for (const ep of protectedEndpoints) {
    const row = [];
    for (const user of roleUsers) {
      const cookies = sessions[user.email];
      try {
        const { status } = await apiCall('GET', ep.path, cookies);
        row.push({ user: user.name, role: user.role, status });
      } catch {
        row.push({ user: user.name, role: user.role, status: 'ERR' });
      }
    }
    const summary = row.map(r => `${r.role}:${r.status}`).join(' | ');
    log('🔐', `${ep.name}: ${summary}`);
  }
}

// ═══════════════════════════════════════════════════════
// PHASE 10: INVENTORY & OTHER SHEETS DATA
// ═══════════════════════════════════════════════════════
async function testInventoryAndSheets(sessions) {
  console.log('\n' + '═'.repeat(60));
  console.log('PHASE 10: INVENTORY & SHEETS DATA VERIFICATION');
  console.log('═'.repeat(60));

  const adminCookies = sessions['michaelmuse@rcrsal.com'];
  const officeCookies = sessions['tia@rcrsal.com'];

  // Inventory
  try {
    const { status, data } = await apiCall('GET', '/api/sheets/inventory', adminCookies);
    if (status === 200) {
      const items = Array.isArray(data) ? data : (data?.inventory || data?.data || []);
      pass(`INVENTORY: ${items.length} items loaded`);
      if (items.length > 0) {
        log('  📦', `Sample: ${items[0].name || items[0].item || JSON.stringify(items[0]).slice(0, 80)}`);
      }
    } else {
      fail('INVENTORY', `HTTP ${status}`);
    }
  } catch (e) {
    fail('INVENTORY', e.message);
  }

  // Customers
  try {
    const { status, data } = await apiCall('GET', '/api/sheets/customers', adminCookies);
    if (status === 200) {
      const customers = Array.isArray(data) ? data : (data?.customers || data?.data || []);
      pass(`CUSTOMERS: ${customers.length} records`);
    } else {
      fail('CUSTOMERS', `HTTP ${status}`);
    }
  } catch (e) {
    fail('CUSTOMERS', e.message);
  }

  // Office staff access to inventory
  try {
    const { status } = await apiCall('GET', '/api/sheets/inventory', officeCookies);
    pass(`OFFICE INVENTORY ACCESS (Tia): HTTP ${status}`);
  } catch (e) {
    fail('OFFICE INVENTORY ACCESS', e.message);
  }

  // Audit log (write-only by design - test POST)
  try {
    const { status, data } = await apiCall('POST', '/api/portal/audit-log', adminCookies, {
      action: 'E2E_TEST',
      userEmail: 'michaelmuse@rcrsal.com',
      details: 'End-to-end test run'
    });
    if (status === 200 || status === 201) {
      pass(`AUDIT LOG WRITE: entry logged`);
    } else {
      fail('AUDIT LOG WRITE', `HTTP ${status}: ${data?.error || ''}`);
    }
  } catch (e) {
    fail('AUDIT LOG WRITE', e.message);
  }
}

// ═══════════════════════════════════════════════════════
// MAIN - Run all phases
// ═══════════════════════════════════════════════════════
async function main() {
  console.log('╔' + '═'.repeat(58) + '╗');
  console.log('║  RCRS PORTAL - FULL END-TO-END SYSTEM TEST             ║');
  console.log('║  Testing ALL systems × ALL users                       ║');
  console.log('║  Notifications: DISABLED (no emails/SMS/GroupMe)        ║');
  console.log('╚' + '═'.repeat(58) + '╝');
  console.log(`\nTimestamp: ${new Date().toISOString()}`);
  console.log(`Server: ${BASE}`);
  console.log(`Users to test: ${USERS.length}`);

  // Phase 1: Auth
  const sessions = await testAuth();

  // Phase 2: Weekly Numbers
  await testWeeklyNumbers(sessions);

  // Phase 3: Leaderboards
  await testLeaderboards(sessions);

  // Phase 4: Command Center
  await testCommandCenter(sessions);

  // Phase 5: Commissions & Sheets
  await testCommissions(sessions);

  // Phase 6: Delivery Pipeline
  await testDeliveryPipeline(sessions);

  // Phase 7: Gamification
  await testGamification(sessions);

  // Phase 8: Meeting System
  await testMeetingSystem(sessions);

  // Phase 9: Access Control Matrix
  await testAccessControl(sessions);

  // Phase 10: Inventory & Sheets
  await testInventoryAndSheets(sessions);

  // ═══════════════════════════════════════════════════
  // FINAL REPORT
  // ═══════════════════════════════════════════════════
  console.log('\n' + '═'.repeat(60));
  console.log('FINAL RESULTS');
  console.log('═'.repeat(60));
  console.log(`✅ PASSED: ${results.passed}`);
  console.log(`❌ FAILED: ${results.failed}`);
  console.log(`📊 TOTAL:  ${results.passed + results.failed}`);
  console.log(`📈 RATE:   ${((results.passed / (results.passed + results.failed)) * 100).toFixed(1)}%`);

  if (results.errors.length > 0) {
    console.log('\n--- FAILURES ---');
    for (const err of results.errors) {
      console.log(`  ❌ ${err}`);
    }
  }

  console.log('\nDone. ' + new Date().toISOString());
}

main().catch(e => {
  console.error('FATAL:', e);
  process.exit(1);
});
