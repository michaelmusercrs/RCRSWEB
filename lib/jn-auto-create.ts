/**
 * JN Auto-Create — pushes a new contact to JobNimbus after a lead is
 * entered and a rep is picked. GATED by `JN_AUTOCREATE_ENABLED=true`
 * (default OFF per stated rule 2026-05-21 — "don't start making JN
 * changes yet").
 *
 * When the gate is OFF:
 *   - The function still executes and logs what it WOULD have done
 *   - Returns { skipped: true, reason: 'gated' }
 *   - The caller stores no JN id (downstream stays consistent)
 *
 * When the gate is ON:
 *   - Builds the JN payload from full lead data
 *   - Maps source, status, record_type, hail-derived Date of Loss
 *   - Calls jobNimbusService.createContact()
 *   - Returns the resulting jnid for storage on the local lead record
 *   - Errors are logged but never thrown — assignment proceeds regardless
 */

import { jobNimbusService, isJobNimbusConfigured } from './jobnimbus-service';

export interface JNAutoCreateInput {
  leadId: string;
  name: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  address: string;
  addressLine1?: string;
  city?: string;
  state?: string;
  zip?: string;
  source?: string;       // 'Yard Sign', 'Google', 'Referral', etc.
  recordType?: string;   // 'Customer' | 'Commercial' | etc.
  company?: string;
  assignedRepName?: string; // JN expects display name on sales_rep_name
  // Hail-derived Date of Loss (from lead-quality-service factors). Pushed
  // back to JN's `Date of Loss` field as the authoritative timestamp.
  hailDerivedDateOfLoss?: string; // ISO
  description?: string;
}

export interface JNAutoCreateResult {
  skipped: boolean;
  jnid?: string;
  reason?: string;
  error?: string;
}

export function isJNAutoCreateEnabled(): boolean {
  return process.env.JN_AUTOCREATE_ENABLED === 'true';
}

/**
 * Parse "1234 Main St, City, ST 12345" into address_line1 / city / state / zip
 * when the structured fields aren't provided. Best-effort.
 */
function parseAddress(addr: string): { line1: string; city: string; state: string; zip: string } {
  const parts = addr.split(',').map(p => p.trim());
  const line1 = parts[0] || '';
  const city = parts[1] || '';
  // last component is "ST 12345" or just "12345"
  const last = parts[2] || '';
  const m = last.match(/^([A-Z]{2})\s+(\d{5}(?:-\d{4})?)$/);
  return {
    line1,
    city,
    state: m ? m[1] : '',
    zip: m ? m[2] : (last.match(/\d{5}/)?.[0] || ''),
  };
}

export async function createJNContactFromLead(input: JNAutoCreateInput): Promise<JNAutoCreateResult> {
  // Gate first — fail safe before any network call.
  if (!isJNAutoCreateEnabled()) {
    console.log(`[JNAutoCreate] GATED — would create JN contact for leadId=${input.leadId} name="${input.name}". Set JN_AUTOCREATE_ENABLED=true to enable.`);
    return { skipped: true, reason: 'JN_AUTOCREATE_ENABLED not set' };
  }
  if (!isJobNimbusConfigured()) {
    return { skipped: true, reason: 'JN_API_KEY missing' };
  }

  try {
    // Derive structured address components when missing
    const parsed = (!input.addressLine1 || !input.city || !input.state || !input.zip)
      ? parseAddress(input.address)
      : { line1: input.addressLine1, city: input.city || '', state: input.state || '', zip: input.zip || '' };

    // Build the payload. Match JN field names verbatim. NEVER push cost
    // fields — stripCostFields inside apiRequest is a belt-and-suspenders
    // guard, but we don't include any here to begin with.
    const payload: Record<string, unknown> = {
      first_name: input.firstName || input.name.split(' ')[0] || '',
      last_name: input.lastName || input.name.split(' ').slice(1).join(' ') || '',
      display_name: input.name,
      email: input.email || '',
      mobile_phone: input.phone || '',
      address_line1: parsed.line1,
      city: parsed.city || input.city || '',
      state_text: parsed.state || input.state || 'AL',
      zip: parsed.zip || input.zip || '',
      source_name: input.source || '',
      sales_rep_name: input.assignedRepName || '',
      status_name: 'Lead - New',
      record_type_name: input.recordType || (input.company ? 'Commercial' : 'Customer'),
      company: input.company || '',
      description: input.description || '',
    };

    // Push hail-derived Date of Loss when we have one — per the v2 policy,
    // we trust HailRecon over whatever JN had in the field (often empty).
    if (input.hailDerivedDateOfLoss) {
      const epoch = Math.floor(new Date(input.hailDerivedDateOfLoss).getTime() / 1000);
      if (!isNaN(epoch)) {
        // JN custom-field literal name
        (payload as Record<string, unknown>)['Date of Loss'] = epoch;
        payload.cf_date_1 = epoch;
      }
    }

    const created = await jobNimbusService.createContact(payload);
    if (!created?.jnid) {
      return { skipped: false, error: 'JN createContact returned no jnid' };
    }
    return { skipped: false, jnid: created.jnid };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[JNAutoCreate] failed for leadId=${input.leadId}:`, msg);
    return { skipped: false, error: msg };
  }
}
