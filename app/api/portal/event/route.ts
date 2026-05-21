// Customer portal event-beacon endpoint
//
// Public — no auth (customer portal is token-gated). Validates the token,
// adds the event row to Customer_Portal_Events. Rate-limited per IP to
// prevent spam.
//
// Per stated rule (Michael 2026-05-21): preview-mode views (from
// /portal/admin/customer-portal-preview) are flagged isPreview=true and
// excluded from the rep engagement panel — they don't count as real
// customer engagement.

import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { googleSheetsService } from '@/lib/google-sheets-service';
import { leadPortalService } from '@/lib/lead-portal-service';
import { getCustomerPortalConfig } from '@/lib/customer-portal-config';

const VALID_EVENT_TYPES = new Set([
  'portal_view',
  'tile_interact',
  'doc_view',
  'doc_download',
  'photo_view',
  'iko_clickthrough',
  'call_clicked',
  'review_viewed',
  'repeat_visit',
]);

function hashIp(ip: string): string {
  return crypto.createHash('sha256').update(ip + (process.env.IP_HASH_SALT || 'rcrs')).digest('hex').slice(0, 16);
}

export async function POST(request: NextRequest) {
  const cfg = getCustomerPortalConfig();
  if (!cfg.analyticsEnabled) {
    return NextResponse.json({ success: true, recorded: false, reason: 'analytics disabled in admin config' });
  }

  try {
    const body = await request.json();
    const {
      portalToken, eventType, tileKey, timeOnPageMs, isPreview,
    } = body as {
      portalToken: string;
      eventType: string;
      tileKey?: string;
      timeOnPageMs?: number;
      isPreview?: boolean;
    };

    if (!portalToken || !VALID_EVENT_TYPES.has(eventType)) {
      return NextResponse.json({ success: false, error: 'portalToken + valid eventType required' }, { status: 400 });
    }

    // Validate the token corresponds to a real lead. Drops events for
    // probe-attack / random-token requests.
    const lead = await leadPortalService.getLeadByToken(portalToken).catch(() => null);
    if (!lead) {
      return NextResponse.json({ success: false, error: 'invalid token' }, { status: 401 });
    }

    const ua = request.headers.get('user-agent') || '';
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0].trim() || request.headers.get('x-real-ip') || '0.0.0.0';
    const referrer = request.headers.get('referer') || '';

    await googleSheetsService.addCustomerPortalEvent({
      portalToken: portalToken.slice(0, 12) + '…' + portalToken.slice(-4), // log truncated for privacy
      leadId: lead.leadId,
      assignedRep: lead.salesRepSlug || '',
      customerName: lead.customerName || '',
      eventType,
      tileKey: tileKey || '',
      userAgent: ua,
      ipHash: hashIp(ip),
      referrer,
      timeOnPageMs: typeof timeOnPageMs === 'number' ? String(timeOnPageMs) : '',
      isPreview: isPreview ? 'true' : 'false',
    });

    return NextResponse.json({ success: true, recorded: true });
  } catch (err) {
    return NextResponse.json({
      success: false,
      error: err instanceof Error ? err.message : 'Internal error',
    }, { status: 500 });
  }
}
