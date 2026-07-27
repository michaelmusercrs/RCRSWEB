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
import { normalizeLineItemQty } from '@/lib/normalize-line-item-qty';
import { googleSheetsService } from '@/lib/google-sheets-service';

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

// Owner always gets failure alerts. Add John/Bart (the people who create
// material orders) via MATERIAL_ORDER_ALERT_EMAILS (comma-separated) so their
// real addresses can be set without a code change.
const OWNER_ALERT_EMAIL = 'rivercityroofingsolutions@gmail.com';
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/**
 * Owner decision (2026-07-10): if a material-order email cannot become a
 * delivery ticket, automatically (a) notify whoever created the order, (b) log
 * the root cause so it can be fixed, (c) alert Michael. The order-email format
 * is highly standardized, so every row here is a bug to investigate.
 *
 * Best-effort and non-throwing — a notification failure must never mask the
 * original error or crash the webhook. Deduplicates repeat emails for the same
 * (subject|from) within 24h but always writes the diagnostic row.
 */
async function notifyParseFailure(opts: {
  payload: WebhookPayload;
  stage: string;
  error: string;
  jobNumber?: string;
  materialsMatched?: number;
  materialsTotal?: number;
}): Promise<void> {
  try {
    const { payload, stage, error } = opts;
    const subject = payload.subject || '(no subject)';
    const from = (payload.from || '').trim();
    const jobNumber = opts.jobNumber || '';
    const rawExcerpt = (payload.body || '').slice(0, 2000);

    const alreadyNotified = await googleSheetsService
      .hasRecentParseFailure(`${subject}|${from}`, 24)
      .catch(() => false);

    const fromIsEmail = EMAIL_RE.test(from);
    const envList = (process.env.MATERIAL_ORDER_ALERT_EMAILS || '')
      .split(',').map(s => s.trim()).filter(Boolean);
    const recipients = Array.from(new Set([
      ...(fromIsEmail ? [from] : []),
      ...envList,
      OWNER_ALERT_EMAIL,
    ]));

    // Always record the root-cause row (even when the email is suppressed).
    await googleSheetsService.logMaterialOrderParseFailure({
      timestamp: new Date().toISOString(),
      stage,
      subject,
      from,
      jobNumber,
      error,
      materialsMatched: opts.materialsMatched ?? '',
      materialsTotal: opts.materialsTotal ?? '',
      rawExcerpt,
      notified: alreadyNotified ? 'suppressed_duplicate_24h' : recipients.join(', '),
    }).catch(() => {});

    if (alreadyNotified) return;

    const esc = (s: string) =>
      s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const html = `
      <div style="font-family:Arial,sans-serif;max-width:640px">
        <h2 style="color:#b91c1c;margin:0 0 8px">Material order could NOT be processed</h2>
        <p>An email sent to <strong>stock@rcrsal.com</strong> could not be turned into a
        delivery ticket, so nothing was created for the warehouse. Please review and resend
        a corrected order, or reply to this message.</p>
        <table style="border-collapse:collapse;font-size:14px;margin:12px 0">
          <tr><td style="padding:4px 12px 4px 0;color:#555">What failed</td><td><strong>${esc(stage)}</strong></td></tr>
          <tr><td style="padding:4px 12px 4px 0;color:#555">Detail</td><td>${esc(error)}</td></tr>
          <tr><td style="padding:4px 12px 4px 0;color:#555">Order subject</td><td>${esc(subject)}</td></tr>
          <tr><td style="padding:4px 12px 4px 0;color:#555">Sent by</td><td>${esc(from || '(unknown)')}</td></tr>
          ${jobNumber ? `<tr><td style="padding:4px 12px 4px 0;color:#555">Job #</td><td>${esc(jobNumber)}</td></tr>` : ''}
          ${opts.materialsTotal !== undefined ? `<tr><td style="padding:4px 12px 4px 0;color:#555">Items matched</td><td>${opts.materialsMatched ?? 0} of ${opts.materialsTotal}</td></tr>` : ''}
        </table>
        <p style="color:#555;font-size:13px;margin:12px 0 4px">First 2KB of the order text:</p>
        <pre style="background:#f6f6f6;border:1px solid #e5e5e5;padding:10px;font-size:12px;white-space:pre-wrap;overflow-x:auto">${esc(rawExcerpt) || '(empty)'}</pre>
        <p style="color:#888;font-size:12px">Logged to the Parse_Failures sheet. — RCRS Inventory System</p>
      </div>`;

    await emailService.send({
      template: 'material-order-parse-failure',
      to: recipients.join(', '),
      subject: `[PARSE FAILURE] Material order not processed — ${subject}`,
      body: html,
      replyTo: fromIsEmail ? from : undefined,
      fromName: 'RCRS Inventory System',
    }).catch(() => {});
  } catch (err) {
    // Never let alerting throw into the request path.
    console.error('[material-order-webhook] notifyParseFailure failed:', err);
  }
}

export async function POST(request: NextRequest) {
  // SECURITY 2026-05-20: confirmed fail-closed. If MATERIAL_ORDER_WEBHOOK_SECRET
  // is unset/empty the webhook is treated as DISABLED and returns 503 (was 500
  // before — semantically the route is unavailable, not crashing). If the
  // secret IS set but the provided header doesn't match, we return 401 as
  // before. Either way, a request CANNOT succeed without a configured secret.
  const provided = request.headers.get('x-webhook-secret') || '';
  if (!WEBHOOK_SECRET) {
    console.error('[WEBHOOK FAIL-CLOSED route=material-order-email] CRITICAL: MATERIAL_ORDER_WEBHOOK_SECRET is not set - webhook disabled, returning 503');
    return NextResponse.json(
      { error: 'Webhook not configured' },
      { status: 503 },
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
  let parsed: ReturnType<typeof parseMaterialOrderEmail>;
  try {
    parsed = parseMaterialOrderEmail(payload.body);
  } catch (err) {
    await notifyParseFailure({ payload, stage: 'parser_exception', error: String(err) });
    return NextResponse.json(
      { error: 'Parser threw while reading the email body', detail: String(err) },
      { status: 422 },
    );
  }

  if (!parsed.jobNumber) {
    await notifyParseFailure({
      payload,
      stage: 'no_job_number',
      error: 'Could not extract a job number (expected e.g. "Job #R-11011 - Customer Name").',
    });
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
  const uomAnomalies: Array<{
    itemName: string;
    itemId: string | null;
    originalQty: number;
    normalizedQty: number;
    reason: string;
    warning?: string;
  }> = [];
  const enrichedMaterials = parsed.materials.map(line => {
    const itemId = matchCatalogItem(line.itemName, catalogPairs);
    if (itemId) matched++;
    // UoM sanity check. We NEVER convert — PMs order in the stock unit (Ridge
    // Vent in sticks), so the parsed qty is trusted as-is. Run the check now
    // that the catalog match has resolved the productId (the parser's first
    // pass runs before catalog match). It only FLAGS an implausibly large qty
    // for human review; the quantity is left unchanged.
    const check = normalizeLineItemQty({
      productId: itemId || undefined,
      productName: line.itemName,
      qty: line.quantity,
    });
    if (check.reason === 'flag_review') {
      uomAnomalies.push({
        itemName: line.itemName,
        itemId,
        originalQty: line.quantity,
        normalizedQty: line.quantity, // unchanged
        reason: check.reason,
        warning: check.warning,
      });
      console.warn(
        `[material-order-webhook] UoM REVIEW FLAG: ${itemId || line.itemName} qty=${line.quantity} (unchanged) — ${check.warning}`,
      );
    }
    return { ...line, itemId, quantity: line.quantity };
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

  // Surface UoM review flags in the ticket notes so office staff can eyeball
  // any line item whose qty looks unusually large for the stock unit (e.g. a
  // Ridge Vent number that may have been pasted in linear feet). Quantities
  // are LEFT AS-ENTERED — this is a flag, not a conversion. DO NOT email or
  // alert — owner directive: direct writes only.
  const uomNoteLines = uomAnomalies.map(
    (a) =>
      `[UoM-REVIEW] ${a.itemId || a.itemName}: qty ${a.normalizedQty} left as-entered — ${a.warning || 'verify unit with PM'}`,
  );
  const combinedNotes = [parsed.specialInstructions, ...uomNoteLines].filter(Boolean).join('\n');

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
    notes: combinedNotes,
  };

  try {
    const ok = await ticketSheetService.upsert(sheetTicket);
    if (!ok) {
      // upsertGenericRow swallows errors and returns false. Surface that as
      // a 500 so the caller (Apps Script) doesn't think the write succeeded.
      console.error('[material-order-webhook] ticketSheetService.upsert returned false (Sheets init or write failed silently)');
      await notifyParseFailure({
        payload,
        stage: 'sheet_write_returned_false',
        error: 'ticketSheetService.upsert returned false (check GOOGLE_SHEETS_ID + credentials).',
        jobNumber: parsed.jobNumber,
        materialsMatched: matched,
        materialsTotal: enrichedMaterials.length,
      });
      return NextResponse.json(
        { error: 'Failed to persist ticket (sheets write returned false — check GOOGLE_SHEETS_ID and credentials)' },
        { status: 500 },
      );
    }
  } catch (err) {
    console.error('[material-order-webhook] Failed to upsert ticket:', err);
    await notifyParseFailure({
      payload,
      stage: 'sheet_write_exception',
      error: String(err),
      jobNumber: parsed.jobNumber,
      materialsMatched: matched,
      materialsTotal: enrichedMaterials.length,
    });
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

  // Soft alert (non-blocking): the ticket was created, but if NONE of the
  // parsed lines matched the catalog, there is nothing to deduct and the
  // delivery is effectively empty — flag it so office/Michael can fix the
  // catalog match, without holding up Rick's ticket.
  if (enrichedMaterials.length > 0 && matched === 0) {
    await notifyParseFailure({
      payload,
      stage: 'zero_catalog_matches',
      error: `Ticket ${ticketId} created but 0 of ${enrichedMaterials.length} line items matched the catalog — no inventory will deduct. Check catalog names / match-catalog-item.ts.`,
      jobNumber: parsed.jobNumber,
      materialsMatched: 0,
      materialsTotal: enrichedMaterials.length,
    });
  }

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
