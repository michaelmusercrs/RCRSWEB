'use strict';

/**
 * Pure helpers for turning raw Asterisk CDR legs into ONE normalized call event
 * per real call. The hard fact this module encodes: a single inbound call is
 * ~10 CDR rows sharing a `linkedid` (each rung extension, each Google Voice
 * leg, the answering-service leg). We aggregate them, using the CDR(userfield)
 * stage labels the PBX now stamps (stage1/stage2/overflow/afterhours, gv:<ext>).
 */

const STAGE_LABELS = ['stage1', 'stage2', 'overflow', 'afterhours'];

/** Digits only; drop a leading US country code. */
function normalizeNum(v) {
  const d = String(v == null ? '' : v).replace(/\D/g, '');
  return d.length === 11 && d.startsWith('1') ? d.slice(1) : d;
}

/** Extract a bare number from an Asterisk clid like '"Jane Doe" <2565551212>'. */
function callerFromClid(clid) {
  const m = String(clid || '').match(/<([^>]+)>/);
  return normalizeNum(m ? m[1] : clid);
}
function nameFromClid(clid) {
  const m = String(clid || '').match(/"?([^"<]+?)"?\s*</);
  const n = (m ? m[1] : '').trim();
  return n && !/^\+?\d+$/.test(n) ? n : '';
}

/** Chicago-local {dow, minutes} for a Date, DST-correct. Mirrors the portal. */
function chicagoLocal(date) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Chicago', weekday: 'short', hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(date);
  const get = (t) => (parts.find((p) => p.type === t) || {}).value || '';
  const dow = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }[get('weekday')] ?? 0;
  let hour = parseInt(get('hour'), 10);
  if (hour === 24) hour = 0;
  return { dow, minutes: hour * 60 + parseInt(get('minute'), 10) };
}
const CLOSE_BY_DOW = { 1: 990, 2: 990, 3: 990, 4: 990, 5: 930 }; // Mon-Thu 16:30, Fri 15:30
function isBusinessHours(date) {
  const { dow, minutes } = chicagoLocal(date);
  const close = CLOSE_BY_DOW[dow];
  return close != null && minutes >= 480 && minutes < close;
}

/** Classify one leg's destination. cfg = { did, answeringService, extensions[] }. */
function classifyLeg(row, cfg) {
  const userfield = String(row.userfield || '').toLowerCase();
  const dst = normalizeNum(row.dst);
  if (userfield.startsWith('gv:')) {
    return { dstType: 'gv', ext: userfield.slice(3).replace(/\D/g, '') };
  }
  const rawDst = String(row.dst || '').replace(/\D/g, '');
  if (cfg.extensions.includes(rawDst)) return { dstType: 'ext', ext: rawDst };
  if (dst && dst === cfg.answeringService) return { dstType: 'answering_service', ext: '' };
  return { dstType: 'other', ext: '' };
}

function toIso(calldate) {
  // mysql2 returns a JS Date (interpreted in the Node process TZ, which on
  // Boston is America/Chicago). toISOString() yields correct UTC.
  const d = calldate instanceof Date ? calldate : new Date(calldate);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

/**
 * Aggregate all CDR legs of one linkedid into a normalized bridge event.
 * Returns null if the group can't be interpreted.
 */
function aggregateCall(rows, cfg) {
  if (!rows || rows.length === 0) return null;
  const sorted = rows.slice().sort((a, b) => new Date(a.calldate) - new Date(b.calldate));

  const classified = sorted.map((r) => ({ row: r, ...classifyLeg(r, cfg) }));

  // The inbound "spine" leg: it carries a stage label, or terminates our DID.
  const inbound =
    sorted.find((r) => STAGE_LABELS.includes(String(r.userfield || '').toLowerCase())) ||
    sorted.find((r) => normalizeNum(r.did) === cfg.did) ||
    null;

  const isInbound = !!inbound;
  const spine = inbound || sorted[0];
  const stageRaw = String(spine.userfield || '').toLowerCase();
  const stage = STAGE_LABELS.includes(stageRaw) ? stageRaw : '';

  // Who answered? Prefer a human leg (ext/gv) over the answering service.
  const answeredHuman = classified.find(
    (c) => String(c.row.disposition).toUpperCase() === 'ANSWERED' && (c.dstType === 'ext' || c.dstType === 'gv'),
  );
  const answeredService = classified.find(
    (c) => String(c.row.disposition).toUpperCase() === 'ANSWERED' && c.dstType === 'answering_service',
  );
  const answered = answeredHuman || answeredService || null;

  let answeredVia = null;
  if (answeredHuman) answeredVia = answeredHuman.dstType === 'gv' ? 'google_voice' : 'desk';
  else if (answeredService) answeredVia = 'answering_service';

  const wentToVoicemail = sorted.some((r) => String(r.lastapp || '').toLowerCase() === 'voicemail');

  let event;
  if (answered) event = 'call_end';
  else if (wentToVoicemail) event = 'voicemail';
  else event = 'call_missed';

  const timestamp = toIso(spine.calldate);
  if (!timestamp) return null;

  const answeringExt = answered ? (answered.ext || '') : '';
  const duration = answered ? Number(answered.row.billsec || 0) : 0;

  // Recording path (CDR(recordingfile) is set on the inbound spine only).
  const recordingfile = sorted.map((r) => r.recordingfile).find(Boolean) || '';

  const caller = callerFromClid(spine.clid) || normalizeNum(spine.src);
  const external = isInbound ? caller : normalizeNum(spine.dst);

  return {
    source: 'freepbx-bridge',
    event,
    linkedid: spine.linkedid || spine.uniqueid,
    callUuid: spine.linkedid || spine.uniqueid,
    direction: isInbound ? 'inbound' : 'outbound',
    from: isInbound ? external : normalizeNum(spine.src),
    to: isInbound ? cfg.did : external,
    callerIdName: nameFromClid(spine.clid),
    extension: answeringExt,
    stage: stage || undefined,
    answeredVia,
    disposition: String(spine.disposition || ''),
    inBusinessHours: isBusinessHours(new Date(spine.calldate)),
    duration,
    timestamp,
    recordingfile,
    legs: classified.map((c) => ({
      uniqueid: c.row.uniqueid,
      channel: c.row.channel || '',
      dst: String(c.row.dst || ''),
      dstType: c.dstType,
      disposition: String(c.row.disposition || ''),
      billsec: Number(c.row.billsec || 0),
      start: toIso(c.row.calldate),
    })),
  };
}

module.exports = {
  STAGE_LABELS,
  normalizeNum,
  callerFromClid,
  nameFromClid,
  isBusinessHours,
  classifyLeg,
  toIso,
  aggregateCall,
};
