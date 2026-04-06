'use client';

/**
 * Monday Meeting Submission Widget
 *
 * Enhanced dashboard widget for team members to submit content for Monday meetings.
 * Supports text notes, image/video uploads, categories, and scheduling options.
 * Replaces/augments the simpler MondayAnnouncementWidget.
 */

import { useState, useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import {
  Megaphone, Send, Clock, Calendar, ChevronRight, ChevronDown,
  CheckCircle, Loader2, X, AlertCircle, Upload, ImageIcon, Video,
  Truck, TrendingUp, Settings, Building, Repeat, CalendarRange,
  FileText, Trash2,
} from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import {
  NoteCategory,
  AnnouncementType,
  ScheduleType,
  NoteSchedule,
  MondayNoteAttachment,
  CATEGORY_INFO,
  SCHEDULE_TYPE_LABELS,
  getNextMondayDate,
  getDaysUntilMonday,
  getCategoriesForRole,
  getDeadlineStatus,
  isPastMondayDeadline,
} from '@/lib/monday-notes-service';
import { TeamRole } from '@/lib/team-roles';

const CATEGORY_ICONS: Record<NoteCategory, typeof Truck> = {
  delivery: Truck,
  sales: TrendingUp,
  operations: Settings,
  office: Building,
  general: Megaphone,
};

export default function MondaySubmissionWidget() {
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isExpanded, setIsExpanded] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [category, setCategory] = useState<NoteCategory>('general');
  const [announcementType, setAnnouncementType] = useState<AnnouncementType>('early');
  const [scheduleType, setScheduleType] = useState<ScheduleType>('this-week');
  const [weeksCount, setWeeksCount] = useState(4);
  const [customEndDate, setCustomEndDate] = useState('');
  const [attachments, setAttachments] = useState<MondayNoteAttachment[]>([]);
  const [showScheduling, setShowScheduling] = useState(false);

  const nextMonday = getNextMondayDate();
  const daysUntil = getDaysUntilMonday();
  const mondayDisplay = new Date(nextMonday + 'T12:00:00').toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });

  const availableCategories = user ? getCategoriesForRole(user.role as TeamRole) : ['general'];
  const deadlineStatus = getDeadlineStatus();
  const isAdminOrOwner = user?.role === 'owner' || user?.role === 'admin';

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || !user) return;

    setIsUploading(true);
    setError(null);

    for (const file of Array.from(files)) {
      try {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('userId', user.userId);

        const res = await fetch('/api/portal/monday-notes/upload', {
          method: 'POST',
          body: formData,
        });

        const data = await res.json();
        if (data.success) {
          setAttachments(prev => [...prev, data.attachment]);
        } else {
          setError(data.error || 'Upload failed');
        }
      } catch {
        setError('Failed to upload file');
      }
    }

    setIsUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeAttachment = async (att: MondayNoteAttachment) => {
    try {
      await fetch(`/api/portal/monday-notes/upload?url=${encodeURIComponent(att.fileUrl)}`, {
        method: 'DELETE',
      });
    } catch { /* best effort */ }
    setAttachments(prev => prev.filter(a => a.id !== att.id));
  };

  const handleSubmit = async () => {
    if (!user || !title.trim() || !content.trim()) return;

    setIsSubmitting(true);
    setError(null);

    const schedule: NoteSchedule = {
      type: scheduleType,
      startDate: nextMonday,
      ...(scheduleType === 'for-x-weeks' ? { weeksCount } : {}),
      ...(scheduleType === 'custom-range' ? { endDate: customEndDate } : {}),
    };

    try {
      const response = await fetch('/api/portal/monday-notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.userId,
          userName: user.name,
          userRole: user.role,
          category,
          title: title.trim(),
          content: content.trim(),
          highlights: [title.trim()],
          attachments,
          announcementType,
          schedule,
          includeInSlide: true,
          status: 'submitted',
        }),
      });

      const data = await response.json();

      if (data.success) {
        setSuccess(true);
        setTitle('');
        setContent('');
        setCategory('general');
        setAnnouncementType('early');
        setScheduleType('this-week');
        setAttachments([]);
        setShowScheduling(false);
        setTimeout(() => {
          setSuccess(false);
          setIsExpanded(false);
        }, 3000);
      } else {
        setError(data.error || 'Failed to submit');
      }
    } catch {
      setError('Failed to submit');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!user) return null;

  return (
    <div className="bg-white/[0.02] border border-white/5 rounded-2xl overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full p-5 flex items-center gap-4 hover:bg-white/[0.02] transition-colors"
      >
        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500/20 to-yellow-500/20 border border-amber-500/30 flex items-center justify-center flex-shrink-0">
          <Megaphone size={22} className="text-amber-400" />
        </div>
        <div className="flex-1 text-left">
          <h3 className="font-semibold text-white">Submit for Monday Meeting</h3>
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
              <span className="text-sm text-green-400">Submitted! Pending admin approval.</span>
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

          {/* Deadline status banner */}
          {deadlineStatus.severity === 'locked' && !isAdminOrOwner && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/20">
              <Clock size={16} className="text-red-400" />
              <span className="text-sm text-red-400">{deadlineStatus.message}</span>
            </div>
          )}
          {deadlineStatus.severity === 'locked' && isAdminOrOwner && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-orange-500/10 border border-orange-500/20">
              <Clock size={16} className="text-orange-400" />
              <span className="text-sm text-orange-400">Deadline passed - admin override active</span>
            </div>
          )}
          {deadlineStatus.severity === 'warning' && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-yellow-500/10 border border-yellow-500/20">
              <Clock size={16} className="text-yellow-400" />
              <span className="text-sm text-yellow-400">{deadlineStatus.message}</span>
            </div>
          )}
          {deadlineStatus.severity === 'ok' && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-green-500/10 border border-green-500/20">
              <Clock size={16} className="text-green-400" />
              <span className="text-sm text-green-400">{deadlineStatus.message}</span>
            </div>
          )}

          {/* Category selector */}
          <div>
            <label className="block text-xs font-medium text-neutral-400 mb-2 uppercase tracking-wider">
              Category
            </label>
            <div className="flex flex-wrap gap-2">
              {availableCategories.map((cat) => {
                const info = CATEGORY_INFO[cat as NoteCategory];
                const Icon = CATEGORY_ICONS[cat as NoteCategory];
                return (
                  <button
                    key={cat}
                    onClick={() => setCategory(cat as NoteCategory)}
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs transition-all ${
                      category === cat
                        ? 'bg-brand-green/20 border-brand-green/40 text-brand-green'
                        : 'bg-white/5 border-white/10 text-neutral-400 hover:bg-white/10'
                    }`}
                  >
                    <Icon size={14} />
                    {info.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Title */}
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Title for your update..."
            maxLength={100}
            className="w-full bg-neutral-800/50 border border-neutral-700 rounded-xl px-4 py-3 text-white placeholder-neutral-500 focus:outline-none focus:border-amber-500/50 focus:ring-2 focus:ring-amber-500/20 text-sm"
          />

          {/* Content */}
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="What do you want to share at the meeting?"
            rows={3}
            maxLength={2000}
            className="w-full bg-neutral-800/50 border border-neutral-700 rounded-xl px-4 py-3 text-white placeholder-neutral-500 focus:outline-none focus:border-amber-500/50 focus:ring-2 focus:ring-amber-500/20 text-sm resize-none"
          />

          {/* File upload */}
          <div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,video/*,.pdf,.doc,.docx"
              multiple
              onChange={handleFileUpload}
              className="hidden"
            />
            <div className="flex items-center gap-2">
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                className="flex items-center gap-2 px-3 py-2 rounded-xl border border-white/10 bg-white/5 text-neutral-400 hover:bg-white/10 transition-colors text-xs"
              >
                {isUploading ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <Upload size={14} />
                )}
                Add Image/Video
              </button>
              {attachments.length > 0 && (
                <span className="text-xs text-neutral-500">
                  {attachments.length} file{attachments.length !== 1 ? 's' : ''} attached
                </span>
              )}
            </div>

            {/* Attachment previews */}
            {attachments.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {attachments.map((att) => (
                  <div
                    key={att.id}
                    className="relative group w-16 h-16 rounded-lg overflow-hidden border border-white/10"
                  >
                    {att.type === 'image' ? (
                      <Image
                        src={att.fileUrl}
                        alt={att.fileName}
                        fill
                        className="object-cover"
                      />
                    ) : att.mimeType?.startsWith('video/') ? (
                      <div className="w-full h-full bg-neutral-800 flex items-center justify-center">
                        <Video size={20} className="text-blue-400" />
                      </div>
                    ) : (
                      <div className="w-full h-full bg-neutral-800 flex items-center justify-center">
                        <FileText size={20} className="text-neutral-400" />
                      </div>
                    )}
                    <button
                      onClick={() => removeAttachment(att)}
                      className="absolute top-0 right-0 p-0.5 bg-red-500/80 rounded-bl-lg opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X size={12} className="text-white" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Announcement timing: Early vs Late */}
          <div>
            <label className="block text-xs font-medium text-neutral-400 mb-2 uppercase tracking-wider">
              When to show in meeting
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
                Early (before numbers)
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
                Late (after numbers)
              </button>
            </div>
          </div>

          {/* Scheduling toggle */}
          <button
            onClick={() => setShowScheduling(!showScheduling)}
            className="flex items-center gap-2 text-xs text-neutral-400 hover:text-neutral-300 transition-colors"
          >
            <Repeat size={14} />
            Scheduling Options
            <ChevronDown
              size={12}
              className={`transition-transform ${showScheduling ? 'rotate-180' : ''}`}
            />
          </button>

          {showScheduling && (
            <div className="space-y-3 p-3 rounded-xl bg-white/[0.02] border border-white/5">
              <label className="block text-xs font-medium text-neutral-400 uppercase tracking-wider">
                How often to show
              </label>
              <div className="grid grid-cols-2 gap-2">
                {(Object.entries(SCHEDULE_TYPE_LABELS) as [ScheduleType, string][]).map(
                  ([key, label]) => (
                    <button
                      key={key}
                      onClick={() => setScheduleType(key)}
                      className={`px-3 py-2 rounded-xl border text-xs transition-all text-left ${
                        scheduleType === key
                          ? 'bg-brand-green/20 border-brand-green/40 text-brand-green'
                          : 'bg-white/5 border-white/10 text-neutral-400 hover:bg-white/10'
                      }`}
                    >
                      {label}
                    </button>
                  )
                )}
              </div>

              {scheduleType === 'for-x-weeks' && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-neutral-400">Show for</span>
                  <input
                    type="number"
                    min={1}
                    max={52}
                    value={weeksCount}
                    onChange={(e) => setWeeksCount(parseInt(e.target.value) || 4)}
                    className="w-16 bg-neutral-800/50 border border-neutral-700 rounded-lg px-2 py-1 text-white text-sm text-center"
                  />
                  <span className="text-xs text-neutral-400">weeks</span>
                </div>
              )}

              {scheduleType === 'custom-range' && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-neutral-400">Show until</span>
                  <input
                    type="date"
                    value={customEndDate}
                    onChange={(e) => setCustomEndDate(e.target.value)}
                    className="bg-neutral-800/50 border border-neutral-700 rounded-lg px-3 py-1 text-white text-sm"
                  />
                </div>
              )}
            </div>
          )}

          {/* Submit row */}
          <div className="flex gap-2 pt-1">
            <button
              onClick={handleSubmit}
              disabled={isSubmitting || !title.trim() || !content.trim() || (deadlineStatus.severity === 'locked' && !isAdminOrOwner)}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-600 hover:to-yellow-600 disabled:from-neutral-700 disabled:to-neutral-700 text-black disabled:text-neutral-500 font-semibold rounded-xl transition-all text-sm disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Send size={16} />
              )}
              Submit for Meeting
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
