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
import {
  createContactFormRateLimiter,
  createGlobalFormRateLimiter,
  withRateLimit,
} from '@/lib/rate-limiter-kv';
import { checkForSpam } from '@/lib/spam-filter';
import { checkHoneypot } from '@/lib/honeypot';
import { verifyTurnstileToken, getRequestIp } from '@/lib/turnstile';
import { logSpamBlock } from '@/lib/spam-log';
import { checkRequestSize } from '@/lib/request-size-limit';

const formRateLimiter = createContactFormRateLimiter();
const globalFormRateLimiter = createGlobalFormRateLimiter();

export async function POST(request: NextRequest) {
  // SECURITY 2026-05-20: body-size cap was missing per verification audit M2.
  // Aligns this footer/popup capture form with the /api/forms/* cohort (50kb).
  const sizeError = checkRequestSize(request, '50kb');
  if (sizeError) return sizeError;

  // Check the cross-form global cap first so a hot IP can't burn its
  // per-form budget before tripping the global cap.
  return withRateLimit(request, globalFormRateLimiter, async () =>
    withRateLimit(request, formRateLimiter, async () => {
  try {
    const body = await request.json();

    // Honeypot check — silently drop bot submissions before any real work.
    // Returns the same success shape a real submit would so bots can't probe.
    const hp = checkHoneypot(body);
    if (hp.triggered) {
      console.warn('[HONEYPOT TRIGGERED route=email-capture]', { value: hp.value });
      logSpamBlock({
        gate: 'honeypot',
        route: '/api/email-capture',
        ip: getRequestIp(request),
        reason: 'website field populated',
        details: JSON.stringify({ value: hp.value }),
        submitterEmail: typeof body?.email === 'string' ? body.email : undefined,
        submitterName: typeof body?.name === 'string' ? body.name : undefined,
      }).catch(() => {});
      return NextResponse.json({
        success: true,
        message: 'Thank you! We\'ll be in touch soon.',
      });
    }

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

    // Spam filter — drop bot/outreach submissions BEFORE we sheet-write or
    // create a downstream lead. Footer/popup capture only collects name+email
    // so we only feed those (no phone/message available). Return a normal-
    // looking success so bots don't learn they were blocked.
    {
      const spamCheck = await checkForSpam({ name, email });
      if (spamCheck.isSpam) {
        console.warn('[EMAIL CAPTURE SPAM BLOCKED]', {
          email, score: spamCheck.spamScore, reasons: spamCheck.reasons,
        });
        logSpamBlock({
          gate: 'spam-filter',
          route: '/api/email-capture',
          ip: getRequestIp(request),
          reason: `score ${spamCheck.spamScore}`,
          details: JSON.stringify({ reasons: spamCheck.reasons }),
          submitterEmail: email,
          submitterName: name,
        }).catch(() => {});
        return NextResponse.json({
          success: true,
          message: 'Thank you! We\'ll be in touch soon.',
        });
      }
    }

    // Cloudflare Turnstile — bot fingerprint challenge. INERT until env vars
    // are set (see lib/turnstile.ts header). Explicit 400 on failure so legit
    // users on flaky networks can retry.
    const turnstile = await verifyTurnstileToken(body.turnstileToken, getRequestIp(request));
    if (!turnstile.valid) {
      console.warn('[TURNSTILE FAILED route=email-capture]', { reason: turnstile.reason });
      logSpamBlock({
        gate: 'turnstile',
        route: '/api/email-capture',
        ip: getRequestIp(request),
        reason: turnstile.reason ?? 'invalid token',
        details: turnstile.errorCodes
          ? JSON.stringify({ errorCodes: turnstile.errorCodes })
          : undefined,
        submitterEmail: typeof email === 'string' ? email : undefined,
        submitterName: typeof name === 'string' ? name : undefined,
      }).catch(() => {});
      return NextResponse.json(
        { success: false, message: 'Verification failed. Please try again.' },
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
          // Server-side fan-in: this route already verified Turnstile.
          // Pass 'disabled' so the downstream gate short-circuits.
          turnstileToken: 'disabled',
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
    })
  );
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
