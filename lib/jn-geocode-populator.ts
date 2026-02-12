// JN Geocode Populator
// Fetches all JobNimbus contacts with addresses and batch-geocodes them
// into the Geocoded_Contacts Google Sheet for proximity-based lead assignment.
//
// Uses Nominatim (free, no API key) with strict 1 req/sec rate limiting.

import { jobNimbusService, isJobNimbusConfigured } from './jobnimbus-service';
import { batchGeocodeWithNominatim } from './nominatim-geocoder';
import { matchRepToTeamMember } from './jn-sync-engine';
import {
  googleSheetsService,
  GeocodedContactRecord,
} from './google-sheets-service';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PopulateResult {
  totalContacts: number;
  alreadyGeocoded: number;
  newlyGeocoded: number;
  failed: number;
  skippedNoAddress: number;
  durationMs: number;
  errors: string[];
}

const MAX_PAGES = 100;

// ---------------------------------------------------------------------------
// JN Geocode Populator
// ---------------------------------------------------------------------------

class JNGeocodePopulator {
  /**
   * Fetch all JN contacts with addresses, check which are already in the
   * Geocoded_Contacts sheet, batch geocode the missing ones, and write them.
   *
   * Uses Nominatim for geocoding (free, 1 req/sec rate limit).
   */
  async populateGeocodedContacts(): Promise<PopulateResult> {
    if (!isJobNimbusConfigured()) {
      throw new Error('JobNimbus API not configured');
    }

    const startTime = Date.now();
    const errors: string[] = [];

    // Step 1: Fetch all contacts from JN
    console.log('[GeoPopulator] Fetching contacts from JobNimbus...');
    const allContacts: Array<{
      jnid: string;
      name: string;
      address: string;
      salesRep: string;
      status: string;
      createdAt: number;
    }> = [];

    let offset = 0;
    const pageSize = 100;
    let hasMore = true;
    let pageCount = 0;

    while (hasMore && pageCount < MAX_PAGES) {
      try {
        const result = await jobNimbusService.getContacts({ limit: pageSize, offset });
        for (const c of result.results) {
          const address = [c.address_line1, c.city, c.state_text, c.zip].filter(Boolean).join(', ');
          const name = c.display_name || `${c.first_name || ''} ${c.last_name || ''}`.trim() || 'Unknown';

          allContacts.push({
            jnid: c.jnid,
            name,
            address,
            salesRep: c.sales_rep_name || '',
            status: c.status || '',
            createdAt: c.created_at || 0,
          });
        }
        offset += pageSize;
        hasMore = result.results.length === pageSize;
        pageCount++;
      } catch (err) {
        errors.push(`Failed fetching contacts page ${pageCount}: ${err instanceof Error ? err.message : String(err)}`);
        break;
      }
    }

    console.log(`[GeoPopulator] Fetched ${allContacts.length} contacts from JN`);

    // Step 2: Filter contacts that have addresses
    const withAddress = allContacts.filter(c => c.address && c.address.length > 10);
    const skippedNoAddress = allContacts.length - withAddress.length;

    // Step 3: Load existing geocoded contacts
    const existingContacts = await googleSheetsService.getGeocodedContacts();
    const existingJnids = new Set(existingContacts.map(c => c.jnid));

    // Step 4: Find contacts that need geocoding
    const needsGeocoding = withAddress.filter(c => !existingJnids.has(c.jnid));
    const alreadyGeocoded = withAddress.length - needsGeocoding.length;

    console.log(`[GeoPopulator] ${alreadyGeocoded} already geocoded, ${needsGeocoding.length} need geocoding`);

    if (needsGeocoding.length === 0) {
      return {
        totalContacts: allContacts.length,
        alreadyGeocoded,
        newlyGeocoded: 0,
        failed: 0,
        skippedNoAddress,
        durationMs: Date.now() - startTime,
        errors,
      };
    }

    // Step 5: Batch geocode missing addresses using Nominatim (1 req/sec)
    const addressBatch = needsGeocoding.map(c => ({
      id: c.jnid,
      address: c.address,
    }));

    console.log(`[GeoPopulator] Batch geocoding ${addressBatch.length} addresses via Nominatim (1/sec)...`);
    const geocodeResults = await batchGeocodeWithNominatim(
      addressBatch,
      (completed, total) => {
        if (completed % 10 === 0 || completed === total) {
          console.log(`[GeoPopulator] Geocoded ${completed}/${total}`);
        }
      }
    );

    // Step 6: Build records and write to sheet
    const newRecords: GeocodedContactRecord[] = [];
    let failed = 0;

    for (const contact of needsGeocoding) {
      const geo = geocodeResults.get(contact.jnid);
      if (!geo) {
        failed++;
        continue;
      }

      // Match sales rep to team member for slug
      const teamMember = matchRepToTeamMember(contact.salesRep);

      newRecords.push({
        jnid: contact.jnid,
        name: contact.name,
        address: geo.displayName || contact.address,
        lat: String(geo.lat),
        lng: String(geo.lng),
        placeId: geo.placeId || '',
        type: 'contact',
        salesRep: teamMember?.slug || contact.salesRep,
        jobStatus: contact.status,
        lastInteraction: '',
        interactionType: '',
        createdAt: contact.createdAt ? new Date(contact.createdAt * 1000).toISOString() : '',
      });
    }

    // Write in batches to avoid overwhelming the Sheets API
    if (newRecords.length > 0) {
      console.log(`[GeoPopulator] Writing ${newRecords.length} new geocoded records to sheet...`);
      const batchResult = await googleSheetsService.addGeocodedContactsBatch(newRecords);
      if (batchResult.errors > 0) {
        errors.push(`${batchResult.errors} records failed to write to sheet`);
      }
    }

    const durationMs = Date.now() - startTime;
    console.log(`[GeoPopulator] Complete in ${(durationMs / 1000).toFixed(1)}s. ${newRecords.length} new, ${failed} failed geocoding.`);

    return {
      totalContacts: allContacts.length,
      alreadyGeocoded,
      newlyGeocoded: newRecords.length,
      failed,
      skippedNoAddress,
      durationMs,
      errors,
    };
  }
}

// Export singleton
export const jnGeocodePopulator = new JNGeocodePopulator();
