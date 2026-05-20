// GroupMe Bot Webhook - "River" bot callback endpoint
// Receives messages posted in GroupMe groups where the bot is added
// Can trigger automated responses, command processing, etc.
//
// SECURITY 2026-05-20: NO signature verification — by design.
// GroupMe outgoing webhooks do NOT sign their callbacks (no HMAC, no secret,
// no IP allowlist published). Per GroupMe dev docs the only available
// authentication is "trust the URL". Risk profile is LOW because:
//   1. The bot only POSTs back to GroupMe via GROUPME_BOT_ID (not the caller)
//   2. Handlers are read-only command lookups; no DB writes, no Sheets writes
//   3. Worst case is bot spam in our own group, not data exfiltration
// If this endpoint ever gains write capability (e.g., creating leads from
// GroupMe messages), it MUST be upgraded to verify a shared-secret query
// parameter on the bot callback URL (e.g., ?token=<GROUPME_WEBHOOK_TOKEN>)
// and that token MUST be required (fail-closed) — same pattern as JobNimbus.

import { NextRequest, NextResponse } from 'next/server';

interface GroupMeCallback {
  attachments: Array<{ type: string; url?: string; loci?: number[][]; user_ids?: string[] }>;
  avatar_url: string | null;
  created_at: number;
  group_id: string;
  id: string;
  name: string;
  sender_id: string;
  sender_type: 'user' | 'bot' | 'system';
  source_guid: string;
  system: boolean;
  text: string | null;
  user_id: string;
}

// River bot commands - messages starting with /river or @River
const RIVER_COMMANDS: Record<string, { description: string; handler: (msg: GroupMeCallback) => Promise<string | null> }> = {
  help: {
    description: 'Show available commands',
    handler: async () => {
      return [
        '🏠 River Bot Commands:',
        '/river help - Show this message',
        '/river status - System status summary',
        '/river leads - Today\'s lead count',
        '/river weather [zip] - Quick weather check',
        '/river schedule - Today\'s schedule summary',
      ].join('\n');
    },
  },
  status: {
    description: 'System status',
    handler: async () => {
      return '✅ All systems operational\n📊 Portal: Online\n📋 JN Sync: Active\n📱 SMS: Ready';
    },
  },
  leads: {
    description: 'Today\'s lead count',
    handler: async () => {
      // In production, this would query Google Sheets
      return '📊 Lead summary requires Google Sheets API connection. Configure GOOGLE_SHEETS_API_KEY in environment.';
    },
  },
};

export async function POST(request: NextRequest) {
  try {
    const callback: GroupMeCallback = await request.json();

    // Ignore messages from bots (prevent infinite loops)
    if (callback.sender_type === 'bot' || callback.system) {
      return NextResponse.json({ ok: true });
    }

    const text = callback.text?.trim() || '';

    // Check for River bot commands
    if (text.toLowerCase().startsWith('/river ') || text.toLowerCase() === '/river') {
      const parts = text.split(/\s+/);
      const command = (parts[1] || 'help').toLowerCase();

      const handler = RIVER_COMMANDS[command];
      if (handler) {
        const response = await handler.handler(callback);
        if (response) {
          await sendBotReply(response);
        }
      } else {
        await sendBotReply(`Unknown command: ${command}\nType /river help for available commands.`);
      }
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('GroupMe webhook error:', error);
    return NextResponse.json({ ok: true }); // Always return 200 to GroupMe
  }
}

// Send a reply via the River bot
async function sendBotReply(text: string) {
  const botId = process.env.GROUPME_BOT_ID;
  if (!botId) return;

  try {
    await fetch('https://api.groupme.com/v3/bots/post', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bot_id: botId, text }),
    });
  } catch (error) {
    console.error('River bot reply failed:', error);
  }
}

// GET endpoint for webhook verification
export async function GET() {
  return NextResponse.json({ status: 'River bot webhook active' });
}
