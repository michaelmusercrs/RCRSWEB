import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-service';
import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';
import { cache, CACHE_TTL } from '@/lib/cache';

// POST - Log a message from a rep to a customer
// This creates a record in the Customer_Messages sheet and optionally creates
// a note in JobNimbus. Used from the customer detail page when reps message customers.
export async function POST(request: NextRequest) {
  const auth = await requireAuth();
  if (!auth.authenticated) return auth.response;

  try {
    const body = await request.json();
    const { customerId, customerName, content, subject, channel, repName, repEmail, contactJnid } = body;

    if (!customerId || !content) {
      return NextResponse.json(
        { error: 'customerId and content are required' },
        { status: 400 }
      );
    }

    if (content.length > 5000) {
      return NextResponse.json(
        { error: 'Message content must be under 5000 characters' },
        { status: 400 }
      );
    }

    const results: { sheet?: boolean; jobnimbus?: boolean; errors: string[] } = { errors: [] };

    // 1. Log to Google Sheets
    try {
      const serviceAccountEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
      const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n');
      const sheetId = process.env.GOOGLE_SHEET_ID
        || process.env.GOOGLE_SHEETS_ID
        || process.env.DELIVERY_SHEETS_ID;

      if (serviceAccountEmail && privateKey && sheetId) {
        const jwt = new JWT({
          email: serviceAccountEmail,
          key: privateKey,
          scopes: ['https://www.googleapis.com/auth/spreadsheets'],
        });

        const doc = new GoogleSpreadsheet(sheetId, jwt);
        await doc.loadInfo();

        let msgSheet = doc.sheetsByTitle['Customer_Messages'];
        if (!msgSheet) {
          msgSheet = await doc.addSheet({
            title: 'Customer_Messages',
            headerValues: [
              'messageId', 'customerId', 'direction', 'channel', 'subject',
              'content', 'sentAt', 'readAt', 'sentBy',
            ],
          });
        }

        await msgSheet.addRow({
          messageId: `MSG-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          customerId,
          direction: 'outbound',
          channel: channel || 'portal',
          subject: subject || 'Message from Rep',
          content,
          sentAt: new Date().toISOString(),
          readAt: '',
          sentBy: repName || 'Rep',
        });

        results.sheet = true;
      }
    } catch (sheetError) {
      console.error('Error logging message to sheet:', sheetError);
      results.errors.push('Failed to log to Google Sheets');
    }

    // 2. Create note in JobNimbus if contact ID provided
    if (contactJnid) {
      const jnApiKey = process.env.JOBNIMBUS_API_KEY;
      const jnApiUrl = process.env.JOBNIMBUS_API_URL || 'https://app.jobnimbus.com/api1';

      if (jnApiKey) {
        try {
          const noteContent = `[Staff Reply] from ${repName || 'Rep'}${subject ? ` - ${subject}` : ''}\n\n${content}`;

          // JN uses /activities (not /notes), with `note`/`record_type_name`.
          const jnRes = await fetch(`${jnApiUrl}/activities`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${jnApiKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              primary: { jnid: contactJnid },
              note: noteContent,
              record_type_name: 'Note',
              is_active: true,
            }),
          });

          if (jnRes.ok) {
            results.jobnimbus = true;
          } else {
            console.error('JN note creation error:', jnRes.status);
            results.errors.push('Failed to create JobNimbus note');
          }
        } catch (jnError) {
          console.error('JN note error:', jnError);
          results.errors.push('Failed to sync with JobNimbus');
        }
      }
    }

    cache.invalidate(`sheets:customer-messages:${customerId}`);

    return NextResponse.json({
      success: true,
      message: {
        id: `MSG-${Date.now()}`,
        customerId,
        customerName,
        content,
        subject,
        channel: channel || 'portal',
        sentBy: repName || 'Rep',
        sentAt: new Date().toISOString(),
      },
      results,
    });
  } catch (error) {
    console.error('Error sending customer message:', error);
    return NextResponse.json(
      { error: 'Failed to send message' },
      { status: 500 }
    );
  }
}

// GET - Fetch message history for a customer
export async function GET(request: NextRequest) {
  const auth = await requireAuth();
  if (!auth.authenticated) return auth.response;

  try {
    const { searchParams } = new URL(request.url);
    const customerId = searchParams.get('customerId');

    if (!customerId) {
      return NextResponse.json(
        { error: 'customerId is required' },
        { status: 400 }
      );
    }

    const msgCacheKey = `sheets:customer-messages:${customerId}`;
    const cachedMsgs = cache.get(msgCacheKey);
    if (cachedMsgs) {
      return NextResponse.json(cachedMsgs, {
        headers: { 'Cache-Control': 'private, s-maxage=30' },
      });
    }

    const messages: Array<{
      id: string;
      direction: string;
      channel: string;
      subject: string;
      content: string;
      sentAt: string;
      sentBy: string;
    }> = [];

    // Fetch from Google Sheets
    try {
      const serviceAccountEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
      const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n');
      const sheetId = process.env.GOOGLE_SHEET_ID
        || process.env.GOOGLE_SHEETS_ID
        || process.env.DELIVERY_SHEETS_ID;

      if (serviceAccountEmail && privateKey && sheetId) {
        const jwt = new JWT({
          email: serviceAccountEmail,
          key: privateKey,
          scopes: ['https://www.googleapis.com/auth/spreadsheets'],
        });

        const doc = new GoogleSpreadsheet(sheetId, jwt);
        await doc.loadInfo();

        const msgSheet = doc.sheetsByTitle['Customer_Messages'];
        if (msgSheet) {
          const rows = await msgSheet.getRows();
          const customerRows = rows.filter(r => r.get('customerId') === customerId);

          for (const row of customerRows) {
            messages.push({
              id: row.get('messageId'),
              direction: row.get('direction'),
              channel: row.get('channel'),
              subject: row.get('subject'),
              content: row.get('content'),
              sentAt: row.get('sentAt'),
              sentBy: row.get('sentBy'),
            });
          }
        }
      }
    } catch (sheetError) {
      console.error('Error fetching messages from sheet:', sheetError);
    }

    // Also fetch from JobNimbus notes if available
    const jnApiKey = process.env.JOBNIMBUS_API_KEY;
    const jnApiUrl = process.env.JOBNIMBUS_API_URL || 'https://app.jobnimbus.com/api1';

    // SECURITY: Sanitize customerId to prevent API query injection
    const safeCustomerId = customerId.replace(/[^a-zA-Z0-9_-]/g, '');
    if (jnApiKey && safeCustomerId.length > 10) {
      // Looks like a JN ID
      try {
        // JN filter must be a JSON-encoded ES bool query — see jobnimbus-service.ts:318
        const jnFilter = encodeURIComponent(
          JSON.stringify({ must: [{ term: { 'primary.id': safeCustomerId } }] }),
        );
        const jnRes = await fetch(
          // JN stores notes inside /activities — there is no /notes endpoint.
          `${jnApiUrl}/activities?filter=${jnFilter}&sort=-created_at&limit=50`,
          {
            headers: {
              'Authorization': `Bearer ${jnApiKey}`,
              'Content-Type': 'application/json',
            },
          }
        );

        if (jnRes.ok) {
          const jnData = await jnRes.json();
          const portalNotes = (jnData.results || []).filter((note: Record<string, unknown>) => {
            const content = note.content as string;
            return content?.includes('[Customer Portal') || content?.includes('[Staff Reply');
          });

          for (const note of portalNotes) {
            const content = note.content as string;
            const isCustomer = content?.includes('[Customer Portal');
            const cleanContent = content
              ?.replace('[Customer Portal Message]', '')
              .replace('[Staff Reply]', '')
              .replace(/from [\w\s]+ - /, '')
              .trim();

            // Avoid duplicates with sheet messages
            const existingIds = new Set(messages.map(m => m.id));
            if (!existingIds.has(note.jnid as string)) {
              messages.push({
                id: note.jnid as string,
                direction: isCustomer ? 'inbound' : 'outbound',
                channel: 'jobnimbus',
                subject: '',
                content: cleanContent || '',
                sentAt: note.created_at
                  ? new Date((note.created_at as number) * 1000).toISOString()
                  : new Date().toISOString(),
                sentBy: isCustomer ? 'Customer' : 'Rep',
              });
            }
          }
        }
      } catch (jnError) {
        console.error('Error fetching JN notes:', jnError);
      }
    }

    // Sort by sentAt descending
    messages.sort((a, b) => new Date(b.sentAt).getTime() - new Date(a.sentAt).getTime());

    const msgResponse = {
      success: true,
      messages,
      count: messages.length,
    };
    cache.set(msgCacheKey, msgResponse, CACHE_TTL.COMMISSION);
    return NextResponse.json(msgResponse, {
      headers: { 'Cache-Control': 'private, s-maxage=30' },
    });
  } catch (error) {
    console.error('Error fetching customer messages:', error);
    return NextResponse.json(
      { error: 'Failed to fetch messages' },
      { status: 500 }
    );
  }
}
