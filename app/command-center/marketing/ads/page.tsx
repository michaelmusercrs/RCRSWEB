'use client';

/**
 * RCRS Command Center - Marketing Ads Library
 *
 * Displays all ad variations with filtering by platform.
 * Includes copy functionality and expandable details.
 *
 * Role-based: Requires marketing.view permission
 */

import * as React from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Image,
  Video,
  LayoutGrid,
  RectangleHorizontal,
  Copy,
  Check,
  Filter,
  ChevronDown,
  ChevronUp,
  Target,
  Megaphone,
} from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { hasPermission } from '@/lib/permissions';
import { cn } from '@/lib/utils';
import {
  ADS,
  Ad,
  AdPlatform,
  AdFormat,
  getAdsByPlatform,
  getPlatformColor,
} from '@/lib/marketing-data';

// Platform filter options
const PLATFORMS: { value: AdPlatform | 'all'; label: string }[] = [
  { value: 'all', label: 'All Platforms' },
  { value: 'Facebook', label: 'Facebook' },
  { value: 'Instagram', label: 'Instagram' },
  { value: 'Google', label: 'Google' },
  { value: 'Print', label: 'Print' },
];

// Format icon mapping
function FormatIcon({ format, className }: { format: AdFormat; className?: string }) {
  const iconProps = { className: cn('h-4 w-4', className) };
  switch (format) {
    case 'Video':
      return <Video {...iconProps} />;
    case 'Carousel':
      return <LayoutGrid {...iconProps} />;
    case 'Banner':
      return <RectangleHorizontal {...iconProps} />;
    default:
      return <Image {...iconProps} />;
  }
}

// Platform badge component
function PlatformBadge({ platform }: { platform: AdPlatform }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium text-white',
        getPlatformColor(platform)
      )}
    >
      {platform}
    </span>
  );
}

// Ad card component
interface AdCardProps {
  ad: Ad;
}

function AdCard({ ad }: AdCardProps) {
  const [isExpanded, setIsExpanded] = React.useState(false);
  const [copied, setCopied] = React.useState<'headline' | 'body' | 'full' | null>(null);

  const copyToClipboard = async (text: string, type: 'headline' | 'body' | 'full') => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(type);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      // Clipboard API not available or failed silently
    }
  };

  const fullAdText = `${ad.headline}\n\n${ad.body}\n\nCTA: ${ad.cta}`;

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 transition-all hover:border-zinc-700">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 p-5">
        <div className="min-w-0 flex-1">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <PlatformBadge platform={ad.platform} />
            <span className="inline-flex items-center gap-1 rounded-full bg-zinc-800 px-2.5 py-1 text-xs text-zinc-400">
              <FormatIcon format={ad.format} className="h-3 w-3" />
              {ad.format}
            </span>
            {ad.month && (
              <span className="rounded-full bg-amber-500/20 px-2.5 py-1 text-xs text-amber-400">
                {ad.month}
              </span>
            )}
          </div>
          <h3 className="text-lg font-semibold text-white">{ad.headline}</h3>
          <p className="mt-2 text-sm text-zinc-400 line-clamp-2">{ad.body}</p>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="flex items-center gap-2 border-t border-zinc-800 px-5 py-3">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center gap-1 text-sm font-medium text-zinc-400 transition-colors hover:text-white"
        >
          {isExpanded ? (
            <>
              <ChevronUp className="h-4 w-4" />
              Collapse
            </>
          ) : (
            <>
              <ChevronDown className="h-4 w-4" />
              Expand
            </>
          )}
        </button>
        <div className="flex-1" />
        <button
          onClick={() => copyToClipboard(fullAdText, 'full')}
          className={cn(
            'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
            copied === 'full'
              ? 'bg-lime-500/20 text-lime-400'
              : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
          )}
        >
          {copied === 'full' ? (
            <>
              <Check className="h-4 w-4" />
              Copied!
            </>
          ) : (
            <>
              <Copy className="h-4 w-4" />
              Copy Ad
            </>
          )}
        </button>
      </div>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="border-t border-zinc-800 p-5">
          <div className="space-y-4">
            {/* Headline */}
            <div>
              <div className="mb-2 flex items-center justify-between">
                <label className="text-xs font-medium uppercase tracking-wider text-zinc-500">
                  Headline
                </label>
                <button
                  onClick={() => copyToClipboard(ad.headline, 'headline')}
                  className={cn(
                    'flex items-center gap-1 text-xs transition-colors',
                    copied === 'headline' ? 'text-lime-400' : 'text-zinc-500 hover:text-zinc-300'
                  )}
                >
                  {copied === 'headline' ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                  {copied === 'headline' ? 'Copied' : 'Copy'}
                </button>
              </div>
              <p className="rounded-lg bg-zinc-800/50 p-3 text-white">{ad.headline}</p>
            </div>

            {/* Body */}
            <div>
              <div className="mb-2 flex items-center justify-between">
                <label className="text-xs font-medium uppercase tracking-wider text-zinc-500">
                  Body Copy
                </label>
                <button
                  onClick={() => copyToClipboard(ad.body, 'body')}
                  className={cn(
                    'flex items-center gap-1 text-xs transition-colors',
                    copied === 'body' ? 'text-lime-400' : 'text-zinc-500 hover:text-zinc-300'
                  )}
                >
                  {copied === 'body' ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                  {copied === 'body' ? 'Copied' : 'Copy'}
                </button>
              </div>
              <p className="whitespace-pre-wrap rounded-lg bg-zinc-800/50 p-3 text-sm text-zinc-300">
                {ad.body}
              </p>
            </div>

            {/* CTA */}
            <div>
              <label className="mb-2 block text-xs font-medium uppercase tracking-wider text-zinc-500">
                Call to Action
              </label>
              <span className="inline-block rounded-lg bg-lime-500/20 px-4 py-2 font-medium text-lime-400">
                {ad.cta}
              </span>
            </div>

            {/* Meta Info */}
            <div className="grid gap-4 border-t border-zinc-800 pt-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-medium uppercase tracking-wider text-zinc-500">
                  Target Audience
                </label>
                <div className="flex items-start gap-2">
                  <Target className="mt-0.5 h-4 w-4 text-zinc-500" />
                  <p className="text-sm text-zinc-300">{ad.targetAudience}</p>
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium uppercase tracking-wider text-zinc-500">
                  Campaign Focus
                </label>
                <div className="flex items-start gap-2">
                  <Megaphone className="mt-0.5 h-4 w-4 text-zinc-500" />
                  <p className="text-sm text-zinc-300">{ad.focus}</p>
                </div>
              </div>
            </div>

            {/* Visual Description */}
            <div className="border-t border-zinc-800 pt-4">
              <label className="mb-2 block text-xs font-medium uppercase tracking-wider text-zinc-500">
                Visual/Creative Direction
              </label>
              <p className="rounded-lg border border-dashed border-zinc-700 bg-zinc-800/30 p-3 text-sm italic text-zinc-400">
                {ad.visual}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function MarketingAdsPage() {
  const { user } = useAuth();
  const [platform, setPlatform] = React.useState<AdPlatform | 'all'>('all');

  // Check permission
  const userRole = (user?.role === 'owner' || user?.role === 'admin') ? 'Owner' :
                   user?.role === 'office' ? 'Office' :
                   user?.role === 'driver' ? 'Driver' : 'Sales';
  const canView = hasPermission(userRole as 'Owner' | 'Admin' | 'Manager' | 'Sales' | 'Driver' | 'Office', 'marketing.view');

  // Filter ads
  const filteredAds = platform === 'all' ? ADS : getAdsByPlatform(platform);

  // Count by platform
  const platformCounts: Record<AdPlatform | 'all', number> = {
    all: ADS.length,
    Facebook: ADS.filter(a => a.platform === 'Facebook' || a.platform === 'All').length,
    Instagram: ADS.filter(a => a.platform === 'Instagram' || a.platform === 'All').length,
    Google: ADS.filter(a => a.platform === 'Google' || a.platform === 'All').length,
    Print: ADS.filter(a => a.platform === 'Print' || a.platform === 'All').length,
    All: ADS.filter(a => a.platform === 'All').length,
  };

  if (!canView) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="text-center">
          <Image className="mx-auto h-12 w-12 text-zinc-600" />
          <h2 className="mt-4 text-xl font-semibold text-white">Access Restricted</h2>
          <p className="mt-2 text-zinc-400">
            You do not have permission to view the Ad Library.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <Link
          href="/command-center/marketing"
          className="mb-4 inline-flex items-center gap-1 text-sm text-zinc-400 transition-colors hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Marketing Hub
        </Link>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">Ad Library</h1>
            <p className="mt-1 text-zinc-400">
              {filteredAds.length} ad variation{filteredAds.length !== 1 ? 's' : ''} for Q1 2026 campaigns
            </p>
          </div>
        </div>
      </div>

      {/* Platform Filter */}
      <div className="flex items-center gap-4 overflow-x-auto rounded-xl border border-zinc-800 bg-zinc-900 p-4">
        <div className="flex items-center gap-2 text-zinc-400">
          <Filter className="h-4 w-4" />
          <span className="text-sm font-medium">Platform:</span>
        </div>
        <div className="flex gap-2">
          {PLATFORMS.map(({ value, label }) => (
            <button
              key={value}
              onClick={() => setPlatform(value)}
              className={cn(
                'flex items-center gap-2 whitespace-nowrap rounded-lg px-4 py-2 text-sm font-medium transition-all',
                platform === value
                  ? 'bg-lime-500 text-zinc-900'
                  : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-white'
              )}
            >
              {label}
              <span
                className={cn(
                  'rounded-full px-1.5 py-0.5 text-xs',
                  platform === value ? 'bg-zinc-900/20' : 'bg-zinc-700'
                )}
              >
                {platformCounts[value]}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Ad Grid */}
      <div className="grid gap-4 lg:grid-cols-2">
        {filteredAds.map((ad) => (
          <AdCard key={ad.id} ad={ad} />
        ))}
      </div>

      {/* Empty State */}
      {filteredAds.length === 0 && (
        <div className="flex min-h-[300px] items-center justify-center rounded-xl border border-dashed border-zinc-800">
          <div className="text-center">
            <Image className="mx-auto h-12 w-12 text-zinc-600" />
            <h3 className="mt-4 text-lg font-medium text-white">No ads found</h3>
            <p className="mt-2 text-sm text-zinc-400">
              No ads match the selected platform filter.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
