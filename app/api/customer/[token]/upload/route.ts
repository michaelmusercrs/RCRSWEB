import { NextRequest, NextResponse } from 'next/server';
import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';

async function getDoc(): Promise<GoogleSpreadsheet> {
  const serviceAccountEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n');
  const sheetId = process.env.GOOGLE_SHEET_ID;

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

// POST - Upload file from customer
export async function POST(
  request: NextRequest,
  { params }: { params: { token: string } }
) {
  try {
    const token = params.token;
    const doc = await getDoc();

    // Verify access token
    const accessSheet = doc.sheetsByTitle['Customer_Portal_Access'];
    if (!accessSheet) {
      return NextResponse.json({ error: 'Portal not configured' }, { status: 500 });
    }

    const accessRows = await accessSheet.getRows();
    const accessRow = accessRows.find(r => r.get('accessToken') === token);

    if (!accessRow || accessRow.get('isActive') !== 'true') {
      return NextResponse.json({ error: 'Invalid access token' }, { status: 404 });
    }

    const customerId = accessRow.get('customerId');
    const customerName = accessRow.get('customerName');

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
      'image/jpeg', 'image/png', 'image/gif', 'image/webp',
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ];

    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({
        error: 'Invalid file type. Please upload images (JPG, PNG, GIF) or documents (PDF, DOC).'
      }, { status: 400 });
    }

    // Validate file size (max 10MB)
    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      return NextResponse.json({
        error: 'File too large. Maximum size is 10MB.'
      }, { status: 400 });
    }

    // Generate unique filename
    const timestamp = Date.now();
    const extension = file.name.split('.').pop()?.toLowerCase() || 'bin';
    const sanitizedName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_').slice(0, 50);
    const filename = `${customerId}-${timestamp}-${sanitizedName}`;

    // Create uploads directory if it doesn't exist
    const uploadsDir = join(process.cwd(), 'public', 'uploads', 'customer');
    if (!existsSync(uploadsDir)) {
      await mkdir(uploadsDir, { recursive: true });
    }

    // Save file
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const filePath = join(uploadsDir, filename);
    await writeFile(filePath, buffer);

    // Generate public URL
    const fileUrl = `/uploads/customer/${filename}`;

    // Save document record
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
      isVisible: 'true', // Customer uploads are visible by default
      uploadSource: 'customer_portal',
    });

    // Notify sales rep about the upload
    const salesRepSlug = accessRow.get('salesRepSlug');
    const salesRepEmail = await getSalesRepEmail(doc, salesRepSlug);

    if (salesRepEmail) {
      // Log notification for sales rep
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
    }

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
}

// Helper to get sales rep email
async function getSalesRepEmail(doc: GoogleSpreadsheet, slug: string): Promise<string | null> {
  const teamSheet = doc.sheetsByTitle['team-members-import'];
  if (!teamSheet) return null;

  const rows = await teamSheet.getRows();
  const repRow = rows.find(r => r.get('slug') === slug);
  return repRow?.get('email') || null;
}

// GET - List customer's uploaded documents
export async function GET(
  request: NextRequest,
  { params }: { params: { token: string } }
) {
  try {
    const token = params.token;
    const doc = await getDoc();

    // Verify access token
    const accessSheet = doc.sheetsByTitle['Customer_Portal_Access'];
    if (!accessSheet) {
      return NextResponse.json({ error: 'Portal not configured' }, { status: 500 });
    }

    const accessRows = await accessSheet.getRows();
    const accessRow = accessRows.find(r => r.get('accessToken') === token);

    if (!accessRow || accessRow.get('isActive') !== 'true') {
      return NextResponse.json({ error: 'Invalid access token' }, { status: 404 });
    }

    const customerId = accessRow.get('customerId');

    // Get customer's documents
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
}
