/**
 * Weather Alert Service - Real-time NWS alerts & storm event tracking
 *
 * Integrates with the free NWS public API (api.weather.gov) for live
 * severe weather alerts. Tracks storm events for lead generation and
 * customer impact analysis.
 *
 * Data persisted to data/weather-alerts.json and data/storm-events.json.
 */

import fs from 'fs';
import path from 'path';

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

interface AlertsFile {
  alerts: WeatherAlert[];
  lastFetched: string;
}

interface StormEventsFile {
  events: StormEvent[];
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
// File helpers
// ---------------------------------------------------------------------------

const ALERTS_FILE = path.join(process.cwd(), 'data', 'weather-alerts.json');
const EVENTS_FILE = path.join(process.cwd(), 'data', 'storm-events.json');

function readAlertsFile(): AlertsFile {
  try {
    const raw = fs.readFileSync(ALERTS_FILE, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return { alerts: [], lastFetched: '' };
  }
}

function writeAlertsFile(data: AlertsFile): void {
  fs.writeFileSync(ALERTS_FILE, JSON.stringify(data, null, 2), 'utf-8');
}

function readEventsFile(): StormEventsFile {
  try {
    const raw = fs.readFileSync(EVENTS_FILE, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return { events: [] };
  }
}

function writeEventsFile(data: StormEventsFile): void {
  fs.writeFileSync(EVENTS_FILE, JSON.stringify(data, null, 2), 'utf-8');
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

      // Update cache
      this.cachedAlerts = nwsAlerts;
      this.lastFetchTime = Date.now();

      // Persist to file
      const fileData = readAlertsFile();
      fileData.alerts = nwsAlerts;
      fileData.lastFetched = new Date().toISOString();
      writeAlertsFile(fileData);

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
   * Get currently active alerts (from cache or file).
   */
  getActiveAlerts(): WeatherAlert[] {
    // Try memory cache first
    if (this.cachedAlerts.length > 0) {
      const now = new Date();
      return this.cachedAlerts.filter(a => a.isActive && new Date(a.endTime) > now);
    }

    // Fall back to file
    const fileData = readAlertsFile();
    const now = new Date();
    return fileData.alerts.filter(a => a.isActive && new Date(a.endTime) > now);
  }

  /**
   * Get all alerts including manual ones merged with NWS data.
   */
  getAllAlerts(): WeatherAlert[] {
    const fileData = readAlertsFile();
    const manualAlerts = fileData.alerts.filter(a => a.source === 'manual');

    if (this.cachedAlerts.length > 0) {
      // Merge NWS cached alerts with manual alerts from file
      const nwsIds = new Set(this.cachedAlerts.map(a => a.id));
      const uniqueManual = manualAlerts.filter(a => !nwsIds.has(a.id));
      return [...this.cachedAlerts, ...uniqueManual];
    }

    return fileData.alerts;
  }

  /**
   * Add a manual alert.
   */
  addManualAlert(alert: Omit<WeatherAlert, 'id' | 'createdAt' | 'source'>): WeatherAlert {
    const newAlert: WeatherAlert = {
      ...alert,
      id: `manual-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      source: 'manual',
      createdAt: new Date().toISOString(),
    };

    const fileData = readAlertsFile();
    fileData.alerts.push(newAlert);
    writeAlertsFile(fileData);

    // Also add to memory cache
    this.cachedAlerts.push(newAlert);

    return newAlert;
  }

  /**
   * Log a storm event for tracking.
   */
  logStormEvent(event: Omit<StormEvent, 'id' | 'createdAt'>): StormEvent {
    const newEvent: StormEvent = {
      ...event,
      id: `storm-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      createdAt: new Date().toISOString(),
    };

    const fileData = readEventsFile();
    fileData.events.unshift(newEvent);
    writeEventsFile(fileData);

    return newEvent;
  }

  /**
   * Get storm history with optional filters.
   */
  getStormHistory(options?: {
    limit?: number;
    startDate?: string;
    endDate?: string;
    county?: string;
    type?: string;
    followUpStatus?: StormEvent['followUpStatus'];
  }): StormEvent[] {
    const fileData = readEventsFile();
    let events = fileData.events;

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
  updateStormEvent(eventId: string, updates: Partial<Pick<StormEvent, 'followUpStatus' | 'notes' | 'leadsGenerated'>>): StormEvent | null {
    const fileData = readEventsFile();
    const idx = fileData.events.findIndex(e => e.id === eventId);
    if (idx === -1) return null;

    fileData.events[idx] = { ...fileData.events[idx], ...updates };
    writeEventsFile(fileData);
    return fileData.events[idx];
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
  getImpactAnalysis(alertOrStormId: string): {
    affectedCustomers: number;
    affectedJobs: number;
    affectedZips: string[];
    potentialLeads: number;
    counties: string[];
    severity: string;
  } | null {
    // Check alerts first
    const allAlerts = this.getAllAlerts();
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
    const events = readEventsFile().events;
    const event = events.find(e => e.id === alertOrStormId);
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

  private getFallbackAlerts(): WeatherAlert[] {
    // Return cached file data if NWS is unreachable
    const fileData = readAlertsFile();
    return fileData.alerts;
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
