// Admin Populate Geocoded Contacts API
// POST: Trigger batch geocoding of JN contacts into Geocoded_Contacts sheet
// GET: Check current geocoded contact count

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-service';
import { jnGeocodePopulator } from '@/lib/jn-geocode-populator';
import { googleSheetsService } from '@/lib/google-sheets-service';

export async function POST(request: NextRequest) {
  const auth = await requireAuth();
  if (!auth.authenticated) return auth.response;

  try {
    // This can take a few minutes for large contact lists
    const resultPromise = jnGeocodePopulator.populateGeocodedContacts();

    // Wait up to 15 seconds for quick results
    const timeoutPromise = new Promise<null>(resolve =>
      setTimeout(() => resolve(null), 15000)
    );

    const result = await Promise.race([resultPromise, timeoutPromise]);

    if (result) {
      return NextResponse.json({
        success: true,
        status: 'complete',
        data: {
          totalContacts: result.totalContacts,
          alreadyGeocoded: result.alreadyGeocoded,
          newlyGeocoded: result.newlyGeocoded,
          failed: result.failed,
          skippedNoAddress: result.skippedNoAddress,
          durationMs: result.durationMs,
          errorCount: result.errors.length,
          errors: result.errors.slice(0, 5),
        },
      });
    }

    // Still running
    resultPromise.then(r => {
      console.log(`[PopulateGeocoded] Background complete: ${r.newlyGeocoded} new, ${r.failed} failed`);
    }).catch(err => {
      console.error('[PopulateGeocoded] Background failed:', err);
    });

    return NextResponse.json({
      success: true,
      status: 'running',
      message: 'Geocode population started in background. This may take several minutes.',
    });
  } catch (error) {
    console.error('Error populating geocoded contacts:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  const auth = await requireAuth();
  if (!auth.authenticated) return auth.response;

  try {
    const contacts = await googleSheetsService.getGeocodedContacts();

    // Group by type
    const byType: Record<string, number> = {};
    const byRep: Record<string, number> = {};
    for (const c of contacts) {
      byType[c.type || 'unknown'] = (byType[c.type || 'unknown'] || 0) + 1;
      if (c.salesRep) {
        byRep[c.salesRep] = (byRep[c.salesRep] || 0) + 1;
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        totalGeocoded: contacts.length,
        byType,
        byRep,
      },
    });
  } catch (error) {
    console.error('Error fetching geocoded stats:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
