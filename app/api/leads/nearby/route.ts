// Nearby Contacts API
// POST: Search for existing contacts near an address

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-service';
import { geocodingService } from '@/lib/geocoding-service';
import { googleSheetsService } from '@/lib/google-sheets-service';
import { cache, CACHE_TTL } from '@/lib/cache';
import { GeocodedContact } from '@/lib/geocoding-service';

export async function POST(request: NextRequest) {
  const auth = await requireAuth();
  if (!auth.authenticated) return auth.response;

  try {
    const { address, radiusMiles } = await request.json();

    if (!address) {
      return NextResponse.json(
        { success: false, error: 'address is required' },
        { status: 400 }
      );
    }

    const radius = radiusMiles || 2.0;

    // Get all geocoded contacts from sheets (populated from JN geo data)
    const geocodedCacheKey = 'sheets:geocoded-contacts';
    let sheetContacts = cache.get<Awaited<ReturnType<typeof googleSheetsService.getGeocodedContacts>>>(geocodedCacheKey);
    if (!sheetContacts) {
      sheetContacts = await googleSheetsService.getGeocodedContacts();
      cache.set(geocodedCacheKey, sheetContacts, CACHE_TTL.TEAM);
    }

    // Convert to GeocodedContact format
    const contacts: GeocodedContact[] = sheetContacts
      .filter(c => c.lat && c.lng)
      .map(c => ({
        jnid: c.jnid,
        name: c.name,
        address: c.address,
        lat: parseFloat(c.lat),
        lng: parseFloat(c.lng),
        placeId: c.placeId,
        type: c.type as GeocodedContact['type'],
        salesRep: c.salesRep,
        jobStatus: c.jobStatus,
        lastInteraction: c.lastInteraction,
        interactionType: c.interactionType,
        createdAt: c.createdAt,
      }));

    // Get intelligence for this address
    const intelligence = await geocodingService.getAddressIntelligence(
      address,
      contacts,
      radius
    );

    return NextResponse.json({
      success: true,
      data: {
        geocoded: intelligence.geocoded ? {
          lat: intelligence.geocoded.lat,
          lng: intelligence.geocoded.lng,
          formattedAddress: intelligence.geocoded.formattedAddress,
          county: intelligence.county,
        } : null,
        exactMatches: intelligence.exactMatches.length,
        sameStreetCount: intelligence.sameStreet.length,
        nearbyCount: intelligence.nearbyContacts.length,
        nearbyContacts: intelligence.nearbyContacts.slice(0, 20).map(c => ({
          name: c.name,
          address: c.address,
          distanceMiles: Math.round(c.distanceMiles * 100) / 100,
          type: c.type,
          salesRep: c.salesRep,
          jobStatus: c.jobStatus,
          lastInteraction: c.lastInteraction,
        })),
        nearbyByRep: Object.entries(intelligence.nearbyByRep).map(([rep, data]) => ({
          repSlug: rep,
          count: data.count,
          closestMiles: data.contacts.length > 0
            ? Math.round(data.contacts[0].distanceMiles * 100) / 100
            : null,
        })),
      },
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
