import { NextRequest, NextResponse } from 'next/server';
import { formService } from '@/lib/form-service';
import {
  createBniPartnerFormRateLimiter,
  createGlobalFormRateLimiter,
  withRateLimit,
} from '@/lib/rate-limiter-kv';
import { checkRequestSize } from '@/lib/request-size-limit';
import { checkForSpam } from '@/lib/spam-filter';
import { checkHoneypot } from '@/lib/honeypot';
import { verifyTurnstileToken, getRequestIp } from '@/lib/turnstile';
import { logSpamBlock } from '@/lib/spam-log';

const formRateLimiter = createBniPartnerFormRateLimiter();
const globalFormRateLimiter = createGlobalFormRateLimiter();

export async function POST(request: NextRequest) {
  // SECURITY: Enforce request body size limit on public form
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
        console.warn('[HONEYPOT TRIGGERED route=forms/bni-partner]', { value: hp.value });
        logSpamBlock({
          gate: 'honeypot',
          route: '/api/forms/bni-partner',
          ip: getRequestIp(request),
          reason: 'website field populated',
          details: JSON.stringify({ value: hp.value }),
          submitterEmail: typeof body?.email === 'string' ? body.email : undefined,
          submitterName: typeof body?.name === 'string' ? body.name : undefined,
        }).catch(() => {});
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
          logSpamBlock({
            gate: 'spam-filter',
            route: '/api/forms/bni-partner',
            ip: getRequestIp(request),
            reason: `score ${spamCheck.spamScore}`,
            details: JSON.stringify({ reasons: spamCheck.reasons }),
            submitterEmail: email,
            submitterName: name,
          }).catch(() => {});
          return NextResponse.json(
            { success: true, message: 'Thank you! We will be in touch soon.' },
            { status: 200 }
          );
        }
      }

      // Cloudflare Turnstile — bot fingerprint challenge. INERT until env
      // vars are set (see lib/turnstile.ts header). Explicit 400 on failure
      // so legit users can retry.
      const turnstile = await verifyTurnstileToken(body.turnstileToken, getRequestIp(request));
      if (!turnstile.valid) {
        console.warn('[TURNSTILE FAILED route=forms/bni-partner]', { reason: turnstile.reason });
        logSpamBlock({
          gate: 'turnstile',
          route: '/api/forms/bni-partner',
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
    })
  );
}
