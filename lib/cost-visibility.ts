/**
 * Cost Visibility Guard
 *
 * HARD RULE (see feedback_purchase_price_visibility.md): material PURCHASE
 * cost — what we paid the supplier — must NEVER reach JobNimbus, sales reps,
 * or customers. Only the marked-up PRICE goes on invoices, JN syncs, and any
 * surface a sales rep can see.
 *
 * Use this module at every API boundary that could return ticket / order /
 * breakdown / invoice data. Never filter at the client — filter server-side
 * before the data leaves the route.
 */

/**
 * Reinforced rules (2026-04-09):
 *
 * Cost only ever appears in THREE places:
 *   1. The inventory pricing admin surface (when entering new stock)
 *   2. The Job_Material_Costs sheet (the database — feeds reports)
 *   3. The invoice email that lands in sara@rcrsal.com
 *
 * Everywhere else, cost is stripped. "Forget about cost, concentrate on
 * price." Rick (driver) does NOT see cost on his daily dashboard, ticket
 * cards, work orders, or anywhere normally — only when he's restocking
 * inventory and needs to enter what we paid the supplier.
 *
 * Reports (the inventory cost reports) are visible to:
 *   Michael, Chris (owner), Sara (admin), Destin (manager), Tia (office).
 *
 * In role terms: owner, admin, office, manager. NOT driver, NOT
 * project_manager (owner re-confirmed 2026-07-02 — AGENDA 3.8: PMs do not
 * see purchase cost; Richard's driver slug is whitelisted separately in
 * lib/auth-service.ts requireRoleAtLeast).
 */
const COST_VISIBLE_ROLES = new Set([
  'owner',
  'admin',
  'office',
  'manager',
]);

/**
 * Roles that may see cost ONLY on the inventory pricing entry surface
 * (entering new stock, supplier price updates, restock receipts). The
 * driver is allowed here because Rick has to type the supplier price
 * when materials come in. He sees cost on this surface and nowhere else.
 */
const COST_VISIBLE_ON_INVENTORY_ENTRY = new Set([
  ...COST_VISIBLE_ROLES,
  'driver',
]);

/**
 * Roles allowed to see cost on DELIVERY-SIDE surfaces (work orders,
 * delivery PDFs, anything that leaves the warehouse). Strictest of all —
 * only office and above. Rick is explicitly NOT here.
 */
const COST_VISIBLE_ON_DELIVERY_DOCS = new Set([
  'owner',
  'admin',
  'office',
]);

export function canSeeCost(role: string | undefined | null): boolean {
  if (!role) return false;
  return COST_VISIBLE_ROLES.has(role.toLowerCase());
}

/**
 * Use this on the inventory pricing admin page and the new-stock receipt
 * flow. Allows the driver in addition to office staff — Rick types the
 * supplier price when stock comes in.
 */
export function canSeeCostOnInventoryEntry(role: string | undefined | null): boolean {
  if (!role) return false;
  return COST_VISIBLE_ON_INVENTORY_ENTRY.has(role.toLowerCase());
}

/**
 * Stricter check for delivery-side documents. Returns true ONLY for office,
 * admin, owner. Use this when generating any document that physically leaves
 * the warehouse (delivery PDF, work order email, ticket-print view).
 */
export function canSeeCostOnDeliveryDoc(role: string | undefined | null): boolean {
  if (!role) return false;
  return COST_VISIBLE_ON_DELIVERY_DOCS.has(role.toLowerCase());
}

/**
 * Field names that represent purchase cost. Add to this list as new fields
 * appear — anything matching one of these names will be deleted from any
 * object passed through stripCostFields.
 */
const COST_FIELD_NAMES = new Set([
  'cost',
  'unitCost',
  'totalCost',
  'lineCost',
  'costPrice',
  'purchasePrice',
  'wholesale',
  'wholesalePrice',
  'margin',
  'marginAmount',
  'marginPercent',
  'profit',
  'ourCost',
]);

/**
 * Recursively strip every cost-related field from a value.
 * Returns a NEW object — does not mutate the input.
 *
 * Handles: plain objects, arrays, nested arrays/objects.
 * Leaves alone: primitives, Date, null, undefined.
 *
 * Use as the LAST step before NextResponse.json(...) on any sales-rep
 * or customer-visible endpoint.
 */
export function stripCostFields<T>(value: T): T {
  if (value === null || value === undefined) return value;
  if (typeof value !== 'object') return value;
  if (value instanceof Date) return value;

  if (Array.isArray(value)) {
    return value.map(item => stripCostFields(item)) as unknown as T;
  }

  const out: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
    if (COST_FIELD_NAMES.has(key)) continue;
    out[key] = stripCostFields(val);
  }
  return out as T;
}

/**
 * Convenience: strip cost fields ONLY if the user role isn't allowed to see
 * them. Use this when you have one endpoint serving multiple roles and want
 * to keep the office's data rich while protecting sales reps.
 *
 * @example
 *   const filtered = filterCostByRole(ticket, auth.user.role);
 *   return NextResponse.json(filtered);
 */
export function filterCostByRole<T>(value: T, role: string | undefined | null): T {
  if (canSeeCost(role)) return value;
  return stripCostFields(value);
}
