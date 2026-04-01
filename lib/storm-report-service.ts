/**
 * Storm Report Service
 *
 * Generates comprehensive storm/hail damage risk reports for a given address.
 * Uses real NWS weather alerts & Iowa State Mesonet hail data via weather-service.
 * Stores generated reports in Google Sheets (Storm_Reports tab).
 * Reports can be linked to customer/lead records and shared via customer portal.
 */

import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';
import { weatherService, HailReport, WeatherAlert } from './weather-service';
import { hailReconService, HailReconEvent } from './hailrecon-service';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const SHEETS_ID = process.env.DELIVERY_SHEETS_ID || process.env.GOOGLE_SHEETS_ID;

const serviceAccountAuth = new JWT({
  email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
  key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type RiskLevel = 'Low' | 'Moderate' | 'High' | 'Severe';

export interface HailEvent {
  date: string;
  size: string;
  sizeNum: number;
  severity: 'minor' | 'moderate' | 'severe';
  distance: number;
  location: string;
  county: string;
  source: string;
  remarks: string;
}

export interface WindEvent {
  date: string;
  event: string;
  severity: string;
  description: string;
}

export interface StormReport {
  // Identifiers
  reportId: string;
  generatedAt: string;

  // Address details
  address: string;
  city: string;
  state: string;
  zip: string;
  fullAddress: string;

  // Search parameters
  dateRangeStart: string;
  dateRangeEnd: string;
  searchRadiusMiles: number;

  // Results
  hailEvents: HailEvent[];
  windEvents: WindEvent[];
  activeAlerts: WeatherAlert[];

  // Risk Assessment
  riskLevel: RiskLevel;
  riskScore: number; // 0-100
  riskFactors: string[];
  recommendation: string;

  // Metadata
  totalHailReports: number;
  closestHailMiles: number | null;
  largestHailSize: string | null;
  largestHailSizeNum: number;

  // HailRecon historical data
  hailReconEvents: HailReconEvent[];
  hailReconTotalStorms: number;
  hailReconLargestSize: number;
  hailReconLargestSizeLabel: string;
  hailReconDataRange: { start: string; end: string };

  // Linking
  leadId?: string;
  customerId?: string;
  sharedWithCustomer: boolean;
  sharedAt?: string;
  sharedBy?: string;
}

// ---------------------------------------------------------------------------
// Regional hail risk data for Alabama / Tennessee
// Based on historical NOAA Storm Prediction Center data
// ---------------------------------------------------------------------------

const REGIONAL_HAIL_RISK: Record<string, { baseRisk: number; avgEventsPerYear: number }> = {
  // Alabama - high hail corridor
  'AL': { baseRisk: 35, avgEventsPerYear: 8 },
  'huntsville': { baseRisk: 45, avgEventsPerYear: 12 },
  'madison': { baseRisk: 45, avgEventsPerYear: 12 },
  'decatur': { baseRisk: 42, avgEventsPerYear: 10 },
  'hartselle': { baseRisk: 42, avgEventsPerYear: 10 },
  'athens': { baseRisk: 40, avgEventsPerYear: 9 },
  'florence': { baseRisk: 38, avgEventsPerYear: 8 },
  'birmingham': { baseRisk: 40, avgEventsPerYear: 10 },
  'cullman': { baseRisk: 42, avgEventsPerYear: 10 },
  'albertville': { baseRisk: 38, avgEventsPerYear: 8 },
  'guntersville': { baseRisk: 38, avgEventsPerYear: 8 },
  'scottsboro': { baseRisk: 36, avgEventsPerYear: 7 },
  'moulton': { baseRisk: 38, avgEventsPerYear: 8 },
  // Tennessee
  'TN': { baseRisk: 32, avgEventsPerYear: 7 },
  'nashville': { baseRisk: 40, avgEventsPerYear: 10 },
  'chattanooga': { baseRisk: 35, avgEventsPerYear: 8 },
  'memphis': { baseRisk: 42, avgEventsPerYear: 11 },
};

// ---------------------------------------------------------------------------
// Storm Report Sheet Configuration
// ---------------------------------------------------------------------------

const STORM_REPORT_HEADERS = [
  'reportId',
  'generatedAt',
  'address',
  'city',
  'state',
  'zip',
  'fullAddress',
  'dateRangeStart',
  'dateRangeEnd',
  'searchRadiusMiles',
  'hailEventsJson',
  'windEventsJson',
  'activeAlertsJson',
  'riskLevel',
  'riskScore',
  'riskFactorsJson',
  'recommendation',
  'totalHailReports',
  'closestHailMiles',
  'largestHailSize',
  'largestHailSizeNum',
  'hailReconJson',
  'hailReconTotalStorms',
  'hailReconLargestSize',
  'hailReconLargestSizeLabel',
  'leadId',
  'customerId',
  'sharedWithCustomer',
  'sharedAt',
  'sharedBy',
];

// ---------------------------------------------------------------------------
// Service Implementation
// ---------------------------------------------------------------------------

class StormReportService {
  private doc: GoogleSpreadsheet | null = null;
  private initialized = false;

  private async getDoc(): Promise<GoogleSpreadsheet> {
    if (!this.doc) {
      if (!SHEETS_ID) {
        throw new Error('Google Sheets ID not configured');
      }
      this.doc = new GoogleSpreadsheet(SHEETS_ID, serviceAccountAuth);
    }
    if (!this.initialized) {
      await this.doc.loadInfo();
      this.initialized = true;
    }
    return this.doc;
  }

  private async getOrCreateSheet(name: string, headers: string[]) {
    const doc = await this.getDoc();
    let sheet = doc.sheetsByTitle[name];
    if (!sheet) {
      sheet = await doc.addSheet({ title: name, headerValues: headers, gridProperties: { columnCount: Math.max(headers.length + 5, 26) } });
    } else {
      // Ensure headers exist - fix for sheets created without headers
      try {
        await sheet.loadHeaderRow();
      } catch {
        if (sheet.gridProperties.columnCount < headers.length) {
          await sheet.resize({ rowCount: sheet.gridProperties.rowCount, columnCount: headers.length + 5 });
        }
        await sheet.setHeaderRow(headers);
      }
    }
    return sheet;
  }

  private generateReportId(): string {
    const date = new Date();
    const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
    const random = Math.random().toString(36).substring(2, 8).toUpperCase();
    return `SR-${dateStr}-${random}`;
  }

  // -------------------------------------------------------------------------
  // Generate a storm report for a given address
  // -------------------------------------------------------------------------

  async generateReport(params: {
    address: string;
    city: string;
    state: string;
    zip: string;
    daysBack?: number;
    radiusMiles?: number;
    leadId?: string;
    customerId?: string;
  }): Promise<StormReport> {
    const {
      address,
      city,
      state,
      zip,
      daysBack = 90,
      radiusMiles = 50,
      leadId,
      customerId,
    } = params;

    const fullAddress = `${address}, ${city}, ${state} ${zip}`;
    const now = new Date();
    const startDate = new Date(now.getTime() - daysBack * 24 * 60 * 60 * 1000);

    // Fetch real data in parallel from multiple sources
    const location = weatherService.geocodeZipCode(zip);
    const lat = location?.lat || 34.4434;
    const lon = location?.lon || -86.9353;

    const [hailReports, weatherData, windReports, spcOutlook, hailReconData] = await Promise.all([
      weatherService.getHailReportsByZip(zip, daysBack, radiusMiles).catch(() => [] as HailReport[]),
      weatherService.getWeatherByZip(zip).catch(() => null),
      weatherService.getWindReports(`${city}, ${state}`, daysBack, radiusMiles).catch(() => []),
      weatherService.getSpcOutlook(lat, lon).catch(() => ({ risk: 'NONE' as const, label: 'No Data', description: '' })),
      hailReconService.getPropertyHailHistory(fullAddress, lat, lon, radiusMiles).catch(() => null),
    ]);

    // Convert hail reports to HailEvent format
    const hailEvents: HailEvent[] = hailReports.map(r => ({
      date: r.date,
      size: r.hailSize,
      sizeNum: r.hailSizeNum,
      severity: r.severity,
      distance: r.distance,
      location: r.location,
      county: r.county,
      source: r.source,
      remarks: r.remarks,
    }));

    // Extract wind events from active alerts AND mesonet wind reports
    const windEvents: WindEvent[] = [];
    const activeAlerts: WeatherAlert[] = weatherData?.alerts || [];

    for (const alert of activeAlerts) {
      if (alert.type === 'wind' || alert.type === 'storm' || alert.type === 'tornado') {
        windEvents.push({
          date: alert.onset || alert.expires,
          event: alert.event,
          severity: alert.severity,
          description: alert.headline,
        });
      }
    }

    // Add wind reports from Iowa State Mesonet
    for (const wr of windReports) {
      windEvents.push({
        date: wr.date,
        event: `${wr.event} - ${wr.speed} mph`,
        severity: wr.speed >= 75 ? 'severe' : wr.speed >= 58 ? 'moderate' : 'minor',
        description: `${wr.speed} mph wind gust near ${wr.location} (${wr.distance} mi away)`,
      });
    }

    // Extract HailRecon events and metadata
    const hailReconEvents = hailReconData?.events || [];
    const hailReconTotalStorms = hailReconData?.totalStorms || 0;
    const hailReconLargestSize = hailReconData?.largestHailSize || 0;
    const hailReconLargestSizeLabel = hailReconData?.largestHailSizeLabel || 'None';
    const hailReconDataRange = hailReconData?.dataRange || { start: '2011-01-01', end: new Date().toISOString().slice(0, 10) };

    // Calculate risk assessment (includes SPC outlook data + HailRecon)
    const riskAssessment = this.calculateRiskAssessment(
      hailEvents,
      windEvents,
      activeAlerts,
      city,
      state,
      spcOutlook,
      hailReconData,
    );

    // Build report
    const report: StormReport = {
      reportId: this.generateReportId(),
      generatedAt: now.toISOString(),
      address,
      city,
      state,
      zip,
      fullAddress,
      dateRangeStart: startDate.toISOString().slice(0, 10),
      dateRangeEnd: now.toISOString().slice(0, 10),
      searchRadiusMiles: radiusMiles,
      hailEvents,
      windEvents,
      activeAlerts,
      riskLevel: riskAssessment.level,
      riskScore: riskAssessment.score,
      riskFactors: riskAssessment.factors,
      recommendation: riskAssessment.recommendation,
      totalHailReports: hailEvents.length,
      closestHailMiles: hailEvents.length > 0
        ? Math.min(...hailEvents.map(e => e.distance))
        : null,
      largestHailSize: hailEvents.length > 0
        ? hailEvents.reduce((max, e) => e.sizeNum > max.sizeNum ? e : max, hailEvents[0]).size
        : null,
      largestHailSizeNum: hailEvents.length > 0
        ? Math.max(...hailEvents.map(e => e.sizeNum))
        : 0,
      hailReconEvents,
      hailReconTotalStorms,
      hailReconLargestSize,
      hailReconLargestSizeLabel,
      hailReconDataRange,
      leadId,
      customerId,
      sharedWithCustomer: false,
    };

    // Store in Google Sheets
    try {
      await this.storeReport(report);
    } catch (error) {
      console.error('Failed to store storm report in Google Sheets:', error);
      // Report is still valid even if storage fails
    }

    return report;
  }

  // -------------------------------------------------------------------------
  // Risk Assessment Algorithm
  // -------------------------------------------------------------------------

  private calculateRiskAssessment(
    hailEvents: HailEvent[],
    windEvents: WindEvent[],
    activeAlerts: WeatherAlert[],
    city: string,
    state: string,
    spcOutlook?: { risk: string; label: string; description: string },
    hailReconData?: { totalStorms: number; largestHailSize: number; events: HailReconEvent[] } | null,
  ): {
    level: RiskLevel;
    score: number;
    factors: string[];
    recommendation: string;
  } {
    let score = 0;
    const factors: string[] = [];

    // 1. Regional base risk (Alabama & Tennessee are high hail risk states)
    const cityKey = city.toLowerCase();
    const regionalData = REGIONAL_HAIL_RISK[cityKey] || REGIONAL_HAIL_RISK[state] || { baseRisk: 25, avgEventsPerYear: 5 };
    score += regionalData.baseRisk * 0.3; // 30% weight for regional risk
    factors.push(`${city}, ${state} averages ${regionalData.avgEventsPerYear} hail events per year`);

    // 2. Recent hail activity
    if (hailEvents.length > 0) {
      const hailScore = Math.min(hailEvents.length * 8, 35); // Up to 35 points
      score += hailScore;

      // Proximity factor
      const closest = Math.min(...hailEvents.map(e => e.distance));
      if (closest < 5) {
        score += 15;
        factors.push(`Hail reported ${closest.toFixed(1)} miles from your address`);
      } else if (closest < 15) {
        score += 10;
        factors.push(`Hail reported within 15 miles of your address`);
      } else if (closest < 30) {
        score += 5;
        factors.push(`Hail reported within 30 miles of your area`);
      }

      // Size factor
      const maxSize = Math.max(...hailEvents.map(e => e.sizeNum));
      if (maxSize >= 1.75) {
        score += 15;
        factors.push(`Golf ball size or larger hail (${maxSize}") reported in your area`);
      } else if (maxSize >= 1.0) {
        score += 10;
        factors.push(`Quarter size or larger hail (${maxSize}") reported nearby`);
      } else if (maxSize > 0) {
        score += 5;
        factors.push(`Pea to marble size hail (${maxSize}") reported nearby`);
      }

      // Severity counts
      const severeCount = hailEvents.filter(e => e.severity === 'severe').length;
      const moderateCount = hailEvents.filter(e => e.severity === 'moderate').length;
      if (severeCount > 0) {
        factors.push(`${severeCount} severe hail event${severeCount > 1 ? 's' : ''} recorded`);
      }
      if (moderateCount > 0) {
        factors.push(`${moderateCount} moderate hail event${moderateCount > 1 ? 's' : ''} recorded`);
      }

      factors.push(`${hailEvents.length} total hail report${hailEvents.length > 1 ? 's' : ''} in the past 90 days`);
    } else {
      // No recent hail but still in a high-risk region
      factors.push('No hail reports in the past 90 days near your address');
    }

    // 3. Active weather alerts
    if (activeAlerts.length > 0) {
      const severeAlerts = activeAlerts.filter(a => a.severity === 'severe' || a.severity === 'extreme');
      const hailAlerts = activeAlerts.filter(a => a.isHailRelated);

      if (severeAlerts.length > 0) {
        score += 20;
        factors.push(`${severeAlerts.length} active severe weather alert${severeAlerts.length > 1 ? 's' : ''}`);
      }
      if (hailAlerts.length > 0) {
        score += 10;
        factors.push('Active hail-related weather alerts in your area');
      }
    }

    // 4. Wind events
    if (windEvents.length > 0) {
      score += Math.min(windEvents.length * 5, 10);
      factors.push(`${windEvents.length} wind/storm event${windEvents.length > 1 ? 's' : ''} in your area`);
    }

    // 5. SPC Convective Outlook (today's severe weather forecast)
    if (spcOutlook && spcOutlook.risk !== 'NONE') {
      const spcScores: Record<string, number> = {
        'HIGH': 25, 'MDT': 20, 'ENH': 15, 'SLGT': 10, 'MRGL': 5, 'TSTM': 2,
      };
      const spcScore = spcScores[spcOutlook.risk] || 0;
      if (spcScore > 0) {
        score += spcScore;
        factors.push(`SPC ${spcOutlook.label}: ${spcOutlook.description}`);
      }
    }

    // 6. HailRecon historical data (long-term history since 2011)
    if (hailReconData && hailReconData.totalStorms > 0) {
      const historicalScore = Math.min(hailReconData.totalStorms * 2, 15);
      score += historicalScore;
      factors.push(`${hailReconData.totalStorms} historical hail events since 2011 (HailRecon)`);

      if (hailReconData.largestHailSize >= 1.75) {
        score += 5;
        factors.push(`Historical golf ball+ size hail (${hailReconData.largestHailSize}") recorded by HailRecon`);
      }
    }

    // 7. Season factor (spring = higher risk in SE US)
    const month = new Date().getMonth();
    if (month >= 2 && month <= 5) {
      // March through June - peak hail season
      score += 5;
      factors.push('Current season is peak hail/storm season in the Southeast');
    } else if (month >= 6 && month <= 8) {
      // Summer storms
      score += 3;
      factors.push('Summer storm season can produce hail and wind damage');
    }

    // Clamp score
    score = Math.min(Math.round(score), 100);

    // Determine level
    let level: RiskLevel;
    if (score >= 70) {
      level = 'Severe';
    } else if (score >= 45) {
      level = 'High';
    } else if (score >= 25) {
      level = 'Moderate';
    } else {
      level = 'Low';
    }

    // Generate recommendation
    let recommendation: string;
    switch (level) {
      case 'Severe':
        recommendation = 'Your area has experienced significant recent storm activity. We strongly recommend a professional roof inspection as soon as possible. Hail and wind damage is often not visible from the ground and can lead to leaks and structural issues if left unaddressed. Contact us today for a free, no-obligation inspection.';
        break;
      case 'High':
        recommendation = 'Recent weather patterns indicate elevated risk for roof damage in your area. We recommend scheduling a professional inspection to check for hidden damage from hail or high winds. Many homeowners are surprised to find damage they cannot see from the ground. A free inspection can give you peace of mind.';
        break;
      case 'Moderate':
        recommendation = 'Your area has moderate storm activity. While there may not be immediate visible damage, periodic professional inspections are important to catch issues early. If your roof is over 10 years old, a check-up is especially worthwhile. We offer free inspections with no obligation.';
        break;
      default:
        recommendation = 'Your area shows lower recent storm activity, which is great news. However, roof wear from UV exposure, minor weather events, and aging materials can still cause issues over time. We recommend an inspection every 1-2 years to stay ahead of problems. Schedule your free inspection anytime.';
    }

    return { level, score, factors, recommendation };
  }

  // -------------------------------------------------------------------------
  // Google Sheets Storage
  // -------------------------------------------------------------------------

  private async storeReport(report: StormReport): Promise<void> {
    const sheet = await this.getOrCreateSheet('Storm_Reports', STORM_REPORT_HEADERS);

    await sheet.addRow({
      reportId: report.reportId,
      generatedAt: report.generatedAt,
      address: report.address,
      city: report.city,
      state: report.state,
      zip: report.zip,
      fullAddress: report.fullAddress,
      dateRangeStart: report.dateRangeStart,
      dateRangeEnd: report.dateRangeEnd,
      searchRadiusMiles: String(report.searchRadiusMiles),
      hailEventsJson: JSON.stringify(report.hailEvents),
      windEventsJson: JSON.stringify(report.windEvents),
      activeAlertsJson: JSON.stringify(report.activeAlerts),
      riskLevel: report.riskLevel,
      riskScore: String(report.riskScore),
      riskFactorsJson: JSON.stringify(report.riskFactors),
      recommendation: report.recommendation,
      totalHailReports: String(report.totalHailReports),
      closestHailMiles: report.closestHailMiles !== null ? String(report.closestHailMiles) : '',
      largestHailSize: report.largestHailSize || '',
      largestHailSizeNum: String(report.largestHailSizeNum),
      hailReconJson: JSON.stringify(report.hailReconEvents),
      hailReconTotalStorms: String(report.hailReconTotalStorms),
      hailReconLargestSize: String(report.hailReconLargestSize),
      hailReconLargestSizeLabel: report.hailReconLargestSizeLabel,
      leadId: report.leadId || '',
      customerId: report.customerId || '',
      sharedWithCustomer: String(report.sharedWithCustomer),
      sharedAt: report.sharedAt || '',
      sharedBy: report.sharedBy || '',
    });
  }

  // -------------------------------------------------------------------------
  // Fetch existing report
  // -------------------------------------------------------------------------

  async getReportById(reportId: string): Promise<StormReport | null> {
    try {
      const sheet = await this.getOrCreateSheet('Storm_Reports', STORM_REPORT_HEADERS);
      const rows = await sheet.getRows();
      const row = rows.find(r => r.get('reportId') === reportId);

      if (!row) return null;

      return this.rowToReport(row);
    } catch (error) {
      console.error('Error fetching storm report:', error);
      return null;
    }
  }

  async getReportByAddress(address: string, zip: string): Promise<StormReport | null> {
    try {
      const sheet = await this.getOrCreateSheet('Storm_Reports', STORM_REPORT_HEADERS);
      const rows = await sheet.getRows();

      // Find most recent report for this address/zip combo
      const matching = rows
        .filter(r => {
          const rowZip = r.get('zip');
          const rowAddress = r.get('address')?.toLowerCase() || '';
          return rowZip === zip && rowAddress.includes(address.toLowerCase().substring(0, 20));
        })
        .map(r => this.rowToReport(r))
        .sort((a, b) => new Date(b.generatedAt).getTime() - new Date(a.generatedAt).getTime());

      return matching.length > 0 ? matching[0] : null;
    } catch (error) {
      console.error('Error fetching storm report by address:', error);
      return null;
    }
  }

  async getReportsByLeadId(leadId: string): Promise<StormReport[]> {
    try {
      const sheet = await this.getOrCreateSheet('Storm_Reports', STORM_REPORT_HEADERS);
      const rows = await sheet.getRows();

      return rows
        .filter(r => r.get('leadId') === leadId)
        .map(r => this.rowToReport(r))
        .sort((a, b) => new Date(b.generatedAt).getTime() - new Date(a.generatedAt).getTime());
    } catch (error) {
      console.error('Error fetching storm reports by leadId:', error);
      return [];
    }
  }

  async getReportsByCustomerId(customerId: string): Promise<StormReport[]> {
    try {
      const sheet = await this.getOrCreateSheet('Storm_Reports', STORM_REPORT_HEADERS);
      const rows = await sheet.getRows();

      return rows
        .filter(r => r.get('customerId') === customerId)
        .map(r => this.rowToReport(r))
        .sort((a, b) => new Date(b.generatedAt).getTime() - new Date(a.generatedAt).getTime());
    } catch (error) {
      console.error('Error fetching storm reports by customerId:', error);
      return [];
    }
  }

  // -------------------------------------------------------------------------
  // Share report with customer
  // -------------------------------------------------------------------------

  async shareReport(reportId: string, sharedBy: string): Promise<boolean> {
    try {
      const sheet = await this.getOrCreateSheet('Storm_Reports', STORM_REPORT_HEADERS);
      const rows = await sheet.getRows();
      const row = rows.find(r => r.get('reportId') === reportId);

      if (!row) return false;

      row.set('sharedWithCustomer', 'true');
      row.set('sharedAt', new Date().toISOString());
      row.set('sharedBy', sharedBy);
      await row.save();

      return true;
    } catch (error) {
      console.error('Error sharing storm report:', error);
      return false;
    }
  }

  // -------------------------------------------------------------------------
  // Link report to lead
  // -------------------------------------------------------------------------

  async linkReportToLead(reportId: string, leadId: string, customerId?: string): Promise<boolean> {
    try {
      const sheet = await this.getOrCreateSheet('Storm_Reports', STORM_REPORT_HEADERS);
      const rows = await sheet.getRows();
      const row = rows.find(r => r.get('reportId') === reportId);

      if (!row) return false;

      row.set('leadId', leadId);
      if (customerId) {
        row.set('customerId', customerId);
      }
      await row.save();

      return true;
    } catch (error) {
      console.error('Error linking storm report to lead:', error);
      return false;
    }
  }

  // -------------------------------------------------------------------------
  // Get shared reports for customer portal
  // -------------------------------------------------------------------------

  async getSharedReportsForCustomer(customerId: string): Promise<StormReport[]> {
    try {
      const sheet = await this.getOrCreateSheet('Storm_Reports', STORM_REPORT_HEADERS);
      const rows = await sheet.getRows();

      return rows
        .filter(r =>
          r.get('customerId') === customerId &&
          r.get('sharedWithCustomer') === 'true'
        )
        .map(r => this.rowToReport(r))
        .sort((a, b) => new Date(b.generatedAt).getTime() - new Date(a.generatedAt).getTime());
    } catch (error) {
      console.error('Error fetching shared storm reports:', error);
      return [];
    }
  }

  // -------------------------------------------------------------------------
  // Row conversion helper
  // -------------------------------------------------------------------------

  private rowToReport(row: { get(key: string): string }): StormReport {
    return {
      reportId: row.get('reportId') || '',
      generatedAt: row.get('generatedAt') || '',
      address: row.get('address') || '',
      city: row.get('city') || '',
      state: row.get('state') || '',
      zip: row.get('zip') || '',
      fullAddress: row.get('fullAddress') || '',
      dateRangeStart: row.get('dateRangeStart') || '',
      dateRangeEnd: row.get('dateRangeEnd') || '',
      searchRadiusMiles: parseInt(row.get('searchRadiusMiles')) || 50,
      hailEvents: this.safeJsonParse(row.get('hailEventsJson'), []),
      windEvents: this.safeJsonParse(row.get('windEventsJson'), []),
      activeAlerts: this.safeJsonParse(row.get('activeAlertsJson'), []),
      riskLevel: (row.get('riskLevel') as RiskLevel) || 'Low',
      riskScore: parseInt(row.get('riskScore')) || 0,
      riskFactors: this.safeJsonParse(row.get('riskFactorsJson'), []),
      recommendation: row.get('recommendation') || '',
      totalHailReports: parseInt(row.get('totalHailReports')) || 0,
      closestHailMiles: row.get('closestHailMiles') ? parseFloat(row.get('closestHailMiles')) : null,
      largestHailSize: row.get('largestHailSize') || null,
      largestHailSizeNum: parseFloat(row.get('largestHailSizeNum')) || 0,
      hailReconEvents: this.safeJsonParse(row.get('hailReconJson'), []),
      hailReconTotalStorms: parseInt(row.get('hailReconTotalStorms')) || 0,
      hailReconLargestSize: parseFloat(row.get('hailReconLargestSize')) || 0,
      hailReconLargestSizeLabel: row.get('hailReconLargestSizeLabel') || 'None',
      hailReconDataRange: { start: '2011-01-01', end: new Date().toISOString().slice(0, 10) },
      leadId: row.get('leadId') || undefined,
      customerId: row.get('customerId') || undefined,
      sharedWithCustomer: row.get('sharedWithCustomer') === 'true',
      sharedAt: row.get('sharedAt') || undefined,
      sharedBy: row.get('sharedBy') || undefined,
    };
  }

  private safeJsonParse<T>(val: string, fallback: T): T {
    if (!val) return fallback;
    try {
      return JSON.parse(val);
    } catch {
      return fallback;
    }
  }
}

// ---------------------------------------------------------------------------
// Export singleton
// ---------------------------------------------------------------------------

export const stormReportService = new StormReportService();
