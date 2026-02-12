// Lead Assignment API
// POST: Confirm rep assignment for a lead
// Executes: JN sync, portal creation, response timer start

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-service';
import { leadPipelineOrchestrator } from '@/lib/lead-pipeline-orchestrator';
import { leadPortalService } from '@/lib/lead-portal-service';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth();
  if (!auth.authenticated) return auth.response;

  try {
    const { id: leadId } = await params;

    let body: {
      repSlug: string;
      customerName: string;
      customerEmail: string;
      customerPhone: string;
      customerAddress: string;
      createPortal?: boolean;
      syncToJN?: boolean;
    };

    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { success: false, error: 'Invalid request body' },
        { status: 400 }
      );
    }

    if (!body.repSlug) {
      return NextResponse.json(
        { success: false, error: 'repSlug is required' },
        { status: 400 }
      );
    }

    // Execute the assignment
    const result = await leadPipelineOrchestrator.confirmAssignment({
      leadId,
      repSlug: body.repSlug,
      customerName: body.customerName || '',
      customerEmail: body.customerEmail || '',
      customerPhone: body.customerPhone || '',
      customerAddress: body.customerAddress || '',
      createPortal: body.createPortal !== false,
      syncToJN: body.syncToJN !== false,
    });

    // Update lead status if we have a lead record
    try {
      await leadPortalService.updateLeadStatus(leadId, 'contacted', 'system');
    } catch {
      // Lead may not exist in portal service yet
    }

    return NextResponse.json({
      success: result.success,
      data: {
        leadId: result.leadId,
        portalUrl: result.portalUrl,
        jnContactId: result.jnContactId,
        timerStarted: result.timerStarted,
        repSlug: body.repSlug,
      },
      errors: result.errors.length > 0 ? result.errors : undefined,
    });
  } catch (error) {
    console.error('Error assigning lead:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
