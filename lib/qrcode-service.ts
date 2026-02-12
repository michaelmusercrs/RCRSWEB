// QR Code Generation Service
// Uses Google Charts API for QR code generation (no dependencies needed)

export interface QRCodeOptions {
  size?: number;
  margin?: number;
  errorCorrection?: 'L' | 'M' | 'Q' | 'H';
  format?: 'png' | 'svg';
}

class QRCodeService {
  private baseUrl = 'https://chart.googleapis.com/chart';

  // Generate QR code URL for Google Charts API
  generateQRCodeUrl(data: string, options: QRCodeOptions = {}): string {
    const {
      size = 200,
      margin = 4,
      errorCorrection = 'M',
    } = options;

    const params = new URLSearchParams({
      cht: 'qr',
      chs: `${size}x${size}`,
      chl: data,
      chld: `${errorCorrection}|${margin}`,
    });

    return `${this.baseUrl}?${params.toString()}`;
  }

  // Generate portal link QR code
  generatePortalQRCode(accessToken: string, options?: QRCodeOptions): string {
    const portalUrl = `https://rivercityroofingsolutions.com/my/${accessToken}`;
    return this.generateQRCodeUrl(portalUrl, options);
  }

  // Generate sales rep profile QR code
  generateRepProfileQRCode(slug: string, options?: QRCodeOptions): string {
    const profileUrl = `https://rivercityroofingsolutions.com/team/${slug}`;
    return this.generateQRCodeUrl(profileUrl, options);
  }

  // Generate contact vCard QR code
  generateVCardQRCode(
    name: string,
    phone: string,
    email: string,
    company: string = 'River City Roofing Solutions',
    title: string = 'Roofing Specialist',
    options?: QRCodeOptions
  ): string {
    const vCard = [
      'BEGIN:VCARD',
      'VERSION:3.0',
      `FN:${name}`,
      `ORG:${company}`,
      `TITLE:${title}`,
      `TEL;TYPE=WORK,VOICE:${phone}`,
      `EMAIL:${email}`,
      'URL:https://rivercityroofingsolutions.com',
      'END:VCARD',
    ].join('\n');

    return this.generateQRCodeUrl(vCard, options);
  }

  // Generate phone call QR code
  generatePhoneQRCode(phone: string, options?: QRCodeOptions): string {
    const cleanPhone = phone.replace(/\D/g, '');
    return this.generateQRCodeUrl(`tel:+1${cleanPhone}`, options);
  }

  // Generate SMS QR code
  generateSMSQRCode(phone: string, message?: string, options?: QRCodeOptions): string {
    const cleanPhone = phone.replace(/\D/g, '');
    const smsUri = message
      ? `sms:+1${cleanPhone}?body=${encodeURIComponent(message)}`
      : `sms:+1${cleanPhone}`;
    return this.generateQRCodeUrl(smsUri, options);
  }

  // Generate email QR code
  generateEmailQRCode(email: string, subject?: string, body?: string, options?: QRCodeOptions): string {
    let mailtoUri = `mailto:${email}`;
    const params: string[] = [];

    if (subject) params.push(`subject=${encodeURIComponent(subject)}`);
    if (body) params.push(`body=${encodeURIComponent(body)}`);

    if (params.length > 0) {
      mailtoUri += `?${params.join('&')}`;
    }

    return this.generateQRCodeUrl(mailtoUri, options);
  }

  // Generate Google Maps location QR code
  generateMapQRCode(address: string, options?: QRCodeOptions): string {
    const mapsUrl = `https://maps.google.com/?q=${encodeURIComponent(address)}`;
    return this.generateQRCodeUrl(mapsUrl, options);
  }

  // Alternative: Generate SVG QR code using a simple algorithm
  // This can be used client-side without external API calls
  generateSVGQRCode(data: string, size: number = 200): string {
    // For now, return the Google Charts URL
    // In production, could implement a pure JS QR code generator
    return this.generateQRCodeUrl(data, { size, format: 'png' });
  }
}

export const qrCodeService = new QRCodeService();
