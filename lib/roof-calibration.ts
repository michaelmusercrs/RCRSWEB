/**
 * Roof Calibration Service
 * 
 * Manages ground truth data, per-method correction factors, and accuracy tracking.
 * Used by the roof measurement pipeline to weight AI methods and apply corrections.
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

// ── Types ──────────────────────────────────────────────────────────────────

export interface CalibrationMeasurements {
  total_ridge_ft: number;
  total_rake_ft: number;
  total_valley_ft: number;
  total_eave_ft: number;
  total_hip_ft: number;
}

export interface AICalibrationResult {
  method: string;        // e.g. "vertex-gemini-2.0-flash"
  provider: string;      // "vertex" | "ai-studio" | "ollama"
  model: string;         // e.g. "gemini-2.0-flash"
  imageSet: string;      // e.g. "google-sat" | "esri" | "street-view"
  ridge: number;
  rake: number;
  valley: number;
  eave: number;
  hip: number;
}

export interface CorrectionFactors {
  ridge_factor: number;
  rake_factor: number;
  valley_factor: number;
  eave_factor: number;
  hip_factor: number;
}

export interface CalibrationEntry {
  address: string;
  date: string;
  roofArea_sqft?: number;
  measurements: CalibrationMeasurements;
  source: 'manual' | 'eagleview' | 'photo_verified';
  aiResults: AICalibrationResult[];
  corrections: Record<string, CorrectionFactors>;
}

export interface MethodAccuracyStats {
  jobs: number;
  avgError: number;        // 0-1 scale (0.04 = 4% average error)
  reliable: boolean;       // avgError < 0.10
  correctionFactors: CorrectionFactors;
}

export interface PhotoCorrections {
  sampleCount: number;
  avgDelta: {
    ridge: number;
    rake: number;
    valley: number;
    eave: number;
    hip: number;
  };
}

export interface CalibrationData {
  calibrations: CalibrationEntry[];
  methodAccuracy: Record<string, MethodAccuracyStats>;
  photoCorrections: PhotoCorrections;
}

// ── File I/O ───────────────────────────────────────────────────────────────

const DATA_DIR = join(process.cwd(), 'data');
const CALIBRATION_FILE = join(DATA_DIR, 'roof-calibration.json');

function ensureDataDir() {
  if (!existsSync(DATA_DIR)) {
    mkdirSync(DATA_DIR, { recursive: true });
  }
}

export function loadCalibrationData(): CalibrationData {
  ensureDataDir();
  if (!existsSync(CALIBRATION_FILE)) {
    const empty: CalibrationData = {
      calibrations: [],
      methodAccuracy: {},
      photoCorrections: { sampleCount: 0, avgDelta: { ridge: 0, rake: 0, valley: 0, eave: 0, hip: 0 } },
    };
    writeFileSync(CALIBRATION_FILE, JSON.stringify(empty, null, 2));
    return empty;
  }
  try {
    return JSON.parse(readFileSync(CALIBRATION_FILE, 'utf-8'));
  } catch {
    return {
      calibrations: [],
      methodAccuracy: {},
      photoCorrections: { sampleCount: 0, avgDelta: { ridge: 0, rake: 0, valley: 0, eave: 0, hip: 0 } },
    };
  }
}

export function saveCalibrationData(data: CalibrationData): void {
  ensureDataDir();
  writeFileSync(CALIBRATION_FILE, JSON.stringify(data, null, 2));
}

// ── Correction Factor Calculation ──────────────────────────────────────────

const MEAS_KEYS = ['ridge', 'rake', 'valley', 'eave', 'hip'] as const;
type MeasKey = typeof MEAS_KEYS[number];

function calcCorrectionFactor(groundTruth: number, aiValue: number): number {
  if (aiValue <= 0 || groundTruth <= 0) return 1.0;
  return Math.max(0.5, Math.min(2.0, groundTruth / aiValue)); // clamp to 0.5x-2.0x
}

function calcError(groundTruth: CalibrationMeasurements, ai: AICalibrationResult): number {
  let totalError = 0;
  let count = 0;
  for (const key of MEAS_KEYS) {
    const gt = groundTruth[`total_${key}_ft` as keyof CalibrationMeasurements];
    const aiVal = ai[key];
    if (gt > 0 && aiVal > 0) {
      totalError += Math.abs(gt - aiVal) / gt;
      count++;
    }
  }
  return count > 0 ? totalError / count : 1.0;
}

// ── Core Operations ────────────────────────────────────────────────────────

/**
 * Add a calibration entry with ground truth measurements.
 * Recalculates all correction factors and method accuracy scores.
 */
export function addCalibration(
  address: string,
  measurements: CalibrationMeasurements,
  source: CalibrationEntry['source'],
  aiResults: AICalibrationResult[],
  roofArea_sqft?: number,
): CalibrationData {
  const data = loadCalibrationData();

  // Build correction factors for each AI method
  const corrections: Record<string, CorrectionFactors> = {};
  for (const ai of aiResults) {
    corrections[ai.method] = {
      ridge_factor: calcCorrectionFactor(measurements.total_ridge_ft, ai.ridge),
      rake_factor: calcCorrectionFactor(measurements.total_rake_ft, ai.rake),
      valley_factor: calcCorrectionFactor(measurements.total_valley_ft, ai.valley),
      eave_factor: calcCorrectionFactor(measurements.total_eave_ft, ai.eave),
      hip_factor: calcCorrectionFactor(measurements.total_hip_ft, ai.hip),
    };
  }

  const entry: CalibrationEntry = {
    address,
    date: new Date().toISOString().split('T')[0],
    roofArea_sqft,
    measurements,
    source,
    aiResults,
    corrections,
  };

  // Replace existing entry for same address or append
  const existingIdx = data.calibrations.findIndex(c => c.address.toLowerCase() === address.toLowerCase());
  if (existingIdx >= 0) {
    data.calibrations[existingIdx] = entry;
  } else {
    data.calibrations.push(entry);
  }

  // Recalculate method accuracy across all calibrations
  recalculateMethodAccuracy(data);

  saveCalibrationData(data);
  return data;
}

/**
 * Recalculate per-method accuracy stats from all calibration entries.
 */
function recalculateMethodAccuracy(data: CalibrationData): void {
  const methodErrors: Record<string, number[]> = {};
  const methodFactors: Record<string, CorrectionFactors[]> = {};

  for (const cal of data.calibrations) {
    for (const ai of cal.aiResults) {
      if (!methodErrors[ai.method]) {
        methodErrors[ai.method] = [];
        methodFactors[ai.method] = [];
      }
      methodErrors[ai.method].push(calcError(cal.measurements, ai));
      if (cal.corrections[ai.method]) {
        methodFactors[ai.method].push(cal.corrections[ai.method]);
      }
    }
  }

  data.methodAccuracy = {};
  for (const [method, errors] of Object.entries(methodErrors)) {
    const avgError = errors.reduce((s, e) => s + e, 0) / errors.length;
    const factors = methodFactors[method] || [];

    // Average correction factors across all jobs
    const avgFactors: CorrectionFactors = {
      ridge_factor: 1, rake_factor: 1, valley_factor: 1, eave_factor: 1, hip_factor: 1,
    };
    if (factors.length > 0) {
      for (const key of ['ridge_factor', 'rake_factor', 'valley_factor', 'eave_factor', 'hip_factor'] as const) {
        avgFactors[key] = factors.reduce((s, f) => s + f[key], 0) / factors.length;
      }
    }

    data.methodAccuracy[method] = {
      jobs: errors.length,
      avgError: Math.round(avgError * 1000) / 1000,
      reliable: avgError < 0.10,
      correctionFactors: avgFactors,
    };
  }
}

/**
 * Get the weight for a method based on calibration data.
 * - Reliable (avgError < 10%): weight 1.0
 * - Moderate (10-30%): weight 0.5
 * - Unreliable (>30%): weight 0.1
 * - Unknown: weight 0.5
 */
export function getMethodWeight(method: string, data?: CalibrationData): number {
  const d = data || loadCalibrationData();
  const stats = d.methodAccuracy[method];
  if (!stats) return 0.5; // unknown method
  if (stats.avgError < 0.10) return 1.0;
  if (stats.avgError < 0.30) return 0.5;
  return 0.1;
}

/**
 * Get correction factors for a method. Returns identity factors if none exist.
 */
export function getCorrectionFactors(method: string, data?: CalibrationData): CorrectionFactors {
  const d = data || loadCalibrationData();
  const stats = d.methodAccuracy[method];
  if (!stats) return { ridge_factor: 1, rake_factor: 1, valley_factor: 1, eave_factor: 1, hip_factor: 1 };
  return stats.correctionFactors;
}

/**
 * Apply correction factors to raw AI measurements.
 */
export function applyCorrectionFactors(
  measurements: { total_ridge_ft: number; total_rake_ft: number; total_valley_ft: number; total_eave_ft: number; total_hip_ft: number },
  factors: CorrectionFactors,
): typeof measurements {
  return {
    total_ridge_ft: Math.round(measurements.total_ridge_ft * factors.ridge_factor * 10) / 10,
    total_rake_ft: Math.round(measurements.total_rake_ft * factors.rake_factor * 10) / 10,
    total_valley_ft: Math.round(measurements.total_valley_ft * factors.valley_factor * 10) / 10,
    total_eave_ft: Math.round(measurements.total_eave_ft * factors.eave_factor * 10) / 10,
    total_hip_ft: Math.round(measurements.total_hip_ft * factors.hip_factor * 10) / 10,
  };
}

/**
 * Track photo-based corrections (satellite vs enhanced measurement deltas).
 */
export function trackPhotoCorrection(
  satelliteMeasurements: CalibrationMeasurements,
  enhancedMeasurements: CalibrationMeasurements,
): void {
  const data = loadCalibrationData();
  const pc = data.photoCorrections;
  const n = pc.sampleCount;

  // Running average of deltas
  for (const key of MEAS_KEYS) {
    const satKey = `total_${key}_ft` as keyof CalibrationMeasurements;
    const satVal = satelliteMeasurements[satKey];
    const enhVal = enhancedMeasurements[satKey];
    if (satVal > 0) {
      const delta = (enhVal - satVal) / satVal; // fractional delta
      pc.avgDelta[key] = (pc.avgDelta[key] * n + delta) / (n + 1);
    }
  }
  pc.sampleCount = n + 1;

  saveCalibrationData(data);
}

/**
 * Run cross-job consistency analysis (for test mode).
 * Compares method results across multiple addresses to find reliable methods.
 */
export function analyzeMethodConsistency(
  jobResults: { address: string; aiResults: AICalibrationResult[] }[]
): Record<string, { consistency: number; avgValues: Record<MeasKey, number>; reliable: boolean }> {
  // Group by method
  const methodData: Record<string, Record<MeasKey, number[]>> = {};

  for (const job of jobResults) {
    for (const ai of job.aiResults) {
      if (!methodData[ai.method]) {
        methodData[ai.method] = { ridge: [], rake: [], valley: [], eave: [], hip: [] };
      }
      for (const key of MEAS_KEYS) {
        if (ai[key] > 0) methodData[ai.method][key].push(ai[key]);
      }
    }
  }

  // For each method, calculate coefficient of variation (stddev/mean) across jobs
  // Lower CV = more consistent = more reliable
  const result: Record<string, { consistency: number; avgValues: Record<MeasKey, number>; reliable: boolean }> = {};

  for (const [method, data] of Object.entries(methodData)) {
    let totalCV = 0;
    let cvCount = 0;
    const avgValues = {} as Record<MeasKey, number>;

    for (const key of MEAS_KEYS) {
      const vals = data[key];
      if (vals.length < 2) {
        avgValues[key] = vals[0] || 0;
        continue;
      }
      const mean = vals.reduce((s, v) => s + v, 0) / vals.length;
      const variance = vals.reduce((s, v) => s + (v - mean) ** 2, 0) / vals.length;
      const stddev = Math.sqrt(variance);
      const cv = mean > 0 ? stddev / mean : 0;
      totalCV += cv;
      cvCount++;
      avgValues[key] = Math.round(mean * 10) / 10;
    }

    const avgCV = cvCount > 0 ? totalCV / cvCount : 1;
    result[method] = {
      consistency: Math.round((1 - Math.min(1, avgCV)) * 100) / 100, // 0-1, higher = more consistent
      avgValues,
      reliable: avgCV < 0.25, // less than 25% coefficient of variation
    };
  }

  // Cross-method agreement: methods that agree with each other are more likely correct
  const methods = Object.keys(result);
  if (methods.length >= 2) {
    for (const m1 of methods) {
      let agreementScore = 0;
      let comparisons = 0;
      for (const m2 of methods) {
        if (m1 === m2) continue;
        for (const key of MEAS_KEYS) {
          const v1 = result[m1].avgValues[key];
          const v2 = result[m2].avgValues[key];
          if (v1 > 0 && v2 > 0) {
            const diff = Math.abs(v1 - v2) / Math.max(v1, v2);
            agreementScore += 1 - Math.min(1, diff);
            comparisons++;
          }
        }
      }
      if (comparisons > 0) {
        // Blend self-consistency with cross-method agreement
        const crossAgreement = agreementScore / comparisons;
        result[m1].consistency = Math.round(((result[m1].consistency + crossAgreement) / 2) * 100) / 100;
        result[m1].reliable = result[m1].consistency > 0.7;
      }
    }
  }

  return result;
}

/**
 * Auto-generate initial method accuracy from test mode results (no ground truth needed).
 * Uses cross-job consistency + cross-method agreement as reliability proxy.
 */
export function autoCalibrate(
  jobResults: { address: string; aiResults: AICalibrationResult[] }[]
): CalibrationData {
  const data = loadCalibrationData();
  const consistency = analyzeMethodConsistency(jobResults);

  for (const [method, stats] of Object.entries(consistency)) {
    // Don't overwrite manual calibration data
    if (data.methodAccuracy[method]?.jobs > 0) continue;

    data.methodAccuracy[method] = {
      jobs: 0, // 0 = auto-calibrated, not manual
      avgError: Math.round((1 - stats.consistency) * 1000) / 1000,
      reliable: stats.reliable,
      correctionFactors: { ridge_factor: 1, rake_factor: 1, valley_factor: 1, eave_factor: 1, hip_factor: 1 },
    };
  }

  saveCalibrationData(data);
  return data;
}
