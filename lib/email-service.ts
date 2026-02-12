// Email Service - Consolidated through Gmail / Google Apps Script
// ALL email sending goes through the Google Apps Script endpoint
// No SendGrid, no Mailgun - just Google Workspace
//
// Supports:
// - Portal link emails to customers
// - Delivery notifications
// - Lead assignment notifications to reps
// - Status update emails
// - Gmail+ alias automation (e.g., richard+orders@rivercityroofingsolutions.com)

export interface EmailOptions {
  to: string;
  subject: string;
  body: string; // HTML body
  replyTo?: string;
  cc?: string;
  bcc?: string;
  fromName?: string;
}

class EmailService {
  private endpoint: string;

  constructor() {
    this.endpoint = process.env.NEXT_PUBLIC_GOOGLE_SCRIPT_ENDPOINT || '';
  }

  // Send email via Google Apps Script
  async send(options: EmailOptions): Promise<{ success: boolean; error?: string }> {
    if (!this.endpoint) {
      console.error('Email: Google Apps Script endpoint not configured');
      return { success: false, error: 'Email endpoint not configured' };
    }

    try {
      const response = await fetch(this.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          formType: 'email_notification',
          to: options.to,
          subject: options.subject,
          body: options.body,
          ...(options.replyTo && { replyTo: options.replyTo }),
          ...(options.cc && { cc: options.cc }),
          ...(options.bcc && { bcc: options.bcc }),
          ...(options.fromName && { fromName: options.fromName }),
        }).toString(),
      });

      if (!response.ok) {
        return { success: false, error: `HTTP ${response.status}` };
      }

      return { success: true };
    } catch (error) {
      console.error('Email send failed:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  // ========================================
  // CONVENIENCE METHODS
  // ========================================

  // Send customer portal link
  async sendPortalLink(data: {
    customerEmail: string;
    customerName: string;
    portalUrl: string;
    repName: string;
    repEmail: string;
    repPhone: string;
    stormReportIncluded?: boolean;
  }): Promise<{ success: boolean; error?: string }> {
    const subject = `Your River City Roofing Project Portal`;
    const body = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #000; padding: 20px; text-align: center;">
          <h1 style="color: #39FF14; margin: 0;">River City Roofing Solutions</h1>
        </div>
        <div style="padding: 30px; background: #fff;">
          <p>Hi ${data.customerName},</p>
          <p>Thank you for contacting River City Roofing Solutions! Your personal project portal is ready.</p>
          ${data.stormReportIncluded ? '<p><strong>Your storm damage report is included in your portal.</strong></p>' : ''}
          <div style="text-align: center; margin: 30px 0;">
            <a href="${data.portalUrl}" style="background: #39FF14; color: #000; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px;">
              View Your Portal
            </a>
          </div>
          <p>Your assigned representative is <strong>${data.repName}</strong>.</p>
          <p>
            📞 ${data.repPhone}<br>
            📧 ${data.repEmail}
          </p>
          <p>Feel free to reach out anytime with questions!</p>
        </div>
        <div style="background: #f5f5f5; padding: 15px; text-align: center; font-size: 12px; color: #666;">
          River City Roofing Solutions | (256) 274-8530 | rivercityroofingsolutions.com
        </div>
      </div>
    `;

    return this.send({
      to: data.customerEmail,
      subject,
      body,
      replyTo: data.repEmail,
      fromName: 'River City Roofing Solutions',
    });
  }

  // Notify rep of new lead assignment
  async sendLeadAssignment(data: {
    repEmail: string;
    repName: string;
    leadName: string;
    leadPhone: string;
    leadEmail: string;
    leadAddress: string;
    source: string;
    riskScore?: number;
    portalUrl?: string;
  }): Promise<{ success: boolean; error?: string }> {
    const subject = `New Lead Assigned: ${data.leadName}`;
    const body = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #000; padding: 20px; text-align: center;">
          <h1 style="color: #39FF14; margin: 0;">New Lead Assignment</h1>
        </div>
        <div style="padding: 30px; background: #fff;">
          <p>Hi ${data.repName},</p>
          <p>A new lead has been assigned to you. <strong>Please respond within 5 minutes.</strong></p>
          <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
            <tr><td style="padding: 8px; border-bottom: 1px solid #eee; font-weight: bold;">Name</td><td style="padding: 8px; border-bottom: 1px solid #eee;">${data.leadName}</td></tr>
            <tr><td style="padding: 8px; border-bottom: 1px solid #eee; font-weight: bold;">Phone</td><td style="padding: 8px; border-bottom: 1px solid #eee;"><a href="tel:${data.leadPhone}">${data.leadPhone}</a></td></tr>
            <tr><td style="padding: 8px; border-bottom: 1px solid #eee; font-weight: bold;">Email</td><td style="padding: 8px; border-bottom: 1px solid #eee;"><a href="mailto:${data.leadEmail}">${data.leadEmail}</a></td></tr>
            <tr><td style="padding: 8px; border-bottom: 1px solid #eee; font-weight: bold;">Address</td><td style="padding: 8px; border-bottom: 1px solid #eee;">${data.leadAddress}</td></tr>
            <tr><td style="padding: 8px; border-bottom: 1px solid #eee; font-weight: bold;">Source</td><td style="padding: 8px; border-bottom: 1px solid #eee;">${data.source}</td></tr>
            ${data.riskScore ? `<tr><td style="padding: 8px; border-bottom: 1px solid #eee; font-weight: bold;">Storm Risk</td><td style="padding: 8px; border-bottom: 1px solid #eee;">${data.riskScore}/100</td></tr>` : ''}
          </table>
          ${data.portalUrl ? `<p><a href="${data.portalUrl}">View Customer Portal</a></p>` : ''}
        </div>
      </div>
    `;

    return this.send({
      to: data.repEmail,
      subject,
      body,
      fromName: 'RCRS Lead Distribution',
    });
  }

  // Send delivery order email (triggers Gmail+ automation)
  async sendDeliveryOrder(data: {
    driverEmail: string; // e.g., richard+orders@rivercityroofingsolutions.com
    ticketId: string;
    customerName: string;
    address: string;
    items: string[];
    deliveryDate: string;
    notes?: string;
  }): Promise<{ success: boolean; error?: string }> {
    const subject = `Delivery Order: ${data.ticketId} - ${data.customerName}`;
    const body = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #000; padding: 20px; text-align: center;">
          <h1 style="color: #39FF14; margin: 0;">Delivery Order</h1>
        </div>
        <div style="padding: 30px; background: #fff;">
          <h2>Ticket: ${data.ticketId}</h2>
          <p><strong>Customer:</strong> ${data.customerName}</p>
          <p><strong>Address:</strong> ${data.address}</p>
          <p><strong>Date:</strong> ${data.deliveryDate}</p>
          <h3>Items:</h3>
          <ul>
            ${data.items.map(item => `<li>${item}</li>`).join('\n')}
          </ul>
          ${data.notes ? `<p><strong>Notes:</strong> ${data.notes}</p>` : ''}
          <p style="margin-top: 20px;"><a href="https://maps.google.com/?q=${encodeURIComponent(data.address)}" style="background: #0066CC; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Get Directions</a></p>
        </div>
      </div>
    `;

    return this.send({
      to: data.driverEmail,
      subject,
      body,
      fromName: 'RCRS Dispatch',
    });
  }

  // Send delivery reminder to customer via email
  async sendDeliveryReminderEmail(data: {
    customerEmail: string;
    customerName: string;
    deliveryDate: string;
    timeWindow?: string;
    address: string;
  }): Promise<{ success: boolean; error?: string }> {
    const subject = `Delivery Scheduled - River City Roofing`;
    const body = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #000; padding: 20px; text-align: center;">
          <h1 style="color: #39FF14; margin: 0;">Delivery Reminder</h1>
        </div>
        <div style="padding: 30px; background: #fff;">
          <p>Hi ${data.customerName},</p>
          <p>Your material delivery from River City Roofing Solutions is scheduled for:</p>
          <div style="background: #f8f8f8; padding: 20px; border-radius: 8px; margin: 20px 0; text-align: center;">
            <p style="font-size: 24px; font-weight: bold; margin: 0;">${data.deliveryDate}</p>
            ${data.timeWindow ? `<p style="color: #666; margin: 5px 0 0 0;">${data.timeWindow}</p>` : ''}
          </div>
          <p><strong>Delivery Address:</strong> ${data.address}</p>
          <p>Please ensure the delivery area is accessible and clear of vehicles/obstacles.</p>
          <p>Questions? Call us at <a href="tel:+12562748530">(256) 274-8530</a>.</p>
        </div>
        <div style="background: #f5f5f5; padding: 15px; text-align: center; font-size: 12px; color: #666;">
          River City Roofing Solutions | (256) 274-8530 | rivercityroofingsolutions.com
        </div>
      </div>
    `;

    return this.send({
      to: data.customerEmail,
      subject,
      body,
      fromName: 'River City Roofing Solutions',
    });
  }

  // Check if email is configured
  isConfigured(): boolean {
    return !!this.endpoint;
  }
}

export const emailService = new EmailService();
export default emailService;
