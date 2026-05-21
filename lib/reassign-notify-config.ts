/**
 * Reassignment-notification recipient config.
 *
 * Reads data/reassign-notify-recipients.json. Provides:
 *   - getReassignNotifyRecipients() — list of {name, email} who get pinged
 *   - isReassignNotifyEnabled()      — env-gate; OFF by default until Michael flips
 *
 * Gating per stated rule (2026-05-21): "go ahead and push changes but
 * dont start sending emails or notifications or making JN changes yet."
 *
 * To enable: set env REASSIGN_NOTIFY_ENABLED=true.
 */
import fs from 'fs';
import path from 'path';

export interface ReassignRecipient {
  slug: string;
  name: string;
  email: string;
  enabled: boolean;
}

interface ReassignNotifyConfig {
  recipients: ReassignRecipient[];
}

const CONFIG_PATH = 'data/reassign-notify-recipients.json';

let _cache: ReassignNotifyConfig | null = null;
let _cacheLoadedAt = 0;
const CACHE_TTL_MS = 60_000;

function loadConfig(): ReassignNotifyConfig {
  if (_cache && Date.now() - _cacheLoadedAt < CACHE_TTL_MS) return _cache;
  try {
    const raw = fs.readFileSync(path.join(process.cwd(), CONFIG_PATH), 'utf-8');
    _cache = JSON.parse(raw);
    _cacheLoadedAt = Date.now();
    return _cache!;
  } catch (err) {
    console.warn('[ReassignNotifyConfig] failed to load — using empty recipient list:', err);
    return { recipients: [] };
  }
}

export function getReassignNotifyRecipients(): ReassignRecipient[] {
  return loadConfig().recipients.filter(r => r.enabled);
}

export function isReassignNotifyEnabled(): boolean {
  return process.env.REASSIGN_NOTIFY_ENABLED === 'true';
}

export function invalidateReassignNotifyCache(): void {
  _cache = null;
  _cacheLoadedAt = 0;
}
