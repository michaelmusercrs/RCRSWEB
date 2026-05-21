// Geocode Sync Service
// Batch geocodes all contacts from JobNimbus AND Google Sheets Customers,
// then stores lat/lng in the Geocoded_Contacts sheet.
//
// Uses Nominatim (free, no API key) with 1 req/sec rate limit.

import { jobNimbusService, isJobNimbusConfigured } from './jobnimbus-service';
import { geocodeWithNominatim } from './nominatim-geocoder';
import { googleSheetsService, GeocodedContactRecord } from './google-sheets-service';

export interface SyncProgress {
  status: 'idle' | 'fetching' | 'geocoding' | 'saving' | 'complete' | 'error';
  totalContacts: number;
  geocoded: number;
  skipped: number;
  saved: number;
  errors: number;
  startedAt?: string;
  completedAt?: string;
  errorMessage?: string;
}

// In-memory progress tracker (resets on server restart)
let currentSync: SyncProgress = {
  status: 'idle',
  totalContacts: 0,
  geocoded: 0,
  skipped: 0,
  saved: 0,
  errors: 0,
};

export function getSyncProgress(): SyncProgress {
  return { ...currentSync };
}

// Convert a rep name from JN to a slug (lowercase, hyphenated)
function repNameToSlug(name?: string): string {
  if (!name) return '';
  return name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
}

// Build full address string from JN contact or job fields
function buildAddress(record: {
  address_line1?: string;
  city?: string;
  state_text?: string;
  zip?: string;
}): string {
  const parts = [
    record.address_line1,
    record.city,
    record.state_text,
    record.zip,
  ].filter(Boolean);
  return parts.join(', ');
}

// Build full address from Google Sheets customer record
function buildCustomerAddress(customer: {
  address: string;
  city: string;
  state: string;
  zip: string;
}): string {
  const parts = [
    customer.address,
    customer.city,
    customer.state,
    customer.zip,
  ].filter(Boolean);
  return parts.join(', ');
}

function emptyGeocodedRecord(): GeocodedContactRecord {
  return {
    jnid: '', name: '', firstName: '', lastName: '', company: '',
    address: '', city: '', state: '', zip: '',
    lat: '', lng: '', placeId: '',
    email: '', mobilePhone: '', homePhone: '',
    type: '', recordType: '',
    salesRep: '', salesRepName: '', salesRepId: '',
    jobStatus: '', isClosed: '', isArchived: '',
    source: '', tags: '',
    approvedEstimateTotal: '', approvedInvoiceTotal: '', lastBudgetRevenue: '',
    dateOfLoss: '',
    dateCreated: '', dateUpdated: '', lastInteraction: '', interactionType: '',
    createdAt: '',
  };
}

const isoFromEpoch = (n?: number) => (n ? new Date(n * 1000).toISOString() : '');

export async function runGeocodeSync(): Promise<SyncProgress> {
  if (currentSync.status === 'fetching' || currentSync.status === 'geocoding' || currentSync.status === 'saving') {
    return currentSync; // Already running
  }

  currentSync = {
    status: 'fetching',
    totalContacts: 0,
    geocoded: 0,
    skipped: 0,
    saved: 0,
    errors: 0,
    startedAt: new Date().toISOString(),
  };

  try {
    // ─── 1. Get existing geocoded contacts to skip already-done ones ─────
    const existingGeocoded = await googleSheetsService.getGeocodedContacts();
    const existingJnids = new Set(existingGeocoded.map(c => c.jnid));

    // ─── 2. Collect contacts from all sources ────────────────────────────
    interface ContactToGeocode {
      id: string;           // jnid or customerId
      name: string;
      address: string;
      salesRep: string;
      status: string;
      type: string;         // 'contact' | 'lead' | 'install' | 'customer'
      source: 'jobnimbus' | 'sheets';
      updatedAt: string;
    }

    const allContacts: ContactToGeocode[] = [];

    // ─── 2a. Fetch from JobNimbus ────────────────────────────────────────
    // Contacts with JN's built-in geo field are saved directly (no Nominatim needed).
    const directGeoRecords: GeocodedContactRecord[] = [];

    if (isJobNimbusConfigured()) {
      try {
        // Internal sync — geocoder consumes address fields only. Owner-tier
        // viewer is safe; nothing here surfaces to user-facing JSON.
        const jnContacts = await jobNimbusService.syncContacts(undefined, { canSeeCost: true });
        for (const c of jnContacts) {
          const address = buildAddress(c);
          if (address.length <= 5) continue;
          if (existingJnids.has(c.jnid)) continue;

          const statusLower = (c.status || c.status_name || '').toLowerCase();
          let type = 'contact';
          if (statusLower.includes('complete') || statusLower.includes('closed')) {
            type = 'install';
          } else if (statusLower.includes('lead') || statusLower.includes('new')) {
            type = 'lead';
          }

          const name = jobNimbusService.getContactName(c);
          const salesRep = repNameToSlug(c.sales_rep_name);
          const updatedAt = c.updated_at ? new Date(c.updated_at * 1000).toISOString() : '';

          // If JN already has geo data, save directly without Nominatim.
          // JN API returns `lon` (older convention); accept either.
          const geoLat = c.geo?.lat;
          const geoLng = c.geo?.lng ?? c.geo?.lon;
          if (geoLat != null && geoLng != null) {
            const dateOfLossRaw = (c['Date of Loss'] ?? c.cf_date_1) as number | undefined;
            directGeoRecords.push({
              ...emptyGeocodedRecord(),
              jnid: c.jnid,
              name,
              firstName: c.first_name || '',
              lastName: c.last_name || '',
              company: c.company || '',
              address,
              city: c.city || '',
              state: c.state_text || '',
              zip: c.zip || '',
              lat: String(geoLat),
              lng: String(geoLng),
              email: c.email || '',
              mobilePhone: c.mobile_phone || '',
              homePhone: c.home_phone || '',
              type,
              recordType: c.record_type_name || c.record_type || '',
              salesRep,
              salesRepName: c.sales_rep_name || '',
              salesRepId: c.sales_rep || '',
              jobStatus: c.status_name || c.status || '',
              isClosed: c.is_closed ? 'true' : 'false',
              isArchived: c.is_archived ? 'true' : 'false',
              source: c.source_name || c.source || '',
              tags: Array.isArray(c.tags) ? c.tags.join('|') : '',
              approvedEstimateTotal: c.approved_estimate_total != null ? String(c.approved_estimate_total) : '',
              approvedInvoiceTotal: c.approved_invoice_total != null ? String(c.approved_invoice_total) : '',
              lastBudgetRevenue: c.last_budget_revenue != null ? String(c.last_budget_revenue) : '',
              dateOfLoss: isoFromEpoch(dateOfLossRaw),
              dateCreated: isoFromEpoch(c.date_created),
              dateUpdated: isoFromEpoch(c.date_updated) || updatedAt,
              lastInteraction: isoFromEpoch(c.date_status_change) || updatedAt,
              interactionType: type,
              createdAt: new Date().toISOString(),
            });
            currentSync.geocoded++;
          } else {
            // No geo from JN — queue for Nominatim geocoding
            allContacts.push({
              id: c.jnid,
              name,
              address,
              salesRep,
              status: c.status || '',
              type,
              source: 'jobnimbus',
              updatedAt,
            });
          }
        }
      } catch (err) {
        console.warn('[GeocodeSync] JobNimbus fetch failed:', err);
      }
    } else {
    }

    // ─── 2b. Fetch from Google Sheets Customers ──────────────────────────
    try {
      const customers = await googleSheetsService.getCustomers();
      let sheetsAdded = 0;
      for (const c of customers) {
        const address = buildCustomerAddress(c);
        if (address.length <= 5) continue;

        // Use customerId as the unique key, prefixed to avoid collision with JN ids
        const geocodeId = `sheets-${c.customerId}`;
        if (existingJnids.has(geocodeId)) continue;

        allContacts.push({
          id: geocodeId,
          name: c.name,
          address,
          salesRep: repNameToSlug(c.salesRep),
          status: 'customer',
          type: 'contact',
          source: 'sheets',
          updatedAt: c.updatedAt || '',
        });
        sheetsAdded++;
      }
    } catch (err) {
      console.warn('[GeocodeSync] Google Sheets customer fetch failed:', err);
    }

    currentSync.totalContacts = allContacts.length + directGeoRecords.length + existingJnids.size;
    currentSync.skipped = existingJnids.size;

    // ─── 2c. Save contacts that already have geo from JN ─────────────
    if (directGeoRecords.length > 0) {
      currentSync.status = 'saving';
      try {
        const directSave = await googleSheetsService.addGeocodedContactsBatch(directGeoRecords);
        currentSync.saved += directSave.added;
        currentSync.errors += directSave.errors;
        // directSave complete
      } catch (err) {
        console.warn('[GeocodeSync] Failed to save direct geo records:', err);
      }
    }

    if (allContacts.length === 0) {
      currentSync.status = 'complete';
      currentSync.completedAt = new Date().toISOString();
      return currentSync;
    }

    currentSync.status = 'geocoding';

    // ─── 3. Geocode remaining contacts via Nominatim (1 per second) ──
    const geocodedRecords: GeocodedContactRecord[] = [];

    for (let i = 0; i < allContacts.length; i++) {
      const contact = allContacts[i];

      try {
        const result = await geocodeWithNominatim(contact.address);

        if (result) {
          currentSync.geocoded++;

          const record: GeocodedContactRecord = {
            ...emptyGeocodedRecord(),
            jnid: contact.id,
            name: contact.name,
            address: result.displayName || contact.address,
            lat: String(result.lat),
            lng: String(result.lng),
            placeId: result.placeId,
            type: contact.type,
            salesRep: contact.salesRep,
            jobStatus: contact.status,
            lastInteraction: contact.updatedAt,
            interactionType: contact.type,
            createdAt: new Date().toISOString(),
          };

          geocodedRecords.push(record);
        } else {
          currentSync.errors++;
        }
      } catch (err) {
        currentSync.errors++;
        console.warn(`[GeocodeSync] Failed to geocode "${contact.address}":`, err);
      }

      // Log progress every 10 contacts
      if ((i + 1) % 10 === 0 || i + 1 === allContacts.length) {
      }
    }

    // ─── 4. Save to Google Sheets ────────────────────────────────────────
    currentSync.status = 'saving';

    if (geocodedRecords.length > 0) {
      const saveResult = await googleSheetsService.addGeocodedContactsBatch(geocodedRecords);
      currentSync.saved = saveResult.added;
      currentSync.errors += saveResult.errors;
    }

    currentSync.status = 'complete';
    currentSync.completedAt = new Date().toISOString();


    return currentSync;
  } catch (error) {
    currentSync.status = 'error';
    currentSync.errorMessage = error instanceof Error ? error.message : 'Unknown error';
    currentSync.completedAt = new Date().toISOString();
    console.error('[GeocodeSync] Error:', error);
    return currentSync;
  }
}

/**
 * Geocode a single contact and save to the Geocoded_Contacts sheet.
 * Used for real-time geocoding when new leads/contacts are created.
 * Returns the geocoded record or null if geocoding failed.
 */
export async function geocodeAndSaveContact(params: {
  id: string;
  name: string;
  address: string;
  salesRep?: string;
  type?: string;
  status?: string;
}): Promise<GeocodedContactRecord | null> {
  if (!params.address || params.address.length < 5 || params.address === 'Not provided') {
    return null;
  }

  try {
    const result = await geocodeWithNominatim(params.address);
    if (!result) return null;

    const record: GeocodedContactRecord = {
      ...emptyGeocodedRecord(),
      jnid: params.id,
      name: params.name,
      address: result.displayName || params.address,
      lat: String(result.lat),
      lng: String(result.lng),
      placeId: result.placeId,
      type: params.type || 'lead',
      salesRep: params.salesRep || '',
      jobStatus: params.status || '',
      lastInteraction: new Date().toISOString(),
      interactionType: params.type || 'lead',
      createdAt: new Date().toISOString(),
    };

    const saved = await googleSheetsService.addGeocodedContact(record);
    if (saved) {
      return record;
    }

    return record; // Return even if save failed (geocoding succeeded)
  } catch (error) {
    console.error(`[GeocodeSync] Failed to geocode contact "${params.name}":`, error);
    return null;
  }
}