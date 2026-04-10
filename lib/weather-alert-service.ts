/**
 * Weather Alert Service - Real-time NWS alerts & storm event tracking
 *
 * Integrates with the free NWS public API (api.weather.gov) for live
 * severe weather alerts. Tracks storm events for lead generation and
 * customer impact analysis.
 *
 * Persisted to the Google Sheets master workbook (Weather_Events tab).
 * A single tab holds both weather alerts and storm events, differentiated
 * by the `type` column (`alert` vs `storm`). The legacy
 * data/weather-alerts.json and data/storm-events.json files are left in
 * place as dev seeds but no longer read or written at runtime.
 */

import { googleSheetsService, SHEET_NAMES } from './google-sheets-service';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface WeatherAlert {
  id: string;
  type: 'severe_thunderstorm' | 'tornado' | 'hail' | 'wind' | 'flood' | 'winter_storm' | 'heat' | 'general';
  severity: 'minor' | 'moderate' | 'severe' | 'extreme';
  title: string;
  description: string;
  area: string;
  counties: string[];
  startTime: string;
  endTime: string;
  source: 'NWS' | 'manual' | 'system';
  isActive: boolean;
  affectedCustomers: number;
  affectedJobs: number;
  hailSize?: string;
  windSpeed?: number;
  createdAt: string;
}

export interface StormEvent {
  id: string;
  date: string;
  type: string;
  counties: string[];
  severity: string;
  hailSize?: string;
  windSpeed?: number;
  description: string;
  estimatedDamage: 'none' | 'minor' | 'moderate' | 'significant' | 'severe';
  leadsGenerated: number;
  customersAffected: number;
  followUpStatus: 'pending' | 'in_progress' | 'completed';
  notes: string;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const NWS_USER_AGENT = 'RiverCityRoofing/1.0 (rcrs@rivercityroofingsolutions.com)';
const NWS_BASE_URL = 'https://api.weather.gov';

// RCRS service area counties in Alabama
const SERVICE_AREA_COUNTIES = [
  'Morgan', 'Madison', 'Limestone', 'Lawrence', 'Cullman',
  'Marshall', 'DeKalb', 'Jackson', 'Colbert', 'Lauderdale',
  'Franklin', 'Marion', 'Winston', 'Blount', 'Etowah',
  'Cherokee', 'Jefferson', 'St. Clair', 'Calhoun',
];

// County-to-zip mapping for impact analysis
const COUNTY_ZIP_MAP: Record<string, string[]> = {
  'Morgan': ['35601', '35602', '35603', '35640', '35671'],
  'Madison': ['35801', '35802', '35803', '35805', '35806', '35810', '35811', '35816', '35756', '35757', '35758'],
  'Limestone': ['35611', '35613'],
  'Lawrence': ['35650'],
  'Cullman': ['35055', '35057', '35058'],
  'Marshall': ['35950', '35951', '35976'],
  'Jackson': ['35768'],
  'Colbert': ['35661'],
  'Lauderdale': ['35630', '35633'],
};

// Simulated customer counts per county (for impact estimates)
const COUNTY_CUSTOMER_ESTIMATES: Record<string, number> = {
  'Morgan': 145,
  'Madison': 280,
  'Limestone': 65,
  'Lawrence': 35,
  'Cullman': 55,
  'Marshall': 40,
  'Jackson': 25,
  'Colbert': 30,
  'Lauderdale': 45,
  'DeKalb': 20,
  'Blount': 15,
  'Etowah': 35,
  'Jefferson': 50,
};

// Simulated active job counts per county
const COUNTY_JOB_ESTIMATES: Record<string, number> = {
  'Morgan': 18,
  'Madison': 32,
  'Limestone': 8,
  'Lawrence': 4,
  'Cullman': 6,
  'Marshall': 5,
  'Jackson': 3,
  'Colbert': 4,
  'Lauderdale': 5,
  'DeKalb': 2,
  'Blount': 2,
  'Etowah': 4,
  'Jefferson': 6,
};

// Homes per zip for lead opportunity estimation
const ZIP_HOME_ESTIMATES: Record<string, number> = {
  '35601': 8500, '35602': 6200, '35603': 7100, '35640': 9800, '35671': 4500,
  '35801': 7200, '35802': 9100, '35803': 8800, '35805': 5600, '35806': 7800,
  '35810': 6400, '35811': 5200, '35816': 4100, '35756': 11200, '35757': 9500,
  '35758': 10800, '35611': 7600, '35613': 4200, '35650': 3800,
  '35055': 5400, '35057': 3200, '35058': 2800, '35950': 4600, '35951': 3100,
  '35976': 3500, '35768': 4200, '35661': 5800, '35630': 6100, '35633': 3400,
};

// ---------------------------------------------------------------------------
// Sheet schema (unified alerts + storms)
// ---------------------------------------------------------------------------

type WeatherRecordType = 'alert' | 'storm';

const WEATHER_EVENT_HEADERS: string[] = [
  'id',
  'recordType',       // 'alert' | 'storm'
  // Shared
  'type',             // alert type or storm type
  'severity',
  'counties',         // JSON string[]
  'hailSize',
  'windSpeed',
  'description',
  'createdAt',
  // Alert-only
  'title',
  'area',
  'startTime',
  'endTime',
  'source',
  'isActive',
  'affectedCustomers',
  'affectedJobs',
  // Storm-only
  'date',
  'estimatedDamage',
  'leadsGenerated',
  'customersAffected',
  'followUpStatus',
  'notes',
];

function parseNumber(raw: string): number {
  if (!raw) return 0;
  const n = parseFloat(raw);
  return Number.isFinite(n) ? n : 0;
}

function parseBool(raw: string): boolean {
  return raw === 'true' || raw === 'TRUE' || raw === '1';
}

function parseJson<T>(raw: string, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function rowToAlert(row: Record<string, string>): WeatherAlert {
  const alert: WeatherAlert = {
    id: row.id || '',
    type: (row.type as WeatherAlert['type']) || 'general',
    severity: (row.severity as WeatherAlert['severity']) || 'minor',
    title: row.title || '',
    description: row.description || '',
    area: row.area || '',
    counties: parseJson<string[]>(row.counties, []),
    startTime: row.startTime || '',
    endTime: row.endTime || '',
    source: (row.source as WeatherAlert['source']) || 'manual',
    isActive: parseBool(row.isActive),
    affectedCustomers: parseNumber(row.affectedCustomers),
    affectedJobs: parseNumber(row.affectedJobs),
    createdAt: row.createdAt || '',
  };
  if (row.hailSize) alert.hailSize = row.hailSize;
  if (row.windSpeed) alert.windSpeed = parseNumber(row.windSpeed);
  return alert;
}

function alertToRow(alert: WeatherAlert): Record<string, unknown> {
  return {
    id: alert.id,
    recordType: 'alert' as WeatherRecordType,
    type: alert.type,
    severity: alert.severity,
    counties: JSON.stringify(alert.counties || []),
    hailSize: alert.hailSize || '',
    windSpeed: alert.windSpeed ?? '',
    description: alert.description,
    createdAt: alert.createdAt,
    title: alert.title,
    area: alert.area,
    startTime: alert.startTime,
    endTime: alert.endTime,
    source: alert.source,
    isActive: alert.isActive ? 'true' : 'false',
    affectedCustomers: alert.affectedCustomers,
    affectedJobs: alert.affectedJobs,
    date: '',
    estimatedDamage: '',
    leadsGenerated: '',
    customersAffected: '',
    followUpStatus: '',
    notes: '',
  };
}

function rowToStorm(row: Record<string, string>): StormEvent {
  const storm: StormEvent = {
    id: row.id || '',
    date: row.date || '',
    type: row.type || '',
    counties: parseJson<string[]>(row.counties, []),
    severity: row.severity || '',
    description: row.description || '',
    estimatedDamage: (row.estimatedDamage as StormEvent['estimatedDamage']) || 'minor',
    leadsGenerated: parseNumber(row.leadsGenerated),
    customersAffected: parseNumber(row.customersAffected),
    followUpStatus: (row.followUpStatus as StormEvent['followUpStatus']) || 'pending',
    notes: row.notes || '',
    createdAt: row.createdAt || '',
  };
  if (row.hailSize) storm.hailSize = row.hailSize;
  if (row.windSpeed) storm.windSpeed = parseNumber(row.windSpeed);
  return storm;
}

function stormToRow(storm: StormEvent): Record<string, unknown> {
  return {
    id: storm.id,
    recordType: 'storm' as WeatherRecordType,
    type: storm.type,
    severity: storm.severity,
    counties: JSON.stringify(storm.counties || []),
    hailSize: storm.hailSize || '',
    windSpeed: storm.windSpeed ?? '',
    description: storm.description,
    createdAt: storm.createdAt,
    title: '',
    area: '',
    startTime: '',
    endTime: '',
    source: '',
    isActive: '',
    affectedCustomers: '',
    affectedJobs: '',
    date: storm.date,
    estimatedDamage: storm.estimatedDamage,
    leadsGenerated: storm.leadsGenerated,
    customersAffected: storm.customersAffected,
    followUpStatus: storm.followUpStatus,
    notes: storm.notes || '',
  };
}

// ---------------------------------------------------------------------------
// NWS Alert type mapping
// ---------------------------------------------------------------------------

function classifyAlertType(event: string, description: string): WeatherAlert['type'] {
  const text = `${event} ${description}`.toLowerCase();
  if (text.includes('tornado')) return 'tornado';
  if (text.includes('hail')) return 'hail';
  if (text.includes('severe thunderstorm') || text.includes('severe tstm')) return 'severe_thunderstorm';
  if (text.includes('wind')) return 'wind';
  if (text.includes('flood') || text.includes('flash')) return 'flood';
  if (text.includes('winter') || text.includes('ice') || text.includes('freeze') || text.includes('snow') || text.includes('blizzard')) return 'winter_storm';
  if (text.includes('heat') || text.includes('excessive')) return 'heat';
  return 'general';
}

function classifySeverity(nwsSeverity: string): WeatherAlert['severity'] {
  const s = (nwsSeverity || '').toLowerCase();
  if (s === 'extreme') return 'extreme';
  if (s === 'severe') return 'severe';
  if (s === 'moderate') return 'moderate';
  return 'minor';
}

function extractHailSize(description: string): string | undefined {
  // Look for hail size mentions: "1 inch hail", "quarter size hail", "golf ball"
  const sizePatterns = [
    /(\d+(?:\.\d+)?)\s*(?:inch|in\.?)\s*(?:hail|diameter)/i,
    /(quarter|half dollar|golf ball|baseball|softball|ping pong|marble|dime|nickel|penny)\s*(?:size|sized)?\s*hail/i,
    /hail\s*(?:up to|of|to)\s*(\d+(?:\.\d+)?)\s*(?:inch|in)/i,
  ];

  for (const pattern of sizePatterns) {
    const match = description.match(pattern);
    if (match) return match[1] || match[0];
  }

  return undefined;
}

function extractWindSpeed(description: string): number | undefined {
  const match = description.match(/(\d{2,3})\s*(?:mph|knot|kt)/i);
  if (match) {
    let speed = parseInt(match[1], 10);
    // Convert knots to mph if needed
    if (/knot|kt/i.test(match[0])) {
      speed = Math.round(speed * 1.15078);
    }
    return speed;
  }
  return undefined;
}

function extractCounties(areaDesc: string): string[] {
  if (!areaDesc) return [];
  // NWS area descriptions look like: "Madison, AL; Morgan, AL; Limestone, AL"
  // or "Madison; Morgan; Limestone"
  const parts = areaDesc.split(/[;,]/).map(p => p.trim());
  const counties: string[] = [];
  for (const part of parts) {
    const cleaned = part.replace(/\s*(AL|TN|GA|MS)\s*$/i, '').trim();
    if (cleaned && cleaned.length > 1 && !/^\d/.test(cleaned)) {
      counties.push(cleaned);
    }
  }
  return [...new Set(counties)];
}

// ---------------------------------------------------------------------------
// Service implementation
// ---------------------------------------------------------------------------

class WeatherAlertService {
  private cachedAlerts: WeatherAlert[] = [];
  private lastFetchTime = 0;
  private readonly CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

  // 60-second in-memory cache for sheet-backed reads
  private sheetCache: { alerts: WeatherAlert[]; storms: StormEvent[] } | null = null;
  private sheetCacheExpiresAt = 0;
  private readonly SHEET_CACHE_TTL_MS = 60_000;

  private async loadFromSheet(): Promise<{ alerts: WeatherAlert[]; storms: StormEvent[] }> {
    const rows = await googleSheetsService.getGenericRows(
      SHEET_NAMES.WEATHER_EVENTS,
      WEATHER_EVENT_HEADERS
    );
    const alerts: WeatherAlert[] = [];
    const storms: StormEvent[] = [];
    for (const row of rows) {
      if (row.recordType === 'storm') {
        storms.push(rowToStorm(row));
      } else {
        // default to alert
        alerts.push(rowToAlert(row));
      }
    }
    return { alerts, storms };
  }

  private async loadCached(): Promise<{ alerts: WeatherAlert[]; storms: StormEvent[] }> {
    if (this.sheetCache && Date.now() < this.sheetCacheExpiresAt) {
      return this.sheetCache;
    }
    this.sheetCache = await this.loadFromSheet();
    this.sheetCacheExpiresAt = Date.now() + this.SHEET_CACHE_TTL_MS;
    return this.sheetCache;
  }

  private invalidateSheetCache(): void {
    this.sheetCache = null;
    this.sheetCacheExpiresAt = 0;
  }

  private async persistAlert(alert: WeatherAlert): Promise<void> {
    await googleSheetsService.upsertGenericRow(
      SHEET_NAMES.WEATHER_EVENTS,
      WEATHER_EVENT_HEADERS,
      'id',
      alertToRow(alert)
    );
    this.invalidateSheetCache();
  }

  private async persistStorm(storm: StormEvent): Promise<void> {
    await googleSheetsService.upsertGenericRow(
      SHEET_NAMES.WEATHER_EVENTS,
      WEATHER_EVENT_HEADERS,
      'id',
      stormToRow(storm)
    );
    this.invalidateSheetCache();
  }

  /**
   * Fetch active weather alerts from NWS for specified counties.
   * Defaults to Alabama state-level if no counties specified.
   */
  async fetchNWSAlerts(counties?: string[]): Promise<WeatherAlert[]> {
    try {
      // Check cache
      if (Date.now() - this.lastFetchTime < this.CACHE_TTL_MS && this.cachedAlerts.length > 0) {
        if (counties && counties.length > 0) {
          return this.cachedAlerts.filter(a =>
            a.counties.some(c => counties.some(sc => c.toLowerCase().includes(sc.toLowerCase())))
          );
        }
        return this.cachedAlerts;
      }

      // Fetch from NWS - use state-level endpoint for broad coverage
      const url = `${NWS_BASE_URL}/alerts/active?area=AL`;
      const response = await fetch(url, {
        headers: {
          'User-Agent': NWS_USER_AGENT,
          'Accept': 'application/geo+json',
        },
        signal: AbortSignal.timeout(15000),
      });

      if (!response.ok) {
        console.error(`[WeatherAlertService] NWS API returned ${response.status}`);
        return this.getFallbackAlerts();
      }

      const data = await response.json();
      const nwsAlerts: WeatherAlert[] = [];

      for (const feature of (data.features || [])) {
        const props = feature.properties || {};
        const event = props.event || '';
        const description = props.description || '';
        const areaDesc = props.areaDesc || '';
        const alertCounties = extractCounties(areaDesc);

        const now = new Date();
        const expires = props.expires ? new Date(props.expires) : new Date(now.getTime() + 3600000);
        const isActive = expires > now;

        const alert: WeatherAlert = {
          id: props.id || `nws-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          type: classifyAlertType(event, description),
          severity: classifySeverity(props.severity),
          title: props.headline || event,
          description: description.slice(0, 1000),
          area: areaDesc.slice(0, 200),
          counties: alertCounties,
          startTime: props.onset || props.effective || now.toISOString(),
          endTime: props.expires || expires.toISOString(),
          source: 'NWS',
          isActive,
          affectedCustomers: this.estimateAffectedCustomers(alertCounties),
          affectedJobs: this.estimateAffectedJobs(alertCounties),
          hailSize: extractHailSize(description),
          windSpeed: extractWindSpeed(description),
          createdAt: props.sent || now.toISOString(),
        };

        nwsAlerts.push(alert);
      }

      // Update in-memory NWS cache
      this.cachedAlerts = nwsAlerts;
      this.lastFetchTime = Date.now();

      // Persist each NWS alert to the sheet
      for (const alert of nwsAlerts) {
        await this.persistAlert(alert);
      }

      // Filter by requested counties
      if (counties && counties.length > 0) {
        return nwsAlerts.filter(a =>
          a.counties.some(c => counties.some(sc => c.toLowerCase().includes(sc.toLowerCase())))
        );
      }

      return nwsAlerts;
    } catch (error) {
      console.error('[WeatherAlertService] Error fetching NWS alerts:', error);
      return this.getFallbackAlerts();
    }
  }

  /**
   * Get currently active alerts (from cache or sheet).
   */
  async getActiveAlerts(): Promise<WeatherAlert[]> {
    const now = new Date();
    // Try NWS memory cache first
    if (this.cachedAlerts.length > 0) {
      return this.cachedAlerts.filter(a => a.isActive && new Date(a.endTime) > now);
    }

    // Fall back to sheet
    const { alerts } = await this.loadCached();
    return alerts.filter(a => a.isActive && new Date(a.endTime) > now);
  }

  /**
   * Get all alerts including manual ones merged with NWS data.
   */
  async getAllAlerts(): Promise<WeatherAlert[]> {
    const { alerts } = await this.loadCached();
    const manualAlerts = alerts.filter(a => a.source === 'manual');

    if (this.cachedAlerts.length > 0) {
      // Merge NWS cached alerts with manual alerts from sheet
      const nwsIds = new Set(this.cachedAlerts.map(a => a.id));
      const uniqueManual = manualAlerts.filter(a => !nwsIds.has(a.id));
      return [...this.cachedAlerts, ...uniqueManual];
    }

    return alerts;
  }

  /**
   * Add a manual alert.
   */
  async addManualAlert(alert: Omit<WeatherAlert, 'id' | 'createdAt' | 'source'>): Promise<WeatherAlert> {
    const newAlert: WeatherAlert = {
      ...alert,
      id: `manual-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      source: 'manual',
      createdAt: new Date().toISOString(),
    };

    await this.persistAlert(newAlert);

    // Also add to in-memory NWS cache
    this.cachedAlerts.push(newAlert);

    return newAlert;
  }

  /**
   * Log a storm event for tracking.
   */
  async logStormEvent(event: Omit<StormEvent, 'id' | 'createdAt'>): Promise<StormEvent> {
    const newEvent: StormEvent = {
      ...event,
      id: `storm-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      createdAt: new Date().toISOString(),
    };

    await this.persistStorm(newEvent);
    return newEvent;
  }

  /**
   * Get storm history with optional filters.
   */
  async getStormHistory(options?: {
    limit?: number;
    startDate?: string;
    endDate?: string;
    county?: string;
    type?: string;
    followUpStatus?: StormEvent['followUpStatus'];
  }): Promise<StormEvent[]> {
    const { storms } = await this.loadCached();
    let events = [...storms];

    if (options?.startDate) {
      const start = new Date(options.startDate);
      events = events.filter(e => new Date(e.date) >= start);
    }

    if (options?.endDate) {
      const end = new Date(options.endDate);
      events = events.filter(e => new Date(e.date) <= end);
    }

    if (options?.county) {
      const county = options.county.toLowerCase();
      events = events.filter(e => e.counties.some(c => c.toLowerCase().includes(county)));
    }

    if (options?.type) {
      const type = options.type.toLowerCase();
      events = events.filter(e => e.type.toLowerCase().includes(type));
    }

    if (options?.followUpStatus) {
      events = events.filter(e => e.followUpStatus === options.followUpStatus);
    }

    // Sort newest first
    events.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    if (options?.limit) {
      events = events.slice(0, options.limit);
    }

    return events;
  }

  /**
   * Update a storm event's follow-up status or notes.
   */
  async updateStormEvent(eventId: string, updates: Partial<Pick<StormEvent, 'followUpStatus' | 'notes' | 'leadsGenerated'>>): Promise<StormEvent | null> {
    const { storms } = await this.loadCached();
    const existing = storms.find(e => e.id === eventId);
    if (!existing) return null;

    const updated: StormEvent = { ...existing, ...updates };
    await this.persistStorm(updated);
    return updated;
  }

  /**
   * Estimate affected customers based on counties in the alert area.
   */
  getAffectedCustomers(counties: string[]): number {
    return this.estimateAffectedCustomers(counties);
  }

  /**
   * Generate lead opportunity analysis from a storm event.
   */
  generateStormLeadOpportunities(stormEvent: StormEvent): {
    potentialLeads: number;
    affectedZips: string[];
    estimatedHomes: number;
    conversionEstimate: number;
  } {
    const affectedZips: string[] = [];
    let estimatedHomes = 0;

    for (const county of stormEvent.counties) {
      const zips = COUNTY_ZIP_MAP[county] || [];
      for (const zip of zips) {
        if (!affectedZips.includes(zip)) {
          affectedZips.push(zip);
          estimatedHomes += ZIP_HOME_ESTIMATES[zip] || 3000;
        }
      }
    }

    // Estimate potential leads based on damage severity
    const damageMultipliers: Record<string, number> = {
      'none': 0.001,
      'minor': 0.005,
      'moderate': 0.015,
      'significant': 0.03,
      'severe': 0.05,
    };
    const multiplier = damageMultipliers[stormEvent.estimatedDamage] || 0.01;
    const potentialLeads = Math.round(estimatedHomes * multiplier);

    // Conversion estimate (historical: ~8-12% of storm leads convert)
    const conversionEstimate = Math.round(potentialLeads * 0.10);

    return {
      potentialLeads,
      affectedZips,
      estimatedHomes,
      conversionEstimate,
    };
  }

  /**
   * Get impact analysis for a specific alert or storm.
   */
  async getImpactAnalysis(alertOrStormId: string): Promise<{
    affectedCustomers: number;
    affectedJobs: number;
    affectedZips: string[];
    potentialLeads: number;
    counties: string[];
    severity: string;
  } | null> {
    // Check alerts first
    const allAlerts = await this.getAllAlerts();
    const alert = allAlerts.find(a => a.id === alertOrStormId);

    if (alert) {
      const leadInfo = this.generateStormLeadOpportunities({
        id: alert.id,
        date: alert.startTime,
        type: alert.type,
        counties: alert.counties,
        severity: alert.severity,
        hailSize: alert.hailSize,
        windSpeed: alert.windSpeed,
        description: alert.description,
        estimatedDamage: this.severityToDamage(alert.severity),
        leadsGenerated: 0,
        customersAffected: alert.affectedCustomers,
        followUpStatus: 'pending',
        notes: '',
        createdAt: alert.createdAt,
      });

      return {
        affectedCustomers: alert.affectedCustomers,
        affectedJobs: alert.affectedJobs,
        affectedZips: leadInfo.affectedZips,
        potentialLeads: leadInfo.potentialLeads,
        counties: alert.counties,
        severity: alert.severity,
      };
    }

    // Check storm events
    const { storms } = await this.loadCached();
    const event = storms.find(e => e.id === alertOrStormId);
    if (event) {
      const leadInfo = this.generateStormLeadOpportunities(event);
      return {
        affectedCustomers: event.customersAffected,
        affectedJobs: 0,
        affectedZips: leadInfo.affectedZips,
        potentialLeads: leadInfo.potentialLeads,
        counties: event.counties,
        severity: event.severity,
      };
    }

    return null;
  }

  // -------------------------------------------------------------------------
  // Private helpers
  // -------------------------------------------------------------------------

  private estimateAffectedCustomers(counties: string[]): number {
    let total = 0;
    for (const county of counties) {
      // Match against our known service area counties
      for (const [knownCounty, count] of Object.entries(COUNTY_CUSTOMER_ESTIMATES)) {
        if (county.toLowerCase().includes(knownCounty.toLowerCase())) {
          total += count;
        }
      }
    }
    return total;
  }

  private estimateAffectedJobs(counties: string[]): number {
    let total = 0;
    for (const county of counties) {
      for (const [knownCounty, count] of Object.entries(COUNTY_JOB_ESTIMATES)) {
        if (county.toLowerCase().includes(knownCounty.toLowerCase())) {
          total += count;
        }
      }
    }
    return total;
  }

  private severityToDamage(severity: WeatherAlert['severity']): StormEvent['estimatedDamage'] {
    switch (severity) {
      case 'extreme': return 'severe';
      case 'severe': return 'significant';
      case 'moderate': return 'moderate';
      default: return 'minor';
    }
  }

  private async getFallbackAlerts(): Promise<WeatherAlert[]> {
    // Return sheet-backed data if NWS is unreachable
    const { alerts } = await this.loadCached();
    return alerts;
  }

  /**
   * Get service area counties list.
   */
  getServiceAreaCounties(): string[] {
    return [...SERVICE_AREA_COUNTIES];
  }

  /**
   * Get county-to-zip mapping.
   */
  getCountyZipMap(): Record<string, string[]> {
    return { ...COUNTY_ZIP_MAP };
  }
}

// ---------------------------------------------------------------------------
// Export singleton
// ---------------------------------------------------------------------------

export const weatherAlertService = new WeatherAlertService();
