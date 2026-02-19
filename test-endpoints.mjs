const urls = [
  'http://localhost:3001/api/bible-verse',
  'http://localhost:3001/api/weather/forecast/35801',
  'http://localhost:3001/api/command-center/meetings/leaderboard?presentMode=true',
  'http://localhost:3001/api/command-center/meetings/stats?presentMode=true',
  'http://localhost:3001/api/command-center/competition?presentMode=true',
  'http://localhost:3001/api/portal/monday-notes/announcements?presentMode=true',
  'http://localhost:3001/api/portal/weekly-numbers?presentMode=true',
  'http://localhost:3001/command-center/meetings/present',
];

for (const url of urls) {
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(15000) });
    const t = await r.text();
    const short = url.replace('http://localhost:3001', '');
    console.log(`${r.status} ${short} (${t.length} bytes) ${t.substring(0, 150).replace(/\n/g, ' ')}`);
  } catch (e) {
    console.log(`ERR ${url}: ${e.message}`);
  }
}
