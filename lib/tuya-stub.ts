/**
 * Tuya Smart Home Integration — Stub
 *
 * Real Tuya API integration is deferred — the user said it'll be set up
 * separately in the Tuya app for lights, fan, garage, gable vent, A/C,
 * roll-up door. This module exposes the same interface but only logs the
 * intent and writes to a `Warehouse_Automation_Log` sheet tab so we have
 * an audit trail when Tuya goes live.
 *
 * Replace each method body with the real Tuya Cloud API call when ready.
 * The TUYA_* env vars need to be set: TUYA_CLIENT_ID, TUYA_CLIENT_SECRET,
 * TUYA_DEVICE_IDS (JSON map: { "lights": "vdevo...", "garage": "vdevo..." }).
 */

import { googleSheetsService } from './google-sheets-service';

const LOG_TAB = 'Warehouse_Automation_Log';
const LOG_HEADERS = [
  'timestamp',
  'event',
  'device',
  'action',
  'distanceMiles',
  'success',
  'notes',
];

export type WarehouseAutomationEvent =
  | 'gps_proximity_2mi'
  | 'gps_proximity_1mi'
  | 'gps_proximity_quarter_mi'
  | 'gps_arrived'
  | 'gps_departed'
  | 'manual_trigger';

export type TuyaDevice =
  | 'overhead_lights'
  | 'gable_vent'
  | 'hvac'
  | 'fans'
  | 'garage_door_crack'
  | 'garage_door_full'
  | 'roll_up_door';

interface TuyaActionResult {
  device: TuyaDevice;
  action: string;
  success: boolean;
  stub: boolean;
  notes?: string;
}

async function logEvent(event: {
  event: WarehouseAutomationEvent;
  device: TuyaDevice;
  action: string;
  distanceMiles?: number;
  success: boolean;
  notes?: string;
}): Promise<void> {
  try {
    await googleSheetsService.appendGenericRow(LOG_TAB, LOG_HEADERS, {
      timestamp: new Date().toISOString(),
      event: event.event,
      device: event.device,
      action: event.action,
      distanceMiles: event.distanceMiles ?? '',
      success: event.success,
      notes: event.notes ?? '',
    });
  } catch (err) {
    console.warn('[tuya-stub] Failed to write log row:', err);
  }
}

async function stubAction(
  event: WarehouseAutomationEvent,
  device: TuyaDevice,
  action: string,
  distanceMiles?: number,
): Promise<TuyaActionResult> {
  console.log(`[tuya-stub] ${event} → ${device}: ${action}` + (distanceMiles ? ` (${distanceMiles}mi)` : ''));
  await logEvent({
    event,
    device,
    action,
    distanceMiles,
    success: true,
    notes: 'STUB — Tuya not yet wired',
  });
  return {
    device,
    action,
    success: true,
    stub: true,
    notes: 'Tuya integration deferred — log only',
  };
}

class TuyaStub {
  /** 2 miles out: lights on, garage cracks, gable vent on */
  async onProximity2Mile(distanceMiles: number): Promise<TuyaActionResult[]> {
    const ev: WarehouseAutomationEvent = 'gps_proximity_2mi';
    return Promise.all([
      stubAction(ev, 'overhead_lights', 'turn_on', distanceMiles),
      stubAction(ev, 'garage_door_crack', 'crack_open', distanceMiles),
      stubAction(ev, 'gable_vent', 'turn_on', distanceMiles),
    ]);
  }

  /** 1 mile out: HVAC kicks on high, fans spin up */
  async onProximity1Mile(distanceMiles: number): Promise<TuyaActionResult[]> {
    const ev: WarehouseAutomationEvent = 'gps_proximity_1mi';
    return Promise.all([
      stubAction(ev, 'hvac', 'set_high', distanceMiles),
      stubAction(ev, 'fans', 'turn_on', distanceMiles),
    ]);
  }

  /** 0.25 mile (~1320 ft): garage door full open */
  async onProximityQuarterMile(distanceMiles: number): Promise<TuyaActionResult[]> {
    const ev: WarehouseAutomationEvent = 'gps_proximity_quarter_mi';
    return [await stubAction(ev, 'garage_door_full', 'open_fully', distanceMiles)];
  }

  /** Driver arrived at warehouse */
  async onArrived(): Promise<TuyaActionResult[]> {
    return [
      await stubAction('gps_arrived', 'roll_up_door', 'open_for_loading'),
    ];
  }

  /** Driver left the warehouse */
  async onDeparted(): Promise<TuyaActionResult[]> {
    const ev: WarehouseAutomationEvent = 'gps_departed';
    return Promise.all([
      stubAction(ev, 'garage_door_full', 'close'),
      stubAction(ev, 'roll_up_door', 'close'),
      stubAction(ev, 'overhead_lights', 'turn_off'),
      stubAction(ev, 'hvac', 'set_eco'),
      stubAction(ev, 'fans', 'turn_off'),
      stubAction(ev, 'gable_vent', 'turn_off'),
    ]);
  }

  /** Manual override from the warehouse dashboard */
  async manualTrigger(device: TuyaDevice, action: string): Promise<TuyaActionResult> {
    return stubAction('manual_trigger', device, action);
  }
}

export const tuyaStub = new TuyaStub();
