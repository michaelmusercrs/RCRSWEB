/**
 * Stock Backfill — historical Material Order email catch-up
 *
 * Use case: when first turning on the email→ticket pipeline, the
 * stock@rcrsal.com inbox already contains weeks/months of Material Order
 * PDFs that were physically delivered long ago. Once the Apps Script
 * forwarder runs `resetAllLabels` and re-forwards them, the webhook creates
 * one ticket per email in status='created'. This route finishes the lifecycle
 * for every such ticket in one shot:
 *
 *   for each ticket where status='created':
 *     1. deduct stock from the master Inventory tab
 *     2. update Tickets row to status='load_verified' + loadVerifiedAt/By
 *     3. dual-write -negative transactions into the legacy Inventory app
 *     4. send a price-only invoice to rcrs@rcrsal.com (the office inbox)
 *
 * Idempotent: tickets already past 'created' status are skipped, so running
 * twice has the same effect as running once.
 *
 * Auth: admin only. The page that calls it (/portal/admin/stock-backfill)
 * is owner/admin only too.
 *
 * GET  /api/admin/stock-backfill            → preview: list pending tickets
 * POST /api/admin/stock-backfill            → process them all
 *      Body (optional): { ticketIds?: string[] } to limit to specific tickets
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth-service';
import { ticketSheetService, type SheetTicket } from '@/lib/ticket-sheet-service';
import { runLoadVerifiedAftermath } from '@/lib/load-verified-aftermath';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

interface BackfillResult {
  ticketId: string;
  jobNumber: string;
  customerName: string;
  materialsCount: number;
  totalPrice: number;
  status: 'processed' | 'skipped' | 'failed';
  reason?: string;
}

async function getPendingTickets(specificIds?: string[]): Promise<SheetTicket[]> {
  const all = await ticketSheetService.getAll();
  return all.filter(t => {
    if (t.status !== 'created') return false;
    if (t.ticketType !== 'delivery') return false;
    if (specificIds && specificIds.length > 0 && !specificIds.includes(t.ticketId)) return false;
    return true;
  });
}

export async function GET() {
  const auth = await requireAdmin();
  if (!auth.authenticated) return auth.response;

  try {
    const pending = await getPendingTickets();
    return NextResponse.json({
      success: true,
      pendingCount: pending.length,
      tickets: pending.map(t => ({
        ticketId: t.ticketId,
        jobNumber: t.referenceNumber,
        customerName: t.customerName || '',
        materialsCount: t.materials?.length || 0,
        totalPrice: t.totalPrice || 0,
        createdAt: t.createdAt,
      })),
    });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: String(err) },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.authenticated) return auth.response;

  let body: { ticketIds?: string[] } = {};
  try {
    body = await request.json();
  } catch {
    /* no body, process all */
  }

  const performedBy = auth.user?.userId || 'system-backfill';
  const performedByName = auth.user?.name || 'Stock Backfill';

  try {
    const pending = await getPendingTickets(body.ticketIds);
    const results: BackfillResult[] = [];

    for (const ticket of pending) {
      const baseResult: BackfillResult = {
        ticketId: ticket.ticketId,
        jobNumber: ticket.referenceNumber,
        customerName: ticket.customerName || '',
        materialsCount: ticket.materials?.length || 0,
        totalPrice: ticket.totalPrice || 0,
        status: 'processed',
      };

      try {
        const verifiedAtIso = new Date().toISOString();

        // Run the standard load-verified aftermath: deduct + legacy mirror +
        // price-only office invoice. Same code path the live verify-load
        // handler uses — single source of truth.
        const aftermath = await runLoadVerifiedAftermath({
          ticket,
          verifiedAtIso,
          verifiedByName: performedByName,
          notesPrefix: 'BACKFILL — historical Material Order email processed after the fact.',
        });

        // Mark the ticket as load_verified so the next backfill run skips it.
        await ticketSheetService.updateStatus(ticket.ticketId, 'load_verified');

        const reasons: string[] = [];
        if (aftermath.missingFromCatalog.length > 0) {
          reasons.push(`missing in catalog: ${aftermath.missingFromCatalog.join(', ')}`);
        }
        if (!aftermath.invoiceSent) reasons.push('invoice email failed');
        if (aftermath.errors.length > 0) reasons.push(...aftermath.errors);
        if (reasons.length > 0) baseResult.reason = reasons.join(' | ');
        results.push(baseResult);
      } catch (err) {
        baseResult.status = 'failed';
        baseResult.reason = String(err);
        results.push(baseResult);
      }
    }

    const summary = {
      total: results.length,
      processed: results.filter(r => r.status === 'processed').length,
      failed: results.filter(r => r.status === 'failed').length,
      performedBy: performedByName,
      performedAt: new Date().toISOString(),
    };

    return NextResponse.json({ success: true, summary, results });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: String(err) },
      { status: 500 },
    );
  }
}
