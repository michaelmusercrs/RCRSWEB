const r = await fetch('http://localhost:3000/command-center/meetings/present');
const t = await r.text();
const m = t.match(/__NEXT_DATA__[^>]*>(.*?)<\/script>/s);
if (m) {
  try { const j = JSON.parse(m[1]); console.log(JSON.stringify(j, null, 2).substring(0, 2000)); } catch(e) { console.log(m[1].substring(0, 1000)); }
} else {
  console.log('Status:', r.status);
  console.log(t.substring(0, 500));
}
