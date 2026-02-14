// Lead Pipeline Orchestrator
// Wires all lead intake services together into a single automated pipeline.
// When a new lead comes in:
//   1. Geocode the address
//   2. Search for nearby jobs in Geocoded_Contacts
//   3. Run HailRecon storm report
//   4. Score reps via lead distribution algorithm (with real data)
//   5. Return ranked recommendations for office to review
// After office confirms assignment:
//   6. Create customer portal
//   7. Sync to JobNimbus
//   8. Start response timer

import { geocodingService, GeocodedContact } from './geocoding-service';
import {
  googleSheetsService,
  GeocodedContactRecord,
} from './google-sheets-service';
import { stormReportService, StormReport } from './storm-report-service';
import { leadDistributionService, RepScore } from './lead-distribution-service';
import { leadResponseTimerService } from './lead-response-timer';
import { leadPortalService } from './lead-portal-service';
import { jnSyncEngine } from './jn-sync-engine';
import { jobNimbusService, isJobNimbusConfigured } from './jobnimbus-service';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface LeadEnrichmentData {
  // Geocoding
  geocoded: {
    lat: number;
    lng: number;
    formattedAddress: string;
    county?: string;
    city?: string;
    state?: string;
    zip?: string;
  } | null;

  // Nearby jobs/contacts
  nearbyJobs: {
    total: number;
    byRep: Record<string, { count: number; closestMiles: number }>;
    sameStreet: number;
    exactMatch: boolean;
  };

  // Storm/hail risk
  stormReport: {
    riskLevel: string;
    riskScore: number;
    totalHailReports: number;
    recommendation: string;
    reportId: string;
  } | null;

  // Rep recommendations
  repRecommendations: Array<{
    repSlug: string;
    repName: string;
    totalScore: number;
    isAvailable: boolean;
    isEligible: boolean;
    factors: Record<string, { score: number; weight: number; raw: number; explanation: string }>;
    disqualifyReason?: string;
  }>;
}

export interface PipelineResult {
  success: boolean;
  enrichment: LeadEnrichmentData;
  errors: string[];
  durationMs: number;
}

export interface AssignmentResult {
  success: boolean;
  leadId?: string;
  portalUrl?: string;
  jnContactId?: string;
  timerStarted: boolean;
  errors: string[];
}

// ---------------------------------------------------------------------------
// Lead Pipeline Orchestrator
// ---------------------------------------------------------------------------

class LeadPipelineOrchestrator {
  /**
   * Process a new lead through the full enrichment pipeline.
   * Does NOT auto-assign — returns recommendations for office review.
   */
  async processNewLead(params: {
    address: string;
    city?: string;
    state?: string;
    zip?: string;
    name: string;
    source?: string;
    referralRepSlug?: string;
  }): Promise<PipelineResult> {
    const startTime = Date.now();
    const errors: string[] = [];

    // 1. Geocode the lead address
    let geocoded: LeadEnrichmentData['geocoded'] = null;
    try {
      const geoResult = await geocodingService.geocodeAddress(params.address);
      if (geoResult) {
        geocoded = {
          lat: geoResult.lat,
          lng: geoResult.lng,
          formattedAddress: geoResult.formattedAddress,
          county: geoResult.components.county,
          city: geoResult.components.city || params.city,
          state: geoResult.components.state || params.state,
          zip: geoResult.components.zip || params.zip,
        };
      }
    } catch (err) {
      errors.push(`Geocoding failed: ${err instanceof Error ? err.message : String(err)}`);
    }

    // 2. Load geocoded contacts and search for nearby jobs
    let nearbyJobs: LeadEnrichmentData['nearbyJobs'] = {
      total: 0,
      byRep: {},
      sameStreet: 0,
      exactMatch: false,
    };

    try {
      const allContactRecords = await googleSheetsService.getGeocodedContacts();
      const contacts: GeocodedContact[] = allContactRecords
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

      if (geocoded && contacts.length > 0) {
        const intel = await geocodingService.getAddressIntelligence(
          params.address,
          contacts,
          2.0
        );

        nearbyJobs = {
          total: intel.nearbyContacts.length,
          byRep: {},
          sameStreet: intel.sameStreet.length,
          exactMatch: intel.exactMatches.length > 0,
        };

        for (const [rep, data] of Object.entries(intel.nearbyByRep)) {
          const closest = data.contacts.length > 0
            ? Math.min(...data.contacts.map(c => c.distanceMiles))
            : 999;
          nearbyJobs.byRep[rep] = { count: data.count, closestMiles: Math.round(closest * 100) / 100 };
        }
      }
    } catch (err) {
      errors.push(`Nearby search failed: ${err instanceof Error ? err.message : String(err)}`);
    }

    // 3. Run HailRecon / storm report
    let stormReport: LeadEnrichmentData['stormReport'] = null;
    try {
      const city = geocoded?.city || params.city || '';
      const state = geocoded?.state || params.state || 'AL';
      const zip = geocoded?.zip || params.zip || '';

      if (city && zip) {
        const report = await stormReportService.generateReport({
          address: params.address,
          city,
          state,
          zip,
        });

        stormReport = {
          riskLevel: report.riskLevel,
          riskScore: report.riskScore,
          totalHailReports: report.totalHailReports,
          recommendation: report.recommendation,
          reportId: report.reportId,
        };
      }
    } catch (err) {
      errors.push(`Storm report failed: ${err instanceof Error ? err.message : String(err)}`);
    }

    // 4. Score reps via lead distribution
    let repRecommendations: LeadEnrichmentData['repRecommendations'] = [];
    try {
      const scores = await leadDistributionService.calculateRepScores(
        params.address,
        params.source,
        params.referralRepSlug
      );

      repRecommendations = scores.map(s => ({
        repSlug: s.repSlug,
        repName: s.repName,
        totalScore: Math.round(s.totalScore * 1000) / 1000,
        isAvailable: s.isAvailable,
        isEligible: s.isEligible,
        factors: s.factors,
        disqualifyReason: s.disqualifyReason,
      }));
    } catch (err) {
      errors.push(`Rep scoring failed: ${err instanceof Error ? err.message : String(err)}`);
    }

    return {
      success: errors.length === 0,
      enrichment: {
        geocoded,
        nearbyJobs,
        stormReport,
        repRecommendations,
      },
      errors,
      durationMs: Date.now() - startTime,
    };
  }

  /**
   * After office confirms assignment, execute the assignment flow:
   * - Sync contact to JobNimbus (find or create)
   * - Optionally create a JN job
   * - Start response timer
   */
  async confirmAssignment(params: {
    leadId: string;
    repSlug: string;
    customerName: string;
    customerEmail: string;
    customerPhone: string;
    customerAddress: string;
    customerCity?: string;
    customerState?: string;
    customerZip?: string;
    createPortal: boolean;
    syncToJN: boolean;
    createJNJob?: boolean; // also create a JN job record
    jobName?: string;
  }): Promise<AssignmentResult> {
    const errors: string[] = [];
    let portalUrl: string | undefined;
    let jnContactId: string | undefined;
    let timerStarted = false;

    // 1. Sync to JobNimbus (find or create contact)
    if (params.syncToJN && isJobNimbusConfigured()) {
      try {
        const nameParts = params.customerName.trim().split(/\s+/);
        const firstName = nameParts[0] || params.customerName;
        const lastName = nameParts.slice(1).join(' ') || '';

        // Use the sync engine's pushNewContact which handles dedup
        const result = await jnSyncEngine.pushNewContact({
          firstName,
          lastName,
          email: params.customerEmail,
          phone: params.customerPhone,
          address: params.customerAddress,
          city: params.customerCity,
          state: params.customerState,
          zip: params.customerZip,
          source: 'RCRS Portal',
          status: 'Lead',
        });

        if (result.success && result.jnid) {
          jnContactId = result.jnid;

          // Also create a JN job if requested
          if (params.createJNJob && jnContactId) {
            try {
              const jobResult = await jnSyncEngine.pushNewJob({
                contactJnid: jnContactId,
                jobName: params.jobName || `${params.customerName} - Roof`,
                status: 'lead',
                address: params.customerAddress,
                city: params.customerCity,
                state: params.customerState,
                zip: params.customerZip,
              });
              if (jobResult.success) {
              }
            } catch (err) {
              errors.push(`JN job creation failed: ${err instanceof Error ? err.message : String(err)}`);
            }
          }
        } else {
          errors.push(`JN sync failed: ${result.message}`);
        }
      } catch (err) {
        errors.push(`JN sync failed: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    // 2. Start response timer
    try {
      await leadResponseTimerService.startTimer(
        params.leadId,
        params.repSlug,
        params.customerName
      );
      timerStarted = true;
    } catch (err) {
      errors.push(`Timer failed: ${err instanceof Error ? err.message : String(err)}`);
    }

    // 3. Save JN contact ID back to lead record
    if (jnContactId) {
      try {
        await leadPortalService.updateLeadJNContactId(params.leadId, jnContactId);
      } catch {
        // Non-critical
      }
    }

    return {
      success: errors.length === 0,
      leadId: params.leadId,
      portalUrl,
      jnContactId,
      timerStarted,
      errors,
    };
  }

  /**
   * Quick enrichment for the wizard UI — geocode + nearby + storm + reps.
   * Lighter-weight than full processNewLead (no lead record created).
   */
  async enrichAddress(address: string): Promise<LeadEnrichmentData> {
    const result = await this.processNewLead({
      address,
      name: 'Preview',
    });
    return result.enrichment;
  }
}

// Export singleton
export const leadPipelineOrchestrator = new LeadPipelineOrchestrator();