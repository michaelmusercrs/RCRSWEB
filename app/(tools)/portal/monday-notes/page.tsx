'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import {
  Calendar, Clock, FileText, Image as ImageIcon, Upload, Send,
  Trash2, Plus, ChevronRight, AlertCircle, CheckCircle, Loader2,
  ArrowLeft, Save, Megaphone, Truck, TrendingUp, Settings, Building,
  Timer, Hash, X, Eye, Edit3, Users, Home, LogOut
} from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import {
  MondayNote,
  MondayNoteAttachment,
  NoteCategory,
  TimingInfo,
  getCategoriesForRole,
  getPromptsForRole,
  getPrimaryCategoryForRole,
  getNextMondayDate,
  getDaysUntilMonday,
  areSubmissionsOpen,
  getSubmissionDeadline,
  getDeadlineStatus,
  CATEGORY_INFO,
  formatTimingInfo,
  validateNote,
} from '@/lib/monday-notes-service';
import { TeamRole, ROLE_DISPLAY_NAMES } from '@/lib/team-roles';

// Category icons mapping
const CATEGORY_ICONS: Record<NoteCategory, typeof Truck> = {
  delivery: Truck,
  sales: TrendingUp,
  operations: Settings,
  office: Building,
  general: Megaphone,
};

// Category colors
const CATEGORY_COLORS: Record<NoteCategory, string> = {
  delivery: 'blue',
  sales: 'green',
  operations: 'orange',
  office: 'purple',
  general: 'gray',
};

export default function MondayNotesPage() {
  const router = useRouter();
  const { user, isLoading: authLoading, logout } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // State
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Note state
  const [note, setNote] = useState<Partial<MondayNote>>({
    title: '',
    content: '',
    highlights: [],
    attachments: [],
    timing: undefined,
    metrics: [],
    includeInSlide: true,
    status: 'draft',
  });

  const [selectedCategory, setSelectedCategory] = useState<NoteCategory>('general');
  const [showTimingModal, setShowTimingModal] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [currentHighlight, setCurrentHighlight] = useState('');

  // Meeting info
  const nextMondayDate = getNextMondayDate();
  const daysUntilMeeting = getDaysUntilMonday();
  const submissionsOpen = areSubmissionsOpen();
  const deadline = getSubmissionDeadline();
  const deadlineStatus = getDeadlineStatus();
  const isAdminOrOwner = user?.role === 'owner' || user?.role === 'admin';

  // Redirect if not logged in
  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/portal');
    }
  }, [user, authLoading, router]);

  // Load existing note
  useEffect(() => {
    if (user) {
      loadExistingNote();
      setSelectedCategory(getPrimaryCategoryForRole(user.role));
    }
  }, [user]);

  const loadExistingNote = async () => {
    if (!user) return;

    try {
      const response = await fetch(
        `/api/portal/monday-notes?meetingDate=${nextMondayDate}&userId=${user.userId}`
      );

      if (response.ok) {
        const data = await response.json();
        if (data.notes && data.notes.length > 0) {
          const existingNote = data.notes[0];
          setNote(existingNote);
          setSelectedCategory(existingNote.category);
        }
      }
    } catch (err) {
      console.error('Error loading existing note:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const saveNote = async (status: 'draft' | 'submitted' = 'draft') => {
    if (!user) return;

    // Validate if submitting
    if (status === 'submitted') {
      const errors = validateNote(note);
      if (errors.length > 0) {
        setError(errors.map(e => e.message).join(', '));
        return;
      }
    }

    setIsSaving(true);
    setError(null);

    try {
      const response = await fetch('/api/portal/monday-notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...note,
          userId: user.userId,
          userName: user.name,
          userRole: user.role,
          category: selectedCategory,
          status,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setNote(data.note);
        setSuccessMessage(
          status === 'submitted'
            ? 'Your note has been submitted for the Monday meeting!'
            : 'Draft saved successfully'
        );
        setTimeout(() => setSuccessMessage(null), 3000);
      } else {
        setError(data.error || 'Failed to save note');
      }
    } catch (err) {
      setError('Failed to save note. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || !user) return;

    setIsUploading(true);
    setError(null);

    try {
      const newAttachments: MondayNoteAttachment[] = [];

      for (const file of Array.from(files)) {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('userId', user.userId);
        formData.append('noteId', note.id || '');

        const response = await fetch('/api/portal/monday-notes/upload', {
          method: 'POST',
          body: formData,
        });

        const data = await response.json();

        if (data.success) {
          newAttachments.push(data.attachment);
        } else {
          setError(data.error || `Failed to upload ${file.name}`);
        }
      }

      if (newAttachments.length > 0) {
        setNote(prev => ({
          ...prev,
          attachments: [...(prev.attachments || []), ...newAttachments],
        }));
      }
    } catch (err) {
      setError('Failed to upload files');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const removeAttachment = async (attachmentId: string) => {
    const attachment = note.attachments?.find(a => a.id === attachmentId);
    if (!attachment) return;

    try {
      await fetch(`/api/portal/monday-notes/upload?url=${encodeURIComponent(attachment.fileUrl)}`, {
        method: 'DELETE',
      });

      setNote(prev => ({
        ...prev,
        attachments: prev.attachments?.filter(a => a.id !== attachmentId) || [],
      }));
    } catch (err) {
      console.error('Error removing attachment:', err);
    }
  };

  const addHighlight = () => {
    if (currentHighlight.trim()) {
      setNote(prev => ({
        ...prev,
        highlights: [...(prev.highlights || []), currentHighlight.trim()],
      }));
      setCurrentHighlight('');
    }
  };

  const removeHighlight = (index: number) => {
    setNote(prev => ({
      ...prev,
      highlights: prev.highlights?.filter((_, i) => i !== index) || [],
    }));
  };

  const updateTiming = (field: keyof TimingInfo, value: string | number) => {
    setNote(prev => ({
      ...prev,
      timing: {
        ...prev.timing,
        [field]: value,
      },
    }));
  };

  // Loading state
  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-neutral-950 via-neutral-900 to-neutral-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="animate-spin text-brand-green" size={48} />
          <p className="text-neutral-400">Loading your notes...</p>
        </div>
      </div>
    );
  }

  if (!user) return null;

  const categories = getCategoriesForRole(user.role);
  const prompts = getPromptsForRole(user.role);
  const CategoryIcon = CATEGORY_ICONS[selectedCategory];

  return (
    <div className="min-h-screen bg-gradient-to-br from-neutral-950 via-neutral-900 to-neutral-950">
      {/* Background Pattern */}
      <div className="fixed inset-0 opacity-30 pointer-events-none">
        <div className="absolute inset-0" style={{
          backgroundImage: `radial-gradient(circle at 25px 25px, rgba(255,255,255,0.03) 2px, transparent 0)`,
          backgroundSize: '50px 50px'
        }} />
      </div>

      <div className="relative z-10">
        {/* Header */}
        <header className="border-b border-white/5 backdrop-blur-xl bg-black/20 sticky top-0 z-20">
          <div className="max-w-4xl mx-auto px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Link
                  href="/portal/dashboard"
                  className="w-10 h-10 rounded-xl bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors"
                >
                  <ArrowLeft size={18} className="text-neutral-400" />
                </Link>
                <div>
                  <h1 className="text-xl font-bold text-white tracking-tight">My Monday Notes</h1>
                  <p className="text-sm text-neutral-400">
                    For {new Date(nextMondayDate).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-4">
                {/* Admin View Link */}
                {['owner', 'admin', 'manager'].includes(user.role) && (
                  <Link
                    href="/portal/monday-notes/admin"
                    className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-purple-500/10 border border-purple-500/20 text-purple-400 text-sm hover:bg-purple-500/20 transition-colors"
                  >
                    <Users size={14} />
                    View All Submissions
                  </Link>
                )}

                <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-brand-green/10 border border-brand-green/20">
                  <Calendar size={14} className="text-brand-green" />
                  <span className="text-sm text-brand-green font-medium">
                    {daysUntilMeeting === 0 ? 'Today!' : `${daysUntilMeeting} day${daysUntilMeeting !== 1 ? 's' : ''} until meeting`}
                  </span>
                </div>

                <button
                  onClick={logout}
                  className="w-10 h-10 rounded-xl bg-white/5 hover:bg-red-500/20 flex items-center justify-center transition-colors group"
                  title="Sign Out"
                >
                  <LogOut size={18} className="text-neutral-400 group-hover:text-red-400" />
                </button>
              </div>
            </div>
          </div>
        </header>

        <main className="max-w-4xl mx-auto px-6 py-8">
          {/* Deadline Status Banner */}
          {deadlineStatus.severity === 'locked' && !isAdminOrOwner && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-4 mb-6 flex items-center gap-3">
              <AlertCircle className="text-red-500 flex-shrink-0" size={20} />
              <div>
                <p className="text-red-400 font-medium">Deadline passed - submissions locked</p>
                <p className="text-sm text-red-400/70">
                  The Monday 9:00 AM CT deadline has passed. Contact Sara or Michael for late submissions.
                </p>
              </div>
            </div>
          )}
          {deadlineStatus.severity === 'locked' && isAdminOrOwner && (
            <div className="bg-orange-500/10 border border-orange-500/20 rounded-2xl p-4 mb-6 flex items-center gap-3">
              <AlertCircle className="text-orange-500 flex-shrink-0" size={20} />
              <div>
                <p className="text-orange-400 font-medium">Deadline passed - admin override active</p>
                <p className="text-sm text-orange-400/70">
                  The Monday 9:00 AM CT deadline has passed, but you can still submit as an admin.
                </p>
              </div>
            </div>
          )}
          {deadlineStatus.severity === 'warning' && (
            <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-2xl p-4 mb-6 flex items-center gap-3">
              <Clock className="text-yellow-500 flex-shrink-0" size={20} />
              <div>
                <p className="text-yellow-400 font-medium">{deadlineStatus.message}</p>
              </div>
            </div>
          )}
          {deadlineStatus.severity === 'ok' && (
            <div className="bg-green-500/10 border border-green-500/20 rounded-2xl p-4 mb-6 flex items-center gap-3">
              <Clock className="text-green-500 flex-shrink-0" size={20} />
              <div>
                <p className="text-green-400 font-medium">{deadlineStatus.message}</p>
              </div>
            </div>
          )}

          {/* Success Message */}
          {successMessage && (
            <div className="bg-green-500/10 border border-green-500/20 rounded-2xl p-4 mb-6 flex items-center gap-3">
              <CheckCircle className="text-green-500 flex-shrink-0" size={20} />
              <p className="text-green-400">{successMessage}</p>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-4 mb-6 flex items-center gap-3">
              <AlertCircle className="text-red-500 flex-shrink-0" size={20} />
              <p className="text-red-400">{error}</p>
              <button onClick={() => setError(null)} className="ml-auto text-red-400 hover:text-red-300">
                <X size={18} />
              </button>
            </div>
          )}

          {/* User Info Card */}
          <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-6 mb-6">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-brand-green/20 to-emerald-500/20 border border-brand-green/30 flex items-center justify-center">
                <span className="text-xl font-bold text-brand-green">
                  {user.name.split(' ').map(n => n[0]).join('')}
                </span>
              </div>
              <div className="flex-1">
                <h2 className="text-lg font-semibold text-white">{user.name}</h2>
                <p className="text-sm text-neutral-400">{ROLE_DISPLAY_NAMES[user.role]}</p>
              </div>
              {note.status === 'submitted' && (
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-green-500/10 border border-green-500/20">
                  <CheckCircle size={14} className="text-green-500" />
                  <span className="text-sm text-green-400 font-medium">Submitted</span>
                </div>
              )}
              {note.status === 'draft' && note.content && (
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
                  <Edit3 size={14} className="text-yellow-500" />
                  <span className="text-sm text-yellow-400 font-medium">Draft</span>
                </div>
              )}
            </div>
          </div>

          {/* Prompts/Suggestions */}
          <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-6 mb-6">
            <h3 className="text-sm font-medium text-neutral-300 mb-3 flex items-center gap-2">
              <Megaphone size={16} className="text-brand-green" />
              Things to share this week:
            </h3>
            <div className="flex flex-wrap gap-2">
              {prompts.map((prompt, i) => (
                <button
                  key={i}
                  onClick={() => {
                    if (!note.content?.includes(prompt)) {
                      setNote(prev => ({
                        ...prev,
                        content: prev.content ? `${prev.content}\n\n${prompt}` : prompt,
                      }));
                    }
                  }}
                  className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-sm text-neutral-400 hover:text-white transition-colors"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>

          {/* Category Selection */}
          {categories.length > 1 && (
            <div className="mb-6">
              <label className="block text-sm font-medium text-neutral-300 mb-3">Category</label>
              <div className="flex flex-wrap gap-2">
                {categories.map(category => {
                  const Icon = CATEGORY_ICONS[category];
                  const info = CATEGORY_INFO[category];
                  const isSelected = selectedCategory === category;

                  return (
                    <button
                      key={category}
                      onClick={() => setSelectedCategory(category)}
                      className={`flex items-center gap-2 px-4 py-2 rounded-xl border transition-all ${
                        isSelected
                          ? `bg-${info.color}-500/20 border-${info.color}-500/40 text-${info.color}-400`
                          : 'bg-white/5 border-white/10 text-neutral-400 hover:bg-white/10'
                      }`}
                    >
                      <Icon size={16} />
                      <span className="text-sm font-medium">{info.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Note Form */}
          <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-6 mb-6">
            {/* Title */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-neutral-300 mb-2">
                Title / Subject
              </label>
              <input
                type="text"
                value={note.title || ''}
                onChange={(e) => setNote(prev => ({ ...prev, title: e.target.value }))}
                placeholder="Brief title for your update (e.g., 'Weekly Delivery Summary')"
                className="w-full bg-neutral-800/50 border border-neutral-700 rounded-xl px-4 py-3 text-white placeholder-neutral-500 focus:outline-none focus:border-brand-green/50 focus:ring-2 focus:ring-brand-green/20"
                maxLength={100}
              />
              <p className="text-xs text-neutral-500 mt-1">{(note.title?.length || 0)}/100 characters</p>
            </div>

            {/* Content */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-neutral-300 mb-2">
                Your Update
              </label>
              <textarea
                value={note.content || ''}
                onChange={(e) => setNote(prev => ({ ...prev, content: e.target.value }))}
                placeholder="Share your updates, accomplishments, challenges, or notes for the Monday meeting..."
                rows={6}
                className="w-full bg-neutral-800/50 border border-neutral-700 rounded-xl px-4 py-3 text-white placeholder-neutral-500 focus:outline-none focus:border-brand-green/50 focus:ring-2 focus:ring-brand-green/20 resize-none"
                maxLength={2000}
              />
              <p className="text-xs text-neutral-500 mt-1">{(note.content?.length || 0)}/2000 characters</p>
            </div>

            {/* Highlights */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-neutral-300 mb-2">
                Key Points (for slide)
              </label>
              <div className="flex gap-2 mb-2">
                <input
                  type="text"
                  value={currentHighlight}
                  onChange={(e) => setCurrentHighlight(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addHighlight())}
                  placeholder="Add a key point..."
                  className="flex-1 bg-neutral-800/50 border border-neutral-700 rounded-xl px-4 py-2 text-white placeholder-neutral-500 focus:outline-none focus:border-brand-green/50"
                />
                <button
                  onClick={addHighlight}
                  className="px-4 py-2 bg-brand-green/20 hover:bg-brand-green/30 text-brand-green rounded-xl transition-colors"
                >
                  <Plus size={18} />
                </button>
              </div>
              {note.highlights && note.highlights.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {note.highlights.map((highlight, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-2 px-3 py-1.5 bg-brand-green/10 border border-brand-green/20 rounded-lg"
                    >
                      <span className="text-sm text-brand-green">{highlight}</span>
                      <button
                        onClick={() => removeHighlight(i)}
                        className="text-brand-green/60 hover:text-brand-green"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Timing Info */}
            <div className="mb-6">
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-neutral-300">
                  Timing / Duration Info (optional)
                </label>
                <button
                  onClick={() => setShowTimingModal(!showTimingModal)}
                  className="text-sm text-brand-green hover:text-brand-green/80"
                >
                  {note.timing ? 'Edit' : 'Add timing'}
                </button>
              </div>

              {note.timing && (
                <div className="flex items-center gap-2 px-3 py-2 bg-brand-green/10 border border-blue-500/20 rounded-lg">
                  <Timer size={14} className="text-blue-400" />
                  <span className="text-sm text-blue-400">{formatTimingInfo(note.timing)}</span>
                  <button
                    onClick={() => setNote(prev => ({ ...prev, timing: undefined }))}
                    className="ml-auto text-blue-400/60 hover:text-blue-400"
                  >
                    <X size={14} />
                  </button>
                </div>
              )}

              {showTimingModal && (
                <div className="mt-3 p-4 bg-neutral-800/50 border border-neutral-700 rounded-xl space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-neutral-400 mb-1">Duration</label>
                      <input
                        type="text"
                        value={note.timing?.duration || ''}
                        onChange={(e) => updateTiming('duration', e.target.value)}
                        placeholder="e.g., 2 hours"
                        className="w-full bg-neutral-900/50 border border-neutral-600 rounded-lg px-3 py-2 text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-brand-green/50"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-neutral-400 mb-1">Frequency</label>
                      <input
                        type="text"
                        value={note.timing?.frequency || ''}
                        onChange={(e) => updateTiming('frequency', e.target.value)}
                        placeholder="e.g., daily, 3x/week"
                        className="w-full bg-neutral-900/50 border border-neutral-600 rounded-lg px-3 py-2 text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-brand-green/50"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-neutral-400 mb-1">Occurrences</label>
                      <input
                        type="number"
                        value={note.timing?.occurrences || ''}
                        onChange={(e) => updateTiming('occurrences', parseInt(e.target.value) || 0)}
                        placeholder="How many times?"
                        className="w-full bg-neutral-900/50 border border-neutral-600 rounded-lg px-3 py-2 text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-brand-green/50"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-neutral-400 mb-1">Time Spent (mins)</label>
                      <input
                        type="number"
                        value={note.timing?.timeSpent || ''}
                        onChange={(e) => updateTiming('timeSpent', parseInt(e.target.value) || 0)}
                        placeholder="Total minutes"
                        className="w-full bg-neutral-900/50 border border-neutral-600 rounded-lg px-3 py-2 text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-brand-green/50"
                      />
                    </div>
                  </div>
                  <button
                    onClick={() => setShowTimingModal(false)}
                    className="w-full py-2 bg-brand-green/20 hover:bg-brand-green/30 text-brand-green rounded-lg text-sm transition-colors"
                  >
                    Done
                  </button>
                </div>
              )}
            </div>

            {/* File Uploads */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-neutral-300 mb-2">
                Photos & Documents
              </label>

              {/* Upload Button */}
              <div className="mb-3">
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt"
                  onChange={handleFileUpload}
                  className="hidden"
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                  className="flex items-center gap-2 px-4 py-3 w-full border-2 border-dashed border-neutral-700 hover:border-brand-green/50 rounded-xl text-neutral-400 hover:text-white transition-colors"
                >
                  {isUploading ? (
                    <Loader2 className="animate-spin" size={20} />
                  ) : (
                    <Upload size={20} />
                  )}
                  <span>{isUploading ? 'Uploading...' : 'Click to upload images or documents'}</span>
                </button>
                <p className="text-xs text-neutral-500 mt-1">
                  Supports: Images (JPG, PNG, GIF, WebP), Documents (PDF, Word, Excel, TXT). Max 10MB each.
                </p>
              </div>

              {/* Attachments Grid */}
              {note.attachments && note.attachments.length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {note.attachments.map(attachment => (
                    <div
                      key={attachment.id}
                      className="relative group bg-neutral-800/50 border border-neutral-700 rounded-xl overflow-hidden"
                    >
                      {attachment.type === 'image' || attachment.type === 'photo' ? (
                        <div className="aspect-square relative">
                          <Image
                            src={attachment.fileUrl}
                            alt={attachment.fileName}
                            fill
                            className="object-cover"
                          />
                        </div>
                      ) : (
                        <div className="aspect-square flex flex-col items-center justify-center p-4">
                          <FileText size={32} className="text-neutral-500 mb-2" />
                          <span className="text-xs text-neutral-400 text-center truncate w-full">
                            {attachment.fileName}
                          </span>
                        </div>
                      )}

                      {/* Delete Button */}
                      <button
                        onClick={() => removeAttachment(attachment.id)}
                        className="absolute top-2 right-2 w-8 h-8 bg-red-500/80 hover:bg-red-500 rounded-lg flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <Trash2 size={14} className="text-white" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Include in Slide Toggle */}
            <div className="flex items-center justify-between p-4 bg-neutral-800/30 rounded-xl">
              <div>
                <p className="text-sm font-medium text-white">Include in Meeting Slide</p>
                <p className="text-xs text-neutral-500">Your note will be shown during the Monday presentation</p>
              </div>
              <button
                onClick={() => setNote(prev => ({ ...prev, includeInSlide: !prev.includeInSlide }))}
                className={`w-12 h-6 rounded-full transition-colors ${
                  note.includeInSlide ? 'bg-brand-green' : 'bg-neutral-700'
                }`}
              >
                <div
                  className={`w-5 h-5 rounded-full bg-white shadow-lg transform transition-transform ${
                    note.includeInSlide ? 'translate-x-6' : 'translate-x-0.5'
                  }`}
                />
              </button>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={() => saveNote('draft')}
              disabled={isSaving}
              className="flex-1 flex items-center justify-center gap-2 px-6 py-4 bg-white/5 hover:bg-white/10 border border-white/10 text-white font-semibold rounded-xl transition-colors"
            >
              {isSaving ? <Loader2 className="animate-spin" size={20} /> : <Save size={20} />}
              Save Draft
            </button>

            <button
              onClick={() => saveNote('submitted')}
              disabled={isSaving || !note.title || !note.content || (deadlineStatus.severity === 'locked' && !isAdminOrOwner)}
              className="flex-1 flex items-center justify-center gap-2 px-6 py-4 bg-gradient-to-r from-brand-green to-emerald-500 hover:from-brand-green/90 hover:to-emerald-500/90 disabled:from-neutral-700 disabled:to-neutral-700 text-black disabled:text-neutral-500 font-semibold rounded-xl transition-all shadow-lg shadow-brand-green/25 disabled:shadow-none disabled:cursor-not-allowed"
            >
              {isSaving ? <Loader2 className="animate-spin" size={20} /> : <Send size={20} />}
              Submit for Monday
            </button>
          </div>

          {/* Preview Section */}
          {note.content && (
            <div className="mt-8">
              <button
                onClick={() => setShowPreview(!showPreview)}
                className="flex items-center gap-2 text-sm text-neutral-400 hover:text-white mb-4"
              >
                <Eye size={16} />
                {showPreview ? 'Hide Preview' : 'Preview Slide Content'}
                <ChevronRight size={16} className={`transition-transform ${showPreview ? 'rotate-90' : ''}`} />
              </button>

              {showPreview && (
                <div className="bg-gradient-to-br from-neutral-800 to-neutral-900 border border-white/10 rounded-2xl p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <div className={`w-10 h-10 rounded-xl bg-${CATEGORY_COLORS[selectedCategory]}-500/20 flex items-center justify-center`}>
                      <CategoryIcon size={20} className={`text-${CATEGORY_COLORS[selectedCategory]}-400`} />
                    </div>
                    <div>
                      <h4 className="font-semibold text-white">{note.title || 'Untitled Update'}</h4>
                      <p className="text-sm text-neutral-400">{user.name} - {CATEGORY_INFO[selectedCategory].label}</p>
                    </div>
                  </div>

                  {note.highlights && note.highlights.length > 0 && (
                    <ul className="space-y-2 mb-4">
                      {note.highlights.map((highlight, i) => (
                        <li key={i} className="flex items-start gap-2 text-neutral-300">
                          <CheckCircle size={16} className="text-brand-green mt-0.5 flex-shrink-0" />
                          <span>{highlight}</span>
                        </li>
                      ))}
                    </ul>
                  )}

                  {note.timing && (
                    <div className="flex items-center gap-2 text-sm text-blue-400">
                      <Timer size={14} />
                      {formatTimingInfo(note.timing)}
                    </div>
                  )}

                  {note.attachments && note.attachments.filter(a => a.type === 'image' || a.type === 'photo').length > 0 && (
                    <div className="mt-4 flex items-center gap-2 text-sm text-neutral-500">
                      <ImageIcon size={14} />
                      {note.attachments.filter(a => a.type === 'image' || a.type === 'photo').length} image(s) attached
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
