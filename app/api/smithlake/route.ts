import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-service';
import smithlake from '@/data/smithlake.json';

// Smith Lake homeowner marketing database (public county parcel/owner records
// joined with hail-impact data). Contains PII (owner names + mailing
// addresses), so this endpoint is AUTH-GATED — any logged-in portal user may
// read it, but it is never exposed publicly or indexed.
export const dynamic = 'force-dynamic';

export async function GET() {
  const auth = await requireAuth();
  if (!auth.authenticated) return auth.response;

  return NextResponse.json(smithlake, {
    headers: {
      'Cache-Control': 'private, max-age=300',
      'X-Robots-Tag': 'noindex, nofollow',
    },
  });
}
