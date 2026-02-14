'use client';

/**
 * Monday Announcement Widget
 *
 * Dashboard widget for portal users to quickly submit announcements
 * for the Monday meeting with early/late timing and duration options.
 */

import { useState } from 'react';
import Link from 'next/link';
import {
  Megaphone,
  Send,
  Clock,
  Calendar,
  ChevronRight,
  CheckCircle,
  Loader2,
  X,
  AlertCircle,
} from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import {
  AnnouncementType,
  DisplayDuration,
  DISPLAY_DURATION_LABELS,
  getNextMondayDate,
  getDaysUntilMonday,
} from '@/lib/monday-notes-service';

export default function MondayAnnouncementWidget() {
  const { user } = useAuth();
  const [isExpanded, setIsExpanded] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [announcementType, setAnnouncementType] = useState<AnnouncementType>('early');
  const [displayDuration, setDisplayDuration] = useState<DisplayDuration>('one-time');

  const nextMonday = getNextMondayDate();
  const daysUntil = getDaysUntilMonday();
  const mondayDisplay = new Date(nextMonday).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });

  const handleSubmit = async () => {
    if (!user || !title.trim() || !content.trim()) return;

    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch('/api/portal/monday-notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.userId,
          userName: user.name,
          userRole: user.role,
          category: 'general',
          title: title.trim(),
          content: content.trim(),
          highlights: [title.trim()],
          announcementType,
          displayDuration,
          includeInSlide: true,
          status: 'submitted',
        }),
      });

      const data = await response.json();

      if (data.success) {
        setSuccess(true);
        setTitle('');
        setContent('');
        setAnnouncementType('early');
        setDisplayDuration('one-time');
        setTimeout(() => {
          setSuccess(false);
          setIsExpanded(false);
        }, 3000);
      } else {
        setError(data.error || 'Failed to submit');
      }
    } catch {
      setError('Failed to submit announcement');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!user) return null;

  return (
    <div className="bg-white/[0.02] border border-white/5 rounded-2xl overflow-hidden">
      {/* Header - always visible */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full p-5 flex items-center gap-4 hover:bg-white/[0.02] transition-colors"
      >
        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500/20 to-yellow-500/20 border border-amber-500/30 flex items-center justify-center flex-shrink-0">
          <Megaphone size={22} className="text-amber-400" />
        </div>
        <div className="flex-1 text-left">
          <h3 className="font-semibold text-white">Monday Meeting Announcement</h3>
          <p className="text-sm text-neutral-400">
            {daysUntil === 0
              ? "Today's meeting"
              : `${daysUntil} day${daysUntil !== 1 ? 's' : ''} until ${mondayDisplay}`}
          </p>
        </div>
        <ChevronRight
          size={20}
          className={`text-neutral-500 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
        />
      </button>

      {/* Expanded form */}
      {isExpanded && (
        <div className="px-5 pb-5 space-y-4 border-t border-white/5 pt-4">
          {success && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-green-500/10 border border-green-500/20">
              <CheckCircle size={16} className="text-green-400" />
              <span className="text-sm text-green-400">Announcement submitted!</span>
            </div>
          )}

          {error && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/20">
              <AlertCircle size={16} className="text-red-400" />
              <span className="text-sm text-red-400">{error}</span>
              <button onClick={() => setError(null)} className="ml-auto">
                <X size={14} className="text-red-400" />
              </button>
            </div>
          )}

          {/* Title */}
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Announcement title..."
            maxLength={100}
            className="w-full bg-neutral-800/50 border border-neutral-700 rounded-xl px-4 py-3 text-white placeholder-neutral-500 focus:outline-none focus:border-amber-500/50 focus:ring-2 focus:ring-amber-500/20 text-sm"
          />

          {/* Content */}
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="What do you want to announce?"
            rows={3}
            maxLength={500}
            className="w-full bg-neutral-800/50 border border-neutral-700 rounded-xl px-4 py-3 text-white placeholder-neutral-500 focus:outline-none focus:border-amber-500/50 focus:ring-2 focus:ring-amber-500/20 text-sm resize-none"
          />

          {/* Announcement Type: Early vs Late */}
          <div>
            <label className="block text-xs font-medium text-neutral-400 mb-2 uppercase tracking-wider">
              When to show
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setAnnouncementType('early')}
                className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-sm transition-all ${
                  announcementType === 'early'
                    ? 'bg-amber-500/20 border-amber-500/40 text-amber-400'
                    : 'bg-white/5 border-white/10 text-neutral-400 hover:bg-white/10'
                }`}
              >
                <Clock size={14} />
                Early Announcements
              </button>
              <button
                onClick={() => setAnnouncementType('late')}
                className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-sm transition-all ${
                  announcementType === 'late'
                    ? 'bg-purple-500/20 border-purple-500/40 text-purple-400'
                    : 'bg-white/5 border-white/10 text-neutral-400 hover:bg-white/10'
                }`}
              >
                <Calendar size={14} />
                Late Announcements
              </button>
            </div>
            <p className="text-xs text-neutral-500 mt-1.5">
              {announcementType === 'early'
                ? 'Shown at the beginning of the meeting, before numbers'
                : 'Shown after sales numbers and leaderboard'}
            </p>
          </div>

          {/* Display Duration */}
          <div>
            <label className="block text-xs font-medium text-neutral-400 mb-2 uppercase tracking-wider">
              How long to run
            </label>
            <div className="grid grid-cols-2 gap-2">
              {(Object.entries(DISPLAY_DURATION_LABELS) as [DisplayDuration, string][]).map(
                ([key, label]) => (
                  <button
                    key={key}
                    onClick={() => setDisplayDuration(key)}
                    className={`px-3 py-2 rounded-xl border text-xs transition-all ${
                      displayDuration === key
                        ? 'bg-brand-green/20 border-brand-green/40 text-brand-green'
                        : 'bg-white/5 border-white/10 text-neutral-400 hover:bg-white/10'
                    }`}
                  >
                    {label}
                  </button>
                )
              )}
            </div>
          </div>

          {/* Submit */}
          <div className="flex gap-2 pt-1">
            <button
              onClick={handleSubmit}
              disabled={isSubmitting || !title.trim() || !content.trim()}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-600 hover:to-yellow-600 disabled:from-neutral-700 disabled:to-neutral-700 text-black disabled:text-neutral-500 font-semibold rounded-xl transition-all text-sm disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Send size={16} />
              )}
              Submit Announcement
            </button>
            <Link
              href="/portal/monday-notes"
              className="flex items-center justify-center gap-2 px-4 py-3 bg-white/5 hover:bg-white/10 border border-white/10 text-neutral-400 rounded-xl transition-colors text-sm"
            >
              Full Notes
              <ChevronRight size={14} />
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
