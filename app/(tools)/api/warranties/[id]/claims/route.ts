/**
 * RCRS Warranty Claims API
 *
 * GET  /api/warranties/[id]/claims - List claims for a warranty
 * POST /api/warranties/[id]/claims - Submit a new claim
 *
 * @author RCRS Development Team
 * @version 1.0.0
 */

import { NextRequest, NextResponse } from 'next/server';
import { warrantyService } from '@/lib/warranty-service';

/**
 * GET /api/warranties/[id]/claims
 *
 * Returns all claims for the specified warranty, sorted newest first.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const warranty = warrantyService.getWarranty(params.id);
    if (!warranty) {
      return NextResponse.json(
        { error: 'Warranty not found' },
        { status: 404 }
      );
    }

    const claims = warrantyService.getClaimsForWarranty(params.id);

    return NextResponse.json({
      success: true,
      warrantyId: params.id,
      claims,
      total: claims.length,
    });
  } catch (error) {
    console.error('[Claims API] GET error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch claims' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/warranties/[id]/claims
 *
 * Submit a new warranty claim.
 *
 * Body:
 * - issueDescription (required)
 * - category: leak | shingle_damage | flashing | gutter | ventilation | other
 * - severity: minor | moderate | major | emergency
 * - photos: string[] (optional)
 * - notes: string (optional)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();

    if (!body.issueDescription || body.issueDescription.trim() === '') {
      return NextResponse.json(
        { error: 'issueDescription is required' },
        { status: 400 }
      );
    }

    const validCategories = ['leak', 'shingle_damage', 'flashing', 'gutter', 'ventilation', 'other'];
    if (body.category && !validCategories.includes(body.category)) {
      return NextResponse.json(
        { error: `Invalid category. Must be one of: ${validCategories.join(', ')}` },
        { status: 400 }
      );
    }

    const validSeverities = ['minor', 'moderate', 'major', 'emergency'];
    if (body.severity && !validSeverities.includes(body.severity)) {
      return NextResponse.json(
        { error: `Invalid severity. Must be one of: ${validSeverities.join(', ')}` },
        { status: 400 }
      );
    }

    const claim = warrantyService.submitClaim(params.id, {
      issueDescription: body.issueDescription.trim(),
      category: body.category || 'other',
      severity: body.severity || 'moderate',
      photos: body.photos || [],
      notes: body.notes || '',
    });

    if (!claim) {
      return NextResponse.json(
        { error: 'Warranty not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      claim,
    }, { status: 201 });
  } catch (error) {
    console.error('[Claims API] POST error:', error);
    return NextResponse.json(
      { error: 'Failed to submit claim' },
      { status: 500 }
    );
  }
}
