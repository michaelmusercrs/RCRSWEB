/**
 * ntfy.sh Push Notification Service
 *
 * Free open-source push to phones/desktops via topic subscriptions on
 * ntfy.sh (or a self-hosted ntfy server). Matches Michael's
 * "default to free + open source" preference (see memory).
 *
 * Recipients install the ntfy app, subscribe to their role topic, and
 * receive push notifications without any account/API key/cost.
 *
 * Topic naming convention:
 *   rcrs-office      — office staff (Sara, Tia, etc.)
 *   rcrs-warehouse   — Rick, drivers, warehouse
 *   rcrs-drivers     — driver-only (subset)
 *   rcrs-admin       — Michael, Chris (owners), Sara
 *   rcrs-pm          — Bart, John, project managers
 *
 * Override the base URL with NTFY_BASE_URL (defaults to https://ntfy.sh).
 * Override the topic prefix with NTFY_TOPIC_PREFIX (defaults to "rcrs-").
 *
 * Failures are logged but never thrown — push is best-effort.
 */

const NTFY_BASE_URL = (process.env.NTFY_BASE_URL || 'https://ntfy.sh').replace(/\/$/, '');
const NTFY_TOPIC_PREFIX = process.env.NTFY_TOPIC_PREFIX || 'rcrs-';
const NTFY_ACCESS_TOKEN = process.env.NTFY_ACCESS_TOKEN; // optional; only needed for ACL'd topics

export type NtfyRole = 'office' | 'warehouse' | 'drivers' | 'admin' | 'pm';

export type NtfyPriority = 'min' | 'low' | 'default' | 'high' | 'max';

export interface NtfyPayload {
  /** Topic name, or pass a role to resolve via NTFY_TOPIC_PREFIX. */
  topic?: string;
  role?: NtfyRole;
  /** Notification title (bold heading). */
  title: string;
  /** Body text. */
  message: string;
  /** ntfy "priority" — controls badge + sound on the device. */
  priority?: NtfyPriority;
  /** Tag emojis/keywords (e.g. ['warning', 'inventory']). */
  tags?: string[];
  /** Optional click URL (deep link into the portal). */
  clickUrl?: string;
}

export interface NtfySendResult {
  ok: boolean;
  topic: string;
  status?: number;
  error?: string;
}

function topicForRole(role: NtfyRole): string {
  return `${NTFY_TOPIC_PREFIX}${role}`;
}

/**
 * Send a single notification to a topic.
 * Best-effort: never throws. Returns a result object the caller can log.
 */
export async function sendNtfy(payload: NtfyPayload): Promise<NtfySendResult> {
  const topic = payload.topic ?? (payload.role ? topicForRole(payload.role) : '');
  if (!topic) {
    return { ok: false, topic: '', error: 'topic or role required' };
  }

  const headers: Record<string, string> = {
    'Content-Type': 'text/plain; charset=utf-8',
    'Title': payload.title,
    'Priority': payload.priority || 'default',
  };
  if (payload.tags && payload.tags.length > 0) {
    headers['Tags'] = payload.tags.join(',');
  }
  if (payload.clickUrl) {
    headers['Click'] = payload.clickUrl;
  }
  if (NTFY_ACCESS_TOKEN) {
    headers['Authorization'] = `Bearer ${NTFY_ACCESS_TOKEN}`;
  }

  try {
    const res = await fetch(`${NTFY_BASE_URL}/${encodeURIComponent(topic)}`, {
      method: 'POST',
      headers,
      body: payload.message,
      // Don't hang the cron forever if ntfy.sh is degraded
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      return { ok: false, topic, status: res.status, error: text.slice(0, 200) };
    }
    return { ok: true, topic, status: res.status };
  } catch (err) {
    return {
      ok: false,
      topic,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * Fan out a notification to multiple roles in parallel.
 * Returns one result per role so the caller knows what landed.
 */
export async function sendNtfyToRoles(
  roles: NtfyRole[],
  payload: Omit<NtfyPayload, 'topic' | 'role'>,
): Promise<NtfySendResult[]> {
  const unique = Array.from(new Set(roles));
  return Promise.all(unique.map(role => sendNtfy({ ...payload, role })));
}

export const ntfyService = {
  send: sendNtfy,
  sendToRoles: sendNtfyToRoles,
  topicForRole,
};
