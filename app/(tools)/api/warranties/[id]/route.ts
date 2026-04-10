/**
 * RCRS Single Warranty API
 *
 * GET    /api/warranties/[id] - Get warranty details
 * PATCH  /api/warranties/[id] - Update warranty
 * DELETE /api/warranties/[id] - Archive warranty (soft delete)
 *
 * @author RCRS Development Team
 * @version 1.0.0
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-service';
import { warrantyService } from '@/lib/warranty-service';

/**
 * GET /api/warranties/[id]
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const warranty = await warrantyService.getWarranty(params.id);

    if (!warranty) {
      return NextResponse.json(
        { error: 'Warranty not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, warranty });
  } catch (error) {
    console.error('[Warranty API] GET error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch warranty' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/warranties/[id]
 *
 * Update warranty fields. Accepts partial warranty object.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await requireAuth();
    if (!auth.authenticated) return auth.response;

    const body = await request.json();

    const warranty = await warrantyService.updateWarranty(params.id, body);

    if (!warranty) {
      return NextResponse.json(
        { error: 'Warranty not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, warranty });
  } catch (error) {
    console.error('[Warranty API] PATCH error:', error);
    return NextResponse.json(
      { error: 'Failed to update warranty' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/warranties/[id]
 *
 * Archives (voids) the warranty. Does not permanently delete.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await requireAuth();
    if (!auth.authenticated) return auth.response;

    const success = await warrantyService.archiveWarranty(params.id);

    if (!success) {
      return NextResponse.json(
        { error: 'Warranty not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, message: 'Warranty archived' });
  } catch (error) {
    console.error('[Warranty API] DELETE error:', error);
    return NextResponse.json(
      { error: 'Failed to archive warranty' },
      { status: 500 }
    );
  }
}
