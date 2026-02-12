'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Command,
  Headphones,
  Video,
  FileText,
  Brain,
  CreditCard,
  Image as ImageIcon,
  Map,
  Play,
  Pause,
  ChevronRight,
  Download,
  Clock,
  GraduationCap,
  Volume2,
  Share2,
  CheckCircle2,
  Trophy,
  Keyboard,
  ChevronLeft,
  RotateCcw,
  AlertCircle,
} from 'lucide-react';
import SettingsMenu from '@/components/SettingsMenu';
import SalesInfographic from './SalesInfographic';
import SalesMasteryInfographic from './SalesMasteryInfographic';
import PlatformOnboardingInfographic from './PlatformOnboardingInfographic';
import FieldOperationsInfographic from './FieldOperationsInfographic';
import CustomerServiceInfographic from './CustomerServiceInfographic';
import AdminDeepDiveInfographic from './AdminDeepDiveInfographic';

const INFOGRAPHIC_COMPONENTS: Record<string, React.ComponentType> = {
  'sales-performance': SalesInfographic,
  'sales-mastery': SalesMasteryInfographic,
  'platform-onboarding': PlatformOnboardingInfographic,
  'field-operations': FieldOperationsInfographic,
  'customer-service': CustomerServiceInfographic,
  'admin-deep-dive': AdminDeepDiveInfographic,
};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface TrainingContent {
  audioDeepDive?: string;
  trainingVideo?: string;
  briefVideo?: string;
  quiz?: string;
  flashcards?: string;
  studyGuide?: string;
  mindMap?: string;
  infographic?: string;
}

interface TrainingModule {
  id: string;
  title: string;
  description: string;
  audience: string[];
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  content: TrainingContent;
}

type ContentType = 'audio' | 'video' | 'quiz' | 'flashcards' | 'guide' | 'mindmap' | 'infographic';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CONTENT_TYPES: { key: ContentType; label: string; icon: typeof Headphones; color: string }[] = [
  { key: 'audio', label: 'Audio Deep Dives', icon: Headphones, color: 'text-purple-400' },
  { key: 'video', label: 'Training Videos', icon: Video, color: 'text-blue-400' },
  { key: 'quiz', label: 'Knowledge Quizzes', icon: Brain, color: 'text-brand-green' },
  { key: 'flashcards', label: 'Flashcards', icon: CreditCard, color: 'text-amber-400' },
  { key: 'guide', label: 'Study Guides', icon: FileText, color: 'text-cyan-400' },
  { key: 'mindmap', label: 'Mind Maps', icon: Map, color: 'text-pink-400' },
  { key: 'infographic', label: 'Infographics', icon: ImageIcon, color: 'text-orange-400' },
];

const DIFFICULTY_COLORS = {
  beginner: 'bg-green-500/20 text-green-400 border-green-500/30',
  intermediate: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  advanced: 'bg-red-500/20 text-red-400 border-red-500/30',
};

const CONTENT_TYPE_MAP: Record<ContentType, keyof TrainingContent> = {
  audio: 'audioDeepDive',
  video: 'trainingVideo',
  quiz: 'quiz',
  flashcards: 'flashcards',
  guide: 'studyGuide',
  mindmap: 'mindMap',
  infographic: 'infographic',
};

const LS_KEY_COMPLETED = 'rcrs-training-completed';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getCompletedModules(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(LS_KEY_COMPLETED);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function setCompletedModules(ids: string[]) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(LS_KEY_COMPLETED, JSON.stringify(ids));
}

function markModuleCompleted(moduleId: string): string[] {
  const current = getCompletedModules();
  if (!current.includes(moduleId)) {
    const updated = [...current, moduleId];
    setCompletedModules(updated);
    return updated;
  }
  return current;
}

function formatTime(seconds: number): string {
  if (!isFinite(seconds) || seconds < 0) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

/** Splits markdown text on ## headers into titled sections */
function parseStudyGuideSections(text: string): { heading: string; body: string }[] {
  const lines = text.split('\n');
  const sections: { heading: string; body: string }[] = [];
  let currentHeading = '';
  let currentBody: string[] = [];

  for (const line of lines) {
    const headerMatch = line.match(/^##\s+(.+)/);
    if (headerMatch) {
      // Push previous section if it exists
      if (currentHeading || currentBody.length > 0) {
        sections.push({ heading: currentHeading, body: currentBody.join('\n').trim() });
      }
      currentHeading = headerMatch[1].trim();
      currentBody = [];
    } else {
      currentBody.push(line);
    }
  }
  // Push last section
  if (currentHeading || currentBody.length > 0) {
    sections.push({ heading: currentHeading, body: currentBody.join('\n').trim() });
  }
  return sections;
}

/** Renders inline markdown: **bold**, *italic*, `code`, [link](url) */
function renderInlineMarkdown(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, '<strong class="text-white font-semibold">$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`(.+?)`/g, '<code class="px-1.5 py-0.5 rounded bg-white/10 text-brand-green text-xs font-mono">$1</code>')
    .replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" class="text-brand-green underline underline-offset-2 hover:text-white transition-colors">$1</a>');
}

/** Renders a markdown body block into HTML for a study guide section */
function renderMarkdownBlock(body: string): string {
  if (!body) return '';
  const lines = body.split('\n');
  const htmlParts: string[] = [];
  let inList = false;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      if (inList) { htmlParts.push('</ul>'); inList = false; }
      continue;
    }
    // Bullet list item
    const bulletMatch = trimmed.match(/^[-*]\s+(.+)/);
    if (bulletMatch) {
      if (!inList) { htmlParts.push('<ul class="space-y-1 ml-4">'); inList = true; }
      htmlParts.push(`<li class="text-sm text-neutral-300 leading-relaxed list-disc list-outside">${renderInlineMarkdown(bulletMatch[1])}</li>`);
      continue;
    }
    // Numbered list item
    const numMatch = trimmed.match(/^\d+\.\s+(.+)/);
    if (numMatch) {
      if (!inList) { htmlParts.push('<ul class="space-y-1 ml-4">'); inList = true; }
      htmlParts.push(`<li class="text-sm text-neutral-300 leading-relaxed list-decimal list-outside">${renderInlineMarkdown(numMatch[1])}</li>`);
      continue;
    }
    // ### sub-heading
    const subHeadMatch = trimmed.match(/^###\s+(.+)/);
    if (subHeadMatch) {
      if (inList) { htmlParts.push('</ul>'); inList = false; }
      htmlParts.push(`<h4 class="text-sm font-semibold text-white mt-3 mb-1">${subHeadMatch[1]}</h4>`);
      continue;
    }
    // Normal paragraph
    if (inList) { htmlParts.push('</ul>'); inList = false; }
    htmlParts.push(`<p class="text-sm text-neutral-300 leading-relaxed">${renderInlineMarkdown(trimmed)}</p>`);
  }
  if (inList) htmlParts.push('</ul>');
  return htmlParts.join('\n');
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function TrainingLibraryPage() {
  const [modules, setModules] = useState<TrainingModule[]>([]);
  const [selectedModule, setSelectedModule] = useState<TrainingModule | null>(null);
  const [activeContent, setActiveContent] = useState<ContentType>('audio');
  const [isPlaying, setIsPlaying] = useState(false);
  const [studyGuideContent, setStudyGuideContent] = useState<string>('');
  const [quizData, setQuizData] = useState<Record<string, unknown> | null>(null);
  const [quizAnswers, setQuizAnswers] = useState<Record<number, number>>({});
  const [quizSubmitted, setQuizSubmitted] = useState(false);
  const [flashcardData, setFlashcardData] = useState<Record<string, unknown>[]>([]);
  const [currentFlashcard, setCurrentFlashcard] = useState(0);
  const [flashcardFlipped, setFlashcardFlipped] = useState(false);
  const [filterAudience, setFilterAudience] = useState<string>('all');
  const [completedModules, setCompletedModulesState] = useState<string[]>([]);
  const [shareToast, setShareToast] = useState(false);

  // Audio progress state
  const [audioCurrent, setAudioCurrent] = useState(0);
  const [audioDuration, setAudioDuration] = useState(0);
  const [audioSeeking, setAudioSeeking] = useState(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const progressBarRef = useRef<HTMLDivElement | null>(null);

  // -------------------------------------------------------------------------
  // Load modules
  // -------------------------------------------------------------------------

  useEffect(() => {
    loadModules();
    setCompletedModulesState(getCompletedModules());
  }, []);

  async function loadModules() {
    try {
      const { TRAINING_MODULES } = await import('@/lib/training-content');
      setModules(TRAINING_MODULES);

      // Check URL hash for a deep-link to a module
      const hash = window.location.hash.replace('#', '');
      const deepLinked = hash ? TRAINING_MODULES.find((m) => m.id === hash) : null;

      if (deepLinked) {
        setSelectedModule(deepLinked);
      } else if (TRAINING_MODULES.length > 0) {
        setSelectedModule(TRAINING_MODULES[0]);
      }
    } catch {
      // Training content not yet generated - show placeholder
      setModules([]);
    }
  }

  // -------------------------------------------------------------------------
  // Content loaders
  // -------------------------------------------------------------------------

  async function loadStudyGuide(url: string) {
    try {
      const res = await fetch(url);
      const text = await res.text();
      setStudyGuideContent(text);
    } catch {
      setStudyGuideContent('Study guide not available yet.');
    }
  }

  async function loadQuiz(url: string) {
    try {
      const res = await fetch(url);
      const data = await res.json();
      setQuizData(data);
      setQuizAnswers({});
      setQuizSubmitted(false);
    } catch {
      setQuizData(null);
    }
  }

  async function loadFlashcards(url: string) {
    try {
      const res = await fetch(url);
      const data = await res.json();
      setFlashcardData(Array.isArray(data) ? data : []);
      setCurrentFlashcard(0);
      setFlashcardFlipped(false);
    } catch {
      setFlashcardData([]);
    }
  }

  useEffect(() => {
    if (!selectedModule) return;
    if (activeContent === 'guide' && selectedModule.content.studyGuide) {
      loadStudyGuide(selectedModule.content.studyGuide);
    }
    if (activeContent === 'quiz' && selectedModule.content.quiz) {
      loadQuiz(selectedModule.content.quiz);
    }
    if (activeContent === 'flashcards' && selectedModule.content.flashcards) {
      loadFlashcards(selectedModule.content.flashcards);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedModule, activeContent]);

  // -------------------------------------------------------------------------
  // Audio controls
  // -------------------------------------------------------------------------

  function toggleAudio() {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setIsPlaying(!isPlaying);
  }

  function handleAudioTimeUpdate() {
    if (!audioRef.current || audioSeeking) return;
    setAudioCurrent(audioRef.current.currentTime);
  }

  function handleAudioLoadedMetadata() {
    if (!audioRef.current) return;
    setAudioDuration(audioRef.current.duration);
    setAudioCurrent(0);
  }

  function handleAudioEnded() {
    setIsPlaying(false);
    setAudioCurrent(audioDuration);
  }

  function handleProgressClick(e: React.MouseEvent<HTMLDivElement>) {
    if (!audioRef.current || !progressBarRef.current) return;
    const rect = progressBarRef.current.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const newTime = ratio * audioDuration;
    audioRef.current.currentTime = newTime;
    setAudioCurrent(newTime);
  }

  function handleProgressMouseDown() {
    setAudioSeeking(true);
  }

  function handleProgressMouseUp() {
    setAudioSeeking(false);
  }

  const audioProgress = audioDuration > 0 ? (audioCurrent / audioDuration) * 100 : 0;

  // -------------------------------------------------------------------------
  // Keyboard shortcuts for flashcards
  // -------------------------------------------------------------------------

  const handleFlashcardKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (activeContent !== 'flashcards' || flashcardData.length === 0) return;

      // Ignore if user is typing in an input/textarea
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        setCurrentFlashcard((prev) => Math.max(0, prev - 1));
        setFlashcardFlipped(false);
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        setCurrentFlashcard((prev) => Math.min(flashcardData.length - 1, prev + 1));
        setFlashcardFlipped(false);
      } else if (e.key === ' ') {
        e.preventDefault();
        setFlashcardFlipped((prev) => !prev);
      }
    },
    [activeContent, flashcardData.length],
  );

  useEffect(() => {
    window.addEventListener('keydown', handleFlashcardKeyDown);
    return () => window.removeEventListener('keydown', handleFlashcardKeyDown);
  }, [handleFlashcardKeyDown]);

  // -------------------------------------------------------------------------
  // Quiz scoring & completion
  // -------------------------------------------------------------------------

  function handleQuizAnswer(questionIndex: number, optionIndex: number) {
    if (quizSubmitted) return;
    setQuizAnswers((prev) => ({ ...prev, [questionIndex]: optionIndex }));
  }

  function submitQuiz() {
    if (!quizData || !Array.isArray(quizData)) return;
    setQuizSubmitted(true);

    const questions = quizData as Record<string, unknown>[];
    let correct = 0;
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      const correctIndex = typeof q.correctIndex === 'number' ? q.correctIndex : typeof q.correct === 'number' ? q.correct : -1;
      if (quizAnswers[i] === correctIndex) correct++;
    }

    const pct = questions.length > 0 ? (correct / questions.length) * 100 : 0;
    if (pct >= 70 && selectedModule) {
      const updated = markModuleCompleted(selectedModule.id);
      setCompletedModulesState(updated);

      // Persist to server
      try {
        let userId = 'anonymous';
        let userName = 'Team Member';
        const raw = localStorage.getItem('rcrs-user-settings');
        if (raw) {
          const settings = JSON.parse(raw);
          userId = settings.email || settings.userId || 'anonymous';
          userName = settings.displayName || settings.name || 'Team Member';
        }
        fetch('/api/portal/training/quiz-submit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId,
            userName,
            moduleId: selectedModule.id,
            moduleName: selectedModule.title,
            score: String(Math.round(pct)),
            passed: true,
            completedAt: new Date().toISOString(),
          }),
        }).catch(() => { /* fail silently */ });
      } catch { /* ignore */ }
    }
  }

  function getQuizScore(): { correct: number; total: number; pct: number } | null {
    if (!quizSubmitted || !quizData || !Array.isArray(quizData)) return null;
    const questions = quizData as Record<string, unknown>[];
    let correct = 0;
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      const correctIndex = typeof q.correctIndex === 'number' ? q.correctIndex : typeof q.correct === 'number' ? q.correct : -1;
      if (quizAnswers[i] === correctIndex) correct++;
    }
    return { correct, total: questions.length, pct: questions.length > 0 ? Math.round((correct / questions.length) * 100) : 0 };
  }

  // -------------------------------------------------------------------------
  // Share module link
  // -------------------------------------------------------------------------

  function handleShare() {
    if (!selectedModule) return;
    const url = `${window.location.origin}${window.location.pathname}#${selectedModule.id}`;
    navigator.clipboard.writeText(url).then(() => {
      setShareToast(true);
      setTimeout(() => setShareToast(false), 2500);
    }).catch(() => {
      // Fallback: prompt with URL
      window.prompt('Copy this link:', url);
    });
  }

  // -------------------------------------------------------------------------
  // Derived
  // -------------------------------------------------------------------------

  const filteredModules =
    filterAudience === 'all'
      ? modules
      : modules.filter((m) => m.audience.includes('all') || m.audience.includes(filterAudience));

  const hasContent = (mod: TrainingModule, type: ContentType): boolean => {
    return !!mod.content[CONTENT_TYPE_MAP[type]];
  };

  const completedCount = completedModules.filter((id) => modules.some((m) => m.id === id)).length;

  // -------------------------------------------------------------------------
  // Render helpers
  // -------------------------------------------------------------------------

  function renderFallback(type: ContentType) {
    const ct = CONTENT_TYPES.find((c) => c.key === type);
    const Icon = ct?.icon || Clock;
    const color = ct?.color || 'text-neutral-600';
    return (
      <div className="p-16 text-center">
        <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-white/[0.03] border border-white/5 flex items-center justify-center">
          <Icon size={28} className={`${color} opacity-40`} />
        </div>
        <p className="text-neutral-400 font-medium">
          {ct?.label || 'Content'} not available yet
        </p>
        <p className="text-xs text-neutral-500 mt-2 max-w-sm mx-auto">
          This content type has not been generated for &ldquo;{selectedModule?.title}&rdquo;.
          Run the NotebookLM pipeline to create it.
        </p>
        <div className="mt-6 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white/[0.03] border border-white/5 text-xs text-neutral-500">
          <AlertCircle size={14} />
          Waiting for content generation
        </div>
      </div>
    );
  }

  function renderStudyGuide() {
    if (!studyGuideContent) return renderFallback('guide');

    const sections = parseStudyGuideSections(studyGuideContent);

    // If no ## headers found, render plain text nicely
    if (sections.length <= 1 && !sections[0]?.heading) {
      return (
        <div className="p-8">
          <div className="flex items-center gap-4 mb-6">
            <FileText size={28} className="text-cyan-400" />
            <div>
              <h3 className="text-lg font-semibold text-white">Study Guide</h3>
              <p className="text-sm text-neutral-400">AI-generated comprehensive study guide</p>
            </div>
          </div>
          <div className="prose prose-invert prose-sm max-w-none">
            <div
              className="text-sm text-neutral-300 leading-relaxed space-y-2"
              dangerouslySetInnerHTML={{ __html: renderMarkdownBlock(studyGuideContent) }}
            />
          </div>
          {selectedModule?.content.studyGuide && (
            <a
              href={selectedModule.content.studyGuide}
              download
              className="inline-flex items-center gap-2 mt-6 px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-sm text-neutral-300 transition-colors"
            >
              <Download size={14} />
              Download Guide
            </a>
          )}
        </div>
      );
    }

    return (
      <div className="p-8">
        <div className="flex items-center gap-4 mb-6">
          <FileText size={28} className="text-cyan-400" />
          <div>
            <h3 className="text-lg font-semibold text-white">Study Guide</h3>
            <p className="text-sm text-neutral-400">
              {sections.filter((s) => s.heading).length} sections
            </p>
          </div>
        </div>

        <div className="space-y-6">
          {sections.map((section, idx) => (
            <div key={idx}>
              {section.heading && (
                <h3 className="text-base font-semibold text-white mb-3 flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 flex-shrink-0" />
                  {section.heading}
                </h3>
              )}
              {section.body && (
                <div
                  className="space-y-2 pl-4 border-l border-white/5"
                  dangerouslySetInnerHTML={{ __html: renderMarkdownBlock(section.body) }}
                />
              )}
            </div>
          ))}
        </div>

        {selectedModule?.content.studyGuide && (
          <a
            href={selectedModule.content.studyGuide}
            download
            className="inline-flex items-center gap-2 mt-6 px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-sm text-neutral-300 transition-colors"
          >
            <Download size={14} />
            Download Guide
          </a>
        )}
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // Main render
  // -------------------------------------------------------------------------

  return (
    <div className="min-h-screen bg-gradient-to-br from-neutral-950 via-neutral-900 to-neutral-950">
      {/* Background pattern */}
      <div className="fixed inset-0 opacity-30 pointer-events-none">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage:
              'radial-gradient(circle at 25px 25px, rgba(255,255,255,0.03) 2px, transparent 0)',
            backgroundSize: '50px 50px',
          }}
        />
      </div>

      {/* Share toast notification */}
      {shareToast && (
        <div className="fixed top-6 right-6 z-50 animate-in fade-in slide-in-from-top-2 duration-300">
          <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-brand-green/20 border border-brand-green/30 text-brand-green text-sm font-medium shadow-lg backdrop-blur-xl">
            <CheckCircle2 size={16} />
            Link copied to clipboard
          </div>
        </div>
      )}

      <div className="relative z-10">
        {/* Header */}
        <header className="border-b border-white/5 backdrop-blur-xl bg-black/20 sticky top-0 z-20">
          <div className="max-w-7xl mx-auto px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Link
                  href="/portal/training"
                  className="w-10 h-10 rounded-xl bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors"
                >
                  <ArrowLeft size={18} className="text-neutral-400" />
                </Link>
                <div>
                  <h1 className="text-xl font-bold text-white tracking-tight">
                    Training Library
                  </h1>
                  <p className="text-sm text-neutral-400">
                    AI-Generated Deep Dives, Videos, Quizzes & More
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Link
                  href="/command-center"
                  className="hidden sm:flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-brand-green/20 to-emerald-500/20 hover:from-brand-green/30 hover:to-emerald-500/30 border border-brand-green/30 text-brand-green text-sm font-medium transition-all"
                >
                  <Command size={16} />
                  RoofStack HQ
                </Link>
                <SettingsMenu />
              </div>
            </div>
          </div>
        </header>

        <main className="max-w-7xl mx-auto px-6 py-8">
          {modules.length === 0 ? (
            /* -------------------------------------------------------------- */
            /* Empty State - Show available training paths & sales training    */
            /* -------------------------------------------------------------- */
            <div className="space-y-8">
              <div className="text-center py-10">
                <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-brand-green/20 to-emerald-500/20 border border-brand-green/20 flex items-center justify-center">
                  <GraduationCap size={40} className="text-brand-green" />
                </div>
                <h2 className="text-2xl font-bold text-white mb-3">
                  Training Library
                </h2>
                <p className="text-neutral-400 max-w-lg mx-auto">
                  Access all RCRS training resources, courses, and certifications below.
                  Additional AI-generated deep dives are being prepared.
                </p>
              </div>

              {/* Available Training Courses */}
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {/* Sales Training Course */}
                <Link
                  href="/portal/training/sales"
                  className="rounded-2xl border border-white/10 bg-white/[0.02] p-6 hover:bg-white/[0.04] hover:border-brand-green/30 transition-all group"
                >
                  <div className="w-12 h-12 rounded-xl bg-brand-green/20 border border-brand-green/20 flex items-center justify-center mb-4">
                    <Brain size={24} className="text-brand-green" />
                  </div>
                  <h3 className="text-lg font-semibold text-white group-hover:text-brand-green transition-colors">
                    Sales Mastery Course
                  </h3>
                  <p className="text-sm text-neutral-400 mt-1">
                    7-module course with quizzes. Score 70% or higher to earn your certificate.
                  </p>
                  <div className="flex items-center gap-2 mt-4 text-xs text-neutral-500">
                    <GraduationCap size={14} />
                    <span>7 Modules</span>
                    <span className="text-neutral-700">|</span>
                    <span>Quiz-based</span>
                    <span className="text-neutral-700">|</span>
                    <span>Certificate</span>
                  </div>
                </Link>

                {/* Platform Onboarding */}
                <Link
                  href="/portal/training/onboarding"
                  className="rounded-2xl border border-white/10 bg-white/[0.02] p-6 hover:bg-white/[0.04] hover:border-brand-green/30 transition-all group"
                >
                  <div className="w-12 h-12 rounded-xl bg-blue-500/20 border border-blue-500/20 flex items-center justify-center mb-4">
                    <Video size={24} className="text-blue-400" />
                  </div>
                  <h3 className="text-lg font-semibold text-white group-hover:text-brand-green transition-colors">
                    Platform Onboarding
                  </h3>
                  <p className="text-sm text-neutral-400 mt-1">
                    8-section walkthrough of the RCRS platform with interactive Try It links.
                  </p>
                  <div className="flex items-center gap-2 mt-4 text-xs text-neutral-500">
                    <Video size={14} />
                    <span>8 Sections</span>
                    <span className="text-neutral-700">|</span>
                    <span>Interactive</span>
                    <span className="text-neutral-700">|</span>
                    <span>All Roles</span>
                  </div>
                </Link>

                {/* RCRS University */}
                <Link
                  href="/portal/training"
                  className="rounded-2xl border border-white/10 bg-white/[0.02] p-6 hover:bg-white/[0.04] hover:border-brand-green/30 transition-all group"
                >
                  <div className="w-12 h-12 rounded-xl bg-purple-500/20 border border-purple-500/20 flex items-center justify-center mb-4">
                    <GraduationCap size={24} className="text-purple-400" />
                  </div>
                  <h3 className="text-lg font-semibold text-white group-hover:text-brand-green transition-colors">
                    RCRS University Hub
                  </h3>
                  <p className="text-sm text-neutral-400 mt-1">
                    All training paths: Sales, Onboarding, and ongoing education.
                  </p>
                  <div className="flex items-center gap-2 mt-4 text-xs text-neutral-500">
                    <FileText size={14} />
                    <span>3 Paths</span>
                    <span className="text-neutral-700">|</span>
                    <span>Role-Based</span>
                    <span className="text-neutral-700">|</span>
                    <span>Self-Paced</span>
                  </div>
                </Link>
              </div>

              {/* Content Type Overview */}
              <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-6">
                <h3 className="text-lg font-semibold text-white mb-4">Available Content Types</h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
                  {CONTENT_TYPES.map((ct) => {
                    const Icon = ct.icon;
                    return (
                      <div
                        key={ct.key}
                        className="rounded-xl border border-white/5 bg-white/[0.02] p-3 text-center"
                      >
                        <Icon size={20} className={`${ct.color} mx-auto mb-1.5`} />
                        <p className="text-xs text-neutral-400">{ct.label}</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : (
            /* -------------------------------------------------------------- */
            /* Main Content - Library View                                     */
            /* -------------------------------------------------------------- */
            <div>
              {/* Progress Summary Banner */}
              <div className="mb-6 rounded-2xl border border-white/10 bg-white/[0.02] p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-brand-green/20 to-emerald-500/20 border border-brand-green/20 flex items-center justify-center flex-shrink-0">
                    <Trophy size={22} className="text-brand-green" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-white">
                      {completedCount} of {modules.length} module{modules.length !== 1 ? 's' : ''} completed
                    </p>
                    <p className="text-xs text-neutral-400 mt-0.5">
                      {completedCount === modules.length
                        ? 'Congratulations! All modules finished.'
                        : 'Pass the quiz (70%+) in each module to mark it complete.'}
                    </p>
                  </div>
                </div>
                {/* Progress bar */}
                <div className="w-full sm:w-48 flex-shrink-0">
                  <div className="flex items-center justify-between text-xs text-neutral-400 mb-1">
                    <span>Progress</span>
                    <span>
                      {modules.length > 0 ? Math.round((completedCount / modules.length) * 100) : 0}%
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-white/10 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-brand-green to-emerald-500 transition-all duration-500"
                      style={{
                        width: `${modules.length > 0 ? (completedCount / modules.length) * 100 : 0}%`,
                      }}
                    />
                  </div>
                </div>
              </div>

              <div className="flex flex-col lg:flex-row gap-6">
                {/* Sidebar - Module List */}
                <div className="lg:w-72 flex-shrink-0">
                  <div className="sticky top-24">
                    {/* Filter */}
                    <select
                      value={filterAudience}
                      onChange={(e) => setFilterAudience(e.target.value)}
                      className="w-full mb-4 px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white text-sm"
                    >
                      <option value="all">All Roles</option>
                      <option value="sales_rep">Sales Reps</option>
                      <option value="driver">Drivers</option>
                      <option value="office_staff">Office Staff</option>
                      <option value="admin">Admin</option>
                      <option value="manager">Managers</option>
                    </select>

                    {/* Module Cards */}
                    <div className="space-y-2">
                      {filteredModules.map((mod) => {
                        const isCompleted = completedModules.includes(mod.id);
                        const isSelected = selectedModule?.id === mod.id;
                        return (
                          <button
                            key={mod.id}
                            onClick={() => setSelectedModule(mod)}
                            className={`w-full text-left rounded-xl p-4 transition-all ${
                              isSelected
                                ? 'bg-brand-green/10 border border-brand-green/30'
                                : 'bg-white/[0.02] border border-white/5 hover:bg-white/5'
                            }`}
                          >
                            <div className="flex items-start justify-between">
                              <h3
                                className={`text-sm font-semibold ${
                                  isSelected ? 'text-brand-green' : 'text-white'
                                }`}
                              >
                                {mod.title}
                              </h3>
                              <div className="flex items-center gap-1 mt-0.5">
                                {isCompleted && (
                                  <CheckCircle2
                                    size={14}
                                    className="text-brand-green flex-shrink-0"
                                  />
                                )}
                                <ChevronRight
                                  size={14}
                                  className={`${
                                    isSelected ? 'text-brand-green' : 'text-neutral-500'
                                  }`}
                                />
                              </div>
                            </div>
                            <p className="text-xs text-neutral-400 mt-1 line-clamp-2">
                              {mod.description}
                            </p>
                            <div className="flex items-center gap-2 mt-2">
                              <span
                                className={`text-[10px] px-2 py-0.5 rounded-full border ${
                                  DIFFICULTY_COLORS[mod.difficulty]
                                }`}
                              >
                                {mod.difficulty}
                              </span>
                              <span className="text-[10px] text-neutral-500">
                                {Object.values(mod.content).filter(Boolean).length} resources
                              </span>
                              {isCompleted && (
                                <span className="text-[10px] text-brand-green font-medium ml-auto">
                                  Done
                                </span>
                              )}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Main Content Area */}
                {selectedModule && (
                  <div className="flex-1 min-w-0">
                    {/* Module Header */}
                    <div className="mb-6 flex items-start justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-3">
                          <h2 className="text-2xl font-bold text-white">
                            {selectedModule.title}
                          </h2>
                          {completedModules.includes(selectedModule.id) && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-brand-green/10 border border-brand-green/30 text-brand-green text-xs font-medium">
                              <CheckCircle2 size={12} />
                              Completed
                            </span>
                          )}
                        </div>
                        <p className="text-neutral-400 mt-1">{selectedModule.description}</p>
                      </div>
                      <button
                        onClick={handleShare}
                        className="flex-shrink-0 flex items-center gap-2 px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 text-sm text-neutral-300 transition-colors"
                        title="Copy link to this module"
                      >
                        <Share2 size={14} />
                        <span className="hidden sm:inline">Share</span>
                      </button>
                    </div>

                    {/* Content Type Tabs */}
                    <div className="flex flex-wrap gap-2 mb-6">
                      {CONTENT_TYPES.map((ct) => {
                        const Icon = ct.icon;
                        const available = hasContent(selectedModule, ct.key);
                        return (
                          <button
                            key={ct.key}
                            onClick={() => available && setActiveContent(ct.key)}
                            disabled={!available}
                            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                              activeContent === ct.key
                                ? 'bg-white/10 border border-white/20 text-white'
                                : available
                                  ? 'bg-white/[0.02] border border-white/5 text-neutral-400 hover:bg-white/5'
                                  : 'bg-white/[0.01] border border-white/[0.03] text-neutral-600 cursor-not-allowed'
                            }`}
                          >
                            <Icon
                              size={16}
                              className={available ? ct.color : 'text-neutral-600'}
                            />
                            <span className="hidden sm:inline">{ct.label}</span>
                            <span className="sm:hidden">{ct.label.split(' ')[0]}</span>
                          </button>
                        );
                      })}
                    </div>

                    {/* Content Display */}
                    <div className="rounded-2xl border border-white/10 bg-white/[0.02] overflow-hidden">
                      {/* ================================================= */}
                      {/* Audio Player                                        */}
                      {/* ================================================= */}
                      {activeContent === 'audio' &&
                        (selectedModule.content.audioDeepDive ? (
                          <div className="p-8">
                            <div className="flex items-center gap-4 mb-6">
                              <div className="w-16 h-16 rounded-2xl bg-purple-500/20 border border-purple-500/30 flex items-center justify-center">
                                <Headphones size={28} className="text-purple-400" />
                              </div>
                              <div>
                                <h3 className="text-lg font-semibold text-white">
                                  Audio Deep Dive
                                </h3>
                                <p className="text-sm text-neutral-400">
                                  AI-generated podcast covering{' '}
                                  {selectedModule.title.toLowerCase()}
                                </p>
                              </div>
                            </div>

                            <audio
                              ref={audioRef}
                              src={selectedModule.content.audioDeepDive}
                              onTimeUpdate={handleAudioTimeUpdate}
                              onLoadedMetadata={handleAudioLoadedMetadata}
                              onEnded={handleAudioEnded}
                              className="hidden"
                              preload="metadata"
                            />

                            {/* Play button + progress bar */}
                            <div className="flex items-center gap-4">
                              <button
                                onClick={toggleAudio}
                                className="w-14 h-14 rounded-full bg-purple-500 hover:bg-purple-400 flex items-center justify-center transition-colors flex-shrink-0"
                              >
                                {isPlaying ? (
                                  <Pause size={24} className="text-white" />
                                ) : (
                                  <Play size={24} className="text-white ml-1" />
                                )}
                              </button>

                              <div className="flex-1 min-w-0">
                                {/* Time labels */}
                                <div className="flex items-center justify-between text-xs text-neutral-400 mb-1.5">
                                  <span className="font-mono">
                                    {formatTime(audioCurrent)}
                                  </span>
                                  <span className="font-mono">
                                    {audioDuration > 0
                                      ? formatTime(audioDuration)
                                      : '--:--'}
                                  </span>
                                </div>
                                {/* Clickable progress bar */}
                                <div
                                  ref={progressBarRef}
                                  className="h-2 rounded-full bg-white/10 cursor-pointer group relative"
                                  onClick={handleProgressClick}
                                  onMouseDown={handleProgressMouseDown}
                                  onMouseUp={handleProgressMouseUp}
                                  role="slider"
                                  aria-label="Audio progress"
                                  aria-valuenow={Math.round(audioCurrent)}
                                  aria-valuemin={0}
                                  aria-valuemax={Math.round(audioDuration)}
                                  tabIndex={0}
                                >
                                  <div
                                    className="h-full rounded-full bg-purple-500 transition-[width] duration-100 relative"
                                    style={{ width: `${audioProgress}%` }}
                                  >
                                    {/* Seek handle */}
                                    <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3.5 h-3.5 rounded-full bg-white shadow-md opacity-0 group-hover:opacity-100 transition-opacity" />
                                  </div>
                                </div>
                              </div>

                              <Volume2 size={18} className="text-neutral-500 flex-shrink-0" />
                            </div>

                            <div className="mt-4 flex gap-3">
                              <a
                                href={selectedModule.content.audioDeepDive}
                                download
                                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-sm text-neutral-300 transition-colors"
                              >
                                <Download size={14} />
                                Download MP3
                              </a>
                            </div>
                          </div>
                        ) : (
                          renderFallback('audio')
                        ))}

                      {/* ================================================= */}
                      {/* Video Player                                        */}
                      {/* ================================================= */}
                      {activeContent === 'video' &&
                        (selectedModule.content.trainingVideo ? (
                          <div className="p-8">
                            <video
                              ref={videoRef}
                              src={selectedModule.content.trainingVideo}
                              controls
                              className="w-full rounded-xl bg-black"
                            />
                            <div className="mt-4 flex gap-3">
                              {selectedModule.content.briefVideo && (
                                <button
                                  onClick={() => {
                                    if (videoRef.current) {
                                      videoRef.current.src =
                                        selectedModule.content.briefVideo!;
                                    }
                                  }}
                                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-sm text-neutral-300 transition-colors"
                                >
                                  <Clock size={14} />
                                  Watch Brief (2 min)
                                </button>
                              )}
                              <a
                                href={selectedModule.content.trainingVideo}
                                download
                                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-sm text-neutral-300 transition-colors"
                              >
                                <Download size={14} />
                                Download Video
                              </a>
                            </div>
                          </div>
                        ) : (
                          renderFallback('video')
                        ))}

                      {/* ================================================= */}
                      {/* Quiz                                                */}
                      {/* ================================================= */}
                      {activeContent === 'quiz' &&
                        (selectedModule.content.quiz ? (
                          <div className="p-8">
                            <div className="flex items-center gap-4 mb-6">
                              <Brain size={28} className="text-brand-green" />
                              <div>
                                <h3 className="text-lg font-semibold text-white">
                                  Knowledge Quiz
                                </h3>
                                <p className="text-sm text-neutral-400">
                                  Test your understanding of{' '}
                                  {selectedModule.title.toLowerCase()}
                                </p>
                              </div>
                            </div>

                            {/* Quiz score banner (shown after submission) */}
                            {quizSubmitted && (() => {
                              const score = getQuizScore();
                              if (!score) return null;
                              const passed = score.pct >= 70;
                              return (
                                <div
                                  className={`mb-6 rounded-xl p-4 border flex items-center gap-3 ${
                                    passed
                                      ? 'bg-brand-green/10 border-brand-green/30'
                                      : 'bg-red-500/10 border-red-500/30'
                                  }`}
                                >
                                  {passed ? (
                                    <CheckCircle2 size={22} className="text-brand-green flex-shrink-0" />
                                  ) : (
                                    <AlertCircle size={22} className="text-red-400 flex-shrink-0" />
                                  )}
                                  <div>
                                    <p className={`text-sm font-semibold ${passed ? 'text-brand-green' : 'text-red-400'}`}>
                                      {passed ? 'Passed!' : 'Not quite.'} {score.correct}/{score.total} correct ({score.pct}%)
                                    </p>
                                    <p className="text-xs text-neutral-400 mt-0.5">
                                      {passed
                                        ? 'This module is now marked as completed.'
                                        : 'You need 70% to pass. Review the study guide and try again.'}
                                    </p>
                                  </div>
                                  {!passed && (
                                    <button
                                      onClick={() => {
                                        setQuizAnswers({});
                                        setQuizSubmitted(false);
                                      }}
                                      className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-xs text-neutral-300 transition-colors flex-shrink-0"
                                    >
                                      <RotateCcw size={12} />
                                      Retry
                                    </button>
                                  )}
                                </div>
                              );
                            })()}

                            <div className="space-y-4">
                              {quizData && Array.isArray(quizData) ? (
                                <>
                                  {(quizData as Record<string, unknown>[]).map(
                                    (q: Record<string, unknown>, i: number) => {
                                      const correctIndex =
                                        typeof q.correctIndex === 'number'
                                          ? q.correctIndex
                                          : typeof q.correct === 'number'
                                            ? q.correct
                                            : -1;
                                      return (
                                        <div
                                          key={i}
                                          className="rounded-xl border border-white/10 bg-white/[0.02] p-4"
                                        >
                                          <p className="text-sm font-medium text-white mb-3">
                                            {i + 1}. {String(q.question || '')}
                                          </p>
                                          {Array.isArray(q.options) &&
                                            (q.options as string[]).map(
                                              (opt: string, j: number) => {
                                                const isSelected = quizAnswers[i] === j;
                                                const isCorrect = quizSubmitted && j === correctIndex;
                                                const isWrong = quizSubmitted && isSelected && j !== correctIndex;
                                                return (
                                                  <button
                                                    key={j}
                                                    onClick={() => handleQuizAnswer(i, j)}
                                                    disabled={quizSubmitted}
                                                    className={`block w-full text-left px-4 py-2 rounded-lg text-sm mb-2 transition-colors border ${
                                                      isCorrect
                                                        ? 'bg-brand-green/10 border-brand-green/30 text-brand-green'
                                                        : isWrong
                                                          ? 'bg-red-500/10 border-red-500/30 text-red-400'
                                                          : isSelected
                                                            ? 'bg-white/10 border-white/20 text-white'
                                                            : 'bg-white/[0.03] hover:bg-white/10 border-white/5 text-neutral-300'
                                                    } ${quizSubmitted ? 'cursor-default' : ''}`}
                                                  >
                                                    {String.fromCharCode(65 + j)}. {opt}
                                                  </button>
                                                );
                                              },
                                            )}
                                        </div>
                                      );
                                    },
                                  )}
                                  {!quizSubmitted && (
                                    <button
                                      onClick={submitQuiz}
                                      disabled={
                                        Object.keys(quizAnswers).length <
                                        (quizData as Record<string, unknown>[]).length
                                      }
                                      className="w-full py-3 rounded-xl bg-gradient-to-r from-brand-green/80 to-emerald-500/80 hover:from-brand-green hover:to-emerald-500 disabled:from-neutral-700 disabled:to-neutral-700 disabled:cursor-not-allowed text-white font-semibold text-sm transition-all"
                                    >
                                      {Object.keys(quizAnswers).length <
                                      (quizData as Record<string, unknown>[]).length
                                        ? `Answer all questions (${Object.keys(quizAnswers).length}/${(quizData as Record<string, unknown>[]).length})`
                                        : 'Submit Quiz'}
                                    </button>
                                  )}
                                </>
                              ) : quizData ? (
                                <p className="text-sm text-neutral-400">
                                  Quiz data loaded. Open in full view for the interactive
                                  experience.
                                </p>
                              ) : (
                                <div className="text-center py-8">
                                  <div className="w-8 h-8 mx-auto mb-3 rounded-full border-2 border-brand-green/30 border-t-brand-green animate-spin" />
                                  <p className="text-sm text-neutral-400">Loading quiz...</p>
                                </div>
                              )}
                            </div>
                          </div>
                        ) : (
                          renderFallback('quiz')
                        ))}

                      {/* ================================================= */}
                      {/* Flashcards                                          */}
                      {/* ================================================= */}
                      {activeContent === 'flashcards' &&
                        (selectedModule.content.flashcards ? (
                          flashcardData.length > 0 ? (
                            <div className="p-8">
                              <div className="flex items-center justify-between mb-6">
                                <div className="flex items-center gap-4">
                                  <CreditCard size={28} className="text-amber-400" />
                                  <div>
                                    <h3 className="text-lg font-semibold text-white">
                                      Flashcards
                                    </h3>
                                    <p className="text-sm text-neutral-400">
                                      {currentFlashcard + 1} of {flashcardData.length}
                                    </p>
                                  </div>
                                </div>
                                {/* Keyboard hint */}
                                <div className="hidden sm:flex items-center gap-2 text-xs text-neutral-500">
                                  <Keyboard size={14} />
                                  <span>
                                    <kbd className="px-1.5 py-0.5 rounded bg-white/10 text-neutral-400 font-mono text-[10px]">
                                      Space
                                    </kbd>{' '}
                                    flip{' '}
                                    <kbd className="px-1.5 py-0.5 rounded bg-white/10 text-neutral-400 font-mono text-[10px]">
                                      &larr;
                                    </kbd>{' '}
                                    <kbd className="px-1.5 py-0.5 rounded bg-white/10 text-neutral-400 font-mono text-[10px]">
                                      &rarr;
                                    </kbd>{' '}
                                    navigate
                                  </span>
                                </div>
                              </div>

                              {/* Flashcard progress dots */}
                              <div className="flex justify-center gap-1.5 mb-4">
                                {flashcardData.map((_, idx) => (
                                  <button
                                    key={idx}
                                    onClick={() => {
                                      setCurrentFlashcard(idx);
                                      setFlashcardFlipped(false);
                                    }}
                                    className={`w-2 h-2 rounded-full transition-all ${
                                      idx === currentFlashcard
                                        ? 'bg-amber-400 scale-125'
                                        : 'bg-white/10 hover:bg-white/20'
                                    }`}
                                    aria-label={`Go to card ${idx + 1}`}
                                  />
                                ))}
                              </div>

                              {/* The card */}
                              <button
                                onClick={() => setFlashcardFlipped(!flashcardFlipped)}
                                className="w-full min-h-[220px] rounded-2xl border border-amber-500/20 bg-gradient-to-br from-amber-500/5 to-orange-500/5 p-8 text-center transition-all hover:border-amber-500/40 focus:outline-none focus:ring-2 focus:ring-amber-500/40 focus:ring-offset-2 focus:ring-offset-neutral-900"
                              >
                                <p className="text-xs text-amber-400 mb-4 uppercase tracking-wider">
                                  {flashcardFlipped ? 'Answer' : 'Question'}{' '}
                                  <span className="text-neutral-500">(click or press space to flip)</span>
                                </p>
                                <p className="text-lg text-white leading-relaxed">
                                  {flashcardFlipped
                                    ? String(
                                        (flashcardData[currentFlashcard] as Record<string, unknown>)
                                          ?.answer || '',
                                      )
                                    : String(
                                        (flashcardData[currentFlashcard] as Record<string, unknown>)
                                          ?.question || '',
                                      )}
                                </p>
                              </button>

                              <div className="flex justify-between mt-4">
                                <button
                                  onClick={() => {
                                    setCurrentFlashcard(Math.max(0, currentFlashcard - 1));
                                    setFlashcardFlipped(false);
                                  }}
                                  disabled={currentFlashcard === 0}
                                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-sm text-neutral-300 disabled:opacity-30 transition-colors"
                                >
                                  <ChevronLeft size={14} />
                                  Previous
                                </button>
                                <button
                                  onClick={() => {
                                    setCurrentFlashcard(
                                      Math.min(flashcardData.length - 1, currentFlashcard + 1),
                                    );
                                    setFlashcardFlipped(false);
                                  }}
                                  disabled={currentFlashcard === flashcardData.length - 1}
                                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-sm text-neutral-300 disabled:opacity-30 transition-colors"
                                >
                                  Next
                                  <ChevronRight size={14} />
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="p-16 text-center">
                              <div className="w-8 h-8 mx-auto mb-3 rounded-full border-2 border-amber-400/30 border-t-amber-400 animate-spin" />
                              <p className="text-sm text-neutral-400">Loading flashcards...</p>
                            </div>
                          )
                        ) : (
                          renderFallback('flashcards')
                        ))}

                      {/* ================================================= */}
                      {/* Study Guide                                         */}
                      {/* ================================================= */}
                      {activeContent === 'guide' &&
                        (selectedModule.content.studyGuide
                          ? renderStudyGuide()
                          : renderFallback('guide'))}

                      {/* ================================================= */}
                      {/* Mind Map                                            */}
                      {/* ================================================= */}
                      {activeContent === 'mindmap' &&
                        (selectedModule.content.mindMap ? (
                          <div className="p-8">
                            <div className="flex items-center gap-4 mb-6">
                              <Map size={28} className="text-pink-400" />
                              <h3 className="text-lg font-semibold text-white">Mind Map</h3>
                            </div>
                            <div className="relative rounded-xl overflow-hidden bg-black/30">
                              <img
                                src={selectedModule.content.mindMap}
                                alt={`${selectedModule.title} Mind Map`}
                                className="w-full h-auto"
                              />
                            </div>
                            <a
                              href={selectedModule.content.mindMap}
                              download
                              className="inline-flex items-center gap-2 mt-4 px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-sm text-neutral-300 transition-colors"
                            >
                              <Download size={14} />
                              Download Mind Map
                            </a>
                          </div>
                        ) : (
                          renderFallback('mindmap')
                        ))}

                      {/* ================================================= */}
                      {/* Infographic                                         */}
                      {/* ================================================= */}
                      {activeContent === 'infographic' &&
                        (selectedModule.content.infographic ? (
                          (() => {
                            const InfographicComponent = INFOGRAPHIC_COMPONENTS[selectedModule.id];
                            if (InfographicComponent) {
                              return <InfographicComponent />;
                            }
                            return (
                              <div className="p-8">
                                <div className="flex items-center gap-4 mb-6">
                                  <ImageIcon size={28} className="text-orange-400" />
                                  <h3 className="text-lg font-semibold text-white">Infographic</h3>
                                </div>
                                <div className="relative rounded-xl overflow-hidden bg-black/30">
                                  <img
                                    src={selectedModule.content.infographic}
                                    alt={`${selectedModule.title} Infographic`}
                                    className="w-full h-auto"
                                  />
                                </div>
                                <a
                                  href={selectedModule.content.infographic}
                                  download
                                  className="inline-flex items-center gap-2 mt-4 px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-sm text-neutral-300 transition-colors"
                                >
                                  <Download size={14} />
                                  Download Infographic
                                </a>
                              </div>
                            );
                          })()
                        ) : (
                          renderFallback('infographic')
                        ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
