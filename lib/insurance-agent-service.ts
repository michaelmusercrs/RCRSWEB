/**
 * Insurance Agent Database Service
 * 
 * Tracks local insurance agents for sales rep visits.
 * Rick's schedule filler: when not busy, auto-suggest agent visits based on location.
 * 
 * Persistence: Google Sheets
 */

import { GoogleSpreadsheet, GoogleSpreadsheetRow, GoogleSpreadsheetWorksheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';

const SHEETS_ID = process.env.DELIVERY_SHEETS_ID || process.env.GOOGLE_SHEETS_ID;
const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n')?.replace(/\r\n/g, '\n');
const serviceAuth = new JWT({
  email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
  key: privateKey,
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});
const SHEETS_CONFIGURED = !!(SHEETS_ID && process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL && privateKey);

const SHEET_TABS = {
  AGENTS: 'InsuranceAgents',
  VISITS: 'AgentVisits',
  ASSIGNMENTS: 'AgentAssignments',
};

// ============================================
// TYPES
// ============================================

export type InsuranceCompany =
  | 'State Farm' | 'Alfa Insurance' | 'Allstate' | 'Country Financial'
  | 'Howard Kilgore' | 'Farmers Insurance' | 'USAA' | 'Nationwide'
  | 'Liberty Mutual' | 'Erie Insurance' | 'Travelers' | 'Auto-Owners'
  | 'Shelter Insurance' | 'American Family' | 'Other';

export type AgentArea = 'Decatur' | 'Madison' | 'Huntsville' | 'Athens' | 'Hartselle' | 'Cullman' | 'Other';

export interface InsuranceAgent {
  agentId: string;
  agentName: string;
  company: InsuranceCompany;
  officeName: string;
  phone: string;
  email: string;
  address: string;
  city: AgentArea;
  state: string;
  zip: string;
  latitude?: number;
  longitude?: number;
  assignedRep?: string;       // Sales rep who regularly visits
  lastVisitDate?: string;
  visitFrequency?: string;    // e.g., 'weekly', 'biweekly', 'monthly'
  notes: string;
  active: boolean;
}

export interface AgentVisit {
  visitId: string;
  agentId: string;
  agentName: string;
  company: string;
  visitedBy: string;
  visitedByName: string;
  visitDate: string;
  duration?: number;          // minutes
  notes: string;
  outcome?: string;
  followUpDate?: string;
}

// ============================================
// SEED DATA — Real local insurance agents in North Alabama
// ============================================

const SEED_AGENTS: Omit<InsuranceAgent, 'agentId'>[] = [
  // STATE FARM — Decatur
  { agentName: 'Bobby Ricks', company: 'State Farm', officeName: 'Bobby Ricks - State Farm Agent', phone: '(256) 353-2323', email: '', address: '1509 Beltline Rd SW', city: 'Decatur', state: 'AL', zip: '35601', notes: '', active: true },
  { agentName: 'Josh Wilson', company: 'State Farm', officeName: 'Josh Wilson - State Farm Agent', phone: '(256) 353-2131', email: '', address: '714 Bank St NE', city: 'Decatur', state: 'AL', zip: '35601', notes: '', active: true },
  { agentName: 'Gregg Harrison', company: 'State Farm', officeName: 'Gregg Harrison - State Farm Agent', phone: '(256) 355-0052', email: '', address: '1304 Stratford Rd SE', city: 'Decatur', state: 'AL', zip: '35601', notes: '', active: true },
  // STATE FARM — Huntsville
  { agentName: 'Mark Fowler', company: 'State Farm', officeName: 'Mark Fowler - State Farm Agent', phone: '(256) 837-5151', email: '', address: '3322 Memorial Pkwy SW', city: 'Huntsville', state: 'AL', zip: '35801', notes: '', active: true },
  { agentName: 'Jason Bates', company: 'State Farm', officeName: 'Jason Bates - State Farm Agent', phone: '(256) 880-0004', email: '', address: '2401 Triana Blvd SW', city: 'Huntsville', state: 'AL', zip: '35805', notes: '', active: true },
  { agentName: 'Matt Stiles', company: 'State Farm', officeName: 'Matt Stiles - State Farm Agent', phone: '(256) 721-3700', email: '', address: '227 Eastside Square', city: 'Huntsville', state: 'AL', zip: '35801', notes: '', active: true },
  // STATE FARM — Madison
  { agentName: 'Andrew Steger', company: 'State Farm', officeName: 'Andrew Steger - State Farm Agent', phone: '(256) 772-0079', email: '', address: '8516 Whitesburg Dr SE', city: 'Madison', state: 'AL', zip: '35758', notes: '', active: true },
  // ALFA INSURANCE
  { agentName: 'Bill Stockton', company: 'Alfa Insurance', officeName: 'Alfa Insurance - Bill Stockton', phone: '(256) 353-4411', email: '', address: '1205 Danville Rd SW', city: 'Decatur', state: 'AL', zip: '35601', notes: '', active: true },
  { agentName: 'Tony Carden', company: 'Alfa Insurance', officeName: 'Alfa Insurance - Tony Carden', phone: '(256) 355-3111', email: '', address: '2506 Danville Rd SW', city: 'Decatur', state: 'AL', zip: '35603', notes: '', active: true },
  { agentName: 'John Horton', company: 'Alfa Insurance', officeName: 'Alfa Insurance - John Horton', phone: '(256) 837-6110', email: '', address: '7500 Memorial Pkwy SW', city: 'Huntsville', state: 'AL', zip: '35802', notes: '', active: true },
  // ALLSTATE
  { agentName: 'David Broom', company: 'Allstate', officeName: 'David Broom: Allstate Insurance', phone: '(256) 353-1120', email: '', address: '923 6th Ave SE', city: 'Decatur', state: 'AL', zip: '35601', notes: '', active: true },
  { agentName: 'Stan Sanders', company: 'Allstate', officeName: 'Stan Sanders: Allstate Insurance', phone: '(256) 772-1182', email: '', address: '12100 County Line Rd', city: 'Madison', state: 'AL', zip: '35758', notes: '', active: true },
  { agentName: 'Brian Woodroof', company: 'Allstate', officeName: 'Brian Woodroof: Allstate Insurance', phone: '(256) 837-7700', email: '', address: '3515 Memorial Pkwy SW', city: 'Huntsville', state: 'AL', zip: '35801', notes: '', active: true },
  // COUNTRY FINANCIAL
  { agentName: 'Mike Giles', company: 'Country Financial', officeName: 'Country Financial - Mike Giles', phone: '(256) 355-1212', email: '', address: '1701 Central Pkwy SW', city: 'Decatur', state: 'AL', zip: '35601', notes: '', active: true },
  { agentName: 'Kyle Patterson', company: 'Country Financial', officeName: 'Country Financial - Kyle Patterson', phone: '(256) 880-5454', email: '', address: '4925 University Dr NW', city: 'Huntsville', state: 'AL', zip: '35816', notes: '', active: true },
  // FARMERS
  { agentName: 'Sharon Bates', company: 'Farmers Insurance', officeName: 'Farmers Insurance - Sharon Bates', phone: '(256) 350-5400', email: '', address: '1009 Beltline Rd SW', city: 'Decatur', state: 'AL', zip: '35601', notes: '', active: true },
  { agentName: 'James Terry', company: 'Farmers Insurance', officeName: 'Farmers Insurance - James Terry', phone: '(256) 539-1234', email: '', address: '1805 University Dr NW', city: 'Huntsville', state: 'AL', zip: '35801', notes: '', active: true },
  // HOWARD KILGORE
  { agentName: 'Howard Kilgore', company: 'Howard Kilgore', officeName: 'Howard Kilgore Insurance', phone: '(256) 353-6611', email: '', address: '510 Cherry St NE', city: 'Decatur', state: 'AL', zip: '35601', notes: 'Independent agency, strong local presence', active: true },
  // SHELTER
  { agentName: 'Teresa Henry', company: 'Shelter Insurance', officeName: 'Shelter Insurance - Teresa Henry', phone: '(256) 351-7900', email: '', address: '1010 Beltline Rd SW', city: 'Decatur', state: 'AL', zip: '35601', notes: '', active: true },
  // ERIE
  { agentName: 'Todd Williams', company: 'Erie Insurance', officeName: 'Erie Insurance - Todd Williams', phone: '(256) 722-0808', email: '', address: '9238 Madison Blvd', city: 'Madison', state: 'AL', zip: '35758', notes: '', active: true },
];

// ============================================
// SERVICE
// ============================================

async function getOrCreateSheet(tabName: string, headerValues: string[]): Promise<{ sheet: GoogleSpreadsheetWorksheet; doc: GoogleSpreadsheet } | null> {
  if (!SHEETS_CONFIGURED) return null;
  try {
    const doc = new GoogleSpreadsheet(SHEETS_ID!, serviceAuth);
    await doc.loadInfo();
    let sheet = doc.sheetsByTitle[tabName];
    if (!sheet) {
      sheet = await doc.addSheet({ title: tabName, headerValues });
    }
    return { sheet, doc };
  } catch (error) {
    console.error(`Failed to get/create sheet ${tabName}:`, error);
    return null;
  }
}

class InsuranceAgentService {
  private agents: InsuranceAgent[] = [];
  private visits: AgentVisit[] = [];
  private loaded = false;
  private loadPromise: Promise<void> | null = null;
  private nextIds = { agent: 1, visit: 1 };

  async ensureLoaded(): Promise<void> {
    if (this.loaded) return;
    if (this.loadPromise) return this.loadPromise;
    this.loadPromise = this._load();
    return this.loadPromise;
  }

  private async _load(): Promise<void> {
    try {
      const result = await getOrCreateSheet(SHEET_TABS.AGENTS, [
        'agentId', 'agentName', 'company', 'officeName', 'phone', 'email',
        'address', 'city', 'state', 'zip', 'latitude', 'longitude',
        'assignedRep', 'lastVisitDate', 'visitFrequency', 'notes', 'active'
      ]);

      if (result) {
        const rows = await result.sheet.getRows({ limit: 100000 });
        if (rows.length > 0) {
          this.agents = rows.map((r: GoogleSpreadsheetRow) => ({
            agentId: r.get('agentId') || '',
            agentName: r.get('agentName') || '',
            company: r.get('company') as InsuranceCompany || 'Other',
            officeName: r.get('officeName') || '',
            phone: r.get('phone') || '',
            email: r.get('email') || '',
            address: r.get('address') || '',
            city: r.get('city') as AgentArea || 'Other',
            state: r.get('state') || 'AL',
            zip: r.get('zip') || '',
            latitude: parseFloat(r.get('latitude')) || undefined,
            longitude: parseFloat(r.get('longitude')) || undefined,
            assignedRep: r.get('assignedRep') || undefined,
            lastVisitDate: r.get('lastVisitDate') || undefined,
            visitFrequency: r.get('visitFrequency') || undefined,
            notes: r.get('notes') || '',
            active: r.get('active') !== 'false',
          }));
          this.nextIds.agent = Math.max(...this.agents.map(a => {
            const num = parseInt(a.agentId.replace('AGT-', ''));
            return isNaN(num) ? 0 : num;
          })) + 1;
        } else {
          // Seed with initial data
          await this._seed(result);
        }
      } else {
        // No Sheets, use seed data in memory
        this.agents = SEED_AGENTS.map((a, idx) => ({
          ...a,
          agentId: `AGT-${String(idx + 1).padStart(4, '0')}`,
        }));
        this.nextIds.agent = this.agents.length + 1;
      }

      // Load visits
      await this._loadVisits();
      this.loaded = true;
    } catch (error) {
      console.error('Failed to load insurance agents:', error);
      this.agents = SEED_AGENTS.map((a, idx) => ({
        ...a,
        agentId: `AGT-${String(idx + 1).padStart(4, '0')}`,
      }));
      this.nextIds.agent = this.agents.length + 1;
      this.loaded = true;
    }
  }

  private async _seed(result: { sheet: GoogleSpreadsheetWorksheet }): Promise<void> {
    const rows = SEED_AGENTS.map((a, idx) => {
      const agentId = `AGT-${String(idx + 1).padStart(4, '0')}`;
      return {
        agentId,
        agentName: a.agentName,
        company: a.company,
        officeName: a.officeName,
        phone: a.phone,
        email: a.email || '',
        address: a.address,
        city: a.city,
        state: a.state,
        zip: a.zip,
        latitude: '',
        longitude: '',
        assignedRep: a.assignedRep || '',
        lastVisitDate: '',
        visitFrequency: '',
        notes: a.notes,
        active: 'true',
      };
    });
    await result.sheet.addRows(rows);
    this.agents = SEED_AGENTS.map((a, idx) => ({
      ...a,
      agentId: `AGT-${String(idx + 1).padStart(4, '0')}`,
    }));
    this.nextIds.agent = this.agents.length + 1;
  }

  private async _loadVisits(): Promise<void> {
    const result = await getOrCreateSheet(SHEET_TABS.VISITS, [
      'visitId', 'agentId', 'agentName', 'company', 'visitedBy',
      'visitedByName', 'visitDate', 'duration', 'notes', 'outcome', 'followUpDate'
    ]);
    if (!result) return;
    try {
      const rows = await result.sheet.getRows({ limit: 100000 });
      this.visits = rows.map((r: GoogleSpreadsheetRow) => ({
        visitId: r.get('visitId') || '',
        agentId: r.get('agentId') || '',
        agentName: r.get('agentName') || '',
        company: r.get('company') || '',
        visitedBy: r.get('visitedBy') || '',
        visitedByName: r.get('visitedByName') || '',
        visitDate: r.get('visitDate') || '',
        duration: parseInt(r.get('duration')) || undefined,
        notes: r.get('notes') || '',
        outcome: r.get('outcome') || undefined,
        followUpDate: r.get('followUpDate') || undefined,
      }));
      if (this.visits.length > 0) {
        this.nextIds.visit = Math.max(...this.visits.map(v => {
          const num = parseInt(v.visitId.replace('VIS-', ''));
          return isNaN(num) ? 0 : num;
        })) + 1;
      }
    } catch (error) {
      console.error('Failed to load agent visits:', error);
    }
  }

  // ============================================
  // CRUD
  // ============================================

  async getAgents(filters?: { city?: AgentArea; company?: string; assignedRep?: string; unassigned?: boolean }): Promise<InsuranceAgent[]> {
    await this.ensureLoaded();
    let agents = this.agents.filter(a => a.active);
    if (filters?.city) agents = agents.filter(a => a.city === filters.city);
    if (filters?.company) agents = agents.filter(a => a.company === filters.company);
    if (filters?.assignedRep) agents = agents.filter(a => a.assignedRep === filters.assignedRep);
    if (filters?.unassigned) agents = agents.filter(a => !a.assignedRep);
    return agents.sort((a, b) => a.agentName.localeCompare(b.agentName));
  }

  async getAgentById(agentId: string): Promise<InsuranceAgent | undefined> {
    await this.ensureLoaded();
    return this.agents.find(a => a.agentId === agentId);
  }

  async addAgent(data: Omit<InsuranceAgent, 'agentId'>): Promise<InsuranceAgent> {
    await this.ensureLoaded();
    const agentId = `AGT-${String(this.nextIds.agent++).padStart(4, '0')}`;
    const agent: InsuranceAgent = { agentId, ...data };
    this.agents.push(agent);
    this._persistAgent(agent).catch(() => {});
    return agent;
  }

  async updateAgent(agentId: string, updates: Partial<InsuranceAgent>): Promise<InsuranceAgent | null> {
    await this.ensureLoaded();
    const idx = this.agents.findIndex(a => a.agentId === agentId);
    if (idx === -1) return null;
    this.agents[idx] = { ...this.agents[idx], ...updates, agentId };
    this._persistAgent(this.agents[idx]).catch(() => {});
    return this.agents[idx];
  }

  async assignRep(agentId: string, repName: string): Promise<InsuranceAgent | null> {
    return this.updateAgent(agentId, { assignedRep: repName });
  }

  // ============================================
  // VISITS
  // ============================================

  async recordVisit(data: {
    agentId: string;
    visitedBy: string;
    visitedByName: string;
    visitDate: string;
    duration?: number;
    notes: string;
    outcome?: string;
    followUpDate?: string;
  }): Promise<AgentVisit> {
    await this.ensureLoaded();
    const agent = this.agents.find(a => a.agentId === data.agentId);
    const visitId = `VIS-${String(this.nextIds.visit++).padStart(5, '0')}`;
    const visit: AgentVisit = {
      visitId,
      agentId: data.agentId,
      agentName: agent?.agentName || 'Unknown',
      company: agent?.company || 'Unknown',
      visitedBy: data.visitedBy,
      visitedByName: data.visitedByName,
      visitDate: data.visitDate,
      duration: data.duration,
      notes: data.notes,
      outcome: data.outcome,
      followUpDate: data.followUpDate,
    };
    this.visits.push(visit);

    // Update agent's last visit
    if (agent) {
      agent.lastVisitDate = data.visitDate;
      this._persistAgent(agent).catch(() => {});
    }

    this._persistVisit(visit).catch(() => {});
    return visit;
  }

  async getVisits(agentId?: string, limit: number = 50): Promise<AgentVisit[]> {
    await this.ensureLoaded();
    let visits = [...this.visits];
    if (agentId) visits = visits.filter(v => v.agentId === agentId);
    return visits.sort((a, b) => b.visitDate.localeCompare(a.visitDate)).slice(0, limit);
  }

  async getVisitsByRep(repName: string, limit: number = 50): Promise<AgentVisit[]> {
    await this.ensureLoaded();
    return this.visits
      .filter(v => v.visitedByName.toLowerCase().includes(repName.toLowerCase()))
      .sort((a, b) => b.visitDate.localeCompare(a.visitDate))
      .slice(0, limit);
  }

  // ============================================
  // RICK'S SCHEDULE FILLER
  // ============================================

  /**
   * Suggest agents for Rick (or any rep) to visit based on location.
   * Prioritizes: unvisited > longest since last visit > unassigned
   */
  async suggestVisits(location: AgentArea, repName?: string, limit: number = 5): Promise<InsuranceAgent[]> {
    await this.ensureLoaded();
    const now = new Date().toISOString().split('T')[0];

    // Get agents in the area
    let candidates = this.agents.filter(a => a.active && a.city === location);

    // If rep specified, include their assigned agents + unassigned
    if (repName) {
      candidates = candidates.filter(a => !a.assignedRep || a.assignedRep.toLowerCase().includes(repName.toLowerCase()));
    }

    // Sort by priority: never visited > longest since last visit
    candidates.sort((a, b) => {
      // Never visited first
      if (!a.lastVisitDate && b.lastVisitDate) return -1;
      if (a.lastVisitDate && !b.lastVisitDate) return 1;
      if (!a.lastVisitDate && !b.lastVisitDate) return a.agentName.localeCompare(b.agentName);
      // Oldest visit first
      return (a.lastVisitDate || '').localeCompare(b.lastVisitDate || '');
    });

    return candidates.slice(0, limit);
  }

  /**
   * Get areas with agent counts for location-based suggestions.
   */
  async getAreaSummary(): Promise<{ area: AgentArea; agentCount: number; lastVisit: string | null }[]> {
    await this.ensureLoaded();
    const areas: AgentArea[] = ['Decatur', 'Madison', 'Huntsville', 'Athens', 'Hartselle'];
    return areas.map(area => {
      const agents = this.agents.filter(a => a.active && a.city === area);
      const lastVisit = agents
        .filter(a => a.lastVisitDate)
        .sort((a, b) => (b.lastVisitDate || '').localeCompare(a.lastVisitDate || ''))[0]?.lastVisitDate || null;
      return { area, agentCount: agents.length, lastVisit };
    }).filter(a => a.agentCount > 0);
  }

  async getCompanySummary(): Promise<{ company: string; agentCount: number }[]> {
    await this.ensureLoaded();
    const companies = [...new Set(this.agents.filter(a => a.active).map(a => a.company))];
    return companies.map(company => ({
      company,
      agentCount: this.agents.filter(a => a.active && a.company === company).length,
    })).sort((a, b) => b.agentCount - a.agentCount);
  }

  // ============================================
  // PERSISTENCE
  // ============================================

  private async _persistAgent(agent: InsuranceAgent): Promise<void> {
    const result = await getOrCreateSheet(SHEET_TABS.AGENTS, [
      'agentId', 'agentName', 'company', 'officeName', 'phone', 'email',
      'address', 'city', 'state', 'zip', 'latitude', 'longitude',
      'assignedRep', 'lastVisitDate', 'visitFrequency', 'notes', 'active'
    ]);
    if (!result) return;
    try {
      const rows = await result.sheet.getRows({ limit: 100000 });
      const existing = rows.find((r: GoogleSpreadsheetRow) => r.get('agentId') === agent.agentId);
      const data: Record<string, string> = {
        agentId: agent.agentId,
        agentName: agent.agentName,
        company: agent.company,
        officeName: agent.officeName,
        phone: agent.phone,
        email: agent.email || '',
        address: agent.address,
        city: agent.city,
        state: agent.state,
        zip: agent.zip,
        latitude: agent.latitude?.toString() || '',
        longitude: agent.longitude?.toString() || '',
        assignedRep: agent.assignedRep || '',
        lastVisitDate: agent.lastVisitDate || '',
        visitFrequency: agent.visitFrequency || '',
        notes: agent.notes,
        active: agent.active ? 'true' : 'false',
      };
      if (existing) {
        Object.entries(data).forEach(([k, v]) => existing.set(k, v));
        await existing.save();
      } else {
        await result.sheet.addRow(data);
      }
    } catch (error) {
      console.error('Failed to persist insurance agent:', error);
    }
  }

  private async _persistVisit(visit: AgentVisit): Promise<void> {
    const result = await getOrCreateSheet(SHEET_TABS.VISITS, [
      'visitId', 'agentId', 'agentName', 'company', 'visitedBy',
      'visitedByName', 'visitDate', 'duration', 'notes', 'outcome', 'followUpDate'
    ]);
    if (!result) return;
    try {
      await result.sheet.addRow({
        visitId: visit.visitId,
        agentId: visit.agentId,
        agentName: visit.agentName,
        company: visit.company,
        visitedBy: visit.visitedBy,
        visitedByName: visit.visitedByName,
        visitDate: visit.visitDate,
        duration: visit.duration?.toString() || '',
        notes: visit.notes,
        outcome: visit.outcome || '',
        followUpDate: visit.followUpDate || '',
      });
    } catch (error) {
      console.error('Failed to persist agent visit:', error);
    }
  }
}

export const insuranceAgentService = new InsuranceAgentService();
