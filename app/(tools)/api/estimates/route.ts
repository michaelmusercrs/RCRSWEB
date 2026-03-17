/**
 * RCRS Estimates Calculator API
 *
 * GET  /api/estimates - List recent saved estimates
 * POST /api/estimates - Calculate (and optionally save) an estimate
 *
 * @author RCRS Development Team
 * @version 1.0.0
 */

import { NextRequest, NextResponse } from 'next/server';
import { estimateCalculatorService } from '@/lib/estimate-calculator-service';

/**
 * GET /api/estimates
 *
 * Query params:
 * - limit: number of recent estimates to return (default 20)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limitStr = searchParams.get('limit');
    const limit = limitStr ? parseInt(limitStr, 10) : 20;

    const estimates = estimateCalculatorService.getRecentEstimates(limit);

    return NextResponse.json({
      success: true,
      estimates,
      total: estimates.length,
    });
  } catch (error) {
    console.error('[Estimates API] GET error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch estimates' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/estimates
 *
 * Calculate a roof estimate. Optionally save it.
 *
 * Body:
 * - roofArea (required): number (sq ft)
 * - pitch: string (e.g., "6/12")
 * - stories: number (1, 2, 3)
 * - roofStyle: string
 * - currentMaterial: string
 * - newMaterial (required): string
 * - tearOff: boolean
 * - complexityLevel: simple | moderate | complex
 * - extras: string[]
 * - measurements: { ridge, rake, valley, eave, hip }
 * - save: boolean — whether to persist the estimate
 * - customerName: string (optional, for saved estimates)
 * - address: string (optional, for saved estimates)
 * - leadId: string (optional, link to a lead)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate required fields
    if (!body.roofArea || body.roofArea <= 0) {
      return NextResponse.json(
        { error: 'roofArea is required and must be greater than 0' },
        { status: 400 }
      );
    }

    if (!body.newMaterial) {
      return NextResponse.json(
        { error: 'newMaterial is required' },
        { status: 400 }
      );
    }

    const input = {
      roofArea: Number(body.roofArea),
      pitch: body.pitch || '6/12',
      stories: Number(body.stories) || 1,
      roofStyle: body.roofStyle || 'gable',
      currentMaterial: body.currentMaterial || 'asphalt',
      newMaterial: body.newMaterial,
      tearOff: body.tearOff !== false, // default true
      complexityLevel: body.complexityLevel || 'moderate',
      extras: body.extras || [],
      measurements: body.measurements || undefined,
    };

    const result = estimateCalculatorService.calculateEstimate(input);

    // Attach optional metadata
    if (body.customerName) result.customerName = body.customerName;
    if (body.address) result.address = body.address;
    if (body.leadId) result.leadId = body.leadId;

    // Save if requested
    if (body.save) {
      estimateCalculatorService.saveEstimate(result);
    }

    return NextResponse.json({
      success: true,
      estimate: result,
      saved: !!body.save,
    });
  } catch (error) {
    console.error('[Estimates API] POST error:', error);
    return NextResponse.json(
      { error: 'Failed to calculate estimate' },
      { status: 500 }
    );
  }
}
