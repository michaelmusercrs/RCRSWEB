/**
 * Material Order Email Webhook
 *
 * Receives a parsed material order email body from a Gmail forwarder
 * (Apps Script trigger on stock@rcrsal.com or a Pub/Sub push subscription).
 * Parses the body, matches items to the catalog, creates a ticket via the
 * same code path as the portal form, returns the new ticketId + interoffice
 * invoice ID.
 *
 * POST /api/webhooks/material-order-email
 *   Headers:
 *     X-Webhook-Secret: <MATERIAL_ORDER_WEBHOOK_SECRET>   // shared secret with Apps Script
 *   Body:
 *     {
 *       subject: string,        // Gmail subject line (used for de-dupe)
 *       from: string,           // sender address (verification)
 *       receivedAt: string,     // ISO timestamp
 *       body: string,           // plain-text body of the email
 *       attachments?: Array<{ name: string; url?: string }>  // PDF link if any
 *     }
 *
 * Response:
 *   { success: true, ticketId, jobNumber, materialsMatched, materialsTotal }
 *
 * Idempotent — re-sending the same message creates the same ticket (the
 * ticketId is derived from the job number, not from a fresh UUID).
 *
 * The webhook does NOT call requireAuth — it's authenticated by the shared
 * secret. Without the secret, it returns 401.
 */

import { NextRequest, NextResponse } from 'next/server';
import { parseMaterialOrderEmail, matchCatalogItem } from '@/lib/material-order-email-parser';
import { unifiedInventoryService } from '@/lib/unified-inventory-service';
import { ticketSheetService, type SheetTicket } from '@/lib/ticket-sheet-service';
import { jobMaterialCostService, type JobMaterialCostLine } from '@/lib/job-material-cost-service';
import { inventoryTabSync } from '@/lib/inventory-tab-sync';
import { emailService } from '@/lib/email-service';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const WEBHOOK_SECRET = process.env.MATERIAL_ORDER_WEBHOOK_SECRET;

interface WebhookPayload {
  subject?: string;
  from?: string;
  receivedAt?: string;
  body?: string;
  attachments?: Array<{ name: string; url?: string }>;
}

export async function POST(request: NextRequest) {
  // Auth via shared secret header
  const provided = request.headers.get('x-webhook-secret') || '';
  if (!WEBHOOK_SECRET) {
    return NextResponse.json(
      { error: 'MATERIAL_ORDER_WEBHOOK_SECRET not configured on server' },
      { status: 500 },
    );
  }
  if (provided !== WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Invalid webhook secret' }, { status: 401 });
  }

  let payload: WebhookPayload;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (!payload.body || typeof payload.body !== 'string') {
    return NextResponse.json({ error: 'Email body is required' }, { status: 400 });
  }

  // Parse the email body
  const parsed = parseMaterialOrderEmail(payload.body);

  if (!parsed.jobNumber) {
    return NextResponse.json(
      {
        error: 'Could not extract job number from email body',
        hint: 'Expected a line like "Job #R-11011 - Customer Name". Check the email format.',
        parsed,
      },
      { status: 422 },
    );
  }

  // Match every parsed material line to a catalog item
  const catalog = await unifiedInventoryService.getInventory();
  const catalogPairs = catalog.map(c => ({ productId: c.productId, productName: c.productName }));
  const costByItemId = new Map(catalog.map(c => [c.productId, c.unitCost || 0] as const));
  const priceByItemId = new Map(catalog.map(c => [c.productId, c.unitPrice || 0] as const));
  const nameByItemId = new Map(catalog.map(c => [c.productId, c.productName] as const));

  let matched = 0;
  const enrichedMaterials = parsed.materials.map(line => {
    const itemId = matchCatalogItem(line.itemName, catalogPairs);
    if (itemId) matched++;
    return { ...line, itemId };
  });

  // Build the ticket payload — same shape the /api/portal/tickets create
  // handler expects, then call into the same persistence logic directly.
  const ticketId = `TKT-${parsed.jobNumber}`;

  // Build sheet materials with REAL cost from the catalog (not from parsed line — that's "Cost" but means line total at unitPrice)
  let totalCost = 0;
  let totalPrice = 0;
  const sheetMaterials = enrichedMaterials.map(m => {
    const itemId = m.itemId || m.itemName;
    const productName = m.itemId ? (nameByItemId.get(m.itemId) || m.itemName) : m.itemName;
    const qty = m.quantity || 0;
    const unitCost = m.itemId ? (costByItemId.get(m.itemId) || 0) : 0;
    // The "Cost" column on the email PDF is actually the catalog selling
    // price per unit (named "Cost" in the legacy template — confusing).
    const unitPrice = m.itemId ? (priceByItemId.get(m.itemId) || m.unitCost) : m.unitCost;
    const lineCost = Math.round(unitCost * qty * 100) / 100;
    const linePrice = Math.round(unitPrice * qty * 100) / 100;
    totalCost += lineCost;
    totalPrice += linePrice;
    return {
      productId: itemId,
      productName,
      quantity: qty,
      unitCost,
      unitPrice,
      totalCost: lineCost,
      totalPrice: linePrice,
    };
  });

  // Step 1: persist to Tickets sheet
  const sheetTicket: SheetTicket = {
    ticketId,
    ticketType: 'delivery',
    status: 'created',
    referenceNumber: parsed.jobNumber,
    createdAt: payload.receivedAt || new Date().toISOString(),
    createdBy: 'email-webhook',
    createdByName: 'Material Order Email',
    jobId: parsed.jobNumber,
    jobName: `${parsed.jobNumber} — ${parsed.customerName}`.trim(),
    jobAddress: parsed.jobAddress,
    city: parsed.city,
    state: parsed.state,
    customerName: parsed.customerName,
    customerPhone: '',
    customerEmail: '',
    materials: sheetMaterials,
    totalCost: Math.round(totalCost * 100) / 100,
    totalPrice: Math.round(totalPrice * 100) / 100,
    notes: parsed.specialInstructions,
  };

  try {
    await ticketSheetService.upsert(sheetTicket);
  } catch (err) {
    console.error('[material-order-webhook] Failed to upsert ticket:', err);
    return NextResponse.json(
      { error: 'Failed to persist ticket', detail: String(err) },
      { status: 500 },
    );
  }

  // Step 2: dual-write to legacy Inventory tab (no-op if env not set)
  try {
    await inventoryTabSync.pushTransactions({
      referenceNumber: parsed.jobNumber,
      timestamp: sheetTicket.createdAt,
      lines: sheetMaterials
        .filter(m => m.productId.startsWith('item-'))
        .map(m => ({
          itemId: m.productId,
          amount: -Math.abs(m.quantity),
          unitPrice: m.unitPrice,
        })),
    });
  } catch (err) {
    console.warn('[material-order-webhook] Legacy tab sync skipped:', err);
  }

  // Step 3: auto-create interoffice invoice
  let interofficeInvoiceId = '';
  try {
    const lines: JobMaterialCostLine[] = sheetMaterials.map(m => ({
      productId: m.productId,
      productName: m.productName,
      quantity: m.quantity,
      unitCost: m.unitCost,
      lineCost: m.totalCost,
    }));
    const record = await jobMaterialCostService.createFromDelivery({
      ticketId,
      referenceNumber: parsed.jobNumber,
      jobId: parsed.jobNumber,
      jobNumber: parsed.jobNumber,
      jobName: `${parsed.jobNumber} — ${parsed.customerName}`.trim(),
      customerName: parsed.customerName,
      customerAddress: [parsed.jobAddress, parsed.city, parsed.state, parsed.zip].filter(Boolean).join(', '),
      salesRepName: parsed.salesRepName,
      lines,
      createdBy: 'email-webhook',
      createdByName: 'Material Order Email',
      notes: `Auto-created from email. Material Order #${parsed.materialOrderNumber}. ${parsed.specialInstructions || ''}`.trim(),
    });
    interofficeInvoiceId = record.invoiceId;
  } catch (err) {
    console.warn('[material-order-webhook] Failed to create interoffice invoice:', err);
  }

  // Step 4: notify the driver only. The order is already saved against the
  // job in JobNimbus, so the office does NOT get a create-time email — the
  // office invoice fires later, at load_verified, with price-only data.
  const fullAddress = [parsed.jobAddress, parsed.city, parsed.state, parsed.zip].filter(Boolean).join(', ');
  try {
    await emailService.sendDriverMaterialOrderNotification({
      ticketId,
      jobNumber: parsed.jobNumber,
      customerName: parsed.customerName,
      address: fullAddress,
      salesRepName: parsed.salesRepName,
      materials: sheetMaterials.map(m => ({
        name: m.productName,
        qty: m.quantity,
      })),
      notes: parsed.specialInstructions,
    });
  } catch (err) {
    console.warn('[material-order-webhook] Failed to notify driver:', err);
  }

  // NOTE: stock@rcrsal.com already received the email — that's how we got
  // here. So we do NOT re-send the delivery order email back to stock.
  // We DO send a parsed-confirmation as a separate concern if needed.

  return NextResponse.json({
    success: true,
    ticketId,
    jobNumber: parsed.jobNumber,
    materialsMatched: matched,
    materialsTotal: enrichedMaterials.length,
    interofficeInvoiceId,
    customerName: parsed.customerName,
    materialOrderNumber: parsed.materialOrderNumber,
  });
}

// Health check
export async function GET() {
  return NextResponse.json({
    endpoint: 'material-order-email-webhook',
    configured: !!WEBHOOK_SECRET,
    method: 'POST',
    auth: 'X-Webhook-Secret header',
  });
}
