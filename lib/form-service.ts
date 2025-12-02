/**
 * Form Service - Unified handler for all form submissions
 * All forms go to Google Sheets + Email notification
 */

import { cmsSheetsService } from './cms-sheets-service';

const COMPANY_EMAIL = 'rivercityroofingsolutions@gmail.com';

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
        ? ['id', 'timestamp', 'status', 'sourcePage', 'name', 'email', 'phone', 'subject', 'message', 'preferredInspector', 'serviceType', 'serviceArea']
        : ['id', 'timestamp', 'status', 'sourcePage', 'referrerName', 'referrerPhone', 'referrerEmail', 'referralName', 'referralPhone', 'referralEmail', 'referralAddress', 'salesRep', 'notes'];

      sheet = await doc.addSheet({ title: sheetName, headerValues: headers });
    }

    await sheet.addRow({
      id: `${formType}-${Date.now()}`,
      timestamp: new Date().toISOString(),
      status: 'new',
      ...data,
    });
  }

  /**
   * Send email notification via Google Apps Script or direct SMTP
   */
  private async sendEmailNotification(formType: string, data: ContactFormData | ReferralFormData): Promise<void> {
    const endpoint = process.env.NEXT_PUBLIC_GOOGLE_SCRIPT_ENDPOINT;

    if (!endpoint) {
      console.log('No email endpoint configured, skipping email notification');
      return;
    }

    const formData = new URLSearchParams();
    formData.append('formType', formType);
    formData.append('sourcePage', data.sourcePage);

    // Add all data fields
    Object.entries(data).forEach(([key, value]) => {
      if (value) formData.append(key, String(value));
    });

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: formData.toString(),
      });

      const result = await response.json();
      if (result.result !== 'success') {
        console.error('Email notification failed:', result);
      }
    } catch (error) {
      console.error('Error sending email notification:', error);
      // Don't throw - form was still saved to sheets
    }
  }
}

export const formService = new FormService();
