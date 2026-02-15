// Portal Generator Service
// Generates unique customer portal links with access tokens

import crypto from 'crypto';
import { teamMembers, TeamMember } from './teamData';
import { CustomerPortalAccess } from './customer-portal-service';

export interface LeadData {
  // Required fields
  name: string;
  email: string;
  phone: string;
  address: string;
  city?: string;
  state?: string;
  zip?: string;

  // Source tracking
  source: 'contact_form' | 'jobnimbus' | 'phone_call' | 'referral' | 'walk_in' | 'other';
  sourceDetails?: string;

  // Sales rep assignment
  preferredRepSlug?: string;
  assignedRepSlug?: string;

  // Additional info
  serviceType?: string;
  message?: string;
  urgency?: 'low' | 'normal' | 'high' | 'emergency';

  // JobNimbus integration
  jobnimbusId?: string;
  jobnimbusContactId?: string;
}

export interface PortalGenerationResult {
  success: boolean;
  portalAccess?: CustomerPortalAccess;
  portalUrl?: string;
  shortCode?: string;
  qrCodeUrl?: string;
  salesRep?: TeamMember;
  error?: string;
}

export interface AssignedRep {
  member: TeamMember;
  reason: string;
}

class PortalGenerator {
  private baseUrl: string;

  constructor() {
    this.baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://rivercityroofingsolutions.com';
  }

  // Generate a secure access token (64 hex characters)
  generateAccessToken(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  // Generate a short code for SMS links (8 uppercase alphanumeric)
  generateShortCode(): string {
    return crypto.randomBytes(4).toString('hex').toUpperCase();
  }

  // Generate a customer ID
  generateCustomerId(): string {
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = crypto.randomBytes(3).toString('hex').toUpperCase();
    return `CUST-${timestamp}-${random}`;
  }

  // Assign a sales rep based on various factors
  assignSalesRep(lead: LeadData): AssignedRep {
    // If a preferred rep is specified, try to find them
    if (lead.preferredRepSlug) {
      const preferredRep = teamMembers.find(m => m.slug === lead.preferredRepSlug);
      if (preferredRep && this.isActiveSalesRep(preferredRep)) {
        return { member: preferredRep, reason: 'Customer requested' };
      }
    }

    // If an assigned rep is specified, use them
    if (lead.assignedRepSlug) {
      const assignedRep = teamMembers.find(m => m.slug === lead.assignedRepSlug);
      if (assignedRep && this.isActiveSalesRep(assignedRep)) {
        return { member: assignedRep, reason: 'Pre-assigned' };
      }
    }

    // Get all active sales inspectors
    const salesReps = teamMembers.filter(m => this.isActiveSalesRep(m));

    // For now, use round-robin based on timestamp
    // In production, this could factor in workload, territory, etc.
    const index = Date.now() % salesReps.length;
    const rep = salesReps[index];

    return { member: rep, reason: 'Auto-assigned (round-robin)' };
  }

  // Check if a team member is an active sales rep
  private isActiveSalesRep(member: TeamMember): boolean {
    const salesPositions = [
      'Sales Inspector',
      'Regional Partner',
      'President',
      'Vice President',
    ];
    const hasValidPosition = salesPositions.some(pos =>
      member.position.toLowerCase().includes(pos.toLowerCase())
    );
    const hasPhone = Boolean(member.phone && member.phone.length > 0);
    return hasValidPosition && hasPhone;
  }

  // Generate portal URL
  getPortalUrl(accessToken: string): string {
    return `${this.baseUrl}/my/${accessToken}`;
  }

  // Generate short portal URL (for SMS)
  getShortPortalUrl(shortCode: string): string {
    return `${this.baseUrl}/p/${shortCode}`;
  }

  // Generate QR code API URL
  getQrCodeUrl(accessToken: string): string {
    return `${this.baseUrl}/api/portal/qr/${accessToken}`;
  }

  // Generate sales rep profile URL
  getSalesRepUrl(repSlug: string, refToken?: string): string {
    const base = `${this.baseUrl}/team/${repSlug}`;
    return refToken ? `${base}?ref=${refToken}` : base;
  }

  // Format address from components
  formatAddress(lead: LeadData): string {
    const parts = [
      lead.address,
      lead.city,
      lead.state,
      lead.zip,
    ].filter(Boolean);
    return parts.join(', ') || 'Address not provided';
  }

  // Format phone number for display
  formatPhoneDisplay(phone: string): string {
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length === 10) {
      return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
    }
    if (cleaned.length === 11 && cleaned.startsWith('1')) {
      return `(${cleaned.slice(1, 4)}) ${cleaned.slice(4, 7)}-${cleaned.slice(7)}`;
    }
    return phone;
  }

  // Format phone for E.164 (for SMS APIs)
  formatPhoneE164(phone: string): string {
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length === 10) {
      return `+1${cleaned}`;
    }
    if (cleaned.length === 11 && cleaned.startsWith('1')) {
      return `+${cleaned}`;
    }
    return phone;
  }

  // Create full portal access object for a lead
  async generatePortalForLead(lead: LeadData): Promise<PortalGenerationResult> {
    try {
      // Assign a sales rep
      const { member: salesRep, reason: assignmentReason } = this.assignSalesRep(lead);

      // Generate tokens
      const accessToken = this.generateAccessToken();
      const shortCode = this.generateShortCode();
      const customerId = this.generateCustomerId();

      // Create portal access object
      const portalAccess: CustomerPortalAccess = {
        accessToken,
        customerId,
        customerName: lead.name,
        customerEmail: lead.email,
        customerPhone: lead.phone,
        customerAddress: this.formatAddress(lead),
        salesRepId: salesRep.slug,
        salesRepName: salesRep.name,
        salesRepSlug: salesRep.slug,
        jobId: lead.jobnimbusId,
        createdAt: new Date().toISOString(),
        isActive: true,
      };

      // Generate URLs
      const portalUrl = this.getPortalUrl(accessToken);
      const qrCodeUrl = this.getQrCodeUrl(accessToken);

    // logging removed

      return {
        success: true,
        portalAccess,
        portalUrl,
        shortCode,
        qrCodeUrl,
        salesRep,
      };
    } catch (error) {
      console.error('Error generating portal:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error generating portal',
      };
    }
  }

  // Generate SMS message templates
  getSmsTemplates(portalAccess: CustomerPortalAccess, salesRep: TeamMember) {
    const firstName = portalAccess.customerName.split(' ')[0];
    const portalUrl = this.getPortalUrl(portalAccess.accessToken);
    const repUrl = this.getSalesRepUrl(salesRep.slug);

    return {
      // Initial introduction message
      intro: `Hi ${firstName}! I'm ${salesRep.name} with River City Roofing Solutions. I'll be your dedicated roofing specialist. Learn more about me here: ${repUrl} - Looking forward to helping you!`,

      // Portal invitation
      portalInvite: `Hi ${firstName}! Your River City Roofing customer portal is ready. View your inspection status, documents, weather forecast & more: ${portalUrl}`,

      // Combined intro + portal
      combined: `Hi ${firstName}! I'm ${salesRep.name} from River City Roofing. Here's your personal portal with my contact info, your inspection status & more: ${portalUrl}`,

      // Appointment scheduled
      appointmentScheduled: (date: string, time: string) =>
        `Hi ${firstName}! Your roof inspection is scheduled for ${date} at ${time}. View details & weather: ${portalUrl} - ${salesRep.name}`,

      // Estimate ready
      estimateReady: `Great news ${firstName}! Your roof estimate is ready to view in your portal: ${portalUrl} - Questions? Just reply to this text! - ${salesRep.name}`,
    };
  }

  // Generate email templates
  getEmailTemplates(portalAccess: CustomerPortalAccess, salesRep: TeamMember) {
    const firstName = portalAccess.customerName.split(' ')[0];
    const portalUrl = this.getPortalUrl(portalAccess.accessToken);
    const repUrl = this.getSalesRepUrl(salesRep.slug);
    const qrUrl = this.getQrCodeUrl(portalAccess.accessToken);

    return {
      // Introduction email with rep bio
      intro: {
        subject: `Meet ${salesRep.name}, Your River City Roofing Specialist`,
        html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f5f5f5;">
  <div style="background-color: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
    <div style="text-align: center; margin-bottom: 30px;">
      <h1 style="color: #16a34a; margin: 0;">River City Roofing Solutions</h1>
      <p style="color: #666; margin: 5px 0;">North Alabama's Trusted Roofing Experts</p>
    </div>

    <h2 style="color: #333;">Welcome, ${firstName}!</h2>

    <p>Thank you for your interest in River City Roofing Solutions. We've assigned ${salesRep.name} as your dedicated roofing specialist.</p>

    <div style="background-color: #f8f8f8; padding: 20px; border-radius: 8px; margin: 20px 0;">
      <h3 style="color: #16a34a; margin-top: 0;">About ${salesRep.name}</h3>
      <p style="color: #555; font-size: 14px; line-height: 1.6;">${salesRep.tagline || salesRep.bio?.substring(0, 200) + '...'}</p>

      <div style="margin-top: 15px;">
        <p style="margin: 5px 0;"><strong>Position:</strong> ${salesRep.position}</p>
        <p style="margin: 5px 0;"><strong>Phone:</strong> <a href="tel:${salesRep.phone}" style="color: #16a34a;">${this.formatPhoneDisplay(salesRep.phone)}</a></p>
        <p style="margin: 5px 0;"><strong>Email:</strong> <a href="mailto:${salesRep.email}" style="color: #16a34a;">${salesRep.email}</a></p>
      </div>

      <a href="${repUrl}" style="display: inline-block; background-color: #16a34a; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin-top: 15px;">View Full Profile</a>
    </div>

    <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee;">
      <p style="color: #666; font-size: 12px;">River City Roofing Solutions<br>North Alabama's Premier Roofing Company</p>
    </div>
  </div>
</body>
</html>`,
      },

      // Portal invitation email
      portalInvite: {
        subject: `Your Customer Portal is Ready - River City Roofing`,
        html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f5f5f5;">
  <div style="background-color: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
    <div style="text-align: center; margin-bottom: 30px;">
      <h1 style="color: #16a34a; margin: 0;">River City Roofing Solutions</h1>
      <p style="color: #666; margin: 5px 0;">Your Customer Portal</p>
    </div>

    <h2 style="color: #333;">Hi ${firstName},</h2>

    <p>Your personal customer portal is now ready! Here's what you can access:</p>

    <ul style="color: #555; line-height: 1.8;">
      <li>Your assigned specialist's profile and contact info</li>
      <li>Current job status and progress tracking</li>
      <li>Upcoming appointments and schedule</li>
      <li>Weather forecast for your install days</li>
      <li>Documents, estimates, and invoices</li>
      <li>Direct messaging with your rep</li>
    </ul>

    <div style="text-align: center; margin: 30px 0;">
      <a href="${portalUrl}" style="display: inline-block; background-color: #16a34a; color: white; padding: 15px 40px; text-decoration: none; border-radius: 8px; font-size: 18px; font-weight: bold;">Access Your Portal</a>
    </div>

    <div style="background-color: #f8f8f8; padding: 15px; border-radius: 8px; text-align: center;">
      <p style="margin: 0 0 10px 0; color: #666; font-size: 14px;">Scan this QR code with your phone:</p>
      <img src="${qrUrl}" alt="Portal QR Code" style="width: 150px; height: 150px;">
    </div>

    <div style="margin-top: 20px; padding: 15px; background-color: #e8f5e9; border-radius: 8px;">
      <p style="margin: 0; color: #2e7d32; font-size: 14px;">
        <strong>Your Specialist:</strong> ${salesRep.name}<br>
        <strong>Phone:</strong> <a href="tel:${salesRep.phone}" style="color: #2e7d32;">${this.formatPhoneDisplay(salesRep.phone)}</a>
      </p>
    </div>

    <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee;">
      <p style="color: #666; font-size: 12px;">Questions? Just reply to this email or call us anytime!</p>
    </div>
  </div>
</body>
</html>`,
      },
    };
  }
}

// Export singleton instance
export const portalGenerator = new PortalGenerator();

// Export types
export type { CustomerPortalAccess };