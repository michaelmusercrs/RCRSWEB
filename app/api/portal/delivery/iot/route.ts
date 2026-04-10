/**
 * Warehouse IoT Control API
 *
 * Controls smart warehouse devices via Home Assistant:
 * - Loading bay lights (color indicators)
 * - Loading bay doors (open/close)
 * - Warehouse TV/display (cast URLs, dashboards)
 * - Speaker announcements (TTS)
 * - Sensor readings (temperature, motion)
 * - Warehouse mode presets
 * - Delivery status automation triggers
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, validateSession } from '@/lib/auth-service';
import { warehouseIoT } from '@/lib/warehouse-iot-service';

export async function POST(request: NextRequest) {
  const auth = await requireAuth();
  if (!auth.authenticated) return auth.response;

  try {
    const body = await request.json();
    const { action } = body;

    if (!action || typeof action !== 'string') {
      return NextResponse.json({ error: 'action parameter required (string)' }, { status: 400 });
    }

    // Check if IoT is configured
    if (!warehouseIoT.isConfigured() && action !== 'status') {
      return NextResponse.json(
        { error: 'IoT not configured. Set HA_ACCESS_TOKEN environment variable.', configured: false },
        { status: 503 }
      );
    }

    switch (action) {
      case 'lights': {
        const { color } = body;
        if (!color || !['green', 'yellow', 'red', 'blue', 'off'].includes(color)) {
          return NextResponse.json(
            { error: 'color required: green, yellow, red, blue, or off' },
            { status: 400 }
          );
        }
        const success = await warehouseIoT.setLoadingBayLights(color);
        return NextResponse.json({ success, color });
      }

      case 'mode': {
        const { mode } = body;
        if (!mode || !['loading', 'departure', 'receiving', 'closed'].includes(mode)) {
          return NextResponse.json(
            { error: 'mode required: loading, departure, receiving, or closed' },
            { status: 400 }
          );
        }
        const success = await warehouseIoT.setWarehouseMode(mode);
        return NextResponse.json({ success, mode });
      }

      case 'flash-alert': {
        const success = await warehouseIoT.flashAlert();
        return NextResponse.json({ success });
      }

      case 'door': {
        const { operation, bayNumber } = body;
        if (!operation || !['open', 'close'].includes(operation)) {
          return NextResponse.json(
            { error: 'operation required: open or close' },
            { status: 400 }
          );
        }
        const bay = typeof bayNumber === 'number' && bayNumber >= 1 && bayNumber <= 3 ? bayNumber : 1;
        const success = operation === 'open'
          ? await warehouseIoT.openLoadingDoor(bay)
          : await warehouseIoT.closeLoadingDoor(bay);
        return NextResponse.json({ success, operation, bayNumber: bay });
      }

      case 'announce': {
        const { message, priority } = body;
        if (!message || typeof message !== 'string' || message.trim().length === 0) {
          return NextResponse.json({ error: 'message required (non-empty string)' }, { status: 400 });
        }
        const sanitizedMessage = message.trim().slice(0, 1000);
        const validPriority = priority === 'urgent' ? 'urgent' : 'normal';
        const success = await warehouseIoT.announce(sanitizedMessage, validPriority);
        return NextResponse.json({ success });
      }

      case 'alert-sound': {
        const { type } = body;
        if (!type || !['new_delivery', 'departure', 'arrival', 'urgent'].includes(type)) {
          return NextResponse.json(
            { error: 'type required: new_delivery, departure, arrival, or urgent' },
            { status: 400 }
          );
        }
        const success = await warehouseIoT.playAlert(type);
        return NextResponse.json({ success });
      }

      case 'display': {
        const { url, displayId } = body;
        if (!url || typeof url !== 'string') {
          return NextResponse.json({ error: 'url required' }, { status: 400 });
        }
        try {
          const parsed = new URL(url);
          if (!['http:', 'https:'].includes(parsed.protocol)) {
            return NextResponse.json({ error: 'url must use http or https protocol' }, { status: 400 });
          }
        } catch {
          return NextResponse.json({ error: 'invalid url format' }, { status: 400 });
        }
        const success = await warehouseIoT.castToDisplay(url, displayId);
        return NextResponse.json({ success });
      }

      case 'show-dashboard': {
        const { displayId } = body;
        const success = await warehouseIoT.showDashboard(displayId);
        return NextResponse.json({ success });
      }

      case 'show-loading-assist': {
        const { ticketId, displayId } = body;
        if (!ticketId) {
          return NextResponse.json({ error: 'ticketId required' }, { status: 400 });
        }
        const success = await warehouseIoT.showLoadingAssist(ticketId, displayId);
        return NextResponse.json({ success });
      }

      case 'delivery-status-change': {
        const { ticketId, newStatus } = body;
        if (!ticketId || !newStatus) {
          return NextResponse.json(
            { error: 'ticketId and newStatus required' },
            { status: 400 }
          );
        }
        await warehouseIoT.onDeliveryStatusChange(ticketId, newStatus);
        return NextResponse.json({ success: true, ticketId, newStatus });
      }

      case 'scene': {
        const { sceneName } = body;
        if (!sceneName || typeof sceneName !== 'string') {
          return NextResponse.json({ error: 'sceneName required' }, { status: 400 });
        }
        const sanitizedSceneName = sceneName.replace(/[^a-z0-9_]/gi, '').slice(0, 100);
        if (!sanitizedSceneName) {
          return NextResponse.json({ error: 'invalid sceneName' }, { status: 400 });
        }
        const success = await warehouseIoT.triggerScene(sanitizedSceneName);
        return NextResponse.json({ success });
      }

      default: {
        const sanitizedAction = typeof action === 'string' ? action.replace(/[<>&"']/g, '') : 'invalid';
        return NextResponse.json(
          {
            error: `Unknown action: ${sanitizedAction}`,
            available: [
              'lights', 'mode', 'flash-alert', 'door', 'announce',
              'alert-sound', 'display', 'show-dashboard', 'show-loading-assist',
              'delivery-status-change', 'scene',
            ],
          },
          { status: 400 }
        );
      }
    }
  } catch (error) {
    console.error('[IoT API] Error:', error);
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

    const configured = warehouseIoT.isConfigured();

    if (!configured) {
      return NextResponse.json({
        configured,
        message: 'IoT not configured. Set HA_ACCESS_TOKEN and HA_BASE_URL environment variables.',
        devices: [],
        doors: [],
        sensors: {},
      });
    }

    // Fetch all device statuses in parallel
    const [devices, doors, temp, motion] = await Promise.all([
      warehouseIoT.getDeviceStatuses(),
      warehouseIoT.getDoorStatus(),
      warehouseIoT.getWarehouseTemp(),
      warehouseIoT.getMotionStatus(),
    ]);

    return NextResponse.json({
      configured,
      devices,
      doors,
      sensors: {
        temperature: temp,
        motion,
      },
    });
  } catch (error) {
    console.error('[IoT API] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
