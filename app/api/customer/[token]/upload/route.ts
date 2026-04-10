import { NextRequest, NextResponse } from 'next/server';
import { put } from '@vercel/blob';
import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';
import { leadPortalService } from '@/lib/lead-portal-service';
import { createCustomerTokenRateLimiter, withRateLimit } from '@/lib/rate-limiter';

// SECURITY: Rate limiter for customer token upload access.
// Limits to 10 attempts per 15 minutes per IP to prevent token brute-force.
const tokenRateLimiter = createCustomerTokenRateLimiter();

async function getDoc(): Promise<GoogleSpreadsheet> {
  const serviceAccountEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n');
  const sheetId = process.env.GOOGLE_SHEET_ID
    || process.env.GOOGLE_SHEETS_ID
    || process.env.DELIVERY_SHEETS_ID;

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

// Resolve token to customer info (supports both lead portal and sheet-based tokens)
async function resolveToken(token: string): Promise<{
  valid: boolean;
  customerId?: string;
  customerName?: string;
  salesRepSlug?: string;
}> {
  // Try lead portal service first
  const lead = await leadPortalService.getLeadByToken(token);
  if (lead) {
    return {
      valid: true,
      customerId: lead.customerId,
      customerName: lead.customerName,
      salesRepSlug: lead.salesRepSlug,
    };
  }

  // Fall back to Google Sheets
  try {
    const doc = await getDoc();
    const accessSheet = doc.sheetsByTitle['Customer_Portal_Access'];
    if (!accessSheet) return { valid: false };

    const accessRows = await accessSheet.getRows();
    const accessRow = accessRows.find(r => r.get('accessToken') === token);

    if (accessRow && accessRow.get('isActive') === 'true') {
      const expiresAtStr = accessRow.get('expiresAt');
      if (expiresAtStr) {
        const expiresAt = new Date(expiresAtStr);
        if (expiresAt < new Date()) {
          return { valid: false };
        }
      }
      return {
        valid: true,
        customerId: accessRow.get('customerId'),
        customerName: accessRow.get('customerName'),
        salesRepSlug: accessRow.get('salesRepSlug'),
      };
    }
  } catch {
    // Fall through
  }

  return { valid: false };
}

// POST - Upload file from customer
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  // SECURITY: Rate limit token access to prevent brute-force token guessing.
  return withRateLimit(request, tokenRateLimiter, async () => {
  try {
    const { token } = await params;

    // SECURITY: Verify access token and derive customerId from the token.
    // The customerId is NEVER taken from user input - it is always resolved
    // from the token to prevent horizontal privilege escalation.
    const resolved = await resolveToken(token);
    if (!resolved.valid || !resolved.customerId) {
      return NextResponse.json({ error: 'Invalid or expired access token' }, { status: 404 });
    }

    const customerId = resolved.customerId;
    const customerName = resolved.customerName || 'Customer';

    // Parse multipart form data
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const description = formData.get('description') as string || '';
    const documentType = formData.get('type') as string || 'other';

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // Validate file type
    const allowedTypes = [
      'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/heic',
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ];

    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({
        error: 'Invalid file type. Please upload images (JPG, PNG, GIF, WebP, HEIC) or documents (PDF, DOC).'
      }, { status: 400 });
    }

    // Validate file size (max 10MB)
    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      return NextResponse.json({
        error: 'File too large. Maximum size is 10MB.'
      }, { status: 400 });
    }

    // Upload to Vercel Blob (persistent cloud storage, works on Vercel)
    const timestamp = Date.now();
    const extension = file.name.split('.').pop()?.toLowerCase() || 'bin';
    const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_').slice(0, 50);
    const blobPath = `customer-portal-uploads/${customerId}/${timestamp}-${safeName}`;

    const blob = await put(blobPath, file, {
      access: 'public',
      addRandomSuffix: false,
    });

    const fileUrl = blob.url;

    // Save document record to Google Sheets
    const doc = await getDoc();
    const docSheet = await getOrCreateSheet(doc, 'Customer_Documents', [
      'documentId', 'customerId', 'type', 'title', 'description',
      'fileUrl', 'fileType', 'fileSize', 'uploadedAt', 'uploadedBy', 'isVisible',
      'uploadSource'
    ]);

    const documentId = `DOC-${timestamp}`;

    await docSheet.addRow({
      documentId,
      customerId,
      type: documentType,
      title: file.name,
      description,
      fileUrl,
      fileType: extension,
      fileSize: file.size.toString(),
      uploadedAt: new Date().toISOString(),
      uploadedBy: customerName,
      isVisible: 'true',
      uploadSource: 'customer_portal',
    });

    // Log upload as a message so the rep sees it
    const msgSheet = await getOrCreateSheet(doc, 'Customer_Messages', [
      'messageId', 'customerId', 'direction', 'channel', 'subject', 'content', 'sentAt', 'readAt', 'sentBy'
    ]);

    await msgSheet.addRow({
      messageId: `MSG-${timestamp}`,
      customerId,
      direction: 'inbound',
      channel: 'portal',
      subject: 'New Document Upload',
      content: `${customerName} uploaded a new file: ${file.name}${description ? ` - ${description}` : ''}`,
      sentAt: new Date().toISOString(),
      readAt: '',
      sentBy: customerName,
    });

    return NextResponse.json({
      success: true,
      document: {
        documentId,
        title: file.name,
        fileUrl,
        fileType: extension,
        fileSize: file.size,
      },
    });
  } catch (error) {
    console.error('File upload error:', error);
    return NextResponse.json({ error: 'Failed to upload file' }, { status: 500 });
  }
  }); // end withRateLimit
}

// GET - List customer's uploaded documents
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  // SECURITY: Rate limit token access to prevent brute-force token guessing.
  return withRateLimit(request, tokenRateLimiter, async () => {
  try {
    const { token } = await params;

    // SECURITY: Verify access token and derive customerId from the token.
    const resolved = await resolveToken(token);
    if (!resolved.valid || !resolved.customerId) {
      return NextResponse.json({ error: 'Invalid or expired access token' }, { status: 404 });
    }

    const customerId = resolved.customerId;

    // Get customer's documents
    const doc = await getDoc();
    const docSheet = doc.sheetsByTitle['Customer_Documents'];
    if (!docSheet) {
      return NextResponse.json({ documents: [] });
    }

    const docRows = await docSheet.getRows();
    const documents = docRows
      .filter(r => r.get('customerId') === customerId && r.get('uploadSource') === 'customer_portal')
      .map(r => ({
        documentId: r.get('documentId'),
        title: r.get('title'),
        description: r.get('description'),
        fileUrl: r.get('fileUrl'),
        fileType: r.get('fileType'),
        fileSize: parseInt(r.get('fileSize')) || 0,
        uploadedAt: r.get('uploadedAt'),
      }));

    return NextResponse.json({ documents });
  } catch (error) {
    console.error('Error fetching documents:', error);
    return NextResponse.json({ error: 'Failed to load documents' }, { status: 500 });
  }
  }); // end withRateLimit
}
