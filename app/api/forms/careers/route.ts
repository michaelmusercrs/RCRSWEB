import { NextRequest, NextResponse } from 'next/server';
import { formService } from '@/lib/form-service';
import { groupMeService, getGroupMeConfigFromEnv } from '@/lib/groupme-service';
import {
  createCareersFormRateLimiter,
  createGlobalFormRateLimiter,
  withRateLimit,
} from '@/lib/rate-limiter-kv';
import { checkRequestSize } from '@/lib/request-size-limit';
import { emailService } from '@/lib/email-service';
import { checkForSpam } from '@/lib/spam-filter';
import { checkHoneypot } from '@/lib/honeypot';
import { verifyTurnstileToken, getRequestIp } from '@/lib/turnstile';
import { logSpamBlock } from '@/lib/spam-log';

const formRateLimiter = createCareersFormRateLimiter();
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
      console.warn('[HONEYPOT TRIGGERED route=forms/careers]', { value: hp.value });
      // Pre-destructure email/name not available yet; pull straight from body.
      const hpEmail = typeof body?.email === 'string' ? body.email : undefined;
      const hpFirst = typeof body?.firstName === 'string' ? body.firstName : '';
      const hpLast = typeof body?.lastName === 'string' ? body.lastName : '';
      const hpName = `${hpFirst} ${hpLast}`.trim() || undefined;
      logSpamBlock({
        gate: 'honeypot',
        route: '/api/forms/careers',
        ip: getRequestIp(request),
        reason: 'website field populated',
        details: JSON.stringify({ value: hp.value }),
        submitterEmail: hpEmail,
        submitterName: hpName,
      }).catch(() => {});
      return NextResponse.json(
        {
          success: true,
          message: 'Application submitted! We will contact you within 24 hours.',
        },
        { status: 200 },
      );
    }

    const { firstName, lastName, email, phone, city, experience, whyJoin } = body;

    // Validate required fields
    if (!firstName || !lastName || !email || !phone || !city || !experience || !whyJoin) {
      return NextResponse.json(
        { success: false, message: 'Please fill in all required fields.' },
        { status: 400 },
      );
    }

    // Validate email
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json(
        { success: false, message: 'Please enter a valid email address.' },
        { status: 400 },
      );
    }

    const name = `${firstName} ${lastName}`;

    // Spam filter — drop bot/outreach submissions BEFORE we sheet-write,
    // GroupMe-ping, or email Michael. Return a normal-looking success so
    // bots don't learn they were blocked.
    {
      const spamCheck = await checkForSpam({ name, email, phone, message: whyJoin });
      if (spamCheck.isSpam) {
        console.warn('[CAREERS SPAM BLOCKED]', {
          email, score: spamCheck.spamScore, reasons: spamCheck.reasons,
        });
        logSpamBlock({
          gate: 'spam-filter',
          route: '/api/forms/careers',
          ip: getRequestIp(request),
          reason: `score ${spamCheck.spamScore}`,
          details: JSON.stringify({ reasons: spamCheck.reasons }),
          submitterEmail: email,
          submitterName: name,
        }).catch(() => {});
        return NextResponse.json(
          {
            success: true,
            message: 'Application submitted! We will contact you within 24 hours.',
          },
          { status: 200 },
        );
      }
    }

    // Cloudflare Turnstile — bot fingerprint challenge. INERT until env vars
    // are set in Vercel (see lib/turnstile.ts header). Explicit 400 on
    // failure so legit users on flaky networks can retry.
    const turnstile = await verifyTurnstileToken(body.turnstileToken, getRequestIp(request));
    if (!turnstile.valid) {
      console.warn('[TURNSTILE FAILED route=forms/careers]', { reason: turnstile.reason });
      logSpamBlock({
        gate: 'turnstile',
        route: '/api/forms/careers',
        ip: getRequestIp(request),
        reason: turnstile.reason ?? 'invalid token',
        details: turnstile.errorCodes
          ? JSON.stringify({ errorCodes: turnstile.errorCodes })
          : undefined,
        submitterEmail: typeof email === 'string' ? email : undefined,
        submitterName: name,
      }).catch(() => {});
      return NextResponse.json(
        { success: false, message: 'Verification failed. Please try again.' },
        { status: 400 },
      );
    }

    // 1. Save to Google Sheets via the form service (reuse contact form pattern)
    const result = await formService.submitContactForm({
      name,
      email,
      phone,
      subject: 'Career Application',
      message: `Experience: ${experience}\nCity: ${city}\n\nWhy they want to join:\n${whyJoin}`,
      sourcePage: 'Careers Page',
      leadSource: 'Website',
      leadSourceDetail: 'Careers Application Form',
      marketingSource: 'Website - Careers Page',
    });

    // 2. Send GroupMe notification (fire-and-forget)
    try {
      const config = getGroupMeConfigFromEnv();
      if (config.enabled) {
        await groupMeService.sendNotification(config, {
          type: 'custom',
          title: '🎯 New Career Application!',
          message: `${name} from ${city} just applied to join the team!\nExperience: ${experience}\nPhone: ${phone}\nEmail: ${email}`,
          priority: 'high',
          mentionAll: false,
        });
      }
    } catch (gmErr) {
      console.warn('GroupMe notification failed for career app:', gmErr);
    }

    // 3. Email Michael about career application
    emailService.send({
      template: 'careers-application',
      to: 'michaelmuse@rcrsal.com',
      subject: `Career Application: ${name} — ${city}`,
      body: `
        <div style="font-family:Arial,sans-serif;max-width:500px;margin:0 auto;">
          <div style="background:#000;padding:16px;text-align:center;">
            <h2 style="color:#39FF14;margin:0;">New Career Application</h2>
          </div>
          <div style="padding:20px;background:#fff;">
            <table style="width:100%;border-collapse:collapse;">
              <tr><td style="padding:6px;border-bottom:1px solid #eee;font-weight:bold;">Name</td><td style="padding:6px;border-bottom:1px solid #eee;">${name}</td></tr>
              <tr><td style="padding:6px;border-bottom:1px solid #eee;font-weight:bold;">Email</td><td style="padding:6px;border-bottom:1px solid #eee;">${email}</td></tr>
              <tr><td style="padding:6px;border-bottom:1px solid #eee;font-weight:bold;">Phone</td><td style="padding:6px;border-bottom:1px solid #eee;">${phone}</td></tr>
              <tr><td style="padding:6px;border-bottom:1px solid #eee;font-weight:bold;">City</td><td style="padding:6px;border-bottom:1px solid #eee;">${city}</td></tr>
              <tr><td style="padding:6px;border-bottom:1px solid #eee;font-weight:bold;">Experience</td><td style="padding:6px;border-bottom:1px solid #eee;">${experience}</td></tr>
              <tr><td style="padding:6px;font-weight:bold;">Why Join</td><td style="padding:6px;">${whyJoin}</td></tr>
            </table>
          </div>
        </div>
      `,
      fromName: 'RCRS Careers',
    }).catch(err => console.error('[Careers] Email failed:', err));

    return NextResponse.json(
      {
        success: result.success,
        message: result.success
          ? 'Application submitted! We will contact you within 24 hours.'
          : result.message,
      },
      { status: result.success ? 200 : 500 },
    );
  } catch (error) {
    console.error('Error processing career application:', error);
    return NextResponse.json(
      { success: false, message: 'Something went wrong. Please call us at (256) 274-8530.' },
      { status: 500 },
    );
  }
  })
  );
}
