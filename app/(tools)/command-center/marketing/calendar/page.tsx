'use client';

/**
 * RCRS Command Center - Content Calendar
 *
 * Monthly calendar view for planning and scheduling marketing content:
 * - Blog posts (auto-publish via /api/cron/publish-blog)
 * - Social media posts
 * - Email campaigns
 * - Simple calendar grid layout with content items per day
 * - Add content interface
 */

import * as React from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Plus,
  FileText,
  Share2,
  Mail,
  Image,
  Star,
  Clock,
  CheckCircle,
  AlertCircle,
  X,
  Loader2,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// =============================================================================
// Types
// =============================================================================

type ContentType = 'blog' | 'social' | 'email' | 'ad' | 'review_request';

interface ContentItem {
  id: string;
  title: string;
  type: ContentType;
  date: string; // YYYY-MM-DD
  time?: string;
  status: 'scheduled' | 'published' | 'draft' | 'pending_review';
  platform?: string;
  description?: string;
}

interface CalendarDay {
  date: Date;
  isCurrentMonth: boolean;
  isToday: boolean;
  items: ContentItem[];
}

// =============================================================================
// Constants
// =============================================================================

const CONTENT_TYPE_CONFIG: Record<ContentType, { label: string; icon: LucideIcon; color: string; bgColor: string }> = {
  blog: { label: 'Blog Post', icon: FileText, color: 'text-blue-400', bgColor: 'bg-blue-500/20' },
  social: { label: 'Social Media', icon: Share2, color: 'text-purple-400', bgColor: 'bg-purple-500/20' },
  email: { label: 'Email Campaign', icon: Mail, color: 'text-amber-400', bgColor: 'bg-amber-500/20' },
  ad: { label: 'Ad Campaign', icon: Image, color: 'text-lime-400', bgColor: 'bg-lime-500/20' },
  review_request: { label: 'Review Request', icon: Star, color: 'text-orange-400', bgColor: 'bg-orange-500/20' },
};

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  scheduled: { label: 'Scheduled', color: 'text-blue-400' },
  published: { label: 'Published', color: 'text-lime-400' },
  draft: { label: 'Draft', color: 'text-zinc-400' },
  pending_review: { label: 'Pending Review', color: 'text-amber-400' },
};

const DAYS_OF_WEEK = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// =============================================================================
// Sample Content (seeded data based on actual RCRS content pipeline)
// =============================================================================

const SAMPLE_CONTENT: ContentItem[] = [
  // Blog posts - Friday publish schedule (matches cron job)
  {
    id: 'blog-1',
    title: 'Storm Season Roof Preparation Checklist',
    type: 'blog',
    date: '2026-03-27',
    status: 'published',
    platform: 'Website',
    description: 'SEO blog post targeting storm damage prevention keywords',
  },
  {
    id: 'blog-2',
    title: 'IKO ROOFPRO: What It Means for Your Roof',
    type: 'blog',
    date: '2026-04-03',
    status: 'scheduled',
    platform: 'Website',
    description: 'Certification advantage blog post',
  },
  {
    id: 'blog-3',
    title: 'Insurance Claim Process: Step-by-Step Guide',
    type: 'blog',
    date: '2026-04-10',
    status: 'draft',
    platform: 'Website',
    description: 'Educational content for homeowners',
  },
  {
    id: 'blog-4',
    title: 'Top 5 Signs You Need a Roof Replacement',
    type: 'blog',
    date: '2026-04-17',
    status: 'draft',
    platform: 'Website',
  },
  // Social media
  {
    id: 'social-1',
    title: 'Before/After: Decatur Roof Replacement',
    type: 'social',
    date: '2026-03-28',
    status: 'scheduled',
    platform: 'Facebook & Instagram',
    description: 'Photo carousel of recent project',
  },
  {
    id: 'social-2',
    title: 'Meet the RCRS Team - Friday Feature',
    type: 'social',
    date: '2026-03-28',
    status: 'draft',
    platform: 'Facebook',
    description: 'Team spotlight series',
  },
  {
    id: 'social-3',
    title: 'Spring Roof Maintenance Tips',
    type: 'social',
    date: '2026-04-01',
    status: 'scheduled',
    platform: 'Facebook & Instagram',
  },
  {
    id: 'social-4',
    title: 'Customer Testimonial Video',
    type: 'social',
    date: '2026-04-05',
    status: 'draft',
    platform: 'Facebook & Instagram',
  },
  // Email campaigns
  {
    id: 'email-1',
    title: 'Spring Inspection Offer',
    type: 'email',
    date: '2026-04-01',
    status: 'scheduled',
    platform: 'Email',
    description: 'Free spring inspection offer to past customers',
  },
  {
    id: 'email-2',
    title: 'Quarterly Referral Request',
    type: 'email',
    date: '2026-04-15',
    status: 'draft',
    platform: 'Email',
    description: 'Referral request to completed job customers',
  },
  // Review requests
  {
    id: 'review-1',
    title: 'Review Request Batch',
    type: 'review_request',
    date: '2026-03-31',
    status: 'scheduled',
    platform: 'Google Reviews',
    description: 'Send review requests to last 10 completed jobs',
  },
];

// =============================================================================
// Utility Functions
// =============================================================================

function getCalendarDays(year: number, month: number, contentItems: ContentItem[]): CalendarDay[] {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startDate = new Date(firstDay);
  startDate.setDate(startDate.getDate() - startDate.getDay());

  const endDate = new Date(lastDay);
  endDate.setDate(endDate.getDate() + (6 - endDate.getDay()));

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const days: CalendarDay[] = [];
  const current = new Date(startDate);

  while (current <= endDate) {
    const dateStr = current.toISOString().split('T')[0];
    const dayItems = contentItems.filter(item => item.date === dateStr);

    days.push({
      date: new Date(current),
      isCurrentMonth: current.getMonth() === month,
      isToday: current.getTime() === today.getTime(),
      items: dayItems,
    });

    current.setDate(current.getDate() + 1);
  }

  return days;
}

function formatMonthYear(year: number, month: number): string {
  return new Date(year, month).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

// =============================================================================
// Sub-Components
// =============================================================================

function ContentBadge({ item }: { item: ContentItem }) {
  const config = CONTENT_TYPE_CONFIG[item.type];
  const Icon = config.icon;

  return (
    <div className={cn(
      'flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium truncate cursor-pointer',
      config.bgColor, config.color
    )} title={`${item.title} (${config.label})`}>
      <Icon size={10} className="shrink-0" />
      <span className="truncate">{item.title}</span>
    </div>
  );
}

function ContentDetailModal({ item, onClose }: { item: ContentItem; onClose: () => void }) {
  const config = CONTENT_TYPE_CONFIG[item.type];
  const statusConfig = STATUS_CONFIG[item.status];
  const Icon = config.icon;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-zinc-900 border border-zinc-700 rounded-2xl p-6 max-w-md w-full shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className={cn('rounded-lg p-2', config.bgColor)}>
              <Icon size={20} className={config.color} />
            </div>
            <div>
              <p className="text-xs text-zinc-500 uppercase tracking-wide">{config.label}</p>
              <h3 className="text-lg font-semibold text-white">{item.title}</h3>
            </div>
          </div>
          <button onClick={onClose} className="text-zinc-400 hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Calendar size={14} className="text-zinc-500" />
            <span className="text-sm text-zinc-300">
              {new Date(item.date + 'T00:00:00').toLocaleDateString('en-US', {
                weekday: 'long',
                month: 'long',
                day: 'numeric',
                year: 'numeric',
              })}
            </span>
          </div>

          {item.platform && (
            <div className="flex items-center gap-2">
              <Share2 size={14} className="text-zinc-500" />
              <span className="text-sm text-zinc-300">{item.platform}</span>
            </div>
          )}

          <div className="flex items-center gap-2">
            <Clock size={14} className="text-zinc-500" />
            <span className={cn('text-sm font-medium', statusConfig.color)}>{statusConfig.label}</span>
          </div>

          {item.description && (
            <div className="pt-2 border-t border-zinc-800">
              <p className="text-sm text-zinc-400">{item.description}</p>
            </div>
          )}

          {item.type === 'blog' && (
            <div className="pt-2 border-t border-zinc-800">
              <p className="text-xs text-zinc-500">
                Blog posts with &quot;approved&quot; status are auto-published on their scheduled date
                via the /api/cron/publish-blog cron job.
              </p>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 mt-6">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-zinc-400 bg-white/5 rounded-lg hover:bg-white/10 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

function AddContentModal({ onClose, onAdd, defaultDate }: {
  onClose: () => void;
  onAdd: (item: ContentItem) => void;
  defaultDate: string;
}) {
  const [title, setTitle] = React.useState('');
  const [type, setType] = React.useState<ContentType>('blog');
  const [date, setDate] = React.useState(defaultDate);
  const [platform, setPlatform] = React.useState('');
  const [description, setDescription] = React.useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    const newItem: ContentItem = {
      id: `custom-${Date.now()}`,
      title: title.trim(),
      type,
      date,
      status: 'draft',
      platform: platform || undefined,
      description: description || undefined,
    };

    onAdd(newItem);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-zinc-900 border border-zinc-700 rounded-2xl p-6 max-w-md w-full shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-white">Schedule Content</h3>
          <button onClick={onClose} className="text-zinc-400 hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm text-zinc-400 mb-1">Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-sm focus:outline-none focus:ring-1 focus:ring-brand-green focus:border-brand-green"
              placeholder="Content title..."
              required
            />
          </div>

          <div>
            <label className="block text-sm text-zinc-400 mb-1">Content Type</label>
            <div className="grid grid-cols-3 gap-2">
              {(Object.entries(CONTENT_TYPE_CONFIG) as [ContentType, typeof CONTENT_TYPE_CONFIG[ContentType]][]).map(([key, config]) => {
                const TypeIcon = config.icon;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setType(key)}
                    className={cn(
                      'flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors border',
                      type === key
                        ? `${config.bgColor} ${config.color} border-current`
                        : 'bg-zinc-800 text-zinc-400 border-zinc-700 hover:bg-zinc-700'
                    )}
                  >
                    <TypeIcon size={12} />
                    {config.label.split(' ')[0]}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="block text-sm text-zinc-400 mb-1">Date</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-sm focus:outline-none focus:ring-1 focus:ring-brand-green focus:border-brand-green"
              required
            />
          </div>

          <div>
            <label className="block text-sm text-zinc-400 mb-1">Platform (optional)</label>
            <input
              type="text"
              value={platform}
              onChange={(e) => setPlatform(e.target.value)}
              className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-sm focus:outline-none focus:ring-1 focus:ring-brand-green focus:border-brand-green"
              placeholder="e.g. Facebook & Instagram, Website, Email"
            />
          </div>

          <div>
            <label className="block text-sm text-zinc-400 mb-1">Description (optional)</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-sm focus:outline-none focus:ring-1 focus:ring-brand-green focus:border-brand-green resize-none"
              rows={2}
              placeholder="Brief description..."
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-zinc-400 bg-white/5 rounded-lg hover:bg-white/10 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-sm font-medium text-black bg-brand-green rounded-lg hover:bg-brand-green/90 transition-colors"
            >
              Schedule
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// =============================================================================
// Page Component
// =============================================================================

export default function ContentCalendarPage() {
  const now = new Date();
  const [currentYear, setCurrentYear] = React.useState(now.getFullYear());
  const [currentMonth, setCurrentMonth] = React.useState(now.getMonth());
  const [contentItems, setContentItems] = React.useState<ContentItem[]>(SAMPLE_CONTENT);
  const [selectedItem, setSelectedItem] = React.useState<ContentItem | null>(null);
  const [showAddModal, setShowAddModal] = React.useState(false);
  const [addModalDate, setAddModalDate] = React.useState('');
  const [filterType, setFilterType] = React.useState<ContentType | 'all'>('all');

  const filteredItems = filterType === 'all'
    ? contentItems
    : contentItems.filter(item => item.type === filterType);

  const calendarDays = getCalendarDays(currentYear, currentMonth, filteredItems);

  const goToPrevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear(currentYear - 1);
    } else {
      setCurrentMonth(currentMonth - 1);
    }
  };

  const goToNextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear(currentYear + 1);
    } else {
      setCurrentMonth(currentMonth + 1);
    }
  };

  const goToToday = () => {
    setCurrentYear(now.getFullYear());
    setCurrentMonth(now.getMonth());
  };

  const handleAddContent = (item: ContentItem) => {
    setContentItems([...contentItems, item]);
  };

  const handleDayClick = (day: CalendarDay) => {
    const dateStr = day.date.toISOString().split('T')[0];
    setAddModalDate(dateStr);
    setShowAddModal(true);
  };

  // Stats for current month
  const monthStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}`;
  const monthItems = contentItems.filter(item => item.date.startsWith(monthStr));
  const publishedCount = monthItems.filter(item => item.status === 'published').length;
  const scheduledCount = monthItems.filter(item => item.status === 'scheduled').length;
  const draftCount = monthItems.filter(item => item.status === 'draft').length;

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
                    <span className="text-neutral-400">Calendar</span>
                  </div>
                  <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
                    <Calendar size={22} className="text-lime-400" />
                    Content Calendar
                  </h1>
                </div>
              </div>
              <button
                onClick={() => {
                  const todayStr = new Date().toISOString().split('T')[0];
                  setAddModalDate(todayStr);
                  setShowAddModal(true);
                }}
                className="flex items-center gap-2 px-4 py-2.5 bg-brand-green text-black font-semibold text-sm rounded-xl hover:bg-brand-green/90 transition-colors"
              >
                <Plus size={16} />
                Add Content
              </button>
            </div>
          </div>
        </header>

        <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">

          {/* Monthly Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
              <p className="text-xs text-zinc-500 uppercase tracking-wide">This Month</p>
              <p className="text-2xl font-bold text-white mt-1">{monthItems.length}</p>
              <p className="text-xs text-zinc-500">total items</p>
            </div>
            <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
              <p className="text-xs text-zinc-500 uppercase tracking-wide">Published</p>
              <p className="text-2xl font-bold text-lime-400 mt-1">{publishedCount}</p>
              <p className="text-xs text-zinc-500">completed</p>
            </div>
            <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
              <p className="text-xs text-zinc-500 uppercase tracking-wide">Scheduled</p>
              <p className="text-2xl font-bold text-blue-400 mt-1">{scheduledCount}</p>
              <p className="text-xs text-zinc-500">upcoming</p>
            </div>
            <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
              <p className="text-xs text-zinc-500 uppercase tracking-wide">Drafts</p>
              <p className="text-2xl font-bold text-zinc-400 mt-1">{draftCount}</p>
              <p className="text-xs text-zinc-500">in progress</p>
            </div>
          </div>

          {/* Calendar Controls */}
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-3">
              <button
                onClick={goToPrevMonth}
                className="w-9 h-9 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors"
              >
                <ChevronLeft size={18} className="text-neutral-400" />
              </button>
              <h2 className="text-lg font-semibold text-white min-w-[180px] text-center">
                {formatMonthYear(currentYear, currentMonth)}
              </h2>
              <button
                onClick={goToNextMonth}
                className="w-9 h-9 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors"
              >
                <ChevronRight size={18} className="text-neutral-400" />
              </button>
              <button
                onClick={goToToday}
                className="px-3 py-1.5 text-xs font-medium text-zinc-400 bg-white/5 rounded-lg hover:bg-white/10 transition-colors"
              >
                Today
              </button>
            </div>

            {/* Content Type Filter */}
            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={() => setFilterType('all')}
                className={cn(
                  'px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
                  filterType === 'all'
                    ? 'bg-brand-green/20 text-brand-green ring-1 ring-brand-green/30'
                    : 'bg-white/5 text-zinc-400 hover:bg-white/10'
                )}
              >
                All
              </button>
              {(Object.entries(CONTENT_TYPE_CONFIG) as [ContentType, typeof CONTENT_TYPE_CONFIG[ContentType]][]).map(([key, config]) => {
                const TypeIcon = config.icon;
                return (
                  <button
                    key={key}
                    onClick={() => setFilterType(key)}
                    className={cn(
                      'flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
                      filterType === key
                        ? `${config.bgColor} ${config.color} ring-1 ring-current/30`
                        : 'bg-white/5 text-zinc-400 hover:bg-white/10'
                    )}
                  >
                    <TypeIcon size={12} />
                    {config.label.split(' ')[0]}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Calendar Grid */}
          <div className="bg-white/[0.02] border border-white/5 rounded-2xl overflow-hidden">
            {/* Day headers */}
            <div className="grid grid-cols-7 border-b border-zinc-800">
              {DAYS_OF_WEEK.map((day) => (
                <div key={day} className="px-2 py-3 text-center text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                  {day}
                </div>
              ))}
            </div>

            {/* Calendar body */}
            <div className="grid grid-cols-7">
              {calendarDays.map((day, index) => {
                const dateStr = day.date.toISOString().split('T')[0];
                return (
                  <div
                    key={dateStr + index}
                    className={cn(
                      'min-h-[100px] sm:min-h-[120px] border-b border-r border-zinc-800/50 p-1.5 transition-colors',
                      !day.isCurrentMonth && 'bg-zinc-950/50',
                      day.isToday && 'bg-brand-green/5 border-brand-green/20',
                      day.isCurrentMonth && 'hover:bg-white/[0.02] cursor-pointer'
                    )}
                    onClick={() => day.isCurrentMonth && handleDayClick(day)}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className={cn(
                        'text-xs font-medium',
                        day.isToday ? 'text-brand-green font-bold' :
                        day.isCurrentMonth ? 'text-zinc-400' : 'text-zinc-700'
                      )}>
                        {day.date.getDate()}
                      </span>
                      {day.isToday && (
                        <span className="text-[9px] font-bold text-brand-green uppercase tracking-wider">Today</span>
                      )}
                    </div>
                    <div className="space-y-0.5">
                      {day.items.slice(0, 3).map((item) => (
                        <div
                          key={item.id}
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedItem(item);
                          }}
                        >
                          <ContentBadge item={item} />
                        </div>
                      ))}
                      {day.items.length > 3 && (
                        <p className="text-[10px] text-zinc-500 px-1">+{day.items.length - 3} more</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Upcoming Content List */}
          <section className="bg-white/[0.02] border border-white/5 rounded-2xl p-6">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <Clock size={18} className="text-blue-400" />
              Upcoming Scheduled Content
            </h3>
            <div className="space-y-3">
              {contentItems
                .filter(item => item.status === 'scheduled' || item.status === 'draft')
                .sort((a, b) => a.date.localeCompare(b.date))
                .slice(0, 8)
                .map((item) => {
                  const config = CONTENT_TYPE_CONFIG[item.type];
                  const statusCfg = STATUS_CONFIG[item.status];
                  const Icon = config.icon;
                  return (
                    <div
                      key={item.id}
                      className="flex items-center gap-3 p-3 bg-zinc-900 rounded-xl border border-zinc-800 hover:border-zinc-700 cursor-pointer transition-colors"
                      onClick={() => setSelectedItem(item)}
                    >
                      <div className={cn('rounded-lg p-2 shrink-0', config.bgColor)}>
                        <Icon size={16} className={config.color} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-white truncate">{item.title}</p>
                        <p className="text-xs text-zinc-500">
                          {new Date(item.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                          {item.platform && ` - ${item.platform}`}
                        </p>
                      </div>
                      <span className={cn('text-xs font-medium', statusCfg.color)}>
                        {statusCfg.label}
                      </span>
                    </div>
                  );
                })}
              {contentItems.filter(item => item.status === 'scheduled' || item.status === 'draft').length === 0 && (
                <div className="text-center py-8">
                  <Calendar size={32} className="mx-auto text-zinc-700 mb-3" />
                  <p className="text-sm text-zinc-500">No upcoming content scheduled</p>
                  <button
                    onClick={() => {
                      const todayStr = new Date().toISOString().split('T')[0];
                      setAddModalDate(todayStr);
                      setShowAddModal(true);
                    }}
                    className="mt-3 inline-flex items-center gap-2 px-4 py-2 text-sm text-zinc-300 bg-white/5 rounded-lg hover:bg-white/10 transition-colors"
                  >
                    <Plus size={14} />
                    Schedule Content
                  </button>
                </div>
              )}
            </div>
          </section>

          {/* Publishing Notes */}
          <section className="bg-blue-500/5 border border-blue-500/20 rounded-xl p-4">
            <div className="flex items-start gap-3">
              <FileText size={16} className="text-blue-400 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-medium text-blue-300">Blog Auto-Publishing</p>
                <p className="text-xs text-zinc-400 mt-1">
                  Blog posts with &quot;approved&quot; status are automatically published on their scheduled date
                  via the <code className="text-zinc-300 bg-zinc-800 px-1 rounded">/api/cron/publish-blog</code> cron job.
                  Set the publish date when approving a blog post, and it will go live automatically.
                </p>
              </div>
            </div>
          </section>

        </main>
      </div>

      {/* Detail Modal */}
      {selectedItem && (
        <ContentDetailModal item={selectedItem} onClose={() => setSelectedItem(null)} />
      )}

      {/* Add Content Modal */}
      {showAddModal && (
        <AddContentModal
          onClose={() => setShowAddModal(false)}
          onAdd={handleAddContent}
          defaultDate={addModalDate}
        />
      )}
    </div>
  );
}
