// QR Code Generator Service
// Generates QR codes for customer portal links

import QRCode from 'qrcode';

export interface QRCodeOptions {
  width?: number;
  margin?: number;
  color?: {
    dark?: string;
    light?: string;
  };
  errorCorrectionLevel?: 'L' | 'M' | 'Q' | 'H';
}

export interface QRCodeResult {
  success: boolean;
  dataUrl?: string;
  buffer?: Buffer;
  svg?: string;
  error?: string;
}

const DEFAULT_OPTIONS: QRCodeOptions = {
  width: 300,
  margin: 2,
  color: {
    dark: '#16a34a', // River City green
    light: '#ffffff',
  },
  errorCorrectionLevel: 'M',
};

class QRGenerator {
  private baseUrl: string;

  constructor() {
    this.baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://rivercityroofingsolutions.com';
  }

  // Generate portal URL from token
  getPortalUrl(accessToken: string): string {
    return `${this.baseUrl}/my/${accessToken}`;
  }

  // Generate QR code as data URL (base64 PNG)
  async generateDataUrl(
    url: string,
    options: QRCodeOptions = {}
  ): Promise<QRCodeResult> {
    try {
      const mergedOptions = { ...DEFAULT_OPTIONS, ...options };

      const dataUrl = await QRCode.toDataURL(url, {
        width: mergedOptions.width,
        margin: mergedOptions.margin,
        color: mergedOptions.color,
        errorCorrectionLevel: mergedOptions.errorCorrectionLevel,
      });

      return {
        success: true,
        dataUrl,
      };
    } catch (error) {
      console.error('Error generating QR code data URL:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to generate QR code',
      };
    }
  }

  // Generate QR code as PNG buffer
  async generateBuffer(
    url: string,
    options: QRCodeOptions = {}
  ): Promise<QRCodeResult> {
    try {
      const mergedOptions = { ...DEFAULT_OPTIONS, ...options };

      const buffer = await QRCode.toBuffer(url, {
        type: 'png',
        width: mergedOptions.width,
        margin: mergedOptions.margin,
        color: mergedOptions.color,
        errorCorrectionLevel: mergedOptions.errorCorrectionLevel,
      });

      return {
        success: true,
        buffer,
      };
    } catch (error) {
      console.error('Error generating QR code buffer:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to generate QR code',
      };
    }
  }

  // Generate QR code as SVG string
  async generateSvg(
    url: string,
    options: QRCodeOptions = {}
  ): Promise<QRCodeResult> {
    try {
      const mergedOptions = { ...DEFAULT_OPTIONS, ...options };

      const svg = await QRCode.toString(url, {
        type: 'svg',
        width: mergedOptions.width,
        margin: mergedOptions.margin,
        color: mergedOptions.color,
        errorCorrectionLevel: mergedOptions.errorCorrectionLevel,
      });

      return {
        success: true,
        svg,
      };
    } catch (error) {
      console.error('Error generating QR code SVG:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to generate QR code',
      };
    }
  }

  // Generate QR code for a portal access token
  async generateForPortal(
    accessToken: string,
    options: QRCodeOptions = {}
  ): Promise<QRCodeResult> {
    const portalUrl = this.getPortalUrl(accessToken);
    return this.generateBuffer(portalUrl, options);
  }

  // Generate QR code for a portal as data URL
  async generateForPortalDataUrl(
    accessToken: string,
    options: QRCodeOptions = {}
  ): Promise<QRCodeResult> {
    const portalUrl = this.getPortalUrl(accessToken);
    return this.generateDataUrl(portalUrl, options);
  }

  // Generate QR code with custom branding
  async generateBrandedQR(
    url: string,
    options: QRCodeOptions = {}
  ): Promise<QRCodeResult> {
    // Use River City brand colors by default
    const brandedOptions: QRCodeOptions = {
      ...options,
      width: options.width || 400,
      margin: options.margin || 3,
      color: {
        dark: options.color?.dark || '#16a34a', // River City green
        light: options.color?.light || '#ffffff',
      },
      errorCorrectionLevel: options.errorCorrectionLevel || 'H', // Higher correction for logo overlay
    };

    return this.generateBuffer(url, brandedOptions);
  }

  // Generate multiple QR codes in batch
  async generateBatch(
    tokens: string[],
    options: QRCodeOptions = {}
  ): Promise<Map<string, QRCodeResult>> {
    const results = new Map<string, QRCodeResult>();

    await Promise.all(
      tokens.map(async (token) => {
        const result = await this.generateForPortal(token, options);
        results.set(token, result);
      })
    );

    return results;
  }

  // Validate that a URL can be encoded
  validateUrl(url: string): boolean {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }

  // Get optimal QR code size based on content length
  getOptimalSize(url: string): number {
    const length = url.length;
    if (length < 50) return 200;
    if (length < 100) return 250;
    if (length < 150) return 300;
    return 350;
  }
}

// Export singleton instance
export const qrGenerator = new QRGenerator();

// Export default options for reference
export { DEFAULT_OPTIONS };
