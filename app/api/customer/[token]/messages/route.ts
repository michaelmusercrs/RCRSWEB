import { NextRequest, NextResponse } from 'next/server';
import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';
import { leadPortalService } from '@/lib/lead-portal-service';
import { createCustomerTokenRateLimiter, withRateLimit } from '@/lib/rate-limiter';
import { groupMeService, getGroupMeConfigFromEnv } from '@/lib/groupme-service';
import { notificationService } from '@/lib/notification-service';

const tokenRateLimiter = createCustomerTokenRateLimiter();

async function getDoc(): Promise<GoogleSpreadsheet> {
  const serviceAccountEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n');
  const sheetId = process.env.GOOGLE_SHEET_ID || process.env.GOOGLE_SHEETS_ID;

  if (!serviceAccountEmail || !privateKey || !sheetId) {
    throw new Error('Missing Google Sheets credentials');
  }

  const jwt = new JWT({
    email: serviceAccountEmail,
    key: privateKey,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });

  const doc = new GoogleSpreadsheet(sheetId, jwt);
  await doc.loadInfo();
  return doc;
}

async function getOrCreateSheet(doc: GoogleSpreadsheet, sheetName: string, headers: string[]) {
  let sheet = doc.sheetsByTitle[sheetName];
  if (!sheet) {
    sheet = await doc.addSheet({ title: sheetName, headerValues: headers });
  }
  return sheet;
}

// Resolve token to customerId + customerName + repInfo
async function resolveToken(token: string): Promise<{
  valid: boolean;
  customerId?: string;
  customerName?: string;
  salesRepName?: string;
  salesRepSlug?: string;
  doc?: GoogleSpreadsheet;
}> {
  // Try lead portal service first
  const lead = await leadPortalService.getLeadByToken(token);
  if (lead) {
    return {
      valid: true,
      customerId: lead.customerId,
      customerName: lead.customerName,
      salesRepName: lead.salesRepName,
      salesRepSlug: lead.salesRepSlug,
    };
  }

  // Fall back to Google Sheets
  try {
    const doc = await getDoc();
    const accessSheet = doc.sheetsByTitle['Customer_Portal_Access'];
    if (!accessSheet) return { valid: false };

    const accessRows = await accessSheet.getRows();
    const row = accessRows.find(r => r.get('accessToken') === token);

    if (row && row.get('isActive')?.toString().toLowerCase() === 'true') {
      const expiresAtStr = row.get('expiresAt');
      if (expiresAtStr && new Date(expiresAtStr) < new Date()) {
        return { valid: false };
      }
      return {
        valid: true,
        customerId: row.get('customerId'),
        customerName: row.get('customerName'),
        salesRepName: row.get('salesRepName'),
        salesRepSlug: row.get('salesRepSlug'),
        doc,
      };
    }
  } catch {
    // Fall through
  }

  return { valid: false };
}

const MSG_HEADERS = [
  'messageId', 'customerId', 'direction', 'channel', 'subject', 'content', 'sentAt', 'readAt', 'sentBy'
];

// GET - Fetch messages for this customer
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  return withRateLimit(request, tokenRateLimiter, async () => {
    try {
      const { token } = await params;
      const resolved = await resolveToken(token);

      if (!resolved.valid || !resolved.customerId) {
        return NextResponse.json({ error: 'Invalid or expired token' }, { status: 404 });
      }

      const doc = resolved.doc || await getDoc();
      const msgSheet = await getOrCreateSheet(doc, 'Customer_Messages', MSG_HEADERS);
      const msgRows = await msgSheet.getRows();

      const messages = msgRows
        .filter(r => r.get('customerId') === resolved.customerId)
        .map(r => ({
          messageId: r.get('messageId'),
          direction: r.get('direction'),
          channel: r.get('channel'),
          subject: r.get('subject'),
          content: r.get('content'),
          sentAt: r.get('sentAt'),
          readAt: r.get('readAt'),
          sentBy: r.get('sentBy'),
        }))
        .sort((a, b) => new Date(a.sentAt).getTime() - new Date(b.sentAt).getTime());

      return NextResponse.json({ messages });
    } catch (error) {
      console.error('Error fetching messages:', error);
      return NextResponse.json({ error: 'Failed to fetch messages' }, { status: 500 });
    }
  });
}

// POST - Send a message from customer to their rep
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  return withRateLimit(request, tokenRateLimiter, async () => {
    try {
      const { token } = await params;
      const body = await request.json();
      const { message, subject } = body;

      if (!message || typeof message !== 'string' || !message.trim()) {
        return NextResponse.json({ error: 'Message is required' }, { status: 400 });
      }

      // Security: customerId must come from token, never from body
      if (body.customerId) {
        return NextResponse.json(
          { error: 'Forbidden: customerId cannot be specified in request body' },
          { status: 403 }
        );
      }

      const resolved = await resolveToken(token);
      if (!resolved.valid || !resolved.customerId) {
        return NextResponse.json({ error: 'Invalid or expired token' }, { status: 404 });
      }

      const doc = resolved.doc || await getDoc();
      const msgSheet = await getOrCreateSheet(doc, 'Customer_Messages', MSG_HEADERS);

      const messageId = `MSG-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

      await msgSheet.addRow({
        messageId,
        customerId: resolved.customerId,
        direction: 'inbound',
        channel: 'portal',
        subject: subject || '',
        content: message.trim(),
        sentAt: new Date().toISOString(),
        readAt: '',
        sentBy: resolved.customerName || 'Customer',
      });

      // Notify rep via notification service
      if (resolved.salesRepSlug) {
        notificationService.notifyCustomerSentMessage({
          repSlug: resolved.salesRepSlug,
          customerId: resolved.customerId,
          customerName: resolved.customerName || 'Customer',
          messagePreview: message.trim().slice(0, 100),
        }).catch(err => {
          console.warn('[Messages] Failed to notify rep:', err);
        });
      }

      // Send GroupMe notification
      try {
        const groupMeConfig = getGroupMeConfigFromEnv();
        if (groupMeConfig.enabled && groupMeConfig.botId && groupMeConfig.notifyOn.customerPortalActivity) {
          const notification = groupMeService.createPortalActivityNotification({
            customerName: resolved.customerName || 'Customer',
            activityType: 'message',
            details: subject || message.trim().slice(0, 50),
          });
          await groupMeService.sendNotification(groupMeConfig, notification);
        }
      } catch (notifyError) {
        console.error('Failed to send GroupMe notification:', notifyError);
      }

      return NextResponse.json({
        success: true,
        messageId,
        sentAt: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Error sending message:', error);
      return NextResponse.json({ error: 'Failed to send message' }, { status: 500 });
    }
  });
}
