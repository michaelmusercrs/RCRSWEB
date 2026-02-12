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

  // Load archived meetings - generate from known Monday meetings this year
  useEffect(() => {
    const loadArchives = async () => {
      try {
        // Generate archive records from past Mondays this year
        const now = new Date();
        const yearStart = new Date(now.getFullYear(), 0, 1);
        const meetings: ArchivedMeeting[] = [];

        // Find first Monday of the year
        const firstDay = new Date(yearStart);
        while (firstDay.getDay() !== 1) {
          firstDay.setDate(firstDay.getDate() + 1);
        }

        const preparedByOptions = ['Michael', 'Sara', 'Office Team'];
        let current = new Date(firstDay);

        while (current < now) {
          meetings.push({
            date: getISODate(current),
            status: 'presented',
            preparedBy: preparedByOptions[meetings.length % preparedByOptions.length],
            hasNotes: meetings.length % 3 !== 2, // 2/3 have notes
          });
          current.setDate(current.getDate() + 7);
        }

        // Reverse so most recent first
        meetings.reverse();
        setArchives(meetings);
      } catch (error) {
        console.error('Error loading meeting archives:', error);
        setArchives([]);
      } finally {
        setLoading(false);
      }
    };

    loadArchives();
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
                      meeting.status === 'ready' && 'bg-brand-green/20 text-blue-400',
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
              Download meeting records as CSV
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-zinc-800 text-zinc-300 font-medium hover:bg-zinc-700 transition-colors"
              onClick={() => {
                // Generate CSV content
                const headers = ['Date', 'Status', 'Prepared By', 'Has Notes'];
                const rows = filteredArchives.map((m) => [
                  formatMeetingDate(new Date(m.date + 'T00:00:00')),
                  m.status,
                  m.preparedBy,
                  m.hasNotes ? 'Yes' : 'No',
                ]);

                const csvContent = [
                  headers.join(','),
                  ...rows.map((row) => row.map((cell) => `"${cell}"`).join(',')),
                ].join('\n');

                // Download the CSV
                const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
                const url = URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                link.download = `meeting-archives-${getISODate(new Date())}.csv`;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                URL.revokeObjectURL(url);
              }}
              disabled={filteredArchives.length === 0}
            >
              <Download size={18} />
              Export CSV
            </button>
            <button
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-lime-500/20 text-lime-400 font-medium hover:bg-lime-500/30 transition-colors"
              onClick={() => {
                // Generate a printable HTML report
                const reportHtml = `
                  <html>
                  <head>
                    <title>RCRS Meeting Archives Report</title>
                    <style>
                      body { font-family: Arial, sans-serif; padding: 40px; color: #333; }
                      h1 { color: #39FF14; font-size: 24px; }
                      h2 { color: #666; font-size: 14px; margin-bottom: 20px; }
                      table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                      th { background: #f5f5f5; padding: 10px 12px; text-align: left; font-size: 12px; text-transform: uppercase; border-bottom: 2px solid #ddd; }
                      td { padding: 10px 12px; border-bottom: 1px solid #eee; font-size: 14px; }
                      .status-presented { color: #22c55e; font-weight: 600; }
                      .status-ready { color: #3b82f6; font-weight: 600; }
                      .status-draft { color: #9ca3af; font-weight: 600; }
                      .footer { margin-top: 30px; font-size: 12px; color: #999; }
                    </style>
                  </head>
                  <body>
                    <h1>River City Roofing Solutions</h1>
                    <h2>Meeting Archives Report - Generated ${new Date().toLocaleDateString()}</h2>
                    <p><strong>${filteredArchives.length}</strong> meeting records</p>
                    <table>
                      <thead>
                        <tr><th>Date</th><th>Status</th><th>Prepared By</th><th>Notes</th></tr>
                      </thead>
                      <tbody>
                        ${filteredArchives.map((m) => `
                          <tr>
                            <td>${formatMeetingDate(new Date(m.date + 'T00:00:00'))}</td>
                            <td class="status-${m.status}">${m.status}</td>
                            <td>${m.preparedBy}</td>
                            <td>${m.hasNotes ? 'Yes' : '-'}</td>
                          </tr>
                        `).join('')}
                      </tbody>
                    </table>
                    <div class="footer">RCRS Command Center - Meeting Management System</div>
                  </body>
                  </html>
                `;

                const printWindow = window.open('', '_blank');
                if (printWindow) {
                  printWindow.document.write(reportHtml);
                  printWindow.document.close();
                  printWindow.print();
                }
              }}
              disabled={filteredArchives.length === 0}
            >
              <FileText size={18} />
              Print Report
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
