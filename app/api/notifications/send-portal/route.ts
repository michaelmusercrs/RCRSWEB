// Send Portal Notification API Route
// Sends portal links to customers via email and/or SMS

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-service';
import { leadPortalService } from '@/lib/lead-portal-service';
import { portalGenerator } from '@/lib/portal-generator';
import { teamMembers } from '@/lib/teamData';

interface SendPortalRequest {
  // Identifier - one of these required
  leadId?: string;
  customerId?: string;
  accessToken?: string;
  email?: string;

  // Notification options
  sendEmail?: boolean;
  sendSms?: boolean;

  // Template selection
  template?: 'intro' | 'portal_invite' | 'combined' | 'custom';
  customSubject?: string;
  customMessage?: string;

  // Override recipient (for testing)
  overrideEmail?: string;
  overridePhone?: string;
}

interface NotificationResult {
  email?: {
    sent: boolean;
    error?: string;
  };
  sms?: {
    sent: boolean;
    error?: string;
  };
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth();
  if (!auth.authenticated) return auth.response;

  try {
    const body: SendPortalRequest = await request.json();

    // Find the lead
    let lead = null;

    if (body.leadId) {
      const leads = await leadPortalService.getLeads({ limit: 1000 });
      lead = leads.find(l => l.leadId === body.leadId);
    } else if (body.customerId) {
      lead = await leadPortalService.getLeadByCustomerId(body.customerId);
    } else if (body.accessToken) {
      lead = await leadPortalService.getLeadByToken(body.accessToken);
    } else if (body.email) {
      lead = await leadPortalService.getLeadByEmail(body.email);
    } else {
      return NextResponse.json(
        {
          success: false,
          error: 'Must provide leadId, customerId, accessToken, or email',
        },
        { status: 400 }
      );
    }

    if (!lead) {
      return NextResponse.json(
        { success: false, error: 'Lead not found' },
        { status: 404 }
      );
    }

    // Get sales rep info
    const salesRep = teamMembers.find(m => m.slug === lead.salesRepSlug);
    if (!salesRep) {
      return NextResponse.json(
        { success: false, error: 'Sales rep not found' },
        { status: 500 }
      );
    }

    // Build portal access object for templates
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://rivercityroofingsolutions.com';
    const portalAccess = {
      accessToken: lead.accessToken,
      customerId: lead.customerId,
      customerName: lead.customerName,
      customerEmail: lead.customerEmail,
      customerPhone: lead.customerPhone,
      customerAddress: lead.customerAddress,
      salesRepId: lead.salesRepId,
      salesRepName: lead.salesRepName,
      salesRepSlug: lead.salesRepSlug,
      createdAt: lead.createdAt,
      isActive: true,
    };

    // Get templates
    const smsTemplates = portalGenerator.getSmsTemplates(portalAccess, salesRep);
    const emailTemplates = portalGenerator.getEmailTemplates(portalAccess, salesRep);

    const result: NotificationResult = {};
    const template = body.template || 'portal_invite';

    // Determine recipients
    const emailRecipient = body.overrideEmail || lead.customerEmail;
    const smsRecipient = body.overridePhone || lead.customerPhone;

    // Send email if requested
    if (body.sendEmail !== false && emailRecipient) {
      try {
        let emailContent;
        let emailSubject;

        if (body.customMessage && body.customSubject) {
          emailSubject = body.customSubject;
          emailContent = body.customMessage;
        } else if (template === 'intro') {
          emailSubject = emailTemplates.intro.subject;
          emailContent = emailTemplates.intro.html;
        } else {
          emailSubject = emailTemplates.portalInvite.subject;
          emailContent = emailTemplates.portalInvite.html;
        }

        // Use Google Apps Script endpoint for sending emails
        const googleScriptEndpoint = process.env.NEXT_PUBLIC_GOOGLE_SCRIPT_ENDPOINT;

        if (googleScriptEndpoint) {
          const formData = new URLSearchParams({
            formType: 'portal_notification',
            recipientEmail: emailRecipient,
            recipientName: lead.customerName,
            subject: emailSubject,
            htmlBody: emailContent,
            salesRepName: salesRep.name,
            salesRepEmail: salesRep.email,
            portalUrl: `${baseUrl}/my/${lead.accessToken}`,
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
            result.email = { sent: true };

            // Record notification sent
            const notificationType = template === 'intro' ? 'intro_email' : 'portal_email';
            await leadPortalService.recordNotificationSent(lead.leadId, notificationType);
          } else {
            result.email = { sent: false, error: data.error || 'Email sending failed' };
          }
        } else {
          // Log email content for development
          console.log('Email notification (endpoint not configured):', {
            to: emailRecipient,
            subject: emailSubject,
            template,
          });

          result.email = { sent: false, error: 'Email endpoint not configured (development mode)' };
        }
      } catch (error) {
        console.error('Error sending email:', error);
        result.email = { sent: false, error: error instanceof Error ? error.message : 'Unknown error' };
      }
    }

    // Send SMS if requested
    if (body.sendSms && smsRecipient) {
      try {
        let smsContent;

        if (body.customMessage) {
          smsContent = body.customMessage;
        } else if (template === 'intro') {
          smsContent = smsTemplates.intro;
        } else if (template === 'combined') {
          smsContent = smsTemplates.combined;
        } else {
          smsContent = smsTemplates.portalInvite;
        }

        // Format phone for E.164
        const formattedPhone = portalGenerator.formatPhoneE164(smsRecipient);

        // Use Twilio or Google Voice for SMS
        // For now, we'll use Google Apps Script if available
        const googleScriptEndpoint = process.env.NEXT_PUBLIC_GOOGLE_SCRIPT_ENDPOINT;

        if (googleScriptEndpoint) {
          const formData = new URLSearchParams({
            formType: 'sms_notification',
            recipientPhone: formattedPhone,
            recipientName: lead.customerName,
            message: smsContent,
            salesRepName: salesRep.name,
            salesRepPhone: salesRep.phone,
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
            result.sms = { sent: true };

            // Record notification sent
            const notificationType = template === 'intro' ? 'intro_sms' : 'portal_sms';
            await leadPortalService.recordNotificationSent(lead.leadId, notificationType);
          } else {
            result.sms = { sent: false, error: data.error || 'SMS sending failed' };
          }
        } else {
          // Log SMS content for development
          console.log('SMS notification (endpoint not configured):', {
            to: formattedPhone,
            message: smsContent,
          });

          result.sms = { sent: false, error: 'SMS endpoint not configured (development mode)' };
        }
      } catch (error) {
        console.error('Error sending SMS:', error);
        result.sms = { sent: false, error: error instanceof Error ? error.message : 'Unknown error' };
      }
    }

    // Determine overall success
    const anySuccess = result.email?.sent || result.sms?.sent;
    const anyRequested = body.sendEmail || body.sendSms;

    return NextResponse.json({
      success: anySuccess || !anyRequested,
      data: {
        leadId: lead.leadId,
        customerId: lead.customerId,
        notifications: result,
        portalUrl: `${baseUrl}/my/${lead.accessToken}`,
        salesRep: {
          name: salesRep.name,
          phone: salesRep.phone,
          email: salesRep.email,
        },
      },
    });

  } catch (error) {
    console.error('Error sending portal notification:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
      },
      { status: 500 }
    );
  }
}

// GET - Preview notification templates
export async function GET(request: NextRequest) {
  const auth = await requireAuth();
  if (!auth.authenticated) return auth.response;

  try {
    const { searchParams } = new URL(request.url);
    const leadId = searchParams.get('leadId');
    const accessToken = searchParams.get('token');
    const email = searchParams.get('email');
    const template = searchParams.get('template') || 'portal_invite';

    // Find the lead
    let lead = null;

    if (leadId) {
      const leads = await leadPortalService.getLeads({ limit: 1000 });
      lead = leads.find(l => l.leadId === leadId);
    } else if (accessToken) {
      lead = await leadPortalService.getLeadByToken(accessToken);
    } else if (email) {
      lead = await leadPortalService.getLeadByEmail(email);
    } else {
      return NextResponse.json(
        {
          success: false,
          error: 'Must provide leadId, token, or email parameter',
        },
        { status: 400 }
      );
    }

    if (!lead) {
      return NextResponse.json(
        { success: false, error: 'Lead not found' },
        { status: 404 }
      );
    }

    // Get sales rep info
    const salesRep = teamMembers.find(m => m.slug === lead.salesRepSlug);
    if (!salesRep) {
      return NextResponse.json(
        { success: false, error: 'Sales rep not found' },
        { status: 500 }
      );
    }

    // Build portal access object
    const portalAccess = {
      accessToken: lead.accessToken,
      customerId: lead.customerId,
      customerName: lead.customerName,
      customerEmail: lead.customerEmail,
      customerPhone: lead.customerPhone,
      customerAddress: lead.customerAddress,
      salesRepId: lead.salesRepId,
      salesRepName: lead.salesRepName,
      salesRepSlug: lead.salesRepSlug,
      createdAt: lead.createdAt,
      isActive: true,
    };

    // Get templates
    const smsTemplates = portalGenerator.getSmsTemplates(portalAccess, salesRep);
    const emailTemplates = portalGenerator.getEmailTemplates(portalAccess, salesRep);

    return NextResponse.json({
      success: true,
      data: {
        lead: {
          leadId: lead.leadId,
          customerName: lead.customerName,
          customerEmail: lead.customerEmail,
          customerPhone: lead.customerPhone,
        },
        salesRep: {
          name: salesRep.name,
          phone: salesRep.phone,
          email: salesRep.email,
        },
        templates: {
          sms: smsTemplates,
          email: {
            intro: {
              subject: emailTemplates.intro.subject,
              preview: `HTML email introducing ${salesRep.name}`,
            },
            portalInvite: {
              subject: emailTemplates.portalInvite.subject,
              preview: 'HTML email with portal access link and QR code',
            },
          },
        },
        notificationStatus: {
          introEmailSent: lead.introEmailSent,
          introEmailSentAt: lead.introEmailSentAt,
          portalEmailSent: lead.portalEmailSent,
          portalEmailSentAt: lead.portalEmailSentAt,
          introSmsSent: lead.introSmsSent,
          introSmsSentAt: lead.introSmsSentAt,
          portalSmsSent: lead.portalSmsSent,
          portalSmsSentAt: lead.portalSmsSentAt,
        },
      },
    });

  } catch (error) {
    console.error('Error getting notification templates:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
      },
      { status: 500 }
    );
  }
}
