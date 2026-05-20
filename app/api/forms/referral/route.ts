import { NextRequest, NextResponse } from 'next/server';
import { formService } from '@/lib/form-service';
import {
  createReferralFormRateLimiter,
  createGlobalFormRateLimiter,
  withRateLimit,
} from '@/lib/rate-limiter-kv';
import { checkRequestSize } from '@/lib/request-size-limit';
import { checkForSpam } from '@/lib/spam-filter';
import { checkHoneypot } from '@/lib/honeypot';
import { verifyTurnstileToken, getRequestIp } from '@/lib/turnstile';
import { logSpamBlock } from '@/lib/spam-log';

const formRateLimiter = createReferralFormRateLimiter();
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
      console.warn('[HONEYPOT TRIGGERED route=forms/referral]', { value: hp.value });
      logSpamBlock({
        gate: 'honeypot',
        route: '/api/forms/referral',
        ip: getRequestIp(request),
        reason: 'website field populated',
        details: JSON.stringify({ value: hp.value }),
        submitterEmail:
          typeof body?.referrerEmail === 'string' ? body.referrerEmail : undefined,
        submitterName:
          typeof body?.referrerName === 'string' ? body.referrerName : undefined,
      }).catch(() => {});
      return NextResponse.json(
        { success: true, message: 'Thank you for your referral! We will contact them soon.' },
        { status: 200 }
      );
    }

    const {
      referrerName,
      referrerPhone,
      referrerEmail,
      referralName,
      referralPhone,
      referralEmail,
      referralAddress,
      salesRep,
      notes,
      sourcePage,
    } = body;

    // Validate required fields
    if (!referrerName || !referrerPhone || !referralName || !referralPhone || !referralAddress) {
      return NextResponse.json(
        { success: false, message: 'Please fill in all required fields.' },
        { status: 400 }
      );
    }

    // Spam filter — drop bot/outreach submissions BEFORE we sheet-write or
    // create a downstream lead. Prefer the referred-person's email (the real
    // future-customer); fall back to the referrer's email if none provided.
    // Return a normal-looking success so bots don't learn they were blocked.
    const spamEmail = referralEmail || referrerEmail;
    if (spamEmail) {
      const spamCheck = await checkForSpam({
        name: referralName,
        email: spamEmail,
        phone: referralPhone,
        message: notes,
      });
      if (spamCheck.isSpam) {
        console.warn('[REFERRAL SPAM BLOCKED]', {
          email: spamEmail, score: spamCheck.spamScore, reasons: spamCheck.reasons,
        });
        logSpamBlock({
          gate: 'spam-filter',
          route: '/api/forms/referral',
          ip: getRequestIp(request),
          reason: `score ${spamCheck.spamScore}`,
          details: JSON.stringify({ reasons: spamCheck.reasons }),
          submitterEmail: spamEmail,
          submitterName: referralName,
        }).catch(() => {});
        return NextResponse.json(
          { success: true, message: 'Thank you for your referral! We will contact them soon.' },
          { status: 200 }
        );
      }
    }

    // Cloudflare Turnstile — bot fingerprint challenge. INERT until env vars
    // are set (see lib/turnstile.ts header). Explicit 400 on failure.
    const turnstile = await verifyTurnstileToken(body.turnstileToken, getRequestIp(request));
    if (!turnstile.valid) {
      console.warn('[TURNSTILE FAILED route=forms/referral]', { reason: turnstile.reason });
      logSpamBlock({
        gate: 'turnstile',
        route: '/api/forms/referral',
        ip: getRequestIp(request),
        reason: turnstile.reason ?? 'invalid token',
        details: turnstile.errorCodes
          ? JSON.stringify({ errorCodes: turnstile.errorCodes })
          : undefined,
        submitterEmail:
          typeof referralEmail === 'string'
            ? referralEmail
            : typeof referrerEmail === 'string'
              ? referrerEmail
              : undefined,
        submitterName: typeof referrerName === 'string' ? referrerName : undefined,
      }).catch(() => {});
      return NextResponse.json(
        { success: false, message: 'Verification failed. Please try again.' },
        { status: 400 }
      );
    }

    // Submit the form
    const result = await formService.submitReferralForm({
      referrerName,
      referrerPhone,
      referrerEmail: referrerEmail || '',
      referralName,
      referralPhone,
      referralEmail: referralEmail || '',
      referralAddress,
      salesRep: salesRep || '',
      notes: notes || '',
      sourcePage: sourcePage || 'Referral Page',
    });

    // Also create a lead entry for the referred person (fire-and-forget)
    if (result.success && referralPhone) {
      const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.rivercityroofingsolutions.com';
      try {
        await fetch(`${baseUrl}/api/leads/new`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: referralName,
            email: referralEmail || '',
            phone: referralPhone,
            address: referralAddress || 'Not provided',
            source: 'referral' as const,
            sourceDetails: `Referred by ${referrerName} (${referrerPhone})${notes ? ` - ${notes}` : ''}`,
            preferredRepSlug: salesRep || undefined,
            sendNotifications: true,
            notifyTeam: true,
            // Server-side fan-in: this route already verified Turnstile.
            // Pass 'disabled' so the downstream gate short-circuits (CF
            // tokens are single-use; can't re-verify the original here).
            turnstileToken: 'disabled',
          }),
        });
      } catch (leadErr) {
        // Non-blocking: referral form succeeded even if lead creation fails
        console.warn('Referral form lead creation failed:', leadErr);
      }
    }

    return NextResponse.json(result, { status: result.success ? 200 : 500 });
  } catch (error) {
    console.error('Error processing referral form:', error);
    return NextResponse.json(
      { success: false, message: 'Something went wrong. Please call us at (256) 274-8530.' },
      { status: 500 }
    );
  }
  })
  );
}
