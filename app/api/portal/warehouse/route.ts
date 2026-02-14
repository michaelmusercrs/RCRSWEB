/**
 * Warehouse Controls API
 *
 * Proxy route for smart warehouse controls via Home Assistant.
 * Handles AC/climate, doors, lights, and sensors.
 * Uses the warehouse-iot-service which connects to HA at 192.168.86.102:8123.
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth-service';

const HA_BASE_URL = process.env.HA_BASE_URL || 'http://192.168.86.102:8123';
const HA_TOKEN = process.env.HA_ACCESS_TOKEN || process.env.HA_TOKEN || '';

const headers = {
  Authorization: `Bearer ${HA_TOKEN}`,
  'Content-Type': 'application/json',
};

async function callHA(domain: string, service: string, data: Record<string, unknown>): Promise<boolean> {
  if (!HA_TOKEN) return false;
  try {
    const response = await fetch(`${HA_BASE_URL}/api/services/${domain}/${service}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(data),
      signal: AbortSignal.timeout(10000),
    });
    return response.ok;
  } catch {
    return false;
  }
}

async function getState(entityId: string): Promise<Record<string, unknown> | null> {
  if (!HA_TOKEN) return null;
  try {
    const response = await fetch(`${HA_BASE_URL}/api/states/${entityId}`, {
      method: 'GET',
      headers,
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  }
}

export async function GET() {
  const auth = await requireAdmin();
  if (!auth.authenticated) return auth.response;

  try {
    const configured = !!HA_TOKEN;

    if (!configured) {
      return NextResponse.json({
        configured: false,
        message: 'Set HA_ACCESS_TOKEN or HA_TOKEN env var to enable warehouse controls',
        climate: null,
        doors: [],
        lights: [],
        sensors: {},
      });
    }

    // Fetch climate, door, light, and sensor states in parallel
    const [climateState, door1, door2, door3, mainLight, bayLight, temp, motion] = await Promise.all([
      getState('climate.warehouse_ac'),
      getState('cover.loading_bay_1'),
      getState('cover.loading_bay_2'),
      getState('cover.loading_bay_3'),
      getState('light.warehouse_main'),
      getState('light.warehouse_loading_bay'),
      getState('sensor.warehouse_temperature'),
      getState('binary_sensor.warehouse_motion'),
    ]);

    return NextResponse.json({
      configured: true,
      climate: climateState ? {
        state: (climateState as any).state,
        currentTemp: (climateState as any).attributes?.current_temperature,
        targetTemp: (climateState as any).attributes?.temperature,
        hvacMode: (climateState as any).attributes?.hvac_mode,
      } : null,
      doors: [
        { bay: 1, state: door1 ? (door1 as any).state : 'unknown' },
        { bay: 2, state: door2 ? (door2 as any).state : 'unknown' },
        { bay: 3, state: door3 ? (door3 as any).state : 'unknown' },
      ],
      lights: [
        { id: 'main', name: 'Main Warehouse', state: mainLight ? (mainLight as any).state : 'unknown' },
        { id: 'bay', name: 'Loading Bay', state: bayLight ? (bayLight as any).state : 'unknown' },
      ],
      sensors: {
        temperature: temp ? {
          value: (temp as any).state,
          unit: (temp as any).attributes?.unit_of_measurement || 'F',
        } : { value: 'unavailable', unit: 'F' },
        motion: motion ? (motion as any).state : 'unavailable',
      },
    });
  } catch (error) {
    console.error('[Warehouse API] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.authenticated) return auth.response;

  try {
    const body = await request.json();
    const { action } = body;

    if (!HA_TOKEN) {
      return NextResponse.json({ error: 'HA not configured', configured: false }, { status: 503 });
    }

    switch (action) {
      case 'climate_set': {
        const { temperature, hvacMode } = body;
        const serviceData: Record<string, unknown> = { entity_id: 'climate.warehouse_ac' };
        if (temperature) serviceData.temperature = temperature;
        if (hvacMode) serviceData.hvac_mode = hvacMode;
        const success = await callHA('climate', 'set_temperature', serviceData);
        return NextResponse.json({ success });
      }

      case 'climate_toggle': {
        const { turnOn } = body;
        const service = turnOn ? 'turn_on' : 'turn_off';
        const success = await callHA('climate', service, { entity_id: 'climate.warehouse_ac' });
        return NextResponse.json({ success });
      }

      case 'door_toggle': {
        const { bay, operation } = body;
        const entityId = `cover.loading_bay_${bay || 1}`;
        const service = operation === 'open' ? 'open_cover' : 'close_cover';
        const success = await callHA('cover', service, { entity_id: entityId });
        return NextResponse.json({ success });
      }

      case 'light_toggle': {
        const { zone, turnOn } = body;
        const entityId = zone === 'bay' ? 'light.warehouse_loading_bay' : 'light.warehouse_main';
        const service = turnOn ? 'turn_on' : 'turn_off';
        const success = await callHA('light', service, { entity_id: entityId });
        return NextResponse.json({ success });
      }

      case 'light_color': {
        const { color } = body;
        const colorMap: Record<string, [number, number, number]> = {
          green: [0, 255, 0],
          yellow: [255, 200, 0],
          red: [255, 0, 0],
          blue: [0, 0, 255],
        };
        const rgb = colorMap[color];
        if (!rgb) {
          return NextResponse.json({ error: 'Invalid color' }, { status: 400 });
        }
        const success = await callHA('light', 'turn_on', {
          entity_id: 'light.warehouse_loading_bay',
          rgb_color: rgb,
          brightness: 255,
        });
        return NextResponse.json({ success });
      }

      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }
  } catch (error) {
    console.error('[Warehouse API] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
