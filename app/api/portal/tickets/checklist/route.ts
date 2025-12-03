import { NextRequest, NextResponse } from 'next/server';
import { deliveryWorkflowService } from '@/lib/delivery-workflow-service';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const ticketId = searchParams.get('ticketId');

    if (!ticketId) {
      return NextResponse.json({ error: 'ticketId is required' }, { status: 400 });
    }

    const checklist = await deliveryWorkflowService.getTicketChecklist(ticketId);
    return NextResponse.json(checklist);
  } catch (error) {
    console.error('Checklist API GET error:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
