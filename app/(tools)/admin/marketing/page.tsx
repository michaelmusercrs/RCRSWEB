'use client';

/**
 * Marketing Admin Page
 * Q1 2026 Marketing Platform for RCRS
 * - Marketing plan overview
 * - Ad variations with preview/copy
 * - Email templates
 * - Content calendar
 * - Campaign status tracking
 */

import { useState } from 'react';
import {
  BarChart3,
  Calendar,
  Mail,
  Megaphone,
  Copy,
  Eye,
  CheckCircle,
  Clock,
  AlertCircle,
  TrendingUp,
  Target,
  DollarSign,
  Users,
  ChevronDown,
  ChevronUp,
  X,
} from 'lucide-react';

// Marketing Plan Overview Data
const marketingOverview = {
  quarter: 'Q1 2026',
  themes: [
    { month: 'January', theme: 'New Year, New Roof', focus: 'Financing promotions, winter damage prevention' },
    { month: 'February', theme: 'Love Your Home', focus: 'Family values, home protection' },
    { month: 'March', theme: 'Storm Season Prep', focus: 'Storm damage awareness, emergency services' },
  ],
  kpis: [
    { label: 'Lead Generation', target: '150+ leads/month', icon: Users },
    { label: 'Website Traffic', target: '25% increase', icon: TrendingUp },
    { label: 'Email Open Rate', target: '25%+ average', icon: Mail },
    { label: 'Conversion Rate', target: '12%+ lead to estimate', icon: Target },
  ],
  budgetAllocation: [
    { channel: 'Digital Advertising', percentage: 40 },
    { channel: 'Email Marketing', percentage: 10 },
    { channel: 'Traditional/Direct Mail', percentage: 20 },
    { channel: 'Content Creation', percentage: 15 },
    { channel: 'Community Sponsorships', percentage: 10 },
    { channel: 'Contingency', percentage: 5 },
  ],
};

// 10 Ad Variations
const ads = [
  {
    id: 1,
    title: 'Family Values - General Brand',
    platform: 'Facebook/Instagram',
    format: 'Single Image',
    headline: 'Family-Owned. Community-Trusted.',
    body: "When you choose River City Roofing, you choose a family that cares. No corporate call centers—just real people who treat your home like their own. Free estimates. Quality workmanship. A name you can trust.",
    cta: 'Get Your Free Estimate',
    status: 'active',
  },
  {
    id: 2,
    title: '3-Minute Financing - Lead Gen',
    platform: 'Facebook/Instagram',
    format: 'Single Image',
    headline: 'New Roof? Apply in Just 3 Minutes.',
    body: "Don't wait on your roof repairs. Our instant financing application takes only 3 minutes—right from your phone. Get fast approval, affordable monthly payments, and peace of mind. No long waits. No complicated paperwork.",
    cta: "Apply Now - It's Fast & Easy",
    status: 'active',
  },
  {
    id: 3,
    title: 'Storm Damage - Urgency',
    platform: 'Facebook/Instagram',
    format: 'Single Image or Video',
    headline: "Storm Damage? Don't Wait—Call Today.",
    body: "Recent storms can cause hidden damage that gets worse over time. Our storm damage experts provide FREE inspections, handle insurance paperwork, and get your roof repaired fast. Protect your home before small problems become big expenses.",
    cta: 'Schedule Free Storm Inspection',
    status: 'scheduled',
  },
  {
    id: 4,
    title: 'Financing + Storm Combo',
    platform: 'Google Display Network',
    format: 'Banner Ad',
    headline: 'Storm Damage + Fast Financing = Peace of Mind',
    body: "Don't let unexpected roof damage drain your savings. Apply for financing in 3 minutes and get your storm repairs started today. Free inspections. Insurance assistance. Affordable payments.",
    cta: 'Get Started Today',
    status: 'draft',
  },
  {
    id: 5,
    title: 'Family Business - Trust Builder',
    platform: 'Facebook/Instagram',
    format: 'Carousel (3-4 images)',
    headline: 'Three Reasons Families Trust Us',
    body: 'Slide 1: Family-Owned & Operated—Your Neighbors, Not a Corporation\nSlide 2: "They treated us like family. Best roofing experience we\'ve had." - Local Customer\nSlide 3: Quality Craftsmanship on Every Project\nSlide 4: Fast Financing—Apply in 3 Minutes',
    cta: 'See Why Families Choose Us',
    status: 'active',
  },
  {
    id: 6,
    title: 'New Year Promotion - January',
    platform: 'Facebook/Instagram/Google',
    format: 'Single Image',
    headline: 'New Year. New Roof. New Payment Options.',
    body: "Start 2026 with a roof you can count on. This January, get a FREE inspection plus instant financing approval in just 3 minutes. Family-owned service. Quality you can trust. Payments that fit your budget.",
    cta: 'Claim Your Free Inspection',
    status: 'completed',
  },
  {
    id: 7,
    title: 'Love Your Home - February',
    platform: 'Facebook/Instagram',
    format: 'Single Image',
    headline: 'Show Your Home Some Love This February',
    body: "Your home protects your family—make sure your roof protects your home. This February, schedule a FREE roof inspection with our family-owned team. If repairs are needed, financing takes just 3 minutes to apply.",
    cta: 'Schedule Free Inspection',
    status: 'active',
  },
  {
    id: 8,
    title: 'Storm Season Prep - March',
    platform: 'Facebook/Instagram/Google',
    format: 'Video (15-30 seconds) or Single Image',
    headline: 'Storm Season Is Coming. Is Your Roof Ready?',
    body: "Don't wait for the first big storm to find out your roof has problems. Our FREE pre-storm inspections identify weak spots before they become leaks. Family-owned expertise. Fast financing if repairs are needed. Protect your home NOW.",
    cta: 'Get Pre-Storm Inspection',
    status: 'scheduled',
  },
  {
    id: 9,
    title: 'Insurance Help - Storm Focus',
    platform: 'Facebook/Google',
    format: 'Single Image',
    headline: 'Storm Damage? We Handle Your Insurance Claim.',
    body: "Filing insurance claims is stressful. Our storm damage experts document everything, communicate with your insurance company, and fight for the coverage you deserve. Family-owned attention. Professional results. Free inspection to start.",
    cta: 'Start Your Claim Today',
    status: 'scheduled',
  },
  {
    id: 10,
    title: 'Testimonial/Social Proof',
    platform: 'Facebook/Instagram',
    format: 'Single Image with Quote',
    headline: '"They Made It So Easy!"',
    body: '"We had storm damage and didn\'t know where to start. River City Roofing did the inspection, helped with our insurance, and got us approved for financing in 3 minutes. As a family-owned business, they really cared about getting it right. Highly recommend!" — Satisfied Customer',
    cta: 'Get Your Free Estimate',
    status: 'draft',
  },
];

// 5 Email Templates
const emailTemplates = [
  {
    id: 1,
    title: 'Welcome / New Lead Nurture',
    subject: 'Welcome to the River City Roofing Family!',
    trigger: 'Form submission',
    preview: 'You\'re in good hands with our family-owned team...',
    content: `Hi {{FirstName}},

Thank you for reaching out to us! As a family-owned roofing company, we're excited to help protect your home.

Here's what makes us different:

- Family-Owned & Operated: You'll work with real people who care—not a corporate call center.
- Instant Financing—Apply in 3 Minutes: Need a new roof but worried about the cost? Our fast financing application takes just 3 minutes.
- Storm Damage Experts: From inspection to insurance assistance, we handle it all.

What's Next?
One of our roofing specialists will contact you within 24 hours to schedule your FREE inspection.

Warm regards,
The River City Roofing Solutions Family`,
  },
  {
    id: 2,
    title: 'Storm Damage Alert',
    subject: 'Recent Storm? Get Your FREE Roof Inspection',
    trigger: 'Manual send to local list',
    preview: 'Hidden damage gets worse over time—schedule your free inspection today...',
    content: `Hi {{FirstName}},

Recent severe weather in our area may have caused damage to your roof that you can't see from the ground. Hidden damage leads to leaks, mold, and expensive repairs if left unchecked.

Our Storm Damage Experts Are Ready to Help:

- FREE Comprehensive Inspection
- Insurance Claim Assistance
- Fast Financing Available

As a family-owned business, we understand how stressful storm damage can be. That's why we respond quickly, communicate clearly, and stand behind every repair.

Don't wait for a small problem to become a big expense.

Protecting your home,
The River City Roofing Solutions Family`,
  },
  {
    id: 3,
    title: 'Financing Spotlight',
    subject: 'Your New Roof is Just 3 Minutes Away',
    trigger: '3-5 days after welcome',
    preview: 'Fast financing, affordable payments, no hassle—apply today...',
    content: `Hi {{FirstName}},

Worried about affording a new roof? Don't let budget concerns put your home at risk.

Our instant financing makes it easy:

How It Works:
Step 1: Apply online or in-person—takes just 3 minutes
Step 2: Get your approval decision fast
Step 3: Choose the monthly payment that works for you
Step 4: We install your new roof!

Why Homeowners Love Our Financing:
- Fast Application — 3 minutes, not 3 days
- Quick Decisions — Know your options right away
- Flexible Payments — Find a plan that fits your budget
- No Surprises — Clear terms you can understand

Your roof protects everything you love. Let us help you protect it.

The River City Roofing Solutions Family`,
  },
  {
    id: 4,
    title: 'Seasonal Check-In (Pre-Storm)',
    subject: 'Is Your Roof Ready for Storm Season?',
    trigger: 'Scheduled campaign (Feb/March)',
    preview: 'Free pre-storm inspections available—protect your home before severe weather hits...',
    content: `Hi {{FirstName}},

Spring storms will be here before you know it. Now is the perfect time to make sure your roof can handle whatever nature throws at it.

Schedule Your FREE Pre-Storm Inspection:

Our experienced team will:
- Identify Weak Spots — Find potential problems before they become leaks
- Check for Existing Damage — Spot wear and tear from winter weather
- Document Everything — Provide a detailed report of your roof's condition
- Recommend Solutions — Give you honest advice on what needs attention

Why Get Inspected Now?
- Avoid Emergency Repairs
- Beat the Rush
- Peace of Mind

If repairs are needed, we offer instant financing—apply in just 3 minutes.

Protecting homes. Protecting families.
The River City Roofing Solutions Family`,
  },
  {
    id: 5,
    title: 'Post-Estimate Follow-Up',
    subject: 'Your Roofing Estimate + Easy Next Steps',
    trigger: 'Manual or CRM trigger',
    preview: 'Review your estimate and explore financing options—we\'re here to help...',
    content: `Hi {{FirstName}},

It was great meeting with you! Attached you'll find your detailed roofing estimate.

Your Estimate Summary:
Project: {{ProjectType}}
Estimated Investment: {{EstimateAmount}}

Easy Financing—Just 3 Minutes to Apply:
- Apply in 3 minutes—online or by phone
- Get fast approval decisions
- Choose affordable monthly payments
- Start your project sooner

Why Choose River City Roofing?
- Family-Owned Values: We're not a corporate franchise.
- Quality Workmanship: We stand behind every project.
- Storm Damage Expertise: We handle insurance communication for you.

We appreciate you considering our family-owned business for your roofing needs.

Warm regards,
{{SalesRepName}}
River City Roofing Solutions`,
  },
];

// Content Calendar Data (simplified for display)
const contentCalendar = [
  { date: 'Jan 1', channel: 'Facebook/Instagram', type: 'Image Post', topic: 'New Year', status: 'completed' },
  { date: 'Jan 2', channel: 'Email', type: 'Newsletter', topic: 'Welcome 2026', status: 'completed' },
  { date: 'Jan 6', channel: 'Facebook', type: 'Image Post', topic: 'Winter Tips', status: 'completed' },
  { date: 'Jan 9', channel: 'Facebook', type: 'Ad Launch', topic: 'Financing', status: 'completed' },
  { date: 'Jan 22', channel: 'Facebook', type: 'Ad Refresh', topic: 'Family Values', status: 'completed' },
  { date: 'Feb 1', channel: 'Facebook/Instagram', type: 'Image Post', topic: 'Love Theme', status: 'active' },
  { date: 'Feb 2', channel: 'Facebook', type: 'Ad Launch', topic: 'February Campaign', status: 'active' },
  { date: 'Feb 14', channel: 'Instagram/Facebook', type: 'Image Post', topic: "Valentine's", status: 'scheduled' },
  { date: 'Feb 23', channel: 'Facebook/Instagram', type: 'Image Post', topic: 'Storm Prep', status: 'scheduled' },
  { date: 'Feb 28', channel: 'Email', type: 'Campaign', topic: 'Storm Prep', status: 'scheduled' },
  { date: 'Mar 1', channel: 'Facebook/Instagram', type: 'Image Post', topic: 'Storm Season', status: 'scheduled' },
  { date: 'Mar 2', channel: 'Facebook', type: 'Ad Launch', topic: 'Storm Urgency', status: 'scheduled' },
  { date: 'Mar 6', channel: 'Email', type: 'Campaign', topic: 'Storm Alert', status: 'scheduled' },
  { date: 'Mar 10', channel: 'Google Ads', type: 'Campaign', topic: 'Insurance Help', status: 'scheduled' },
  { date: 'Mar 20', channel: 'Facebook', type: 'Ad Launch', topic: 'Testimonial', status: 'scheduled' },
];

// Campaign Status Data
const campaignStatus = [
  { name: 'New Year Financing', status: 'completed', leads: 47, spend: '$1,250', ctr: '3.2%' },
  { name: 'Family Values Brand', status: 'active', leads: 23, spend: '$680', ctr: '2.8%' },
  { name: 'Love Your Home Feb', status: 'active', leads: 12, spend: '$340', ctr: '3.1%' },
  { name: 'Storm Damage March', status: 'scheduled', leads: '-', spend: '$0', ctr: '-' },
  { name: 'Insurance Assistance', status: 'scheduled', leads: '-', spend: '$0', ctr: '-' },
];

// Status badge component
function StatusBadge({ status }: { status: string }) {
  const styles = {
    active: 'bg-brand-green/20 text-brand-green border-brand-green/30',
    completed: 'bg-brand-green/20 text-blue-400 border-blue-500/30',
    scheduled: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    draft: 'bg-gray-400/20 text-neutral-400 border-gray-500/30',
  };
  const icons = {
    active: CheckCircle,
    completed: CheckCircle,
    scheduled: Clock,
    draft: AlertCircle,
  };
  const Icon = icons[status as keyof typeof icons] || AlertCircle;

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full border ${styles[status as keyof typeof styles] || styles.draft}`}>
      <Icon className="w-3 h-3" />
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

// Ad Card Component
function AdCard({
  ad,
  onPreview,
  onCopy,
}: {
  ad: typeof ads[0];
  onPreview: () => void;
  onCopy: () => void;
}) {
  return (
    <div className="bg-neutral-900 rounded-lg border border-white/10 p-4 hover:border-white/20 transition-shadow">
      <div className="flex items-start justify-between mb-3">
        <div>
          <h4 className="font-semibold text-white">{ad.title}</h4>
          <p className="text-xs text-neutral-500">{ad.platform} - {ad.format}</p>
        </div>
        <StatusBadge status={ad.status} />
      </div>
      <p className="text-sm text-neutral-300 font-medium mb-1">{ad.headline}</p>
      <p className="text-xs text-neutral-500 line-clamp-2 mb-3">{ad.body}</p>
      <div className="flex items-center gap-2">
        <button
          onClick={onPreview}
          className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-white/10 hover:bg-white/10 text-neutral-300 rounded-lg transition-colors"
        >
          <Eye className="w-3 h-3" />
          Preview
        </button>
        <button
          onClick={onCopy}
          className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-brand-green/10 hover:bg-brand-green/20 text-black rounded-lg transition-colors"
        >
          <Copy className="w-3 h-3" />
          Copy
        </button>
      </div>
    </div>
  );
}

// Email Template Card Component
function EmailCard({
  template,
  onPreview,
}: {
  template: typeof emailTemplates[0];
  onPreview: () => void;
}) {
  return (
    <div className="bg-neutral-900 rounded-lg border border-white/10 p-4 hover:border-white/20 transition-shadow">
      <div className="flex items-start justify-between mb-2">
        <h4 className="font-semibold text-white">{template.title}</h4>
        <span className="text-xs bg-white/10 text-neutral-400 px-2 py-1 rounded">{template.trigger}</span>
      </div>
      <p className="text-sm text-neutral-300 font-medium mb-1">Subject: {template.subject}</p>
      <p className="text-xs text-neutral-500 line-clamp-2 mb-3">{template.preview}</p>
      <button
        onClick={onPreview}
        className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-white/10 hover:bg-white/10 text-neutral-300 rounded-lg transition-colors"
      >
        <Eye className="w-3 h-3" />
        Preview Template
      </button>
    </div>
  );
}

// Modal Component
function Modal({
  isOpen,
  onClose,
  title,
  children,
}: {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-neutral-900 rounded-xl border border-white/10 max-w-2xl w-full mx-4 max-h-[80vh] overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-white/10 bg-black">
          <h3 className="text-lg font-semibold text-white">{title}</h3>
          <button
            onClick={onClose}
            className="p-1 hover:bg-white/10 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-neutral-500" />
          </button>
        </div>
        <div className="p-6 overflow-y-auto max-h-[calc(80vh-80px)]">
          {children}
        </div>
      </div>
    </div>
  );
}

export default function MarketingPage() {
  const [activeTab, setActiveTab] = useState<'overview' | 'ads' | 'emails' | 'calendar' | 'campaigns'>('overview');
  const [selectedAd, setSelectedAd] = useState<typeof ads[0] | null>(null);
  const [selectedEmail, setSelectedEmail] = useState<typeof emailTemplates[0] | null>(null);
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [expandedMonth, setExpandedMonth] = useState<string | null>('February');

  const handleCopyAd = (ad: typeof ads[0]) => {
    const text = `Headline: ${ad.headline}\n\nBody:\n${ad.body}\n\nCTA: ${ad.cta}`;
    navigator.clipboard.writeText(text);
    setCopiedId(ad.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const tabs = [
    { id: 'overview', label: 'Overview', icon: BarChart3 },
    { id: 'ads', label: 'Ad Variations', icon: Megaphone },
    { id: 'emails', label: 'Email Templates', icon: Mail },
    { id: 'calendar', label: 'Content Calendar', icon: Calendar },
    { id: 'campaigns', label: 'Campaign Status', icon: TrendingUp },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Marketing</h1>
          <p className="text-neutral-400 mt-1">Q1 2026 Marketing Platform</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="px-3 py-1.5 bg-brand-green text-black text-sm font-semibold rounded-lg">
            Q1 2026
          </span>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-white/10">
        <div className="flex space-x-1">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as typeof activeTab)}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === tab.id
                    ? 'border-brand-green text-brand-green'
                    : 'border-transparent text-neutral-500 hover:text-neutral-300 hover:border-white/10'
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Overview Tab */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Monthly Themes */}
          <div className="bg-neutral-900 rounded-lg border border-white/10 p-6">
            <h2 className="text-xl font-bold text-white mb-4">Q1 2026 Campaign Themes</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {marketingOverview.themes.map((theme, index) => (
                <div
                  key={theme.month}
                  className="p-4 rounded-lg border-2 border-white/5 hover:border-brand-green/50 transition-colors"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <span className="w-8 h-8 rounded-full bg-black text-brand-green flex items-center justify-center text-sm font-bold">
                      {index + 1}
                    </span>
                    <h3 className="font-semibold text-white">{theme.month}</h3>
                  </div>
                  <p className="text-brand-green font-medium mb-1">{theme.theme}</p>
                  <p className="text-sm text-neutral-400">{theme.focus}</p>
                </div>
              ))}
            </div>
          </div>

          {/* KPIs */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {marketingOverview.kpis.map((kpi) => {
              const Icon = kpi.icon;
              return (
                <div key={kpi.label} className="bg-neutral-900 rounded-lg border border-white/10 p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-brand-green/10 rounded-lg">
                      <Icon className="w-5 h-5 text-black" />
                    </div>
                    <div>
                      <p className="text-xs text-neutral-500">{kpi.label}</p>
                      <p className="font-semibold text-white">{kpi.target}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Budget Allocation */}
          <div className="bg-neutral-900 rounded-lg border border-white/10 p-6">
            <h2 className="text-xl font-bold text-white mb-4">Budget Allocation</h2>
            <div className="space-y-3">
              {marketingOverview.budgetAllocation.map((item) => (
                <div key={item.channel} className="flex items-center gap-4">
                  <span className="w-40 text-sm text-neutral-300">{item.channel}</span>
                  <div className="flex-1 h-4 bg-white/10 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-brand-green rounded-full"
                      style={{ width: `${item.percentage}%` }}
                    />
                  </div>
                  <span className="w-12 text-sm font-medium text-white text-right">{item.percentage}%</span>
                </div>
              ))}
            </div>
          </div>

          {/* Key Messaging */}
          <div className="bg-black rounded-lg p-6 text-white">
            <h2 className="text-xl font-bold mb-4">Key Messaging Pillars</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <h3 className="text-brand-green font-semibold mb-2">Family-Owned Business</h3>
                <ul className="text-sm text-neutral-400 space-y-1">
                  <li>- Multi-generational expertise</li>
                  <li>- Personal attention to every customer</li>
                  <li>- Community-focused values</li>
                  <li>- Local decision-making</li>
                </ul>
              </div>
              <div>
                <h3 className="text-brand-green font-semibold mb-2">3-Minute Financing</h3>
                <ul className="text-sm text-neutral-400 space-y-1">
                  <li>- Fast approval process</li>
                  <li>- Accessible to more homeowners</li>
                  <li>- No surprise fees</li>
                  <li>- Payments that fit your budget</li>
                </ul>
              </div>
              <div>
                <h3 className="text-brand-green font-semibold mb-2">Storm Damage Specialists</h3>
                <ul className="text-sm text-neutral-400 space-y-1">
                  <li>- Rapid response after weather</li>
                  <li>- Expert insurance claim assistance</li>
                  <li>- Free storm damage inspections</li>
                  <li>- Comprehensive repair solutions</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Ads Tab */}
      {activeTab === 'ads' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-white">10 Ad Variations</h2>
            <div className="flex items-center gap-2 text-sm">
              <span className="flex items-center gap-1 text-neutral-500">
                <CheckCircle className="w-4 h-4 text-brand-green" /> Active: {ads.filter(a => a.status === 'active').length}
              </span>
              <span className="flex items-center gap-1 text-neutral-500">
                <Clock className="w-4 h-4 text-yellow-500" /> Scheduled: {ads.filter(a => a.status === 'scheduled').length}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {ads.map((ad) => (
              <AdCard
                key={ad.id}
                ad={ad}
                onPreview={() => setSelectedAd(ad)}
                onCopy={() => handleCopyAd(ad)}
              />
            ))}
          </div>

          {copiedId && (
            <div className="fixed bottom-4 right-4 bg-black text-brand-green px-4 py-2 rounded-lg shadow-lg flex items-center gap-2">
              <CheckCircle className="w-4 h-4" />
              Copied to clipboard!
            </div>
          )}
        </div>
      )}

      {/* Emails Tab */}
      {activeTab === 'emails' && (
        <div className="space-y-4">
          <h2 className="text-xl font-bold text-white">5 Email Templates</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {emailTemplates.map((template) => (
              <EmailCard
                key={template.id}
                template={template}
                onPreview={() => setSelectedEmail(template)}
              />
            ))}
          </div>

          {/* Email Usage Guide */}
          <div className="bg-white/5 rounded-lg border border-white/10 p-4 mt-6">
            <h3 className="font-semibold text-white mb-3">Email Template Usage Guide</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/10">
                    <th className="text-left py-2 px-3 font-medium text-neutral-300">Template</th>
                    <th className="text-left py-2 px-3 font-medium text-neutral-300">When to Use</th>
                    <th className="text-left py-2 px-3 font-medium text-neutral-300">Trigger</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-white/5">
                    <td className="py-2 px-3">Welcome</td>
                    <td className="py-2 px-3 text-neutral-400">New lead enters system</td>
                    <td className="py-2 px-3 text-neutral-400">Form submission</td>
                  </tr>
                  <tr className="border-b border-white/5">
                    <td className="py-2 px-3">Storm Alert</td>
                    <td className="py-2 px-3 text-neutral-400">After severe weather events</td>
                    <td className="py-2 px-3 text-neutral-400">Manual send</td>
                  </tr>
                  <tr className="border-b border-white/5">
                    <td className="py-2 px-3">Financing</td>
                    <td className="py-2 px-3 text-neutral-400">Mid-funnel nurture</td>
                    <td className="py-2 px-3 text-neutral-400">3-5 days after welcome</td>
                  </tr>
                  <tr className="border-b border-white/5">
                    <td className="py-2 px-3">Pre-Storm</td>
                    <td className="py-2 px-3 text-neutral-400">February/Early March</td>
                    <td className="py-2 px-3 text-neutral-400">Scheduled campaign</td>
                  </tr>
                  <tr>
                    <td className="py-2 px-3">Post-Estimate</td>
                    <td className="py-2 px-3 text-neutral-400">After in-home estimate</td>
                    <td className="py-2 px-3 text-neutral-400">CRM trigger</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Calendar Tab */}
      {activeTab === 'calendar' && (
        <div className="space-y-4">
          <h2 className="text-xl font-bold text-white">Q1 2026 Content Calendar</h2>

          {/* Month Accordions */}
          {['January', 'February', 'March'].map((month) => {
            const monthItems = contentCalendar.filter((item) =>
              item.date.startsWith(month.substring(0, 3))
            );
            const isExpanded = expandedMonth === month;

            return (
              <div key={month} className="bg-neutral-900 rounded-lg border border-white/10 overflow-hidden">
                <button
                  onClick={() => setExpandedMonth(isExpanded ? null : month)}
                  className="w-full flex items-center justify-between p-4 hover:bg-white/5 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <span className="w-10 h-10 rounded-full bg-black text-brand-green flex items-center justify-center font-bold">
                      {month.substring(0, 1)}
                    </span>
                    <div className="text-left">
                      <h3 className="font-semibold text-white">{month} 2026</h3>
                      <p className="text-sm text-neutral-500">{monthItems.length} scheduled items</p>
                    </div>
                  </div>
                  {isExpanded ? (
                    <ChevronUp className="w-5 h-5 text-neutral-500" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-neutral-500" />
                  )}
                </button>

                {isExpanded && (
                  <div className="border-t border-white/10">
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-white/5">
                          <tr>
                            <th className="text-left py-3 px-4 font-medium text-neutral-300">Date</th>
                            <th className="text-left py-3 px-4 font-medium text-neutral-300">Channel</th>
                            <th className="text-left py-3 px-4 font-medium text-neutral-300">Type</th>
                            <th className="text-left py-3 px-4 font-medium text-neutral-300">Topic</th>
                            <th className="text-left py-3 px-4 font-medium text-neutral-300">Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {monthItems.map((item, index) => (
                            <tr key={index} className="border-t border-white/5 hover:bg-white/5">
                              <td className="py-3 px-4 font-medium">{item.date}</td>
                              <td className="py-3 px-4 text-neutral-400">{item.channel}</td>
                              <td className="py-3 px-4 text-neutral-400">{item.type}</td>
                              <td className="py-3 px-4 text-neutral-400">{item.topic}</td>
                              <td className="py-3 px-4">
                                <StatusBadge status={item.status} />
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {/* Posting Frequency Summary */}
          <div className="bg-black rounded-lg p-6 text-white">
            <h3 className="font-semibold mb-4">Posting Frequency Summary</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div>
                <p className="text-brand-green font-medium">Facebook</p>
                <p className="text-sm text-neutral-400">4-5 posts per week</p>
              </div>
              <div>
                <p className="text-brand-green font-medium">Instagram Feed</p>
                <p className="text-sm text-neutral-400">3-4 posts per week</p>
              </div>
              <div>
                <p className="text-brand-green font-medium">Instagram Stories</p>
                <p className="text-sm text-neutral-400">Daily during campaigns</p>
              </div>
              <div>
                <p className="text-brand-green font-medium">Email</p>
                <p className="text-sm text-neutral-400">2-3 per month</p>
              </div>
              <div>
                <p className="text-brand-green font-medium">Blog</p>
                <p className="text-sm text-neutral-400">1-2 articles per week</p>
              </div>
              <div>
                <p className="text-brand-green font-medium">Google Ads</p>
                <p className="text-sm text-neutral-400">Weekly optimization</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Campaigns Tab */}
      {activeTab === 'campaigns' && (
        <div className="space-y-4">
          <h2 className="text-xl font-bold text-white">Campaign Status Tracking</h2>

          <div className="bg-neutral-900 rounded-lg border border-white/10 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-white/5">
                  <tr>
                    <th className="text-left py-3 px-4 font-medium text-neutral-300">Campaign</th>
                    <th className="text-left py-3 px-4 font-medium text-neutral-300">Status</th>
                    <th className="text-left py-3 px-4 font-medium text-neutral-300">Leads</th>
                    <th className="text-left py-3 px-4 font-medium text-neutral-300">Spend</th>
                    <th className="text-left py-3 px-4 font-medium text-neutral-300">CTR</th>
                  </tr>
                </thead>
                <tbody>
                  {campaignStatus.map((campaign, index) => (
                    <tr key={index} className="border-t border-white/5 hover:bg-white/5">
                      <td className="py-3 px-4 font-medium text-white">{campaign.name}</td>
                      <td className="py-3 px-4">
                        <StatusBadge status={campaign.status} />
                      </td>
                      <td className="py-3 px-4 text-neutral-400">{campaign.leads}</td>
                      <td className="py-3 px-4 text-neutral-400">{campaign.spend}</td>
                      <td className="py-3 px-4 text-neutral-400">{campaign.ctr}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Performance Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-neutral-900 rounded-lg border border-white/10 p-4">
              <div className="flex items-center gap-2 text-neutral-500 mb-2">
                <Users className="w-4 h-4" />
                <span className="text-sm">Total Leads</span>
              </div>
              <p className="text-2xl font-bold text-white">82</p>
              <p className="text-xs text-brand-green">+23% from last month</p>
            </div>
            <div className="bg-neutral-900 rounded-lg border border-white/10 p-4">
              <div className="flex items-center gap-2 text-neutral-500 mb-2">
                <DollarSign className="w-4 h-4" />
                <span className="text-sm">Total Spend</span>
              </div>
              <p className="text-2xl font-bold text-white">$2,270</p>
              <p className="text-xs text-neutral-500">Q1 Budget: $15,000</p>
            </div>
            <div className="bg-neutral-900 rounded-lg border border-white/10 p-4">
              <div className="flex items-center gap-2 text-neutral-500 mb-2">
                <Target className="w-4 h-4" />
                <span className="text-sm">Avg. CTR</span>
              </div>
              <p className="text-2xl font-bold text-white">3.03%</p>
              <p className="text-xs text-brand-green">Above industry avg</p>
            </div>
            <div className="bg-neutral-900 rounded-lg border border-white/10 p-4">
              <div className="flex items-center gap-2 text-neutral-500 mb-2">
                <TrendingUp className="w-4 h-4" />
                <span className="text-sm">Cost Per Lead</span>
              </div>
              <p className="text-2xl font-bold text-white">$27.68</p>
              <p className="text-xs text-neutral-500">Target: $35</p>
            </div>
          </div>

          {/* Active Campaigns Detail */}
          <div className="bg-brand-green/5 border border-brand-green/20 rounded-lg p-4">
            <h3 className="font-semibold text-white mb-3">Active Campaigns</h3>
            <div className="space-y-3">
              {campaignStatus.filter(c => c.status === 'active').map((campaign, index) => (
                <div key={index} className="flex items-center justify-between p-3 bg-white rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 bg-brand-green rounded-full animate-pulse" />
                    <span className="font-medium text-white">{campaign.name}</span>
                  </div>
                  <div className="flex items-center gap-4 text-sm text-neutral-400">
                    <span>{campaign.leads} leads</span>
                    <span>{campaign.spend} spent</span>
                    <span>{campaign.ctr} CTR</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Ad Preview Modal */}
      <Modal
        isOpen={!!selectedAd}
        onClose={() => setSelectedAd(null)}
        title={`Ad Preview: ${selectedAd?.title || ''}`}
      >
        {selectedAd && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <span className="text-sm text-neutral-500">Platform:</span>
              <span className="text-sm font-medium">{selectedAd.platform}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-neutral-500">Format:</span>
              <span className="text-sm font-medium">{selectedAd.format}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-neutral-500">Status:</span>
              <StatusBadge status={selectedAd.status} />
            </div>

            {/* Ad Preview Card */}
            <div className="bg-black rounded-lg p-6 mt-4">
              <h3 className="text-brand-green font-bold text-xl mb-3">{selectedAd.headline}</h3>
              <p className="text-neutral-400 whitespace-pre-line mb-4">{selectedAd.body}</p>
              <button className="bg-brand-green text-black font-semibold px-6 py-2 rounded-lg">
                {selectedAd.cta}
              </button>
            </div>

            <div className="flex gap-2 mt-4">
              <button
                onClick={() => handleCopyAd(selectedAd)}
                className="flex items-center gap-2 px-4 py-2 bg-brand-green text-black font-medium rounded-lg hover:bg-lime-400 transition-colors"
              >
                <Copy className="w-4 h-4" />
                Copy Ad Content
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Email Preview Modal */}
      <Modal
        isOpen={!!selectedEmail}
        onClose={() => setSelectedEmail(null)}
        title={`Email Template: ${selectedEmail?.title || ''}`}
      >
        {selectedEmail && (
          <div className="space-y-4">
            <div className="bg-white/10 rounded-lg p-4">
              <p className="text-sm text-neutral-500 mb-1">Subject Line:</p>
              <p className="font-medium">{selectedEmail.subject}</p>
            </div>
            <div className="bg-white/10 rounded-lg p-4">
              <p className="text-sm text-neutral-500 mb-1">Trigger:</p>
              <p className="font-medium">{selectedEmail.trigger}</p>
            </div>

            {/* Email Content Preview */}
            <div className="border border-white/10 rounded-lg overflow-hidden">
              <div className="bg-black p-4">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-brand-green rounded flex items-center justify-center">
                    <span className="text-black font-bold text-sm">RC</span>
                  </div>
                  <span className="text-white font-semibold">River City Roofing Solutions</span>
                </div>
              </div>
              <div className="p-4 bg-neutral-900">
                <pre className="whitespace-pre-wrap font-sans text-sm text-neutral-300">
                  {selectedEmail.content}
                </pre>
              </div>
              <div className="bg-black p-4 text-center">
                <button className="bg-brand-green text-black font-semibold px-6 py-2 rounded-lg">
                  Schedule Free Inspection
                </button>
                <p className="text-neutral-500 text-xs mt-3">
                  River City Roofing Solutions | Family-Owned. Community-Trusted.
                </p>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
