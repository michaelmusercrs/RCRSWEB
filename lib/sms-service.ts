// SMS Service - Multi-provider with admin controls
// Priority: Phone Gateway (free) > Email-to-SMS (free) > VoIP.ms (paid) > Twilio (paid) > Google Apps Script (fallback)
//
// Email-to-SMS: Send emails to carrier gateways (number@txt.att.net etc.)
// Arrives as a text message on the customer's phone. $0/msg, works immediately.
// Requires knowing the carrier - stored on customer record, rep selects on first contact.
//
// Phone Gateway: Install "SMS Gateway" app on a spare Android phone.
// The phone becomes a free SMS server using its own cell plan.
//
// VoIP.ms: REST API for SMS delivery. $0.01/msg, same number as FreePBX.
//
// Admin can enable/disable customer texting globally (on by default)
// Sales rep controls which topics are texted per customer
// Individual customer portal settings control what's shared

export interface SMSConfig {
  globalEnabled: boolean; // Admin master toggle (default: true)
  defaultTopics: {
    deliveryReminders: boolean;
    appointmentReminders: boolean;
    statusUpdates: boolean;
    portalLinks: boolean;
    weatherAlerts: boolean;
    documentSharing: boolean;
  };
}

export interface CustomerSMSPreferences {
  enabled: boolean; // Per-customer toggle (set by rep)
  topics: {
    deliveryReminders: boolean;
    appointmentReminders: boolean;
    statusUpdates: boolean;
    portalLinks: boolean;
    weatherAlerts: boolean;
    documentSharing: boolean;
  };
}

const DEFAULT_SMS_CONFIG: SMSConfig = {
  globalEnabled: true,
  defaultTopics: {
    deliveryReminders: true,
    appointmentReminders: true,
    statusUpdates: true,
    portalLinks: true,
    weatherAlerts: false,
    documentSharing: false,
  },
};

// Carrier email-to-SMS gateways (US carriers)
// Send email to number@gateway -> arrives as text message on phone
const CARRIER_GATEWAYS: Record<string, { sms: string; mms?: string; name: string }> = {
  att:       { sms: 'txt.att.net',               mms: 'mms.att.net',              name: 'AT&T' },
  tmobile:   { sms: 'tmomail.net',               mms: 'tmomail.net',              name: 'T-Mobile' },
  verizon:   { sms: 'vtext.com',                 mms: 'vzwpix.com',               name: 'Verizon' },
  sprint:    { sms: 'messaging.sprintpcs.com',   mms: 'pm.sprint.com',            name: 'Sprint/T-Mobile' },
  uscellular:{ sms: 'email.uscc.net',            mms: 'mms.uscc.net',             name: 'US Cellular' },
  cricket:   { sms: 'sms.cricketwireless.net',   mms: 'mms.cricketwireless.net',  name: 'Cricket' },
  metropcs:  { sms: 'mymetropcs.com',            mms: 'mymetropcs.com',           name: 'Metro PCS' },
  boost:     { sms: 'sms.myboostmobile.com',     mms: 'myboostmobile.com',        name: 'Boost Mobile' },
  straight:  { sms: 'vtext.com',                 mms: 'mypixmessages.com',        name: 'Straight Talk' },
  consumer:  { sms: 'mailmymobile.net',                                            name: 'Consumer Cellular' },
  googlefi:  { sms: 'msg.fi.google.com',                                           name: 'Google Fi' },
  mint:      { sms: 'tmomail.net',                                                 name: 'Mint Mobile (T-Mobile)' },
  visible:   { sms: 'vtext.com',                                                   name: 'Visible (Verizon)' },
};

export type CarrierCode = keyof typeof CARRIER_GATEWAYS;

class SMSService {
  private twilioConfigured = false;
  private phoneGatewayConfigured = false;
  private voipMsConfigured = false;
  private emailToSmsEnabled = true; // Always available when email is configured

  constructor() {
    this.twilioConfigured = !!(
      process.env.TWILIO_ACCOUNT_SID &&
      process.env.TWILIO_AUTH_TOKEN &&
      process.env.TWILIO_PHONE_NUMBER
    );
    this.phoneGatewayConfigured = !!(
      process.env.SMS_GATEWAY_API_URL &&
      process.env.SMS_GATEWAY_DEVICE_ID
    );
    this.voipMsConfigured = !!(
      process.env.VOIPMS_API_USERNAME &&
      process.env.VOIPMS_API_PASSWORD &&
      process.env.VOIPMS_DID
    );
  }

  // Format phone to E.164
  private formatPhone(phone: string): string {
    const digits = phone.replace(/\D/g, '');
    if (digits.length === 10) return `+1${digits}`;
    if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
    return `+${digits}`;
  }

  // Format phone to 10-digit (for carrier gateways)
  private formatPhone10(phone: string): string {
    const digits = phone.replace(/\D/g, '');
    if (digits.length === 11 && digits.startsWith('1')) return digits.slice(1);
    if (digits.length === 10) return digits;
    return digits;
  }

  // Get list of supported carriers (for UI dropdown)
  static getCarriers(): { code: string; name: string }[] {
    return Object.entries(CARRIER_GATEWAYS).map(([code, info]) => ({
      code,
      name: info.name,
    }));
  }

  // ========================================
  // PROVIDER: Phone Gateway (FREE - spare Android phone)
  // ========================================
  // Uses "SMS Gateway API" or compatible Android app as SMS sender.
  // The phone runs the app, which provides a cloud REST API.
  // Our server POSTs to the cloud API -> relays to phone -> phone sends SMS.
  //
  // Supported apps (install one on spare phone):
  //   1. "SMS Gateway API" (smsgateway.me) - free cloud relay
  //   2. "HTTP SMS Server" - local network only
  //   3. Any app exposing POST /send with {phone, message} body
  //
  // ENV vars:
  //   SMS_GATEWAY_API_URL=https://smsgateway.me/api/v4/message/send  (or custom URL)
  //   SMS_GATEWAY_DEVICE_ID=your_device_id
  //   SMS_GATEWAY_API_KEY=your_api_key (if required)

  private async sendViaPhoneGateway(to: string, body: string): Promise<{ success: boolean; error?: string }> {
    const apiUrl = process.env.SMS_GATEWAY_API_URL!;
    const deviceId = process.env.SMS_GATEWAY_DEVICE_ID!;
    const apiKey = process.env.SMS_GATEWAY_API_KEY || '';

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (apiKey) {
        headers['Authorization'] = `Bearer ${apiKey}`;
      }

      // Try smsgateway.me format first (most popular free option)
      const payload = JSON.stringify({
        phone_number: this.formatPhone(to),
        message: body,
        device_id: parseInt(deviceId) || deviceId,
      });

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers,
        body: payload,
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Phone Gateway SMS error:', errorText);
        return { success: false, error: `Gateway HTTP ${response.status}: ${errorText.slice(0, 200)}` };
      }

      const result = await response.json().catch(() => ({}));
      console.log(`[SMS Gateway] Sent to ${to} via phone gateway`);
      return { success: true };
    } catch (error) {
      console.error('Phone Gateway SMS failed:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  // ========================================
  // PROVIDER: Email-to-SMS (FREE - carrier gateways)
  // ========================================
  // Sends email to carrier gateway address -> arrives as SMS on customer's phone.
  // Requires carrier code (att, tmobile, verizon, etc.) stored on customer record.
  // North Alabama is mostly AT&T and T-Mobile territory.
  // Falls through to next provider if no carrier specified.
  //
  // How it works:
  //   1. Look up carrier gateway: att -> txt.att.net
  //   2. Build email: 2565551234@txt.att.net
  //   3. Send via Google Apps Script (same email endpoint)
  //   4. Carrier delivers as SMS to phone

  private async sendViaEmailGateway(
    to: string,
    body: string,
    carrier?: CarrierCode
  ): Promise<{ success: boolean; error?: string }> {
    if (!carrier) {
      return { success: false, error: 'No carrier specified for email-to-SMS' };
    }

    const gateway = CARRIER_GATEWAYS[carrier];
    if (!gateway) {
      return { success: false, error: `Unknown carrier: ${carrier}` };
    }

    const endpoint = process.env.NEXT_PUBLIC_GOOGLE_SCRIPT_ENDPOINT;
    if (!endpoint) {
      return { success: false, error: 'Google Apps Script endpoint not configured' };
    }

    const phone10 = this.formatPhone10(to);
    const smsEmailAddress = `${phone10}@${gateway.sms}`;

    try {
      // SMS via carrier gateway has 160 char limit per segment
      // Truncate message to keep it clean (carriers may split long messages)
      const truncatedBody = body.length > 459 ? body.slice(0, 456) + '...' : body;

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          formType: 'email_notification',
          to: smsEmailAddress,
          subject: '', // No subject = cleaner SMS display
          body: truncatedBody,
          fromName: 'River City Roofing',
        }).toString(),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Email-to-SMS gateway error:', errorText);
        return { success: false, error: `HTTP ${response.status}` };
      }

      console.log(`[SMS Email Gateway] Sent to ${phone10} via ${gateway.name} (${smsEmailAddress})`);
      return { success: true };
    } catch (error) {
      console.error('Email-to-SMS gateway failed:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  // ========================================
  // PROVIDER: VoIP.ms (paid ~$0.01/msg)
  // ========================================
  // Uses VoIP.ms REST API for SMS delivery.
  // Same number as FreePBX, cheaper than Twilio but slightly higher cost per message.
  //
  // ENV vars:
  //   VOIPMS_API_USERNAME=your_email@example.com
  //   VOIPMS_API_PASSWORD=your_api_password (from voip.ms portal)
  //   VOIPMS_DID=your_10_digit_phone_number
  //
  // API docs: https://voip.ms/m/apidocs.php

  private async sendViaVoipMs(to: string, body: string): Promise<{ success: boolean; error?: string }> {
    const username = process.env.VOIPMS_API_USERNAME!;
    const password = process.env.VOIPMS_API_PASSWORD!;
    const did = process.env.VOIPMS_DID!;

    try {
      // VoIP.ms expects 10-digit destination number
      const dst = this.formatPhone10(to);

      // Build API URL with query parameters
      const url = new URL('https://voip.ms/api/v1/rest.php');
      url.searchParams.set('api_username', username);
      url.searchParams.set('api_password', password);
      url.searchParams.set('method', 'sendSMS');
      url.searchParams.set('did', did);
      url.searchParams.set('dst', dst);
      url.searchParams.set('message', body);

      const response = await fetch(url.toString(), {
        method: 'GET',
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('VoIP.ms SMS error:', errorText);
        return { success: false, error: `HTTP ${response.status}: ${errorText.slice(0, 200)}` };
      }

      const result = await response.json();

      if (result.status === 'success') {
        console.log(`[VoIP.ms] Sent to ${to} via VoIP.ms (DID: ${did})`);
        return { success: true };
      } else {
        console.error('VoIP.ms SMS failed:', result);
        return { success: false, error: result.message || 'Unknown VoIP.ms error' };
      }
    } catch (error) {
      console.error('VoIP.ms SMS failed:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  // ========================================
  // PROVIDER: Twilio (paid ~$0.0079/msg)
  // ========================================
  private async sendViaTwilio(to: string, body: string): Promise<{ success: boolean; sid?: string; error?: string }> {
    const accountSid = process.env.TWILIO_ACCOUNT_SID!;
    const authToken = process.env.TWILIO_AUTH_TOKEN!;
    const from = process.env.TWILIO_PHONE_NUMBER!;

    try {
      const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
      const auth = Buffer.from(`${accountSid}:${authToken}`).toString('base64');

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${auth}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          To: this.formatPhone(to),
          From: from,
          Body: body,
        }).toString(),
      });

      if (!response.ok) {
        const error = await response.json();
        console.error('Twilio SMS error:', error);
        return { success: false, error: error.message || `HTTP ${response.status}` };
      }

      const result = await response.json();
      return { success: true, sid: result.sid };
    } catch (error) {
      console.error('Twilio SMS failed:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  // ========================================
  // PROVIDER: Google Apps Script (fallback)
  // ========================================
  private async sendViaAppsScript(to: string, body: string): Promise<{ success: boolean; error?: string }> {
    const endpoint = process.env.NEXT_PUBLIC_GOOGLE_SCRIPT_ENDPOINT;
    if (!endpoint) {
      return { success: false, error: 'Google Apps Script endpoint not configured' };
    }

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          formType: 'sms_notification',
          phone: this.formatPhone(to),
          message: body,
        }).toString(),
      });

      return { success: response.ok };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  // ========================================
  // PUBLIC API
  // ========================================

  // Send raw SMS (bypasses topic controls - for system messages)
  // Priority: Phone Gateway > Email-to-SMS (if carrier known) > VoIP.ms > Twilio > Apps Script
  async send(to: string, message: string, carrier?: CarrierCode): Promise<{ success: boolean; sid?: string; error?: string }> {
    // 1. Phone Gateway (free - spare phone)
    if (this.phoneGatewayConfigured) {
      const result = await this.sendViaPhoneGateway(to, message);
      if (result.success) return result;
      console.warn('Phone Gateway failed, trying next provider...');
    }

    // 2. Email-to-SMS (free - carrier gateway)
    if (carrier && CARRIER_GATEWAYS[carrier]) {
      const result = await this.sendViaEmailGateway(to, message, carrier);
      if (result.success) return result;
      console.warn('Email-to-SMS failed, trying next provider...');
    }

    // 3. VoIP.ms (paid - same number as FreePBX)
    if (this.voipMsConfigured) {
      const result = await this.sendViaVoipMs(to, message);
      if (result.success) return result;
      console.warn('VoIP.ms failed, trying next provider...');
    }

    // 4. Twilio (paid backup)
    if (this.twilioConfigured) {
      return this.sendViaTwilio(to, message);
    }

    // 5. Apps Script fallback
    return this.sendViaAppsScript(to, message);
  }

  // Send customer SMS (respects admin + rep + topic controls)
  async sendToCustomer(
    to: string,
    message: string,
    topic: keyof SMSConfig['defaultTopics'],
    customerPrefs?: CustomerSMSPreferences,
    carrier?: CarrierCode
  ): Promise<{ success: boolean; skipped?: boolean; reason?: string; sid?: string; error?: string }> {
    // Check global admin toggle
    const config = DEFAULT_SMS_CONFIG; // In production, load from settings
    if (!config.globalEnabled) {
      return { success: false, skipped: true, reason: 'SMS globally disabled by admin' };
    }

    // Check customer-specific preferences (set by rep)
    if (customerPrefs) {
      if (!customerPrefs.enabled) {
        return { success: false, skipped: true, reason: 'SMS disabled for this customer' };
      }
      if (!customerPrefs.topics[topic]) {
        return { success: false, skipped: true, reason: `Topic "${topic}" disabled for this customer` };
      }
    } else {
      // Use default topic settings
      if (!config.defaultTopics[topic]) {
        return { success: false, skipped: true, reason: `Topic "${topic}" disabled by default` };
      }
    }

    return this.send(to, message, carrier);
  }

  // ========================================
  // CONVENIENCE METHODS
  // ========================================

  // Send portal link to customer
  async sendPortalLink(to: string, customerName: string, portalUrl: string, repName: string): Promise<{ success: boolean; sid?: string; error?: string }> {
    const message = [
      `Hi ${customerName}! This is ${repName} from River City Roofing Solutions.`,
      ``,
      `Your project portal is ready. View your storm report, job progress, and documents here:`,
      portalUrl,
      ``,
      `Questions? Reply to this text or call (256) 274-8530.`,
    ].join('\n');

    return this.sendToCustomer(to, message, 'portalLinks');
  }

  // Send delivery reminder
  async sendDeliveryReminder(
    to: string,
    customerName: string,
    deliveryDate: string,
    timeWindow?: string,
    customerPrefs?: CustomerSMSPreferences
  ): Promise<{ success: boolean; sid?: string; error?: string }> {
    const message = [
      `Hi ${customerName}, this is River City Roofing Solutions.`,
      ``,
      `Your material delivery is scheduled for ${deliveryDate}${timeWindow ? ` (${timeWindow})` : ''}.`,
      `Please ensure the delivery area is accessible.`,
      ``,
      `Questions? Call (256) 274-8530.`,
    ].join('\n');

    return this.sendToCustomer(to, message, 'deliveryReminders', customerPrefs);
  }

  // Send appointment reminder
  async sendAppointmentReminder(
    to: string,
    customerName: string,
    appointmentType: string,
    dateTime: string,
    repName: string,
    customerPrefs?: CustomerSMSPreferences
  ): Promise<{ success: boolean; sid?: string; error?: string }> {
    const message = [
      `Hi ${customerName}, this is River City Roofing Solutions.`,
      ``,
      `Reminder: Your ${appointmentType} is scheduled for ${dateTime}.`,
      `${repName} will be there. Please have someone 18+ available.`,
      ``,
      `Need to reschedule? Call (256) 274-8530.`,
    ].join('\n');

    return this.sendToCustomer(to, message, 'appointmentReminders', customerPrefs);
  }

  // Send job status update
  async sendStatusUpdate(
    to: string,
    customerName: string,
    status: string,
    details: string,
    portalUrl?: string,
    customerPrefs?: CustomerSMSPreferences
  ): Promise<{ success: boolean; sid?: string; error?: string }> {
    const message = [
      `Hi ${customerName}, update from River City Roofing:`,
      ``,
      `Status: ${status}`,
      details,
      portalUrl ? `\nView details: ${portalUrl}` : '',
      ``,
      `Questions? Call (256) 274-8530.`,
    ].filter(Boolean).join('\n');

    return this.sendToCustomer(to, message, 'statusUpdates', customerPrefs);
  }

  // Check if any SMS provider is configured
  isConfigured(): boolean {
    return this.phoneGatewayConfigured || this.emailToSmsEnabled || this.voipMsConfigured || this.twilioConfigured || !!process.env.NEXT_PUBLIC_GOOGLE_SCRIPT_ENDPOINT;
  }

  // Get status info for all providers
  getStatus(): { provider: string; configured: boolean; allProviders: { name: string; configured: boolean; priority: number }[] } {
    const providers = [
      { name: 'Phone Gateway (free)', configured: this.phoneGatewayConfigured, priority: 1 },
      { name: 'Email-to-SMS (free)', configured: !!process.env.NEXT_PUBLIC_GOOGLE_SCRIPT_ENDPOINT, priority: 2 },
      { name: 'VoIP.ms ($0.01/msg)', configured: this.voipMsConfigured, priority: 3 },
      { name: 'Twilio ($0.008/msg)', configured: this.twilioConfigured, priority: 4 },
      { name: 'Google Apps Script', configured: !!process.env.NEXT_PUBLIC_GOOGLE_SCRIPT_ENDPOINT, priority: 5 },
    ];

    const active = providers.find(p => p.configured);
    return {
      provider: active?.name || 'None',
      configured: !!active,
      allProviders: providers,
    };
  }
}

export const smsService = new SMSService();
export default smsService;
