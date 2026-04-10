/**
 * RCRS Single Estimate API
 *
 * GET /api/estimates/[id] - Get a saved estimate by ID
 *
 * @author RCRS Development Team
 * @version 1.0.0
 */

import { NextRequest, NextResponse } from 'next/server';
import { estimateCalculatorService } from '@/lib/estimate-calculator-service';

/**
 * GET /api/estimates/[id]
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const estimate = await estimateCalculatorService.getEstimate(params.id);

    if (!estimate) {
      return NextResponse.json(
        { error: 'Estimate not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, estimate });
  } catch (error) {
    console.error('[Estimate API] GET error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch estimate' },
      { status: 500 }
    );
  }
}
