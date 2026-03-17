import { NextRequest, NextResponse } from 'next/server';
import { reportGeneratorService } from '@/lib/report-generator-service';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : undefined;

    const reports = reportGeneratorService.getReportHistory(limit);
    return NextResponse.json({ success: true, data: reports });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
