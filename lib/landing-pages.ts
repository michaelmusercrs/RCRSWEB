/**
 * Landing Page Configuration
 * Defines campaign-specific landing pages for /p/[slug] routes
 */

export interface LandingPageConfig {
  slug: string;
  title: string;
  headline: string;
  subheadline: string;
  source: string;
  medium: string;
  campaign: string;
  assignedRep?: string;
  ctaText?: string;
  showTrustBadges?: boolean;
  showPhoneCTA?: boolean;
}

const defaultConfig: Omit<LandingPageConfig, 'slug' | 'title' | 'headline' | 'subheadline' | 'source' | 'medium' | 'campaign'> = {
  ctaText: 'Get Your Free Roof Inspection',
  showTrustBadges: true,
  showPhoneCTA: true,
};

export const landingPages: Record<string, LandingPageConfig> = {
  // Social Media
  facebook: {
    ...defaultConfig,
    slug: 'facebook',
    title: 'Free Roof Inspection | River City Roofing Solutions',
    headline: 'Get Your Free Roof Inspection Today',
    subheadline: 'North Alabama\'s #1 rated roofing company. Licensed, insured & trusted by thousands of homeowners.',
    source: 'facebook',
    medium: 'social',
    campaign: 'facebook-organic',
  },
  instagram: {
    ...defaultConfig,
    slug: 'instagram',
    title: 'Free Roof Inspection | River City Roofing Solutions',
    headline: 'Protect Your Home — Free Inspection',
    subheadline: 'Expert roofing services in Decatur, Huntsville & all of North Alabama.',
    source: 'instagram',
    medium: 'social',
    campaign: 'instagram-organic',
  },

  // Physical Marketing
  'door-hanger': {
    ...defaultConfig,
    slug: 'door-hanger',
    title: 'Your Neighbor Chose Us | River City Roofing Solutions',
    headline: 'We\'re Working In Your Neighborhood!',
    subheadline: 'Your neighbors trust us with their roof. Get a free inspection and see why we\'re the top choice in North Alabama.',
    source: 'door-hanger',
    medium: 'offline',
    campaign: 'door-hanger',
  },
  'yard-sign': {
    ...defaultConfig,
    slug: 'yard-sign',
    title: 'Free Roof Inspection | River City Roofing Solutions',
    headline: 'Saw Our Sign? Great Taste!',
    subheadline: 'We just finished a project nearby. Get your free inspection — no obligation, no pressure.',
    source: 'yard-sign',
    medium: 'offline',
    campaign: 'yard-sign',
  },

  // Networking & Referrals
  bni: {
    ...defaultConfig,
    slug: 'bni',
    title: 'BNI Partner Referral | River City Roofing Solutions',
    headline: 'Welcome, BNI Friends!',
    subheadline: 'Referred by a BNI partner? You\'re in great hands. Let\'s get your free roof inspection scheduled.',
    source: 'bni',
    medium: 'referral',
    campaign: 'bni-network',
  },
  referral: {
    ...defaultConfig,
    slug: 'referral',
    title: 'You Were Referred! | River City Roofing Solutions',
    headline: 'Someone You Trust Sent You Here',
    subheadline: 'We earn our business through referrals. Schedule your free inspection and see why our customers recommend us.',
    source: 'referral',
    medium: 'referral',
    campaign: 'customer-referral',
  },

  // Digital Advertising
  'google-ad': {
    ...defaultConfig,
    slug: 'google-ad',
    title: 'Top Rated Roofer Near You | River City Roofing Solutions',
    headline: 'North Alabama\'s Most Trusted Roofer',
    subheadline: 'Free inspections • Insurance claim experts • 5-star reviews. Schedule today!',
    source: 'google',
    medium: 'cpc',
    campaign: 'google-ads',
  },

  // QR Codes
  'qr-code': {
    ...defaultConfig,
    slug: 'qr-code',
    title: 'Free Roof Inspection | River City Roofing Solutions',
    headline: 'Smart Move — Let\'s Check Your Roof',
    subheadline: 'You scanned, we deliver. Get your free, no-obligation roof inspection today.',
    source: 'qr-code',
    medium: 'offline',
    campaign: 'qr-code',
  },

  // Team member QR codes
  'larry-qr': {
    ...defaultConfig,
    slug: 'larry-qr',
    title: 'Larry Ray | River City Roofing Solutions',
    headline: 'Larry Ray — Your Roofing Expert',
    subheadline: 'You met Larry, now let him take care of your roof. Free inspection, no pressure.',
    source: 'qr-code',
    medium: 'offline',
    campaign: 'larry-qr',
    assignedRep: 'larry-ray',
  },
  'brendon-qr': {
    ...defaultConfig,
    slug: 'brendon-qr',
    title: 'Brendon Payne | River City Roofing Solutions',
    headline: 'Brendon Payne — Your Roofing Expert',
    subheadline: 'Brendon will personally handle your project from start to finish. Schedule your free inspection.',
    source: 'qr-code',
    medium: 'offline',
    campaign: 'brendon-qr',
    assignedRep: 'brendon-payne',
  },
  'michael-qr': {
    ...defaultConfig,
    slug: 'michael-qr',
    title: 'Michael Roofing | River City Roofing Solutions',
    headline: 'Welcome From Michael',
    subheadline: 'Let\'s get your roof inspected — free, fast, and no strings attached.',
    source: 'qr-code',
    medium: 'offline',
    campaign: 'michael-qr',
    assignedRep: 'michael-mccary',
  },
};

/**
 * Get landing page config by slug. Returns a generic config for unknown slugs.
 */
export function getLandingPageConfig(slug: string): LandingPageConfig {
  if (landingPages[slug]) return landingPages[slug];

  // Generic fallback — never 404
  return {
    ...defaultConfig,
    slug,
    title: 'Free Roof Inspection | River City Roofing Solutions',
    headline: 'Get Your Free Roof Inspection',
    subheadline: 'North Alabama\'s #1 rated roofing company. Licensed, insured & trusted by your neighbors.',
    source: slug,
    medium: 'unknown',
    campaign: slug,
  };
}
