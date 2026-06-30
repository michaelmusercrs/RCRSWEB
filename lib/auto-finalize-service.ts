/**
 * Auto-Finalize Stuck Tickets
 *
 * The "stop the bleeding" safety net. The email webhook reliably creates
 * delivery tickets in status='created', but the warehouse verify-load click
 * (which fires the inventory deduction + invoice) was historically never done,
 * so tickets piled up untracked and uninvoiced for weeks.
 *
 * This service finalizes any delivery ticket that has sat in 'created' for
 * longer than STALL_HOURS, doing the SAME complete finalization as the
 * 2026-06-30 backfill:
 *   1. Write an Invoices row (status='posted', no email)
 *   2. Write a Job_Breakdowns row if the job has none
 *   3. Deduct each material line from Inventory_Products (canonical stock)
 *   4. Flip the ticket to status='load_verified'
 *
 * Guards (anything excluded is left for the stalled-tickets digest / human):
 *   - ticketType must be 'delivery'
 *   - totalPrice >= MIN_PRICE  (skips $0 / junk-parsed tickets)
 *   - at least one material line
 *   - not already invoiced (dedup by ticketId in Invoices)
 *
 * Idempotent: re-running skips already-invoiced tickets and already-logged
 * deductions (Inventory_Deductions_Log). Self-contained Sheets access (own
 * JWT/doc) so it can run from a cron route or be unit/dry-run tested directly.
 */

import { JWT } from 'google-auth-library';
import { GoogleSpreadsheet } from 'google-spreadsheet';
import crypto from 'crypto';
import {
  ensureInventoryDeductionsLogSheet,
  loadDeductionKeySet,
  wasDeducted,
  appendDeductionLog,
  makeDeductionKey,
} from './inventory-deduction-log';

const STALL_HOURS = 48;
const MIN_PRICE = 1;
const MAX_PER_RUN = 8; // bound write-quota usage; remainder waits for next run
const WRITE_PAUSE_MS = 1100; // ~54 writes/min, under the 60/min Sheets quota
const DEDUCTION_SOURCE = 'auto-finalize-cron';

interface RawMaterial {
  productId?: string;
  productName?: string;
  quantity?: number;
  unitCost?: number;
  unitPrice?: number;
  totalPrice?: number;
}

export interface AutoFinalizeTicketResult {
  ticketId: string;
  jobName: string;
  invoiceId: string;
  total: number;
  deducted: number;
  action: 'finalized' | 'would-finalize' | 'failed';
  reason?: string;
}

export interface AutoFinalizeSummary {
  dryRun: boolean;
  configured: boolean;
  candidates: number;
  processed: number;
  cappedAt: number | null;
  results: AutoFinalizeTicketResult[];
  errors: string[];
}

function ageHours(createdAt: string): number {
  const t = new Date(createdAt).getTime();
  if (!Number.isFinite(t)) return 0;
  return (Date.now() - t) / 3_600_000;
}

function num(v: unknown): number {
  return parseFloat(String(v ?? '').replace(/[$,]/g, '')) || 0;
}

export async function autoFinalizeStuckTickets(
  opts: { dryRun?: boolean } = {},
): Promise<AutoFinalizeSummary> {
  const dryRun = opts.dryRun === true;
  const errors: string[] = [];

  const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n').replace(/\r\n/g, '\n').trim();
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL?.trim();
  const sheetsId = process.env.GOOGLE_SHEETS_ID?.trim();
  if (!privateKey || !email || !sheetsId) {
    return { dryRun, configured: false, candidates: 0, processed: 0, cappedAt: null, results: [], errors: ['Google Sheets credentials not configured'] };
  }

  const auth = new JWT({ email, key: privateKey, scopes: ['https://www.googleapis.com/auth/spreadsheets'] });
  const doc = new GoogleSpreadsheet(sheetsId, auth);
  await doc.loadInfo();

  const ticketsSheet = doc.sheetsByTitle['Tickets'];
  const invoicesSheet = doc.sheetsByTitle['Invoices'];
  const breakdownsSheet = doc.sheetsByTitle['Job_Breakdowns'];
  const invProdSheet = doc.sheetsByTitle['Inventory_Products'];
  if (!ticketsSheet || !invoicesSheet || !breakdownsSheet || !invProdSheet) {
    return { dryRun, configured: false, candidates: 0, processed: 0, cappedAt: null, results: [], errors: ['Required tab missing (Tickets/Invoices/Job_Breakdowns/Inventory_Products)'] };
  }

  const [ticketRows, invoiceRows, breakdownRows, invProdRows] = await Promise.all([
    ticketsSheet.getRows(),
    invoicesSheet.getRows(),
    breakdownsSheet.getRows(),
    invProdSheet.getRows(),
  ]);

  const invoicedTickets = new Set(invoiceRows.map(r => r.get('ticketId')).filter(Boolean));
  const bdJobIds = new Set(breakdownRows.map(r => r.get('jobId')).filter(Boolean));
  const bdJobNames = new Set(breakdownRows.map(r => r.get('jobName')).filter(Boolean));
  const invProdByName = new Map(invProdRows.map(r => [(r.get('productName') || '').toLowerCase().trim(), r]));
  const invProdById = new Map(invProdRows.map(r => [r.get('productId'), r]));

  // Collision-proof invoice numbering: next sequence after the max existing
  // INV-YYYYMMDD-#### for today.
  const dateTag = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const todayPrefix = `INV-${dateTag}-`;
  let seq = 0;
  for (const r of invoiceRows) {
    const id = r.get('invoiceId') || '';
    if (id.startsWith(todayPrefix)) {
      const n = parseInt(id.slice(todayPrefix.length), 10);
      if (Number.isFinite(n) && n > seq) seq = n;
    }
  }

  await ensureInventoryDeductionsLogSheet(doc);
  const dedKeys = await loadDeductionKeySet(doc);

  // Candidate selection
  const candidates = ticketRows.filter(r => {
    if ((r.get('status') || '').trim() !== 'created') return false;
    if ((r.get('ticketType') || '').trim() !== 'delivery') return false;
    if (invoicedTickets.has(r.get('ticketId'))) return false;
    if (ageHours(r.get('createdAt') || '') < STALL_HOURS) return false;
    if (num(r.get('totalPrice')) < MIN_PRICE) return false;
    let mats: RawMaterial[] = [];
    try { mats = JSON.parse(r.get('materialsJson') || '[]'); } catch { /* skip */ }
    return mats.length > 0;
  });

  const summary: AutoFinalizeSummary = {
    dryRun,
    configured: true,
    candidates: candidates.length,
    processed: 0,
    cappedAt: candidates.length > MAX_PER_RUN ? MAX_PER_RUN : null,
    results: [],
    errors,
  };

  const pause = () => new Promise(r => setTimeout(r, WRITE_PAUSE_MS));
  const batch = candidates.slice(0, MAX_PER_RUN);
  const stamp = new Date().toISOString();

  for (const t of batch) {
    const ticketId = t.get('ticketId');
    const jobId = t.get('jobId') || '';
    const jobName = t.get('jobName') || '';
    const customerName = t.get('customerName') || '';
    const customerEmail = t.get('customerEmail') || '';
    const createdAt = t.get('createdAt') || '';
    const address = [t.get('jobAddress'), t.get('city'), t.get('state')].filter(Boolean).join(', ');
    const total = num(t.get('totalPrice'));
    let mats: RawMaterial[] = [];
    try { mats = JSON.parse(t.get('materialsJson') || '[]'); } catch { /* skip */ }

    seq += 1;
    const invoiceId = `${todayPrefix}${String(seq).padStart(4, '0')}`;

    if (dryRun) {
      summary.results.push({ ticketId, jobName, invoiceId, total, deducted: 0, action: 'would-finalize' });
      summary.processed += 1;
      continue;
    }

    try {
      // 1. Invoice row
      await invoicesSheet.addRow({
        invoiceId, ticketId, jobId, jobName, customerName, customerEmail,
        createdAt: stamp, dueDate: '', paidAt: '',
        subtotal: total.toFixed(2), taxRate: '0', taxAmount: '0.00', deliveryFee: '0.00', rushFee: '0.00',
        total: total.toFixed(2), status: 'posted', paymentMethod: '', paymentReference: '',
        notes: `Auto-finalized by cron (stuck in 'created' >${STALL_HOURS}h). Inventory deducted from Inventory_Products. No email sent.`,
        internalNotes: '',
      });
      await pause();

      // 2. Breakdown row (if job has none)
      if (!bdJobIds.has(jobId) && !bdJobNames.has(jobName)) {
        const breakdownId = `BD-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
        const materialsSummary = mats.slice(0, 6).map(m => `${m.quantity || 0} ${m.productName || ''}`).join('; ');
        await breakdownsSheet.addRow({
          breakdownId, jobId, jobName, customerName, address, projectType: 'delivery', status: 'auto-created',
          materials: materialsSummary, labor: '', materialTotal: total.toFixed(2), laborTotal: '', deliveryFees: '0', overhead: '', profit: '',
          totalEstimate: total.toFixed(2), estimatedStartDate: createdAt.slice(0, 10), estimatedEndDate: createdAt.slice(0, 10),
          createdBy: 'auto-finalize-cron', createdAt: stamp, updatedAt: stamp,
          notes: `Auto-created from delivery ticket ${ticketId}. Linked invoice ${invoiceId}.`,
        });
        bdJobIds.add(jobId);
        bdJobNames.add(jobName);
        await pause();
      }

      // 3. Deduct from Inventory_Products (idempotent)
      let deducted = 0;
      for (const m of mats) {
        const productName = (m.productName || '').toLowerCase().trim();
        const qty = num(m.quantity);
        if (!productName || !qty) continue;
        if (wasDeducted(dedKeys, ticketId, productName)) continue;
        const row = invProdByName.get(productName) || invProdById.get(m.productId || '');
        if (!row) continue;
        const before = num(row.get('currentQty'));
        const after = Math.max(0, before - qty);
        const unitCost = num(row.get('unitCost'));
        row.set('currentQty', String(after));
        row.set('totalValue', (after * unitCost).toFixed(2));
        await row.save();
        deducted += 1;
        await appendDeductionLog(doc, {
          ticketId, productName, productId: row.get('productId') || '',
          qtyBefore: before, qtyAfter: after, qtyDelta: -qty, invoiceId, source: DEDUCTION_SOURCE,
        });
        dedKeys.add(makeDeductionKey(ticketId, productName));
        await pause();
      }

      // 4. Flip ticket to load_verified
      t.set('status', 'load_verified');
      t.set('completedAt', t.get('completedAt') || stamp);
      await t.save();
      await pause();

      summary.results.push({ ticketId, jobName, invoiceId, total, deducted, action: 'finalized' });
      summary.processed += 1;
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      errors.push(`${ticketId}: ${reason}`);
      summary.results.push({ ticketId, jobName, invoiceId, total, deducted: 0, action: 'failed', reason });
    }
  }

  return summary;
}
