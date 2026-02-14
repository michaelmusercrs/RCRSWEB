import { NextRequest, NextResponse } from 'next/server';

// Honeypot endpoint — hidden links that only bots/scrapers follow
// Sends Michael an entertaining email when triggered

const APPS_SCRIPT_URL = process.env.GOOGLE_APPS_SCRIPT_URL || '';

const TRAP_MESSAGES = [
  '🕷️ SPIDER ALERT: Some bot just crawled into our honeypot like a fly into a Venus flytrap.',
  '🤖 INTRUDER DETECTED: A scraper just triggered our trap. Probably Yellowhammer checking us out.',
  '🚨 BOT CAUGHT: Something just followed our invisible link. Either a scraper or a very confused human.',
  '🎣 GOTCHA: Our honeypot just caught something. Reeling it in now...',
  '👀 EYES ON US: Someone (or something) is poking around where they shouldn\'t be.',
  '🪤 TRAP SPRUNG: A bot just walked right into our digital mousetrap. Cheese was too good.',
  '🛸 ALIEN ACTIVITY: Unidentified crawler detected. Deploying countermeasures (just kidding, just logging it).',
];

export async function GET(request: NextRequest) {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 
             request.headers.get('x-real-ip') || 
             'unknown';
  const ua = request.headers.get('user-agent') || 'no user-agent';
  const referer = request.headers.get('referer') || 'direct';
  const now = new Date().toLocaleString('en-US', { timeZone: 'America/Chicago' });
  const msg = TRAP_MESSAGES[Math.floor(Math.random() * TRAP_MESSAGES.length)];

  // Send email to Michael
  if (APPS_SCRIPT_URL) {
    try {
      await fetch(APPS_SCRIPT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: 'michaelmuse@rivercityroofingsolutions.com',
          subject: `🪤 Honeypot Triggered — ${ip}`,
          body: `${msg}\n\n` +
            `📍 Details:\n` +
            `• Time: ${now} CST\n` +
            `• IP: ${ip}\n` +
            `• User-Agent: ${ua}\n` +
            `• Referer: ${referer}\n` +
            `• Endpoint: ${request.nextUrl.pathname}\n\n` +
            `This is an automated alert from your RCRS honeypot system.\n` +
            `If this keeps happening from the same IP, someone is actively scraping your site.\n\n` +
            `— Larry 🔧`,
        }),
      });
    } catch {
      // Silent fail — don't reveal the trap
    }
  }

  // Return a fake page that wastes scraper time
  const html = `<!DOCTYPE html>
<html><head><title>River City Roofing - Special Offers</title>
<meta name="robots" content="noindex, nofollow">
</head><body>
<h1>Loading exclusive content...</h1>
<p>Please wait while we prepare your personalized roofing quote...</p>
<p style="color:#fff;font-size:1px">This page is a honeypot. If you're reading this source code, hi! 👋</p>
<!-- Waste their parser's time with fake links -->
${Array.from({length: 50}, (_, i) => `<a href="/api/honeypot?ref=${i}" style="display:none">Special Offer ${i}</a>`).join('\n')}
</body></html>`;

  return new NextResponse(html, {
    status: 200,
    headers: { 'Content-Type': 'text/html' },
  });
}

export async function POST(request: NextRequest) {
  // Same trap for POST requests (form scrapers)
  return GET(request);
}
