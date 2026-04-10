/**
 * RCRS Roof Inspection Service
 *
 * Manages inspection templates, field inspections, and report generation.
 * Supports multiple template types: Standard, Storm Damage, Pre/Post-Installation, Insurance.
 *
 * Templates are still stored in data/inspection-templates.json (config-like,
 * rarely edited). Inspection reports are persisted to the master Google Sheet
 * on the `Inspections` tab via googleSheetsService. The local
 * data/inspections.json file is now a deprecated dev seed and is NOT written
 * by this service anymore.
 *
 * @author RCRS Development Team
 * @version 2.0.0
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { googleSheetsService, SHEET_NAMES } from './google-sheets-service';

// =============================================================================
// TYPES
// =============================================================================

export interface InspectionTemplate {
  id: string;
  name: string;
  description: string;
  sections: InspectionSection[];
  estimatedMinutes: number;
  createdBy: string;
  isDefault: boolean;
  createdAt: string;
}

export interface InspectionSection {
  id: string;
  name: string;
  order: number;
  items: InspectionItem[];
}

export interface InspectionItem {
  id: string;
  label: string;
  type: 'checkbox' | 'rating' | 'text' | 'photo' | 'measurement' | 'select';
  required: boolean;
  options?: string[];
  helpText?: string;
  order: number;
}

export interface InspectionReport {
  id: string;
  templateId: string;
  templateName: string;
  customerId: string;
  customerName: string;
  address: string;
  jobId?: string;
  leadId?: string;
  inspectorId: string;
  inspectorName: string;

  status: 'draft' | 'in_progress' | 'completed' | 'approved' | 'shared';
  startedAt: string;
  completedAt?: string;

  responses: InspectionResponse[];
  photos: InspectionPhoto[];

  overallCondition: 'excellent' | 'good' | 'fair' | 'poor' | 'critical';
  summary: string;
  recommendations: string[];
  estimatedRepairCost?: number;
  urgencyLevel: 'none' | 'routine' | 'soon' | 'urgent' | 'emergency';

  shareToken?: string;
  sharedAt?: string;

  createdAt: string;
  updatedAt: string;
}

export interface InspectionResponse {
  itemId: string;
  sectionId: string;
  value: string | boolean | number;
  notes?: string;
  photoUrls?: string[];
}

export interface InspectionPhoto {
  url: string;
  caption: string;
  sectionId: string;
  uploadedAt: string;
}

export interface InspectionStats {
  totalInspections: number;
  thisMonth: number;
  pendingCompletion: number;
  sharedWithCustomers: number;
  byCondition: Record<string, number>;
  byTemplate: Record<string, number>;
  byUrgency: Record<string, number>;
  averageCompletionMinutes: number;
}

// =============================================================================
// DATA TYPES
// =============================================================================

interface TemplateData {
  templates: InspectionTemplate[];
}

// =============================================================================
// SHEET CONFIG
// =============================================================================

// Canonical column order for the Inspections tab. Do NOT reorder — the sheet
// already has rows keyed off these column names.
const INSPECTION_HEADERS: string[] = [
  'id',
  'templateId',
  'templateName',
  'customerId',
  'customerName',
  'address',
  'jobId',
  'leadId',
  'inspectorId',
  'inspectorName',
  'status',
  'startedAt',
  'completedAt',
  'responses',
  'photos',
  'overallCondition',
  'summary',
  'recommendations',
  'estimatedRepairCost',
  'urgencyLevel',
  'shareToken',
  'sharedAt',
  'createdAt',
  'updatedAt',
];

// =============================================================================
// DATA HELPERS
// =============================================================================

const TEMPLATES_FILE = path.join(process.cwd(), 'data', 'inspection-templates.json');

function readTemplates(): TemplateData {
  try {
    if (fs.existsSync(TEMPLATES_FILE)) {
      const content = fs.readFileSync(TEMPLATES_FILE, 'utf-8');
      return JSON.parse(content);
    }
  } catch (error) {
    console.error('[InspectionService] Error reading templates:', error);
  }
  return { templates: [] };
}

function writeTemplates(data: TemplateData): void {
  // Inspection templates are static config that ships with the build. Writing
  // them in production is best-effort: Vercel's filesystem is read-only, so
  // we log and swallow rather than 500-ing the request.
  try {
    const dir = path.dirname(TEMPLATES_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(TEMPLATES_FILE, JSON.stringify(data, null, 2));
  } catch (error) {
    console.warn('[InspectionService] Local templates write skipped (read-only fs?):', error);
  }
}

function generateId(prefix: string): string {
  return `${prefix}-${crypto.randomBytes(6).toString('hex')}`;
}

/** Parse a sheet row (all strings) back into a typed InspectionReport. */
function rowToInspection(row: Record<string, string>): InspectionReport {
  const parseJson = <T,>(raw: string, fallback: T): T => {
    if (!raw) return fallback;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return fallback;
    }
  };

  const inspection: InspectionReport = {
    id: row.id || '',
    templateId: row.templateId || '',
    templateName: row.templateName || '',
    customerId: row.customerId || '',
    customerName: row.customerName || '',
    address: row.address || '',
    jobId: row.jobId || undefined,
    leadId: row.leadId || undefined,
    inspectorId: row.inspectorId || '',
    inspectorName: row.inspectorName || '',
    status: (row.status || 'draft') as InspectionReport['status'],
    startedAt: row.startedAt || '',
    completedAt: row.completedAt || undefined,
    responses: parseJson<InspectionResponse[]>(row.responses, []),
    photos: parseJson<InspectionPhoto[]>(row.photos, []),
    overallCondition: (row.overallCondition || 'good') as InspectionReport['overallCondition'],
    summary: row.summary || '',
    recommendations: parseJson<string[]>(row.recommendations, []),
    estimatedRepairCost:
      row.estimatedRepairCost !== '' && row.estimatedRepairCost !== undefined
        ? Number(row.estimatedRepairCost)
        : undefined,
    urgencyLevel: (row.urgencyLevel || 'none') as InspectionReport['urgencyLevel'],
    shareToken: row.shareToken || undefined,
    sharedAt: row.sharedAt || undefined,
    createdAt: row.createdAt || '',
    updatedAt: row.updatedAt || '',
  };

  return inspection;
}

/** Flatten an InspectionReport into sheet-friendly scalar columns. */
function inspectionToRow(inspection: InspectionReport): Record<string, unknown> {
  return {
    id: inspection.id,
    templateId: inspection.templateId,
    templateName: inspection.templateName,
    customerId: inspection.customerId,
    customerName: inspection.customerName,
    address: inspection.address,
    jobId: inspection.jobId || '',
    leadId: inspection.leadId || '',
    inspectorId: inspection.inspectorId,
    inspectorName: inspection.inspectorName,
    status: inspection.status,
    startedAt: inspection.startedAt,
    completedAt: inspection.completedAt || '',
    responses: JSON.stringify(inspection.responses || []),
    photos: JSON.stringify(inspection.photos || []),
    overallCondition: inspection.overallCondition,
    summary: inspection.summary,
    recommendations: JSON.stringify(inspection.recommendations || []),
    estimatedRepairCost:
      inspection.estimatedRepairCost !== undefined ? inspection.estimatedRepairCost : '',
    urgencyLevel: inspection.urgencyLevel,
    shareToken: inspection.shareToken || '',
    sharedAt: inspection.sharedAt || '',
    createdAt: inspection.createdAt,
    updatedAt: inspection.updatedAt,
  };
}

// =============================================================================
// SERVICE CLASS
// =============================================================================

class InspectionService {
  // 60-second cache so we don't hammer the Sheets API for read-heavy endpoints.
  private cache: InspectionReport[] | null = null;
  private cacheExpiresAt = 0;

  private invalidateCache(): void {
    this.cache = null;
    this.cacheExpiresAt = 0;
  }

  private async loadFromSheet(): Promise<InspectionReport[]> {
    try {
      const rows = await googleSheetsService.getGenericRows(
        SHEET_NAMES.INSPECTIONS,
        INSPECTION_HEADERS,
      );
      return rows.filter((r) => r.id).map(rowToInspection);
    } catch (error) {
      console.error('[InspectionService] Error loading inspections from sheet:', error);
      return [];
    }
  }

  private async loadCached(): Promise<InspectionReport[]> {
    if (this.cache && Date.now() < this.cacheExpiresAt) return this.cache;
    this.cache = await this.loadFromSheet();
    this.cacheExpiresAt = Date.now() + 60_000;
    return this.cache;
  }

  private async persistInspection(inspection: InspectionReport): Promise<void> {
    await googleSheetsService.upsertGenericRow(
      SHEET_NAMES.INSPECTIONS,
      INSPECTION_HEADERS,
      'id',
      inspectionToRow(inspection),
    );
    this.invalidateCache();
  }

  // ---------------------------------------------------------------------------
  // Template Methods (still JSON-backed; templates are config-like)
  // ---------------------------------------------------------------------------

  /**
   * Get all available inspection templates.
   */
  getTemplates(): InspectionTemplate[] {
    const data = readTemplates();
    return data.templates;
  }

  /**
   * Get a single template by ID.
   */
  getTemplate(id: string): InspectionTemplate | null {
    const data = readTemplates();
    return data.templates.find((t) => t.id === id) || null;
  }

  /**
   * Create a new custom inspection template.
   */
  createTemplate(input: {
    name: string;
    description: string;
    sections: InspectionSection[];
    estimatedMinutes: number;
    createdBy: string;
  }): InspectionTemplate {
    const data = readTemplates();

    const template: InspectionTemplate = {
      id: generateId('tmpl'),
      name: input.name,
      description: input.description,
      sections: input.sections.map((section, sIdx) => ({
        ...section,
        id: section.id || generateId('sec'),
        order: section.order ?? sIdx + 1,
        items: section.items.map((item, iIdx) => ({
          ...item,
          id: item.id || generateId('item'),
          order: item.order ?? iIdx + 1,
        })),
      })),
      estimatedMinutes: input.estimatedMinutes,
      createdBy: input.createdBy,
      isDefault: false,
      createdAt: new Date().toISOString(),
    };

    data.templates.push(template);
    writeTemplates(data);

    return template;
  }

  // ---------------------------------------------------------------------------
  // Inspection CRUD (sheet-backed)
  // ---------------------------------------------------------------------------

  /**
   * Start a new inspection from a template.
   */
  async startInspection(input: {
    templateId: string;
    customerId: string;
    customerName: string;
    address: string;
    inspectorId: string;
    inspectorName: string;
    jobId?: string;
    leadId?: string;
  }): Promise<InspectionReport> {
    const template = this.getTemplate(input.templateId);
    if (!template) {
      throw new Error(`Template not found: ${input.templateId}`);
    }

    const now = new Date().toISOString();
    const inspection: InspectionReport = {
      id: generateId('insp'),
      templateId: template.id,
      templateName: template.name,
      customerId: input.customerId,
      customerName: input.customerName,
      address: input.address,
      jobId: input.jobId,
      leadId: input.leadId,
      inspectorId: input.inspectorId,
      inspectorName: input.inspectorName,
      status: 'in_progress',
      startedAt: now,
      responses: [],
      photos: [],
      overallCondition: 'good',
      summary: '',
      recommendations: [],
      urgencyLevel: 'none',
      createdAt: now,
      updatedAt: now,
    };

    await this.persistInspection(inspection);
    return inspection;
  }

  /**
   * Update an in-progress inspection with new responses, photos, or metadata.
   */
  async updateInspection(
    id: string,
    updates: {
      responses?: InspectionResponse[];
      photos?: InspectionPhoto[];
      overallCondition?: InspectionReport['overallCondition'];
      summary?: string;
      recommendations?: string[];
      estimatedRepairCost?: number;
      urgencyLevel?: InspectionReport['urgencyLevel'];
      jobId?: string;
      leadId?: string;
    }
  ): Promise<InspectionReport> {
    const inspection = await this.getInspection(id);
    if (!inspection) {
      throw new Error(`Inspection not found: ${id}`);
    }

    // Merge responses — replace existing by itemId, add new ones
    if (updates.responses) {
      for (const resp of updates.responses) {
        const existingIdx = inspection.responses.findIndex(
          (r) => r.itemId === resp.itemId
        );
        if (existingIdx >= 0) {
          inspection.responses[existingIdx] = resp;
        } else {
          inspection.responses.push(resp);
        }
      }
    }

    // Merge photos — append new
    if (updates.photos) {
      inspection.photos.push(...updates.photos);
    }

    // Apply scalar updates
    if (updates.overallCondition !== undefined) {
      inspection.overallCondition = updates.overallCondition;
    }
    if (updates.summary !== undefined) {
      inspection.summary = updates.summary;
    }
    if (updates.recommendations !== undefined) {
      inspection.recommendations = updates.recommendations;
    }
    if (updates.estimatedRepairCost !== undefined) {
      inspection.estimatedRepairCost = updates.estimatedRepairCost;
    }
    if (updates.urgencyLevel !== undefined) {
      inspection.urgencyLevel = updates.urgencyLevel;
    }
    if (updates.jobId !== undefined) {
      inspection.jobId = updates.jobId;
    }
    if (updates.leadId !== undefined) {
      inspection.leadId = updates.leadId;
    }

    inspection.updatedAt = new Date().toISOString();
    await this.persistInspection(inspection);

    return inspection;
  }

  /**
   * Complete an inspection with summary and recommendations.
   */
  async completeInspection(
    id: string,
    completion: {
      summary: string;
      recommendations: string[];
      overallCondition: InspectionReport['overallCondition'];
      urgencyLevel: InspectionReport['urgencyLevel'];
      estimatedRepairCost?: number;
    }
  ): Promise<InspectionReport> {
    const inspection = await this.getInspection(id);
    if (!inspection) {
      throw new Error(`Inspection not found: ${id}`);
    }

    inspection.status = 'completed';
    inspection.completedAt = new Date().toISOString();
    inspection.summary = completion.summary;
    inspection.recommendations = completion.recommendations;
    inspection.overallCondition = completion.overallCondition;
    inspection.urgencyLevel = completion.urgencyLevel;
    if (completion.estimatedRepairCost !== undefined) {
      inspection.estimatedRepairCost = completion.estimatedRepairCost;
    }
    inspection.updatedAt = new Date().toISOString();

    await this.persistInspection(inspection);

    return inspection;
  }

  /**
   * Get a single inspection by ID.
   */
  async getInspection(id: string): Promise<InspectionReport | null> {
    const inspections = await this.loadCached();
    return inspections.find((i) => i.id === id) || null;
  }

  /**
   * Get all inspections for a customer.
   */
  async getInspectionsByCustomer(customerId: string): Promise<InspectionReport[]> {
    const inspections = await this.loadCached();
    return inspections
      .filter((i) => i.customerId === customerId)
      .sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
  }

  /**
   * Get recent inspections with optional limit.
   */
  async getRecentInspections(limit: number = 20): Promise<InspectionReport[]> {
    const inspections = await this.loadCached();
    return [...inspections]
      .sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      )
      .slice(0, limit);
  }

  /**
   * List inspections with optional filters.
   */
  async listInspections(filters?: {
    customerId?: string;
    inspectorId?: string;
    status?: string;
    templateId?: string;
    limit?: number;
  }): Promise<InspectionReport[]> {
    const inspections = await this.loadCached();
    let results = [...inspections];

    if (filters?.customerId) {
      results = results.filter((i) => i.customerId === filters.customerId);
    }
    if (filters?.inspectorId) {
      results = results.filter((i) => i.inspectorId === filters.inspectorId);
    }
    if (filters?.status) {
      results = results.filter((i) => i.status === filters.status);
    }
    if (filters?.templateId) {
      results = results.filter((i) => i.templateId === filters.templateId);
    }

    // Sort newest first
    results.sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    if (filters?.limit) {
      results = results.slice(0, filters.limit);
    }

    return results;
  }

  /**
   * Delete a draft inspection.
   */
  async deleteInspection(id: string): Promise<boolean> {
    const inspection = await this.getInspection(id);
    if (!inspection) return false;

    if (inspection.status !== 'draft' && inspection.status !== 'in_progress') {
      throw new Error('Only draft or in-progress inspections can be deleted');
    }

    const removed = await googleSheetsService.deleteGenericRow(
      SHEET_NAMES.INSPECTIONS,
      'id',
      id,
    );
    this.invalidateCache();
    return removed;
  }

  /**
   * Generate a shareable link for an inspection.
   */
  async shareInspection(id: string): Promise<{ shareUrl: string; token: string }> {
    const inspection = await this.getInspection(id);
    if (!inspection) {
      throw new Error(`Inspection not found: ${id}`);
    }

    if (inspection.status !== 'completed' && inspection.status !== 'approved') {
      throw new Error('Only completed or approved inspections can be shared');
    }

    const token = crypto.randomBytes(16).toString('hex');
    inspection.shareToken = token;
    inspection.sharedAt = new Date().toISOString();
    inspection.status = 'shared';
    inspection.updatedAt = new Date().toISOString();

    await this.persistInspection(inspection);

    const baseUrl =
      process.env.NEXT_PUBLIC_BASE_URL ||
      'https://www.rivercityroofingsolutions.com';
    const shareUrl = `${baseUrl}/inspection-report/${token}`;

    return { shareUrl, token };
  }

  /**
   * Look up an inspection by share token.
   */
  async getInspectionByToken(token: string): Promise<InspectionReport | null> {
    const inspections = await this.loadCached();
    return inspections.find((i) => i.shareToken === token) || null;
  }

  /**
   * Compute inspection statistics.
   */
  async getInspectionStats(): Promise<InspectionStats> {
    const inspections = await this.loadCached();

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const thisMonth = inspections.filter(
      (i) => new Date(i.createdAt) >= startOfMonth
    ).length;

    const pendingCompletion = inspections.filter(
      (i) => i.status === 'in_progress' || i.status === 'draft'
    ).length;

    const sharedWithCustomers = inspections.filter(
      (i) => i.status === 'shared'
    ).length;

    // Condition breakdown
    const byCondition: Record<string, number> = {};
    const completedInspections = inspections.filter(
      (i) =>
        i.status === 'completed' ||
        i.status === 'approved' ||
        i.status === 'shared'
    );
    for (const i of completedInspections) {
      byCondition[i.overallCondition] =
        (byCondition[i.overallCondition] || 0) + 1;
    }

    // Template breakdown
    const byTemplate: Record<string, number> = {};
    for (const i of inspections) {
      byTemplate[i.templateName] = (byTemplate[i.templateName] || 0) + 1;
    }

    // Urgency breakdown
    const byUrgency: Record<string, number> = {};
    for (const i of completedInspections) {
      byUrgency[i.urgencyLevel] = (byUrgency[i.urgencyLevel] || 0) + 1;
    }

    // Average completion time in minutes
    let totalMinutes = 0;
    let completedCount = 0;
    for (const i of completedInspections) {
      if (i.completedAt && i.startedAt) {
        const start = new Date(i.startedAt).getTime();
        const end = new Date(i.completedAt).getTime();
        const minutes = (end - start) / (1000 * 60);
        if (minutes > 0 && minutes < 600) {
          // Sanity check: under 10 hours
          totalMinutes += minutes;
          completedCount++;
        }
      }
    }

    return {
      totalInspections: inspections.length,
      thisMonth,
      pendingCompletion,
      sharedWithCustomers,
      byCondition,
      byTemplate,
      byUrgency,
      averageCompletionMinutes:
        completedCount > 0 ? Math.round(totalMinutes / completedCount) : 0,
    };
  }

  /**
   * Calculate completion percentage for an in-progress inspection.
   */
  getCompletionPercent(inspection: InspectionReport): number {
    const template = this.getTemplate(inspection.templateId);
    if (!template) return 0;

    let totalRequired = 0;
    let completedRequired = 0;

    for (const section of template.sections) {
      for (const item of section.items) {
        if (item.required) {
          totalRequired++;
          const hasResponse = inspection.responses.some(
            (r) => r.itemId === item.id && r.value !== '' && r.value !== null
          );
          if (hasResponse) completedRequired++;
        }
      }
    }

    if (totalRequired === 0) return 100;
    return Math.round((completedRequired / totalRequired) * 100);
  }
}

// =============================================================================
// SINGLETON EXPORT
// =============================================================================

export const inspectionService = new InspectionService();
