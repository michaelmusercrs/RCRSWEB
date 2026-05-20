/**
 * RCRS FreePBX Integration Service
 *
 * Talks to the on-prem FreePBX 16+ server running on the owner's son's
 * Ubuntu box. Two transport layers are supported, in priority order:
 *
 *   1. REST API (`/admin/api/api/*`) — added in FreePBX 16, requires the
 *      "API" module + an API Key generated from
 *      Admin → System Admin → API.
 *   2. Asterisk Manager Interface (AMI) — TCP socket on port 5038
 *      configured in `manager.conf`. We don't speak AMI from inside
 *      Next.js (would need a long-lived socket), so for now the AMI
 *      transport just records the request and returns stubbed data.
 *      Use a side-car daemon (planned in docs/phone-system-roadmap.md)
 *      if/when REST isn't available.
 *
 * ---------------------------------------------------------------------------
 * Required environment variables (all optional — if unset, the service
 * returns empty arrays / stub responses + logs `[FREEPBX NOT CONFIGURED]`
 * so the UI never crashes when env hasn't been provisioned):
 *
 *   FREEPBX_URL          - https://freepbx.local:8443  (or owner's WAN/Tailscale)
 *   FREEPBX_API_USER     - usually `admin`
 *   FREEPBX_API_KEY      - generated under Admin → API
 *   FREEPBX_API_SECRET   - optional, FreePBX 16+ uses a token bearer scheme
 *   FREEPBX_RECORDINGS_BASE - base URL for stored MP3/WAV recordings (CDR)
 *
 * ---------------------------------------------------------------------------
 * Exports:
 *   - isFreePbxConfigured()
 *   - listExtensions()
 *   - getExtensionStatus(ext)
 *   - listQueues()
 *   - getQueueStatus(queueId)
 *   - listCallRoutes()             — inbound routes + time conditions
 *   - getCallLog({ ext?, since? })
 *   - originateCall({ fromExt, toNumber })
 *   - listRecordings({ ext?, since? })
 *   - getRecording(recordingId)
 *   - listVoipNumbers()            — provider DIDs from env (owner-provided)
 *
 * Every function returns a `{ ok, data, source, error? }` envelope so the
 * UI can render even when FreePBX is unreachable.
 */

// ============================================================================
// TYPES
// ============================================================================

export interface FreePbxEnvelope<T> {
  ok: boolean;
  /** Where the data came from: real FreePBX, env-config, or local stub */
  source: 'freepbx-rest' | 'freepbx-ami' | 'env' | 'stub';
  data: T;
  error?: string;
}

export type ExtensionDevice = 'mobile' | 'desk' | 'softphone' | 'unknown';
export type ExtensionRegistration =
  | 'registered'
  | 'unregistered'
  | 'in-call'
  | 'ringing'
  | 'dnd'
  | 'unknown';

export interface FreePbxExtension {
  extension: string;
  name: string;
  device: ExtensionDevice;
  registration: ExtensionRegistration;
  /** Queues this extension is a member of */
  queueIds: string[];
  /** Calls handled today (CDR count) */
  callsToday: number;
  /** Whether DND is currently engaged */
  dnd: boolean;
  /** Optional secret/secret hash (NEVER returned to client) */
  voicemailEnabled?: boolean;
}

export interface FreePbxQueue {
  queueId: string;
  name: string;
  strategy: string;
  members: { extension: string; paused: boolean }[];
  waitingCalls: number;
  avgWaitSeconds: number;
  abandonRate: number;
  /** Calls completed today through this queue */
  completedToday: number;
}

export interface FreePbxRoute {
  routeId: string;
  name: string;
  /** DID the route is tied to (E.164 or 10-digit) */
  did: string;
  /** Destination — queue, ring group, IVR, etc. */
  destination: string;
  /** Time-of-day conditions */
  timeCondition?: {
    name: string;
    matches: string[];
    matchedDestination: string;
    unmatchedDestination: string;
  };
  /** After-hours fallback destination */
  afterHours?: string;
  enabled: boolean;
}

export interface FreePbxCallLogEntry {
  callId: string;
  startTime: string;
  endTime: string;
  duration: number;
  direction: 'inbound' | 'outbound';
  from: string;
  to: string;
  ext: string;
  status: 'answered' | 'no-answer' | 'busy' | 'failed' | 'voicemail';
  recordingId?: string;
  notes?: string;
}

export interface FreePbxRecording {
  recordingId: string;
  callId: string;
  date: string;
  duration: number;
  from: string;
  to: string;
  url: string;
  /** Size in bytes if known */
  sizeBytes?: number;
}

export interface FreePbxVoipNumber {
  did: string;
  label: string;
  /** Route or extension this DID rings */
  ringsTo: string;
  /** Provider e.g. Twilio, VoIP.ms, Bandwidth */
  provider: string;
  status: 'active' | 'inactive' | 'unknown';
  monthlyCostUsd: number;
}

// ============================================================================
// ENV / CONFIG
// ============================================================================

function getEnv() {
  return {
    url: process.env.FREEPBX_URL?.trim() || '',
    user: process.env.FREEPBX_API_USER?.trim() || 'admin',
    key: process.env.FREEPBX_API_KEY?.trim() || '',
    secret: process.env.FREEPBX_API_SECRET?.trim() || '',
    recordingsBase: process.env.FREEPBX_RECORDINGS_BASE?.trim() || '',
    /**
     * Owner-provided list of VoIP DIDs as JSON in `FREEPBX_VOIP_NUMBERS`.
     * Format: `[{"did":"+12565154245","label":"Main","ringsTo":"queue:600","provider":"VoIP.ms","status":"active","monthlyCostUsd":0.99}]`
     */
    voipNumbersJson: process.env.FREEPBX_VOIP_NUMBERS?.trim() || '',
  };
}

export function isFreePbxConfigured(): boolean {
  const e = getEnv();
  return !!(e.url && e.key);
}

function notConfigured(label: string): void {
  // Single source of truth for the warning, deliberately not noisy.
  // The UI is allowed to call these on every render in dev, so we
  // suppress in production-build to keep logs clean.
  if (process.env.NODE_ENV !== 'production') {
    // eslint-disable-next-line no-console
    console.warn(`[FREEPBX NOT CONFIGURED] ${label} — set FREEPBX_URL + FREEPBX_API_KEY`);
  }
}

// ============================================================================
// REST CLIENT
// ============================================================================

/**
 * Low-level REST call to FreePBX.
 *
 * FreePBX 16+ exposes a Bearer-token REST API at `/admin/api/api/`.
 * Auth header format: `Authorization: Bearer <key>:<secret>` (or just
 * `<key>` if no secret pair). Token TTL is 60min — we don't cache it
 * because requests are infrequent (admin dashboard).
 */
async function freepbxFetch<T = unknown>(
  path: string,
  init: RequestInit = {},
): Promise<{ ok: true; data: T } | { ok: false; error: string }> {
  const env = getEnv();
  if (!env.url || !env.key) {
    return { ok: false, error: 'FreePBX not configured' };
  }

  const token = env.secret ? `${env.key}:${env.secret}` : env.key;
  const url = `${env.url.replace(/\/+$/, '')}/admin/api/api${path.startsWith('/') ? '' : '/'}${path}`;

  try {
    const res = await fetch(url, {
      ...init,
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        ...(init.headers || {}),
      },
      // FreePBX boxes are slow — give them room. AbortSignal.timeout is
      // node 18+, which Next 14 already targets.
      signal: AbortSignal.timeout(10_000),
    });

    if (!res.ok) {
      return { ok: false, error: `FreePBX ${res.status}: ${await safeText(res)}` };
    }
    const json = (await res.json()) as T;
    return { ok: true, data: json };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'FreePBX request failed',
    };
  }
}

async function safeText(res: Response): Promise<string> {
  try {
    return (await res.text()).slice(0, 200);
  } catch {
    return '<unreadable body>';
  }
}

// ============================================================================
// EXTENSIONS
// ============================================================================

export async function listExtensions(): Promise<FreePbxEnvelope<FreePbxExtension[]>> {
  if (!isFreePbxConfigured()) {
    notConfigured('listExtensions');
    return { ok: true, source: 'stub', data: [] };
  }

  // FreePBX 16+: GET /admin/api/api/extensions
  // Returns { status: 'success', extensions: [{ extension, name, ... }] }
  const res = await freepbxFetch<{ extensions?: RawExtension[] }>('/extensions');
  if (!res.ok) {
    return { ok: false, source: 'freepbx-rest', data: [], error: res.error };
  }

  const raw = res.data.extensions || [];
  const mapped: FreePbxExtension[] = raw.map(r => ({
    extension: String(r.extension ?? r.user ?? ''),
    name: String(r.name ?? r.callerid ?? ''),
    device: classifyDevice(String(r.tech ?? r.deviceType ?? '')),
    registration: classifyRegistration(r),
    queueIds: Array.isArray(r.queues) ? r.queues.map(String) : [],
    callsToday: Number(r.cdrCount ?? 0),
    dnd: Boolean(r.dnd),
    voicemailEnabled: Boolean(r.voicemail),
  }));
  return { ok: true, source: 'freepbx-rest', data: mapped };
}

interface RawExtension {
  extension?: string | number;
  user?: string | number;
  name?: string;
  callerid?: string;
  tech?: string;
  deviceType?: string;
  state?: string;
  registered?: boolean;
  inCall?: boolean;
  dnd?: boolean;
  voicemail?: boolean;
  queues?: (string | number)[];
  cdrCount?: number;
}

function classifyDevice(tech: string): ExtensionDevice {
  const t = tech.toLowerCase();
  if (t.includes('sip') || t.includes('pjsip')) {
    // Heuristic: extensions 5xx commonly mobile, others desk.
    // Without a tag from FreePBX we can't be sure, so default to softphone.
    return 'softphone';
  }
  if (t.includes('iax')) return 'desk';
  if (t.includes('dahdi')) return 'desk';
  if (t.includes('mobile')) return 'mobile';
  return 'unknown';
}

function classifyRegistration(r: RawExtension): ExtensionRegistration {
  if (r.dnd) return 'dnd';
  if (r.inCall) return 'in-call';
  if (r.state === 'ringing') return 'ringing';
  if (r.registered === false) return 'unregistered';
  if (r.registered === true) return 'registered';
  if (r.state === 'available' || r.state === 'idle') return 'registered';
  return 'unknown';
}

export async function getExtensionStatus(
  ext: string,
): Promise<FreePbxEnvelope<FreePbxExtension | null>> {
  if (!isFreePbxConfigured()) {
    notConfigured(`getExtensionStatus(${ext})`);
    return { ok: true, source: 'stub', data: null };
  }
  const list = await listExtensions();
  if (!list.ok) return { ok: false, source: 'freepbx-rest', data: null, error: list.error };
  return {
    ok: true,
    source: list.source,
    data: list.data.find(e => e.extension === ext) ?? null,
  };
}

// ============================================================================
// QUEUES
// ============================================================================

export async function listQueues(): Promise<FreePbxEnvelope<FreePbxQueue[]>> {
  if (!isFreePbxConfigured()) {
    notConfigured('listQueues');
    return { ok: true, source: 'stub', data: [] };
  }

  const res = await freepbxFetch<{ queues?: RawQueue[] }>('/queues');
  if (!res.ok) {
    return { ok: false, source: 'freepbx-rest', data: [], error: res.error };
  }

  const mapped: FreePbxQueue[] = (res.data.queues || []).map(q => ({
    queueId: String(q.queue ?? q.id ?? ''),
    name: String(q.descr ?? q.name ?? ''),
    strategy: String(q.strategy ?? 'ringall'),
    members: (q.members || []).map(m => ({
      extension: String(m.extension ?? m.interface ?? ''),
      paused: Boolean(m.paused),
    })),
    waitingCalls: Number(q.waiting ?? 0),
    avgWaitSeconds: Number(q.avgWait ?? 0),
    abandonRate: Number(q.abandonRate ?? 0),
    completedToday: Number(q.completedToday ?? 0),
  }));
  return { ok: true, source: 'freepbx-rest', data: mapped };
}

interface RawQueue {
  id?: string | number;
  queue?: string | number;
  name?: string;
  descr?: string;
  strategy?: string;
  members?: { extension?: string | number; interface?: string; paused?: boolean }[];
  waiting?: number;
  avgWait?: number;
  abandonRate?: number;
  completedToday?: number;
}

export async function getQueueStatus(
  queueId: string,
): Promise<FreePbxEnvelope<FreePbxQueue | null>> {
  if (!isFreePbxConfigured()) {
    notConfigured(`getQueueStatus(${queueId})`);
    return { ok: true, source: 'stub', data: null };
  }
  const all = await listQueues();
  if (!all.ok) return { ok: false, source: 'freepbx-rest', data: null, error: all.error };
  return {
    ok: true,
    source: all.source,
    data: all.data.find(q => q.queueId === queueId) ?? null,
  };
}

// ============================================================================
// CALL ROUTES
// ============================================================================

export async function listCallRoutes(): Promise<FreePbxEnvelope<FreePbxRoute[]>> {
  if (!isFreePbxConfigured()) {
    notConfigured('listCallRoutes');
    return { ok: true, source: 'stub', data: [] };
  }

  const res = await freepbxFetch<{ routes?: RawRoute[] }>('/inbound-routes');
  if (!res.ok) {
    return { ok: false, source: 'freepbx-rest', data: [], error: res.error };
  }

  const mapped: FreePbxRoute[] = (res.data.routes || []).map(r => ({
    routeId: String(r.id ?? ''),
    name: String(r.description ?? r.didDescription ?? ''),
    did: String(r.didnumber ?? r.did ?? ''),
    destination: String(r.destination ?? ''),
    enabled: r.enabled !== false,
    timeCondition: r.timeCondition
      ? {
          name: String(r.timeCondition.name ?? ''),
          matches: Array.isArray(r.timeCondition.matches)
            ? r.timeCondition.matches.map(String)
            : [],
          matchedDestination: String(r.timeCondition.match ?? ''),
          unmatchedDestination: String(r.timeCondition.unmatch ?? ''),
        }
      : undefined,
    afterHours: r.afterHours ? String(r.afterHours) : undefined,
  }));
  return { ok: true, source: 'freepbx-rest', data: mapped };
}

interface RawRoute {
  id?: string | number;
  description?: string;
  didDescription?: string;
  didnumber?: string;
  did?: string;
  destination?: string;
  enabled?: boolean;
  afterHours?: string;
  timeCondition?: {
    name?: string;
    matches?: string[];
    match?: string;
    unmatch?: string;
  };
}

// ============================================================================
// CALL LOG (CDR)
// ============================================================================

export async function getCallLog(
  opts: { ext?: string; since?: string; limit?: number } = {},
): Promise<FreePbxEnvelope<FreePbxCallLogEntry[]>> {
  const limit = Math.min(opts.limit ?? 50, 500);

  if (!isFreePbxConfigured()) {
    notConfigured('getCallLog');
    return { ok: true, source: 'stub', data: [] };
  }

  const params = new URLSearchParams();
  params.set('limit', String(limit));
  if (opts.ext) params.set('extension', opts.ext);
  if (opts.since) params.set('since', opts.since);

  const res = await freepbxFetch<{ cdr?: RawCdr[] }>(`/cdr?${params.toString()}`);
  if (!res.ok) {
    return { ok: false, source: 'freepbx-rest', data: [], error: res.error };
  }

  const mapped: FreePbxCallLogEntry[] = (res.data.cdr || []).map(c => ({
    callId: String(c.uniqueid ?? c.id ?? ''),
    startTime: String(c.calldate ?? ''),
    endTime: String(c.endtime ?? ''),
    duration: Number(c.billsec ?? c.duration ?? 0),
    direction: deriveDirection(c),
    from: String(c.src ?? ''),
    to: String(c.dst ?? ''),
    ext: String(c.cnum ?? c.extension ?? ''),
    status: mapDisposition(c.disposition ?? ''),
    recordingId: c.recordingfile ? String(c.recordingfile) : undefined,
  }));
  return { ok: true, source: 'freepbx-rest', data: mapped };
}

interface RawCdr {
  id?: string | number;
  uniqueid?: string;
  calldate?: string;
  endtime?: string;
  duration?: number;
  billsec?: number;
  src?: string;
  dst?: string;
  cnum?: string;
  extension?: string;
  disposition?: string;
  recordingfile?: string;
  context?: string;
}

function deriveDirection(c: RawCdr): 'inbound' | 'outbound' {
  const ctx = (c.context || '').toLowerCase();
  if (ctx.includes('from-internal') || ctx.includes('outbound')) return 'outbound';
  return 'inbound';
}

function mapDisposition(d: string): FreePbxCallLogEntry['status'] {
  const v = d.toUpperCase();
  if (v === 'ANSWERED') return 'answered';
  if (v === 'NO ANSWER' || v === 'NOANSWER') return 'no-answer';
  if (v === 'BUSY') return 'busy';
  if (v === 'FAILED') return 'failed';
  if (v.includes('VOICEMAIL')) return 'voicemail';
  return 'no-answer';
}

// ============================================================================
// ORIGINATE (CLICK-TO-CALL)
// ============================================================================

export interface OriginateRequest {
  fromExt: string;
  toNumber: string;
  /** Optional caller-id override */
  callerId?: string;
  /** Optional tag to surface in CDR + Sheets log */
  context?: {
    customerName?: string;
    customerId?: string;
    jobNumber?: string;
    notes?: string;
  };
}

export interface OriginateResult {
  callId: string;
  /** What FreePBX returned, if anything */
  message: string;
}

export async function originateCall(
  req: OriginateRequest,
): Promise<FreePbxEnvelope<OriginateResult | null>> {
  if (!isFreePbxConfigured()) {
    notConfigured(`originateCall(${req.fromExt} → ${req.toNumber})`);
    return {
      ok: true,
      source: 'stub',
      data: {
        callId: `stub-${Date.now()}`,
        message: 'FreePBX not configured — call not placed (stub)',
      },
    };
  }

  // FreePBX 16+ REST: POST /admin/api/api/originate
  // body: { channel, extension, ... }
  const res = await freepbxFetch<{ uniqueid?: string; message?: string }>(`/originate`, {
    method: 'POST',
    body: JSON.stringify({
      channel: `Local/${req.fromExt}@from-internal`,
      extension: normalizeDial(req.toNumber),
      context: 'from-internal',
      priority: 1,
      callerid: req.callerId || req.fromExt,
      timeout: 30_000,
      async: true,
    }),
  });

  if (!res.ok) {
    return { ok: false, source: 'freepbx-rest', data: null, error: res.error };
  }
  return {
    ok: true,
    source: 'freepbx-rest',
    data: {
      callId: res.data.uniqueid || `freepbx-${Date.now()}`,
      message: res.data.message || 'originated',
    },
  };
}

function normalizeDial(n: string): string {
  const d = n.replace(/\D/g, '');
  if (d.length === 10) return `1${d}`;
  if (d.length === 11 && d.startsWith('1')) return d;
  return d;
}

// ============================================================================
// RECORDINGS
// ============================================================================

export async function listRecordings(
  opts: { ext?: string; since?: string; limit?: number } = {},
): Promise<FreePbxEnvelope<FreePbxRecording[]>> {
  if (!isFreePbxConfigured()) {
    notConfigured('listRecordings');
    return { ok: true, source: 'stub', data: [] };
  }

  const log = await getCallLog({ ext: opts.ext, since: opts.since, limit: opts.limit });
  if (!log.ok) {
    return { ok: false, source: 'freepbx-rest', data: [], error: log.error };
  }

  const base = getEnv().recordingsBase;
  const recordings: FreePbxRecording[] = log.data
    .filter(c => !!c.recordingId)
    .map(c => ({
      recordingId: c.recordingId!,
      callId: c.callId,
      date: c.startTime,
      duration: c.duration,
      from: c.from,
      to: c.to,
      url: buildRecordingUrl(base, c.recordingId!),
    }));
  return { ok: true, source: 'freepbx-rest', data: recordings };
}

function buildRecordingUrl(base: string, file: string): string {
  if (!base) return '';
  return `${base.replace(/\/+$/, '')}/${encodeURIComponent(file)}`;
}

export async function getRecording(
  recordingId: string,
): Promise<FreePbxEnvelope<FreePbxRecording | null>> {
  if (!isFreePbxConfigured()) {
    notConfigured(`getRecording(${recordingId})`);
    return { ok: true, source: 'stub', data: null };
  }
  const all = await listRecordings({ limit: 500 });
  if (!all.ok) {
    return { ok: false, source: 'freepbx-rest', data: null, error: all.error };
  }
  return {
    ok: true,
    source: all.source,
    data: all.data.find(r => r.recordingId === recordingId) ?? null,
  };
}

// ============================================================================
// VOIP NUMBERS (provider-managed DIDs)
// ============================================================================

/**
 * VoIP DIDs aren't owned by FreePBX — they're owned by the upstream SIP
 * provider (Twilio, VoIP.ms, Bandwidth, etc.). FreePBX just routes them.
 * Owner has the canonical list. We accept it as JSON in
 * `FREEPBX_VOIP_NUMBERS` so it can be edited without a deploy.
 */
export function listVoipNumbers(): FreePbxEnvelope<FreePbxVoipNumber[]> {
  const env = getEnv();
  if (!env.voipNumbersJson) {
    notConfigured('listVoipNumbers (FREEPBX_VOIP_NUMBERS env)');
    return { ok: true, source: 'stub', data: [] };
  }
  try {
    const parsed = JSON.parse(env.voipNumbersJson);
    if (!Array.isArray(parsed)) {
      return { ok: false, source: 'env', data: [], error: 'FREEPBX_VOIP_NUMBERS is not a JSON array' };
    }
    const list: FreePbxVoipNumber[] = parsed.map(n => ({
      did: String(n.did || ''),
      label: String(n.label || ''),
      ringsTo: String(n.ringsTo || ''),
      provider: String(n.provider || 'unknown'),
      status: (['active', 'inactive', 'unknown'] as const).includes(n.status)
        ? n.status
        : 'unknown',
      monthlyCostUsd: Number(n.monthlyCostUsd ?? 0),
    }));
    return { ok: true, source: 'env', data: list };
  } catch (err) {
    return {
      ok: false,
      source: 'env',
      data: [],
      error: err instanceof Error ? err.message : 'Failed to parse FREEPBX_VOIP_NUMBERS',
    };
  }
}
