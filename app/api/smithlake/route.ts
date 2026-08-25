import { NextResponse } from 'next/server';
import smithlake from '@/data/smithlake.json';

// Smith Lake homeowner marketing database (public county parcel/owner records
// joined with hail-impact data). Served OPEN (no login) as an internal
// dashboard — same pattern as /reps and /calls — but noindex so it stays out of
// search results. If this needs to be re-gated later, wrap with requireAuth()
// from '@/lib/auth-service' and restore the /portal/smithlake route + rule.
export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json(smithlake, {
    headers: {
      'Cache-Control': 'public, max-age=300',
      'X-Robots-Tag': 'noindex, nofollow',
    },
  });
}
