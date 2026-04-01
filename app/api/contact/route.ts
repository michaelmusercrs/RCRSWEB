import { NextRequest, NextResponse } from 'next/server';
import { calculateLeadScore } from '@/lib/lead-tracker';
import { groupMeService, getGroupMeConfigFromEnv } from '@/lib/groupme-service';
import { portalGenerator } from '@/lib/portal-generator';
import { leadPortalService } from '@/lib/lead-portal-service';
import { apiError } from '@/lib/api-response';
import { createFormRateLimiter, withRateLimit } from '@/lib/rate-limiter';
import { emailService } from '@/lib/email-service';

const contactRateLimiter = createFormRateLimiter();

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
export async function POST(request: NextRequest) {
  return withRateLimit(request, contactRateLimiter, async () => {
  try {
    const body = await request.json();
    const { name, email, phone, subject, message, preferredInspector, serviceType, serviceArea, city, sourcePage } = body;

    // Validate required fields
    if (!name || !email || !subject || !message) {
      return apiError('Missing required fields: name, email, subject, and message are required', 400, 'VALIDATION_ERROR');
    }

    // SECURITY: Validate input lengths to prevent abuse
    if (name.length > 200 || email.length > 254 || subject.length > 500 || message.length > 5000) {
      return apiError('One or more fields exceed maximum length', 400, 'VALIDATION_ERROR');
    }
    if (phone && phone.length > 50) {
      return apiError('Phone number too long', 400, 'VALIDATION_ERROR');
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return apiError('Invalid email address', 400, 'INVALID_EMAIL');
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
    // Get Google Apps Script endpoint from environment variables
    const googleScriptEndpoint = process.env.NEXT_PUBLIC_GOOGLE_SCRIPT_ENDPOINT;

    if (!googleScriptEndpoint) {
      console.error('NEXT_PUBLIC_GOOGLE_SCRIPT_ENDPOINT not configured');

      // Log locally for development

      // Still send GroupMe notification even in dev mode
      try {
        const groupMeConfig = getGroupMeConfigFromEnv();
        if (groupMeConfig.enabled && groupMeConfig.botId) {
          const notification = groupMeService.createNewLeadNotification({
            name,
            email,
            phone,
            source: sourcePage || 'Contact Page',
            subject,
            message,
          });
          await groupMeService.sendNotification(groupMeConfig, notification);
        }
      } catch (groupMeError) {
        console.error('Failed to send GroupMe notification:', groupMeError);
      }

      return apiError(
        'Contact form processing is temporarily unavailable. Please call us at (256) 274-8530.',
        503,
        'GOOGLE_SCRIPT_NOT_CONFIGURED'
      );
    }

    // Forward to Google Apps Script
    const formData = new URLSearchParams({
      formType: 'contact',
      sourcePage: sourcePage || 'Contact Page',
      name,
      email,
      phone: phone || '',
      subject,
      message,
      preferredInspector: preferredInspector || 'First Available',
      serviceType: serviceType || '',
      serviceArea: serviceArea || '',
      city: city || '',
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
      // Auto-generate customer portal for new leads
      let portalData = null;
      try {
        // Check if we have enough info to generate a portal
        if (phone && (serviceArea || city)) {
          const address = [serviceArea, city, 'AL'].filter(Boolean).join(', ');

          const portalResult = await portalGenerator.generatePortalForLead({
            name,
            email,
            phone,
            address,
            source: 'contact_form',
            sourceDetails: sourcePage || 'Contact Page',
            preferredRepSlug: preferredInspector && preferredInspector !== 'First Available'
              ? preferredInspector.toLowerCase().replace(/\s+/g, '-')
              : undefined,
            serviceType,
            message,
          });

          if (portalResult.success && portalResult.portalAccess) {
            // Store the lead in our system
            await leadPortalService.createLead({
              portalAccess: portalResult.portalAccess,
              shortCode: portalResult.shortCode!,
              source: 'contact_form',
              sourceDetails: sourcePage || 'Contact Page',
              serviceType,
              message,
            });

            portalData = {
              portalUrl: portalResult.portalUrl,
              salesRepName: portalResult.salesRep?.name,
            };
          }
        }
      } catch (portalError) {
        // Don't fail the request if portal generation fails
        console.error('Failed to auto-generate portal:', portalError);
      }

      // Send GroupMe notification for new lead
      try {
        const groupMeConfig = getGroupMeConfigFromEnv();
        if (groupMeConfig.enabled && groupMeConfig.botId) {
          const notification = groupMeService.createNewLeadNotification({
            name,
            email,
            phone,
            source: sourcePage || 'Contact Page',
            subject,
            message,
          });
          await groupMeService.sendNotification(groupMeConfig, notification);
        }
      } catch (groupMeError) {
        console.error('Failed to send GroupMe notification:', groupMeError);
      }

      // Email notification to Michael + office for every website lead
      emailService.send({
        to: 'michaelmuse@rcrsal.com',
        cc: 'sara@rcrsal.com,tia@rcrsal.com',
        subject: `Website Lead: ${name} — ${subject}`,
        body: `
          <div style="font-family:Arial,sans-serif;max-width:500px;margin:0 auto;">
            <div style="background:#000;padding:16px;text-align:center;">
              <h2 style="color:#39FF14;margin:0;">New Website Lead</h2>
            </div>
            <div style="padding:20px;background:#fff;">
              <table style="width:100%;border-collapse:collapse;">
                <tr><td style="padding:6px;border-bottom:1px solid #eee;font-weight:bold;">Name</td><td style="padding:6px;border-bottom:1px solid #eee;">${name}</td></tr>
                <tr><td style="padding:6px;border-bottom:1px solid #eee;font-weight:bold;">Email</td><td style="padding:6px;border-bottom:1px solid #eee;">${email}</td></tr>
                <tr><td style="padding:6px;border-bottom:1px solid #eee;font-weight:bold;">Phone</td><td style="padding:6px;border-bottom:1px solid #eee;">${phone || 'Not provided'}</td></tr>
                <tr><td style="padding:6px;border-bottom:1px solid #eee;font-weight:bold;">Subject</td><td style="padding:6px;border-bottom:1px solid #eee;">${subject}</td></tr>
                <tr><td style="padding:6px;border-bottom:1px solid #eee;font-weight:bold;">Source</td><td style="padding:6px;border-bottom:1px solid #eee;">${sourcePage || 'Contact Page'}</td></tr>
                <tr><td style="padding:6px;font-weight:bold;">Message</td><td style="padding:6px;">${message}</td></tr>
              </table>
              ${portalData ? `<p style="margin-top:12px;"><a href="${portalData.portalUrl}">View Customer Portal</a></p>` : ''}
            </div>
          </div>
        `,
        fromName: 'RCRS Website',
      }).catch(err => console.error('[Contact] Email notification failed:', err));

      return NextResponse.json(
        {
          success: true,
          message: 'Thank you for contacting us! We will get back to you shortly.',
          portalGenerated: portalData !== null,
          ...(portalData && { portal: portalData }),
        },
        { status: 200 }
      );
    } else {
      console.error('Google Apps Script returned error:', data);
      return apiError(
        'Failed to process your request. Please try calling us directly at (256) 274-8530.',
        500,
        'GOOGLE_SCRIPT_ERROR'
      );
    }
  } catch (error) {
    console.error('Error processing contact form:', error);
    return apiError(
      'Failed to process your request. Please try calling us directly at (256) 274-8530.',
      500,
      'CONTACT_FORM_ERROR'
    );
  }
  }); // end withRateLimit
}
