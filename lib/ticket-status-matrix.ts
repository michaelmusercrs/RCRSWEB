/**
 * Ticket status-change safety matrix (pure, unit-testable).
 *
 * Rick asked for an easy way to fix a mis-clicked status. The hazard: stock is
 * deducted + the invoice/breakdown are written exactly once when a ticket
 * crosses into `load_verified` (the "verify-load" action, via
 * load-verified-aftermath). So a free-for-all status editor could double-deduct
 * or skip the deduction. This matrix defines exactly which plain "set-status"
 * moves are safe — the ones with NO financial side effects — and forces the two
 * boundary crossings through their dedicated, side-effect-aware actions:
 *
 *   PRE  ── verify-load ──▶  POST        (deducts + invoices; NOT a plain move)
 *   POST ── undo-verify-load ─▶ PRE      (reverses deduction; NOT a plain move)
 *
 * PRE  = before stock leaves: created, assigned, materials_pulled
 * POST = stock committed:     load_verified, en_route, arrived, delivered,
 *                             proof_captured, qc_photos, completed
 *
 * Within a zone, any move is safe (no deduction change) — backward moves just
 * require a reason note for the audit trail. Crossing the PRE/POST boundary via
 * set-status is refused with a hint pointing to the right action.
 */

import type { TicketStatus } from './ticket-sheet-service';

export const PRE_ZONE: TicketStatus[] = ['created', 'assigned', 'materials_pulled'];
export const POST_ZONE: TicketStatus[] = [
  'load_verified', 'en_route', 'arrived', 'delivered', 'proof_captured', 'qc_photos', 'completed',
];

// Canonical forward order for "is this a backward move?" detection.
const ORDER: TicketStatus[] = [...PRE_ZONE, ...POST_ZONE];
const orderIndex = (s: TicketStatus): number => ORDER.indexOf(s);

// The ONLY statuses set-status is allowed to touch. Anything else — an unzoned
// status like 'picked_up', or an unvalidated garbage string cast to TicketStatus
// — must be refused so it can't two-hop across the PRE/POST boundary and bypass
// verify-load / undo-verify-load (their inventory side effects).
const KNOWN_STATUSES = new Set<string>([...ORDER, 'cancelled']);

const inPre = (s: TicketStatus) => PRE_ZONE.includes(s);
const inPost = (s: TicketStatus) => POST_ZONE.includes(s);

/** Roles allowed to use the status-changer at all. */
const OPERATOR_ROLES = new Set(['driver', 'office', 'admin', 'owner', 'manager']);
/** Roles allowed to move backward, cancel, or reopen (not drivers). */
const SUPERVISOR_ROLES = new Set(['office', 'admin', 'owner', 'manager']);

export interface MoveEvaluation {
  ok: boolean;
  /** When true, the caller must supply a non-empty reason note. */
  requiresReason: boolean;
  /** Human-readable refusal reason (only when ok=false). */
  error?: string;
  /** Points the user at the correct action when a boundary crossing is refused. */
  hint?: string;
}

/**
 * Evaluate a single plain set-status move. Does NOT consider inventory rows —
 * it only permits moves that can't change the deduction state.
 */
export function evaluateMove(
  current: TicketStatus,
  target: TicketStatus,
  role: string,
): MoveEvaluation {
  if (!OPERATOR_ROLES.has(role)) {
    return { ok: false, requiresReason: false, error: 'Your role cannot change ticket status.' };
  }
  // Refuse any status this tool doesn't govern (unzoned like 'picked_up', or an
  // unvalidated string). Prevents a two-hop boundary bypass through an unzoned
  // status. Boundary crossings must use verify-load / undo-verify-load.
  if (!KNOWN_STATUSES.has(target)) {
    return { ok: false, requiresReason: false, error: `"${target}" is not a status you can set here.` };
  }
  if (!KNOWN_STATUSES.has(current)) {
    return { ok: false, requiresReason: false, error: `This ticket's status ("${current}") can't be changed with this tool.` };
  }
  if (current === target) {
    return { ok: false, requiresReason: false, error: 'Ticket is already in that status.' };
  }

  // Cancel handling.
  if (target === 'cancelled') {
    if (!SUPERVISOR_ROLES.has(role)) {
      return { ok: false, requiresReason: false, error: 'Only office/admin can cancel a ticket.' };
    }
    if (inPost(current)) {
      return {
        ok: false,
        requiresReason: false,
        error: 'This ticket already has stock deducted.',
        hint: 'Use "Undo verify-load" first to restore inventory, then cancel.',
      };
    }
    return { ok: true, requiresReason: true }; // reason for the cancel
  }

  // Reopen a cancelled ticket back to the start.
  if (current === 'cancelled') {
    if (target !== 'created') {
      return { ok: false, requiresReason: false, error: 'A cancelled ticket can only be reopened to "created".' };
    }
    if (!SUPERVISOR_ROLES.has(role)) {
      return { ok: false, requiresReason: false, error: 'Only office/admin can reopen a cancelled ticket.' };
    }
    return { ok: true, requiresReason: true };
  }

  // Boundary crossings are refused here — they have inventory side effects.
  if (inPre(current) && inPost(target)) {
    return {
      ok: false,
      requiresReason: false,
      error: 'That would commit stock.',
      hint: 'Use "Verify Load" — it deducts inventory and creates the invoice.',
    };
  }
  if (inPost(current) && inPre(target)) {
    return {
      ok: false,
      requiresReason: false,
      error: 'This ticket already has stock deducted.',
      hint: 'Use "Undo verify-load" to restore inventory and move it back.',
    };
  }

  // Same-zone move — always safe. Backward needs a reason + supervisor role.
  const backward = orderIndex(target) < orderIndex(current);
  if (backward && !SUPERVISOR_ROLES.has(role)) {
    return { ok: false, requiresReason: false, error: 'Only office/admin can move a ticket backward.' };
  }
  return { ok: true, requiresReason: backward };
}

/** The set of target statuses a user in `role` may move `current` to via set-status. */
export function allowedTargets(current: TicketStatus, role: string): TicketStatus[] {
  const candidates: TicketStatus[] = [...PRE_ZONE, ...POST_ZONE, 'cancelled'];
  return candidates.filter(t => evaluateMove(current, t, role).ok);
}
