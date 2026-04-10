import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth-service';
import { reportGeneratorService } from '@/lib/report-generator-service';

export async function GET() {
  try {
    const configs = reportGeneratorService.getReportConfigs();
    return NextResponse.json({ success: true, data: configs });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.authenticated) return auth.response;

  try {
    const body = await request.json();
    const config = reportGeneratorService.createReportConfig(body);
    return NextResponse.json({ success: true, data: config });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
