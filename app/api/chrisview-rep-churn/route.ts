import { NextResponse } from 'next/server';
import { getRepChurnSignal } from '@/lib/rep-churn-signal';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  try {
    return NextResponse.json(await getRepChurnSignal());
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
