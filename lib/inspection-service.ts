/**
 * RCRS Roof Inspection Service
 *
 * Manages inspection templates, field inspections, and report generation.
 * Supports multiple template types: Standard, Storm Damage, Pre/Post-Installation, Insurance.
 *
 * Data stored in data/inspection-templates.json and data/inspections.json
 *
 * @author RCRS Development Team
 * @version 1.0.0
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

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

interface InspectionData {
  inspections: InspectionReport[];
}

// =============================================================================
// DATA HELPERS
// =============================================================================

const TEMPLATES_FILE = path.join(process.cwd(), 'data', 'inspection-templates.json');
const INSPECTIONS_FILE = path.join(process.cwd(), 'data', 'inspections.json');

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
  try {
    const dir = path.dirname(TEMPLATES_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(TEMPLATES_FILE, JSON.stringify(data, null, 2));
  } catch (error) {
    console.error('[InspectionService] Error writing templates:', error);
    throw error;
  }
}

function readInspections(): InspectionData {
  try {
    if (fs.existsSync(INSPECTIONS_FILE)) {
      const content = fs.readFileSync(INSPECTIONS_FILE, 'utf-8');
      return JSON.parse(content);
    }
  } catch (error) {
    console.error('[InspectionService] Error reading inspections:', error);
  }
  return { inspections: [] };
}

function writeInspections(data: InspectionData): void {
  try {
    const dir = path.dirname(INSPECTIONS_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(INSPECTIONS_FILE, JSON.stringify(data, null, 2));
  } catch (error) {
    console.error('[InspectionService] Error writing inspections:', error);
    throw error;
  }
}

function generateId(prefix: string): string {
  return `${prefix}-${crypto.randomBytes(6).toString('hex')}`;
}

// =============================================================================
// SERVICE CLASS
// =============================================================================

class InspectionService {
  // ---------------------------------------------------------------------------
  // Template Methods
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
  // Inspection CRUD
  // ---------------------------------------------------------------------------

  /**
   * Start a new inspection from a template.
   */
  startInspection(input: {
    templateId: string;
    customerId: string;
    customerName: string;
    address: string;
    inspectorId: string;
    inspectorName: string;
    jobId?: string;
    leadId?: string;
  }): InspectionReport {
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

    const data = readInspections();
    data.inspections.push(inspection);
    writeInspections(data);

    return inspection;
  }

  /**
   * Update an in-progress inspection with new responses, photos, or metadata.
   */
  updateInspection(
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
  ): InspectionReport {
    const data = readInspections();
    const index = data.inspections.findIndex((i) => i.id === id);
    if (index === -1) {
      throw new Error(`Inspection not found: ${id}`);
    }

    const inspection = data.inspections[index];

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
    data.inspections[index] = inspection;
    writeInspections(data);

    return inspection;
  }

  /**
   * Complete an inspection with summary and recommendations.
   */
  completeInspection(
    id: string,
    completion: {
      summary: string;
      recommendations: string[];
      overallCondition: InspectionReport['overallCondition'];
      urgencyLevel: InspectionReport['urgencyLevel'];
      estimatedRepairCost?: number;
    }
  ): InspectionReport {
    const data = readInspections();
    const index = data.inspections.findIndex((i) => i.id === id);
    if (index === -1) {
      throw new Error(`Inspection not found: ${id}`);
    }

    const inspection = data.inspections[index];
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

    data.inspections[index] = inspection;
    writeInspections(data);

    return inspection;
  }

  /**
   * Get a single inspection by ID.
   */
  getInspection(id: string): InspectionReport | null {
    const data = readInspections();
    return data.inspections.find((i) => i.id === id) || null;
  }

  /**
   * Get all inspections for a customer.
   */
  getInspectionsByCustomer(customerId: string): InspectionReport[] {
    const data = readInspections();
    return data.inspections
      .filter((i) => i.customerId === customerId)
      .sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
  }

  /**
   * Get recent inspections with optional limit.
   */
  getRecentInspections(limit: number = 20): InspectionReport[] {
    const data = readInspections();
    return data.inspections
      .sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      )
      .slice(0, limit);
  }

  /**
   * List inspections with optional filters.
   */
  listInspections(filters?: {
    customerId?: string;
    inspectorId?: string;
    status?: string;
    templateId?: string;
    limit?: number;
  }): InspectionReport[] {
    const data = readInspections();
    let results = data.inspections;

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
  deleteInspection(id: string): boolean {
    const data = readInspections();
    const index = data.inspections.findIndex((i) => i.id === id);
    if (index === -1) return false;

    const inspection = data.inspections[index];
    if (inspection.status !== 'draft' && inspection.status !== 'in_progress') {
      throw new Error('Only draft or in-progress inspections can be deleted');
    }

    data.inspections.splice(index, 1);
    writeInspections(data);
    return true;
  }

  /**
   * Generate a shareable link for an inspection.
   */
  shareInspection(id: string): { shareUrl: string; token: string } {
    const data = readInspections();
    const index = data.inspections.findIndex((i) => i.id === id);
    if (index === -1) {
      throw new Error(`Inspection not found: ${id}`);
    }

    const inspection = data.inspections[index];
    if (inspection.status !== 'completed' && inspection.status !== 'approved') {
      throw new Error('Only completed or approved inspections can be shared');
    }

    const token = crypto.randomBytes(16).toString('hex');
    inspection.shareToken = token;
    inspection.sharedAt = new Date().toISOString();
    inspection.status = 'shared';
    inspection.updatedAt = new Date().toISOString();

    data.inspections[index] = inspection;
    writeInspections(data);

    const baseUrl =
      process.env.NEXT_PUBLIC_BASE_URL ||
      'https://www.rivercityroofingsolutions.com';
    const shareUrl = `${baseUrl}/inspection-report/${token}`;

    return { shareUrl, token };
  }

  /**
   * Look up an inspection by share token.
   */
  getInspectionByToken(token: string): InspectionReport | null {
    const data = readInspections();
    return data.inspections.find((i) => i.shareToken === token) || null;
  }

  /**
   * Compute inspection statistics.
   */
  getInspectionStats(): InspectionStats {
    const data = readInspections();
    const inspections = data.inspections;

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
