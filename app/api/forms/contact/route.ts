import { NextRequest, NextResponse } from 'next/server';
import { formService } from '@/lib/form-service';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, email, phone, subject, message, preferredInspector, sourcePage } = body;

    // Validate required fields
    if (!name || !email || !subject || !message) {
      return NextResponse.json(
        { success: false, message: 'Please fill in all required fields.' },
        { status: 400 }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { success: false, message: 'Please enter a valid email address.' },
        { status: 400 }
      );
    }

    // Submit the form
    const result = await formService.submitContactForm({
      name,
      email,
      phone: phone || '',
      subject,
      message,
      preferredInspector: preferredInspector || 'First Available',
      sourcePage: sourcePage || 'Contact Page',
    });

    return NextResponse.json(result, { status: result.success ? 200 : 500 });
  } catch (error) {
    console.error('Error processing contact form:', error);
    return NextResponse.json(
      { success: false, message: 'Something went wrong. Please call us at (256) 274-8530.' },
      { status: 500 }
    );
  }
}
