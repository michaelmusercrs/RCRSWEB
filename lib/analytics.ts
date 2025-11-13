/**
 * Analytics and Event Tracking
 * Track user interactions, form submissions, and business metrics
 */

// Google Analytics 4
export const GA_TRACKING_ID = process.env.NEXT_PUBLIC_GA_ID || '';

// Track page views
export const pageview = (url: string) => {
  if (typeof window !== 'undefined' && window.gtag) {
    window.gtag('config', GA_TRACKING_ID, {
      page_path: url,
    });
  }
};

// Track events
export const event = ({ action, category, label, value }: {
  action: string;
  category: string;
  label?: string;
  value?: number;
}) => {
  if (typeof window !== 'undefined' && window.gtag) {
    window.gtag('event', action, {
      event_category: category,
      event_label: label,
      value: value,
    });
  }
};

// Business-specific events
export const trackFormSubmission = (formType: string, inspectorPreference?: string) => {
  event({
    action: 'form_submission',
    category: 'Lead Generation',
    label: `${formType} - ${inspectorPreference || 'No preference'}`,
  });
};

export const trackInspectorSelection = (inspectorSlug: string) => {
  event({
    action: 'inspector_selected',
    category: 'Inspector Selection',
    label: inspectorSlug,
  });
};

export const trackTeamMemberView = (memberSlug: string) => {
  event({
    action: 'team_member_view',
    category: 'Team',
    label: memberSlug,
  });
};

export const trackServiceView = (serviceSlug: string) => {
  event({
    action: 'service_view',
    category: 'Services',
    label: serviceSlug,
  });
};

export const trackLocationView = (locationSlug: string) => {
  event({
    action: 'location_view',
    category: 'Locations',
    label: locationSlug,
  });
};

export const trackBlogView = (blogSlug: string) => {
  event({
    action: 'blog_view',
    category: 'Blog',
    label: blogSlug,
  });
};

export const trackPhoneClick = (source: string) => {
  event({
    action: 'phone_click',
    category: 'Contact',
    label: source,
  });
};

export const trackEmailClick = (source: string) => {
  event({
    action: 'email_click',
    category: 'Contact',
    label: source,
  });
};

// Lead scoring
export const trackLeadScore = (score: number, source: string) => {
  event({
    action: 'lead_score',
    category: 'Lead Quality',
    label: source,
    value: score,
  });
};

// Admin events
export const trackAdminAction = (action: string, entity: string) => {
  event({
    action: `admin_${action}`,
    category: 'Admin',
    label: entity,
  });
};

// TypeScript window extension
declare global {
  interface Window {
    gtag: (...args: any[]) => void;
  }
}
