import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-service';
import {
  deliveryReminderService,
  ReminderType,
  ReminderTrigger,
} from '@/lib/delivery-reminder-service';

// GET - Fetch pending/sent reminders for a date
export async function GET(request: NextRequest) {
  const auth = await requireAuth();
  if (!auth.authenticated) return auth.response;

  try {
    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date') || new Date().toISOString().slice(0, 10);
    const status = searchParams.get('status') as 'pending' | 'sent' | 'failed' | 'skipped' | null;
    const type = searchParams.get('type') as ReminderType | null;
    const ticketId = searchParams.get('ticketId');
    const preview = searchParams.get('preview') === 'true';

    // Preview mode: generate reminders without saving
    if (preview) {
      const trigger = (searchParams.get('trigger') as ReminderTrigger) || 'next_day';
      const reminders = await deliveryReminderService.generateRemindersForDate(date, trigger);
      return NextResponse.json({
        success: true,
        preview: true,
        date,
        trigger,
        count: reminders.length,
        reminders,
      });
    }

    // Fetch existing reminders
    const reminders = await deliveryReminderService.getReminders({
      date: date || undefined,
      ticketId: ticketId || undefined,
      type: type || undefined,
      status: status || undefined,
    });

    return NextResponse.json({
      success: true,
      date,
      count: reminders.length,
      reminders,
    });
  } catch (error) {
    console.error('Reminders GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch reminders' }, { status: 500 });
  }
}

// POST - Send reminders
export async function POST(request: NextRequest) {
  const auth = await requireAuth();
  if (!auth.authenticated) return auth.response;

  try {
    const body = await request.json();
    const { action, date, trigger, reminderId } = body;

    if (action === 'send-batch') {
      // Send all pending reminders for a given date
      const targetDate = date || new Date().toISOString().slice(0, 10);
      const reminderTrigger: ReminderTrigger = trigger || 'same_day_morning';

      const result = await deliveryReminderService.sendBatchReminders(targetDate, reminderTrigger);

      return NextResponse.json({
        success: true,
        action: 'send-batch',
        date: targetDate,
        trigger: reminderTrigger,
        sent: result.sent,
        failed: result.failed,
        skipped: result.skipped,
        total: result.reminders.length,
        reminders: result.reminders,
      });
    }

    if (action === 'send-single') {
      // Send a single specific reminder
      if (!body.reminder) {
        return NextResponse.json({ error: 'Reminder data required' }, { status: 400 });
      }

      const result = await deliveryReminderService.sendReminder(body.reminder);
      return NextResponse.json({
        success: result.status === 'sent',
        reminder: result,
      });
    }

    if (action === 'generate') {
      // Generate reminders for a date (next_day or same_day_morning)
      const targetDate = date || (() => {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        return tomorrow.toISOString().slice(0, 10);
      })();
      const reminderTrigger: ReminderTrigger = trigger || 'next_day';

      const reminders = await deliveryReminderService.generateRemindersForDate(
        targetDate,
        reminderTrigger,
      );

      return NextResponse.json({
        success: true,
        action: 'generate',
        date: targetDate,
        trigger: reminderTrigger,
        count: reminders.length,
        reminders,
      });
    }

    return NextResponse.json({ error: 'Invalid action. Use: send-batch, send-single, or generate' }, { status: 400 });
  } catch (error) {
    console.error('Reminders POST error:', error);
    return NextResponse.json({ error: 'Failed to process reminder request' }, { status: 500 });
  }
}
