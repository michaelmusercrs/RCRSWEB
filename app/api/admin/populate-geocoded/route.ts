// Admin Populate Geocoded Contacts API
// POST: Populate geocoded contacts from JN's built-in geo field (no external geocoding needed)
// GET: Check current geocoded contact count

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-service';
import { jobNimbusService, isJobNimbusConfigured } from '@/lib/jobnimbus-service';
import { googleSheetsService, GeocodedContactRecord } from '@/lib/google-sheets-service';
import { cache, CACHE_TTL } from '@/lib/cache';

interface PopulateResult {
  totalContacts: number;
  withGeo: number;
  saved: number;
  skippedNoAddress: number;
  skippedNoGeo: number;
  alreadyExists: number;
  durationMs: number;
  errors: string[];
}

async function populateFromJNGeo(): Promise<PopulateResult> {
  const startTime = Date.now();
  const errors: string[] = [];

  // Get existing geocoded contacts to skip duplicates
  let existingJnids = new Set<string>();
  try {
    const existing = await googleSheetsService.getGeocodedContacts();
    existingJnids = new Set(existing.map(c => c.jnid));
  } catch {
    // Sheet might not exist yet
  }

  // Fetch all JN contacts with pagination
  const newRecords: GeocodedContactRecord[] = [];
  let totalContacts = 0;
  let withGeo = 0;
  let skippedNoAddress = 0;
  let skippedNoGeo = 0;
  let alreadyExists = 0;

  let offset = 0;
  const pageSize = 100;
  let hasMore = true;
  let pageCount = 0;

  while (hasMore && pageCount < 120) {
    try {
      const page = await jobNimbusService.getContacts({ limit: pageSize, offset });

      for (const c of page.results) {
        totalContacts++;

        const address = [c.address_line1, c.city, c.state_text, c.zip].filter(Boolean).join(', ');
        if (address.length <= 5) {
          skippedNoAddress++;
          continue;
        }

        if (existingJnids.has(c.jnid)) {
          alreadyExists++;
          continue;
        }

        // Use JN's built-in geo field
        if (!c.geo?.lat || !c.geo?.lng) {
          skippedNoGeo++;
          continue;
        }

        withGeo++;
        const name = c.display_name || `${c.first_name || ''} ${c.last_name || ''}`.trim() || 'Unknown';
        const statusLower = (c.status_name || c.status || '').toLowerCase();
        let type = 'contact';
        if (statusLower.includes('complete') || statusLower.includes('closed')) type = 'install';
        else if (statusLower.includes('lead') || statusLower.includes('new')) type = 'lead';

        const repName = c.sales_rep_name || '';
        const repSlug = repName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');

        newRecords.push({
          jnid: c.jnid,
          name,
          address,
          lat: String(c.geo.lat),
          lng: String(c.geo.lng),
          placeId: '',
          type,
          salesRep: repSlug,
          jobStatus: c.status_name || c.status || '',
          lastInteraction: c.updated_at ? new Date(c.updated_at * 1000).toISOString() : '',
          interactionType: type,
          createdAt: new Date().toISOString(),
        });
      }

      offset += pageSize;
      hasMore = page.results.length === pageSize;
      pageCount++;
    } catch (err) {
      errors.push(`Page ${pageCount} error: ${err instanceof Error ? err.message : String(err)}`);
      break;
    }
  }

  // Save in batches
  let saved = 0;
  if (newRecords.length > 0) {
    try {
      const result = await googleSheetsService.addGeocodedContactsBatch(newRecords);
      saved = result.added;
      if (result.errors > 0) {
        errors.push(`${result.errors} records failed to save`);
      }
    } catch (err) {
      errors.push(`Save error: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  return {
    totalContacts,
    withGeo,
    saved,
    skippedNoAddress,
    skippedNoGeo,
    alreadyExists,
    durationMs: Date.now() - startTime,
    errors,
  };
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth();
  if (!auth.authenticated) return auth.response;

  if (!isJobNimbusConfigured()) {
    return NextResponse.json(
      { success: false, error: 'JobNimbus API not configured' },
      { status: 400 }
    );
  }

  try {
    // Run with timeout race
    const resultPromise = populateFromJNGeo();
    const timeoutPromise = new Promise<null>(resolve =>
      setTimeout(() => resolve(null), 25000)
    );

    const result = await Promise.race([resultPromise, timeoutPromise]);

    if (result) {
      cache.invalidate('sheets:geocoded-stats');
      cache.invalidate('sheets:geocoded-contacts');
      return NextResponse.json({
        success: true,
        status: 'complete',
        data: result,
      });
    }

    // Still running in background
    resultPromise.then(() => {
      // completed in background
    }).catch(err => {
      console.error('[PopulateGeocoded] Background failed:', err);
    });

    return NextResponse.json({
      success: true,
      status: 'running',
      message: 'Geocode population started in background using JN geo data. This may take several minutes for 10K+ contacts.',
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
    const geoCacheKey = 'sheets:geocoded-stats';
    const cachedGeo = cache.get(geoCacheKey);
    if (cachedGeo) {
      return NextResponse.json(cachedGeo, {
        headers: { 'Cache-Control': 'private, s-maxage=30' },
      });
    }

    const contacts = await googleSheetsService.getGeocodedContacts();

    const byType: Record<string, number> = {};
    const byRep: Record<string, number> = {};
    for (const c of contacts) {
      byType[c.type || 'unknown'] = (byType[c.type || 'unknown'] || 0) + 1;
      if (c.salesRep) {
        byRep[c.salesRep] = (byRep[c.salesRep] || 0) + 1;
      }
    }

    const geoResponse = {
      success: true,
      data: {
        totalGeocoded: contacts.length,
        byType,
        byRep,
      },
    };
    cache.set(geoCacheKey, geoResponse, CACHE_TTL.TEAM);
    return NextResponse.json(geoResponse, {
      headers: { 'Cache-Control': 'private, s-maxage=30' },
    });
  } catch (error) {
    console.error('Error fetching geocoded stats:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
