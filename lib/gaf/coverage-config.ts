/**
 * GAF QuickMeasure → Material Cheat-Sheet coverage config + calculator.
 *
 * Numbers are the AUTHORITATIVE RCRS values from the official "Material Order
 * Cheat Sheet" in the SALES REP HANDBOOK (Google Drive,
 * id 1Vbk9TBlggz4N3ORh-obi522e10pFXLf3), reconciled with Michael's rules
 * (2026-08-18). Edit COVERAGE + CALC_RULES here to tune — one file.
 *
 * Handbook conversions used:
 *   Arch shingle ........ 3 BDL = 1 SQ (100 sq ft)
 *   Synthetic Felt ...... 1 RL = 10 SQ
 *   Coil Nails 1¼" ...... 1 BX = 16 SQ
 *   Button Caps ......... Flat 1 BKT = 35 SQ, Steep 1 BKT = 25 SQ (pitch-dependent)
 *   Stormguard I&W ...... 1 RL = 60 LF (200 sq ft = 2 SQ)
 *   IKO Hip & Ridge ..... 1 BDL = 33 LF  (OC DuraRidge alt = 20 LF/BDL)
 *   Starter Shingles .... 1 BDL = 100 LF
 *   Ridge Vent .......... 1 PC = 4 LF
 *   Drip Edge ........... 10' sticks, figure ~9.5 LF usable per stick
 *
 * Michael's placement rules (2026-08-18):
 *   - Starter goes on ALL eaves AND rakes.
 *   - Drip edge goes on ALL perimeters (eaves + rakes).
 *   - Ice & Water: on EVERY job in valleys + along walls + chimneys +
 *     penetrations (pipe boots, gas vents). In Madison County / Madison City /
 *     Huntsville (and a few other code areas) code also requires I&W around the
 *     ENTIRE perimeter (eaves + rakes) — so those add the full perimeter.
 */

export interface CoverageItem {
  name: string;
  unit: string;
  per: number;
  basis: 'sq' | 'lf';
  needsConfirm?: boolean;
}

export const COVERAGE = {
  shingles:     { name: 'Architectural shingles', unit: 'bundle', per: 1 / 3, basis: 'sq' as const }, // 3 bundles / square
  underlayment: { name: 'Synthetic underlayment', unit: 'roll',   per: 10,    basis: 'sq' as const },
  coilNails:    { name: 'Coil nails (1¼\")',       unit: 'box',    per: 16,    basis: 'sq' as const },
  iceWater:     { name: 'Ice & Water (Stormguard)', unit: 'roll',  per: 60,    basis: 'lf' as const },
  hipRidgeCap:  { name: 'Hip & Ridge cap (IKO)',   unit: 'bundle', per: 33,    basis: 'lf' as const },
  ridgeVent:    { name: 'Ridge vent',              unit: 'piece',  per: 4,     basis: 'lf' as const },
  starter:      { name: 'Starter shingles',        unit: 'bundle', per: 100,   basis: 'lf' as const },
  dripEdge:     { name: 'Drip edge',               unit: 'stick',  per: 9.5,   basis: 'lf' as const },
} satisfies Record<string, CoverageItem>;

/** Button caps are pitch-dependent (flat vs steep). */
export const CAP_NAILS = {
  name: 'Button / cap nails',
  unit: 'bucket',
  flatPer: 35, // sq per bucket, low slope
  steepPer: 25, // sq per bucket, steep slope
  /** Pitch (rise/12) at or above which we treat the roof as "steep". */
  steepThreshold: 7,
};

export const CALC_RULES = {
  /** Waste factor added to shingle squares. 0.10 = 10%. (Still confirm w/ Michael.) */
  wasteFactor: 0.10,
  wasteNeedsConfirm: true,
  /** Starter on eaves + rakes (Michael 2026-08-18). */
  starterApplyTo: 'eaves+rakes' as 'eaves' | 'eaves+rakes',
  /** Drip edge on the full perimeter (eaves + rakes). */
  dripEdgeApplyTo: 'eaves+rakes' as 'eaves' | 'eaves+rakes',
  /** Ridge vent stays advisory (per-job ventilation call). */
  autoQuantifyRidgeVent: false,
};

/**
 * Areas where code requires Ice & Water around the ENTIRE perimeter (not just
 * valleys/walls/penetrations). Matched against the report's city (normalized,
 * lowercase) or zip prefix. Override/extend via GAF_ICE_WATER_CODE_CITIES (csv
 * of city substrings) and GAF_ICE_WATER_CODE_ZIP_PREFIXES (csv).
 */
export function iceWaterCodeCities(): string[] {
  const raw = process.env.GAF_ICE_WATER_CODE_CITIES || 'huntsville,madison';
  return raw.split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
}
export function iceWaterCodeZipPrefixes(): string[] {
  // 357xx (Madison/Madison Co. west) + 358xx (Huntsville / Madison Co.).
  const raw = process.env.GAF_ICE_WATER_CODE_ZIP_PREFIXES || '357,358';
  return raw.split(',').map(s => s.trim()).filter(Boolean);
}

export function isIceWaterCodeArea(city?: string, zip?: string): boolean {
  const c = (city || '').toLowerCase();
  if (c && iceWaterCodeCities().some(k => c.includes(k))) return true;
  const z = (zip || '').trim();
  if (z && iceWaterCodeZipPrefixes().some(p => z.startsWith(p))) return true;
  return false;
}

export interface Measurements {
  squares?: number;
  roofAreaSqFt?: number;
  ridgeLengthFt?: number;
  hipLengthFt?: number;
  valleyLengthFt?: number;
  eaveLengthFt?: number;
  rakeLengthFt?: number;
  perimeterFt?: number;
  predominantPitch?: string;
  facets?: number;
  // GAF QuickMeasure Summary-page roll-ups (preferred when present — GAF has
  // already summed these across all facets):
  ridgeCapLengthFt?: number;  // ridges + hips
  starterLengthFt?: number;   // eaves + rakes
  dripEdgeLengthFt?: number;  // eaves + rakes
  leakBarrierLengthFt?: number; // full I&W formula (eaves+rakes+valleys+flash+step+hips)
  flashLengthFt?: number;
  stepLengthFt?: number;
  penetrations?: number;
  penetrationPerimeterFt?: number;
  /** GAF's suggested waste for this roof, 0..1 (e.g. 0.21). Overrides default. */
  suggestedWaste?: number;
}

export interface MaterialLine {
  name: string;
  qty: number;
  unit: string;
  basis: string;
  estimated: boolean;
}

export interface MaterialSummary {
  lines: MaterialLine[];
  advisories: string[];
  assumptions: string[];
  incomplete: boolean;
}

export interface SummaryContext {
  city?: string;
  zip?: string;
}

const ceil = (n: number) => Math.ceil(Number(n.toFixed(4)));

/** Parse "6/12" | "6:12" | "6" → 6 (rise per 12). undefined if unknown. */
function pitchRise(p?: string): number | undefined {
  if (!p) return undefined;
  const m = p.match(/(\d+(?:\.\d+)?)\s*[\/:]\s*12/) || p.match(/^(\d+(?:\.\d+)?)$/);
  return m ? parseFloat(m[1]) : undefined;
}

/**
 * Turn QuickMeasure measurements into a material order cheat-sheet using the
 * handbook coverage numbers. Deterministic — every number traces to a
 * measurement ÷ a coverage constant. `ctx` (city/zip) drives the Ice & Water
 * code-area rule.
 */
export function buildMaterialSummary(m: Measurements, ctx: SummaryContext = {}): MaterialSummary {
  const lines: MaterialLine[] = [];
  const advisories: string[] = [];
  const assumptions: string[] = [];
  let incomplete = false;

  const squares = m.squares ?? (m.roofAreaSqFt ? m.roofAreaSqFt / 100 : undefined);
  const waste = m.suggestedWaste ?? CALC_RULES.wasteFactor;
  const wasteEst = m.suggestedWaste == null;
  const codeArea = isIceWaterCodeArea(ctx.city, ctx.zip);

  const add = (name: string, qty: number, unit: string, basis: string, estimated = false) =>
    lines.push({ name, qty: ceil(qty), unit, basis, estimated });

  // Prefer GAF's pre-summed roll-ups; fall back to component sums.
  const nz = (n?: number) => (n && n > 0 ? n : undefined);
  const ridgeCapLf = m.ridgeCapLengthFt ?? nz((m.ridgeLengthFt ?? 0) + (m.hipLengthFt ?? 0));
  const starterLf = m.starterLengthFt ?? nz((m.eaveLengthFt ?? 0) + (m.rakeLengthFt ?? 0));
  const dripLf = m.dripEdgeLengthFt ?? nz((m.eaveLengthFt ?? 0) + (m.rakeLengthFt ?? 0));

  // ── Area items ────────────────────────────────────────────────────────────
  if (squares != null) {
    const ws = squares * (1 + waste);
    assumptions.push(`Waste: ${Math.round(waste * 100)}%${wasteEst ? ' (default — GAF suggested not found)' : ' (GAF suggested for this roof)'}, applied to shingles`);
    add(COVERAGE.shingles.name, ws * 3, 'bundle', `${ws.toFixed(1)} sq (+${Math.round(waste * 100)}% waste) × 3 bundles/sq`);
    add(COVERAGE.underlayment.name, squares / COVERAGE.underlayment.per, 'roll', `${squares.toFixed(1)} sq ÷ ${COVERAGE.underlayment.per} sq/roll`);
    add(COVERAGE.coilNails.name, squares / COVERAGE.coilNails.per, 'box', `${squares.toFixed(1)} sq ÷ ${COVERAGE.coilNails.per} sq/box`);
    const rise = pitchRise(m.predominantPitch);
    const steep = rise == null ? true : rise >= CAP_NAILS.steepThreshold;
    const capPer = steep ? CAP_NAILS.steepPer : CAP_NAILS.flatPer;
    add(CAP_NAILS.name, squares / capPer, 'bucket', `${squares.toFixed(1)} sq ÷ ${capPer} sq/bucket (${steep ? 'steep' : 'flat'}${rise == null ? ', pitch unknown' : ` ${rise}/12`})`, rise == null);
  } else { incomplete = true; }

  // ── Ice & Water ───────────────────────────────────────────────────────────
  let iwLf: number | undefined;
  let iwBasis = '';
  if (codeArea && m.leakBarrierLengthFt != null) { iwLf = m.leakBarrierLengthFt; iwBasis = `${iwLf} LF full perimeter (GAF leak barrier, code area)`; }
  else if (codeArea) { iwLf = nz((m.eaveLengthFt ?? 0) + (m.rakeLengthFt ?? 0) + (m.valleyLengthFt ?? 0)); iwBasis = `${iwLf ?? 0} LF eaves+rakes+valleys (code area)`; }
  else { iwLf = nz((m.valleyLengthFt ?? 0) + (m.flashLengthFt ?? 0) + (m.stepLengthFt ?? 0) + (m.penetrationPerimeterFt ?? 0)); iwBasis = `${iwLf ?? 0} LF valleys+walls+penetrations`; }
  if (iwLf) add(COVERAGE.iceWater.name, iwLf / COVERAGE.iceWater.per, 'roll', `${iwBasis} ÷ ${COVERAGE.iceWater.per} LF/roll`);
  else incomplete = true;
  assumptions.push(codeArea ? 'Ice & Water: FULL PERIMETER (Madison Co./Huntsville code area)' : 'Ice & Water: valleys + walls/chimneys/penetrations');
  if (!codeArea) advisories.push('Ice & Water: confirm wall/chimney footage on site — some is not in the report.');

  // ── LF items from roll-ups ────────────────────────────────────────────────
  if (ridgeCapLf) add(COVERAGE.hipRidgeCap.name, ridgeCapLf / COVERAGE.hipRidgeCap.per, 'bundle', `${ridgeCapLf} LF ridge+hip ÷ ${COVERAGE.hipRidgeCap.per} LF/bundle`); else incomplete = true;
  if (starterLf) add(COVERAGE.starter.name, starterLf / COVERAGE.starter.per, 'bundle', `${starterLf} LF eaves+rakes ÷ ${COVERAGE.starter.per} LF/bundle`); else incomplete = true;
  if (dripLf) add(COVERAGE.dripEdge.name, dripLf / COVERAGE.dripEdge.per, 'stick', `${dripLf} LF eaves+rakes ÷ ${COVERAGE.dripEdge.per} ft usable/stick`); else incomplete = true;

  // ── Advisories ────────────────────────────────────────────────────────────
  if (m.ridgeLengthFt != null) advisories.push(`Ridge vent: ${m.ridgeLengthFt.toFixed(0)} LF ridge → ${ceil(m.ridgeLengthFt / COVERAGE.ridgeVent.per)} pieces if fully vented (per-job call).`);
  if (m.penetrations) advisories.push(`${m.penetrations} penetrations (pipe boots / gas vents) — confirm boot sizes at the job.`);

  return { lines, advisories, assumptions, incomplete };
}
