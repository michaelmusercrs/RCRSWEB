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
  const eave = m.eaveLengthFt;
  const rake = m.rakeLengthFt;
  const valley = m.valleyLengthFt;
  const ridge = m.ridgeLengthFt;
  const hip = m.hipLengthFt;

  const push = (item: CoverageItem, input: number | undefined, basisLabel: string) => {
    if (input == null || !Number.isFinite(input)) { incomplete = true; return; }
    lines.push({ name: item.name, qty: ceil(input / item.per), unit: item.unit, basis: basisLabel, estimated: !!item.needsConfirm });
  };

  // ── Area items (squares-based) ────────────────────────────────────────────
  if (squares != null) {
    const wasteSquares = squares * (1 + CALC_RULES.wasteFactor);
    assumptions.push(`Waste factor: ${Math.round(CALC_RULES.wasteFactor * 100)}% on shingles${CALC_RULES.wasteNeedsConfirm ? ' (confirm)' : ''}`);
    lines.push({
      name: COVERAGE.shingles.name,
      qty: ceil(wasteSquares * 3),
      unit: COVERAGE.shingles.unit,
      basis: `${wasteSquares.toFixed(1)} sq × 3 bundles/sq`,
      estimated: false,
    });
    push(COVERAGE.underlayment, squares, `${squares.toFixed(1)} sq ÷ ${COVERAGE.underlayment.per} sq/roll`);
    push(COVERAGE.coilNails, squares, `${squares.toFixed(1)} sq ÷ ${COVERAGE.coilNails.per} sq/box`);

    // Button caps — pitch-dependent (flat 35 / steep 25).
    const rise = pitchRise(m.predominantPitch);
    const steep = rise == null ? true : rise >= CAP_NAILS.steepThreshold; // unknown → assume steep (order more)
    const per = steep ? CAP_NAILS.steepPer : CAP_NAILS.flatPer;
    lines.push({
      name: CAP_NAILS.name,
      qty: ceil(squares / per),
      unit: CAP_NAILS.unit,
      basis: `${squares.toFixed(1)} sq ÷ ${per} sq/bucket (${steep ? 'steep' : 'flat'}${rise == null ? ', pitch unknown → assumed steep' : ` ${rise}/12`})`,
      estimated: rise == null,
    });
  } else {
    incomplete = true;
  }

  // ── Ice & Water — valleys always; full perimeter in code areas ────────────
  const codeArea = isIceWaterCodeArea(ctx.city, ctx.zip);
  {
    let iwLf = 0;
    const parts: string[] = [];
    if (valley != null) { iwLf += valley; parts.push(`${valley.toFixed(0)} LF valleys`); }
    if (codeArea) {
      if (eave != null) { iwLf += eave; parts.push(`${eave.toFixed(0)} LF eaves`); }
      if (rake != null) { iwLf += rake; parts.push(`${rake.toFixed(0)} LF rakes`); }
    }
    if (parts.length) {
      lines.push({
        name: COVERAGE.iceWater.name,
        qty: ceil(iwLf / COVERAGE.iceWater.per),
        unit: COVERAGE.iceWater.unit,
        basis: `${parts.join(' + ')} ÷ ${COVERAGE.iceWater.per} LF/roll`,
        estimated: false,
      });
    } else {
      incomplete = true;
    }
    assumptions.push(codeArea
      ? 'Ice & Water: FULL PERIMETER (code area) + valleys.'
      : 'Ice & Water: valleys only in the auto-count.');
    advisories.push('Ice & Water also required along walls, chimneys & penetrations (pipe boots, gas vents) on every job — add that field-measured footage; it is not in the measurement report.');
  }

  // ── Hip & Ridge cap (ridge + hip) ─────────────────────────────────────────
  if (ridge != null || hip != null) {
    const capLf = (ridge ?? 0) + (hip ?? 0);
    push(COVERAGE.hipRidgeCap, capLf, `${(ridge ?? 0).toFixed(0)} LF ridge + ${(hip ?? 0).toFixed(0)} LF hip ÷ ${COVERAGE.hipRidgeCap.per} LF/bundle`);
  } else {
    incomplete = true;
  }

  // ── Starter (eaves + rakes) ───────────────────────────────────────────────
  {
    let sLf = 0; const parts: string[] = [];
    if (eave != null) { sLf += eave; parts.push(`${eave.toFixed(0)} LF eaves`); }
    if (CALC_RULES.starterApplyTo === 'eaves+rakes' && rake != null) { sLf += rake; parts.push(`${rake.toFixed(0)} LF rakes`); }
    if (parts.length) push(COVERAGE.starter, sLf, `${parts.join(' + ')} ÷ ${COVERAGE.starter.per} LF/bundle`);
    else incomplete = true;
  }

  // ── Drip edge (eaves + rakes) ─────────────────────────────────────────────
  {
    let dLf = 0; const parts: string[] = [];
    if (eave != null) { dLf += eave; parts.push(`${eave.toFixed(0)} LF eaves`); }
    if (rake != null) { dLf += rake; parts.push(`${rake.toFixed(0)} LF rakes`); }
    if (parts.length) push(COVERAGE.dripEdge, dLf, `${parts.join(' + ')} ÷ ${COVERAGE.dripEdge.per} LF usable/stick`);
    else incomplete = true;
  }

  // ── Ridge vent (advisory) ─────────────────────────────────────────────────
  if (ridge != null) {
    const ventPcs = ceil(ridge / COVERAGE.ridgeVent.per);
    if (CALC_RULES.autoQuantifyRidgeVent) {
      lines.push({ name: COVERAGE.ridgeVent.name, qty: ventPcs, unit: COVERAGE.ridgeVent.unit, basis: `${ridge.toFixed(0)} LF ridge ÷ ${COVERAGE.ridgeVent.per} LF/pc`, estimated: false });
    } else {
      advisories.push(`Ridge vent: ${ridge.toFixed(0)} LF of ridge → ${ventPcs} pieces if fully vented (per-job call — not auto-ordered).`);
    }
  }

  return { lines, advisories, assumptions, incomplete };
}
