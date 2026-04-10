/**
 * Customer Breakdown Service
 *
 * Models the job costing & commission payout format used in the historical
 * per-job Excel sheets (R1081-R1394). Replaces the generic estimating tool
 * in job-breakdown-service.ts with a structure that matches how RCRS
 * actually tracks jobs:
 *
 *   - Material = named supplier line items (not generic categories)
 *   - Labor    = subcontractor payouts with check refs
 *   - Finance  = auto-calculated overhead/profit/commission column
 *   - Two tiers: public (stops at Sales Rep) and admin (includes Pres/VP)
 *
 * Calculation rules verified against 14 of 15 historical sheets — see
 * scripts/verify-breakdown-calcs.js (the 2 mismatches were manual sheet
 * overrides, not formula errors).
 */

import { promises as fs } from 'fs';
import path from 'path';
import { googleSheetsService } from '@/lib/google-sheets-service';

// ─── Types ───────────────────────────────────────────────────────────────

export interface MaterialLineItem {
  supplier: string;
  description?: string;      // optional — e.g., "shingles + accessories"
  amount: number;
  isCredit?: boolean;        // true for material credits / returns (subtracted)
  receiptRef?: string;       // optional receipt / PO number
  /**
   * Where this line's materials came from:
   *   - 'stock' (default) = pulled from our warehouse catalog
   *   - 'other_vendor' = purchased from outside supplier for this job
   * Optional on read so legacy breakdown rows default to 'stock'.
   */
  orderSource?: 'stock' | 'other_vendor';
}

export interface LaborLineItem {
  subcontractor: string;
  amount: number;
  checkDate?: string;        // ISO date
  checkNumber?: string;
  isWorkersComp?: boolean;   // true if this line is the workers comp surcharge
}

export interface PaymentLineItem {
  kind: 'deposit' | 'final' | 'progress';
  amount: number;
  date?: string;             // ISO date
  checkNumber?: string;
  method?: 'check' | 'cash' | 'card' | 'ach' | 'other';
}

export interface CommissionPayout {
  amount: number;
  date?: string;
  checkNumber?: string;
  paidAt?: string;           // ISO datetime when marked paid
}

export interface BreakdownRevision {
  amount: number;            // can be negative
  reason: string;
  date: string;              // ISO date
  enteredBy: string;         // user id/email
}

export interface CustomerBreakdown {
  breakdownId: string;                 // UUID we generate
  rNumber: string;                     // internal R-number (e.g., R1295)
  jnJobNumber?: string;                // JobNimbus display number if different
  jnJobId?: string;                    // JobNimbus jnid (for 2-way sync)
  customerName: string;
  address: string;
  salesRep: string;
  inspector?: string;                  // initials OR team member id
  dateInstalled?: string;              // ISO date

  jobTotal: number;                    // contracted job price (manual input)
  permit: number;                      // permit fees (manual)
  otherCosts: Array<{ label: string; amount: number }>;  // misc deductions

  materials: MaterialLineItem[];
  labor: LaborLineItem[];

  paymentsIn: PaymentLineItem[];       // deposit + final + progress
  commissionsPaid: {
    onDeposit?: CommissionPayout;
    finalPayout?: CommissionPayout;
    revisions: BreakdownRevision[];
  };

  notes?: string;
  status: 'draft' | 'pending_approval' | 'approved' | 'in_progress' | 'completed' | 'voided';

  /**
   * Insurance claim details — only populated when this is an insurance job.
   * RCRS policy: insurance jobs need claim #, deductible, ACV/RCV, carrier,
   * and any supplements tracked separately from the job price for accurate
   * depreciation and supplement chase. Optional on read so non-insurance
   * breakdowns (cash jobs) leave this undefined.
   */
  insurance?: {
    isInsuranceClaim: boolean;
    carrierName?: string;          // State Farm, Allstate, etc.
    claimNumber?: string;
    deductible?: number;           // $ customer pays
    acv?: number;                  // Actual Cash Value
    rcv?: number;                  // Replacement Cost Value
    depreciation?: number;         // RCV - ACV (auto-calculated in UI)
    supplements?: Array<{
      description: string;
      amount: number;
      status: 'pending' | 'approved' | 'paid' | 'denied';
      submittedAt?: string;
    }>;
  };

  // Audit
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  approvedBy?: string;
  approvedAt?: string;
}

export interface CalculatedTotals {
  // Inputs (echoed)
  jobTotal: number;
  materialSubtotal: number;      // sum of materials (credits subtract)
  laborSubtotal: number;         // sum of labor BEFORE workers comp auto-add
  workersCompAdded: number;      // auto-added WC amount (0 if labor already had WC)
  laborTotal: number;            // materialSubtotal + workersCompAdded
  permit: number;
  otherCostsTotal: number;

  // Overhead — tiered
  overheadOnFirst50k: number;    // 15% of min(jobTotal, 50000)
  overheadOver50k: number;       // 10% of max(0, jobTotal - 50000)
  overheadTotal: number;

  // Profit & splits
  jobProfit: number;             // jobTotal - overhead - material - labor - permit - otherCosts
  salesRepCommission: number;    // 50% of profit
  presCommission: number;        // 15% of profit  (ADMIN TIER)
  vpCommission: number;          // 15% of profit  (ADMIN TIER)
  companyRetained: number;       // profit - (rep + pres + vp)  (ADMIN TIER)

  // Profit percentage as historically displayed = salesRep / jobTotal
  profitPercentDisplay: number;

  // Balance
  paymentsReceived: number;
  balance: number;

  // Commissions status
  commissionPaidToDate: number;
  commissionOutstanding: number;
}

// ─── Sheet record (for persistence) ──────────────────────────────────────

export interface CustomerBreakdownRecord {
  breakdownId: string;
  rNumber: string;
  jnJobId: string;
  jnJobNumber: string;
  customerName: string;
  address: string;
  salesRep: string;
  inspector: string;
  dateInstalled: string;
  jobTotal: string;
  status: string;
  payloadJson: string;          // full CustomerBreakdown serialized
  totalsJson: string;           // full CalculatedTotals serialized
  createdAt: string;
  updatedAt: string;
  createdBy: string;
}

// ─── Calculation Engine ──────────────────────────────────────────────────

/**
 * Load the dropdown config (workers comp rate, thresholds, splits).
 * Cached after first load.
 */
let dropdownConfigCache: BreakdownDropdownConfig | null = null;

export interface BreakdownDropdownConfig {
  suppliers: Array<{ name: string; category: string; active: boolean }>;
  subcontractors: Array<{ name: string; trade: string; active: boolean }>;
  workersComp: { enabled: boolean; ratePercent: number; displayAs: string; description: string };
  overheadTiers: Array<{ threshold: number; rate: number; label: string }>;
  profitSplits: { salesRep: number; pres: number; vp: number };
  newEntryThresholds: {
    supplier: number;
    subcontractor: number;
    notifyRecipients: string[];
  };
  permissions: {
    canCreate: string[];
    canViewAdminTier: string[];
  };
}

export async function loadDropdownConfig(): Promise<BreakdownDropdownConfig> {
  if (dropdownConfigCache) return dropdownConfigCache;
  const file = path.join(process.cwd(), 'data', 'breakdown-dropdowns.json');
  const raw = await fs.readFile(file, 'utf8');
  const cfg = JSON.parse(raw) as BreakdownDropdownConfig;
  dropdownConfigCache = cfg;
  return cfg;
}

export function clearDropdownConfigCache(): void {
  dropdownConfigCache = null;
}

export async function saveDropdownConfig(cfg: BreakdownDropdownConfig): Promise<void> {
  const file = path.join(process.cwd(), 'data', 'breakdown-dropdowns.json');
  await fs.writeFile(file, JSON.stringify(cfg, null, 2), 'utf8');
  dropdownConfigCache = cfg;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Compute tiered overhead.
 *   First $50,000 of job total → 15%
 *   Amount over $50,000       → 10%
 *
 * Was previously $25K cutoff before company raised it.
 */
export function calculateOverhead(
  jobTotal: number,
  tiers: Array<{ threshold: number; rate: number }> = [
    { threshold: 0, rate: 0.15 },
    { threshold: 50000, rate: 0.10 },
  ]
): { onFirst: number; overCutoff: number; total: number; cutoff: number } {
  // Sort tiers ascending by threshold
  const sorted = [...tiers].sort((a, b) => a.threshold - b.threshold);
  const firstTier = sorted[0];
  const secondTier = sorted[1];
  const cutoff = secondTier?.threshold ?? Number.POSITIVE_INFINITY;

  const onFirst = round2(Math.min(jobTotal, cutoff) * firstTier.rate);
  const overCutoff = jobTotal > cutoff
    ? round2((jobTotal - cutoff) * (secondTier?.rate ?? firstTier.rate))
    : 0;

  return {
    onFirst,
    overCutoff,
    total: round2(onFirst + overCutoff),
    cutoff,
  };
}

/**
 * Check if labor line items already include a workers comp surcharge.
 * We look for either:
 *   - an explicit isWorkersComp:true line
 *   - a subcontractor name matching /workers?\s*comp/i
 */
export function laborHasWorkersComp(labor: LaborLineItem[]): boolean {
  return labor.some(
    l => l.isWorkersComp === true || /workers?\s*comp/i.test(l.subcontractor)
  );
}

/**
 * Compute all totals for a breakdown. Pure function — no I/O.
 *
 * @param breakdown the breakdown inputs
 * @param config    dropdown config (for workers comp rate + overhead tiers + splits)
 */
export function calculateTotals(
  breakdown: Pick<
    CustomerBreakdown,
    'jobTotal' | 'permit' | 'otherCosts' | 'materials' | 'labor' | 'paymentsIn' | 'commissionsPaid'
  >,
  config: BreakdownDropdownConfig
): CalculatedTotals {
  const jobTotal = Number(breakdown.jobTotal) || 0;
  const permit = Number(breakdown.permit) || 0;

  // Material subtotal — credits subtract
  const materialSubtotal = round2(
    breakdown.materials.reduce(
      (sum, m) => sum + (m.isCredit ? -Number(m.amount || 0) : Number(m.amount || 0)),
      0
    )
  );

  // Labor subtotal (before workers comp auto)
  const laborSubtotal = round2(
    breakdown.labor
      .filter(l => !l.isWorkersComp)
      .reduce((sum, l) => sum + Number(l.amount || 0), 0)
  );

  // Workers Comp: auto-add if missing AND enabled in config
  let workersCompAdded = 0;
  if (config.workersComp.enabled && !laborHasWorkersComp(breakdown.labor)) {
    workersCompAdded = round2(laborSubtotal * (config.workersComp.ratePercent / 100));
  } else {
    // If explicit WC line present, sum it into the totals
    workersCompAdded = round2(
      breakdown.labor.filter(l => l.isWorkersComp).reduce((s, l) => s + Number(l.amount || 0), 0)
    );
  }

  const laborTotal = round2(laborSubtotal + workersCompAdded);

  // Other costs
  const otherCostsTotal = round2(
    (breakdown.otherCosts || []).reduce((sum, c) => sum + Number(c.amount || 0), 0)
  );

  // Tiered overhead
  const overhead = calculateOverhead(jobTotal, config.overheadTiers);

  // Profit
  const jobProfit = round2(
    jobTotal - overhead.total - materialSubtotal - laborTotal - permit - otherCostsTotal
  );

  // Splits
  const splits = config.profitSplits;
  const salesRepCommission = round2(jobProfit * splits.salesRep);
  const presCommission = round2(jobProfit * splits.pres);
  const vpCommission = round2(jobProfit * splits.vp);
  const companyRetained = round2(jobProfit - salesRepCommission - presCommission - vpCommission);

  // Historical display: Sales Rep / Job Total (not true margin)
  const profitPercentDisplay = jobTotal > 0 ? round2((salesRepCommission / jobTotal) * 100) : 0;

  // Payments
  const paymentsReceived = round2(
    breakdown.paymentsIn.reduce((sum, p) => sum + Number(p.amount || 0), 0)
  );
  const balance = round2(jobTotal - paymentsReceived);

  // Commissions paid to date
  const paidOnDeposit = Number(breakdown.commissionsPaid?.onDeposit?.amount || 0);
  const paidFinal = Number(breakdown.commissionsPaid?.finalPayout?.amount || 0);
  const revisions = (breakdown.commissionsPaid?.revisions || []).reduce(
    (s, r) => s + Number(r.amount || 0),
    0
  );
  const commissionPaidToDate = round2(paidOnDeposit + paidFinal + revisions);
  const commissionOutstanding = round2(salesRepCommission - commissionPaidToDate);

  return {
    jobTotal,
    materialSubtotal,
    laborSubtotal,
    workersCompAdded,
    laborTotal,
    permit,
    otherCostsTotal,
    overheadOnFirst50k: overhead.onFirst,
    overheadOver50k: overhead.overCutoff,
    overheadTotal: overhead.total,
    jobProfit,
    salesRepCommission,
    presCommission,
    vpCommission,
    companyRetained,
    profitPercentDisplay,
    paymentsReceived,
    balance,
    commissionPaidToDate,
    commissionOutstanding,
  };
}

// ─── Permission helpers ─────────────────────────────────────────────────

/**
 * Returns true if the given role can view the admin-tier financials
 * (Pres/VP commissions, company retained).
 */
export function canViewAdminTier(role: string, config: BreakdownDropdownConfig): boolean {
  return config.permissions.canViewAdminTier.includes(role);
}

export function canCreateBreakdown(role: string, config: BreakdownDropdownConfig): boolean {
  return config.permissions.canCreate.includes(role);
}

/**
 * Strip admin-tier fields from totals before sending to non-admin users.
 * Used when returning breakdowns to managers/PMs/sales reps.
 */
export function redactAdminTier(totals: CalculatedTotals): Omit<
  CalculatedTotals,
  'presCommission' | 'vpCommission' | 'companyRetained'
> {
  const { presCommission, vpCommission, companyRetained, ...rest } = totals;
  void presCommission; void vpCommission; void companyRetained;
  return rest;
}

// ─── New-vendor threshold detection ─────────────────────────────────────

export interface NewVendorAlert {
  type: 'supplier' | 'subcontractor';
  name: string;
  amount: number;
  threshold: number;
}

/**
 * Given a breakdown and the current dropdown config, return alerts for
 * any new suppliers over the supplier threshold or new subs over the sub
 * threshold. Caller is responsible for actually sending the notification.
 */
export function detectNewVendorAlerts(
  breakdown: Pick<CustomerBreakdown, 'materials' | 'labor'>,
  config: BreakdownDropdownConfig
): NewVendorAlert[] {
  const alerts: NewVendorAlert[] = [];

  const knownSuppliers = new Set(
    config.suppliers.map(s => s.name.toLowerCase().trim())
  );
  const knownSubs = new Set(
    config.subcontractors.map(s => s.name.toLowerCase().trim())
  );

  // Aggregate amounts per supplier on THIS breakdown
  const supplierTotals = new Map<string, number>();
  for (const m of breakdown.materials) {
    const key = m.supplier.toLowerCase().trim();
    if (!key) continue;
    const current = supplierTotals.get(key) || 0;
    supplierTotals.set(key, current + (m.isCredit ? -m.amount : m.amount));
  }

  for (const [key, amount] of supplierTotals.entries()) {
    if (!knownSuppliers.has(key) && amount > config.newEntryThresholds.supplier) {
      alerts.push({
        type: 'supplier',
        name: breakdown.materials.find(m => m.supplier.toLowerCase().trim() === key)!.supplier,
        amount: round2(amount),
        threshold: config.newEntryThresholds.supplier,
      });
    }
  }

  // Same for subs
  const subTotals = new Map<string, number>();
  for (const l of breakdown.labor) {
    if (l.isWorkersComp) continue;
    const key = l.subcontractor.toLowerCase().trim();
    if (!key) continue;
    const current = subTotals.get(key) || 0;
    subTotals.set(key, current + l.amount);
  }

  for (const [key, amount] of subTotals.entries()) {
    if (!knownSubs.has(key) && amount > config.newEntryThresholds.subcontractor) {
      alerts.push({
        type: 'subcontractor',
        name: breakdown.labor.find(l => l.subcontractor.toLowerCase().trim() === key)!.subcontractor,
        amount: round2(amount),
        threshold: config.newEntryThresholds.subcontractor,
      });
    }
  }

  return alerts;
}

// ─── Persistence (Google Sheets) ────────────────────────────────────────

const CUSTOMER_BREAKDOWNS_TAB = 'CustomerBreakdowns';
const CUSTOMER_BREAKDOWNS_HEADERS = [
  'breakdownId', 'rNumber', 'jnJobId', 'jnJobNumber', 'customerName',
  'address', 'salesRep', 'inspector', 'dateInstalled', 'jobTotal',
  'status', 'payloadJson', 'totalsJson', 'createdAt', 'updatedAt', 'createdBy',
];

function toSheetRecord(
  breakdown: CustomerBreakdown,
  totals: CalculatedTotals
): CustomerBreakdownRecord {
  return {
    breakdownId: breakdown.breakdownId,
    rNumber: breakdown.rNumber,
    jnJobId: breakdown.jnJobId || '',
    jnJobNumber: breakdown.jnJobNumber || '',
    customerName: breakdown.customerName,
    address: breakdown.address,
    salesRep: breakdown.salesRep,
    inspector: breakdown.inspector || '',
    dateInstalled: breakdown.dateInstalled || '',
    jobTotal: String(breakdown.jobTotal),
    status: breakdown.status,
    payloadJson: JSON.stringify(breakdown),
    totalsJson: JSON.stringify(totals),
    createdAt: breakdown.createdAt,
    updatedAt: breakdown.updatedAt,
    createdBy: breakdown.createdBy,
  };
}

function fromSheetRecord(
  record: CustomerBreakdownRecord
): { breakdown: CustomerBreakdown; totals: CalculatedTotals } | null {
  try {
    const breakdown = JSON.parse(record.payloadJson) as CustomerBreakdown;
    const totals = JSON.parse(record.totalsJson) as CalculatedTotals;
    return { breakdown, totals };
  } catch {
    return null;
  }
}

export async function saveBreakdown(
  breakdown: CustomerBreakdown,
  totals: CalculatedTotals
): Promise<boolean> {
  try {
    // Use the same getOrCreateSheet helper the existing sheets service exposes
    // via addJobBreakdown pattern; we reuse the generic sheet methods.
    const sheetsService = googleSheetsService as unknown as {
      init: () => Promise<boolean>;
      doc: { sheetsByTitle: Record<string, unknown> } | null;
      getOrCreateSheet: (
        name: string,
        headers: string[]
      ) => Promise<{
        getRows: () => Promise<Array<{ get: (k: string) => string; set: (k: string, v: string) => void; save: () => Promise<void> }>>;
        addRow: (row: Record<string, string>) => Promise<void>;
      }>;
    };
    const ready = await sheetsService.init();
    if (!ready) return false;

    const sheet = await sheetsService.getOrCreateSheet(
      CUSTOMER_BREAKDOWNS_TAB,
      CUSTOMER_BREAKDOWNS_HEADERS
    );
    const record = toSheetRecord(breakdown, totals);

    // Update-or-insert by breakdownId
    const rows = await sheet.getRows();
    const existing = rows.find(r => r.get('breakdownId') === breakdown.breakdownId);
    if (existing) {
      for (const [k, v] of Object.entries(record)) {
        existing.set(k, String(v));
      }
      await existing.save();
    } else {
      await sheet.addRow(record as unknown as Record<string, string>);
    }

    // ─── Mirror to per-job formatted sheet (non-fatal) ──────────────────
    // The JSON CustomerBreakdowns tab is the source of truth. The per-job
    // 8-column tab is a mirror for Sara + historical consistency with the
    // old xlsx files. If the sheet write fails we log and keep going.
    try {
      const { writeBreakdownSheet } = await import('./breakdown-sheet-sync');
      const sheetResult = await writeBreakdownSheet(breakdown, totals);
      if (!sheetResult.success) {
        console.warn('[breakdown-sync] Sheet write failed (non-fatal):', sheetResult.reason);
      }
    } catch (err) {
      console.error('[breakdown-sync] Sheet write threw (non-fatal):', err);
    }

    // Audit log — fire and forget, never break the business logic
    try {
      const { auditLog } = await import('./audit-logger');
      auditLog(
        'BREAKDOWN_SAVED',
        breakdown.createdBy || 'unknown',
        `Breakdown ${breakdown.breakdownId} (${breakdown.rNumber}) saved. Status: ${breakdown.status}. Customer: ${breakdown.customerName}. Job total: $${breakdown.jobTotal}.`
      );
    } catch (err) {
      console.warn('[audit] BREAKDOWN_SAVED log failed:', err);
    }

    return true;
  } catch (err) {
    console.error('saveBreakdown failed:', err);
    return false;
  }
}

export async function listBreakdowns(filter?: {
  salesRep?: string;
  status?: string;
  rNumber?: string;
}): Promise<Array<{ breakdown: CustomerBreakdown; totals: CalculatedTotals }>> {
  try {
    const sheetsService = googleSheetsService as unknown as {
      init: () => Promise<boolean>;
      getOrCreateSheet: (name: string, headers: string[]) => Promise<{
        getRows: () => Promise<Array<{ get: (k: string) => string }>>;
      }>;
    };
    const ready = await sheetsService.init();
    if (!ready) return [];

    const sheet = await sheetsService.getOrCreateSheet(
      CUSTOMER_BREAKDOWNS_TAB,
      CUSTOMER_BREAKDOWNS_HEADERS
    );
    const rows = await sheet.getRows();

    const records: CustomerBreakdownRecord[] = rows.map(r => ({
      breakdownId: r.get('breakdownId') || '',
      rNumber: r.get('rNumber') || '',
      jnJobId: r.get('jnJobId') || '',
      jnJobNumber: r.get('jnJobNumber') || '',
      customerName: r.get('customerName') || '',
      address: r.get('address') || '',
      salesRep: r.get('salesRep') || '',
      inspector: r.get('inspector') || '',
      dateInstalled: r.get('dateInstalled') || '',
      jobTotal: r.get('jobTotal') || '0',
      status: r.get('status') || '',
      payloadJson: r.get('payloadJson') || '{}',
      totalsJson: r.get('totalsJson') || '{}',
      createdAt: r.get('createdAt') || '',
      updatedAt: r.get('updatedAt') || '',
      createdBy: r.get('createdBy') || '',
    }));

    let filtered = records
      .map(fromSheetRecord)
      .filter((x): x is { breakdown: CustomerBreakdown; totals: CalculatedTotals } => x !== null);

    if (filter?.salesRep) {
      filtered = filtered.filter(x => x.breakdown.salesRep === filter.salesRep);
    }
    if (filter?.status) {
      filtered = filtered.filter(x => x.breakdown.status === filter.status);
    }
    if (filter?.rNumber) {
      const q = filter.rNumber.toLowerCase();
      filtered = filtered.filter(x => x.breakdown.rNumber.toLowerCase().includes(q));
    }

    return filtered.sort((a, b) => b.breakdown.updatedAt.localeCompare(a.breakdown.updatedAt));
  } catch (err) {
    console.error('listBreakdowns failed:', err);
    return [];
  }
}

export async function getBreakdownById(
  breakdownId: string
): Promise<{ breakdown: CustomerBreakdown; totals: CalculatedTotals } | null> {
  const all = await listBreakdowns();
  return all.find(x => x.breakdown.breakdownId === breakdownId) || null;
}

export async function getBreakdownByRNumber(
  rNumber: string
): Promise<{ breakdown: CustomerBreakdown; totals: CalculatedTotals } | null> {
  const all = await listBreakdowns({ rNumber });
  return all.find(x => x.breakdown.rNumber.toLowerCase() === rNumber.toLowerCase()) || null;
}

// ─── ID generation ──────────────────────────────────────────────────────

export function generateBreakdownId(): string {
  return `cbd_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

// ─── Return sync (inventory return → breakdown material credit) ─────────

/**
 * Sync a received return ticket to the matching CustomerBreakdown by
 * adding credit MaterialLineItems that reduce the material total.
 *
 * Called from unified-inventory-service when a return transitions to
 * `received` status. Idempotent — if any existing material line already
 * has receiptRef === returnTicket.ticketId, this is a no-op.
 *
 * ─── Future credit-memo invoice wiring ────────────────────────────────
 * When the invoice persistence layer is ready, this function should also
 * emit a CreditMemo-style Invoice record, something like:
 *
 *     {
 *       invoiceId: `cm_${ticketId}`,
 *       kind: 'credit_memo',
 *       jobId / rNumber,
 *       amount: -creditAmount,   // negative = credit
 *       source: 'return_ticket',
 *       sourceRef: ticketId,
 *       status: 'pending_application',
 *     }
 *
 * That invoice would then be picked up by the next customer invoice run
 * and either applied against an open balance or issued as a refund.
 * For now we just log a TODO line so the credit amount is visible in
 * server logs and the real breakdown numbers stay correct.
 */
export async function syncReturnToBreakdown(
  returnTicket: {
    ticketId: string;
    jobNumber?: string;
    jobId?: string;
    items: Array<{ productId: string; productName: string; quantity: number; unitCost: number }>;
    distributor?: string;
  }
): Promise<{ success: boolean; breakdownId?: string; creditAmount?: number; reason?: string }> {
  const rNumber = returnTicket.jobNumber || returnTicket.jobId;
  if (!rNumber) {
    return { success: false, reason: 'No jobNumber on return ticket' };
  }

  const found = await getBreakdownByRNumber(rNumber);
  if (!found) {
    return { success: false, reason: `No breakdown found for ${rNumber}` };
  }

  const { breakdown } = found;

  // Idempotency check — if any material line already references this
  // return ticket, we've already synced it.
  const alreadySynced = breakdown.materials.some(
    m => m.receiptRef === returnTicket.ticketId
  );
  if (alreadySynced) {
    return {
      success: true,
      breakdownId: breakdown.breakdownId,
      creditAmount: 0,
      reason: 'Already synced',
    };
  }

  // Build the new credit lines
  const creditLines: MaterialLineItem[] = returnTicket.items.map(item => ({
    supplier: returnTicket.distributor || 'Return Credit',
    description: `Returned: ${item.productName}`,
    amount: Math.abs(Number(item.quantity || 0) * Number(item.unitCost || 0)),
    isCredit: true,
    receiptRef: returnTicket.ticketId,
  }));

  const creditAmount = round2(creditLines.reduce((sum, l) => sum + l.amount, 0));

  // ─── Cap rule: returns can never exceed original ticket for that job ──
  // Business rule: a return must not take a breakdown's net material total
  // below zero. You cannot return more than was delivered. Sum the existing
  // positive material lines, subtract the already-posted credits (from any
  // prior returns), and refuse if the new credit would exceed what's left.
  const existingPositiveMaterial = round2(
    breakdown.materials
      .filter(m => !m.isCredit)
      .reduce((sum, m) => sum + Number(m.amount || 0), 0)
  );
  const existingCredits = round2(
    breakdown.materials
      .filter(m => m.isCredit)
      .reduce((sum, m) => sum + Number(m.amount || 0), 0)
  );
  const netMaterialRemaining = round2(existingPositiveMaterial - existingCredits);

  if (creditAmount > netMaterialRemaining + 0.01) {
    return {
      success: false,
      breakdownId: breakdown.breakdownId,
      creditAmount,
      reason:
        `Return exceeds original ticket. Breakdown ${breakdown.breakdownId} ` +
        `(${rNumber}) has $${netMaterialRemaining.toFixed(2)} of material ` +
        `remaining after prior credits. Attempted return credit: $${creditAmount.toFixed(2)}. ` +
        `Partial return allowed up to $${netMaterialRemaining.toFixed(2)}.`,
    };
  }

  // Build updated breakdown
  const updatedBreakdown: CustomerBreakdown = {
    ...breakdown,
    materials: [...breakdown.materials, ...creditLines],
    updatedAt: new Date().toISOString(),
  };

  // Recalculate totals with the fresh config
  const config = await loadDropdownConfig();
  const newTotals = calculateTotals(updatedBreakdown, config);

  const saved = await saveBreakdown(updatedBreakdown, newTotals);
  if (!saved) {
    return { success: false, reason: 'saveBreakdown failed' };
  }

  // TODO: credit memo invoice wiring (see comment block above)
  console.log(
    '[returns] TODO: Create credit memo Invoice for',
    returnTicket.ticketId,
    'amount:',
    creditAmount
  );

  // Fire notification email (non-fatal)
  try {
    const { emailService } = await import('./email-service');
    const itemsHtml = returnTicket.items
      .map(
        i =>
          `<li>${i.quantity} × ${i.productName} @ $${Number(i.unitCost || 0).toFixed(2)} = $${(
            Math.abs(Number(i.quantity || 0) * Number(i.unitCost || 0))
          ).toFixed(2)}</li>`
      )
      .join('');
    await emailService.send({
      to: 'stock@rcrsal.com',
      cc: 'sara@rcrsal.com',
      subject: `Return credited to breakdown: ${rNumber} - $${creditAmount.toFixed(2)}`,
      fromName: 'RCRS Inventory',
      body: `
        <div style="font-family: Arial, sans-serif; max-width: 600px;">
          <h2 style="color: #0066CC;">Return Credit Applied to Job Breakdown</h2>
          <p>A return ticket has been received and a material credit has been posted to the job breakdown.</p>
          <table style="border-collapse: collapse; width: 100%; margin: 20px 0;">
            <tr><td style="padding: 6px; border: 1px solid #ddd;"><strong>Return Ticket</strong></td><td style="padding: 6px; border: 1px solid #ddd;">${returnTicket.ticketId}</td></tr>
            <tr><td style="padding: 6px; border: 1px solid #ddd;"><strong>Job / R-Number</strong></td><td style="padding: 6px; border: 1px solid #ddd;">${rNumber}</td></tr>
            <tr><td style="padding: 6px; border: 1px solid #ddd;"><strong>Breakdown ID</strong></td><td style="padding: 6px; border: 1px solid #ddd;">${breakdown.breakdownId}</td></tr>
            <tr><td style="padding: 6px; border: 1px solid #ddd;"><strong>Customer</strong></td><td style="padding: 6px; border: 1px solid #ddd;">${breakdown.customerName}</td></tr>
            <tr><td style="padding: 6px; border: 1px solid #ddd;"><strong>Distributor</strong></td><td style="padding: 6px; border: 1px solid #ddd;">${returnTicket.distributor || 'Warehouse return'}</td></tr>
            <tr><td style="padding: 6px; border: 1px solid #ddd;"><strong>Credit Amount</strong></td><td style="padding: 6px; border: 1px solid #ddd;"><strong>$${creditAmount.toFixed(2)}</strong></td></tr>
          </table>
          <h3>Items Returned</h3>
          <ul>${itemsHtml}</ul>
          <p style="color: #666; font-size: 12px;">This message was generated automatically when the return ticket transitioned to "received".</p>
        </div>
      `,
    });
  } catch (err) {
    console.error('[returns] Breakdown sync email failed (non-fatal):', err);
  }

  return {
    success: true,
    breakdownId: breakdown.breakdownId,
    creditAmount,
  };
}

/**
 * Pre-validate a proposed return against the matching breakdown BEFORE
 * the return ticket is even created. Call this from the return-creation
 * endpoint / UI to block over-returns at the source.
 *
 * Business rule (explicit from Michael):
 *   "RETURNS NO LARGER THAN ORIGINAL TICKET FOR THAT JOB"
 *
 * Returns { ok: true, remaining } if the return is valid, or
 * { ok: false, reason, remaining } if it would exceed what's available.
 */
export async function validateReturnAgainstBreakdown(proposed: {
  jobNumber?: string;
  jobId?: string;
  items: Array<{ quantity: number; unitCost: number }>;
}): Promise<{ ok: boolean; remaining: number; proposed: number; reason?: string }> {
  const rNumber = proposed.jobNumber || proposed.jobId;
  if (!rNumber) {
    return { ok: false, remaining: 0, proposed: 0, reason: 'No jobNumber on return' };
  }

  const found = await getBreakdownByRNumber(rNumber);
  if (!found) {
    // No breakdown means we can't validate — that's a data issue, not a
    // return-cap issue. Let the caller decide whether to block or allow.
    return {
      ok: false,
      remaining: 0,
      proposed: 0,
      reason: `No breakdown found for ${rNumber} — cannot validate return cap`,
    };
  }

  const { breakdown } = found;
  const existingPositiveMaterial = round2(
    breakdown.materials
      .filter(m => !m.isCredit)
      .reduce((sum, m) => sum + Number(m.amount || 0), 0)
  );
  const existingCredits = round2(
    breakdown.materials
      .filter(m => m.isCredit)
      .reduce((sum, m) => sum + Number(m.amount || 0), 0)
  );
  const remaining = round2(existingPositiveMaterial - existingCredits);

  const proposedAmount = round2(
    proposed.items.reduce(
      (sum, item) =>
        sum + Math.abs(Number(item.quantity || 0) * Number(item.unitCost || 0)),
      0
    )
  );

  if (proposedAmount > remaining + 0.01) {
    return {
      ok: false,
      remaining,
      proposed: proposedAmount,
      reason:
        `Return exceeds original ticket. $${remaining.toFixed(2)} of material ` +
        `remains on breakdown for ${rNumber} after prior credits. ` +
        `Attempted return: $${proposedAmount.toFixed(2)}. ` +
        `Reduce the return to $${remaining.toFixed(2)} or less.`,
    };
  }

  return { ok: true, remaining, proposed: proposedAmount };
}
