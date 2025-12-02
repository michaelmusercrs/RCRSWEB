import { NextRequest, NextResponse } from 'next/server';
import { formService } from '@/lib/form-service';

export async function POST(request: NextRequest) {
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

    return NextResponse.json(result, { status: result.success ? 200 : 500 });
  } catch (error) {
    console.error('Error processing referral form:', error);
    return NextResponse.json(
      { success: false, message: 'Something went wrong. Please call us at (256) 274-8530.' },
      { status: 500 }
    );
  }
}
