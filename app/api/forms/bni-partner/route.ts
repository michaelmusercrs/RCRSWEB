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
        console.warn('[HONEYPOT TRIGGERED route=forms/bni-partner]', { value: hp.value });
        return NextResponse.json(
          { success: true, message: 'Thank you! We will be in touch soon.' },
          { status: 200 }
        );
      }

      const { partner, name, phone, email, message } = body;

      if (!partner || !name || !phone) {
        return NextResponse.json(
          { success: false, message: 'Please select a partner and fill in your name and phone number.' },
          { status: 400 }
        );
      }

      if (email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
          return NextResponse.json(
            { success: false, message: 'Please enter a valid email address.' },
            { status: 400 }
          );
        }
      }

      // Spam filter — drop bot/outreach submissions BEFORE we sheet-write.
      // Email is optional on this form, so we only run the check when present.
      // Return a normal-looking success so bots don't learn they were blocked.
      if (email) {
        const spamCheck = await checkForSpam({ name, email, phone, message });
        if (spamCheck.isSpam) {
          console.warn('[BNI SPAM BLOCKED]', {
            email, score: spamCheck.spamScore, reasons: spamCheck.reasons,
          });
          return NextResponse.json(
            { success: true, message: 'Thank you! We will be in touch soon.' },
            { status: 200 }
          );
        }
      }

      // Submit as a contact form with BNI partner context
      const result = await formService.submitContactForm({
        name,
        email: email || '',
        phone,
        subject: `BNI Partner Introduction Request: ${partner}`,
        message: message || `Customer requesting introduction to BNI partner: ${partner}`,
        sourcePage: 'BNI Partners Page',
        leadSource: 'BNI Partner Network',
        leadSourceDetail: partner,
        marketingSource: 'Website - BNI Partner Directory',
      });

      return NextResponse.json(result, { status: result.success ? 200 : 500 });
    } catch (error) {
      console.error('Error processing BNI partner form:', error);
      return NextResponse.json(
        { success: false, message: 'Something went wrong. Please call us at (256) 274-8530.' },
        { status: 500 }
      );
    }
  });
}
