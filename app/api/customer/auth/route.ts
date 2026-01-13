import { NextResponse } from 'next/server';

const JOBNIMBUS_API_KEY = process.env.JOBNIMBUS_API_KEY;
const JOBNIMBUS_API_URL = process.env.JOBNIMBUS_API_URL || 'https://app.jobnimbus.com/api1';

interface JobNimbusContact {
  jnid: string;
  first_name?: string;
  last_name?: string;
  display_name?: string;
  email?: string;
  home_phone?: string;
  mobile_phone?: string;
  work_phone?: string;
  address_line1?: string;
  city?: string;
  state_text?: string;
  zip?: string;
}

function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, '');
}

function getContactName(contact: JobNimbusContact): string {
  if (contact.display_name) return contact.display_name;
  return `${contact.first_name || ''} ${contact.last_name || ''}`.trim() || 'Customer';
}

function getContactPhone(contact: JobNimbusContact): string {
  return contact.mobile_phone || contact.home_phone || contact.work_phone || '';
}

function formatAddress(contact: JobNimbusContact): string {
  const parts = [
    contact.address_line1,
    contact.city,
    contact.state_text,
    contact.zip,
  ].filter(Boolean);
  return parts.join(', ') || '';
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { method, email, phone, accessCode } = body;

    if (!JOBNIMBUS_API_KEY) {
      // Demo mode - return mock data
      return NextResponse.json({
        success: true,
        customer: {
          jnid: 'demo-customer',
          name: 'Demo Customer',
          email: email || 'demo@example.com',
          phone: phone || '256-555-1234',
          address: '123 Main St, Hartselle, AL 35640',
        },
      });
    }

    let filter = '';
    if (method === 'email' && email) {
      filter = `email:"${email}"`;
    } else if (method === 'phone' && phone) {
      const normalizedPhone = normalizePhone(phone);
      filter = `mobile_phone:"${normalizedPhone}" OR home_phone:"${normalizedPhone}" OR work_phone:"${normalizedPhone}"`;
    } else if (method === 'code' && accessCode) {
      // Access code is stored in a custom field
      filter = `customer_portal_code:"${accessCode}"`;
    } else {
      return NextResponse.json({ success: false, error: 'Invalid login method' }, { status: 400 });
    }

    const response = await fetch(`${JOBNIMBUS_API_URL}/contacts?filter=${encodeURIComponent(filter)}&limit=1`, {
      headers: {
        'Authorization': `Bearer ${JOBNIMBUS_API_KEY}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      console.error('JobNimbus API error:', response.status);
      return NextResponse.json({ success: false, error: 'Unable to verify account' }, { status: 500 });
    }

    const data = await response.json();
    const contacts = data.results || [];

    if (contacts.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Account not found. Please check your information or call us at 256-274-8530.',
      });
    }

    const contact = contacts[0] as JobNimbusContact;

    return NextResponse.json({
      success: true,
      customer: {
        jnid: contact.jnid,
        name: getContactName(contact),
        email: contact.email || '',
        phone: getContactPhone(contact),
        address: formatAddress(contact),
      },
    });
  } catch (error) {
    console.error('Customer auth error:', error);
    return NextResponse.json({ success: false, error: 'Server error' }, { status: 500 });
  }
}
