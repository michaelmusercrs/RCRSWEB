'use client';

/**
 * RCRS Command Center - Meeting Archives Page
 *
 * Browse past meeting records and notes.
 * Shows historical meeting data with filtering and search.
 *
 * @author RCRS Development Team
 * @version 1.0.0
 */

import * as React from 'react';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Calendar,
  Search,
  Archive,
  FileText,
  ChevronRight,
  Filter,
  Download,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { StatCard, LoadingSpinner } from '@/components/command-center';
import {
  getWeeksPresented,
  formatMeetingDate,
  calculateNextMeetingDate,
  getISODate,
} from '@/lib/meeting-data';

// =============================================================================
// Types
// =============================================================================

interface ArchivedMeeting {
  date: string;
  status: 'presented' | 'ready' | 'draft';
  preparedBy: string;
  hasNotes: boolean;
}

// =============================================================================
// Main Page Component
// =============================================================================

export default function MeetingArchivesPage() {
  const [loading, setLoading] = useState(true);
  const [archives, setArchives] = useState<ArchivedMeeting[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');

  // Simulate loading archived meetings
  useEffect(() => {
    // In production, this would fetch from the API
    const mockArchives: ArchivedMeeting[] = [];

    // Generate past 8 weeks of mock data
    const today = new Date();
    for (let i = 1; i <= 8; i++) {
      const meetingDate = new Date(today);
      meetingDate.setDate(meetingDate.getDate() - i * 7);

      // Find the Monday of that week
      const dayOfWeek = meetingDate.getDay();
      const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
      meetingDate.setDate(meetingDate.getDate() + diff);

      mockArchives.push({
        date: getISODate(meetingDate),
        status: i === 1 ? 'ready' : 'presented',
        preparedBy: ['Sara Hill', 'Michael Muse', 'Chris Muse'][i % 3],
        hasNotes: i > 1,
      });
    }

    setTimeout(() => {
      setArchives(mockArchives);
      setLoading(false);
    }, 500);
  }, []);

  // Filter archives
  const filteredArchives = archives.filter((meeting) => {
    // Search filter
    if (searchQuery) {
      const searchLower = searchQuery.toLowerCase();
      const dateStr = formatMeetingDate(new Date(meeting.date)).toLowerCase();
      if (!dateStr.includes(searchLower) && !meeting.preparedBy.toLowerCase().includes(searchLower)) {
        return false;
      }
    }

    // Status filter
    if (filterStatus !== 'all' && meeting.status !== filterStatus) {
      return false;
    }

    return true;
  });

  // Stats
  const weeksPresented = getWeeksPresented();
  const presentedCount = archives.filter((m) => m.status === 'presented').length;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <Link
          href="/command-center/meetings"
          className="inline-flex items-center gap-2 text-sm text-zinc-400 hover:text-white mb-2 transition-colors"
        >
          <ArrowLeft size={16} />
          Back to Meeting Hub
        </Link>
        <h1 className="text-3xl font-bold text-white flex items-center gap-3">
          <Archive className="h-8 w-8 text-lime-400" />
          Meeting Archives
        </h1>
        <p className="text-zinc-400 mt-1">
          Browse and review past meeting records
        </p>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          title="Total Meetings"
          value={weeksPresented}
          icon={Calendar}
          description="this year"
        />
        <StatCard
          title="Archived"
          value={presentedCount}
          icon={Archive}
          description="meetings with records"
        />
        <StatCard
          title="With Notes"
          value={archives.filter((m) => m.hasNotes).length}
          icon={FileText}
          description="documented meetings"
        />
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search
            size={18}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500"
          />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search archives..."
            className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-zinc-700 bg-zinc-800 text-white placeholder-zinc-500 focus:border-lime-500 focus:outline-none focus:ring-1 focus:ring-lime-500/50"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter size={18} className="text-zinc-500" />
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-2.5 text-white focus:border-lime-500 focus:outline-none"
          >
            <option value="all">All Status</option>
            <option value="presented">Presented</option>
            <option value="ready">Ready</option>
            <option value="draft">Draft</option>
          </select>
        </div>
      </div>

      {/* Archives List */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900 overflow-hidden">
        <div className="p-4 border-b border-zinc-800 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">Past Meetings</h2>
          <span className="text-sm text-zinc-500">
            {filteredArchives.length} records
          </span>
        </div>

        {filteredArchives.length === 0 ? (
          <div className="p-8 text-center">
            <Archive className="h-12 w-12 text-zinc-600 mx-auto mb-3" />
            <p className="text-zinc-500">No archived meetings found</p>
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="mt-2 text-sm text-lime-400 hover:text-lime-300"
              >
                Clear search
              </button>
            )}
          </div>
        ) : (
          <div className="divide-y divide-zinc-800">
            {filteredArchives.map((meeting) => (
              <div
                key={meeting.date}
                className="flex items-center gap-4 p-4 hover:bg-zinc-800/50 transition-colors"
              >
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-zinc-800">
                  <Calendar className="h-5 w-5 text-zinc-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-white">
                    {formatMeetingDate(new Date(meeting.date + 'T00:00:00'))}
                  </p>
                  <p className="text-sm text-zinc-500">
                    Prepared by {meeting.preparedBy}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span
                    className={cn(
                      'px-2.5 py-1 rounded-full text-xs font-medium',
                      meeting.status === 'presented' && 'bg-lime-500/20 text-lime-400',
                      meeting.status === 'ready' && 'bg-blue-500/20 text-blue-400',
                      meeting.status === 'draft' && 'bg-zinc-700 text-zinc-400'
                    )}
                  >
                    {meeting.status}
                  </span>
                  {meeting.hasNotes && (
                    <span className="p-1.5 rounded-lg bg-zinc-800 text-zinc-400">
                      <FileText size={16} />
                    </span>
                  )}
                  <ChevronRight size={18} className="text-zinc-600" />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Export Section */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-white">Export Archives</h3>
            <p className="text-sm text-zinc-500">
              Download meeting records as CSV or PDF
            </p>
          </div>
          <button
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-zinc-800 text-zinc-300 font-medium hover:bg-zinc-700 transition-colors"
            onClick={() => alert('Export functionality coming soon!')}
          >
            <Download size={18} />
            Export
          </button>
        </div>
      </div>
    </div>
  );
}
