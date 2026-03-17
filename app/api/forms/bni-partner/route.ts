import { NextRequest, NextResponse } from 'next/server';
import { formService } from '@/lib/form-service';
import { createFormRateLimiter, withRateLimit } from '@/lib/rate-limiter';

const formRateLimiter = createFormRateLimiter();

export async function POST(request: NextRequest) {
  return withRateLimit(request, formRateLimiter, async () => {
    try {
      const body = await request.json();
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
