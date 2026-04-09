'use client';

/**
 * Department Notes Widget
 *
 * Compact, embeddable widget for department dashboards that lets team members
 * see their existing Monday notes, quick-add new notes with attachments,
 * and track submission status with a deadline countdown.
 *
 * Props:
 *   category - auto-set category for this department (e.g. 'sales', 'delivery', 'office')
 *   compact  - if true, uses a more condensed layout
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import {
  FileText, Upload, Send, Trash2, Plus, ChevronRight,
  AlertCircle, CheckCircle, Loader2, Clock, X, Edit3,
  Megaphone, Truck, TrendingUp, Settings, Building,
  Video, ImageIcon, ChevronDown,
} from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import {
  MondayNote,
  MondayNoteAttachment,
  NoteCategory,
  CATEGORY_INFO,
  getNextMondayDate,
  getDaysUntilMonday,
  areSubmissionsOpen,
  getSubmissionDeadline,
} from '@/lib/monday-notes-service';

const CATEGORY_ICONS: Record<NoteCategory, typeof Truck> = {
  delivery: Truck,
  sales: TrendingUp,
  operations: Settings,
  office: Building,
  general: Megaphone,
};

interface DeptNotesWidgetProps {
  category?: NoteCategory;
  compact?: boolean;
}

export default function DeptNotesWidget({ category = 'general', compact = false }: DeptNotesWidgetProps) {
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Data state
  const [existingNotes, setExistingNotes] = useState<MondayNote[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Form state
  const [isExpanded, setIsExpanded] = useState(false);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [attachments, setAttachments] = useState<MondayNoteAttachment[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Meeting info
  const nextMondayDate = getNextMondayDate();
  const daysUntil = getDaysUntilMonday();
  const submissionsOpen = areSubmissionsOpen();
  const deadline = getSubmissionDeadline();

  const categoryInfo = CATEGORY_INFO[category];
  const CategoryIcon = CATEGORY_ICONS[category];

  // Countdown string
  const getCountdown = useCallback(() => {
    const now = new Date();
    const diff = deadline.getTime() - now.getTime();
    if (diff <= 0) return 'Deadline passed';
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    if (days > 0) return `${days}d ${hours}h remaining`;
    const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${mins}m remaining`;
  }, [deadline]);

  const [countdown, setCountdown] = useState(getCountdown());

  // Update countdown every minute
  useEffect(() => {
    const interval = setInterval(() => setCountdown(getCountdown()), 60000);
    return () => clearInterval(interval);
  }, [getCountdown]);

  // Fetch existing notes for this user + category + upcoming Monday
  const loadNotes = useCallback(async () => {
    if (!user) return;
    try {
      const res = await fetch(
        `/api/portal/monday-notes?meetingDate=${nextMondayDate}&userId=${user.userId}`
      );
      if (res.ok) {
        const data = await res.json();
        if (data.notes) {
          // Filter to this category (user may have notes in multiple categories)
          const filtered = data.notes.filter(
            (n: MondayNote) => n.category === category
          );
          setExistingNotes(filtered);
        }
      }
    } catch (err) {
      // Silent failure - widget is non-critical
    } finally {
      setIsLoading(false);
    }
  }, [user, nextMondayDate, category]);

  useEffect(() => {
    loadNotes();
  }, [loadNotes]);

  // Determine submission status
  const hasSubmitted = existingNotes.some(n => n.status === 'submitted' || n.status === 'approved');
  const hasDraft = existingNotes.some(n => n.status === 'draft');
  const latestNote = existingNotes[0];

  const statusLabel = hasSubmitted
    ? 'Submitted'
    : hasDraft
    ? 'Draft saved'
    : 'Not yet submitted';

  const statusColor = hasSubmitted
    ? 'text-green-400 bg-green-500/10 border-green-500/20'
    : hasDraft
    ? 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20'
    : 'text-neutral-400 bg-white/5 border-white/10';

  const statusIcon = hasSubmitted
    ? CheckCircle
    : hasDraft
    ? Edit3
    : Clock;

  const StatusIcon = statusIcon;

  // Handle file upload
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
          setError(data.error || `Failed to upload ${file.name}`);
        }
      } catch {
        setError('Failed to upload file');
      }
    }

    setIsUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Remove attachment
  const removeAttachment = async (att: MondayNoteAttachment) => {
    try {
      await fetch(`/api/portal/monday-notes/upload?url=${encodeURIComponent(att.fileUrl)}`, {
        method: 'DELETE',
      });
    } catch { /* best effort */ }
    setAttachments(prev => prev.filter(a => a.id !== att.id));
  };

  // Submit note
  const handleSubmit = async (status: 'draft' | 'submitted' = 'submitted') => {
    if (!user) return;
    if (status === 'submitted' && (!title.trim() || !content.trim())) {
      setError('Title and content are required to submit');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const body: Record<string, unknown> = {
        userId: user.userId,
        userName: user.name,
        userRole: user.role,
        category,
        title: title.trim(),
        content: content.trim(),
        highlights: title.trim() ? [title.trim()] : [],
        attachments,
        includeInSlide: true,
        status,
      };

      // If editing existing note, include its id
      if (latestNote?.id) {
        body.id = latestNote.id;
      }

      const res = await fetch('/api/portal/monday-notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (data.success) {
        setSuccess(status === 'submitted' ? 'Note submitted for Monday meeting!' : 'Draft saved');
        setTitle('');
        setContent('');
        setAttachments([]);
        // Refresh notes list
        await loadNotes();
        setTimeout(() => {
          setSuccess(null);
          if (status === 'submitted') setIsExpanded(false);
        }, 3000);
      } else {
        setError(data.error || 'Failed to save note');
      }
    } catch {
      setError('Failed to save note. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!user) return null;

  const mondayDisplay = new Date(nextMondayDate + 'T12:00:00').toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });

  return (
    <div className="bg-white/[0.02] border border-white/5 rounded-2xl overflow-hidden">
      {/* Header - always visible */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full p-4 flex items-center gap-3 hover:bg-white/[0.02] transition-colors"
      >
        <div className={`w-10 h-10 rounded-xl bg-gradient-to-br from-${categoryInfo.color}-500/20 to-${categoryInfo.color}-500/10 border border-${categoryInfo.color}-500/30 flex items-center justify-center flex-shrink-0`}>
          <CategoryIcon size={20} className={`text-${categoryInfo.color}-400`} />
        </div>
        <div className="flex-1 text-left min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-white text-sm truncate">Monday Notes</h3>
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border ${statusColor}`}>
              <StatusIcon size={10} />
              {statusLabel}
            </span>
          </div>
          <div className="flex items-center gap-2 text-xs text-neutral-500 mt-0.5">
            <span>{mondayDisplay}</span>
            <span className="text-neutral-700">|</span>
            <span className="flex items-center gap-1">
              <Clock size={10} />
              {submissionsOpen ? countdown : 'Submissions closed'}
            </span>
          </div>
        </div>
        <ChevronDown
          size={18}
          className={`text-neutral-500 transition-transform flex-shrink-0 ${isExpanded ? 'rotate-180' : ''}`}
        />
      </button>

      {/* Expanded content */}
      {isExpanded && (
        <div className="px-4 pb-4 space-y-3 border-t border-white/5 pt-3">
          {/* Success message */}
          {success && (
            <div className="flex items-center gap-2 p-2.5 rounded-xl bg-green-500/10 border border-green-500/20">
              <CheckCircle size={14} className="text-green-400 flex-shrink-0" />
              <span className="text-xs text-green-400">{success}</span>
            </div>
          )}

          {/* Error message */}
          {error && (
            <div className="flex items-center gap-2 p-2.5 rounded-xl bg-red-500/10 border border-red-500/20">
              <AlertCircle size={14} className="text-red-400 flex-shrink-0" />
              <span className="text-xs text-red-400 flex-1">{error}</span>
              <button onClick={() => setError(null)} className="text-red-400/60 hover:text-red-400">
                <X size={12} />
              </button>
            </div>
          )}

          {/* Existing notes summary */}
          {isLoading ? (
            <div className="flex items-center justify-center py-3">
              <Loader2 size={16} className="animate-spin text-neutral-500" />
            </div>
          ) : existingNotes.length > 0 ? (
            <div className="space-y-2">
              {existingNotes.map(note => (
                <div
                  key={note.id}
                  className="p-3 rounded-xl bg-white/[0.03] border border-white/5"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-white truncate">{note.title || 'Untitled'}</p>
                      <p className="text-xs text-neutral-500 line-clamp-2 mt-0.5">
                        {note.content?.substring(0, 120)}{note.content && note.content.length > 120 ? '...' : ''}
                      </p>
                    </div>
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border flex-shrink-0 ${
                      note.status === 'submitted' || note.status === 'approved'
                        ? 'text-green-400 bg-green-500/10 border-green-500/20'
                        : 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20'
                    }`}>
                      {note.status === 'submitted' || note.status === 'approved' ? (
                        <CheckCircle size={10} />
                      ) : (
                        <Edit3 size={10} />
                      )}
                      {note.status}
                    </span>
                  </div>
                  {note.attachments && note.attachments.length > 0 && (
                    <div className="flex items-center gap-1 mt-2 text-xs text-neutral-500">
                      <ImageIcon size={10} />
                      {note.attachments.length} file{note.attachments.length !== 1 ? 's' : ''} attached
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="py-2 text-center">
              <p className="text-xs text-neutral-500">No notes submitted yet for {mondayDisplay}</p>
            </div>
          )}

          {/* Deadline warning */}
          {!submissionsOpen && (
            <div className="flex items-center gap-2 p-2.5 rounded-xl bg-yellow-500/10 border border-yellow-500/20">
              <AlertCircle size={14} className="text-yellow-400 flex-shrink-0" />
              <span className="text-xs text-yellow-400">Submissions are closed. Notes may not be included in today&apos;s meeting.</span>
            </div>
          )}

          {/* Quick-add form */}
          <div className="space-y-2.5">
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Title for your update..."
              maxLength={100}
              className="w-full bg-neutral-800/50 border border-neutral-700 rounded-xl px-3 py-2.5 text-white placeholder-neutral-500 focus:outline-none focus:border-brand-green/50 focus:ring-1 focus:ring-brand-green/20 text-sm"
            />

            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder={`Share your ${categoryInfo.label.toLowerCase().replace(' updates', '')} updates for the Monday meeting...`}
              rows={compact ? 2 : 3}
              maxLength={2000}
              className="w-full bg-neutral-800/50 border border-neutral-700 rounded-xl px-3 py-2.5 text-white placeholder-neutral-500 focus:outline-none focus:border-brand-green/50 focus:ring-1 focus:ring-brand-green/20 text-sm resize-none"
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
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                className="flex items-center gap-2 px-3 py-2 rounded-xl border border-dashed border-neutral-700 hover:border-brand-green/40 bg-white/[0.02] text-neutral-400 hover:text-white transition-colors text-xs w-full justify-center"
              >
                {isUploading ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <Upload size={14} />
                )}
                {isUploading ? 'Uploading...' : 'Add images, videos, or documents'}
              </button>

              {/* Attachment thumbnails */}
              {attachments.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {attachments.map((att) => (
                    <div
                      key={att.id}
                      className="relative group w-14 h-14 rounded-lg overflow-hidden border border-white/10"
                    >
                      {att.type === 'image' || att.type === 'photo' ? (
                        <Image
                          src={att.fileUrl}
                          alt={att.fileName}
                          fill
                          className="object-cover"
                        />
                      ) : att.mimeType?.startsWith('video/') ? (
                        <div className="w-full h-full bg-neutral-800 flex items-center justify-center">
                          <Video size={18} className="text-blue-400" />
                        </div>
                      ) : (
                        <div className="w-full h-full bg-neutral-800 flex items-center justify-center">
                          <FileText size={18} className="text-neutral-400" />
                        </div>
                      )}
                      <button
                        onClick={() => removeAttachment(att)}
                        className="absolute top-0 right-0 p-0.5 bg-red-500/80 rounded-bl-lg opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X size={10} className="text-white" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex gap-2 pt-1">
            <button
              onClick={() => handleSubmit('draft')}
              disabled={isSubmitting || (!title.trim() && !content.trim())}
              className="flex items-center justify-center gap-1.5 px-3 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 text-neutral-300 disabled:text-neutral-600 rounded-xl transition-colors text-xs font-medium disabled:cursor-not-allowed"
            >
              {isSubmitting ? <Loader2 size={12} className="animate-spin" /> : <Edit3 size={12} />}
              Save Draft
            </button>
            <button
              onClick={() => handleSubmit('submitted')}
              disabled={isSubmitting || !title.trim() || !content.trim()}
              className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 bg-gradient-to-r from-brand-green to-emerald-500 hover:from-brand-green/90 hover:to-emerald-500/90 disabled:from-neutral-700 disabled:to-neutral-700 text-black disabled:text-neutral-500 font-semibold rounded-xl transition-all text-xs disabled:cursor-not-allowed"
            >
              {isSubmitting ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
              Submit for Monday
            </button>
            <Link
              href="/portal/monday-notes"
              className="flex items-center justify-center gap-1 px-3 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 text-neutral-400 rounded-xl transition-colors text-xs"
              title="Open full notes editor"
            >
              <Plus size={12} />
              Full Editor
              <ChevronRight size={12} />
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
