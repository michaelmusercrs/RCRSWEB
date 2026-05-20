/**
 * Form Service - Unified handler for all form submissions
 * All forms go to Google Sheets + Email notification
 */


const COMPANY_EMAIL = 'rcrs@rivercityroofingsolutions.com';
// COMPANY_EMAIL_BACKUP (rivercityroofingsolutions@gmail.com) intentionally
// removed 2026-05-20 — see CC removal note below.

export interface ContactFormData {
  name: string;
  email: string;
  phone?: string;
  subject: string;
  message: string;
  preferredInspector?: string;
  serviceType?: string;
  serviceArea?: string;
  sourcePage: string;
  // Lead source attribution
  leadSource?: string;
  leadSourceDetail?: string;
  marketingSource?: string;
}

export interface ReferralFormData {
  referrerName: string;
  referrerPhone: string;
  referrerEmail?: string;
  referralName: string;
  referralPhone: string;
  referralEmail?: string;
  referralAddress: string;
  salesRep?: string;
  notes?: string;
  sourcePage: string;
}

export type FormSubmission = {
  id: string;
  formType: 'contact' | 'referral';
  timestamp: string;
  sourcePage: string;
  data: Record<string, string>;
  status: 'new' | 'contacted' | 'converted' | 'closed';
};

class FormService {
  /**
   * Submit a contact form
   */
  async submitContactForm(data: ContactFormData): Promise<{ success: boolean; message: string }> {
    try {
      // Save to Google Sheets
      await this.saveToSheet('contact', {
        name: data.name,
        email: data.email,
        phone: data.phone || '',
        subject: data.subject,
        message: data.message,
        preferredInspector: data.preferredInspector || 'First Available',
        serviceType: data.serviceType || '',
        serviceArea: data.serviceArea || '',
        sourcePage: data.sourcePage,
        // Lead source attribution columns
        leadSource: data.leadSource || 'Direct',
        leadSourceDetail: data.leadSourceDetail || '',
        marketingSource: data.marketingSource || 'Website - Direct',
      });

      // Send email notification
      await this.sendEmailNotification('contact', data);

      return {
        success: true,
        message: 'Thank you for contacting us! We will get back to you within 24 hours.',
      };
    } catch (error) {
      console.error('Error submitting contact form:', error);
      return {
        success: false,
        message: 'There was a problem submitting your request. Please call us at (256) 274-8530.',
      };
    }
  }

  /**
   * Submit a referral form
   */
  async submitReferralForm(data: ReferralFormData): Promise<{ success: boolean; message: string }> {
    try {
      // Save to Google Sheets
      await this.saveToSheet('referral', {
        referrerName: data.referrerName,
        referrerPhone: data.referrerPhone,
        referrerEmail: data.referrerEmail || '',
        referralName: data.referralName,
        referralPhone: data.referralPhone,
        referralEmail: data.referralEmail || '',
        referralAddress: data.referralAddress,
        salesRep: data.salesRep || '',
        notes: data.notes || '',
        sourcePage: data.sourcePage,
      });

      // Send email notification
      await this.sendEmailNotification('referral', data);

      return {
        success: true,
        message: 'Thank you for your referral! We will contact them soon and keep you updated on your reward.',
      };
    } catch (error) {
      console.error('Error submitting referral form:', error);
      return {
        success: false,
        message: 'There was a problem submitting your referral. Please call us at (256) 274-8530.',
      };
    }
  }

  /**
   * Sanitize input to prevent Google Sheets formula injection
   */
  private sanitizeForSheets(value: string): string {
    if (typeof value !== 'string') return value;
    // Prefix dangerous formula characters with a single quote
    if (/^[=+\-@\t\r]/.test(value)) {
      return `'${value}`;
    }
    return value;
  }

  /**
   * Save form submission to Google Sheets
   */
  private async saveToSheet(formType: string, data: Record<string, string>): Promise<void> {
    const { GoogleSpreadsheet } = await import('google-spreadsheet');
    const { JWT } = await import('google-auth-library');

    const auth = new JWT({
      email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    const doc = new GoogleSpreadsheet(process.env.GOOGLE_SHEETS_ID!, auth);
    await doc.loadInfo();

    const sheetName = formType === 'contact' ? 'contact-submissions' : 'referral-submissions';
    let sheet = doc.sheetsByTitle[sheetName];

    if (!sheet) {
      const headers = formType === 'contact'
        ? ['id', 'timestamp', 'status', 'sourcePage', 'name', 'email', 'phone', 'subject', 'message', 'preferredInspector', 'serviceType', 'serviceArea', 'leadSource', 'leadSourceDetail', 'marketingSource']
        : ['id', 'timestamp', 'status', 'sourcePage', 'referrerName', 'referrerPhone', 'referrerEmail', 'referralName', 'referralPhone', 'referralEmail', 'referralAddress', 'salesRep', 'notes'];

      sheet = await doc.addSheet({ title: sheetName, headerValues: headers });
    }

    // Sanitize all user input to prevent formula injection
    const sanitizedData: Record<string, string> = {};
    for (const [key, value] of Object.entries(data)) {
      sanitizedData[key] = this.sanitizeForSheets(value);
    }

    await sheet.addRow({
      id: `${formType}-${Date.now()}`,
      timestamp: new Date().toISOString(),
      status: 'new',
      ...sanitizedData,
    });

    // Save backup copy to 'Form Backup' tab
    try {
      let backupSheet = doc.sheetsByTitle['Form Backup'];
      if (!backupSheet) {
        backupSheet = await doc.addSheet({
          title: 'Form Backup',
          headerValues: ['id', 'timestamp', 'formType', 'status', ...Object.keys(sanitizedData)],
        });
      }
      await backupSheet.addRow({
        id: `${formType}-${Date.now()}`,
        timestamp: new Date().toISOString(),
        formType,
        status: 'new',
        ...sanitizedData,
      });
    } catch (backupErr) {
      console.error('Backup sheet save failed:', backupErr);
    }
  }

  /**
   * Send email notification.
   *
   * NOTE 2026-05-20: the legacy Google Apps Script notification fetch is
   * DISABLED. That GAS endpoint emails the owner gmail with subject
   * "[Contact Page] New Lead: …" on every submission, and was the actual
   * channel of today's flood (bot spam on the public contact form, amplified
   * straight to the personal inbox via GAS). Sheet logging is unaffected —
   * saveToSheet writes directly via the Google Sheets API. The formal
   * company-address email below (emailService.send) still fires and is now
   * rate-limited per recipient. To re-enable the GAS notification later,
   * first update the GAS code so it does not email the owner gmail.
   */
  private async sendEmailNotification(formType: string, data: ContactFormData | ReferralFormData): Promise<void> {
    // 1. Legacy GAS notification — disabled. See note above.
    // const endpoint = process.env.NEXT_PUBLIC_GOOGLE_SCRIPT_ENDPOINT;
    // (intentionally not re-enabled — flood channel)

    // 2. Send direct email notification to both company addresses
    try {
      const { emailService } = await import('./email-service');
      const isContact = formType === 'contact';
      const contactData = data as ContactFormData;
      const referralData = data as ReferralFormData;

      const subject = isContact
        ? `New Contact Form: ${contactData.subject} - ${contactData.name}`
        : `New Referral: ${referralData.referralName} (from ${referralData.referrerName})`;

      const body = isContact
        ? `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background: #000; padding: 20px; text-align: center;">
              <h1 style="color: #39FF14; margin: 0;">New Contact Form Submission</h1>
            </div>
            <div style="padding: 30px; background: #fff;">
              <table style="width: 100%; border-collapse: collapse;">
                <tr><td style="padding: 8px; border-bottom: 1px solid #eee; font-weight: bold;">Name</td><td style="padding: 8px; border-bottom: 1px solid #eee;">${contactData.name}</td></tr>
                <tr><td style="padding: 8px; border-bottom: 1px solid #eee; font-weight: bold;">Email</td><td style="padding: 8px; border-bottom: 1px solid #eee;">${contactData.email || 'Not provided'}</td></tr>
                <tr><td style="padding: 8px; border-bottom: 1px solid #eee; font-weight: bold;">Phone</td><td style="padding: 8px; border-bottom: 1px solid #eee;">${contactData.phone || 'Not provided'}</td></tr>
                <tr><td style="padding: 8px; border-bottom: 1px solid #eee; font-weight: bold;">Subject</td><td style="padding: 8px; border-bottom: 1px solid #eee;">${contactData.subject}</td></tr>
                <tr><td style="padding: 8px; border-bottom: 1px solid #eee; font-weight: bold;">Message</td><td style="padding: 8px; border-bottom: 1px solid #eee;">${contactData.message}</td></tr>
                <tr><td style="padding: 8px; border-bottom: 1px solid #eee; font-weight: bold;">Source</td><td style="padding: 8px; border-bottom: 1px solid #eee;">${contactData.sourcePage}</td></tr>
              </table>
            </div>
          </div>`
        : `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background: #000; padding: 20px; text-align: center;">
              <h1 style="color: #39FF14; margin: 0;">New Referral Submission</h1>
            </div>
            <div style="padding: 30px; background: #fff;">
              <h3>Referrer</h3>
              <p>${referralData.referrerName} | ${referralData.referrerPhone} | ${referralData.referrerEmail || 'No email'}</p>
              <h3>Referred Person</h3>
              <table style="width: 100%; border-collapse: collapse;">
                <tr><td style="padding: 8px; border-bottom: 1px solid #eee; font-weight: bold;">Name</td><td style="padding: 8px; border-bottom: 1px solid #eee;">${referralData.referralName}</td></tr>
                <tr><td style="padding: 8px; border-bottom: 1px solid #eee; font-weight: bold;">Phone</td><td style="padding: 8px; border-bottom: 1px solid #eee;">${referralData.referralPhone}</td></tr>
                <tr><td style="padding: 8px; border-bottom: 1px solid #eee; font-weight: bold;">Address</td><td style="padding: 8px; border-bottom: 1px solid #eee;">${referralData.referralAddress}</td></tr>
              </table>
              ${referralData.notes ? `<p><strong>Notes:</strong> ${referralData.notes}</p>` : ''}
            </div>
          </div>`;

      // Send to primary company address only.
      // gmail backup CC removed 2026-05-20 — was the only path leaking form
      // submissions into the owner's personal inbox and got flooded. Restore
      // via env recipient list once we identify the flood source. Even if
      // re-added, lib/email-service.ts enforces a per-recipient hourly cap
      // (tightest on the owner gmail) so a flood can never recur.
      await emailService.send({
        to: COMPANY_EMAIL,
        subject,
        body,
        replyTo: isContact ? (contactData.email || undefined) : (referralData.referrerEmail || undefined),
        fromName: 'RCRS Website Forms',
      });
    } catch (error) {
      console.error('Direct email notification failed:', error);
    }
  }
}

export const formService = new FormService();