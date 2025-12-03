import { NextRequest, NextResponse } from 'next/server';
import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';
import { customerPortalService } from '@/lib/customer-portal-service';

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

// GET - Fetch customer portal data
export async function GET(
  request: NextRequest,
  { params }: { params: { token: string } }
) {
  try {
    const token = params.token;
    const doc = await getDoc();

    // Get customer access record
    const accessSheet = await getOrCreateSheet(doc, 'Customer_Portal_Access', [
      'accessToken', 'customerId', 'customerName', 'customerEmail', 'customerPhone',
      'customerAddress', 'salesRepId', 'salesRepName', 'salesRepSlug', 'jobId',
      'createdAt', 'expiresAt', 'lastAccessedAt', 'isActive'
    ]);

    const accessRows = await accessSheet.getRows();
    const accessRow = accessRows.find(r => r.get('accessToken') === token);

    if (!accessRow || accessRow.get('isActive') !== 'true') {
      return NextResponse.json({ error: 'Invalid or expired access token' }, { status: 404 });
    }

    // Update last accessed
    accessRow.set('lastAccessedAt', new Date().toISOString());
    await accessRow.save();

    const customerId = accessRow.get('customerId');
    const customerAddress = accessRow.get('customerAddress');

    // Get appointments
    const apptSheet = await getOrCreateSheet(doc, 'Customer_Appointments', [
      'appointmentId', 'customerId', 'type', 'title', 'description',
      'scheduledDate', 'scheduledTime', 'duration', 'status', 'assignedTo', 'notes', 'createdAt'
    ]);
    const apptRows = await apptSheet.getRows();
    const appointments = apptRows
      .filter(r => r.get('customerId') === customerId)
      .map(r => ({
        appointmentId: r.get('appointmentId'),
        customerId: r.get('customerId'),
        type: r.get('type'),
        title: r.get('title'),
        description: r.get('description'),
        scheduledDate: r.get('scheduledDate'),
        scheduledTime: r.get('scheduledTime'),
        duration: parseInt(r.get('duration')) || 60,
        status: r.get('status'),
        assignedTo: r.get('assignedTo'),
        notes: r.get('notes'),
        createdAt: r.get('createdAt'),
      }));

    // Get documents
    const docSheet = await getOrCreateSheet(doc, 'Customer_Documents', [
      'documentId', 'customerId', 'type', 'title', 'description',
      'fileUrl', 'fileType', 'fileSize', 'uploadedAt', 'uploadedBy', 'isVisible'
    ]);
    const docRows = await docSheet.getRows();
    const documents = docRows
      .filter(r => r.get('customerId') === customerId && r.get('isVisible') === 'true')
      .map(r => ({
        documentId: r.get('documentId'),
        customerId: r.get('customerId'),
        type: r.get('type'),
        title: r.get('title'),
        description: r.get('description'),
        fileUrl: r.get('fileUrl'),
        fileType: r.get('fileType'),
        fileSize: parseInt(r.get('fileSize')) || 0,
        uploadedAt: r.get('uploadedAt'),
        uploadedBy: r.get('uploadedBy'),
        isVisible: true,
      }));

    // Get messages
    const msgSheet = await getOrCreateSheet(doc, 'Customer_Messages', [
      'messageId', 'customerId', 'direction', 'channel', 'subject', 'content', 'sentAt', 'readAt', 'sentBy'
    ]);
    const msgRows = await msgSheet.getRows();
    const messages = msgRows
      .filter(r => r.get('customerId') === customerId)
      .map(r => ({
        messageId: r.get('messageId'),
        customerId: r.get('customerId'),
        direction: r.get('direction'),
        channel: r.get('channel'),
        subject: r.get('subject'),
        content: r.get('content'),
        sentAt: r.get('sentAt'),
        readAt: r.get('readAt'),
        sentBy: r.get('sentBy'),
      }));

    // Get job status if jobId exists
    let jobStatus = null;
    const jobId = accessRow.get('jobId');
    if (jobId) {
      const jobSheet = doc.sheetsByTitle['Jobs_Master'];
      if (jobSheet) {
        const jobRows = await jobSheet.getRows();
        const jobRow = jobRows.find(r => r.get('jobId') === jobId);
        if (jobRow) {
          const phases = customerPortalService.getJobPhases();
          const currentPhase = phases.find(p => p.id === jobRow.get('jobStatus'));
          const nextPhase = phases.find(p => p.progress > (currentPhase?.progress || 0));

          jobStatus = {
            phase: currentPhase?.label || 'In Progress',
            progress: currentPhase?.progress || 0,
            nextMilestone: nextPhase?.label || 'Project Complete',
            estimatedCompletion: jobRow.get('scheduledStartDate'),
          };
        }
      }
    }

    // Geocode address for weather (simplified - using Huntsville coords as default)
    // In production, use a geocoding API
    const latitude = 34.7304;
    const longitude = -86.5861;

    // Get weather forecast
    const weather = await customerPortalService.getWeatherForecast(latitude, longitude);

    // Get hail reports
    const hailReports = await customerPortalService.getHailReports(latitude, longitude, 30);

    // Get sales rep info from team sheet
    let salesRep = {
      name: accessRow.get('salesRepName'),
      slug: accessRow.get('salesRepSlug'),
      phone: '',
      email: '',
      photo: '',
      position: 'Roofing Specialist',
    };

    const teamSheet = doc.sheetsByTitle['team-members-import'];
    if (teamSheet) {
      const teamRows = await teamSheet.getRows();
      const repRow = teamRows.find(r => r.get('slug') === accessRow.get('salesRepSlug'));
      if (repRow) {
        salesRep = {
          name: repRow.get('name') || salesRep.name,
          slug: repRow.get('slug') || salesRep.slug,
          phone: repRow.get('phone') || '',
          email: repRow.get('email') || '',
          photo: repRow.get('profileImage') || '',
          position: repRow.get('position') || 'Roofing Specialist',
        };
      }
    }

    return NextResponse.json({
      customer: {
        accessToken: token,
        customerId,
        customerName: accessRow.get('customerName'),
        customerEmail: accessRow.get('customerEmail'),
        customerPhone: accessRow.get('customerPhone'),
        customerAddress,
        salesRepId: accessRow.get('salesRepId'),
        salesRepName: accessRow.get('salesRepName'),
        salesRepSlug: accessRow.get('salesRepSlug'),
        jobId,
        createdAt: accessRow.get('createdAt'),
        isActive: true,
      },
      salesRep,
      appointments,
      documents,
      messages,
      jobStatus,
      weather,
      hailReports,
    });
  } catch (error) {
    console.error('Customer portal error:', error);
    return NextResponse.json({ error: 'Failed to load portal data' }, { status: 500 });
  }
}

// POST - Send message from customer
export async function POST(
  request: NextRequest,
  { params }: { params: { token: string } }
) {
  try {
    const token = params.token;
    const body = await request.json();
    const { message, subject } = body;

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

    // Save message
    const msgSheet = await getOrCreateSheet(doc, 'Customer_Messages', [
      'messageId', 'customerId', 'direction', 'channel', 'subject', 'content', 'sentAt', 'readAt', 'sentBy'
    ]);

    await msgSheet.addRow({
      messageId: `MSG-${Date.now()}`,
      customerId,
      direction: 'inbound',
      channel: 'portal',
      subject: subject || 'Message from Customer Portal',
      content: message,
      sentAt: new Date().toISOString(),
      readAt: '',
      sentBy: accessRow.get('customerName'),
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error sending message:', error);
    return NextResponse.json({ error: 'Failed to send message' }, { status: 500 });
  }
}
