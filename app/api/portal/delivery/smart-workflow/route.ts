/**
 * Smart Delivery Workflow API
 *
 * Intelligent delivery operations powered by the SmartDeliveryEngine:
 * - Route optimization
 * - Status progression and validation
 * - Smart notifications
 * - Loading logic and capacity checks
 * - Delivery window management
 * - Performance tracking
 * - Weather impact assessment
 * - Photo requirement enforcement
 */

import { NextRequest, NextResponse } from 'next/server';
import { validateSession } from '@/lib/auth-service';
import { smartDeliveryEngine } from '@/lib/smart-delivery-engine';

export async function POST(request: NextRequest) {
  try {
    const session = await validateSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { action } = body;

    if (!action || typeof action !== 'string') {
      return NextResponse.json({ error: 'action parameter required (string)' }, { status: 400 });
    }

    switch (action) {
      // ---- Route Optimization ----
      case 'optimize-route': {
        const { stops } = body;
        if (!stops || !Array.isArray(stops)) {
          return NextResponse.json({ error: 'stops array required' }, { status: 400 });
        }
        const optimized = smartDeliveryEngine.optimizeRoute(stops);
        return NextResponse.json({ route: optimized });
      }

      case 'estimate-route-time': {
        const { stops } = body;
        if (!stops || !Array.isArray(stops)) {
          return NextResponse.json({ error: 'stops array required' }, { status: 400 });
        }
        const estimate = smartDeliveryEngine.estimateRouteTime(stops);
        return NextResponse.json({ estimatedMinutes: estimate });
      }

      case 'suggest-driver': {
        const { tickets, drivers } = body;
        if (!tickets || !drivers) {
          return NextResponse.json({ error: 'tickets and drivers arrays required' }, { status: 400 });
        }
        const suggestion = smartDeliveryEngine.suggestDriverAssignment(tickets, drivers);
        return NextResponse.json({ suggestion });
      }

      // ---- Status Progression ----
      case 'next-status': {
        const { currentStatus, ticketType } = body;
        if (!currentStatus) {
          return NextResponse.json({ error: 'currentStatus required' }, { status: 400 });
        }
        const next = smartDeliveryEngine.getNextStatus(currentStatus, ticketType || 'delivery');
        return NextResponse.json({ currentStatus, nextStatus: next });
      }

      case 'validate-transition': {
        const { currentStatus, targetStatus, ticketType } = body;
        if (!currentStatus || !targetStatus) {
          return NextResponse.json({ error: 'currentStatus and targetStatus required' }, { status: 400 });
        }
        const valid = smartDeliveryEngine.validateStatusTransition(
          currentStatus,
          targetStatus
        );
        return NextResponse.json({ valid, currentStatus, targetStatus });
      }

      case 'required-actions': {
        const { status, ticketType } = body;
        if (!status) {
          return NextResponse.json({ error: 'status required' }, { status: 400 });
        }
        const actions = smartDeliveryEngine.getRequiredActionsForStatus(status);
        return NextResponse.json({ status, actions });
      }

      // ---- Notifications ----
      case 'status-notification': {
        const { ticketId, status, context } = body;
        if (!ticketId || !status || !context) {
          return NextResponse.json({ error: 'ticketId, status, and context required' }, { status: 400 });
        }
        const notification = smartDeliveryEngine.generateStatusNotification(ticketId, status, context);
        return NextResponse.json(notification);
      }

      case 'should-escalate': {
        const { ticket } = body;
        if (!ticket) {
          return NextResponse.json({ error: 'ticket required' }, { status: 400 });
        }
        const shouldEscalate = smartDeliveryEngine.shouldEscalate(ticket);
        return NextResponse.json({ shouldEscalate });
      }

      // ---- Loading Logic ----
      case 'loading-order': {
        const { materials } = body;
        if (!materials || !Array.isArray(materials)) {
          return NextResponse.json({ error: 'materials array required' }, { status: 400 });
        }
        const order = smartDeliveryEngine.generateLoadingOrder(materials);
        return NextResponse.json({ loadingOrder: order });
      }

      case 'validate-capacity': {
        const { materials, vehicleType } = body;
        if (!materials || !vehicleType) {
          return NextResponse.json({ error: 'materials and vehicleType required' }, { status: 400 });
        }
        const validation = smartDeliveryEngine.validateLoadCapacity(materials, vehicleType);
        return NextResponse.json(validation);
      }

      case 'check-inventory': {
        const { materials, inventoryLevels } = body;
        if (!materials || !inventoryLevels) {
          return NextResponse.json({ error: 'materials and inventoryLevels required' }, { status: 400 });
        }
        const missing = smartDeliveryEngine.flagMissingMaterials(materials, inventoryLevels);
        return NextResponse.json({ missing, allAvailable: missing.length === 0 });
      }

      // ---- Delivery Windows ----
      case 'delivery-window': {
        const { scheduledTime, stopsBeforeThis } = body;
        if (!scheduledTime) {
          return NextResponse.json({ error: 'scheduledTime required' }, { status: 400 });
        }
        const window = smartDeliveryEngine.calculateDeliveryWindow(
          scheduledTime,
          stopsBeforeThis || 0
        );
        return NextResponse.json(window);
      }

      case 'detect-conflicts': {
        const { newTicket, existingTickets } = body;
        if (!newTicket || !existingTickets) {
          return NextResponse.json({ error: 'newTicket and existingTickets required' }, { status: 400 });
        }
        const conflicts = smartDeliveryEngine.detectConflicts(newTicket, existingTickets);
        return NextResponse.json({ conflicts, hasConflicts: conflicts.length > 0 });
      }

      // ---- Performance ----
      case 'driver-score': {
        const { driverId, metrics } = body;
        if (!driverId || !metrics) {
          return NextResponse.json({ error: 'driverId and metrics required' }, { status: 400 });
        }
        const score = smartDeliveryEngine.calculateDriverScore(driverId, metrics);
        return NextResponse.json({ driverId, score });
      }

      case 'bottlenecks': {
        const { tickets } = body;
        if (!tickets || !Array.isArray(tickets)) {
          return NextResponse.json({ error: 'tickets array required' }, { status: 400 });
        }
        const bottlenecks = smartDeliveryEngine.identifyBottlenecks(tickets);
        return NextResponse.json({ bottlenecks });
      }

      case 'daily-summary': {
        const { tickets, date } = body;
        if (!tickets || !date) {
          return NextResponse.json({ error: 'tickets and date required' }, { status: 400 });
        }
        const summary = smartDeliveryEngine.generateDailySummary(date, tickets);
        return NextResponse.json(summary);
      }

      // ---- Weather ----
      case 'weather-impact': {
        const { date, weatherData } = body;
        if (!date) {
          return NextResponse.json({ error: 'date required' }, { status: 400 });
        }
        const impact = smartDeliveryEngine.getWeatherImpact(date, weatherData);
        return NextResponse.json(impact);
      }

      case 'should-delay': {
        const { weatherData } = body;
        if (!weatherData) {
          return NextResponse.json({ error: 'weatherData required' }, { status: 400 });
        }
        const shouldDelay = smartDeliveryEngine.shouldDelayDelivery(weatherData);
        return NextResponse.json({ shouldDelay });
      }

      // ---- Photos ----
      case 'required-photos': {
        const { ticketType, status } = body;
        if (!ticketType || !status) {
          return NextResponse.json({ error: 'ticketType and status required' }, { status: 400 });
        }
        const photos = smartDeliveryEngine.getRequiredPhotos(ticketType, status);
        return NextResponse.json({ required: photos });
      }

      case 'validate-photos': {
        const { ticketId, photos, ticketType, status } = body;
        if (!ticketId || !photos || !ticketType || !status) {
          return NextResponse.json({ error: 'ticketId, photos, ticketType, and status required' }, { status: 400 });
        }
        const compliance = smartDeliveryEngine.validatePhotoCompliance(ticketId, photos, ticketType, status);
        return NextResponse.json(compliance);
      }

      case 'photo-prompts': {
        const { ticketType, status } = body;
        if (!ticketType || !status) {
          return NextResponse.json({ error: 'ticketType and status required' }, { status: 400 });
        }
        const prompts = smartDeliveryEngine.generatePhotoPrompts(status, ticketType);
        return NextResponse.json({ prompts });
      }

      default: {
        const sanitizedAction = typeof action === 'string' ? action.replace(/[<>&"']/g, '') : 'invalid';
        return NextResponse.json(
          {
            error: `Unknown action: ${sanitizedAction}`,
            categories: {
              routing: ['optimize-route', 'estimate-route-time', 'suggest-driver'],
              status: ['next-status', 'validate-transition', 'required-actions'],
              notifications: ['status-notification', 'should-escalate'],
              loading: ['loading-order', 'validate-capacity', 'check-inventory'],
              scheduling: ['delivery-window', 'detect-conflicts'],
              performance: ['driver-score', 'bottlenecks', 'daily-summary'],
              weather: ['weather-impact', 'should-delay'],
              photos: ['required-photos', 'validate-photos', 'photo-prompts'],
            },
          },
          { status: 400 }
        );
      }
    }
  } catch (error) {
    console.error('[Smart Workflow API] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const session = await validateSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    return NextResponse.json({
      engine: 'SmartDeliveryEngine',
      version: '1.0',
      capabilities: {
        routing: {
          description: 'Route optimization and driver assignment',
          actions: ['optimize-route', 'estimate-route-time', 'suggest-driver'],
        },
        status: {
          description: 'Status progression and validation',
          actions: ['next-status', 'validate-transition', 'required-actions'],
        },
        notifications: {
          description: 'Smart notifications and escalation',
          actions: ['status-notification', 'should-escalate'],
        },
        loading: {
          description: 'Loading order, capacity, and inventory checks',
          actions: ['loading-order', 'validate-capacity', 'check-inventory'],
        },
        scheduling: {
          description: 'Delivery windows and conflict detection',
          actions: ['delivery-window', 'detect-conflicts'],
        },
        performance: {
          description: 'Driver scoring and analytics',
          actions: ['driver-score', 'bottlenecks', 'daily-summary'],
        },
        weather: {
          description: 'Weather impact assessment',
          actions: ['weather-impact', 'should-delay'],
        },
        photos: {
          description: 'Photo requirements and compliance',
          actions: ['required-photos', 'validate-photos', 'photo-prompts'],
        },
      },
    });
  } catch (error) {
    console.error('[Smart Workflow API] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
