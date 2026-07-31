'use strict';

/**
 * Voicemail watcher. Scans each mailbox's INBOX and Old folders (moveheard=yes
 * on the PBX means a message moves INBOX→Old the moment it's listened to via
 * *97 — so "gone from INBOX" means HEARD, not deleted; we scan both and dedupe
 * by a stable key).
 *
 * Each message is a msgNNNN.wav + msgNNNN.txt pair; the .txt carries callerid,
 * origdate, origtime, duration. Dedup key = <ext>:<origtime>:<msgId>.
 *
 * STATUS: emits `voicemail` events (which mark the call record). Full voicemail
 * MESSAGE ingestion into the portal's Voicemails tab (audio + Whisper) is the
 * next portal vertical; this watcher is ready to feed it. Disabled by default.
 */

const fs = require('fs');
const path = require('path');

function parseMeta(txtPath) {
  const meta = {};
  try {
    for (const line of fs.readFileSync(txtPath, 'utf8').split('\n')) {
      const m = line.match(/^([A-Za-z_]+)\s*=\s*(.*)$/);
      if (m) meta[m[1].toLowerCase()] = m[2].trim();
    }
  } catch { /* ignore */ }
  return meta;
}

/** Return unseen voicemail descriptors across all mailboxes. */
function scanVoicemail(cfg, seen) {
  const out = [];
  let mailboxes = [];
  try {
    mailboxes = fs.readdirSync(cfg.voicemailDir, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name);
  } catch {
    return out;
  }
  for (const ext of mailboxes) {
    for (const folder of ['INBOX', 'Old']) {
      const dir = path.join(cfg.voicemailDir, ext, folder);
      let files = [];
      try { files = fs.readdirSync(dir); } catch { continue; }
      for (const f of files) {
        const m = f.match(/^(msg\d+)\.txt$/);
        if (!m) continue;
        const msgId = m[1];
        const meta = parseMeta(path.join(dir, f));
        const origtime = meta.origtime || '';
        const key = `${ext}:${origtime}:${msgId}`;
        if (seen.has(key)) continue;
        out.push({
          key,
          extension: ext,
          folder,
          msgId,
          wavPath: path.join(dir, `${msgId}.wav`),
          callerid: meta.callerid || '',
          origtime,
          duration: Number(meta.duration || 0),
          isHeard: folder === 'Old',
        });
      }
    }
  }
  return out;
}

module.exports = { scanVoicemail, parseMeta };
