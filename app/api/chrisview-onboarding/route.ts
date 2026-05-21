import { NextResponse } from 'next/server';
import { getOnboardingCurve } from '@/lib/onboarding-curve';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  try {
    return NextResponse.json(await getOnboardingCurve());
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
