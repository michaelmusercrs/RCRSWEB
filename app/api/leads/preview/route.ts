// Lead Distribution Preview API
// POST: Preview distribution scores for an address without assigning

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-service';
import { leadDistributionService } from '@/lib/lead-distribution-service';

export async function POST(request: NextRequest) {
  const auth = await requireAuth();
  if (!auth.authenticated) return auth.response;

  try {
    const body = await request.json();

    if (!body.address || typeof body.address !== 'string' || !body.address.trim()) {
      return NextResponse.json(
        { success: false, error: 'address is required' },
        { status: 400 }
      );
    }

    const scores = await leadDistributionService.getDistributionPreview(body.address.trim());

    return NextResponse.json({
      success: true,
      data: { scores },
    });
  } catch (error) {
    console.error('[Leads Preview API] Error generating preview:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to generate distribution preview' },
      { status: 500 }
    );
  }
}
