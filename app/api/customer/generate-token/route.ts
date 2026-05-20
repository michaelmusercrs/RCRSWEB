import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { apiError } from '@/lib/api-response';
import { jobNimbusService, isJobNimbusConfigured } from '@/lib/jobnimbus-service';
import { leadPortalService } from '@/lib/lead-portal-service';
import { teamMembers } from '@/lib/teamData';
import { validateSession } from '@/lib/auth-service';

const TOKENS_FILE = path.join(process.cwd(), 'data', 'customer-tokens.json');

interface CustomerToken {
  token: string;
  jobNimbusContactId: string;
  customerName: string;
  zip: string;
  repId: string;
  repSlug: string;
  createdAt: string;
}

function readTokens(): CustomerToken[] {
  try {
    const raw = fs.readFileSync(TOKENS_FILE, 'utf8');
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function writeTokens(tokens: CustomerToken[]) {
  fs.writeFileSync(TOKENS_FILE, JSON.stringify(tokens, null, 2));
}

// POST - Admin generates a customer portal link
export async function POST(request: NextRequest) {
  try {
    // Auth check: Bearer token OR valid portal session cookie
    const authHeader = request.headers.get('authorization');
    const adminKey = process.env.ADMIN_API_KEY || process.env.PORTAL_ADMIN_KEY;
    
    let isAuthorized = false;
    if (adminKey && authHeader === `Bearer ${adminKey}`) {
      isAuthorized = true;
    } else {
      // Fall back to portal session auth (cookie-based)
      const session = await validateSession();
      if (session.valid && session.user && ['owner', 'admin', 'manager'].includes(session.user.role)) {
        isAuthorized = true;
      }
    }

    if (!isAuthorized) {
      return apiError('Unauthorized', 401);
    }

    const body = await request.json();
    const { jobNimbusContactId, customerName, phone, zip, repId, repSlug } = body;

    if (!customerName) {
      return NextResponse.json(
        { error: 'customerName is required' },
        { status: 400 }
      );
    }

    // Check if token already exists for this contact
    const existing = readTokens();
    const existingToken = jobNimbusContactId 
      ? existing.find(t => t.jobNimbusContactId === jobNimbusContactId)
      : null;
    if (existingToken) {
      return NextResponse.json({
        token: existingToken.token,
        portalUrl: `/my/${existingToken.token}`,
        existing: true,
        createdAt: existingToken.createdAt,
      });
    }

    // Resolve rep info
    let resolvedRepSlug = repSlug || '';
    let resolvedRepId = repId || '';

    if (!resolvedRepSlug && resolvedRepId) {
      const rep = teamMembers.find(m => m.slug === resolvedRepId || m.name === resolvedRepId);
      if (rep) resolvedRepSlug = rep.slug;
    }

    // Try to enrich from JobNimbus
    let resolvedName = customerName;
    let resolvedZip = zip || '';

    if (isJobNimbusConfigured()) {
      try {
        // Token generation path — server-internal, we extract name + zip
        // only. Explicit no-cost viewer keeps the contact payload clean.
        const contact = await jobNimbusService.getContact(jobNimbusContactId, { canSeeCost: false });
        if (contact) {
          resolvedName = jobNimbusService.getContactName(contact) || customerName;
          resolvedZip = contact.zip || zip || '';
        }
      } catch {
        // Use provided values
      }
    }

    // Generate token
    const token = crypto.randomUUID();

    const tokenRecord: CustomerToken = {
      token,
      jobNimbusContactId: jobNimbusContactId || '',
      customerName: resolvedName,
      zip: resolvedZip,
      repId: resolvedRepId,
      repSlug: resolvedRepSlug,
      createdAt: new Date().toISOString(),
    };

    // Save to local JSON
    existing.push(tokenRecord);
    writeTokens(existing);

    // Also create in lead portal service for full integration
    try {
      const rep = teamMembers.find(m => m.slug === resolvedRepSlug);
      const shortCode = crypto.randomBytes(4).toString('hex');
      await leadPortalService.createLead({
        portalAccess: {
          accessToken: token,
          customerId: `CUS-${Date.now()}`,
          customerName: resolvedName,
          customerEmail: '',
          customerPhone: phone || '',
          customerAddress: '',
          salesRepId: resolvedRepId,
          salesRepName: rep?.name || resolvedRepSlug,
          salesRepSlug: resolvedRepSlug,
          createdAt: tokenRecord.createdAt,
          isActive: true,
        },
        shortCode,
        source: 'admin-generated',
        jobnimbusContactId: jobNimbusContactId,
      });
    } catch (err) {
      console.warn('[GenerateToken] Failed to create lead portal record:', err);
    }

    return NextResponse.json({
      token,
      portalUrl: `/my/${token}`,
      existing: false,
      createdAt: tokenRecord.createdAt,
    });
  } catch (error) {
    console.error('Error generating customer token:', error);
    return apiError('Failed to generate token', 500);
  }
}

// GET - List all tokens (admin only)
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const adminKey = process.env.ADMIN_API_KEY || process.env.PORTAL_ADMIN_KEY;

  let isAuthorized = false;
  if (adminKey && authHeader === `Bearer ${adminKey}`) {
    isAuthorized = true;
  } else {
    const session = await validateSession();
    if (session.valid && session.user && ['owner', 'admin', 'manager'].includes(session.user.role)) {
      isAuthorized = true;
    }
  }

  if (!isAuthorized) {
    return apiError('Unauthorized', 401);
  }

  const tokens = readTokens();
  return NextResponse.json({ tokens, count: tokens.length });
}
