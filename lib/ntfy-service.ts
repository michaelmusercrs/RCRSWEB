/**
 * ntfy.sh Push Notification Service (Phase 4)
 *
 * Free, open-source push channel. Default: https://ntfy.sh (hosted public
 * instance). Can be pointed at a self-hosted instance via NTFY_BASE_URL.
 *
 * Topic naming convention (one topic per role):
 *   rcrs-office     — Tia, billing-related
 *   rcrs-warehouse  — PM/Bart, stage events
 *   rcrs-drivers    — Rick, Travis, route + load
 *   rcrs-admin      — Michael, Chris, Sara
 *   rcrs-billing    — invoicing events
 *
 * No SDK — ntfy is a plain POST. Fire-and-forget; failures are logged but
 * never block the caller. Topics are deliberately open by default; teams
 * subscribe via the ntfy mobile app or web UI by typing the topic name.
 *
 * Per Michael's memory: this is the chosen push channel. NOT Pushover, NOT
 * Twilio — those are paid SaaS and rejected for this codebase.
 */

const DEFAULT_BASE = 'https://ntfy.sh';

export type NtfyPriority = 1 | 2 | 3 | 4 | 5; // 1=min, 3=default, 5=urgent

export type NtfyRoleTopic = 'office' | 'warehouse' | 'drivers' | 'admin' | 'billing';

export interface NtfyPushOptions {
  /** 1..5; default 3 */
  priority?: NtfyPriority;
  /** Comma-separated tags (used as emoji on most ntfy clients) */
  tags?: string[];
  /** Optional click-through URL when the user taps the notification */
  clickUrl?: string;
  /** Quiet hours: if true and current time is 8 PM..7 AM, downgrade to priority 1 */
  respectQuietHours?: boolean;
}

const ROLE_TOPIC_MAP: Record<NtfyRoleTopic, string> = {
  office: 'rcrs-office',
  warehouse: 'rcrs-warehouse',
  drivers: 'rcrs-drivers',
  admin: 'rcrs-admin',
  billing: 'rcrs-billing',
};

export function getBaseUrl(): string {
  return process.env.NTFY_BASE_URL?.replace(/\/+$/, '') || DEFAULT_BASE;
}

/**
 * Resolve a role to its topic name. Per-role overrides via env vars
 * (NTFY_TOPIC_OFFICE, NTFY_TOPIC_WAREHOUSE, etc.) take precedence — lets
 * admins move teams to custom topics without code changes.
 */
export function topicForRole(role: NtfyRoleTopic): string {
  const envKey = `NTFY_TOPIC_${role.toUpperCase()}`;
  const fromEnv = process.env[envKey];
  return fromEnv && fromEnv.trim() ? fromEnv.trim() : ROLE_TOPIC_MAP[role];
}

/**
 * Map a pipeline `notifyRole` (admin/owner/office/billing/pm/warehouse/driver)
 * to the closest ntfy topic role.
 */
export function roleTopicFor(notifyRole: string): NtfyRoleTopic | null {
  switch (notifyRole) {
    case 'admin':
    case 'owner':
      return 'admin';
    case 'office':
      return 'office';
    case 'billing':
      return 'billing';
    case 'warehouse':
    case 'pm':
      return 'warehouse';
    case 'driver':
      return 'drivers';
    default:
      return null;
  }
}

function isQuietHour(d: Date = new Date()): boolean {
  const h = d.getHours();
  // 8 PM (20) through 7 AM (<7): quiet
  return h >= 20 || h < 7;
}

/**
 * Send a push notification to an ntfy topic. Fire-and-forget — never throws.
 * Returns true if the request was made and 2xx came back, false otherwise.
 */
export async function pushNotification(
  topic: string,
  title: string,
  message: string,
  options: NtfyPushOptions = {},
): Promise<boolean> {
  if (!topic) return false;
  const base = getBaseUrl();
  let priority: NtfyPriority = options.priority ?? 3;
  if (options.respectQuietHours && isQuietHour() && priority > 1) {
    priority = 1; // downgrade so it doesn't buzz at 2 AM
  }
  const headers: Record<string, string> = {
    'Content-Type': 'text/plain; charset=utf-8',
    Title: encodeRfc2047(title),
    Priority: String(priority),
  };
  if (options.tags && options.tags.length > 0) {
    headers.Tags = options.tags.join(',');
  }
  if (options.clickUrl) {
    headers.Click = options.clickUrl;
  }

  try {
    const url = `${base}/${encodeURIComponent(topic)}`;
    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: message,
    });
    if (!res.ok) {
      console.error('[ntfy] push failed', res.status, await res.text().catch(() => ''));
      return false;
    }
    return true;
  } catch (err) {
    console.error('[ntfy] push exception:', err);
    return false;
  }
}

/**
 * Send the same notification to a set of roles. Deduplicates topics so a
 * role pair like ['admin', 'owner'] only delivers once.
 */
export async function pushToRoles(
  roles: NtfyRoleTopic[],
  title: string,
  message: string,
  options: NtfyPushOptions = {},
): Promise<{ topic: string; ok: boolean }[]> {
  const topics = Array.from(new Set(roles.map(topicForRole)));
  return Promise.all(
    topics.map(async topic => ({
      topic,
      ok: await pushNotification(topic, title, message, options),
    })),
  );
}

/**
 * Adapter object for Phase 5 callers (predictive-stock cron) that use a
 * sendToRoles({title, message, priority, tags, ...}) object-payload style.
 * Maps string priority ('min'|'low'|'default'|'high'|'max') to Phase 4's
 * numeric NtfyPriority scale.
 */
type Phase5Priority = 'min' | 'low' | 'default' | 'high' | 'max';
const PRIORITY_MAP: Record<Phase5Priority, NtfyPriority> = {
  min: 1, low: 2, default: 3, high: 4, max: 5,
};

interface Phase5SendOptions {
  title: string;
  message: string;
  priority?: Phase5Priority | NtfyPriority;
  tags?: string[];
  clickUrl?: string;
}

export const ntfyService = {
  async sendToRoles(
    roles: NtfyRoleTopic[],
    opts: Phase5SendOptions,
  ): Promise<{ topic: string; ok: boolean }[]> {
    const numericPriority: NtfyPriority | undefined =
      typeof opts.priority === 'string'
        ? PRIORITY_MAP[opts.priority]
        : opts.priority;
    return pushToRoles(roles, opts.title, opts.message, {
      priority: numericPriority,
      tags: opts.tags,
      clickUrl: opts.clickUrl,
    });
  },
};

/**
 * RFC 2047 encode the title header. ntfy is OK with plain ASCII, but emoji
 * and accented chars in titles need =?UTF-8?B?...?= or they get mangled
 * client-side. Simplest safe path: base64-utf8 encode anything non-ASCII.
 */
function encodeRfc2047(s: string): string {
  if (!s) return '';
  // eslint-disable-next-line no-control-regex
  if (/^[\x00-\x7F]*$/.test(s)) return s;
  const b64 = Buffer.from(s, 'utf-8').toString('base64');
  return `=?UTF-8?B?${b64}?=`;
}
