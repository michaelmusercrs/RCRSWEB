/**
 * Historical Inventory Backfill (XLSX → Tickets sheet)
 *
 * One-shot route that converts the entire historical inventory transaction
 * log from data/inventory-import/inventory-source.xlsx into:
 *   - One delivery ticket per real job R# (191 jobs)
 *   - Plus one credit memo per job that has return lines (50 jobs)
 *   - Total: ~241 tickets + ~50 credit memos
 *
 * SILENT MIGRATION — this route MUST NOT:
 *   - Send notifications to Sara or anyone else
 *   - Push anything to JobNimbus (only READS from JN to enrich tickets)
 *   - Generate emails to richard.stock or any driver
 *   - Call deliveryWorkflowService.createTicket (that path notifies)
 *   - Touch the live material-order-pipeline create flow
 *
 * It only READS from JN to enrich tickets with customer/address/sales rep
 * data, then UPSERTS rows into the Tickets sheet tab. Idempotent — running
 * twice produces the same row count.
 *
 * Auth: admin or owner only.
 *
 * POST /api/admin/inventory/backfill-from-xlsx
 *   Body (optional):
 *     {
 *       dryRun?: boolean,        // when true, returns counts + sample without writing
 *       enrichFromJN?: boolean,  // default true; set false to skip JN lookups for speed
 *       excludeRefs?: string[]   // R# values to skip; defaults to ["1234"] (restock pseudo-ref)
 *     }
 *
 * GET /api/admin/inventory/backfill-from-xlsx
 *   Returns counts + how many already exist in the Tickets sheet.
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-service';
import {
  loadInventoryXlsx,
  groupByReference,
  splitDeliveryAndReturn,
  type XlsxItem,
  type XlsxTransaction,
} from '@/lib/inventory-xlsx-loader';
import {
  ticketSheetService,
  type SheetTicket,
  type TicketMaterial,
} from '@/lib/ticket-sheet-service';
import { jobNimbusService, isJobNimbusConfigured } from '@/lib/jobnimbus-service';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 600; // 10 min — 241 tickets × ~250ms upsert + JN lookups

// R#s that are not real jobs. 1234 is the restock pseudo-reference Richard
// uses when materials come in from suppliers.
const DEFAULT_EXCLUDE_REFS = new Set(['1234']);

interface BuildResult {
  ticketsBuilt: number;
  creditMemosBuilt: number;
  jnEnriched: number;
  jnMissing: number;
  skippedRefs: string[];
}

interface MaterialAggregate {
  itemId: string;
  productName: string;
  qty: number;
  unitCost: number;
  unitPrice: number;
}

/**
 * Aggregate transactions for a single R# bucket into MaterialAggregate[]
 * (one row per item, summed quantities). The sign of `amount` is removed —
 * caller decides direction (delivery vs return).
 */
function aggregateMaterials(
  txs: XlsxTransaction[],
  itemsById: Map<string, XlsxItem>,
): MaterialAggregate[] {
  const byItem = new Map<string, MaterialAggregate>();
  for (const t of txs) {
    const item = itemsById.get(t.itemId);
    const productName = item?.name || t.itemId;
    const qty = Math.abs(t.amount);
    if (qty === 0) continue;

    const existing = byItem.get(t.itemId);
    if (existing) {
      existing.qty += qty;
    } else {
      byItem.set(t.itemId, {
        itemId: t.itemId,
        productName,
        qty,
        unitCost: item?.unitCost || 0,
        unitPrice: item?.unitPrice || 0,
      });
    }
  }
  return Array.from(byItem.values());
}

function aggregatesToTicketMaterials(
  aggs: MaterialAggregate[],
): { materials: TicketMaterial[]; totalCost: number; totalPrice: number } {
  const materials: TicketMaterial[] = [];
  let totalCost = 0;
  let totalPrice = 0;
  for (const a of aggs) {
    const lineCost = Math.round(a.unitCost * a.qty * 100) / 100;
    const linePrice = Math.round(a.unitPrice * a.qty * 100) / 100;
    materials.push({
      productId: a.itemId,
      productName: a.productName,
      quantity: a.qty,
      unitCost: a.unitCost,
      unitPrice: a.unitPrice,
      totalCost: lineCost,
      totalPrice: linePrice,
    });
    totalCost += lineCost;
    totalPrice += linePrice;
  }
  return {
    materials,
    totalCost: Math.round(totalCost * 100) / 100,
    totalPrice: Math.round(totalPrice * 100) / 100,
  };
}

/**
 * Try to enrich a ticket with JobNimbus job + customer data. Looks up
 * `R-{refNumber}` in JN. Returns the patch fields to apply, or empty object
 * if no match. NEVER pushes anything to JN — read only.
 */
async function tryJnEnrichment(refNumber: string): Promise<Partial<SheetTicket>> {
  if (!isJobNimbusConfigured()) return {};
  const jobNumber = `R-${refNumber}`;
  const job = await jobNimbusService.getJobByNumber(jobNumber).catch(() => null);
  if (!job) return {};

  // Pull the linked contact for address + name
  let customerName = '';
  let customerPhone = '';
  let customerEmail = '';
  let customerAddress = job.address_line1 || '';
  let city = job.city || '';
  let state = job.state_text || '';

  const contactJnid = job.primary?.jnid;
  if (contactJnid) {
    const contact = await jobNimbusService.getContact(contactJnid).catch(() => null);
    if (contact) {
      customerName = jobNimbusService.getContactName(contact);
      customerPhone = jobNimbusService.getContactPhone(contact) || '';
      customerEmail = contact.email || '';
      if (!customerAddress && contact.address_line1) customerAddress = contact.address_line1;
      if (!city && contact.city) city = contact.city;
      if (!state && contact.state_text) state = contact.state_text;
    }
  }

  return {
    jobId: job.jnid,
    jobName: job.name || `Job ${jobNumber}`,
    jobAddress: customerAddress,
    city,
    state,
    customerName,
    customerPhone,
    customerEmail,
    createdByName: job.sales_rep_name || undefined,
  };
}

async function buildTicketsFromXlsx(opts: {
  enrichFromJN: boolean;
  excludeRefs: Set<string>;
}): Promise<{ tickets: SheetTicket[]; result: BuildResult }> {
  const { items, transactions } = loadInventoryXlsx();

  // Build item lookup once
  const itemsById = new Map<string, XlsxItem>();
  for (const i of items) itemsById.set(i.itemId, i);

  // Group by R# (skip excluded refs)
  const byRef = groupByReference(transactions, opts.excludeRefs);

  const tickets: SheetTicket[] = [];
  const result: BuildResult = {
    ticketsBuilt: 0,
    creditMemosBuilt: 0,
    jnEnriched: 0,
    jnMissing: 0,
    skippedRefs: Array.from(opts.excludeRefs),
  };

  // Iterate jobs sequentially. The bottleneck is JN HTTP — running serially
  // keeps us under the JN per-second rate limit.
  for (const [refNumber, txs] of byRef.entries()) {
    const { delivery, returned } = splitDeliveryAndReturn(txs);

    // Enrich once per refNumber — both the delivery and return ticket
    // share the same job context.
    let enrichment: Partial<SheetTicket> = {};
    if (opts.enrichFromJN) {
      enrichment = await tryJnEnrichment(refNumber);
      if (enrichment.jobId) result.jnEnriched++;
      else result.jnMissing++;
    }

    const firstDeliveryTime = delivery[0]?.dateTime || returned[0]?.dateTime || '';
    const lastDeliveryTime = delivery[delivery.length - 1]?.dateTime || firstDeliveryTime;
    const firstReturnTime = returned[0]?.dateTime || '';
    const lastReturnTime = returned[returned.length - 1]?.dateTime || firstReturnTime;

    // ---- Delivery ticket -------------------------------------------------
    if (delivery.length > 0) {
      const aggs = aggregateMaterials(delivery, itemsById);
      const { materials, totalCost, totalPrice } = aggregatesToTicketMaterials(aggs);

      tickets.push({
        ticketId: `TKT-${refNumber}`,
        ticketType: 'delivery',
        status: 'completed', // historical — already happened
        referenceNumber: refNumber,
        createdAt: firstDeliveryTime,
        completedAt: lastDeliveryTime,
        createdBy: 'historical-backfill',
        createdByName: enrichment.createdByName || 'Historical Import',
        // Default the historical driver to Richard since he handled all deliveries
        assignedTo: 'driver-richard',
        assignedToName: 'Richard Geahr',
        ...enrichment,
        materials,
        totalCost,
        totalPrice,
        notes: 'Backfilled from inventory-source.xlsx (historical transaction log). Job context enriched from JobNimbus where R-{ref} matched.',
        sourceTransactionId: delivery[0]?.inventoryId,
      });
      result.ticketsBuilt++;
    }

    // ---- Credit memo (return ticket) ------------------------------------
    if (returned.length > 0) {
      const aggs = aggregateMaterials(returned, itemsById);
      const { materials, totalCost, totalPrice } = aggregatesToTicketMaterials(aggs);

      tickets.push({
        ticketId: `CM-${refNumber}`,
        ticketType: 'return',
        status: 'completed',
        referenceNumber: refNumber,
        createdAt: firstReturnTime,
        completedAt: lastReturnTime,
        createdBy: 'historical-backfill',
        createdByName: enrichment.createdByName || 'Historical Import',
        assignedTo: 'driver-richard',
        assignedToName: 'Richard Geahr',
        ...enrichment,
        materials,
        totalCost,
        totalPrice,
        notes: 'Credit memo: materials returned from job back to warehouse. Backfilled from inventory-source.xlsx.',
        sourceTransactionId: returned[0]?.inventoryId,
      });
      result.creditMemosBuilt++;
    }
  }

  return { tickets, result };
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth();
  if (!auth.authenticated) return auth.response;
  if (!['admin', 'owner'].includes(auth.user.role)) {
    return NextResponse.json({ error: 'Admin or owner role required' }, { status: 403 });
  }

  let body: {
    dryRun?: boolean;
    enrichFromJN?: boolean;
    excludeRefs?: string[];
  } = {};
  try {
    body = await request.json();
  } catch {
    // empty body is fine
  }

  const excludeRefs = new Set([
    ...DEFAULT_EXCLUDE_REFS,
    ...(body.excludeRefs || []),
  ]);
  // Historical backfill defaults to NO JN enrichment per user instruction
  // (2026-04-09): "just take the data from the items sheet ... if you dont
  // have the address or phone its ok". New tickets going forward enrich
  // from JN at create time, not from this route.
  const enrichFromJN = body.enrichFromJN === true;

  let built;
  try {
    built = await buildTicketsFromXlsx({ enrichFromJN, excludeRefs });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { success: false, error: `XLSX parse failed: ${message}` },
      { status: 500 },
    );
  }

  if (body.dryRun) {
    return NextResponse.json({
      success: true,
      dryRun: true,
      ...built.result,
      totalRows: built.tickets.length,
      sample: built.tickets.slice(0, 3),
    });
  }

  // Silent persist — no notifications, no JN push, no email.
  // Just upsert each row by ticketId.
  const upserts = await ticketSheetService.upsertMany(built.tickets);

  return NextResponse.json({
    success: upserts.failed === 0,
    ...built.result,
    written: upserts.written,
    failed: upserts.failed,
    sheetTab: 'Tickets',
    notificationsSent: 0, // intentional: historical catch-up is silent
  });
}

export async function GET() {
  const auth = await requireAuth();
  if (!auth.authenticated) return auth.response;
  if (!['admin', 'owner'].includes(auth.user.role)) {
    return NextResponse.json({ error: 'Admin or owner role required' }, { status: 403 });
  }

  // Read what's currently in the sheet without doing any JN enrichment
  const built = await buildTicketsFromXlsx({
    enrichFromJN: false,
    excludeRefs: DEFAULT_EXCLUDE_REFS,
  });
  const existing = await ticketSheetService.getAll();

  return NextResponse.json({
    success: true,
    fromXlsx: {
      tickets: built.result.ticketsBuilt,
      creditMemos: built.result.creditMemosBuilt,
      total: built.tickets.length,
    },
    inSheet: existing.length,
    needsBackfill: built.tickets.length > existing.length,
    skippedRefs: built.result.skippedRefs,
  });
}
