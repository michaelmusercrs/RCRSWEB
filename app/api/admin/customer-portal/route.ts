import { NextRequest, NextResponse } from 'next/server';
import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';
import { customerPortalService, DEFAULT_PORTAL_SETTINGS, PortalSettings } from '@/lib/customer-portal-service';
import { jobNimbusService } from '@/lib/jobnimbus-service';

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

// GET - List all customer portal accesses
export async function GET(request: NextRequest) {
  try {
    const doc = await getDoc();
    const accessSheet = doc.sheetsByTitle['Customer_Portal_Access'];

    if (!accessSheet) {
      return NextResponse.json({ portals: [] });
    }

    const rows = await accessSheet.getRows();
    const portals = rows.map(r => {
      // Parse settings from JSON or use defaults
      let settings = DEFAULT_PORTAL_SETTINGS;
      try {
        const settingsStr = r.get('settings');
        if (settingsStr) {
          settings = { ...DEFAULT_PORTAL_SETTINGS, ...JSON.parse(settingsStr) };
        }
      } catch {}

      return {
        accessToken: r.get('accessToken'),
        customerId: r.get('customerId'),
        customerName: r.get('customerName'),
        customerEmail: r.get('customerEmail'),
        customerPhone: r.get('customerPhone'),
        customerAddress: r.get('customerAddress'),
        salesRepName: r.get('salesRepName'),
        salesRepSlug: r.get('salesRepSlug'),
        jobId: r.get('jobId'),
        createdAt: r.get('createdAt'),
        lastAccessedAt: r.get('lastAccessedAt'),
        isActive: r.get('isActive') === 'true',
        notificationSent: r.get('notificationSent') === 'true',
        notificationChannel: r.get('notificationChannel'),
        portalUrl: customerPortalService.getPortalUrl(r.get('accessToken')),
        settings,
      };
    });

    return NextResponse.json({ portals });
  } catch (error) {
    console.error('Error fetching portals:', error);
    return NextResponse.json({ error: 'Failed to fetch portals' }, { status: 500 });
  }
}

// POST - Create new customer portal access
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      customerName,
      customerEmail,
      customerPhone,
      customerAddress,
      salesRepSlug,
      jobNimbusContactId,
      sendNotification = true,
      notificationMethod = 'sms', // 'sms', 'email', or 'both'
    } = body;

    if (!customerName || (!customerEmail && !customerPhone)) {
      return NextResponse.json({
        error: 'Customer name and at least email or phone required'
      }, { status: 400 });
    }

    const doc = await getDoc();

    // Look up sales rep
    let salesRepInfo = { id: '', slug: salesRepSlug || 'chris-muse', name: 'River City Roofing' };
    const teamSheet = doc.sheetsByTitle['team-members-import'];
    if (teamSheet && salesRepSlug) {
      const teamRows = await teamSheet.getRows();
      const repRow = teamRows.find(r => r.get('slug') === salesRepSlug);
      if (repRow) {
        salesRepInfo = {
          id: repRow.get('id') || '',
          slug: repRow.get('slug'),
          name: repRow.get('name'),
        };
      }
    }

    // Create portal access
    const portalAccess = customerPortalService.createPortalAccess({
      customerName,
      customerEmail: customerEmail || '',
      customerPhone: customerPhone || '',
      customerAddress: customerAddress || '',
      salesRepId: salesRepInfo.id,
      salesRepName: salesRepInfo.name,
      salesRepSlug: salesRepInfo.slug,
    });

    // Save to sheet
    const accessSheet = await getOrCreateSheet(doc, 'Customer_Portal_Access', [
      'accessToken', 'customerId', 'customerName', 'customerEmail', 'customerPhone',
      'customerAddress', 'salesRepId', 'salesRepName', 'salesRepSlug', 'jobId',
      'createdAt', 'expiresAt', 'lastAccessedAt', 'isActive', 'jobNimbusContactId',
      'notificationSent', 'notificationChannel'
    ]);

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
      jobId: '',
      createdAt: portalAccess.createdAt,
      expiresAt: '',
      lastAccessedAt: '',
      isActive: 'true',
      jobNimbusContactId: jobNimbusContactId || '',
      notificationSent: 'false',
      notificationChannel: '',
    });

    const portalUrl = customerPortalService.getPortalUrl(portalAccess.accessToken);
    const smsTemplates = customerPortalService.getSMSTemplates(portalAccess);
    const emailTemplates = customerPortalService.getEmailTemplates(portalAccess);

    // Return the portal data with templates (actual sending done separately)
    return NextResponse.json({
      success: true,
      portal: {
        ...portalAccess,
        portalUrl,
      },
      templates: {
        sms: smsTemplates.portalInvite,
        email: emailTemplates.portalInvite,
      },
      sendNotification,
      notificationMethod,
    });
  } catch (error) {
    console.error('Error creating portal:', error);
    return NextResponse.json({ error: 'Failed to create portal' }, { status: 500 });
  }
}

// PUT - Update portal (activate/deactivate, resend notification)
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { accessToken, action, ...updates } = body;

    if (!accessToken) {
      return NextResponse.json({ error: 'Access token required' }, { status: 400 });
    }

    const doc = await getDoc();
    const accessSheet = doc.sheetsByTitle['Customer_Portal_Access'];

    if (!accessSheet) {
      return NextResponse.json({ error: 'Portal not found' }, { status: 404 });
    }

    const rows = await accessSheet.getRows();
    const row = rows.find(r => r.get('accessToken') === accessToken);

    if (!row) {
      return NextResponse.json({ error: 'Portal not found' }, { status: 404 });
    }

    switch (action) {
      case 'deactivate':
        row.set('isActive', 'false');
        break;
      case 'activate':
        row.set('isActive', 'true');
        break;
      case 'regenerate':
        // Generate new token
        const newToken = customerPortalService.generateAccessToken();
        row.set('accessToken', newToken);
        break;
      case 'update-settings':
        // Save portal settings as JSON
        if (updates.settings) {
          row.set('settings', JSON.stringify(updates.settings));
        }
        break;
      default:
        // Update fields
        Object.entries(updates).forEach(([key, value]) => {
          if (typeof value === 'string') {
            row.set(key, value);
          } else if (key === 'settings' && typeof value === 'object') {
            row.set('settings', JSON.stringify(value));
          }
        });
    }

    await row.save();

    return NextResponse.json({
      success: true,
      portal: {
        accessToken: row.get('accessToken'),
        customerId: row.get('customerId'),
        customerName: row.get('customerName'),
        isActive: row.get('isActive') === 'true',
        portalUrl: customerPortalService.getPortalUrl(row.get('accessToken')),
      },
    });
  } catch (error) {
    console.error('Error updating portal:', error);
    return NextResponse.json({ error: 'Failed to update portal' }, { status: 500 });
  }
}

// DELETE - Deactivate portal
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const accessToken = searchParams.get('token');

    if (!accessToken) {
      return NextResponse.json({ error: 'Access token required' }, { status: 400 });
    }

    const doc = await getDoc();
    const accessSheet = doc.sheetsByTitle['Customer_Portal_Access'];

    if (!accessSheet) {
      return NextResponse.json({ error: 'Portal not found' }, { status: 404 });
    }

    const rows = await accessSheet.getRows();
    const row = rows.find(r => r.get('accessToken') === accessToken);

    if (!row) {
      return NextResponse.json({ error: 'Portal not found' }, { status: 404 });
    }

    // Deactivate instead of deleting
    row.set('isActive', 'false');
    await row.save();

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting portal:', error);
    return NextResponse.json({ error: 'Failed to delete portal' }, { status: 500 });
  }
}
