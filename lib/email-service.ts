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
    // Sandbox mode: log instead of sending
    if (process.env.SANDBOX_MODE === 'true' || process.env.VERCEL_GIT_COMMIT_REF === 'sandbox') {
      console.log('[SANDBOX] Email intercepted:', { to: options.to, subject: options.subject });
      return { success: true };
    }

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

  // Send delivery order email (triggers Gmail+ automation).
  // driverEmail is optional — if omitted, the order goes to stock@rcrsal.com.
  // That inbox is the single home for all inventory / stock / material-order
  // emails and must never be used for anything else. Default can be overridden
  // via the DEFAULT_DELIVERY_ORDER_EMAIL env var.
  // CRITICAL: items must contain only "qty unit name" strings — never include
  // cost, price, or any dollar value. The work order PDF physically rides out
  // with the truck and could be left at a job site.
  async sendDeliveryOrder(data: {
    driverEmail?: string;
    ticketId: string;
    customerName: string;
    address: string;
    items: string[];
    deliveryDate: string;
    notes?: string;
  }): Promise<{ success: boolean; error?: string }> {
    const recipient =
      data.driverEmail ||
      process.env.DEFAULT_DELIVERY_ORDER_EMAIL ||
      'stock@rcrsal.com';

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
      to: recipient,
      subject,
      body,
      fromName: 'RCRS Dispatch',
    });
  }

  // Notify office (Sara + anyone copied) when a new material order ticket
  // is created. Office-side notification — INCLUDES cost / total because
  // Sara handles invoicing and accounting. This email NEVER goes to a
  // customer or sales rep.
  async sendOfficeMaterialOrderNotification(data: {
    officeEmail?: string;
    ticketId: string;
    ticketType: 'delivery' | 'return';
    jobNumber: string;
    customerName: string;
    address: string;
    salesRepName: string;
    materials: Array<{ name: string; qty: number; unit?: string; lineCost: number; linePrice: number }>;
    totalCost: number;
    totalPrice: number;
    interofficeInvoiceId: string;
    notes?: string;
  }): Promise<{ success: boolean; error?: string }> {
    // Default to Sara per the team-roles.ts entry
    const recipient = data.officeEmail || process.env.OFFICE_NOTIFY_EMAIL || 'sara@rcrsal.com';

    const isReturn = data.ticketType === 'return';
    const subject = isReturn
      ? `Credit Memo: ${data.ticketId} — ${data.jobNumber} ${data.customerName}`
      : `New Material Order: ${data.ticketId} — ${data.jobNumber} ${data.customerName}`;

    const fmt = (n: number) => `$${n.toFixed(2)}`;
    const tableRows = data.materials.map(m => `
      <tr>
        <td style="padding: 6px 8px; border-bottom: 1px solid #eee;">${m.qty} ${m.unit || ''} ${m.name}</td>
        <td style="padding: 6px 8px; border-bottom: 1px solid #eee; text-align: right;">${fmt(m.lineCost)}</td>
        <td style="padding: 6px 8px; border-bottom: 1px solid #eee; text-align: right;">${fmt(m.linePrice)}</td>
      </tr>
    `).join('');

    const body = `
      <div style="font-family: Arial, sans-serif; max-width: 700px; margin: 0 auto;">
        <div style="background: #000; padding: 20px; text-align: center;">
          <h1 style="color: #39FF14; margin: 0;">${isReturn ? 'Credit Memo' : 'New Material Order'}</h1>
        </div>
        <div style="padding: 30px; background: #fff;">
          <p style="font-size: 14px; color: #555;">
            ${isReturn
              ? 'Materials returned from job to warehouse. Credit memo posted to the job material cost ledger.'
              : 'Materials issued from warehouse to job. Interoffice invoice posted to the job material cost ledger.'}
          </p>
          <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
            <tr><td style="padding: 4px 8px;"><strong>Ticket:</strong></td><td style="padding: 4px 8px;">${data.ticketId}</td></tr>
            <tr><td style="padding: 4px 8px;"><strong>Interoffice Invoice:</strong></td><td style="padding: 4px 8px;">${data.interofficeInvoiceId}</td></tr>
            <tr><td style="padding: 4px 8px;"><strong>Job:</strong></td><td style="padding: 4px 8px;">${data.jobNumber} — ${data.customerName}</td></tr>
            <tr><td style="padding: 4px 8px;"><strong>Address:</strong></td><td style="padding: 4px 8px;">${data.address}</td></tr>
            <tr><td style="padding: 4px 8px;"><strong>Sales Rep:</strong></td><td style="padding: 4px 8px;">${data.salesRepName || '—'}</td></tr>
          </table>

          <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
            <thead>
              <tr style="background: #f5f5f5;">
                <th style="padding: 8px; text-align: left;">Item</th>
                <th style="padding: 8px; text-align: right;">Cost</th>
                <th style="padding: 8px; text-align: right;">Price</th>
              </tr>
            </thead>
            <tbody>${tableRows}</tbody>
            <tfoot>
              <tr style="font-weight: bold; background: #f5f5f5;">
                <td style="padding: 8px;">TOTAL</td>
                <td style="padding: 8px; text-align: right;">${fmt(data.totalCost)}</td>
                <td style="padding: 8px; text-align: right;">${fmt(data.totalPrice)}</td>
              </tr>
            </tfoot>
          </table>

          ${data.notes ? `<div style="background: #fffbe6; border-left: 3px solid #f0ad4e; padding: 12px; margin: 16px 0;"><strong>Special Instructions:</strong><br>${data.notes.replace(/\n/g, '<br>')}</div>` : ''}

          <p style="font-size: 12px; color: #888; margin-top: 20px;">
            This notification is INTERNAL ONLY. Do not forward to customer or sales rep.
            The interoffice invoice records cost-side material consumption for job profitability.
          </p>
        </div>
      </div>
    `;

    return this.send({
      to: recipient,
      subject,
      body,
      fromName: 'RCRS Inventory',
    });
  }

  // Notify Sara about a vendor return — Rick picked up materials from a
  // job that came from an outside supplier (SRS, ABC, etc.). Sara needs to
  // chase the vendor credit and post it against the job. INTERNAL ONLY —
  // never goes to customer or sales rep.
  async sendVendorReturnNotification(data: {
    officeEmail?: string;
    vendorReturnId: string;
    jobNumber: string;
    customerName: string;
    pickupAddress: string;
    vendorName: string;
    vendorReceiptNumber?: string;
    pickedUpByName: string;
    lines: Array<{ description: string; quantity: number; unit?: string; estimatedValue?: number }>;
    estimatedTotalValue: number;
    notes?: string;
    photoUrl?: string;
  }): Promise<{ success: boolean; error?: string }> {
    const recipient = data.officeEmail || process.env.OFFICE_NOTIFY_EMAIL || 'sara@rcrsal.com';

    const subject = `Vendor Return: ${data.vendorName} — ${data.jobNumber} ${data.customerName}`;

    const fmt = (n: number) => `$${n.toFixed(2)}`;
    const tableRows = data.lines.map(l => `
      <tr>
        <td style="padding: 6px 8px; border-bottom: 1px solid #eee;">${l.quantity} ${l.unit || ''} ${l.description}</td>
        <td style="padding: 6px 8px; border-bottom: 1px solid #eee; text-align: right;">${l.estimatedValue ? fmt(l.estimatedValue) : '—'}</td>
      </tr>
    `).join('');

    const body = `
      <div style="font-family: Arial, sans-serif; max-width: 700px; margin: 0 auto;">
        <div style="background: #000; padding: 20px; text-align: center;">
          <h1 style="color: #39FF14; margin: 0;">Vendor Return — Action Needed</h1>
        </div>
        <div style="padding: 30px; background: #fff;">
          <p style="font-size: 14px; color: #555;">
            Materials were picked up from a job site that came from an outside vendor.
            These items are NOT in our inventory catalog. Please chase the credit from
            <strong>${data.vendorName}</strong> and post it against job <strong>${data.jobNumber}</strong>.
          </p>

          <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
            <tr><td style="padding: 4px 8px;"><strong>Vendor Return:</strong></td><td style="padding: 4px 8px;">${data.vendorReturnId}</td></tr>
            <tr><td style="padding: 4px 8px;"><strong>Job:</strong></td><td style="padding: 4px 8px;">${data.jobNumber} — ${data.customerName}</td></tr>
            <tr><td style="padding: 4px 8px;"><strong>Pickup Address:</strong></td><td style="padding: 4px 8px;">${data.pickupAddress}</td></tr>
            <tr><td style="padding: 4px 8px;"><strong>Vendor:</strong></td><td style="padding: 4px 8px;">${data.vendorName}</td></tr>
            ${data.vendorReceiptNumber ? `<tr><td style="padding: 4px 8px;"><strong>Receipt #:</strong></td><td style="padding: 4px 8px;">${data.vendorReceiptNumber}</td></tr>` : ''}
            <tr><td style="padding: 4px 8px;"><strong>Picked up by:</strong></td><td style="padding: 4px 8px;">${data.pickedUpByName}</td></tr>
          </table>

          <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
            <thead>
              <tr style="background: #f5f5f5;">
                <th style="padding: 8px; text-align: left;">Item</th>
                <th style="padding: 8px; text-align: right;">Est. Credit</th>
              </tr>
            </thead>
            <tbody>${tableRows}</tbody>
            <tfoot>
              <tr style="font-weight: bold; background: #f5f5f5;">
                <td style="padding: 8px;">ESTIMATED TOTAL</td>
                <td style="padding: 8px; text-align: right;">${fmt(data.estimatedTotalValue)}</td>
              </tr>
            </tfoot>
          </table>

          ${data.notes ? `<div style="background: #fffbe6; border-left: 3px solid #f0ad4e; padding: 12px; margin: 16px 0;"><strong>Notes:</strong><br>${data.notes.replace(/\n/g, '<br>')}</div>` : ''}

          ${data.photoUrl ? `<p><strong>Photo:</strong> <a href="${data.photoUrl}">${data.photoUrl}</a></p>` : ''}

          <p style="font-size: 12px; color: #888; margin-top: 20px;">
            INTERNAL ONLY. Do not forward to the customer. Once the vendor issues
            the credit memo, mark this vendor return as credited in the portal.
          </p>
        </div>
      </div>
    `;

    return this.send({
      to: recipient,
      subject,
      body,
      fromName: 'RCRS Inventory',
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
