'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import {
  Calendar, Clock, FileText, Image as ImageIcon, Users,
  ChevronRight, AlertCircle, CheckCircle, Loader2,
  ArrowLeft, Megaphone, Truck, TrendingUp, Settings, Building,
  Timer, Eye, Download, Presentation, Home, LogOut, RefreshCw
} from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import {
  MondayNote,
  NoteCategory,
  getNextMondayDate,
  getDaysUntilMonday,
  areSubmissionsOpen,
  getSubmissionDeadline,
  CATEGORY_INFO,
  formatTimingInfo,
} from '@/lib/monday-notes-service';
import { ROLE_DISPLAY_NAMES } from '@/lib/team-roles';

// Category icons mapping
const CATEGORY_ICONS: Record<NoteCategory, typeof Truck> = {
  delivery: Truck,
  sales: TrendingUp,
  operations: Settings,
  office: Building,
  general: Megaphone,
};

interface SummaryData {
  meetingDate: string;
  summary: {
    totalNotes: number;
    submittedNotes: number;
    draftNotes: number;
    categoryCounts: Record<NoteCategory, number>;
    submissionStatus: {
      submitted: string[];
      pending: string[];
      total: number;
    };
    submissionsOpen: boolean;
    deadline: string;
    daysUntilMeeting: number;
  };
  notesByUser: Record<string, {
    userName: string;
    userRole: string;
    notes: MondayNote[];
  }>;
  categories: {
    category: string;
    count: number;
    label: string;
    color: string;
  }[];
}

export default function MondayNotesAdminPage() {
  const router = useRouter();
  const { user, isLoading: authLoading, logout } = useAuth();

  const [isLoading, setIsLoading] = useState(true);
  const [summaryData, setSummaryData] = useState<SummaryData | null>(null);
  const [allNotes, setAllNotes] = useState<MondayNote[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<NoteCategory | 'all'>('all');
  const [expandedUsers, setExpandedUsers] = useState<Set<string>>(new Set());

  const nextMondayDate = getNextMondayDate();
  const daysUntilMeeting = getDaysUntilMonday();
  const submissionsOpen = areSubmissionsOpen();

  // Redirect if not admin
  useEffect(() => {
    if (!authLoading && user) {
      if (!['owner', 'admin', 'manager'].includes(user.role)) {
        router.push('/portal/monday-notes');
      }
    } else if (!authLoading && !user) {
      router.push('/portal');
    }
  }, [user, authLoading, router]);

  // Load summary data
  useEffect(() => {
    if (user && ['owner', 'admin', 'manager'].includes(user.role)) {
      loadSummary();
    }
  }, [user]);

  const loadSummary = async () => {
    setIsLoading(true);
    try {
      // Fetch summary
      const summaryRes = await fetch(`/api/portal/monday-notes/summary?meetingDate=${nextMondayDate}`);
      if (summaryRes.ok) {
        const data = await summaryRes.json();
        setSummaryData(data);
      }

      // Fetch all notes
      const notesRes = await fetch(`/api/portal/monday-notes?meetingDate=${nextMondayDate}`);
      if (notesRes.ok) {
        const data = await notesRes.json();
        setAllNotes(data.notes || []);
      }
    } catch (err) {
      console.error('Error loading summary:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleUserExpanded = (userId: string) => {
    setExpandedUsers(prev => {
      const newSet = new Set(prev);
      if (newSet.has(userId)) {
        newSet.delete(userId);
      } else {
        newSet.add(userId);
      }
      return newSet;
    });
  };

  const filteredNotes = selectedCategory === 'all'
    ? allNotes
    : allNotes.filter(n => n.category === selectedCategory);

  // Loading state
  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-neutral-950 via-neutral-900 to-neutral-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="animate-spin text-brand-green" size={48} />
          <p className="text-neutral-400">Loading submissions...</p>
        </div>
      </div>
    );
  }

  if (!user || !['owner', 'admin', 'manager'].includes(user.role)) {
    return null;
  }

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
          <div className="max-w-6xl mx-auto px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Link
                  href="/portal/dashboard"
                  className="w-10 h-10 rounded-xl bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors"
                >
                  <ArrowLeft size={18} className="text-neutral-400" />
                </Link>
                <div>
                  <h1 className="text-xl font-bold text-white tracking-tight">Monday Notes - Admin View</h1>
                  <p className="text-sm text-neutral-400">
                    {new Date(nextMondayDate).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <button
                  onClick={loadSummary}
                  className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-neutral-400 text-sm transition-colors"
                >
                  <RefreshCw size={16} />
                  Refresh
                </button>

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

        <main className="max-w-6xl mx-auto px-6 py-8">
          {/* Summary Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl bg-brand-green/20 flex items-center justify-center">
                  <FileText size={20} className="text-brand-green" />
                </div>
              </div>
              <div className="text-3xl font-bold text-white mb-1">
                {summaryData?.summary.submittedNotes || 0}
              </div>
              <div className="text-sm text-neutral-400">Submitted Notes</div>
            </div>

            <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl bg-yellow-500/20 flex items-center justify-center">
                  <Clock size={20} className="text-yellow-500" />
                </div>
              </div>
              <div className="text-3xl font-bold text-white mb-1">
                {summaryData?.summary.draftNotes || 0}
              </div>
              <div className="text-sm text-neutral-400">Drafts</div>
            </div>

            <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl bg-brand-green/20 flex items-center justify-center">
                  <Users size={20} className="text-blue-500" />
                </div>
              </div>
              <div className="text-3xl font-bold text-white mb-1">
                {summaryData?.summary.submissionStatus?.submitted.length || 0}
                <span className="text-lg text-neutral-500">/{summaryData?.summary.submissionStatus?.total || 0}</span>
              </div>
              <div className="text-sm text-neutral-400">Team Submitted</div>
            </div>

            <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center">
                  <Calendar size={20} className="text-purple-500" />
                </div>
              </div>
              <div className="text-3xl font-bold text-white mb-1">
                {daysUntilMeeting}
              </div>
              <div className="text-sm text-neutral-400">Days Until Meeting</div>
            </div>
          </div>

          {/* Submission Status */}
          <div className="grid lg:grid-cols-2 gap-6 mb-8">
            {/* Submitted */}
            <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-6">
              <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <CheckCircle size={18} className="text-green-500" />
                Submitted ({summaryData?.summary.submissionStatus?.submitted.length || 0})
              </h3>
              <div className="flex flex-wrap gap-2">
                {summaryData?.summary.submissionStatus?.submitted.map((name, i) => (
                  <span key={i} className="px-3 py-1.5 bg-green-500/10 border border-green-500/20 rounded-lg text-sm text-green-400">
                    {name}
                  </span>
                ))}
                {(!summaryData?.summary.submissionStatus?.submitted || summaryData.summary.submissionStatus.submitted.length === 0) && (
                  <p className="text-neutral-500 text-sm">No submissions yet</p>
                )}
              </div>
            </div>

            {/* Pending */}
            <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-6">
              <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <AlertCircle size={18} className="text-yellow-500" />
                Pending ({summaryData?.summary.submissionStatus?.pending.length || 0})
              </h3>
              <div className="flex flex-wrap gap-2">
                {summaryData?.summary.submissionStatus?.pending.map((name, i) => (
                  <span key={i} className="px-3 py-1.5 bg-yellow-500/10 border border-yellow-500/20 rounded-lg text-sm text-yellow-400">
                    {name}
                  </span>
                ))}
                {(!summaryData?.summary.submissionStatus?.pending || summaryData.summary.submissionStatus.pending.length === 0) && (
                  <p className="text-neutral-500 text-sm">Everyone has submitted!</p>
                )}
              </div>
            </div>
          </div>

          {/* Category Filter */}
          <div className="mb-6">
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setSelectedCategory('all')}
                className={`px-4 py-2 rounded-xl border transition-all ${
                  selectedCategory === 'all'
                    ? 'bg-brand-green/20 border-brand-green/40 text-brand-green'
                    : 'bg-white/5 border-white/10 text-neutral-400 hover:bg-white/10'
                }`}
              >
                All ({allNotes.length})
              </button>
              {(Object.keys(CATEGORY_INFO) as NoteCategory[]).map(category => {
                const info = CATEGORY_INFO[category];
                const Icon = CATEGORY_ICONS[category];
                const count = allNotes.filter(n => n.category === category).length;
                if (count === 0) return null;

                return (
                  <button
                    key={category}
                    onClick={() => setSelectedCategory(category)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl border transition-all ${
                      selectedCategory === category
                        ? `bg-${info.color}-500/20 border-${info.color}-500/40 text-${info.color}-400`
                        : 'bg-white/5 border-white/10 text-neutral-400 hover:bg-white/10'
                    }`}
                  >
                    <Icon size={16} />
                    <span>{info.label} ({count})</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Notes List */}
          <div className="space-y-4">
            {filteredNotes.length === 0 ? (
              <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-12 text-center">
                <Megaphone size={48} className="text-neutral-600 mx-auto mb-4" />
                <p className="text-neutral-400">No notes submitted yet for this category</p>
              </div>
            ) : (
              filteredNotes.map(note => {
                const CategoryIcon = CATEGORY_ICONS[note.category];
                const categoryInfo = CATEGORY_INFO[note.category];

                return (
                  <div
                    key={note.id}
                    className="bg-white/[0.02] border border-white/5 rounded-2xl p-6 hover:bg-white/[0.04] transition-colors"
                  >
                    <div className="flex items-start gap-4">
                      <div className={`w-12 h-12 rounded-xl bg-${categoryInfo.color}-500/20 flex items-center justify-center flex-shrink-0`}>
                        <CategoryIcon size={24} className={`text-${categoryInfo.color}-400`} />
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 mb-2">
                          <h4 className="font-semibold text-white">{note.title || 'Untitled'}</h4>
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                            note.status === 'submitted'
                              ? 'bg-green-500/20 text-green-400'
                              : 'bg-yellow-500/20 text-yellow-400'
                          }`}>
                            {note.status}
                          </span>
                        </div>

                        <p className="text-sm text-neutral-400 mb-2">
                          {note.userName} - {ROLE_DISPLAY_NAMES[note.userRole]} - {categoryInfo.label}
                        </p>

                        <p className="text-neutral-300 mb-3 whitespace-pre-wrap">
                          {note.content}
                        </p>

                        {/* Highlights */}
                        {note.highlights && note.highlights.length > 0 && (
                          <div className="mb-3">
                            <p className="text-xs text-neutral-500 mb-1">Key Points:</p>
                            <ul className="space-y-1">
                              {note.highlights.map((h, i) => (
                                <li key={i} className="flex items-start gap-2 text-sm text-brand-green">
                                  <CheckCircle size={14} className="mt-0.5 flex-shrink-0" />
                                  <span>{h}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {/* Timing */}
                        {note.timing && (
                          <div className="flex items-center gap-2 mb-3 text-sm text-blue-400">
                            <Timer size={14} />
                            {formatTimingInfo(note.timing)}
                          </div>
                        )}

                        {/* Attachments */}
                        {note.attachments && note.attachments.length > 0 && (
                          <div className="flex items-center gap-4 text-sm text-neutral-500">
                            <span className="flex items-center gap-1">
                              <ImageIcon size={14} />
                              {note.attachments.filter(a => a.type === 'image' || a.type === 'photo').length} images
                            </span>
                            <span className="flex items-center gap-1">
                              <FileText size={14} />
                              {note.attachments.filter(a => a.type === 'document').length} documents
                            </span>
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        {note.includeInSlide && (
                          <span className="flex items-center gap-1 px-2 py-1 bg-purple-500/10 border border-purple-500/20 rounded-lg text-xs text-purple-400">
                            <Presentation size={12} />
                            In Slide
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Attachments Preview */}
                    {note.attachments && note.attachments.filter(a => a.type === 'image' || a.type === 'photo').length > 0 && (
                      <div className="mt-4 pt-4 border-t border-white/5">
                        <div className="flex gap-2 overflow-x-auto pb-2">
                          {note.attachments
                            .filter(a => a.type === 'image' || a.type === 'photo')
                            .map(att => (
                              <a
                                key={att.id}
                                href={att.fileUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex-shrink-0 w-20 h-20 rounded-lg overflow-hidden bg-neutral-800 relative group"
                              >
                                <Image
                                  src={att.fileUrl}
                                  alt={att.fileName}
                                  fill
                                  className="object-cover group-hover:scale-110 transition-transform"
                                />
                              </a>
                            ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* Action Buttons */}
          <div className="mt-8 flex flex-col sm:flex-row gap-3">
            <Link
              href="/portal/monday-notes"
              className="flex-1 flex items-center justify-center gap-2 px-6 py-4 bg-white/5 hover:bg-white/10 border border-white/10 text-white font-semibold rounded-xl transition-colors"
            >
              <Megaphone size={20} />
              Add My Notes
            </Link>

            <button
              onClick={async () => {
                // Build meeting notes text organized by category
                const meetingDate = new Date(nextMondayDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
                const meetingTitle = `Monday Meeting Notes - ${meetingDate}`;

                // Group notes by category for the clipboard
                const notesByCategory: Record<string, string[]> = {};
                for (const note of allNotes) {
                  const cat = note.category || 'general';
                  if (!notesByCategory[cat]) notesByCategory[cat] = [];
                  notesByCategory[cat].push(`- ${note.content} (${note.userName})`);
                }

                let clipboardText = `${meetingTitle}\n\n`;
                for (const [category, items] of Object.entries(notesByCategory)) {
                  const catLabel = CATEGORY_INFO[category as NoteCategory]?.label || category;
                  clipboardText += `${catLabel.toUpperCase()}\n`;
                  clipboardText += items.join('\n') + '\n\n';
                }

                // Copy notes to clipboard
                try {
                  await navigator.clipboard.writeText(clipboardText);
                } catch {
                  // Clipboard API may not be available
                }

                // Open Google Slides with the title
                const slidesUrl = `https://docs.google.com/presentation/create?title=${encodeURIComponent(meetingTitle)}`;
                window.open(slidesUrl, '_blank');

                alert(`Meeting notes copied to clipboard. A new Google Slides presentation "${meetingTitle}" is opening in a new tab. Paste the notes into your slides.`);
              }}
              className="flex-1 flex items-center justify-center gap-2 px-6 py-4 bg-gradient-to-r from-purple-500 to-indigo-500 hover:from-purple-600 hover:to-indigo-600 text-white font-semibold rounded-xl transition-all shadow-lg shadow-purple-500/25"
            >
              <Presentation size={20} />
              Generate Slides
            </button>
          </div>
        </main>
      </div>
    </div>
  );
}
