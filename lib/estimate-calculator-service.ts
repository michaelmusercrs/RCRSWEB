/**
 * RCRS Quick Estimate Calculator Service
 *
 * Calculates roof replacement/repair estimates with material quantities,
 * labor costs, and timeline projections. Uses Alabama-specific labor rates
 * and regional material pricing.
 *
 * Data stored in data/estimates.json
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

export interface EstimateInput {
  roofArea: number; // sq ft
  pitch: string; // e.g., "6/12"
  stories: number; // 1, 2, 3
  roofStyle: string; // gable, hip, cross-gable, mansard, flat, shed
  currentMaterial: string; // asphalt, metal, tile, flat
  newMaterial: string; // what they want
  tearOff: boolean; // remove old roof
  complexityLevel: 'simple' | 'moderate' | 'complex';
  extras: string[]; // skylights, chimney_flash, ridge_vent, gutter, soffit, fascia, drip_edge, ice_water_shield
  measurements?: {
    ridge: number;
    rake: number;
    valley: number;
    eave: number;
    hip: number;
  };
}

export interface EstimateResult {
  id: string;
  input: EstimateInput;

  // Cost breakdown
  materialCost: number;
  laborCost: number;
  tearOffCost: number;
  extrasCost: Record<string, number>;
  wasteFactorPercent: number;
  wasteCost: number;
  subtotal: number;
  overhead: number;
  profit: number;
  totalEstimate: number;

  // Material quantities
  squares: number;
  bundlesNeeded: number;
  underlaymentRolls: number;
  ridgeCapLinearFt: number;
  dripEdgeLinearFt: number;
  starterStripLinearFt: number;
  nailPounds: number;

  // Ranges
  lowEstimate: number;
  highEstimate: number;

  // Notes
  pricePerSquare: number;
  estimatedDays: number;
  crewSize: number;
  notes: string[];

  createdAt: string;
  customerName?: string;
  address?: string;
  leadId?: string;
}

interface EstimateData {
  estimates: EstimateResult[];
  lastUpdated: string;
}

// =============================================================================
// PRICING DATA (Alabama / North Alabama rates)
// =============================================================================

/** Material cost per roofing square (100 sq ft) — [low, high] */
const MATERIAL_COST_PER_SQUARE: Record<string, [number, number]> = {
  '3_tab_asphalt':       [75, 100],
  'architectural':       [100, 150],
  'designer_asphalt':    [150, 250],
  'metal_standing_seam': [300, 500],
  'metal_corrugated':    [150, 250],
  'tpo_flat':            [150, 250],
  'modified_bitumen':    [100, 200],
  'cedar_shake':         [350, 500],
  'synthetic_slate':     [400, 700],
  'clay_tile':           [500, 1000],
};

/** Labor cost per square by complexity — Alabama rates */
const LABOR_COST_PER_SQUARE: Record<string, [number, number]> = {
  simple:   [150, 200],
  moderate: [200, 275],
  complex:  [275, 400],
};

/** Tear-off cost per square */
const TEAR_OFF_COST_PER_SQUARE: [number, number] = [75, 150];

/** Waste factor by complexity (percent) */
const WASTE_FACTOR: Record<string, [number, number]> = {
  simple:   [10, 15],
  moderate: [15, 20],
  complex:  [20, 25],
};

/** Extras pricing — per unit / each */
const EXTRAS_PRICING: Record<string, { label: string; unit: string; low: number; high: number }> = {
  skylights:          { label: 'Skylight Install/Flash', unit: 'each', low: 250, high: 500 },
  chimney_flash:      { label: 'Chimney Flashing',      unit: 'each', low: 300, high: 600 },
  ridge_vent:         { label: 'Ridge Vent',             unit: 'per ft', low: 3,  high: 5 },
  gutter:             { label: 'Gutters',                unit: 'per ft', low: 5,  high: 15 },
  soffit:             { label: 'Soffit & Fascia',        unit: 'per ft', low: 4,  high: 8 },
  fascia:             { label: 'Fascia Only',            unit: 'per ft', low: 3,  high: 6 },
  drip_edge:          { label: 'Drip Edge',              unit: 'per ft', low: 1,  high: 3 },
  ice_water_shield:   { label: 'Ice & Water Shield',     unit: 'per sq', low: 50, high: 100 },
};

/** Pitch multiplier — steeper pitches cost more labor */
const PITCH_MULTIPLIERS: Record<string, number> = {
  '2/12': 1.0,
  '3/12': 1.0,
  '4/12': 1.0,
  '5/12': 1.05,
  '6/12': 1.10,
  '7/12': 1.15,
  '8/12': 1.20,
  '9/12': 1.30,
  '10/12': 1.40,
  '11/12': 1.50,
  '12/12': 1.60,
};

/** Story height surcharge multiplier */
const STORY_MULTIPLIERS: Record<number, number> = {
  1: 1.0,
  2: 1.10,
  3: 1.25,
};

/** Roof style complexity additions */
const STYLE_COMPLEXITY: Record<string, number> = {
  flat:        0,
  shed:        0,
  gable:       0,
  hip:         0.05,
  'cross-gable': 0.08,
  mansard:     0.15,
};

/** Material display labels */
const MATERIAL_LABELS: Record<string, string> = {
  '3_tab_asphalt':       '3-Tab Asphalt Shingles',
  'architectural':       'Architectural Asphalt Shingles',
  'designer_asphalt':    'Designer Asphalt Shingles',
  'metal_standing_seam': 'Metal Standing Seam',
  'metal_corrugated':    'Metal Corrugated',
  'tpo_flat':            'TPO Flat Roof',
  'modified_bitumen':    'Modified Bitumen',
  'cedar_shake':         'Cedar Shake',
  'synthetic_slate':     'Synthetic Slate',
  'clay_tile':           'Clay Tile',
};

// =============================================================================
// DATA HELPERS
// =============================================================================

const DATA_FILE_PATH = path.join(process.cwd(), 'data', 'estimates.json');

function readData(): EstimateData {
  try {
    if (fs.existsSync(DATA_FILE_PATH)) {
      const content = fs.readFileSync(DATA_FILE_PATH, 'utf-8');
      return JSON.parse(content);
    }
  } catch (error) {
    console.error('[EstimateService] Error reading data:', error);
  }
  return { estimates: [], lastUpdated: new Date().toISOString() };
}

function writeData(data: EstimateData): void {
  try {
    const dir = path.dirname(DATA_FILE_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    data.lastUpdated = new Date().toISOString();
    fs.writeFileSync(DATA_FILE_PATH, JSON.stringify(data, null, 2));
  } catch (error) {
    console.error('[EstimateService] Error writing data:', error);
    throw error;
  }
}

function generateId(): string {
  return `EST-${crypto.randomBytes(6).toString('hex')}`;
}

function avg(low: number, high: number): number {
  return (low + high) / 2;
}

// =============================================================================
// SERVICE CLASS
// =============================================================================

class EstimateCalculatorService {
  // ---------------------------------------------------------------------------
  // Calculate
  // ---------------------------------------------------------------------------

  calculateEstimate(input: EstimateInput): EstimateResult {
    const squares = input.roofArea / 100;
    const notes: string[] = [];

    // ----- Material pricing -----
    const matPricing = MATERIAL_COST_PER_SQUARE[input.newMaterial] || MATERIAL_COST_PER_SQUARE['architectural'];
    const matPricePerSquare = avg(matPricing[0], matPricing[1]);
    const materialCostBase = squares * matPricePerSquare;

    // ----- Labor pricing -----
    const labPricing = LABOR_COST_PER_SQUARE[input.complexityLevel] || LABOR_COST_PER_SQUARE['moderate'];
    const labPricePerSquare = avg(labPricing[0], labPricing[1]);

    // Apply pitch multiplier
    const pitchMult = PITCH_MULTIPLIERS[input.pitch] || 1.0;
    if (pitchMult > 1.0) {
      notes.push(`Steep pitch (${input.pitch}) adds ${Math.round((pitchMult - 1) * 100)}% to labor`);
    }

    // Apply story multiplier
    const storyMult = STORY_MULTIPLIERS[input.stories] || 1.0;
    if (storyMult > 1.0) {
      notes.push(`${input.stories}-story height adds ${Math.round((storyMult - 1) * 100)}% to labor`);
    }

    // Apply style complexity
    const styleMult = 1 + (STYLE_COMPLEXITY[input.roofStyle] || 0);
    if (styleMult > 1.0) {
      notes.push(`${input.roofStyle} roof style adds ${Math.round((styleMult - 1) * 100)}% to labor`);
    }

    const laborCost = squares * labPricePerSquare * pitchMult * storyMult * styleMult;

    // ----- Tear-off -----
    let tearOffCost = 0;
    if (input.tearOff) {
      tearOffCost = squares * avg(TEAR_OFF_COST_PER_SQUARE[0], TEAR_OFF_COST_PER_SQUARE[1]);
      notes.push('Includes tear-off of existing roof and disposal');
    }

    // ----- Waste factor -----
    const wastePricing = WASTE_FACTOR[input.complexityLevel] || WASTE_FACTOR['moderate'];
    const wasteFactorPercent = avg(wastePricing[0], wastePricing[1]);
    const wasteCost = materialCostBase * (wasteFactorPercent / 100);

    const materialCost = materialCostBase + wasteCost;

    // ----- Extras -----
    const extrasCost: Record<string, number> = {};
    let extrasTotal = 0;

    for (const extra of input.extras) {
      const pricing = EXTRAS_PRICING[extra];
      if (!pricing) continue;

      let quantity = 1;
      const avgPrice = avg(pricing.low, pricing.high);

      // Calculate quantity based on unit type and available measurements
      if (pricing.unit === 'per ft') {
        if (extra === 'ridge_vent' && input.measurements?.ridge) {
          quantity = input.measurements.ridge;
        } else if (extra === 'gutter' && input.measurements?.eave) {
          quantity = input.measurements.eave;
        } else if (extra === 'drip_edge') {
          quantity = input.measurements
            ? (input.measurements.eave || 0) + (input.measurements.rake || 0)
            : Math.sqrt(input.roofArea) * 4; // Rough perimeter estimate
        } else if (extra === 'soffit' || extra === 'fascia') {
          quantity = input.measurements
            ? (input.measurements.eave || 0)
            : Math.sqrt(input.roofArea) * 2; // Rough eave estimate
        } else {
          // Default linear feet estimate from roof area
          quantity = Math.sqrt(input.roofArea) * 2;
        }
        notes.push(`${pricing.label}: ~${Math.round(quantity)} linear ft`);
      } else if (pricing.unit === 'per sq') {
        quantity = squares;
      } else {
        // "each" — default 1
        quantity = 1;
      }

      const cost = Math.round(quantity * avgPrice);
      extrasCost[extra] = cost;
      extrasTotal += cost;
    }

    // ----- Subtotal, Overhead, Profit -----
    const subtotal = materialCost + laborCost + tearOffCost + extrasTotal;
    const overhead = subtotal * 0.15;
    const profit = subtotal * 0.25;
    const totalEstimate = Math.round(subtotal + overhead + profit);

    // ----- Low/High range (±15%) -----
    const lowEstimate = Math.round(totalEstimate * 0.85);
    const highEstimate = Math.round(totalEstimate * 1.15);

    // ----- Material quantities -----
    const bundlesNeeded = Math.ceil(squares * 3 * (1 + wasteFactorPercent / 100));
    const underlaymentRolls = Math.ceil(squares / 4); // 1 roll covers ~4 squares
    const ridgeCapLinearFt = input.measurements?.ridge || Math.round(Math.sqrt(input.roofArea) * 0.5);
    const dripEdgeLinearFt = input.measurements
      ? (input.measurements.eave || 0) + (input.measurements.rake || 0)
      : Math.round(Math.sqrt(input.roofArea) * 4);
    const starterStripLinearFt = input.measurements?.eave || Math.round(Math.sqrt(input.roofArea) * 2);
    const nailPounds = Math.ceil(squares * 2); // ~2 lbs per square

    // ----- Timeline -----
    const baseDays = Math.ceil(squares / 8); // ~8 squares per day for avg crew
    const complexityMultDays = input.complexityLevel === 'complex' ? 1.5
      : input.complexityLevel === 'moderate' ? 1.2 : 1.0;
    const estimatedDays = Math.max(1, Math.ceil(baseDays * complexityMultDays * pitchMult));
    const crewSize = squares <= 15 ? 3 : squares <= 30 ? 4 : 5;

    // ----- Additional notes -----
    const matLabel = MATERIAL_LABELS[input.newMaterial] || input.newMaterial;
    notes.unshift(`Material: ${matLabel}`);
    if (input.currentMaterial && input.currentMaterial !== input.newMaterial) {
      notes.push(`Replacing ${input.currentMaterial} with ${matLabel}`);
    }
    notes.push(`Estimated crew: ${crewSize} workers, ${estimatedDays} day${estimatedDays > 1 ? 's' : ''}`);
    notes.push('Pricing based on North Alabama market rates (Huntsville/Madison area)');
    notes.push('Final price subject to on-site inspection');

    const pricePerSquare = Math.round(totalEstimate / squares);

    return {
      id: generateId(),
      input,
      materialCost: Math.round(materialCost),
      laborCost: Math.round(laborCost),
      tearOffCost: Math.round(tearOffCost),
      extrasCost,
      wasteFactorPercent,
      wasteCost: Math.round(wasteCost),
      subtotal: Math.round(subtotal),
      overhead: Math.round(overhead),
      profit: Math.round(profit),
      totalEstimate,
      squares: Math.round(squares * 100) / 100,
      bundlesNeeded,
      underlaymentRolls,
      ridgeCapLinearFt,
      dripEdgeLinearFt,
      starterStripLinearFt,
      nailPounds,
      lowEstimate,
      highEstimate,
      pricePerSquare,
      estimatedDays,
      crewSize,
      notes,
      createdAt: new Date().toISOString(),
    };
  }

  // ---------------------------------------------------------------------------
  // Persistence
  // ---------------------------------------------------------------------------

  saveEstimate(result: EstimateResult): string {
    const data = readData();
    // Ensure the estimate has an ID
    if (!result.id) result.id = generateId();
    data.estimates.unshift(result);
    writeData(data);
    return result.id;
  }

  getEstimate(id: string): EstimateResult | null {
    const data = readData();
    return data.estimates.find(e => e.id === id) || null;
  }

  getRecentEstimates(limit: number = 20): EstimateResult[] {
    const data = readData();
    return data.estimates
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, limit);
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  getMaterialOptions() {
    return Object.entries(MATERIAL_COST_PER_SQUARE).map(([key, [low, high]]) => ({
      value: key,
      label: MATERIAL_LABELS[key] || key,
      priceRange: `$${low}-${high}/sq`,
      low,
      high,
    }));
  }

  getExtrasOptions() {
    return Object.entries(EXTRAS_PRICING).map(([key, info]) => ({
      value: key,
      label: info.label,
      unit: info.unit,
      priceRange: `$${info.low}-${info.high}/${info.unit}`,
      low: info.low,
      high: info.high,
    }));
  }

  getPitchOptions() {
    return Object.entries(PITCH_MULTIPLIERS).map(([pitch, mult]) => ({
      value: pitch,
      label: pitch,
      multiplier: mult,
    }));
  }
}

// =============================================================================
// EXPORTS
// =============================================================================

export const estimateCalculatorService = new EstimateCalculatorService();
export { MATERIAL_LABELS, EXTRAS_PRICING, MATERIAL_COST_PER_SQUARE };
