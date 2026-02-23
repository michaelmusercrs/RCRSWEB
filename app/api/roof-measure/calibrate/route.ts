import { NextRequest, NextResponse } from 'next/server';
import {
  addCalibration,
  loadCalibrationData,
  type CalibrationMeasurements,
  type AICalibrationResult,
} from '@/lib/roof-calibration';

export const dynamic = 'force-dynamic';

/**
 * POST /api/roof-measure/calibrate
 * 
 * Save ground truth measurements for calibration.
 * Recalculates per-method correction factors and accuracy scores.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { address, measurements, source, aiResults, roofArea_sqft } = body;

    if (!address || !measurements) {
      return NextResponse.json({ error: 'address and measurements required' }, { status: 400 });
    }

    const validSources = ['manual', 'eagleview', 'photo_verified'];
    if (source && !validSources.includes(source)) {
      return NextResponse.json({ error: `source must be one of: ${validSources.join(', ')}` }, { status: 400 });
    }

    // Normalize measurements
    const calibMeasurements: CalibrationMeasurements = {
      total_ridge_ft: Number(measurements.ridge) || Number(measurements.total_ridge_ft) || 0,
      total_rake_ft: Number(measurements.rake) || Number(measurements.total_rake_ft) || 0,
      total_valley_ft: Number(measurements.valley) || Number(measurements.total_valley_ft) || 0,
      total_eave_ft: Number(measurements.eave) || Number(measurements.total_eave_ft) || 0,
      total_hip_ft: Number(measurements.hip) || Number(measurements.total_hip_ft) || 0,
    };

    // Normalize AI results if provided
    const normalizedAiResults: AICalibrationResult[] = (aiResults || []).map((r: Record<string, unknown>) => ({
      method: String(r.method || ''),
      provider: String(r.provider || ''),
      model: String(r.model || ''),
      imageSet: String(r.imageSet || ''),
      ridge: Number(r.ridge) || 0,
      rake: Number(r.rake) || 0,
      valley: Number(r.valley) || 0,
      eave: Number(r.eave) || 0,
      hip: Number(r.hip) || 0,
    }));

    const data = addCalibration(
      address,
      calibMeasurements,
      source || 'manual',
      normalizedAiResults,
      roofArea_sqft ? Number(roofArea_sqft) : undefined,
    );

    return NextResponse.json({
      success: true,
      message: 'Calibration saved — future measurements will be more accurate',
      methodAccuracy: data.methodAccuracy,
      totalCalibrations: data.calibrations.length,
    });
  } catch (e: unknown) {
    console.error('Calibration error:', e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

/**
 * GET /api/roof-measure/calibrate
 * 
 * Returns current calibration stats.
 */
export async function GET() {
  try {
    const data = loadCalibrationData();
    return NextResponse.json({
      methodAccuracy: data.methodAccuracy,
      totalCalibrations: data.calibrations.length,
      photoCorrections: data.photoCorrections,
    });
  } catch (e: unknown) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
