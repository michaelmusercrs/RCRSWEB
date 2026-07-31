/**
 * Phone data authorization — who may see which calls/voicemails.
 *
 * Fixes a pre-existing exposure: every /api/calls/* route gated only on
 * requireAuth(), so ANY logged-in employee (drivers, viewers included) could
 * read the entire call log and every recording reference. This centralizes the
 * rule so the routes apply it consistently.
 *
 *   owner | admin | manager  → ALL calls, recordings, analytics
 *   sales | office           → only calls involving THEIR extension
 *   everyone else            → nothing (no phone module)
 *
 * Join key is email (@rcrsal.com), the stable identity on the JWT, matched to
 * the canonical extension seed. Scope is enforced by filtering results, so it
 * holds regardless of any repId/repExtension query param a caller supplies.
 */

import { EXTENSION_SEED } from './phone-system-config';

export type PhoneScope =
  | { level: 'all' }
  | { level: 'own'; extension: string | null }
  | { level: 'none' };

const ALL_ROLES = ['owner', 'admin', 'manager'];
const OWN_ROLES = ['sales', 'office'];

/** The desk extension owned by a given email, or null. */
export function extensionForEmail(email: string | undefined): string | null {
  const e = (email || '').trim().toLowerCase();
  if (!e) return null;
  const seed = EXTENSION_SEED.find(s => s.email && s.email.toLowerCase() === e);
  return seed?.extension || null;
}

export function getPhoneScope(user: { role?: string; email?: string } | null | undefined): PhoneScope {
  const role = (user?.role || '').toLowerCase();
  if (ALL_ROLES.includes(role)) return { level: 'all' };
  if (OWN_ROLES.includes(role)) return { level: 'own', extension: extensionForEmail(user?.email) };
  return { level: 'none' };
}

/** True if callers with this scope may view management/aggregate analytics. */
export function scopeCanViewAll(scope: PhoneScope): boolean {
  return scope.level === 'all';
}

type ScopableCall = {
  repExtension?: string;
  legs?: { dst?: string }[];
};

/** Whether a scope permits viewing one specific call. */
export function scopeAllowsCall(scope: PhoneScope, call: ScopableCall): boolean {
  if (scope.level === 'all') return true;
  if (scope.level === 'none') return false;
  const ext = scope.extension;
  if (!ext) return false;
  if (call.repExtension === ext) return true;
  if (Array.isArray(call.legs) && call.legs.some(l => l?.dst === ext)) return true;
  return false;
}

/** Filter a list of calls to those the scope permits ([] for 'none'). */
export function filterCallsByScope<T extends ScopableCall>(scope: PhoneScope, calls: T[]): T[] {
  if (scope.level === 'all') return calls;
  if (scope.level === 'none') return [];
  return calls.filter(c => scopeAllowsCall(scope, c));
}
