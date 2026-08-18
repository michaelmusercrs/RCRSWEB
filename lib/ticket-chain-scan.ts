/**
 * Ticket-Chain Self-Check Scanner
 *
 * Reads the CANONICAL stores and verifies, for every recent delivery ticket,
 * that the chain agrees end to end:
 *
 *   material order (Tickets row line items)
 *     → delivery ticket total
 *     → Invoices row
 *     → Job_Breakdowns row
 *     → Inventory_Products deduction (Inventory_Deductions_Log)
 *     → interoffice invoice (Job_Material_Costs)
 *
 * It FLAGS mismatches and PROPOSES inventory adjustments — it never mutates
 * anything (read-only). Proposals are surfaced for a human to apply.
 *
 * Deliberately separate from lib/inventory-reconciliation-service.ts, which is
 * welded to the legacy deliveryWorkflow/jobBreakdown/invoice models (the same
 * legacy sheets that miss the 600+ email-created tickets). This scanner reads
 * the authoritative Tickets tab + the canonical Invoices/Job_Breakdowns/
 * Job_Material_Costs/Inventory_Deductions_Log/Inventory_Products tabs.
 */

import { JWT } from 'google-auth-library';
import { GoogleSpreadsheet, type GoogleSpreadsheetRow } from 'google-spreadsheet';
import { ticketSheetService, type SheetTicket } from './ticket-sheet-service';
import { POST_ZONE } from './ticket-status-matrix';

const POST_STATUSES = new Set<string>(POST_ZONE as string[]);

export type ScanSeverity = 'red' | 'yellow';

export interface ChainFinding {
  severity: ScanSeverity;
  ticketId: string;
  referenceNumber: string;
  check: string; // e.g. 'line-sum', 'invoice-missing', 'deduction-mismatch'
  detail: string;
}

export interface InventoryProposal {
  ticketId: string;
  productName: string;
  productId: string;
  /** Amount to change currentQty by to reconcile (positive = add back). */
  proposedDelta: number;
  reason: string;
}

export interface ChainScanReport {
  generatedAt: string;
  windowDays: number;
  ticketsScanned: number;
  findings: ChainFinding[];
  proposals: InventoryProposal[];
  counts: { red: number; yellow: number; proposals: number };
}

const CHAIN_SCAN_TAB = 'Chain_Scan_Results';
const CHAIN_SCAN_HEADERS = [
  'scanId', 'generatedAt', 'windowDays', 'ticketsScanned',
  'red', 'yellow', 'proposals', 'topFindingsJson', 'proposalsJson',
] as const;

function num(v: unknown): number {
  return parseFloat(String(v ?? '').replace(/[$,]/g, '')) || 0;
}

async function openDoc(): Promise<GoogleSpreadsheet | null> {
  const sheetsId = process.env.GOOGLE_SHEETS_ID || process.env.DELIVERY_SHEETS_ID || process.env.GOOGLE_SHEET_ID;
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL?.trim();
  const key = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n').replace(/\r\n/g, '\n').trim();
  if (!sheetsId || !email || !key) return null;
  const auth = new JWT({ email, key, scopes: ['https://www.googleapis.com/auth/spreadsheets'] });
  const doc = new GoogleSpreadsheet(sheetsId, auth);
  await doc.loadInfo();
  return doc;
}

/** Hours between two dates counting only Mon–Fri 8:00–17:00 Central (approx). */
function businessHoursSince(iso: string): number {
  const start = Date.parse(iso);
  if (!Number.isFinite(start)) return 0;
  let ms = Date.now() - start;
  if (ms <= 0) return 0;
  // Coarse approximation: business time is ~ 45/168 of wall time. Good enough
  // for a "stuck > 48 business hours" threshold without a full calendar walk.
  return (ms / 3_600_000) * (45 / 168);
}

/**
 * Run the chain scan over tickets created in the last `windowDays`.
 * Read-only. Returns the full report.
 */
export async function scanTicketChain(windowDays = 14): Promise<ChainScanReport> {
  const generatedAt = new Date().toISOString();
  const report: ChainScanReport = {
    generatedAt, windowDays, ticketsScanned: 0, findings: [], proposals: [],
    counts: { red: 0, yellow: 0, proposals: 0 },
  };

  const doc = await openDoc();
  if (!doc) {
    report.findings.push({ severity: 'red', ticketId: '', referenceNumber: '', check: 'config', detail: 'Google Sheets not configured' });
    report.counts.red++;
    return report;
  }

  const cutoff = Date.now() - windowDays * 86_400_000;
  const allTickets = await ticketSheetService.getAll();
  const tickets = allTickets.filter(t => {
    const c = Date.parse(t.createdAt || '');
    return t.ticketType === 'delivery' && (!Number.isFinite(c) || c >= cutoff);
  });

  // Load the supporting tabs once.
  const rowsOf = async (title: string): Promise<GoogleSpreadsheetRow[]> => {
    const s = doc.sheetsByTitle[title];
    if (!s) return [];
    return s.getRows({ limit: 100000 });
  };
  const [invoiceRows, breakdownRows, jmcRows, dedRows] = await Promise.all([
    rowsOf('Invoices'),
    rowsOf('Job_Breakdowns'),
    rowsOf('Job_Material_Costs'),
    rowsOf('Inventory_Deductions_Log'),
  ]);

  // Index by ticketId / jobId.
  const invByTicket = new Map<string, typeof invoiceRows>();
  for (const r of invoiceRows) {
    const tid = (r.get('ticketId') || '').trim();
    if (!tid) continue;
    (invByTicket.get(tid) || invByTicket.set(tid, []).get(tid)!).push(r);
  }
  const jmcByTicket = new Map<string, typeof jmcRows>();
  for (const r of jmcRows) {
    const tid = (r.get('ticketId') || '').trim();
    if (!tid) continue;
    (jmcByTicket.get(tid) || jmcByTicket.set(tid, []).get(tid)!).push(r);
  }
  // Net deduction per (ticketId, productNameLower).
  const netDed = new Map<string, Map<string, { net: number; productId: string }>>();
  for (const r of dedRows) {
    const tid = (r.get('ticketId') || '').trim();
    const pn = (r.get('productName') || '').toLowerCase().trim();
    if (!tid || !pn) continue;
    const delta = num(r.get('qtyDelta'));
    const inner = netDed.get(tid) || netDed.set(tid, new Map()).get(tid)!;
    const cur = inner.get(pn) || { net: 0, productId: r.get('productId') || '' };
    cur.net += delta;
    if (r.get('productId')) cur.productId = r.get('productId');
    inner.set(pn, cur);
  }
  // Breakdown materialTotal per jobId and per jobName.
  const bdByJobId = new Map<string, typeof breakdownRows[number]>();
  const bdByJobName = new Map<string, typeof breakdownRows[number]>();
  for (const r of breakdownRows) {
    const jid = (r.get('jobId') || '').trim();
    const jname = (r.get('jobName') || '').trim();
    if (jid && !bdByJobId.has(jid)) bdByJobId.set(jid, r);
    if (jname && !bdByJobName.has(jname)) bdByJobName.set(jname, r);
  }

  const add = (f: ChainFinding) => { report.findings.push(f); report.counts[f.severity]++; };

  for (const t of tickets) {
    report.ticketsScanned++;
    const ref = t.referenceNumber || '';
    const committed = POST_STATUSES.has(t.status);
    const heldForReview = (t.notes || '').includes('[NEEDS REVIEW');
    const isStock = (t.orderSource || 'stock') !== 'other_vendor';

    // C1 — line-item sum vs ticket total (price).
    const lineSum = (t.materials || []).reduce((s, m) => s + num(m.totalPrice ?? (num(m.unitPrice) * num(m.quantity))), 0);
    if (Math.abs(lineSum - num(t.totalPrice)) > 0.01 && (lineSum > 0 || num(t.totalPrice) > 0)) {
      add({ severity: 'yellow', ticketId: t.ticketId, referenceNumber: ref, check: 'line-sum',
        detail: `Line items sum to $${lineSum.toFixed(2)} but ticket total is $${num(t.totalPrice).toFixed(2)}.` });
    }

    // C2 — invoice presence + total (committed tickets only).
    const invs = invByTicket.get(t.ticketId) || [];
    if (committed && !heldForReview) {
      if (invs.length === 0) {
        add({ severity: 'red', ticketId: t.ticketId, referenceNumber: ref, check: 'invoice-missing',
          detail: `Ticket is ${t.status} but has no Invoices row.` });
      } else if (invs.length > 1) {
        add({ severity: 'red', ticketId: t.ticketId, referenceNumber: ref, check: 'invoice-duplicate',
          detail: `${invs.length} Invoices rows for one ticket (double-invoice).` });
      } else {
        const invTotal = num(invs[0].get('total'));
        if (Math.abs(invTotal - num(t.totalPrice)) > 0.01) {
          add({ severity: 'yellow', ticketId: t.ticketId, referenceNumber: ref, check: 'invoice-total',
            detail: `Invoice total $${invTotal.toFixed(2)} != ticket total $${num(t.totalPrice).toFixed(2)}.` });
        }
      }
    }

    // C3 — per-line deduction match (committed stock tickets only) + proposal.
    const inner = netDed.get(t.ticketId) || new Map();
    if (committed && isStock && !heldForReview) {
      for (const m of t.materials || []) {
        const pn = (m.productName || '').toLowerCase().trim();
        const qty = num(m.quantity);
        if (!pn || !qty) continue;
        const entry = inner.get(pn);
        const net = entry ? entry.net : 0;
        // Expected net is -qty. Mismatch (incl. never deducted) → proposal.
        if (Math.abs(net - (-qty)) > 0.001) {
          const proposedDelta = (-qty) - net; // change to currentQty to reconcile (negative = deduct more)
          add({ severity: 'red', ticketId: t.ticketId, referenceNumber: ref, check: 'deduction-mismatch',
            detail: `"${m.productName}" expected net -${qty} deducted, log shows ${net}.` });
          report.proposals.push({
            ticketId: t.ticketId, productName: m.productName, productId: entry?.productId || m.productId || '',
            proposedDelta, reason: `Reconcile ${t.ticketId} "${m.productName}" (expected -${qty}, log ${net}).`,
          });
        }
      }
    }

    // C4 — deduction rows on a NON-committed or other_vendor ticket = foreign/early.
    if ((!committed || !isStock)) {
      for (const [pn, entry] of inner) {
        if (entry.net < 0) {
          add({ severity: 'red', ticketId: t.ticketId, referenceNumber: ref, check: 'deduction-foreign',
            detail: `"${pn}" shows ${entry.net} deducted but ticket is ${t.status}${isStock ? '' : ' / other_vendor'}.` });
        }
      }
    }

    // C6 — interoffice invoice (Job_Material_Costs) present unless held for review.
    const jmc = (jmcByTicket.get(t.ticketId) || []).filter(r => (r.get('status') || '').toLowerCase() !== 'voided');
    if (committed && !heldForReview && isStock && jmc.length === 0) {
      add({ severity: 'yellow', ticketId: t.ticketId, referenceNumber: ref, check: 'interoffice-missing',
        detail: `No non-voided Job_Material_Costs (interoffice) record for a committed ticket.` });
    }

    // C7 — stuck hold: [NEEDS REVIEW older than ~48 business hours.
    if (heldForReview && businessHoursSince(t.createdAt || '') > 48) {
      add({ severity: 'red', ticketId: t.ticketId, referenceNumber: ref, check: 'hold-stuck',
        detail: `[NEEDS REVIEW] unresolved for >48 business hours (created ${(t.createdAt || '').slice(0, 10)}).` });
    }

    // C8 — lifecycle hygiene.
    if ((t.status === 'delivered' || t.status === 'completed') && !t.completedAt) {
      add({ severity: 'yellow', ticketId: t.ticketId, referenceNumber: ref, check: 'lifecycle-completedAt',
        detail: `Status ${t.status} but completedAt is blank.` });
    }
  }

  // C5 — breakdown materialTotal vs sum of non-voided invoice totals, per job.
  const invoiceTotalByJob = new Map<string, number>();
  for (const r of invoiceRows) {
    if ((r.get('status') || '').toLowerCase() === 'voided') continue;
    const jid = (r.get('jobId') || '').trim();
    const jname = (r.get('jobName') || '').trim();
    const keyId = jid || jname;
    if (!keyId) continue;
    invoiceTotalByJob.set(keyId, (invoiceTotalByJob.get(keyId) || 0) + num(r.get('total')));
  }
  const scannedJobs = new Set(tickets.map(t => (t.jobId || t.jobName || '').trim()).filter(Boolean));
  for (const jobKey of scannedJobs) {
    const bd = bdByJobId.get(jobKey) || bdByJobName.get(jobKey);
    if (!bd) continue;
    const bdTotal = num(bd.get('materialTotal'));
    const invTotal = invoiceTotalByJob.get(jobKey) || 0;
    if (invTotal > 0 && Math.abs(bdTotal - invTotal) > 1) {
      add({ severity: 'yellow', ticketId: '', referenceNumber: jobKey, check: 'breakdown-drift',
        detail: `Job breakdown materialTotal $${bdTotal.toFixed(2)} != invoiced $${invTotal.toFixed(2)}.` });
    }
  }

  report.counts.proposals = report.proposals.length;

  // Persist a one-row summary (best-effort).
  try {
    let sheet = doc.sheetsByTitle[CHAIN_SCAN_TAB];
    if (!sheet) sheet = await doc.addSheet({ title: CHAIN_SCAN_TAB, headerValues: [...CHAIN_SCAN_HEADERS] });
    else await sheet.loadHeaderRow().catch(() => undefined);
    await sheet.addRow({
      scanId: `SCAN-${Date.now().toString(36).toUpperCase()}`,
      generatedAt, windowDays: String(windowDays), ticketsScanned: String(report.ticketsScanned),
      red: String(report.counts.red), yellow: String(report.counts.yellow), proposals: String(report.counts.proposals),
      topFindingsJson: JSON.stringify(report.findings.slice(0, 40)),
      proposalsJson: JSON.stringify(report.proposals.slice(0, 40)),
    });
  } catch (e) {
    console.warn('[ticket-chain-scan] failed to persist summary:', e);
  }

  return report;
}

/** Read the most recent stored scan summary (cheap — for the health dashboard). */
export async function getLastChainScanSummary(): Promise<
  { generatedAt: string; windowDays: number; ticketsScanned: number; red: number; yellow: number; proposals: number } | null
> {
  const doc = await openDoc();
  if (!doc) return null;
  const sheet = doc.sheetsByTitle[CHAIN_SCAN_TAB];
  if (!sheet) return null;
  const rows = await sheet.getRows({ limit: 100000 });
  if (rows.length === 0) return null;
  const last = rows[rows.length - 1];
  return {
    generatedAt: last.get('generatedAt') || '',
    windowDays: parseInt(last.get('windowDays')) || 0,
    ticketsScanned: parseInt(last.get('ticketsScanned')) || 0,
    red: parseInt(last.get('red')) || 0,
    yellow: parseInt(last.get('yellow')) || 0,
    proposals: parseInt(last.get('proposals')) || 0,
  };
}
