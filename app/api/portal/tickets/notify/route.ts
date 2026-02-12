import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-service';
import { deliveryWorkflowService, TicketStatus } from '@/lib/delivery-workflow-service';
import { deliveryReminderService } from '@/lib/delivery-reminder-service';

// POST - Send auto-notification for ticket status changes
export async function POST(request: NextRequest) {
  const auth = await requireAuth();
  if (!auth.authenticated) return auth.response;

  try {
    const body = await request.json();
    const { ticketId, status, action } = body;

    if (action === 'status-change') {
      if (!ticketId || !status) {
        return NextResponse.json(
          { error: 'ticketId and status are required' },
          { status: 400 }
        );
      }

      const ticket = await deliveryWorkflowService.getTicketById(ticketId);
      if (!ticket) {
        return NextResponse.json({ error: 'Ticket not found' }, { status: 404 });
      }

      const result = await deliveryReminderService.sendStatusNotification(
        ticket,
        status as TicketStatus,
      );

      return NextResponse.json({
        success: result.sent,
        message: result.message,
        ticketId,
        status,
      });
    }

    if (action === 'custom') {
      // Send a custom notification for a ticket
      const { ticketId, message, recipientType } = body;

      if (!ticketId || !message) {
        return NextResponse.json(
          { error: 'ticketId and message are required' },
          { status: 400 }
        );
      }

      const ticket = await deliveryWorkflowService.getTicketById(ticketId);
      if (!ticket) {
        return NextResponse.json({ error: 'Ticket not found' }, { status: 404 });
      }

      // Send as a manual reminder
      const reminder = await deliveryReminderService.sendReminder({
        reminderId: `RMD-${Date.now()}`,
        ticketId,
        reminderType: recipientType || 'customer',
        trigger: 'manual',
        recipientName: ticket.customerName,
        recipientContact: ticket.customerPhone || 'office',
        message,
        scheduledFor: new Date().toISOString().slice(0, 10),
        status: 'pending',
        createdAt: new Date().toISOString(),
      });

      return NextResponse.json({
        success: reminder.status === 'sent',
        reminder,
      });
    }

    if (action === 'eta-update') {
      // Get current ETAs for a driver's route
      const { driverId, date } = body;

      if (!driverId) {
        return NextResponse.json({ error: 'driverId is required' }, { status: 400 });
      }

      const targetDate = date || new Date().toISOString().slice(0, 10);
      const etas = await deliveryReminderService.calculateETAs(driverId, targetDate);

      return NextResponse.json({
        success: true,
        driverId,
        date: targetDate,
        etas,
      });
    }

    return NextResponse.json(
      { error: 'Invalid action. Use: status-change, custom, or eta-update' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Ticket notify error:', error);
    return NextResponse.json({ error: 'Failed to send notification' }, { status: 500 });
  }
}
