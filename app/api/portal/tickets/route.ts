import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-service';
import { deliveryWorkflowService, TicketStatus, TicketType, MaterialItem } from '@/lib/delivery-workflow-service';
import { groupMeService, getGroupMeConfigFromEnv } from '@/lib/groupme-service';
import { deliveryReminderService } from '@/lib/delivery-reminder-service';
import { ticketSheetService, type SheetTicket } from '@/lib/ticket-sheet-service';
import { emailService } from '@/lib/email-service';
import { jobMaterialCostService, type JobMaterialCostLine } from '@/lib/job-material-cost-service';
import { unifiedInventoryService } from '@/lib/unified-inventory-service';
import { upsertDeliveryScheduleEntry } from '@/lib/delivery-schedule-service';
import { normalizeLineItemQty } from '@/lib/normalize-line-item-qty';
import { filterCostByRole } from '@/lib/cost-visibility';
import { syncTicketPhotoToJN } from '@/lib/jn-photo-sync';
import { deriveScheduledDate } from '@/lib/delivery-date-parser';
import { evaluateMove, POST_ZONE } from '@/lib/ticket-status-matrix';
import { withKeyLock } from '@/lib/request-mutex';

// Best-effort mirror of a status change onto the master Tickets tab — the
// sheet the warehouse dashboard (/api/warehouse/today) reads. Without this,
// status actions that go through deliveryWorkflowService only reach the
// Delivery Tickets sheet and the driver's phone never sees the change.
async function syncTicketsTabStatus(
  ticketId: string,
  status: import('@/lib/ticket-sheet-service').TicketStatus,
): Promise<boolean> {
  try {
    // updateStatus returns false on a swallowed Sheets failure (row missing,
    // write rejected) — propagate that instead of reporting a phantom success.
    return await ticketSheetService.updateStatus(ticketId, status);
  } catch (err) {
    // The Sheets layer already retries rate-limit failures; reaching here means
    // the mirror genuinely failed. Return false so the caller can tell the
    // driver the board didn't update (instead of a false "success").
    console.warn(`[tickets] Failed to mirror status '${status}' to Tickets tab:`, err);
    return false;
  }
}

// Helper function to send delivery notification (GroupMe + customer auto-notify)
async function sendDeliveryNotification(ticket: any, status: string) {
  try {
    // Send GroupMe office notification (existing behavior)
    const groupMeConfig = getGroupMeConfigFromEnv();
    if (groupMeConfig.enabled && groupMeConfig.botId && groupMeConfig.notifyOn.deliveryUpdates) {
      const notification = groupMeService.createDeliveryUpdateNotification({
        ticketId: ticket.ticketId,
        jobName: ticket.jobName || 'Unknown Job',
        jobAddress: ticket.jobAddress || 'Unknown Address',
        status: status,
        driverName: ticket.assignedDriverName,
      });
      await groupMeService.sendNotification(groupMeConfig, notification);
    }

    // Send auto-notification to customer via reminder service
    await deliveryReminderService.sendStatusNotification(ticket, ticket.status as TicketStatus);
  } catch (error) {
    console.error('Failed to send delivery notification:', error);
  }
}

export async function GET(request: NextRequest) {
  const auth = await requireAuth();
  if (!auth.authenticated) return auth.response;

  try {
    const { searchParams } = new URL(request.url);
    const ticketId = searchParams.get('ticketId');
    const status = searchParams.get('status');
    const ticketType = searchParams.get('type');
    const driverId = searchParams.get('driverId');
    const projectManager = searchParams.get('pm');
    const date = searchParams.get('date');
    const limit = searchParams.get('limit');

    // Get single ticket
    if (ticketId) {
      const ticket = await deliveryWorkflowService.getTicketById(ticketId);
      if (!ticket) {
        return NextResponse.json({ error: 'Ticket not found' }, { status: 404 });
      }
      // Strip purchase cost for roles that must never see it (driver/rep/customer).
      return NextResponse.json(filterCostByRole(ticket, auth.user.role));
    }

    // Single ticket by JN reference (R-XXXXX) from the canonical Tickets tab —
    // used by the Credit Memo form to prefill the return line items from the
    // job's original delivery. Cost-filtered by role.
    const reference = searchParams.get('reference');
    if (reference) {
      const t = await ticketSheetService.getByReferenceNumber(reference);
      if (!t) {
        return NextResponse.json({ error: 'No delivery found for that job number' }, { status: 404 });
      }
      return NextResponse.json(filterCostByRole(t, auth.user.role));
    }

    // Canonical history source: read the authoritative 'Tickets' tab
    // (ticketSheetService) — every TKT-* order incl. all email-created
    // deliveries (600+). The legacy Delivery Tickets tab that
    // deliveryWorkflowService reads only holds ~20 orphaned rows, so the
    // Order History page must opt into this via ?source=canonical. Existing
    // consumers (driver pipeline, etc.) keep the legacy behavior unchanged.
    if (searchParams.get('source') === 'canonical') {
      const all = await ticketSheetService.getAll();
      let list = all;
      if (ticketType) list = list.filter(t => t.ticketType === ticketType);
      if (status) list = list.filter(t => t.status === status);
      list = list
        .slice()
        .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
      const mapped = list.map(t => ({
        ticketId: t.ticketId,
        referenceNumber: t.referenceNumber,
        ticketType: t.ticketType,
        status: t.status,
        jobNumber: t.jobId || t.referenceNumber,
        jobName: t.jobName,
        customerName: t.customerName,
        jobAddress: t.jobAddress,
        city: t.city,
        state: t.state,
        createdAt: t.createdAt,
        createdByName: t.createdByName,
        loadVerifiedAt: t.completedAt,
        materials: t.materials,
        totalCost: t.totalCost,
        totalPrice: t.totalPrice,
        notes: t.notes,
      }));
      const capped = limit ? mapped.slice(0, parseInt(limit)) : mapped;
      // Strip cost fields for roles that must never see purchase price.
      return NextResponse.json(filterCostByRole(capped, auth.user.role));
    }

    // Get tickets with filters
    const tickets = await deliveryWorkflowService.getTickets({
      status: status as TicketStatus | undefined,
      ticketType: ticketType as TicketType | undefined,
      driverId: driverId || undefined,
      projectManager: projectManager || undefined,
      date: date || undefined,
      limit: limit ? parseInt(limit) : undefined,
    });

    // Return array directly for driver portal compatibility (cost-filtered by role —
    // these tickets carry ourCost/unitCost which reps/drivers must not see).
    return NextResponse.json(filterCostByRole(tickets, auth.user.role));
  } catch (error) {
    console.error('Tickets API GET error:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth();
  if (!auth.authenticated) return auth.response;

  try {
    const body = await request.json();
    const { action, ...data } = body;

    switch (action) {
      case 'create': {
        // ─────────────────────────────────────────────────────────────────
        // LIVE TICKET CREATION — Triple-write + interoffice invoice + notify
        //
        // Per the rules:
        //   1. NO JobNimbus lookup. The form / Material Order PDF carries
        //      every field we need (job#, customer, address, sales rep,
        //      materials, special instructions). Pulling from JN is for the
        //      sync layer, not the create path.
        //   2. Persist the ticket to BOTH the new Tickets sheet tab AND the
        //      legacy Inventory tab Richard's app reads from. 2-way sync.
        //   3. Auto-create an interoffice invoice (Job_Material_Costs tab).
        //      This is INTERNAL — never goes to customer, never goes to JN.
        //   4. Email stock@rcrsal.com the work order WITHOUT cost.
        //   5. Email Sara the office notification WITH cost (she handles
        //      invoicing). Customer NEVER receives anything.
        //   6. Job number is ALWAYS the R-XXXXX format (the JN job number).
        //      Forms / parsers may pass bare digits or "M-1234" — normalize
        //      to "R-XXXXX" so every downstream surface uses the same key.
        // ─────────────────────────────────────────────────────────────────

        // Normalize the job number to R-XXXXX. Accepts bare digits, "R-XXXXX",
        // or "M-XXXX" (the material order number, sometimes pasted by mistake).
        const rawJobNumber = String(data.jobNumber || data.jobId || '').trim();
        const jobNumberDigits = rawJobNumber.replace(/^[A-Za-z]-?/, '').replace(/\D/g, '');
        const normalizedJobNumber = jobNumberDigits ? `R-${jobNumberDigits}` : rawJobNumber;

        const rawFormMaterials = (data.materials as MaterialItem[]) || [];

        // UoM sanity check: we do NOT convert quantities — PMs enter Ridge
        // Vent (and everything else) in the stock unit (sticks), so the
        // entered qty is trusted. The helper only FLAGS an implausibly large
        // qty for human review. See lib/normalize-line-item-qty.ts.
        const uomFormAnomalies: string[] = [];
        const formMaterials: MaterialItem[] = rawFormMaterials.map((m) => {
          const norm = normalizeLineItemQty({
            productId: m.productId,
            productName: m.productName,
            qty: m.quantity || 0,
          });
          if (norm.reason === 'flag_review') {
            uomFormAnomalies.push(
              `[UoM-REVIEW] ${m.productId || m.productName}: qty ${norm.qty} left as-entered — ${norm.warning}`,
            );
            console.warn(
              `[tickets/create] UoM review flag: ${m.productId} qty=${norm.qty} (unchanged) — ${norm.warning}`,
            );
          }
          return m;
        });

        // Look up the real unitCost for each material from the inventory
        // catalog. The form passes unitPrice (selling) but not cost — cost
        // lives in the catalog and is the source of truth. We also keep a
        // unitPrice lookup as a fallback: the warehouse Return / Credit Memo
        // form sends bare {productId, qty} lines with no price (Rick's UI is
        // cost/price-free), so the selling price comes from the catalog.
        const catalog = await unifiedInventoryService.getInventory();
        const costLookup = new Map<string, number>();
        const priceLookup = new Map<string, number>();
        for (const item of catalog) {
          costLookup.set(item.productId, item.unitCost || 0);
          priceLookup.set(item.productId, item.unitPrice || 0);
        }

        // Step 1: persist via the existing delivery workflow service so the
        // pipeline + driver dashboard stay populated. This also writes to
        // the Delivery Tickets tab via the existing path.
        const ticket = await deliveryWorkflowService.createTicket({
          ticketType: data.ticketType || 'delivery',
          createdBy: data.createdBy,
          createdByName: data.createdByName || 'Unknown',
          createdByRole: data.createdByRole || 'project_manager',
          jobId: data.jobId,
          jobName: data.jobName,
          jobAddress: data.jobAddress,
          city: data.city,
          state: data.state,
          zip: data.zip,
          customerName: data.customerName,
          customerPhone: data.customerPhone,
          // customerEmail captured for office reference only — NEVER used
          // to email the customer about a material order.
          customerEmail: data.customerEmail,
          projectManager: data.projectManager,
          pmPhone: data.pmPhone,
          pmEmail: data.pmEmail,
          materials: formMaterials,
          requestedDate: data.requestedDate,
          requestedTime: data.requestedTime,
          priority: data.priority,
          specialInstructions: data.specialInstructions,
          returnReason: data.returnReason,
          pickupReason: data.pickupReason,
          relatedTicketId: data.relatedTicketId,
        });

        // Build the unified material rows with REAL cost from the catalog.
        let totalCost = 0;
        let totalPrice = 0;
        const sheetMaterials = formMaterials.map(m => {
          const qty = m.quantity || 0;
          const unitCost = costLookup.get(m.productId) || 0;
          const unitPrice = m.unitPrice || priceLookup.get(m.productId) || 0;
          const lineCost = Math.round(unitCost * qty * 100) / 100;
          const linePrice = Math.round(unitPrice * qty * 100) / 100;
          totalCost += lineCost;
          totalPrice += linePrice;
          return {
            productId: m.productId,
            productName: m.productName,
            quantity: qty,
            unitCost,
            unitPrice,
            totalCost: lineCost,
            totalPrice: linePrice,
          };
        });

        // Reference number is always the normalized R-XXXXX. The Tickets tab,
        // the legacy Inventory tab R# column, the interoffice invoice, and
        // the office email all use this single key so the data is joinable.
        const referenceNumber = normalizedJobNumber || ticket.ticketId;
        const isReturn = ticket.ticketType === 'return';

        // Step 2: mirror into the unified Tickets sheet tab.
        try {
          // Surface any UoM auto-conversions on the ticket notes so office
          // staff can see what was changed at a glance.
          const baseNotes = data.specialInstructions || data.workOrderBody || data.returnReason || '';
          const combinedNotes = [baseNotes, ...uomFormAnomalies].filter(Boolean).join('\n');
          // Delivery date: an office-entered requestedDate (YYYY-MM-DD) wins;
          // otherwise derive from the special instructions / next business
          // day, same as the email webhook.
          const requestedYmd = /^\d{4}-\d{2}-\d{2}$/.test(String(data.requestedDate || '').trim())
            ? String(data.requestedDate).trim()
            : '';
          const derivedSchedule = requestedYmd
            ? null
            : deriveScheduledDate(data.specialInstructions || '', '', ticket.createdAt);
          const sheetTicket: SheetTicket = {
            ticketId: ticket.ticketId,
            ticketType: ticket.ticketType,
            status: ticket.status,
            referenceNumber,
            createdAt: ticket.createdAt,
            createdBy: ticket.createdBy,
            createdByName: ticket.createdByName,
            jobId: data.jobId,
            jobName: data.jobName,
            jobAddress: data.jobAddress,
            city: data.city,
            state: data.state,
            customerName: data.customerName,
            customerPhone: data.customerPhone,
            customerEmail: data.customerEmail,
            materials: sheetMaterials,
            totalCost: Math.round(totalCost * 100) / 100,
            totalPrice: Math.round(totalPrice * 100) / 100,
            notes: combinedNotes,
            scheduledDate: requestedYmd || derivedSchedule!.date,
            scheduleSource: requestedYmd ? 'office' : derivedSchedule!.source,
          };
          await ticketSheetService.upsert(sheetTicket);
        } catch (mirrorErr) {
          console.warn('[tickets] Failed to mirror ticket to Tickets tab:', mirrorErr);
        }

        // Step 3 (REMOVED 2026-08-18): legacy Inventory-tab transaction
        // dual-write. Richard's standalone app reads the catalog-state mirror
        // maintained by the sync-inventory-tab cron (Portal->legacy, every
        // 15 min), which deletes+rewrites that tab — so these transaction rows
        // were wiped within 15 min and their schema fought the cron's. The
        // cron is the sole mirror. See inventory-tab-sync.ts (deprecated).

        // Step 4: auto-create the interoffice invoice (or credit memo for
        // returns). This is the internal job-material-cost record. NEVER
        // goes to customer, NEVER goes to JN.
        let interofficeInvoiceId = '';
        try {
          const invoiceLines: JobMaterialCostLine[] = sheetMaterials.map(m => ({
            productId: m.productId,
            productName: m.productName,
            quantity: m.quantity,
            unitCost: m.unitCost,
            lineCost: m.totalCost,
          }));

          const record = isReturn
            ? await jobMaterialCostService.createCreditMemoFromReturn({
                ticketId: ticket.ticketId,
                referenceNumber,
                jobId: data.jobId,
                jobNumber: normalizedJobNumber,
                jobName: data.jobName,
                customerName: data.customerName,
                customerAddress: [data.jobAddress, data.city, data.state, data.zip].filter(Boolean).join(', '),
                salesRepName: data.salesRepName || data.projectManager || '',
                lines: invoiceLines,
                createdBy: auth.user.userId,
                createdByName: auth.user.name,
              })
            : await jobMaterialCostService.createFromDelivery({
                ticketId: ticket.ticketId,
                referenceNumber,
                jobId: data.jobId,
                jobNumber: normalizedJobNumber,
                jobName: data.jobName,
                customerName: data.customerName,
                customerAddress: [data.jobAddress, data.city, data.state, data.zip].filter(Boolean).join(', '),
                salesRepName: data.salesRepName || data.projectManager || '',
                lines: invoiceLines,
                createdBy: auth.user.userId,
                createdByName: auth.user.name,
              });
          interofficeInvoiceId = record.invoiceId;
        } catch (invErr) {
          console.warn('[tickets] Failed to auto-create interoffice invoice:', invErr);
        }

        // Step 4b (returns only): email the office the credit memo, like the
        // material-order invoice email. PRICE side only — never cost. The JN
        // job note is posted inside createCreditMemoFromReturn (also
        // best-effort, no cost). Never blocks the response.
        if (isReturn) {
          try {
            const unitByProduct = new Map(formMaterials.map(f => [f.productId, f.unit]));
            await emailService.sendCreditMemoNotification({
              ticketId: ticket.ticketId,
              invoiceId: interofficeInvoiceId,
              jobNumber: normalizedJobNumber || referenceNumber,
              customerName: data.customerName || '',
              lines: sheetMaterials.map(m => ({
                name: m.productName,
                qty: m.quantity,
                unit: unitByProduct.get(m.productId),
                unitPrice: m.unitPrice,
                linePrice: m.totalPrice,
              })),
              totalPrice: Math.round(totalPrice * 100) / 100,
              reason: data.returnReason || '',
              createdByName: auth.user.name,
            });
          } catch (cmEmailErr) {
            console.warn('[tickets] Failed to send credit-memo office email:', cmEmailErr);
          }
        }

        // Step 4c (returns only): reduce the job's Job_Breakdowns material
        // total (PRICE side) by the returned amount. The warehouse form only
        // carries the R-number, so resolve jobId/jobName from the job's
        // original delivery ticket when the form didn't send them.
        // Idempotent per credit-memo id; best-effort.
        if (isReturn && interofficeInvoiceId) {
          try {
            let origDelivery: SheetTicket | null = null;
            try {
              const orig = await ticketSheetService.getByReferenceNumber(referenceNumber);
              if (orig && orig.ticketType === 'delivery') origDelivery = orig;
            } catch {
              // fall through with form-supplied identifiers only
            }
            const adj = await jobMaterialCostService.applyCreditMemoToBreakdown({
              creditMemoId: interofficeInvoiceId,
              jobId: data.jobId || origDelivery?.jobId || '',
              jobName: data.jobName || origDelivery?.jobName || '',
              customerName: data.customerName || origDelivery?.customerName || '',
              creditPrice: Math.round(totalPrice * 100) / 100,
            });
            if (!adj.applied) {
              console.warn(
                `[tickets] Credit memo ${interofficeInvoiceId} not applied to breakdown: ${adj.reason}`,
              );
            }
          } catch (bdErr) {
            console.warn('[tickets] Failed to adjust job breakdown for credit memo:', bdErr);
          }
        }

        // Step 5: email stock@rcrsal.com the work order. NO cost in the
        // body — items is just "qty unit name" strings. Skip for pickup.
        if (ticket.ticketType === 'delivery') {
          try {
            const items = sheetMaterials.map(
              m => `${m.quantity} ${formMaterials.find(f => f.productId === m.productId)?.unit || ''} ${m.productName}`.trim()
            );
            const fullAddress = [data.jobAddress, data.city, data.state, data.zip].filter(Boolean).join(', ');
            await emailService.sendDeliveryOrder({
              ticketId: ticket.ticketId,
              customerName: data.customerName || 'Customer',
              address: fullAddress,
              items,
              deliveryDate: data.requestedDate,
              notes: data.specialInstructions || data.workOrderBody,
            });
          } catch (emailErr) {
            console.warn('[tickets] Failed to send delivery order email:', emailErr);
          }
        }

        // No office email on ticket creation — the order is already saved
        // against the job in JobNimbus, and the office invoice fires later
        // at load_verified (price-only, sent from delivery-workflow-service).

        // Step 6: write a Delivery Schedule entry. Owner directive:
        // "delivery scheduling is automatic when submitting a material order
        //  to email stock@rcrsal.com." We lazy-create the sheet tab and
        //  upsert by ticketId. Driver/scheduledDate stay blank until office
        //  assigns. Best-effort — never blocks the response.
        try {
          await upsertDeliveryScheduleEntry({
            ticketId: ticket.ticketId,
            jobNumber: normalizedJobNumber,
            customerName: data.customerName || '',
            address: [data.jobAddress, data.city, data.state, data.zip].filter(Boolean).join(', '),
            scheduledDate: data.requestedDate || '',
            status: 'pending',
            driverSlug: '',
            notes: data.specialInstructions || data.workOrderBody || '',
          });
        } catch (scheduleErr) {
          console.warn('[tickets] Failed to upsert Delivery Schedule entry:', scheduleErr);
        }

        return NextResponse.json({
          success: true,
          ticket,
          interofficeInvoiceId,
        });
      }

      case 'assign-driver': {
        const ticket = await deliveryWorkflowService.assignDriver(
          data.ticketId,
          data.driverId,
          data.driverName,
          data.vehicle,
          data.scheduledDate,
          data.scheduledTime
        );
        const assignSynced = await syncTicketsTabStatus(data.ticketId, 'assigned');
        // Also mirror the driver assignment onto the Tickets tab so the
        // delivery-route view (which reads canonical assignedTo/assignedToName)
        // groups this ticket under the driver instead of "Unassigned".
        try {
          await ticketSheetService.patch(data.ticketId, {
            assignedTo: data.driverId || '',
            assignedToName: data.driverName || '',
            ...(data.scheduledDate ? { scheduledDate: data.scheduledDate, scheduleSource: 'office' } : {}),
          });
        } catch (e) {
          console.warn('[tickets] assign-driver: failed to mirror driver to Tickets tab:', e);
        }
        return NextResponse.json({ success: true, ticket, boardSynced: assignSynced });
      }

      case 'set-status': {
        // Rick's "Fix status" tool — plain status correction with NO inventory
        // side effects. The safety matrix (lib/ticket-status-matrix) refuses any
        // move that would change the deduction state; those must go through
        // verify-load (deduct) or undo-verify-load (restore) instead. So a
        // mis-click can be fixed without risking a double/skipped deduction.
        const current = await ticketSheetService.getById(data.ticketId);
        if (!current) {
          return NextResponse.json({ success: false, error: 'Ticket not found' }, { status: 404 });
        }
        const target = data.status as import('@/lib/ticket-sheet-service').TicketStatus;
        const verdict = evaluateMove(current.status, target, auth.user.role);
        if (!verdict.ok) {
          return NextResponse.json(
            { success: false, error: verdict.error, hint: verdict.hint },
            { status: 400 },
          );
        }
        const reason = (data.reason || '').trim();
        if (verdict.requiresReason && !reason) {
          return NextResponse.json(
            { success: false, error: 'A reason is required for this change.', requiresReason: true },
            { status: 400 },
          );
        }
        const completedAt = target === 'completed' ? new Date().toISOString() : undefined;
        const ok = await ticketSheetService.updateStatus(data.ticketId, target, completedAt);
        if (!ok) {
          return NextResponse.json({ success: false, error: 'Board update failed — try again' }, { status: 502 });
        }
        // Append an audit note onto the ticket (this route's audit trail).
        const stamp = new Date().toISOString().slice(0, 16).replace('T', ' ');
        const who = auth.user?.name || auth.user?.email || auth.user.role;
        const note = `[STATUS ${current.status}->${target} by ${who} @ ${stamp}${reason ? `: ${reason}` : ''}]`;
        try {
          await ticketSheetService.patch(data.ticketId, {
            notes: `${current.notes ? current.notes + '\n' : ''}${note}`,
          });
        } catch (e) {
          console.warn('[tickets] set-status: failed to append audit note:', e);
        }
        return NextResponse.json({ success: true, status: target, note });
      }

      case 'undo-verify-load': {
        // Reverse an accidental "Mark Loaded": restore the deducted stock and
        // move the ticket back to materials_pulled. Office/admin/owner/manager
        // only, reason required. Invoices/breakdowns are intentionally left
        // intact — re-verify reuses the existing invoice (no double count) and
        // the net-delta deduction log lets stock re-deduct exactly once.
        // Serialized per ticket so a double-click can't double-restore.
        return await withKeyLock(`ticket:${data.ticketId}`, async () => {
          const sheetTicket = await ticketSheetService.getById(data.ticketId);
          if (!sheetTicket) {
            return NextResponse.json({ success: false, error: 'Ticket not found' }, { status: 404 });
          }
          if (!['office', 'admin', 'owner', 'manager'].includes(auth.user.role)) {
            return NextResponse.json({ success: false, error: 'Only office/admin can undo verify-load.' }, { status: 403 });
          }
          // Status gate: only meaningful from a POST (stock-committed) state.
          if (!POST_ZONE.includes(sheetTicket.status)) {
            return NextResponse.json(
              { success: false, error: `Ticket is "${sheetTicket.status}" — there's nothing loaded to undo.` },
              { status: 400 },
            );
          }
          const undoReason = (data.reason || '').trim();
          if (!undoReason) {
            return NextResponse.json({ success: false, error: 'A reason is required to undo verify-load.', requiresReason: true }, { status: 400 });
          }
          const { undoVerifyLoad } = await import('@/lib/load-verified-aftermath');
          const undo = await undoVerifyLoad(sheetTicket);
          if (undo.errors.length) {
            // Something went wrong mid-restore. Do NOT move the status back —
            // undoVerifyLoad rolls back cleanly, so a retry is safe; a moved
            // status here could strand a partially-reversed ticket.
            return NextResponse.json({ success: false, error: 'Undo could not complete — safe to retry.', detail: undo.errors }, { status: 500 });
          }
          const isStock = (sheetTicket.orderSource || 'stock') !== 'other_vendor';
          if (undo.restored === 0 && isStock) {
            // POST-status stock ticket but no logged deductions to reverse. This
            // means the deduction was never logged (a lost-log case) — we can't
            // safely reason about inventory, so leave the status alone and ask
            // for a manual check instead of silently "succeeding" (D3).
            return NextResponse.json(
              { success: false, error: 'No logged deductions found for this loaded ticket. If stock was deducted it was not logged — check inventory manually. Status left unchanged.' },
              { status: 409 },
            );
          }
          const undoSynced = await syncTicketsTabStatus(data.ticketId, 'materials_pulled');
          if (!undoSynced) {
            return NextResponse.json(
              { success: false, error: 'Stock restored, but the board status update failed — tap again.' },
              { status: 502 },
            );
          }
          const undoStamp = new Date().toISOString().slice(0, 16).replace('T', ' ');
          const undoWho = auth.user?.name || auth.user?.email || auth.user.role;
          const undoNote = `[UNDO-VERIFY by ${undoWho} @ ${undoStamp}: ${undoReason} — restored ${undo.restored} item(s)]`;
          try {
            await ticketSheetService.patch(data.ticketId, {
              notes: `${sheetTicket.notes ? sheetTicket.notes + '\n' : ''}${undoNote}`,
            });
          } catch (e) {
            console.warn('[tickets] undo-verify-load: failed to append audit note:', e);
          }
          return NextResponse.json({ success: true, restored: undo.restored, restoredItems: undo.restoredItems, note: undoNote });
        });
      }

      case 'pull-materials': {
        // Prefer the authenticated identity over the client-supplied name
        // (the warehouse UI used to hardcode 'rick').
        const pulledBy = auth.user?.name || data.pulledBy || 'driver';
        const ticket = await deliveryWorkflowService.pullMaterials(data.ticketId, pulledBy);
        // The warehouse dashboard reads status from the master Tickets tab,
        // while deliveryWorkflowService writes only to Delivery Tickets.
        // Without this mirror the Pull button is a silent no-op on Rick's
        // phone and the ticket strands at 'created' forever.
        const pullSynced = await syncTicketsTabStatus(data.ticketId, 'materials_pulled');
        return NextResponse.json({ success: true, ticket, boardSynced: pullSynced });
      }

      case 'verify-load': {
        // Serialized per ticket so two simultaneous "Mark Loaded" taps can't
        // both pass the alreadyVerified check and double-deduct/duplicate.
        return await withKeyLock(`ticket:${data.ticketId}`, async () => {
        // Use the master Tickets sheet as source of truth so this works for
        // BOTH webhook-created tickets (Tickets only) AND portal-created
        // tickets (Tickets + Delivery Tickets).
        const sheetTicket = await ticketSheetService.getById(data.ticketId);
        if (!sheetTicket) {
          return NextResponse.json({ success: false, error: 'Ticket not found' }, { status: 404 });
        }

        // HOLD gate (owner rule): a ticket flagged [NEEDS REVIEW] by the ingest
        // trust-check has its invoice + stock deduction held until the office
        // confirms the order. Refuse verify-load (which fires both) and tell the
        // driver why. The office clears it by removing the [NEEDS REVIEW] marker
        // from the ticket notes once the order is fixed.
        if ((sheetTicket.notes || '').includes('[NEEDS REVIEW')) {
          return NextResponse.json({
            success: false,
            needsReview: true,
            error: 'This order is flagged NEEDS REVIEW — the office must confirm it before it can be loaded and invoiced. It will be released once reviewed.',
          }, { status: 409 });
        }

        // Idempotency: skip the aftermath if this ticket has already been
        // verified. Status reflects the prior state because we haven't
        // updated it yet. Pre-verify statuses (created / assigned /
        // materials_pulled) all still need the aftermath — the Tickets tab
        // now mirrors those earlier steps too. The aftermath itself is also
        // internally idempotent (invoice dedup + deduction log) as a second
        // layer of protection.
        const alreadyVerified = !['created', 'assigned', 'materials_pulled'].includes(
          sheetTicket.status,
        );
        const verifiedAtIso = new Date().toISOString();

        // Assemble a driver-report string from the loading-checklist
        // submission. Persisted on the ticket and surfaced on the office
        // invoice so flagged damage / returns / photos are visible.
        const driverReportLines: string[] = [];
        if (typeof data.notes === 'string' && data.notes.trim()) {
          driverReportLines.push(`Driver: ${data.notes.trim()}`);
        }
        if (Array.isArray(data.damageReports) && data.damageReports.length > 0) {
          driverReportLines.push(
            `Damage flagged (${data.damageReports.length}): ${data.damageReports.join('; ')}`,
          );
        }
        if (Array.isArray(data.returnItems) && data.returnItems.length > 0) {
          driverReportLines.push(
            `Returns flagged (${data.returnItems.length}): ${data.returnItems.join('; ')}`,
          );
        }
        if (Array.isArray(data.photoUrls) && data.photoUrls.length > 0) {
          driverReportLines.push(`Photos (${data.photoUrls.length}): ${data.photoUrls.join(' | ')}`);
        }
        const driverReport = driverReportLines.join('\n');

        // Always update Tickets-sheet status + best-effort write to Delivery
        // Tickets sheet (returns null for webhook tickets, that's fine).
        let dtTicket = null;
        try {
          dtTicket = await deliveryWorkflowService.verifyLoad(
            data.ticketId,
            data.verifiedBy,
            data.gpsLocation,
          );
        } catch (err) {
          console.warn('[verify-load] Delivery Tickets sheet update skipped:', err);
        }
        try {
          await ticketSheetService.updateStatus(data.ticketId, 'load_verified');
        } catch (err) {
          console.warn('[verify-load] Failed to update Tickets tab status:', err);
        }

        // Persist driver-report onto the ticket notes column.
        if (driverReport) {
          const merged = sheetTicket.notes
            ? `${sheetTicket.notes}\n${driverReport}`
            : driverReport;
          try {
            await ticketSheetService.patch(data.ticketId, { notes: merged });
          } catch (err) {
            console.warn('[verify-load] Failed to persist driver report:', err);
          }
        }

        // Run deduction + legacy mirror + office invoice exactly once per
        // ticket, regardless of which sheet the ticket originated in.
        let aftermath = null;
        let aftermathError: string | null = null;
        if (!alreadyVerified) {
          try {
            const { runLoadVerifiedAftermath } = await import('@/lib/load-verified-aftermath');
            aftermath = await runLoadVerifiedAftermath({
              ticket: { ...sheetTicket, notes: driverReport || sheetTicket.notes },
              verifiedAtIso,
              verifiedByName: auth.user?.name || data.verifiedBy || 'driver',
            });
            if (aftermath.errors?.length) {
              // Status already advanced to load_verified, but the invoice /
              // deduction step reported problems. Don't hide it — the office
              // needs to know, and the ticket-chain scanner will also flag the
              // data-level effect (missing invoice / deduction mismatch). (D6)
              aftermathError = aftermath.errors.join(' | ');
              console.error('[verify-load] Aftermath errors:', aftermathError);
            }
          } catch (err) {
            aftermathError = `Aftermath threw: ${err instanceof Error ? err.message : String(err)}`;
            console.error('[verify-load] Aftermath threw:', err);
          }
        }

        return NextResponse.json({
          success: true,
          ticket: filterCostByRole(dtTicket || sheetTicket, auth.user.role),
          aftermath,
          // Present only when the invoice/deduction step failed after the status
          // advanced — a signal for the office/API, surfaced without failing the
          // driver's action.
          ...(aftermathError ? { aftermathError } : {}),
        });
        });
      }

      // ── start-delivery / mark-arrived / complete-delivery ────────────────
      // Tickets-tab-FIRST (authoritative), Delivery Tickets second — same
      // shape as verify-load. The board (and every downstream sweep) reads
      // the Tickets tab; the old order updated Delivery Tickets first and
      // reported success even when the Tickets-tab mirror failed, which is
      // exactly how delivered "zombie" cards stayed on Rick's board. If the
      // authoritative write fails, the driver must see a failure and tap
      // again — not a false success.

      case 'start-delivery': {
        const synced = await syncTicketsTabStatus(data.ticketId, 'en_route');
        if (!synced) {
          return NextResponse.json(
            { success: false, boardSynced: false, error: 'Board not updated — tap again' },
            { status: 502 },
          );
        }
        let ticket = null;
        try {
          ticket = await deliveryWorkflowService.startDelivery(data.ticketId);
        } catch (err) {
          // Webhook-created tickets have no Delivery Tickets row — that's fine.
          console.warn('[tickets] start-delivery: Delivery Tickets update skipped:', err);
        }
        if (ticket) {
          await sendDeliveryNotification(ticket, 'En Route');
        }
        return NextResponse.json({ success: true, ticket, boardSynced: true });
      }

      case 'mark-arrived': {
        const synced = await syncTicketsTabStatus(data.ticketId, 'arrived');
        if (!synced) {
          return NextResponse.json(
            { success: false, boardSynced: false, error: 'Board not updated — tap again' },
            { status: 502 },
          );
        }
        let ticket = null;
        try {
          ticket = await deliveryWorkflowService.markArrived(data.ticketId, data.gpsLocation);
        } catch (err) {
          console.warn('[tickets] mark-arrived: Delivery Tickets update skipped:', err);
        }
        if (ticket) {
          await sendDeliveryNotification(ticket, 'Arrived');
        }
        return NextResponse.json({ success: true, ticket, boardSynced: true });
      }

      case 'complete-delivery': {
        const synced = await syncTicketsTabStatus(data.ticketId, 'delivered');
        if (!synced) {
          return NextResponse.json(
            { success: false, boardSynced: false, error: 'Board not updated — tap again' },
            { status: 502 },
          );
        }
        let ticket = null;
        try {
          ticket = await deliveryWorkflowService.completeDelivery(data.ticketId, data.notes);
        } catch (err) {
          console.warn('[tickets] complete-delivery: Delivery Tickets update skipped:', err);
        }
        if (ticket) {
          await sendDeliveryNotification(ticket, 'Delivered');
        }
        return NextResponse.json({ success: true, ticket, boardSynced: true });
      }

      case 'capture-proof': {
        const ticket = await deliveryWorkflowService.captureProof(
          data.ticketId
        );
        if (ticket) {
          await sendDeliveryNotification(ticket, 'Proof Captured');
        }
        return NextResponse.json({ success: true, ticket });
      }

      case 'upload-qc': {
        const ticket = await deliveryWorkflowService.uploadQCPhotos(data.ticketId);
        return NextResponse.json({ success: true, ticket });
      }

      case 'complete-ticket': {
        const ticket = await deliveryWorkflowService.completeTicket(data.ticketId);
        const synced = await syncTicketsTabStatus(data.ticketId, 'completed');
        if (ticket) {
          await sendDeliveryNotification(ticket, 'Completed');
        }
        return NextResponse.json({ success: true, ticket, boardSynced: synced });
      }

      case 'add-photo': {
        const photo = await deliveryWorkflowService.addPhoto({
          ticketId: data.ticketId,
          jobId: data.jobId,
          photoType: data.photoType,
          photoUrl: data.photoUrl,
          thumbnailUrl: data.thumbnailUrl,
          uploadedBy: data.uploadedBy,
          gpsLocation: data.gpsLocation,
          description: data.description,
        });
        // Best-effort: surface the delivery photo on the JobNimbus job (as a
        // note link). Fire-and-forget — never blocks or fails the driver flow.
        void syncTicketPhotoToJN({
          ticketId: data.ticketId,
          photoUrl: data.photoUrl,
          photoType: data.photoType,
        });
        return NextResponse.json({ success: true, photo });
      }

      case 'complete-pickup': {
        const ticket = await deliveryWorkflowService.completePickup(
          data.ticketId,
          data.gpsLocation,
          data.notes
        );
        return NextResponse.json({ success: true, ticket });
      }

      case 'process-return': {
        const ticket = await deliveryWorkflowService.processReturn(
          data.ticketId,
          data.returnedMaterials,
          data.condition
        );
        return NextResponse.json({ success: true, ticket });
      }

      case 'set-schedule': {
        // Office override of a ticket's delivery date. Clears any overdue
        // flag so a rescheduled ticket that misses AGAIN gets re-flagged by
        // the overdue sweep.
        if (!['office', 'admin', 'owner', 'manager'].includes(auth.user.role)) {
          return NextResponse.json({ error: 'Office access required' }, { status: 403 });
        }
        const newDate = String(data.scheduledDate || '').trim();
        if (!/^\d{4}-\d{2}-\d{2}$/.test(newDate)) {
          return NextResponse.json(
            { error: 'scheduledDate must be YYYY-MM-DD' },
            { status: 400 },
          );
        }
        const existing = await ticketSheetService.getById(data.ticketId);
        if (!existing) {
          return NextResponse.json({ error: 'Ticket not found' }, { status: 404 });
        }
        const patched = await ticketSheetService.patch(data.ticketId, {
          scheduledDate: newDate,
          scheduleSource: 'office',
          overdueAt: '',
        });
        if (!patched) {
          return NextResponse.json(
            { success: false, error: 'Schedule not saved — try again' },
            { status: 502 },
          );
        }
        return NextResponse.json({
          success: true,
          ticketId: data.ticketId,
          scheduledDate: newDate,
          scheduleSource: 'office',
        });
      }

      case 'stock-adjustment': {
        const adjustment = await deliveryWorkflowService.createStockAdjustment({
          productId: data.productId,
          productName: data.productName,
          previousQty: data.previousQty,
          newQty: data.newQty,
          reason: data.reason,
          adjustedBy: data.adjustedBy,
          adjustedByName: data.adjustedByName,
          adjustedByRole: data.adjustedByRole,
          ticketId: data.ticketId,
        });
        return NextResponse.json({ success: true, adjustment });
      }

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    console.error('Tickets API POST error:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
