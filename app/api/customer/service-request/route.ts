import { NextRequest, NextResponse } from 'next/server';
import { leadPortalService } from '@/lib/lead-portal-service';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const DATA_FILE = path.join(process.cwd(), 'data', 'service-requests.json');

interface ServiceRequest {
  id: string;
  customerId: string;
  customerName: string;
  customerAddress: string;
  customerPhone: string;
  customerEmail: string;
  repSlug: string;
  repName: string;
  type: 'maintenance' | 'repair' | 'inspection' | 'other';
  description: string;
  preferredDate: string;
  urgency: 'low' | 'medium' | 'high' | 'emergency';
  photos: string[];
  status: 'submitted' | 'reviewed' | 'scheduled' | 'in_progress' | 'completed' | 'cancelled';
  assignedTo?: string;
  scheduledDate?: string;
  resolution?: string;
  createdAt: string;
  updatedAt: string;
}

interface ServiceRequestsData {
  requests: ServiceRequest[];
}

function readData(): ServiceRequestsData {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const content = fs.readFileSync(DATA_FILE, 'utf-8');
      return JSON.parse(content);
    }
  } catch (error) {
    console.error('[ServiceRequest] Error reading data:', error);
  }
  return { requests: [] };
}

function writeData(data: ServiceRequestsData): void {
  try {
    const dir = path.dirname(DATA_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
  } catch (error) {
    console.error('[ServiceRequest] Error writing data:', error);
    throw error;
  }
}

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

    const data = readData();
    const now = new Date().toISOString();

    const serviceRequest: ServiceRequest = {
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
      photos: photos || [],
      status: 'submitted',
      createdAt: now,
      updatedAt: now,
    };

    data.requests.unshift(serviceRequest);
    writeData(data);

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

    const data = readData();
    const customerRequests = data.requests
      .filter(r => r.customerId === customer.customerId)
      .map(r => ({
        id: r.id,
        type: r.type,
        description: r.description,
        preferredDate: r.preferredDate,
        urgency: r.urgency,
        status: r.status,
        assignedTo: r.assignedTo,
        scheduledDate: r.scheduledDate,
        resolution: r.resolution,
        photos: r.photos,
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
      }));

    return NextResponse.json({ requests: customerRequests });
  } catch (error) {
    console.error('Error fetching service requests:', error);
    return NextResponse.json({ error: 'Failed to fetch service requests' }, { status: 500 });
  }
}
