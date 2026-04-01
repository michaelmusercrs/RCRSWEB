'use client';

/**
 * RCRS Command Center - Marketing Hub Dashboard
 *
 * Central marketing overview with:
 * - KPI cards (website traffic, reviews, campaigns, content)
 * - Quick links to ads, calendar, emails sub-pages
 * - External tool links (Google Analytics, GBP, social)
 * - SEO score summary
 * - Marketing activity feed
 */

import * as React from 'react';
import Link from 'next/link';
import {
  Megaphone,
  ArrowLeft,
  Mail,
  Image,
  Calendar,
  BarChart3,
  Star,
  TrendingUp,
  Globe,
  Search,
  ExternalLink,
  ArrowRight,
  Activity,
  Eye,
  MousePointerClick,
  FileText,
  Share2,
  Target,
  CheckCircle,
  Clock,
  AlertTriangle,
  RefreshCw,
  ChevronRight,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// =============================================================================
// Types
// =============================================================================

interface MarketingKPI {
  title: string;
  value: string;
  subtitle?: string;
  icon: LucideIcon;
  color: 'lime' | 'blue' | 'orange' | 'purple' | 'amber' | 'cyan';
  href?: string;
}

interface QuickLinkItem {
  title: string;
  description: string;
  href: string;
  icon: LucideIcon;
  color: string;
  internal?: boolean;
}

interface MarketingActivity {
  id: string;
  type: 'seo' | 'content' | 'review' | 'campaign' | 'social';
  title: string;
  detail: string;
  time: string;
  status: 'completed' | 'pending' | 'active';
}

// =============================================================================
// Static Data
// =============================================================================

const GA_ID = 'G-Y8PB85BZC5';
const GA_URL = `https://analytics.google.com/analytics/web/#/p${GA_ID.replace('G-', '')}/reports/intelligenthome`;
const GBP_URL = 'https://business.google.com/';
const GOOGLE_ADS_URL = 'https://ads.google.com/';
const META_ADS_URL = 'https://business.facebook.com/';
const GOOGLE_SEARCH_CONSOLE_URL = 'https://search.google.com/search-console';

const MARKETING_KPIS: MarketingKPI[] = [
  {
    title: 'Website Sessions',
    value: 'View in GA',
    subtitle: 'Google Analytics ' + GA_ID,
    icon: Eye,
    color: 'blue',
    href: GA_URL,
  },
  {
    title: 'Google Reviews',
    value: '47',
    subtitle: '5.0 avg rating',
    icon: Star,
    color: 'amber',
    href: GBP_URL,
  },
  {
    title: 'Active Campaigns',
    value: '0',
    subtitle: 'No active ad campaigns',
    icon: Target,
    color: 'purple',
  },
  {
    title: 'Content Published',
    value: '598',
    subtitle: 'Total site pages indexed',
    icon: FileText,
    color: 'lime',
  },
];

const INTERNAL_LINKS: QuickLinkItem[] = [
  {
    title: 'Digital Ads',
    description: 'Google Ads & Meta campaign management, budgets, and performance',
    href: '/command-center/marketing/ads',
    icon: Image,
    color: 'purple',
    internal: true,
  },
  {
    title: 'Content Calendar',
    description: 'Plan and schedule blog posts, social media, and email campaigns',
    href: '/command-center/marketing/calendar',
    icon: Calendar,
    color: 'lime',
    internal: true,
  },
  {
    title: 'Email Campaigns',
    description: 'Design, send, and track email campaigns to customers and prospects',
    href: '/command-center/marketing/emails',
    icon: Mail,
    color: 'blue',
    internal: true,
  },
];

const EXTERNAL_TOOLS: QuickLinkItem[] = [
  {
    title: 'Google Analytics',
    description: 'Website traffic, user behavior, and conversion tracking',
    href: GA_URL,
    icon: BarChart3,
    color: 'orange',
  },
  {
    title: 'Google Business Profile',
    description: 'Reviews, business listing, photos, and local SEO',
    href: GBP_URL,
    icon: Globe,
    color: 'blue',
  },
  {
    title: 'Google Search Console',
    description: 'Search performance, indexing status, and crawl errors',
    href: GOOGLE_SEARCH_CONSOLE_URL,
    icon: Search,
    color: 'lime',
  },
  {
    title: 'Google Ads',
    description: 'PPC campaigns, keywords, and ad performance',
    href: GOOGLE_ADS_URL,
    icon: MousePointerClick,
    color: 'amber',
  },
  {
    title: 'Meta Business Suite',
    description: 'Facebook & Instagram ads, posts, and audience insights',
    href: META_ADS_URL,
    icon: Share2,
    color: 'purple',
  },
];

const SEO_METRICS = [
  { label: 'Total Pages', value: '598', status: 'good' as const },
  { label: 'City Pages', value: '20+', status: 'good' as const },
  { label: 'Blog Posts', value: 'Active', status: 'good' as const },
  { label: 'SSL Certificate', value: 'Active', status: 'good' as const },
  { label: 'Mobile Responsive', value: 'Yes', status: 'good' as const },
  { label: 'Schema Markup', value: 'Active', status: 'good' as const },
  { label: 'Meta Descriptions', value: 'All unique', status: 'good' as const },
  { label: 'Google Reviews', value: '47 (5.0)', status: 'warning' as const },
];

const RECENT_ACTIVITY: MarketingActivity[] = [
  {
    id: '1',
    type: 'seo',
    title: 'SEO Meta Optimization Complete',
    detail: '21 files updated with unique titles and descriptions',
    time: 'Mar 16',
    status: 'completed',
  },
  {
    id: '2',
    type: 'content',
    title: '10 New City Pages Published',
    detail: 'Albertville, Guntersville, Arab, Scottsboro, Fort Payne, and more',
    time: 'Mar 16',
    status: 'completed',
  },
  {
    id: '3',
    type: 'content',
    title: 'New Pages Added',
    detail: '/reviews, /gallery, /faq, /financing, /warranty',
    time: 'Mar 16',
    status: 'completed',
  },
  {
    id: '4',
    type: 'seo',
    title: 'Media Optimization',
    detail: 'Hero video 2.6MB to 848KB, 12 images compressed (~12.7MB saved)',
    time: 'Mar 16',
    status: 'completed',
  },
  {
    id: '5',
    type: 'review',
    title: 'Review Gap Identified',
    detail: 'Yellowhammer has 1,355 reviews vs our 47 - need review generation campaign',
    time: 'Ongoing',
    status: 'pending',
  },
  {
    id: '6',
    type: 'campaign',
    title: 'Boston Pixel Setup Guide',
    detail: 'FB Pixel + Google Ads tracking setup documented for Boston',
    time: 'Mar 16',
    status: 'completed',
  },
];

// =============================================================================
// Sub-components
// =============================================================================

function KPICard({ kpi }: { kpi: MarketingKPI }) {
  const colorMap = {
    lime: 'bg-lime-500/10 text-lime-400',
    blue: 'bg-blue-500/10 text-blue-400',
    orange: 'bg-orange-500/10 text-orange-400',
    purple: 'bg-purple-500/10 text-purple-400',
    amber: 'bg-amber-500/10 text-amber-400',
    cyan: 'bg-cyan-500/10 text-cyan-400',
  };

  const inner = (
    <div className={cn(
      'rounded-xl border border-zinc-800 bg-zinc-900 p-5 transition-all',
      kpi.href && 'hover:border-zinc-700 hover:bg-zinc-800/50 cursor-pointer group'
    )}>
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-zinc-500 uppercase tracking-wide">{kpi.title}</p>
          <p className="mt-1 text-2xl font-bold text-white">{kpi.value}</p>
          {kpi.subtitle && (
            <p className="mt-1 text-xs text-zinc-500">{kpi.subtitle}</p>
          )}
        </div>
        <div className={cn('rounded-lg p-2.5 shrink-0', colorMap[kpi.color])}>
          <kpi.icon size={20} />
        </div>
      </div>
      {kpi.href && (
        <div className="mt-3 flex items-center gap-1 text-xs text-zinc-500 group-hover:text-zinc-400 transition-colors">
          <ExternalLink size={12} />
          <span>Open</span>
        </div>
      )}
    </div>
  );

  if (kpi.href) {
    return (
      <a href={kpi.href} target="_blank" rel="noopener noreferrer">
        {inner}
      </a>
    );
  }
  return inner;
}

function InternalLinkCard({ item }: { item: QuickLinkItem }) {
  const colorMap: Record<string, string> = {
    purple: 'bg-purple-500/10 text-purple-400 group-hover:bg-purple-500/20',
    lime: 'bg-lime-500/10 text-lime-400 group-hover:bg-lime-500/20',
    blue: 'bg-blue-500/10 text-blue-400 group-hover:bg-blue-500/20',
    orange: 'bg-orange-500/10 text-orange-400 group-hover:bg-orange-500/20',
    amber: 'bg-amber-500/10 text-amber-400 group-hover:bg-amber-500/20',
    cyan: 'bg-cyan-500/10 text-cyan-400 group-hover:bg-cyan-500/20',
  };

  return (
    <Link
      href={item.href}
      className="group flex items-start gap-4 rounded-xl border border-zinc-800 bg-zinc-900 p-5 transition-all hover:border-zinc-700 hover:bg-zinc-800/50"
    >
      <div className={cn(
        'flex h-12 w-12 shrink-0 items-center justify-center rounded-lg transition-colors',
        colorMap[item.color] || 'bg-zinc-500/10 text-zinc-400'
      )}>
        <item.icon size={24} />
      </div>
      <div className="min-w-0 flex-1">
        <h3 className="font-semibold text-white">{item.title}</h3>
        <p className="mt-0.5 text-sm text-zinc-400">{item.description}</p>
      </div>
      <ArrowRight
        size={20}
        className="shrink-0 text-zinc-600 transition-transform group-hover:translate-x-1 group-hover:text-zinc-400 mt-1"
      />
    </Link>
  );
}

function ExternalToolCard({ item }: { item: QuickLinkItem }) {
  const colorMap: Record<string, string> = {
    orange: 'bg-orange-500/10 text-orange-400',
    blue: 'bg-blue-500/10 text-blue-400',
    lime: 'bg-lime-500/10 text-lime-400',
    amber: 'bg-amber-500/10 text-amber-400',
    purple: 'bg-purple-500/10 text-purple-400',
  };

  return (
    <a
      href={item.href}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex items-center gap-3 rounded-xl border border-zinc-800 bg-zinc-900 p-4 transition-all hover:border-zinc-700 hover:bg-zinc-800/50"
    >
      <div className={cn('rounded-lg p-2 shrink-0', colorMap[item.color] || 'bg-zinc-500/10 text-zinc-400')}>
        <item.icon size={18} />
      </div>
      <div className="min-w-0 flex-1">
        <h4 className="text-sm font-medium text-white">{item.title}</h4>
        <p className="text-xs text-zinc-500 truncate">{item.description}</p>
      </div>
      <ExternalLink size={14} className="shrink-0 text-zinc-600 group-hover:text-zinc-400 transition-colors" />
    </a>
  );
}

function ActivityItem({ activity }: { activity: MarketingActivity }) {
  const typeIcons: Record<string, LucideIcon> = {
    seo: Search,
    content: FileText,
    review: Star,
    campaign: Target,
    social: Share2,
  };
  const typeColors: Record<string, string> = {
    seo: 'text-lime-400',
    content: 'text-blue-400',
    review: 'text-amber-400',
    campaign: 'text-purple-400',
    social: 'text-cyan-400',
  };
  const statusIcons: Record<string, React.ReactNode> = {
    completed: <CheckCircle size={14} className="text-lime-400" />,
    pending: <AlertTriangle size={14} className="text-amber-400" />,
    active: <Activity size={14} className="text-blue-400" />,
  };

  const Icon = typeIcons[activity.type] || Activity;

  return (
    <div className="flex items-start gap-3 py-3 border-b border-zinc-800/50 last:border-0">
      <div className={cn('mt-0.5', typeColors[activity.type] || 'text-zinc-400')}>
        <Icon size={16} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-white">{activity.title}</span>
          {statusIcons[activity.status]}
        </div>
        <p className="text-xs text-zinc-500 mt-0.5">{activity.detail}</p>
      </div>
      <span className="text-xs text-zinc-600 shrink-0">{activity.time}</span>
    </div>
  );
}

// =============================================================================
// Page Component
// =============================================================================

export default function MarketingHubPage() {
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
                  href="/command-center"
                  className="w-10 h-10 rounded-xl bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors"
                >
                  <ArrowLeft size={20} className="text-neutral-400" />
                </Link>
                <div>
                  <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
                    <Megaphone size={22} className="text-orange-400" />
                    Marketing Hub
                  </h1>
                  <p className="text-xs text-neutral-400">
                    Campaign management, content, and analytics
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <a
                  href={GA_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-4 py-2.5 bg-white/5 text-neutral-300 text-sm rounded-xl hover:bg-white/10 transition-colors"
                >
                  <BarChart3 size={16} />
                  Analytics
                  <ExternalLink size={12} />
                </a>
              </div>
            </div>
          </div>
        </header>

        <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-8">

          {/* KPI Cards */}
          <section>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {MARKETING_KPIS.map((kpi) => (
                <KPICard key={kpi.title} kpi={kpi} />
              ))}
            </div>
          </section>

          {/* Internal Navigation: Sub-pages */}
          <section>
            <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <Megaphone size={18} className="text-orange-400" />
              Marketing Tools
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {INTERNAL_LINKS.map((item) => (
                <InternalLinkCard key={item.title} item={item} />
              ))}
            </div>
          </section>

          {/* Two-column: SEO Summary + Activity Feed */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

            {/* SEO Score Summary */}
            <section className="bg-white/[0.02] border border-white/5 rounded-2xl p-6">
              <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <Search size={18} className="text-lime-400" />
                SEO Health Check
              </h3>
              <div className="space-y-3">
                {SEO_METRICS.map((metric) => (
                  <div key={metric.label} className="flex items-center justify-between">
                    <span className="text-sm text-neutral-300">{metric.label}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-white">{metric.value}</span>
                      {metric.status === 'good' ? (
                        <CheckCircle size={14} className="text-lime-400" />
                      ) : (
                        <AlertTriangle size={14} className="text-amber-400" />
                      )}
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-4 pt-4 border-t border-zinc-800">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-zinc-400">Overall SEO Score</span>
                  <span className="text-lg font-bold text-lime-400">Good</span>
                </div>
                <p className="text-xs text-zinc-500 mt-1">
                  Priority: Increase review count to compete with Yellowhammer (1,355 reviews)
                </p>
              </div>
            </section>

            {/* Recent Marketing Activity */}
            <section className="bg-white/[0.02] border border-white/5 rounded-2xl p-6">
              <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <Activity size={18} className="text-blue-400" />
                Recent Activity
              </h3>
              <div className="space-y-0">
                {RECENT_ACTIVITY.map((activity) => (
                  <ActivityItem key={activity.id} activity={activity} />
                ))}
              </div>
            </section>
          </div>

          {/* External Tools Grid */}
          <section>
            <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <ExternalLink size={18} className="text-zinc-400" />
              External Marketing Tools
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {EXTERNAL_TOOLS.map((tool) => (
                <ExternalToolCard key={tool.title} item={tool} />
              ))}
            </div>
          </section>

          {/* Competitive Intelligence Callout */}
          <section className="bg-amber-500/5 border border-amber-500/20 rounded-2xl p-6">
            <h3 className="text-lg font-semibold text-white mb-2 flex items-center gap-2">
              <AlertTriangle size={18} className="text-amber-400" />
              Competitive Intelligence: Review Gap
            </h3>
            <p className="text-sm text-zinc-400 mb-4">
              Yellowhammer Roofing has <span className="text-amber-400 font-semibold">1,355 reviews</span> (4.8 avg)
              vs. RCRS <span className="text-lime-400 font-semibold">47 reviews</span> (5.0 avg).
              While we have a perfect rating and own Decatur searches, the review volume gap is our biggest weakness
              for Huntsville market visibility.
            </p>
            <div className="flex flex-wrap gap-3">
              <div className="bg-zinc-900 rounded-lg px-4 py-2 border border-zinc-800">
                <p className="text-xs text-zinc-500">RCRS</p>
                <p className="text-lg font-bold text-lime-400">47 <span className="text-xs text-zinc-500">reviews</span></p>
              </div>
              <div className="bg-zinc-900 rounded-lg px-4 py-2 border border-zinc-800">
                <p className="text-xs text-zinc-500">RCRS Rating</p>
                <p className="text-lg font-bold text-white">5.0 <Star size={14} className="inline text-amber-400" /></p>
              </div>
              <div className="bg-zinc-900 rounded-lg px-4 py-2 border border-zinc-800">
                <p className="text-xs text-zinc-500">Yellowhammer</p>
                <p className="text-lg font-bold text-amber-400">1,355 <span className="text-xs text-zinc-500">reviews</span></p>
              </div>
              <div className="bg-zinc-900 rounded-lg px-4 py-2 border border-zinc-800">
                <p className="text-xs text-zinc-500">Yellowhammer Rating</p>
                <p className="text-lg font-bold text-white">4.8 <Star size={14} className="inline text-amber-400" /></p>
              </div>
            </div>
            <div className="mt-4">
              <p className="text-xs text-zinc-500">
                <span className="text-amber-400 font-medium">Action Items:</span> Launch review request email campaign after every completed job.
                Use the Job Complete + Review Request template in Email Campaigns.
                Target 10+ new reviews per month to close the gap.
              </p>
            </div>
          </section>

          {/* Key Targets */}
          <section className="bg-white/[0.02] border border-white/5 rounded-2xl p-6">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <Target size={18} className="text-purple-400" />
              Target Keywords
            </h3>
            <div className="flex flex-wrap gap-2">
              {[
                'roofing company Huntsville AL',
                'roof replacement Decatur AL',
                'storm damage roof repair',
                'roofing contractor Hartselle',
                'roof replacement Madison AL',
                'roofing contractor Athens AL',
                'free roof inspection North Alabama',
                'insurance claim roofer Huntsville',
                'IKO ROOFPRO contractor Alabama',
                'best roofer Decatur AL',
              ].map((keyword) => (
                <span
                  key={keyword}
                  className="inline-flex items-center px-3 py-1.5 rounded-full bg-zinc-800 text-xs text-zinc-300 border border-zinc-700"
                >
                  {keyword}
                </span>
              ))}
            </div>
          </section>

        </main>
      </div>
    </div>
  );
}
