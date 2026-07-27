/**
 * Unit-of-measure sanity check for material-order line items.
 *
 * HISTORY
 * -------
 * 2026-05-21: We added an auto-conversion here that divided Ridge Vent qty by
 * 4 (LF → stick) whenever the line "looked like" linear feet. The LF signal
 * was derived from the text next to the quantity — but that text included the
 * product NAME, and the Ridge Vent SKU is literally named "Ridge Vent 4LF".
 * The "4LF" is a fixed descriptor of the SKU (each stick spans 4 linear feet),
 * NOT a statement that the order was placed in linear feet. So the detector
 * fired on EVERY Ridge Vent line and quartered the quantity unconditionally.
 *
 * 2026-07-27: Confirmed with the owner that PMs order Ridge Vent in STICKS,
 * not linear feet. The auto-÷4 was therefore wrong almost everywhere — it
 * under-delivered normal orders 4× (40 sticks → 10) and collapsed edge cases
 * to zero (qty 1 → 0, qty 0 → 0), producing broken tickets (e.g. R-9559,
 * R-11266). We are removing the silent mutation entirely.
 *
 * NEW BEHAVIOR: this helper NEVER changes a quantity. It trusts the entered
 * stick count. Its only job now is to FLAG a line for human review when the
 * quantity is implausibly large for the stock unit (which usually means the
 * PM accidentally pasted linear feet). A human then decides — we never guess.
 *
 * Still the single chokepoint, invoked from:
 *   - lib/material-order-email-parser.ts (PDF → parsed line)
 *   - app/api/webhooks/material-order-email/route.ts (webhook ticket create)
 *   - app/api/portal/tickets/route.ts (portal manual ticket create)
 *
 * Backwards-compatible surface: callers read `.qty`, `.originalQty`,
 * `.converted`, `.reason`, `.warning`. `.converted` is now ALWAYS false —
 * we no longer mutate — but flagged lines carry `reason: 'flag_review'` and a
 * `.warning`.
 */

export type StockUnitOfMeasure =
  | 'each'
  | 'stick'
  | 'roll'
  | 'box'
  | 'bag'
  | 'bucket'
  | 'tube'
  | 'lb'
  | 'piece';

export interface UomHint {
  /** Canonical stock unit (what Inventory_Products.currentQty counts in). */
  unitOfMeasure: StockUnitOfMeasure;
  /**
   * Linear feet covered per stock unit. Retained for documentation only —
   * Ridge Vent 4LF = 4 (one stick = 4 LF). We no longer divide by it.
   */
  linearFeetPerUnit?: number;
  /**
   * Review threshold — if the entered qty exceeds this, it's suspiciously
   * large for the stock unit (likely pasted in linear feet) and gets flagged
   * for a human to eyeball. The quantity itself is NEVER changed.
   */
  suspiciousQtyThreshold?: number;
}

/**
 * Map of canonical productId → UoM hint. Keyed by INV-XXXX so legacy IDs
 * resolve through `resolveProductId()` first.
 *
 * Only SKUs that need a review flag belong here. Ridge Vent is stocked and
 * ordered by the stick; anything over ~60 sticks (240 LF of ridge) is worth a
 * human glance in case the number arrived as linear feet.
 */
export const INVENTORY_UOM_HINTS: Record<string, UomHint> = {
  'INV-0005': { unitOfMeasure: 'stick', linearFeetPerUnit: 4, suspiciousQtyThreshold: 60 },
};

// Legacy ID aliases — same hint surfaces under item-XXX and the old SKU code
// so callers that haven't resolved to INV-XXXX yet still get the flag.
INVENTORY_UOM_HINTS['item-127'] = INVENTORY_UOM_HINTS['INV-0005'];
INVENTORY_UOM_HINTS['VENT-RIDGE-4'] = INVENTORY_UOM_HINTS['INV-0005'];

/**
 * Resolve any incoming id (canonical INV-XXXX, legacy item-XXX, or a name
 * substring) to a UomHint, or null if the SKU has no hint registered.
 */
export function getUomHint(opts: {
  productId?: string;
  legacyId?: string;
  productName?: string;
}): UomHint | null {
  const { productId, legacyId, productName } = opts;
  if (productId && INVENTORY_UOM_HINTS[productId]) return INVENTORY_UOM_HINTS[productId];
  if (legacyId && INVENTORY_UOM_HINTS[legacyId]) return INVENTORY_UOM_HINTS[legacyId];
  // Name-substring fallback — only used when product hasn't been matched yet.
  if (productName && /ridge\s*vent/i.test(productName)) {
    return INVENTORY_UOM_HINTS['INV-0005'];
  }
  return null;
}

export interface NormalizeQtyResult {
  /** The qty in the canonical stock unit. We never mutate, so this always
   *  equals `originalQty`. Kept for a stable caller surface. */
  qty: number;
  /** The original (as-entered) qty. */
  originalQty: number;
  /** Why we did (or didn't) flag the line. */
  reason:
    | 'no_hint'        // SKU has no UoM hint registered — no-op
    | 'no_conversion'  // SKU has a hint and the qty looks fine — no-op
    | 'flag_review';   // qty implausibly large for the stock unit — flagged, NOT changed
  /**
   * Always false now — this helper no longer converts quantities. Retained so
   * existing callers that branch on `.converted` keep compiling. Flagged lines
   * are signalled via `reason === 'flag_review'` + `.warning` instead.
   */
  converted: boolean;
  /** Human-readable warning when the line is flagged for review. */
  warning?: string;
}

/**
 * Sanity-check a parsed material-order line item's qty. NEVER changes the
 * quantity — PMs order in the stock unit (e.g. Ridge Vent in sticks), so the
 * entered number is trusted. When the number is implausibly large for the
 * stock unit (usually a linear-feet paste), the line is FLAGGED for human
 * review and returned unchanged.
 */
export function normalizeLineItemQty(opts: {
  productId?: string;
  legacyId?: string;
  productName?: string;
  qty: number;
  /** Optional raw text from the PDF line. Unused now that we never auto-convert;
   *  kept in the signature so callers don't have to change. */
  adjacentText?: string;
  /** Kept for signature stability; no longer changes behavior. */
  forceCheck?: boolean;
}): NormalizeQtyResult {
  const originalQty = opts.qty;
  const hint = getUomHint(opts);
  if (!hint) {
    return { qty: originalQty, originalQty, reason: 'no_hint', converted: false };
  }

  // Flag-only: never mutate. Surface implausibly large quantities so a human
  // can confirm the SKU wasn't ordered in the wrong unit (e.g. linear feet
  // pasted where sticks were expected).
  const threshold = hint.suspiciousQtyThreshold;
  if (threshold && originalQty > threshold) {
    return {
      qty: originalQty,
      originalQty,
      reason: 'flag_review',
      converted: false,
      warning:
        `qty=${originalQty} is unusually large for ${opts.productName || opts.productId} ` +
        `(stock unit: ${hint.unitOfMeasure}, ~${threshold} max typical). ` +
        `Left AS-ENTERED — verify with the PM that it wasn't meant as linear feet ` +
        `(${hint.linearFeetPerUnit ? `${hint.linearFeetPerUnit} LF per ${hint.unitOfMeasure}` : 'check units'}).`,
    };
  }

  return { qty: originalQty, originalQty, reason: 'no_conversion', converted: false };
}

/**
 * True if a given qty for a given SKU exceeds the review threshold. Used by
 * sanity scans to flag existing tickets. Does not imply the qty is wrong —
 * only that a human should confirm the unit.
 */
export function isSuspectQty(opts: {
  productId?: string;
  legacyId?: string;
  productName?: string;
  qty: number;
}): boolean {
  const hint = getUomHint(opts);
  if (!hint || !hint.suspiciousQtyThreshold) return false;
  return opts.qty > hint.suspiciousQtyThreshold;
}
