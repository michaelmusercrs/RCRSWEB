/**
 * RCRS Phone System — canonical call-flow config (versioned, code-owned)
 *
 * This file MIRRORS the authoritative dialplan on the office PBX
 * (/etc/asterisk/extensions_custom.conf on machine "Boston"). It is the ONE
 * place in the portal where the physical phone topology lives — extensions,
 * Google Voice legs, ring stages, business hours, DIDs, answering service.
 *
 * WHY code, not a Sheet: this must stay in lock-step with the dialplan, which
 * only changes via a deliberate, reviewed action on the PBX side. A standing
 * agreement (the "change-notification protocol") requires the Boston session to
 * notify us the same day it changes stages/hours/DIDs so we bump CONFIG_VERSION
 * here. Editable, drifting per-employee data (a reassigned extension, a new GV
 * number, a swapped desk phone) lives instead in the `Phone_Extensions` sheet
 * via lib/phone-directory.ts, which layers on top of the EXTENSION_SEED below.
 *
 * Read-only invariant: the portal NEVER changes call flow. This config only
 * lets analytics reason about what "stage 1", "overflow", and "after hours"
 * mean for a given call.
 *
 * Source of truth confirmed by the Boston PBX session 2026-07-31.
 */

export const CONFIG_VERSION = '2026-07-31.1';

// -----------------------------------------------------------------------------
// DIDs / key numbers (digits-only, no country code — matches normalizePhone())
// -----------------------------------------------------------------------------
export const PHONE_NUMBERS = {
  /** Published business number (Telco Depot, forwards to `did`; VoIP.ms port in progress) */
  published: '2562748530',
  /** Active VoIP.ms DID that actually terminates at the PBX */
  did: '2565154245',
  /** Overflow + after-hours answering service */
  answeringService: '2566848240',
} as const;

// -----------------------------------------------------------------------------
// Business hours (America/Chicago). Mon–Thu 08:00–16:30, Fri 08:00–15:30.
// -----------------------------------------------------------------------------
export const BUSINESS_TZ = 'America/Chicago';

/** Closing minute-of-day per weekday (0=Sun..6=Sat); undefined = closed all day. */
const CLOSE_MINUTE_BY_DOW: Record<number, number | undefined> = {
  0: undefined,          // Sun closed
  1: 16 * 60 + 30,       // Mon 16:30
  2: 16 * 60 + 30,       // Tue 16:30
  3: 16 * 60 + 30,       // Wed 16:30
  4: 16 * 60 + 30,       // Thu 16:30
  5: 15 * 60 + 30,       // Fri 15:30
  6: undefined,          // Sat closed
};
const OPEN_MINUTE = 8 * 60; // 08:00 every open day

/** Chicago-local {dow, minutes} for an instant, TZ-correct across DST. */
function chicagoLocal(date: Date): { dow: number; minutes: number } {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: BUSINESS_TZ,
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(date);
  const get = (t: string) => parts.find(p => p.type === t)?.value ?? '';
  const dowMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  const dow = dowMap[get('weekday')] ?? 0;
  let hour = parseInt(get('hour'), 10);
  if (hour === 24) hour = 0; // hour12:false can emit "24" at midnight in some environments
  const minute = parseInt(get('minute'), 10);
  return { dow, minutes: hour * 60 + minute };
}

/** True if the instant falls inside published business hours (Central). */
export function isBusinessHours(date: Date = new Date()): boolean {
  const { dow, minutes } = chicagoLocal(date);
  const close = CLOSE_MINUTE_BY_DOW[dow];
  if (close === undefined) return false;
  return minutes >= OPEN_MINUTE && minutes < close;
}

// -----------------------------------------------------------------------------
// Ring stages — the two-stage hunt the PBX runs on in-hours inbound calls.
// STAGE 1 rings the front line + their GV for 10s; STAGE 2 adds everyone else
// for 15s more; then the call overflows to the answering service.
// -----------------------------------------------------------------------------
export const RING_STAGES = {
  stage1: { extensions: ['104', '105', '103', '107'], ringGoogleVoice: true, seconds: 10 },
  stage2: { addExtensions: ['101', '102', '106', '108'], ringGoogleVoice: true, seconds: 15 },
  overflow: { destination: 'answering_service' as const, seconds: 30 },
  afterHours: { destination: 'answering_service' as const },
} as const;

export type CallStage = 'stage1' | 'stage2' | 'overflow' | 'afterhours';
export type AnsweredVia = 'desk' | 'google_voice' | 'answering_service' | null;

// -----------------------------------------------------------------------------
// Extension SEED — canonical default topology. The editable source of truth is
// the `Phone_Extensions` sheet (lib/phone-directory.ts), which starts from this
// seed. `slug`/`email` join to lib/team-roles.ts TEAM_MEMBERS (@rcrsal.com).
// Voicemail PINs are DELIBERATELY absent (secrets; pattern is 1+ext). Phone IPs
// are DELIBERATELY absent (DHCP-drifting; resolved by MAC on the PBX side).
// -----------------------------------------------------------------------------
export interface ExtensionSeed {
  extension: string;
  slug: string;          // '' for unassigned (ext 108)
  name: string;
  email: string;         // '' for unassigned
  googleVoice: string;   // digits-only; '' if none
  mac: string;           // desk phone MAC (lowercase, no separators); '' if TBD
}

export const EXTENSION_SEED: ExtensionSeed[] = [
  { extension: '101', slug: 'michael-muse', name: 'Michael Muse', email: 'michaelmuse@rcrsal.com', googleVoice: '2562034189', mac: '000b82e8e298' },
  { extension: '102', slug: 'chris-muse',   name: 'Chris Muse',   email: 'chrismuse@rcrsal.com',   googleVoice: '6617483724', mac: 'c074ad2bf328' },
  { extension: '103', slug: 'sara-hill',    name: 'Sara Hill',    email: 'sara@rcrsal.com',        googleVoice: '2562034283', mac: '000b82e8e268' },
  { extension: '104', slug: 'tia',          name: 'Tia Muse Morris', email: 'tia@rcrsal.com',      googleVoice: '6786698676', mac: '000b82e8e63d' },
  { extension: '105', slug: 'destin',       name: 'Destin Mccary', email: 'destin@rcrsal.com',     googleVoice: '5594245776', mac: '000b82e8e63f' },
  { extension: '106', slug: 'john',         name: 'John Cordonis', email: 'john@rcrsal.com',        googleVoice: '6267655843', mac: '000b82e8e295' },
  { extension: '107', slug: 'bart',         name: 'Bart Roberts',  email: 'bart@rcrsal.com',        googleVoice: '8142042042', mac: '000b82e8e29b' },
  { extension: '108', slug: '',             name: 'Portable (unassigned)', email: '',               googleVoice: '',           mac: '' },
];

/** Canonical seed lookup by extension. */
export function seedForExtension(extension: string): ExtensionSeed | null {
  return EXTENSION_SEED.find(e => e.extension === String(extension).trim()) || null;
}

/** All extensions that ring at some stage, in ring order. */
export const ALL_EXTENSIONS: string[] = [
  ...RING_STAGES.stage1.extensions,
  ...RING_STAGES.stage2.addExtensions,
].filter((v, i, a) => a.indexOf(v) === i);

// -----------------------------------------------------------------------------
// Verified feature codes (confirmed live by the Boston session 2026-07-31).
// Display ONLY these — every other FreePBX default (*72 etc.) is NOT implemented
// in the hand-rolled dialplan and must not be shown as if it works.
// -----------------------------------------------------------------------------
export const FEATURE_CODES = [
  { code: '*97', label: 'Check your own voicemail', note: 'First use forces a greeting recording. PIN = 1 + your extension.' },
  { code: '*1XX', label: "Send a caller to an extension's voicemail", note: 'e.g. *103 transfers the caller straight to ext 103\'s mailbox.' },
  { code: '*43', label: 'Echo test', note: 'Plays your audio back to you — handy for checking a handset.' },
] as const;

// -----------------------------------------------------------------------------
// Data-availability watermarks — the portal must not imply history it lacks.
// CDRs exist since March 2026, but per-stage LABELING and call RECORDINGS only
// began at today's cutover. Show "available since" notices in the UI.
// -----------------------------------------------------------------------------
export const DATA_AVAILABILITY = {
  /** Inbound call recordings first captured (~12:45 CT, 2026-07-31). */
  recordingsSince: '2026-07-31T12:45:00-05:00',
  /** Per-leg stage labeling (CDR userfield) went live (~13:00 CT, 2026-07-31). */
  stageLabelingSince: '2026-07-31T13:00:00-05:00',
  /** Raw call detail records reach back to roughly this date (unlabeled). */
  cdrSince: '2026-03-01T00:00:00-06:00',
} as const;
