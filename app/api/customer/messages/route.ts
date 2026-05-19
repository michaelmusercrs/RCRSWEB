import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-service';

const JOBNIMBUS_API_KEY = process.env.JOBNIMBUS_API_KEY;
const JOBNIMBUS_API_URL = process.env.JOBNIMBUS_API_URL || 'https://app.jobnimbus.com/api1';

export async function POST(request: Request) {
  const auth = await requireAuth();
  if (!auth.authenticated) return auth.response;

  try {
    const body = await request.json();
    const { customerId, content } = body;

    if (!customerId || !content) {
      return NextResponse.json({ success: false, error: 'Missing required fields' }, { status: 400 });
    }

    // SECURITY: Validate content length
    if (typeof content !== 'string' || content.length > 5000) {
      return NextResponse.json(
        { success: false, error: 'Message content must be a string under 5000 characters' },
        { status: 400 }
      );
    }

    // SECURITY: Prevent horizontal privilege escalation.
    // Customers can ONLY send messages for their own account.
    if (auth.user.role === 'customer' && auth.user.userId !== customerId) {
      console.warn(
        `SECURITY: Horizontal privilege escalation attempt (messages POST). ` +
        `User ${auth.user.userId} tried to send message as customer ${customerId}`
      );
      return NextResponse.json(
        { success: false, error: 'Access denied: you can only send messages from your own account' },
        { status: 403 }
      );
    }

    // Require API key - no demo mode
    if (!JOBNIMBUS_API_KEY) {
      return NextResponse.json(
        {
          success: false,
          error: 'Messaging is not configured',
          message: 'Please contact River City Roofing at 256-274-8530 for assistance.'
        },
        { status: 500 }
      );
    }

    // JN uses /activities (not /notes) for notes, with `note` (not `content`)
    // and `record_type_name: 'Note'`. Mirrors lib/jobnimbus-service.ts createNote.
    const response = await fetch(`${JOBNIMBUS_API_URL}/activities`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${JOBNIMBUS_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        primary: { jnid: customerId },
        note: `[Customer Portal Message]\n\n${content}`,
        record_type_name: 'Note',
        is_active: true,
      }),
    });

    if (!response.ok) {
      console.error('JobNimbus note creation error:', response.status);
      return NextResponse.json({ success: false, error: 'Failed to send message' }, { status: 500 });
    }

    const noteData = await response.json();

    return NextResponse.json({
      success: true,
      message: {
        id: noteData.jnid,
        content,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('Message send error:', error);
    return NextResponse.json({ success: false, error: 'Server error' }, { status: 500 });
  }
}

export async function GET(request: Request) {
  const auth = await requireAuth();
  if (!auth.authenticated) return auth.response;

  const { searchParams } = new URL(request.url);
  const customerId = searchParams.get('customerId');

  if (!customerId) {
    return NextResponse.json({ success: false, error: 'Customer ID required' }, { status: 400 });
  }

  // SECURITY: Prevent horizontal privilege escalation.
  // Customers can ONLY read their own messages.
  if (auth.user.role === 'customer' && auth.user.userId !== customerId) {
    console.warn(
      `SECURITY: Horizontal privilege escalation attempt (messages GET). ` +
      `User ${auth.user.userId} tried to read messages for customer ${customerId}`
    );
    return NextResponse.json(
      { success: false, error: 'Access denied: you can only view your own messages' },
      { status: 403 }
    );
  }

  // Require API key - no demo mode
  if (!JOBNIMBUS_API_KEY) {
    return NextResponse.json(
      {
        success: false,
        error: 'Messaging is not configured',
        message: 'Please contact River City Roofing at 256-274-8530 for assistance.'
      },
      { status: 500 }
    );
  }

  try {
    // Fetch notes for this customer that contain portal messages
    // SECURITY: Sanitize customerId to prevent API query injection
    const safeCustomerId = customerId.replace(/[^a-zA-Z0-9_-]/g, '');
    // JN filter must be a JSON-encoded ES bool query — see jobnimbus-service.ts:318
    const jnFilter = encodeURIComponent(
      JSON.stringify({ must: [{ term: { 'primary.id': safeCustomerId } }] }),
    );
    const response = await fetch(
      // JN stores notes inside /activities — there is no /notes endpoint.
      `${JOBNIMBUS_API_URL}/activities?filter=${jnFilter}&sort=-created_at&limit=50`,
      {
        headers: {
          'Authorization': `Bearer ${JOBNIMBUS_API_KEY}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      return NextResponse.json({ success: false, error: 'Failed to load messages' }, { status: 500 });
    }

    const data = await response.json();
    const messages = (data.results || [])
      .filter((note: Record<string, unknown>) => {
        const content = note.content as string;
        return content?.includes('[Customer Portal') || content?.includes('[Staff Reply');
      })
      .map((note: Record<string, unknown>) => {
        const content = note.content as string;
        const isCustomer = content?.includes('[Customer Portal');
        const cleanContent = content
          ?.replace('[Customer Portal Message]', '')
          .replace('[Staff Reply]', '')
          .trim();

        return {
          id: note.jnid,
          from: isCustomer ? 'You' : 'River City Roofing',
          content: cleanContent,
          timestamp: note.created_at ? new Date((note.created_at as number) * 1000).toISOString() : new Date().toISOString(),
          isCustomer,
        };
      });

    return NextResponse.json({ success: true, messages });
  } catch (error) {
    console.error('Messages fetch error:', error);
    return NextResponse.json({ success: false, error: 'Server error' }, { status: 500 });
  }
}
