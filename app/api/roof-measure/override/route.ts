import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * POST /api/roof-measure/override
 * 
 * Accepts a roof measurement report + on-site verified measurements.
 * Recalculates the entire report using the verified values as ground truth.
 * 
 * When a user provides a verified measurement (e.g., actual ridge length),
 * we calculate the ratio between AI estimate and verified value, then
 * apply that ratio as a correction factor to all related measurements.
 */

interface MeasurementItem {
  totalFt: number;
  count: number;
  details: { lengthFt: number }[];
  confidence: string;
}

interface Override {
  field: string;        // e.g., "ridges.totalFt", "eaves.totalFt", "pitches.primary"
  verifiedValue: number | string;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { measurements, overrides, solarData } = body;

    if (!measurements || !overrides || !Array.isArray(overrides)) {
      return NextResponse.json({ error: 'Missing measurements or overrides array' }, { status: 400 });
    }

    // Deep clone measurements
    const recalculated = JSON.parse(JSON.stringify(measurements));
    const appliedOverrides: Record<string, number | string> = {};

    // Calculate correction factors from overrides
    const linearFields = ['ridges', 'rakes', 'valleys', 'eaves', 'hips'] as const;
    const correctionFactors: Record<string, number> = {};

    for (const override of overrides as Override[]) {
      const { field, verifiedValue } = override;

      // Handle pitch override
      if (field === 'pitches.primary' && typeof verifiedValue === 'string') {
        recalculated.pitches.primary = verifiedValue;
        recalculated.pitches.confidence = 'VERIFIED';
        appliedOverrides[field] = verifiedValue;

        // Recalculate area with new pitch
        const pitchMatch = verifiedValue.match(/(\d+(?:\.\d+)?)\s*\/\s*12/);
        if (pitchMatch && solarData?.groundFootprintSqFt) {
          const pitchRatio = parseFloat(pitchMatch[1]);
          const slopeFactor = Math.sqrt(1 + (pitchRatio / 12) ** 2);
          // Update total area based on new pitch
          const newArea = solarData.groundFootprintSqFt * slopeFactor;
          if (body.solarData) {
            body.solarData.totalRoofAreaSqFt = Math.round(newArea);
          }
        }
        continue;
      }

      // Handle roof style override
      if (field === 'roofStyle' && typeof verifiedValue === 'string') {
        recalculated.roofStyle = verifiedValue;
        appliedOverrides[field] = verifiedValue;
        continue;
      }

      // Handle linear measurement overrides
      for (const lf of linearFields) {
        if (field === `${lf}.totalFt` && typeof verifiedValue === 'number') {
          const original = recalculated[lf]?.totalFt || 0;
          if (original > 0) {
            correctionFactors[lf] = verifiedValue / original;
          }
          recalculated[lf].totalFt = verifiedValue;
          recalculated[lf].confidence = 'VERIFIED';
          appliedOverrides[field] = verifiedValue;

          // Scale individual details proportionally
          if (recalculated[lf].details?.length > 0 && original > 0) {
            const ratio = verifiedValue / original;
            recalculated[lf].details = recalculated[lf].details.map((d: { lengthFt: number }) => ({
              lengthFt: Math.round(d.lengthFt * ratio * 10) / 10,
            }));
          }
        }
      }
    }

    // Apply cross-field corrections:
    // If user verified eaves, and rakes weren't verified, scale rakes proportionally
    // (roof dimensions are correlated — if eaves are off by 10%, rakes likely are too)
    const verifiedFields = new Set(Object.keys(appliedOverrides).map(f => f.split('.')[0]));

    // Only cross-correct unverified linear measurements
    for (const lf of linearFields) {
      if (verifiedFields.has(lf)) continue; // Already verified, skip

      // Find the average correction factor from verified fields
      const factors = Object.entries(correctionFactors)
        .filter(([key]) => key !== lf)
        .map(([, val]) => val);

      if (factors.length > 0) {
        const avgFactor = factors.reduce((s, f) => s + f, 0) / factors.length;
        // Only apply if correction is significant (>5% off) but not extreme (>50% off)
        if (Math.abs(avgFactor - 1) > 0.05 && Math.abs(avgFactor - 1) < 0.50) {
          const original = recalculated[lf]?.totalFt || 0;
          if (original > 0) {
            recalculated[lf].totalFt = Math.round(original * avgFactor * 10) / 10;
            recalculated[lf].confidence = 'ADJUSTED';
            if (recalculated[lf].details?.length > 0) {
              recalculated[lf].details = recalculated[lf].details.map((d: { lengthFt: number }) => ({
                lengthFt: Math.round(d.lengthFt * avgFactor * 10) / 10,
              }));
            }
          }
        }
      }
    }

    // Recalculate perimeter
    recalculated.perimeterFt = Math.round(
      ((recalculated.eaves?.totalFt || 0) + (recalculated.rakes?.totalFt || 0)) * 10
    ) / 10;

    // Determine overall confidence after overrides
    const confidences = linearFields.map(f => recalculated[f]?.confidence || 'LOW');
    const verifiedCount = confidences.filter(c => c === 'VERIFIED').length;
    const adjustedCount = confidences.filter(c => c === 'ADJUSTED').length;
    let overallConfidence = 'LOW';
    if (verifiedCount >= 3) overallConfidence = 'VERIFIED';
    else if (verifiedCount >= 1 && adjustedCount >= 2) overallConfidence = 'HIGH';
    else if (verifiedCount >= 1) overallConfidence = 'MEDIUM';

    return NextResponse.json({
      measurements: recalculated,
      overallConfidence,
      appliedOverrides,
      correctionFactors,
      qualityNotes: [
        `${verifiedCount} field(s) verified on-site`,
        `${adjustedCount} field(s) auto-adjusted from verified data`,
        ...Object.entries(correctionFactors).map(([field, factor]) =>
          `${field}: ${((factor - 1) * 100).toFixed(1)}% correction applied`
        ),
      ],
    });
  } catch (e: unknown) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
