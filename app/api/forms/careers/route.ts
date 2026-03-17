import { NextRequest, NextResponse } from 'next/server';
import { formService } from '@/lib/form-service';
import { groupMeService, getGroupMeConfigFromEnv } from '@/lib/groupme-service';
import { createFormRateLimiter, withRateLimit } from '@/lib/rate-limiter';
import { checkRequestSize } from '@/lib/request-size-limit';

const formRateLimiter = createFormRateLimiter();

export async function POST(request: NextRequest) {
  // SECURITY: Enforce request body size limit on public form
  const sizeError = checkRequestSize(request, '50kb');
  if (sizeError) return sizeError;

  return withRateLimit(request, formRateLimiter, async () => {
  try {
    const body = await request.json();
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
  });
}
