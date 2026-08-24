// Fetch the service account's numeric Client ID (Unique ID) for Domain-Wide
// Delegation. Read-only. node scripts/gaf-get-client-id.mjs
import fs from 'node:fs';
import { JWT } from 'google-auth-library';

for (const f of ['.env.local', '.env']) {
  if (!fs.existsSync(f)) continue;
  for (const line of fs.readFileSync(f, 'utf8').split('\n')) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}
const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
const key = (process.env.GOOGLE_PRIVATE_KEY || '').replace(/\\n/g, '\n');

try {
  const jwt = new JWT({ email, key, scopes: ['https://www.googleapis.com/auth/cloud-platform'] });
  const { access_token } = await jwt.authorize();
  const r = await fetch('https://oauth2.googleapis.com/tokeninfo?access_token=' + access_token);
  const j = await r.json();
  console.log('Service account :', email);
  console.log('CLIENT ID       :', j.azp || j.aud || '(not found)');
} catch (e) {
  console.log('error:', e.message.slice(0, 160));
}
