/**
 * Roof Measurement Compare API — /api/roof-measure/compare
 *
 * POST: Run all available AI engines separately and compare results.
 * Returns detailed comparison with accuracy scores vs consensus.
 */

import { NextRequest, NextResponse } from 'next/server';
import { roofMeasureService } from '@/lib/roof-measure-service';
import type { EngineResult, MeasurementResult } from '@/lib/roof-measure-service';

export const maxDuration = 300;
export const dynamic = 'force-dynamic';

interface EngineComparison {
  engine: string;
  status: 'success' | 'error';
  error?: string;
  ridge: number;
  rake: number;
  valley: number;
  eave: number;
  hip: number;
  totalArea: number;
  pitch: string;
  roofStyle: string;
  components: EngineResult['components'];
  // Accuracy vs consensus
  deviationFromConsensus: {
    ridge: number;
    rake: number;
    valley: number;
    eave: number;
    hip: number;
    average: number;
  };
  isClosestToConsensus: boolean;
  isBiggestOutlier: boolean;
}

function sumLines(lines: { lengthFt: number }[]): number {
  return lines.reduce((s, l) => s + (l.lengthFt ?? 0), 0);
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { address, engines: requestedEngines } = body;

    if (!address) {
      return NextResponse.json(
        { error: "Missing required 'address' field" },
        { status: 400 }
      );
    }

    // Run the full measurement to get consensus + all engine results
    const result: MeasurementResult = await roofMeasureService.measureRoof(address);

    // Build comparison data for each engine
    const metrics = ['ridges', 'rakes', 'valleys', 'eaves', 'hips'] as const;
    const metricLabels = ['ridge', 'rake', 'valley', 'eave', 'hip'] as const;

    // Consensus values
    const consensusValues = {
      ridge: result.measurements.ridge.totalFt,
      rake: result.measurements.rake.totalFt,
      valley: result.measurements.valley.totalFt,
      eave: result.measurements.eave.totalFt,
      hip: result.measurements.hip.totalFt,
    };

    const comparisons: EngineComparison[] = result.providerResults.map((engine) => {
      const engineValues = {
        ridge: sumLines(engine.ridges),
        rake: sumLines(engine.rakes),
        valley: sumLines(engine.valleys),
        eave: sumLines(engine.eaves),
        hip: sumLines(engine.hips),
      };

      // Calculate deviation from consensus for each metric
      const deviations: Record<string, number> = {};
      let totalDeviation = 0;
      let deviationCount = 0;

      for (const label of metricLabels) {
        const consensusVal = consensusValues[label];
        const engineVal = engineValues[label];
        if (consensusVal > 0 && engineVal > 0) {
          const dev = Math.abs(engineVal - consensusVal) / consensusVal;
          deviations[label] = Math.round(dev * 1000) / 10; // percentage
          totalDeviation += dev;
          deviationCount++;
        } else {
          deviations[label] = 0;
        }
      }

      return {
        engine: engine.engine,
        status: engine.error ? 'error' as const : 'success' as const,
        error: engine.error,
        ridge: engineValues.ridge,
        rake: engineValues.rake,
        valley: engineValues.valley,
        eave: engineValues.eave,
        hip: engineValues.hip,
        totalArea: engine.totalRoofAreaSqFt,
        pitch: engine.pitches?.[0] ?? 'unknown',
        roofStyle: engine.roofStyle,
        components: engine.components,
        deviationFromConsensus: {
          ridge: deviations.ridge ?? 0,
          rake: deviations.rake ?? 0,
          valley: deviations.valley ?? 0,
          eave: deviations.eave ?? 0,
          hip: deviations.hip ?? 0,
          average: deviationCount > 0 ? Math.round((totalDeviation / deviationCount) * 1000) / 10 : 0,
        },
        isClosestToConsensus: false,
        isBiggestOutlier: false,
      };
    });

    // Mark closest to consensus and biggest outlier
    const successfulComparisons = comparisons.filter((c) => c.status === 'success');
    if (successfulComparisons.length >= 2) {
      const sorted = [...successfulComparisons].sort(
        (a, b) => a.deviationFromConsensus.average - b.deviationFromConsensus.average
      );
      sorted[0].isClosestToConsensus = true;
      sorted[sorted.length - 1].isBiggestOutlier = true;
    }

    // Generate recommendations
    const recommendations: string[] = [];
    const successEngines = successfulComparisons.map((c) => c.engine);
    if (successEngines.length >= 3) {
      recommendations.push(`${successEngines.length} engines produced results — consensus is strong.`);
    } else if (successEngines.length === 2) {
      recommendations.push('Only 2 engines produced results — consider adding more AI providers for better consensus.');
    } else if (successEngines.length === 1) {
      recommendations.push('Only 1 engine produced results — measurements may be unreliable.');
    }

    const closest = successfulComparisons.find((c) => c.isClosestToConsensus);
    if (closest) {
      recommendations.push(`${closest.engine} was closest to consensus (${closest.deviationFromConsensus.average}% avg deviation).`);
    }

    const outlier = successfulComparisons.find((c) => c.isBiggestOutlier);
    if (outlier && outlier !== closest) {
      recommendations.push(`${outlier.engine} was the biggest outlier (${outlier.deviationFromConsensus.average}% avg deviation).`);
    }

    // Check agreement on style and pitch
    const styles = successfulComparisons.map((c) => c.roofStyle).filter((s) => s !== 'unknown');
    const uniqueStyles = [...new Set(styles)];
    if (uniqueStyles.length === 1) {
      recommendations.push(`All engines agree on roof style: ${uniqueStyles[0]}.`);
    } else if (uniqueStyles.length > 1) {
      recommendations.push(`Engines disagree on roof style: ${uniqueStyles.join(' vs ')}.`);
    }

    return NextResponse.json({
      address: result.address,
      lat: result.lat,
      lng: result.lng,
      consensus: {
        ...consensusValues,
        totalArea: result.solarData?.totalArea ?? 0,
        pitch: result.pitch,
        roofStyle: result.roofStyle,
        overallConfidence: result.overallConfidence,
      },
      comparisons,
      recommendations,
      qualityNotes: result.qualityNotes,
      engineCount: {
        total: comparisons.length,
        successful: successfulComparisons.length,
        failed: comparisons.length - successfulComparisons.length,
      },
    });
  } catch (err: any) {
    console.error('Compare pipeline error:', err);
    return NextResponse.json(
      { error: err.message ?? 'Comparison failed' },
      { status: 500 }
    );
  }
}
