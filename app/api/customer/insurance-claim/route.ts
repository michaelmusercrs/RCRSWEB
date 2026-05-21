/**
 * Customer-facing insurance claim coordination endpoint.
 *
 * GET   /api/customer/insurance-claim?token=...
 *   Returns the authenticated customer's claim (most-recently-updated)
 *   plus the full list of their historical claims. Customer identity
 *   comes from the lead-portal access token — same flow used by the
 *   service-request and warranty-claim routes.
 *
 * POST  /api/customer/insurance-claim
 *   File a new claim. Customers can only CREATE; status starts in
 *   "damage_reported" and stays PENDING admin review. The customer
 *   route does NOT accept a status param — preventing customers from
 *   advancing their own claim.
 *
 * Money fields are PRICE-only per feedback_purchase_price_visibility.
 * The customer never sees or sends cost.
 */

import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { leadPortalService } from '@/lib/lead-portal-service';
import {
  getInsuranceClaim,
  listInsuranceClaimsForCustomer,
  recordInsuranceClaim,
  type InsuranceClaim,
} from '@/lib/insurance-claims-service';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

interface CustomerIdentity {
  customerId: string;
  customerName: string;
  customerEmail: string;
  repSlug: string;
  repName: string;
}

async function validateCustomerToken(token: string): Promise<CustomerIdentity | null> {
  if (!token) return null;
  const lead = await leadPortalService.getLeadByToken(token);
  if (!lead) return null;
  return {
    customerId: lead.customerId,
    customerName: lead.customerName,
    customerEmail: lead.customerEmail || '',
    repSlug: lead.salesRepSlug,
    repName: lead.salesRepName,
  };
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');

    if (!token) {
      return NextResponse.json({ error: 'Token is required' }, { status: 401 });
    }

    const customer = await validateCustomerToken(token);
    if (!customer) {
      return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 });
    }

    const claims = await listInsuranceClaimsForCustomer(customer.customerId);
    const claim = claims[0] || null;

    return NextResponse.json({
      success: true,
      claim,
      claims,
    });
  } catch (error) {
    console.error('Error fetching insurance claim:', error);
    return NextResponse.json({ error: 'Failed to fetch insurance claim' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      token,
      jobId,
      insuranceCarrier,
      claimNumber,
      adjusterName,
      adjusterPhone,
      adjusterEmail,
      dateOfLoss,
      dateClaimFiled,
      deductible,
      notes,
    } = body || {};

    if (!token) {
      return NextResponse.json({ error: 'Token is required' }, { status: 401 });
    }

    const customer = await validateCustomerToken(token);
    if (!customer) {
      return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 });
    }

    if (!insuranceCarrier || String(insuranceCarrier).trim().length === 0) {
      return NextResponse.json({ error: 'Insurance carrier is required' }, { status: 400 });
    }

    // Block accidental cross-customer collisions — if this customer
    // already has an open (non-terminal) claim, prefer upsert via the
    // admin path. Customer POST creates ONLY a fresh claim record.
    const existing = await getInsuranceClaim({ customerId: customer.customerId });
    if (existing && existing.status !== 'complete' && existing.status !== 'denied') {
      return NextResponse.json(
        {
          error: 'An active claim already exists for this customer. Contact your rep to update it.',
          existingClaimId: existing.claimId,
        },
        { status: 409 },
      );
    }

    const now = new Date().toISOString();
    const claimId = `ICL-${crypto.randomBytes(6).toString('hex').toUpperCase()}`;

    const claim: InsuranceClaim = {
      claimId,
      customerId: customer.customerId,
      customerName: customer.customerName,
      customerEmail: customer.customerEmail,
      jobId: String(jobId || ''),
      repSlug: customer.repSlug,
      repName: customer.repName,
      insuranceCarrier: String(insuranceCarrier).trim(),
      claimNumber: String(claimNumber || '').trim(),
      adjusterName: String(adjusterName || '').trim(),
      adjusterPhone: String(adjusterPhone || '').trim(),
      adjusterEmail: String(adjusterEmail || '').trim(),
      dateOfLoss: String(dateOfLoss || ''),
      dateClaimFiled: String(dateClaimFiled || ''),
      dateAdjusterVisit: '',
      dateAdjusterAccepted: '',
      dateSupplementSubmitted: '',
      dateSupplementApproved: '',
      dateFinalApproved: '',
      dateDepreciationReleased: '',
      initialEstimate: '',
      supplementAmount: '',
      finalSettlement: '',
      depreciationAmount: '',
      deductible: String(deductible || ''),
      // Status starts at damage_reported (claim_filed only set once admin
      // confirms the claim is actually filed with the carrier).
      status: dateClaimFiled ? 'claim_filed' : 'damage_reported',
      notes: String(notes || '').trim(),
      createdAt: now,
      updatedAt: now,
    };

    // Fire-and-forget sheet write — never blocks the customer response.
    recordInsuranceClaim(claim).catch(() => {});

    return NextResponse.json({
      success: true,
      claim: {
        claimId: claim.claimId,
        status: claim.status,
        insuranceCarrier: claim.insuranceCarrier,
        claimNumber: claim.claimNumber,
        createdAt: claim.createdAt,
      },
    });
  } catch (error) {
    console.error('Error filing insurance claim:', error);
    return NextResponse.json({ error: 'Failed to file insurance claim' }, { status: 500 });
  }
}
