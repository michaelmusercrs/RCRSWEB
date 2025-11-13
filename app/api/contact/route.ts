import { NextResponse } from 'next/server';

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

    // Here you would typically:
    // 1. Send an email notification to the company
    // 2. Store the submission in a database
    // 3. Send a confirmation email to the customer
    // 4. Integrate with a CRM or notification system

    // For now, we'll just log it and return success
    console.log('Contact form submission:', {
      name,
      email,
      phone,
      subject,
      message,
      preferredInspector,
      timestamp: new Date().toISOString(),
    });

    // You could integrate with services like:
    // - Resend for email notifications
    // - SendGrid for email
    // - Twilio for SMS notifications
    // - Airtable or Google Sheets for storage
    // - Zapier for workflow automation

    return NextResponse.json(
      {
        success: true,
        message: 'Thank you for contacting us! We will get back to you shortly.',
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error processing contact form:', error);
    return NextResponse.json(
      { error: 'Failed to process your request' },
      { status: 500 }
    );
  }
}
