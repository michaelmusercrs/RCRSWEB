/**
 * Available Time Slots API
 *
 * GET /api/calendar/slots - Get available time slots for scheduling
 *
 * Query Parameters:
 * - date: Date to check (YYYY-MM-DD), required
 * - eventType: Event type ('inspection' | 'installation' | 'delivery' | 'meeting')
 * - duration: Duration in minutes (default based on event type)
 */

import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-service';
import { teamupService, TeamUpEventType } from '@/lib/teamup-service';

// Default durations by event type
const DEFAULT_DURATIONS: Record<TeamUpEventType, number> = {
  inspection: 60,
  installation: 480, // 8 hours
  repair: 240,       // 4 hours
  delivery: 30,
  pickup: 30,
  meeting: 60,
  followup: 30,
  estimate: 60,
  other: 60,
};

export async function GET(request: Request) {
  const auth = await requireAuth();
  if (!auth.authenticated) return auth.response;

  try {
    const { searchParams } = new URL(request.url);

    const date = searchParams.get('date');
    const eventType = (searchParams.get('eventType') || 'inspection') as TeamUpEventType;
    const durationParam = searchParams.get('duration');
    const duration = durationParam ? parseInt(durationParam, 10) : DEFAULT_DURATIONS[eventType];

    if (!date) {
      return NextResponse.json(
        { success: false, error: 'Date is required' },
        { status: 400 }
      );
    }

    // Validate date format
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(date)) {
      return NextResponse.json(
        { success: false, error: 'Invalid date format. Use YYYY-MM-DD' },
        { status: 400 }
      );
    }

    // Check if date is in the past
    const checkDate = new Date(date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (checkDate < today) {
      return NextResponse.json(
        { success: false, error: 'Cannot check slots for past dates' },
        { status: 400 }
      );
    }

    // Check configuration
    const config = teamupService.checkConfiguration();

    // Get available slots
    const slots = await teamupService.getAvailableSlots(date, eventType, duration);

    // Format slots for display
    const formattedSlots = slots.map(slot => {
      const slotDate = new Date(slot);
      const endDate = new Date(slotDate.getTime() + duration * 60000);

      return {
        startTime: slot,
        endTime: endDate.toISOString(),
        displayTime: slotDate.toLocaleTimeString('en-US', {
          hour: 'numeric',
          minute: '2-digit',
          hour12: true,
        }),
        displayRange: `${slotDate.toLocaleTimeString('en-US', {
          hour: 'numeric',
          minute: '2-digit',
          hour12: true,
        })} - ${endDate.toLocaleTimeString('en-US', {
          hour: 'numeric',
          minute: '2-digit',
          hour12: true,
        })}`,
      };
    });

    // Group slots by morning/afternoon
    const morningSlots = formattedSlots.filter(slot => {
      const hour = new Date(slot.startTime).getHours();
      return hour < 12;
    });

    const afternoonSlots = formattedSlots.filter(slot => {
      const hour = new Date(slot.startTime).getHours();
      return hour >= 12;
    });

    return NextResponse.json({
      success: true,
      configured: config.configured,
      date,
      eventType,
      duration,
      slots: formattedSlots,
      grouped: {
        morning: morningSlots,
        afternoon: afternoonSlots,
      },
      meta: {
        totalSlots: formattedSlots.length,
        morningCount: morningSlots.length,
        afternoonCount: afternoonSlots.length,
        demoMode: !config.configured,
      },
    });
  } catch (error) {
    console.error('Calendar slots API error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch available slots',
      },
      { status: 500 }
    );
  }
}
