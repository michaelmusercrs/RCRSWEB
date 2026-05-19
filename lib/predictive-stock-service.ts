/**
 * Predictive Stock Service
 *
 * Forecasts material consumption over the next 14 days by:
 *   1. Pulling signed/scheduled JobNimbus jobs starting in the next 14 days
 *   2. Computing expected material usage per job from category defaults
 *   3. Layering in a weather buffer when NWS forecasts severe hail/wind
 *      for our North Alabama service area
 *   4. Comparing projected usage vs. current available stock per item
 *   5. Surfacing items projected to go negative as actionable shortfalls
 *
 * Outputs feed:
 *   - /portal/inventory/forecast page (UI)
 *   - /api/cron/predictive-stock daily cron (ntfy + email alerts)
 *
 * Free-OSS data sources only:
 *   - api.weather.gov (NWS) via lib/weather-alert-service.ts
 *   - ntfy.sh for push (lib/ntfy-service.ts)
 *
 * Single-roof material defaults are rough — they're meant for
 * planning, not job-level costing. If JN later exposes per-job
 * estimated materials we should prefer that.
 */

import { jobNimbusService, type JobNimbusJob } from './jobnimbus-service';
import { unifiedInventoryService, type InventoryCategory } from './unified-inventory-service';
import { weatherAlertService } from './weather-alert-service';

// =============================================================================
// CONFIG / DEFAULTS
// =============================================================================

/** How far out we project consumption. */
export const FORECAST_HORIZON_DAYS = 14;

/** Buffer multiplier applied when a severe hail/wind alert is forecasted. */
export const STORM_BUFFER_MULTIPLIER = 1.3;

/** Average residential roof, in squares (100 sq ft). Tweakable. */
const AVG_ROOF_SQUARES = 25;

/** Material-per-square defaults for a residential reroof. */
const DEFAULTS_PER_SQUARE: Partial<Record<InventoryCategory, number>> = {
  // Shingles are sold in bundles where 3 bundles ≈ 1 square. Track bundles.
  shingles: 3,
  // Synthetic felt: 1 roll covers 10 squares.
  underlayment: 0.12, // 10 squares per roll, but add ice & water shield margin
  // Drip edge / step flashing per square is small but non-zero.
  flashing: 0.5,
  // Coil nails: 1 box covers ~16 squares.
  nails_fasteners: 0.08,
  // Sealants: 1 tube per ~10 squares for ridge cap / step flash.
  sealants: 0.15,
  // Lumber: usually only on tear-off jobs needing decking. Conservative.
  lumber: 0.3,
  // Ridge vent and pipe boots: 0.05 squares of "unit" coverage.
  ventilation: 0.08,
};

/** Status values from JN that we treat as "actionable, will consume material". */
const SIGNED_STATUS_KEYWORDS = [
  'contract signed',
  'contract',
  'sold',
  'permit',
  'material ordered',
  'materials',
  'scheduled',
  'in progress',
  'work in progress',
];

// =============================================================================
// TYPES
// =============================================================================

export interface JobForecastInput {
  jnid: string;
  jobNumber: string;
  customerName: string;
  scheduledStartDate: string; // ISO date
  status: string;
  squares: number; // estimated roof squares (defaults to AVG_ROOF_SQUARES if unknown)
}

export interface MaterialForecastLine {
  productId: string;
  productName: string;
  category: InventoryCategory;
  unit: string;
  currentQty: number;
  holdQty: number;
  availableQty: number; // currentQty - holdQty
  baseProjectedUsage: number; // pre-buffer
  stormBufferAdded: number; // adjustment applied
  projectedUsage: number; // baseProjectedUsage + stormBufferAdded
  projectedShortfall: number; // max(0, projectedUsage - availableQty)
  suggestedPoQty: number; // shortfall rounded up to vendor minimum (reorderQty)
  contributingJobCount: number;
}

export interface PredictiveForecastResult {
  generatedAt: string;
  horizonDays: number;
  jobCount: number;
  jobs: JobForecastInput[];
  stormBufferApplied: boolean;
  stormReason?: string;
  lines: MaterialForecastLine[];
  shortfalls: MaterialForecastLine[]; // subset where projectedShortfall > 0
}

// =============================================================================
// HELPERS
// =============================================================================

function isSignedAndScheduled(job: JobNimbusJob): boolean {
  const status = (job.status || '').toLowerCase();
  return SIGNED_STATUS_KEYWORDS.some(kw => status.includes(kw));
}

function jobStartWithinHorizon(job: JobNimbusJob, horizonMs: number): boolean {
  // date_start is JN's scheduled start (unix seconds). Fall back to
  // date_end or created_at when missing. Skip if all are absent.
  const startSec = job.date_start || job.date_end || job.created_at;
  if (!startSec) return false;
  const startMs = startSec * 1000;
  const now = Date.now();
  return startMs >= now && startMs <= now + horizonMs;
}

function describeJobName(job: JobNimbusJob): string {
  return job.name || job.number || job.jnid;
}

function estimateSquaresFromJob(job: JobNimbusJob): number {
  // JN doesn't surface squares on the basic job payload. Description
  // sometimes embeds "30 sq" or "30 squares" — best-effort parse.
  const desc = `${job.name || ''} ${job.description || ''}`.toLowerCase();
  const m = desc.match(/(\d{1,3})\s*(?:sq|square)/);
  if (m) {
    const n = Number(m[1]);
    if (Number.isFinite(n) && n > 0 && n < 200) return n;
  }
  return AVG_ROOF_SQUARES;
}

/**
 * Are we currently under (or imminently under) a hail/severe-wind threat that
 * justifies adding the storm buffer? Threshold is "any active or upcoming
 * NWS alert in our service area with severity moderate+ and type hail|wind|storm".
 */
async function shouldApplyStormBuffer(): Promise<{ apply: boolean; reason?: string }> {
  try {
    const alerts = await weatherAlertService.fetchNWSAlerts();
    const trigger = alerts.find(a => {
      if (!a.isActive) return false;
      if (!['hail', 'wind', 'severe_thunderstorm', 'tornado'].includes(a.type)) return false;
      return ['severe', 'extreme', 'moderate'].includes(a.severity);
    });
    if (trigger) {
      return {
        apply: true,
        reason: `${trigger.severity.toUpperCase()} ${trigger.type} alert active: ${trigger.title.slice(0, 80)}`,
      };
    }
    return { apply: false };
  } catch (err) {
    console.warn('[predictive-stock] NWS fetch failed; skipping storm buffer:', err);
    return { apply: false };
  }
}

// =============================================================================
// MAIN
// =============================================================================

/**
 * Generate a 14-day stock forecast.
 *
 * Strategy: enumerate every signed-and-scheduled JN job whose date_start
 * falls inside the horizon, compute its rough material demand from
 * category defaults, sum across jobs, optionally inflate by the storm
 * buffer, then subtract against current inventory.
 */
export async function generateForecast(opts?: {
  horizonDays?: number;
  /** Override the storm-buffer decision (testing). */
  forceStormBuffer?: boolean;
}): Promise<PredictiveForecastResult> {
  const horizonDays = opts?.horizonDays ?? FORECAST_HORIZON_DAYS;
  const horizonMs = horizonDays * 24 * 60 * 60 * 1000;

  // 1. Pull JN jobs (best-effort; if JN is down we still want a forecast
  //    of "what's on the shelf").
  let candidateJobs: JobNimbusJob[] = [];
  try {
    const result = await jobNimbusService.getJobs({ limit: 200 });
    candidateJobs = (result?.results || []).filter(j => isSignedAndScheduled(j) && jobStartWithinHorizon(j, horizonMs));
  } catch (err) {
    console.warn('[predictive-stock] JobNimbus getJobs failed:', err);
    candidateJobs = [];
  }

  const jobInputs: JobForecastInput[] = candidateJobs.map(j => ({
    jnid: j.jnid,
    jobNumber: j.number || '',
    customerName: describeJobName(j),
    scheduledStartDate: j.date_start
      ? new Date(j.date_start * 1000).toISOString()
      : '',
    status: j.status || '',
    squares: estimateSquaresFromJob(j),
  }));

  const totalSquares = jobInputs.reduce((sum, j) => sum + j.squares, 0);

  // 2. Storm buffer decision
  const buffer = opts?.forceStormBuffer !== undefined
    ? { apply: opts.forceStormBuffer, reason: opts.forceStormBuffer ? 'forced via param' : undefined }
    : await shouldApplyStormBuffer();

  // 3. Pull current inventory
  const inventory = await unifiedInventoryService.getInventory();

  // 4. Compute per-item projection.
  //    Strategy: every active item in a category that has a per-square default
  //    gets `totalSquares * default` of demand, evenly split among items
  //    in that category (so we don't bias toward one SKU). This gives the
  //    operator a planning view they can refine with reality.
  const itemsByCategory = new Map<InventoryCategory, typeof inventory>();
  for (const item of inventory) {
    if (!item.active) continue;
    const list = itemsByCategory.get(item.category) || [];
    list.push(item);
    itemsByCategory.set(item.category, list);
  }

  const lines: MaterialForecastLine[] = [];

  for (const [category, items] of itemsByCategory.entries()) {
    const perSquare = DEFAULTS_PER_SQUARE[category];
    if (!perSquare || items.length === 0 || totalSquares === 0) {
      // Still surface the item so the UI can show "no projection — 0 jobs"
      for (const item of items) {
        lines.push({
          productId: item.productId,
          productName: item.productName,
          category: item.category,
          unit: item.unit,
          currentQty: item.currentQty,
          holdQty: item.holdQty,
          availableQty: item.availableQty,
          baseProjectedUsage: 0,
          stormBufferAdded: 0,
          projectedUsage: 0,
          projectedShortfall: 0,
          suggestedPoQty: 0,
          contributingJobCount: jobInputs.length,
        });
      }
      continue;
    }

    const categoryDemand = totalSquares * perSquare;
    const perItemDemand = categoryDemand / items.length;

    for (const item of items) {
      const base = perItemDemand;
      const bufferAmt = buffer.apply ? base * (STORM_BUFFER_MULTIPLIER - 1) : 0;
      const projected = base + bufferAmt;
      const shortfall = Math.max(0, projected - item.availableQty);
      // Round PO suggestion up to the vendor's reorderQty step when known
      const reorderStep = item.reorderQty > 0 ? item.reorderQty : 1;
      const suggestedPo = shortfall > 0
        ? Math.ceil(shortfall / reorderStep) * reorderStep
        : 0;

      lines.push({
        productId: item.productId,
        productName: item.productName,
        category: item.category,
        unit: item.unit,
        currentQty: item.currentQty,
        holdQty: item.holdQty,
        availableQty: item.availableQty,
        baseProjectedUsage: Math.round(base * 100) / 100,
        stormBufferAdded: Math.round(bufferAmt * 100) / 100,
        projectedUsage: Math.round(projected * 100) / 100,
        projectedShortfall: Math.round(shortfall * 100) / 100,
        suggestedPoQty: suggestedPo,
        contributingJobCount: jobInputs.length,
      });
    }
  }

  // Items in categories with no per-square default still appear with 0 demand
  // so the page surfaces them.
  const seen = new Set(lines.map(l => l.productId));
  for (const item of inventory) {
    if (!item.active) continue;
    if (seen.has(item.productId)) continue;
    lines.push({
      productId: item.productId,
      productName: item.productName,
      category: item.category,
      unit: item.unit,
      currentQty: item.currentQty,
      holdQty: item.holdQty,
      availableQty: item.availableQty,
      baseProjectedUsage: 0,
      stormBufferAdded: 0,
      projectedUsage: 0,
      projectedShortfall: 0,
      suggestedPoQty: 0,
      contributingJobCount: jobInputs.length,
    });
  }

  lines.sort((a, b) => b.projectedShortfall - a.projectedShortfall);

  return {
    generatedAt: new Date().toISOString(),
    horizonDays,
    jobCount: jobInputs.length,
    jobs: jobInputs,
    stormBufferApplied: buffer.apply,
    stormReason: buffer.reason,
    lines,
    shortfalls: lines.filter(l => l.projectedShortfall > 0),
  };
}

export const predictiveStockService = {
  generateForecast,
};
