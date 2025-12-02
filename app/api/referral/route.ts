import { NextResponse } from 'next/server';

/**
 * Referral Form API Route
 * Forwards referral submissions to Google Apps Script for processing
 */
export async function POST(request: Request) {
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
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Log the referral
    console.log(`New referral from: ${referrerName} -> ${referralName}`);

    // Get Google Apps Script endpoint from environment variables
    const googleScriptEndpoint = process.env.NEXT_PUBLIC_GOOGLE_SCRIPT_ENDPOINT;

    if (!googleScriptEndpoint) {
      console.error('NEXT_PUBLIC_GOOGLE_SCRIPT_ENDPOINT not configured');

      // Log locally for development
      console.log('Referral submission (no endpoint configured):', {
        referrerName,
        referrerPhone,
        referrerEmail,
        referralName,
        referralPhone,
        referralEmail,
        referralAddress,
        salesRep,
        notes,
        timestamp: new Date().toISOString(),
      });

      return NextResponse.json(
        {
          success: true,
          message: 'Thank you for your referral! We will contact them soon.',
          warning: 'Development mode - no email sent'
        },
        { status: 200 }
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
      return NextResponse.json(
        { error: 'Failed to process your referral. Please try calling us directly.' },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Error processing referral form:', error);
    return NextResponse.json(
      { error: 'Failed to process your referral. Please try calling us directly.' },
      { status: 500 }
    );
  }
}
