import { NextResponse } from 'next/server';
import { apiError, getErrorMessage } from '@/lib/api-response';
import { createFormRateLimiter, withRateLimit } from '@/lib/rate-limiter';

const formRateLimiter = createFormRateLimiter();

/**
 * Referral Form API Route
 * Forwards referral submissions to Google Apps Script for processing
 */
export async function POST(request: Request) {
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
    } = body;

    // Validate required fields
    if (!referrerName || !referrerPhone || !referralName || !referralPhone || !referralAddress) {
      return apiError(
        'Missing required fields: referrerName, referrerPhone, referralName, referralPhone, and referralAddress are required',
        400,
        'VALIDATION_ERROR'
      );
    }

    // Log the referral
    // Get Google Apps Script endpoint from environment variables
    const googleScriptEndpoint = process.env.NEXT_PUBLIC_GOOGLE_SCRIPT_ENDPOINT;

    if (!googleScriptEndpoint) {
      console.error('NEXT_PUBLIC_GOOGLE_SCRIPT_ENDPOINT not configured');

      // Log locally for development

      return apiError(
        'Referral processing is temporarily unavailable. Please call us at (256) 274-8530.',
        503,
        'GOOGLE_SCRIPT_NOT_CONFIGURED'
      );
    }

    // Forward to Google Apps Script with referral type
    const formData = new URLSearchParams({
      formType: 'referral',
      sourcePage: 'Referral Rewards Page',
      referrerName,
      referrerPhone,
      referrerEmail: referrerEmail || '',
      referralName,
      referralPhone,
      referralEmail: referralEmail || '',
      referralAddress,
      salesRep: salesRep || '',
      notes: notes || '',
    });

    const response = await fetch(googleScriptEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formData.toString(),
    });

    const data = await response.json();

    if (data.result === 'success') {
      return NextResponse.json(
        {
          success: true,
          message: 'Thank you for your referral! We will contact them soon.',
        },
        { status: 200 }
      );
    } else {
      console.error('Google Apps Script returned error:', data);
      return apiError(
        'Failed to process your referral. Please try calling us directly at (256) 274-8530.',
        500,
        'GOOGLE_SCRIPT_ERROR'
      );
    }
  } catch (error) {
    console.error('Error processing referral form:', error);
    return apiError(
      'Failed to process your referral. Please try calling us directly at (256) 274-8530.',
      500,
      'REFERRAL_FORM_ERROR'
    );
  }
  });
}
