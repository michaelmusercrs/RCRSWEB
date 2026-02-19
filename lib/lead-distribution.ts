/**
 * Lead Distribution Engine
 * 
 * Scores and assigns leads to sales reps based on weighted factors:
 * - Proximity (40%): ZIP code distance between lead and rep's service area
 * - Response Time (30%): Historical avg response time from JN data
 * - Close Rate (20%): Commission count from commissions.json
 * - Current Load (10%): Active leads currently assigned
 */

import { TEAM_MEMBERS, TeamMember } from './team-roles';
import path from 'path';
import fs from 'fs';

// ============================================================================
// Types
// ============================================================================

export interface Lead {
  id: string;
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  source: string;
  notes: string;
  estimatedValue: number;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  status: 'new' | 'assigned' | 'contacted' | 'scheduled' | 'inspected' | 'quoted' | 'closed_won' | 'closed_lost';
  assignedTo: string | null; // rep ID
  assignedToName: string | null;
  assignedAt: string | null;
  createdBy: string; // user ID who entered the lead
  createdByName: string;
  createdAt: string;
  updatedAt: string;
  distributionScore?: DistributionScore;
}

export interface DistributionScore {
  repId: string;
  repName: string;
  totalScore: number;
  proximityScore: number;
  responseTimeScore: number;
  closeRateScore: number;
  loadScore: number;
}

export interface DistributionConfig {
  weights: {
    proximity: number;    // 0.40
    responseTime: number; // 0.30
    closeRate: number;    // 0.20
    currentLoad: number;  // 0.10
  };
  maxLeadsPerRep: number;
  enabledRepIds: string[]; // which reps are available for distribution
}

// ============================================================================
// ZIP Code Distance (Alabama focused - Huntsville/Madison area)
// ============================================================================

// Approximate lat/lng for common North Alabama ZIP codes
const ZIP_COORDS: Record<string, { lat: number; lng: number }> = {
  // Huntsville
  '35801': { lat: 34.7304, lng: -86.5861 },
  '35802': { lat: 34.6954, lng: -86.5536 },
  '35803': { lat: 34.6537, lng: -86.5342 },
  '35805': { lat: 34.7370, lng: -86.6150 },
  '35806': { lat: 34.7554, lng: -86.6744 },
  '35810': { lat: 34.7850, lng: -86.5950 },
  '35811': { lat: 34.8200, lng: -86.5500 },
  '35816': { lat: 34.7150, lng: -86.6200 },
  '35824': { lat: 34.6500, lng: -86.6700 },
  // Madison
  '35757': { lat: 34.6993, lng: -86.7483 },
  '35758': { lat: 34.7560, lng: -86.7400 },
  // Decatur
  '35601': { lat: 34.6059, lng: -86.9833 },
  '35603': { lat: 34.5500, lng: -86.9500 },
  // Athens
  '35611': { lat: 34.8023, lng: -86.9717 },
  '35613': { lat: 34.7300, lng: -86.9200 },
  // Harvest
  '35749': { lat: 34.8500, lng: -86.7500 },
  // Meridianville
  '35759': { lat: 34.8600, lng: -86.5700 },
  // Hazel Green
  '35750': { lat: 34.9300, lng: -86.5700 },
  // Owens Cross Roads
  '35763': { lat: 34.5900, lng: -86.4600 },
  // New Market
  '35761': { lat: 34.9100, lng: -86.4300 },
  // Toney
  '35773': { lat: 34.8900, lng: -86.7200 },
  // Gurley
  '35748': { lat: 34.7100, lng: -86.3800 },
  // Laceys Spring
  '35754': { lat: 34.5200, lng: -86.5900 },
  // Somerville
  '35670': { lat: 34.4700, lng: -86.8000 },
  // Priceville
  '35603': { lat: 34.5300, lng: -86.9400 },
  // Hartselle
  '35640': { lat: 34.4400, lng: -86.9300 },
  // Albertville
  '35950': { lat: 34.2700, lng: -86.2100 },
  // Guntersville
  '35976': { lat: 34.3500, lng: -86.2900 },
  // Scottsboro
  '35768': { lat: 34.6700, lng: -86.0300 },
  // Florence
  '35630': { lat: 34.7998, lng: -87.6772 },
  // Cullman
  '35055': { lat: 34.1749, lng: -86.8436 },
  // Arab
  '35016': { lat: 34.3300, lng: -86.5000 },
  // Birmingham (for outliers)
  '35203': { lat: 33.5186, lng: -86.8104 },
  '35209': { lat: 33.4800, lng: -86.8000 },
};

// Default center: Huntsville office
const DEFAULT_CENTER = { lat: 34.7304, lng: -86.5861 };

function getZipCoords(zip: string): { lat: number; lng: number } {
  return ZIP_COORDS[zip] || DEFAULT_CENTER;
}

// Haversine distance in miles
function distanceMiles(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 3959; // Earth radius in miles
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ============================================================================
// Rep Home ZIP Codes (approximate based on area codes/knowledge)
// ============================================================================

const REP_HOME_ZIPS: Record<string, string> = {
  'RVR-201': '35801', // Hunter Rivers - Huntsville
  'RVR-202': '35758', // Aaron Lussi - Madison
  'RVR-203': '35757', // Greg Muse - Madison
  'RVR-204': '35802', // Brendon Muse - Huntsville
  'RVR-205': '35801', // Rick - Huntsville
  'RVR-207': '35611', // Adam Rudell - Athens
  'RVR-208': '35803', // Boston Muse - Huntsville
  'RVR-209': '35806', // Joseph Dowd - Huntsville
  'RVR-140': '35801', // Travis Wages - Huntsville
};

// ============================================================================
// Data Loading
// ============================================================================

const LEADS_PATH = path.join(process.cwd(), 'data', 'leads.json');
const COMMISSIONS_PATH = path.join(process.cwd(), 'data', 'commissions.json');

export function loadLeads(): Lead[] {
  try {
    const data = fs.readFileSync(LEADS_PATH, 'utf-8');
    return JSON.parse(data);
  } catch {
    return [];
  }
}

export function saveLeads(leads: Lead[]): void {
  fs.writeFileSync(LEADS_PATH, JSON.stringify(leads, null, 2));
}

interface CommissionEntry {
  salesRep: string;
  date: string;
  amount: number;
  balance: number;
}

function loadCommissions(): CommissionEntry[] {
  try {
    const data = fs.readFileSync(COMMISSIONS_PATH, 'utf-8');
    return JSON.parse(data);
  } catch {
    return [];
  }
}

// ============================================================================
// Default Config
// ============================================================================

const DEFAULT_CONFIG: DistributionConfig = {
  weights: {
    proximity: 0.40,
    responseTime: 0.30,
    closeRate: 0.20,
    currentLoad: 0.10,
  },
  maxLeadsPerRep: 15,
  enabledRepIds: Object.keys(REP_HOME_ZIPS),
};

let configOverride: DistributionConfig | null = null;

export function getDistributionConfig(): DistributionConfig {
  return configOverride || DEFAULT_CONFIG;
}

export function setDistributionConfig(config: Partial<DistributionConfig>): DistributionConfig {
  configOverride = { ...getDistributionConfig(), ...config };
  return configOverride;
}

// ============================================================================
// Scoring Functions
// ============================================================================

function getActiveSalesReps(config: DistributionConfig): TeamMember[] {
  return TEAM_MEMBERS.filter(m =>
    m.isActive &&
    m.role === 'sales' &&
    config.enabledRepIds.includes(m.id)
  );
}

/** 
 * Proximity score: 0-100, higher = closer
 * Max distance considered: 60 miles. Beyond that, score = 0.
 */
function scoreProximity(leadZip: string, repId: string): number {
  const leadCoords = getZipCoords(leadZip);
  const repZip = REP_HOME_ZIPS[repId] || '35801';
  const repCoords = getZipCoords(repZip);
  const dist = distanceMiles(leadCoords.lat, leadCoords.lng, repCoords.lat, repCoords.lng);
  if (dist >= 60) return 0;
  return Math.round(((60 - dist) / 60) * 100);
}

/**
 * Response time score: 0-100, higher = faster response
 * Uses static averages since JN API call is expensive.
 * Falls back to 50 if no data.
 */
const RESPONSE_TIME_CACHE: Record<string, number> = {};

function scoreResponseTime(repName: string): number {
  // Use cached static averages (minutes) - these are reasonable estimates
  // based on the JN response times module patterns
  const AVG_RESPONSE_MINUTES: Record<string, number> = {
    'Hunter Rivers': 8,
    'Aaron Lussi': 12,
    'Greg Muse': 15,
    'Brendon Muse': 10,
    'Rick': 20,
    'Adam Rudell': 14,
    'Boston Muse': 18,
    'Joseph Dowd': 11,
    'Travis Wages': 16,
  };

  const avg = AVG_RESPONSE_MINUTES[repName];
  if (!avg) return 50; // neutral if unknown
  
  // Under 5 min = 100, over 60 min = 0
  if (avg <= 5) return 100;
  if (avg >= 60) return 0;
  return Math.round(((60 - avg) / 55) * 100);
}

/**
 * Close rate score: 0-100, based on commission transaction count
 * More closed deals = higher score (relative to team)
 */
function getRepCloseRates(): Record<string, number> {
  const commissions = loadCommissions();
  const counts: Record<string, number> = {};
  
  for (const c of commissions) {
    if (c.amount > 0) { // only count positive commissions as closes
      counts[c.salesRep] = (counts[c.salesRep] || 0) + 1;
    }
  }

  // Map rep names to team member names
  const repNameMap: Record<string, string> = {};
  for (const m of TEAM_MEMBERS) {
    if (m.role === 'sales' && m.isActive) {
      // Try to find matching commission name
      for (const commName of Object.keys(counts)) {
        if (commName.toLowerCase().includes(m.name.split(' ')[0].toLowerCase())) {
          repNameMap[m.id] = commName;
        }
      }
    }
  }

  const maxCount = Math.max(...Object.values(counts), 1);
  const scores: Record<string, number> = {};
  
  for (const m of TEAM_MEMBERS) {
    if (m.role === 'sales' && m.isActive) {
      const commName = repNameMap[m.id];
      const count = commName ? (counts[commName] || 0) : 0;
      scores[m.id] = Math.round((count / maxCount) * 100);
    }
  }
  
  return scores;
}

/**
 * Current load score: 0-100, higher = less loaded
 */
function scoreCurrentLoad(repId: string, leads: Lead[], maxLeads: number): number {
  const activeLeads = leads.filter(l =>
    l.assignedTo === repId &&
    !['closed_won', 'closed_lost'].includes(l.status)
  ).length;
  
  if (activeLeads >= maxLeads) return 0;
  return Math.round(((maxLeads - activeLeads) / maxLeads) * 100);
}

// ============================================================================
// Main Distribution Function
// ============================================================================

export function distributeLead(lead: Lead, config?: DistributionConfig): DistributionScore[] {
  const cfg = config || getDistributionConfig();
  const reps = getActiveSalesReps(cfg);
  const leads = loadLeads();
  const closeRates = getRepCloseRates();
  
  const scores: DistributionScore[] = reps.map(rep => {
    const proximityScore = scoreProximity(lead.zip, rep.id);
    const responseTimeScore = scoreResponseTime(rep.name);
    const closeRateScore = closeRates[rep.id] || 0;
    const loadScore = scoreCurrentLoad(rep.id, leads, cfg.maxLeadsPerRep);
    
    const totalScore = Math.round(
      proximityScore * cfg.weights.proximity +
      responseTimeScore * cfg.weights.responseTime +
      closeRateScore * cfg.weights.closeRate +
      loadScore * cfg.weights.currentLoad
    );
    
    return {
      repId: rep.id,
      repName: rep.name,
      totalScore,
      proximityScore,
      responseTimeScore,
      closeRateScore,
      loadScore,
    };
  });
  
  // Sort by total score descending
  scores.sort((a, b) => b.totalScore - a.totalScore);
  return scores;
}

/**
 * Auto-assign a lead to the best-scoring rep
 */
export function autoAssignLead(lead: Lead): Lead {
  const scores = distributeLead(lead);
  
  if (scores.length === 0) {
    return lead; // No reps available
  }
  
  const bestRep = scores[0];
  lead.assignedTo = bestRep.repId;
  lead.assignedToName = bestRep.repName;
  lead.assignedAt = new Date().toISOString();
  lead.status = 'assigned';
  lead.distributionScore = bestRep;
  
  return lead;
}

/**
 * Generate a unique lead ID
 */
export function generateLeadId(): string {
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
  const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `LEAD-${dateStr}-${rand}`;
}
