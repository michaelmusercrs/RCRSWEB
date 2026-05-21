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
  hailDerivedDateOfLoss: string | null; // ISO — most recent hail event date, when within 365d
  hailDerivedDateOfLossWithinYear: boolean; // shortcut flag

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

  // Returning customer — when true, the routing layer should auto-route to
  // originalRepSlug if that rep is still active (returning customers go back
  // to the rep who closed them the first time).
  isReturningCustomer: boolean;
  originalRepSlug: string;            // rep who closed this customer originally; '' if none
  originalInstallJnid: string;        // jnid of the prior closed job for audit

  // Commercial — separate signal from residential; tracks estimates-delivered
  // rate per source for commercial leads.
  isCommercial: boolean;
  commercialEstimatesDeliveredRate: number; // 0..1 for this lead's source, when isCommercial
  commercialEstimatesDeliveredBasis: 'derived' | 'prior' | 'na';
  commercialEstimatesDeliveredSampleSize: number;

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
  // dateOfLoss intentionally removed — derived from HailRecon's most recent
  // event within 365d. JN's Date of Loss field is not trusted (often blank
  // or stale). The derived value can be pushed back to JN later.
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
// Weight allocation (sums to 100). BETA — admin-tunable via the settings
// panel; persisted in data/lead-quality-config.json. Defaults reflect:
//   - Returning customer is a strong signal (loyal repeat business)
//   - Hail-derived Date of Loss replaces the old JN-sourced field
//   - Commercial has its own estimates-delivered signal separate from the
//     binary "is it commercial" flag
// ---------------------------------------------------------------------------

export interface LeadQualityWeights {
  hailRisk: number;
  hailRecency: number;
  hailDerivedDateOfLoss: number;
  sourceCloseRate: number;
  areaCloseRate: number;
  returningCustomer: number;
  commercialIntent: number;
  commercialEstimatesDelivered: number;
  estimatedJobValue: number;
  roofComplexity: number;
}

export const DEFAULT_QUALITY_WEIGHTS: LeadQualityWeights = {
  hailRisk: 18,
  hailRecency: 8,
  hailDerivedDateOfLoss: 12,
  sourceCloseRate: 10,
  areaCloseRate: 8,
  returningCustomer: 20,       // heavy weight per stated direction — loyal customers matter
  commercialIntent: 4,          // base flag, low weight
  commercialEstimatesDelivered: 5,
  estimatedJobValue: 10,
  roofComplexity: 5,
};

export interface LeadQualityConfig {
  weights: LeadQualityWeights;
  weightsEnabled?: Partial<Record<keyof LeadQualityWeights, boolean>>;
  updatedAt?: string;
  updatedBy?: string;
}

const QUALITY_CONFIG_PATH = 'data/lead-quality-config.json';

// In-memory config cache so we don't re-read disk on every assignment.
let _configCache: LeadQualityConfig | null = null;
let _configCacheLoadedAt = 0;
const CONFIG_CACHE_TTL_MS = 60_000;

export function getQualityConfig(): LeadQualityConfig {
  if (_configCache && Date.now() - _configCacheLoadedAt < CONFIG_CACHE_TTL_MS) {
    return _configCache;
  }
  try {
    // Lazy require to keep the service Edge-safe if ever imported in a runtime
    // without fs. The disk read only happens server-side.

    const fs = require('fs');

    const path = require('path');
    const raw = fs.readFileSync(path.join(process.cwd(), QUALITY_CONFIG_PATH), 'utf-8');
    _configCache = JSON.parse(raw);
    _configCacheLoadedAt = Date.now();
    return _configCache!;
  } catch {
    return { weights: DEFAULT_QUALITY_WEIGHTS };
  }
}

export function invalidateQualityConfigCache(): void {
  _configCache = null;
  _configCacheLoadedAt = 0;
}

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

type RateStat = { rate: number; n: number };

let closeRateCache: {
  bySource: Map<string, RateStat>;
  byCity: Map<string, RateStat>;
  // Commercial-only rates: separate close-rate AND estimates-delivered stats.
  // Estimates-delivered is the more useful short-term signal for commercial
  // since the close cycle runs months instead of days.
  commercialBySource: Map<string, RateStat>;
  commercialByCity: Map<string, RateStat>;
  commercialEstDeliveredBySource: Map<string, RateStat>;
  computedAt: number;
} | null = null;

const CLOSE_RATE_CACHE_TTL_MS = 30 * 60 * 1000; // 30 min

function isCommercialContact(c: { company?: string; recordType?: string } | undefined): boolean {
  if (!c) return false;
  return !!c.company || /commercial|business|llc|inc/i.test(c.recordType || '');
}

async function buildCloseRateMaps(): Promise<typeof closeRateCache> {
  // Pull recent outcome log + distribution log, join, count won/lost by
  // source and city, with separate breakouts for commercial leads.
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
    const commBySource = new Map<string, { won: number; total: number }>();
    const commByCity = new Map<string, { won: number; total: number }>();
    const commEstDeliveredBySource = new Map<string, { delivered: number; total: number }>();

    for (const log of logs) {
      const outcome = outcomeByLogId.get(log.logId);
      if (!outcome) continue;
      const contact = contactByJnid.get(log.leadId);
      const source = normalizeSource(contact?.source);
      const city = (contact?.city || '').toLowerCase();
      const commercial = isCommercialContact(contact);

      const disp = outcome.finalDisposition;
      const isFinal = disp === 'closed-won' || disp === 'closed-lost';
      const won = disp === 'closed-won' ? 1 : 0;

      if (isFinal) {
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

        if (commercial) {
          const cs = commBySource.get(source) || { won: 0, total: 0 };
          cs.won += won;
          cs.total++;
          commBySource.set(source, cs);
          if (city) {
            const cc = commByCity.get(city) || { won: 0, total: 0 };
            cc.won += won;
            cc.total++;
            commByCity.set(city, cc);
          }
        }
      }

      // Commercial estimates-delivered: tracked even before final disposition.
      // The leading indicator that says "this kind of lead actually GOT TO an
      // estimate" — for commercial leads, that's a meaningful early signal.
      if (commercial) {
        const delivered = outcome.estimateCreatedAt ? 1 : 0;
        const s = commEstDeliveredBySource.get(source) || { delivered: 0, total: 0 };
        s.delivered += delivered;
        s.total++;
        commEstDeliveredBySource.set(source, s);
      }
    }

    const toRateStat = <T extends Record<string, number>>(map: Map<string, T>, num: keyof T, denom: keyof T): Map<string, RateStat> =>
      new Map([...map.entries()].map(([k, v]) => [k, { rate: (v[denom] as number) ? (v[num] as number) / (v[denom] as number) : 0, n: v[denom] as number }]));

    const out = {
      bySource: toRateStat(bySource, 'won', 'total'),
      byCity: toRateStat(byCity, 'won', 'total'),
      commercialBySource: toRateStat(commBySource, 'won', 'total'),
      commercialByCity: toRateStat(commByCity, 'won', 'total'),
      commercialEstDeliveredBySource: toRateStat(commEstDeliveredBySource, 'delivered', 'total'),
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

interface ReturningCustomerMatch {
  isReturning: boolean;
  originalRepSlug: string;      // slug of the rep who closed the original job
  originalInstallJnid: string;  // jnid of the prior closed job (for audit)
}

async function findReturningCustomer(email?: string, phone?: string): Promise<ReturningCustomerMatch> {
  const empty: ReturningCustomerMatch = { isReturning: false, originalRepSlug: '', originalInstallJnid: '' };
  if (!email && !phone) return empty;
  try {
    const contacts = await googleSheetsService.getGeocodedContacts();
    const emailLc = (email || '').toLowerCase();
    const phoneDigits = (phone || '').replace(/\D/g, '');
    // Returning if there's any past install with matching email or phone.
    // Prefer the MOST RECENT install (so the rep recorded is current).
    const matches = contacts.filter(c => {
      if (c.type !== 'install') return false;
      const matchEmail = emailLc && c.email && c.email.toLowerCase() === emailLc;
      const matchPhone = phoneDigits && c.mobilePhone && c.mobilePhone.replace(/\D/g, '') === phoneDigits;
      return matchEmail || matchPhone;
    });
    if (!matches.length) return empty;
    // Sort by lastInteraction desc to get the most recent install
    matches.sort((a, b) => (b.lastInteraction || '').localeCompare(a.lastInteraction || ''));
    const best = matches[0];
    return {
      isReturning: true,
      originalRepSlug: best.salesRep || '',
      originalInstallJnid: best.jnid || '',
    };
  } catch {
    return empty;
  }
}

// ---------------------------------------------------------------------------
// MAIN — computeLeadQuality
// ---------------------------------------------------------------------------

export async function computeLeadQuality(input: LeadQualityInput): Promise<LeadQualityResult> {
  const now = new Date().toISOString();
  const config = getQualityConfig();
  const W = { ...DEFAULT_QUALITY_WEIGHTS, ...config.weights };
  const enabled = config.weightsEnabled || {};
  const isEnabled = (k: keyof LeadQualityWeights) => enabled[k] !== false;

  const sourceLc = normalizeSource(input.source);
  const cityLc = (input.city || '').toLowerCase();
  const isCommercial = !!input.company || /commercial|business|llc|inc/i.test(input.recordType || '');
  const contributions: Record<string, number> = {};
  const unconfirmedNotes: string[] = [];

  // ─── 1. Hail recon ────────────────────────────────────────────────────
  let hailRisk: number | null = null;
  let hailEventCountNearby = 0;
  let hailLargestSizeInches = 0;
  let hailMostRecentDays: number | null = null;
  let hailDerivedDateOfLoss: string | null = null;

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
      const sortedEvents = [...stormReport.hailEvents]
        .map(e => ({ ...e, t: new Date(e.date).getTime() }))
        .filter(e => !isNaN(e.t))
        .sort((a, b) => b.t - a.t);
      if (sortedEvents.length) {
        const mostRecent = sortedEvents[0];
        hailMostRecentDays = Math.floor((Date.now() - mostRecent.t) / 86400000);
        hailDerivedDateOfLoss = new Date(mostRecent.t).toISOString();
      }
      unconfirmedNotes.push(
        `${stormReport.totalHailReports} hail event(s) within 25mi in last 12mo; largest ${stormReport.largestHailSize || 'n/a'}; risk: ${stormReport.riskLevel}.`
      );
    }
  } catch (err) {
    console.warn('[LeadQuality] Storm report failed:', err);
  }

  contributions.hailRisk = isEnabled('hailRisk') && hailRisk != null
    ? Math.round((hailRisk / 100) * W.hailRisk)
    : 0;
  contributions.hailRecency = isEnabled('hailRecency') && hailMostRecentDays != null
    ? Math.round(clamp(1 - hailMostRecentDays / 180, 0, 1) * W.hailRecency)
    : 0;

  // ─── 2. Hail-derived Date of Loss (replaces JN's Date of Loss field) ─
  // If the most-recent hail event is within 365 days, treat that as the
  // effective Date of Loss for insurance-signal purposes. We DO NOT trust
  // JN's Date of Loss field — too often blank or stale. The derived value
  // can be pushed back to JN later as the authoritative date.
  const hailWithinYear = hailMostRecentDays != null && hailMostRecentDays < 365;
  contributions.hailDerivedDateOfLoss = isEnabled('hailDerivedDateOfLoss') && hailWithinYear ? W.hailDerivedDateOfLoss : 0;
  if (hailWithinYear) {
    unconfirmedNotes.push(
      `Date of Loss derived from HailRecon: ${hailDerivedDateOfLoss?.slice(0, 10)} (insurance signal — auto-detected, not from JN).`
    );
  }

  // ─── 3. Source historical close rate ────────────────────────────────
  const maps = await getCloseRateMaps();

  // For commercial leads, prefer the commercial-only source rate when we
  // have enough samples; otherwise fall back to the overall rate.
  let sourceCloseRate = SOURCE_CLOSE_RATE_PRIORS[sourceLc] ?? SOURCE_CLOSE_RATE_PRIORS.unknown;
  let sourceBasis: 'derived' | 'prior' = 'prior';
  let sourceN = 0;
  if (maps) {
    const commercialDerived = isCommercial ? maps.commercialBySource.get(sourceLc) : undefined;
    if (commercialDerived && commercialDerived.n >= MIN_DERIVATION_SAMPLE) {
      sourceCloseRate = commercialDerived.rate;
      sourceBasis = 'derived';
      sourceN = commercialDerived.n;
    } else {
      const derived = maps.bySource.get(sourceLc);
      if (derived && derived.n >= MIN_DERIVATION_SAMPLE) {
        sourceCloseRate = derived.rate;
        sourceBasis = 'derived';
        sourceN = derived.n;
      } else if (derived) {
        sourceN = derived.n;
      }
    }
  }
  const sourceFraction = clamp(sourceCloseRate / 0.6, 0, 1);
  contributions.sourceCloseRate = isEnabled('sourceCloseRate') ? Math.round(sourceFraction * W.sourceCloseRate) : 0;
  if (input.source) {
    unconfirmedNotes.push(
      `Source "${input.source}" closes at ${(sourceCloseRate * 100).toFixed(0)}% historically (${sourceBasis === 'derived' ? `from ${sourceN} ${isCommercial ? 'commercial ' : ''}closed jobs` : 'prior estimate — limited data'}).`
    );
  }

  // ─── 4. Area historical close rate ───────────────────────────────────
  let areaCloseRate = AREA_CLOSE_RATE_PRIORS_BY_CITY[cityLc] ?? AREA_CLOSE_RATE_DEFAULT;
  let areaBasis: 'derived' | 'prior' = 'prior';
  let areaN = 0;
  if (maps && cityLc) {
    const commercialDerived = isCommercial ? maps.commercialByCity.get(cityLc) : undefined;
    if (commercialDerived && commercialDerived.n >= MIN_DERIVATION_SAMPLE) {
      areaCloseRate = commercialDerived.rate;
      areaBasis = 'derived';
      areaN = commercialDerived.n;
    } else {
      const derived = maps.byCity.get(cityLc);
      if (derived && derived.n >= MIN_DERIVATION_SAMPLE) {
        areaCloseRate = derived.rate;
        areaBasis = 'derived';
        areaN = derived.n;
      } else if (derived) {
        areaN = derived.n;
      }
    }
  }
  const areaFraction = clamp(areaCloseRate / 0.35, 0, 1);
  contributions.areaCloseRate = isEnabled('areaCloseRate') ? Math.round(areaFraction * W.areaCloseRate) : 0;
  if (cityLc) {
    unconfirmedNotes.push(
      `${input.city} closes at ${(areaCloseRate * 100).toFixed(0)}% historically (${areaBasis === 'derived' ? `from ${areaN} ${isCommercial ? 'commercial ' : ''}closed jobs in this city` : 'regional prior'}).`
    );
  }

  // ─── 5. Returning customer ───────────────────────────────────────────
  const returningMatch = await findReturningCustomer(input.email, input.phone);
  contributions.returningCustomer = isEnabled('returningCustomer') && returningMatch.isReturning ? W.returningCustomer : 0;
  if (returningMatch.isReturning) {
    unconfirmedNotes.push(
      `Returning customer — has a prior closed job in our system${returningMatch.originalRepSlug ? ` with rep "${returningMatch.originalRepSlug}"` : ''}. Routing layer will auto-route to that rep if still active.`
    );
  }

  // ─── 6. Commercial intent (binary) ───────────────────────────────────
  contributions.commercialIntent = isEnabled('commercialIntent') && isCommercial ? W.commercialIntent : 0;
  if (isCommercial) {
    unconfirmedNotes.push(`Commercial / company lead${input.company ? ` (${input.company})` : ''}.`);
  }

  // ─── 7. Commercial estimates-delivered rate ──────────────────────────
  // For commercial leads, "did we even get to an estimate" is a leading
  // indicator that matters more than "did we win" (commercial close cycles
  // run months, not days).
  let commEstDeliveredRate = 0;
  let commEstBasis: 'derived' | 'prior' | 'na' = 'na';
  let commEstN = 0;
  if (isCommercial && maps) {
    const derived = maps.commercialEstDeliveredBySource.get(sourceLc);
    if (derived && derived.n >= 5) {
      commEstDeliveredRate = derived.rate;
      commEstBasis = 'derived';
      commEstN = derived.n;
    } else {
      commEstDeliveredRate = 0.4;
      commEstBasis = 'prior';
    }
  }
  if (isCommercial && isEnabled('commercialEstimatesDelivered')) {
    contributions.commercialEstimatesDelivered = Math.round(clamp(commEstDeliveredRate, 0, 1) * W.commercialEstimatesDelivered);
    if (commEstBasis === 'derived') {
      unconfirmedNotes.push(
        `Commercial estimates-delivered rate for this source: ${(commEstDeliveredRate * 100).toFixed(0)}% (from ${commEstN} commercial leads).`
      );
    }
  } else {
    contributions.commercialEstimatesDelivered = 0;
  }

  // ─── 8. Estimated job value (when roof measure is in) ────────────────
  let estimatedJobValueScore = 0;
  if (isEnabled('estimatedJobValue') && input.estimatedJobValue && input.estimatedJobValue > 0) {
    const fraction = clamp((input.estimatedJobValue - 5000) / (50000 - 5000), 0, 1);
    estimatedJobValueScore = Math.round(fraction * W.estimatedJobValue);
  }
  contributions.estimatedJobValue = estimatedJobValueScore;

  // ─── 9. Roof complexity ──────────────────────────────────────────────
  let complexityScore = 0;
  if (isEnabled('roofComplexity') && input.roofSqFt && input.roofPitch) {
    const complexity = (input.roofSqFt / 3000) * (input.roofPitch / 6);
    const fraction = clamp(complexity, 0, 1);
    complexityScore = Math.round(fraction * W.roofComplexity);
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
    hailDerivedDateOfLoss,
    hailDerivedDateOfLossWithinYear: hailWithinYear,
    sourceName: input.source || '',
    sourceHistoricalCloseRate: sourceCloseRate,
    sourceCloseRateBasis: sourceBasis,
    sourceSampleSize: sourceN,
    areaName: input.city || input.county || '',
    areaHistoricalCloseRate: areaCloseRate,
    areaCloseRateBasis: areaBasis,
    areaSampleSize: areaN,
    isReturningCustomer: returningMatch.isReturning,
    originalRepSlug: returningMatch.originalRepSlug,
    originalInstallJnid: returningMatch.originalInstallJnid,
    isCommercial,
    commercialEstimatesDeliveredRate: commEstDeliveredRate,
    commercialEstimatesDeliveredBasis: commEstBasis,
    commercialEstimatesDeliveredSampleSize: commEstN,
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
    hailDerivedDateOfLoss: string | null;
    hailDerivedDateOfLossWithinYear: boolean;
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
      hailDerivedDateOfLoss: result.factors.hailDerivedDateOfLoss,
      hailDerivedDateOfLossWithinYear: result.factors.hailDerivedDateOfLossWithinYear,
      sourceName: result.factors.sourceName,
      areaName: result.factors.areaName,
      isReturningCustomer: result.factors.isReturningCustomer,
      isCommercial: result.factors.isCommercial,
    },
    isBeta: true,
  };
}
