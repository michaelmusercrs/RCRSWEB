'use strict';

/**
 * Recording handling: locate the MixMonitor WAV for a call, optionally transcode
 * to Opus (voice → ~24 kbps, ~10x smaller), and upload to the portal (which
 * stores it in PRIVATE Blob). Returns the stored pathname for the recording_ready
 * event.
 *
 * FIELD NOTE: recordings only exist from ~12:45 CT 2026-07-31 onward. Older calls
 * have CDR rows but no audio — that's expected, not an error.
 */

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

function resolveFile(recordingfile, recordingDir) {
  if (!recordingfile) return null;
  if (path.isAbsolute(recordingfile) && fs.existsSync(recordingfile)) return recordingfile;
  const candidate = path.join(recordingDir, path.basename(recordingfile));
  return fs.existsSync(candidate) ? candidate : null;
}

// Files under this are empty MixMonitor stubs (44-byte WAV headers) — abandoned
// or Local-channel-answered calls before the 2026-08-02 record-from-arrival fix,
// plus retry stubs the PBX purges daily. Never upload them.
const MIN_RECORDING_BYTES = 1024;

async function processRecording(portal, cfg, { callUuid, recordingfile, ext }) {
  const file = resolveFile(recordingfile, cfg.recordingDir);
  if (!file) return { ok: false, reason: 'not-found', recordingfile };

  let size = 0;
  try { size = fs.statSync(file).size; } catch { return { ok: false, reason: 'not-found', recordingfile }; }
  if (size < MIN_RECORDING_BYTES) return { ok: false, reason: 'empty-stub', file, bytes: size };

  let buffer;
  let contentType;
  let outExt;

  if (cfg.transcode === 'opus') {
    const tmp = path.join(cfg.stateDir, `rec-${Date.now()}-${Math.floor(process.hrtime()[1] % 1e6)}.opus`);
    const r = spawnSync(
      cfg.ffmpeg,
      ['-y', '-i', file, '-ac', '1', '-c:a', 'libopus', '-b:a', '24k', '-application', 'voip', tmp],
      { stdio: 'ignore' },
    );
    if (r.status !== 0 || !fs.existsSync(tmp)) {
      return { ok: false, reason: 'ffmpeg-failed', file };
    }
    buffer = fs.readFileSync(tmp);
    contentType = 'audio/ogg';
    outExt = 'opus';
    try { fs.unlinkSync(tmp); } catch { /* ignore */ }
  } else {
    buffer = fs.readFileSync(file);
    contentType = 'audio/wav';
    outExt = 'wav';
  }

  const up = await portal.uploadAudio(buffer, { kind: 'recording', callUuid, ext: outExt, contentType });
  return up.ok
    ? { ok: true, pathname: up.pathname, url: up.url, bytes: buffer.length }
    : { ok: false, reason: 'upload-failed', ...up };
}

module.exports = { processRecording, resolveFile };
