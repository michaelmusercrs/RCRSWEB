import { NextRequest, NextResponse } from 'next/server';
import { leadPortalService, ServiceRequestRecord } from '@/lib/lead-portal-service';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Validate token and return customer info
async function validateCustomerToken(token: string) {
  if (!token) return null;

  const lead = await leadPortalService.getLeadByToken(token);
  if (lead) {
    return {
      customerId: lead.customerId,
      customerName: lead.customerName,
      customerAddress: lead.customerAddress || '',
      customerPhone: lead.customerPhone || '',
      customerEmail: lead.customerEmail || '',
      repSlug: lead.salesRepSlug,
      repName: lead.salesRepName,
    };
  }

  return null;
}

const VALID_TYPES = ['maintenance', 'repair', 'inspection', 'other'] as const;
const VALID_URGENCY = ['low', 'medium', 'high', 'emergency'] as const;

// POST - Submit a service request
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { token, type, description, preferredDate, urgency, photos } = body;

    if (!token) {
      return NextResponse.json({ error: 'Token is required' }, { status: 401 });
    }

    if (!type || !VALID_TYPES.includes(type)) {
      return NextResponse.json({ error: 'Valid service type is required' }, { status: 400 });
    }

    if (!description || description.trim().length === 0) {
      return NextResponse.json({ error: 'Description is required' }, { status: 400 });
    }

    if (!urgency || !VALID_URGENCY.includes(urgency)) {
      return NextResponse.json({ error: 'Valid urgency level is required' }, { status: 400 });
    }

    const customer = await validateCustomerToken(token);
    if (!customer) {
      return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 });
    }

    const now = new Date().toISOString();

    const serviceRequest: ServiceRequestRecord = {
      id: `SRQ-${crypto.randomBytes(6).toString('hex')}`,
      customerId: customer.customerId,
      customerName: customer.customerName,
      customerAddress: customer.customerAddress,
      customerPhone: customer.customerPhone,
      customerEmail: customer.customerEmail,
      repSlug: customer.repSlug,
      repName: customer.repName,
      type,
      description: description.trim(),
      preferredDate: preferredDate || '',
      urgency,
      photos: Array.isArray(photos) ? JSON.stringify(photos) : (photos || ''),
      status: 'submitted',
      createdAt: now,
      updatedAt: now,
    };

    await leadPortalService.createServiceRequest(serviceRequest);

    return NextResponse.json({
      success: true,
      request: {
        id: serviceRequest.id,
        type: serviceRequest.type,
        status: serviceRequest.status,
        urgency: serviceRequest.urgency,
        createdAt: serviceRequest.createdAt,
      },
    });
  } catch (error) {
    console.error('Error submitting service request:', error);
    return NextResponse.json({ error: 'Failed to submit service request' }, { status: 500 });
  }
}

// GET - Get existing service requests for this customer
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

    const records = await leadPortalService.getServiceRequestsByCustomer(customer.customerId);

    const customerRequests = records.map(r => {
      let parsedPhotos: string[] = [];
      try {
        if (r.photos) parsedPhotos = JSON.parse(r.photos);
      } catch {
        parsedPhotos = r.photos ? [r.photos] : [];
      }
      return {
        id: r.id,
        type: r.type,
        description: r.description,
        preferredDate: r.preferredDate,
        urgency: r.urgency,
        status: r.status,
        assignedTo: r.assignedTo,
        scheduledDate: r.scheduledDate,
        resolution: r.resolution,
        photos: parsedPhotos,
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
      };
    });

    return NextResponse.json({ requests: customerRequests });
  } catch (error) {
    console.error('Error fetching service requests:', error);
    return NextResponse.json({ error: 'Failed to fetch service requests' }, { status: 500 });
  }
}
