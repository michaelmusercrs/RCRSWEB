// Customer Portal Service
// Manages customer access tokens, documents, and portal data

import crypto from 'crypto';
import { GoogleSpreadsheet } from 'google-spreadsheet';
import { googleSheetsService } from './google-sheets-service';

/** GeoJSON feature from Iowa State Mesonet hail reports */
interface HailGeoJsonFeature {
  properties: {
    valid?: string;
    utc_valid?: string;
    city?: string;
    magnitude?: number;
  };
  geometry: {
    coordinates: [number, number];
  };
}

/** Accessor for the private doc on googleSheetsService (non-null after init() returns true) */
type SheetsServiceWithDoc = { doc: GoogleSpreadsheet };

/** Google Sheets row accessor with .get() method */
interface SheetRow {
  get(key: string): string;
  set(key: string, value: string): void;
  save(): Promise<void>;
}

export interface CustomerPortalAccess {
  accessToken: string;
  customerId: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  customerAddress: string;
  salesRepId: string;
  salesRepName: string;
  salesRepSlug: string;
  jobId?: string;
  createdAt: string;
  expiresAt?: string; // Optional expiration
  lastAccessedAt?: string;
  isActive: boolean;
}

export interface CustomerAppointment {
  appointmentId: string;
  customerId: string;
  type: 'inspection' | 'estimate' | 'install_start' | 'install_complete' | 'final_walkthrough' | 'other';
  title: string;
  description?: string;
  scheduledDate: string;
  scheduledTime: string;
  duration: number; // minutes
  status: 'scheduled' | 'confirmed' | 'completed' | 'cancelled' | 'rescheduled';
  assignedTo: string;
  notes?: string;
  createdAt: string;
}

export interface CustomerDocument {
  documentId: string;
  customerId: string;
  type: 'estimate' | 'contract' | 'invoice' | 'warranty' | 'permit' | 'inspection_report' | 'photo' | 'other';
  title: string;
  description?: string;
  fileUrl: string;
  fileType: string; // pdf, jpg, png, etc.
  fileSize?: number;
  uploadedAt: string;
  uploadedBy: string;
  isVisible: boolean; // Whether customer can see this
}

export interface CustomerMessage {
  messageId: string;
  customerId: string;
  direction: 'inbound' | 'outbound';
  channel: 'sms' | 'email' | 'portal';
  subject?: string;
  content: string;
  sentAt: string;
  readAt?: string;
  sentBy?: string;
}

export interface WeatherForecast {
  date: string;
  dayOfWeek: string;
  high: number;
  low: number;
  condition: string;
  icon: string;
  precipChance: number;
  windSpeed: number;
  humidity: number;
}

export interface HailReport {
  reportId: string;
  date: string;
  location: string;
  distance: number; // miles from customer address
  hailSize: string; // e.g., "1.25 inch"
  source: string; // NWS, HailRecon, etc.
  severity: 'minor' | 'moderate' | 'severe';
  latitude: number;
  longitude: number;
}

export interface PortalSettings {
  showWeather: boolean;
  showHailReports: boolean;
  showStormReport: boolean;
  showHailRecon: boolean;
  showWeatherAlerts: boolean;
  showRiskScore: boolean;
  showAppointments: boolean;
  showDocuments: boolean;
  showMessages: boolean;
  showJobProgress: boolean;
  showDeliveryTracking: boolean;
  allowFileUpload: boolean;
  allowMessages: boolean;
}

export interface RepPortalSettings {
  repSlug: string;
  repName: string;
  // Each setting can be: true (enabled), false (disabled), or null (inherit from global)
  showWeather: boolean | null;
  showHailReports: boolean | null;
  showStormReport: boolean | null;
  showHailRecon: boolean | null;
  showWeatherAlerts: boolean | null;
  showRiskScore: boolean | null;
  showAppointments: boolean | null;
  showDocuments: boolean | null;
  showMessages: boolean | null;
  showJobProgress: boolean | null;
  showDeliveryTracking: boolean | null;
  allowFileUpload: boolean | null;
  allowMessages: boolean | null;
  updatedAt: string;
  updatedBy: string;
}

// Per-customer settings overrides (nullable = inherit from rep default)
export interface CustomerSettingsOverride {
  customerId: string;
  repSlug: string;
  showWeather: boolean | null;
  showHailReports: boolean | null;
  showStormReport: boolean | null;
  showHailRecon: boolean | null;
  showWeatherAlerts: boolean | null;
  showRiskScore: boolean | null;
  showAppointments: boolean | null;
  showDocuments: boolean | null;
  showMessages: boolean | null;
  showJobProgress: boolean | null;
  showDeliveryTracking: boolean | null;
  allowFileUpload: boolean | null;
  allowMessages: boolean | null;
  updatedAt: string;
  updatedBy: string;
}

// Customer-facing defaults: core features ON so the portal is useful out of the box.
// Reps/admins can disable specific features via the settings cascade.
// NOTE: If you set these all to false, new portals show a blank page until
// someone manually configures settings in Google Sheets -- that's a bad UX.
export const DEFAULT_PORTAL_SETTINGS: PortalSettings = {
  showWeather: true,
  showHailReports: true,
  showStormReport: false,
  showHailRecon: false,
  showWeatherAlerts: false,
  showRiskScore: false,
  showAppointments: true,
  showDocuments: true,
  showMessages: true,
  showJobProgress: true,
  showDeliveryTracking: true,
  allowFileUpload: true,
  allowMessages: true,
};

// Setting keys used in cascade logic
export const PORTAL_SETTING_KEYS: (keyof PortalSettings)[] = [
  'showWeather', 'showHailReports', 'showStormReport', 'showHailRecon',
  'showWeatherAlerts', 'showRiskScore', 'showAppointments', 'showDocuments',
  'showMessages', 'showJobProgress', 'showDeliveryTracking',
  'allowFileUpload', 'allowMessages',
];

export interface CustomerCallRecord {
  callId: string;
  direction: 'inbound' | 'outbound';
  status: 'completed' | 'missed' | 'voicemail';
  startTime: string;
  duration: number;
  repName: string;
  notes?: string;
  recordingAvailable?: boolean;
}

export interface CustomerPortalData {
  customer: CustomerPortalAccess;
  salesRep: {
    name: string;
    slug: string;
    phone: string;
    email: string;
    photo: string;
    position: string;
  };
  appointments: CustomerAppointment[];
  documents: CustomerDocument[];
  messages: CustomerMessage[];
  calls?: CustomerCallRecord[];
  jobStatus?: {
    phase: string;
    progress: number;
    nextMilestone: string;
    estimatedCompletion?: string;
  };
  weather?: WeatherForecast[];
  hailReports?: HailReport[];
  settings?: PortalSettings;
}

class CustomerPortalService {
  // Generate secure access token
  generateAccessToken(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  // Generate short link code for SMS
  generateShortCode(): string {
    return crypto.randomBytes(4).toString('hex').toUpperCase();
  }

  // Create customer portal access
  createPortalAccess(data: {
    customerName: string;
    customerEmail: string;
    customerPhone: string;
    customerAddress: string;
    salesRepId: string;
    salesRepName: string;
    salesRepSlug: string;
    jobId?: string;
  }): CustomerPortalAccess {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000); // 90 days from now

    return {
      accessToken: this.generateAccessToken(),
      customerId: `CUST-${Date.now()}-${this.generateShortCode()}`,
      customerName: data.customerName,
      customerEmail: data.customerEmail,
      customerPhone: data.customerPhone,
      customerAddress: data.customerAddress,
      salesRepId: data.salesRepId,
      salesRepName: data.salesRepName,
      salesRepSlug: data.salesRepSlug,
      jobId: data.jobId,
      createdAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
      isActive: true,
    };
  }

  // Generate customer portal URL
  getPortalUrl(accessToken: string): string {
    return `https://rivercityroofingsolutions.com/my/${accessToken}`;
  }

  // Generate sales rep intro link
  getSalesRepIntroUrl(salesRepSlug: string, customerToken?: string): string {
    const base = `https://rivercityroofingsolutions.com/team/${salesRepSlug}`;
    return customerToken ? `${base}?ref=${customerToken}` : base;
  }

  // Format phone for SMS
  formatPhoneForSMS(phone: string): string {
    return phone.replace(/\D/g, '').replace(/^1/, '');
  }

  // Generate SMS message templates
  getSMSTemplates(customer: CustomerPortalAccess) {
    const repUrl = this.getSalesRepIntroUrl(customer.salesRepSlug);
    const portalUrl = this.getPortalUrl(customer.accessToken);

    return {
      intro: `Hi ${customer.customerName.split(' ')[0]}! This is ${customer.salesRepName} from River City Roofing. Here's my profile with contact info: ${repUrl} - Looking forward to helping with your roof!`,

      portalInvite: `Hi ${customer.customerName.split(' ')[0]}! Your River City Roofing customer portal is ready. View appointments, documents & more: ${portalUrl}`,

      appointmentReminder: (apt: CustomerAppointment) =>
        `Reminder: Your ${apt.title} is scheduled for ${apt.scheduledDate} at ${apt.scheduledTime}. Questions? Reply to this text or call ${customer.salesRepName}.`,

      estimateReady: `Great news ${customer.customerName.split(' ')[0]}! Your roof estimate is ready to view: ${portalUrl} - ${customer.salesRepName}`,

      installScheduled: (date: string) =>
        `Your roof installation is scheduled to begin ${date}! View details & weather forecast: ${portalUrl}`,

      jobComplete: `Congratulations! Your new roof is complete. View warranty info & final photos: ${portalUrl} - Thank you for choosing River City Roofing!`,
    };
  }

  // Generate email templates
  getEmailTemplates(customer: CustomerPortalAccess) {
    const repUrl = this.getSalesRepIntroUrl(customer.salesRepSlug);
    const portalUrl = this.getPortalUrl(customer.accessToken);

    return {
      intro: {
        subject: `Meet Your Roofing Specialist - ${customer.salesRepName}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #16a34a;">Welcome to River City Roofing!</h2>
            <p>Hi ${customer.customerName},</p>
            <p>Thank you for your interest in River City Roofing Solutions. I'm ${customer.salesRepName}, and I'll be your dedicated roofing specialist.</p>
            <p>Learn more about me and my experience:</p>
            <a href="${repUrl}" style="display: inline-block; background: #16a34a; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; margin: 16px 0;">View My Profile</a>
            <p>I look forward to helping you with your roofing needs!</p>
            <p>Best regards,<br>${customer.salesRepName}<br>River City Roofing Solutions</p>
          </div>
        `,
      },

      portalInvite: {
        subject: `Your Customer Portal is Ready - River City Roofing`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #16a34a;">Your Customer Portal is Ready!</h2>
            <p>Hi ${customer.customerName},</p>
            <p>We've set up a personal portal just for you where you can:</p>
            <ul>
              <li>View upcoming appointments</li>
              <li>Access estimates, contracts & invoices</li>
              <li>Track your project status</li>
              <li>See weather forecasts for install days</li>
              <li>Contact your sales rep directly</li>
            </ul>
            <a href="${portalUrl}" style="display: inline-block; background: #16a34a; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; margin: 16px 0;">Access Your Portal</a>
            <p>Questions? Reply to this email or call us anytime.</p>
            <p>- The River City Roofing Team</p>
          </div>
        `,
      },
    };
  }

  // Fetch weather forecast (using Open-Meteo - free, no API key needed)
  async getWeatherForecast(latitude: number, longitude: number): Promise<WeatherForecast[]> {
    try {
      const response = await fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max,weather_code,wind_speed_10m_max&temperature_unit=fahrenheit&wind_speed_unit=mph&timezone=America/Chicago&forecast_days=5`
      );

      if (!response.ok) throw new Error('Weather API error');

      const data = await response.json();
      const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

      return data.daily.time.map((date: string, i: number) => {
        const weatherCode = data.daily.weather_code[i];
        return {
          date,
          dayOfWeek: days[new Date(date).getDay()],
          high: Math.round(data.daily.temperature_2m_max[i]),
          low: Math.round(data.daily.temperature_2m_min[i]),
          condition: this.getWeatherCondition(weatherCode),
          icon: this.getWeatherIcon(weatherCode),
          precipChance: data.daily.precipitation_probability_max[i] || 0,
          windSpeed: Math.round(data.daily.wind_speed_10m_max[i]),
          humidity: 0, // Not available in free tier
        };
      });
    } catch (error) {
      console.error('Error fetching weather:', error);
      return [];
    }
  }

  // Convert weather code to condition string
  private getWeatherCondition(code: number): string {
    const conditions: Record<number, string> = {
      0: 'Clear',
      1: 'Mainly Clear',
      2: 'Partly Cloudy',
      3: 'Overcast',
      45: 'Foggy',
      48: 'Foggy',
      51: 'Light Drizzle',
      53: 'Drizzle',
      55: 'Heavy Drizzle',
      61: 'Light Rain',
      63: 'Rain',
      65: 'Heavy Rain',
      71: 'Light Snow',
      73: 'Snow',
      75: 'Heavy Snow',
      77: 'Snow Grains',
      80: 'Light Showers',
      81: 'Showers',
      82: 'Heavy Showers',
      85: 'Snow Showers',
      86: 'Heavy Snow Showers',
      95: 'Thunderstorm',
      96: 'Thunderstorm with Hail',
      99: 'Severe Thunderstorm',
    };
    return conditions[code] || 'Unknown';
  }

  // Get weather icon
  private getWeatherIcon(code: number): string {
    if (code === 0) return 'sun';
    if (code <= 3) return 'cloud-sun';
    if (code <= 48) return 'cloud';
    if (code <= 55) return 'cloud-drizzle';
    if (code <= 65) return 'cloud-rain';
    if (code <= 77) return 'cloud-snow';
    if (code <= 82) return 'cloud-rain';
    if (code <= 86) return 'cloud-snow';
    return 'cloud-lightning';
  }

  // Fetch NWS hail reports (free API)
  async getHailReports(latitude: number, longitude: number, daysBack: number = 30): Promise<HailReport[]> {
    try {
      // NWS Storm Reports API
      const endDate = new Date();
      const startDate = new Date(endDate.getTime() - daysBack * 24 * 60 * 60 * 1000);

      const startStr = startDate.toISOString().slice(0, 10);
      const endStr = endDate.toISOString().slice(0, 10);

      // Using Iowa State Mesonet (free, comprehensive)
      const response = await fetch(
        `https://mesonet.agron.iastate.edu/geojson/lsr.php?sts=${startStr}T00:00:00Z&ets=${endStr}T23:59:59Z&wfos=HUN&type=H`
      );

      if (!response.ok) return [];

      const data = await response.json();
      const reports: HailReport[] = [];

      if (data.features) {
        data.features.forEach((feature: HailGeoJsonFeature, index: number) => {
          const props = feature.properties;
          const coords = feature.geometry.coordinates;

          // Calculate distance from customer
          const distance = this.calculateDistance(
            latitude, longitude,
            coords[1], coords[0]
          );

          // Only include reports within 50 miles
          if (distance <= 50) {
            reports.push({
              reportId: `HAIL-${index}-${Date.now()}`,
              date: props.valid || props.utc_valid || '',
              location: props.city || 'Unknown',
              distance: Math.round(distance * 10) / 10,
              hailSize: props.magnitude ? `${props.magnitude} inch` : 'Unknown',
              source: 'NWS',
              severity: this.getHailSeverity(props.magnitude ?? 0),
              latitude: coords[1],
              longitude: coords[0],
            });
          }
        });
      }

      return reports.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    } catch (error) {
      console.error('Error fetching hail reports:', error);
      return [];
    }
  }

  // Determine hail severity based on size
  private getHailSeverity(size: number): 'minor' | 'moderate' | 'severe' {
    if (!size || size < 1) return 'minor';
    if (size < 1.75) return 'moderate';
    return 'severe';
  }

  // Calculate distance between two GPS points
  private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 3959; // Earth's radius in miles
    const dLat = this.toRad(lat2 - lat1);
    const dLon = this.toRad(lon2 - lon1);
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(this.toRad(lat1)) * Math.cos(this.toRad(lat2)) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }

  private toRad(deg: number): number {
    return deg * Math.PI / 180;
  }

  // Global settings - cached in memory, persisted to Google Sheets
  private globalSettings: PortalSettings = { ...DEFAULT_PORTAL_SETTINGS };
  private globalSettingsLoaded = false;

  // Get global portal settings
  getGlobalSettings(): PortalSettings {
    return { ...this.globalSettings };
  }

  // Load global settings from Google Sheets
  async loadGlobalSettings(): Promise<PortalSettings> {
    try {
      const ready = await googleSheetsService.init();
      if (!ready) return this.getGlobalSettings();

      const doc = (googleSheetsService as unknown as SheetsServiceWithDoc).doc;
      if (!doc) return this.getGlobalSettings();

      let sheet = doc.sheetsByTitle['Portal_Global_Settings'];
      if (!sheet) {
        this.globalSettingsLoaded = true;
        return this.getGlobalSettings();
      }

      const rows = await sheet.getRows({ limit: 100000 });
      if (rows.length > 0) {
        const row = rows[0];
        const loaded: Record<string, boolean> = {};
        for (const key of PORTAL_SETTING_KEYS) {
          const val = row.get(key);
          // Keys missing from older sheet rows default to the DEFAULT_PORTAL_SETTINGS value
          loaded[key] = val !== undefined && val !== null && val !== '' ? val === 'true' : DEFAULT_PORTAL_SETTINGS[key];
        }
        this.globalSettings = loaded as unknown as PortalSettings;
      }

      this.globalSettingsLoaded = true;
      return this.getGlobalSettings();
    } catch (error) {
      console.error('Error loading global portal settings:', error);
      return this.getGlobalSettings();
    }
  }

  // Save global portal settings to Google Sheets
  async saveGlobalSettings(settings: PortalSettings): Promise<void> {
    this.globalSettings = { ...settings };

    try {
      const ready = await googleSheetsService.init();
      if (!ready) throw new Error('Google Sheets not initialized');

      const doc = (googleSheetsService as unknown as SheetsServiceWithDoc).doc;
      if (!doc) throw new Error('Google Sheets doc not available');

      const headers = [
        ...PORTAL_SETTING_KEYS,
        'updatedAt', 'updatedBy'
      ];

      let sheet = doc.sheetsByTitle['Portal_Global_Settings'];
      if (!sheet) {
        sheet = await doc.addSheet({ title: 'Portal_Global_Settings', headerValues: headers });
      }

      const rows = await sheet.getRows({ limit: 100000 });
      const rowData: Record<string, string> = {};
      for (const key of PORTAL_SETTING_KEYS) {
        rowData[key] = String(settings[key]);
      }
      rowData.updatedAt = new Date().toISOString();
      rowData.updatedBy = 'admin';

      if (rows.length > 0) {
        const row = rows[0];
        Object.entries(rowData).forEach(([key, value]) => {
          row.set(key, value);
        });
        await row.save();
      } else {
        await sheet.addRow(rowData);
      }
    } catch (error) {
      console.error('Error saving global portal settings:', error);
      throw error;
    }
  }

  // Get per-rep portal settings overrides
  async getRepSettings(repSlug: string): Promise<RepPortalSettings | null> {
    try {
      const ready = await googleSheetsService.init();
      if (!ready) return null;

      const doc = (googleSheetsService as unknown as SheetsServiceWithDoc).doc;
      if (!doc) return null;

      const sheet = doc.sheetsByTitle['Portal_Rep_Settings'];
      if (!sheet) return null;

      const rows = await sheet.getRows({ limit: 100000 });
      const row = rows.find((r: SheetRow) => r.get('repSlug') === repSlug);
      if (!row) return null;

      const result: Record<string, string | boolean | null | undefined> = {
        repSlug: row.get('repSlug'),
        repName: row.get('repName'),
        updatedAt: row.get('updatedAt') || '',
        updatedBy: row.get('updatedBy') || '',
      };
      for (const key of PORTAL_SETTING_KEYS) {
        result[key] = this.parseNullableBoolean(row.get(key));
      }
      return result as unknown as RepPortalSettings;
    } catch (error) {
      console.error('Error getting rep portal settings:', error);
      return null;
    }
  }

  // Get all rep settings
  async getAllRepSettings(): Promise<RepPortalSettings[]> {
    try {
      const ready = await googleSheetsService.init();
      if (!ready) return [];

      const doc = (googleSheetsService as unknown as SheetsServiceWithDoc).doc;
      if (!doc) return [];

      const sheet = doc.sheetsByTitle['Portal_Rep_Settings'];
      if (!sheet) return [];

      const rows = await sheet.getRows({ limit: 100000 });
      return rows.map((row: SheetRow) => {
        const result: Record<string, string | boolean | null> = {
          repSlug: row.get('repSlug') || '',
          repName: row.get('repName') || '',
          updatedAt: row.get('updatedAt') || '',
          updatedBy: row.get('updatedBy') || '',
        };
        for (const key of PORTAL_SETTING_KEYS) {
          result[key] = this.parseNullableBoolean(row.get(key));
        }
        return result as unknown as RepPortalSettings;
      });
    } catch (error) {
      console.error('Error getting all rep portal settings:', error);
      return [];
    }
  }

  // Save per-rep portal settings overrides
  async saveRepSettings(repSlug: string, settings: Partial<RepPortalSettings>): Promise<void> {
    try {
      const ready = await googleSheetsService.init();
      if (!ready) throw new Error('Google Sheets not initialized');

      const doc = (googleSheetsService as unknown as SheetsServiceWithDoc).doc;
      if (!doc) throw new Error('Google Sheets doc not available');

      const headers = [
        'repSlug', 'repName',
        ...PORTAL_SETTING_KEYS,
        'updatedAt', 'updatedBy'
      ];

      let sheet = doc.sheetsByTitle['Portal_Rep_Settings'];
      if (!sheet) {
        sheet = await doc.addSheet({ title: 'Portal_Rep_Settings', headerValues: headers });
      }

      const rows = await sheet.getRows({ limit: 100000 });
      const existingRow = rows.find((r: SheetRow) => r.get('repSlug') === repSlug);

      const serializeNullable = (val: boolean | null | undefined): string => {
        if (val === null || val === undefined) return 'null';
        return String(val);
      };

      const rowData: Record<string, string> = {
        repSlug,
        repName: settings.repName || existingRow?.get('repName') || '',
        updatedAt: new Date().toISOString(),
        updatedBy: settings.updatedBy || 'admin',
      };
      for (const key of PORTAL_SETTING_KEYS) {
        rowData[key] = serializeNullable(settings[key as keyof Partial<RepPortalSettings>] as boolean | null | undefined);
      }

      if (existingRow) {
        Object.entries(rowData).forEach(([key, value]) => {
          existingRow.set(key, value);
        });
        await existingRow.save();
      } else {
        await sheet.addRow(rowData);
      }
    } catch (error) {
      console.error('Error saving rep portal settings:', error);
      throw error;
    }
  }

  // Get effective settings for a rep (global merged with rep overrides) - 2-tier cascade
  async getEffectiveSettings(repSlug: string): Promise<PortalSettings> {
    if (!this.globalSettingsLoaded) {
      await this.loadGlobalSettings();
    }

    const global = this.getGlobalSettings();
    const repSettings = await this.getRepSettings(repSlug);

    if (!repSettings) return global;

    // Merge: rep override takes precedence, null means inherit from global
    const effective: PortalSettings = { ...global };
    for (const key of PORTAL_SETTING_KEYS) {
      const repValue = repSettings[key];
      if (repValue !== null && repValue !== undefined) {
        effective[key] = repValue as boolean;
      }
    }

    return effective;
  }

  // 3-TIER CASCADE: Admin → Rep → Per-Customer
  // For each setting:
  //   1. If admin global = OFF → result = OFF (admin wins, can't be overridden)
  //   2. If admin global = ON, check rep setting
  //   3. If rep allows, check per-customer override
  //   4. Customer null → inherit from rep effective (which defaults OFF)
  async getEffectiveCustomerSettings(repSlug: string, customerId: string): Promise<PortalSettings> {
    // Get the 2-tier result (admin + rep)
    const repEffective = await this.getEffectiveSettings(repSlug);

    // Fetch per-customer overrides
    const custOverride = await this.getCustomerSettings(customerId);
    if (!custOverride) return repEffective;

    // Apply customer-level overrides on top of rep-effective
    const effective: PortalSettings = { ...repEffective };
    for (const key of PORTAL_SETTING_KEYS) {
      // Admin already baked in via repEffective - if OFF, stays OFF
      if (!repEffective[key]) {
        effective[key] = false;
        continue;
      }
      // Rep allows it; check customer override
      const custValue = custOverride[key];
      if (custValue !== null && custValue !== undefined) {
        effective[key] = custValue as boolean;
      }
      // else: inherit from repEffective (already set)
    }

    return effective;
  }

  // Get per-customer settings overrides from Google Sheets
  async getCustomerSettings(customerId: string): Promise<CustomerSettingsOverride | null> {
    try {
      const ready = await googleSheetsService.init();
      if (!ready) return null;

      const doc = (googleSheetsService as unknown as SheetsServiceWithDoc).doc;
      if (!doc) return null;

      const sheet = doc.sheetsByTitle['Portal_Customer_Settings'];
      if (!sheet) return null;

      const rows = await sheet.getRows({ limit: 100000 });
      const row = rows.find((r: SheetRow) => r.get('customerId') === customerId);
      if (!row) return null;

      const result: Record<string, string | boolean | null | undefined> = {
        customerId: row.get('customerId'),
        repSlug: row.get('repSlug'),
        updatedAt: row.get('updatedAt') || '',
        updatedBy: row.get('updatedBy') || '',
      };
      for (const key of PORTAL_SETTING_KEYS) {
        result[key] = this.parseNullableBoolean(row.get(key));
      }
      return result as unknown as CustomerSettingsOverride;
    } catch (error) {
      console.error('Error getting customer portal settings:', error);
      return null;
    }
  }

  // Save per-customer settings overrides
  async saveCustomerSettings(customerId: string, repSlug: string, settings: Partial<CustomerSettingsOverride>, updatedBy?: string): Promise<void> {
    try {
      const ready = await googleSheetsService.init();
      if (!ready) throw new Error('Google Sheets not initialized');

      const doc = (googleSheetsService as unknown as SheetsServiceWithDoc).doc;
      if (!doc) throw new Error('Google Sheets doc not available');

      const headers = [
        'customerId', 'repSlug',
        ...PORTAL_SETTING_KEYS,
        'updatedAt', 'updatedBy'
      ];

      let sheet = doc.sheetsByTitle['Portal_Customer_Settings'];
      if (!sheet) {
        sheet = await doc.addSheet({ title: 'Portal_Customer_Settings', headerValues: headers });
      }

      const rows = await sheet.getRows({ limit: 100000 });
      const existingRow = rows.find((r: SheetRow) => r.get('customerId') === customerId);

      const serializeNullable = (val: boolean | null | undefined): string => {
        if (val === null || val === undefined) return 'null';
        return String(val);
      };

      const rowData: Record<string, string> = {
        customerId,
        repSlug,
        updatedAt: new Date().toISOString(),
        updatedBy: updatedBy || 'rep',
      };
      for (const key of PORTAL_SETTING_KEYS) {
        rowData[key] = serializeNullable(settings[key as keyof Partial<CustomerSettingsOverride>] as boolean | null | undefined);
      }

      if (existingRow) {
        Object.entries(rowData).forEach(([key, value]) => {
          existingRow.set(key, value);
        });
        await existingRow.save();
      } else {
        await sheet.addRow(rowData);
      }
    } catch (error) {
      console.error('Error saving customer portal settings:', error);
      throw error;
    }
  }

  // Get all customer settings for a specific rep
  async getCustomerSettingsForRep(repSlug: string): Promise<CustomerSettingsOverride[]> {
    try {
      const ready = await googleSheetsService.init();
      if (!ready) return [];

      const doc = (googleSheetsService as unknown as SheetsServiceWithDoc).doc;
      if (!doc) return [];

      const sheet = doc.sheetsByTitle['Portal_Customer_Settings'];
      if (!sheet) return [];

      const rows = await sheet.getRows({ limit: 100000 });
      return rows
        .filter((r: SheetRow) => r.get('repSlug') === repSlug)
        .map((row: SheetRow) => {
          const result: Record<string, string | boolean | null | undefined> = {
            customerId: row.get('customerId'),
            repSlug: row.get('repSlug'),
            updatedAt: row.get('updatedAt') || '',
            updatedBy: row.get('updatedBy') || '',
          };
          for (const key of PORTAL_SETTING_KEYS) {
            result[key] = this.parseNullableBoolean(row.get(key));
          }
          return result as unknown as CustomerSettingsOverride;
        });
    } catch (error) {
      console.error('Error getting customer settings for rep:', error);
      return [];
    }
  }

  // Parse a nullable boolean from a string
  private parseNullableBoolean(value: string | undefined | null): boolean | null {
    if (!value || value === 'null' || value === '') return null;
    return value === 'true';
  }

  // Job status phases
  getJobPhases() {
    return [
      { id: 'lead', label: 'Lead', progress: 0 },
      { id: 'inspection', label: 'Inspection Scheduled', progress: 10 },
      { id: 'estimate', label: 'Estimate Provided', progress: 20 },
      { id: 'contract', label: 'Contract Signed', progress: 30 },
      { id: 'permit', label: 'Permit Approved', progress: 40 },
      { id: 'materials', label: 'Materials Ordered', progress: 50 },
      { id: 'scheduled', label: 'Install Scheduled', progress: 60 },
      { id: 'in_progress', label: 'Installation In Progress', progress: 75 },
      { id: 'quality_check', label: 'Quality Check', progress: 90 },
      { id: 'complete', label: 'Project Complete', progress: 100 },
    ];
  }
}

export const customerPortalService = new CustomerPortalService();
