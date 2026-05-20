import { NextRequest, NextResponse } from 'next/server';
import { formService } from '@/lib/form-service';
import { createFormRateLimiter, withRateLimit } from '@/lib/rate-limiter';
import { checkRequestSize } from '@/lib/request-size-limit';
import { checkForSpam } from '@/lib/spam-filter';

const formRateLimiter = createFormRateLimiter();

export async function POST(request: NextRequest) {
  // SECURITY: Enforce request body size limit on public form
  const sizeError = checkRequestSize(request, '50kb');
  if (sizeError) return sizeError;

  return withRateLimit(request, formRateLimiter, async () => {
  try {
    const body = await request.json();
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
        return NextResponse.json(
          { success: true, message: 'Thank you for your referral! We will contact them soon.' },
          { status: 200 }
        );
      }
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
  });
}
