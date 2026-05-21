/**
 * Lead Quality Service — *BETA*
 *
 * Computes a 0–100 quality score per inbound lead from the data we already
 * have: hail recon report, historical source close rates, area priors,
 * date-of-loss signal, returning customer, commercial flag, and roof measure
 * when available.
 *
 * Lifecycle:
 *   - **Preliminary score** at distribution time (no roof imagery yet)
 *   - **Updated score** after roof-measure-service produces sq/pitch
 *   - **Future**: local AI image evaluation will further refine the score
 *
 * Visibility:
 *   - Owner / Admin / Manager: see score + factor breakdown
 *   - Sales rep: NEVER sees the score — only raw inputs labeled
 *     "unconfirmed preliminary intelligence" (via a separate API)
 *   - Customer: NEVER sees anything from this module
 *
 * BETA: weights are educated-guesses tied to current heuristics. They'll be
 * recalibrated automatically once the outcome log has enough closed-won/lost
 * data to feed `scripts/lead-distro-recalibrate.mjs` over this module's
 * factors.
 */

import { stormReportService } from './storm-report-service';
import { googleSheetsService } from './google-sheets-service';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type QualityBand = 'low' | 'medium' | 'high' | 'premium';
export type QualityConfidence = 'preliminary' | 'updated' | 'unavailable';

export interface LeadQualityFactors {
  // Hail / storm
  hailRiskScore: number | null;       // 0-100 from storm report riskScore
  hailEventCountNearby: number;
  hailLargestSizeInches: number;
  hailMostRecentDays: number | null;  // days since most recent qualifying event

  // Insurance signal
  dateOfLossWithinYear: boolean;

  // Source
  sourceName: string;
  sourceHistoricalCloseRate: number;  // 0..1 — derived or prior
  sourceCloseRateBasis: 'derived' | 'prior';
  sourceSampleSize: number;           // 0 if prior-only

  // Area
  areaName: string;                   // city or county
  areaHistoricalCloseRate: number;    // 0..1
  areaCloseRateBasis: 'derived' | 'prior';
  areaSampleSize: number;

  // Customer-level
  isReturningCustomer: boolean;
  isCommercial: boolean;

  // Roof / property (filled later by recompute hook)
  roofSqFt: number | null;
  roofPitch: number | null;
  estimatedJobValue: number | null;
}

export interface LeadQualityResult {
  score: number;                              // 0-100
  band: QualityBand;
  factors: LeadQualityFactors;
  factorContributions: Record<string, number>; // weighted points per factor
  confidence: QualityConfidence;
  isBeta: true;
  computedAt: string;
  unconfirmedNotes: string[];                  // human-readable bullets safe to surface to reps
}

export interface LeadQualityInput {
  leadId: string;
  address: string;
  city?: string;
  state?: string;
  zip?: string;
  county?: string;
  source?: string;                  // 'Yard Sign', 'Google', 'Referral', etc.
  dateOfLoss?: string;              // ISO
  recordType?: string;              // 'Customer', 'Commercial', etc.
  company?: string;
  email?: string;
  phone?: string;
  // Optional pre-computed roof data (provided by recompute hook)
  roofSqFt?: number;
  roofPitch?: number;
  estimatedJobValue?: number;
}

// ---------------------------------------------------------------------------
// Priors (used when we don't have enough outcome data yet for derivation)
// Calibration target: refine these once the outcome log has ≥200 closed rows.
// ---------------------------------------------------------------------------

const SOURCE_CLOSE_RATE_PRIORS: Record<string, number> = {
  referral: 0.45,
  'yard sign': 0.22,
  'door knock': 0.30,
  google: 0.08,
  facebook: 0.05,
  angi: 0.10,
  homeadvisor: 0.10,
  website: 0.12,
  'web form': 0.12,
  'phone call': 0.18,
  phone: 0.18,
  'walk-in': 0.25,
  insurance: 0.55,
  bni: 0.40,
  unknown: 0.15,
};

// City-level priors derived from regional hail-risk + customer density.
// These mirror the constants in storm-report-service.ts so the two systems
// agree on which areas are "premium" for roofing leads.
const AREA_CLOSE_RATE_PRIORS_BY_CITY: Record<string, number> = {
  huntsville: 0.28,
  madison: 0.28,
  decatur: 0.26,
  hartselle: 0.26,
  cullman: 0.25,
  athens: 0.24,
  florence: 0.22,
  birmingham: 0.20,
  albertville: 0.22,
  guntersville: 0.22,
  scottsboro: 0.21,
  moulton: 0.22,
};
const AREA_CLOSE_RATE_DEFAULT = 0.18;

// Sample size below which we use the prior instead of the derived rate.
// Keeps a single fluky early outcome from skewing the system.
const MIN_DERIVATION_SAMPLE = 15;

// ---------------------------------------------------------------------------
// Weight allocation (sums to 100). BETA — tune as outcome data lands.
// ---------------------------------------------------------------------------

const WEIGHTS = {
  hailRisk: 25,             // recent local hail event presence + severity
  hailRecency: 10,          // bonus for very recent events (<90d)
  dateOfLoss: 15,           // insurance signal — known damage event
  sourceCloseRate: 15,      // historical close-rate by lead source
  areaCloseRate: 10,        // historical close-rate by city
  returningCustomer: 5,
  commercial: 5,
  estimatedJobValue: 10,    // dollar-value band (when roof measure available)
  roofComplexity: 5,        // sq ft × pitch (when available)
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function normalizeSource(s?: string): string {
  if (!s) return 'unknown';
  return s.toLowerCase().trim();
}

function bandFromScore(score: number): QualityBand {
  if (score >= 81) return 'premium';
  if (score >= 61) return 'high';
  if (score >= 31) return 'medium';
  return 'low';
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

// ---------------------------------------------------------------------------
// Derived close-rate lookup. Uses the outcome log + distribution log when
// available, falls back to priors.
// ---------------------------------------------------------------------------

let closeRateCache: {
  bySource: Map<string, { rate: number; n: number }>;
  byCity: Map<string, { rate: number; n: number }>;
  computedAt: number;
} | null = null;

const CLOSE_RATE_CACHE_TTL_MS = 30 * 60 * 1000; // 30 min

async function buildCloseRateMaps(): Promise<typeof closeRateCache> {
  // Pull recent outcome log + distribution log, join, count won/lost by source and city.
  try {
    const [logs, outcomes, contacts] = await Promise.all([
      googleSheetsService.getDistributionLogs({ limit: 5000 }),
      googleSheetsService.getLeadOutcomeLogs({ limit: 5000 }),
      googleSheetsService.getGeocodedContacts(),
    ]);

    const outcomeByLogId = new Map(outcomes.map(o => [o.logId, o]));
    const contactByJnid = new Map(contacts.map(c => [c.jnid, c]));

    const bySource = new Map<string, { won: number; total: number }>();
    const byCity = new Map<string, { won: number; total: number }>();

    for (const log of logs) {
      const outcome = outcomeByLogId.get(log.logId);
      if (!outcome) continue;
      const disp = outcome.finalDisposition;
      if (disp !== 'closed-won' && disp !== 'closed-lost') continue;
      const won = disp === 'closed-won' ? 1 : 0;

      const contact = contactByJnid.get(log.leadId);
      const source = normalizeSource(contact?.source);
      const city = (contact?.city || '').toLowerCase();

      const s = bySource.get(source) || { won: 0, total: 0 };
      s.won += won;
      s.total++;
      bySource.set(source, s);

      if (city) {
        const c = byCity.get(city) || { won: 0, total: 0 };
        c.won += won;
        c.total++;
        byCity.set(city, c);
      }
    }

    const out = {
      bySource: new Map([...bySource.entries()].map(([k, v]) => [k, { rate: v.won / v.total, n: v.total }])),
      byCity: new Map([...byCity.entries()].map(([k, v]) => [k, { rate: v.won / v.total, n: v.total }])),
      computedAt: Date.now(),
    };
    closeRateCache = out;
    return out;
  } catch (err) {
    console.warn('[LeadQuality] Failed to build close-rate maps:', err);
    return null;
  }
}

async function getCloseRateMaps() {
  if (closeRateCache && Date.now() - closeRateCache.computedAt < CLOSE_RATE_CACHE_TTL_MS) {
    return closeRateCache;
  }
  return buildCloseRateMaps();
}

// ---------------------------------------------------------------------------
// Returning customer lookup
// ---------------------------------------------------------------------------

async function isReturningCustomer(email?: string, phone?: string): Promise<boolean> {
  if (!email && !phone) return false;
  try {
    const contacts = await googleSheetsService.getGeocodedContacts();
    const emailLc = (email || '').toLowerCase();
    const phoneDigits = (phone || '').replace(/\D/g, '');
    // Returning if there's any past contact with matching email or phone AND
    // type is 'install' (means they've closed a job before)
    return contacts.some(c => {
      if (c.type !== 'install') return false;
      const matchEmail = emailLc && c.email && c.email.toLowerCase() === emailLc;
      const matchPhone = phoneDigits && c.mobilePhone && c.mobilePhone.replace(/\D/g, '') === phoneDigits;
      return matchEmail || matchPhone;
    });
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// MAIN — computeLeadQuality
// ---------------------------------------------------------------------------

export async function computeLeadQuality(input: LeadQualityInput): Promise<LeadQualityResult> {
  const now = new Date().toISOString();
  const sourceLc = normalizeSource(input.source);
  const cityLc = (input.city || '').toLowerCase();
  const contributions: Record<string, number> = {};
  const unconfirmedNotes: string[] = [];

  // ─── 1. Hail recon ────────────────────────────────────────────────────
  let hailRisk: number | null = null;
  let hailEventCountNearby = 0;
  let hailLargestSizeInches = 0;
  let hailMostRecentDays: number | null = null;

  try {
    const stormReport = await stormReportService.generateReport({
      address: input.address,
      city: input.city || '',
      state: input.state || 'AL',
      zip: input.zip || '',
      daysBack: 365,
      radiusMiles: 25,
      leadId: input.leadId,
    });
    hailRisk = stormReport.riskScore;
    hailEventCountNearby = stormReport.totalHailReports;
    hailLargestSizeInches = stormReport.largestHailSizeNum || 0;
    if (stormReport.hailEvents.length > 0) {
      const mostRecent = stormReport.hailEvents
        .map(e => new Date(e.date).getTime())
        .filter(t => !isNaN(t))
        .sort((a, b) => b - a)[0];
      if (mostRecent) {
        hailMostRecentDays = Math.floor((Date.now() - mostRecent) / 86400000);
      }
      unconfirmedNotes.push(
        `${stormReport.totalHailReports} hail event(s) within 25mi in last 12mo; largest ${stormReport.largestHailSize || 'n/a'}; risk: ${stormReport.riskLevel}.`
      );
    }
  } catch (err) {
    console.warn('[LeadQuality] Storm report failed:', err);
  }

  if (hailRisk != null) {
    contributions.hailRisk = Math.round((hailRisk / 100) * WEIGHTS.hailRisk);
  } else {
    contributions.hailRisk = 0;
  }
  // Recency bonus: full WEIGHTS.hailRecency for events <30d, decay to 0 at 180d
  if (hailMostRecentDays != null) {
    const recencyFraction = clamp(1 - hailMostRecentDays / 180, 0, 1);
    contributions.hailRecency = Math.round(recencyFraction * WEIGHTS.hailRecency);
  } else {
    contributions.hailRecency = 0;
  }

  // ─── 2. Date of loss signal ──────────────────────────────────────────
  let dateOfLossWithinYear = false;
  if (input.dateOfLoss) {
    const dt = new Date(input.dateOfLoss).getTime();
    if (!isNaN(dt) && Date.now() - dt < 365 * 86400000) {
      dateOfLossWithinYear = true;
      unconfirmedNotes.push(`Lead has a Date of Loss within the last 12 months — insurance signal.`);
    }
  }
  contributions.dateOfLoss = dateOfLossWithinYear ? WEIGHTS.dateOfLoss : 0;

  // ─── 3. Source historical close rate ────────────────────────────────
  const maps = await getCloseRateMaps();
  let sourceCloseRate = SOURCE_CLOSE_RATE_PRIORS[sourceLc] ?? SOURCE_CLOSE_RATE_PRIORS.unknown;
  let sourceBasis: 'derived' | 'prior' = 'prior';
  let sourceN = 0;
  if (maps) {
    const derived = maps.bySource.get(sourceLc);
    if (derived && derived.n >= MIN_DERIVATION_SAMPLE) {
      sourceCloseRate = derived.rate;
      sourceBasis = 'derived';
      sourceN = derived.n;
    } else if (derived) {
      sourceN = derived.n;
    }
  }
  // Normalize: a 0.45 source vs the typical 0.15 = strong signal.
  // Map rates 0.0-0.6 to 0-1 contribution fraction.
  const sourceFraction = clamp(sourceCloseRate / 0.6, 0, 1);
  contributions.sourceCloseRate = Math.round(sourceFraction * WEIGHTS.sourceCloseRate);
  if (input.source) {
    unconfirmedNotes.push(
      `Source "${input.source}" closes at ${(sourceCloseRate * 100).toFixed(0)}% historically (${sourceBasis === 'derived' ? `from ${sourceN} closed jobs` : 'prior estimate — limited data'}).`
    );
  }

  // ─── 4. Area historical close rate ───────────────────────────────────
  let areaCloseRate = AREA_CLOSE_RATE_PRIORS_BY_CITY[cityLc] ?? AREA_CLOSE_RATE_DEFAULT;
  let areaBasis: 'derived' | 'prior' = 'prior';
  let areaN = 0;
  if (maps && cityLc) {
    const derived = maps.byCity.get(cityLc);
    if (derived && derived.n >= MIN_DERIVATION_SAMPLE) {
      areaCloseRate = derived.rate;
      areaBasis = 'derived';
      areaN = derived.n;
    } else if (derived) {
      areaN = derived.n;
    }
  }
  const areaFraction = clamp(areaCloseRate / 0.35, 0, 1); // 35% is the historical ceiling
  contributions.areaCloseRate = Math.round(areaFraction * WEIGHTS.areaCloseRate);
  if (cityLc) {
    unconfirmedNotes.push(
      `${input.city} closes at ${(areaCloseRate * 100).toFixed(0)}% historically (${areaBasis === 'derived' ? `from ${areaN} closed jobs in this city` : 'regional prior'}).`
    );
  }

  // ─── 5. Returning customer ───────────────────────────────────────────
  const returning = await isReturningCustomer(input.email, input.phone);
  contributions.returningCustomer = returning ? WEIGHTS.returningCustomer : 0;
  if (returning) {
    unconfirmedNotes.push(`Returning customer — has a prior closed job in our system.`);
  }

  // ─── 6. Commercial flag ──────────────────────────────────────────────
  const isCommercial = !!input.company || /commercial|business|llc|inc/i.test(input.recordType || '');
  contributions.commercial = isCommercial ? WEIGHTS.commercial : 0;
  if (isCommercial) {
    unconfirmedNotes.push(`Commercial / company lead${input.company ? ` (${input.company})` : ''}.`);
  }

  // ─── 7. Estimated job value (when roof measure is in) ────────────────
  let estimatedJobValueScore = 0;
  if (input.estimatedJobValue && input.estimatedJobValue > 0) {
    // Map $5k-$50k to 0-1 fraction
    const fraction = clamp((input.estimatedJobValue - 5000) / (50000 - 5000), 0, 1);
    estimatedJobValueScore = Math.round(fraction * WEIGHTS.estimatedJobValue);
  }
  contributions.estimatedJobValue = estimatedJobValueScore;

  // ─── 8. Roof complexity ──────────────────────────────────────────────
  let complexityScore = 0;
  if (input.roofSqFt && input.roofPitch) {
    // Big complex roofs are higher-margin. Map sq ft × pitch normalized.
    const complexity = (input.roofSqFt / 3000) * (input.roofPitch / 6);
    const fraction = clamp(complexity, 0, 1);
    complexityScore = Math.round(fraction * WEIGHTS.roofComplexity);
  }
  contributions.roofComplexity = complexityScore;

  // ─── Total ───────────────────────────────────────────────────────────
  const score = Math.min(100, Object.values(contributions).reduce((a, b) => a + b, 0));
  const band = bandFromScore(score);
  const confidence: QualityConfidence =
    (input.roofSqFt && input.roofPitch) ? 'updated' : 'preliminary';

  const factors: LeadQualityFactors = {
    hailRiskScore: hailRisk,
    hailEventCountNearby,
    hailLargestSizeInches,
    hailMostRecentDays,
    dateOfLossWithinYear,
    sourceName: input.source || '',
    sourceHistoricalCloseRate: sourceCloseRate,
    sourceCloseRateBasis: sourceBasis,
    sourceSampleSize: sourceN,
    areaName: input.city || input.county || '',
    areaHistoricalCloseRate: areaCloseRate,
    areaCloseRateBasis: areaBasis,
    areaSampleSize: areaN,
    isReturningCustomer: returning,
    isCommercial,
    roofSqFt: input.roofSqFt || null,
    roofPitch: input.roofPitch || null,
    estimatedJobValue: input.estimatedJobValue || null,
  };

  return {
    score,
    band,
    factors,
    factorContributions: contributions,
    confidence,
    isBeta: true,
    computedAt: now,
    unconfirmedNotes,
  };
}

/**
 * Recompute a lead's quality score after the roof has been measured. Called
 * by roof-measure-service (or any future post-job hook — local AI image
 * eval, lidar, etc.). Persists the refreshed score to the distribution log
 * row with confidence='updated'.
 *
 * Wiring: callers that have BOTH a leadId AND a fresh roof measurement
 * (sqFt + pitch) should invoke this. The intended callsites are:
 *   - app/api/roof-measure/route.ts        (when measurement is for a known lead)
 *   - app/api/portal/roof-measure/route.ts (manual measure from admin)
 *   - app/api/roof-report/route.ts         (when the report is keyed to a lead)
 *   - any future local-AI image eval cron that processes a queue of new leads
 *
 * No-op if the lead has no distribution log entry yet.
 */
export async function recomputeLeadQuality(params: {
  leadId: string;
  address: string;
  city?: string;
  state?: string;
  zip?: string;
  source?: string;
  // The post-measure inputs that bump confidence to 'updated'
  roofSqFt?: number;
  roofPitch?: number;
  estimatedJobValue?: number;
  // Other context if available
  county?: string;
  dateOfLoss?: string;
  recordType?: string;
  company?: string;
  email?: string;
  phone?: string;
}): Promise<LeadQualityResult | null> {
  // Find the existing distribution log row
  const logId = await googleSheetsService.findDistributionLogIdByLeadId(params.leadId);
  if (!logId) {
    console.warn(`[LeadQuality] recompute: no distribution log entry for leadId ${params.leadId}`);
    return null;
  }

  const result = await computeLeadQuality({
    leadId: params.leadId,
    address: params.address,
    city: params.city,
    state: params.state,
    zip: params.zip,
    county: params.county,
    source: params.source,
    dateOfLoss: params.dateOfLoss,
    recordType: params.recordType,
    company: params.company,
    email: params.email,
    phone: params.phone,
    roofSqFt: params.roofSqFt,
    roofPitch: params.roofPitch,
    estimatedJobValue: params.estimatedJobValue,
  });

  await googleSheetsService.updateDistributionLogQuality(logId, {
    leadQualityScore: String(result.score),
    leadQualityBand: result.band,
    leadQualityFactors: JSON.stringify(result.factors),
    leadQualityContributions: JSON.stringify(result.factorContributions),
    leadQualityConfidence: result.confidence,
    leadQualityComputedAt: result.computedAt,
  });

  return result;
}

/**
 * Strip everything sensitive — score, band, factor weights, contributions —
 * leaving only the raw unconfirmed-intelligence bullets safe to surface to
 * sales reps. Never call this for customers.
 */
export function repSafeUnconfirmedContext(result: LeadQualityResult): {
  unconfirmedNotes: string[];
  preliminaryFactsForDisclosure: {
    hailEventCountNearby: number;
    hailLargestSizeInches: number;
    hailMostRecentDays: number | null;
    dateOfLossWithinYear: boolean;
    sourceName: string;
    areaName: string;
    isReturningCustomer: boolean;
    isCommercial: boolean;
  };
  isBeta: true;
} {
  return {
    unconfirmedNotes: result.unconfirmedNotes,
    preliminaryFactsForDisclosure: {
      hailEventCountNearby: result.factors.hailEventCountNearby,
      hailLargestSizeInches: result.factors.hailLargestSizeInches,
      hailMostRecentDays: result.factors.hailMostRecentDays,
      dateOfLossWithinYear: result.factors.dateOfLossWithinYear,
      sourceName: result.factors.sourceName,
      areaName: result.factors.areaName,
      isReturningCustomer: result.factors.isReturningCustomer,
      isCommercial: result.factors.isCommercial,
    },
    isBeta: true,
  };
}
