import {
  Megaphone,
  MapPin,
  BarChart3,
  Target,
  Heart,
} from 'lucide-react';
import type { WalkthroughData } from './types';

export const bostonWalkthrough: WalkthroughData = {
  slug: 'boston',
  name: 'Boston',
  role: 'Marketing Director',
  greeting: 'Hey Boston! Here\'s your marketing toolkit in RoofStack.',
  description: 'Marketing dashboard, Check My Address tool, SEO/analytics, lead capture, and community engagement.',
  icon: Megaphone,
  accentColor: 'text-fuchsia-400',
  accentGradient: 'from-fuchsia-500/20 to-pink-500/20',
  borderColor: 'border-fuchsia-500/30',
  sections: [
    {
      id: 'marketing-dashboard',
      number: 1,
      title: 'Marketing Dashboard',
      description: 'Your marketing command center — campaign performance, lead sources, and ROI tracking.',
      icon: Megaphone,
      iconColor: 'text-fuchsia-400',
      steps: [
        {
          title: 'Dashboard Overview',
          bullets: [
            'The marketing section of the Command Center shows lead source performance.',
            'Track which channels drive the most leads: website, referrals, door-knocking, social media.',
            'View cost-per-lead by channel to optimize marketing spend.',
            'The "This Month" vs "Last Month" comparison shows trending performance.',
          ],
          tryItLink: { label: 'View Command Center', href: '/command-center' },
        },
        {
          title: 'Lead Source Analytics',
          bullets: [
            'Every lead is tagged with a source when it enters the system.',
            'The lead source report shows conversion rates from lead → inspection → sale for each channel.',
            'Identify your best-performing sources and double down on what works.',
            'Use UTM parameters on digital campaigns for granular tracking.',
          ],
        },
        {
          title: 'Campaign Tracking',
          bullets: [
            'Log marketing campaigns in the system to track their ROI.',
            'Associate leads with specific campaigns for accurate attribution.',
            'Compare campaign performance over time to spot trends.',
            'Share campaign reports with Chris during weekly marketing reviews.',
          ],
          tip: 'Pull the lead source report every Monday morning to have fresh data for the week\'s marketing planning.',
        },
      ],
    },
    {
      id: 'check-my-address',
      number: 2,
      title: 'Check My Address Tool',
      description: 'The public-facing hail/storm damage checker that captures leads from homeowners.',
      icon: MapPin,
      iconColor: 'text-red-400',
      steps: [
        {
          title: 'How Check My Address Works',
          bullets: [
            'Homeowners visit /check-my-address on the website and enter their address.',
            'The system checks NWS storm data and hail reports for their area.',
            'Results show recent storm activity, hail size, and a risk assessment.',
            'If there\'s been storm activity, a contact form lets them request a free inspection.',
          ],
          tryItLink: { label: 'Try Check My Address', href: '/check-my-address' },
        },
        {
          title: 'Lead Capture Flow',
          bullets: [
            'When a homeowner submits the form, a lead is auto-created in the system.',
            'The lead is tagged with source "Check My Address" and includes the storm data.',
            'The office receives a notification to assign the lead to a rep.',
            'Storm data is attached to the lead so the rep has context before calling.',
          ],
        },
        {
          title: 'Promoting the Tool',
          bullets: [
            'Share the Check My Address link on social media after storms.',
            'Include the link in door-hanger flyers and direct mail campaigns.',
            'Add it to your email signature and business cards.',
            'The tool is already linked in the website header, footer, and homepage CTA.',
          ],
          tip: 'After every significant storm, post the Check My Address link on all social media channels within 2 hours for maximum lead capture.',
        },
      ],
    },
    {
      id: 'seo-analytics',
      number: 3,
      title: 'SEO & Website Analytics',
      description: 'Monitor website traffic, search rankings, and content performance.',
      icon: BarChart3,
      iconColor: 'text-green-400',
      steps: [
        {
          title: 'Google Analytics Overview',
          bullets: [
            'The website uses Google Analytics (GA4) with ID G-Y8PB85BZC5.',
            'Track page views, session duration, bounce rate, and user demographics.',
            'Monitor which pages get the most traffic and which convert best.',
            'Check the real-time view during active campaigns to see immediate impact.',
          ],
        },
        {
          title: 'SEO Structured Data',
          bullets: [
            'All public pages have JSON-LD structured data for better search engine visibility.',
            'Service pages include LocalBusiness schema with address, phone, and service areas.',
            'Blog posts use Article schema for rich snippets in search results.',
            'The FAQ pages use FAQPage schema for featured snippet eligibility.',
          ],
        },
        {
          title: 'Content Strategy',
          bullets: [
            'Blog posts target local SEO keywords: "roofing contractor Huntsville AL", etc.',
            'Service area pages are optimized for each city and county we serve.',
            'The website covers 367+ pages with comprehensive local content.',
            'Monitor top-performing blog posts and create related follow-up content.',
          ],
          tip: 'Review Google Analytics weekly. Look for pages with high traffic but low conversion — they may need better CTAs.',
        },
      ],
    },
    {
      id: 'lead-capture',
      number: 4,
      title: 'Lead Capture & Forms',
      description: 'How website forms work, where leads come from, and how to optimize conversions.',
      icon: Target,
      iconColor: 'text-blue-400',
      steps: [
        {
          title: 'Website Contact Forms',
          bullets: [
            'The main contact form is on the /contact page and in the website header.',
            'Form submissions create a lead in Google Sheets and trigger an email notification.',
            'Required fields: name, phone, and service type. Email and address are optional but helpful.',
            'Form submissions also appear in the admin lead dashboard.',
          ],
        },
        {
          title: 'Referral Program',
          bullets: [
            'The referral form at /referral captures both the referrer and prospect info.',
            'Referral leads get tagged as "Referral" source for tracking.',
            'Use the referral link in customer follow-up emails to encourage word-of-mouth.',
            'Track referral conversion rates to measure program effectiveness.',
          ],
        },
        {
          title: 'Optimizing Conversions',
          bullets: [
            'Every page should have at least one clear CTA (call-to-action).',
            'The phone number (256) 274-8530 is clickable on mobile for instant calls.',
            'Test different CTA copy and placement to improve form submission rates.',
            'Monitor form abandonment — if people start but don\'t finish, simplify the form.',
          ],
          tip: 'A/B test your CTAs monthly. Even small changes like button color or wording can significantly impact conversion rates.',
        },
      ],
    },
    {
      id: 'community',
      number: 5,
      title: 'Community & Social Engagement',
      description: 'Managing RCRS\'s community presence and social media content strategy.',
      icon: Heart,
      iconColor: 'text-rose-400',
      steps: [
        {
          title: 'Social Media Strategy',
          bullets: [
            'Post consistently across Facebook, Instagram, and Google Business Profile.',
            'Content mix: 40% educational (roofing tips), 30% project showcases, 20% community, 10% promotions.',
            'Use before/after photos from completed jobs (get customer permission first).',
            'Respond to all comments and messages within 4 hours during business hours.',
          ],
        },
        {
          title: 'Review Management',
          bullets: [
            'Encourage satisfied customers to leave Google reviews after job completion.',
            'Respond to every review — positive and negative — professionally and promptly.',
            'Negative reviews should be addressed publicly, then resolved privately.',
            'Track review volume and average rating monthly.',
          ],
        },
        {
          title: 'Community Involvement',
          bullets: [
            'Document RCRS community involvement: sponsorships, charity work, local events.',
            'Create content around community events for social media and the blog.',
            'Partner with local businesses for cross-promotion opportunities.',
            'Track community engagement metrics: event attendance, partnership leads, brand mentions.',
          ],
          tip: 'After every completed project, text the customer a direct Google review link. The best time to ask is right after they express satisfaction.',
        },
      ],
    },
  ],
};
