/**
 * Unit-of-measure normalization for material-order line items.
 *
 * Background (2026-05-21): the material-order PDF parser was accepting Ridge
 * Vent qty in LINEAR FEET, but the inventory + legacy log count Ridge Vent in
 * STICKS (each Ridge Vent 4LF unit is a 4-LF stick). Four tickets this week
 * shipped with 4× the intended stick count:
 *
 *   TKT-R-10923 (Chuck)   qty=88  → 22 sticks
 *   TKT-R-10993 (Joy)     qty=88  → 22 sticks
 *   TKT-R-10997 (Leanna)  qty=48  → 12 sticks
 *   TKT-R-11223 (Brenda)  qty=40  → 10 sticks
 *
 * This helper is the single chokepoint for converting a parsed line item's
 * qty to the canonical stock UoM. It's invoked from:
 *   - lib/material-order-email-parser.ts (PDF → parsed line)
 *   - app/api/webhooks/material-order-email/route.ts (webhook ticket create)
 *   - app/api/portal/tickets/route.ts (portal manual ticket create)
 *
 * Backwards-compatible: if a SKU has no UoM hint, the helper is a no-op and
 * returns the qty unchanged. Tickets that were already correct (typical
 * stick counts of 5–40) are not touched.
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
   * Linear feet covered per stock unit. Only set for SKUs sold by length.
   * Ridge Vent 4LF = 4 (one stick = 4 LF). Most other SKUs are sold each /
   * by roll / by box and DO NOT set this field.
   */
  linearFeetPerUnit?: number;
  /**
   * Heuristic threshold — if parsed qty exceeds this, it's suspiciously
   * large for the stock unit and likely arrived in linear feet. Used as the
   * fallback trigger when the PDF text doesn't say "LF" explicitly.
   */
  suspiciousQtyThreshold?: number;
}

/**
 * Map of canonical productId → UoM hint. Keyed by INV-XXXX so legacy IDs
 * resolve through `resolveProductId()` first.
 *
 * NOTE: Only SKUs whose stock unit differs from their natural quoting unit
 * need an entry here. Most items (boots, sealant, nails) are sold each /
 * by box and never need conversion — leave them off the map.
 */
export const INVENTORY_UOM_HINTS: Record<string, UomHint> = {
  // Ridge Vent: 4 LF per stick. Real orders typically 5–40 sticks.
  // 88 LF, 48 LF, 40 LF are linear-feet entries — divide by 4.
  'INV-0005': { unitOfMeasure: 'stick', linearFeetPerUnit: 4, suspiciousQtyThreshold: 50 },
};

// Legacy ID aliases — same hint surfaces under item-XXX and the old SKU code
// so callers that haven't resolved to INV-XXXX yet still get the conversion.
INVENTORY_UOM_HINTS['item-127'] = INVENTORY_UOM_HINTS['INV-0005'];
INVENTORY_UOM_HINTS['VENT-RIDGE-4'] = INVENTORY_UOM_HINTS['INV-0005'];

/** True when the surrounding PDF text indicates the qty was in linear feet. */
function textImpliesLinearFeet(adjacentText?: string): boolean {
  if (!adjacentText) return false;
  return /\b(LF|linear[- ]?feet|linear[- ]?foot|lin[. ]?ft|\s+ft\b)\b/i.test(adjacentText);
}

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
  /** Normalized qty in the canonical stock unit. */
  qty: number;
  /** The original (un-converted) qty. */
  originalQty: number;
  /**
   * Why the conversion fired (or didn't). Useful for logging + the
   * LineItemAnomalies sheet.
   */
  reason:
    | 'no_hint'           // SKU has no UoM hint registered — no-op
    | 'no_conversion'     // SKU has a hint but the qty looks fine
    | 'explicit_lf_text'  // PDF text said "LF" — confident convert
    | 'heuristic_threshold' // qty > threshold for an LF-based SKU — fallback convert
    | 'still_suspicious'; // converted qty STILL looks suspicious (fail-loud)
  /** True when the value was actually changed. */
  converted: boolean;
  /** Human-readable warning when the result is suspicious. */
  warning?: string;
}

/**
 * Normalize a parsed material-order line item's qty into the canonical
 * stock unit. Idempotent: a qty already in the canonical unit is returned
 * unchanged. Order-of-precedence:
 *
 *   1. No UoM hint registered for this SKU → no-op.
 *   2. PDF text adjacent to the qty contains "LF"/"linear feet" → divide by
 *      `linearFeetPerUnit`. This is the high-confidence path.
 *   3. SKU has `linearFeetPerUnit` AND qty > `suspiciousQtyThreshold` →
 *      divide by `linearFeetPerUnit` and flag as heuristic. This is the
 *      observed-pattern fallback (this week's 4 tickets had Ridge Vent qty
 *      40, 48, 88, 88 — all > 50 except Brenda's 40, which gets caught by
 *      the explicit threshold edge case).
 *   4. Otherwise, leave qty unchanged.
 *
 * Post-conversion, if the result STILL exceeds the threshold (would require
 * a double-conversion to land in a sane range), return `still_suspicious`
 * with the converted value but flag it for human review.
 */
export function normalizeLineItemQty(opts: {
  productId?: string;
  legacyId?: string;
  productName?: string;
  qty: number;
  /** Optional raw text from the PDF line — used to detect "LF" markers. */
  adjacentText?: string;
  /**
   * If true, lower the heuristic-threshold trigger. Used by manual
   * portal-form submissions where the PM can also click an LF radio button
   * (future hook — not implemented yet).
   */
  forceCheck?: boolean;
}): NormalizeQtyResult {
  const originalQty = opts.qty;
  const hint = getUomHint(opts);
  if (!hint) {
    return { qty: originalQty, originalQty, reason: 'no_hint', converted: false };
  }
  // SKU has a hint but no linear-feet conversion → no-op for now (future:
  // could handle 'lb' vs 'each' for nails-by-weight, etc).
  if (!hint.linearFeetPerUnit) {
    return { qty: originalQty, originalQty, reason: 'no_conversion', converted: false };
  }

  // High-confidence: PDF text says "LF" near the qty
  if (textImpliesLinearFeet(opts.adjacentText)) {
    const converted = Math.round(originalQty / hint.linearFeetPerUnit);
    const result: NormalizeQtyResult = {
      qty: converted,
      originalQty,
      reason: 'explicit_lf_text',
      converted: true,
    };
    if (hint.suspiciousQtyThreshold && converted > hint.suspiciousQtyThreshold) {
      result.reason = 'still_suspicious';
      result.warning = `Even after LF→stick conversion (÷${hint.linearFeetPerUnit}), qty=${converted} still exceeds the sane threshold (${hint.suspiciousQtyThreshold}) for ${opts.productName || opts.productId}. Human review required.`;
    }
    return result;
  }

  // Heuristic fallback: qty too large for this stock unit → auto-convert
  const threshold = hint.suspiciousQtyThreshold ?? 50;
  if (originalQty > threshold) {
    const converted = Math.round(originalQty / hint.linearFeetPerUnit);
    const result: NormalizeQtyResult = {
      qty: converted,
      originalQty,
      reason: 'heuristic_threshold',
      converted: true,
      warning: `qty=${originalQty} exceeds suspicious-threshold ${threshold} for ${opts.productName || opts.productId} (stock unit: ${hint.unitOfMeasure}). Auto-converted to ${converted} ${hint.unitOfMeasure}s by ÷${hint.linearFeetPerUnit}. Verify with PM if unexpected.`,
    };
    if (converted > threshold) {
      result.reason = 'still_suspicious';
      result.warning = `After ÷${hint.linearFeetPerUnit} conversion, qty=${converted} ${hint.unitOfMeasure}s STILL exceeds threshold ${threshold} for ${opts.productName || opts.productId}. Human review required.`;
    }
    return result;
  }

  // Edge case: forceCheck triggered or PDF text was ambiguous but qty looks
  // sane — leave alone.
  return { qty: originalQty, originalQty, reason: 'no_conversion', converted: false };
}

/**
 * Returns true if a given qty for a given SKU exceeds the sane threshold.
 * Used by the Step-5 sanity scan to flag any existing tickets for review.
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
