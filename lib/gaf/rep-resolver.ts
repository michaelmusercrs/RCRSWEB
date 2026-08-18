/**
 * Resolve a GAF report recipient to a canonical RCRS team member.
 *
 * GAF sends reports to reps on the @rivercityroofingsolutions.com domain, but
 * TEAM_MEMBERS are keyed on @rcrsal.com. The stable join key across both
 * domains is the local-part (the bit before @) — e.g. "greg". We match on that,
 * prefer an ACTIVE sales-capable member, and return the canonical name + email
 * to notify. Falls back to the raw GAF address when there's no roster hit.
 */

import { TEAM_MEMBERS } from '../team-roles';

export interface ResolvedRep {
  name: string;
  /** Canonical email to notify (roster email if matched, else the GAF address). */
  email: string;
  matched: boolean;
}

export function resolveRep(gafEmail: string, gafLocalPart: string): ResolvedRep {
  const lp = (gafLocalPart || (gafEmail.split('@')[0] || '')).trim().toLowerCase();
  if (!lp) return { name: '', email: gafEmail, matched: false };

  const hits = TEAM_MEMBERS.filter(m => (m.email.split('@')[0] || '').trim().toLowerCase() === lp);
  if (hits.length === 0) return { name: '', email: gafEmail, matched: false };

  // Prefer an active member if multiple share a local-part (unlikely).
  const pick = hits.find(m => m.isActive) || hits[0];
  return { name: pick.name, email: pick.email || gafEmail, matched: true };
}
