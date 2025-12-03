// Customer Portal Service
// Manages customer access tokens, documents, and portal data

import crypto from 'crypto';

export interface CustomerPortalAccess {
  accessToken: string;
  customerId: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  customerAddress: string;
  salesRepId: string;
  salesRepName: string;
  salesRepSlug: string;
  jobId?: string;
  createdAt: string;
  expiresAt?: string; // Optional expiration
  lastAccessedAt?: string;
  isActive: boolean;
}

export interface CustomerAppointment {
  appointmentId: string;
  customerId: string;
  type: 'inspection' | 'estimate' | 'install_start' | 'install_complete' | 'final_walkthrough' | 'other';
  title: string;
  description?: string;
  scheduledDate: string;
  scheduledTime: string;
  duration: number; // minutes
  status: 'scheduled' | 'confirmed' | 'completed' | 'cancelled' | 'rescheduled';
  assignedTo: string;
  notes?: string;
  createdAt: string;
}

export interface CustomerDocument {
  documentId: string;
  customerId: string;
  type: 'estimate' | 'contract' | 'invoice' | 'warranty' | 'permit' | 'inspection_report' | 'photo' | 'other';
  title: string;
  description?: string;
  fileUrl: string;
  fileType: string; // pdf, jpg, png, etc.
  fileSize?: number;
  uploadedAt: string;
  uploadedBy: string;
  isVisible: boolean; // Whether customer can see this
}

export interface CustomerMessage {
  messageId: string;
  customerId: string;
  direction: 'inbound' | 'outbound';
  channel: 'sms' | 'email' | 'portal';
  subject?: string;
  content: string;
  sentAt: string;
  readAt?: string;
  sentBy?: string;
}

export interface WeatherForecast {
  date: string;
  dayOfWeek: string;
  high: number;
  low: number;
  condition: string;
  icon: string;
  precipChance: number;
  windSpeed: number;
  humidity: number;
}

export interface HailReport {
  reportId: string;
  date: string;
  location: string;
  distance: number; // miles from customer address
  hailSize: string; // e.g., "1.25 inch"
  source: string; // NWS, HailRecon, etc.
  severity: 'minor' | 'moderate' | 'severe';
  latitude: number;
  longitude: number;
}

export interface PortalSettings {
  showWeather: boolean;
  showHailReports: boolean;
  showAppointments: boolean;
  showDocuments: boolean;
  showMessages: boolean;
  showJobProgress: boolean;
  allowFileUpload: boolean;
  allowMessages: boolean;
}

export const DEFAULT_PORTAL_SETTINGS: PortalSettings = {
  showWeather: true,
  showHailReports: true,
  showAppointments: true,
  showDocuments: true,
  showMessages: true,
  showJobProgress: true,
  allowFileUpload: true,
  allowMessages: true,
};

export interface CustomerPortalData {
  customer: CustomerPortalAccess;
  salesRep: {
    name: string;
    slug: string;
    phone: string;
    email: string;
    photo: string;
    position: string;
  };
  appointments: CustomerAppointment[];
  documents: CustomerDocument[];
  messages: CustomerMessage[];
  jobStatus?: {
    phase: string;
    progress: number;
    nextMilestone: string;
    estimatedCompletion?: string;
  };
  weather?: WeatherForecast[];
  hailReports?: HailReport[];
  settings?: PortalSettings;
}

class CustomerPortalService {
  // Generate secure access token
  generateAccessToken(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  // Generate short link code for SMS
  generateShortCode(): string {
    return crypto.randomBytes(4).toString('hex').toUpperCase();
  }

  // Create customer portal access
  createPortalAccess(data: {
    customerName: string;
    customerEmail: string;
    customerPhone: string;
    customerAddress: string;
    salesRepId: string;
    salesRepName: string;
    salesRepSlug: string;
    jobId?: string;
  }): CustomerPortalAccess {
    return {
      accessToken: this.generateAccessToken(),
      customerId: `CUST-${Date.now()}-${this.generateShortCode()}`,
      customerName: data.customerName,
      customerEmail: data.customerEmail,
      customerPhone: data.customerPhone,
      customerAddress: data.customerAddress,
      salesRepId: data.salesRepId,
      salesRepName: data.salesRepName,
      salesRepSlug: data.salesRepSlug,
      jobId: data.jobId,
      createdAt: new Date().toISOString(),
      isActive: true,
    };
  }

  // Generate customer portal URL
  getPortalUrl(accessToken: string): string {
    return `https://rivercityroofingsolutions.com/my/${accessToken}`;
  }

  // Generate sales rep intro link
  getSalesRepIntroUrl(salesRepSlug: string, customerToken?: string): string {
    const base = `https://rivercityroofingsolutions.com/team/${salesRepSlug}`;
    return customerToken ? `${base}?ref=${customerToken}` : base;
  }

  // Format phone for SMS
  formatPhoneForSMS(phone: string): string {
    return phone.replace(/\D/g, '').replace(/^1/, '');
  }

  // Generate SMS message templates
  getSMSTemplates(customer: CustomerPortalAccess) {
    const repUrl = this.getSalesRepIntroUrl(customer.salesRepSlug);
    const portalUrl = this.getPortalUrl(customer.accessToken);

    return {
      intro: `Hi ${customer.customerName.split(' ')[0]}! This is ${customer.salesRepName} from River City Roofing. Here's my profile with contact info: ${repUrl} - Looking forward to helping with your roof!`,

      portalInvite: `Hi ${customer.customerName.split(' ')[0]}! Your River City Roofing customer portal is ready. View appointments, documents & more: ${portalUrl}`,

      appointmentReminder: (apt: CustomerAppointment) =>
        `Reminder: Your ${apt.title} is scheduled for ${apt.scheduledDate} at ${apt.scheduledTime}. Questions? Reply to this text or call ${customer.salesRepName}.`,

      estimateReady: `Great news ${customer.customerName.split(' ')[0]}! Your roof estimate is ready to view: ${portalUrl} - ${customer.salesRepName}`,

      installScheduled: (date: string) =>
        `Your roof installation is scheduled to begin ${date}! View details & weather forecast: ${portalUrl}`,

      jobComplete: `Congratulations! Your new roof is complete. View warranty info & final photos: ${portalUrl} - Thank you for choosing River City Roofing!`,
    };
  }

  // Generate email templates
  getEmailTemplates(customer: CustomerPortalAccess) {
    const repUrl = this.getSalesRepIntroUrl(customer.salesRepSlug);
    const portalUrl = this.getPortalUrl(customer.accessToken);

    return {
      intro: {
        subject: `Meet Your Roofing Specialist - ${customer.salesRepName}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #16a34a;">Welcome to River City Roofing!</h2>
            <p>Hi ${customer.customerName},</p>
            <p>Thank you for your interest in River City Roofing Solutions. I'm ${customer.salesRepName}, and I'll be your dedicated roofing specialist.</p>
            <p>Learn more about me and my experience:</p>
            <a href="${repUrl}" style="display: inline-block; background: #16a34a; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; margin: 16px 0;">View My Profile</a>
            <p>I look forward to helping you with your roofing needs!</p>
            <p>Best regards,<br>${customer.salesRepName}<br>River City Roofing Solutions</p>
          </div>
        `,
      },

      portalInvite: {
        subject: `Your Customer Portal is Ready - River City Roofing`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #16a34a;">Your Customer Portal is Ready!</h2>
            <p>Hi ${customer.customerName},</p>
            <p>We've set up a personal portal just for you where you can:</p>
            <ul>
              <li>View upcoming appointments</li>
              <li>Access estimates, contracts & invoices</li>
              <li>Track your project status</li>
              <li>See weather forecasts for install days</li>
              <li>Contact your sales rep directly</li>
            </ul>
            <a href="${portalUrl}" style="display: inline-block; background: #16a34a; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; margin: 16px 0;">Access Your Portal</a>
            <p>Questions? Reply to this email or call us anytime.</p>
            <p>- The River City Roofing Team</p>
          </div>
        `,
      },
    };
  }

  // Fetch weather forecast (using Open-Meteo - free, no API key needed)
  async getWeatherForecast(latitude: number, longitude: number): Promise<WeatherForecast[]> {
    try {
      const response = await fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max,weather_code,wind_speed_10m_max&temperature_unit=fahrenheit&wind_speed_unit=mph&timezone=America/Chicago&forecast_days=5`
      );

      if (!response.ok) throw new Error('Weather API error');

      const data = await response.json();
      const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

      return data.daily.time.map((date: string, i: number) => {
        const weatherCode = data.daily.weather_code[i];
        return {
          date,
          dayOfWeek: days[new Date(date).getDay()],
          high: Math.round(data.daily.temperature_2m_max[i]),
          low: Math.round(data.daily.temperature_2m_min[i]),
          condition: this.getWeatherCondition(weatherCode),
          icon: this.getWeatherIcon(weatherCode),
          precipChance: data.daily.precipitation_probability_max[i] || 0,
          windSpeed: Math.round(data.daily.wind_speed_10m_max[i]),
          humidity: 0, // Not available in free tier
        };
      });
    } catch (error) {
      console.error('Error fetching weather:', error);
      return [];
    }
  }

  // Convert weather code to condition string
  private getWeatherCondition(code: number): string {
    const conditions: Record<number, string> = {
      0: 'Clear',
      1: 'Mainly Clear',
      2: 'Partly Cloudy',
      3: 'Overcast',
      45: 'Foggy',
      48: 'Foggy',
      51: 'Light Drizzle',
      53: 'Drizzle',
      55: 'Heavy Drizzle',
      61: 'Light Rain',
      63: 'Rain',
      65: 'Heavy Rain',
      71: 'Light Snow',
      73: 'Snow',
      75: 'Heavy Snow',
      77: 'Snow Grains',
      80: 'Light Showers',
      81: 'Showers',
      82: 'Heavy Showers',
      85: 'Snow Showers',
      86: 'Heavy Snow Showers',
      95: 'Thunderstorm',
      96: 'Thunderstorm with Hail',
      99: 'Severe Thunderstorm',
    };
    return conditions[code] || 'Unknown';
  }

  // Get weather icon
  private getWeatherIcon(code: number): string {
    if (code === 0) return 'sun';
    if (code <= 3) return 'cloud-sun';
    if (code <= 48) return 'cloud';
    if (code <= 55) return 'cloud-drizzle';
    if (code <= 65) return 'cloud-rain';
    if (code <= 77) return 'cloud-snow';
    if (code <= 82) return 'cloud-rain';
    if (code <= 86) return 'cloud-snow';
    return 'cloud-lightning';
  }

  // Fetch NWS hail reports (free API)
  async getHailReports(latitude: number, longitude: number, daysBack: number = 30): Promise<HailReport[]> {
    try {
      // NWS Storm Reports API
      const endDate = new Date();
      const startDate = new Date(endDate.getTime() - daysBack * 24 * 60 * 60 * 1000);

      const startStr = startDate.toISOString().slice(0, 10);
      const endStr = endDate.toISOString().slice(0, 10);

      // Using Iowa State Mesonet (free, comprehensive)
      const response = await fetch(
        `https://mesonet.agron.iastate.edu/geojson/lsr.php?sts=${startStr}T00:00:00Z&ets=${endStr}T23:59:59Z&wfos=HUN&type=H`
      );

      if (!response.ok) return [];

      const data = await response.json();
      const reports: HailReport[] = [];

      if (data.features) {
        data.features.forEach((feature: any, index: number) => {
          const props = feature.properties;
          const coords = feature.geometry.coordinates;

          // Calculate distance from customer
          const distance = this.calculateDistance(
            latitude, longitude,
            coords[1], coords[0]
          );

          // Only include reports within 50 miles
          if (distance <= 50) {
            reports.push({
              reportId: `HAIL-${index}-${Date.now()}`,
              date: props.valid || props.utc_valid,
              location: props.city || 'Unknown',
              distance: Math.round(distance * 10) / 10,
              hailSize: props.magnitude ? `${props.magnitude} inch` : 'Unknown',
              source: 'NWS',
              severity: this.getHailSeverity(props.magnitude),
              latitude: coords[1],
              longitude: coords[0],
            });
          }
        });
      }

      return reports.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    } catch (error) {
      console.error('Error fetching hail reports:', error);
      return [];
    }
  }

  // Determine hail severity based on size
  private getHailSeverity(size: number): 'minor' | 'moderate' | 'severe' {
    if (!size || size < 1) return 'minor';
    if (size < 1.75) return 'moderate';
    return 'severe';
  }

  // Calculate distance between two GPS points
  private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 3959; // Earth's radius in miles
    const dLat = this.toRad(lat2 - lat1);
    const dLon = this.toRad(lon2 - lon1);
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(this.toRad(lat1)) * Math.cos(this.toRad(lat2)) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }

  private toRad(deg: number): number {
    return deg * Math.PI / 180;
  }

  // Job status phases
  getJobPhases() {
    return [
      { id: 'lead', label: 'Lead', progress: 0 },
      { id: 'inspection', label: 'Inspection Scheduled', progress: 10 },
      { id: 'estimate', label: 'Estimate Provided', progress: 20 },
      { id: 'contract', label: 'Contract Signed', progress: 30 },
      { id: 'permit', label: 'Permit Approved', progress: 40 },
      { id: 'materials', label: 'Materials Ordered', progress: 50 },
      { id: 'scheduled', label: 'Install Scheduled', progress: 60 },
      { id: 'in_progress', label: 'Installation In Progress', progress: 75 },
      { id: 'quality_check', label: 'Quality Check', progress: 90 },
      { id: 'complete', label: 'Project Complete', progress: 100 },
    ];
  }
}

export const customerPortalService = new CustomerPortalService();
