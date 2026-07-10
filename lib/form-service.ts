/**
 * Form Service - Unified handler for all form submissions
 * All forms go to Google Sheets + Email notification
 */

import { persistLeadFallback } from './lead-fallback';

// Primary recipient: rcrs@rivercityroofingsolutions.com — the company's main
// monitored inbox. (Both rivercityroofingsolutions.com and rcrsal.com are
// attached to the same Google Workspace accounts, so either domain reaches
// the team; we keep the historical main address.) Overridable via env.
const COMPANY_EMAIL =
  process.env.LEAD_NOTIFY_TO || 'rcrs@rivercityroofingsolutions.com';
// Owner visibility copy. The 2026-05-20 flood was Google Apps Script
// amplifying spam to this gmail; that channel is gone. Now every send is
// spam-filtered upstream (honeypot + spam-filter + Turnstile in the route)
// and the gmail is rate-capped (5/hr, 30/day in email-service), so a cc is
// safe. Set LEAD_NOTIFY_CC='' to disable.
const OWNER_CC =
  process.env.LEAD_NOTIFY_CC ?? 'rivercityroofingsolutions@gmail.com';

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
      const errMsg = error instanceof Error ? error.message : String(error);
      console.error('Error submitting contact form:', errMsg);
      // Owner directive 2026-05-21: persist to blob fallback so the
      // reconcile-leads cron can replay this write. submitContactForm
      // is the shared writer for /api/forms/contact, /api/forms/careers
      // (which routes career applications through this same funnel with
      // sourcePage='Careers Page'), and /api/forms/bni-partner. We pass
      // the route-specific source slug so the replay knows which sheet
      // tab to target. The slug is derived from sourcePage when it's an
      // exact match for a known funnel; otherwise we fall through to the
      // generic 'contact' slug.
      const source =
        data.sourcePage === 'Careers Page'
          ? 'careers'
          : data.sourcePage === 'BNI Partners Page'
            ? 'bni-partner'
            : 'contact-form';
      await persistLeadFallback({
        source,
        payload: data as unknown as Record<string, unknown>,
        reason: 'sheets-write-failed',
        originalError: errMsg,
      });
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
      const errMsg = error instanceof Error ? error.message : String(error);
      console.error('Error submitting referral form:', errMsg);
      // Owner directive 2026-05-21: persist to blob fallback so the
      // reconcile-leads cron can replay this referral write.
      await persistLeadFallback({
        source: 'referral',
        payload: data as unknown as Record<string, unknown>,
        reason: 'sheets-write-failed',
        originalError: errMsg,
      });
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

    // 2. Send direct email notification to the company address
    try {
      const { emailService } = await import('./email-service');
      const { renderContactFormEmail, contactFormSubject } = await import(
        './email-templates/contact-form'
      );
      const isContact = formType === 'contact';
      const contactData = data as ContactFormData;
      const referralData = data as ReferralFormData;

      let subject: string;
      let body: string;
      let replyTo: string | undefined;

      if (isContact) {
        const leadEmailData = {
          name: contactData.name,
          email: contactData.email,
          phone: contactData.phone,
          subject: contactData.subject,
          message: contactData.message,
          sourcePage: contactData.sourcePage,
          preferredInspector: contactData.preferredInspector,
          serviceType: contactData.serviceType,
        };
        subject = contactFormSubject(leadEmailData);
        body = renderContactFormEmail(leadEmailData);
        replyTo = contactData.email || undefined;
      } else {
        // Referral form shares the 'contact-form' allowlist tag. Render it
        // as a lead notification too, with the referred person as the lead
        // and the referrer surfaced in the message body.
        const referralMessage =
          `Referrer: ${referralData.referrerName} (${referralData.referrerPhone}` +
          (referralData.referrerEmail ? `, ${referralData.referrerEmail}` : '') +
          `)\nReferred address: ${referralData.referralAddress}` +
          (referralData.salesRep ? `\nRequested rep: ${referralData.salesRep}` : '') +
          (referralData.notes ? `\n\nNotes: ${referralData.notes}` : '');

        const leadEmailData = {
          name: referralData.referralName,
          email: referralData.referralEmail || '',
          phone: referralData.referralPhone,
          subject: `Referral from ${referralData.referrerName}`,
          message: referralMessage,
          sourcePage: referralData.sourcePage || 'Referral Form',
        };
        subject = contactFormSubject(leadEmailData);
        body = renderContactFormEmail(leadEmailData);
        replyTo = referralData.referrerEmail || undefined;
      }

      // Send to primary company address only.
      // Tagged template: 'contact-form' (also used for referral/career/BNI
      // partner submissions — they share this funnel).
      // gmail backup CC removed 2026-05-20. Resend transport + template
      // allowlist in lib/email-service.ts is the new layered defense.
      await emailService.send({
        template: 'contact-form',
        to: COMPANY_EMAIL,
        cc: OWNER_CC || undefined,
        subject,
        body,
        replyTo,
        fromName: 'RCRS Website Forms',
      });
    } catch (error) {
      console.error('Direct email notification failed:', error);
    }
  }
}

export const formService = new FormService();