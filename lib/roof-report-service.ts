/**
 * Roof Report Service
 *
 * Manages roof measurement reports stored in Google Sheets (Roof_Reports tab).
 * Reports are auto-generated when leads are created and can be shared with homeowners.
 * Integrates with the /api/roof-measure endpoint for AI-powered satellite analysis.
 */

import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const SHEETS_ID = process.env.DELIVERY_SHEETS_ID || process.env.GOOGLE_SHEETS_ID;
const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://rivercityroofingsolutions.com';

const serviceAccountAuth = new JWT({
  email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
  key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RoofReportRecord {
  reportId: string;
  generatedAt: string;
  address: string;
  lat: number;
  lng: number;

  // Solar / area data
  totalRoofAreaSqFt: number;
  roofSquares: number;
  segmentCount: number;

  // Measurements
  primaryPitch: string;
  roofStyle: string;
  totalRidgeFt: number;
  totalRakeFt: number;
  totalValleyFt: number;
  totalEaveFt: number;
  totalHipFt: number;
  perimeterFt: number;
  overallConfidence: string;

  // Components (JSON)
  componentsJson: string;
  measurementsJson: string;

  // Images
  satelliteImageUrl: string;

  // Linking
  leadId?: string;
  customerId?: string;

  // Sharing
  shareToken: string;
  isPublic: boolean;
  sharedAt?: string;
  sharedBy?: string;

  // Full raw report (JSON)
  rawReportJson: string;
}

// ---------------------------------------------------------------------------
// Sheet Configuration
// ---------------------------------------------------------------------------

const ROOF_REPORT_HEADERS = [
  'reportId',
  'generatedAt',
  'address',
  'lat',
  'lng',
  'totalRoofAreaSqFt',
  'roofSquares',
  'segmentCount',
  'primaryPitch',
  'roofStyle',
  'totalRidgeFt',
  'totalRakeFt',
  'totalValleyFt',
  'totalEaveFt',
  'totalHipFt',
  'perimeterFt',
  'overallConfidence',
  'componentsJson',
  'measurementsJson',
  'satelliteImageUrl',
  'leadId',
  'customerId',
  'shareToken',
  'isPublic',
  'sharedAt',
  'sharedBy',
  'rawReportJson',
];

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

class RoofReportService {
  private doc: GoogleSpreadsheet | null = null;
  private initialized = false;

  private async getDoc(): Promise<GoogleSpreadsheet> {
    if (!this.doc) {
      if (!SHEETS_ID) throw new Error('Google Sheets ID not configured');
      this.doc = new GoogleSpreadsheet(SHEETS_ID, serviceAccountAuth);
    }
    if (!this.initialized) {
      await this.doc.loadInfo();
      this.initialized = true;
    }
    return this.doc;
  }

  private async getOrCreateSheet() {
    const doc = await this.getDoc();
    let sheet = doc.sheetsByTitle['Roof_Reports'];
    if (!sheet) {
      sheet = await doc.addSheet({
        title: 'Roof_Reports',
        headerValues: ROOF_REPORT_HEADERS,
        gridProperties: { columnCount: ROOF_REPORT_HEADERS.length + 5 },
      });
    } else {
      try { await sheet.loadHeaderRow(); } catch {
        if (sheet.gridProperties.columnCount < ROOF_REPORT_HEADERS.length) {
          await sheet.resize({ rowCount: sheet.gridProperties.rowCount, columnCount: ROOF_REPORT_HEADERS.length + 5 });
        }
        await sheet.setHeaderRow(ROOF_REPORT_HEADERS);
      }
    }
    return sheet;
  }

  private generateReportId(): string {
    const date = new Date();
    const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
    const random = Math.random().toString(36).substring(2, 8).toUpperCase();
    return `ROOF-${dateStr}-${random}`;
  }

  private generateShareToken(): string {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    let token = '';
    for (let i = 0; i < 12; i++) {
      token += chars[Math.floor(Math.random() * chars.length)];
    }
    return token;
  }

  /**
   * Generate a roof report by calling the roof-measure API and storing the result.
   */
  async generateReport(params: {
    address: string;
    leadId?: string;
    customerId?: string;
  }): Promise<RoofReportRecord> {
    const { address, leadId, customerId } = params;

    // Call the roof-measure API internally
    const measureUrl = `${BASE_URL}/api/roof-measure?address=${encodeURIComponent(address)}`;
    const response = await fetch(measureUrl);

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Roof measurement failed: ${errText.slice(0, 200)}`);
    }

    const data = await response.json();
    return this.storeReport(data, leadId, customerId);
  }

  /**
   * Store a roof measurement result as a report record.
   */
  async storeReport(
    data: any,
    leadId?: string,
    customerId?: string,
  ): Promise<RoofReportRecord> {
    const sheet = await this.getOrCreateSheet();
    const reportId = this.generateReportId();
    const shareToken = this.generateShareToken();

    const measurements = data.measurements || {};
    const solarData = data.solarData || {};
    const components = data.components || {};

    const record: RoofReportRecord = {
      reportId,
      generatedAt: data.generatedAt || new Date().toISOString(),
      address: data.address || '',
      lat: data.lat || 0,
      lng: data.lng || 0,
      totalRoofAreaSqFt: solarData.totalRoofAreaSqFt || 0,
      roofSquares: Math.round((solarData.totalRoofAreaSqFt || 0) / 100 * 10) / 10,
      segmentCount: solarData.segmentCount || 0,
      primaryPitch: measurements.pitches?.primary || 'Unknown',
      roofStyle: measurements.roofStyle || 'unknown',
      totalRidgeFt: measurements.ridges?.totalFt || 0,
      totalRakeFt: measurements.rakes?.totalFt || 0,
      totalValleyFt: measurements.valleys?.totalFt || 0,
      totalEaveFt: measurements.eaves?.totalFt || 0,
      totalHipFt: measurements.hips?.totalFt || 0,
      perimeterFt: measurements.perimeterFt || 0,
      overallConfidence: data.overallConfidence || 'LOW',
      componentsJson: JSON.stringify(components),
      measurementsJson: JSON.stringify(measurements),
      satelliteImageUrl: data.images?.satellite || '',
      leadId: leadId || '',
      customerId: customerId || '',
      shareToken,
      isPublic: false,
      rawReportJson: JSON.stringify(data),
    };

    await sheet.addRow(record as unknown as Record<string, string | number | boolean>);
    return record;
  }

  /**
   * Get all roof reports for a specific lead.
   */
  async getReportsByLeadId(leadId: string): Promise<RoofReportRecord[]> {
    const sheet = await this.getOrCreateSheet();
    const rows = await sheet.getRows();
    return rows
      .filter(r => r.get('leadId') === leadId)
      .map(r => this.rowToRecord(r))
      .sort((a, b) => new Date(b.generatedAt).getTime() - new Date(a.generatedAt).getTime());
  }

  /**
   * Get a roof report by its share token (for public sharing).
   */
  async getReportByShareToken(shareToken: string): Promise<RoofReportRecord | null> {
    const sheet = await this.getOrCreateSheet();
    const rows = await sheet.getRows();
    const row = rows.find(r => r.get('shareToken') === shareToken);
    if (!row) return null;
    return this.rowToRecord(row);
  }

  /**
   * Get a roof report by its ID.
   */
  async getReportById(reportId: string): Promise<RoofReportRecord | null> {
    const sheet = await this.getOrCreateSheet();
    const rows = await sheet.getRows();
    const row = rows.find(r => r.get('reportId') === reportId);
    if (!row) return null;
    return this.rowToRecord(row);
  }

  /**
   * Toggle public visibility of a report.
   */
  async togglePublic(reportId: string, isPublic: boolean, sharedBy?: string): Promise<boolean> {
    const sheet = await this.getOrCreateSheet();
    const rows = await sheet.getRows();
    const row = rows.find(r => r.get('reportId') === reportId);
    if (!row) return false;

    row.set('isPublic', isPublic ? 'true' : 'false');
    if (isPublic) {
      row.set('sharedAt', new Date().toISOString());
      if (sharedBy) row.set('sharedBy', sharedBy);
    }
    await row.save();
    return true;
  }

  /**
   * Get the shareable URL for a report.
   */
  getShareUrl(shareToken: string): string {
    return `${BASE_URL}/report/${shareToken}`;
  }

  private rowToRecord(row: any): RoofReportRecord {
    return {
      reportId: row.get('reportId') || '',
      generatedAt: row.get('generatedAt') || '',
      address: row.get('address') || '',
      lat: parseFloat(row.get('lat') || '0'),
      lng: parseFloat(row.get('lng') || '0'),
      totalRoofAreaSqFt: parseFloat(row.get('totalRoofAreaSqFt') || '0'),
      roofSquares: parseFloat(row.get('roofSquares') || '0'),
      segmentCount: parseInt(row.get('segmentCount') || '0'),
      primaryPitch: row.get('primaryPitch') || 'Unknown',
      roofStyle: row.get('roofStyle') || 'unknown',
      totalRidgeFt: parseFloat(row.get('totalRidgeFt') || '0'),
      totalRakeFt: parseFloat(row.get('totalRakeFt') || '0'),
      totalValleyFt: parseFloat(row.get('totalValleyFt') || '0'),
      totalEaveFt: parseFloat(row.get('totalEaveFt') || '0'),
      totalHipFt: parseFloat(row.get('totalHipFt') || '0'),
      perimeterFt: parseFloat(row.get('perimeterFt') || '0'),
      overallConfidence: row.get('overallConfidence') || 'LOW',
      componentsJson: row.get('componentsJson') || '{}',
      measurementsJson: row.get('measurementsJson') || '{}',
      satelliteImageUrl: row.get('satelliteImageUrl') || '',
      leadId: row.get('leadId') || '',
      customerId: row.get('customerId') || '',
      shareToken: row.get('shareToken') || '',
      isPublic: row.get('isPublic') === 'true',
      sharedAt: row.get('sharedAt') || undefined,
      sharedBy: row.get('sharedBy') || undefined,
      rawReportJson: row.get('rawReportJson') || '{}',
    };
  }
}

// ---------------------------------------------------------------------------
// Export singleton
// ---------------------------------------------------------------------------

export const roofReportService = new RoofReportService();
