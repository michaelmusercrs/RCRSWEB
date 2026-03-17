import { NextRequest, NextResponse } from 'next/server';
import { reportGeneratorService } from '@/lib/report-generator-service';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { configId, dateRange } = body;

    if (!configId) {
      return NextResponse.json(
        { success: false, error: 'configId is required' },
        { status: 400 }
      );
    }

    const report = reportGeneratorService.generateReport(configId, dateRange);
    return NextResponse.json({ success: true, data: report });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
