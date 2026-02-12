/**
 * Marketing Tracking Service
 * Handles Google Analytics 4, Facebook Pixel, Google Ads, and lead source attribution
 */

// Type declarations for tracking pixels
declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
    dataLayer?: unknown[];
    fbq?: (...args: unknown[]) => void;
    _fbq?: unknown;
  }
}

// Environment variables for tracking IDs
const GA_MEASUREMENT_ID = process.env.NEXT_PUBLIC_GA_ID || '';
const FB_PIXEL_ID = process.env.NEXT_PUBLIC_FB_PIXEL_ID || '';
const GOOGLE_ADS_ID = process.env.NEXT_PUBLIC_GOOGLE_ADS_ID || '';

// UTM Parameters interface
export interface UTMParams {
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_content?: string;
  utm_term?: string;
}

// Lead source data interface
export interface LeadSourceData {
  source: string;
  medium: string;
  campaign: string;
  content: string;
  term: string;
  referrer: string;
  landingPage: string;
  timestamp: string;
  gclid?: string;      // Google Click ID
  fbclid?: string;     // Facebook Click ID
  msclkid?: string;    // Microsoft/Bing Click ID
}

// Tracking event types
export type TrackingEventName =
  | 'page_view'
  | 'form_start'
  | 'form_submit'
  | 'form_complete'
  | 'phone_click'
  | 'email_click'
  | 'chat_open'
  | 'service_view'
  | 'quote_request'
  | 'inspection_request'
  | 'referral_submit'
  | 'customer_portal_login'
  | 'customer_portal_action'
  | 'contact_button_click'
  | 'cta_click';

export interface TrackingEventParams {
  event_category?: string;
  event_label?: string;
  value?: number;
  page_title?: string;
  page_location?: string;
  form_name?: string;
  service_type?: string;
  source_page?: string;
  button_text?: string;
  action_type?: string;
  [key: string]: string | number | undefined;
}

/**
 * Cookie consent status
 */
export type ConsentStatus = 'granted' | 'denied' | 'pending';

export interface ConsentSettings {
  analytics: ConsentStatus;
  marketing: ConsentStatus;
  timestamp?: string;
}

const CONSENT_COOKIE_NAME = 'rcrs_cookie_consent';
const UTM_STORAGE_KEY = 'rcrs_lead_source';
const UTM_EXPIRY_DAYS = 30;

class TrackingService {
  private initialized = false;
  private consentSettings: ConsentSettings = {
    analytics: 'pending',
    marketing: 'pending',
  };

  /**
   * Initialize tracking service
   * Called once when the app loads
   */
  initialize(): void {
    if (this.initialized || typeof window === 'undefined') return;

    // Load consent settings from cookie
    this.loadConsentSettings();

    // Capture UTM parameters on first visit
    this.captureUTMParams();

    // Check for Do Not Track
    if (this.isDoNotTrackEnabled()) {
      console.log('Do Not Track enabled - tracking disabled');
      return;
    }

    this.initialized = true;
  }

  /**
   * Check if Do Not Track is enabled
   */
  isDoNotTrackEnabled(): boolean {
    if (typeof window === 'undefined') return false;
    const dnt = navigator.doNotTrack || (window as unknown as { doNotTrack?: string }).doNotTrack;
    return dnt === '1' || dnt === 'yes';
  }

  /**
   * Load consent settings from cookie
   */
  loadConsentSettings(): void {
    if (typeof document === 'undefined') return;

    const cookie = document.cookie
      .split('; ')
      .find(row => row.startsWith(`${CONSENT_COOKIE_NAME}=`));

    if (cookie) {
      try {
        const value = decodeURIComponent(cookie.split('=')[1]);
        this.consentSettings = JSON.parse(value);
      } catch (e) {
        console.error('Error parsing consent cookie:', e);
      }
    }
  }

  /**
   * Save consent settings to cookie
   */
  saveConsentSettings(settings: ConsentSettings): void {
    if (typeof document === 'undefined') return;

    this.consentSettings = {
      ...settings,
      timestamp: new Date().toISOString(),
    };

    const expires = new Date();
    expires.setFullYear(expires.getFullYear() + 1);

    document.cookie = `${CONSENT_COOKIE_NAME}=${encodeURIComponent(JSON.stringify(this.consentSettings))}; expires=${expires.toUTCString()}; path=/; SameSite=Lax`;

    // Update Google consent mode
    this.updateGoogleConsent();

    // If marketing consent granted, initialize pixels
    if (settings.marketing === 'granted') {
      this.initializeFacebookPixel();
    }
  }

  /**
   * Get current consent settings
   */
  getConsentSettings(): ConsentSettings {
    return this.consentSettings;
  }

  /**
   * Check if consent has been given
   */
  hasConsent(type: 'analytics' | 'marketing'): boolean {
    return this.consentSettings[type] === 'granted';
  }

  /**
   * Check if consent banner should be shown
   */
  shouldShowConsentBanner(): boolean {
    return this.consentSettings.analytics === 'pending' &&
           this.consentSettings.marketing === 'pending';
  }

  /**
   * Update Google consent mode
   */
  private updateGoogleConsent(): void {
    if (typeof window === 'undefined' || !window.gtag) return;

    window.gtag('consent', 'update', {
      analytics_storage: this.consentSettings.analytics === 'granted' ? 'granted' : 'denied',
      ad_storage: this.consentSettings.marketing === 'granted' ? 'granted' : 'denied',
      ad_user_data: this.consentSettings.marketing === 'granted' ? 'granted' : 'denied',
      ad_personalization: this.consentSettings.marketing === 'granted' ? 'granted' : 'denied',
    });
  }

  /**
   * Initialize Facebook Pixel
   */
  private initializeFacebookPixel(): void {
    if (typeof window === 'undefined' || !FB_PIXEL_ID || window.fbq) return;

    // Facebook Pixel base code
    const fbq = function(...args: unknown[]) {
      if (fbq.callMethod) {
        fbq.callMethod.apply(fbq, args);
      } else {
        fbq.queue.push(args);
      }
    } as { (...args: unknown[]): void; callMethod?: (...args: unknown[]) => void; queue: unknown[][]; push: (args: unknown[]) => void; loaded: boolean; version: string };

    if (!window._fbq) window._fbq = fbq;
    fbq.push = fbq;
    fbq.loaded = true;
    fbq.version = '2.0';
    fbq.queue = [];
    window.fbq = fbq;

    // Load Facebook Pixel script
    const script = document.createElement('script');
    script.async = true;
    script.src = 'https://connect.facebook.net/en_US/fbevents.js';
    document.head.appendChild(script);

    // Initialize pixel
    window.fbq('init', FB_PIXEL_ID);
    window.fbq('track', 'PageView');
  }

  /**
   * Capture UTM parameters from URL
   */
  captureUTMParams(): void {
    if (typeof window === 'undefined') return;

    const params = new URLSearchParams(window.location.search);

    // Check if we have any tracking parameters
    const hasTrackingParams =
      params.has('utm_source') ||
      params.has('gclid') ||
      params.has('fbclid') ||
      params.has('msclkid');

    if (!hasTrackingParams) {
      // Check if we already have stored data
      const existing = this.getLeadSourceData();
      if (!existing) {
        // Store organic/direct visit
        this.storeLeadSourceData({
          source: document.referrer ? new URL(document.referrer).hostname : 'direct',
          medium: document.referrer ? 'referral' : 'none',
          campaign: '',
          content: '',
          term: '',
          referrer: document.referrer || '',
          landingPage: window.location.href,
          timestamp: new Date().toISOString(),
        });
      }
      return;
    }

    const leadSource: LeadSourceData = {
      source: params.get('utm_source') || this.inferSource(params),
      medium: params.get('utm_medium') || this.inferMedium(params),
      campaign: params.get('utm_campaign') || '',
      content: params.get('utm_content') || '',
      term: params.get('utm_term') || '',
      referrer: document.referrer || '',
      landingPage: window.location.href,
      timestamp: new Date().toISOString(),
      gclid: params.get('gclid') || undefined,
      fbclid: params.get('fbclid') || undefined,
      msclkid: params.get('msclkid') || undefined,
    };

    this.storeLeadSourceData(leadSource);
  }

  /**
   * Infer source from click IDs
   */
  private inferSource(params: URLSearchParams): string {
    if (params.has('gclid')) return 'google';
    if (params.has('fbclid')) return 'facebook';
    if (params.has('msclkid')) return 'bing';
    if (document.referrer) {
      const referrerHost = new URL(document.referrer).hostname;
      if (referrerHost.includes('google')) return 'google';
      if (referrerHost.includes('facebook') || referrerHost.includes('fb.')) return 'facebook';
      if (referrerHost.includes('bing')) return 'bing';
      return referrerHost;
    }
    return 'direct';
  }

  /**
   * Infer medium from click IDs
   */
  private inferMedium(params: URLSearchParams): string {
    if (params.has('gclid') || params.has('msclkid')) return 'cpc';
    if (params.has('fbclid')) return 'paid_social';
    if (document.referrer) return 'referral';
    return 'none';
  }

  /**
   * Store lead source data in localStorage
   */
  private storeLeadSourceData(data: LeadSourceData): void {
    if (typeof localStorage === 'undefined') return;

    const storageData = {
      ...data,
      expiresAt: new Date(Date.now() + UTM_EXPIRY_DAYS * 24 * 60 * 60 * 1000).toISOString(),
    };

    localStorage.setItem(UTM_STORAGE_KEY, JSON.stringify(storageData));
  }

  /**
   * Get stored lead source data
   */
  getLeadSourceData(): LeadSourceData | null {
    if (typeof localStorage === 'undefined') return null;

    const stored = localStorage.getItem(UTM_STORAGE_KEY);
    if (!stored) return null;

    try {
      const data = JSON.parse(stored);

      // Check if expired
      if (data.expiresAt && new Date(data.expiresAt) < new Date()) {
        localStorage.removeItem(UTM_STORAGE_KEY);
        return null;
      }

      return data as LeadSourceData;
    } catch {
      return null;
    }
  }

  /**
   * Get lead source summary for forms
   */
  getLeadSourceSummary(): string {
    const data = this.getLeadSourceData();
    if (!data) return 'Direct';

    const parts: string[] = [];
    if (data.source) parts.push(data.source);
    if (data.medium) parts.push(data.medium);
    if (data.campaign) parts.push(data.campaign);

    return parts.join(' / ') || 'Direct';
  }

  /**
   * Track an event
   */
  trackEvent(eventName: TrackingEventName, params?: TrackingEventParams): void {
    if (typeof window === 'undefined') return;
    if (this.isDoNotTrackEnabled()) return;

    // Add lead source to event params
    const leadSource = this.getLeadSourceData();
    const enrichedParams = {
      ...params,
      lead_source: leadSource?.source,
      lead_medium: leadSource?.medium,
      lead_campaign: leadSource?.campaign,
    };

    // Track in Google Analytics
    if (this.hasConsent('analytics') && window.gtag && GA_MEASUREMENT_ID) {
      window.gtag('event', eventName, enrichedParams);
    }

    // Track in Facebook Pixel
    if (this.hasConsent('marketing') && window.fbq && FB_PIXEL_ID) {
      const fbEventName = this.mapToFacebookEvent(eventName);
      if (fbEventName) {
        window.fbq('track', fbEventName, enrichedParams);
      }
    }

    // Track Google Ads conversions
    if (this.hasConsent('marketing') && window.gtag && GOOGLE_ADS_ID) {
      const conversionId = this.getGoogleAdsConversionId(eventName);
      if (conversionId) {
        window.gtag('event', 'conversion', {
          send_to: `${GOOGLE_ADS_ID}/${conversionId}`,
          ...enrichedParams,
        });
      }
    }
  }

  /**
   * Map internal events to Facebook standard events
   */
  private mapToFacebookEvent(eventName: TrackingEventName): string | null {
    const mapping: Record<string, string> = {
      page_view: 'PageView',
      form_start: 'InitiateCheckout',
      form_submit: 'SubmitApplication',
      form_complete: 'Lead',
      phone_click: 'Contact',
      quote_request: 'Lead',
      inspection_request: 'Lead',
      referral_submit: 'Lead',
      contact_button_click: 'Contact',
      cta_click: 'ViewContent',
    };
    return mapping[eventName] || null;
  }

  /**
   * Get Google Ads conversion ID for event
   * Configure these in your Google Ads account
   */
  private getGoogleAdsConversionId(eventName: TrackingEventName): string | null {
    // These should be configured based on your Google Ads conversion actions
    // Format: conversion_label from Google Ads
    const mapping: Record<string, string> = {
      form_complete: process.env.NEXT_PUBLIC_GADS_FORM_CONVERSION || '',
      phone_click: process.env.NEXT_PUBLIC_GADS_PHONE_CONVERSION || '',
      quote_request: process.env.NEXT_PUBLIC_GADS_QUOTE_CONVERSION || '',
    };
    return mapping[eventName] || null;
  }

  /**
   * Track page view
   */
  trackPageView(pagePath?: string, pageTitle?: string): void {
    this.trackEvent('page_view', {
      page_location: pagePath || (typeof window !== 'undefined' ? window.location.href : ''),
      page_title: pageTitle || (typeof document !== 'undefined' ? document.title : ''),
    });
  }

  /**
   * Track form interactions
   */
  trackFormStart(formName: string): void {
    this.trackEvent('form_start', { form_name: formName });
  }

  trackFormSubmit(formName: string): void {
    this.trackEvent('form_submit', { form_name: formName });
  }

  trackFormComplete(formName: string, additionalParams?: TrackingEventParams): void {
    this.trackEvent('form_complete', {
      form_name: formName,
      ...additionalParams,
    });
  }

  /**
   * Track phone clicks
   */
  trackPhoneClick(phoneNumber: string, sourcePage?: string): void {
    this.trackEvent('phone_click', {
      event_label: phoneNumber,
      source_page: sourcePage,
    });
  }

  /**
   * Track email clicks
   */
  trackEmailClick(email: string, sourcePage?: string): void {
    this.trackEvent('email_click', {
      event_label: email,
      source_page: sourcePage,
    });
  }

  /**
   * Track CTA button clicks
   */
  trackCTAClick(buttonText: string, sourcePage?: string): void {
    this.trackEvent('cta_click', {
      button_text: buttonText,
      source_page: sourcePage,
    });
  }

  /**
   * Track customer portal actions
   */
  trackPortalLogin(method: string): void {
    this.trackEvent('customer_portal_login', { event_label: method });
  }

  trackPortalAction(action: string, details?: string): void {
    this.trackEvent('customer_portal_action', {
      action_type: action,
      event_label: details,
    });
  }

  /**
   * Get formatted lead source for JobNimbus
   */
  getJobNimbusSource(): Record<string, string> {
    const data = this.getLeadSourceData();
    if (!data) {
      return {
        lead_source: 'Website - Direct',
        lead_source_detail: '',
      };
    }

    let source = 'Website';
    if (data.source === 'google' && data.medium === 'cpc') {
      source = 'Google Ads';
    } else if (data.source === 'facebook' || data.medium === 'paid_social') {
      source = 'Facebook Ads';
    } else if (data.source === 'bing' && data.medium === 'cpc') {
      source = 'Bing Ads';
    } else if (data.medium === 'organic') {
      source = `${data.source} Organic`;
    } else if (data.medium === 'referral') {
      source = `Referral - ${data.source}`;
    }

    return {
      lead_source: source,
      lead_source_detail: [
        data.campaign,
        data.content,
        data.term,
      ].filter(Boolean).join(' | '),
    };
  }
}

// Export singleton instance
export const trackingService = new TrackingService();

// Export convenience functions
export const initializeTracking = () => trackingService.initialize();
export const trackEvent = (name: TrackingEventName, params?: TrackingEventParams) =>
  trackingService.trackEvent(name, params);
export const trackPageView = (path?: string, title?: string) =>
  trackingService.trackPageView(path, title);
export const getLeadSource = () => trackingService.getLeadSourceData();
export const getLeadSourceSummary = () => trackingService.getLeadSourceSummary();
export const getJobNimbusSource = () => trackingService.getJobNimbusSource();
