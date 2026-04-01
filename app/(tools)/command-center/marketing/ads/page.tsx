'use client';

/**
 * RCRS Command Center - Digital Ads Management
 *
 * Overview and management hub for digital advertising:
 * - Google Ads campaign overview with link to dashboard
 * - Facebook/Meta Ads section with link to Meta Business Suite
 * - Budget tracking display
 * - Performance metrics cards (impressions, clicks, conversions, cost per lead)
 * - Actual ad management happens in external platforms
 */

import * as React from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  ExternalLink,
  MousePointerClick,
  Eye,
  Target,
  DollarSign,
  TrendingUp,
  BarChart3,
  Share2,
  Users,
  Percent,
  ArrowUpRight,
  Calendar,
  AlertTriangle,
  CheckCircle,
  Clock,
  Plus,
  Settings,
  Layers,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// =============================================================================
// Types
// =============================================================================

interface CampaignData {
  id: string;
  name: string;
  platform: 'google' | 'meta';
  status: 'active' | 'paused' | 'ended' | 'draft';
  budget: number;
  spent: number;
  impressions: number;
  clicks: number;
  conversions: number;
  cpl: number;
  startDate: string;
  endDate?: string;
}

interface PlatformSummary {
  platform: string;
  icon: LucideIcon;
  color: string;
  dashboardUrl: string;
  totalBudget: number;
  totalSpent: number;
  activeCampaigns: number;
  totalImpressions: number;
  totalClicks: number;
  totalConversions: number;
  avgCpl: number;
}

// =============================================================================
// Constants
// =============================================================================

const GOOGLE_ADS_URL = 'https://ads.google.com/';
const META_ADS_URL = 'https://business.facebook.com/adsmanager';

// =============================================================================
// Empty State Campaign Display
// Note: When real campaigns are running, these would come from API data.
// For now, we show a smart empty state that's useful for getting started.
// =============================================================================

const PLATFORM_SUMMARIES: PlatformSummary[] = [
  {
    platform: 'Google Ads',
    icon: MousePointerClick,
    color: 'blue',
    dashboardUrl: GOOGLE_ADS_URL,
    totalBudget: 0,
    totalSpent: 0,
    activeCampaigns: 0,
    totalImpressions: 0,
    totalClicks: 0,
    totalConversions: 0,
    avgCpl: 0,
  },
  {
    platform: 'Meta Ads',
    icon: Share2,
    color: 'purple',
    dashboardUrl: META_ADS_URL,
    totalBudget: 0,
    totalSpent: 0,
    activeCampaigns: 0,
    totalImpressions: 0,
    totalClicks: 0,
    totalConversions: 0,
    avgCpl: 0,
  },
];

const SUGGESTED_CAMPAIGN_TYPES = [
  {
    title: 'Google Search Ads',
    description: 'Target homeowners searching for roofing services in North Alabama',
    keywords: ['roofing company Huntsville AL', 'roof replacement Decatur AL', 'storm damage roof repair'],
    estimatedCpl: '$25-50',
    platform: 'google' as const,
  },
  {
    title: 'Google Local Services Ads',
    description: 'Pay-per-lead ads that appear above search results with Google Guarantee badge',
    keywords: ['roofer near me', 'roofing contractor near me', 'roof repair near me'],
    estimatedCpl: '$30-75',
    platform: 'google' as const,
  },
  {
    title: 'Facebook Storm Damage Ads',
    description: 'Target homeowners in storm-affected areas with free inspection offers',
    keywords: ['Storm damage', 'Insurance claims', 'Free inspection'],
    estimatedCpl: '$15-35',
    platform: 'meta' as const,
  },
  {
    title: 'Facebook Retargeting',
    description: 'Re-engage website visitors who did not convert with special offers',
    keywords: ['Website visitors', 'Form abandonment', 'Quote requesters'],
    estimatedCpl: '$10-25',
    platform: 'meta' as const,
  },
  {
    title: 'Instagram Brand Awareness',
    description: 'Showcase before/after transformations and team photos to build trust',
    keywords: ['Before/after', 'Team photos', 'Community involvement'],
    estimatedCpl: '$5-15',
    platform: 'meta' as const,
  },
];

// =============================================================================
// Sub-Components
// =============================================================================

function MetricCard({ label, value, icon: Icon, color, subtitle }: {
  label: string;
  value: string;
  icon: LucideIcon;
  color: string;
  subtitle?: string;
}) {
  const colorMap: Record<string, string> = {
    blue: 'bg-blue-500/10 text-blue-400',
    lime: 'bg-lime-500/10 text-lime-400',
    purple: 'bg-purple-500/10 text-purple-400',
    amber: 'bg-amber-500/10 text-amber-400',
    orange: 'bg-orange-500/10 text-orange-400',
    red: 'bg-red-500/10 text-red-400',
    cyan: 'bg-cyan-500/10 text-cyan-400',
  };

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium text-zinc-500 uppercase tracking-wide">{label}</p>
          <p className="mt-1 text-2xl font-bold text-white">{value}</p>
          {subtitle && <p className="text-xs text-zinc-500 mt-1">{subtitle}</p>}
        </div>
        <div className={cn('rounded-lg p-2', colorMap[color] || 'bg-zinc-500/10 text-zinc-400')}>
          <Icon size={18} />
        </div>
      </div>
    </div>
  );
}

function PlatformCard({ summary }: { summary: PlatformSummary }) {
  const colorMap: Record<string, string> = {
    blue: 'border-blue-500/20 bg-blue-500/5',
    purple: 'border-purple-500/20 bg-purple-500/5',
  };
  const iconColorMap: Record<string, string> = {
    blue: 'bg-blue-500/10 text-blue-400',
    purple: 'bg-purple-500/10 text-purple-400',
  };
  const hasData = summary.totalSpent > 0 || summary.activeCampaigns > 0;

  return (
    <div className={cn('rounded-2xl border p-6', colorMap[summary.color] || 'border-zinc-800 bg-zinc-900')}>
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className={cn('rounded-lg p-2.5', iconColorMap[summary.color])}>
            <summary.icon size={22} />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">{summary.platform}</h3>
            <p className="text-xs text-zinc-500">
              {summary.activeCampaigns} active campaign{summary.activeCampaigns !== 1 ? 's' : ''}
            </p>
          </div>
        </div>
        <a
          href={summary.dashboardUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-zinc-300 bg-white/5 rounded-lg hover:bg-white/10 transition-colors"
        >
          Open Dashboard
          <ExternalLink size={12} />
        </a>
      </div>

      {hasData ? (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div>
            <p className="text-xs text-zinc-500">Budget</p>
            <p className="text-lg font-bold text-white">${summary.totalBudget.toLocaleString()}</p>
          </div>
          <div>
            <p className="text-xs text-zinc-500">Spent</p>
            <p className="text-lg font-bold text-white">${summary.totalSpent.toLocaleString()}</p>
          </div>
          <div>
            <p className="text-xs text-zinc-500">Clicks</p>
            <p className="text-lg font-bold text-white">{summary.totalClicks.toLocaleString()}</p>
          </div>
          <div>
            <p className="text-xs text-zinc-500">Conversions</p>
            <p className="text-lg font-bold text-white">{summary.totalConversions}</p>
          </div>
        </div>
      ) : (
        <div className="text-center py-6">
          <p className="text-sm text-zinc-500 mb-3">No active campaigns</p>
          <a
            href={summary.dashboardUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2 bg-white/5 text-zinc-300 text-sm rounded-lg hover:bg-white/10 transition-colors"
          >
            <Plus size={14} />
            Create Campaign in {summary.platform}
          </a>
        </div>
      )}
    </div>
  );
}

function CampaignSuggestionCard({ suggestion }: { suggestion: typeof SUGGESTED_CAMPAIGN_TYPES[0] }) {
  const platformUrl = suggestion.platform === 'google' ? GOOGLE_ADS_URL : META_ADS_URL;
  const platformColor = suggestion.platform === 'google' ? 'blue' : 'purple';
  const platformIcon = suggestion.platform === 'google' ? MousePointerClick : Share2;
  const PlatformIcon = platformIcon;

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5 hover:border-zinc-700 transition-colors">
      <div className="flex items-start gap-3 mb-3">
        <div className={cn(
          'rounded-lg p-2 shrink-0',
          platformColor === 'blue' ? 'bg-blue-500/10 text-blue-400' : 'bg-purple-500/10 text-purple-400'
        )}>
          <PlatformIcon size={16} />
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-semibold text-white">{suggestion.title}</h4>
          <p className="text-xs text-zinc-500 mt-0.5">{suggestion.description}</p>
        </div>
      </div>
      <div className="flex flex-wrap gap-1.5 mb-3">
        {suggestion.keywords.map((kw) => (
          <span key={kw} className="inline-flex items-center px-2 py-0.5 rounded-full bg-zinc-800 text-[10px] text-zinc-400 border border-zinc-700">
            {kw}
          </span>
        ))}
      </div>
      <div className="flex items-center justify-between">
        <span className="text-xs text-zinc-500">
          Est. Cost/Lead: <span className="text-zinc-300 font-medium">{suggestion.estimatedCpl}</span>
        </span>
        <a
          href={platformUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-zinc-400 hover:text-white flex items-center gap-1 transition-colors"
        >
          Set up <ExternalLink size={10} />
        </a>
      </div>
    </div>
  );
}

// =============================================================================
// Page Component
// =============================================================================

export default function AdsPage() {
  const [activeTab, setActiveTab] = React.useState<'overview' | 'google' | 'meta' | 'budget'>('overview');

  return (
    <div className="min-h-screen bg-gradient-to-br from-neutral-950 via-neutral-900 to-neutral-950">
      {/* Background Pattern */}
      <div className="fixed inset-0 opacity-30 pointer-events-none">
        <div className="absolute inset-0" style={{
          backgroundImage: 'radial-gradient(circle at 25px 25px, rgba(255,255,255,0.03) 2px, transparent 0)',
          backgroundSize: '50px 50px',
        }} />
      </div>

      <div className="relative z-10">
        {/* Header */}
        <header className="border-b border-white/5 backdrop-blur-xl bg-black/20 sticky top-0 z-20">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Link
                  href="/command-center/marketing"
                  className="w-10 h-10 rounded-xl bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors"
                >
                  <ArrowLeft size={20} className="text-neutral-400" />
                </Link>
                <div>
                  <div className="flex items-center gap-2 text-xs text-neutral-500 mb-0.5">
                    <Link href="/command-center" className="hover:text-neutral-300 transition-colors">Command Center</Link>
                    <span>/</span>
                    <Link href="/command-center/marketing" className="hover:text-neutral-300 transition-colors">Marketing</Link>
                    <span>/</span>
                    <span className="text-neutral-400">Ads</span>
                  </div>
                  <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
                    <Target size={22} className="text-purple-400" />
                    Digital Ads Management
                  </h1>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <a
                  href={GOOGLE_ADS_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-3 py-2 bg-white/5 text-neutral-300 text-sm rounded-xl hover:bg-white/10 transition-colors"
                >
                  <MousePointerClick size={14} />
                  Google Ads
                  <ExternalLink size={12} />
                </a>
                <a
                  href={META_ADS_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-3 py-2 bg-white/5 text-neutral-300 text-sm rounded-xl hover:bg-white/10 transition-colors"
                >
                  <Share2 size={14} />
                  Meta Ads
                  <ExternalLink size={12} />
                </a>
              </div>
            </div>
          </div>
        </header>

        <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">

          {/* Tab Navigation */}
          <div className="flex gap-2 overflow-x-auto pb-1">
            {[
              { key: 'overview' as const, label: 'Overview', icon: Layers },
              { key: 'google' as const, label: 'Google Ads', icon: MousePointerClick },
              { key: 'meta' as const, label: 'Meta Ads', icon: Share2 },
              { key: 'budget' as const, label: 'Budget Tracking', icon: DollarSign },
            ].map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                onClick={() => setActiveTab(key)}
                className={cn(
                  'flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-colors',
                  activeTab === key
                    ? 'bg-brand-green/20 text-brand-green ring-1 ring-brand-green/30'
                    : 'bg-white/5 text-neutral-400 hover:bg-white/10'
                )}
              >
                <Icon size={16} />
                {label}
              </button>
            ))}
          </div>

          {/* Aggregate Metrics */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <MetricCard label="Total Impressions" value="0" icon={Eye} color="blue" subtitle="Across all platforms" />
            <MetricCard label="Total Clicks" value="0" icon={MousePointerClick} color="lime" subtitle="Click-through rate: --" />
            <MetricCard label="Conversions" value="0" icon={Target} color="purple" subtitle="Cost per lead: --" />
            <MetricCard label="Total Ad Spend" value="$0" icon={DollarSign} color="amber" subtitle="Monthly budget: Not set" />
          </div>

          {/* Overview Tab */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* Platform Cards */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {PLATFORM_SUMMARIES.map((summary) => (
                  <PlatformCard key={summary.platform} summary={summary} />
                ))}
              </div>

              {/* Getting Started */}
              <section className="bg-white/[0.02] border border-white/5 rounded-2xl p-6">
                <h3 className="text-lg font-semibold text-white mb-2">Getting Started with Digital Ads</h3>
                <p className="text-sm text-zinc-400 mb-4">
                  No active campaigns yet. Here are recommended campaign types for RCRS based on your
                  market position and target keywords. Create campaigns directly in Google Ads or Meta Business Suite.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {SUGGESTED_CAMPAIGN_TYPES.slice(0, 3).map((suggestion) => (
                    <CampaignSuggestionCard key={suggestion.title} suggestion={suggestion} />
                  ))}
                </div>
              </section>
            </div>
          )}

          {/* Google Ads Tab */}
          {activeTab === 'google' && (
            <div className="space-y-6">
              <div className="bg-blue-500/5 border border-blue-500/20 rounded-2xl p-6">
                <div className="flex items-start gap-4">
                  <div className="bg-blue-500/10 rounded-lg p-3">
                    <MousePointerClick size={24} className="text-blue-400" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-white mb-1">Google Ads</h3>
                    <p className="text-sm text-zinc-400 mb-4">
                      Manage search ads, display ads, and local services ads targeting North Alabama homeowners.
                      All campaign creation and management is done in the Google Ads platform.
                    </p>
                    <a
                      href={GOOGLE_ADS_URL}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-500/20 text-blue-300 font-medium text-sm rounded-xl hover:bg-blue-500/30 transition-colors"
                    >
                      Open Google Ads Dashboard
                      <ExternalLink size={14} />
                    </a>
                  </div>
                </div>
              </div>

              <h3 className="text-md font-semibold text-white">Recommended Google Campaigns</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {SUGGESTED_CAMPAIGN_TYPES.filter(s => s.platform === 'google').map((suggestion) => (
                  <CampaignSuggestionCard key={suggestion.title} suggestion={suggestion} />
                ))}
              </div>

              {/* Google Ads Best Practices */}
              <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-6">
                <h4 className="text-md font-semibold text-white mb-3">Best Practices for Roofing Google Ads</h4>
                <ul className="space-y-2 text-sm text-zinc-400">
                  <li className="flex items-start gap-2">
                    <CheckCircle size={14} className="text-lime-400 mt-0.5 shrink-0" />
                    Use location targeting for your service area (50-mile radius from Hartselle)
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle size={14} className="text-lime-400 mt-0.5 shrink-0" />
                    Include call extensions with (256) 274-8530 on all ads
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle size={14} className="text-lime-400 mt-0.5 shrink-0" />
                    Bid higher on &quot;storm damage&quot; and &quot;insurance claim&quot; keywords after severe weather
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle size={14} className="text-lime-400 mt-0.5 shrink-0" />
                    Use negative keywords to exclude &quot;DIY&quot;, &quot;how to&quot;, &quot;jobs&quot;, &quot;hiring&quot;
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle size={14} className="text-lime-400 mt-0.5 shrink-0" />
                    Schedule ads during business hours (Mon-Sat 7am-7pm) for best conversion rates
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle size={14} className="text-lime-400 mt-0.5 shrink-0" />
                    Use landing pages (/check-my-address or city-specific pages) instead of homepage
                  </li>
                </ul>
              </div>
            </div>
          )}

          {/* Meta Ads Tab */}
          {activeTab === 'meta' && (
            <div className="space-y-6">
              <div className="bg-purple-500/5 border border-purple-500/20 rounded-2xl p-6">
                <div className="flex items-start gap-4">
                  <div className="bg-purple-500/10 rounded-lg p-3">
                    <Share2 size={24} className="text-purple-400" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-white mb-1">Meta Ads (Facebook & Instagram)</h3>
                    <p className="text-sm text-zinc-400 mb-4">
                      Reach homeowners on Facebook and Instagram with targeted ads. Great for brand awareness,
                      storm damage outreach, and retargeting website visitors.
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <a
                        href={META_ADS_URL}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 px-4 py-2.5 bg-purple-500/20 text-purple-300 font-medium text-sm rounded-xl hover:bg-purple-500/30 transition-colors"
                      >
                        Open Meta Ads Manager
                        <ExternalLink size={14} />
                      </a>
                    </div>
                  </div>
                </div>
              </div>

              {/* Pixel Setup Note */}
              <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-4">
                <div className="flex items-start gap-2">
                  <AlertTriangle size={16} className="text-amber-400 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-amber-300">Facebook Pixel Setup</p>
                    <p className="text-xs text-zinc-400 mt-1">
                      Ensure the Facebook Pixel is installed on the website for conversion tracking and retargeting.
                      See BOSTON-PIXEL-SETUP-GUIDE.md for step-by-step instructions.
                    </p>
                  </div>
                </div>
              </div>

              <h3 className="text-md font-semibold text-white">Recommended Meta Campaigns</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {SUGGESTED_CAMPAIGN_TYPES.filter(s => s.platform === 'meta').map((suggestion) => (
                  <CampaignSuggestionCard key={suggestion.title} suggestion={suggestion} />
                ))}
              </div>

              {/* Pre-written Ad Content */}
              <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-6">
                <h4 className="text-md font-semibold text-white mb-3">Pre-Written Ad Content Available</h4>
                <p className="text-sm text-zinc-400 mb-4">
                  RCRS has pre-written social ad content ready for use. These include storm damage ads,
                  family-owned trust-building ads, seasonal promotions, and referral program promotions.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {[
                    { title: 'Storm Damage Response', platform: 'All platforms', type: 'Image ad' },
                    { title: 'Family-Owned Trust Builder', platform: 'Facebook', type: 'Image ad' },
                    { title: 'Before & After Showcase', platform: 'Instagram', type: 'Carousel' },
                    { title: 'Free Inspection Offer', platform: 'All platforms', type: 'Image ad' },
                  ].map((ad) => (
                    <div key={ad.title} className="flex items-center gap-3 bg-zinc-900 rounded-lg p-3 border border-zinc-800">
                      <Share2 size={14} className="text-purple-400 shrink-0" />
                      <div className="min-w-0">
                        <p className="text-sm text-white truncate">{ad.title}</p>
                        <p className="text-xs text-zinc-500">{ad.platform} - {ad.type}</p>
                      </div>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-zinc-600 mt-3">
                  Full ad content in lib/socialAds.ts - copy/paste into Meta Ads Manager
                </p>
              </div>
            </div>
          )}

          {/* Budget Tab */}
          {activeTab === 'budget' && (
            <div className="space-y-6">
              {/* Budget Overview */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
                  <p className="text-xs font-medium text-zinc-500 uppercase tracking-wide">Monthly Budget</p>
                  <p className="mt-1 text-3xl font-bold text-white">Not Set</p>
                  <p className="text-xs text-zinc-500 mt-1">Set a monthly budget to track spend</p>
                </div>
                <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
                  <p className="text-xs font-medium text-zinc-500 uppercase tracking-wide">Spent This Month</p>
                  <p className="mt-1 text-3xl font-bold text-white">$0</p>
                  <p className="text-xs text-zinc-500 mt-1">0% of budget used</p>
                </div>
                <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
                  <p className="text-xs font-medium text-zinc-500 uppercase tracking-wide">Cost Per Lead (Avg)</p>
                  <p className="mt-1 text-3xl font-bold text-white">--</p>
                  <p className="text-xs text-zinc-500 mt-1">No conversion data yet</p>
                </div>
              </div>

              {/* Budget Recommendations */}
              <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-6">
                <h3 className="text-lg font-semibold text-white mb-4">Budget Recommendations for Roofing</h3>
                <div className="space-y-4">
                  {[
                    {
                      tier: 'Starter',
                      monthly: '$500-1,000',
                      description: 'Google Search only, targeting high-intent keywords in core service area',
                      expectedLeads: '10-20 leads/month',
                    },
                    {
                      tier: 'Growth',
                      monthly: '$1,500-3,000',
                      description: 'Google Search + Facebook campaigns, broader geographic targeting',
                      expectedLeads: '30-60 leads/month',
                    },
                    {
                      tier: 'Aggressive',
                      monthly: '$3,000-5,000',
                      description: 'Full multi-platform with retargeting, local services ads, and brand campaigns',
                      expectedLeads: '60-100+ leads/month',
                    },
                  ].map((rec) => (
                    <div key={rec.tier} className="flex items-start gap-4 p-4 bg-zinc-900 rounded-xl border border-zinc-800">
                      <div className="bg-brand-green/10 rounded-lg px-3 py-1.5 shrink-0">
                        <span className="text-sm font-bold text-brand-green">{rec.tier}</span>
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-1">
                          <span className="text-white font-semibold">{rec.monthly}/mo</span>
                          <span className="text-xs text-zinc-500">{rec.expectedLeads}</span>
                        </div>
                        <p className="text-sm text-zinc-400">{rec.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* ROI Calculator */}
              <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-6">
                <h3 className="text-lg font-semibold text-white mb-4">Quick ROI Estimate</h3>
                <p className="text-sm text-zinc-400 mb-4">
                  Average roofing job value: ~$8,000-12,000. At $35/lead with 15% close rate:
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div className="text-center">
                    <p className="text-xs text-zinc-500">$1,000 spend</p>
                    <p className="text-lg font-bold text-white">~28 leads</p>
                    <p className="text-xs text-lime-400">~4 jobs closed</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-zinc-500">Revenue</p>
                    <p className="text-lg font-bold text-lime-400">~$40,000</p>
                    <p className="text-xs text-zinc-500">at $10K avg job</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-zinc-500">ROI</p>
                    <p className="text-lg font-bold text-lime-400">40x</p>
                    <p className="text-xs text-zinc-500">return on ad spend</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-zinc-500">Break Even</p>
                    <p className="text-lg font-bold text-white">1 job</p>
                    <p className="text-xs text-zinc-500">covers monthly spend</p>
                  </div>
                </div>
              </div>
            </div>
          )}

        </main>
      </div>
    </div>
  );
}
