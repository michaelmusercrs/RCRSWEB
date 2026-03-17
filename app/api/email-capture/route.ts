/**
 * Email Capture API Route
 * 
 * Captures leads from popup/footer forms on the public site.
 * Stores to Google Sheets ("Email Captures" tab) and logs all submissions.
 * 
 * POST /api/email-capture
 * Body: { name, email, phone?, address?, sourcePage, utmSource?, utmMedium?, utmCampaign?, utmTerm?, utmContent? }
 */

import { NextRequest, NextResponse } from 'next/server';
import { isGoogleSheetsConfigured } from '@/lib/google-sheets-service';
import { rateLimit } from '@/lib/rate-limit';

export async function POST(request: NextRequest) {
  // Rate limit: 5 submissions per minute per IP
  const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown';
  const rateLimitResult = rateLimit(ip, 5, 60_000);
  if (!rateLimitResult.allowed) {
    return NextResponse.json(
      { success: false, error: 'Too many requests. Please try again later.' },
      { status: 429 }
    );
  }

  try {
    const body = await request.json();
    const { name, email, phone, address, sourcePage, utmSource, utmMedium, utmCampaign, utmTerm, utmContent } = body;

    // Validate required fields
    if (!name || !email) {
      return NextResponse.json(
        { success: false, error: 'Name and email are required.' },
        { status: 400 }
      );
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { success: false, error: 'Invalid email address.' },
        { status: 400 }
      );
    }

    const timestamp = new Date().toISOString();

    const captureData = {
      timestamp,
      name: name.trim(),
      email: email.trim().toLowerCase(),
      phone: phone?.trim() || '',
      address: address?.trim() || '',
      sourcePage: sourcePage || '/',
      utmSource: utmSource || '',
      utmMedium: utmMedium || '',
      utmCampaign: utmCampaign || '',
      utmTerm: utmTerm || '',
      utmContent: utmContent || '',
      status: 'new',
    };

    // Store to Google Sheets if configured
    if (isGoogleSheetsConfigured()) {
      try {
        await saveToGoogleSheets(captureData);
      } catch (sheetsError) {
        console.error('[Email Capture] Google Sheets save failed:', sheetsError);
      }
    }

    // Also create a lead so it goes through the full pipeline (email + distribution)
    try {
      const leadRes = await fetch(new URL('/api/leads/new', request.url).toString(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: captureData.name,
          email: captureData.email,
          phone: captureData.phone || undefined,
          address: captureData.address || undefined,
          source: 'email_capture',
          sourceDetails: `Footer/Popup - ${captureData.sourcePage}`,
          serviceType: 'General Inquiry',
          message: `Email capture from ${captureData.sourcePage}. UTM: ${captureData.utmSource || 'direct'}/${captureData.utmMedium || 'none'}/${captureData.utmCampaign || 'none'}`,
          sendNotifications: true,
          notifyTeam: true,
        }),
      });
      if (!leadRes.ok) {
        console.error('[Email Capture] Lead creation failed:', leadRes.status);
      }
    } catch (leadErr) {
      console.error('[Email Capture] Lead creation error:', leadErr);
    }

    return NextResponse.json({
      success: true,
      message: 'Thank you! We\'ll be in touch soon.',
    });
  } catch (error) {
    console.error('[Email Capture] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Something went wrong. Please try again.' },
      { status: 500 }
    );
  }
}

/**
 * Save capture data to Google Sheets "Email Captures" tab.
 * Creates the tab if it doesn't exist.
 */
async function saveToGoogleSheets(data: Record<string, string>) {
  const { GoogleSpreadsheet } = await import('google-spreadsheet');
  const { JWT } = await import('google-auth-library');

  const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n')?.replace(/\r\n/g, '\n');
  const auth = new JWT({
    email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    key: privateKey,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });

  const doc = new GoogleSpreadsheet(process.env.GOOGLE_SHEETS_ID!, auth);
  await doc.loadInfo();

  // Find or create "Email Captures" sheet
  let sheet = doc.sheetsByTitle['Email Captures'];
  if (!sheet) {
    sheet = await doc.addSheet({
      title: 'Email Captures',
      headerValues: [
        'Timestamp', 'Name', 'Email', 'Phone', 'Address',
        'Source Page', 'UTM Source', 'UTM Medium', 'UTM Campaign',
        'UTM Term', 'UTM Content', 'Status',
      ],
    });
  }

  await sheet.addRow({
    Timestamp: data.timestamp,
    Name: data.name,
    Email: data.email,
    Phone: data.phone,
    Address: data.address,
    'Source Page': data.sourcePage,
    'UTM Source': data.utmSource,
    'UTM Medium': data.utmMedium,
    'UTM Campaign': data.utmCampaign,
    'UTM Term': data.utmTerm,
    'UTM Content': data.utmContent,
    Status: data.status,
  });
}
