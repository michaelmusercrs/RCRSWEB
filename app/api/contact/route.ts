import { NextResponse } from 'next/server';
import { calculateLeadScore, formatLeadForEmail } from '@/lib/lead-tracker';

/**
 * Contact Form API Route
 * Forwards submissions to Google Apps Script for processing
 *
 * Flow:
 * 1. Validate form data
 * 2. Calculate lead score
 * 3. Forward to Google Apps Script
 * 4. Google Apps Script handles:
 *    - Saving to Google Sheet
 *    - Sending confirmation email to user
 *    - Sending notification to company
 * 5. Return success/error to frontend
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, email, phone, subject, message, preferredInspector } = body;

    // Validate required fields
    if (!name || !email || !subject || !message) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: 'Invalid email address' },
        { status: 400 }
      );
    }

    // Calculate lead quality score
    const leadScore = calculateLeadScore({
      name,
      email,
      phone,
      subject,
      message,
      preferredInspector,
      timestamp: new Date(),
    });

    // Log lead score for analytics
    console.log(`New lead: ${name} - Score: ${leadScore}/100`);

    // Get Google Apps Script endpoint from environment variables
    const googleScriptEndpoint = process.env.NEXT_PUBLIC_GOOGLE_SCRIPT_ENDPOINT;

    if (!googleScriptEndpoint) {
      console.error('NEXT_PUBLIC_GOOGLE_SCRIPT_ENDPOINT not configured');

      // Log locally for development
      console.log('Contact form submission (no endpoint configured):', {
        name,
        email,
        phone,
        subject,
        message,
        preferredInspector,
        timestamp: new Date().toISOString(),
      });

      return NextResponse.json(
        {
          success: true,
          message: 'Thank you for contacting us! We will get back to you shortly.',
          warning: 'Development mode - no email sent'
        },
        { status: 200 }
      );
    }

    // Forward to Google Apps Script
    const formData = new URLSearchParams({
      name,
      email,
      phone: phone || '',
      subject,
      message,
      preferredInspector: preferredInspector || 'First Available',
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
          message: 'Thank you for contacting us! We will get back to you shortly.',
        },
        { status: 200 }
      );
    } else {
      console.error('Google Apps Script returned error:', data);
      return NextResponse.json(
        { error: 'Failed to process your request. Please try calling us directly.' },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Error processing contact form:', error);
    return NextResponse.json(
      { error: 'Failed to process your request. Please try calling us directly.' },
      { status: 500 }
    );
  }
}
