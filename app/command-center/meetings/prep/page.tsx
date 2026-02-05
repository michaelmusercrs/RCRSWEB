'use client';

/**
 * RCRS Command Center - Meeting Prep Page
 *
 * Form for preparing content for the next Monday meeting.
 * Includes:
 * - Bible verse selection (dropdown or random)
 * - Announcements (Part 1 & Part 2)
 * - Employee of the Month selection
 * - Training topic input
 * - Department notes (Office, Sales, Production, Drivers)
 * - Save Draft / Mark Ready functionality
 *
 * Access: Admin/Owner only
 *
 * @author RCRS Development Team
 * @version 1.0.0
 */

import * as React from 'react';
import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Save,
  CheckCircle2,
  AlertCircle,
  BookOpen,
  Megaphone,
  Award,
  GraduationCap,
  Users,
  Shuffle,
  Calendar,
  Clock,
  Loader2,
  X,
  Plus,
  Trash2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { LoadingSpinner, PermissionGate } from '@/components/command-center';
import {
  BIBLE_VERSES,
  SLIDES,
  BibleVerse,
  MeetingPrepData,
  calculateNextMeetingDate,
  formatMeetingDate,
  getISODate,
  getRandomBibleVerse,
  getWeekNumber,
  getBibleVerseByWeek,
} from '@/lib/meeting-data';
import { teamMembers } from '@/lib/teamData';

// =============================================================================
// Types
// =============================================================================

interface FormState {
  bibleVerse: BibleVerse | null;
  useRandomVerse: boolean;
  announcements: {
    part1: string[];
    part2: string[];
  };
  employeeOfMonth: {
    name: string;
    department: string;
    reason: string;
  } | null;
  trainingTopic: string;
  departmentNotes: {
    sales: string;
    operations: string;
    office: string;
    drivers: string;
  };
  specialNotes: string;
  preparedBy: string;
}

// =============================================================================
// Constants
// =============================================================================

const DEPARTMENTS = ['Leadership', 'Office', 'Production', 'Regional Partner'] as const;

// Filter team members for employee of month selection (exclude advisors and memorial)
const ELIGIBLE_EMPLOYEES = teamMembers.filter(
  (m) => m.category !== 'In Loving Memory' && m.category !== 'Partners & Advisors'
);

// =============================================================================
// Section Component
// =============================================================================

interface SectionProps {
  title: string;
  icon: React.ElementType;
  description?: string;
  children: React.ReactNode;
}

function Section({ title, icon: Icon, description, children }: SectionProps) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 overflow-hidden">
      <div className="p-4 border-b border-zinc-800 bg-zinc-800/30">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-lime-500/20">
            <Icon className="h-5 w-5 text-lime-400" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-white">{title}</h2>
            {description && (
              <p className="text-sm text-zinc-500">{description}</p>
            )}
          </div>
        </div>
      </div>
      <div className="p-4 space-y-4">{children}</div>
    </div>
  );
}

// =============================================================================
// Form Field Components
// =============================================================================

interface TextAreaFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
}

function TextAreaField({ label, value, onChange, placeholder, rows = 3 }: TextAreaFieldProps) {
  return (
    <div>
      <label className="block text-sm font-medium text-zinc-300 mb-2">
        {label}
      </label>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={rows}
        className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-3 text-white placeholder-zinc-500 focus:border-lime-500 focus:outline-none focus:ring-1 focus:ring-lime-500/50 resize-none"
      />
    </div>
  );
}

interface AnnouncementListProps {
  label: string;
  items: string[];
  onChange: (items: string[]) => void;
  placeholder?: string;
}

function AnnouncementList({ label, items, onChange, placeholder }: AnnouncementListProps) {
  const [newItem, setNewItem] = useState('');

  const addItem = () => {
    if (newItem.trim()) {
      onChange([...items, newItem.trim()]);
      setNewItem('');
    }
  };

  const removeItem = (index: number) => {
    onChange(items.filter((_, i) => i !== index));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addItem();
    }
  };

  return (
    <div>
      <label className="block text-sm font-medium text-zinc-300 mb-2">
        {label}
      </label>
      <div className="space-y-2">
        {items.map((item, index) => (
          <div
            key={index}
            className="flex items-center gap-2 p-2 rounded-lg bg-zinc-800 border border-zinc-700"
          >
            <span className="flex-1 text-sm text-white">{item}</span>
            <button
              type="button"
              onClick={() => removeItem(index)}
              className="p-1 rounded text-zinc-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
            >
              <Trash2 size={16} />
            </button>
          </div>
        ))}
        <div className="flex gap-2">
          <input
            type="text"
            value={newItem}
            onChange={(e) => setNewItem(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder || 'Add announcement...'}
            className="flex-1 rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-2 text-white placeholder-zinc-500 focus:border-lime-500 focus:outline-none focus:ring-1 focus:ring-lime-500/50"
          />
          <button
            type="button"
            onClick={addItem}
            disabled={!newItem.trim()}
            className="px-4 py-2 rounded-lg bg-lime-500/20 text-lime-400 font-medium hover:bg-lime-500/30 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Plus size={20} />
          </button>
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// Main Page Component
// =============================================================================

export default function MeetingPrepPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isDirty, setIsDirty] = useState(false);

  // Meeting info
  const nextMeeting = calculateNextMeetingDate();
  const meetingDate = getISODate(nextMeeting);
  const weekNumber = getWeekNumber(nextMeeting);

  // Form state
  const [form, setForm] = useState<FormState>({
    bibleVerse: getBibleVerseByWeek(weekNumber),
    useRandomVerse: false,
    announcements: {
      part1: [],
      part2: [],
    },
    employeeOfMonth: null,
    trainingTopic: '',
    departmentNotes: {
      sales: '',
      operations: '',
      office: '',
      drivers: '',
    },
    specialNotes: '',
    preparedBy: '',
  });

  // Load existing prep data
  useEffect(() => {
    async function loadPrepData() {
      try {
        setLoading(true);
        const res = await fetch(`/api/command-center/meetings?action=prep&date=${meetingDate}`);
        if (!res.ok) {
          throw new Error('Failed to load prep data');
        }
        const json = await res.json();
        if (json.success && json.data) {
          const data = json.data as MeetingPrepData;
          setForm({
            bibleVerse: data.bibleVerse || getBibleVerseByWeek(weekNumber),
            useRandomVerse: data.useRandomVerse || false,
            announcements: data.announcements || { part1: [], part2: [] },
            employeeOfMonth: data.employeeOfMonth || null,
            trainingTopic: data.trainingTopic || '',
            departmentNotes: data.departmentNotes || {
              sales: '',
              operations: '',
              office: '',
              drivers: '',
            },
            specialNotes: data.specialNotes || '',
            preparedBy: data.preparedBy || '',
          });
        }
      } catch {
        // Not an error state - just means no existing data
      } finally {
        setLoading(false);
      }
    }

    loadPrepData();
  }, [meetingDate, weekNumber]);

  // Load from localStorage draft
  useEffect(() => {
    const draft = localStorage.getItem(`meeting-prep-draft-${meetingDate}`);
    if (draft) {
      try {
        const parsedDraft = JSON.parse(draft);
        setForm(parsedDraft);
        setSuccess('Draft loaded from local storage');
        setTimeout(() => setSuccess(null), 3000);
      } catch {
        // Invalid draft, ignore
      }
    }
  }, [meetingDate]);

  // Update form helper
  const updateForm = useCallback(<K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setIsDirty(true);
  }, []);

  // Select random verse
  const selectRandomVerse = () => {
    const verse = getRandomBibleVerse();
    updateForm('bibleVerse', verse);
    updateForm('useRandomVerse', true);
  };

  // Save draft to localStorage
  const saveDraft = () => {
    localStorage.setItem(`meeting-prep-draft-${meetingDate}`, JSON.stringify(form));
    setSuccess('Draft saved to local storage');
    setTimeout(() => setSuccess(null), 3000);
  };

  // Save to server
  const saveToServer = async (markReady: boolean = false) => {
    try {
      setSaving(true);
      setError(null);

      const prepData: Partial<MeetingPrepData> = {
        meetingDate,
        bibleVerse: form.bibleVerse,
        useRandomVerse: form.useRandomVerse,
        announcements: form.announcements,
        employeeOfMonth: form.employeeOfMonth,
        trainingTopic: form.trainingTopic,
        departmentNotes: form.departmentNotes,
        specialNotes: form.specialNotes,
        preparedBy: form.preparedBy,
        status: markReady ? 'ready' : 'draft',
      };

      const res = await fetch('/api/command-center/meetings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'save-prep',
          data: prepData,
        }),
      });

      if (!res.ok) {
        throw new Error('Failed to save prep data');
      }

      const json = await res.json();
      if (!json.success) {
        throw new Error(json.error || 'Failed to save');
      }

      // Clear local draft
      localStorage.removeItem(`meeting-prep-draft-${meetingDate}`);
      setIsDirty(false);

      setSuccess(markReady ? 'Meeting marked as ready!' : 'Prep data saved successfully!');
      setTimeout(() => {
        setSuccess(null);
        if (markReady) {
          router.push('/command-center/meetings');
        }
      }, 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <PermissionGate
      permissions={['dashboard.viewAll']}
      fallback={
        <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
          <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-6 max-w-md">
            <AlertCircle className="h-12 w-12 text-red-400 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-red-400 mb-2">Access Denied</h2>
            <p className="text-zinc-400 mb-4">
              Only Admins and Owners can prepare meeting content.
            </p>
            <Link
              href="/command-center/meetings"
              className="inline-flex items-center gap-2 px-4 py-2 bg-zinc-800 text-white rounded-lg hover:bg-zinc-700 transition"
            >
              <ArrowLeft size={18} />
              Back to Meetings
            </Link>
          </div>
        </div>
      }
    >
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <Link
              href="/command-center/meetings"
              className="inline-flex items-center gap-2 text-sm text-zinc-400 hover:text-white mb-2 transition-colors"
            >
              <ArrowLeft size={16} />
              Back to Meeting Hub
            </Link>
            <h1 className="text-3xl font-bold text-white flex items-center gap-3">
              <Calendar className="h-8 w-8 text-lime-400" />
              Prepare Meeting Content
            </h1>
            <div className="flex items-center gap-4 mt-2">
              <p className="text-zinc-400">
                {formatMeetingDate(nextMeeting)}
              </p>
              <span className="text-zinc-600">|</span>
              <p className="text-zinc-500 flex items-center gap-1">
                <Clock size={14} />
                10:00 AM Central
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={saveDraft}
              className="px-4 py-2 rounded-lg bg-zinc-800 text-zinc-300 font-medium hover:bg-zinc-700 transition-colors"
            >
              Save Draft
            </button>
            <button
              onClick={() => saveToServer(false)}
              disabled={saving}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-zinc-700 text-white font-medium hover:bg-zinc-600 disabled:opacity-50 transition-colors"
            >
              {saving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
              Save
            </button>
            <button
              onClick={() => saveToServer(true)}
              disabled={saving}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-lime-500 text-zinc-900 font-semibold hover:bg-lime-400 disabled:opacity-50 transition-colors"
            >
              {saving ? <Loader2 size={18} className="animate-spin" /> : <CheckCircle2 size={18} />}
              Mark Ready
            </button>
          </div>
        </div>

        {/* Alerts */}
        {error && (
          <div className="flex items-center gap-3 p-4 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400">
            <AlertCircle size={20} />
            <span>{error}</span>
            <button
              onClick={() => setError(null)}
              className="ml-auto p-1 hover:bg-red-500/20 rounded"
            >
              <X size={18} />
            </button>
          </div>
        )}

        {success && (
          <div className="flex items-center gap-3 p-4 rounded-lg bg-lime-500/10 border border-lime-500/20 text-lime-400">
            <CheckCircle2 size={20} />
            <span>{success}</span>
          </div>
        )}

        {isDirty && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20 text-yellow-400 text-sm">
            <AlertCircle size={16} />
            <span>You have unsaved changes</span>
          </div>
        )}

        {/* Form Sections */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Bible Verse */}
          <Section
            title="Bible Verse"
            icon={BookOpen}
            description="Select the inspirational verse for this week"
          >
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <select
                  value={form.bibleVerse?.reference || ''}
                  onChange={(e) => {
                    const verse = BIBLE_VERSES.find((v) => v.reference === e.target.value);
                    if (verse) {
                      updateForm('bibleVerse', verse);
                      updateForm('useRandomVerse', false);
                    }
                  }}
                  className="flex-1 rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-3 text-white focus:border-lime-500 focus:outline-none focus:ring-1 focus:ring-lime-500/50"
                >
                  <option value="">Select a verse...</option>
                  {BIBLE_VERSES.map((verse) => (
                    <option key={verse.reference} value={verse.reference}>
                      {verse.reference} - {verse.theme}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={selectRandomVerse}
                  className="inline-flex items-center gap-2 px-4 py-3 rounded-lg bg-lime-500/20 text-lime-400 font-medium hover:bg-lime-500/30 transition-colors"
                >
                  <Shuffle size={18} />
                  Random
                </button>
              </div>
              {form.bibleVerse && (
                <div className="p-4 rounded-lg bg-zinc-800/50 border border-zinc-700">
                  <p className="text-lg text-white italic">"{form.bibleVerse.text}"</p>
                  <p className="text-sm text-lime-400 mt-2">- {form.bibleVerse.reference}</p>
                  <span className="inline-block mt-2 px-2 py-1 rounded bg-zinc-700 text-xs text-zinc-400">
                    {form.bibleVerse.theme}
                  </span>
                </div>
              )}
            </div>
          </Section>

          {/* Employee of the Month */}
          <Section
            title="Employee of the Month"
            icon={Award}
            description="Recognize an outstanding team member"
          >
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-2">
                  Select Employee
                </label>
                <select
                  value={form.employeeOfMonth?.name || ''}
                  onChange={(e) => {
                    const employee = ELIGIBLE_EMPLOYEES.find((m) => m.name === e.target.value);
                    if (employee) {
                      updateForm('employeeOfMonth', {
                        name: employee.name,
                        department: employee.category,
                        reason: form.employeeOfMonth?.reason || '',
                      });
                    } else {
                      updateForm('employeeOfMonth', null);
                    }
                  }}
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-3 text-white focus:border-lime-500 focus:outline-none focus:ring-1 focus:ring-lime-500/50"
                >
                  <option value="">Select an employee...</option>
                  {DEPARTMENTS.map((dept) => (
                    <optgroup key={dept} label={dept}>
                      {ELIGIBLE_EMPLOYEES.filter((m) => m.category === dept).map((m) => (
                        <option key={m.slug} value={m.name}>
                          {m.name} - {m.position}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </div>
              {form.employeeOfMonth && (
                <TextAreaField
                  label="Recognition Reason"
                  value={form.employeeOfMonth.reason}
                  onChange={(value) =>
                    updateForm('employeeOfMonth', {
                      ...form.employeeOfMonth!,
                      reason: value,
                    })
                  }
                  placeholder="Why is this person being recognized?"
                  rows={3}
                />
              )}
            </div>
          </Section>

          {/* Announcements Part 1 */}
          <Section
            title="Announcements Part 1"
            icon={Megaphone}
            description="Morning announcements (Slide 5)"
          >
            <AnnouncementList
              label="Announcements"
              items={form.announcements.part1}
              onChange={(items) =>
                updateForm('announcements', { ...form.announcements, part1: items })
              }
              placeholder="Add morning announcement..."
            />
          </Section>

          {/* Announcements Part 2 */}
          <Section
            title="Announcements Part 2"
            icon={Megaphone}
            description="Additional announcements (Slide 13)"
          >
            <AnnouncementList
              label="Announcements"
              items={form.announcements.part2}
              onChange={(items) =>
                updateForm('announcements', { ...form.announcements, part2: items })
              }
              placeholder="Add additional announcement..."
            />
          </Section>

          {/* Training Topic */}
          <Section
            title="Training Module"
            icon={GraduationCap}
            description="Weekly training topic (Slide 14)"
          >
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-2">
                Training Topic
              </label>
              <input
                type="text"
                value={form.trainingTopic}
                onChange={(e) => updateForm('trainingTopic', e.target.value)}
                placeholder="Enter this week's training topic..."
                className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-3 text-white placeholder-zinc-500 focus:border-lime-500 focus:outline-none focus:ring-1 focus:ring-lime-500/50"
              />
            </div>
            <TextAreaField
              label="Training Notes (Optional)"
              value={form.specialNotes}
              onChange={(value) => updateForm('specialNotes', value)}
              placeholder="Additional notes for the training module..."
              rows={4}
            />
          </Section>

          {/* Department Notes */}
          <Section
            title="Department Notes"
            icon={Users}
            description="Notes for each department"
          >
            <div className="space-y-4">
              <TextAreaField
                label="Office Notes"
                value={form.departmentNotes.office}
                onChange={(value) =>
                  updateForm('departmentNotes', { ...form.departmentNotes, office: value })
                }
                placeholder="Notes for office staff..."
                rows={2}
              />
              <TextAreaField
                label="Sales Notes"
                value={form.departmentNotes.sales}
                onChange={(value) =>
                  updateForm('departmentNotes', { ...form.departmentNotes, sales: value })
                }
                placeholder="Notes for sales team..."
                rows={2}
              />
              <TextAreaField
                label="Production/Operations Notes"
                value={form.departmentNotes.operations}
                onChange={(value) =>
                  updateForm('departmentNotes', { ...form.departmentNotes, operations: value })
                }
                placeholder="Notes for production team..."
                rows={2}
              />
              <TextAreaField
                label="Drivers Notes"
                value={form.departmentNotes.drivers}
                onChange={(value) =>
                  updateForm('departmentNotes', { ...form.departmentNotes, drivers: value })
                }
                placeholder="Notes for drivers..."
                rows={2}
              />
            </div>
          </Section>
        </div>

        {/* Prepared By */}
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
          <div className="flex items-center gap-4">
            <label className="text-sm font-medium text-zinc-300">
              Prepared By:
            </label>
            <input
              type="text"
              value={form.preparedBy}
              onChange={(e) => updateForm('preparedBy', e.target.value)}
              placeholder="Your name..."
              className="flex-1 max-w-xs rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-2 text-white placeholder-zinc-500 focus:border-lime-500 focus:outline-none focus:ring-1 focus:ring-lime-500/50"
            />
          </div>
        </div>

        {/* Agenda Preview */}
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 overflow-hidden">
          <div className="p-4 border-b border-zinc-800 bg-zinc-800/30">
            <h2 className="text-lg font-semibold text-white">Meeting Agenda Preview</h2>
            <p className="text-sm text-zinc-500">{SLIDES.length} slides total</p>
          </div>
          <div className="p-4">
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {SLIDES.map((slide, index) => (
                <div
                  key={slide.id}
                  className={cn(
                    'p-3 rounded-lg border transition-colors',
                    [5, 13].includes(slide.id)
                      ? 'bg-lime-500/10 border-lime-500/30'
                      : 'bg-zinc-800/50 border-zinc-700'
                  )}
                >
                  <div className="flex items-center gap-2">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-zinc-700 text-xs font-bold text-zinc-300">
                      {index + 1}
                    </span>
                    <span className="text-sm font-medium text-white truncate">
                      {slide.name}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Bottom Actions */}
        <div className="flex items-center justify-between py-4 border-t border-zinc-800">
          <Link
            href="/command-center/meetings"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-zinc-400 hover:text-white transition-colors"
          >
            <ArrowLeft size={18} />
            Cancel
          </Link>
          <div className="flex items-center gap-3">
            <button
              onClick={saveDraft}
              className="px-4 py-2 rounded-lg bg-zinc-800 text-zinc-300 font-medium hover:bg-zinc-700 transition-colors"
            >
              Save Draft
            </button>
            <button
              onClick={() => saveToServer(false)}
              disabled={saving}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-zinc-700 text-white font-medium hover:bg-zinc-600 disabled:opacity-50 transition-colors"
            >
              {saving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
              Save
            </button>
            <button
              onClick={() => saveToServer(true)}
              disabled={saving}
              className="inline-flex items-center gap-2 px-6 py-2 rounded-lg bg-lime-500 text-zinc-900 font-semibold hover:bg-lime-400 disabled:opacity-50 transition-colors"
            >
              {saving ? <Loader2 size={18} className="animate-spin" /> : <CheckCircle2 size={18} />}
              Mark Ready
            </button>
          </div>
        </div>
      </div>
    </PermissionGate>
  );
}
