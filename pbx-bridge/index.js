#!/usr/bin/env node
'use strict';

/**
 * RCR PBX Bridge — reads FreePBX CDR + recordings + voicemail on the office box
 * and PUSHES them to the rcrsal portal. Read-only against the PBX. Outbound
 * HTTPS only. See README.md.
 *
 * Modes:
 *   node index.js                 continuous poll loop
 *   node index.js --once          one cycle then exit
 *   node index.js --dry-run       print events instead of POSTing (safe on live box)
 *   node index.js --since 2026-07-31   backfill from a date (idempotent)
 */

require('dotenv').config();
const mysql = require('mysql2/promise');
const { State } = require('./lib/state');
const { Portal } = require('./lib/portal');
const { aggregateCall } = require('./lib/util');
const { processRecording } = require('./lib/recordings');
const { scanVoicemail } = require('./lib/voicemail');

function parseArgs(argv) {
  const args = { dryRun: false, once: false, since: null };
  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === '--dry-run') args.dryRun = true;
    else if (argv[i] === '--once') args.once = true;
    else if (argv[i] === '--since') args.since = argv[++i];
  }
  return args;
}

function loadConfig() {
  const env = process.env;
  return {
    portalUrl: env.PORTAL_URL || 'https://rcrsal.com',
    apiKey: env.CALLS_WEBHOOK_API_KEY || '',
    db: {
      host: env.CDR_DB_HOST || '127.0.0.1',
      port: Number(env.CDR_DB_PORT || 3306),
      user: env.CDR_DB_USER || 'portal_bridge',
      password: env.CDR_DB_PASSWORD || '',
      database: env.CDR_DB_NAME || 'asteriskcdrdb',
    },
    pollInterval: Number(env.POLL_INTERVAL_SECONDS || 30) * 1000,
    settleSeconds: Number(env.SETTLE_SECONDS || 60),
    did: (env.PBX_DID || '2565154245').replace(/\D/g, ''),
    answeringService: (env.ANSWERING_SERVICE || '2566848240').replace(/\D/g, ''),
    extensions: (env.EXTENSIONS || '101,102,103,104,105,106,107,108').split(',').map((s) => s.trim()),
    recordingsEnabled: /^true$/i.test(env.RECORDINGS_ENABLED || ''),
    recordingDir: env.RECORDING_DIR || '/var/spool/asterisk/monitor',
    transcode: (env.RECORDING_TRANSCODE || 'opus').toLowerCase(),
    ffmpeg: env.FFMPEG_BIN || 'ffmpeg',
    voicemailEnabled: /^true$/i.test(env.VOICEMAIL_ENABLED || ''),
    voicemailDir: env.VOICEMAIL_DIR || '/var/spool/asterisk/voicemail/default',
    stateDir: env.STATE_DIR || './state',
  };
}

const CDR_COLUMNS =
  'DATE_FORMAT(calldate, \'%Y-%m-%d %H:%i:%s\') AS calldate_local, calldate, clid, src, dst, ' +
  'dcontext, channel, dstchannel, lastapp, disposition, billsec, uniqueid, linkedid, recordingfile, did, userfield';

async function runCycle(cfg, state, portal, pool, log) {
  const from = state.watermark || '2000-01-01 00:00:00';
  // Trailing 5-min re-look window makes late legs / corrections self-heal
  // (idempotent upserts absorb the re-processing).
  const [rows] = await pool.query(
    `SELECT ${CDR_COLUMNS} FROM cdr
       WHERE calldate >= (? - INTERVAL 300 SECOND)
         AND calldate <  (NOW() - INTERVAL ? SECOND)
       ORDER BY calldate ASC`,
    [from, cfg.settleSeconds],
  );

  if (rows.length === 0) return { calls: 0, maxCalldate: null };

  // Group legs by linkedid.
  const groups = new Map();
  let maxCalldate = state.watermark;
  for (const r of rows) {
    const key = r.linkedid || r.uniqueid;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(r);
    if (!maxCalldate || r.calldate_local > maxCalldate) maxCalldate = r.calldate_local;
  }

  const uploaded = new Set(state.data.uploadedRecordings || []);
  let emitted = 0;

  for (const [linkedid, legs] of groups) {
    const event = aggregateCall(legs, cfg);
    if (!event) continue;

    const res = await portal.postEvent(event);
    if (!res.ok && res.permanent) {
      state.deadLetter(event, `HTTP ${res.status}`);
    } else if (!res.ok) {
      // transient failure exhausted retries — dead-letter and keep going;
      // the trailing window will retry it next cycle anyway.
      state.deadLetter(event, `transient HTTP ${res.status}`);
    } else {
      emitted++;
    }

    // Recording: upload once per call, only if answered and we have a file.
    if (
      cfg.recordingsEnabled &&
      event.recordingfile &&
      event.event === 'call_end' &&
      !uploaded.has(linkedid)
    ) {
      const rec = await processRecording(portal, cfg, {
        callUuid: event.callUuid,
        recordingfile: event.recordingfile,
        ext: event.extension,
      });
      if (rec.ok) {
        await portal.postEvent({
          source: 'freepbx-bridge',
          event: 'recording_ready',
          linkedid: event.linkedid,
          callUuid: event.callUuid,
          from: event.from,
          to: event.to,
          direction: event.direction,
          timestamp: event.timestamp,
          recordingPath: rec.pathname,
          recordingUrl: rec.url,
        });
        uploaded.add(linkedid);
      } else {
        log.warn(`[rec] ${linkedid}: ${rec.reason || 'failed'}`);
      }
    }
  }

  // Persist upload set (cap to last 5000 to bound growth).
  state.data.uploadedRecordings = Array.from(uploaded).slice(-5000);
  if (maxCalldate) state.setWatermark(maxCalldate);
  return { calls: emitted, maxCalldate };
}

async function runVoicemail(cfg, state, portal, log) {
  const seen = new Set(state.data.seenVoicemail || []);
  const found = scanVoicemail(cfg, seen);
  for (const vm of found) {
    await portal.postEvent({
      source: 'freepbx-bridge',
      event: 'voicemail',
      linkedid: `vm-${vm.key}`,
      callUuid: `vm-${vm.key}`,
      from: vm.callerid.replace(/\D/g, ''),
      to: cfg.did,
      direction: 'inbound',
      extension: vm.extension,
      vmExtension: vm.extension,
      vmMsgId: vm.msgId,
      vmOrigTime: vm.origtime,
      vmDuration: vm.duration,
      timestamp: vm.origtime ? new Date(Number(vm.origtime) * 1000).toISOString() : new Date().toISOString(),
    });
    seen.add(vm.key);
  }
  state.data.seenVoicemail = Array.from(seen).slice(-5000);
  if (found.length) log.log(`[vm] ${found.length} new voicemail(s)`);
}

async function main() {
  const args = parseArgs(process.argv);
  const cfg = loadConfig();
  const log = console;

  if (!cfg.apiKey && !args.dryRun) {
    log.error('CALLS_WEBHOOK_API_KEY is not set. Refusing to run (use --dry-run to test without it).');
    process.exit(1);
  }

  const state = new State(cfg.stateDir);
  if (args.since) {
    state.data.watermark = `${args.since.slice(0, 10)} 00:00:00`;
    log.log(`Backfill: watermark set to ${state.data.watermark}`);
  }
  const portal = new Portal({ baseUrl: cfg.portalUrl, apiKey: cfg.apiKey, dryRun: args.dryRun, log });
  const pool = mysql.createPool({ ...cfg.db, connectionLimit: 2, timezone: 'local' });

  log.log(`RCR PBX Bridge starting — portal=${cfg.portalUrl} dryRun=${args.dryRun} recordings=${cfg.recordingsEnabled} voicemail=${cfg.voicemailEnabled}`);

  const cycle = async () => {
    try {
      const r = await runCycle(cfg, state, portal, pool, log);
      if (cfg.voicemailEnabled) await runVoicemail(cfg, state, portal, log);
      state.save();
      if (r.calls) log.log(`cycle: ${r.calls} call event(s), watermark=${state.watermark}`);
      if (!args.dryRun) await portal.heartbeat({ watermark: state.watermark });
    } catch (err) {
      log.error('cycle error:', err && err.message ? err.message : err);
    }
  };

  await cycle();
  if (args.once) {
    await pool.end();
    return;
  }
  const timer = setInterval(cycle, cfg.pollInterval);
  const shutdown = async () => {
    clearInterval(timer);
    await pool.end().catch(() => {});
    state.save();
    log.log('bridge stopped');
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((err) => {
  console.error('fatal:', err);
  process.exit(1);
});
