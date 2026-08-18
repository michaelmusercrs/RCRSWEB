/**
 * GAF QuickMeasure → Material Cheat-Sheet coverage config + calculator.
 *
 * The coverage numbers below drive the auto-generated material order summary
 * that gets attached to each JN job and emailed to the rep. They come from
 * RCRS's real inventory catalog (data/inventory-products.json) + Michael's
 * stated numbers. Items marked `needsConfirm: true` use an industry-standard
 * default that Michael still needs to confirm — the summary flags every such
 * line with a ⚠ so nobody orders off an unconfirmed number by accident.
 *
 * TO TUNE: edit COVERAGE + CALC_RULES here. One file, no code changes needed.
 *
 * Sources:
 *   - Synthetic underlayment 10 sq/roll .......... confirmed (Michael 2026-08-18)
 *   - Coil nails 15–18 sq/box (using 17) ......... catalog + Michael's example
 *   - Ice & Water 2 sq (67 LF)/roll .............. catalog
 *   - Cap/button nails ~30 sq/bucket ............. catalog "25–35 by pitch"
 *   - Hip & Ridge cap 30 LF/bundle ............... Michael's example
 *   - Ridge vent 4 LF/stick ...................... catalog (INV Ridge Vent 4LF)
 *   - Architectural shingles 3 bundles/sq ........ training content
 *   - Starter 120 LF/bundle ...................... ⚠ default (GAF Pro-Start) — confirm
 *   - Drip edge 10 ft/stick ...................... ⚠ default — confirm length/profile
 */

export interface CoverageItem {
  /** Display name on the cheat-sheet. */
  name: string;
  /** Unit ordered in (roll, box, bundle, bucket, stick). */
  unit: string;
  /** How much one unit covers. */
  per: number;
  /** What `per` is measured in: 'sq' (squares) or 'lf' (linear feet). */
  basis: 'sq' | 'lf';
  /** True when `per` is an unconfirmed industry default — flagged in output. */
  needsConfirm?: boolean;
}

export const COVERAGE = {
  shingles:      { name: 'Architectural shingles', unit: 'bundle', per: 1 / 3, basis: 'sq' as const }, // 3 bundles / square
  underlayment:  { name: 'Synthetic underlayment', unit: 'roll',   per: 10,    basis: 'sq' as const },
  coilNails:     { name: 'Coil roofing nails (1¼\" EG)', unit: 'box', per: 17,  basis: 'sq' as const },
  capNails:      { name: 'Cap / button nails',     unit: 'bucket', per: 30,    basis: 'sq' as const },
  iceWater:      { name: 'Ice & Water shield',     unit: 'roll',   per: 67,    basis: 'lf' as const }, // 67 LF / roll
  hipRidgeCap:   { name: 'Hip & Ridge cap',        unit: 'bundle', per: 30,    basis: 'lf' as const },
  ridgeVent:     { name: 'Ridge vent',             unit: 'stick',  per: 4,     basis: 'lf' as const },
  starter:       { name: 'Starter strip',          unit: 'bundle', per: 120,   basis: 'lf' as const, needsConfirm: true },
  dripEdge:      { name: 'Drip edge',              unit: 'stick',  per: 10,    basis: 'lf' as const, needsConfirm: true },
} satisfies Record<string, CoverageItem>;

/**
 * Calc rules Michael still needs to confirm (the 4 questions from 2026-08-18).
 * Defaults chosen to be reasonable and clearly surfaced in the summary.
 */
export const CALC_RULES = {
  /** Waste factor added to shingle squares. 0.10 = 10%. */
  wasteFactor: 0.10,
  /** Where Ice & Water is applied → which LF feed the roll count. */
  iceWaterApplyTo: 'eaves+valleys' as 'eaves' | 'eaves+valleys' | 'whole-roof',
  /** Starter placement → which LF feed the starter bundle count. */
  starterApplyTo: 'eaves' as 'eaves' | 'eaves+rakes',
  /**
   * Ridge vent is a per-job call (not every ridge is vented). When false we
   * do NOT auto-quantify it — we just surface the ridge LF and the "if fully
   * vented" count as an advisory line so the rep/PM decides.
   */
  autoQuantifyRidgeVent: false,
  /** All defaults above are pending Michael's confirmation. */
  needsConfirm: true,
};

/** Structured measurements pulled from the QuickMeasure XML (all optional). */
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
  /** Human-readable basis, e.g. "22.4 sq ÷ 10 sq/roll". */
  basis: string;
  /** True when this line rests on an unconfirmed coverage/rule default. */
  estimated: boolean;
}

export interface MaterialSummary {
  lines: MaterialLine[];
  /** Advisory lines that are NOT firm order quantities (e.g. ridge vent). */
  advisories: string[];
  /** Assumptions applied (waste %, I&W placement, etc.) for transparency. */
  assumptions: string[];
  /** True if any input measurement was missing so counts may be partial. */
  incomplete: boolean;
}

const ceil = (n: number) => Math.ceil(Number(n.toFixed(4)));

/**
 * Turn QuickMeasure measurements into a material order cheat-sheet using the
 * coverage config above. Deterministic — no AI, instant, and every number is
 * traceable to a measurement ÷ a coverage constant.
 */
export function buildMaterialSummary(m: Measurements): MaterialSummary {
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

  const push = (
    item: CoverageItem,
    input: number | undefined,
    qtyPerUnit: number,
    basisLabel: string,
    extraEstimated = false,
  ) => {
    if (input == null || !Number.isFinite(input)) { incomplete = true; return; }
    const qty = ceil(input / qtyPerUnit);
    lines.push({
      name: item.name,
      qty,
      unit: item.unit,
      basis: basisLabel,
      estimated: !!item.needsConfirm || extraEstimated,
    });
  };

  // ── Field / area items (squares-based) ────────────────────────────────────
  if (squares != null) {
    const wasteSquares = squares * (1 + CALC_RULES.wasteFactor);
    assumptions.push(`Waste factor: ${Math.round(CALC_RULES.wasteFactor * 100)}% (on shingles)`);
    // Shingles: 3 bundles/sq × squares(+waste)
    lines.push({
      name: COVERAGE.shingles.name,
      qty: ceil(wasteSquares * 3),
      unit: COVERAGE.shingles.unit,
      basis: `${wasteSquares.toFixed(1)} sq × 3 bundles/sq`,
      estimated: false,
    });
    push(COVERAGE.underlayment, squares, COVERAGE.underlayment.per, `${squares.toFixed(1)} sq ÷ ${COVERAGE.underlayment.per} sq/roll`);
    push(COVERAGE.coilNails, squares, COVERAGE.coilNails.per, `${squares.toFixed(1)} sq ÷ ${COVERAGE.coilNails.per} sq/box`);
    push(COVERAGE.capNails, squares, COVERAGE.capNails.per, `${squares.toFixed(1)} sq ÷ ${COVERAGE.capNails.per} sq/bucket`);
  } else {
    incomplete = true;
  }

  // ── Ice & Water (eaves +/- valleys) ───────────────────────────────────────
  if (eave != null) {
    let iwLf = eave;
    let label = `${eave.toFixed(0)} LF eaves`;
    if (CALC_RULES.iceWaterApplyTo === 'eaves+valleys' && valley != null) {
      iwLf += valley;
      label = `${eave.toFixed(0)} LF eaves + ${valley.toFixed(0)} LF valleys`;
    }
    assumptions.push(`Ice & Water applied to: ${CALC_RULES.iceWaterApplyTo}`);
    push(COVERAGE.iceWater, iwLf, COVERAGE.iceWater.per, `${label} ÷ ${COVERAGE.iceWater.per} LF/roll`);
  } else {
    incomplete = true;
  }

  // ── Hip & Ridge cap (ridge + hip) ─────────────────────────────────────────
  if (ridge != null || hip != null) {
    const capLf = (ridge ?? 0) + (hip ?? 0);
    push(COVERAGE.hipRidgeCap, capLf, COVERAGE.hipRidgeCap.per,
      `${(ridge ?? 0).toFixed(0)} LF ridge + ${(hip ?? 0).toFixed(0)} LF hip ÷ ${COVERAGE.hipRidgeCap.per} LF/bundle`);
  } else {
    incomplete = true;
  }

  // ── Starter (eaves +/- rakes) ─────────────────────────────────────────────
  if (eave != null) {
    let starterLf = eave;
    let label = `${eave.toFixed(0)} LF eaves`;
    if (CALC_RULES.starterApplyTo === 'eaves+rakes' && rake != null) {
      starterLf += rake;
      label = `${eave.toFixed(0)} LF eaves + ${rake.toFixed(0)} LF rakes`;
    }
    assumptions.push(`Starter applied to: ${CALC_RULES.starterApplyTo}`);
    push(COVERAGE.starter, starterLf, COVERAGE.starter.per, `${label} ÷ ${COVERAGE.starter.per} LF/bundle`);
  }

  // ── Drip edge (eaves + rakes) ─────────────────────────────────────────────
  if (eave != null || rake != null) {
    const dripLf = (eave ?? 0) + (rake ?? 0);
    push(COVERAGE.dripEdge, dripLf, COVERAGE.dripEdge.per,
      `${(eave ?? 0).toFixed(0)} LF eaves + ${(rake ?? 0).toFixed(0)} LF rakes ÷ ${COVERAGE.dripEdge.per} ft/stick`);
  }

  // ── Ridge vent (advisory unless auto-quantify enabled) ────────────────────
  if (ridge != null) {
    const ventSticks = ceil(ridge / COVERAGE.ridgeVent.per);
    if (CALC_RULES.autoQuantifyRidgeVent) {
      lines.push({
        name: COVERAGE.ridgeVent.name, qty: ventSticks, unit: COVERAGE.ridgeVent.unit,
        basis: `${ridge.toFixed(0)} LF ridge ÷ ${COVERAGE.ridgeVent.per} LF/stick`, estimated: false,
      });
    } else {
      advisories.push(`Ridge vent: ${ridge.toFixed(0)} LF of ridge → ${ventSticks} sticks if fully vented (per-job call — not auto-ordered).`);
    }
  }

  if (CALC_RULES.needsConfirm) {
    assumptions.push('⚠ Coverage numbers + calc rules are pending Michael\'s final confirmation.');
  }

  return { lines, advisories, assumptions, incomplete };
}
