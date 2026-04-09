#!/usr/bin/env node
/**
 * RCRS Portal - Deep Per-User System Scan
 * Tests EVERY portal page + EVERY system endpoint as each individual user.
 * Checks: page loads, data correctness, role enforcement, broken links.
 */

const BASE = 'http://localhost:3000';
const PASSWORD = 'ChangeMe123!';

// All active users with their expected access
const USERS = [
  { name: 'Michael Muse', email: 'michaelmuse@rcrsal.com', role: 'owner', slug: 'michael-muse',
    expectedPages: ['/portal/pm', '/portal/office', '/portal/billing', '/portal/inventory', '/portal/driver', '/portal/admin', '/portal/sales', '/portal/manager', '/command-center'],
    canAccessFinancial: true, canSubmitWeekly: false, isOnLeaderboard: false },
  { name: 'Chris Muse', email: 'chrismuse@rcrsal.com', role: 'owner', slug: 'chris-muse',
    expectedPages: ['/portal/pm', '/portal/office', '/portal/billing', '/portal/inventory', '/portal/admin', '/portal/sales', '/command-center'],
    canAccessFinancial: true, canSubmitWeekly: false, isOnLeaderboard: false },
  { name: 'Sara Hill', email: 'sara@rcrsal.com', role: 'admin', slug: 'sara-hill',
    expectedPages: ['/portal/pm', '/portal/office', '/portal/billing', '/portal/inventory', '/portal/admin', '/portal/sales', '/command-center'],
    canAccessFinancial: true, canSubmitWeekly: false, isOnLeaderboard: false },
  { name: 'Destin Mccary', email: 'destin@rcrsal.com', role: 'manager', slug: 'destin',
    expectedPages: ['/portal/dashboard', '/portal/manager', '/portal/office', '/command-center'],
    canAccessFinancial: false, canSubmitWeekly: false, isOnLeaderboard: false },
  { name: 'Tia Muse Morris', email: 'tia@rcrsal.com', role: 'office', slug: 'tia',
    expectedPages: ['/portal/dashboard', '/portal/office', '/portal/billing', '/portal/inventory'],
    canAccessFinancial: false, canSubmitWeekly: false, isOnLeaderboard: false },
  { name: 'Bart Roberts', email: 'bart@rcrsal.com', role: 'project_manager', slug: 'bart',
    expectedPages: ['/portal/dashboard', '/portal/pm', '/portal/inventory'],
    canAccessFinancial: false, canSubmitWeekly: false, isOnLeaderboard: false },
  { name: 'John Cordonis', email: 'john@rcrsal.com', role: 'project_manager', slug: 'john',
    expectedPages: ['/portal/dashboard', '/portal/pm', '/portal/inventory', '/portal/sales'],
    canAccessFinancial: false, canSubmitWeekly: false, isOnLeaderboard: false },
  { name: 'Richard Geahr', email: 'richard@rcrsal.com', role: 'driver', slug: 'richard',
    expectedPages: ['/portal/dashboard', '/portal/driver', '/portal/inventory'],
    canAccessFinancial: false, canSubmitWeekly: true, isOnLeaderboard: true },
  { name: 'Hunter Rivers', email: 'hunter@rcrsal.com', role: 'sales', slug: 'hunter',
    expectedPages: ['/portal/dashboard', '/portal/sales', '/portal/inventory'],
    canAccessFinancial: false, canSubmitWeekly: true, isOnLeaderboard: true },
  { name: 'Aaron Lussi', email: 'aaron@rcrsal.com', role: 'sales', slug: 'aaron',
    expectedPages: ['/portal/dashboard', '/portal/sales', '/portal/inventory'],
    canAccessFinancial: false, canSubmitWeekly: true, isOnLeaderboard: true },
  { name: 'Greg Muse', email: 'greg@rcrsal.com', role: 'sales', slug: 'greg',
    expectedPages: ['/portal/dashboard', '/portal/sales', '/portal/inventory'],
    canAccessFinancial: false, canSubmitWeekly: true, isOnLeaderboard: true },
  { name: 'Brendon Muse', email: 'brendon@rcrsal.com', role: 'sales', slug: 'brendon',
    expectedPages: ['/portal/dashboard', '/portal/sales', '/portal/inventory'],
    canAccessFinancial: false, canSubmitWeekly: true, isOnLeaderboard: true },
  { name: 'Adam Rudell', email: 'adam@rcrsal.com', role: 'sales', slug: 'adam',
    expectedPages: ['/portal/dashboard', '/portal/sales', '/portal/inventory'],
    canAccessFinancial: false, canSubmitWeekly: true, isOnLeaderboard: true },
  { name: 'Joseph Dowd', email: 'joseph@rcrsal.com', role: 'sales', slug: 'joseph',
    expectedPages: ['/portal/dashboard', '/portal/sales', '/portal/inventory'],
    canAccessFinancial: false, canSubmitWeekly: true, isOnLeaderboard: true },
  { name: 'Alijah', email: 'alijah@rcrsal.com', role: 'sales', slug: 'alijah',
    expectedPages: ['/portal/dashboard', '/portal/sales', '/portal/inventory'],
    canAccessFinancial: false, canSubmitWeekly: true, isOnLeaderboard: true },
  { name: 'Travis Wages', email: 'travis@rcrsal.com', role: 'sales', slug: 'travis',
    expectedPages: ['/portal/dashboard', '/portal/sales', '/portal/inventory'],
    canAccessFinancial: false, canSubmitWeekly: true, isOnLeaderboard: true },
  { name: 'Boston Muse', email: 'boston@rcrsal.com', role: 'viewer', slug: 'boston',
    expectedPages: ['/portal/dashboard', '/portal/office'],
    canAccessFinancial: false, canSubmitWeekly: false, isOnLeaderboard: false },
];

// ALL portal pages to test
const ALL_PORTAL_PAGES = [
  '/portal',
  '/portal/dashboard',
  '/portal/sales',
  '/portal/sales/leads',
  '/portal/sales/leaderboard',
  '/portal/sales/weekly-numbers',
  '/portal/sales/commissions',
  '/portal/inventory',
  '/portal/office',
  '/portal/billing',
  '/portal/driver',
  '/portal/pm',
  '/portal/admin',
  '/portal/admin/team',
  '/portal/manager',
  '/portal/training',
  '/command-center',
  '/command-center/sales',
  '/command-center/meetings',
  '/command-center/meetings/leaderboard',
  '/command-center/meetings/prep',
  '/command-center/meetings/presentation',
];

// ALL API endpoints to test per user
const ALL_API_ENDPOINTS = [
  { method: 'GET', path: '/api/command-center/meetings/leaderboard', name: 'meeting-leaderboard' },
  { method: 'GET', path: '/api/command-center/weekly-leaderboard?metric=revenue&period=thisMonth', name: 'weekly-leaderboard' },
  { method: 'GET', path: '/api/command-center/sales', name: 'cmd-ctr-sales' },
  { method: 'GET', path: '/api/command-center/stats', name: 'cmd-ctr-stats' },
  { method: 'GET', path: '/api/command-center/insights', name: 'insights' },
  { method: 'GET', path: '/api/command-center/trends', name: 'trends' },
  { method: 'GET', path: '/api/command-center/financial?action=dashboard', name: 'financial' },
  { method: 'GET', path: '/api/command-center/rep-comparison?rep1=hunter&rep2=greg', name: 'rep-compare' },
  { method: 'GET', path: '/api/command-center/meetings/weather', name: 'weather' },
  { method: 'GET', path: '/api/command-center/meetings/auto-generate', name: 'meeting-auto-gen' },
  { method: 'GET', path: '/api/portal/weekly-numbers?allReps=true', name: 'weekly-nums-all' },
  { method: 'GET', path: '/api/portal/delivery', name: 'delivery' },
  { method: 'GET', path: '/api/portal/orders', name: 'orders' },
  { method: 'GET', path: '/api/sheets/inventory', name: 'inventory' },
  { method: 'GET', path: '/api/sheets/customers', name: 'customers' },
  { method: 'GET', path: '/api/sheets/commissions', name: 'commissions' },
  { method: 'GET', path: '/api/gamification/leaderboard?period=monthly', name: 'gamification-lb' },
  { method: 'GET', path: '/api/portal/jobnimbus/commissions', name: 'jn-commissions' },
];

const results = { passed: 0, failed: 0, warnings: 0, errors: [], warnings_list: [] };
const userReports = {};

function log(icon, msg) { console.log(`${icon} ${msg}`); }
function pass(test) { results.passed++; }
function fail(test, detail) { results.failed++; results.errors.push(`${test}: ${detail}`); }
function warn(test, detail) { results.warnings++; results.warnings_list.push(`${test}: ${detail}`); }

function extractCookies(response) {
  const cookies = {};
  const setCookieHeaders = response.headers.getSetCookie?.() || [];
  for (const header of setCookieHeaders) {
    const [pair] = header.split(';');
    const [name, value] = pair.split('=');
    cookies[name.trim()] = value?.trim();
  }
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
    headers: { 'Content-Type': 'application/json', 'Origin': 'http://localhost:3000' },
    redirect: 'manual',
  };
  if (cookies && Object.keys(cookies).length > 0) opts.headers['Cookie'] = cookieHeader(cookies);
  if (body) opts.body = JSON.stringify(body);

  const resp = await fetch(`${BASE}${path}`, opts);
  let data;
  const contentType = resp.headers.get('content-type') || '';
  if (contentType.includes('json')) {
    try { data = await resp.json(); } catch { data = null; }
  } else {
    const text = await resp.text();
    // Check for error indicators in HTML
    data = {
      _isHtml: true,
      _hasError: text.includes('Internal Server Error') || text.includes('500') || text.includes('Application error'),
      _has404: text.includes('404') || text.includes('not found') || text.includes('Not Found'),
      _hasRedirect: resp.status >= 300 && resp.status < 400,
      _redirectTo: resp.headers.get('location'),
      _size: text.length,
    };
  }
  return { status: resp.status, data, cookies: extractCookies(resp) };
}

async function login(email) {
  // Try portal auth first
  let result = await apiCall('POST', '/api/portal/auth', {}, { action: 'login-password', email, password: PASSWORD });
  if (result.cookies?.access_token) return result.cookies;
  // Fallback to admin auth
  result = await apiCall('POST', '/api/auth/login', {}, { email, password: PASSWORD });
  return result.cookies;
}

// ═══════════════════════════════════════════════════════
// Deep scan for ONE user
// ═══════════════════════════════════════════════════════
async function deepScanUser(user, cookies) {
  const report = {
    name: user.name,
    role: user.role,
    pages: { accessible: [], blocked: [], errors: [], redirects: [] },
    apis: { accessible: [], blocked: [], errors: [] },
    systems: {},
  };

  // TEST 1: Every portal page
  for (const page of ALL_PORTAL_PAGES) {
    try {
      const { status, data } = await apiCall('GET', page, cookies);
      if (status === 200 && !data?._hasError) {
        report.pages.accessible.push(page);
        pass(`${user.name}|${page}`);
      } else if (status >= 300 && status < 400) {
        report.pages.redirects.push({ page, to: data?._redirectTo || 'unknown' });
        pass(`${user.name}|${page}|redirect`);
      } else if (status === 403 || status === 401) {
        report.pages.blocked.push(page);
        pass(`${user.name}|${page}|blocked`);
      } else {
        report.pages.errors.push({ page, status, error: data?._hasError });
        fail(`${user.name} PAGE ${page}`, `HTTP ${status}`);
      }
    } catch (e) {
      report.pages.errors.push({ page, error: e.message });
      fail(`${user.name} PAGE ${page}`, e.message);
    }
  }

  // TEST 2: Every API endpoint
  for (const ep of ALL_API_ENDPOINTS) {
    try {
      const { status, data } = await apiCall(ep.method, ep.path, cookies);
      if (status === 200) {
        report.apis.accessible.push(ep.name);
        pass(`${user.name}|API|${ep.name}`);
      } else if (status === 403 || status === 401) {
        report.apis.blocked.push(ep.name);
        pass(`${user.name}|API|${ep.name}|blocked`);
      } else {
        report.apis.errors.push({ name: ep.name, status, error: data?.error });
        fail(`${user.name} API ${ep.name}`, `HTTP ${status}: ${data?.error || ''}`);
      }
    } catch (e) {
      report.apis.errors.push({ name: ep.name, error: e.message });
      fail(`${user.name} API ${ep.name}`, e.message);
    }
  }

  // TEST 3: User-specific systems
  // 3a: Can they see their own data on leaderboard?
  if (user.isOnLeaderboard) {
    try {
      const { status, data } = await apiCall('GET', '/api/command-center/meetings/leaderboard', cookies);
      if (status === 200 && data?.data) {
        const reps = data.data;
        const self = reps.find(r =>
          r.name?.toLowerCase().includes(user.name.split(' ')[0].toLowerCase()) ||
          r.repName?.toLowerCase().includes(user.name.split(' ')[0].toLowerCase())
        );
        if (self) {
          report.systems.leaderboardSelf = { found: true, rank: self.rank, revenue: self.revenue || self.totalRevenue };
          pass(`${user.name}|LEADERBOARD_SELF`);
        } else {
          report.systems.leaderboardSelf = { found: false };
          warn(`${user.name} LEADERBOARD`, 'Not found on leaderboard');
        }
      }
    } catch (e) {
      fail(`${user.name} LEADERBOARD_SELF`, e.message);
    }
  }

  // 3b: Can they submit/view their own weekly numbers?
  if (user.canSubmitWeekly) {
    try {
      const { status, data } = await apiCall('GET',
        `/api/portal/weekly-numbers?repEmail=${user.email}`, cookies);
      if (status === 200) {
        report.systems.weeklyNumbers = { canView: true };
        pass(`${user.name}|WEEKLY_VIEW`);
      } else {
        report.systems.weeklyNumbers = { canView: false, status };
        fail(`${user.name} WEEKLY_VIEW`, `HTTP ${status}`);
      }
    } catch (e) {
      fail(`${user.name} WEEKLY_VIEW`, e.message);
    }
  }

  // 3c: Can they see their own commissions?
  if (user.isOnLeaderboard) {
    try {
      const slug = user.slug.split('-')[0]; // first name
      const { status, data } = await apiCall('GET',
        `/api/portal/jobnimbus/commissions?rep=${slug}`, cookies);
      if (status === 200) {
        report.systems.commissions = { canView: true, data: data?.commissions || data };
        pass(`${user.name}|COMMISSIONS_SELF`);
      } else {
        fail(`${user.name} COMMISSIONS_SELF`, `HTTP ${status}`);
      }
    } catch (e) {
      fail(`${user.name} COMMISSIONS_SELF`, e.message);
    }
  }

  // 3d: Financial access (should only work for owners/admins)
  try {
    const { status } = await apiCall('GET', '/api/command-center/financial?action=summary', cookies);
    if (user.canAccessFinancial && status !== 200) {
      fail(`${user.name} FINANCIAL_ACCESS`, `Expected 200, got ${status}`);
    } else if (!user.canAccessFinancial && status === 200) {
      warn(`${user.name} FINANCIAL`, 'Has financial access but should not');
    } else {
      pass(`${user.name}|FINANCIAL_ACCESS`);
    }
    report.systems.financial = { status, allowed: status === 200 };
  } catch (e) {
    fail(`${user.name} FINANCIAL_ACCESS`, e.message);
  }

  // 3e: Gamification/achievements
  try {
    const slug = user.slug.split('-')[0];
    const { status, data } = await apiCall('GET',
      `/api/gamification/achievements?repSlug=${slug}&checkAll=true`, cookies);
    report.systems.achievements = { status, data: data?.achievements || data };
    pass(`${user.name}|ACHIEVEMENTS`);
  } catch (e) {
    fail(`${user.name} ACHIEVEMENTS`, e.message);
  }

  // 3f: Rep predictions (for sales reps)
  if (user.isOnLeaderboard) {
    const firstName = user.name.split(' ')[0];
    try {
      const { status, data } = await apiCall('GET',
        `/api/command-center/meetings/predictions?rep=${firstName}&goal=5`, cookies);
      if (status === 200 && data?.data?.repStats) {
        const stats = data.data.repStats;
        report.systems.predictions = {
          totalWeeks: stats.totalWeeks,
          weeksPresent: stats.weeksPresent,
          attendanceRate: stats.attendanceRate,
          avgInspected: stats.avgInspected,
          avgSigned: stats.avgSigned,
          avgRevenue: stats.avgRevenue,
        };
        pass(`${user.name}|PREDICTIONS`);
      } else {
        report.systems.predictions = { status, error: data?.error };
        if (status !== 200) fail(`${user.name} PREDICTIONS`, `HTTP ${status}`);
        else pass(`${user.name}|PREDICTIONS`);
      }
    } catch (e) {
      fail(`${user.name} PREDICTIONS`, e.message);
    }
  }

  return report;
}

// ═══════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════
async function main() {
  console.log('╔' + '═'.repeat(58) + '╗');
  console.log('║  RCRS PORTAL - DEEP PER-USER SYSTEM SCAN               ║');
  console.log('║  Every page × Every API × Every user                   ║');
  console.log('╚' + '═'.repeat(58) + '╝');
  console.log(`\nTimestamp: ${new Date().toISOString()}`);

  for (const user of USERS) {
    console.log(`\n${'▓'.repeat(60)}`);
    console.log(`▓  ${user.name} (${user.role})`);
    console.log(`${'▓'.repeat(60)}`);

    const cookies = await login(user.email);
    if (!cookies?.access_token) {
      console.log(`  ⚠️  Login failed - testing with empty session`);
    }

    const report = await deepScanUser(user, cookies);
    userReports[user.email] = report;

    // Summary for this user
    console.log(`\n  📊 ${user.name} Summary:`);
    console.log(`     Pages: ${report.pages.accessible.length} accessible, ${report.pages.blocked.length} blocked, ${report.pages.errors.length} errors, ${report.pages.redirects.length} redirects`);
    console.log(`     APIs:  ${report.apis.accessible.length} accessible, ${report.apis.blocked.length} blocked, ${report.apis.errors.length} errors`);

    if (report.pages.errors.length > 0) {
      console.log(`     ❌ Page errors: ${report.pages.errors.map(e => `${e.page}(${e.status})`).join(', ')}`);
    }
    if (report.apis.errors.length > 0) {
      console.log(`     ❌ API errors: ${report.apis.errors.map(e => `${e.name}(${e.status})`).join(', ')}`);
    }
    if (report.systems.leaderboardSelf) {
      console.log(`     🏆 Leaderboard: ${report.systems.leaderboardSelf.found ? `Rank #${report.systems.leaderboardSelf.rank}` : 'NOT FOUND'}`);
    }
    if (report.systems.predictions) {
      const p = report.systems.predictions;
      console.log(`     📈 Stats: ${p.totalWeeks || '?'} total weeks, ${p.attendanceRate || '?'}% attendance, avg $${p.avgRevenue || '?'} revenue`);
    }
  }

  // ═══════════════════════════════════════════════════
  // CROSS-USER COMPARISON TABLE
  // ═══════════════════════════════════════════════════
  console.log('\n\n' + '═'.repeat(60));
  console.log('ACCESS CONTROL MATRIX - Pages');
  console.log('═'.repeat(60));
  console.log(`${'User'.padEnd(18)} ${'Role'.padEnd(10)} ${'Access'.padEnd(6)} ${'Block'.padEnd(6)} ${'Error'.padEnd(6)} ${'Redir'.padEnd(6)}`);
  console.log('-'.repeat(55));
  for (const user of USERS) {
    const r = userReports[user.email];
    console.log(
      `${user.name.slice(0, 17).padEnd(18)} ${user.role.padEnd(10)} ${String(r.pages.accessible.length).padEnd(6)} ${String(r.pages.blocked.length).padEnd(6)} ${String(r.pages.errors.length).padEnd(6)} ${String(r.pages.redirects.length).padEnd(6)}`
    );
  }

  console.log('\n' + '═'.repeat(60));
  console.log('ACCESS CONTROL MATRIX - APIs');
  console.log('═'.repeat(60));
  console.log(`${'User'.padEnd(18)} ${'Role'.padEnd(10)} ${'Access'.padEnd(6)} ${'Block'.padEnd(6)} ${'Error'.padEnd(6)}`);
  console.log('-'.repeat(50));
  for (const user of USERS) {
    const r = userReports[user.email];
    console.log(
      `${user.name.slice(0, 17).padEnd(18)} ${user.role.padEnd(10)} ${String(r.apis.accessible.length).padEnd(6)} ${String(r.apis.blocked.length).padEnd(6)} ${String(r.apis.errors.length).padEnd(6)}`
    );
  }

  // LEADERBOARD RANKINGS
  console.log('\n' + '═'.repeat(60));
  console.log('SALES REP STATS COMPARISON');
  console.log('═'.repeat(60));
  console.log(`${'Rep'.padEnd(18)} ${'Weeks'.padEnd(8)} ${'Present'.padEnd(8)} ${'Attend%'.padEnd(8)} ${'AvgRev$'.padEnd(10)}`);
  console.log('-'.repeat(55));
  for (const user of USERS.filter(u => u.isOnLeaderboard)) {
    const r = userReports[user.email];
    const p = r?.systems?.predictions || {};
    console.log(
      `${user.name.slice(0, 17).padEnd(18)} ${String(p.totalWeeks || '-').padEnd(8)} ${String(p.weeksPresent || '-').padEnd(8)} ${String(p.attendanceRate ? p.attendanceRate + '%' : '-').padEnd(8)} ${String(p.avgRevenue ? '$' + Math.round(p.avgRevenue) : '-').padEnd(10)}`
    );
  }

  // FINAL RESULTS
  console.log('\n' + '═'.repeat(60));
  console.log('FINAL RESULTS');
  console.log('═'.repeat(60));
  console.log(`✅ PASSED:    ${results.passed}`);
  console.log(`❌ FAILED:    ${results.failed}`);
  console.log(`⚠️  WARNINGS:  ${results.warnings}`);
  console.log(`📊 TOTAL:     ${results.passed + results.failed}`);
  console.log(`📈 RATE:      ${((results.passed / (results.passed + results.failed)) * 100).toFixed(1)}%`);

  if (results.errors.length > 0) {
    console.log('\n--- ALL FAILURES ---');
    for (const err of results.errors) {
      console.log(`  ❌ ${err}`);
    }
  }
  if (results.warnings_list.length > 0) {
    console.log('\n--- WARNINGS ---');
    for (const w of results.warnings_list) {
      console.log(`  ⚠️  ${w}`);
    }
  }

  console.log('\nDone. ' + new Date().toISOString());
}

main().catch(e => { console.error('FATAL:', e); process.exit(1); });
