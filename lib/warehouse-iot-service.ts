// Warehouse IoT Service for River City Roofing Solutions
// Integrates with Home Assistant on Raspberry Pi for smart warehouse device control.
// Controls lights, doors, displays, speakers, and sensors via HA REST API.

// ============================================
// CONFIGURATION
// ============================================

const HA_BASE_URL = process.env.HA_BASE_URL || 'http://192.168.86.102:8123';
const HA_ACCESS_TOKEN = process.env.HA_ACCESS_TOKEN || '';
const API_TIMEOUT_MS = 10000;

// ============================================
// ENTITY IDS
// ============================================

const ENTITIES = {
  // Lights
  loadingBayLight: 'light.warehouse_loading_bay',
  mainLight: 'light.warehouse_main',

  // Doors (covers)
  loadingBay1: 'cover.loading_bay_1',
  loadingBay2: 'cover.loading_bay_2',
  loadingBay3: 'cover.loading_bay_3',

  // Media players
  speaker: 'media_player.warehouse_speaker',
  tv: 'media_player.warehouse_tv',

  // Sensors
  temperature: 'sensor.warehouse_temperature',
  motion: 'binary_sensor.warehouse_motion',
} as const;

// Map bay number to entity ID
function loadingBayEntity(bayNumber: number): string {
  const map: Record<number, string> = {
    1: ENTITIES.loadingBay1,
    2: ENTITIES.loadingBay2,
    3: ENTITIES.loadingBay3,
  };
  return map[bayNumber] || ENTITIES.loadingBay1;
}

// ============================================
// TYPES
// ============================================

export type LightColor = 'green' | 'yellow' | 'red' | 'blue' | 'off';
export type WarehouseMode = 'loading' | 'departure' | 'receiving' | 'closed';
export type AlertSoundType = 'new_delivery' | 'departure' | 'arrival' | 'urgent';
export type AnnouncePriority = 'normal' | 'urgent';

export interface DoorStatus {
  bayNumber: number;
  entityId: string;
  state: 'open' | 'closed' | 'opening' | 'closing' | 'unknown';
}

export interface DeviceStatus {
  entityId: string;
  name: string;
  state: string;
  available: boolean;
  lastChanged?: string;
}

export interface SensorReading {
  entityId: string;
  state: string;
  unit?: string;
  lastUpdated?: string;
}

// Color map: light color name -> HA RGB values
const COLOR_MAP: Record<Exclude<LightColor, 'off'>, [number, number, number]> = {
  green: [0, 255, 0],
  yellow: [255, 200, 0],
  red: [255, 0, 0],
  blue: [0, 0, 255],
};

// Warehouse mode -> light settings
const MODE_LIGHT_CONFIG: Record<WarehouseMode, { bay: LightColor; main: boolean; brightness?: number }> = {
  loading: { bay: 'yellow', main: true, brightness: 255 },
  departure: { bay: 'green', main: true, brightness: 200 },
  receiving: { bay: 'blue', main: true, brightness: 255 },
  closed: { bay: 'off', main: false },
};

// Alert sounds (relative paths for HA media)
const ALERT_SOUNDS: Record<AlertSoundType, string> = {
  new_delivery: 'media-source://media_source/local/alerts/new_delivery.mp3',
  departure: 'media-source://media_source/local/alerts/departure.mp3',
  arrival: 'media-source://media_source/local/alerts/arrival.mp3',
  urgent: 'media-source://media_source/local/alerts/urgent.mp3',
};

// ============================================
// SERVICE CLASS
// ============================================

export class WarehouseIoTService {
  private baseUrl: string;
  private token: string;

  constructor() {
    this.baseUrl = HA_BASE_URL;
    this.token = HA_ACCESS_TOKEN;
  }

  // ------------------------------------------
  // Configuration Check
  // ------------------------------------------

  /**
   * Returns true if HA_ACCESS_TOKEN is set and the service can communicate with HA.
   * When false, the app still works - IoT features are just disabled.
   */
  isConfigured(): boolean {
    return !!this.token && this.token.length > 0;
  }

  // ------------------------------------------
  // HA REST API Helpers
  // ------------------------------------------

  private get headers(): Record<string, string> {
    return {
      Authorization: `Bearer ${this.token}`,
      'Content-Type': 'application/json',
    };
  }

  /**
   * Call an HA service (e.g. light.turn_on, cover.open_cover).
   */
  private async callService(
    domain: string,
    service: string,
    data: Record<string, unknown> = {}
  ): Promise<boolean> {
    if (!this.isConfigured()) {
      console.warn('[WarehouseIoT] Not configured - skipping service call:', domain, service);
      return false;
    }

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), API_TIMEOUT_MS);

      const response = await fetch(`${this.baseUrl}/api/services/${domain}/${service}`, {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify(data),
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!response.ok) {
        console.error(`[WarehouseIoT] Service call failed: ${domain}.${service}`, response.status, await response.text());
        return false;
      }

      return true;
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        console.error(`[WarehouseIoT] Service call timed out: ${domain}.${service}`);
      } else {
        console.error(`[WarehouseIoT] Service call error: ${domain}.${service}`, error);
      }
      return false;
    }
  }

  /**
   * Get the state of an entity from HA.
   */
  private async getState(entityId: string): Promise<Record<string, unknown> | null> {
    if (!this.isConfigured()) {
      console.warn('[WarehouseIoT] Not configured - skipping state read:', entityId);
      return null;
    }

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), API_TIMEOUT_MS);

      const response = await fetch(`${this.baseUrl}/api/states/${entityId}`, {
        method: 'GET',
        headers: this.headers,
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!response.ok) {
        console.error(`[WarehouseIoT] Get state failed: ${entityId}`, response.status);
        return null;
      }

      return await response.json();
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        console.error(`[WarehouseIoT] Get state timed out: ${entityId}`);
      } else {
        console.error(`[WarehouseIoT] Get state error: ${entityId}`, error);
      }
      return null;
    }
  }

  /**
   * Helper to add a small delay (used between rapid commands like flash).
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  // ------------------------------------------
  // Smart Light Control
  // ------------------------------------------

  /**
   * Set the loading bay indicator light to a specific color, or turn it off.
   */
  async setLoadingBayLights(color: LightColor): Promise<boolean> {
    if (color === 'off') {
      return this.callService('light', 'turn_off', {
        entity_id: ENTITIES.loadingBayLight,
      });
    }

    const rgb = COLOR_MAP[color];
    return this.callService('light', 'turn_on', {
      entity_id: ENTITIES.loadingBayLight,
      rgb_color: rgb,
      brightness: 255,
    });
  }

  /**
   * Set the warehouse to a predefined mode which adjusts lighting accordingly.
   * - loading: bay yellow, main lights full brightness
   * - departure: bay green, main lights on
   * - receiving: bay blue, main lights full brightness
   * - closed: bay off, main lights off
   */
  async setWarehouseMode(mode: WarehouseMode): Promise<boolean> {
    const config = MODE_LIGHT_CONFIG[mode];

    // Set bay light
    const bayResult = await this.setLoadingBayLights(config.bay);

    // Set main lights
    let mainResult: boolean;
    if (config.main) {
      mainResult = await this.callService('light', 'turn_on', {
        entity_id: ENTITIES.mainLight,
        brightness: config.brightness || 255,
      });
    } else {
      mainResult = await this.callService('light', 'turn_off', {
        entity_id: ENTITIES.mainLight,
      });
    }

    return bayResult && mainResult;
  }

  /**
   * Flash the loading bay lights for urgent notifications.
   * Flashes red 3 times, then returns to previous state.
   */
  async flashAlert(): Promise<boolean> {
    // Get current state to restore after flash
    const currentState = await this.getState(ENTITIES.loadingBayLight);

    try {
      for (let i = 0; i < 3; i++) {
        await this.callService('light', 'turn_on', {
          entity_id: ENTITIES.loadingBayLight,
          rgb_color: [255, 0, 0],
          brightness: 255,
        });
        await this.delay(400);

        await this.callService('light', 'turn_off', {
          entity_id: ENTITIES.loadingBayLight,
        });
        await this.delay(400);
      }

      // Restore previous state
      if (currentState && (currentState as any).state === 'on') {
        const attrs = (currentState as any).attributes || {};
        await this.callService('light', 'turn_on', {
          entity_id: ENTITIES.loadingBayLight,
          ...(attrs.rgb_color ? { rgb_color: attrs.rgb_color } : {}),
          ...(attrs.brightness ? { brightness: attrs.brightness } : {}),
        });
      }

      return true;
    } catch (error) {
      console.error('[WarehouseIoT] Flash alert error:', error);
      return false;
    }
  }

  // ------------------------------------------
  // Door Control
  // ------------------------------------------

  /**
   * Open a loading bay door. Defaults to bay 1 if no bay number specified.
   */
  async openLoadingDoor(bayNumber: number = 1): Promise<boolean> {
    const entityId = loadingBayEntity(bayNumber);
    return this.callService('cover', 'open_cover', {
      entity_id: entityId,
    });
  }

  /**
   * Close a loading bay door. Defaults to bay 1 if no bay number specified.
   */
  async closeLoadingDoor(bayNumber: number = 1): Promise<boolean> {
    const entityId = loadingBayEntity(bayNumber);
    return this.callService('cover', 'close_cover', {
      entity_id: entityId,
    });
  }

  /**
   * Get the open/closed status of all loading bay doors.
   */
  async getDoorStatus(): Promise<DoorStatus[]> {
    const doors: DoorStatus[] = [];
    const bayEntries: [number, string][] = [
      [1, ENTITIES.loadingBay1],
      [2, ENTITIES.loadingBay2],
      [3, ENTITIES.loadingBay3],
    ];

    for (const [bayNumber, entityId] of bayEntries) {
      const state = await this.getState(entityId);
      doors.push({
        bayNumber,
        entityId,
        state: state
          ? (state as any).state as DoorStatus['state']
          : 'unknown',
      });
    }

    return doors;
  }

  // ------------------------------------------
  // TV/Display Control
  // ------------------------------------------

  /**
   * Cast a URL to a display device (warehouse TV or other media player).
   */
  async castToDisplay(url: string, displayId?: string): Promise<boolean> {
    const entityId = displayId || ENTITIES.tv;

    // Use media_player.play_media to cast a URL
    return this.callService('media_player', 'play_media', {
      entity_id: entityId,
      media_content_type: 'url',
      media_content_id: url,
    });
  }

  /**
   * Show the main warehouse dashboard on the TV.
   */
  async showDashboard(displayId?: string): Promise<boolean> {
    // Cast the internal warehouse dashboard page
    const dashboardUrl = `${this.baseUrl}/local/warehouse-dashboard.html`;
    return this.castToDisplay(dashboardUrl, displayId);
  }

  /**
   * Show the loading assist view for a specific delivery ticket on the TV.
   * This displays the ticket's item checklist, customer info, and delivery details.
   */
  async showLoadingAssist(ticketId: string, displayId?: string): Promise<boolean> {
    // Cast the loading assist page with the ticket ID as a query parameter
    const baseAppUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://www.rivercityroofingsolutions.com';
    const loadingUrl = `${baseAppUrl}/portal/warehouse/loading-assist?ticket=${encodeURIComponent(ticketId)}`;
    return this.castToDisplay(loadingUrl, displayId);
  }

  // ------------------------------------------
  // Speaker / TTS
  // ------------------------------------------

  /**
   * Make a TTS announcement through the warehouse speaker.
   * Urgent announcements are preceded by an alert tone and use higher volume.
   */
  async announce(message: string, priority: AnnouncePriority = 'normal'): Promise<boolean> {
    if (priority === 'urgent') {
      // Play alert tone first
      await this.callService('media_player', 'volume_set', {
        entity_id: ENTITIES.speaker,
        volume_level: 1.0,
      });
      await this.playAlert('urgent');
      await this.delay(1500);
    } else {
      await this.callService('media_player', 'volume_set', {
        entity_id: ENTITIES.speaker,
        volume_level: 0.7,
      });
    }

    return this.callService('tts', 'speak', {
      entity_id: ENTITIES.speaker,
      media_player_entity_id: ENTITIES.speaker,
      message,
    });
  }

  /**
   * Play a predefined alert sound through the warehouse speaker.
   */
  async playAlert(type: AlertSoundType): Promise<boolean> {
    const mediaUrl = ALERT_SOUNDS[type];

    return this.callService('media_player', 'play_media', {
      entity_id: ENTITIES.speaker,
      media_content_type: 'music',
      media_content_id: mediaUrl,
    });
  }

  // ------------------------------------------
  // Automation Triggers
  // ------------------------------------------

  /**
   * Trigger a Home Assistant scene by name.
   */
  async triggerScene(sceneName: string): Promise<boolean> {
    return this.callService('scene', 'turn_on', {
      entity_id: `scene.${sceneName}`,
    });
  }

  /**
   * Automatically trigger IoT actions based on a delivery status change.
   * This is the main integration point between the delivery workflow and the warehouse.
   */
  async onDeliveryStatusChange(ticketId: string, newStatus: string): Promise<void> {
    if (!this.isConfigured()) {
      return;
    }


    try {
      switch (newStatus) {
        case 'assigned':
          // New delivery assigned - announce and display on TV
          await this.announce(`New delivery assigned. Ticket ${ticketId}. Check the display for details.`);
          await this.showLoadingAssist(ticketId);
          break;

        case 'materials_pulled':
          // Materials are being gathered - set bay lights to yellow (loading in progress)
          await this.setLoadingBayLights('yellow');
          break;

        case 'load_verified':
          // Load has been verified and is ready - set bay lights to green
          await this.setLoadingBayLights('green');
          await this.announce(`Ticket ${ticketId} loaded and verified. Ready for departure.`);
          break;

        case 'en_route':
          // Truck is departing - announce, close door, turn off bay lights
          await this.announce(`Delivery ${ticketId} departing. Safe travels.`);
          await this.playAlert('departure');
          await this.delay(2000);
          await this.closeLoadingDoor();
          await this.setLoadingBayLights('off');
          break;

        case 'arrived':
          // Driver arrived at customer - notify the office
          await this.announce(`Driver has arrived at the delivery location for ticket ${ticketId}.`);
          break;

        case 'delivered':
          // Delivery confirmed - success announcement
          await this.playAlert('arrival');
          await this.delay(1000);
          await this.announce(`Delivery complete for ticket ${ticketId}. Great job, team!`);
          break;

        case 'completed':
          // Fully completed - update TV back to main dashboard
          await this.showDashboard();
          break;

        default:
      }
    } catch (error) {
      console.error(`[WarehouseIoT] Error handling status change for ${ticketId}:`, error);
    }
  }

  // ------------------------------------------
  // Sensor Data
  // ------------------------------------------

  /**
   * Read the current warehouse temperature from the HA sensor.
   */
  async getWarehouseTemp(): Promise<SensorReading> {
    const state = await this.getState(ENTITIES.temperature);

    if (!state) {
      return {
        entityId: ENTITIES.temperature,
        state: 'unavailable',
      };
    }

    const attrs = (state as any).attributes || {};
    return {
      entityId: ENTITIES.temperature,
      state: (state as any).state || 'unavailable',
      unit: attrs.unit_of_measurement || '°F',
      lastUpdated: (state as any).last_updated,
    };
  }

  /**
   * Check whether the warehouse motion sensor is detecting motion.
   */
  async getMotionStatus(): Promise<SensorReading> {
    const state = await this.getState(ENTITIES.motion);

    if (!state) {
      return {
        entityId: ENTITIES.motion,
        state: 'unavailable',
      };
    }

    return {
      entityId: ENTITIES.motion,
      state: (state as any).state || 'unavailable', // 'on' = motion detected, 'off' = clear
      lastUpdated: (state as any).last_updated,
    };
  }

  // ------------------------------------------
  // Device Status
  // ------------------------------------------

  /**
   * Get the status of all managed warehouse devices.
   * Returns a list with entity ID, friendly name, current state, and availability.
   */
  async getDeviceStatuses(): Promise<DeviceStatus[]> {
    const allEntities = Object.values(ENTITIES);
    const statuses: DeviceStatus[] = [];

    for (const entityId of allEntities) {
      const state = await this.getState(entityId);

      if (state) {
        const attrs = (state as any).attributes || {};
        statuses.push({
          entityId,
          name: attrs.friendly_name || entityId,
          state: (state as any).state || 'unknown',
          available: (state as any).state !== 'unavailable',
          lastChanged: (state as any).last_changed,
        });
      } else {
        statuses.push({
          entityId,
          name: entityId,
          state: 'unknown',
          available: false,
        });
      }
    }

    return statuses;
  }
}

// ============================================
// SINGLETON EXPORT
// ============================================

export const warehouseIoT = new WarehouseIoTService();