/**
 * Shared ticket-board helpers — the ONE definition of "active delivery ticket"
 * and the Chicago-calendar date bucketing, used by both the warehouse board
 * (/api/warehouse/today) and the delivery-route view (/api/portal/delivery) so
 * the two can never drift apart.
 *
 * Background: the canonical order store is the `Tickets` tab
 * (lib/ticket-sheet-service.ts). Views that read the near-empty legacy
 * `Delivery Tickets` sheet (deliveryWorkflowService, ~20 orphaned rows) miss
 * the 600+ email-created deliveries — that was the "delivery view is empty /
 * delivered jobs don't clear" bug. Everything operational reads canonical.
 */

import type { SheetTicket } from './ticket-sheet-service';

/** Non-terminal delivery statuses — a ticket in any of these is still "active"
 * (i.e. it belongs on Rick's board / a driver's route). Terminal statuses
 * (delivered/completed/cancelled/voided) fall out. Mirrors the set the
 * warehouse board and the backfill script use. */
export const ACTIVE_STATUSES = new Set<string>([
  'created',
  'assigned',
  'materials_pulled',
  'load_verified',
  'en_route',
  'arrived',
]);

const CHICAGO_TZ = 'America/Chicago';

/** Today's date as a Chicago-calendar YYYY-MM-DD string. The warehouse runs on
 * Chicago time; the server runs UTC — every "today" comparison must use this. */
export function chicagoToday(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: CHICAGO_TZ }).format(new Date());
}

/** Only the active delivery tickets from a full ticket list. */
export function activeDeliveries(tickets: SheetTicket[]): SheetTicket[] {
  return tickets.filter(
    t => t.ticketType === 'delivery' && ACTIVE_STATUSES.has(t.status),
  );
}

export interface DateBuckets {
  overdue: SheetTicket[];
  today: SheetTicket[];
  upcoming: SheetTicket[];
}

/**
 * Partition active delivery tickets into overdue / today / upcoming against the
 * Chicago calendar day:
 *   overdue  — scheduled before today, still not delivered
 *   today    — scheduled today, OR undated (a legacy/unmigrated ticket must
 *              fail VISIBLE on today's board, never silently hide)
 *   upcoming — scheduled after today (sorted ascending)
 */
export function partitionByScheduleDate(
  active: SheetTicket[],
  todayYmd: string = chicagoToday(),
): DateBuckets {
  const overdue = active.filter(t => t.scheduledDate && t.scheduledDate < todayYmd);
  const today = active.filter(t => !t.scheduledDate || t.scheduledDate === todayYmd);
  const upcoming = active
    .filter(t => !!t.scheduledDate && t.scheduledDate > todayYmd)
    .sort((a, b) => (a.scheduledDate || '').localeCompare(b.scheduledDate || ''));
  return { overdue, today, upcoming };
}

/**
 * The tickets that belong on a given date's delivery route view.
 * - For today: everything that needs attention now — overdue + today's + undated.
 * - For a specific other date: exactly the tickets scheduled that day.
 */
export function ticketsForRouteDate(
  active: SheetTicket[],
  dateYmd: string,
  todayYmd: string = chicagoToday(),
): SheetTicket[] {
  if (dateYmd === todayYmd) {
    const { overdue, today } = partitionByScheduleDate(active, todayYmd);
    return [...overdue, ...today];
  }
  return active.filter(t => t.scheduledDate === dateYmd);
}
