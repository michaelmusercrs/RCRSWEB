import { NextRequest, NextResponse } from 'next/server';
import { formService } from '@/lib/form-service';
import { createFormRateLimiter, withRateLimit } from '@/lib/rate-limiter';
import { checkRequestSize } from '@/lib/request-size-limit';
import { checkForSpam } from '@/lib/spam-filter';
import { checkHoneypot } from '@/lib/honeypot';

const formRateLimiter = createFormRateLimiter();

export async function POST(request: NextRequest) {
  // SECURITY: Enforce request body size limit on public form
  const sizeError = checkRequestSize(request, '50kb');
  if (sizeError) return sizeError;

  return withRateLimit(request, formRateLimiter, async () => {
  try {
    const body = await request.json();

    // Honeypot check — silently drop bot submissions before any real work.
    // Returns the same success shape a real submit would so bots can't probe.
    const hp = checkHoneypot(body);
    if (hp.triggered) {
      console.warn('[HONEYPOT TRIGGERED route=forms/contact]', { value: hp.value });
      return NextResponse.json(
        { success: true, message: 'Thank you for contacting us! We will get back to you within 24 hours.' },
        { status: 200 }
      );
    }

    const {
      name,
      email,
      phone,
      address,
      subject,
      message,
      preferredInspector,
      sourcePage,
      salesRep,
      // Lead source attribution
      leadSource,
      leadSourceDetail,
      marketingSource,
    } = body;

    // Validate required fields. Name + subject + message are always needed,
    // and the customer must provide AT LEAST one way to reach them
    // (phone OR email). Without that, the lead is unactionable.
    if (!name || !subject || !message) {
      return NextResponse.json(
        { success: false, message: 'Please fill in all required fields.' },
        { status: 400 }
      );
    }
    if (!phone && !email) {
      return NextResponse.json(
        { success: false, message: 'Please provide a phone number or email so we can reach you.' },
        { status: 400 }
      );
    }

    // Validate email format if provided
    if (email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return NextResponse.json(
          { success: false, message: 'Please enter a valid email address.' },
          { status: 400 }
        );
      }
    }

    // Validate phone format if provided (US: 10 digits, optional country code)
    if (phone) {
      const digitsOnly = phone.replace(/\D/g, '');
      if (digitsOnly.length < 10 || digitsOnly.length > 11) {
        return NextResponse.json(
          { success: false, message: 'Please enter a valid US phone number.' },
          { status: 400 }
        );
      }
    }

    // Spam filter — drop bot/outreach submissions BEFORE we sheet-log or email.
    // Custom-blocked domains hard-fail; other heuristics use the scored threshold.
    // Return 200 OK to the client either way so bots don't learn they were blocked.
    if (email) {
      const spamCheck = await checkForSpam({ name, email, phone, message });
      if (spamCheck.isSpam) {
        console.warn('[CONTACT FORM SPAM BLOCKED]', {
          email, score: spamCheck.spamScore, reasons: spamCheck.reasons,
        });
        return NextResponse.json(
          { success: true, message: 'Thank you for contacting us! We will get back to you within 24 hours.' },
          { status: 200 }
        );
      }
    }

    // Submit the form to Google Sheets
    const result = await formService.submitContactForm({
      name,
      email,
      phone: phone || '',
      subject,
      message,
      preferredInspector: preferredInspector || 'First Available',
      sourcePage: sourcePage || 'Contact Page',
      // Lead source attribution
      leadSource: leadSource || 'Direct',
      leadSourceDetail: leadSourceDetail || '',
      marketingSource: marketingSource || 'Website - Direct',
    });

    // Also create a lead in the portal system (fire-and-forget).
    // Fires whenever we have ANY contact method (phone or email) — previously
    // this only ran on phone-bearing leads, silently dropping email-only ones.
    if (result.success && (phone || email)) {
      const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.rivercityroofingsolutions.com';
      try {
        await fetch(`${baseUrl}/api/leads/new`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name,
            email,
            phone: phone || '',
            address: address || 'Not provided',
            source: 'contact_form',
            sourceDetails: `${sourcePage || 'Contact Page'} - ${subject}`,
            sourcePage: sourcePage || 'Contact Page',
            serviceType: subject,
            message,
            preferredRepSlug: preferredInspector !== 'First Available' ? preferredInspector : undefined,
            assignedRepSlug: salesRep || (preferredInspector !== 'First Available' ? preferredInspector : undefined),
            sendNotifications: true,
            notifyTeam: true,
          }),
        });
      } catch (leadErr) {
        // Non-blocking: form submission succeeded even if lead creation fails
        console.warn('Contact form lead creation failed:', leadErr);
      }
    }

    return NextResponse.json(result, { status: result.success ? 200 : 500 });
  } catch (error) {
    console.error('Error processing contact form:', error);
    return NextResponse.json(
      { success: false, message: 'Something went wrong. Please call us at (256) 274-8530.' },
      { status: 500 }
    );
  }
  });
}
