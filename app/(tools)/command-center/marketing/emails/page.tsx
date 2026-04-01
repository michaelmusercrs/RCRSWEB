'use client';

/**
 * RCRS Command Center - Email Campaigns
 *
 * Email campaign management hub:
 * - Campaign list/history with metrics
 * - Campaign metrics (sent, opened, clicked, bounced)
 * - Templates section showing available email templates
 * - Send campaign interface (select template, select audience, schedule)
 * - References lib/email-templates.ts for existing template types
 */

import * as React from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Mail,
  Send,
  Users,
  Eye,
  MousePointerClick,
  AlertTriangle,
  CheckCircle,
  Clock,
  Plus,
  FileText,
  Star,
  Zap,
  CloudRain,
  UserPlus,
  ExternalLink,
  BarChart3,
  Inbox,
  X,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// =============================================================================
// Types
// =============================================================================

interface EmailTemplate {
  id: string;
  name: string;
  description: string;
  icon: LucideIcon;
  color: string;
  subject: string;
  lastUsed?: string;
  category: 'customer' | 'marketing' | 'follow_up';
}

interface EmailCampaign {
  id: string;
  name: string;
  templateId: string;
  status: 'sent' | 'scheduled' | 'draft' | 'sending';
  sentDate?: string;
  scheduledDate?: string;
  audience: string;
  recipientCount: number;
  metrics: {
    sent: number;
    opened: number;
    clicked: number;
    bounced: number;
  };
}

type CampaignTab = 'campaigns' | 'templates' | 'compose';

// =============================================================================
// Template Data (matching lib/email-templates.ts)
// =============================================================================

const EMAIL_TEMPLATES: EmailTemplate[] = [
  {
    id: 'welcome',
    name: 'Welcome Email',
    description: 'Sent to customers on first login to the customer portal. Introduces RCRS and their assigned sales rep.',
    icon: UserPlus,
    color: 'blue',
    subject: 'Welcome to River City Roofing Solutions!',
    category: 'customer',
  },
  {
    id: 'quote-followup',
    name: 'Quote Follow-Up',
    description: 'Sent 2 days after an estimate is provided. Reminds customer of the quote and encourages scheduling.',
    icon: FileText,
    color: 'purple',
    subject: 'Your Roofing Estimate from River City Roofing',
    lastUsed: '2026-03-15',
    category: 'follow_up',
  },
  {
    id: 'job-complete-review',
    name: 'Job Complete + Review Request',
    description: 'Sent 2 days after job completion. Thanks the customer and asks for a Google review. Critical for closing the review gap.',
    icon: Star,
    color: 'amber',
    subject: 'How Did We Do? Your RCRS Project is Complete!',
    lastUsed: '2026-03-20',
    category: 'follow_up',
  },
  {
    id: 'referral-request',
    name: 'Referral Request',
    description: 'Quarterly email to past customers asking for referrals. Includes referral incentive details.',
    icon: Users,
    color: 'lime',
    subject: 'Know Someone Who Needs a Roof? Refer & Earn!',
    lastUsed: '2026-01-15',
    category: 'marketing',
  },
  {
    id: 'storm-alert',
    name: 'Storm Alert',
    description: 'Sent when severe weather hits service area. Offers free storm damage inspections to affected homeowners.',
    icon: CloudRain,
    color: 'orange',
    subject: 'Storm Alert: Free Damage Inspection Available',
    lastUsed: '2026-02-28',
    category: 'marketing',
  },
];

// =============================================================================
// Sample Campaign History
// =============================================================================

const SAMPLE_CAMPAIGNS: EmailCampaign[] = [
  {
    id: 'camp-1',
    name: 'Storm Alert - Feb 2026',
    templateId: 'storm-alert',
    status: 'sent',
    sentDate: '2026-02-28',
    audience: 'All customers in service area',
    recipientCount: 156,
    metrics: { sent: 156, opened: 89, clicked: 34, bounced: 3 },
  },
  {
    id: 'camp-2',
    name: 'Q1 2026 Referral Request',
    templateId: 'referral-request',
    status: 'sent',
    sentDate: '2026-01-15',
    audience: 'Past customers (completed jobs)',
    recipientCount: 203,
    metrics: { sent: 203, opened: 112, clicked: 28, bounced: 8 },
  },
  {
    id: 'camp-3',
    name: 'March Review Request Batch',
    templateId: 'job-complete-review',
    status: 'sent',
    sentDate: '2026-03-20',
    audience: 'Recent completed jobs (last 30 days)',
    recipientCount: 18,
    metrics: { sent: 18, opened: 14, clicked: 7, bounced: 0 },
  },
  {
    id: 'camp-4',
    name: 'Spring Inspection Offer',
    templateId: 'storm-alert',
    status: 'scheduled',
    scheduledDate: '2026-04-01',
    audience: 'All customers - spring outreach',
    recipientCount: 245,
    metrics: { sent: 0, opened: 0, clicked: 0, bounced: 0 },
  },
  {
    id: 'camp-5',
    name: 'Q2 Referral Campaign',
    templateId: 'referral-request',
    status: 'draft',
    audience: 'Past customers (completed jobs 2025-2026)',
    recipientCount: 0,
    metrics: { sent: 0, opened: 0, clicked: 0, bounced: 0 },
  },
];

// =============================================================================
// Audience Presets
// =============================================================================

const AUDIENCE_PRESETS = [
  { id: 'all', label: 'All Customers', description: 'Every customer in the database', count: 450 },
  { id: 'recent', label: 'Recent Jobs (30d)', description: 'Customers with jobs completed in last 30 days', count: 18 },
  { id: 'past', label: 'Past Customers', description: 'All customers with completed jobs', count: 280 },
  { id: 'service-area', label: 'Service Area', description: 'North Alabama service area contacts', count: 245 },
  { id: 'no-review', label: 'No Review Left', description: 'Completed customers who have not left a review', count: 195 },
  { id: 'estimate', label: 'Open Estimates', description: 'Customers with pending estimates', count: 32 },
];

// =============================================================================
// Sub-Components
// =============================================================================

function MetricCard({ label, value, icon: Icon, color, subtitle }: {
  label: string;
  value: string | number;
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

function CampaignStatusBadge({ status }: { status: EmailCampaign['status'] }) {
  const styles: Record<string, { bg: string; text: string; icon: LucideIcon }> = {
    sent: { bg: 'bg-lime-500/20', text: 'text-lime-400', icon: CheckCircle },
    scheduled: { bg: 'bg-blue-500/20', text: 'text-blue-400', icon: Clock },
    draft: { bg: 'bg-zinc-500/20', text: 'text-zinc-400', icon: FileText },
    sending: { bg: 'bg-amber-500/20', text: 'text-amber-400', icon: Send },
  };
  const style = styles[status] || styles.draft;
  const StatusIcon = style.icon;

  return (
    <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium', style.bg, style.text)}>
      <StatusIcon size={10} />
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

function TemplateCard({ template, onUse }: { template: EmailTemplate; onUse: (id: string) => void }) {
  const colorMap: Record<string, { bg: string; text: string }> = {
    blue: { bg: 'bg-blue-500/10', text: 'text-blue-400' },
    purple: { bg: 'bg-purple-500/10', text: 'text-purple-400' },
    amber: { bg: 'bg-amber-500/10', text: 'text-amber-400' },
    lime: { bg: 'bg-lime-500/10', text: 'text-lime-400' },
    orange: { bg: 'bg-orange-500/10', text: 'text-orange-400' },
  };
  const colors = colorMap[template.color] || colorMap.blue;
  const Icon = template.icon;

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5 hover:border-zinc-700 transition-colors">
      <div className="flex items-start gap-3 mb-3">
        <div className={cn('rounded-lg p-2 shrink-0', colors.bg)}>
          <Icon size={20} className={colors.text} />
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-semibold text-white">{template.name}</h4>
          <span className="text-[10px] text-zinc-600 uppercase tracking-wider">{template.category.replace('_', ' ')}</span>
        </div>
      </div>
      <p className="text-xs text-zinc-400 mb-3 line-clamp-2">{template.description}</p>
      <div className="flex items-center justify-between">
        <div className="text-xs text-zinc-600">
          {template.lastUsed ? (
            <>Last used: {new Date(template.lastUsed + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</>
          ) : (
            'Never used'
          )}
        </div>
        <button
          onClick={() => onUse(template.id)}
          className="text-xs font-medium text-brand-green hover:text-brand-green/80 transition-colors"
        >
          Use Template
        </button>
      </div>
      <div className="mt-2 pt-2 border-t border-zinc-800">
        <p className="text-[11px] text-zinc-500 truncate">
          Subject: {template.subject}
        </p>
      </div>
    </div>
  );
}

function ComposePanel({ selectedTemplateId, onCancel }: {
  selectedTemplateId: string | null;
  onCancel: () => void;
}) {
  const [templateId, setTemplateId] = React.useState(selectedTemplateId || '');
  const [campaignName, setCampaignName] = React.useState('');
  const [audienceId, setAudienceId] = React.useState('');
  const [scheduleDate, setScheduleDate] = React.useState('');
  const [showSuccess, setShowSuccess] = React.useState(false);

  const selectedTemplate = EMAIL_TEMPLATES.find(t => t.id === templateId);
  const selectedAudience = AUDIENCE_PRESETS.find(a => a.id === audienceId);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    setShowSuccess(true);
    setTimeout(() => setShowSuccess(false), 3000);
  };

  return (
    <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-white flex items-center gap-2">
          <Send size={18} className="text-brand-green" />
          Compose Campaign
        </h3>
        <button onClick={onCancel} className="text-zinc-400 hover:text-white transition-colors">
          <X size={20} />
        </button>
      </div>

      {showSuccess && (
        <div className="mb-4 flex items-center gap-2 px-4 py-3 bg-lime-500/10 border border-lime-500/20 rounded-xl text-sm text-lime-400">
          <CheckCircle size={16} />
          Campaign saved! {scheduleDate ? 'Scheduled for ' + scheduleDate : 'Saved as draft.'}
        </div>
      )}

      <form onSubmit={handleSend} className="space-y-5">
        {/* Campaign Name */}
        <div>
          <label className="block text-sm text-zinc-400 mb-1">Campaign Name</label>
          <input
            type="text"
            value={campaignName}
            onChange={(e) => setCampaignName(e.target.value)}
            className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-sm focus:outline-none focus:ring-1 focus:ring-brand-green focus:border-brand-green"
            placeholder="e.g. April Storm Season Outreach"
            required
          />
        </div>

        {/* Template Selection */}
        <div>
          <label className="block text-sm text-zinc-400 mb-2">Email Template</label>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {EMAIL_TEMPLATES.map((tmpl) => {
              const TmplIcon = tmpl.icon;
              const colorMap: Record<string, string> = {
                blue: 'bg-blue-500/10 text-blue-400',
                purple: 'bg-purple-500/10 text-purple-400',
                amber: 'bg-amber-500/10 text-amber-400',
                lime: 'bg-lime-500/10 text-lime-400',
                orange: 'bg-orange-500/10 text-orange-400',
              };
              return (
                <button
                  key={tmpl.id}
                  type="button"
                  onClick={() => setTemplateId(tmpl.id)}
                  className={cn(
                    'flex items-center gap-2 px-3 py-2.5 rounded-lg text-left text-sm transition-colors border',
                    templateId === tmpl.id
                      ? 'bg-brand-green/10 text-brand-green border-brand-green/30'
                      : 'bg-zinc-800 text-zinc-300 border-zinc-700 hover:bg-zinc-700'
                  )}
                >
                  <TmplIcon size={14} className={templateId === tmpl.id ? 'text-brand-green' : undefined} />
                  <span className="truncate">{tmpl.name}</span>
                </button>
              );
            })}
          </div>
          {selectedTemplate && (
            <p className="text-xs text-zinc-500 mt-2">
              Subject: &quot;{selectedTemplate.subject}&quot;
            </p>
          )}
        </div>

        {/* Audience Selection */}
        <div>
          <label className="block text-sm text-zinc-400 mb-2">Audience</label>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {AUDIENCE_PRESETS.map((audience) => (
              <button
                key={audience.id}
                type="button"
                onClick={() => setAudienceId(audience.id)}
                className={cn(
                  'flex flex-col px-3 py-2.5 rounded-lg text-left text-sm transition-colors border',
                  audienceId === audience.id
                    ? 'bg-brand-green/10 text-brand-green border-brand-green/30'
                    : 'bg-zinc-800 text-zinc-300 border-zinc-700 hover:bg-zinc-700'
                )}
              >
                <span className="font-medium">{audience.label}</span>
                <span className="text-xs text-zinc-500">{audience.count} contacts</span>
              </button>
            ))}
          </div>
        </div>

        {/* Schedule Date */}
        <div>
          <label className="block text-sm text-zinc-400 mb-1">Schedule (optional - leave empty to save as draft)</label>
          <input
            type="datetime-local"
            value={scheduleDate}
            onChange={(e) => setScheduleDate(e.target.value)}
            className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-sm focus:outline-none focus:ring-1 focus:ring-brand-green focus:border-brand-green"
          />
        </div>

        {/* Summary */}
        {templateId && audienceId && (
          <div className="bg-zinc-800 rounded-lg p-4 border border-zinc-700">
            <p className="text-xs text-zinc-500 uppercase tracking-wide mb-2">Campaign Summary</p>
            <div className="space-y-1 text-sm">
              <p className="text-zinc-300">
                <span className="text-zinc-500">Template:</span> {selectedTemplate?.name}
              </p>
              <p className="text-zinc-300">
                <span className="text-zinc-500">Audience:</span> {selectedAudience?.label} ({selectedAudience?.count} contacts)
              </p>
              <p className="text-zinc-300">
                <span className="text-zinc-500">Schedule:</span> {scheduleDate ? new Date(scheduleDate).toLocaleString() : 'Save as draft'}
              </p>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2.5 text-sm text-zinc-400 bg-white/5 rounded-lg hover:bg-white/10 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!templateId || !audienceId || !campaignName}
            className={cn(
              'flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-lg transition-colors',
              templateId && audienceId && campaignName
                ? 'bg-brand-green text-black hover:bg-brand-green/90'
                : 'bg-zinc-800 text-zinc-600 cursor-not-allowed'
            )}
          >
            <Send size={14} />
            {scheduleDate ? 'Schedule Campaign' : 'Save as Draft'}
          </button>
        </div>
      </form>

      {/* Important Note */}
      <div className="mt-4 pt-4 border-t border-zinc-800">
        <p className="text-xs text-zinc-600">
          Emails are sent via Google Apps Script through the RCRS Google Workspace.
          All email templates are branded with RCRS colors and include unsubscribe links.
          See lib/email-templates.ts for the full HTML template source code.
        </p>
      </div>
    </div>
  );
}

// =============================================================================
// Page Component
// =============================================================================

export default function EmailCampaignsPage() {
  const [activeTab, setActiveTab] = React.useState<CampaignTab>('campaigns');
  const [selectedTemplateForCompose, setSelectedTemplateForCompose] = React.useState<string | null>(null);

  // Aggregate metrics from all sent campaigns
  const sentCampaigns = SAMPLE_CAMPAIGNS.filter(c => c.status === 'sent');
  const totalSent = sentCampaigns.reduce((sum, c) => sum + c.metrics.sent, 0);
  const totalOpened = sentCampaigns.reduce((sum, c) => sum + c.metrics.opened, 0);
  const totalClicked = sentCampaigns.reduce((sum, c) => sum + c.metrics.clicked, 0);
  const totalBounced = sentCampaigns.reduce((sum, c) => sum + c.metrics.bounced, 0);
  const openRate = totalSent > 0 ? ((totalOpened / totalSent) * 100).toFixed(1) : '0';
  const clickRate = totalOpened > 0 ? ((totalClicked / totalOpened) * 100).toFixed(1) : '0';

  const handleUseTemplate = (templateId: string) => {
    setSelectedTemplateForCompose(templateId);
    setActiveTab('compose');
  };

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
                    <span className="text-neutral-400">Emails</span>
                  </div>
                  <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
                    <Mail size={22} className="text-blue-400" />
                    Email Campaigns
                  </h1>
                </div>
              </div>
              <button
                onClick={() => {
                  setSelectedTemplateForCompose(null);
                  setActiveTab('compose');
                }}
                className="flex items-center gap-2 px-4 py-2.5 bg-brand-green text-black font-semibold text-sm rounded-xl hover:bg-brand-green/90 transition-colors"
              >
                <Plus size={16} />
                New Campaign
              </button>
            </div>
          </div>
        </header>

        <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">

          {/* Aggregate Metrics */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <MetricCard label="Emails Sent" value={totalSent} icon={Send} color="blue" subtitle="All time" />
            <MetricCard label="Open Rate" value={`${openRate}%`} icon={Eye} color="lime" subtitle={`${totalOpened} opened`} />
            <MetricCard label="Click Rate" value={`${clickRate}%`} icon={MousePointerClick} color="purple" subtitle={`${totalClicked} clicked`} />
            <MetricCard label="Bounce Rate" value={totalSent > 0 ? `${((totalBounced / totalSent) * 100).toFixed(1)}%` : '0%'} icon={AlertTriangle} color="amber" subtitle={`${totalBounced} bounced`} />
          </div>

          {/* Tab Navigation */}
          <div className="flex gap-2 overflow-x-auto pb-1">
            {[
              { key: 'campaigns' as const, label: 'Campaigns', icon: Inbox },
              { key: 'templates' as const, label: 'Templates', icon: FileText },
              { key: 'compose' as const, label: 'Compose', icon: Send },
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

          {/* Campaigns Tab */}
          {activeTab === 'campaigns' && (
            <div className="space-y-4">
              <div className="bg-white/[0.02] border border-white/5 rounded-2xl overflow-hidden">
                <div className="px-6 py-4 border-b border-zinc-800">
                  <h3 className="text-md font-semibold text-white">Campaign History</h3>
                </div>
                <div className="divide-y divide-zinc-800/50">
                  {SAMPLE_CAMPAIGNS.map((campaign) => {
                    const template = EMAIL_TEMPLATES.find(t => t.id === campaign.templateId);
                    const openRate = campaign.metrics.sent > 0
                      ? ((campaign.metrics.opened / campaign.metrics.sent) * 100).toFixed(0)
                      : '0';
                    const clickRate = campaign.metrics.opened > 0
                      ? ((campaign.metrics.clicked / campaign.metrics.opened) * 100).toFixed(0)
                      : '0';

                    return (
                      <div key={campaign.id} className="px-6 py-4 hover:bg-white/[0.02] transition-colors">
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <h4 className="text-sm font-semibold text-white">{campaign.name}</h4>
                              <CampaignStatusBadge status={campaign.status} />
                            </div>
                            <p className="text-xs text-zinc-500">
                              {template?.name || 'Unknown template'} &middot; {campaign.audience}
                            </p>
                          </div>
                          <span className="text-xs text-zinc-600 shrink-0">
                            {campaign.sentDate || campaign.scheduledDate || 'Draft'}
                          </span>
                        </div>

                        {campaign.status === 'sent' && (
                          <div className="grid grid-cols-4 gap-4 mt-3 bg-zinc-900 rounded-lg p-3">
                            <div className="text-center">
                              <p className="text-lg font-bold text-white">{campaign.metrics.sent}</p>
                              <p className="text-[10px] text-zinc-500 uppercase">Sent</p>
                            </div>
                            <div className="text-center">
                              <p className="text-lg font-bold text-lime-400">{openRate}%</p>
                              <p className="text-[10px] text-zinc-500 uppercase">Opened</p>
                            </div>
                            <div className="text-center">
                              <p className="text-lg font-bold text-purple-400">{clickRate}%</p>
                              <p className="text-[10px] text-zinc-500 uppercase">Clicked</p>
                            </div>
                            <div className="text-center">
                              <p className="text-lg font-bold text-zinc-400">{campaign.metrics.bounced}</p>
                              <p className="text-[10px] text-zinc-500 uppercase">Bounced</p>
                            </div>
                          </div>
                        )}

                        {campaign.status === 'scheduled' && (
                          <div className="mt-2 flex items-center gap-2 text-xs text-blue-400">
                            <Clock size={12} />
                            Scheduled for {campaign.scheduledDate} &middot; {campaign.recipientCount} recipients
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {SAMPLE_CAMPAIGNS.length === 0 && (
                <div className="text-center py-12">
                  <Mail size={48} className="mx-auto text-zinc-700 mb-4" />
                  <p className="text-lg text-zinc-400 mb-2">No campaigns yet</p>
                  <p className="text-sm text-zinc-600 mb-4">Create your first email campaign to get started.</p>
                  <button
                    onClick={() => setActiveTab('compose')}
                    className="inline-flex items-center gap-2 px-4 py-2.5 bg-brand-green text-black font-medium text-sm rounded-xl hover:bg-brand-green/90 transition-colors"
                  >
                    <Plus size={14} />
                    Create Campaign
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Templates Tab */}
          {activeTab === 'templates' && (
            <div className="space-y-6">
              {/* Customer Templates */}
              <div>
                <h3 className="text-md font-semibold text-white mb-3 flex items-center gap-2">
                  <Users size={16} className="text-blue-400" />
                  Customer Lifecycle
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {EMAIL_TEMPLATES.filter(t => t.category === 'customer' || t.category === 'follow_up').map((template) => (
                    <TemplateCard key={template.id} template={template} onUse={handleUseTemplate} />
                  ))}
                </div>
              </div>

              {/* Marketing Templates */}
              <div>
                <h3 className="text-md font-semibold text-white mb-3 flex items-center gap-2">
                  <Zap size={16} className="text-amber-400" />
                  Marketing & Outreach
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {EMAIL_TEMPLATES.filter(t => t.category === 'marketing').map((template) => (
                    <TemplateCard key={template.id} template={template} onUse={handleUseTemplate} />
                  ))}
                </div>
              </div>

              {/* Source Info */}
              <div className="bg-blue-500/5 border border-blue-500/20 rounded-xl p-4">
                <div className="flex items-start gap-3">
                  <FileText size={16} className="text-blue-400 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-blue-300">Template Source Code</p>
                    <p className="text-xs text-zinc-400 mt-1">
                      All email templates are production-ready HTML with dark mode support, mobile responsiveness,
                      and RCRS branding. View and edit the source in{' '}
                      <code className="text-zinc-300 bg-zinc-800 px-1 rounded">lib/email-templates.ts</code>.
                      Templates include: Welcome, Quote Follow-up, Job Complete + Review Request,
                      Referral Request, and Storm Alert.
                    </p>
                  </div>
                </div>
              </div>

              {/* Review Campaign Priority */}
              <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-4">
                <div className="flex items-start gap-3">
                  <Star size={16} className="text-amber-400 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-amber-300">Priority: Review Generation</p>
                    <p className="text-xs text-zinc-400 mt-1">
                      Use the &quot;Job Complete + Review Request&quot; template after every completed job to close the
                      review gap with competitors. Target: 10+ new Google reviews per month.
                      Currently at 47 reviews vs. Yellowhammer&apos;s 1,355.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Compose Tab */}
          {activeTab === 'compose' && (
            <ComposePanel
              selectedTemplateId={selectedTemplateForCompose}
              onCancel={() => setActiveTab('campaigns')}
            />
          )}

        </main>
      </div>
    </div>
  );
}
