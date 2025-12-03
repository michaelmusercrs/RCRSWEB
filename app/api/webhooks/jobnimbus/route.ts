import { NextRequest, NextResponse } from 'next/server';
import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';
import { customerPortalService } from '@/lib/customer-portal-service';

// Twilio credentials (optional - for SMS)
const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;
const TWILIO_PHONE_NUMBER = process.env.TWILIO_PHONE_NUMBER;

// SendGrid credentials (optional - for email)
const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY;
const FROM_EMAIL = process.env.FROM_EMAIL || 'noreply@rivercityroofingsolutions.com';

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

// Send SMS via Twilio
async function sendSMS(to: string, message: string): Promise<boolean> {
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_PHONE_NUMBER) {
    console.log('Twilio not configured, skipping SMS');
    return false;
  }

  try {
    const phone = to.replace(/\D/g, '');
    const formattedPhone = phone.startsWith('1') ? `+${phone}` : `+1${phone}`;

    const response = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`,
      {
        method: 'POST',
        headers: {
          'Authorization': 'Basic ' + Buffer.from(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`).toString('base64'),
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          To: formattedPhone,
          From: TWILIO_PHONE_NUMBER,
          Body: message,
        }),
      }
    );

    if (!response.ok) {
      console.error('Twilio error:', await response.text());
      return false;
    }

    return true;
  } catch (error) {
    console.error('SMS send error:', error);
    return false;
  }
}

// Send email via SendGrid
async function sendEmail(to: string, subject: string, html: string): Promise<boolean> {
  if (!SENDGRID_API_KEY) {
    console.log('SendGrid not configured, skipping email');
    return false;
  }

  try {
    const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SENDGRID_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: to }] }],
        from: { email: FROM_EMAIL, name: 'River City Roofing Solutions' },
        subject,
        content: [{ type: 'text/html', value: html }],
      }),
    });

    if (!response.ok && response.status !== 202) {
      console.error('SendGrid error:', await response.text());
      return false;
    }

    return true;
  } catch (error) {
    console.error('Email send error:', error);
    return false;
  }
}

// JobNimbus Webhook Handler
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Verify webhook secret if configured
    const webhookSecret = process.env.JOBNIMBUS_WEBHOOK_SECRET;
    if (webhookSecret) {
      const signature = request.headers.get('x-jobnimbus-signature');
      // In production, verify the signature
    }

    const { event, data } = body;

    // Handle different webhook events
    switch (event) {
      case 'contact.created':
      case 'contact.updated':
        await handleContactEvent(data, event);
        break;

      case 'job.created':
      case 'job.updated':
        await handleJobEvent(data, event);
        break;

      case 'estimate.created':
      case 'estimate.approved':
        await handleEstimateEvent(data, event);
        break;

      default:
        console.log('Unhandled webhook event:', event);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Webhook error:', error);
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 });
  }
}

// Handle contact creation/update
async function handleContactEvent(data: any, event: string) {
  const doc = await getDoc();

  // Get or create customer portal access sheet
  const accessSheet = await getOrCreateSheet(doc, 'Customer_Portal_Access', [
    'accessToken', 'customerId', 'customerName', 'customerEmail', 'customerPhone',
    'customerAddress', 'salesRepId', 'salesRepName', 'salesRepSlug', 'jobId',
    'createdAt', 'expiresAt', 'lastAccessedAt', 'isActive', 'jobNimbusContactId',
    'notificationSent', 'notificationChannel'
  ]);

  // Check if portal access already exists for this contact
  const existingRows = await accessSheet.getRows();
  const existingAccess = existingRows.find(r => r.get('jobNimbusContactId') === data.jnid);

  if (existingAccess && event === 'contact.created') {
    console.log('Portal access already exists for contact:', data.jnid);
    return;
  }

  // Get sales rep info from JobNimbus data or default
  const salesRepName = data.sales_rep_name || data.assigned_to || 'River City Roofing';
  const salesRepSlug = salesRepName.toLowerCase().replace(/\s+/g, '-');

  // Look up sales rep in team sheet
  let salesRepInfo = { id: '', slug: salesRepSlug, name: salesRepName };
  const teamSheet = doc.sheetsByTitle['team-members-import'];
  if (teamSheet) {
    const teamRows = await teamSheet.getRows();
    const repRow = teamRows.find(r =>
      r.get('name')?.toLowerCase() === salesRepName.toLowerCase() ||
      r.get('slug') === salesRepSlug
    );
    if (repRow) {
      salesRepInfo = {
        id: repRow.get('id') || '',
        slug: repRow.get('slug') || salesRepSlug,
        name: repRow.get('name') || salesRepName,
      };
    }
  }

  // Create or update portal access
  const portalAccess = customerPortalService.createPortalAccess({
    customerName: `${data.first_name || ''} ${data.last_name || ''}`.trim() || 'Customer',
    customerEmail: data.email || '',
    customerPhone: data.home_phone || data.mobile_phone || data.work_phone || '',
    customerAddress: formatAddress(data),
    salesRepId: salesRepInfo.id,
    salesRepName: salesRepInfo.name,
    salesRepSlug: salesRepInfo.slug,
    jobId: data.related_job_id,
  });

  if (existingAccess) {
    // Update existing record
    existingAccess.set('customerName', portalAccess.customerName);
    existingAccess.set('customerEmail', portalAccess.customerEmail);
    existingAccess.set('customerPhone', portalAccess.customerPhone);
    existingAccess.set('customerAddress', portalAccess.customerAddress);
    existingAccess.set('salesRepId', salesRepInfo.id);
    existingAccess.set('salesRepName', salesRepInfo.name);
    existingAccess.set('salesRepSlug', salesRepInfo.slug);
    await existingAccess.save();
  } else {
    // Create new portal access
    await accessSheet.addRow({
      accessToken: portalAccess.accessToken,
      customerId: portalAccess.customerId,
      customerName: portalAccess.customerName,
      customerEmail: portalAccess.customerEmail,
      customerPhone: portalAccess.customerPhone,
      customerAddress: portalAccess.customerAddress,
      salesRepId: salesRepInfo.id,
      salesRepName: salesRepInfo.name,
      salesRepSlug: salesRepInfo.slug,
      jobId: portalAccess.jobId || '',
      createdAt: portalAccess.createdAt,
      expiresAt: '',
      lastAccessedAt: '',
      isActive: 'true',
      jobNimbusContactId: data.jnid || '',
      notificationSent: 'false',
      notificationChannel: '',
    });

    // Send welcome notification
    await sendWelcomeNotification(portalAccess, accessSheet);
  }
}

// Handle job creation/update
async function handleJobEvent(data: any, event: string) {
  const doc = await getDoc();

  // Update customer portal with job info
  const accessSheet = doc.sheetsByTitle['Customer_Portal_Access'];
  if (!accessSheet) return;

  const rows = await accessSheet.getRows();
  const customerRow = rows.find(r =>
    r.get('jobNimbusContactId') === data.related?.contact_id ||
    r.get('customerEmail') === data.contact_email
  );

  if (customerRow) {
    customerRow.set('jobId', data.jnid || data.number);
    await customerRow.save();

    // If job was just created, send update notification
    if (event === 'job.created') {
      const accessToken = customerRow.get('accessToken');
      const phone = customerRow.get('customerPhone');
      const email = customerRow.get('customerEmail');
      const name = customerRow.get('customerName');
      const portalUrl = customerPortalService.getPortalUrl(accessToken);

      if (phone) {
        await sendSMS(phone,
          `Hi ${name.split(' ')[0]}! Your roofing project has been created. Track your progress: ${portalUrl}`
        );
      }
    }
  }
}

// Handle estimate events
async function handleEstimateEvent(data: any, event: string) {
  const doc = await getDoc();

  // Add estimate document to customer portal
  const docSheet = await getOrCreateSheet(doc, 'Customer_Documents', [
    'documentId', 'customerId', 'type', 'title', 'description',
    'fileUrl', 'fileType', 'fileSize', 'uploadedAt', 'uploadedBy', 'isVisible'
  ]);

  // Find customer
  const accessSheet = doc.sheetsByTitle['Customer_Portal_Access'];
  if (!accessSheet) return;

  const accessRows = await accessSheet.getRows();
  const customerRow = accessRows.find(r =>
    r.get('jobNimbusContactId') === data.related?.contact_id ||
    r.get('customerEmail') === data.contact_email
  );

  if (customerRow) {
    const customerId = customerRow.get('customerId');

    // Add estimate as document
    await docSheet.addRow({
      documentId: `DOC-${Date.now()}`,
      customerId,
      type: 'estimate',
      title: `Estimate #${data.number || data.jnid}`,
      description: `Roofing estimate - ${data.total ? `$${data.total}` : 'View for details'}`,
      fileUrl: data.pdf_url || data.public_url || '',
      fileType: 'pdf',
      fileSize: 0,
      uploadedAt: new Date().toISOString(),
      uploadedBy: 'JobNimbus',
      isVisible: 'true',
    });

    // Send notification
    const accessToken = customerRow.get('accessToken');
    const phone = customerRow.get('customerPhone');
    const email = customerRow.get('customerEmail');
    const name = customerRow.get('customerName');
    const portalUrl = customerPortalService.getPortalUrl(accessToken);

    const templates = customerPortalService.getSMSTemplates({
      ...customerRow.toObject() as any,
      accessToken,
    });

    if (phone) {
      await sendSMS(phone, templates.estimateReady);
    }

    if (email) {
      await sendEmail(
        email,
        'Your Roofing Estimate is Ready - River City Roofing',
        `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #16a34a;">Your Estimate is Ready!</h2>
          <p>Hi ${name.split(' ')[0]},</p>
          <p>Great news! Your roofing estimate is ready to view.</p>
          <a href="${portalUrl}" style="display: inline-block; background: #16a34a; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; margin: 16px 0;">
            View Your Estimate
          </a>
          <p>If you have any questions, reply to this email or call your sales rep directly from your portal.</p>
          <p>- River City Roofing Solutions</p>
        </div>
        `
      );
    }
  }
}

// Send welcome notification with portal link
async function sendWelcomeNotification(
  portalAccess: ReturnType<typeof customerPortalService.createPortalAccess>,
  accessSheet: any
) {
  const templates = customerPortalService.getSMSTemplates(portalAccess);
  const emailTemplates = customerPortalService.getEmailTemplates(portalAccess);

  let notificationSent = false;
  let notificationChannel = '';

  // Prefer SMS if phone available
  if (portalAccess.customerPhone) {
    const smsSent = await sendSMS(portalAccess.customerPhone, templates.portalInvite);
    if (smsSent) {
      notificationSent = true;
      notificationChannel = 'sms';
    }
  }

  // Also send email if available
  if (portalAccess.customerEmail) {
    const emailSent = await sendEmail(
      portalAccess.customerEmail,
      emailTemplates.portalInvite.subject,
      emailTemplates.portalInvite.html
    );
    if (emailSent) {
      notificationSent = true;
      notificationChannel = notificationChannel ? 'sms,email' : 'email';
    }
  }

  // Update notification status
  if (notificationSent) {
    const rows = await accessSheet.getRows();
    const row = rows.find((r: any) => r.get('accessToken') === portalAccess.accessToken);
    if (row) {
      row.set('notificationSent', 'true');
      row.set('notificationChannel', notificationChannel);
      await row.save();
    }
  }
}

// Format address from JobNimbus data
function formatAddress(data: any): string {
  const parts = [
    data.address_line1,
    data.address_line2,
    data.city,
    data.state_text,
    data.zip,
  ].filter(Boolean);

  return parts.join(', ') || 'Address not provided';
}

// Verify endpoint for JobNimbus webhook setup
export async function GET(request: NextRequest) {
  // JobNimbus may ping this endpoint to verify it's active
  return NextResponse.json({
    status: 'active',
    service: 'River City Roofing - Customer Portal Webhook',
    supported_events: [
      'contact.created',
      'contact.updated',
      'job.created',
      'job.updated',
      'estimate.created',
      'estimate.approved',
    ],
  });
}
