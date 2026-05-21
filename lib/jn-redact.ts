/**
 * JobNimbus Read-Time Cost Privacy Redactor
 *
 * Per docs/research-crm-comparison.md moat #3 + feedback_purchase_price_visibility:
 * material purchase cost, margin, supplier price, and similar fields MUST be
 * stripped from any JN read result before it reaches a caller who isn't on
 * the cost-visibility allowlist (owner / admin / office / manager + Richard).
 *
 * This module is the single chokepoint. Every read function in lib/jobnimbus-*.ts
 * pipes its result through one of the redactors below.
 *
 * Failure mode is FAIL-SAFE: if `viewerCanSeeCost` is missing/undefined, we
 * treat the viewer as NOT allowed and strip the fields. This is the inverse
 * of the JN webhook fail-open bug — when in doubt, restrict.
 *
 * IMPORTANT: fields are DELETED (not nulled). They must not appear in the
 * JSON serialization at all, so a client cannot infer existence from a null.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * CACHE-KEY DISCIPLINE (M4, docs/2026-05-20-verification-pass.md):
 *
 * If you cache any JN-derived response at the API-route layer, the cache key
 * MUST include the viewer's `canSeeCost` flag (or role). Otherwise the first
 * caller to populate the cache fixes the redaction state for every subsequent
 * caller, and a rep can hit an owner-tier (cost-bearing) cache entry — or
 * vice-versa, an owner gets a redacted entry.
 *
 * Canonical pattern (see app/api/sheets/customers/route.ts:173):
 *
 *     const cacheKey = `jn:thing:${id}:cost=${viewer.canSeeCost ? '1' : '0'}`;
 *
 * As of 2026-05-20 the only route-level cache over JN data lives in
 * `app/api/sheets/customers/route.ts`. Other JN reads (calendar events,
 * customer messages, geocoded stats, etc.) cache non-cost-bearing
 * projections, but any NEW route that adds a `cache.set` over JN-derived
 * data must include the `:cost=0|1` suffix in the key.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { canSeeCost } from './cost-visibility';

export type JNObject = Record<string, unknown>;

/**
 * Canonical list of cost-sensitive field names. Add aliases as JN / our
 * mappers introduce new ones. snake_case + camelCase both included because
 * JN raw responses use snake_case and our wrappers re-emit camelCase.
 */
export const COST_FIELD_NAMES: ReadonlySet<string> = new Set([
  // generic
  'cost',
  'unitCost',
  'unit_cost',
  'lineCost',
  'line_cost',
  'totalCost',
  'total_cost',
  'costBasis',
  'cost_basis',
  'costPrice',
  'cost_price',
  'ourCost',
  'our_cost',
  // purchase / supplier
  'purchasePrice',
  'purchase_price',
  'supplierCost',
  'supplier_cost',
  'vendorCost',
  'vendor_cost',
  'wholesale',
  'wholesalePrice',
  'wholesale_price',
  // material / labor breakouts
  'materialCost',
  'material_cost',
  'laborCost',
  'labor_cost',
  // margin / profit / markup
  'margin',
  'marginAmount',
  'margin_amount',
  'marginPercent',
  'margin_percent',
  'profit',
  'profitAmount',
  'profit_amount',
  'markup',
  'markupAmount',
  'markup_amount',
  'markupPercent',
  'markup_percent',
]);

const COST_FIELD_PREFIXES = ['_internal_', '_admin_'];

function isCostFieldName(key: string): boolean {
  if (COST_FIELD_NAMES.has(key)) return true;
  for (const prefix of COST_FIELD_PREFIXES) {
    if (key.startsWith(prefix)) return true;
  }
  return false;
}

/**
 * Shallow redact: strips cost-named keys from the top level of a single
 * object. Use only when you know the structure is one-level (rare — prefer
 * the deep version). Does not mutate input.
 */
export function redactCostFields<T extends JNObject>(
  obj: T,
  viewerCanSeeCost: boolean,
): T {
  if (viewerCanSeeCost) return obj;
  if (obj === null || obj === undefined) return obj;
  if (typeof obj !== 'object') return obj;

  const out: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(obj)) {
    if (isCostFieldName(key)) continue;
    out[key] = val;
  }
  return out as T;
}

/**
 * Deep redact: recurses into nested objects and arrays. This is the default
 * for all JN read functions because JN responses are nested
 * (job → estimates → line_items each with their own cost fields).
 *
 * Does not mutate input. Returns a structurally fresh object/array.
 * Leaves alone: primitives, Date, null, undefined.
 */
export function redactCostFieldsDeep<T>(value: T, viewerCanSeeCost: boolean): T {
  if (viewerCanSeeCost) return value;
  if (value === null || value === undefined) return value;
  if (typeof value !== 'object') return value;
  if (value instanceof Date) return value;

  if (Array.isArray(value)) {
    return value.map(item => redactCostFieldsDeep(item, viewerCanSeeCost)) as unknown as T;
  }

  const out: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
    if (isCostFieldName(key)) continue;
    out[key] = redactCostFieldsDeep(val, viewerCanSeeCost);
  }
  return out as T;
}

/**
 * Convenience helper for paginated/list endpoints that return arrays of
 * objects. Equivalent to `list.map(item => redactCostFieldsDeep(item, ...))`.
 */
export function redactCostInList<T extends JNObject>(
  list: T[],
  viewerCanSeeCost: boolean,
): T[] {
  if (viewerCanSeeCost) return list;
  if (!Array.isArray(list)) return list;
  return list.map(item => redactCostFieldsDeep(item, viewerCanSeeCost));
}

// =============================================================================
// Viewer helpers
// =============================================================================

/**
 * Lightweight viewer descriptor. Pass this into every JN read function.
 * `canSeeCost` is the authoritative bit — derive it from the requestor's
 * role at the API boundary via `canSeeCost(user.role)` from cost-visibility.ts.
 *
 * For internal/background consumers (load-verified aftermath, sara's email
 * pipeline) that legitimately need cost, pass `{ canSeeCost: true }`
 * explicitly. NEVER default true.
 */
export interface JNViewer {
  canSeeCost: boolean;
}

/**
 * Identity slugs/emails that get cost visibility regardless of role.
 * Mirrors the allowlist in lib/auth-service.ts:requireRoleAtLeast — Richard
 * Geahr is role=driver but explicitly on the cost-visibility allowlist per
 * feedback_purchase_price_visibility.
 */
const COST_VISIBLE_IDENTITIES: ReadonlySet<string> = new Set([
  'richard',
  'richard@rcrsal.com',
]);

/**
 * Build a viewer from a user role string (e.g. from requireAuth().user.role).
 * Convenience for API routes — keeps the fail-safe semantics centralized.
 *
 * Optional `identity` (email/userId/slug) opts in identity-based overrides
 * (e.g. Richard Geahr, role=driver, is on the cost allowlist).
 */
export function viewerForRole(
  role: string | undefined | null,
  identity?: { email?: string | null; userId?: string | null } | null,
): JNViewer {
  if (canSeeCost(role)) return { canSeeCost: true };

  const email = (identity?.email || '').toLowerCase();
  const userId = (identity?.userId || '').toLowerCase();
  if (COST_VISIBLE_IDENTITIES.has(email) || COST_VISIBLE_IDENTITIES.has(userId)) {
    return { canSeeCost: true };
  }
  return { canSeeCost: false };
}

/**
 * Resolve the effective `canSeeCost` bit from an optional viewer. Fail-safe:
 * if viewer is missing/undefined, returns false (strip the cost).
 */
export function effectiveCanSeeCost(viewer?: JNViewer | null): boolean {
  return viewer?.canSeeCost === true;
}
