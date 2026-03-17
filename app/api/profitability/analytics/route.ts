import { NextRequest, NextResponse } from 'next/server';
import { profitabilityService } from '@/lib/profitability-service';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('startDate') || undefined;
    const endDate = searchParams.get('endDate') || undefined;

    const analytics = profitabilityService.getAnalytics(startDate, endDate);
    return NextResponse.json({ success: true, data: analytics });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
